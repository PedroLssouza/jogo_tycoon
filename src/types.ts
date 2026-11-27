export type Difficulty = 'easy' | 'normal' | 'hard'

export type Role =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'designer'
  | 'qa'
  | 'pm'
  | 'devops'

export type TaskStatus = 'todo' | 'inprogress' | 'review' | 'done'
export type ContractStatus = 'available' | 'negotiating' | 'rejected' | 'accepted' | 'inprogress' | 'completed' | 'failed'
export type EmployeeState = 'idle' | 'working' | 'tired' | 'sick' | 'unhappy' | 'job Hunting' | 'burnout'

export interface Employee {
  id: string
  name: string
  role: Role
  salary: number
  experience: number // 0-100
  productivity: number // 0-100 base
  speed: number // 0-100
  quality: number // 0-100
  specialization: string
  satisfaction: number // 0-100
  energy: number // 0-100
  state: EmployeeState
  currentTaskId: string | null
  hiredAt: number // day
  zeroes?: number // vezes que a energia zerou no projeto atual (2 = burnout)
}

export interface Task {
  id: string
  projectId: string
  name: string
  description: string
  status: TaskStatus
  complexity: number // 1-10
  requiredRole: Role
  secondaryRole?: Role
  technology?: string
  estimatedDays: number
  progress: number // 0-100
  assignedTo: string | null // employee id
  startedAt: number | null
  quality: number | null
  errors: number
  dependsOn: string[]
}

export interface Contract {
  id: string
  name: string
  client: string
  description: string
  value: number
  deadlineDays: number
  features: number
  complexity: 'easy' | 'medium' | 'hard'
  technicalReqs: string[]
  penaltyPerDay: number
  bonusEarly: number
  bonusQuality: number
  status: ContractStatus
  acceptedAt: number | null
  completedAt: number | null
  tasks: Task[]
  minQuality: number
  negotiationAttempts: number
  originalValue: number
  originalDeadlineDays: number
  rejectionReason: 'value' | 'deadline' | 'both' | null
  category?: string
  featureList?: string[]
  buildingType?: 'retail' | 'delivery' | 'ead' | 'fintech' | 'health'
}

export interface ProjectMetrics {
  technicalQuality: number
  onTime: boolean
  clientSatisfaction: number
  featuresDelivered: number
  errorsFound: number
  productivity: number
}

export interface RandomEvent {
  id: string
  type: string
  title: string
  description: string
  options: EventOption[]
}

export interface EventOption {
  label: string
  description: string
  apply: (state: GameState) => Partial<GameState> & { log?: string }
}

export interface GameState {
  // Meta
  difficulty: Difficulty
  founderName: string
  company: string
  day: number
  startedAt: number
  reputation: number // 0-100
  officeLevel: number

  // Finance
  balance: number
  revenue: number
  expenses: number
  profit: number
  weeklyBurn: number

  // Employees
  employees: Employee[]
  nextEmployeeId: number

  // Coringa Claude (opcionais: saves antigos não têm)
  jokers?: number // coringas guardados
  joker?: Employee | null // coringa em ação
  jokerDay?: number // dia da última tentativa no minigame

  // Placas de vídeo (gemas) e turbo do tutor (opcionais: saves antigos não têm)
  gpus?: number
  gpuGift?: boolean // já recebeu as 3 placas extras
  turboUntil?: number // o turbo vale enquanto day < turboUntil

  // Progressão (opcionais: saves antigos não têm)
  stats?: GameStats
  achievements?: string[]
  loan?: { owed: number; dueDay: number } | null
  redDays?: number // dias seguidos com caixa negativo
  pendingEvent?: string | null
  lastEventDay?: number
  marketDay?: number // último dia em que o mercado ganhou uma proposta nova
  contractSeq?: number
  saleOfferSeen?: boolean
  ended?: { kind: 'sold' | 'bankrupt'; day: number } | null
  floors?: { team?: boolean; servers?: boolean } // andares extras do prédio
  psychologist?: boolean // psicóloga contratada pela empresa
  lounge?: boolean // sala de jogos e descanso
  hosting?: HostingDeal[] // racks alugados
  hostingOffers?: HostingDeal[]
  hostingDay?: number // último dia em que surgiu proposta de locação

  // Contracts
  contracts: Contract[]
  availableContracts: Contract[]
  nextContractId: number

  // Time
  timeScale: 'paused' | 'day' | 'week'
  lastTick: number
  daysRemainingAlert: boolean

  // UI
  currentScreen: string
  selectedProjectId: string | null
  notifications: Notification[]
  gameLog: LogEntry[]
}

export interface Notification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  day: number
  read: boolean
}

export interface LogEntry {
  day: number
  message: string
}

export interface GameStats {
  contractsDone: number
  perfect: number
  gpusEaten: number
  malwareWins: number
  malwareFlawless: number
  quits: number
}

/** Contrato de locação de servidor: o cliente paga um valor por dia pelos racks */
export interface HostingDeal {
  id: string
  client: string
  racks: number
  dailyRent: number
  days: number
  startDay: number | null
}
