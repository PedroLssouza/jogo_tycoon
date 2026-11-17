import { uid } from './utils'
import type { Employee, Role } from './types'

const FIRST_NAMES = [
  'Ana','Bruno','Carla','Diego','Eduarda','Felipe','Gabriel','Helena','Igor','Juliana',
  'Laura','Matheus','Natália','Olavo','Paula','Rafael','Sabrina','Thiago','Valentina','Wallace',
  'Yasmin','Arthur','Breno','Camila','Daniel','Eduardo','Fernanda','Gustavo','Hugo','Isabela'
]
const LAST_NAMES = [
  'Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Almeida','Nascimento','Araújo',
  'Ferreira','Gomes','Ribeiro','Alves','Carvalho','Teixeira','Mendes','Barbosa','Rocha','Dias',
  'Nunes','Machado','Batista','Lima','Moura','Pinto','Castro','Macedo','Correia','Vieira'
]
const SPECIALIZATIONS: Record<string, string[]> = {
  frontend: ['React', 'Vue', 'Angular', 'CSS', 'TypeScript'],
  backend: ['Node.js', 'Python', 'Java', 'Go', 'C#', 'SQL'],
  fullstack: ['React + Node', 'Vue + Django', 'Full Stack'],
  designer: ['Figma', 'Adobe XD', 'UI Design', 'Prototyping'],
  qa: ['Automated Testing', 'Manual Testing', 'Selenium', 'Cypress'],
  pm: ['Agile', 'Scrum', 'Jira', 'Roadmapping'],
  devops: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux']
}

function pickName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
}

function baseStatsFor(role: Role, exp: number) {
  const base: Record<number, { productivity: number; speed: number; quality: number }> = {
    0: { productivity: 40, speed: 35, quality: 45 },
    1: { productivity: 55, speed: 50, quality: 60 },
    2: { productivity: 70, speed: 65, quality: 75 },
    3: { productivity: 85, speed: 80, quality: 88 },
    4: { productivity: 95, speed: 92, quality: 96 },
  }
  const tier = Math.min(4, Math.floor(exp / 25))
  const s = base[tier]
  const noise = (v: number) => Math.round(v + randFloat(-5, 5))
  return {
    productivity: noise(s.productivity),
    speed: noise(s.speed),
    quality: noise(s.quality),
  }
}

export function createEmployee(role: Role, experience = 0, salaryMul = 1): Employee {
  const baseSalary: Record<Role, number> = {
    frontend: 3500,
    backend: 3800,
    fullstack: 4500,
    designer: 3200,
    qa: 3000,
    pm: 5000,
    devops: 4200,
  }
  const stats = baseStatsFor(role, experience)
  return {
    id: uid(),
    name: pickName(),
    role,
    salary: Math.round(baseSalary[role] * salaryMul * (1 + experience / 100)),
    experience,
    productivity: stats.productivity,
    speed: stats.speed,
    quality: stats.quality,
    specialization: pick(SPECIALIZATIONS[role]),
    satisfaction: 70 + randInt(-10, 15),
    energy: 100,
    state: 'idle',
    currentTaskId: null,
    hiredAt: 0,
  }
}

export function createStarterTeam(): Employee[] {
  const team: Employee[] = []
  team.push(createEmployee('fullstack', 2, 1))
  team.push(createEmployee('frontend', 1, 1))
  team.push(createEmployee('backend', 1, 1))
  team.push(createEmployee('qa', 0, 1))
  team.push(createEmployee('pm', 1, 1))
  team.forEach(e => { e.hiredAt = 0 })
  return team
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}