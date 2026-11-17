import type { GameState } from './types'

const SAVE_KEY = 'projectTycoon_save_v1'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save game', e)
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GameState
  } catch (e) {
    console.error('Failed to load game', e)
    return null
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY)
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null
}