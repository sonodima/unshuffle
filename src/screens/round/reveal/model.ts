// Pure derivations + choreography timing for the round reveal. No React, no DOM:
// everything here is unit-testable.

import { MAX_ROUND_POINTS, POSITION_WEIGHT } from '../../../game/constants'
import { computeRoundStandings } from '../../../game/selectors'
import type { RoundStanding } from '../../../game/selectors'
import type { PlayerId, RoomState, RoundPublic, RoundResult, TrackInfo } from '../../../game/types'

export type RevealMark = 'correct' | 'wrong'

/** What the local viewer gets to see about themselves. */
export type RevealMode =
  /** Played the round: full personal choreography. */
  | 'player'
  /** Late joiner (activeFromRound > round): song + leaderboard only. */
  | 'spectator'
  /** Active but the host has no result for them (e.g. dropped mid-round). */
  | 'missing'

export interface ScoreBreakdown {
  n: number
  correct: number
  pairs: number
  /** Points from exact positions (rounded so that position + pair === points). */
  positionPoints: number
  pairPoints: number
  points: number
  perfect: boolean
  timedOut: boolean
  timeMs: number
}

export interface LeaderRow extends RoundStanding {
  /** Did not play this round (joined late). */
  spectator: boolean
  /** Best points of the round (ties included), only when > 0. */
  top: boolean
  /** Sanitized arrangement for the mini strip (null without a result). */
  order: number[] | null
  marks: RevealMark[] | null
}

export interface RevealModel {
  round: number
  totalRounds: number
  isLast: boolean
  track: TrackInfo
  /** Null only if the round data never reached this peer. */
  data: RoundPublic | null
  n: number
  mode: RevealMode
  me: PlayerId
  /** My submitted arrangement (sanitized permutation), or null. */
  myOrder: number[] | null
  /** Per POSITION of `myOrder`. */
  myMarks: RevealMark[] | null
  breakdown: ScoreBreakdown | null
  /** Rows sorted by rank after this round. */
  rows: LeaderRow[]
  /** Player ids ordered by the ranking BEFORE this round (for the reshuffle animation). */
  prevOrder: PlayerId[]
  myRow: LeaderRow | undefined
}

/** A valid permutation of 0..n-1, or null. */
export function sanitizeOrder(order: readonly number[] | null | undefined, n: number): number[] | null {
  if (!order || order.length !== n) return null
  const seen = new Uint8Array(n)
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen[v]) return null
    seen[v] = 1
  }
  return [...order]
}

export function marksFor(order: readonly number[]): RevealMark[] {
  return order.map((seg, pos) => (seg === pos ? 'correct' : 'wrong'))
}

/** Which arrangement the reveal board shows. */
export type BoardView = 'mine' | 'correct'

/**
 * Marks per POSITION of the correct order: the blocks the player got right keep
 * their ✓, the misplaced ones are neutral (this IS the right order, nothing in
 * it is wrong) and carry an "era Nº" label instead (see `boardLabels`).
 */
export function sortedViewMarks(order: readonly number[]): (RevealMark | null)[] {
  return Array.from({ length: order.length }, (_, p) => (order[p] === p ? 'correct' : null))
}

/**
 * Small per-POSITION labels for the misplaced blocks of `view`:
 * - 'correct' (board sorted): where the player had put that snippet, "era 5º";
 * - 'mine' (the player's arrangement): where the snippet belongs, "→ 3º".
 * Null for blocks in the right place.
 */
export function boardLabels(order: readonly number[], view: BoardView): (string | null)[] {
  const n = order.length
  if (view === 'correct') {
    return Array.from({ length: n }, (_, p) => {
      if (order[p] === p) return null
      const was = order.indexOf(p)
      return was >= 0 ? `era ${was + 1}º` : null
    })
  }
  return order.map((seg, p) => (seg === p || seg < 0 || seg >= n ? null : `→ ${seg + 1}º`))
}

/** Per-POSITION segment index shown by `view` (the board's `order`). */
export function boardOrderFor(order: readonly number[], view: BoardView): number[] {
  return view === 'correct' ? Array.from({ length: order.length }, (_, i) => i) : [...order]
}

/** Index of the segment playing at `t` seconds of the song, or -1 (before / after / between). */
export function segmentAt(segments: readonly { start: number; end: number }[] | null | undefined, t: number): number {
  if (!segments || !Number.isFinite(t)) return -1
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (t >= s.start && t < s.end) return i
  }
  return -1
}

export function breakdownOf(result: RoundResult, n: number): ScoreBreakdown {
  const positionPoints = result.perfect ? Math.round(MAX_ROUND_POINTS * POSITION_WEIGHT) : Math.round((result.correct / n) * MAX_ROUND_POINTS * POSITION_WEIGHT)
  const positionShare = Math.min(result.points, positionPoints)
  return {
    n,
    correct: result.correct,
    pairs: result.pairs,
    positionPoints: positionShare,
    pairPoints: Math.max(0, result.points - positionShare),
    points: result.points,
    perfect: result.perfect,
    timedOut: result.timedOut,
    timeMs: result.timeMs,
  }
}

export function buildRevealModel(room: RoomState, me: PlayerId): RevealModel | null {
  if (room.phase.kind !== 'reveal') return null
  const round = room.phase.round
  const data = room.rounds[round] ?? null
  const track = data?.track ?? room.tracks[round]
  if (!track) return null
  const n = data?.segments.length ?? room.settings.snippets
  const results = room.results[round] ?? []
  const totalRounds = Math.max(room.settings.rounds, round + 1)

  const standings = computeRoundStandings(room, round)
  const best = results.reduce((m, r) => Math.max(m, r.points), 0)
  const rows: LeaderRow[] = standings.map((s) => {
    const order = s.result ? sanitizeOrder(s.result.order, n) : null
    return {
      ...s,
      spectator: !s.result && s.player.activeFromRound > round,
      top: !!s.result && best > 0 && s.result.points === best,
      order,
      marks: order ? marksFor(order) : null,
    }
  })
  const prevOrder = [...rows]
    .sort((a, b) => a.prevRank - b.prevRank || a.rank - b.rank)
    .map((r) => r.player.id)

  const myRow = rows.find((r) => r.player.id === me)
  const myResult = myRow?.result
  const myOrder = myResult && data ? sanitizeOrder(myResult.order, n) : null
  const player = room.players.find((p) => p.id === me)
  const mode: RevealMode = myResult && myOrder ? 'player' : !player || player.activeFromRound > round ? 'spectator' : 'missing'

  return {
    round,
    totalRounds,
    isLast: round >= room.settings.rounds - 1,
    track,
    data,
    n,
    mode,
    me,
    myOrder: mode === 'player' ? myOrder : null,
    myMarks: mode === 'player' && myOrder ? marksFor(myOrder) : null,
    breakdown: mode === 'player' && myResult ? breakdownOf(myResult, n) : null,
    rows,
    prevOrder,
    myRow,
  }
}

// ---- choreography ------------------------------------------------------------

/** Milliseconds after mount at which each beat of the reveal starts. */
export interface RevealTimeline {
  /** Board (my arrangement) appears. */
  board: number
  /** One entry per POSITION: when its ✓/✗ pops. */
  marks: number[]
  /** Blocks slide into the correct order. */
  sort: number
  /** Points start counting. */
  score: number
  scoreDurationS: number
  /** Leaderboard rows enter (previous ranking). */
  lead: number
  /** Leaderboard reshuffles into the new ranking, totals count up. */
  ranks: number
  /** Everything settled. */
  done: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function buildTimeline(n: number, personal: boolean): RevealTimeline {
  if (!personal || n <= 0) {
    return { board: 0, marks: [], sort: 0, score: 0, scoreDurationS: 0, lead: 650, ranks: 1350, done: 2500 }
  }
  const interval = clamp(Math.round(1600 / n), 90, 200)
  const first = 850
  const marks = Array.from({ length: n }, (_, i) => first + i * interval)
  const sort = first + n * interval + 320
  const score = sort + 380
  const scoreDurationS = 1.3
  const lead = score + 750
  const ranks = lead + 700
  const settle = sort + 640 + 38 * (n - 1)
  return { board: 380, marks, sort, score, scoreDurationS, lead, ranks, done: Math.max(settle, ranks + 1200) }
}

/** Major-scale steps so a run of correct snippets climbs like a melody. */
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12]

/**
 * Pitch for the k-th consecutive correct mark (0-based) on a board of n: the
 * melody climbs one scale step per mark up to 8 snippets and is spread out on
 * bigger boards, so a perfect run always lands on (at most) the octave.
 */
export function streakPitch(streak: number, n = 8): number {
  const step = Math.floor((Math.max(0, streak) * 8) / Math.max(8, n))
  return Math.pow(2, SCALE[Math.min(step, 7)] / 12)
}

/** For each position: the streak index if correct (0-based), or -1 if wrong. */
export function streaks(marks: readonly RevealMark[]): number[] {
  let run = 0
  return marks.map((m) => {
    if (m !== 'correct') {
      run = 0
      return -1
    }
    return run++
  })
}

// ---- layout ---------------------------------------------------------------------

/**
 * Height (px) that makes fitGrid pick the play-screen column count at `width`.
 * Blocks are a little taller than fitGrid's ideal (like the play screen) so the
 * waveforms read; the container may still cap the height.
 */
export function boardHeightFor(n: number, width: number): number {
  const phone = width < 560
  const cols = n <= 6 ? Math.min(3, n) : Math.min(4, n)
  const rows = Math.ceil(n / cols)
  const gap = phone ? (n >= 12 ? 7 : 9) : width < 900 ? 12 : 14
  const w = Math.min((width - gap * (cols - 1)) / cols, phone ? 260 : 300)
  const aspect = phone ? 1.02 : 1.18
  const h = Math.min(w / aspect, phone ? 230 : 236)
  return Math.ceil(rows * Math.floor(h) + (rows - 1) * gap + 2)
}

// ---- copy -----------------------------------------------------------------------

export function verdictFor(b: ScoreBreakdown): string {
  if (b.perfect) return 'Sequenza perfetta!'
  const share = b.points / MAX_ROUND_POINTS
  if (share >= 0.8) return 'Quasi perfetta!'
  if (share >= 0.55) return 'Bell’orecchio!'
  if (share >= 0.3) return 'Ci sei quasi…'
  if (b.points > 0) return 'Serve un altro ascolto'
  return 'Nessuno spezzone al posto giusto'
}

export function pairsLabel(pairs: number): string {
  return pairs === 1 ? 'coppia in sequenza' : 'coppie in sequenza'
}

const secondsFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 55800 → "55,8 s" */
export function formatSeconds(ms: number): string {
  return `${secondsFmt.format(Math.max(0, ms) / 1000)} s`
}

/** 1 → "1º" */
export function ordinal(rank: number): string {
  return `${rank}º`
}

/** Seconds (ceil) until the host's auto-advance, or null when there is none. */
export function secondsUntil(nextAt: number | null, now: number): number | null {
  if (nextAt == null) return null
  return Math.max(0, Math.ceil((nextAt - now) / 1000))
}

/**
 * A reveal that is already well under way (reconnect / refresh): show the end
 * state straight away instead of replaying the whole choreography.
 */
export function shouldSkipChoreography(nextAt: number | null, now: number, autoAdvanceMs: number): boolean {
  if (nextAt == null) return false
  return nextAt - now < autoAdvanceMs - 9000
}

/** Points with a thousands dot even for 4 digits ("3.571", "10.000"), unlike it-IT's default. */
export function formatPoints(n: number): string {
  const v = Math.round(n)
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return v < 0 ? `-${s}` : s
}

/** 72.4 → "1:12" */
export function formatClockS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export interface RoundStats {
  /** Average points of the players who played. */
  average: number
  perfect: number
  fastest: { name: string; timeMs: number } | null
}

export function roundStats(rows: readonly LeaderRow[]): RoundStats | null {
  const played = rows.filter((r) => r.result)
  if (!played.length) return null
  // "Più veloce" = fastest confirm that scored: an instant confirm of a board with
  // nothing in place isn't speed (same rule as the final screen's Fulmine award).
  let fastest: RoundStats['fastest'] = null
  for (const r of played) {
    const res = r.result!
    if (!res.timedOut && res.points > 0 && (!fastest || res.timeMs < fastest.timeMs)) fastest = { name: r.player.name, timeMs: res.timeMs }
  }
  return {
    average: played.reduce((sum, r) => sum + (r.result?.points ?? 0), 0) / played.length,
    perfect: played.filter((r) => r.result?.perfect).length,
    fastest,
  }
}
