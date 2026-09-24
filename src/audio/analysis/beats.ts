// Dynamic-programming beat tracker (Ellis 2007): finds the beat sequence that
// maximises onset strength at beats while keeping inter-beat intervals close
// to the target period.

import { convolveSymmetric, gaussianKernel, maxIn, parabolicOffset } from './dsp'

interface BeatTrackOptions {
  /** Higher = stricter tempo (librosa default 100). */
  tightness?: number
  /**
   * Up to this frame a beat may start a fresh chain instead of linking to a
   * poor predecessor (default 2.5 periods): the excerpt starts mid-song, so
   * the first real beat must not pay for the missing ones before it.
   */
  freshUntil?: number
}

/** Onset envelope scaled to unit standard deviation (DP weights assume it). */
export function normalizeOnset(onset: Float32Array): Float32Array {
  let m = 0
  for (let i = 0; i < onset.length; i++) m += onset[i]
  m /= Math.max(1, onset.length)
  let v = 0
  for (let i = 0; i < onset.length; i++) v += (onset[i] - m) ** 2
  const s = Math.sqrt(v / Math.max(1, onset.length - 1)) || 1
  const out = new Float32Array(onset.length)
  for (let i = 0; i < onset.length; i++) out[i] = onset[i] / s
  return out
}

/** Gaussian-smoothed onset (σ = period / 32), the DP's local score. */
export function localScore(onsetNorm: Float32Array, period: number): Float32Array {
  const sigma = Math.max(0.75, period / 32)
  return convolveSymmetric(onsetNorm, gaussianKernel(sigma))
}

/**
 * Track beats over `local` (from `localScore`) with the given period (frames).
 * Returns beat positions in frames (fractional, peak-refined), increasing.
 */
export function trackBeats(local: Float32Array, period: number, opts: BeatTrackOptions = {}): number[] {
  const tightness = opts.tightness ?? 100
  const freshUntil = opts.freshUntil ?? 2.5 * period
  const n = local.length
  if (n < 4 || !(period > 1)) return []
  const minLag = Math.max(1, Math.round(period / 2))
  const maxLag = Math.max(minLag + 1, Math.round(2 * period))
  const penalty = new Float32Array(maxLag + 1)
  for (let d = minLag; d <= maxLag; d++) penalty[d] = -tightness * Math.log(d / period) ** 2

  let localMax = 0
  for (let i = 0; i < n; i++) if (local[i] > localMax) localMax = local[i]
  const cum = new Float32Array(n)
  const back = new Int32Array(n).fill(-1)
  let started = false
  for (let i = 0; i < n; i++) {
    let best = -Infinity
    let arg = -1
    const lo = Math.max(0, i - maxLag)
    const hi = i - minLag
    for (let j = lo; j <= hi; j++) {
      const v = cum[j] + penalty[i - j]
      if (v > best) {
        best = v
        arg = j
      }
    }
    if (!started && local[i] < 0.01 * localMax) {
      cum[i] = local[i]
      back[i] = -1
    } else {
      started = true
      if (arg >= 0 && (best > 0 || i > freshUntil)) {
        cum[i] = local[i] + best
        back[i] = arg
      } else {
        cum[i] = local[i]
      }
    }
  }

  // Last beat: the last local maximum of the cumulative score above half the
  // median of all local maxima.
  const maxima: number[] = []
  for (let i = 1; i < n - 1; i++) if (cum[i] > cum[i - 1] && cum[i] >= cum[i + 1]) maxima.push(i)
  if (!maxima.length) return []
  const vals = maxima.map((i) => cum[i]).sort((a, b) => a - b)
  const thr = 0.5 * vals[vals.length >> 1]
  let last = maxima[maxima.length - 1]
  for (let k = maxima.length - 1; k >= 0; k--) {
    if (cum[maxima[k]] >= thr) {
      last = maxima[k]
      break
    }
  }
  const beats: number[] = []
  for (let i = last; i >= 0; i = back[i]) {
    beats.push(i)
    if (back[i] < 0) break
  }
  beats.reverse()

  // Sub-frame refinement on the local score peak (±2 frames).
  return beats.map((b) => {
    let p = b
    const lo = Math.max(1, b - 2)
    const hi = Math.min(n - 2, b + 2)
    for (let j = lo; j <= hi; j++) if (local[j] > local[p]) p = j
    if (p <= 0 || p >= n - 1) return p
    return p + parabolicOffset(local[p - 1], local[p], local[p + 1])
  })
}

/**
 * Regularise a tracked sequence: extend it with period-spaced beats to cover
 * [from, to] (frames), dropping beats outside.
 */
export function extendGrid(beats: number[], period: number, from: number, to: number): number[] {
  if (!beats.length) return []
  const out = beats.filter((b) => b >= from - period * 0.25 && b <= to + period * 0.25)
  if (!out.length) return []
  // Local period estimate at each edge (median of the last few intervals).
  const edgePeriod = (xs: number[]): number => {
    if (xs.length < 2) return period
    const d = xs.slice(1).map((v, i) => v - xs[i]).sort((a, b) => a - b)
    return d[d.length >> 1]
  }
  const pStart = edgePeriod(out.slice(0, 5))
  const pEnd = edgePeriod(out.slice(-5))
  while (out[0] - pStart >= from - pStart * 0.25) out.unshift(out[0] - pStart)
  while (out[out.length - 1] + pEnd <= to + pEnd * 0.25) out.push(out[out.length - 1] + pEnd)
  return out
}

/** Median inter-beat interval. */
function medianInterval(beats: number[]): number {
  if (beats.length < 2) return 0
  const d = beats.slice(1).map((v, i) => v - beats[i]).sort((a, b) => a - b)
  return d[d.length >> 1]
}

/**
 * Largest phase slip, in periods: the biggest accumulated deviation from the
 * median interval over any run of up to 5 intervals. A tracker that jumps to
 * the off-beats shows ≈0.5; steady tracking stays below ≈0.15.
 */
export function slipAmount(beats: number[]): number {
  const med = medianInterval(beats)
  if (!(med > 0)) return 0
  let worst = 0
  for (let i = 1; i < beats.length; i++) {
    let acc = 0
    for (let k = i; k < Math.min(beats.length, i + 5); k++) {
      acc += beats[k] - beats[k - 1] - med
      const a = Math.abs(acc)
      if (a > worst) worst = a
    }
  }
  return worst / med
}

/** Drops a first / last beat whose interval to its neighbour is off by more than 15%. */
export function trimEdgeOutliers(beats: number[]): number[] {
  const med = medianInterval(beats)
  if (beats.length < 6 || !(med > 0)) return beats
  const out = beats.slice()
  if (Math.abs(out[1] - out[0] - med) > 0.15 * med) out.shift()
  const k = out.length - 1
  if (Math.abs(out[k] - out[k - 1] - med) > 0.15 * med) out.pop()
  return out
}

/**
 * The DP is least reliable at the edges of the excerpt, where it has no
 * context on one side: re-derive leading / trailing beats from the first
 * (last) run of 4 steady intervals, snapping each to a local-score peak
 * within ±1.5 frames when there is one.
 */
export function regularizeEdges(beats: number[], local: Float32Array): number[] {
  const med = medianInterval(beats)
  const n = beats.length
  if (n < 8 || !(med > 0)) return beats
  const steady = (i: number): boolean => {
    for (let k = i; k < i + 4; k++) if (Math.abs(beats[k + 1] - beats[k] - med) > 0.06 * med) return false
    return true
  }
  const snap = (x: number): number => {
    const c = Math.round(x)
    let p = c
    for (let j = Math.max(1, c - 1); j <= Math.min(local.length - 2, c + 1); j++) if (local[j] > local[p]) p = j
    const isPeak = p > 0 && p < local.length - 1 && local[p] >= local[p - 1] && local[p] >= local[p + 1]
    return isPeak && Math.abs(p - x) <= 1.5 ? p + parabolicOffset(local[p - 1], local[p], local[p + 1]) : x
  }
  const out = beats.slice()
  let s = 0
  while (s + 4 < n && !steady(s)) s++
  if (s > 0 && s + 4 < n) {
    const step = (out[s + 4] - out[s]) / 4
    for (let i = s - 1; i >= 0; i--) out[i] = snap(out[i + 1] - step)
  }
  let e = n - 5
  while (e > s && !steady(e)) e--
  if (e < n - 5 && e > s) {
    const step = (out[e + 4] - out[e]) / 4
    for (let i = e + 5; i < n; i++) out[i] = snap(out[i - 1] + step)
  }
  return out
}

/** Mean of the max of `env` within ±radius frames around each position. */
export function strengthAt(env: Float32Array, positions: number[], radius = 1.5): number {
  if (!positions.length) return 0
  let s = 0
  for (const p of positions) s += maxIn(env, p - radius, p + radius)
  return s / positions.length
}
