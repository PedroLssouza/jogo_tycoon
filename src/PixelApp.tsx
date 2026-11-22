import React, { useEffect, useState } from 'react'
import { createEmployee } from './employees'
import {
  calculateProjectQuality,
  calculateTaskGain,
  contractDaysRemaining,
  createInitialState,
  createProjectTasks,
  dailyEmployeeCost,
  evaluateOffer,
  getAllStarterContracts,
  settlementFor,
  taskDependenciesDone,
} from './game'
import { deleteSave, loadGame, saveGame } from './storage'
import type { Contract, Difficulty, GameState, Role, Task } from './types'
import { clamp, formatMoney, uid } from './utils'
import './pixel.css'

type PixelScreen = 'menu' | 'office' | 'contract' | 'kanban' | 'results'
type Modal = 'setup' | 'negotiation' | 'tasks' | 'team' | 'finance' | null

const ROLE_LABEL: Record<Role, string> = {
  frontend: 'Front-end',
  backend: 'Back-end',
  fullstack: 'Full Stack',
  designer: 'UI/UX Designer',
  qa: 'QA / Testes',
  pm: 'Gerente / PM',
  devops: 'DevOps & Cloud',
}

const ROLE_SHORT: Record<Role, string> = {
  frontend: 'FRONT',
  backend: 'BACK',
  fullstack: 'FULL',
  designer: 'UI/UX',
  qa: 'QA',
  pm: 'PM',
  devops: 'OPS',
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

const ROLE_HAIR: Record<Role, string> = {
  frontend: '#78350f',
  backend: '#1e1b4b',
  fullstack: '#0f172a',
  designer: '#d97706',
  qa: '#b45309',
  pm: '#374151',
  devops: '#64748b',
}

const ROLE_CODE_COLORS: Record<Role, [string, string, string]> = {
  frontend: ['#4cf17c', '#63e8ff', '#ffd166'],
  backend: ['#63e8ff', '#ffd166', '#a855f7'],
  fullstack: ['#38bdf8', '#4cf17c', '#f59e0b'],
  designer: ['#ec4899', '#f43f5e', '#a855f7'],
  qa: ['#f59e0b', '#10b981', '#ef4444'],
  pm: ['#14b8a6', '#3b82f6', '#f59e0b'],
  devops: ['#ef4444', '#f97316', '#22c55e'],
}

function PixelApp() {
  const [state, setState] = useState<GameState | null>(() => {
    const loaded = loadGame()
    if (!loaded) return null
    if ((!loaded.availableContracts || loaded.availableContracts.length <= 1) && loaded.contracts.length === 0) {
      return { ...loaded, availableContracts: getAllStarterContracts() }
    }
    return loaded
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
    const completed = state.contracts.some(contract => contract.status === 'completed')
    setScreen(completed ? 'results' : 'office')
  }

  function signContract(contractToSign: Contract, value: number, deadlineDays: number) {
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
    setState(current => {
      if (!current) return current
      const cost = dailyEmployeeCost(current)
      let reachedReview = 0
      const contracts = current.contracts.map(contract => {
        if (!['accepted', 'inprogress'].includes(contract.status)) return contract
        return {
          ...contract,
          status: 'inprogress' as const,
          tasks: contract.tasks.map(task => {
            if (task.status !== 'inprogress' || !task.assignedTo) return task
            const employee = current.employees.find(item => item.id === task.assignedTo)
            if (!employee) return task
            const gain = calculateTaskGain(employee, task, current.difficulty)
            const progress = clamp(task.progress + gain)
            if (progress >= 100) reachedReview += 1
            return { ...task, progress, status: progress >= 100 ? 'review' as const : task.status }
          }),
        }
      })
      const busyIds = new Set(contracts.flatMap(contract => contract.tasks.filter(task => task.status === 'inprogress').map(task => task.assignedTo)))
      return {
        ...current,
        day: current.day + 1,
        balance: current.balance - cost,
        expenses: current.expenses + cost,
        profit: current.revenue - current.expenses - cost,
        contracts,
        employees: current.employees.map(employee => ({
          ...employee,
          energy: clamp(employee.energy + (busyIds.has(employee.id) ? -7 : 9)),
          state: busyIds.has(employee.id) ? 'working' : 'idle',
          currentTaskId: busyIds.has(employee.id) ? employee.currentTaskId : null,
        })),
        gameLog: [{ day: current.day + 1, message: reachedReview ? `${reachedReview} tarefa(s) pronta(s) para validação.` : `Custo operacional diário: ${formatMoney(cost)}.` }, ...current.gameLog],
      }
    })
    setToast('Dia avançado: progresso, caixas e energia atualizados!')
  }

  function approveTask(taskId: string) {
    let finished = false
    setState(current => {
      if (!current) return current
      const active = current.contracts.find(contract => contract.id === project?.id)
      const task = active?.tasks.find(item => item.id === taskId)
      if (!active || !task || task.status !== 'review') return current
      const employee = current.employees.find(item => item.id === task.assignedTo)
      const isIdeal = employee?.role === task.requiredRole
      const isAlt = employee && ((task.secondaryRole && employee.role === task.secondaryRole) || (employee.role === 'fullstack' && ['frontend', 'backend'].includes(task.requiredRole)))
      const techBonus = isIdeal ? 10 : isAlt ? 5 : -4
      const quality = clamp(Math.round((employee?.quality ?? 60) * .88 + (employee?.energy ?? 60) * .12 + techBonus), 50, 100)
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
      return {
        ...current,
        balance,
        revenue,
        reputation,
        profit: revenue - current.expenses,
        contracts: current.contracts.map(contract => contract.id === active.id ? updated : contract),
        employees: current.employees.map(item => item.id === task.assignedTo ? { ...item, state: 'idle', currentTaskId: null } : item),
      }
    })
    if (finished) { setModal(null); setScreen('results'); setToast('🎉 Projeto concluído e entregue com sucesso!') }
    else setToast('✓ Tarefa validada e movida para Concluído.')
  }

  function hire(role: Role) {
    setState(current => {
      if (!current || current.balance < 1_200) return current
      const employee = createEmployee(role, 15)
      employee.hiredAt = current.day
      return { ...current, balance: current.balance - 1_200, expenses: current.expenses + 1_200, employees: [...current.employees, employee] }
    })
    setToast('Novo talento contratado por R$ 1.200.')
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
      <header className="pixel-brandbar">
        <button className="pixel-logo" onClick={() => setScreen('menu')} aria-label="Voltar ao menu">
          <span className="growth">▁▃▆↗</span><b>Project <em>Tycoon</em></b>
        </button>
        {state && screen !== 'menu' && (
          <div className="compact-hud">
            <span>💵 {formatMoney(state.balance)}</span>
            <span>⭐ {state.reputation} rep</span>
            <span>📅 Dia {state.day}</span>
          </div>
        )}
      </header>

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
          />
        )}
        {screen === 'contract' && (
          <MultiContractScreen
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
            project={project}
            completion={completion}
            onAssign={assignTask}
            onApprove={approveTask}
            onAdvance={advanceDay}
            onBack={() => setScreen('office')}
            onTeam={() => setModal('team')}
          />
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
      {modal === 'team' && state && <TeamModal state={state} onClose={() => setModal(null)} onHire={hire} />}
      {modal === 'finance' && state && <FinanceModal state={state} onClose={() => setModal(null)} />}
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
    <div className="native-slide-container">
      <header className="slide-top-header">
        <span className="slide-badge">INÍCIO DA JORNADA</span>
        <h1 className="slide-title">01 / Menu principal</h1>
        <p className="slide-subtitle">A entrada para construir sua primeira empresa de software.</p>
      </header>

      <div className="slide-main-layout">
        <section className="arcade-window">
          <div className="arcade-titlebar">
            <span className="titlebar-icon-sq" />
            <span className="titlebar-text">Menu Principal</span>
            <div className="titlebar-controls">🗕 🗖 🗙</div>
          </div>

          <div className="arcade-content-area menu-grid-content">
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
              <svg viewBox="0 0 320 240" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
                {/* Céu noturno da janela */}
                <rect x="180" y="20" width="120" height="110" fill="#0b0e28" rx="4" />
                <circle cx="200" cy="40" r="1.5" fill="#fff" />
                <circle cx="240" cy="35" r="1.5" fill="#63e8ff" />
                <circle cx="280" cy="50" r="1.5" fill="#ffd166" />
                {/* Lua suave */}
                <circle cx="265" cy="45" r="12" fill="#ffd166" opacity="0.8" />
                {/* Silhueta da cidade no horizonte */}
                <rect x="185" y="65" width="25" height="65" fill="#141a4a" />
                <rect x="215" y="55" width="30" height="75" fill="#1b2260" />
                <rect x="250" y="70" width="22" height="60" fill="#141a4a" />
                <rect x="275" y="60" width="22" height="70" fill="#1a205a" />
                {/* Janelas iluminadas da cidade */}
                <rect x="220" y="65" width="4" height="5" fill="#ffd166" />
                <rect x="232" y="75" width="4" height="5" fill="#63e8ff" />
                <rect x="220" y="85" width="4" height="5" fill="#ffd166" />
                <rect x="282" y="75" width="4" height="5" fill="#ffd166" />

                {/* Estante de livros com planta trepadeira */}
                <rect x="110" y="30" width="60" height="8" fill="#50372b" />
                <rect x="115" y="16" width="7" height="14" fill="#a855f7" />
                <rect x="124" y="14" width="8" height="16" fill="#63e8ff" />
                <rect x="134" y="18" width="6" height="12" fill="#4cf17c" />
                {/* Vaso e folhas trepadeiras balançando */}
                <rect x="146" y="20" width="14" height="10" fill="#2d1d15" rx="2" />
                <path d="M148 30 Q144 45 142 55 Q138 65 140 75" stroke="#22c55e" strokeWidth="2.5" fill="none" />
                <circle cx="144" cy="42" r="3" fill="#16a34a" />
                <circle cx="140" cy="58" r="3.5" fill="#22c55e" />
                <circle cx="142" cy="72" r="3" fill="#15803d" />

                {/* Lâmpada de teto pendente */}
                <line x1="165" y1="0" x2="165" y2="70" stroke="#778" strokeWidth="1.5" />
                <polygon points="155,70 175,70 180,82 150,82" fill="#333855" />
                <ellipse cx="165" cy="82" rx="15" ry="5" fill="#ffc75a" />
                {/* Brilho de luz cônico */}
                <polygon points="150,82 180,82 225,185 105,185" fill="url(#lampGradient)" opacity="0.3" />

                {/* Mesa de Trabalho */}
                <rect x="90" y="145" width="220" height="16" fill="#4a3020" rx="2" />
                <rect x="105" y="161" width="12" height="79" fill="#2d1c12" />
                <rect x="285" y="161" width="12" height="79" fill="#2d1c12" />

                {/* Monitor Gamer / CRT */}
                <rect x="195" y="98" width="70" height="48" fill="#1e2238" stroke="#3b426f" strokeWidth="2" rx="3" />
                <rect x="200" y="103" width="60" height="38" fill="#0c1432" rx="2" />
                <rect x="225" y="146" width="10" height="10" fill="#282d4a" />
                <rect x="215" y="154" width="30" height="4" fill="#3b426f" rx="1" />
                {/* Código rolando no monitor */}
                <line x1="205" y1="110" x2="245" y2="110" stroke="#4cf17c" strokeWidth="2" />
                <line x1="205" y1="116" x2="235" y2="116" stroke="#63e8ff" strokeWidth="2" />
                <line x1="210" y1="122" x2="252" y2="122" stroke="#a855f7" strokeWidth="2" />
                <line x1="205" y1="128" x2="225" y2="128" stroke="#ffd166" strokeWidth="2" />
                <line x1="205" y1="134" x2="248" y2="134" stroke="#4cf17c" strokeWidth="2" />

                {/* Teclado e Caneca na mesa */}
                <rect x="185" y="148" width="45" height="5" fill="#2b314e" rx="1" />
                <rect x="250" y="136" width="10" height="12" fill="#e2e8f0" rx="1" />
                <rect x="260" y="139" width="3" height="6" fill="#cbd5e1" />
                {/* Fumaça da caneca */}
                <path d="M254 133 Q252 126 255 120 Q257 114 254 108" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6" />

                {/* Cadeira Gamer */}
                <rect x="142" y="115" width="46" height="65" fill="#1b203c" stroke="#384070" strokeWidth="2" rx="6" />
                <rect x="160" y="180" width="10" height="40" fill="#15192e" />
                <line x1="145" y1="220" x2="185" y2="220" stroke="#252c4e" strokeWidth="4" />

                {/* PERSONAGEM PROGRAMADOR RESPIRANDO */}
                <g className="pixel-char-breathe">
                  {/* Corpo / Blusa de Capuz Roxo */}
                  <rect x="146" y="140" width="38" height="42" fill="#6d28d9" rx="5" />
                  <rect x="156" y="142" width="18" height="38" fill="#5b21b6" />

                  {/* Braço e Mãos Digitando */}
                  <rect x="168" y="146" width="22" height="10" fill="#6d28d9" rx="3" />
                  <g className="pixel-hands-typing">
                    <rect x="188" y="147" width="8" height="7" fill="#fcd34d" rx="2" />
                  </g>

                  {/* Cabeça do Dev Respirando */}
                  <g className="pixel-head-breathe">
                    <circle cx="165" cy="125" r="14" fill="#fcd34d" />
                    {/* Cabelo castanho espetado */}
                    <path d="M151 125 C150 110 162 108 172 110 C180 112 181 120 178 128 C172 120 160 118 151 125 Z" fill="#451a03" />
                    {/* Fone de Ouvido Gamer */}
                    <rect x="160" y="115" width="5" height="12" fill="#06b6d4" rx="2" />
                    <path d="M155 116 Q165 110 174 116" stroke="#06b6d4" strokeWidth="2.5" fill="none" />
                  </g>
                </g>

                <defs>
                  <linearGradient id="lampGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffc75a" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#ffc75a" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </section>

        {/* 3 Cartões Laterais Idênticos aos Slides */}
        <aside className="side-cards-column">
          <div className="side-card purple">
            <span className="side-card-tag">COMEÇAR</span>
            <h3 className="side-card-title">Nova partida</h3>
            <span className="side-card-sub">Crie sua software house do zero</span>
          </div>

          <div className="side-card cyan">
            <span className="side-card-tag">CONTINUAR</span>
            <h3 className="side-card-title">Retomar empresa</h3>
            <span className="side-card-sub">Continue sua jornada empresarial</span>
          </div>

          <div className="side-card orange">
            <span className="side-card-tag">IDENTIDADE</span>
            <h3 className="side-card-title">Pixel art viva</h3>
            <span className="side-card-sub">Simulador de gestão interativo</span>
          </div>
        </aside>
      </div>

      <footer className="slide-bottom-bar">
        <span>PROJECT TYCOON</span>
        <span>DEMONSTRAÇÃO · TELA 1</span>
        <span>04 / 09</span>
      </footer>
    </div>
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
}: {
  state: GameState | null
  onContract: () => void
  onKanban: () => void
  onTeam: () => void
  onFinance: () => void
  onMenu: () => void
}) {
  if (!state) return null
  const hasContracts = state.availableContracts.length > 0

  return (
    <div className="native-slide-container">
      <header className="slide-top-header">
        <span className="slide-badge">SEU CENTRO DE CONTROLE</span>
        <h1 className="slide-title">02 / Escritório da empresa</h1>
        <p className="slide-subtitle">Dinheiro, reputação, tempo e novas oportunidades em um só lugar.</p>
      </header>

      <div className="slide-main-layout">
        <section className="arcade-window">
          <div className="arcade-titlebar">
            <span className="titlebar-icon-sq" />
            <span className="titlebar-text">Escritório da Empresa · {state.company}</span>
            <div className="titlebar-controls">🗕 🗖 🗙</div>
          </div>

          <div className="arcade-content-area office-grid-content">
            {/* HUD Superior Nativo */}
            <div className="office-native-hud">
              <div className="office-hud-pill green">
                <span>💲 {formatMoney(state.balance)}</span>
                <small style={{ color: '#4cf17c', fontSize: 10 }}>+2.5% ▲</small>
              </div>

              <div className="office-hud-pill yellow">
                <span>⭐ Reputação: {state.reputation}/100</span>
              </div>

              <div className="office-hud-pill">
                <span>📅 Dia {state.day}</span>
              </div>

              {hasContracts && (
                <button className="office-hud-contract-btn" onClick={onContract}>
                  🏆 {state.availableContracts.length} novo(s) contrato(s)!
                </button>
              )}

              <div className="office-hud-time">
                <button className="btn-office-time" onClick={onKanban}>
                  ▶ KANBAN
                </button>
              </div>
            </div>

            {/* Sala Isométrica Dinâmica — 1 desk por funcionário contratado */}
            <div className="office-isometric-canvas">
              {(() => {
                // 2 fileiras de 4 desks — organização isométrica em fileiras
                const DESK_SLOTS = [
                  // Fileira traseira (mais ao fundo)
                  { tx: 100, ty: 118 },
                  { tx: 185, ty:  88 },
                  { tx: 272, ty:  88 },
                  { tx: 357, ty: 118 },
                  // Fileira frontal (mais próxima ao observador)
                  { tx:  82, ty: 196 },
                  { tx: 182, ty: 176 },
                  { tx: 282, ty: 176 },
                  { tx: 372, ty: 196 },
                ]
                const emps = state.employees
                return (
                  <svg viewBox="0 0 540 310" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
                    {/* Piso */}
                    <polygon points="270,40 520,155 270,290 20,155" fill="#1b2252" stroke="#38438e" strokeWidth="2" />
                    <line x1="270" y1="40" x2="270" y2="290" stroke="#272e72" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="145" y1="98" x2="395" y2="218" stroke="#272e72" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="395" y1="98" x2="145" y2="218" stroke="#272e72" strokeWidth="1" strokeDasharray="4 4" />
                    {/* grade fina extra entre fileiras */}
                    <line x1="80" y1="162" x2="400" y2="162" stroke="#2a3378" strokeWidth="0.8" strokeDasharray="6 5" opacity="0.6" />

                    {/* Parede esquerda + janela de floresta */}
                    <polygon points="20,155 270,40 270,10 20,115" fill="#121840" stroke="#37427e" strokeWidth="2" />
                    <polygon points="38,140 252,38 252,16 38,116" fill="#0f3b32" stroke="#248066" strokeWidth="1.5" />
                    {/* grade da janela */}
                    <line x1="145" y1="27" x2="145" y2="128" stroke="#1a5e44" strokeWidth="1" />
                    <line x1="38" y1="78" x2="252" y2="27" stroke="#1a5e44" strokeWidth="1" />
                    <circle cx="88" cy="88" r="22" fill="#15803d" />
                    <circle cx="136" cy="68" r="18" fill="#16a34a" />
                    <circle cx="185" cy="52" r="20" fill="#22c55e" />

                    {/* Parede direita + logo + quadro kanban */}
                    <polygon points="270,40 520,155 520,115 270,10" fill="#161c50" stroke="#37427e" strokeWidth="2" />
                    <rect x="306" y="34" width="96" height="32" fill="#0d1238" stroke="#63e8ff" strokeWidth="1.5" rx="3" />
                    <text x="354" y="48" fill="#63e8ff" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">◆ PROJECT TYCOON ◆</text>
                    <text x="354" y="58" fill="#4a7af0" fontSize="5" textAnchor="middle" fontFamily="monospace">SOFTWARE HOUSE SIM</text>
                    {/* Lousa de tarefas */}
                    <rect x="414" y="68" width="82" height="48" fill="#e8ecf0" stroke="#64748b" strokeWidth="2" rx="2" />
                    <text x="455" y="80" fill="#334155" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="monospace">SPRINT BOARD</text>
                    {['#ffc75a','#ff5277','#4cf17c','#63e8ff','#c084fc','#ffd166'].map((c, i) => (
                      <rect key={i} x={420 + (i % 3) * 17} y={84 + Math.floor(i / 3) * 14} width="12" height="10" fill={c} rx="1" />
                    ))}
                    {/* Bebedouro + café */}
                    <rect x="476" y="130" width="16" height="30" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
                    <circle cx="484" cy="124" r="8" fill="#60a5fa" opacity="0.85" />
                    <circle cx="484" cy="126" r="2" fill="#fff" opacity="0.9" />
                    <rect x="498" y="140" width="14" height="20" fill="#334155" rx="2" />
                    <path d="M504 137 Q502 130 505 123" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.7" />

                    {/* ===== DESKS DINÂMICOS EM 2 FILEIRAS ===== */}
                    {DESK_SLOTS.map((slot, idx) => {
                      const emp = emps[idx]
                      const shirtColor  = emp ? ROLE_COLOR[emp.role]       : '#1e2a4a'
                      const hairColor   = emp ? ROLE_HAIR[emp.role]        : '#334155'
                      const codeColors  = emp ? ROLE_CODE_COLORS[emp.role] : ['#334155','#475569','#64748b']
                      const isWorking   = emp?.state === 'working'
                      const isLowEnergy = emp && emp.energy < 30
                      const roleTxt     = emp ? ROLE_SHORT[emp.role] : ''
                      return (
                        <g key={idx} transform={`translate(${slot.tx}, ${slot.ty})`} className="office-desk-slot">
                          {/* Mesa */}
                          <rect x="24" y="16" width="46" height="22" fill="#3b2b20" stroke="#5d4332" strokeWidth="1.5" rx="2" />
                          {/* Monitor */}
                          <rect x="34" y="0" width="26" height="18" fill="#1c2838" stroke="#475569" strokeWidth="1" rx="2" />
                          <rect x="36" y="2" width="22" height="14" fill={emp ? '#040d22' : '#0a0f20'} />
                          {emp ? (
                            <>
                              <line x1="38" y1="6"  x2="56" y2="6"  stroke={codeColors[0]} strokeWidth="1.5" />
                              <line x1="38" y1="10" x2="52" y2="10" stroke={codeColors[1]} strokeWidth="1.5" />
                              <line x1="38" y1="14" x2="47" y2="14" stroke={codeColors[2]} strokeWidth="1" />
                              <text x="47" y="9" fill="rgba(255,255,255,0.75)" fontSize="4" textAnchor="middle" fontFamily="monospace">{roleTxt}</text>
                            </>
                          ) : (
                            <text x="47" y="11" fill="#2d3a6a" fontSize="7" textAnchor="middle" fontFamily="monospace">···</text>
                          )}
                          {/* Cadeira */}
                          <rect x="1" y="11" width="20" height="27" fill="#181d38" rx="4" />

                          {emp ? (
                            <g className="pixel-char-breathe">
                              <rect x="4" y="15" width="17" height="20" fill={shirtColor} rx="3" />
                              <rect x="18" y="20" width="8" height="4" fill="#fcd34d" rx="1" />
                              <g className="pixel-head-breathe">
                                <circle cx="11" cy="9" r="8"  fill="#fcd34d" />
                                <circle cx="11" cy="6" r="7"  fill={hairColor} />
                                <circle cx="8.5"  cy="10" r="1" fill="#1e293b" />
                                <circle cx="13.5" cy="10" r="1" fill="#1e293b" />
                              </g>
                              {isWorking && (
                                <g>
                                  <circle cx="22" cy="4" r="4.5" fill="#4cf17c" opacity="0.95" />
                                  <text x="22" y="7" fill="#06200e" fontSize="5" textAnchor="middle">⚙</text>
                                </g>
                              )}
                              {isLowEnergy && (
                                <g>
                                  <rect x="-2" y="4" width="10" height="6" fill="#ff5277" rx="2" />
                                  <text x="3" y="9" fill="#fff" fontSize="4.5" textAnchor="middle">😩</text>
                                </g>
                              )}
                            </g>
                          ) : (
                            <g className="office-empty-desk-badge">
                              <rect x="2" y="12" width="17" height="23" fill="rgba(14,20,70,0.8)" stroke="#2a3480" strokeWidth="1" rx="4" strokeDasharray="3 2" />
                              <text x="10" y="21" fill="#3a4890" fontSize="8" textAnchor="middle" fontFamily="monospace">+</text>
                              <text x="10" y="29" fill="#3a4890" fontSize="4" textAnchor="middle" fontFamily="monospace">VAGA</text>
                            </g>
                          )}
                          {emp && (
                            <text x="47" y="43" fill="rgba(255,255,255,0.72)" fontSize="4.8" textAnchor="middle" fontFamily="monospace">
                              {emp.name.split(' ')[0]}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                )
              })()}
            </div>

            {/* Barra Inferior com Botões Reais Nativos Clicáveis */}
            <nav className="office-bottom-nav">
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
              <button className="btn-office-nav" onClick={onMenu}>
                <span className="nav-icon-glyph">‹</span>
                <span>Menu</span>
              </button>
            </nav>
          </div>
        </section>

        {/* 3 Cartões Laterais Idênticos aos Slides */}
        <aside className="side-cards-column">
          <div className="side-card cyan">
            <span className="side-card-tag">CAIXA</span>
            <h3 className="side-card-title">{formatMoney(state.balance)}</h3>
            <span className="side-card-sub">Controlar gastos operacionais</span>
          </div>

          <div className="side-card purple">
            <span className="side-card-tag">PESSOAS</span>
            <h3 className="side-card-title">{state.employees.length} no time</h3>
            <span className="side-card-sub">Gerir energia e produtividade</span>
          </div>

          <div className="side-card orange">
            <span className="side-card-tag">CLIENTES</span>
            <h3 className="side-card-title">{state.availableContracts.length} contratos</h3>
            <span className="side-card-sub">Novas oportunidades no mercado</span>
          </div>
        </aside>
      </div>

      <footer className="slide-bottom-bar">
        <span>PROJECT TYCOON</span>
        <span>DEMONSTRAÇÃO · TELA 2</span>
        <span>05 / 09</span>
      </footer>
    </div>
  )
}

/* =========================================================================
   CENA NATIVA 04: QUADRO KANBAN REAL
   ========================================================================= */
function NativeKanbanScene({
  state,
  project,
  completion,
  onAssign,
  onApprove,
  onAdvance,
  onBack,
  onTeam,
}: {
  state: GameState | null
  project?: Contract
  completion: number
  onAssign: (taskId: string, empId: string) => void
  onApprove: (taskId: string) => void
  onAdvance: () => void
  onBack: () => void
  onTeam: () => void
}) {
  if (!state || !project) {
    return (
      <div className="pixel-empty">
        <h2>SEM PROJETO ATIVO</h2>
        <p>Negocie ou aceite uma proposta no mercado para abrir o Kanban.</p>
        <button onClick={onBack}>VOLTAR AO ESCRITÓRIO</button>
      </div>
    )
  }

  const columns: Array<{ id: Task['status']; title: string; count: number; colorClass: string }> = [
    { id: 'todo', title: 'A Fazer (Backlog)', count: project.tasks.filter(t => t.status === 'todo').length, colorClass: 'todo' },
    { id: 'inprogress', title: 'Em Desenvolvimento', count: project.tasks.filter(t => t.status === 'inprogress').length, colorClass: 'inprogress' },
    { id: 'review', title: 'Em Testes / QA', count: project.tasks.filter(t => t.status === 'review').length, colorClass: 'review' },
    { id: 'done', title: 'Concluído', count: project.tasks.filter(t => t.status === 'done').length, colorClass: 'done' },
  ]

  const availableDevs = state.employees.filter(emp => !project.tasks.some(t => t.status === 'inprogress' && t.assignedTo === emp.id))

  return (
    <div className="native-slide-container">
      <header className="slide-top-header">
        <span className="slide-badge">GESTÃO NA PRÁTICA</span>
        <h1 className="slide-title">04 / Quadro Kanban</h1>
        <p className="slide-subtitle">O jogador enxerga o fluxo de trabalho e decide o que acontece em seguida.</p>
      </header>

      <div className="slide-main-layout">
        <section className="arcade-window">
          <div className="arcade-titlebar">
            <span className="titlebar-icon-sq" />
            <span className="titlebar-text">Gerenciamento do Projeto (Kanban)</span>
            <div className="titlebar-controls">🗕 🗖 🗙</div>
          </div>

          <div className="arcade-content-area kanban-grid-content">
            {/* Topo do Kanban com Progresso */}
            <div className="kanban-top-info">
              <div className="kanban-project-name">
                <span>📁 {project.name}</span>
                <small style={{ color: '#9ea8eb', fontSize: 11 }}>({project.client})</small>
              </div>

              <div className="kanban-progress-wrapper">
                <span style={{ font: '700 13px Pixelify Sans', color: 'white' }}>Progresso: {completion}%</span>
                <div className="kanban-progress-bar-bg">
                  <div className="kanban-progress-fill" style={{ width: `${completion}%` }} />
                </div>
              </div>
            </div>

            {/* As 4 Colunas com Cartões Reais Clicáveis */}
            <div className="kanban-board-columns">
              {columns.map(col => (
                <div key={col.id} className={`kanban-col ${col.colorClass}`}>
                  <div className="kanban-col-head">
                    <span>{col.title}</span>
                    <span>({col.count})</span>
                  </div>

                  <div className="kanban-cards-list">
                    {project.tasks.filter(t => t.status === col.id).map(task => {
                      const unlocked = taskDependenciesDone(task, project.tasks)
                      const assignedDev = state.employees.find(e => e.id === task.assignedTo)

                      // Calcula sinergia de cada dev disponível
                      const getSynergy = (devRole: Role) => {
                        if (devRole === task.requiredRole) return { label: '⭐ Ideal (+35% vel)', cls: 'ideal' }
                        if ((task.secondaryRole && devRole === task.secondaryRole) || (devRole === 'fullstack' && ['frontend','backend'].includes(task.requiredRole))) {
                          return { label: '⚡ Adaptado (+15%)', cls: 'good' }
                        }
                        return { label: '⚠️ Básico', cls: 'basic' }
                      }

                      // Sinergia do dev já alocado
                      const devSynergy = assignedDev ? getSynergy(assignedDev.role) : null

                      return (
                        <article key={task.id} className="kanban-card">
                          {/* Cabeçalho com nome da tarefa + chip de tecnologia */}
                          <div className="kanban-card-header">
                            <h4 className="kanban-card-title">{task.name}</h4>
                            {task.technology && (
                              <span className="kanban-tech-chip">🔧 {task.technology}</span>
                            )}
                          </div>

                          {/* Papel e complexidade */}
                          <div className="kanban-role-guide">
                            <span className="role-ideal">
                              ✦ Ideal: {ROLE_LABEL[task.requiredRole]}
                            </span>
                            {task.secondaryRole && (
                              <span className="role-alt">
                                ↝ Alternativo: {ROLE_LABEL[task.secondaryRole]}
                              </span>
                            )}
                          </div>

                          {/* Complexidade */}
                          <p className="kanban-task-desc">
                            Complexidade: <b style={{ color: task.complexity >= 8 ? '#ff5277' : task.complexity >= 6 ? '#facc15' : '#4cf17c' }}>{task.complexity} pts</b>
                            {task.estimatedDays && <span style={{ color: '#94a3b8' }}> · ~{task.estimatedDays} dias</span>}
                          </p>

                          {/* Alocação */}
                          {task.status === 'todo' && (
                            <>
                              {unlocked ? (
                                <div className="kanban-assign-box">
                                  <span className="kanban-assign-label">👤 Alocar desenvolvedor:</span>
                                  <select
                                    className="kanban-dev-select"
                                    defaultValue=""
                                    onChange={e => e.target.value && onAssign(task.id, e.target.value)}
                                  >
                                    <option value="" disabled>— Escolher profissional —</option>
                                    {availableDevs.map(d => {
                                      const syn = getSynergy(d.role)
                                      return (
                                        <option key={d.id} value={d.id}>
                                          {syn.label} {d.name} · {ROLE_SHORT[d.role]}
                                        </option>
                                      )
                                    })}
                                  </select>
                                </div>
                              ) : (
                                <div className="kanban-locked-notice">
                                  🔒 Aguardando tarefas anteriores serem concluídas antes de desbloquear.
                                </div>
                              )}
                            </>
                          )}

                          {/* Em progresso */}
                          {task.status === 'inprogress' && assignedDev && (
                            <div className="kanban-working-box">
                              <div className="kanban-worker-info">
                                <div
                                  className="kanban-worker-avatar"
                                  style={{ background: ROLE_COLOR[assignedDev.role] }}
                                >
                                  {assignedDev.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                                </div>
                                <div className="kanban-worker-text">
                                  <span className="kanban-worker-name">⚙ {assignedDev.name}</span>
                                  {devSynergy && (
                                    <span className={`kanban-synergy-pill ${devSynergy.cls}`}>{devSynergy.label}</span>
                                  )}
                                </div>
                              </div>
                              <div className="kanban-progress-track">
                                <div className="kanban-progress-fill-card" style={{ width: `${task.progress}%` }} />
                              </div>
                              <div className="kanban-progress-labels">
                                <span>Progresso</span>
                                <b>{task.progress}%</b>
                              </div>
                            </div>
                          )}

                          {/* Em revisão */}
                          {task.status === 'review' && (
                            <div className="kanban-review-box">
                              <span className="review-badge">✓ Tarefa pronta para validação!</span>
                              <button className="btn-approve-task" onClick={() => onApprove(task.id)}>
                                ✔ VALIDAR TAREFA
                              </button>
                            </div>
                          )}

                          {/* Concluída */}
                          {task.status === 'done' && (
                            <div className="kanban-done-box">
                              <span className="done-check">✓ Entregue com sucesso</span>
                              <span className="done-quality">Qualidade: <b>{task.quality}%</b></span>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé do Kanban com Personagens Respirando e Botão Avançar Dia */}
            <div className="kanban-bottom-bar">
              <div className="kanban-team-row">
                <button
                  style={{ padding: '6px 12px', background: '#1c2468', border: '1.5px solid #63e8ff', color: 'white', borderRadius: 6, font: '700 11px Pixelify Sans' }}
                  onClick={onBack}
                >
                  ‹ ESCRITÓRIO
                </button>

                {state.employees.map(dev => {
                  const isWorking = project.tasks.some(t => t.status === 'inprogress' && t.assignedTo === dev.id)
                  return (
                    <div
                      key={dev.id}
                      className={`kanban-dev-avatar-box ${isWorking ? 'busy' : ''}`}
                      title={`${dev.name} · ${ROLE_LABEL[dev.role]}${isWorking ? ' (trabalhando)' : ' (livre)'}`}
                      style={{ borderColor: isWorking ? ROLE_COLOR[dev.role] : undefined }}
                    >
                      <svg viewBox="0 0 32 32" width="28" height="28" className="pixel-char-breathe">
                        <circle cx="16" cy="13" r="7" fill="#fcd34d" />
                        <circle cx="16" cy="10" r="6" fill={ROLE_HAIR[dev.role]} />
                        <rect x="8" y="19" width="16" height="12" fill={ROLE_COLOR[dev.role]} rx="2" />
                        {isWorking && <circle cx="26" cy="6" r="4" fill="#4cf17c" />}
                      </svg>
                    </div>
                  )
                })}

                <button
                  style={{ width: 32, height: 32, borderRadius: 6, background: '#252e7a', border: '1.5px solid #555eb3', color: 'white', font: '800 16px Pixelify Sans' }}
                  onClick={onTeam}
                  title="Contratar profissional"
                >
                  +
                </button>
              </div>

              <button className="btn-kanban-advance-day" onClick={onAdvance}>
                ▶▶ Avançar Dia (Dia {state.day})
              </button>
            </div>
          </div>
        </section>

        {/* 3 Cartões Laterais Idênticos aos Slides */}
        <aside className="side-cards-column">
          <div className="side-card cyan">
            <span className="side-card-tag">1 • PRIORIZAR</span>
            <h3 className="side-card-title">O que vem primeiro?</h3>
            <span className="side-card-sub">Respeite as dependências de cada entrega</span>
          </div>

          <div className="side-card orange">
            <span className="side-card-tag">2 • DISTRIBUIR</span>
            <h3 className="side-card-title">Quem faz cada tarefa?</h3>
            <span className="side-card-sub">Aloque os devs pela especialidade certa</span>
          </div>

          <div className="side-card green">
            <span className="side-card-tag">3 • VALIDAR</span>
            <h3 className="side-card-title">O que está pronto?</h3>
            <span className="side-card-sub">Revise e certifique a qualidade final</span>
          </div>
        </aside>
      </div>

      <footer className="slide-bottom-bar">
        <span>PROJECT TYCOON</span>
        <span>DEMONSTRAÇÃO · TELA 4</span>
        <span>07 / 09</span>
      </footer>
    </div>
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
    <div className="native-slide-container results-completion-bg">
      <header className="slide-top-header">
        <span className="slide-badge">🎉 PROJETO CONCLUÍDO</span>
        <h1 className="slide-title">05 / Relatório de Entrega</h1>
        <p className="slide-subtitle">
          {settlement?.projectName ?? project?.name} · Cliente: {settlement?.clientName ?? project?.client}
        </p>
      </header>

      <div className="slide-main-layout">
        <section className="arcade-window">
          <div className="arcade-titlebar">
            <span className="titlebar-icon-sq" />
            <span className="titlebar-text">Relatório Final do Projeto</span>
            <div className="titlebar-controls">🗕 🗖 🗙</div>
          </div>

          <div className="arcade-content-area results-grid-content">
            {/* Banner comemorativo com devs celebrando */}
            <div className="results-banner-delivered">
              {/* Equipe comemorando — SVG animado */}
              <svg viewBox="0 0 200 90" width="180" height="80" style={{ imageRendering: 'pixelated', flexShrink: 0 }}>
                {/* Fogos de artifício */}
                {[40, 100, 160].map((cx, i) => (
                  <g key={i}>
                    <circle cx={cx} cy="18" r="2" fill={['#ffd166','#4cf17c','#ff5277'][i]} opacity="0.9" />
                    {[0,60,120,180,240,300].map((ang, j) => (
                      <line key={j}
                        x1={cx} y1="18"
                        x2={cx + Math.cos(ang * Math.PI / 180) * 10}
                        y2={18  + Math.sin(ang * Math.PI / 180) * 10}
                        stroke={['#ffd166','#4cf17c','#ff5277'][i]}
                        strokeWidth="1.5" opacity="0.8" />
                    ))}
                  </g>
                ))}

                {/* Dev 1 — braço levantado */}
                <g className="pixel-char-breathe" transform="translate(14, 28)">
                  <rect x="4" y="18" width="18" height="22" fill="#10b981" rx="3" />
                  <rect x="20" y="4" width="8" height="18" fill="#10b981" rx="3" />
                  <circle cx="27" cy="2" r="4" fill="#fcd34d" />
                  <g className="pixel-head-breathe">
                    <circle cx="12" cy="10" r="8" fill="#fcd34d" />
                    <circle cx="12" cy="7"  r="7" fill="#78350f" />
                    <circle cx="9.5" cy="11" r="1.2" fill="#1e293b" />
                    <circle cx="14.5" cy="11" r="1.2" fill="#1e293b" />
                    <path d="M9 14 Q12 17 15 14" stroke="#1e293b" strokeWidth="1.2" fill="none" />
                  </g>
                </g>

                {/* Dev 2 — central com troféu */}
                <g className="pixel-char-breathe" transform="translate(80, 22)">
                  <rect x="3" y="18" width="18" height="22" fill="#2563eb" rx="3" />
                  <rect x="-4" y="8" width="8" height="16" fill="#2563eb" rx="3" />
                  <circle cx="-1" cy="6" r="4" fill="#fcd34d" />
                  {/* troféu */}
                  <rect x="17" y="5" width="10" height="8" fill="#ffd166" rx="2" />
                  <rect x="20" y="12" width="4" height="4" fill="#ffd166" />
                  <rect x="18" y="15" width="8" height="2" fill="#ffd166" />
                  <g className="pixel-head-breathe">
                    <circle cx="12" cy="10" r="8" fill="#fcd34d" />
                    <circle cx="12" cy="7"  r="7" fill="#0f172a" />
                    <circle cx="9.5" cy="11" r="1.2" fill="#1e293b" />
                    <circle cx="14.5" cy="11" r="1.2" fill="#1e293b" />
                    <path d="M9 14 Q12 17 15 14" stroke="#1e293b" strokeWidth="1.2" fill="none" />
                  </g>
                </g>

                {/* Dev 3 */}
                <g className="pixel-char-breathe" transform="translate(152, 28)">
                  <rect x="2" y="18" width="18" height="22" fill="#ec4899" rx="3" />
                  <rect x="17" y="4" width="8" height="18" fill="#ec4899" rx="3" />
                  <circle cx="21" cy="2" r="4" fill="#fcd34d" />
                  <g className="pixel-head-breathe">
                    <circle cx="10" cy="10" r="8" fill="#fcd34d" />
                    <circle cx="10" cy="7"  r="7" fill="#d97706" />
                    <circle cx="7.5" cy="11" r="1.2" fill="#1e293b" />
                    <circle cx="12.5" cy="11" r="1.2" fill="#1e293b" />
                    <path d="M7 14 Q10 17 13 14" stroke="#1e293b" strokeWidth="1.2" fill="none" />
                  </g>
                </g>
              </svg>

              {/* Nota / Grade */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: gradeColor, color: '#060f28', font: '900 32px Pixelify Sans', display: 'grid', placeItems: 'center', boxShadow: `0 0 24px ${gradeColor}99` }}>
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

        {/* Cartões laterais dinâmicos */}
        <aside className="side-cards-column">
          <div className={`side-card ${grade === 'S' || grade === 'A' ? 'green' : grade === 'B' ? 'orange' : 'purple'}`}>
            <span className="side-card-tag">NOTA {grade}</span>
            <h3 className="side-card-title">{quality}% qualidade</h3>
            <span className="side-card-sub">{quality >= 80 ? 'Código impecável' : quality >= 60 ? 'Qualidade adequada' : 'Dívida técnica alta'}</span>
          </div>

          <div className={`side-card ${wasLate ? 'orange' : 'cyan'}`}>
            <span className="side-card-tag">PRAZO</span>
            <h3 className="side-card-title">{wasLate ? `${lateDays}d atraso` : `${earlyDays}d adiantado`}</h3>
            <span className="side-card-sub">{wasLate ? 'Multa aplicada ao pagamento' : 'Bônus de pontualidade!'}</span>
          </div>

          <div className={`side-card ${reputationDelta >= 5 ? 'green' : reputationDelta >= 0 ? 'purple' : 'orange'}`}>
            <span className="side-card-tag">REPUTAÇÃO</span>
            <h3 className="side-card-title">{reputationDelta >= 0 ? '+' : ''}{reputationDelta} pts</h3>
            <span className="side-card-sub">Total: {state?.reputation ?? 0} / 100</span>
          </div>
        </aside>
      </div>

      <footer className="slide-bottom-bar">
        <span>PROJECT TYCOON</span>
        <span>RELATÓRIO FINAL · {settlement?.projectName ?? 'PROJETO'}</span>
        <span>05 / 09</span>
      </footer>
    </div>
  )
}

/* =========================================================================
   CENA NATIVA 03: MULTI-CONTRATOS (SEGUINDO O DESIGN DE SLIDE)
   ========================================================================= */
interface MultiContractScreenProps {
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

  return (
    <div className="native-slide-container">
      <header className="slide-top-header">
        <span className="slide-badge">PRIMEIRO DESAFIO</span>
        <h1 className="slide-title">03 / Clientes & Contratos</h1>
        <p className="slide-subtitle">Avalie propostas do mercado, analise o escopo e feche o melhor negócio.</p>
      </header>

      {/* Barra de Navegação entre Contratos */}
      {contracts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141a54', padding: '8px 16px', borderRadius: 10, border: '2px solid #5863c4' }}>
          <button
            style={{ padding: '6px 14px', background: '#1e2675', border: '1.5px solid #63e8ff', color: 'white', borderRadius: 6, font: '700 12px Pixelify Sans' }}
            disabled={currentIndex === 0}
            onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
          >
            ◀ ANTERIOR
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {contracts.map((c, i) => (
              <button
                key={c.id}
                style={{
                  width: 32, height: 28, borderRadius: 5, font: '700 12px Pixelify Sans',
                  background: i === currentIndex ? '#782cf0' : '#141b4e',
                  border: i === currentIndex ? '2px solid #bd74ff' : '1px solid #4a54b8',
                  color: 'white',
                }}
                onClick={() => onSelectIndex(i)}
              >
                0{i + 1}
              </button>
            ))}
          </div>

          <button
            style={{ padding: '6px 14px', background: '#1e2675', border: '1.5px solid #63e8ff', color: 'white', borderRadius: 6, font: '700 12px Pixelify Sans' }}
            disabled={currentIndex >= contracts.length - 1}
            onClick={() => onSelectIndex(Math.min(contracts.length - 1, currentIndex + 1))}
          >
            PRÓXIMO ▶
          </button>
        </div>
      )}

      <div className="slide-main-layout">
        <section className="arcade-window">
          <div className="arcade-titlebar">
            <span className="titlebar-icon-sq" />
            <span className="titlebar-text">Proposta 0{currentIndex + 1} · {current?.client ?? 'Mercado'}</span>
            <div className="titlebar-controls">🗕 🗖 🗙</div>
          </div>

          <div className="arcade-content-area" style={{ padding: 24, background: '#101443', position: 'relative' }}>
            {hasActiveProject && (
              <div className="signed-overlay">
                <span>✓ PROJETO ATIVO EM ANDAMENTO</span>
                <b>{project?.name} · {formatMoney(project?.value ?? 0)} · {project?.deadlineDays} dias</b>
                <button onClick={onKanban}>ABRIR QUADRO KANBAN</button>
              </div>
            )}

            {current ? (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 20 }}>
                  {/* Prédio Pixel Art do Contrato */}
                  <div style={{ width: '100%', aspectRatio: '1/1', background: '#161d56', border: '2px solid #5863c4', borderRadius: 10, display: 'grid', placeItems: 'center' }}>
                    <BuildingArt type={current.buildingType} />
                  </div>

                  {/* Informações do Contrato */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ margin: 0, font: '800 clamp(18px, 2.2vw, 28px) Pixelify Sans', color: 'white' }}>{current.name}</h2>
                      <span style={{ padding: '3px 8px', background: '#4cf17c', color: '#072212', borderRadius: 6, font: '800 11px Pixelify Sans' }}>Novo contrato</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: 8, background: '#151c5a', borderRadius: 6, border: '1px solid #4a54b8' }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#aeb4db' }}>Valor</span>
                        <div style={{ font: '800 18px Pixelify Sans', color: '#4cf17c' }}>{formatMoney(current.value)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#aeb4db' }}>Prazo</span>
                        <div style={{ font: '800 18px Pixelify Sans', color: 'white' }}>{current.deadlineDays} dias</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#aeb4db' }}>Dificuldade</span>
                        <div style={{ font: '800 18px Pixelify Sans', color: current.complexity === 'easy' ? '#4cf17c' : current.complexity === 'hard' ? '#ff5277' : '#ffd166' }}>
                          {current.complexity === 'easy' ? 'Inicial' : current.complexity === 'hard' ? 'Avançada' : 'Média'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '4px 0 6px', font: '700 13px Pixelify Sans', color: 'white' }}>Requisitos Solicitados:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {(current.featureList || current.technicalReqs).map((req, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d8dbfa' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }} />
                            <span>{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {current.technicalReqs.map(t => (
                        <span key={t} style={{ padding: '2px 8px', background: '#1e2870', border: '1px solid #5863c4', borderRadius: 4, fontSize: 11, color: '#63e8ff' }}>#{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14, marginTop: 'auto', paddingTop: 10 }}>
                  <button
                    style={{ padding: 12, background: '#1c2468', border: '2px solid #63e8ff', color: 'white', borderRadius: 8, font: '700 14px Pixelify Sans' }}
                    onClick={() => onNegotiate(current)}
                  >
                    🤝 NEGOCIAR CONDIÇÕES
                  </button>
                  <button
                    style={{ padding: 12, background: 'linear-gradient(180deg, #4ef27e, #30d762)', border: '2px solid #7eff9e', color: '#072212', borderRadius: 8, font: '800 16px Pixelify Sans' }}
                    onClick={() => onAccept(current)}
                  >
                    ✓ Aceitar contrato
                  </button>
                </div>
              </div>
            ) : (
              <div className="pixel-empty">
                <h2>SEM PROPOSTAS</h2>
                <button onClick={onBack}>VOLTAR AO ESCRITÓRIO</button>
              </div>
            )}
          </div>
        </section>

        {/* 3 Cartões Laterais Idênticos aos Slides */}
        <aside className="side-cards-column">
          <div className="side-card cyan">
            <span className="side-card-tag">VALOR</span>
            <h3 className="side-card-title">{current ? formatMoney(current.value) : '—'}</h3>
            <span className="side-card-sub">Bônus rápido: +{formatMoney(current?.bonusEarly ?? 0)}</span>
          </div>

          <div className="side-card orange">
            <span className="side-card-tag">PRAZO</span>
            <h3 className="side-card-title">{current ? `${current.deadlineDays} dias` : '—'}</h3>
            <span className="side-card-sub">Multa: {formatMoney(current?.penaltyPerDay ?? 0)}/dia</span>
          </div>

          <div className="side-card purple">
            <span className="side-card-tag">REQUISITOS</span>
            <h3 className="side-card-title">{current?.features ?? 5} entregas</h3>
            <span className="side-card-sub">Mínimo de qualidade: {current?.minQuality ?? 70}%</span>
          </div>
        </aside>
      </div>

      <footer className="slide-bottom-bar">
        <span>PROJECT TYCOON</span>
        <span>DEMONSTRAÇÃO · TELA 3</span>
        <span>06 / 09</span>
      </footer>
    </div>
  )
}

function BuildingArt({ type }: { type?: string }) {
  switch (type) {
    case 'delivery':
      return (
        <svg viewBox="0 0 160 160" width="100%" height="100%">
          <rect width="160" height="160" fill="#13194a" rx="8" />
          <rect x="30" y="45" width="75" height="90" fill="#2a3382" stroke="#505ab8" strokeWidth="2" />
          <rect x="35" y="48" width="65" height="14" fill="#ff4d6d" rx="2" />
          <text x="67" y="59" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">DELIVERY</text>
          <rect x="38" y="70" width="12" height="14" fill="#ffd166" />
          <rect x="58" y="70" width="12" height="14" fill="#ffd166" />
          <rect x="78" y="70" width="12" height="14" fill="#ffd166" />
          <rect x="110" y="125" width="26" height="12" fill="#ff4d6d" rx="2" />
          <circle cx="114" cy="138" r="5" fill="#0d102e" stroke="#667" strokeWidth="2" />
          <circle cx="132" cy="138" r="5" fill="#0d102e" stroke="#667" strokeWidth="2" />
        </svg>
      )
    case 'ead':
      return (
        <svg viewBox="0 0 160 160" width="100%" height="100%">
          <rect width="160" height="160" fill="#101744" rx="8" />
          <rect x="35" y="45" width="90" height="92" fill="#242c75" stroke="#6875d9" strokeWidth="2" />
          <rect x="42" y="52" width="76" height="12" fill="#7928ca" rx="2" />
          <text x="80" y="61" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">EDUCA ACADEMY</text>
          <rect x="45" y="72" width="20" height="24" fill="#63e8ff" />
          <rect x="72" y="72" width="20" height="24" fill="#ffd166" />
          <rect x="98" y="72" width="20" height="24" fill="#63e8ff" />
        </svg>
      )
    case 'fintech':
      return (
        <svg viewBox="0 0 160 160" width="100%" height="100%">
          <rect width="160" height="160" fill="#0a0e2a" rx="8" />
          <rect x="42" y="24" width="76" height="116" fill="#131c54" stroke="#485ee8" strokeWidth="2" />
          <rect x="50" y="28" width="60" height="16" fill="#00b4d8" rx="2" />
          <text x="80" y="39" fill="#03045e" fontSize="9" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">◆ NEOBANK</text>
          <rect x="52" y="52" width="12" height="8" fill="#4cf17c" />
          <rect x="74" y="52" width="12" height="8" fill="#63e8ff" />
          <rect x="96" y="52" width="12" height="8" fill="#4cf17c" />
          <rect x="52" y="72" width="12" height="8" fill="#63e8ff" />
          <rect x="74" y="72" width="12" height="8" fill="#4cf17c" />
          <rect x="96" y="72" width="12" height="8" fill="#63e8ff" />
        </svg>
      )
    case 'health':
      return (
        <svg viewBox="0 0 160 160" width="100%" height="100%">
          <rect width="160" height="160" fill="#0d143d" rx="8" />
          <rect x="30" y="38" width="98" height="102" fill="#1d286d" stroke="#5263d9" strokeWidth="2" />
          <rect x="68" y="44" width="24" height="24" fill="#0e1642" rx="4" />
          <rect x="77" y="48" width="6" height="16" fill="#4cf17c" />
          <rect x="72" y="53" width="16" height="6" fill="#4cf17c" />
          <rect x="40" y="76" width="16" height="16" fill="#63e8ff" />
          <rect x="64" y="76" width="16" height="16" fill="#ffd166" />
          <rect x="88" y="76" width="16" height="16" fill="#63e8ff" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 160 160" width="100%" height="100%">
          <rect width="160" height="160" fill="#101443" rx="8" />
          <rect x="36" y="36" width="86" height="104" fill="#2b358a" stroke="#5d69db" strokeWidth="2" />
          <rect x="48" y="46" width="16" height="18" fill="#ffd166" />
          <rect x="74" y="46" width="16" height="18" fill="#ffd166" />
          <rect x="96" y="46" width="16" height="18" fill="#ffd166" />
          <rect x="48" y="72" width="16" height="18" fill="#ffd166" />
          <rect x="74" y="72" width="16" height="18" fill="#ffd166" />
          <rect x="96" y="72" width="16" height="18" fill="#ffd166" />
        </svg>
      )
  }
}

/* =========================================================================
   MODAIS NATIVOS
   ========================================================================= */
function PixelModal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className={`pixel-modal ${wide ? 'wide' : ''}`}>
        <header>
          <span className="pixel-square" />
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

function SetupModal(props: { company: string; founder: string; difficulty: Difficulty; onCompany: (value: string) => void; onFounder: (value: string) => void; onDifficulty: (value: Difficulty) => void; onClose: () => void; onConfirm: () => void }) {
  const diffLabels: Record<Difficulty, { title: string; capital: string; desc: string }> = {
    easy: { title: 'FÁCIL', capital: 'R$ 32.000', desc: 'Maior capital & clientes tolerantes' },
    normal: { title: 'NORMAL', capital: 'R$ 24.000', desc: 'Desafio equilibrado e realista' },
    hard: { title: 'DIFÍCIL', capital: 'R$ 18.000', desc: 'Menor margem & clientes exigentes' },
  }

  return (
    <PixelModal title="NOVA EMPRESA · FUNDAÇÃO" subtitle="Defina sua identidade e nível de desafio para começar." onClose={props.onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 16, alignItems: 'center', background: '#12184c', padding: 12, borderRadius: 10, border: '1.5px solid #4a54b8' }}>
        <div style={{ width: 80, height: 80, background: '#192264', borderRadius: 8, display: 'grid', placeItems: 'center', border: '2px solid #63e8ff' }}>
          <svg viewBox="0 0 32 32" width="60" height="60" className="pixel-char-breathe">
            <circle cx="16" cy="14" r="8" fill="#fcd34d" />
            <circle cx="16" cy="11" r="7" fill="#451a03" />
            <rect x="7" y="22" width="18" height="10" fill="#6d28d9" rx="3" />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0, font: '800 18px Pixelify Sans', color: 'white' }}>{props.company || 'Sua Software House'}</h3>
          <p style={{ margin: '3px 0 0', color: '#9ea8eb', fontSize: 12 }}>Fundada por: {props.founder || 'Você'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label>Nome da empresa
          <input value={props.company} onChange={event => props.onCompany(event.target.value)} placeholder="Ex.: Pixel Forge" />
        </label>
        <label>Nome do fundador
          <input value={props.founder} onChange={event => props.onFounder(event.target.value)} placeholder="Seu nome" />
        </label>
      </div>

      <div>
        <label style={{ marginBottom: 6 }}>Nível de Dificuldade</label>
        <div className="pixel-choice">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map(item => (
            <button
              key={item}
              type="button"
              className={props.difficulty === item ? 'selected' : ''}
              onClick={() => props.onDifficulty(item)}
            >
              <span>{diffLabels[item].title}</span>
              <small style={{ color: props.difficulty === item ? '#4cf17c' : '#9ea8eb', fontSize: 11, fontWeight: 700 }}>
                {diffLabels[item].capital}
              </small>
            </button>
          ))}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#8c95cf', textAlign: 'center' }}>
          {diffLabels[props.difficulty].desc}
        </p>
      </div>

      <button className="pixel-primary" onClick={props.onConfirm}>
        ▶ FUNDAR EMPRESA
      </button>
    </PixelModal>
  )
}

function NegotiationModal(props: { contract: Contract; value: number; deadline: number; message: string; onValue: (value: number) => void; onDeadline: (value: number) => void; onClose: () => void; onSend: () => void }) {
  const rejected = props.contract.status === 'rejected' || props.message.startsWith('Recusada')
  return (
    <PixelModal title={rejected ? 'RENEGOCIAR CONTRATO' : 'NEGOCIAR CONTRATO'} subtitle={`Cliente: ${props.contract.client}`} onClose={props.onClose}>
      <div className="client-message">
        <span>CLIENTE · {props.contract.client.toUpperCase()}</span>
        <p>{rejected ? 'A oferta anterior não foi aprovada pela diretoria. Envie uma contraproposta mais alinhada.' : 'Estamos abertos a ouvir sua proposta comercial, considerando orçamento e prazo.'}</p>
      </div>
      {props.message && (
        <div className={`negotiation-feedback ${props.message.includes('aceita') ? 'accepted' : ''}`}>
          {props.message}
        </div>
      )}
      <div className="offer-grid">
        <label>VALOR DA PROPOSTA
          <input
            type="number"
            min={Math.floor(props.contract.originalValue * 0.7)}
            max={Math.floor(props.contract.originalValue * 1.5)}
            step="500"
            value={props.value}
            onChange={event => props.onValue(Number(event.target.value))}
          />
        </label>
        <label>PRAZO EM DIAS
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
        <span>SUA OFERTA</span>
        <b>{formatMoney(props.value)} · {props.deadline} dias</b>
      </div>
      <button className="pixel-primary" onClick={props.onSend}>
        🤝 {rejected ? 'ENVIAR CONTRAPROPOSTA' : 'ENVIAR PROPOSTA'}
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

function TeamModal({ state, onClose, onHire }: { state: GameState; onClose: () => void; onHire: (role: Role) => void }) {
  const [role, setRole] = useState<Role>('qa')
  return (
    <PixelModal title="EQUIPE" subtitle={`${state.employees.length} profissionais na empresa`} onClose={onClose} wide>
      <div className="team-list">
        {state.employees.map(employee => (
          <article key={employee.id}>
            <span className="pixel-avatar">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
            <div>
              <b>{employee.name}</b>
              <small>{ROLE_LABEL[employee.role]} · {employee.specialization}</small>
            </div>
            <div>
              <span>ENERGIA {employee.energy}%</span>
              <span>QUAL. {employee.quality}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="hire-bar">
        <select value={role} onChange={event => setRole(event.target.value as Role)}>
          {(['qa', 'fullstack', 'frontend', 'backend', 'designer'] as Role[]).map(item => (
            <option key={item} value={item}>{ROLE_LABEL[item]}</option>
          ))}
        </select>
        <button className="pixel-primary" onClick={() => onHire(role)}>+ CONTRATAR · R$ 1.200</button>
      </div>
    </PixelModal>
  )
}

function FinanceModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  return (
    <PixelModal title="FINANÇAS" subtitle="Sustentabilidade da empresa" onClose={onClose}>
      <div className="finance-grid">
        <span>CAIXA<b>{formatMoney(state.balance)}</b></span>
        <span>RECEITAS<b>{formatMoney(state.revenue)}</b></span>
        <span>DESPESAS<b>{formatMoney(state.expenses)}</b></span>
        <span>RESULTADO<b>{formatMoney(state.profit)}</b></span>
      </div>
      <p className="finance-tip">Custo operacional diário estimado: <b>{formatMoney(dailyEmployeeCost(state))}</b></p>
    </PixelModal>
  )
}

export default PixelApp
