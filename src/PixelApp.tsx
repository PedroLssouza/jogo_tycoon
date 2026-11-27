import { useEffect, useRef, useState } from 'react'
import { createEmployee } from './employees'
import {
  calculateProjectQuality,
  calculateTaskGain,
  contractDaysRemaining,
  createInitialState,
  createProjectTasks,
  dailyEmployeeCost,
  PSYCHOLOGIST_DAILY,
  evaluateOffer,
  getAllStarterContracts,
  GPU_PRICE,
  gpusOf,
  withGpuGift,
  TURBO_DAYS,
  turboDaysLeft,
  settlementFor,
  taskDependenciesDone,
} from './game'
import { deleteSave, loadGame, saveGame } from './storage'
import type { Contract, Difficulty, Employee, GameState, Role, Task } from './types'
import { clamp, formatMoney, uid } from './utils'
import { MalwareGame } from './MalwareGame'
import type { RackView, TutorAct } from './PixelScenes'
import { BuildingScene, ClaudeIcon, FoundingScene, MenuScene, LoungeScene, OfficeScene, PixelIcon, Portrait, ServerRoom, GpuIcon, SpinningCoin, TutorScene, VictoryScene } from './PixelScenes'
import { applyFatigue, restAfterProject, WELLNESS, deskCapacity, FLOORS, hostingDaysLeft, hostingIncome, racksInUse, refillHosting, daysToBankruptcy, eventById, endOfDay, LOAN, newAchievements, nextOffice, officeOf, refillMarket, SALE_PRICE, SALE_REVENUE_GOAL, saleReady, statsOf, bump, log } from './progression'
import { sfx } from './sound'
import { playMusic, stopMusic, unlockAudioOnGesture } from './music'
import type { TrackId } from './music'
import type { Sound } from './sound'
import { PixelModal } from './PixelModal'
import { DiaryModal, ElevatorModal, EndingScreen, EventModal, SaleModal } from './PixelPanels'
import type { FloorId } from './PixelPanels'
import './pixel.css'

type PixelScreen = 'menu' | 'office' | 'contract' | 'kanban' | 'results' | 'ending' | 'floor2' | 'servers' | 'lounge'
type Modal = 'setup' | 'negotiation' | 'tasks' | 'team' | 'finance' | 'malware' | 'tutor' | 'event' | 'diary' | 'sale' | 'elevator' | null

const ROLE_LABEL: Record<Role, string> = {
  frontend: 'Front-end',
  backend: 'Back-end',
  fullstack: 'Full Stack',
  designer: 'UI/UX Designer',
  qa: 'QA / Testes',
  pm: 'Gerente / PM',
  devops: 'DevOps & Cloud',
}


const ROLE_COLOR: Record<Role, string> = {
  frontend: '#10b981',
  backend: '#6366f1',
  fullstack: '#2563eb',
  designer: '#ec4899',
  qa: '#f59e0b',
  pm: '#14b8a6',
  devops: '#ef4444',
}

/* Equipe mais o coringa em ação, para achar quem faz cada tarefa */
function staffOf(state: GameState): Employee[] {
  return state.joker ? [...state.employees, state.joker] : state.employees
}

/* Qualidade com que alguém entrega a tarefa hoje */
function deliveryQuality(employee: Employee | undefined, task: Task, officeBonus = 0) {
  const isIdeal = employee?.role === task.requiredRole
  const isAlt = employee && ((task.secondaryRole && employee.role === task.secondaryRole) || (employee.role === 'fullstack' && ['frontend', 'backend'].includes(task.requiredRole)))
  const techBonus = isIdeal ? 10 : isAlt ? 5 : -4
  return clamp(Math.round((employee?.quality ?? 60) * .88 + (employee?.energy ?? 60) * .12 + techBonus + officeBonus), 50, 100)
}

const JOKER_QUALITY_LOSS = 5

/* O coringa não custa nada, mas entrega um pouco abaixo de quem substitui
   (ou da média da equipe, se ninguém estava na tarefa) */
function jokerQuality(state: GameState, task: Task) {
  const replaced = state.employees.find(item => item.id === task.assignedTo)
  const team = replaced ? [replaced] : state.employees
  const usual = team.length ? team.reduce((sum, item) => sum + deliveryQuality(item, task), 0) / team.length : 60
  return Math.round(usual) - JOKER_QUALITY_LOSS
}

function canFightMalware(state: GameState) {
  return !state.jokers && !state.joker && state.jokerDay !== state.day
}

function PixelApp() {
  const [state, setState] = useState<GameState | null>(() => {
    const saved = loadGame()
    if (!saved) return null
    const loaded = withGpuGift(saved)
    if ((!loaded.availableContracts || loaded.availableContracts.length <= 1) && loaded.contracts.length === 0) {
      return { ...loaded, availableContracts: getAllStarterContracts() }
    }
    // Saves antigos podiam ficar sem propostas depois dos 5 contratos iniciais
    return loaded.availableContracts.length < 3 ? refillMarket(loaded) : loaded
  })
  const [screen, setScreen] = useState<PixelScreen>('menu')
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [company, setCompany] = useState('Pixel Forge')
  const [founder, setFounder] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [contractIndex, setContractIndex] = useState(0)
  const [offerValue, setOfferValue] = useState(30_000)
  const [offerDeadline, setOfferDeadline] = useState(45)
  const [negotiationMessage, setNegotiationMessage] = useState('')
  const [lastSettlement, setLastSettlement] = useState<{
    payment: number; earlyBonus: number; qualityBonus: number; penalty: number;
    quality: number; daysRemaining: number; reputationDelta: number;
    projectName: string; clientName: string;
  } | null>(null)

  useEffect(() => { if (state) saveGame(state) }, [state])
  useEffect(() => unlockAudioOnGesture(), [])
  // Música ambiente: uma para a tela inicial, uma para o escritório e uma por andar
  useEffect(() => {
    const track: TrackId = screen === 'menu' || screen === 'ending' ? 'menu' : screen === 'floor2' ? 'team' : screen === 'servers' ? 'servers' : screen === 'lounge' ? 'lounge' : 'office'
    playMusic(track)
  }, [screen])
  useEffect(() => () => stopMusic(), [])
  useEffect(() => {
    if (!state) return
    const unlocked = newAchievements(state)
    if (!unlocked.length) return
    setState(current => current && { ...current, achievements: [...(current.achievements ?? []), ...unlocked.map(a => a.id)] })
    sfx('achievement')
    setToast(`🏅 Conquista: ${unlocked.map(a => a.title).join(', ')}!`)
  }, [state])
  useEffect(() => {
    if (state?.ended && screen !== 'ending' && screen !== 'menu') { setModal(null); setScreen('ending') }
  }, [state?.ended, screen])
  useEffect(() => {
    if (!state || modal || !['office', 'kanban', 'contract'].includes(screen)) return
    if (state.pendingEvent) setModal('event')
    else if (saleReady(state) && !state.saleOfferSeen) setModal('sale')
  }, [state, modal, screen])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const available = state?.availableContracts ?? []
  const safeIndex = available.length > 0 ? Math.min(contractIndex, available.length - 1) : 0
  const currentProposal = available[safeIndex]

  const project = state?.contracts.find(contract => ['accepted', 'inprogress'].includes(contract.status))
    ?? state?.contracts.find(contract => contract.status === 'completed')
  const completion = project?.tasks.length
    ? Math.round(project.tasks.reduce((total, task) => total + task.progress, 0) / project.tasks.length)
    : 0

  function newGame() {
    setModal('setup')
  }

  function confirmNewGame() {
    const next = createInitialState(company.trim() || 'Pixel Forge', founder.trim() || 'Fundador(a)', difficulty)
    setState(next)
    setContractIndex(0)
    setModal(null)
    setScreen('office')
    setToast('Empresa criada com sucesso! 5 contratos abertos no mercado.')
  }

  function continueGame() {
    if (!state) return newGame()
    setScreen(state.ended ? 'ending' : 'office')
  }

  function signContract(contractToSign: Contract, value: number, deadlineDays: number) {
    if (state?.contracts.some(contract => ['accepted', 'inprogress'].includes(contract.status))) {
      sfx('error')
      setToast('Termine o projeto atual antes de aceitar outro.')
      return
    }
    sfx('coin')
    setState(current => {
      if (!current) return current
      const accepted: Contract = {
        ...contractToSign,
        value,
        deadlineDays,
        acceptedAt: current.day,
        status: 'accepted',
        rejectionReason: null,
        tasks: createProjectTasks(contractToSign.id),
      }
      return {
        ...current,
        contracts: [...current.contracts, accepted],
        availableContracts: current.availableContracts.filter(c => c.id !== contractToSign.id),
        selectedProjectId: accepted.id,
        currentScreen: 'kanban',
        notifications: [{ id: uid(), type: 'success', message: `Contrato assinado com ${contractToSign.client}.`, day: current.day, read: false }, ...current.notifications],
        gameLog: [{ day: current.day, message: `Contrato fechado com ${contractToSign.client} por ${formatMoney(value)} em ${deadlineDays} dias.` }, ...current.gameLog],
      }
    })
    setModal(null)
    setScreen('kanban')
    setToast(`Contrato com ${contractToSign.client} fechado! Distribua o backlog.`)
  }

  function sendCounterOffer() {
    if (!state || !currentProposal) return
    const evaluation = evaluateOffer(currentProposal, offerValue, offerDeadline, state.reputation)
    if (evaluation.accepted) {
      setNegotiationMessage('Proposta aceita! O cliente aprovou suas condições.')
      window.setTimeout(() => signContract(currentProposal, offerValue, offerDeadline), 650)
      return
    }
    const message = evaluation.reason === 'both'
      ? `Recusada: valor e prazo altos. O cliente sinalizou até ${formatMoney(evaluation.maxValue)} e ${evaluation.maxDeadline} dias.`
      : evaluation.reason === 'value'
        ? `Recusada: o valor está alto. O cliente sinalizou até ${formatMoney(evaluation.maxValue)}.`
        : `Recusada: o prazo está longo. O cliente espera no máximo ${evaluation.maxDeadline} dias.`
    setNegotiationMessage(message)
    setState(current => current ? {
      ...current,
      availableContracts: current.availableContracts.map(contract => contract.id === currentProposal.id ? {
        ...contract,
        status: 'rejected',
        value: offerValue,
        deadlineDays: offerDeadline,
        rejectionReason: evaluation.reason,
        negotiationAttempts: contract.negotiationAttempts + 1,
      } : contract),
      gameLog: [{ day: current.day, message }, ...current.gameLog],
    } : current)
  }

  function openNegotiation(contract: Contract) {
    setOfferValue(contract.value)
    setOfferDeadline(contract.deadlineDays)
    setNegotiationMessage(contract.status === 'rejected' ? 'Ajuste a proposta conforme o retorno do cliente.' : '')
    setModal('negotiation')
  }

  function assignTask(taskId: string, employeeId: string) {
    let synergyFeedback = 'Desenvolvedor alocado com sucesso!'
    setState(current => {
      if (!current) return current
      const active = current.contracts.find(contract => contract.id === project?.id)
      const task = active?.tasks.find(item => item.id === taskId)
      if (!active || !task || !taskDependenciesDone(task, active.tasks)) return current
      const busy = current.contracts.some(contract => contract.tasks.some(item => item.assignedTo === employeeId && item.status === 'inprogress'))
      if (busy) { setToast('Esse profissional já está trabalhando em outra tarefa.'); return current }
      if (current.employees.find(e => e.id === employeeId)?.state === 'burnout') { setToast('Em burnout: trate com um psicólogo antes.'); return current }

      const dev = current.employees.find(e => e.id === employeeId)
      if (dev) {
        const isIdeal = dev.role === task.requiredRole
        const isAlt = (task.secondaryRole && dev.role === task.secondaryRole) || (dev.role === 'fullstack' && ['frontend', 'backend'].includes(task.requiredRole))
        if (isIdeal) {
          synergyFeedback = `⭐ Perfeito! ${dev.name} domina ${task.technology || 'a tecnologia'} (+35% de velocidade)!`
        } else if (isAlt) {
          synergyFeedback = `⚡ Boa escolha! ${dev.name} tem adaptação em ${task.technology || 'a tecnologia'} (+15% de bônus).`
        } else {
          synergyFeedback = `⚠️ Alocação básica: ${dev.name} (${ROLE_LABEL[dev.role]}) produzirá em ritmo padrão.`
        }
      }

      return {
        ...current,
        contracts: current.contracts.map(contract => contract.id !== active.id ? contract : {
          ...contract,
          status: 'inprogress',
          tasks: contract.tasks.map(item => item.id === taskId ? {
            ...item, assignedTo: employeeId, status: 'inprogress', startedAt: item.startedAt ?? current.day,
          } : item),
        }),
        employees: current.employees.map(employee => employee.id === employeeId
          ? { ...employee, state: 'working', currentTaskId: taskId }
          : employee),
      }
    })
    setToast(synergyFeedback)
  }

  function advanceDay() {
    if (!state || state.ended) return
    const current = state
    const cost = dailyEmployeeCost(current)
    const turbo = turboDaysLeft(current) > 0
    const office = officeOf(current)
    let reachedReview = 0
    const contracts = current.contracts.map(contract => {
      if (!['accepted', 'inprogress'].includes(contract.status)) return contract
      return {
        ...contract,
        status: 'inprogress' as const,
        tasks: contract.tasks.map(task => {
          if (task.status !== 'inprogress' || !task.assignedTo) return task
          const employee = staffOf(current).find(item => item.id === task.assignedTo)
          if (!employee) return task
          // No turbo, cada tarefa anda o dobro: meio período por etapa
          // Turbo dobra; psicóloga na empresa ajuda; muito cansado rende menos
          const tired = employee.energy < 25 ? 0.6 : 1
          const gain = calculateTaskGain(employee, task, current.difficulty) * (turbo ? 2 : 1) * (current.psychologist ? WELLNESS.psychBoost : 1) * tired
          const progress = clamp(task.progress + gain)
          if (progress >= 100) reachedReview += 1
          return { ...task, progress, status: progress >= 100 ? 'review' as const : task.status }
        }),
      }
    })
    const busyIds = new Set(contracts.flatMap(contract => contract.tasks.filter(task => task.status === 'inprogress').map(task => task.assignedTo)))
    const worked: GameState = {
      ...current,
      day: current.day + 1,
      balance: current.balance - cost,
      expenses: current.expenses + cost,
      profit: current.revenue - current.expenses - cost,
      contracts,
      employees: current.employees,
      gameLog: [{ day: current.day + 1, message: reachedReview ? `${reachedReview} tarefa(s) pronta(s) para validação.` : `Custo operacional diário: ${formatMoney(cost)}.` }, ...current.gameLog].slice(0, 80),
    }
    const fatigue = applyFatigue(worked, busyIds, turbo, office.energy)
    const { state: next, news } = endOfDay(fatigue.state)
    setState(next)
    if (news.bankrupt) return
    if (news.event) { sfx('event'); setModal('event'); return }
    sfx('day')
    if (fatigue.news.burnout.length) {
      sfx('hurt')
      setToast(`🔥 ${fatigue.news.burnout.join(', ')} teve burnout! Pague um psicólogo na tela Equipe.`)
      return
    }
    setToast(fatigue.news.treated.length ? `🧠 A psicóloga evitou o burnout de ${fatigue.news.treated.join(', ')}.`
      : fatigue.news.exhausted.length ? `😩 ${fatigue.news.exhausted.join(', ')} se esgotou (1/2). Mais uma vez e é burnout!`
      : news.hostingEnded ? `🖥 Locação encerrada: ${news.hostingEnded.join(', ')}. Racks livres!`
      : news.quit ? `😢 ${news.quit} pediu demissão por estar insatisfeito.`
      : news.loanPaid ? `🏦 Empréstimo quitado: −${formatMoney(news.loanPaid)}.`
      : reachedReview ? `✓ ${reachedReview} tarefa(s) pronta(s) para validar!`
      : news.newOffer ? '📬 Nova proposta no mercado!'
      : 'Dia avançado: progresso, caixas e energia atualizados!')
  }

  function approveTask(taskId: string) {
    let finished = false
    let earnedGpu = false
    setState(current => {
      if (!current) return current
      const active = current.contracts.find(contract => contract.id === project?.id)
      const task = active?.tasks.find(item => item.id === taskId)
      if (!active || !task || task.status !== 'review') return current
      const employee = staffOf(current).find(item => item.id === task.assignedTo)
      // A qualidade do coringa já foi definida quando ele assumiu a tarefa
      const quality = employee && employee.id === current.joker?.id ? employee.quality : deliveryQuality(employee, task, officeOf(current).quality)
      let updated: Contract = {
        ...active,
        tasks: active.tasks.map(item => item.id === taskId
          ? { ...item, status: 'done', quality, errors: quality < 70 ? 1 : 0 }
          : item),
      }
      finished = updated.tasks.every(item => item.status === 'done')
      let balance = current.balance
      let revenue = current.revenue
      let reputation = current.reputation
      if (finished) {
        const settlement = settlementFor(updated, current.day)
        updated = { ...updated, status: 'completed', completedAt: current.day }
        balance += settlement.payment
        revenue += settlement.payment
        reputation = clamp(reputation + settlement.reputationDelta)
        if (settlement.quality >= 100) earnedGpu = true
        // Salvar dados de settlement para a tela de resultados
        window.setTimeout(() => setLastSettlement({
          payment: settlement.payment,
          earlyBonus: settlement.earlyBonus,
          qualityBonus: settlement.qualityBonus,
          penalty: settlement.penalty,
          quality: settlement.quality,
          daysRemaining: settlement.daysRemaining,
          reputationDelta: settlement.reputationDelta,
          projectName: active.name,
          clientName: active.client,
        }), 0)
      }
      const after: GameState = {
        ...current,
        balance,
        revenue,
        reputation,
        joker: current.joker?.id === task.assignedTo ? null : current.joker,
        gpus: gpusOf(current) + (earnedGpu ? 1 : 0),
        profit: revenue - current.expenses,
        contracts: current.contracts.map(contract => contract.id === active.id ? updated : contract),
        employees: current.employees.map(item => item.id === task.assignedTo ? { ...item, state: 'idle', currentTaskId: null } : item),
      }
      if (!finished) return after
      // Projeto entregue: conta para as conquistas e o mercado ganha novas propostas
      const delivered = refillMarket(restAfterProject(log(bump(after, 'contractsDone'), `${active.name} entregue para ${active.client}.`)))
      return earnedGpu ? bump(delivered, 'perfect') : delivered
    })
    if (finished) sfx('win')
    if (finished) { setModal(null); setScreen('results'); setToast(earnedGpu ? '🎉 Entrega perfeita! Você ganhou uma placa de vídeo.' : '🎉 Projeto concluído e entregue com sucesso!') }
    else setToast('✓ Tarefa validada e movida para Concluído.')
  }

  function feedTutor() {
    setState(current => {
      if (!current || gpusOf(current) < 1 || turboDaysLeft(current) > 0) return current
      return {
        ...current,
        gpus: gpusOf(current) - 1,
        turboUntil: current.day + TURBO_DAYS,
        stats: { ...statsOf(current), gpusEaten: statsOf(current).gpusEaten + 1 },
        employees: current.employees.map(employee => ({ ...employee, energy: clamp(employee.energy * 2) })),
      }
    })
  }

  function buyGpu() {
    setState(current => {
      if (!current || current.balance < GPU_PRICE) return current
      return { ...current, gpus: gpusOf(current) + 1, balance: current.balance - GPU_PRICE, expenses: current.expenses + GPU_PRICE }
    })
    sfx('coin')
    setToast('Placa de vídeo comprada!')
  }

  function startMalware() {
    if (!state) return
    if (state.joker) setToast('O Claude já está trabalhando em uma tarefa.')
    else if (state.jokers) setToast('Você já tem um coringa. Use-o em uma tarefa do quadro.')
    else if (!canFightMalware(state)) setToast('Você já enfrentou o malware hoje. Avance um dia.')
    else setModal('malware')
  }

  function callJoker(taskId: string) {
    setState(current => {
      if (!current?.jokers || current.joker) return current
      const active = current.contracts.find(contract => contract.id === project?.id)
      const task = active?.tasks.find(item => item.id === taskId)
      if (!active || !task || !['todo', 'inprogress'].includes(task.status) || !taskDependenciesDone(task, active.tasks)) return current
      const replaced = task.assignedTo
      const joker: Employee = {
        id: `claude-${taskId}`, name: 'Claude', role: task.requiredRole, salary: 0, experience: 100,
        productivity: 80, speed: 80, quality: jokerQuality(current, task), specialization: 'Coringa', satisfaction: 100, energy: 100,
        state: 'working', currentTaskId: taskId, hiredAt: current.day,
      }
      return {
        ...current,
        jokers: current.jokers - 1,
        joker,
        contracts: current.contracts.map(contract => contract.id !== active.id ? contract : {
          ...contract,
          status: 'inprogress',
          tasks: contract.tasks.map(item => item.id === taskId
            ? { ...item, assignedTo: joker.id, status: 'inprogress', startedAt: item.startedAt ?? current.day }
            : item),
        }),
        employees: current.employees.map(item => item.id === replaced ? { ...item, state: 'idle', currentTaskId: null } : item),
      }
    })
    setToast('Claude assumiu a tarefa!')
  }

  function hire(role: Role, senior = false) {
    if (!state) return
    if (state.employees.length >= deskCapacity(state)) {
      sfx('error')
      setToast('Sem mesas livres! Amplie o escritório ou compre um andar pelo elevador.')
      return
    }
    if (senior ? gpusOf(state) < 2 : state.balance < 1_200) { sfx('error'); return }
    setState(current => {
      if (!current) return current
      const employee = createEmployee(role, senior ? 80 : 15)
      employee.hiredAt = current.day
      const paid = senior
        ? { ...current, gpus: gpusOf(current) - 2 }
        : { ...current, balance: current.balance - 1_200, expenses: current.expenses + 1_200 }
      return log({ ...paid, employees: [...current.employees, employee] }, `${employee.name} foi contratado(a).`)
    })
    sfx('coin')
    setToast(senior ? 'Talento sênior recrutado com 2 placas de vídeo!' : 'Novo talento contratado por R$ 1.200.')
  }

  function upgradeOffice() {
    const target = state && nextOffice(state)
    if (!state || !target || state.balance < target.cost) { sfx('error'); return }
    setState(current => current && log({
      ...current,
      officeLevel: target.level,
      balance: current.balance - target.cost,
      expenses: current.expenses + target.cost,
    }, `Mudança para: ${target.name}.`))
    sfx('win')
    setToast(`🏢 Bem-vindo ao ${target.name}! Agora cabem ${target.desks} pessoas.`)
  }

  function takeLoan() {
    if (!state || state.loan) return
    setState(current => current && log({
      ...current,
      balance: current.balance + LOAN.amount,
      loan: { owed: LOAN.owed, dueDay: current.day + LOAN.days },
    }, `Empréstimo de ${formatMoney(LOAN.amount)} contratado.`))
    sfx('coin')
    setToast(`🏦 ${formatMoney(LOAN.amount)} na conta. Devolva ${formatMoney(LOAN.owed)} em ${LOAN.days} dias.`)
  }

  function repayLoan() {
    if (!state?.loan || state.balance < state.loan.owed) { sfx('error'); return }
    setState(current => current?.loan ? log({
      ...current,
      balance: current.balance - current.loan.owed,
      expenses: current.expenses + current.loan.owed,
      loan: null,
    }, 'Empréstimo quitado antes do prazo.') : current)
    sfx('coin')
    setToast('🏦 Empréstimo quitado!')
  }

  function giveBonus(employeeId: string) {
    if (!state || state.balance < 1_000) { sfx('error'); return }
    setState(current => current && {
      ...current,
      balance: current.balance - 1_000,
      expenses: current.expenses + 1_000,
      employees: current.employees.map(e => e.id === employeeId ? { ...e, satisfaction: clamp(e.satisfaction + 25), energy: clamp(e.energy + 10) } : e),
    })
    sfx('coin')
    setToast('🎁 Bônus pago! A pessoa ficou bem mais feliz.')
  }

  function deployNow(taskId: string) {
    if (!state || gpusOf(state) < 1) { sfx('error'); return }
    setState(current => current && {
      ...current,
      gpus: gpusOf(current) - 1,
      contracts: current.contracts.map(contract => ({
        ...contract,
        tasks: contract.tasks.map(task => task.id === taskId && task.status === 'inprogress' ? { ...task, progress: 100, status: 'review' } : task),
      })),
    })
    sfx('coin')
    setToast('⚡ Deploy instantâneo! A tarefa está pronta para validar.')
  }

  function resolveEvent(option: number) {
    const event = eventById(state?.pendingEvent)
    if (!state || !event) { setModal(null); return }
    const choice = event.options[option]
    if (choice.can && !choice.can(state)) { sfx('error'); return }
    setState(current => current && log({ ...choice.apply(current), pendingEvent: null }, `${event.title} ${choice.label}.`))
    sfx('click')
    setModal(null)
  }

  function sellCompany() {
    if (!state || !saleReady(state)) return
    setState(current => current && log({
      ...current,
      balance: current.balance + SALE_PRICE,
      saleOfferSeen: true,
      ended: { kind: 'sold', day: current.day },
    }, `${current.company} foi vendida por ${formatMoney(SALE_PRICE)}!`))
    sfx('win')
    setModal(null)
    setScreen('ending')
  }

  function buyFloor(kind: 'team' | 'servers') {
    const floor = FLOORS[kind]
    if (!state || state.floors?.[kind] || state.balance < floor.price) { sfx('error'); return }
    setState(current => {
      if (!current) return current
      const bought = log({
        ...current,
        floors: { ...current.floors, [kind]: true },
        balance: current.balance - floor.price,
        expenses: current.expenses + floor.price,
      }, `Andar comprado: ${floor.name}.`)
      return kind === 'servers' ? refillHosting({ ...bought, hostingDay: current.day }) : bought
    })
    sfx('win')
    setToast(kind === 'team' ? `🏢 ${floor.name} liberado: +${FLOORS.team.desks} mesas!` : `🖥 ${floor.name} liberado: alugue racks para clientes!`)
  }

  function rideTo(floor: FloorId) {
    setModal(null)
    setScreen(floor === 'team' ? 'floor2' : floor === 'servers' ? 'servers' : 'office')
  }

  function acceptHosting(dealId: string) {
    const deal = state?.hostingOffers?.find(item => item.id === dealId)
    if (!state || !deal || racksInUse(state) + deal.racks > FLOORS.servers.racks) { sfx('error'); return }
    setState(current => current && log({
      ...current,
      hostingOffers: (current.hostingOffers ?? []).filter(item => item.id !== dealId),
      hosting: [...(current.hosting ?? []), { ...deal, startDay: current.day }],
    }, `Locação fechada: ${deal.client} (${deal.racks} rack${deal.racks > 1 ? 's' : ''}).`))
    sfx('coin')
    setToast(`🖥 ${deal.client} alugou ${deal.racks} rack${deal.racks > 1 ? 's' : ''}: +${formatMoney(deal.dailyRent)} por dia.`)
  }

  function treatBurnout(employeeId: string) {
    if (!state || state.balance < WELLNESS.treatPrice) { sfx('error'); return }
    setState(current => current && log({
      ...current,
      balance: current.balance - WELLNESS.treatPrice,
      expenses: current.expenses + WELLNESS.treatPrice,
      employees: current.employees.map(e => e.id === employeeId ? { ...e, state: 'idle', energy: 70, zeroes: 0, satisfaction: clamp(e.satisfaction + 10) } : e),
    }, 'Sessões de psicólogo pagas para tratar um burnout.'))
    sfx('coin')
    setToast('🧠 Tratamento pago! A pessoa voltou com 70% de energia.')
  }

  function hirePsychologist() {
    if (!state || state.psychologist || state.balance < WELLNESS.psychHire) { sfx('error'); return }
    setState(current => current && log({
      ...current,
      psychologist: true,
      balance: current.balance - WELLNESS.psychHire,
      expenses: current.expenses + WELLNESS.psychHire,
      // quem já estava em burnout é atendido na hora
      employees: current.employees.map(e => e.state === 'burnout' ? { ...e, state: 'idle', energy: 70, zeroes: 0 } : e),
    }, 'Psicóloga contratada para a empresa.'))
    sfx('win')
    setToast('🧠 Psicóloga contratada! Equipe +15% produtiva e sem burnouts.')
  }

  function buyLounge() {
    if (!state || state.lounge || state.balance < WELLNESS.loungePrice) { sfx('error'); return }
    setState(current => current && log({
      ...current,
      lounge: true,
      balance: current.balance - WELLNESS.loungePrice,
      expenses: current.expenses + WELLNESS.loungePrice,
    }, 'Sala de jogos e descanso inaugurada.'))
    sfx('win')
    setToast('🎮 Sala de jogos e descanso pronta! Quem estiver sem tarefa recupera energia.')
  }

  function startOver() {
    deleteSave()
    setState(null)
    setScreen('menu')
    setModal('setup')
  }

  function resetSave() {
    deleteSave()
    setState(null)
    setModal(null)
    setScreen('menu')
    setToast('Partida apagada. Inicie uma nova software house.')
  }

  return (
    <div className="pixel-app">
      <div className="pixel-stars" />

      <main className="pixel-stage">
        {screen === 'menu' && (
          <NativeMenuScene
            hasSave={Boolean(state)}
            onNew={newGame}
            onContinue={continueGame}
          />
        )}
        {screen === 'office' && (
          <NativeOfficeScene
            state={state}
            onContract={() => setScreen('contract')}
            onKanban={() => setScreen('kanban')}
            onTeam={() => setModal('team')}
            onFinance={() => setModal('finance')}
            onMenu={() => setScreen('menu')}
            onClaude={startMalware}
            onTutor={() => setModal('tutor')}
            onDiary={() => setModal('diary')}
            onSale={() => setModal('sale')}
            onElevator={() => setModal('elevator')}
            onLounge={() => setScreen('lounge')}
          />
        )}
        {screen === 'contract' && (
          <MultiContractScreen
            state={state}
            contracts={available}
            currentIndex={safeIndex}
            onSelectIndex={setContractIndex}
            project={project}
            onBack={() => setScreen('office')}
            onAccept={(c) => signContract(c, c.value, c.deadlineDays)}
            onNegotiate={(c) => openNegotiation(c)}
            onKanban={() => setScreen('kanban')}
          />
        )}
        {screen === 'kanban' && (
          <NativeKanbanScene
            state={state}
            project={project && ['accepted', 'inprogress'].includes(project.status) ? project : undefined}
            completion={completion}
            onAssign={assignTask}
            onApprove={approveTask}
            onAdvance={advanceDay}
            onBack={() => setScreen('office')}
            onTeam={() => setModal('team')}
            onContract={() => setScreen('contract')}
            onJoker={callJoker}
            onDeploy={deployNow}
            onMalware={startMalware}
          />
        )}
        {screen === 'floor2' && state && (
          <TeamFloorScene state={state} onTeam={() => setModal('team')} onKanban={() => setScreen('kanban')} onElevator={() => setModal('elevator')} />
        )}
        {screen === 'lounge' && state && (
          <LoungeFloorScene state={state} onBuy={buyLounge} onBack={() => setScreen('office')} onTeam={() => setModal('team')} onKanban={() => setScreen('kanban')} />
        )}
        {screen === 'servers' && state && (
          <ServerFloorScene state={state} onAccept={acceptHosting} onElevator={() => setModal('elevator')} />
        )}
        {screen === 'ending' && state?.ended && (
          <EndingScreen state={state} onRestart={startOver} onMenu={() => setScreen('menu')} />
        )}
        {screen === 'results' && (
          <NativeResultsScene
            state={state}
            project={project}
            settlement={lastSettlement}
            onContinue={() => { setScreen('office'); setLastSettlement(null) }}
          />
        )}
      </main>

      {modal === 'setup' && (
        <SetupModal
          company={company}
          founder={founder}
          difficulty={difficulty}
          onCompany={setCompany}
          onFounder={setFounder}
          onDifficulty={setDifficulty}
          onClose={() => setModal(null)}
          onConfirm={confirmNewGame}
        />
      )}
      {modal === 'negotiation' && currentProposal && (
        <NegotiationModal
          contract={currentProposal}
          value={offerValue}
          deadline={offerDeadline}
          message={negotiationMessage}
          onValue={setOfferValue}
          onDeadline={setOfferDeadline}
          onClose={() => setModal(null)}
          onSend={sendCounterOffer}
        />
      )}
      {modal === 'tasks' && state && project && (
        <TaskModal
          state={state}
          project={project}
          onClose={() => setModal(null)}
          onAssign={assignTask}
          onApprove={approveTask}
        />
      )}
      {modal === 'team' && state && <TeamModal state={state} onClose={() => setModal(null)} onHire={hire} onBonus={giveBonus} onTreat={treatBurnout} onPsychologist={hirePsychologist} />}
      {modal === 'malware' && state && (
        <PixelModal className="setup-modal malware-modal" title="Claude contra o malware" subtitle={`Nível ${Math.min(statsOf(state).malwareWins, 3) + 1} · vença para ganhar o coringa`} onClose={() => setModal(null)} wide>
          <MalwareGame
            onAttempt={() => setState(current => current && { ...current, jokerDay: current.day })}
            level={statsOf(state).malwareWins}
            onWin={flawless => setState(current => {
              if (!current) return current
              const won = bump({ ...current, jokers: 1 }, 'malwareWins')
              return flawless ? bump(won, 'malwareFlawless') : won
            })}
            onClose={() => setModal(null)}
          />
        </PixelModal>
      )}
      {modal === 'tutor' && state && <TutorModal state={state} onFeed={feedTutor} onBuy={buyGpu} onUpgrade={upgradeOffice} onClose={() => setModal(null)} />}
      {modal === 'elevator' && state && (
        <ElevatorModal
          state={state}
          current={screen === 'floor2' ? 'team' : screen === 'servers' ? 'servers' : 'office'}
          onRide={rideTo}
          onBuy={buyFloor}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'event' && state && <EventModal state={state} onChoose={resolveEvent} />}
      {modal === 'diary' && state && <DiaryModal state={state} onClose={() => setModal(null)} />}
      {modal === 'sale' && state && (
        <SaleModal state={state} onSell={sellCompany} onLater={() => { setState(current => current && { ...current, saleOfferSeen: true }); setModal(null) }} />
      )}
      {modal === 'finance' && state && <FinanceModal state={state} onLoan={takeLoan} onRepay={repayLoan} onClose={() => setModal(null)} />}
      {toast && <div className="pixel-toast">{toast}</div>}
      {state && screen === 'menu' && <button className="delete-save" onClick={resetSave}>Apagar save</button>}
    </div>
  )
}

/* =========================================================================
   CENA NATIVA 01: MENU PRINCIPAL
   ========================================================================= */
function NativeMenuScene({ hasSave, onNew, onContinue }: { hasSave: boolean; onNew: () => void; onContinue: () => void }) {
  return (
    <section className="game-office game-menu" aria-label="Menu principal">
          <div className="menu-grid-content">
            {/* Lado Esquerdo: UI Interativa Real de Clique */}
            <div className="menu-left-panel">
              <div className="menu-brand-title">
                <div className="menu-brand-logo">
                  <span className="menu-brand-icon">▁▃▆↗</span>
                  <span className="menu-brand-text">PROJECT TYCOON</span>
                </div>
                <p className="menu-brand-tagline">Construa. Gerencie. Evolua.</p>
              </div>

              <div className="menu-actions-stack">
                <button className="btn-menu-primary" onClick={onNew}>
                  <span>▶</span> NOVO PROJETO
                </button>
                <button className="btn-menu-secondary" disabled={!hasSave} onClick={onContinue}>
                  <span>💾</span> {hasSave ? 'CONTINUAR' : 'SEM SAVE'}
                </button>
                <span className="menu-version-tag">v1.0.0 · Edição Web Local</span>
              </div>
            </div>

            {/* Lado Direito: Ilustração Pixel Art Viva com Dev Respirando */}
            <div className="menu-dev-studio">
              <MenuScene />
            </div>
          </div>
    </section>
  )
}

/* =========================================================================
   CENA NATIVA 02: ESCRITÓRIO (ISOMÉTRICO VIVO COM PERSONAGENS RESPIRANDO)
   ========================================================================= */
function NativeOfficeScene({
  state,
  onContract,
  onKanban,
  onTeam,
  onFinance,
  onMenu,
  onClaude,
  onTutor,
  onDiary,
  onSale,
  onElevator,
  onLounge,
}: {
  state: GameState | null
  onContract: () => void
  onKanban: () => void
  onTeam: () => void
  onFinance: () => void
  onMenu: () => void
  onClaude: () => void
  onTutor: () => void
  onDiary: () => void
  onSale: () => void
  onElevator: () => void
  onLounge: () => void
}) {
  if (!state) return null
  const contractCount = state.availableContracts.length
  const teamSize = state.employees.length
  const energy = teamSize ? Math.round(state.employees.reduce((sum, e) => sum + e.energy, 0) / teamSize) : 0
  const dailyCost = dailyEmployeeCost(state)
  const runway = dailyCost > 0 ? Math.max(0, Math.floor(state.balance / dailyCost)) : null
  const cashLow = state.balance <= 0 || (runway !== null && runway < 15)
  const activeProject = state.contracts.find(c => ['accepted', 'inprogress'].includes(c.status))
  const progress = activeProject?.tasks.length
    ? Math.round(activeProject.tasks.reduce((sum, t) => sum + t.progress, 0) / activeProject.tasks.length)
    : 0

  return (
    <section className="game-office game-office-room" aria-label={`Escritório de ${state.company}`}>
            <div className="game-backdrop"><OfficeScene employees={state.employees.slice(0, officeOf(state).desks)} onHire={onTeam} desks={officeOf(state).desks} level={officeOf(state).level} onElevator={onElevator} /></div>
            <div className="game-hud">
              <HudCompany state={state} />

              <div className="hud-resources">
                <button className={`hud-chip ${cashLow ? 'danger' : 'green'}`} onClick={onFinance} title="Caixa: abrir finanças">
                  <span className="hud-chip-icon" aria-hidden="true"><SpinningCoin /></span>
                  <span className="hud-chip-body">
                    <small>Caixa</small>
                    <b key={state.balance} className="hud-bump">{formatMoney(state.balance)}</b>
                    <small>{state.balance < 0 ? `Falência em ${daysToBankruptcy(state)}d` : runway === null ? 'Sem custo diário' : `Dura ${runway} ${runway === 1 ? 'dia' : 'dias'}`}</small>
                  </span>
                </button>
                <button className="hud-chip purple" onClick={onTeam} title="Pessoas: abrir equipe">
                  <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="people" /></span>
                  <span className="hud-chip-body">
                    <small>Pessoas</small>
                    <b>{teamSize} no time</b>
                    <span className={`hud-meter ${energy < 30 ? 'red' : 'cyan'}`}><i style={{ width: `${energy}%` }} /></span>
                    <small>Energia {energy}%</small>
                  </span>
                </button>
                <button className="hud-chip gem" onClick={onTutor} title="Placas de vídeo: abrir o tutor e a loja">
                  <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="gpu" /></span>
                  <span className="hud-chip-body">
                    <small>Placas</small>
                    <b>{gpusOf(state)} GPU</b>
                    <small>{turboDaysLeft(state) > 0 ? `Turbo ${turboDaysLeft(state)}d` : 'Dar ao tutor'}</small>
                  </span>
                </button>
                <button className="hud-chip orange" onClick={onContract} title="Clientes: ver contratos">
                  <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="contract" /></span>
                  <span className="hud-chip-body">
                    <small>Clientes</small>
                    <b>{contractCount} {contractCount === 1 ? 'contrato' : 'contratos'}</b>
                    <small>{contractCount > 0 ? 'Disponíveis' : 'Nenhum no momento'}</small>
                  </span>
                </button>
              </div>
            </div>

            <div className="hud-quest-stack">
              {(activeProject || contractCount > 0) && (
                <button className="hud-quest" onClick={activeProject ? onKanban : onContract}>
                  <small>❗ OBJETIVO ATUAL</small>
                  <b>{activeProject ? activeProject.name : 'Feche um contrato'}</b>
                  {activeProject ? (
                    <>
                      <span className="hud-meter green"><i style={{ width: `${progress}%` }} /></span>
                      <small>{progress}% concluído</small>
                    </>
                  ) : (
                    <small>Escolha um cliente ▶</small>
                  )}
                </button>
              )}
              {saleReady(state) ? (
                <button className="hud-quest goal ready" onClick={onSale}>
                  <small>🏆 META FINAL ATINGIDA</small>
                  <b>Vender por {formatMoney(SALE_PRICE)}</b>
                  <small>Abrir a proposta ▶</small>
                </button>
              ) : (
                <div className="hud-quest goal">
                  <small>🏆 META FINAL</small>
                  <b>Faturar {formatMoney(SALE_REVENUE_GOAL)}</b>
                  <span className="hud-meter gold"><i style={{ width: `${Math.min(100, state.revenue / SALE_REVENUE_GOAL * 100)}%` }} /></span>
                  <small>{formatMoney(state.revenue)} · depois, vender por {formatMoney(SALE_PRICE)}</small>
                </div>
              )}
            </div>

            {/* Barra Inferior com Botões Reais Nativos Clicáveis */}
            <nav className="office-bottom-nav game-dock">
              <button className="btn-office-nav" onClick={onTeam}>
                <span className="nav-icon-glyph">👥</span>
                <span>Equipe</span>
              </button>
              <button className="btn-office-nav" onClick={onKanban}>
                <span className="nav-icon-glyph">📋</span>
                <span>Projetos</span>
              </button>
              <button className="btn-office-nav" onClick={onContract}>
                <span className="nav-icon-glyph">🤝</span>
                <span>Contratos</span>
              </button>
              <button className="btn-office-nav" onClick={onFinance}>
                <span className="nav-icon-glyph">💲</span>
                <span>Finança</span>
              </button>
              <button className={`btn-office-nav nav-claude ${canFightMalware(state) ? 'ready' : ''}`} onClick={onClaude}>
                <span className="nav-icon-glyph"><ClaudeIcon /></span>
                <span>{state.joker ? 'Trabalhando' : state.jokers ? 'Coringa pronto' : 'Coringa'}</span>
              </button>
              <button className={`btn-office-nav ${state.lounge ? '' : 'nav-new'}`} onClick={onLounge}>
                <span className="nav-icon-glyph">🎮</span>
                <span>Descanso</span>
              </button>
              <button className="btn-office-nav" onClick={onElevator}>
                <span className="nav-icon-glyph">🛗</span>
                <span>Elevador</span>
              </button>
              <button className="btn-office-nav" onClick={onDiary}>
                <span className="nav-icon-glyph">📖</span>
                <span>Diário</span>
              </button>
              <button className="btn-office-nav" onClick={onMenu}>
                <span className="nav-icon-glyph">‹</span>
                <span>Menu</span>
              </button>
            </nav>
    </section>
  )
}

/* =========================================================================
   2º ANDAR: MAIS MESAS PARA A EQUIPE
   ========================================================================= */
function TeamFloorScene({ state, onTeam, onKanban, onElevator }: { state: GameState; onTeam: () => void; onKanban: () => void; onElevator: () => void }) {
  const firstFloor = officeOf(state).desks
  const here = state.employees.slice(firstFloor, firstFloor + FLOORS.team.desks)
  return (
    <section className="game-office game-office-room floor-two" aria-label="2º andar">
      <div className="game-backdrop">
        <OfficeScene employees={here} onHire={onTeam} desks={FLOORS.team.desks} level={3} floor={2} walker={false} offset={firstFloor} onElevator={onElevator} />
      </div>
      <div className="game-hud">
        <HudCompany state={state} />
        <div className="hud-resources">
          <button className="hud-chip purple" onClick={onTeam}>
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="people" /></span>
            <span className="hud-chip-body"><small>Neste andar</small><b>{here.length}/{FLOORS.team.desks}</b><small>{here.length ? 'mesas ocupadas' : 'Contrate mais gente'}</small></span>
          </button>
          <button className="hud-chip gem" onClick={onElevator}>
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="office" /></span>
            <span className="hud-chip-body"><small>2º andar</small><b>Elevador</b><small>Trocar de andar</small></span>
          </button>
        </div>
      </div>
      <nav className="office-bottom-nav game-dock floor-dock">
        <button className="btn-office-nav" onClick={onTeam}><span className="nav-icon-glyph">👥</span><span>Equipe</span></button>
        <button className="btn-office-nav" onClick={onKanban}><span className="nav-icon-glyph">📋</span><span>Projetos</span></button>
        <button className="btn-office-nav" onClick={onElevator}><span className="nav-icon-glyph">🛗</span><span>Elevador</span></button>
      </nav>
    </section>
  )
}

/* =========================================================================
   SALA DE JOGOS E DESCANSO (anexo ao lado do escritório)
   ========================================================================= */
function LoungeFloorScene({ state, onBuy, onBack, onTeam, onKanban }: { state: GameState; onBuy: () => void; onBack: () => void; onTeam: () => void; onKanban: () => void }) {
  const resting = state.employees.map((employee, index) => ({ employee, index })).filter(({ employee }) => employee.state !== 'working')
  const built = Boolean(state.lounge)
  return (
    <section className="game-office game-office-room lounge-room" aria-label="Sala de jogos e descanso">
      <div className="game-backdrop"><LoungeScene people={resting} psychologist={Boolean(state.psychologist)} built={built} /></div>
      <div className="game-hud">
        <HudCompany state={state} />
        <div className="hud-resources">
          <div className="hud-chip purple">
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="people" /></span>
            <span className="hud-chip-body"><small>Descansando</small><b>{built ? resting.length : 0} aqui</b><small>{built ? `+${WELLNESS.restInLounge} energia/dia` : 'Sala fechada'}</small></span>
          </div>
          <button className="hud-chip gem" onClick={onBack}>
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="office" /></span>
            <span className="hud-chip-body"><small>Voltar ao</small><b>Escritório</b><small>Sala ao lado</small></span>
          </button>
        </div>
      </div>
      {!built && (
        <div className="lounge-build">
          <h2>🚧 Sala de jogos e descanso</h2>
          <p>Um anexo ao lado do escritório com videogame, pingue-pongue, fliperama e sofá.</p>
          <ul>
            <li>Durante os projetos, quem está sem tarefa recupera <b>+{WELLNESS.restInLounge}</b> de energia por dia (na mesa, só +{WELLNESS.restAtDesk}).</li>
            <li>Ajuda a evitar o burnout: dá para revezar a equipe.</li>
          </ul>
          <button className="mission-accept setup-confirm" disabled={state.balance < WELLNESS.loungePrice} onClick={onBuy}>
            {state.balance < WELLNESS.loungePrice ? `Caixa insuficiente · ${formatMoney(WELLNESS.loungePrice)}` : `Construir · ${formatMoney(WELLNESS.loungePrice)}`}
          </button>
        </div>
      )}
      <nav className="office-bottom-nav game-dock floor-dock">
        <button className="btn-office-nav" onClick={onBack}><span className="nav-icon-glyph">🏢</span><span>Escritório</span></button>
        <button className="btn-office-nav" onClick={onTeam}><span className="nav-icon-glyph">👥</span><span>Equipe</span></button>
        <button className="btn-office-nav" onClick={onKanban}><span className="nav-icon-glyph">📋</span><span>Projetos</span></button>
      </nav>
    </section>
  )
}

/* =========================================================================
   3º ANDAR: SERVIDORES PARA ALUGAR
   ========================================================================= */
function ServerFloorScene({ state, onAccept, onElevator }: { state: GameState; onAccept: (id: string) => void; onElevator: () => void }) {
  const used = racksInUse(state)
  const total = FLOORS.servers.racks
  const racks: RackView[] = (state.hosting ?? []).flatMap(deal => Array.from({ length: deal.racks }, () => ({ client: deal.client, daysLeft: hostingDaysLeft(deal, state.day) })))
  while (racks.length < total) racks.push({ client: null, daysLeft: 0 })
  return (
    <section className="game-office game-servers" aria-label="Andar de servidores">
      <div className="game-hud">
        <HudCompany state={state} />
        <div className="hud-resources">
          <div className="hud-chip gem">
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="gpu" /></span>
            <span className="hud-chip-body"><small>Racks</small><b>{used}/{total}</b><small>{total - used} livres</small></span>
          </div>
          <div className="hud-chip green">
            <span className="hud-chip-icon" aria-hidden="true"><SpinningCoin /></span>
            <span className="hud-chip-body"><small>Aluguel</small><b>{formatMoney(hostingIncome(state))}</b><small>por dia</small></span>
          </div>
          <button className="hud-chip purple" onClick={onElevator}>
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="office" /></span>
            <span className="hud-chip-body"><small>3º andar</small><b>Elevador</b><small>Trocar de andar</small></span>
          </button>
        </div>
      </div>
      <div className="srv-main">
        <div className="srv-room"><ServerRoom racks={racks} onElevator={onElevator} /></div>
        <aside className="srv-panel">
          <section className="fin-panel">
            <h3>Propostas de locação</h3>
            {(state.hostingOffers ?? []).length === 0 && <small>Novas propostas chegam a cada 4 dias.</small>}
            {(state.hostingOffers ?? []).map(deal => {
              const fits = used + deal.racks <= total
              return (
                <div key={deal.id} className="srv-offer">
                  <b>{deal.client}</b>
                  <small>{deal.racks} rack{deal.racks > 1 ? 's' : ''} · {daysLabel(deal.days)} · total {formatMoney(deal.dailyRent * deal.days)}</small>
                  <button className="mission-accept" disabled={!fits} onClick={() => onAccept(deal.id)}>
                    {fits ? `Alugar · +${formatMoney(deal.dailyRent)}/dia` : 'Sem racks livres'}
                  </button>
                </div>
              )
            })}
          </section>
          <section className="fin-panel">
            <h3>Clientes hospedados</h3>
            {(state.hosting ?? []).length === 0 && <small>Nenhum rack alugado ainda.</small>}
            {(state.hosting ?? []).map(deal => (
              <div key={deal.id} className="fin-row">
                <span>🖥 {deal.client} <small>({deal.racks} · faltam {daysLabel(hostingDaysLeft(deal, state.day))})</small></span>
                <b className="fin-in">+{formatMoney(deal.dailyRent)}</b>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </section>
  )
}

function HudCompany({ state }: { state: GameState }) {
  return (
    <div className="hud-company">
      <span className="hud-avatar" aria-hidden="true">{state.company.charAt(0).toUpperCase()}</span>
      <div className="hud-company-info">
        <b>{state.company}</b>
        <span className="hud-meter gold"><i style={{ width: `${Math.min(100, Math.max(0, state.reputation))}%` }} /></span>
        <small>⭐ {state.reputation}/100 reputação</small>
      </div>
      {turboDaysLeft(state) > 0 && (
        <span className="hud-turbo" title="Tutor turbinado: tarefas andam o dobro e a equipe cansa menos">
          <small>TURBO</small>{turboDaysLeft(state)}d
        </span>
      )}
      <span className="hud-day"><small>DIA</small><span key={state.day} className="hud-bump">{state.day}</span></span>
    </div>
  )
}

/* =========================================================================
   CENA NATIVA 04: QUADRO KANBAN REAL
   ========================================================================= */
type Fit = 'ideal' | 'good' | 'basic'

const FIT_LABEL: Record<Fit, string> = { ideal: '⭐ Ideal +35%', good: '⚡ Adaptado +15%', basic: '⚠️ Fora da área −25%' }
const FIT_ORDER: Record<Fit, number> = { ideal: 0, good: 1, basic: 2 }

function taskFit(role: Role, task: Task): Fit {
  if (role === task.requiredRole) return 'ideal'
  if (role === task.secondaryRole || (role === 'fullstack' && ['frontend', 'backend'].includes(task.requiredRole))) return 'good'
  return 'basic'
}

function daysLabel(days: number) {
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

const BOARD: Array<{ id: Task['status']; title: string; empty: string }> = [
  { id: 'todo', title: '📋 A fazer', empty: 'Tudo distribuído!' },
  { id: 'inprogress', title: '⚙ Fazendo', empty: 'Ninguém produzindo' },
  { id: 'review', title: '🔍 Validar', empty: 'Nada para validar' },
  { id: 'done', title: '🏆 Pronto', empty: 'Nenhuma entrega ainda' },
]

function NativeKanbanScene({
  state,
  project,
  completion,
  onAssign,
  onApprove,
  onAdvance,
  onBack,
  onTeam,
  onContract,
  onJoker,
  onMalware,
  onDeploy,
}: {
  state: GameState | null
  project?: Contract
  completion: number
  onAssign: (taskId: string, empId: string) => void
  onApprove: (taskId: string) => void
  onAdvance: () => void
  onBack: () => void
  onTeam: () => void
  onContract: () => void
  onJoker: (taskId: string) => void
  onMalware: () => void
  onDeploy: (taskId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!state) return null

  const hud = (
    <div className="hud-resources">
      <div className={`hud-chip ${state.balance <= 0 ? 'danger' : 'green'}`}>
        <span className="hud-chip-icon" aria-hidden="true"><SpinningCoin /></span>
        <span className="hud-chip-body"><small>Caixa</small><b key={state.balance} className="hud-bump">{formatMoney(state.balance)}</b></span>
      </div>
      <button className="hud-chip purple" onClick={onBack}>
        <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="office" /></span>
        <span className="hud-chip-body"><small>Voltar ao</small><b>Escritório</b></span>
      </button>
    </div>
  )

  if (!project) {
    return (
      <section className="game-office" aria-label="Quadro do projeto">
        <div className="game-hud"><HudCompany state={state} />{hud}</div>
        <div className="pixel-empty">
          <h2>Sem projeto ativo</h2>
          <p>Aceite uma proposta para abrir o quadro, ou espere novas propostas no mercado.</p>
          <div className="empty-actions">
            <button onClick={onContract}>Ver contratos</button>
            <button onClick={onAdvance}>⏭ Esperar um dia</button>
          </div>
        </div>
      </section>
    )
  }

  const tasks = project.tasks
  const unlocked = (task: Task) => taskDependenciesDone(task, tasks)
  const jobOf = (id: string) => tasks.find(t => t.status === 'inprogress' && t.assignedTo === id)
  const toReview = tasks.filter(t => t.status === 'review')
  const toAssign = tasks.filter(t => t.status === 'todo' && unlocked(t))
  const free = state.employees.filter(e => !jobOf(e.id) && e.state !== 'working' && e.state !== 'burnout')
  const working = tasks.filter(t => t.status === 'inprogress')
  const daysLeft = contractDaysRemaining(project, state.day)
  const suggested = toReview[0] ?? (free.length ? toAssign[0] : undefined) ?? working[0] ?? toAssign[0] ?? tasks[0]
  const selected = tasks.find(t => t.id === selectedId) ?? suggested
  const allDone = tasks.every(t => t.status === 'done')

  const step = allDone
    ? { text: 'Projeto entregue! Volte ao escritório.', target: null }
    : toReview.length
      ? { text: `Valide: ${toReview[0].name}`, target: toReview[0].id }
      : toAssign.length && free.length
        ? { text: `Escolha quem faz: ${toAssign[0].name}`, target: toAssign[0].id }
        : { text: working.length ? 'Equipe produzindo: avance o dia' : 'Contrate alguém para continuar', target: null }
  const shouldAdvance = !allDone && !step.target && working.length > 0

  // Tarefas liberadas aparecem antes das bloqueadas
  const inColumn = (status: Task['status']) => tasks
    .filter(t => t.status === status)
    .sort((x, y) => Number(unlocked(y)) - Number(unlocked(x)))

  const worker = staffOf(state).find(e => e.id === selected?.assignedTo)
  const candidates = selected
    ? [...state.employees].sort((x, y) =>
        Number(!free.includes(x)) - Number(!free.includes(y))
        || FIT_ORDER[taskFit(x.role, selected)] - FIT_ORDER[taskFit(y.role, selected)])
    : []
  const etaFor = (employee: GameState['employees'][number], task: Task) =>
    daysLabel(Math.max(1, Math.ceil((100 - task.progress) / Math.max(1, calculateTaskGain(employee, task, state.difficulty) * (turboDaysLeft(state) > 0 ? 2 : 1)))))
  const faceOf = (id: string) => state.employees.findIndex(e => e.id === id)

  return (
    <section className="game-office game-kanban" aria-label="Quadro do projeto">
      <div className="game-hud">
        <HudCompany state={state} />
        <div className="hud-company kb-project">
          <div className="kb-project-info">
            <b>{project.name}</b>
            <span className="hud-meter green"><i style={{ width: `${completion}%` }} /></span>
            <small>{completion}% concluído</small>
          </div>
          <span className={`hud-day ${daysLeft < 5 ? 'late' : ''}`}><small>{daysLeft < 0 ? 'ATRASO' : 'RESTAM'}</small>{Math.abs(daysLeft)}d</span>
        </div>
        {hud}
      </div>

      <div className="kb-main">
        <div className="kb-board">
          {BOARD.map(col => {
            const list = inColumn(col.id)
            return (
              <section key={col.id} className={`kb-col ${col.id}`} aria-label={`${col.title}: ${list.length}`}>
                <header><span>{col.title}</span><b>{list.length}</b></header>
                <div className="kb-list">
                  {list.length === 0 && <p className="kb-none">{col.empty}</p>}
                  {list.map(task => {
                    const open = task.status !== 'todo' || unlocked(task)
                    const dev = staffOf(state).find(e => e.id === task.assignedTo)
                    return (
                      <button
                        key={task.id}
                        className={`kb-card ${open ? '' : 'locked'} ${task.status === 'review' ? 'ready' : ''}`}
                        aria-pressed={selected?.id === task.id}
                        onClick={() => setSelectedId(task.id)}
                      >
                        <b>{open ? '' : '🔒 '}{task.name}</b>
                        {task.status === 'todo' && <small>{ROLE_LABEL[task.requiredRole]} · {task.complexity} pts</small>}
                        {task.status === 'inprogress' && (
                          <>
                            <small>{dev?.name.split(' ')[0]} · {task.progress}%</small>
                            <span className="hud-meter cyan"><i style={{ width: `${task.progress}%` }} /></span>
                          </>
                        )}
                        {task.status === 'review' && <small>Pronta para validar</small>}
                        {task.status === 'done' && <small>Qualidade {task.quality}%</small>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        {selected && (
          <aside className="kb-sheet" aria-label="Tarefa selecionada" key={selected.id}>
            <div className="kb-sheet-scroll">
              <h2>{selected.name}</h2>
              <div className="mission-tech">
                {selected.technology && <span>{selected.technology}</span>}
                <span>{selected.complexity} pts</span>
                <span>~{daysLabel(selected.estimatedDays)}</span>
              </div>
              <p className="kb-roles">
                ⭐ {ROLE_LABEL[selected.requiredRole]}
                {selected.secondaryRole && <> · ⚡ {ROLE_LABEL[selected.secondaryRole]}</>}
              </p>

              {selected.status === 'todo' && !unlocked(selected) && (
                <div className="kb-block">
                  <h3>🔒 Conclua antes</h3>
                  {tasks.filter(t => selected.dependsOn.includes(t.id) && t.status !== 'done').map(t => (
                    <button key={t.id} className="kb-dep" onClick={() => setSelectedId(t.id)}>{t.name} ▶</button>
                  ))}
                </div>
              )}

              {selected.status === 'todo' && unlocked(selected) && (
                <div className="kb-block">
                  <h3>Quem vai fazer?</h3>
                  {candidates.map(dev => {
                    const fit = taskFit(dev.role, selected)
                    const isFree = free.includes(dev)
                    return (
                      <button key={dev.id} className={`kb-dev ${fit}`} disabled={!isFree} onClick={() => { onAssign(selected.id, dev.id); setSelectedId(null) }}>
                        <Portrait name={dev.name} index={faceOf(dev.id)} color={ROLE_COLOR[dev.role]} />
                        <span>
                          <b>{dev.name}</b>
                          <small>{ROLE_LABEL[dev.role]} · ⚡{dev.energy}%</small>
                          <small className="kb-fit">{isFree ? `${FIT_LABEL[fit]} · ${etaFor(dev, selected)}` : dev.state === 'burnout' ? '🔥 Em burnout' : 'Ocupado em outra tarefa'}</small>
                        </span>
                      </button>
                    )
                  })}
                  <button className="kb-dep" onClick={onTeam}>+ Contratar profissional</button>
                </div>
              )}

              {selected.status !== 'todo' && worker && (
                <div className="kb-block">
                  <h3>{selected.status === 'inprogress' ? 'Trabalhando nisso' : 'Feita por'}</h3>
                  <div className={`kb-dev ${taskFit(worker.role, selected)}`}>
                    <Portrait name={worker.name} index={faceOf(worker.id)} color={ROLE_COLOR[worker.role]} />
                    <span>
                      <b>{worker.name}</b>
                      <small>{worker.id === state.joker?.id ? 'Coringa' : `${ROLE_LABEL[worker.role]} · ⚡${worker.energy}%`}</small>
                      <small className="kb-fit">{worker.id === state.joker?.id ? `Sem custo · qualidade ${worker.quality}%` : FIT_LABEL[taskFit(worker.role, selected)]}</small>
                    </span>
                  </div>
                </div>
              )}
              {selected.status === 'inprogress' && (
                <div className="kb-block">
                  <span className="hud-meter cyan"><i style={{ width: `${selected.progress}%` }} /></span>
                  <small>{selected.progress}%{worker && ` · faltam cerca de ${etaFor(worker, selected)}`}</small>
                </div>
              )}
              {(selected.status === 'todo' || selected.status === 'inprogress') && unlocked(selected) && !state.joker && (
                <div className="kb-block">
                  {state.jokers ? (
                    <button className="kb-dev joker" onClick={() => { onJoker(selected.id); setSelectedId(null) }}>
                      <Portrait name="Claude" index={-1} color="" />
                      <span>
                        <b>{selected.status === 'todo' ? 'Usar o coringa Claude' : `Claude no lugar de ${worker?.name.split(' ')[0] ?? 'quem faz'}`}</b>
                        <small className="kb-fit">Rápido e sem custo · qualidade {jokerQuality(state, selected)}%</small>
                      </span>
                    </button>
                  ) : canFightMalware(state) && (
                    <button className="kb-dep joker" onClick={onMalware}>🕹 Ganhar o coringa Claude</button>
                  )}
                </div>
              )}
              {selected.status === 'inprogress' && gpusOf(state) > 0 && (
                <button className="kb-dep gpu" onClick={() => onDeploy(selected.id)}>⚡ Deploy instantâneo · 1 placa de vídeo ({gpusOf(state)})</button>
              )}
              {selected.status === 'done' && <p className="kb-roles">🏆 Entregue com {selected.quality}% de qualidade</p>}
            </div>
            {selected.status === 'review' && (
              <button className="mission-accept kb-approve" onClick={() => { onApprove(selected.id); setSelectedId(null) }}>✓ Validar tarefa</button>
            )}
          </aside>
        )}
      </div>

      <footer className="kb-dock">
        <button className="kb-team" onClick={onTeam} aria-label={`Abrir equipe: ${free.length} livres de ${state.employees.length}`}>
          {state.employees.slice(0, 5).map((dev, index) => (
            <span key={dev.id} className={free.includes(dev) ? 'kb-face' : 'kb-face busy'} title={`${dev.name}: ${free.includes(dev) ? 'livre' : 'ocupado'}`}>
              <Portrait name={dev.name} index={index} color={ROLE_COLOR[dev.role]} />
            </span>
          ))}
          <small>{state.employees.length > 5 && `+${state.employees.length - 5} · `}{free.length} livre(s)</small>
        </button>

        <button className="kb-step" disabled={!step.target} onClick={() => setSelectedId(step.target)}>
          <small>❗ PRÓXIMO PASSO</small>
          <b>{step.text}</b>
        </button>

        <button className={`mission-accept kb-advance ${shouldAdvance ? 'pulse' : ''}`} onClick={onAdvance}>▶▶ Avançar dia</button>
      </footer>
    </section>
  )
}

/* =========================================================================
   CENA NATIVA 05: RESULTADOS DO PROJETO
   ========================================================================= */
function NativeResultsScene({
  state,
  project,
  settlement,
  onContinue,
}: {
  state: GameState | null
  project?: Contract
  settlement: {
    payment: number; earlyBonus: number; qualityBonus: number; penalty: number;
    quality: number; daysRemaining: number; reputationDelta: number;
    projectName: string; clientName: string;
  } | null
  onContinue: () => void
}) {
  const quality = settlement?.quality ?? (project ? calculateProjectQuality(project.tasks) : 0)
  const wasLate = (settlement?.daysRemaining ?? 0) < 0
  const lateDays = wasLate ? Math.abs(settlement?.daysRemaining ?? 0) : 0
  const earlyDays = !wasLate ? (settlement?.daysRemaining ?? 0) : 0
  const reputationDelta = settlement?.reputationDelta ?? 0
  const satisfactionPct = Math.min(100, Math.max(0, Math.round(quality * 0.9 + (wasLate ? -15 : earlyDays > 3 ? 10 : 5))))
  const grade = quality >= 85 ? 'S' : quality >= 70 ? 'A' : quality >= 55 ? 'B' : 'C'
  const gradeColor = quality >= 85 ? '#4cf17c' : quality >= 70 ? '#63e8ff' : quality >= 55 ? '#ffd166' : '#ff5277'

  return (
    <section className="game-office game-results" aria-label="Relatório de entrega">
      <div className="game-hud">
        {state && <HudCompany state={state} />}
        <div className="hud-company kb-project">
          <div className="kb-project-info">
            <b>🎉 {settlement?.projectName ?? project?.name}</b>
            <small>Entregue para {settlement?.clientName ?? project?.client}</small>
          </div>
          <span className="hud-day"><small>NOTA</small>{grade}</span>
        </div>
      </div>
          <div className="results-grid-content">
            {/* Banner comemorativo com devs celebrando */}
            <div className="results-banner-delivered">
              {/* Equipe comemorando — SVG animado */}
              <div className="results-victory"><VictoryScene /></div>

              {/* Nota / Grade */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 60, height: 60, background: gradeColor, color: '#060f28', font: '900 32px Pixelify Sans', display: 'grid', placeItems: 'center', boxShadow: `0 0 24px ${gradeColor}99` }}>
                  {grade}
                </div>
                <span style={{ font: '700 10px Pixelify Sans', color: gradeColor }}>NOTA FINAL</span>
              </div>

              <div className="delivered-stamp-text">
                <h2>🎉 Projeto Entregue!</h2>
                <p>{wasLate
                  ? `⚠️ Entregue com ${lateDays} dia(s) de atraso.`
                  : earlyDays > 0
                    ? `✅ Entregue ${earlyDays} dia(s) antes do prazo!`
                    : `✅ Entregue no prazo!`
                }</p>
                <p style={{ color: reputationDelta >= 0 ? '#4cf17c' : '#ff5277', marginTop: 4 }}>
                  {reputationDelta >= 0 ? `⭐ +${reputationDelta}` : `📉 ${reputationDelta}`} pontos de reputação
                </p>
              </div>
            </div>

            {/* Extrato financeiro */}
            <div className="results-finance-breakdown">
              <h3 className="results-breakdown-title">💳 Extrato do Pagamento</h3>
              <div className="results-breakdown-rows">
                <div className="breakdown-row">
                  <span>Valor base do contrato</span>
                  <b className="num-money">{formatMoney(project?.value ?? 0)}</b>
                </div>
                {(settlement?.earlyBonus ?? 0) > 0 && (
                  <div className="breakdown-row bonus">
                    <span>🎁 Bônus de entrega antecipada</span>
                    <b className="num-money">+{formatMoney(settlement!.earlyBonus)}</b>
                  </div>
                )}
                {(settlement?.qualityBonus ?? 0) > 0 && (
                  <div className="breakdown-row bonus">
                    <span>⭐ Bônus de qualidade ({quality}%)</span>
                    <b className="num-money">+{formatMoney(settlement!.qualityBonus)}</b>
                  </div>
                )}
                {(settlement?.penalty ?? 0) > 0 && (
                  <div className="breakdown-row penalty">
                    <span>⚠️ Multa por atraso ({lateDays} dias)</span>
                    <b style={{ color: '#ff5277' }}>-{formatMoney(settlement!.penalty)}</b>
                  </div>
                )}
                <div className="breakdown-row total">
                  <span>💰 Total recebido</span>
                  <b className="num-money" style={{ fontSize: 20 }}>{formatMoney(settlement?.payment ?? 0)}</b>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="results-metrics-grid">
              <div className="results-metric-card green">
                <span className="metric-card-label">⭐ Qualidade Técnica</span>
                <b className="metric-card-value" style={{ color: quality >= 80 ? '#4cf17c' : quality >= 60 ? '#ffd166' : '#ff5277' }}>{quality}%</b>
                <small style={{ color: '#94a3b8', fontSize: 11 }}>{quality >= 80 ? 'Excelente entrega!' : quality >= 60 ? 'Qualidade aceitável' : 'Muitos erros encontrados'}</small>
              </div>

              <div className="results-metric-card cyan">
                <span className="metric-card-label">⏱ Prazo</span>
                <b className="metric-card-value" style={{ color: wasLate ? '#ff5277' : '#4cf17c' }}>
                  {wasLate ? `-${lateDays}d` : `+${earlyDays}d`}
                </b>
                <small style={{ color: '#94a3b8', fontSize: 11 }}>{wasLate ? 'Atrasado' : 'Dentro do prazo'}</small>
              </div>

              <div className="results-metric-card gold">
                <span className="metric-card-label">📈 Reputação</span>
                <b className="metric-card-value" style={{ color: reputationDelta >= 0 ? '#ffd166' : '#ff5277' }}>
                  {reputationDelta >= 0 ? '+' : ''}{reputationDelta}
                </b>
                <small style={{ color: '#94a3b8', fontSize: 11 }}>Reputação atual: {state?.reputation ?? 0}/100</small>
              </div>
            </div>

            {/* Satisfação do cliente */}
            <div className="results-satisfaction-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '700 13px Pixelify Sans', color: 'white' }}>Satisfação do Cliente:</span>
                <b style={{ font: '800 15px Pixelify Sans', color: satisfactionPct >= 80 ? '#4cf17c' : satisfactionPct >= 60 ? '#ffd166' : '#ff5277' }}>
                  {satisfactionPct}%
                </b>
              </div>
              <div className="satisfaction-bar-bg">
                <div className="satisfaction-bar-fill" style={{ width: `${satisfactionPct}%`, background: satisfactionPct >= 80 ? 'linear-gradient(90deg, #4cf17c, #63e8ff)' : satisfactionPct >= 60 ? 'linear-gradient(90deg, #ffd166, #f59e0b)' : 'linear-gradient(90deg, #ff5277, #ef4444)' }} />
              </div>
            </div>

            <button className="btn-results-continue" onClick={onContinue}>
              🏢 Voltar ao Escritório →
            </button>
          </div>
    </section>
  )
}

/* =========================================================================
   CENA NATIVA 03: MURAL DE CONTRATOS
   ========================================================================= */
interface MultiContractScreenProps {
  state: GameState | null
  contracts: Contract[]
  currentIndex: number
  onSelectIndex: (idx: number) => void
  project?: Contract
  onBack: () => void
  onAccept: (c: Contract) => void
  onNegotiate: (c: Contract) => void
  onKanban: () => void
}

function MultiContractScreen({
  state,
  contracts,
  currentIndex,
  onSelectIndex,
  project,
  onBack,
  onAccept,
  onNegotiate,
  onKanban,
}: MultiContractScreenProps) {
  const current = contracts[currentIndex]
  const hasActiveProject = Boolean(project && ['accepted', 'inprogress'].includes(project.status))

  if (!state) return null
  const complexity = current?.complexity ?? 'medium'
  const stars = complexity === 'easy' ? 1 : complexity === 'hard' ? 3 : 2
  const complexityLabel = complexity === 'easy' ? 'Inicial' : complexity === 'hard' ? 'Avançada' : 'Média'

  return (
    <section className="game-office game-contracts" aria-label="Mural de contratos">
      <div className="game-hud">
        <HudCompany state={state} />
        <div className="hud-resources">
          <div className="hud-chip green">
            <span className="hud-chip-icon" aria-hidden="true"><SpinningCoin /></span>
            <span className="hud-chip-body"><small>Caixa</small><b key={state.balance} className="hud-bump">{formatMoney(state.balance)}</b></span>
          </div>
          <button className="hud-chip purple" onClick={onBack}>
            <span className="hud-chip-icon" aria-hidden="true"><PixelIcon name="office" /></span>
            <span className="hud-chip-body"><small>Voltar ao</small><b>Escritório</b></span>
          </button>
        </div>
      </div>

      <div className="contract-arena">
        {contracts.length > 0 && (
          <nav className="contract-list" aria-label="Propostas disponíveis">
            {contracts.map((c, i) => (
              <button
                key={c.id}
                className={`contract-ticket ${i === currentIndex ? 'active' : ''}`}
                aria-pressed={i === currentIndex}
                onClick={() => onSelectIndex(i)}
              >
                <span className="contract-ticket-art" aria-hidden="true"><BuildingScene type={c.buildingType} /></span>
                <span className="contract-ticket-body">
                  <small>{c.client}</small>
                  <b>{c.name}</b>
                  <small className="contract-ticket-pay">{formatMoney(c.value)}</small>
                </span>
              </button>
            ))}
          </nav>
        )}

        <div className="contract-mission" key={current?.id}>
          {hasActiveProject && (
            <div className="signed-overlay">
              <span>✓ PROJETO ATIVO EM ANDAMENTO</span>
              <b>{project?.name} · {formatMoney(project?.value ?? 0)} · {project?.deadlineDays} dias</b>
              <button onClick={onKanban}>ABRIR QUADRO KANBAN</button>
            </div>
          )}

          {current ? (
            <>
              <div className="mission-scroll">
                <header className="mission-head">
                  <span className="mission-art" aria-hidden="true"><BuildingScene type={current.buildingType} /></span>
                  <div>
                    <small>❗ MISSÃO DE {current.client.toUpperCase()}</small>
                    <h2>{current.name}</h2>
                    <span className={`mission-stars ${complexity}`}>
                      <span aria-hidden="true">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span> {complexityLabel}
                    </span>
                  </div>
                </header>

                <div className="mission-stats">
                  <div className="green"><small>💰 Recompensa</small><b>{formatMoney(current.value)}</b><small>Bônus rápido +{formatMoney(current.bonusEarly)}</small></div>
                  <div className="orange"><small>⏳ Prazo</small><b>{current.deadlineDays} dias</b><small>Multa {formatMoney(current.penaltyPerDay)}/dia</small></div>
                  <div className="purple"><small>📦 Escopo</small><b>{current.features} entregas</b><small>Qualidade mínima {current.minQuality}%</small></div>
                </div>

                <h3>Objetivos</h3>
                <ul className="mission-goals">
                  {(current.featureList || current.technicalReqs).map((req, idx) => <li key={idx}>{req}</li>)}
                </ul>

                <div className="mission-tech">
                  <small>Tecnologias</small>
                  {current.technicalReqs.map(t => <span key={t}>{t}</span>)}
                </div>
              </div>

              <div className="mission-actions">
                <button className="mission-negotiate" disabled={hasActiveProject} onClick={() => onNegotiate(current)}>🤝 Negociar</button>
                <button className="mission-accept" disabled={hasActiveProject} onClick={() => onAccept(current)}>{hasActiveProject ? 'Termine o projeto atual' : '✓ Aceitar contrato'}</button>
              </div>
            </>
          ) : (
            <div className="pixel-empty">
              <h2>SEM PROPOSTAS</h2>
              <button onClick={onBack}>VOLTAR AO ESCRITÓRIO</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* =========================================================================
   MODAIS NATIVOS
   ========================================================================= */

function SetupModal(props: { company: string; founder: string; difficulty: Difficulty; onCompany: (value: string) => void; onFounder: (value: string) => void; onDifficulty: (value: Difficulty) => void; onClose: () => void; onConfirm: () => void }) {
  const levels: Record<Difficulty, { title: string; capital: string; desc: string; stars: number; hue: number }> = {
    easy: { title: 'Fácil', capital: 'R$ 32.000', desc: 'Maior capital e clientes tolerantes', stars: 1, hue: -110 },
    normal: { title: 'Normal', capital: 'R$ 24.000', desc: 'Desafio equilibrado e realista', stars: 2, hue: 0 },
    hard: { title: 'Difícil', capital: 'R$ 18.000', desc: 'Menor margem e clientes exigentes', stars: 3, hue: 110 },
  }
  const level = levels[props.difficulty]

  return (
    <PixelModal className="setup-modal" title="Nova empresa" subtitle="Defina sua identidade e nível de desafio para começar." onClose={props.onClose}>
      <form className="setup-grid" onSubmit={event => { event.preventDefault(); props.onConfirm() }}>
        <div className="setup-scene">
          <FoundingScene hue={level.hue} />
          <b className="setup-sign">{props.company.trim() || 'Sua empresa'}</b>
          <div className="setup-plate">
            <small>Fundada por</small>
            <b>{props.founder.trim() || 'Você'}</b>
          </div>
        </div>

        <div className="setup-fields">
          <label>Nome da empresa
            <input value={props.company} onChange={event => props.onCompany(event.target.value)} placeholder="Ex.: Pixel Forge" />
          </label>
          <label>Nome do fundador
            <input value={props.founder} onChange={event => props.onFounder(event.target.value)} placeholder="Seu nome" />
          </label>

          <div role="group" aria-label="Nível de dificuldade">
            <span className="setup-label">Nível de dificuldade</span>
            <div className="setup-levels">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(item => (
                <button key={item} type="button" className={`setup-level ${item}`} aria-pressed={props.difficulty === item} onClick={() => props.onDifficulty(item)}>
                  <span className="setup-stars" aria-hidden="true">{'★'.repeat(levels[item].stars)}{'☆'.repeat(3 - levels[item].stars)}</span>
                  <b>{levels[item].title}</b>
                  <small>{levels[item].capital}</small>
                </button>
              ))}
            </div>
            <p className="setup-desc">{level.desc}</p>
          </div>

          <button type="submit" className="mission-accept setup-confirm">▶ Fundar empresa</button>
        </div>
      </form>
    </PixelModal>
  )
}

function NegotiationModal(props: { contract: Contract; value: number; deadline: number; message: string; onValue: (value: number) => void; onDeadline: (value: number) => void; onClose: () => void; onSend: () => void }) {
  const rejected = props.contract.status === 'rejected' || props.message.startsWith('Recusada')
  return (
    <PixelModal className="setup-modal negotiation-modal" title={rejected ? 'Renegociar contrato' : 'Negociar contrato'} subtitle={`${props.contract.name} · ${props.contract.client}`} onClose={props.onClose}>
      <div className="client-message">
        <span className="client-face" aria-hidden="true"><BuildingScene type={props.contract.buildingType} /></span>
        <span>{props.contract.client}</span>
        <p>{rejected ? 'A oferta anterior não foi aprovada pela diretoria. Envie uma contraproposta mais alinhada.' : 'Estamos abertos a ouvir sua proposta comercial, considerando orçamento e prazo.'}</p>
      </div>
      {props.message && (
        <div className={`negotiation-feedback ${props.message.includes('aceita') ? 'accepted' : ''}`}>
          {props.message}
        </div>
      )}
      <div className="offer-grid">
        <label>Valor da proposta
          <input
            type="number"
            min={Math.floor(props.contract.originalValue * 0.7)}
            max={Math.floor(props.contract.originalValue * 1.5)}
            step="500"
            value={props.value}
            onChange={event => props.onValue(Number(event.target.value))}
          />
        </label>
        <label>Prazo em dias
          <input
            type="number"
            min={Math.floor(props.contract.originalDeadlineDays * 0.6)}
            max={Math.floor(props.contract.originalDeadlineDays * 1.5)}
            value={props.deadline}
            onChange={event => props.onDeadline(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="offer-preview">
        <span>Sua oferta · original {formatMoney(props.contract.originalValue)} em {props.contract.originalDeadlineDays} dias</span>
        <b>{formatMoney(props.value)} · {props.deadline} dias</b>
      </div>
      <button className="mission-accept setup-confirm" onClick={props.onSend}>
        🤝 {rejected ? 'Enviar contraproposta' : 'Enviar proposta'}
      </button>
    </PixelModal>
  )
}

function TaskModal({ state, project, onClose, onAssign, onApprove }: { state: GameState; project: Contract; onClose: () => void; onAssign: (taskId: string, employeeId: string) => void; onApprove: (taskId: string) => void }) {
  const availableEmployees = (task: Task) => state.employees.filter(employee => !project.tasks.some(item => item.status === 'inprogress' && item.assignedTo === employee.id) || task.assignedTo === employee.id)
  return (
    <PixelModal title="GERENCIAMENTO DO PROJETO" subtitle={`${project.name} · ${contractDaysRemaining(project, state.day)} dias restantes`} onClose={onClose} wide>
      <div className="task-manager">
        {project.tasks.map(task => {
          const unlocked = taskDependenciesDone(task, project.tasks)
          const employee = state.employees.find(item => item.id === task.assignedTo)
          return (
            <article key={task.id} className={`task-row ${task.status} ${!unlocked ? 'locked' : ''}`}>
              <span className="task-icon">{task.status === 'done' ? '✓' : task.status === 'review' ? '⚗' : task.status === 'inprogress' ? '⚙' : '▣'}</span>
              <div>
                <b>{task.name}</b>
                <small>{ROLE_LABEL[task.requiredRole]} · {task.progress}% {employee ? `· ${employee.name}` : ''}</small>
                <span className="task-mini-progress"><i style={{ width: `${task.progress}%` }} /></span>
              </div>
              <div>
                {task.status === 'todo' && unlocked && (
                  <select defaultValue="" onChange={event => event.target.value && onAssign(task.id, event.target.value)}>
                    <option value="" disabled>ALOCAR…</option>
                    {availableEmployees(task).map(item => (
                      <option key={item.id} value={item.id}>{item.name} · {ROLE_LABEL[item.role]}</option>
                    ))}
                  </select>
                )}
                {task.status === 'todo' && !unlocked && <span className="locked-label">BLOQUEADA</span>}
                {task.status === 'inprogress' && <span className="working-label">EM PRODUÇÃO</span>}
                {task.status === 'review' && <button className="approve-task" onClick={() => onApprove(task.id)}>VALIDAR</button>}
                {task.status === 'done' && <span className="done-label">QUAL. {task.quality}%</span>}
              </div>
            </article>
          )
        })}
      </div>
    </PixelModal>
  )
}

function TeamModal({ state, onClose, onHire, onBonus, onTreat, onPsychologist }: { state: GameState; onClose: () => void; onHire: (role: Role, senior?: boolean) => void; onBonus: (employeeId: string) => void; onTreat: (employeeId: string) => void; onPsychologist: () => void }) {
  const tasks = state.contracts.filter(c => ['accepted', 'inprogress'].includes(c.status)).flatMap(c => c.tasks)
  const missing = (role: Role) =>
    !state.employees.some(e => e.role === role) && tasks.some(t => t.status === 'todo' && t.requiredRole === role)
  const roles: Role[] = ['qa', 'fullstack', 'frontend', 'backend', 'designer']
  const [role, setRole] = useState<Role>(() => roles.find(missing) ?? 'qa')
  const canPay = state.balance >= 1_200
  const desks = deskCapacity(state)
  const full = state.employees.length >= desks
  const bars = (e: GameState['employees'][number]): Array<[string, number, string]> => [
    ['⚡ Energia', e.energy, e.energy < 30 ? 'red' : 'cyan'],
    ['💎 Qualidade', e.quality, 'gold'],
    ['🚀 Velocidade', e.speed, 'green'],
    ['😊 Satisfação', e.satisfaction, e.satisfaction < 30 ? 'red' : 'cyan'],
  ]

  return (
    <PixelModal className="setup-modal team-modal" title="Equipe" subtitle={`${state.employees.length} de ${desks} mesas ocupadas · ${officeOf(state).name}${state.floors?.team ? ' + 2º andar' : ''}`} onClose={onClose} wide>
      <div className="team-grid">
        {state.employees.map((employee, index) => {
          const job = tasks.find(t => t.status === 'inprogress' && t.assignedTo === employee.id)
          return (
            <article key={employee.id} className={employee.state === 'burnout' ? 'team-card burnout' : 'team-card'}>
              <Portrait name={employee.name} index={index} color={ROLE_COLOR[employee.role]} />
              <div className="team-card-body">
                <b>{employee.name}</b>
                <small>{ROLE_LABEL[employee.role]} · {employee.specialization}</small>
                <small className={`team-zeroes z${employee.zeroes ?? 0}`}>{employee.state === 'burnout' ? '🔥 Burnout: não pode trabalhar' : `Esgotou ${employee.zeroes ?? 0}/2 neste projeto`}</small>
                {bars(employee).map(([label, value, tone]) => (
                  <div key={label} className="team-stat">
                    <small>{label}</small>
                    <span className={`hud-meter ${tone}`}><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>
                    <small>{Math.round(value)}</small>
                  </div>
                ))}
                <div className="team-card-foot">
                  <small className={job ? 'team-job busy' : 'team-job'}>{job ? `⚙ ${job.name}` : employee.state === 'working' ? '⚙ Ocupado' : '💤 Livre'}</small>
                  {employee.state === 'burnout'
                    ? <button className="team-bonus treat" disabled={state.balance < WELLNESS.treatPrice} onClick={() => onTreat(employee.id)}>🧠 Psicólogo {formatMoney(WELLNESS.treatPrice)}</button>
                    : <button className="team-bonus" disabled={state.balance < 1_000} onClick={() => onBonus(employee.id)}>🎁 Bônus R$ 1.000</button>}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className={state.psychologist ? 'team-psy hired' : 'team-psy'}>
        <Portrait name="Helena" index={0} color="#14b8a6" />
        <div>
          <b>{state.psychologist ? 'Dra. Helena · psicóloga da empresa' : 'Contratar uma psicóloga para a empresa'}</b>
          <small>{state.psychologist
            ? `Equipe 15% mais produtiva, cansa menos e nenhum burnout. Custa ${formatMoney(PSYCHOLOGIST_DAILY)} por dia.`
            : `Equipe 15% mais produtiva, cansa menos e burnouts tratados na hora. ${formatMoney(WELLNESS.psychHire)} + ${formatMoney(PSYCHOLOGIST_DAILY)} por dia.`}</small>
        </div>
        {!state.psychologist && <button className="mission-accept" disabled={state.balance < WELLNESS.psychHire} onClick={onPsychologist}>Contratar</button>}
      </div>

      <div className="team-hire">
        <span className="setup-label">Contratar</span>
        <div className="team-roles" role="group" aria-label="Cargo a contratar">
          {roles.map(item => (
            <button key={item} className="team-role" aria-pressed={role === item} onClick={() => setRole(item)}>
              <i style={{ background: ROLE_COLOR[item] }} />
              <b>{ROLE_LABEL[item]}</b>
              {missing(item) && <small>❗ Falta no projeto</small>}
            </button>
          ))}
        </div>
        {full ? (
          <p className="team-full">🪑 Todas as {desks} mesas estão ocupadas. Amplie o escritório na loja do tutor ou compre um andar pelo elevador.</p>
        ) : (
          <div className="team-hire-actions">
            <button className="mission-accept setup-confirm" disabled={!canPay} onClick={() => onHire(role)}>
              {canPay ? `+ Contratar ${ROLE_LABEL[role]} · R$ 1.200` : 'Caixa insuficiente · R$ 1.200'}
            </button>
            <button className="mission-negotiate setup-confirm senior" disabled={gpusOf(state) < 2} onClick={() => onHire(role, true)}>
              ★ Sênior · 2 placas
            </button>
          </div>
        )}
      </div>
    </PixelModal>
  )
}

function TutorModal({ state, onFeed, onBuy, onUpgrade, onClose }: { state: GameState; onFeed: () => void; onBuy: () => void; onUpgrade: () => void; onClose: () => void }) {
  const office = officeOf(state)
  const upgrade = nextOffice(state)
  const [act, setAct] = useState<TutorAct>('idle')
  const eating = act !== 'idle'
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  const gpus = gpusOf(state)
  const turbo = turboDaysLeft(state)
  const canBuy = state.balance >= GPU_PRICE

  function feed() {
    if (!gpus || turbo > 0 || eating) return
    onFeed()
    // Vê a placa, engole, mastiga e arrota
    const script: Array<[TutorAct, number]> = [['see', 0], ['gulp', 900], ['chew', 1500], ['burp', 3000], ['idle', 4200]]
    const noise: Partial<Record<TutorAct, Sound>> = { see: 'coin', gulp: 'chomp', chew: 'chomp', burp: 'burp' }
    timers.current = script.map(([next, at]) => window.setTimeout(() => {
      setAct(next)
      const sound = noise[next]
      if (sound) sfx(sound)
    }, at))
  }

  return (
    <PixelModal className="setup-modal tutor-modal" title="Tutor e loja" subtitle="Ele precisa de placas de vídeo para processar imagens" onClose={onClose} wide>
      <div className="tutor-grid">
        <div className={`tutor-stage ${turbo ? 'charged' : ''}`}>
          <TutorScene act={act} />
          <p className="tutor-bubble">
            {act === 'see' ? 'Uma placa de vídeo! Agora sim!'
              : act === 'gulp' || act === 'chew' ? 'Processando imagens a todo vapor…'
              : act === 'burp' ? 'Imagens processadas! Equipe turbinada!'
              : turbo ? `Processando imagens por mais ${daysLabel(turbo)}!`
              : gpus ? 'Preciso de placas de vídeo para processar imagens. Me dá uma?'
              : 'Sem placa de vídeo não consigo processar imagens. Passe na loja!'}
          </p>
        </div>

        <div className="tutor-side">
          <section className="fin-panel">
            <h3>Suas placas</h3>
            <div className="tutor-gems" aria-label={`${gpus} placas de vídeo`}>
              {gpus === 0 && <small>Nenhuma placa</small>}
              {Array.from({ length: Math.min(gpus, 6) }, (_, i) => <GpuIcon key={i} />)}
              {gpus > 6 && <b>+{gpus - 6}</b>}
            </div>
            <button className="mission-accept tutor-feed" disabled={!gpus || turbo > 0 || eating} onClick={feed}>
              {turbo ? `Turbo ativo · ${daysLabel(turbo)}` : gpus ? '▶ Dar uma placa ao tutor' : 'Sem placas'}
            </button>
            <ul className="tutor-perks">
              <li>⚡ Energia da equipe em dobro na hora</li>
              <li>⏱ Cada tarefa anda o dobro por dia</li>
              <li>😌 A equipe cansa metade</li>
              <li>📅 Dura {daysLabel(TURBO_DAYS)}</li>
            </ul>
          </section>

          <section className="fin-panel">
            <h3>Loja</h3>
            <div className="fin-row"><span><GpuIcon /> Placa de vídeo</span><b>{formatMoney(GPU_PRICE)}</b></div>
            <button className="mission-negotiate tutor-buy" disabled={!canBuy} onClick={onBuy}>{canBuy ? 'Comprar placa' : 'Caixa insuficiente'}</button>
            <small>Também ganha uma ao entregar um contrato com 100% de qualidade.</small>
          </section>

          <section className="fin-panel">
            <h3>Escritório · {office.name}</h3>
            {upgrade ? (
              <>
                <div className="fin-row"><span>🏢 {upgrade.name}: {upgrade.desks} mesas, equipe recupera +{upgrade.energy} energia e entrega +{upgrade.quality}% de qualidade</span><b>{formatMoney(upgrade.cost)}</b></div>
                <button className="mission-negotiate tutor-buy" disabled={state.balance < upgrade.cost} onClick={onUpgrade}>{state.balance < upgrade.cost ? 'Caixa insuficiente' : `Mudar para ${upgrade.name}`}</button>
              </>
            ) : <small>🏆 Você já está na maior sede.</small>}
          </section>
        </div>
      </div>
    </PixelModal>
  )
}

function FinanceModal({ state, onLoan, onRepay, onClose }: { state: GameState; onLoan: () => void; onRepay: () => void; onClose: () => void }) {
  const bankruptcy = daysToBankruptcy(state)
  const daily = dailyEmployeeCost(state)
  const runway = daily > 0 ? Math.floor(state.balance / daily) : null
  const result = state.revenue - state.expenses
  const peak = Math.max(state.revenue, state.expenses, 1)
  const active = state.contracts.filter(c => ['accepted', 'inprogress'].includes(c.status))
  const payroll = state.employees.reduce((sum, e) => sum + e.salary, 0) / 30
  // Mesma proporção usada no custo diário: salários + R$ 130 de estrutura
  const payrollShare = Math.round(daily * payroll / (payroll + 130))
  const status = state.balance < 0
    ? { tone: 'bad', title: `Falência em ${daysLabel(bankruptcy ?? 0)}`, text: 'Volte ao azul antes disso: entregue um projeto ou peça um empréstimo.' }
    : runway !== null && runway < 15
      ? { tone: 'warn', title: runway === 0 ? 'Não cobre mais um dia' : `Dura ${daysLabel(runway)}`, text: 'O caixa está curto. Evite novos gastos.' }
      : { tone: 'good', title: runway === null ? 'Sem custo diário' : `Dura ${daysLabel(runway)}`, text: 'As contas estão em dia.' }

  return (
    <PixelModal className="setup-modal finance-modal" title="Finanças" subtitle="Sustentabilidade da empresa" onClose={onClose} wide>
      <div className={`fin-vault ${status.tone}`}>
        <SpinningCoin />
        <div className="fin-balance">
          <small>Caixa</small>
          <b>{formatMoney(state.balance)}</b>
        </div>
        <div className="fin-status">
          <b>{status.title}</b>
          <small>{status.text}</small>
        </div>
      </div>

      <div className="fin-grid">
        <section className="fin-panel">
          <h3>Desde a fundação</h3>
          <div className="fin-flow">
            <span>▲ Receitas</span>
            <span className="hud-meter green"><i style={{ width: `${state.revenue / peak * 100}%` }} /></span>
            <b>{formatMoney(state.revenue)}</b>
          </div>
          <div className="fin-flow">
            <span>▼ Despesas</span>
            <span className="hud-meter red"><i style={{ width: `${state.expenses / peak * 100}%` }} /></span>
            <b>{formatMoney(state.expenses)}</b>
          </div>
          <div className={`fin-total ${result < 0 ? 'bad' : 'good'}`}>
            <span>Resultado</span>
            <b>{result > 0 ? '+' : ''}{formatMoney(result)}</b>
          </div>
        </section>

        <section className="fin-panel">
          <h3>Custo por dia</h3>
          <div className="fin-row"><span>👥 Salários ({state.employees.length})</span><b>{formatMoney(payrollShare)}</b></div>
          <div className="fin-row"><span>🏢 Estrutura</span><b>{formatMoney(daily - payrollShare)}</b></div>
          <div className="fin-total bad"><span>Total por dia</span><b>{formatMoney(daily)}</b></div>
        </section>
      </div>

      <section className="fin-panel">
        <h3>Empréstimo</h3>
        {state.loan ? (
          <>
            <div className="fin-row"><span>🏦 Vence no dia {state.loan.dueDay} (desconto automático)</span><b className="fin-out">{formatMoney(state.loan.owed)}</b></div>
            <button className="mission-negotiate tutor-buy" disabled={state.balance < state.loan.owed} onClick={onRepay}>Quitar agora</button>
          </>
        ) : (
          <>
            <div className="fin-row"><span>🏦 Receba {formatMoney(LOAN.amount)} hoje e devolva {formatMoney(LOAN.owed)} em {daysLabel(LOAN.days)}</span><b>20% de juros</b></div>
            <button className="mission-negotiate tutor-buy" onClick={onLoan}>Pedir empréstimo</button>
          </>
        )}
      </section>

      <section className="fin-panel">
        <h3>A receber na entrega</h3>
        {active.length === 0 && <p>Nenhum projeto em andamento. Feche um contrato para gerar receita.</p>}
        {active.map(contract => {
          const left = contractDaysRemaining(contract, state.day)
          return (
            <div key={contract.id} className="fin-row">
              <span>📦 {contract.name} <small className={left < 0 ? 'late' : ''}>{left < 0 ? `${daysLabel(-left)} de atraso · multa ${formatMoney(contract.penaltyPerDay)}/dia` : `prazo em ${daysLabel(left)}`}</small></span>
              <b className="fin-in">{formatMoney(contract.value)}</b>
            </div>
          )
        })}
      </section>
    </PixelModal>
  )
}

export default PixelApp
