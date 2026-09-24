// Reveal fixtures on top of src/dev/fixtures.ts: earlier rounds with different
// results (so the leaderboard actually reshuffles) and any snippet count.
import { fxPlayers, fxReveal, fxRound, fxTrack } from './room'
import { scoreArrangement } from '../../src/game/scoring'
import type { RoomState, RoundPublic, RoundResult, Segment } from '../../src/game/types'

function past(playerId: string, points: number, timeMs: number): RoundResult {
  return { playerId, order: [], correct: 0, pairs: 0, points, perfect: points === 5000, timeMs, timedOut: false }
}

function scored(playerId: string, order: number[], timeMs: number, timedOut = false): RoundResult {
  const s = scoreArrangement(order, order.length)
  return { playerId, order, ...s, timeMs, timedOut }
}

const EARLIER: RoundResult[][] = [
  [past('p-3', 4200, 38000), past('p-host', 2600, 52000), past('p-2', 2400, 61000), past('p-4', 3800, 47000)],
  [past('p-3', 3900, 44000), past('p-host', 3300, 50000), past('p-2', 2600, 58000), past('p-4', 2300, 90000)],
]

function segmentsFor(n: number): Segment[] {
  if (n === fxRound.segments.length) return fxRound.segments
  const a = 1.1
  const len = (28.6 - a) / n
  return Array.from({ length: n }, (_, i) => ({ index: i, start: a + i * len, end: a + (i + 1) * len, beats: 0 }))
}

/** Deterministic derangement-ish scramble (no correct positions for these n). */
function scramble(n: number): number[] {
  if (n === fxRound.initialOrder.length) return fxRound.initialOrder
  const step = n % 3 === 0 ? 5 : 3
  return Array.from({ length: n }, (_, p) => (p * step + 2) % n)
}

function huesFor(n: number): number[] {
  if (n === fxRound.hues.length) return fxRound.hues
  const base = Array.from({ length: n }, (_, i) => Math.round((17 + (i * 360) / n) % 360))
  // Fixed shuffle so hues never follow the order.
  return base.map((_, i) => base[(i * 7 + 3) % n])
}

function swapped(n: number, pairs: [number, number][]): number[] {
  const o = Array.from({ length: n }, (_, i) => i)
  for (const [a, b] of pairs) [o[a], o[b]] = [o[b], o[a]]
  return o
}

export interface RevealFixtureOptions {
  n?: number
  /** Make this the last round of the game. */
  last?: boolean
  /** Auto-advance (default) or wait for the host. */
  auto?: boolean
  /** ms offset of nextAt relative to FX_NOW (default +20 s, i.e. 5 s into the reveal). */
  nextIn?: number
  now: number
}

export function revealFixture({ n = 8, last = false, auto = true, nextIn = 20_000, now }: RevealFixtureOptions): RoomState {
  const round = last ? 4 : 2
  const segments = segmentsFor(n)
  const initialOrder = scramble(n)
  const data: RoundPublic = { ...fxRound, index: round, segments, initialOrder, hues: huesFor(n) }
  const mid = Math.floor(n / 2)
  const current: RoundResult[] = [
    scored('p-2', Array.from({ length: n }, (_, i) => i), 41200),
    scored('p-host', swapped(n, [[mid - 1, mid]]), 55800),
    scored('p-3', swapped(n, [[0, 1], [mid, n - 1], [mid + 1, n - 2]]), 71000),
    scored('p-4', initialOrder, 90000, true),
  ]
  const results: RoundResult[][] = []
  for (let r = 0; r < round; r++) results.push(EARLIER[r % EARLIER.length])
  results.push(current)
  const totals = new Map<string, number>()
  for (const rs of results) for (const r of rs) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.points)
  const rounds: (RoundPublic | null)[] = Array.from({ length: round + 1 }, (_, i) => (i === round ? data : null))
  return {
    ...fxReveal,
    players: fxPlayers.map((p) => ({ ...p, score: totals.get(p.id) ?? 0 })),
    settings: { ...fxReveal.settings, snippets: n, rounds: 5 },
    tracks: [fxTrack, fxTrack, fxTrack, fxTrack, fxTrack],
    rounds,
    results,
    phase: { kind: 'reveal', round, nextAt: auto ? now + nextIn : null },
  }
}
