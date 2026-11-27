import { blueprintOf, gpusOf } from './game'
import type { Contract, Employee, GameState, GameStats, HostingDeal } from './types'
import { clamp } from './utils'

/* =========================================================================
   META FINAL: faturar R$ 1 milhão e vender a empresa por R$ 10 milhões
   ========================================================================= */
export const SALE_REVENUE_GOAL = 1_000_000
export const SALE_PRICE = 10_000_000

export function saleReady(state: GameState) {
  return state.revenue >= SALE_REVENUE_GOAL && !state.ended
}

/* =========================================================================
   ESTATÍSTICAS
   ========================================================================= */
const NO_STATS: GameStats = { contractsDone: 0, perfect: 0, gpusEaten: 0, malwareWins: 0, malwareFlawless: 0, quits: 0 }

export function statsOf(state: GameState): GameStats {
  return { ...NO_STATS, ...state.stats }
}

export function bump(state: GameState, key: keyof GameStats, amount = 1): GameState {
  const stats = statsOf(state)
  return { ...state, stats: { ...stats, [key]: stats[key] + amount } }
}

export function log(state: GameState, message: string): GameState {
  return { ...state, gameLog: [{ day: state.day, message }, ...state.gameLog].slice(0, 80) }
}

/* =========================================================================
   ESCRITÓRIO
   ========================================================================= */
export interface OfficeLevel { level: number; name: string; desks: number; cost: number; energy: number; quality: number }

export const OFFICE_LEVELS: OfficeLevel[] = [
  { level: 1, name: 'Escritório inicial', desks: 4, cost: 0, energy: 0, quality: 0 },
  { level: 2, name: 'Escritório ampliado', desks: 6, cost: 40_000, energy: 2, quality: 2 },
  { level: 3, name: 'Sede tech', desks: 8, cost: 120_000, energy: 4, quality: 4 },
]

export function officeOf(state: GameState) {
  return OFFICE_LEVELS[clamp(state.officeLevel || 1, 1, OFFICE_LEVELS.length) - 1]
}

export function nextOffice(state: GameState): OfficeLevel | null {
  return OFFICE_LEVELS[officeOf(state).level] ?? null
}

/* =========================================================================
   ANDARES DO PRÉDIO (acessados pelo elevador)
   ========================================================================= */
export const FLOORS = {
  team: { name: '2º andar · Equipe', price: 150_000, desks: 8 },
  servers: { name: '3º andar · Servidores', price: 100_000, racks: 8 },
} as const

export function deskCapacity(state: GameState) {
  return officeOf(state).desks + (state.floors?.team ? FLOORS.team.desks : 0)
}

/* =========================================================================
   LOCAÇÃO DE SERVIDORES
   ========================================================================= */
const HOSTING_CLIENTS = ['StartUp Foguete', 'Loja Virtual Pix', 'App Fitness Já', 'Jornal Digital', 'Game Studio Bit', 'Escola Online', 'Clínica Conecta', 'Rádio Web 24h', 'Agência Criativa', 'Marketplace Bairro']

export function racksInUse(state: GameState) {
  return (state.hosting ?? []).reduce((sum, deal) => sum + deal.racks, 0)
}

export function hostingIncome(state: GameState) {
  return (state.hosting ?? []).reduce((sum, deal) => sum + deal.dailyRent, 0)
}

export function hostingDaysLeft(deal: HostingDeal, day: number) {
  return deal.startDay === null ? deal.days : Math.max(0, deal.startDay + deal.days - day)
}

function generateHosting(state: GameState): HostingDeal {
  const racks = 1 + Math.floor(Math.random() * 3)
  return {
    id: `host-${state.day}-${Math.random().toString(36).slice(2, 7)}`,
    client: pick(HOSTING_CLIENTS),
    racks,
    dailyRent: round(racks * (140 + Math.random() * 90) * (1 + state.reputation / 200), 10),
    days: 20 + Math.floor(Math.random() * 5) * 10,
    startDay: null,
  }
}

export function refillHosting(state: GameState, target = 3): GameState {
  let offers = state.hostingOffers ?? []
  while (offers.length < target) offers = [...offers, generateHosting(state)]
  return { ...state, hostingOffers: offers }
}

/* =========================================================================
   CANSAÇO, BURNOUT, PSICÓLOGA E SALA DE DESCANSO
   A energia não volta de um dia para o outro durante o projeto: só no fim dele.
   Quem zera a energia duas vezes no mesmo projeto entra em burnout.
   ========================================================================= */
export const WELLNESS = {
  drain: 6, // energia gasta por dia de trabalho
  secondWind: 35, // energia depois de zerar a primeira vez
  restAtDesk: 3, // recuperação por dia parado na mesa, durante um projeto
  restInLounge: 12, // recuperação por dia na sala de descanso
  restBetween: 25, // recuperação por dia sem projeto
  treatPrice: 3_000, // sessões de psicólogo para tirar alguém do burnout
  psychHire: 4_000,
  psychBoost: 1.15, // produtividade com a psicóloga na empresa
  psychDrain: 0.7, // cansaço com a psicóloga na empresa
  loungePrice: 45_000,
}

export interface FatigueNews { exhausted: string[]; burnout: string[]; treated: string[] }

/** Atualiza a energia do dia e trata quem zerou. Devolve funcionários e tarefas atualizados. */
export function applyFatigue(state: GameState, busy: Set<string | null>, turbo: boolean, officeEnergy: number): { state: GameState; news: FatigueNews } {
  const news: FatigueNews = { exhausted: [], burnout: [], treated: [] }
  const projectActive = state.contracts.some(c => ['accepted', 'inprogress'].includes(c.status))
  const drain = WELLNESS.drain * (turbo ? 0.5 : 1) * (state.psychologist ? WELLNESS.psychDrain : 1)
  const rest = (projectActive ? (state.lounge ? WELLNESS.restInLounge + officeEnergy : WELLNESS.restAtDesk) : WELLNESS.restBetween) * (turbo ? 2 : 1)
  const burned = new Set<string>()
  const employees = state.employees.map(e => {
    if (e.state === 'burnout') return e
    if (!busy.has(e.id)) return { ...e, energy: clamp(e.energy + rest), state: 'idle' as const, currentTaskId: null }
    const energy = e.energy - drain
    if (energy > 0) return { ...e, energy: Math.round(energy * 10) / 10, state: 'working' as const }
    const zeroes = (e.zeroes ?? 0) + 1
    if (zeroes < 2) {
      news.exhausted.push(e.name)
      return { ...e, energy: WELLNESS.secondWind, zeroes, state: 'working' as const }
    }
    if (state.psychologist) {
      news.treated.push(e.name)
      return { ...e, energy: 60, zeroes: 0, state: 'working' as const }
    }
    news.burnout.push(e.name)
    burned.add(e.id)
    return { ...e, energy: 0, zeroes, state: 'burnout' as const, currentTaskId: null, satisfaction: clamp(e.satisfaction - 15) }
  })
  // Quem entrou em burnout larga a tarefa (o progresso fica)
  const contracts = burned.size ? state.contracts.map(c => ({
    ...c,
    tasks: c.tasks.map(t => t.assignedTo && burned.has(t.assignedTo) && t.status === 'inprogress' ? { ...t, status: 'todo' as const, assignedTo: null } : t),
  })) : state.contracts
  let next: GameState = { ...state, employees, contracts }
  news.burnout.forEach(name => { next = log(next, `${name} teve burnout e precisa de psicólogo.`) })
  return { state: next, news }
}

/** Fim de projeto: todo mundo descansa (menos quem está em burnout) */
export function restAfterProject(state: GameState): GameState {
  return everyone(state, e => e.state === 'burnout' ? {} : { energy: 100, zeroes: 0 })
}

/* =========================================================================
   EMPRÉSTIMO E FALÊNCIA
   ========================================================================= */
export const LOAN = { amount: 20_000, owed: 24_000, days: 30 }
export const BANKRUPT_DAYS = 15

export function daysToBankruptcy(state: GameState) {
  return state.balance < 0 ? Math.max(0, BANKRUPT_DAYS - (state.redDays ?? 0)) : null
}

/* =========================================================================
   CONTRATOS GERADOS
   ========================================================================= */
const KINDS: Array<{ base: string; building: NonNullable<Contract['buildingType']>; category: string; clients: string[]; names: string[] }> = [
  { base: 'first-contract', building: 'retail', category: 'Varejo', clients: ['Loja Estrela', 'SuperBom Atacado', 'Rede Farol', 'Empório Central'], names: ['Sistema de Vendas', 'PDV na Nuvem', 'Gestão de Estoque', 'E-commerce Completo'] },
  { base: 'delivery-contract', building: 'delivery', category: 'Delivery', clients: ['RapidoJá', 'Fome Zero Apps', 'EntregaMax', 'Sabor na Porta'], names: ['App de Delivery', 'Rastreio de Entregas', 'Marketplace de Restaurantes', 'App de Pedidos'] },
  { base: 'ead-contract', building: 'ead', category: 'Educação', clients: ['Colégio Nova Era', 'Universidade Aurora', 'CursoMais', 'Escola Online Saber'], names: ['Plataforma EAD', 'Sala de Aula Virtual', 'Portal do Aluno', 'App de Cursos'] },
  { base: 'fintech-contract', building: 'fintech', category: 'Finanças', clients: ['BancoLeve', 'PayPix Brasil', 'Cooperativa Unir', 'InvestFácil'], names: ['Core Bancário', 'Carteira Digital', 'App de Investimentos', 'Gateway de Pagamentos'] },
  { base: 'health-contract', building: 'health', category: 'Saúde', clients: ['Clínica Bem-Estar', 'Hospital Esperança', 'SaúdeJá', 'Rede Vida Laboratórios'], names: ['Portal de Telemedicina', 'Prontuário Digital', 'Agenda de Consultas', 'App de Exames'] },
]

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
const round = (value: number, step: number) => Math.round(value / step) * step

/** Proposta nova: fica maior conforme a empresa entrega projetos e ganha reputação */
export function generateContract(state: GameState): { contract: Contract; seq: number } {
  const seq = (state.contractSeq ?? 0) + 1
  const kind = pick(KINDS)
  const done = statsOf(state).contractsDone
  const steps = blueprintOf(kind.base)
  const value = Math.min(160_000, round((26_000 + done * 11_000) * (0.85 + Math.random() * 0.3) * (1 + state.reputation / 200), 500))
  const complexity: Contract['complexity'] = value > 80_000 ? 'hard' : value > 40_000 ? 'medium' : 'easy'
  const deadlineDays = 34 + Math.round(steps.reduce((sum, step) => sum + step[6], 0) * 0.35) + (complexity === 'hard' ? 6 : 0)
  return {
    seq,
    contract: {
      id: `${kind.base}-g${seq}`,
      name: pick(kind.names),
      client: pick(kind.clients),
      category: kind.category,
      description: `Novo projeto de ${kind.category.toLowerCase()}.`,
      value,
      deadlineDays,
      features: steps.length,
      complexity,
      technicalReqs: [...new Set(steps.map(step => step[2].split(/[ &,/]+/)[0]))].slice(0, 5),
      penaltyPerDay: round(value * 0.02, 50),
      bonusEarly: round(value * 0.1, 100),
      bonusQuality: round(value * 0.08, 100),
      status: 'available',
      acceptedAt: null,
      completedAt: null,
      tasks: [],
      minQuality: Math.min(85, 60 + done * 3),
      negotiationAttempts: 0,
      originalValue: value,
      originalDeadlineDays: deadlineDays,
      rejectionReason: null,
      buildingType: kind.building,
      featureList: steps.map(step => `${step[1]} [${step[2]}]`),
    },
  }
}

/** Completa o mercado até ter `target` propostas */
export function refillMarket(state: GameState, target = 5): GameState {
  let next = state
  while (next.availableContracts.length < target) {
    const { contract, seq } = generateContract(next)
    next = { ...next, contractSeq: seq, availableContracts: [...next.availableContracts, contract] }
  }
  return next
}

/* =========================================================================
   EVENTOS ALEATÓRIOS
   ========================================================================= */
export interface GameEvent {
  id: string
  title: string
  text: string
  icon: string
  when?: (state: GameState) => boolean
  options: Array<{ label: string; hint: string; can?: (state: GameState) => boolean; apply: (state: GameState) => GameState }>
}

const activeProject = (state: GameState) => state.contracts.find(c => ['accepted', 'inprogress'].includes(c.status))
const everyone = (state: GameState, change: (e: Employee) => Partial<Employee>): GameState =>
  ({ ...state, employees: state.employees.map(e => ({ ...e, ...change(e) })) })
const pay = (state: GameState, amount: number): GameState =>
  ({ ...state, balance: state.balance - amount, expenses: state.expenses + amount })
const earn = (state: GameState, amount: number): GameState =>
  ({ ...state, balance: state.balance + amount, revenue: state.revenue + amount })
const rep = (state: GameState, delta: number): GameState => ({ ...state, reputation: clamp(state.reputation + delta) })

export const EVENTS: GameEvent[] = [
  {
    id: 'server', icon: '🔥', title: 'O servidor caiu!', text: 'O sistema de um cliente antigo saiu do ar no meio da madrugada.',
    options: [
      { label: 'Plantão de emergência', hint: '−R$ 2.000 · +3 reputação', apply: s => rep(pay(s, 2_000), 3) },
      { label: 'Resolver amanhã', hint: '−5 reputação', apply: s => rep(s, -5) },
    ],
  },
  {
    id: 'scope', icon: '📝', title: 'Mudança de escopo', text: 'O cliente do projeto atual quer uma funcionalidade nova.',
    when: s => Boolean(activeProject(s)),
    options: [
      { label: 'Aceitar e cobrar', hint: '+R$ 4.000 no contrato · uma tarefa volta 25%', apply: s => {
        const project = activeProject(s)
        if (!project) return s
        let hit = false
        return {
          ...s,
          contracts: s.contracts.map(c => c.id !== project.id ? c : {
            ...c,
            value: c.value + 4_000,
            tasks: c.tasks.map(t => {
              if (hit || t.status !== 'inprogress') return t
              hit = true
              return { ...t, progress: Math.max(0, t.progress - 25) }
            }),
          }),
        }
      } },
      { label: 'Recusar educadamente', hint: '−3 reputação', apply: s => rep(s, -3) },
    ],
  },
  {
    id: 'flu', icon: '🤧', title: 'Gripe no escritório', text: 'Metade da equipe chegou espirrando.',
    options: [
      { label: 'Home office pago', hint: '−R$ 1.500 · equipe +15 satisfação', apply: s => everyone(pay(s, 1_500), e => ({ satisfaction: clamp(e.satisfaction + 15) })) },
      { label: 'Todo mundo trabalhando', hint: 'equipe −30 energia · −10 satisfação', apply: s => everyone(s, e => ({ energy: clamp(e.energy - 30), satisfaction: clamp(e.satisfaction - 10) })) },
    ],
  },
  {
    id: 'gpu-sale', icon: '🛒', title: 'Promoção de placas de vídeo', text: 'Uma loja está liquidando placas de vídeo pela metade do preço.',
    options: [
      { label: 'Comprar uma', hint: '−R$ 2.500 · +1 placa', can: s => s.balance >= 2_500, apply: s => ({ ...pay(s, 2_500), gpus: gpusOf(s) + 1 }) },
      { label: 'Deixar passar', hint: 'nada acontece', apply: s => s },
    ],
  },
  {
    id: 'hackathon', icon: '🏆', title: 'Convite para hackathon', text: 'Um evento de programação quer sua equipe no fim de semana.',
    options: [
      { label: 'Participar', hint: '−R$ 1.500 · +5 reputação · +10 satisfação', apply: s => everyone(rep(pay(s, 1_500), 5), e => ({ satisfaction: clamp(e.satisfaction + 10) })) },
      { label: 'Descansar', hint: 'equipe +20 energia', apply: s => everyone(s, e => ({ energy: clamp(e.energy + 20) })) },
    ],
  },
  {
    id: 'coffee', icon: '☕', title: 'A cafeteira quebrou', text: 'Sem café, a produtividade despenca.',
    options: [
      { label: 'Consertar já', hint: '−R$ 600', apply: s => pay(s, 600) },
      { label: 'Aguentar firme', hint: 'equipe −15 energia · −8 satisfação', apply: s => everyone(s, e => ({ energy: clamp(e.energy - 15), satisfaction: clamp(e.satisfaction - 8) })) },
    ],
  },
  {
    id: 'viral', icon: '📣', title: 'Post viralizou!', text: 'Um vídeo dos bastidores da empresa bombou nas redes.',
    options: [{ label: 'Aproveitar a fama', hint: '+6 reputação · nova proposta no mercado', apply: s => refillMarket(rep(s, 6), s.availableContracts.length + 1) }],
  },
  {
    id: 'bug', icon: '🐛', title: 'Bug em produção', text: 'Um cliente antigo achou um bug sério no sistema entregue.',
    when: s => statsOf(s).contractsDone > 0,
    options: [
      { label: 'Corrigir de graça', hint: 'equipe −10 energia · +3 reputação', apply: s => everyone(rep(s, 3), e => ({ energy: clamp(e.energy - 10) })) },
      { label: 'Cobrar a correção', hint: '+R$ 3.000 · −5 reputação', apply: s => rep(earn(s, 3_000), -5) },
    ],
  },
  {
    id: 'angel', icon: '😇', title: 'Investidor-anjo', text: 'Um investidor gostou da empresa e oferece um aporte.',
    when: s => s.balance < 15_000,
    options: [
      { label: 'Aceitar o aporte', hint: '+R$ 12.000 · −4 reputação', apply: s => rep({ ...s, balance: s.balance + 12_000 }, -4) },
      { label: 'Seguir independente', hint: '+2 reputação', apply: s => rep(s, 2) },
    ],
  },
]

export function eventById(id: string | null | undefined) {
  return EVENTS.find(event => event.id === id) ?? null
}

/* =========================================================================
   FIM DO DIA: satisfação, demissões, empréstimo, falência, mercado e eventos
   ========================================================================= */
export interface DayNews { hostingEnded?: string[]; quit?: string; loanPaid?: number; bankrupt?: boolean; event?: string; newOffer?: boolean }

export function endOfDay(input: GameState): { state: GameState; news: DayNews } {
  let state = input
  const news: DayNews = {}
  const turbo = (state.turboUntil ?? 0) > state.day

  // Satisfação: cansaço derruba, descanso e turbo animam
  state = everyone(state, e => ({
    satisfaction: clamp(e.satisfaction + (e.state === 'burnout' ? -4 : e.energy < 25 ? -2 : e.energy > 70 ? 1 : 0) + (turbo ? 1 : 0) + (state.psychologist ? 1 : 0)),
  }))

  // Muito insatisfeito pode pedir demissão (a tarefa volta para "a fazer")
  const unhappy = state.employees.find(e => e.satisfaction < 20 && Math.random() < 0.15)
  if (unhappy && state.employees.length > 1) {
    news.quit = unhappy.name
    state = bump(log({
      ...state,
      employees: state.employees.filter(e => e.id !== unhappy.id),
      contracts: state.contracts.map(c => ({
        ...c,
        tasks: c.tasks.map(t => t.assignedTo === unhappy.id && t.status === 'inprogress' ? { ...t, status: 'todo', assignedTo: null } : t),
      })),
    }, `${unhappy.name} pediu demissão.`), 'quits')
  }

  // Racks alugados pagam todo dia; contratos vencidos liberam espaço
  if (state.floors?.servers) {
    const income = hostingIncome(state)
    const expired = (state.hosting ?? []).filter(deal => hostingDaysLeft(deal, state.day) <= 0)
    if (income) state = { ...state, balance: state.balance + income, revenue: state.revenue + income }
    if (expired.length) {
      news.hostingEnded = expired.map(deal => deal.client)
      state = log({ ...state, hosting: (state.hosting ?? []).filter(deal => !expired.includes(deal)) }, `Locação encerrada: ${news.hostingEnded.join(', ')}.`)
    }
    if (state.day - (state.hostingDay ?? 0) >= 4) {
      const offers = (state.hostingOffers ?? []).slice(-2)
      state = refillHosting({ ...state, hostingOffers: offers, hostingDay: state.day })
    }
  }

  // Empréstimo vence
  if (state.loan && state.day >= state.loan.dueDay) {
    news.loanPaid = state.loan.owed
    state = log({ ...pay(state, state.loan.owed), loan: null }, `Empréstimo quitado: ${state.loan.owed}.`)
  }

  // Falência após dias seguidos no vermelho
  const redDays = state.balance < 0 ? (state.redDays ?? 0) + 1 : 0
  state = { ...state, redDays }
  if (redDays >= BANKRUPT_DAYS && !state.ended) {
    news.bankrupt = true
    state = log({ ...state, ended: { kind: 'bankrupt', day: state.day } }, 'A empresa faliu.')
  }

  // Mercado: uma proposta nova a cada 7 dias
  if (state.day - (state.marketDay ?? 0) >= 7 && state.availableContracts.length < 6) {
    news.newOffer = true
    state = { ...refillMarket(state, state.availableContracts.length + 1), marketDay: state.day }
  }

  // Evento aleatório (no máximo um a cada 4 dias)
  if (!state.pendingEvent && !state.ended && state.day - (state.lastEventDay ?? 0) >= 4 && Math.random() < 0.16) {
    const options = EVENTS.filter(event => !event.when || event.when(state))
    const event = pick(options)
    news.event = event.id
    state = { ...state, pendingEvent: event.id, lastEventDay: state.day }
  }

  return { state, news }
}

/* =========================================================================
   CONQUISTAS
   ========================================================================= */
export const ACHIEVEMENTS: Array<{ id: string; icon: string; title: string; text: string; test: (s: GameState) => boolean }> = [
  { id: 'first', icon: '🤝', title: 'Primeiro cliente', text: 'Entregue um contrato.', test: s => statsOf(s).contractsDone >= 1 },
  { id: 'five', icon: '📦', title: 'Portfólio de respeito', text: 'Entregue 5 contratos.', test: s => statsOf(s).contractsDone >= 5 },
  { id: 'perfect', icon: '💎', title: 'Entrega perfeita', text: 'Entregue um contrato com 100% de qualidade.', test: s => statsOf(s).perfect >= 1 },
  { id: 'malware', icon: '🛡', title: 'Antivírus humano', text: 'Vença o malware.', test: s => statsOf(s).malwareWins >= 1 },
  { id: 'flawless', icon: '❤', title: 'Sem um arranhão', text: 'Vença o malware sem perder vida.', test: s => statsOf(s).malwareFlawless >= 1 },
  { id: 'malware4', icon: '👾', title: 'Caçador de vírus', text: 'Vença 4 malwares diferentes.', test: s => statsOf(s).malwareWins >= 4 },
  { id: 'gpus', icon: '🍽', title: 'Tutor bem alimentado', text: 'Dê 5 placas de vídeo ao tutor.', test: s => statsOf(s).gpusEaten >= 5 },
  { id: 'team', icon: '👥', title: 'Casa cheia', text: 'Tenha 8 pessoas na equipe.', test: s => s.employees.length >= 8 },
  { id: '100k', icon: '💰', title: 'Seis dígitos', text: 'Fature R$ 100 mil.', test: s => s.revenue >= 100_000 },
  { id: 'hq', icon: '🏢', title: 'Sede tech', text: 'Amplie o escritório ao máximo.', test: s => (s.officeLevel || 1) >= 3 },
  { id: 'tower', icon: '🛗', title: 'Prédio inteiro', text: 'Compre os dois andares novos.', test: s => Boolean(s.floors?.team && s.floors?.servers) },
  { id: 'datacenter', icon: '🖥', title: 'Data center lotado', text: 'Alugue todos os racks do andar de servidores.', test: s => racksInUse(s) >= FLOORS.servers.racks },
  { id: 'psy', icon: '🧠', title: 'Mente sã', text: 'Contrate a psicóloga da empresa.', test: s => Boolean(s.psychologist) },
  { id: 'lounge', icon: '🎮', title: 'Hora do recreio', text: 'Construa a sala de jogos e descanso.', test: s => Boolean(s.lounge) },
  { id: 'rep', icon: '⭐', title: 'Referência no mercado', text: 'Chegue a 80 de reputação.', test: s => s.reputation >= 80 },
  { id: 'exit', icon: '🚀', title: 'Exit milionário', text: 'Venda a empresa por R$ 10 milhões.', test: s => s.ended?.kind === 'sold' },
]

export function newAchievements(state: GameState) {
  const owned = new Set(state.achievements ?? [])
  return ACHIEVEMENTS.filter(a => !owned.has(a.id) && a.test(state))
}

