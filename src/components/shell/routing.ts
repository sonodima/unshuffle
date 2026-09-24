// Pure screen routing rules (no React): which screen to show and its document.title.

import { t } from '../../i18n'
import type { Role } from '../../game/store'
import type { RoomState } from '../../game/types'

export type ScreenKey = 'home' | 'lobby' | 'round' | 'final'

interface ScreenSelectInput {
  role: Role
  room: Pick<RoomState, 'phase'> | null
}

/** Pure screen selection (exported for tests). */
export function selectScreen({ role, room }: ScreenSelectInput): ScreenKey {
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

/** Not translated. */
const BRAND = 'UNSHUFFLE'

/** document.title for a screen ("UNSHUFFLE · Lobby KXQPM"…), in the current language. */
export function screenTitle(screen: ScreenKey, room: Pick<RoomState, 'code' | 'phase' | 'settings'> | null, lost = false): string {
  if (lost && room) return t('shell.title.lost', { brand: BRAND })
  switch (screen) {
    case 'lobby':
      return room ? t('shell.title.lobbyRoom', { brand: BRAND, code: room.code }) : t('shell.title.lobby', { brand: BRAND })
    case 'round': {
      const phase = room?.phase
      if (!room || !phase || !('round' in phase)) return t('shell.title.round', { brand: BRAND })
      const params = { brand: BRAND, round: phase.round + 1, rounds: room.settings.rounds }
      if (phase.kind === 'reveal') return t('shell.title.roundReveal', params)
      if (phase.kind === 'preparing') return t('shell.title.roundPreparing', params)
      return t('shell.title.roundOf', params)
    }
    case 'final':
      return t('shell.title.final', { brand: BRAND })
    default:
      return BRAND
  }
}
