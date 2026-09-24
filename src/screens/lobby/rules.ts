import { INTRO_MS, REVEAL_AUTO_ADVANCE_MS, SETTINGS_OPTIONS } from '../../game/constants'
import type { GameSettings, PlaylistRef } from '../../game/types'

/** Upper bound of a game's length in minutes (every round played to the buzzer). */
export function estimateMinutes(s: Pick<GameSettings, 'rounds' | 'roundTime'>): number {
  const perRound = s.roundTime * 1000 + INTRO_MS + REVEAL_AUTO_ADVANCE_MS
  return Math.max(1, Math.round((s.rounds * perRound) / 60000))
}

/** Italian noun for a track count: 1 → "brano", anything else → "brani". */
export function tracksWord(n: number): string {
  return n === 1 ? 'brano' : 'brani'
}

/** Fewest rounds a game can have: a playlist shorter than this can never be played. */
export const MIN_ROUNDS: number = Math.min(...SETTINGS_OPTIONS.rounds)

export interface PlaylistShortfall {
  /** Tracks the playlist has (Deezer's count, previews not checked yet). */
  have: number
  /** Tracks the current round count needs (one per round). */
  need: number
  /** Largest round option the playlist could fill, or null when even the smallest is too many. */
  fitRounds: number | null
}

/**
 * Known-too-short playlist for the chosen round count, else null. Deezer's
 * `nbTracks` is an upper bound (some tracks may lack a preview), so this only
 * catches the certain failures; the host still checks the real previews.
 */
export function playlistShortfall(playlist: PlaylistRef | null, rounds: number): PlaylistShortfall | null {
  if (!playlist || !Number.isFinite(playlist.nbTracks) || playlist.nbTracks <= 0) {
    // 0 / unknown: Deezer sometimes omits the count; let the host decide.
    return null
  }
  const have = Math.floor(playlist.nbTracks)
  if (have >= rounds) return null
  const fits = SETTINGS_OPTIONS.rounds.filter((r) => r <= have)
  return { have, need: rounds, fitRounds: fits.length ? Math.max(...fits) : null }
}
