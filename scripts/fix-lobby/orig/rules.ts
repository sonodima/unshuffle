import { INTRO_MS, REVEAL_AUTO_ADVANCE_MS } from '../../game/constants'
import type { GameSettings } from '../../game/types'

/** Upper bound of a game's length in minutes (every round played to the buzzer). */
export function estimateMinutes(s: Pick<GameSettings, 'rounds' | 'roundTime'>): number {
  const perRound = s.roundTime * 1000 + INTRO_MS + REVEAL_AUTO_ADVANCE_MS
  return Math.max(1, Math.round((s.rounds * perRound) / 60000))
}
