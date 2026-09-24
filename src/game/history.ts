// Listening history: the songs this browser has heard in a game, kept as play counts
// that fade over time (a play weighs half after HISTORY_HALF_LIFE_DAYS). Each player
// sends a small digest to the host in `hello`; the host adds up the room's digests so
// the track picker can favour songs nobody at the table has heard lately.

import { loadHistoryRaw, saveHistoryRaw } from './persist'

/** A play weighs 1, then half after this many days, a quarter after twice as many… */
export const HISTORY_HALF_LIFE_DAYS = 30
const HALF_LIFE_MS = HISTORY_HALF_LIFE_DAYS * 86_400_000
/** Entries lighter than this (a single play ~5.6 half-lives ago) are forgotten. */
const FORGET_BELOW = 0.02
/** Stored entries, heaviest kept. */
const MAX_ENTRIES = 1000
/** Entries sent to the host: the most-heard songs are the ones that matter. */
export const DIGEST_MAX_ENTRIES = 400
/** Cap on a single song's weight in a peer's digest (untrusted input). */
const MAX_DIGEST_WEIGHT = 100
/** A second play this soon is the same play (a reload during the reveal, a reconnect). */
const SAME_PLAY_MS = 15 * 60_000

/** Play count of one track, as of `t` (ms). */
export interface HistoryEntry {
  w: number
  t: number
}

/** Track id (as a string: JSON object keys) → entry. */
export type History = Record<string, HistoryEntry>

/** Track id → faded play count, rounded. What a player shares with the host. */
export type HistoryDigest = Record<string, number>

const TRACK_ID = /^\d{1,15}$/

export function weightAt(entry: HistoryEntry, now: number): number {
  return entry.w * 0.5 ** (Math.max(0, now - entry.t) / HALF_LIFE_MS)
}

/** Drops faded entries and keeps the MAX_ENTRIES heaviest. */
export function pruneHistory(history: History, now: number): History {
  const live = Object.entries(history)
    .map(([id, e]) => [id, weightAt(e, now), e] as const)
    .filter(([, w]) => w >= FORGET_BELOW)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ENTRIES)
  return Object.fromEntries(live.map(([id, , e]) => [id, e]))
}

/** The history with one more play of `trackId` at `now`. */
export function withPlay(history: History, trackId: number, now: number): History {
  const key = String(trackId)
  const prev = history[key]
  if (prev && now - prev.t >= 0 && now - prev.t < SAME_PLAY_MS) return history
  return pruneHistory({ ...history, [key]: { w: (prev ? weightAt(prev, now) : 0) + 1, t: now } }, now)
}

export function toDigest(history: History, now: number, max = DIGEST_MAX_ENTRIES): HistoryDigest {
  const rows = Object.entries(history)
    .map(([id, e]) => [id, Math.round(weightAt(e, now) * 100) / 100] as const)
    .filter(([, w]) => w >= FORGET_BELOW)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
  return Object.fromEntries(rows)
}

/** Validates a digest received from a peer: numeric ids, finite weights in range, bounded size. */
export function sanitizeDigest(raw: unknown): HistoryDigest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: HistoryDigest = {}
  let n = 0
  for (const [id, w] of Object.entries(raw)) {
    if (n >= DIGEST_MAX_ENTRIES) break
    if (!TRACK_ID.test(id) || typeof w !== 'number' || !Number.isFinite(w) || w <= 0) continue
    out[id] = Math.min(w, MAX_DIGEST_WEIGHT)
    n++
  }
  return out
}

function parseHistory(raw: unknown): History {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: History = {}
  for (const [id, e] of Object.entries(raw)) {
    if (!TRACK_ID.test(id) || typeof e !== 'object' || e === null) continue
    const { w, t } = e as Partial<HistoryEntry>
    if (typeof w === 'number' && Number.isFinite(w) && w > 0 && typeof t === 'number' && Number.isFinite(t)) out[id] = { w, t }
  }
  return out
}

/** Remember that this browser heard `trackId` in a game. */
export function recordPlay(trackId: number, now = Date.now()): void {
  saveHistoryRaw(withPlay(parseHistory(loadHistoryRaw()), trackId, now))
}

/** This browser's digest, for `hello`. */
export function localDigest(now = Date.now()): HistoryDigest {
  return toDigest(parseHistory(loadHistoryRaw()), now)
}
