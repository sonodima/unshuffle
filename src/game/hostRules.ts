// Pure validation / sanitizing / scoring helpers used by HostGame. No side
// effects, no timers: everything here is safe to unit-test in isolation.

import type { CutPlan } from '../audio/analysis'
import { AVATARS, DEFAULT_SETTINGS, PLAYER_COLORS, SETTINGS_OPTIONS, isCutStyle } from './constants'
import { isMessageKey, t } from '../i18n'
import { sanitizeName } from './names'
import { isPermutation, isPlayerId } from './persist'
import { scoreArrangement } from './scoring'
import type {
  GameSettings,
  Phase,
  Player,
  PlayerId,
  PlayerProfile,
  PlaylistRef,
  RoundPublic,
  RoundResult,
  Segment,
  SubmissionStatus,
  TrackInfo,
} from './types'

export { isPermutation }

/** Shortest snippet we accept from the analysis (seconds). */
const MIN_SEGMENT_SEC = 0.4
/** Max gap/overlap tolerated between two analysis segments before they count as non-contiguous. */
const CONTIGUITY_EPS_SEC = 0.002

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

function isNonNegInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0
}

/** 1–64 URL-safe characters, taken as is (never trimmed: ' p-a' must not alias 'p-a'), no Object.prototype names. */
export function isValidPlayerId(x: unknown): x is PlayerId {
  return isPlayerId(x)
}

/** Clamp any value to a valid index of a list of `length` items (non-numbers → 0). */
export function clampIndex(value: unknown, length: number): number {
  if (!isFiniteNumber(value) || length <= 0) return 0
  return Math.min(length - 1, Math.max(0, Math.trunc(value)))
}

/** Trimmed, whitespace-collapsed, ≤ MAX_NAME_LENGTH; falls back to "Giocatore". */
export function cleanPlayerName(raw: unknown): string {
  return sanitizeName(raw) || t('game.host.defaultPlayer')
}

/** Sanitized copy of an untrusted profile, or null when the id is unusable. */
export function sanitizeProfile(raw: unknown): PlayerProfile | null {
  if (!isRecord(raw) || !isValidPlayerId(raw.id)) return null
  return {
    id: raw.id,
    name: cleanPlayerName(raw.name),
    avatar: clampIndex(raw.avatar, AVATARS.length),
    color: clampIndex(raw.color, PLAYER_COLORS.length),
  }
}

/** The option closest to `value` (ties → the smaller one); `fallback` when value isn't a number. */
function snapToOption(value: unknown, options: readonly number[], fallback: number): number {
  if (!isFiniteNumber(value) || options.length === 0) return fallback
  let best = options[0]
  for (const option of options) if (Math.abs(option - value) < Math.abs(best - value)) best = option
  return best
}

function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return ''
  const printable = Array.from(raw, (ch) => {
    const code = ch.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : ch
  }).join('')
  return Array.from(printable.replace(/\s+/g, ' ').trim()).slice(0, max).join('')
}

/** A sane PlaylistRef, null for an explicit null, undefined when the input is unusable. */
function sanitizePlaylist(raw: unknown): PlaylistRef | null | undefined {
  if (raw === null) return null
  if (!isRecord(raw)) return undefined
  const id = raw.id
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return undefined
  const playlist: PlaylistRef = {
    id,
    title: cleanText(raw.title, 120) || t('game.host.untitledPlaylist', { id: String(id) }),
    picture: typeof raw.picture === 'string' && raw.picture.length <= 2048 ? raw.picture : '',
    nbTracks: isNonNegInt(raw.nbTracks) ? raw.nbTracks : 0,
  }
  const creator = cleanText(raw.creator, 80)
  if (creator) playlist.creator = creator
  return playlist
}

/** Apply an untrusted settings patch: numbers snap to SETTINGS_OPTIONS, invalid values are ignored. */
export function applySettingsPatch(current: GameSettings, patch: unknown): GameSettings {
  if (!isRecord(patch)) return current
  const next: GameSettings = { ...current }
  if ('rounds' in patch) next.rounds = snapToOption(patch.rounds, SETTINGS_OPTIONS.rounds, current.rounds)
  if ('snippets' in patch) next.snippets = snapToOption(patch.snippets, SETTINGS_OPTIONS.snippets, current.snippets)
  if (isCutStyle(patch.cuts)) next.cuts = patch.cuts
  if ('roundTime' in patch) next.roundTime = snapToOption(patch.roundTime, SETTINGS_OPTIONS.roundTime, current.roundTime)
  if ('finalTimer' in patch) next.finalTimer = snapToOption(patch.finalTimer, SETTINGS_OPTIONS.finalTimer, current.finalTimer)
  if ('playlist' in patch) {
    const playlist = sanitizePlaylist(patch.playlist)
    if (playlist !== undefined) next.playlist = playlist
  }
  return next
}

/** Fully sanitized settings from untrusted input (restore), defaults for anything invalid. */
export function sanitizeSettings(raw: unknown): GameSettings {
  return applySettingsPatch({ ...DEFAULT_SETTINGS }, raw)
}

export function settingsEqual(a: GameSettings, b: GameSettings): boolean {
  return (
    a.rounds === b.rounds &&
    a.snippets === b.snippets &&
    a.cuts === b.cuts &&
    a.roundTime === b.roundTime &&
    a.finalTimer === b.finalTimer &&
    JSON.stringify(a.playlist) === JSON.stringify(b.playlist)
  )
}

export function isTrackInfo(x: unknown): x is TrackInfo {
  return (
    isRecord(x) &&
    typeof x.id === 'number' &&
    Number.isFinite(x.id) &&
    typeof x.title === 'string' &&
    typeof x.artist === 'string' &&
    typeof x.preview === 'string' &&
    x.preview.length > 0
  )
}

export function isRoundPublic(x: unknown): x is RoundPublic {
  if (!isRecord(x) || !isNonNegInt(x.index) || !isTrackInfo(x.track)) return false
  const segments = x.segments
  if (!Array.isArray(segments) || segments.length < 1) return false
  const n = segments.length
  return (
    segments.every((s, i) => isRecord(s) && s.index === i && isFiniteNumber(s.start) && isFiniteNumber(s.end)) &&
    isPermutation(x.initialOrder, n) &&
    Array.isArray(x.hues) &&
    x.hues.length === n &&
    isFiniteNumber(x.bpm)
  )
}

/** Validated copy of a phase from a snapshot (null when unusable). `roundCount` = tracks in the game. */
export function sanitizePhase(raw: unknown, roundCount: number): Phase | null {
  if (!isRecord(raw)) return null
  const round = raw.round
  const validRound = isNonNegInt(round) && round < Math.max(1, roundCount)
  switch (raw.kind) {
    case 'lobby':
      return { kind: 'lobby' }
    case 'final':
      return roundCount > 0 ? { kind: 'final' } : null
    case 'preparing':
      return validRound ? { kind: 'preparing', round, ...(isMessageKey(raw.message) ? { message: raw.message } : {}) } : null
    case 'intro':
      return validRound && roundCount > 0 && isFiniteNumber(raw.endsAt) ? { kind: 'intro', round, endsAt: raw.endsAt } : null
    case 'playing': {
      if (!validRound || roundCount === 0 || !isFiniteNumber(raw.startedAt) || !isFiniteNumber(raw.endsAt)) return null
      const fs = raw.firstSubmit
      const firstSubmit =
        isRecord(fs) && isValidPlayerId(fs.playerId) && isFiniteNumber(fs.at) ? { playerId: fs.playerId, at: fs.at } : null
      return { kind: 'playing', round, startedAt: raw.startedAt, endsAt: raw.endsAt, firstSubmit }
    }
    case 'reveal':
      if (!validRound || roundCount === 0) return null
      return { kind: 'reveal', round, nextAt: isFiniteNumber(raw.nextAt) ? raw.nextAt : null }
    default:
      return null
  }
}

function toSegments(parts: readonly { start: number; end: number; beats: number }[]): Segment[] {
  return parts.map((p, index) => ({ index, start: p.start, end: p.end, beats: p.beats }))
}

/**
 * Validate an analysis cut plan: exactly `n` contiguous segments, each at least
 * MIN_SEGMENT_SEC long, inside the buffer. Returns segments with `index = i` and
 * joins made exactly equal, or null when the plan is unusable.
 */
export function segmentsFromPlan(plan: unknown, n: number, duration: number): Segment[] | null {
  if (!isRecord(plan) || !Array.isArray(plan.segments) || plan.segments.length !== n || n < 1) return null
  const limit = (isFiniteNumber(duration) && duration > 0 ? duration : Infinity) + 0.05
  const parts: { start: number; end: number; beats: number }[] = []
  for (let i = 0; i < n; i++) {
    const s: unknown = plan.segments[i]
    if (!isRecord(s) || !isFiniteNumber(s.start) || !isFiniteNumber(s.end)) return null
    const start = i === 0 ? s.start : parts[i - 1].end
    if (i > 0 && Math.abs(s.start - start) > CONTIGUITY_EPS_SEC) return null
    if (start < 0 || s.end > limit || s.end - start < MIN_SEGMENT_SEC) return null
    parts.push({ start, end: s.end, beats: isFiniteNumber(s.beats) && s.beats >= 0 ? s.beats : 0 })
  }
  return toSegments(parts)
}

/** Last-resort equal-length cut of the whole buffer (null if it can't fit n snippets). */
export function uniformSegments(duration: number, n: number): Segment[] | null {
  if (!isFiniteNumber(duration) || n < 1 || duration / n < MIN_SEGMENT_SEC) return null
  const step = duration / n
  const parts = Array.from({ length: n }, (_, i) => ({ start: i * step, end: i === n - 1 ? duration : (i + 1) * step, beats: 0 }))
  for (let i = 1; i < n; i++) parts[i].start = parts[i - 1].end
  return toSegments(parts)
}

/** Tempo from a plan, rounded to 0.1 BPM, 0 when missing or implausible. */
export function planBpm(plan: CutPlan | unknown): number {
  const bpm = isRecord(plan) ? plan.bpm : 0
  return isFiniteNumber(bpm) && bpm > 0 && bpm < 400 ? Math.round(bpm * 10) / 10 : 0
}

/** Ranking inside a round: points desc, then faster confirm first, then player id for stability. */
function rankResults(results: readonly RoundResult[]): RoundResult[] {
  return [...results].sort((a, b) => b.points - a.points || a.timeMs - b.timeMs || (a.playerId < b.playerId ? -1 : 1))
}

export interface RoundScoringInput {
  players: readonly Player[]
  round: RoundPublic
  roundTimeMs: number
  submissions: Readonly<Record<PlayerId, SubmissionStatus>>
  /** Confirmed arrangements. */
  orders: ReadonlyMap<PlayerId, readonly number[]>
  /** Latest live arrangements (used for players who didn't confirm). */
  arrangements: ReadonlyMap<PlayerId, readonly number[]>
}

/**
 * Score every player active in this round. Confirmed players use their submitted
 * order; everyone else is `timedOut` with their last arrangement (or the initial
 * scramble) and the full round time.
 */
export function buildRoundResults(input: RoundScoringInput): RoundResult[] {
  const { round, roundTimeMs } = input
  const n = round.segments.length
  const out: RoundResult[] = []
  for (const player of input.players) {
    if (player.activeFromRound > round.index) continue
    const status = input.submissions[player.id]
    const submitted = status?.submitted === true
    const candidates = submitted ? [input.orders.get(player.id), input.arrangements.get(player.id)] : [input.arrangements.get(player.id)]
    const order = [...(candidates.find((o): o is readonly number[] => isPermutation(o, n)) ?? round.initialOrder)]
    const score = scoreArrangement(order, n)
    out.push({
      playerId: player.id,
      order,
      ...score,
      timeMs: submitted ? Math.min(roundTimeMs, Math.max(0, Math.round(status.atMs))) : roundTimeMs,
      timedOut: !submitted,
    })
  }
  return rankResults(out)
}
