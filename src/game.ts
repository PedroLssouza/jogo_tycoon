import { createStarterTeam } from './employees'
import type { Contract, Difficulty, GameState, Role, Task } from './types'
import { clamp, uid } from './utils'

export const DIFFICULTY_CONFIG = {
  easy: { label: 'Fácil', balance: 32_000, dailyCostMultiplier: 0.8, productivity: 1.18 },
  normal: { label: 'Normal', balance: 24_000, dailyCostMultiplier: 1, productivity: 1 },
  hard: { label: 'Difícil', balance: 18_000, dailyCostMultiplier: 1.2, productivity: 0.88 },
} as const

// [id, name, technology, requiredRole, secondaryRole, complexity, estimatedDays, dependsOn]
export type TaskBlueprint = [string, string, string, Role, Role | undefined, number, number, string[]]

const TASK_BLUEPRINTS_MAP: Record<string, TaskBlueprint[]> = {
  'first-contract': [
    ['ui', 'Design System & Telas de PDV', 'Figma & UI Design', 'designer', 'frontend', 4, 4, []],
    ['products', 'Catálogo de Produtos & Estoque', 'React / TypeScript', 'frontend', 'fullstack', 5, 5, ['ui']],
    ['stock', 'API de Estoque & Banco Relacional', 'Node.js & PostgreSQL', 'backend', 'fullstack', 7, 6, ['products']],
    ['sales', 'Registro de Vendas & Checkout', 'Full Stack Integrado', 'fullstack', 'backend', 8, 7, ['products', 'stock']],
    ['reports', 'Dashboard de Vendas & Relatórios', 'React Charts & BI', 'frontend', 'designer', 6, 5, ['sales']],
    ['tests', 'Testes Automatizados & Validação', 'Jest & QA', 'qa', 'fullstack', 6, 6, ['reports', 'stock']],
  ],
  'delivery-contract': [
    ['wireframes', 'UI/UX Mobile do Cliente & Entregador', 'Figma Mobile', 'designer', 'frontend', 4, 4, []],
    ['catalog', 'Cardápio Digital & Restaurantes', 'React Native / Mobile', 'frontend', 'fullstack', 5, 5, ['wireframes']],
    ['cart', 'Carrinho de Compras & Checkout PIX', 'Node.js & Stripe', 'fullstack', 'backend', 6, 5, ['catalog']],
    ['tracking', 'Rastreamento GPS em Tempo Real', 'WebSockets & Redis', 'backend', 'devops', 7, 6, ['cart']],
    ['panel', 'Painel Administrativo do Restaurante', 'React Dashboard', 'frontend', 'designer', 5, 5, ['catalog']],
    ['tests', 'Homologação Mobile iOS & Android', 'Appium & QA Test', 'qa', 'frontend', 5, 5, ['panel', 'tracking']],
  ],
  'ead-contract': [
    ['ux', 'Design da Plataforma & Player de Vídeo', 'Figma & Prototipagem', 'designer', 'frontend', 5, 4, []],
    ['player', 'Player HLS Adaptativo com Legendas', 'Next.js & Video.js', 'frontend', 'fullstack', 6, 6, ['ux']],
    ['media', 'Pipeline de Processamento & Upload', 'AWS S3 & Node.js', 'backend', 'devops', 6, 5, ['ux']],
    ['quizzes', 'Módulo de Quizzes & Certificados', 'PostgreSQL & TypeScript', 'fullstack', 'backend', 5, 5, ['player']],
    ['forum', 'Fórum Interativo de Alunos', 'WebSockets & React', 'frontend', 'fullstack', 5, 5, ['quizzes']],
    ['tests', 'Testes de Carga & Streaming Massivo', 'k6 & QA Performance', 'qa', 'devops', 7, 6, ['player', 'forum']],
  ],
  'fintech-contract': [
    ['infra', 'Infraestrutura de Microsserviços', 'Docker & Kubernetes', 'devops', 'backend', 7, 6, []],
    ['auth2fa', 'Autenticação Biométrica & 2FA', 'Go & Criptografia', 'backend', 'devops', 7, 6, ['infra']],
    ['pix', 'Motor de Liquidação PIX em Tempo Real', 'Go, Redis & Filas', 'backend', 'fullstack', 9, 8, ['auth2fa']],
    ['banking-ui', 'Internet Banking Web Responsivo', 'React, Next.js & Tailwind', 'frontend', 'designer', 7, 6, ['auth2fa']],
    ['antifraud', 'Motor Antifraude & Inteligência de Risco', 'Python & Go API', 'fullstack', 'backend', 8, 7, ['pix']],
    ['tests', 'Pen-Test, Auditoria & Segurança Máxima', 'QA Security & OWASP', 'qa', 'devops', 9, 8, ['banking-ui', 'antifraud']],
  ],
  'health-contract': [
    ['tele-ui', 'Design de Consulta Online & Triagem', 'Figma & Acessibilidade', 'designer', 'frontend', 5, 5, []],
    ['webrtc', 'Sala de Videoconferência Médica HD', 'WebRTC & React', 'frontend', 'fullstack', 8, 7, ['tele-ui']],
    ['records', 'Prontuário Eletrônico LGPD Criptografado', 'Node.js & Cripto', 'backend', 'devops', 7, 7, ['tele-ui']],
    ['scheduling', 'Agendamento Médico & Lembretes WhatsApp', 'APIs & Node.js', 'fullstack', 'frontend', 5, 5, ['records']],
    ['prescription', 'Prescrição Digital com Assinatura & QR', 'PostgreSQL & ICP-Brasil', 'backend', 'fullstack', 6, 5, ['records']],
    ['tests', 'Validação Clínica & Conformidade LGPD', 'QA Compliance & HIPAA', 'qa', 'backend', 7, 6, ['webrtc', 'prescription']],
  ],
}

/** Etapas de um tipo de projeto (usadas também pelos contratos gerados) */
export function blueprintOf(base: string): TaskBlueprint[] {
  return TASK_BLUEPRINTS_MAP[base] ?? TASK_BLUEPRINTS_MAP['first-contract']
}

export function makeFirstContract(): Contract {
  return {
    id: 'first-contract',
    name: 'Sistema de Vendas',
    client: 'Mercado Horizonte',
    category: 'Varejo',
    description: 'Uma rede varejista precisa digitalizar catálogo, estoque, vendas e relatórios.',
    value: 30_000,
    deadlineDays: 45,
    features: 6,
    complexity: 'medium',
    technicalReqs: ['React', 'Node.js', 'PostgreSQL', 'Figma', 'Jest'],
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
    buildingType: 'retail',
    featureList: [
      'Design System & Telas PDV [Figma]',
      'Catálogo & Estoque [React]',
      'API Vendas & Banco [Node.js]',
      'Registro de Vendas [Fullstack]',
      'Dashboard & Relatórios [BI]',
      'Testes Automatizados [Jest]',
    ],
  }
}

export function makeDeliveryContract(): Contract {
  return {
    id: 'delivery-contract',
    name: 'App Delivery & Rastreio',
    client: 'SaborExpress',
    category: 'Gastronomia & Logística',
    description: 'Rede de restaurantes necessita de app mobile com cardápio, checkout e rota de entregadores.',
    value: 24_000,
    deadlineDays: 35,
    features: 6,
    complexity: 'easy',
    technicalReqs: ['React Native', 'Node.js', 'WebSockets', 'MongoDB', 'Figma'],
    penaltyPerDay: 500,
    bonusEarly: 2_500,
    bonusQuality: 1_800,
    status: 'available',
    acceptedAt: null,
    completedAt: null,
    tasks: [],
    minQuality: 65,
    negotiationAttempts: 0,
    originalValue: 24_000,
    originalDeadlineDays: 35,
    rejectionReason: null,
    buildingType: 'delivery',
    featureList: [
      'UI/UX Mobile [Figma]',
      'Cardápio Digital [React Native]',
      'Carrinho & Pagamentos [Stripe]',
      'Rastreamento GPS [WebSockets]',
      'Painel do Restaurante [Web]',
      'Homologação Mobile [Appium]',
    ],
  }
}

export function makeEadContract(): Contract {
  return {
    id: 'ead-contract',
    name: 'Plataforma EAD & Vídeos',
    client: 'EducaPlus Academy',
    category: 'Educação & Mídia',
    description: 'Portal de ensino a distância com streaming em alta definição, quizzes e certificação.',
    value: 38_000,
    deadlineDays: 50,
    features: 6,
    complexity: 'medium',
    technicalReqs: ['Next.js', 'AWS S3', 'PostgreSQL', 'Stripe', 'Video.js'],
    penaltyPerDay: 750,
    bonusEarly: 3_500,
    bonusQuality: 2_500,
    status: 'available',
    acceptedAt: null,
    completedAt: null,
    tasks: [],
    minQuality: 75,
    negotiationAttempts: 0,
    originalValue: 38_000,
    originalDeadlineDays: 50,
    rejectionReason: null,
    buildingType: 'ead',
    featureList: [
      'UX de Aprendizagem [Figma]',
      'Player Vídeo Adaptativo [Next.js]',
      'Processamento Mídia [AWS S3]',
      'Quizzes & Certificados [SQL]',
      'Fórum Interativo [WebSockets]',
      'Testes de Carga [k6 QA]',
    ],
  }
}

export function makeFintechContract(): Contract {
  return {
    id: 'fintech-contract',
    name: 'Fintech Core & PIX',
    client: 'NeoBank Tech',
    category: 'Finanças & Segurança',
    description: 'Core bancário seguro com gateway PIX instantâneo, conciliação e motor antifraude.',
    value: 58_000,
    deadlineDays: 60,
    features: 6,
    complexity: 'hard',
    technicalReqs: ['Go', 'TypeScript', 'Redis', 'Docker', 'Criptografia'],
    penaltyPerDay: 1_200,
    bonusEarly: 5_500,
    bonusQuality: 4_000,
    status: 'available',
    acceptedAt: null,
    completedAt: null,
    tasks: [],
    minQuality: 85,
    negotiationAttempts: 0,
    originalValue: 58_000,
    originalDeadlineDays: 60,
    rejectionReason: null,
    buildingType: 'fintech',
    featureList: [
      'Infra Microsserviços [Docker]',
      'Autenticação 2FA [Go Cripto]',
      'Motor PIX Instantâneo [Redis]',
      'Web Banking Seguro [React]',
      'Motor Antifraude [Python/Go]',
      'Pen-Test & Auditoria [Security]',
    ],
  }
}

export function makeHealthContract(): Contract {
  return {
    id: 'health-contract',
    name: 'Portal de Telemedicina',
    client: 'VidaDigital Saúde',
    category: 'Saúde & Conectividade',
    description: 'Plataforma para consultas médicas online por vídeo, agendamento e receitas digitais com QR.',
    value: 46_000,
    deadlineDays: 55,
    features: 6,
    complexity: 'hard',
    technicalReqs: ['WebRTC', 'React', 'Node.js', 'LGPD/HIPAA', 'Figma'],
    penaltyPerDay: 950,
    bonusEarly: 4_200,
    bonusQuality: 3_200,
    status: 'available',
    acceptedAt: null,
    completedAt: null,
    tasks: [],
    minQuality: 80,
    negotiationAttempts: 0,
    originalValue: 46_000,
    originalDeadlineDays: 55,
    rejectionReason: null,
    buildingType: 'health',
    featureList: [
      'UI Triagem Médica [Figma]',
      'Vídeo Consulta HD [WebRTC]',
      'Prontuário Cripto [Node.js]',
      'Agendamento Médico [APIs]',
      'Prescrição Digital QR [SQL]',
      'Conformidade LGPD [QA Clinic]',
    ],
  }
}

export function getAllStarterContracts(): Contract[] {
  return [
    makeFirstContract(),
    makeDeliveryContract(),
    makeEadContract(),
    makeFintechContract(),
    makeHealthContract(),
  ]
}

/* Placas de vídeo: a moeda premium do jogo */
export const STARTING_GPUS = 2
/** Placas extras dadas a todas as empresas (novas e salvas) */
export const GIFT_GPUS = 3
export const GPU_PRICE = 5_000
export const TURBO_DAYS = 5

/* Saves antigos recebem as placas extras uma única vez */
export function withGpuGift(state: GameState): GameState {
  return state.gpuGift ? state : { ...state, gpus: gpusOf(state) + GIFT_GPUS, gpuGift: true }
}

export function gpusOf(state: GameState) {
  return state.gpus ?? STARTING_GPUS
}

export function turboDaysLeft(state: GameState) {
  return Math.max(0, (state.turboUntil ?? 0) - state.day)
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
    gpus: STARTING_GPUS + GIFT_GPUS,
    gpuGift: true,
    revenue: 0,
    expenses: 0,
    profit: 0,
    weeklyBurn: Math.round(team.reduce((total, employee) => total + employee.salary, 0) / 4),
    employees: team,
    nextEmployeeId: team.length + 1,
    contracts: [],
    availableContracts: getAllStarterContracts(),
    nextContractId: 6,
    timeScale: 'paused',
    lastTick: Date.now(),
    daysRemainingAlert: false,
    currentScreen: 'overview',
    selectedProjectId: null,
    notifications: [{ id: uid(), type: 'info', message: 'Seus primeiros contratos estão disponíveis no mercado.', day: 1, read: false }],
    gameLog: [{ day: 1, message: `${company} iniciou com ${team.length} profissionais na equipe.` }],
  }
}

export function createProjectTasks(projectId: string): Task[] {
  const matchedKey = Object.keys(TASK_BLUEPRINTS_MAP).find(k => projectId.startsWith(k)) || 'first-contract'
  const blueprints = TASK_BLUEPRINTS_MAP[matchedKey] || TASK_BLUEPRINTS_MAP['first-contract']

  return blueprints.map(([id, name, technology, requiredRole, secondaryRole, complexity, estimatedDays, dependsOn]) => ({
    id: `${projectId}-${id}`,
    projectId,
    name,
    technology,
    description: `Desenvolver ${name} utilizando ${technology}. Papel ideal: ${requiredRole}.`,
    status: 'todo',
    complexity,
    requiredRole,
    secondaryRole,
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
  const maxValue = contract.originalValue * (1 + trust * 0.09 - attemptPenalty)
  const maxDeadline = contract.originalDeadlineDays + Math.floor(trust * 5) - contract.negotiationAttempts
  const valueTooHigh = value > maxValue
  const deadlineTooHigh = deadlineDays > maxDeadline
  const minAcceptableValue = contract.originalValue * 0.80
  const minAcceptableDeadline = Math.max(20, Math.floor(contract.originalDeadlineDays * 0.70))
  const accepted = !valueTooHigh && !deadlineTooHigh && value >= minAcceptableValue && deadlineDays >= minAcceptableDeadline
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

/** Salário diário da psicóloga da empresa */
export const PSYCHOLOGIST_DAILY = 200

export function dailyEmployeeCost(state: GameState) {
  const salaries = state.employees.reduce((total, employee) => total + employee.salary, 0)
  const psychologist = state.psychologist ? PSYCHOLOGIST_DAILY : 0
  return Math.round((salaries / 30 + 130 + psychologist) * DIFFICULTY_CONFIG[state.difficulty].dailyCostMultiplier)
}

/** Ajuste de ritmo: com 1, o primeiro contrato levava ~80 dias para um prazo de 45 */
export const WORK_PACE = 2

export function calculateTaskGain(
  workerOrProd: { productivity: number; speed: number; role?: Role } | number,
  taskOrSpeed: Task | number,
  complexityOrDiff: number | Difficulty,
  diffFallback?: Difficulty
) {
  // Suporte à assinatura rica com verificação de compatibilidade de tecnologia e papel
  if (typeof workerOrProd === 'object' && typeof taskOrSpeed === 'object') {
    const employee = workerOrProd
    const task = taskOrSpeed
    const difficulty = (complexityOrDiff as Difficulty) || 'normal'

    let roleMultiplier = 0.75 // Alocado fora da especialidade (ex: QA no Front)
    if (employee.role === task.requiredRole) {
      roleMultiplier = 1.35 // Cargo ideal para a tecnologia! Bônus de 35%
    } else if (task.secondaryRole && employee.role === task.secondaryRole) {
      roleMultiplier = 1.15 // Segundo cargo mais adequado
    } else if (employee.role === 'fullstack' && (task.requiredRole === 'frontend' || task.requiredRole === 'backend')) {
      roleMultiplier = 1.15 // Fullstack se adapta bem a front e back
    }

    const baseOutput = (employee.productivity * 0.55 + employee.speed * 0.45) / Math.max(3.5, task.complexity)
    const output = baseOutput * roleMultiplier * DIFFICULTY_CONFIG[difficulty].productivity * WORK_PACE
    return Math.max(4, Math.round(output))
  }

  // Assinatura legada
  const prod = Number(workerOrProd)
  const speed = Number(taskOrSpeed)
  const complexity = Number(complexityOrDiff)
  const diff = diffFallback || 'normal'
  const output = (prod * 0.55 + speed * 0.45) / Math.max(3.5, complexity)
  return Math.max(4, Math.round(output * DIFFICULTY_CONFIG[diff].productivity))
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
