// Frame-level features from a mono signal: log-mel spectral flux onset
// envelopes (full band + low band, any band on demand), loudness, coarse
// timbre bands and chroma. Everything downstream (tempo, beats, downbeats, novelty,
// cuts) is computed from these.

import { createRealFft, hann } from './fft'
import { dbPow } from './dsp'

export interface Features {
  rate: number
  hop: number
  /** Onset-envelope frames per second. */
  fps: number
  frames: number
  /**
   * Seconds to add to `frame / fps` to get the physical time of an onset
   * detected at that frame (flux is measured across a lag of a few frames).
   */
  onsetShift: number
  /** SuperFlux-style onset strength, mean over all mel bands (log domain). */
  onset: Float32Array
  /** Flux of the 30–150 Hz bands (kick drum / bass attacks). */
  low: Float32Array
  /** Frame loudness in dB (time-domain RMS). */
  rmsDb: Float32Array
  /** Low band (30–150 Hz) energy in dB. */
  lowDb: Float32Array
  /** frames × timbreBands mean mel dB, row-major. */
  timbre: Float32Array
  timbreBands: number
  /** chromaFrames × 12 chroma energy, row-major. */
  chroma: Float32Array
  chromaFrames: number
  chromaFps: number
  /** frames × MEL_BANDS log-mel spectrogram (dB), row-major. */
  mel: Float32Array
  /** Center frequency (Hz) of each mel band. */
  melCenters: Float32Array
  /** Leading frames whose flux is an artefact of the excerpt start (zeroed). */
  leadFrames: number
}

/** SuperFlux restricted to the mel bands whose centers lie in [loHz, hiHz). */
export function bandFlux(f: Features, loHz: number, hiHz: number): Float32Array {
  const nb = f.melCenters.length
  const bands: number[] = []
  for (let b = 0; b < nb; b++) if (f.melCenters[b] >= loHz && f.melCenters[b] < hiHz) bands.push(b)
  const out = new Float32Array(f.frames)
  if (!bands.length) return out
  for (let t = FLUX_LAG; t < f.frames; t++) {
    const row = t * nb
    const prev = (t - FLUX_LAG) * nb
    let s = 0
    for (const b of bands) {
      let ref = f.mel[prev + b]
      if (b > 0 && f.mel[prev + b - 1] > ref) ref = f.mel[prev + b - 1]
      if (b < nb - 1 && f.mel[prev + b + 1] > ref) ref = f.mel[prev + b + 1]
      const d = f.mel[row + b] - ref
      if (d > 0) s += d
    }
    out[t] = s / bands.length
  }
  const lead = Math.min(f.frames, Math.ceil(f.leadFrames))
  for (let t = 0; t < lead; t++) out[t] = 0
  return out
}

const MEL_BANDS = 64
const TIMBRE_BANDS = 16
const FLUX_LAG = 1
const DB_RANGE = 80
/**
 * Measured on ~40 real previews: the flux peak precedes the start of the
 * sample-level energy rise by ≈9 ms (the Hann window "sees" the attack early).
 */
const ONSET_LATENCY_SEC = 0.009

function hzToMel(f: number): number {
  return 2595 * Math.log10(1 + f / 700)
}
function melToHz(m: number): number {
  return 700 * (10 ** (m / 2595) - 1)
}

interface Band {
  lo: number
  weights: Float32Array
  center: number
}

function melFilterbank(nfft: number, rate: number, bands: number, fmin: number, fmax: number): Band[] {
  const binHz = rate / nfft
  const mlo = hzToMel(fmin)
  const mhi = hzToMel(fmax)
  const edges: number[] = []
  for (let i = 0; i < bands + 2; i++) edges.push(melToHz(mlo + ((mhi - mlo) * i) / (bands + 1)))
  const out: Band[] = []
  for (let b = 0; b < bands; b++) {
    const f0 = edges[b]
    const f1 = edges[b + 1]
    const f2 = edges[b + 2]
    let lo = Math.max(1, Math.floor(f0 / binHz))
    let hi = Math.min(nfft / 2, Math.ceil(f2 / binHz))
    const w: number[] = []
    for (let k = lo; k <= hi; k++) {
      const f = k * binHz
      const v = f <= f1 ? (f - f0) / Math.max(1e-9, f1 - f0) : (f2 - f) / Math.max(1e-9, f2 - f1)
      w.push(Math.max(0, v))
    }
    // Narrow low bands can fall between bins: fall back to the nearest bin.
    if (!w.some((v) => v > 0)) {
      lo = hi = Math.min(nfft / 2, Math.max(1, Math.round(f1 / binHz)))
      w.length = 0
      w.push(1)
    }
    out.push({ lo, weights: Float32Array.from(w), center: f1 })
  }
  return out
}

function pow2Near(v: number): number {
  return 2 ** Math.round(Math.log2(Math.max(64, v)))
}

export function computeFeatures(x: Float32Array, rate: number): Features {
  const nfft = pow2Near(rate * 0.0464)
  // ≈86 frames/s: plenty for beat tracking; cuts are refined on raw samples.
  const hop = nfft >> 2
  const frames = Math.max(1, Math.floor(x.length / hop) + 1)
  const fps = rate / hop
  const half = nfft >> 1
  const win = hann(nfft)
  const fft = createRealFft(nfft)
  const bins = half + 1
  const fmax = Math.min(rate / 2, 11025)
  const bank = melFilterbank(nfft, rate, MEL_BANDS, 30, fmax)

  const mel = new Float32Array(frames * MEL_BANDS)
  const frame = new Float32Array(nfft)
  const spec = new Float32Array(bins)
  const n = x.length
  let melMax = 1e-12

  for (let t = 0; t < frames; t++) {
    const start = t * hop - half
    if (start >= 0 && start + nfft <= n) {
      for (let i = 0; i < nfft; i++) frame[i] = x[start + i] * win[i]
    } else {
      for (let i = 0; i < nfft; i++) {
        const j = start + i
        frame[i] = j >= 0 && j < n ? x[j] * win[i] : 0
      }
    }
    fft.power(frame, spec)
    const row = t * MEL_BANDS
    for (let b = 0; b < MEL_BANDS; b++) {
      const band = bank[b]
      let s = 0
      const w = band.weights
      for (let k = 0; k < w.length; k++) s += spec[band.lo + k] * w[k]
      mel[row + b] = s
      if (s > melMax) melMax = s
    }
  }

  // Log compression with a fixed dynamic range below the loudest band.
  const floor = dbPow(melMax) - DB_RANGE
  for (let i = 0; i < mel.length; i++) {
    const d = dbPow(mel[i])
    mel[i] = d < floor ? floor : d
  }

  const onset = new Float32Array(frames)
  const low = new Float32Array(frames)
  const lowDb = new Float32Array(frames)
  const isLow = bank.map((b) => b.center < 150)
  const lowCount = isLow.filter(Boolean).length
  const lowBands: number[] = []
  bank.forEach((b, i) => {
    if (b.center >= 30 && b.center < 150) lowBands.push(i)
  })

  for (let t = 0; t < frames; t++) {
    const row = t * MEL_BANDS
    let e = 0
    for (const b of lowBands) e += 10 ** (mel[row + b] / 10)
    lowDb[t] = dbPow(e)
    if (t < FLUX_LAG) continue
    const prev = (t - FLUX_LAG) * MEL_BANDS
    let s = 0
    let sl = 0
    for (let b = 0; b < MEL_BANDS; b++) {
      // SuperFlux: compare against the max of the neighbouring bands in the
      // reference frame, which suppresses vibrato / pitch glides.
      let ref = mel[prev + b]
      if (b > 0 && mel[prev + b - 1] > ref) ref = mel[prev + b - 1]
      if (b < MEL_BANDS - 1 && mel[prev + b + 1] > ref) ref = mel[prev + b + 1]
      const d = mel[row + b] - ref
      if (d > 0) {
        s += d
        if (isLow[b]) sl += d
      }
    }
    onset[t] = s / MEL_BANDS
    low[t] = lowCount ? sl / lowCount : 0
  }

  // The abrupt start of the excerpt (against zero padding) is not an onset.
  const lead = Math.min(frames, Math.ceil(half / hop) + 1)
  for (let t = 0; t < lead; t++) onset[t] = low[t] = 0

  // Coarse timbre bands for the self-similarity matrix.
  const per = MEL_BANDS / TIMBRE_BANDS
  const timbre = new Float32Array(frames * TIMBRE_BANDS)
  for (let t = 0; t < frames; t++) {
    for (let g = 0; g < TIMBRE_BANDS; g++) {
      let s = 0
      for (let b = g * per; b < (g + 1) * per; b++) s += mel[t * MEL_BANDS + b]
      timbre[t * TIMBRE_BANDS + g] = s / per
    }
  }

  // Loudness from the time domain (prefix sums of x^2).
  const sq = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) sq[i + 1] = sq[i] + x[i] * x[i]
  const rmsDb = new Float32Array(frames)
  for (let t = 0; t < frames; t++) {
    const lo = Math.max(0, t * hop - half)
    const hi = Math.min(n, t * hop + half)
    rmsDb[t] = hi > lo ? dbPow((sq[hi] - sq[lo]) / (hi - lo)) : -120
  }

  const chromaData = computeChroma(x, rate)

  return {
    rate,
    hop,
    fps,
    frames,
    onsetShift: -((FLUX_LAG / 2) * hop) / rate + ONSET_LATENCY_SEC,
    onset,
    low,
    rmsDb,
    lowDb,
    timbre,
    timbreBands: TIMBRE_BANDS,
    chroma: chromaData.chroma,
    chromaFrames: chromaData.frames,
    chromaFps: chromaData.fps,
    mel,
    melCenters: Float32Array.from(bank.map((b) => b.center)),
    leadFrames: lead,
  }
}

/** Chroma from a long-window STFT (≈186 ms) for usable pitch resolution. */
function computeChroma(x: Float32Array, rate: number): { chroma: Float32Array; frames: number; fps: number } {
  const nfft = pow2Near(rate * 0.186)
  const hop = nfft >> 1
  const half = nfft >> 1
  const frames = Math.max(1, Math.floor(x.length / hop) + 1)
  const win = hann(nfft)
  const fft = createRealFft(nfft)
  const bins = half + 1
  const binHz = rate / nfft
  const pc = new Int8Array(bins).fill(-1)
  for (let k = 1; k < bins; k++) {
    const f = k * binHz
    if (f < 100 || f > 5000) continue
    const midi = 69 + 12 * Math.log2(f / 440)
    pc[k] = ((Math.round(midi) % 12) + 12) % 12
  }
  const chroma = new Float32Array(frames * 12)
  const frame = new Float32Array(nfft)
  const spec = new Float32Array(bins)
  const n = x.length
  for (let t = 0; t < frames; t++) {
    const start = t * hop - half
    for (let i = 0; i < nfft; i++) {
      const j = start + i
      frame[i] = j >= 0 && j < n ? x[j] * win[i] : 0
    }
    fft.power(frame, spec)
    const row = t * 12
    for (let k = 1; k < bins; k++) {
      const c = pc[k]
      if (c >= 0) chroma[row + c] += Math.sqrt(spec[k])
    }
  }
  return { chroma, frames, fps: rate / hop }
}
