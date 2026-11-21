import { createStarterTeam } from './employees'
import type { Contract, Difficulty, GameState, Role, Task } from './types'
import { clamp, uid } from './utils'

const FIRST_PROJECT_ID = 'first-contract'

const TASK_BLUEPRINTS: Array<[string, string, Role, number, number, string[]]> = [
  ['products', 'Cadastro de produtos', 'fullstack', 5, 5, []],
  ['stock', 'Controle de estoque', 'backend', 7, 7, ['products']],
  ['sales', 'Registro de vendas', 'fullstack', 8, 8, ['products', 'stock']],
  ['reports', 'Relatórios gerenciais', 'frontend', 6, 6, ['sales']],
  ['users', 'Controle de usuários', 'backend', 5, 5, []],
  ['tests', 'Testes e validação final', 'qa', 6, 7, ['reports', 'users']],
]

export const DIFFICULTY_CONFIG = {
  easy: { label: 'Fácil', balance: 32_000, dailyCostMultiplier: 0.8, productivity: 1.18 },
  normal: { label: 'Normal', balance: 24_000, dailyCostMultiplier: 1, productivity: 1 },
  hard: { label: 'Difícil', balance: 18_000, dailyCostMultiplier: 1.2, productivity: 0.88 },
} as const

export function makeFirstContract(): Contract {
  return {
    id: FIRST_PROJECT_ID,
    name: 'Sistema de Vendas',
    client: 'Mercado Horizonte',
    description: 'Uma rede varejista precisa digitalizar produtos, estoque, vendas, relatórios e usuários.',
    value: 30_000,
    deadlineDays: 45,
    features: 5,
    complexity: 'medium',
    technicalReqs: ['React', 'Node.js', 'Banco de dados', 'Testes'],
    penaltyPerDay: 650,
    bonusEarly: 3_000,
    bonusQuality: 2_000,
    status: 'available',
    acceptedAt: null,
    completedAt: null,
    tasks: [],
    minQuality: 70,
    negotiationAttempts: 0,
    originalValue: 30_000,
    originalDeadlineDays: 45,
    rejectionReason: null,
  }
}

export function createInitialState(company: string, founderName: string, difficulty: Difficulty): GameState {
  const team = createStarterTeam().slice(0, 2)
  return {
    difficulty,
    founderName,
    company,
    day: 1,
    startedAt: Date.now(),
    reputation: 35,
    officeLevel: 1,
    balance: DIFFICULTY_CONFIG[difficulty].balance,
    revenue: 0,
    expenses: 0,
    profit: 0,
    weeklyBurn: Math.round(team.reduce((total, employee) => total + employee.salary, 0) / 4),
    employees: team,
    nextEmployeeId: team.length + 1,
    contracts: [],
    availableContracts: [makeFirstContract()],
    nextContractId: 2,
    timeScale: 'paused',
    lastTick: Date.now(),
    daysRemainingAlert: false,
    currentScreen: 'overview',
    selectedProjectId: null,
    notifications: [{ id: uid(), type: 'info', message: 'Seu primeiro cliente aguarda uma proposta.', day: 1, read: false }],
    gameLog: [{ day: 1, message: `${company} iniciou suas atividades.` }],
  }
}

export function createProjectTasks(projectId: string): Task[] {
  return TASK_BLUEPRINTS.map(([id, name, requiredRole, complexity, estimatedDays, dependsOn]) => ({
    id: `${projectId}-${id}`,
    projectId,
    name,
    description: `Entregar ${name.toLocaleLowerCase('pt-BR')} com qualidade e documentação.`,
    status: 'todo',
    complexity,
    requiredRole,
    estimatedDays,
    progress: 0,
    assignedTo: null,
    startedAt: null,
    quality: null,
    errors: 0,
    dependsOn: dependsOn.map(dependency => `${projectId}-${dependency}`),
  }))
}

export function evaluateOffer(contract: Contract, value: number, deadlineDays: number, reputation: number) {
  const trust = reputation / 100
  const attemptPenalty = contract.negotiationAttempts * 0.025
  const maxValue = contract.originalValue * (1 + trust * 0.08 - attemptPenalty)
  const maxDeadline = contract.originalDeadlineDays + Math.floor(trust * 4) - contract.negotiationAttempts
  const valueTooHigh = value > maxValue
  const deadlineTooHigh = deadlineDays > maxDeadline
  const accepted = !valueTooHigh && !deadlineTooHigh && value >= contract.originalValue * 0.82 && deadlineDays >= 32
  const reason: Contract['rejectionReason'] = valueTooHigh && deadlineTooHigh ? 'both' : valueTooHigh ? 'value' : deadlineTooHigh ? 'deadline' : null
  return { accepted, reason, maxValue: Math.floor(maxValue / 500) * 500, maxDeadline }
}

export function contractDaysRemaining(contract: Contract, currentDay: number) {
  if (contract.acceptedAt === null) return contract.deadlineDays
  return contract.deadlineDays - (currentDay - contract.acceptedAt)
}

export function taskDependenciesDone(task: Task, tasks: Task[]) {
  return task.dependsOn.every(id => tasks.find(candidate => candidate.id === id)?.status === 'done')
}

export function dailyEmployeeCost(state: GameState) {
  const salaries = state.employees.reduce((total, employee) => total + employee.salary, 0)
  return Math.round((salaries / 30 + 130) * DIFFICULTY_CONFIG[state.difficulty].dailyCostMultiplier)
}

export function calculateTaskGain(productivity: number, speed: number, complexity: number, difficulty: Difficulty) {
  const output = (productivity * 0.55 + speed * 0.45) / Math.max(3.5, complexity)
  return Math.max(4, Math.round(output * DIFFICULTY_CONFIG[difficulty].productivity))
}

export function calculateProjectQuality(tasks: Task[]) {
  if (!tasks.length) return 0
  return Math.round(tasks.reduce((sum, task) => sum + (task.quality ?? 0), 0) / tasks.length)
}

export function settlementFor(contract: Contract, currentDay: number) {
  const quality = calculateProjectQuality(contract.tasks)
  const daysRemaining = contractDaysRemaining(contract, currentDay)
  const lateDays = Math.max(0, -daysRemaining)
  const earlyBonus = daysRemaining >= 4 ? contract.bonusEarly : 0
  const qualityBonus = quality >= 85 ? contract.bonusQuality : 0
  const penalty = lateDays * contract.penaltyPerDay
  const payment = Math.max(0, contract.value + earlyBonus + qualityBonus - penalty)
  const reputationDelta = clamp(Math.round((quality - 65) / 5) + (lateDays === 0 ? 3 : -lateDays), -12, 15)
  return { quality, daysRemaining, earlyBonus, qualityBonus, penalty, payment, reputationDelta }
}
