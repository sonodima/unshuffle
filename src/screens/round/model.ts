// Pure helpers shared by the round views (no React, no store): everything the
// HUD derives from RoomState lives here so it can be unit-tested headless.
import { formatList, t } from '../../i18n'
import { SNIPPET_DIFFICULTY } from '../../game/constants'
import { compareStanding } from '../../game/standing'
import type { RankKey } from '../../game/standing'
import type { Phase, Player, PlayerId, RoomState, RoundPublic, TrackInfo } from '../../game/types'

export interface RoundInfo {
  /** 0-based round index. */
  index: number
  /** 1-based number shown to players. */
  number: number
  /** Rounds in this game. */
  total: number
  isLast: boolean
  /** Snippet count (prepared round wins over settings). */
  snippets: number
  /** Round duration in seconds. */
  roundTimeSec: number
  /** Final timer (after the first confirm) in seconds. */
  finalTimerSec: number
  /** Difficulty name in the current language ('' when unknown). */
  difficulty: string
  data: RoundPublic | null
  track: TrackInfo | null
}

export function roundInfo(room: RoomState, index: number): RoundInfo {
  const data = room.rounds[index] ?? null
  const total = Math.max(1, room.settings.rounds, index + 1)
  const snippets = data?.segments.length || room.settings.snippets
  return {
    index,
    number: index + 1,
    total,
    isLast: index >= total - 1,
    snippets,
    roundTimeSec: room.settings.roundTime,
    finalTimerSec: room.settings.finalTimer,
    difficulty: SNIPPET_DIFFICULTY[snippets] ? t(SNIPPET_DIFFICULTY[snippets]) : '',
    data,
    track: data?.track ?? room.tracks[index] ?? null,
  }
}

/** Late joiners spectate until `activeFromRound`. */
export function isActiveIn(player: Player | null | undefined, round: number): boolean {
  return !!player && player.activeFromRound <= round
}

export function findPlayer(room: RoomState, id: PlayerId | null | undefined): Player | undefined {
  return id ? room.players.find((p) => p.id === id) : undefined
}

/** Players taking part in `round`, in join order. */
export function activePlayers(room: RoomState, round: number): Player[] {
  return room.players.filter((p) => isActiveIn(p, round))
}

export function hasSubmitted(room: RoomState, id: PlayerId): boolean {
  return room.submissions[id]?.submitted === true
}

/** Connected active players (other than `me`) who still have to confirm. */
export function waitingPlayers(room: RoomState, round: number, me: PlayerId): Player[] {
  return activePlayers(room, round).filter((p) => p.id !== me && p.connected && !hasSubmitted(room, p.id))
}

/** Active players whose audio for the round is decoded (room.ready). */
export function readyCount(room: RoomState, round: number): { ready: number; total: number } {
  const players = activePlayers(room, round).filter((p) => p.connected)
  return { ready: players.filter((p) => room.ready[p.id]).length, total: players.length }
}

export function isPermutation(order: readonly number[] | null | undefined, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n) return false
  const seen = new Uint8Array(n)
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen[v]) return false
    seen[v] = 1
  }
  return true
}

/** The order to show on the board: my arrangement when it fits this round, else the initial shuffle. */
export function boardOrder(arrangement: readonly number[] | null | undefined, initialOrder: readonly number[], n: number): number[] {
  if (isPermutation(arrangement, n)) return arrangement
  if (isPermutation(initialOrder, n)) return initialOrder
  return Array.from({ length: n }, (_, i) => i)
}

/** Full ring for the timer: the round length (the ring visibly jumps when the final timer kicks in). */
export function roundTotalMs(room: RoomState, phase: Extract<Phase, { kind: 'playing' }>): number {
  const configured = room.settings.roundTime * 1000
  const firstSubmitAt = phase.firstSubmit?.at
  // Before any confirm, endsAt - startedAt is the true length (covers host-side overrides).
  const natural = firstSubmitAt == null ? phase.endsAt - phase.startedAt : 0
  return Math.max(1000, configured, natural)
}

/** Seconds granted to everyone after the first confirm (≤ finalTimer if time was already short). */
export function finalWindowSec(phase: Extract<Phase, { kind: 'playing' }>): number | null {
  if (!phase.firstSubmit) return null
  return Math.max(1, Math.ceil((phase.endsAt - phase.firstSubmit.at) / 1000))
}

/** Sum of confirmation times over the rounds played so far (the leaderboards' tie-breaker). */
export function totalTimes(room: Pick<RoomState, 'results'>): Map<PlayerId, number> {
  const time = new Map<PlayerId, number>()
  for (const round of room.results) {
    for (const r of round ?? []) time.set(r.playerId, (time.get(r.playerId) ?? 0) + (Number.isFinite(r.timeMs) ? r.timeMs : 0))
  }
  return time
}

/**
 * 1-based standing, like every leaderboard (game/standing compareStanding): score desc,
 * then more rounds played, then lower total confirmation time; players equal on all
 * three share the rank.
 */
export function rankOf(room: Pick<RoomState, 'players' | 'results'>, id: PlayerId): number {
  const me = room.players.find((p) => p.id === id)
  if (!me) return 0
  const time = totalTimes(room)
  const played = new Map<PlayerId, number>()
  for (const round of room.results) for (const r of round ?? []) played.set(r.playerId, (played.get(r.playerId) ?? 0) + 1)
  const keyOf = (p: Player): RankKey => ({ score: p.score, roundsPlayed: played.get(p.id) ?? 0, totalTimeMs: time.get(p.id) ?? 0 })
  const mine = keyOf(me)
  return 1 + room.players.filter((p) => compareStanding(keyOf(p), mine) < 0).length
}

/** Same arrangement position by position. */
export function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** A list of names in the current language: "Giulia", "Giulia e Marco", "Giulia, Marco e Sofi". */
export function joinNames(names: readonly string[]): string {
  return formatList(names)
}
