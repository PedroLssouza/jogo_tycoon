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
export type EmployeeState = 'idle' | 'working' | 'tired' | 'sick' | 'unhappy' | 'job Hunting'

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
}

export interface Task {
  id: string
  projectId: string
  name: string
  description: string
  status: TaskStatus
  complexity: number // 1-10
  requiredRole: Role
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
