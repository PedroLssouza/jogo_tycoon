import { useEffect, useState } from 'react'
import { createEmployee } from './employees'
import {
  calculateProjectQuality,
  calculateTaskGain,
  contractDaysRemaining,
  createInitialState,
  createProjectTasks,
  dailyEmployeeCost,
  DIFFICULTY_CONFIG,
  evaluateOffer,
  settlementFor,
  taskDependenciesDone,
} from './game'
import { deleteSave, hasSave, loadGame, saveGame } from './storage'
import type { Contract, Difficulty, GameState, Role, Task, TaskStatus } from './types'
import { clamp, formatMoney, uid } from './utils'

type Screen = 'overview' | 'contracts' | 'kanban' | 'team'

const SCREEN_META: Record<Screen, { title: string; subtitle: string }> = {
  overview: { title: 'Visão geral', subtitle: 'Centro de comando da empresa' },
  contracts: { title: 'Clientes & contratos', subtitle: 'Negocie escopo, valor e prazo' },
  kanban: { title: 'Quadro Kanban', subtitle: 'Planeje e acompanhe a execução' },
  team: { title: 'Equipe', subtitle: 'Capacidade, energia e especialidades' },
}

const ROLE_LABEL: Record<Role, string> = {
  frontend: 'Front-end', backend: 'Back-end', fullstack: 'Full Stack', designer: 'UI/UX',
  qa: 'QA', pm: 'Gerente de projeto', devops: 'DevOps',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'A fazer', inprogress: 'Em andamento', review: 'Validação', done: 'Concluído',
}

function App() {
  const [state, setState] = useState<GameState | null>(() => loadGame())
  const [showLanding, setShowLanding] = useState(() => !hasSave())
  const [company, setCompany] = useState('Pixel Forge')
  const [founder, setFounder] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  useEffect(() => {
    if (state) saveGame(state)
  }, [state])

  function startGame() {
    const companyName = company.trim() || 'Nova Software'
    const founderName = founder.trim() || 'Fundador(a)'
    setState(createInitialState(companyName, founderName, difficulty))
    setShowLanding(false)
  }

  function resetGame() {
    deleteSave()
    setState(null)
    setShowLanding(true)
  }

  if (showLanding || !state) {
    return (
      <Landing
        company={company}
        founder={founder}
        difficulty={difficulty}
        canContinue={Boolean(state)}
        onCompany={setCompany}
        onFounder={setFounder}
        onDifficulty={setDifficulty}
        onStart={startGame}
        onContinue={() => setShowLanding(false)}
      />
    )
  }

  const screen = (state.currentScreen || 'overview') as Screen
  const completed = state.contracts.some(contract => contract.status === 'completed')
  const gameOver = state.balance < -5_000

  function changeScreen(next: Screen) {
    setState(current => current ? { ...current, currentScreen: next } : current)
  }

  function addLog(current: GameState, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
    return {
      notifications: [{ id: uid(), type, message, day: current.day, read: false }, ...current.notifications].slice(0, 20),
      gameLog: [{ day: current.day, message }, ...current.gameLog].slice(0, 30),
    }
  }

  function advanceDay() {
    setState(current => {
      if (!current || current.balance < -5_000) return current
      const cost = dailyEmployeeCost(current)
      let finishedCount = 0
      const contracts = current.contracts.map(contract => {
        if (!['accepted', 'inprogress'].includes(contract.status)) return contract
        const tasks = contract.tasks.map(task => {
          if (task.status !== 'inprogress' || !task.assignedTo) return task
          const employee = current.employees.find(candidate => candidate.id === task.assignedTo)
          if (!employee) return task
          const gain = calculateTaskGain(employee.productivity, employee.speed, task.complexity, current.difficulty)
          const progress = clamp(task.progress + gain)
          if (progress >= 100) finishedCount += 1
          return { ...task, progress, status: progress >= 100 ? 'review' as const : task.status }
        })
        return { ...contract, status: 'inprogress' as const, tasks }
      })
      const busyIds = new Set(contracts.flatMap(contract => contract.tasks.filter(task => task.status === 'inprogress').map(task => task.assignedTo)))
      const employees = current.employees.map(employee => {
        const working = busyIds.has(employee.id)
        return {
          ...employee,
          energy: clamp(employee.energy + (working ? -7 : 9)),
          satisfaction: clamp(employee.satisfaction + (employee.energy < 25 ? -2 : 0)),
          state: working ? 'working' as const : employee.energy < 30 ? 'tired' as const : 'idle' as const,
          currentTaskId: working
            ? contracts.flatMap(contract => contract.tasks).find(task => task.assignedTo === employee.id && task.status === 'inprogress')?.id ?? null
            : null,
        }
      })
      const nextDay = current.day + 1
      const deadlineWarning = contracts.some(contract => ['accepted', 'inprogress'].includes(contract.status) && contractDaysRemaining(contract, nextDay) <= 5)
      const message = finishedCount > 0
        ? `${finishedCount} tarefa${finishedCount > 1 ? 's chegaram' : ' chegou'} à validação.`
        : `Dia encerrado. Custo operacional: ${formatMoney(cost)}.`
      const log = addLog({ ...current, day: nextDay }, message, finishedCount ? 'success' : 'info')
      return {
        ...current,
        day: nextDay,
        balance: current.balance - cost,
        expenses: current.expenses + cost,
        profit: current.revenue - (current.expenses + cost),
        contracts,
        employees,
        daysRemainingAlert: deadlineWarning,
        ...log,
      }
    })
  }

  function acceptNegotiation(contractId: string, value: number, deadline: number) {
    setState(current => {
      if (!current) return current
      const proposal = current.availableContracts.find(contract => contract.id === contractId)
      if (!proposal) return current
      const result = evaluateOffer(proposal, value, deadline, current.reputation)
      if (!result.accepted) {
        const reasonText = result.reason === 'both'
          ? 'O cliente recusou: valor e prazo ficaram acima do aceitável.'
          : result.reason === 'value'
            ? 'O cliente recusou: o valor ficou alto demais.'
            : 'O cliente recusou: o prazo ficou longo demais.'
        const availableContracts = current.availableContracts.map(contract => contract.id === contractId
          ? { ...contract, value, deadlineDays: deadline, status: 'rejected' as const, rejectionReason: result.reason, negotiationAttempts: contract.negotiationAttempts + 1 }
          : contract)
        return { ...current, availableContracts, ...addLog(current, `${reasonText} Uma contraproposta pode ser enviada.`, 'warning') }
      }
      const accepted: Contract = {
        ...proposal,
        value,
        deadlineDays: deadline,
        acceptedAt: current.day,
        status: 'accepted',
        rejectionReason: null,
        tasks: createProjectTasks(proposal.id),
      }
      return {
        ...current,
        contracts: [...current.contracts, accepted],
        availableContracts: current.availableContracts.filter(contract => contract.id !== contractId),
        selectedProjectId: accepted.id,
        currentScreen: 'kanban',
        ...addLog(current, `Contrato com ${accepted.client} fechado por ${formatMoney(value)} em ${deadline} dias.`, 'success'),
      }
    })
  }

  function assignTask(contractId: string, taskId: string, employeeId: string) {
    setState(current => {
      if (!current) return current
      const contract = current.contracts.find(candidate => candidate.id === contractId)
      const task = contract?.tasks.find(candidate => candidate.id === taskId)
      if (!contract || !task || !taskDependenciesDone(task, contract.tasks)) return current
      const employeeBusy = current.contracts.some(candidate => candidate.tasks.some(candidateTask => candidateTask.assignedTo === employeeId && candidateTask.status === 'inprogress'))
      if (employeeBusy) return { ...current, ...addLog(current, 'Esse profissional já está em outra tarefa.', 'warning') }
      const contracts = current.contracts.map(candidate => candidate.id !== contractId ? candidate : {
        ...candidate,
        status: 'inprogress' as const,
        tasks: candidate.tasks.map(candidateTask => candidateTask.id === taskId
          ? { ...candidateTask, assignedTo: employeeId, status: 'inprogress' as const, startedAt: candidateTask.startedAt ?? current.day }
          : candidateTask),
      })
      const employees = current.employees.map(employee => employee.id === employeeId
        ? { ...employee, currentTaskId: taskId, state: 'working' as const }
        : employee)
      return { ...current, contracts, employees, ...addLog(current, `${current.employees.find(employee => employee.id === employeeId)?.name} iniciou “${task.name}”.`) }
    })
  }

  function approveTask(contractId: string, taskId: string) {
    setState(current => {
      if (!current) return current
      const sourceContract = current.contracts.find(contract => contract.id === contractId)
      const sourceTask = sourceContract?.tasks.find(task => task.id === taskId)
      if (!sourceContract || !sourceTask || sourceTask.status !== 'review') return current
      const employee = current.employees.find(candidate => candidate.id === sourceTask.assignedTo)
      const quality = clamp(Math.round((employee?.quality ?? 55) * .88 + (employee?.energy ?? 50) * .12))
      let updatedContract: Contract = {
        ...sourceContract,
        tasks: sourceContract.tasks.map(task => task.id === taskId ? { ...task, status: 'done', quality, errors: quality < 65 ? 2 : quality < 78 ? 1 : 0 } : task),
      }
      const allDone = updatedContract.tasks.every(task => task.status === 'done')
      let balance = current.balance
      let revenue = current.revenue
      let reputation = current.reputation
      let resultMessage = `“${sourceTask.name}” foi aprovada com ${quality}% de qualidade.`
      if (allDone) {
        const settlement = settlementFor(updatedContract, current.day)
        updatedContract = { ...updatedContract, status: 'completed', completedAt: current.day }
        balance += settlement.payment
        revenue += settlement.payment
        reputation = clamp(reputation + settlement.reputationDelta)
        resultMessage = `Projeto entregue! Recebimento de ${formatMoney(settlement.payment)} e qualidade média de ${settlement.quality}%.`
      }
      const contracts = current.contracts.map(contract => contract.id === contractId ? updatedContract : contract)
      const employees = current.employees.map(candidate => candidate.id === sourceTask.assignedTo
        ? { ...candidate, currentTaskId: null, state: 'idle' as const }
        : candidate)
      return {
        ...current,
        contracts,
        employees,
        balance,
        revenue,
        reputation,
        profit: revenue - current.expenses,
        currentScreen: allDone ? 'overview' : current.currentScreen,
        ...addLog(current, resultMessage, 'success'),
      }
    })
  }

  function hire(role: Role) {
    setState(current => {
      if (!current) return current
      const signingCost = 1_200
      if (current.balance < signingCost) return { ...current, ...addLog(current, 'Caixa insuficiente para a contratação.', 'error') }
      const employee = createEmployee(role, role === 'qa' ? 18 : 12, 1)
      employee.hiredAt = current.day
      return {
        ...current,
        balance: current.balance - signingCost,
        expenses: current.expenses + signingCost,
        employees: [...current.employees, employee],
        ...addLog(current, `${employee.name} entrou na equipe como ${ROLE_LABEL[role]}.`, 'success'),
      }
    })
  }

  if (gameOver) {
    return (
      <div className="game-over">
        <div>
          <p className="eyebrow">Fim de jogo</p>
          <h2>A empresa ficou sem caixa.</h2>
          <p>As despesas ultrapassaram o limite de crédito. Recomece e negocie um contrato mais sustentável.</p>
          <button className="primary" onClick={resetGame}>Começar novamente</button>
        </div>
      </div>
    )
  }

  return (
    <div className="game-shell">
      <Sidebar state={state} screen={screen} onScreen={changeScreen} onMenu={() => setShowLanding(true)} />
      <main className="main">
        <Topbar state={state} screen={screen} onAdvance={advanceDay} />
        <div className="content">
          {screen === 'overview' && <Overview state={state} completed={completed} onScreen={changeScreen} />}
          {screen === 'contracts' && <Contracts state={state} onOffer={acceptNegotiation} />}
          {screen === 'kanban' && <Kanban state={state} onAssign={assignTask} onApprove={approveTask} onContracts={() => changeScreen('contracts')} />}
          {screen === 'team' && <Team state={state} onHire={hire} />}
        </div>
      </main>
    </div>
  )
}

function Landing(props: {
  company: string; founder: string; difficulty: Difficulty; canContinue: boolean
  onCompany: (value: string) => void; onFounder: (value: string) => void
  onDifficulty: (value: Difficulty) => void; onStart: () => void; onContinue: () => void
}) {
  return (
    <div className="landing">
      <section className="hero">
        <div>
          <div className="brand"><span className="brand-mark">PT</span><span>Project Tycoon / v0.2</span></div>
          <h1>Construa.<br />Entregue.<br /><span>Cresça.</span></h1>
          <p className="hero-copy">Você tem dois desenvolvedores, um caixa limitado e seu primeiro cliente. Cada decisão de projeto transforma a história da sua software house.</p>
        </div>
        <div className="hero-foot">
          <div><b>05</b>Pilares de gestão</div><div><b>45d</b>Primeiro desafio</div><div><b>∞</b>Decisões possíveis</div>
        </div>
      </section>
      <section className="start-panel">
        <p className="eyebrow">Nova empresa</p>
        <h2>Comece sua jornada</h2>
        <p className="muted">Defina sua identidade e escolha o nível do desafio.</p>
        <div className="form-grid">
          <label>Nome da empresa<input value={props.company} maxLength={28} onChange={event => props.onCompany(event.target.value)} placeholder="Ex.: Pixel Forge" /></label>
          <label>Nome do fundador<input value={props.founder} maxLength={28} onChange={event => props.onFounder(event.target.value)} placeholder="Seu nome" /></label>
          <label>Dificuldade
            <div className="difficulty-grid">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(level => (
                <button key={level} className={`difficulty ${props.difficulty === level ? 'active' : ''}`} onClick={() => props.onDifficulty(level)}>{DIFFICULTY_CONFIG[level].label}</button>
              ))}
            </div>
          </label>
          <button className="primary" onClick={props.onStart}>Fundar empresa →</button>
        </div>
        {props.canContinue && <div className="continue-box"><button className="secondary" onClick={props.onContinue}>Continuar partida salva</button></div>}
      </section>
    </div>
  )
}

function Sidebar({ state, screen, onScreen, onMenu }: { state: GameState; screen: Screen; onScreen: (screen: Screen) => void; onMenu: () => void }) {
  const nav: Array<[Screen, string, string]> = [['overview', '⌂', 'Visão geral'], ['contracts', '◇', 'Contratos'], ['kanban', '▦', 'Kanban'], ['team', '◎', 'Equipe']]
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">PT</span><span>Project Tycoon</span></div>
      <div className="company-name"><b>{state.company}</b><span>fund. {state.founderName}</span></div>
      <nav className="nav">{nav.map(([id, icon, label]) => <button key={id} className={screen === id ? 'active' : ''} onClick={() => onScreen(id)}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom">SAVE AUTOMÁTICO<br /><button className="ghost" onClick={onMenu}>Menu</button></div>
    </aside>
  )
}

function Topbar({ state, screen, onAdvance }: { state: GameState; screen: Screen; onAdvance: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-title"><h1>{SCREEN_META[screen].title}</h1><span>{SCREEN_META[screen].subtitle}</span></div>
      <div className="hud">
        <div className="hud-item money"><small>Caixa</small><b>{formatMoney(state.balance)}</b></div>
        <div className="hud-item"><small>Reputação</small><b>{state.reputation}/100</b></div>
        <div className="advance"><div className="hud-item"><small>Calendário</small><b>Dia {state.day}</b></div><button className="primary" onClick={onAdvance}>Avançar dia ▸</button></div>
      </div>
    </header>
  )
}

function Overview({ state, completed, onScreen }: { state: GameState; completed: boolean; onScreen: (screen: Screen) => void }) {
  const active = state.contracts.find(contract => ['accepted', 'inprogress'].includes(contract.status))
  const doneTasks = active?.tasks.filter(task => task.status === 'done').length ?? 0
  const progress = active?.tasks.length ? Math.round(doneTasks / active.tasks.length * 100) : 0
  const phases = getPhases(state)
  return (
    <>
      <div className="page-head"><div><h2>Olá, {state.founderName}.</h2><p>{completed ? 'A primeira entrega foi concluída. Sua empresa ganhou mercado.' : 'Sua software house depende das decisões de hoje.'}</p></div>{!active && !completed && <button className="primary" onClick={() => onScreen('contracts')}>Ver primeiro contrato</button>}</div>
      {completed && <div className="result"><h3>Primeiro contrato concluído ✓</h3><p>Você equilibrou prazo, capacidade, qualidade e sustentabilidade financeira — o objetivo central desta fase.</p></div>}
      <section className="grid metrics">
        <Metric className="accent" label="Saldo disponível" value={formatMoney(state.balance)} note={`Resultado: ${formatMoney(state.profit)}`} />
        <Metric className="blue" label="Projeto ativo" value={active ? `${progress}%` : completed ? 'Entregue' : '—'} note={active?.name ?? 'Aguardando contrato'} />
        <Metric className="green" label="Equipe" value={`${state.employees.length}`} note={`${state.employees.filter(employee => employee.state === 'working').length} em atividade`} />
        <Metric className="orange" label="Prazo crítico" value={active ? `${contractDaysRemaining(active, state.day)} dias` : '—'} note={state.daysRemainingAlert ? 'Atenção ao cronograma' : 'Dentro do planejado'} />
      </section>
      <section className="grid overview-grid">
        <div className="card">
          <div className="card-title"><h3>Fases do primeiro contrato</h3><span className="chip">MVP jogável</span></div>
          <div className="phase-list">{phases.map((phase, index) => <div key={phase.title} className={`phase ${phase.state}`}><span className="phase-index">0{index + 1}</span><div><b>{phase.title}</b><small>{phase.description}</small></div><span className="phase-status">{phase.state === 'done' ? 'Concluída' : phase.state === 'active' ? 'Atual' : 'Bloqueada'}</span></div>)}</div>
        </div>
        <div className="card">
          <div className="card-title"><h3>Diário da empresa</h3><span className="chip blue">Dia {state.day}</span></div>
          <div className="activity">{state.gameLog.map((entry, index) => <div className="activity-row" key={`${entry.day}-${index}`}><time>DIA {entry.day}</time><p>{entry.message}</p></div>)}</div>
        </div>
      </section>
    </>
  )
}

function Metric({ label, value, note, className }: { label: string; value: string; note: string; className: string }) {
  return <div className={`card metric ${className}`}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>
}

function Contracts({ state, onOffer }: { state: GameState; onOffer: (id: string, value: number, deadline: number) => void }) {
  const proposal = state.availableContracts[0]
  const active = state.contracts[0]
  const [value, setValue] = useState(proposal?.value ?? active?.value ?? 30_000)
  const [deadline, setDeadline] = useState(proposal?.deadlineDays ?? active?.deadlineDays ?? 45)

  useEffect(() => {
    if (proposal) { setValue(proposal.value); setDeadline(proposal.deadlineDays) }
  }, [proposal?.negotiationAttempts])

  if (!proposal) return (
    <><div className="page-head"><div><h2>Contrato assinado</h2><p>Agora transforme o acordo em uma entrega de qualidade.</p></div></div>
      {active ? <div className="card contract-hero"><span className="client">{active.client}</span><h3>{active.name}</h3><div className="contract-stats"><Stat label="Valor negociado" value={formatMoney(active.value)} /><Stat label="Prazo" value={`${active.deadlineDays} dias`} /><Stat label="Situação" value={active.status === 'completed' ? 'Entregue' : 'Em execução'} /></div></div> : <div className="empty">Nenhuma proposta disponível.</div>}
    </>
  )

  const rejectionText = proposal.rejectionReason === 'both' ? 'O valor e o prazo ultrapassaram o limite do cliente.' : proposal.rejectionReason === 'value' ? 'O cliente achou o valor muito alto.' : 'O cliente achou o prazo muito longo.'
  return (
    <>
      <div className="page-head"><div><h2>Seu primeiro cliente</h2><p>Defina uma proposta sustentável sem perder o negócio.</p></div><span className={`chip ${proposal.status === 'rejected' ? 'warning' : ''}`}>{proposal.status === 'rejected' ? `Contraproposta ${proposal.negotiationAttempts}` : 'Nova oportunidade'}</span></div>
      <section className="grid contract-layout">
        <article className="card contract-hero">
          <span className="client">{proposal.client} / varejo</span><h3>{proposal.name}</h3><p>{proposal.description}</p>
          <div className="contract-stats"><Stat label="Referência" value={formatMoney(proposal.originalValue)} /><Stat label="Prazo esperado" value={`${proposal.originalDeadlineDays} dias`} /><Stat label="Complexidade" value="Média" /></div>
          <p className="eyebrow">Escopo solicitado</p><div className="requirements">{['Cadastro de produtos', 'Controle de estoque', 'Registro de vendas', 'Relatórios', 'Controle de usuários'].map(item => <span key={item}>{item}</span>)}</div>
          <p className="eyebrow" style={{ marginTop: 24 }}>Stack sugerida</p><div className="requirements">{proposal.technicalReqs.map(item => <span key={item}>{item}</span>)}</div>
        </article>
        <aside className="card offer-form">
          <div><p className="eyebrow">Mesa de negociação</p><h3>{proposal.status === 'rejected' ? 'Renegociar contrato' : 'Monte sua oferta'}</h3></div>
          {proposal.status === 'rejected' && <div className="rejection"><b>Oferta recusada.</b><br />{rejectionText} Ajuste as condições e envie uma nova proposta.</div>}
          <label>Valor do contrato<input type="number" min="24000" max="45000" step="500" value={value} onChange={event => setValue(Number(event.target.value))} /></label>
          <label>Prazo de entrega (dias)<input type="number" min="30" max="60" value={deadline} onChange={event => setDeadline(Number(event.target.value))} /></label>
          <div className="offer-summary">Sua proposta: <b>{formatMoney(value)}</b> por uma entrega em <b>{deadline} dias</b>.<br />Quanto maiores o valor e o prazo, maior o risco de recusa.</div>
          <button className="primary" disabled={proposal.negotiationAttempts >= 3} onClick={() => onOffer(proposal.id, value, deadline)}>{proposal.status === 'rejected' ? 'Enviar contraproposta' : 'Apresentar proposta'}</button>
          {proposal.negotiationAttempts >= 3 && <small className="muted">O cliente encerrou a rodada após três tentativas.</small>}
        </aside>
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="contract-stat"><small>{label}</small><b>{value}</b></div> }

function Kanban({ state, onAssign, onApprove, onContracts }: { state: GameState; onAssign: (contractId: string, taskId: string, employeeId: string) => void; onApprove: (contractId: string, taskId: string) => void; onContracts: () => void }) {
  const contract = state.contracts.find(candidate => ['accepted', 'inprogress'].includes(candidate.status)) ?? state.contracts.find(candidate => candidate.status === 'completed')
  if (!contract) return <><div className="page-head"><div><h2>Quadro vazio</h2><p>Um projeto aparece aqui após o aceite do contrato.</p></div></div><div className="empty"><p>Negocie o primeiro contrato para liberar o backlog.</p><button className="primary" onClick={onContracts}>Ir para contratos</button></div></>
  const columns: TaskStatus[] = ['todo', 'inprogress', 'review', 'done']
  return (
    <>
      <div className="page-head"><div><h2>{contract.name}</h2><p>{contract.client} · {contractDaysRemaining(contract, state.day)} dias restantes · qualidade atual {calculateProjectQuality(contract.tasks)}%</p></div><span className="chip">{contract.tasks.filter(task => task.status === 'done').length}/{contract.tasks.length} concluídas</span></div>
      <section className="kanban">{columns.map(status => <div className="column" key={status}><div className="column-head">{STATUS_LABEL[status]}<span>{contract.tasks.filter(task => task.status === status).length}</span></div><div className="task-list">{contract.tasks.filter(task => task.status === status).map(task => <TaskCard key={task.id} task={task} contract={contract} state={state} onAssign={onAssign} onApprove={onApprove} />)}</div></div>)}</section>
    </>
  )
}

function TaskCard({ task, contract, state, onAssign, onApprove }: { task: Task; contract: Contract; state: GameState; onAssign: (contractId: string, taskId: string, employeeId: string) => void; onApprove: (contractId: string, taskId: string) => void }) {
  const dependenciesDone = taskDependenciesDone(task, contract.tasks)
  const assigned = state.employees.find(employee => employee.id === task.assignedTo)
  const available = state.employees.filter(employee => !state.contracts.some(candidate => candidate.tasks.some(candidateTask => candidateTask.status === 'inprogress' && candidateTask.assignedTo === employee.id)))
  return (
    <article className={`task ${!dependenciesDone ? 'blocked' : ''}`}>
      <h4>{task.name}</h4><div className="task-meta"><span>{ROLE_LABEL[task.requiredRole]}</span><span>{task.complexity} pts</span></div>
      <div className="progress"><span style={{ width: `${task.progress}%` }} /></div>
      {task.status === 'todo' && dependenciesDone && <><select defaultValue="" onChange={event => event.target.value && onAssign(contract.id, task.id, event.target.value)}><option value="" disabled>Alocar profissional…</option>{available.map(employee => <option value={employee.id} key={employee.id}>{employee.name} · {ROLE_LABEL[employee.role]}</option>)}</select></>}
      {!dependenciesDone && <div className="blocked-note">Aguardando dependências</div>}
      {task.status === 'inprogress' && <small className="muted">{assigned?.name} · {task.progress}%</small>}
      {task.status === 'review' && <button className="secondary" onClick={() => onApprove(contract.id, task.id)}>Validar e aprovar</button>}
      {task.status === 'done' && <small style={{ color: 'var(--green)' }}>Qualidade {task.quality}% · {task.errors} erro(s)</small>}
    </article>
  )
}

function Team({ state, onHire }: { state: GameState; onHire: (role: Role) => void }) {
  const [role, setRole] = useState<Role>('qa')
  return (
    <>
      <div className="page-head"><div><h2>Seu time</h2><p>Produtividade depende de especialidade, energia e carga de trabalho.</p></div><div className="actions"><select value={role} onChange={event => setRole(event.target.value as Role)}>{(['qa', 'fullstack', 'backend', 'frontend', 'designer'] as Role[]).map(item => <option key={item} value={item}>{ROLE_LABEL[item]}</option>)}</select><button className="primary" onClick={() => onHire(role)}>Contratar · R$ 1,2k</button></div></div>
      <section className="grid team-grid">{state.employees.map(employee => <article className="card employee" key={employee.id}><div className="avatar">{employee.name.split(' ').map(name => name[0]).slice(0, 2).join('')}</div><div><h3>{employee.name}</h3><p>{ROLE_LABEL[employee.role]} · {employee.specialization}</p></div><div className="employee-stats">PROD {employee.productivity} · QUAL {employee.quality}<br />ENERGIA {employee.energy}%<div className="energy"><span style={{ width: `${employee.energy}%` }} /></div></div></article>)}</section>
    </>
  )
}

function getPhases(state: GameState) {
  const contract = state.contracts[0]
  const completed = contract?.status === 'completed'
  const done = contract?.tasks.filter(task => task.status === 'done').length ?? 0
  const hasReview = contract?.tasks.some(task => task.status === 'review') ?? false
  return [
    { title: 'Negociar o contrato', description: 'Equilibrar valor, prazo e chance de aceite.', state: contract ? 'done' : 'active' },
    { title: 'Planejar o trabalho', description: 'Priorizar funcionalidades e respeitar dependências.', state: !contract ? 'locked' : contract.tasks.some(task => task.status !== 'todo') ? 'done' : 'active' },
    { title: 'Executar o projeto', description: 'Alocar equipe e controlar prazo, caixa e energia.', state: !contract || !contract.tasks.some(task => task.status !== 'todo') ? 'locked' : done >= contract.tasks.length - 1 ? 'done' : 'active' },
    { title: 'Validar a qualidade', description: 'Testar entregas e medir erros remanescentes.', state: completed ? 'done' : hasReview || done > 0 ? 'active' : 'locked' },
    { title: 'Entregar e avaliar', description: 'Calcular lucro, reputação e satisfação do cliente.', state: completed ? 'done' : 'locked' },
  ]
}

export default App
