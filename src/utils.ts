import { v4 as uuid } from 'uuid'

export function uid(): string {
  return uuid()
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

export function formatMoney(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}R$ ${(abs / 1e3).toFixed(0)}k`
  return `${sign}R$ ${Math.floor(abs).toLocaleString('pt-BR')}`
}

export function daysToMonthsDays(d: number): string {
  const m = Math.floor(d / 30)
  const days = d % 30
  return `${m}m ${days}d`
}