// Decoder-independent cut boundaries.
//
// The host computes a CutPlan on ITS decode of the preview, and every peer
// plays the same boundary times on its own decode. MP3 decoders do not agree
// on where the audio starts: WebKit (CoreAudio) trims the decoder delay that
// Chrome keeps, so on an iPhone the same music sits 529 source samples (12 ms)
// earlier. The host places every cut a few milliseconds before an attack, and
// that pre-roll is often shorter than 12 ms — so on such a peer a snippet would
// start just after its downbeat and the previous one would end with the start
// of the next attack.
//
// realignSegments() re-derives the boundaries from the peer's own buffer:
// each host cut is re-snapped against the local audio, the shift that most
// boundaries agree on is taken as the decoder offset, and the boundaries move
// by it (consistent ones land exactly on the local quiet point before their
// attack). When the decoders agree — or the evidence is weak or inconsistent,
// e.g. a uniform fallback cut that was never snapped — the input comes back
// unchanged (same array), so it is a no-op on the host and on peers with the
// host's decoder. Only playback times change: segment identity and order (and
// therefore scoring) are untouched.

import { getMono } from '../peaks'
import { snapToAttack } from './snap'

export interface TimeSpan {
  start: number
  end: number
}

interface CutAlignment {
  /** Boundaries on the local decode (same length as the input). */
  cuts: number[]
  /** Local time − host time of the same music (s); 0 when unchanged. */
  offset: number
  /** Boundaries that agreed on the offset / boundaries with a clear attack. */
  agree: number
  strong: number
  /** False when the input was kept as is. */
  changed: boolean
}

/**
 * Where the re-snap looks for the attack, relative to the host cut: first just
 * after it (the host pre-roll is 1–30 ms), then earlier / later for decoders
 * that disagree by more than a few ms.
 */
const LOOK_AHEADS_SEC = [0.015, -0.008, 0.038]
/** A boundary votes when the re-snap found a real attack (snap's own threshold). */
const MIN_STRENGTH_DB = 3
/** Votes within this distance of each other agree (1 ms blocks + sample search). */
const AGREE_SEC = 0.0015
/** Offsets below this are treated as "same decoder" (sub-millisecond block noise). */
const MIN_OFFSET_SEC = 0.0015
/** Largest decoder disagreement handled (encoder delay + decoder delay ≈ 25 ms). */
const MAX_OFFSET_SEC = 0.03
const MIN_VOTES = 3
/** Share of all boundaries that must agree on the offset. */
const MIN_AGREE_SHARE = 0.4
const MIN_GAP_SEC = 0.05

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

interface Pass {
  local: number[]
  cluster: number[]
  voters: number[]
  offset: number
}

/** Re-snap every cut with the search centred `lookAhead` after it and find the dominant shift. */
function pass(x: Float32Array, sr: number, cuts: readonly number[], lookAhead: number): Pass {
  const duration = x.length / sr
  const local: number[] = []
  const voters: number[] = []
  for (let i = 0; i < cuts.length; i++) {
    const c = cuts[i]
    const s = snapToAttack(x, sr, Math.min(duration, Math.max(0, c + lookAhead)))
    local.push(s.time)
    if (s.strengthDb >= MIN_STRENGTH_DB && Math.abs(s.time - c) <= MAX_OFFSET_SEC + AGREE_SEC) voters.push(i)
  }
  const shift = (i: number): number => local[i] - cuts[i]
  // The offset is the mode of the votes: a decoder offset moves every attack by
  // the same amount, while misdetections scatter.
  let cluster: number[] = []
  for (const i of voters) {
    const near = voters.filter((j) => Math.abs(shift(j) - shift(i)) <= AGREE_SEC)
    if (near.length > cluster.length) cluster = near
  }
  return { local, cluster, voters, offset: cluster.length ? median(cluster.map(shift)) : 0 }
}

/**
 * Align host boundary times (seconds, increasing) to the local mono signal `x`.
 * Pure and deterministic.
 */
export function alignCuts(x: Float32Array, sr: number, cuts: readonly number[]): CutAlignment {
  const unchanged = (strong = 0, agree = 0): CutAlignment => ({ cuts: cuts.slice(), offset: 0, agree, strong, changed: false })
  const duration = sr > 0 ? x.length / sr : 0
  if (!(duration > 0) || cuts.length < MIN_VOTES || cuts.some((c) => !Number.isFinite(c))) return unchanged()

  // Re-snap every host cut on the local audio. On the host's own decode this
  // lands on the very same sample; on a shifted decode, on the same attack's
  // quiet point shifted by the decoder offset. The search is centred just
  // after the cut (where the host's attack is); for large offsets the attack
  // may sit outside the favoured zone, so two more centres are tried and the
  // most unanimous pass wins (ties keep the first).
  let best: Pass | null = null
  for (const la of LOOK_AHEADS_SEC) {
    const p = pass(x, sr, cuts, la)
    if (!best || p.cluster.length > best.cluster.length) best = p
  }
  if (!best) return unchanged()
  const { local, cluster, voters, offset } = best
  const shift = (i: number): number => local[i] - cuts[i]
  const strong = voters.length
  const agree = cluster.length
  if (agree < MIN_VOTES || agree < MIN_AGREE_SHARE * cuts.length) return unchanged(strong, agree)
  if (Math.abs(offset) < MIN_OFFSET_SEC || Math.abs(offset) > MAX_OFFSET_SEC) return unchanged(strong, agree)
  // A rival cluster nearly as large means the evidence is ambiguous.
  const rest = voters.filter((i) => Math.abs(shift(i) - offset) > 2 * AGREE_SEC)
  let rival = 0
  for (const i of rest) rival = Math.max(rival, rest.filter((j) => Math.abs(shift(j) - shift(i)) <= AGREE_SEC).length)
  if (rival * 2 > agree) return unchanged(strong, agree)

  const ok = new Set(cluster.filter((i) => Math.abs(shift(i) - offset) <= AGREE_SEC))
  const out: number[] = []
  for (let i = 0; i < cuts.length; i++) {
    // Agreeing boundaries take their exact local quiet point; the others move by the common offset.
    let t = ok.has(i) ? local[i] : cuts[i] + offset
    t = Math.min(duration, Math.max(0, Math.round(t * sr) / sr))
    if (i > 0 && t < out[i - 1] + MIN_GAP_SEC) t = Math.min(duration, out[i - 1] + MIN_GAP_SEC)
    out.push(t)
  }
  // Keep the invariants of the input: strictly increasing, inside the buffer.
  for (let i = 1; i < out.length; i++) if (!(out[i] > out[i - 1])) return unchanged(strong, agree)
  return { cuts: out, offset, agree, strong, changed: true }
}

/** Aligned boundary times per buffer, keyed by the host boundary times (null = unchanged). */
const cutCache = new WeakMap<AudioBuffer, Map<string, number[] | null>>()
/** Last result per input array, so repeated calls return the same array (stable React deps). */
const resultCache = new WeakMap<readonly TimeSpan[], { buffer: AudioBuffer; result: readonly TimeSpan[] }>()

function alignedCutsFor(buffer: AudioBuffer, cuts: number[]): number[] | null {
  const key = cuts.join(',')
  let byKey = cutCache.get(buffer)
  if (byKey?.has(key)) return byKey.get(key) ?? null
  const a = alignCuts(getMono(buffer), buffer.sampleRate, cuts)
  if (!byKey) {
    byKey = new Map()
    cutCache.set(buffer, byKey)
  }
  if (byKey.size >= 32) byKey.clear()
  byKey.set(key, a.changed ? a.cuts : null)
  return a.changed ? a.cuts : null
}

/**
 * Contiguous segments (the host's plan) re-aligned to this peer's decode of
 * the same preview. Returns the SAME array when nothing needs to move, else
 * shallow copies with new `start` / `end` (every other field kept; joins stay
 * exactly contiguous). Cached per (buffer, boundary times) and per input
 * array; cheap (≈ 1 ms for 16 snippets) and never throws.
 */
export function realignSegments<T extends TimeSpan>(buffer: AudioBuffer | null | undefined, segments: readonly T[]): readonly T[] {
  try {
    if (!buffer || !Array.isArray(segments) || segments.length < 2) return segments
    const memo = resultCache.get(segments)
    if (memo && memo.buffer === buffer) return memo.result as readonly T[]
    let result: readonly T[] = segments
    let contiguous = true
    for (let i = 1; i < segments.length; i++) if (segments[i].start !== segments[i - 1].end) contiguous = false
    if (contiguous) {
      const cuts = segments.map((s) => s.start).concat(segments[segments.length - 1].end)
      const aligned = alignedCutsFor(buffer, cuts)
      if (aligned) result = segments.map((s, i) => ({ ...s, start: aligned[i], end: aligned[i + 1] }))
    }
    resultCache.set(segments, { buffer, result })
    return result
  } catch {
    return segments
  }
}
