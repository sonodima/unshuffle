// Tempo salience from the onset envelope: autocorrelation evaluated through a
// comb of integer multiples of each candidate period, weighted by a
// log-Gaussian prior around 120 BPM. Octave (metrical level) decisions are
// taken later in the pipeline with beat-level evidence.

import { movingAverage, sampleAt } from './dsp'

export const MIN_BPM = 58
export const MAX_BPM = 205

export interface TempoCandidate {
  bpm: number
  /** Beat period in onset frames (fractional). */
  period: number
  /** Comb salience normalised so the best candidate = 1. */
  salience: number
  /** Log-Gaussian prior weight (1 at 120 BPM). */
  prior: number
}

export interface TempoAnalysis {
  /** Normalised autocorrelation of the (high-passed) onset envelope. */
  acf: Float32Array
  bpms: Float32Array
  /** Raw comb salience per bpm. */
  salience: Float32Array
  /** Candidates sorted by salience × prior, best first. */
  candidates: TempoCandidate[]
  /** Peak-to-median ratio of the weighted salience (periodicity strength). */
  peakiness: number
}

export function tempoPrior(bpm: number): number {
  const o = Math.log2(bpm / 120) / 0.9
  return Math.exp(-0.5 * o * o)
}

/** Onset envelope with the slow baseline removed, half-wave rectified. */
export function highpassOnset(onset: Float32Array, fps: number): Float32Array {
  const base = movingAverage(onset, Math.max(1, Math.round(fps * 0.25)))
  const out = new Float32Array(onset.length)
  for (let i = 0; i < onset.length; i++) out[i] = Math.max(0, onset[i] - base[i])
  return out
}

export function analyzeTempo(onset: Float32Array, fps: number, from = 0, to = onset.length): TempoAnalysis {
  const o = highpassOnset(onset.subarray(from, to), fps)
  const len = o.length
  const maxLag = Math.min(len - 1, Math.ceil((4 * 60 * fps) / MIN_BPM) + 2)
  const acf = new Float32Array(Math.max(1, maxLag + 1))
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0
    for (let t = 0; t + lag < len; t++) s += o[t] * o[t + lag]
    acf[lag] = s / Math.max(1, len - lag)
  }
  const r0 = acf[0] || 1
  for (let i = 0; i < acf.length; i++) acf[i] /= r0

  // Log-spaced bpm grid, ~0.05% steps (sub-frame period resolution).
  const steps = Math.ceil(Math.log(MAX_BPM / MIN_BPM) / Math.log(1.0005))
  const bpms = new Float32Array(steps + 1)
  const salience = new Float32Array(steps + 1)
  const weighted = new Float32Array(steps + 1)
  for (let i = 0; i <= steps; i++) {
    const bpm = MIN_BPM * 1.0005 ** i
    const period = (60 * fps) / bpm
    let s = 0
    let wsum = 0
    for (let k = 1; k <= 4; k++) {
      const lag = k * period
      if (lag >= acf.length - 1) break
      const w = 1 / (1 + 0.25 * (k - 1))
      s += w * Math.max(0, sampleAt(acf, lag))
      wsum += w
    }
    bpms[i] = bpm
    salience[i] = wsum ? s / wsum : 0
    weighted[i] = salience[i] * tempoPrior(bpm)
  }

  // Local maxima of the weighted salience.
  const peaks: number[] = []
  for (let i = 1; i < steps; i++) {
    if (weighted[i] >= weighted[i - 1] && weighted[i] > weighted[i + 1]) peaks.push(i)
  }
  peaks.sort((a, b) => weighted[b] - weighted[a])
  const best = peaks.length ? salience[peaks[0]] : 0
  const candidates: TempoCandidate[] = []
  for (const i of peaks) {
    if (candidates.length >= 8) break
    // Skip near-duplicates (within 2%).
    if (candidates.some((c) => Math.abs(Math.log(c.bpm / bpms[i])) < 0.02)) continue
    candidates.push({
      bpm: bpms[i],
      period: (60 * fps) / bpms[i],
      salience: best > 0 ? salience[i] / best : 0,
      prior: tempoPrior(bpms[i]),
    })
  }
  const sortedW = Float32Array.from(weighted).sort()
  const med = sortedW[sortedW.length >> 1] || 1e-9
  const peakiness = peaks.length ? weighted[peaks[0]] / med : 0
  return { acf, bpms, salience, candidates, peakiness }
}

/** Salience of an arbitrary bpm (interpolated from the grid). */
export function salienceAt(t: TempoAnalysis, bpm: number): number {
  if (bpm < MIN_BPM || bpm > MAX_BPM) return 0
  const x = Math.log(bpm / MIN_BPM) / Math.log(1.0005)
  // Best value within ±1% to tolerate grid/estimation offsets.
  const r = Math.ceil(Math.log(1.01) / Math.log(1.0005))
  let m = 0
  for (let i = Math.max(0, Math.floor(x) - r); i <= Math.min(t.salience.length - 1, Math.ceil(x) + r); i++) {
    if (t.salience[i] > m) m = t.salience[i]
  }
  return m
}
