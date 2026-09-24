// Pure screen routing rules (no React): which screen to show and its document.title.

import type { Role } from '../../game/store'
import type { RoomState } from '../../game/types'
import type { RouteName } from '../../lib/router'

export type ScreenKey = 'home' | 'lobby' | 'round' | 'final' | 'styleguide'

export interface ScreenSelectInput {
  route: RouteName
  role: Role
  room: Pick<RoomState, 'phase'> | null
}

/** Pure screen selection (exported for tests). */
export function selectScreen({ route, role, room }: ScreenSelectInput): ScreenKey {
  if (route === 'styleguide') return 'styleguide'
  if (role === 'none' || !room) return 'home'
  switch (room.phase.kind) {
    case 'lobby':
      return 'lobby'
    case 'preparing':
    case 'intro':
    case 'playing':
    case 'reveal':
      return 'round'
    case 'final':
      return 'final'
    default:
      return 'home'
  }
}

const BRAND = 'UNSHUFFLE'

/** document.title for a screen ("UNSHUFFLE · Lobby KXQPM"…). */
export function screenTitle(screen: ScreenKey, room: Pick<RoomState, 'code' | 'phase' | 'settings'> | null, lost = false): string {
  if (lost && room) return `${BRAND} · Connessione persa`
  switch (screen) {
    case 'styleguide':
      return `${BRAND} · Styleguide`
    case 'lobby':
      return room ? `${BRAND} · Lobby ${room.code}` : `${BRAND} · Lobby`
    case 'round': {
      const phase = room?.phase
      if (!room || !phase || !('round' in phase)) return `${BRAND} · Round`
      const base = `${BRAND} · Round ${phase.round + 1}/${room.settings.rounds}`
      if (phase.kind === 'reveal') return `${base} · Risultati`
      if (phase.kind === 'preparing') return `${base} · Preparazione`
      return base
    }
    case 'final':
      return `${BRAND} · Classifica finale`
    default:
      return BRAND
  }
}

