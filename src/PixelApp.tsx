import { useEffect, useState } from 'react'
import { createEmployee } from './employees'
import {
  calculateProjectQuality,
  calculateTaskGain,
  contractDaysRemaining,
  createInitialState,
  createProjectTasks,
  dailyEmployeeCost,
  evaluateOffer,
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
  frontend: 'Front-end', backend: 'Back-end', fullstack: 'Full Stack', designer: 'UI/UX',
  qa: 'QA', pm: 'Gerente', devops: 'DevOps',
}

const SLIDES = {
  menu: { src: '/art/menu-slide.png', crop: [82, 226, 1237, 692] },
  office: { src: '/art/office-slide.png', crop: [82, 259, 1237, 659] },
  contract: { src: '/art/contract-slide.png', crop: [82, 259, 1237, 659] },
  kanban: { src: '/art/kanban-slide.png', crop: [82, 259, 1237, 659] },
  results: { src: '/art/results-slide.png', crop: [82, 258, 1237, 661] },
} as const

function PixelApp() {
  const [state, setState] = useState<GameState | null>(() => loadGame())
  const [screen, setScreen] = useState<PixelScreen>('menu')
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [company, setCompany] = useState('Pixel Forge')
  const [founder, setFounder] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [offerValue, setOfferValue] = useState(30_000)
  const [offerDeadline, setOfferDeadline] = useState(45)
  const [negotiationMessage, setNegotiationMessage] = useState('')

  useEffect(() => { if (state) saveGame(state) }, [state])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const proposal = state?.availableContracts[0]
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
    setModal(null)
    setScreen('office')
    setToast('Empresa criada. Seu primeiro contrato está disponível!')
  }

  function continueGame() {
    if (!state) return newGame()
    const completed = state.contracts.some(contract => contract.status === 'completed')
    setScreen(completed ? 'results' : 'office')
  }

  function signContract(value: number, deadlineDays: number) {
    setState(current => {
      if (!current) return current
      const available = current.availableContracts[0]
      if (!available) return current
      const accepted: Contract = {
        ...available,
        value,
        deadlineDays,
        acceptedAt: current.day,
        status: 'accepted',
        rejectionReason: null,
        tasks: createProjectTasks(available.id),
      }
      return {
        ...current,
        contracts: [...current.contracts, accepted],
        availableContracts: [],
        selectedProjectId: accepted.id,
        currentScreen: 'kanban',
        notifications: [{ id: uid(), type: 'success', message: 'Contrato assinado.', day: current.day, read: false }, ...current.notifications],
        gameLog: [{ day: current.day, message: `Contrato fechado por ${formatMoney(value)} em ${deadlineDays} dias.` }, ...current.gameLog],
      }
    })
    setModal(null)
    setScreen('kanban')
    setToast('Contrato aceito. Agora planeje e distribua as tarefas.')
  }

  function sendCounterOffer() {
    if (!state || !proposal) return
    const evaluation = evaluateOffer(proposal, offerValue, offerDeadline, state.reputation)
    if (evaluation.accepted) {
      setNegotiationMessage('Proposta aceita! O cliente aprovou as novas condições.')
      window.setTimeout(() => signContract(offerValue, offerDeadline), 650)
      return
    }
    const message = evaluation.reason === 'both'
      ? `Recusada: o valor e o prazo estão altos. O cliente sinalizou até ${formatMoney(evaluation.maxValue)} e ${evaluation.maxDeadline} dias.`
      : evaluation.reason === 'value'
        ? `Recusada: o valor está alto. O cliente sinalizou até ${formatMoney(evaluation.maxValue)}.`
        : `Recusada: o prazo está alto. O cliente espera no máximo ${evaluation.maxDeadline} dias.`
    setNegotiationMessage(message)
    setState(current => current ? {
      ...current,
      availableContracts: current.availableContracts.map(contract => ({
        ...contract,
        status: 'rejected',
        value: offerValue,
        deadlineDays: offerDeadline,
        rejectionReason: evaluation.reason,
        negotiationAttempts: contract.negotiationAttempts + 1,
      })),
      gameLog: [{ day: current.day, message }, ...current.gameLog],
    } : current)
  }

  function openNegotiation() {
    if (!proposal) return
    setOfferValue(proposal.value)
    setOfferDeadline(proposal.deadlineDays)
    setNegotiationMessage(proposal.status === 'rejected' ? 'Ajuste a proposta conforme o retorno do cliente.' : '')
    setModal('negotiation')
  }

  function assignTask(taskId: string, employeeId: string) {
    setState(current => {
      if (!current) return current
      const active = current.contracts.find(contract => contract.id === project?.id)
      const task = active?.tasks.find(item => item.id === taskId)
      if (!active || !task || !taskDependenciesDone(task, active.tasks)) return current
      const busy = current.contracts.some(contract => contract.tasks.some(item => item.assignedTo === employeeId && item.status === 'inprogress'))
      if (busy) { setToast('Esse profissional já está trabalhando em outra tarefa.'); return current }
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
    setToast('Profissional alocado. Avance o dia para desenvolver.')
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
            const gain = calculateTaskGain(employee.productivity, employee.speed, task.complexity, current.difficulty)
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
        gameLog: [{ day: current.day + 1, message: reachedReview ? `${reachedReview} tarefa(s) pronta(s) para validar.` : `Custo do dia: ${formatMoney(cost)}.` }, ...current.gameLog],
      }
    })
    setToast('Dia avançado: produção, energia, prazo e caixa atualizados.')
  }

  function approveTask(taskId: string) {
    let finished = false
    setState(current => {
      if (!current) return current
      const active = current.contracts.find(contract => contract.id === project?.id)
      const task = active?.tasks.find(item => item.id === taskId)
      if (!active || !task || task.status !== 'review') return current
      const employee = current.employees.find(item => item.id === task.assignedTo)
      const quality = clamp(Math.round((employee?.quality ?? 60) * .88 + (employee?.energy ?? 60) * .12))
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
    if (finished) { setModal(null); setScreen('results'); setToast('Projeto entregue com sucesso!') }
    else setToast('Tarefa validada e movida para Concluído.')
  }

  function hire(role: Role) {
    setState(current => {
      if (!current || current.balance < 1_200) return current
      const employee = createEmployee(role, 15)
      employee.hiredAt = current.day
      return { ...current, balance: current.balance - 1_200, expenses: current.expenses + 1_200, employees: [...current.employees, employee] }
    })
    setToast('Novo profissional contratado por R$ 1.200.')
  }

  function resetSave() {
    deleteSave()
    setState(null)
    setModal(null)
    setScreen('menu')
    setToast('Partida apagada. Comece uma nova empresa.')
  }

  return (
    <div className="pixel-app">
      <div className="pixel-stars" />
      <header className="pixel-brandbar">
        <button className="pixel-logo" onClick={() => setScreen('menu')} aria-label="Voltar ao menu">
          <span className="growth">▁▃▆↗</span><b>Project <em>Tycoon</em></b>
        </button>
        {state && screen !== 'menu' && <div className="compact-hud"><span>💵 {formatMoney(state.balance)}</span><span>⭐ {state.reputation}</span><span>📅 Dia {state.day}</span></div>}
      </header>

      <main className="pixel-stage">
        {screen === 'menu' && <MenuScreen hasSave={Boolean(state)} onNew={newGame} onContinue={continueGame} />}
        {screen === 'office' && <OfficeScreen state={state} onContract={() => setScreen('contract')} onKanban={() => setScreen('kanban')} onTeam={() => setModal('team')} onFinance={() => setModal('finance')} />}
        {screen === 'contract' && <ContractScreen hasProposal={Boolean(proposal)} project={project} onBack={() => setScreen('office')} onAccept={() => signContract(30_000, 45)} onNegotiate={openNegotiation} onKanban={() => setScreen('kanban')} />}
        {screen === 'kanban' && <KanbanScreen state={state} project={project} completion={completion} onTasks={() => setModal('tasks')} onAdvance={advanceDay} onBack={() => setScreen('office')} />}
        {screen === 'results' && <ResultsScreen state={state} project={project} onContinue={() => setScreen('office')} />}
      </main>

      {modal === 'setup' && <SetupModal company={company} founder={founder} difficulty={difficulty} onCompany={setCompany} onFounder={setFounder} onDifficulty={setDifficulty} onClose={() => setModal(null)} onConfirm={confirmNewGame} />}
      {modal === 'negotiation' && proposal && <NegotiationModal contract={proposal} value={offerValue} deadline={offerDeadline} message={negotiationMessage} onValue={setOfferValue} onDeadline={setOfferDeadline} onClose={() => setModal(null)} onSend={sendCounterOffer} />}
      {modal === 'tasks' && state && project && <TaskModal state={state} project={project} onClose={() => setModal(null)} onAssign={assignTask} onApprove={approveTask} />}
      {modal === 'team' && state && <TeamModal state={state} onClose={() => setModal(null)} onHire={hire} />}
      {modal === 'finance' && state && <FinanceModal state={state} onClose={() => setModal(null)} />}
      {toast && <div className="pixel-toast">{toast}</div>}
      {state && screen === 'menu' && <button className="delete-save" onClick={resetSave}>Apagar save</button>}
    </div>
  )
}

function SlideCrop({ slide, children, className = '' }: { slide: keyof typeof SLIDES; children?: React.ReactNode; className?: string }) {
  const { src, crop } = SLIDES[slide]
  const [x, y, width, height] = crop
  return (
    <div className={`slide-crop ${className}`} style={{ aspectRatio: `${width}/${height}` }}>
      <img src={src} alt="" draggable={false} style={{ width: `${1734 / width * 100}%`, left: `${-x / width * 100}%`, top: `${-y / height * 100}%` }} />
      {children}
    </div>
  )
}

function MenuScreen({ hasSave, onNew, onContinue }: { hasSave: boolean; onNew: () => void; onContinue: () => void }) {
  return <SlideCrop slide="menu" className="menu-scene"><button className="hotspot menu-new" onClick={onNew} aria-label="Novo projeto" /><button className="hotspot menu-continue" disabled={!hasSave} onClick={onContinue} aria-label="Continuar partida" />{!hasSave && <span className="no-save">SEM SAVE</span>}</SlideCrop>
}

function OfficeScreen({ state, onContract, onKanban, onTeam, onFinance }: { state: GameState | null; onContract: () => void; onKanban: () => void; onTeam: () => void; onFinance: () => void }) {
  if (!state) return null
  const hasProposal = state.availableContracts.length > 0
  return <SlideCrop slide="office" className="office-scene"><div className="office-live-hud"><span>💵 {formatMoney(state.balance)}</span><span>⭐ Reputação: {state.reputation}</span><span>📅 Dia {state.day}</span></div>{hasProposal && <button className="contract-alert" onClick={onContract}>🏆 <b>Novo contrato disponível!</b><small>Clique para negociar</small></button>}<button className="hotspot office-team" onClick={onTeam} aria-label="Equipe" /><button className="hotspot office-projects" onClick={onKanban} aria-label="Projetos" /><button className="hotspot office-contracts" onClick={onContract} aria-label="Contratos" /><button className="hotspot office-finance" onClick={onFinance} aria-label="Finanças" /></SlideCrop>
}

function ContractScreen({ hasProposal, project, onBack, onAccept, onNegotiate, onKanban }: { hasProposal: boolean; project?: Contract; onBack: () => void; onAccept: () => void; onNegotiate: () => void; onKanban: () => void }) {
  return <SlideCrop slide="contract" className="contract-scene"><button className="scene-back" onClick={onBack}>‹ ESCRITÓRIO</button>{hasProposal ? <><button className="contract-negotiate" onClick={onNegotiate}>🤝 NEGOCIAR CONDIÇÕES</button><button className="hotspot contract-accept" onClick={onAccept} aria-label="Aceitar contrato" /></> : <div className="signed-overlay"><span>✓ CONTRATO ASSINADO</span><b>{project ? `${formatMoney(project.value)} · ${project.deadlineDays} dias` : ''}</b><button onClick={onKanban}>ABRIR KANBAN</button></div>}</SlideCrop>
}

function KanbanScreen({ state, project, completion, onTasks, onAdvance, onBack }: { state: GameState | null; project?: Contract; completion: number; onTasks: () => void; onAdvance: () => void; onBack: () => void }) {
  if (!state || !project) return <div className="pixel-empty"><h2>SEM PROJETO ATIVO</h2><p>Aceite ou negocie o primeiro contrato.</p><button onClick={onBack}>VOLTAR AO ESCRITÓRIO</button></div>
  return <SlideCrop slide="kanban" className="kanban-scene"><button className="scene-back" onClick={onBack}>‹ ESCRITÓRIO</button><div className="kanban-live-progress"><b>Progresso: {completion}%</b><span><i style={{ width: `${completion}%` }} /></span></div><button className="hotspot kanban-board" onClick={onTasks} aria-label="Gerenciar tarefas" /><button className="hotspot kanban-advance" onClick={onAdvance} aria-label="Avançar dia" /><button className="manage-tasks" onClick={onTasks}>⚙ GERENCIAR TAREFAS</button><div className="kanban-day">DIA {state.day} · {contractDaysRemaining(project, state.day)} DIAS RESTANTES</div></SlideCrop>
}

function ResultsScreen({ state, project, onContinue }: { state: GameState | null; project?: Contract; onContinue: () => void }) {
  const quality = project ? calculateProjectQuality(project.tasks) : 0
  return <SlideCrop slide="results" className="results-scene"><div className="result-actual"><span>RESULTADO DA PARTIDA</span><b>Caixa {formatMoney(state?.balance ?? 0)} · Qualidade {quality}% · Reputação {state?.reputation ?? 0}</b></div><button className="hotspot results-continue" onClick={onContinue} aria-label="Continuar" /></SlideCrop>
}

function PixelModal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className={`pixel-modal ${wide ? 'wide' : ''}`}><header><span className="pixel-square" /><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button onClick={onClose} aria-label="Fechar">×</button></header><div className="modal-body">{children}</div></section></div>
}

function SetupModal(props: { company: string; founder: string; difficulty: Difficulty; onCompany: (value: string) => void; onFounder: (value: string) => void; onDifficulty: (value: Difficulty) => void; onClose: () => void; onConfirm: () => void }) {
  return <PixelModal title="NOVA EMPRESA" subtitle="Defina sua identidade para começar." onClose={props.onClose}><label>Nome da empresa<input value={props.company} onChange={event => props.onCompany(event.target.value)} /></label><label>Nome do fundador<input value={props.founder} onChange={event => props.onFounder(event.target.value)} placeholder="Seu nome" /></label><div className="pixel-choice">{(['easy', 'normal', 'hard'] as Difficulty[]).map(item => <button key={item} className={props.difficulty === item ? 'selected' : ''} onClick={() => props.onDifficulty(item)}>{item === 'easy' ? 'FÁCIL' : item === 'normal' ? 'NORMAL' : 'DIFÍCIL'}</button>)}</div><button className="pixel-primary" onClick={props.onConfirm}>▶ CRIAR EMPRESA</button></PixelModal>
}

function NegotiationModal(props: { contract: Contract; value: number; deadline: number; message: string; onValue: (value: number) => void; onDeadline: (value: number) => void; onClose: () => void; onSend: () => void }) {
  const rejected = props.contract.status === 'rejected' || props.message.startsWith('Recusada')
  return <PixelModal title={rejected ? 'RENEGOCIAR CONTRATO' : 'NEGOCIAR CONTRATO'} subtitle="O cliente avalia valor e prazo em conjunto." onClose={props.onClose}><div className="client-message"><span>CLIENTE · MERCADO HORIZONTE</span><p>{rejected ? 'A oferta anterior não funcionou. Envie uma contraproposta mais equilibrada.' : 'Estamos abertos a uma proposta, mas temos limite de orçamento e urgência na entrega.'}</p></div>{props.message && <div className={`negotiation-feedback ${props.message.includes('aceita') ? 'accepted' : ''}`}>{props.message}</div>}<div className="offer-grid"><label>VALOR DA PROPOSTA<input type="number" min="24000" max="45000" step="500" value={props.value} onChange={event => props.onValue(Number(event.target.value))} /></label><label>PRAZO EM DIAS<input type="number" min="30" max="60" value={props.deadline} onChange={event => props.onDeadline(Number(event.target.value))} /></label></div><div className="offer-preview"><span>SUA OFERTA</span><b>{formatMoney(props.value)} · {props.deadline} dias</b></div><button className="pixel-primary" onClick={props.onSend}>🤝 {rejected ? 'ENVIAR CONTRAPROPOSTA' : 'ENVIAR PROPOSTA'}</button></PixelModal>
}

function TaskModal({ state, project, onClose, onAssign, onApprove }: { state: GameState; project: Contract; onClose: () => void; onAssign: (taskId: string, employeeId: string) => void; onApprove: (taskId: string) => void }) {
  const availableEmployees = (task: Task) => state.employees.filter(employee => !project.tasks.some(item => item.status === 'inprogress' && item.assignedTo === employee.id) || task.assignedTo === employee.id)
  return <PixelModal title="GERENCIAMENTO DO PROJETO" subtitle={`${project.name} · ${contractDaysRemaining(project, state.day)} dias restantes`} onClose={onClose} wide><div className="task-manager">{project.tasks.map(task => { const unlocked = taskDependenciesDone(task, project.tasks); const employee = state.employees.find(item => item.id === task.assignedTo); return <article key={task.id} className={`task-row ${task.status} ${!unlocked ? 'locked' : ''}`}><span className="task-icon">{task.status === 'done' ? '✓' : task.status === 'review' ? '⚗' : task.status === 'inprogress' ? '⚙' : '▣'}</span><div><b>{task.name}</b><small>{ROLE_LABEL[task.requiredRole]} · {task.progress}% {employee ? `· ${employee.name}` : ''}</small><span className="task-mini-progress"><i style={{ width: `${task.progress}%` }} /></span></div><div>{task.status === 'todo' && unlocked && <select defaultValue="" onChange={event => event.target.value && onAssign(task.id, event.target.value)}><option value="" disabled>ALOCAR…</option>{availableEmployees(task).map(item => <option key={item.id} value={item.id}>{item.name} · {ROLE_LABEL[item.role]}</option>)}</select>}{task.status === 'todo' && !unlocked && <span className="locked-label">BLOQUEADA</span>}{task.status === 'inprogress' && <span className="working-label">EM PRODUÇÃO</span>}{task.status === 'review' && <button className="approve-task" onClick={() => onApprove(task.id)}>VALIDAR</button>}{task.status === 'done' && <span className="done-label">QUAL. {task.quality}%</span>}</div></article>})}</div></PixelModal>
}

function TeamModal({ state, onClose, onHire }: { state: GameState; onClose: () => void; onHire: (role: Role) => void }) {
  const [role, setRole] = useState<Role>('qa')
  return <PixelModal title="EQUIPE" subtitle={`${state.employees.length} profissionais na empresa`} onClose={onClose} wide><div className="team-list">{state.employees.map(employee => <article key={employee.id}><span className="pixel-avatar">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><b>{employee.name}</b><small>{ROLE_LABEL[employee.role]} · {employee.specialization}</small></div><div><span>ENERGIA {employee.energy}%</span><span>QUAL. {employee.quality}</span></div></article>)}</div><div className="hire-bar"><select value={role} onChange={event => setRole(event.target.value as Role)}>{(['qa', 'fullstack', 'frontend', 'backend', 'designer'] as Role[]).map(item => <option key={item} value={item}>{ROLE_LABEL[item]}</option>)}</select><button className="pixel-primary" onClick={() => onHire(role)}>+ CONTRATAR · R$ 1.200</button></div></PixelModal>
}

function FinanceModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  return <PixelModal title="FINANÇAS" subtitle="Sustentabilidade da empresa" onClose={onClose}><div className="finance-grid"><span>CAIXA<b>{formatMoney(state.balance)}</b></span><span>RECEITAS<b>{formatMoney(state.revenue)}</b></span><span>DESPESAS<b>{formatMoney(state.expenses)}</b></span><span>RESULTADO<b>{formatMoney(state.profit)}</b></span></div><p className="finance-tip">Custo operacional estimado por dia: <b>{formatMoney(dailyEmployeeCost(state))}</b></p></PixelModal>
}

export default PixelApp
