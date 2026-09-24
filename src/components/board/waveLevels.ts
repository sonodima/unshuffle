// Waveform bar heights on a loudness scale shared by every block of a track.
//
// Modern masters are so compressed that linear RMS/peak (normalised to the track
// max) sits at 50–80% for the whole preview: every block looked like the same
// full-height comb. Instead each bar is its bin's level in dB, placed between the
// track's own quiet (p5) and loud (p99.5) bins and curved (γ 1.6). Still honest —
// louder is taller, on one scale per track — but verses, drops and breaks now read.
//
// Track-wide stats come from one fine pass (5 ms bins) per buffer; the stats for a
// block's bin duration are aggregated from it (exact RMS / max combination), so a
// board of 16 blocks costs a single extra pass over the samples.
import type { Peaks } from '../../audio/peaks'
import type { PeaksFn } from './boardAudio'

/** dB range the bars are mapped onto (levels relative to the track's peak sample). */
export interface LevelRange {
  lo: number
  hi: number
}

export interface TrackLevels {
  rms: LevelRange
  max: LevelRange
}

export const LEVEL_GAMMA = 1.6
/** Shortest bar, as a fraction of the full height (silence still shows a dot). */
export const LEVEL_FLOOR = 0.06
const MIN_DB = -100
/** Never stretch less than this many dB over the full height (no noise blow-up on flat masters). */
const MIN_SPAN_DB = 6
/** Never compress more than this many dB into the full height (digital silence would flatten everything). */
const MAX_SPAN_DB = 36
const LO_PCT = 0.05
const HI_PCT = 0.995
const FINE_SEC = 0.005
/** Fades at the ends of a preview are left out of the statistics. */
const TRIM_SEC = 0.5

export function toDb(v: number): number {
  return v > 0 ? Math.max(MIN_DB, 20 * Math.log10(v)) : MIN_DB
}

/** p-quantile (0..1) of an ascending-sorted array (nearest rank). */
export function quantile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length
  if (!n) return 0
  return sorted[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))]
}

/** dB range of linear levels (0..1): track quiet/loud percentiles with guard rails. */
export function levelRange(values: ArrayLike<number>, loP = LO_PCT, hiP = HI_PCT): LevelRange {
  const db = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) db[i] = toDb(values[i])
  db.sort()
  let hi = quantile(db, hiP)
  let lo = quantile(db, loP)
  if (!Number.isFinite(hi) || hi <= MIN_DB) return { lo: -MIN_SPAN_DB, hi: 0 }
  if (!Number.isFinite(lo)) lo = hi - MAX_SPAN_DB
  lo = Math.max(lo, hi - MAX_SPAN_DB)
  if (hi - lo < MIN_SPAN_DB) {
    // Nearly constant loudness: centre a minimal span on it.
    const mid = (hi + lo) / 2
    lo = mid - MIN_SPAN_DB / 2
    hi = mid + MIN_SPAN_DB / 2
  }
  return { lo, hi }
}

/** Bar height 0..1 for a linear level on the track's range. */
export function mapLevel(v: number, r: LevelRange, gamma = LEVEL_GAMMA, floor = LEVEL_FLOOR): number {
  const t = (toDb(v) - r.lo) / Math.max(1e-3, r.hi - r.lo)
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t
  return Math.max(floor, Math.pow(c, gamma))
}

/** Combine `factor` consecutive fine bins into one (RMS by mean square, peak by max). */
export function aggregate(fine: Peaks, factor: number, from = 0, to = fine.rms.length): { rms: Float32Array; max: Float32Array } {
  const k = Math.max(1, Math.floor(factor))
  const a = Math.max(0, Math.floor(from))
  const z = Math.min(fine.rms.length, Math.max(a, Math.floor(to)))
  const count = Math.max(0, Math.floor((z - a) / k))
  const rms = new Float32Array(count)
  const max = new Float32Array(count)
  for (let b = 0; b < count; b++) {
    let sq = 0
    let m = 0
    for (let i = a + b * k, e = i + k; i < e; i++) {
      const r = fine.rms[i]
      sq += r * r
      if (fine.max[i] > m) m = fine.max[i]
    }
    rms[b] = Math.sqrt(sq / k)
    max[b] = m
  }
  return { rms, max }
}

interface CacheEntry {
  fine: Peaks
  fineSec: number
  byFactor: Map<number, TrackLevels>
}
const cache = new WeakMap<PeaksFn, WeakMap<AudioBuffer, CacheEntry>>()

/**
 * Track-wide level ranges for bars of `binSec` seconds (the block's bin duration),
 * cached per (peaks function, buffer, bin factor). Null when the buffer is unusable.
 */
export function trackLevels(buffer: AudioBuffer, binSec: number, peaksFn: PeaksFn): TrackLevels | null {
  const dur = buffer.duration
  if (!(dur > 0) || !(binSec > 0)) return null
  let perFn = cache.get(peaksFn)
  if (!perFn) {
    perFn = new WeakMap()
    cache.set(peaksFn, perFn)
  }
  let entry = perFn.get(buffer)
  if (!entry) {
    const bins = Math.max(1, Math.round(dur / FINE_SEC))
    const fine = peaksFn(buffer, 0, dur, bins)
    if (!fine || !fine.rms?.length) return null
    entry = { fine, fineSec: dur / fine.rms.length, byFactor: new Map() }
    perFn.set(buffer, entry)
  }
  const factor = Math.max(1, Math.round(binSec / entry.fineSec))
  const hit = entry.byFactor.get(factor)
  if (hit) return hit
  const total = entry.fine.rms.length
  const trim = dur > TRIM_SEC * 8 ? Math.round(TRIM_SEC / entry.fineSec) : 0
  const agg = aggregate(entry.fine, factor, trim, total - trim)
  const src = agg.rms.length >= 8 ? agg : aggregate(entry.fine, factor)
  const levels: TrackLevels = { rms: levelRange(src.rms), max: levelRange(src.max) }
  entry.byFactor.set(factor, levels)
  return levels
}

export interface BarHeights {
  /** Bright core (RMS), 0..1 of the full height. */
  core: Float32Array
  /** Soft envelope behind it (peaks), never below the core. */
  halo: Float32Array
}

/** Bar heights for one block's peaks on the track's scale. */
export function barHeights(peaks: Peaks, levels: TrackLevels): BarHeights {
  const n = peaks.rms.length
  const core = new Float32Array(n)
  const halo = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const c = mapLevel(peaks.rms[i], levels.rms)
    core[i] = c
    halo[i] = Math.max(c, mapLevel(peaks.max[i], levels.max))
  }
  return { core, halo }
}

/** The previous linear mapping, kept for placeholders and as a fallback. */
export function linearHeights(peaks: Peaks): BarHeights {
  const n = peaks.max.length
  const core = new Float32Array(n)
  const halo = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    halo[i] = Math.pow(Math.min(1, Math.max(0, peaks.max[i])), 0.8)
    core[i] = Math.pow(Math.min(1, Math.max(0, peaks.rms[i] * 1.9)), 0.8)
  }
  return { core, halo }
}
