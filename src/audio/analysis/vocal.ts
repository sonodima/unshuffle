// "Don't chop a sung note": a cheap centre-panned sustained-harmonic track.
//
// Lead vocals sit in the middle of the stereo image and are tonal and
// sustained; drums are transient and cymbals / pads are usually wide. Per STFT
// bin (250–4000 Hz, ≈11 kHz rate, 46 ms window, 23 ms hop) the mid-channel
// magnitude is weighted by how centred the bin is (coherence from mid vs side
// power) and
// clipped to its running temporal median (±70 ms), which removes attacks and
// keeps held notes. A cut is "through" a note when that energy is loud just
// before and just after the cut with no dip at it — the moment a singer holds
// a vowel across the bar line. Mono input (no side) simply skips the centre
// weighting. Costs ≈ 2 small STFTs + one median pass (≈ 20 ms for 30 s).

import { createRealFft, hann } from './fft'
import { clamp, decimate, percentile } from './dsp'

export interface CentreHarmonic {
  /** Frames per second; frame f is centred at f / fps seconds. */
  fps: number
  /** Bins per frame in `sus`. */
  bins: number
  /** Per bin: how many neighbouring bins count as the same pitch (vibrato). */
  tol: Uint8Array
  /** Sustained centred power per frame and bin (frame-major). */
  sus: Float32Array
  /** Total sustained centred energy per frame (dB). */
  db: Float32Array
}

const LO_HZ = 250
const HI_HZ = 4000
/** 46 ms window (21.5 Hz bins at 11 kHz: a semitone apart above ≈ 360 Hz), half-window hop. */
const WINDOW_SEC = 0.046
/** Temporal median half-width in frames (≈ ±70 ms at a 23 ms hop). */
const MEDIAN_HALF = 3
/** Pitch tolerance when matching bins across the cut (vibrato), relative. */
const VIBRATO = 0.03
/**
 * Exponent of the centre weight. For a source panned L = a·s, R = b·s the bin's
 * mid share r = |M|² / (|M|² + |S|²) equals (1 + ψ) / 2, with ψ = 2ab / (a² + b²)
 * the inter-channel coherence: 1 centred, 0 hard-panned, ≈ 0 for wide
 * (decorrelated) pads and reverbs. The weight is ψ⁴.
 */
const CENTRE_POW = 4

function pow2Near(v: number): number {
  return 2 ** Math.round(Math.log2(Math.max(64, v)))
}

/** `mid` and `side` ((L − R) / 2, or null) at `rate`. */
export function centreHarmonic(mid: Float32Array, side: Float32Array | null, rate: number): CentreHarmonic {
  const factor = rate >= 20000 ? 2 : 1
  const r = rate / factor
  const m = decimate(mid, factor)
  const s = side ? decimate(side, factor) : null
  const nfft = pow2Near(r * WINDOW_SEC)
  const hop = nfft >> 1
  const half = nfft >> 1
  const frames = Math.max(1, Math.floor(m.length / hop) + 1)
  const binHz = r / nfft
  const k0 = Math.max(1, Math.round(LO_HZ / binHz))
  const k1 = Math.min(nfft >> 1, Math.round(HI_HZ / binHz))
  const nb = Math.max(0, k1 - k0)
  const win = hann(nfft)
  const fft = createRealFft(nfft)
  const frame = new Float32Array(nfft)
  const pm = new Float32Array((nfft >> 1) + 1)
  const ps = new Float32Array((nfft >> 1) + 1)
  // Bin-major (one contiguous row per bin) for the median pass below.
  const C = new Float32Array(frames * nb)
  const n = m.length
  const load = (x: Float32Array, start: number): void => {
    for (let i = 0; i < nfft; i++) {
      const j = start + i
      frame[i] = j >= 0 && j < n ? x[j] * win[i] : 0
    }
  }
  for (let f = 0; f < frames; f++) {
    const start = f * hop - half
    load(m, start)
    fft.power(frame, pm)
    if (s) {
      load(s, start)
      fft.power(frame, ps)
    }
    for (let k = 0; k < nb; k++) {
      const a = pm[k0 + k]
      const psi = s ? 2 * (a / (a + ps[k0 + k] + 1e-20)) - 1 : 1
      const w = psi > 0 ? psi ** CENTRE_POW : 0
      C[k * frames + f] = Math.sqrt(a) * w
    }
  }

  // Sustained part: each bin clipped to its running temporal median (sliding
  // sorted window, edges clamped).
  const sus = new Float32Array(frames * nb)
  const L = 2 * MEDIAN_HALF + 1
  const win2 = new Float32Array(L)
  for (let k = 0; k < nb; k++) {
    const row = k * frames
    const at = (g: number): number => C[row + (g < 0 ? 0 : g >= frames ? frames - 1 : g)]
    for (let d = 0; d < L; d++) win2[d] = at(d - MEDIAN_HALF)
    win2.sort()
    for (let f = 0; f < frames; f++) {
      if (f > 0) {
        // Slide: drop frame f − 1 − H, add frame f + H.
        const out = at(f - 1 - MEDIAN_HALF)
        const inn = at(f + MEDIAN_HALF)
        let i = 0
        while (i < L - 1 && win2[i] !== out) i++
        // Remove index i, then insert `inn` keeping the order.
        if (inn >= out) {
          while (i < L - 1 && win2[i + 1] < inn) {
            win2[i] = win2[i + 1]
            i++
          }
        } else {
          while (i > 0 && win2[i - 1] > inn) {
            win2[i] = win2[i - 1]
            i--
          }
        }
        win2[i] = inn
      }
      const h = win2[MEDIAN_HALF]
      const v = C[row + f]
      const sustained = v < h ? v : h
      sus[f * nb + k] = sustained * sustained
    }
  }
  const db = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let e = 0
    for (let k = 0; k < nb; k++) e += sus[f * nb + k]
    db[f] = 10 * Math.log10(e + 1e-12)
  }
  const tol = new Uint8Array(nb)
  for (let k = 0; k < nb; k++) tol[k] = Math.min(8, Math.floor(VIBRATO * (k0 + k)))
  return { fps: r / hop, bins: nb, tol, sus, db }
}

/** Reference level (≈ 95th percentile, dB) of the track over [from, to] seconds. */
export function referenceDb(v: CentreHarmonic, from: number, to: number): number {
  const a = clamp(Math.floor(from * v.fps), 0, v.db.length - 1)
  const b = clamp(Math.ceil(to * v.fps), a + 1, v.db.length)
  return percentile(v.db.subarray(a, b), 0.95)
}

/** Mean sustained power per bin over [t0, t1] seconds, into `out`. */
function binPower(v: CentreHarmonic, t0: number, t1: number, out: Float64Array): void {
  out.fill(0)
  const a = Math.max(0, Math.round(t0 * v.fps))
  const b = Math.min(v.db.length - 1, Math.round(t1 * v.fps))
  if (b < a) return
  const nb = v.bins
  for (let f = a; f <= b; f++) for (let k = 0; k < nb; k++) out[k] += v.sus[f * nb + k]
  for (let k = 0; k < nb; k++) out[k] /= b - a + 1
}

const toDb = (p: number): number => 10 * Math.log10(p + 1e-12)

/**
 * 0..1: how much a cut at `t` would chop a held centred note — the SAME bins
 * (±3 % in pitch, for vibrato) sustained loudly both 20–60 ms before and after the cut
 * (relative to `ref`), with no dip at the cut itself. A chord change on the
 * bar line moves the energy to other bins and does not count: that is the
 * perfect place for a cut (unless a common tone rings on).
 */
export function throughAt(v: CentreHarmonic, ref: number, t: number): number {
  const nb = v.bins
  if (nb === 0 || v.db.length === 0) return 0
  const pre = new Float64Array(nb)
  const post = new Float64Array(nb)
  const mid = new Float64Array(nb)
  binPower(v, t - 0.06, t - 0.02, pre)
  binPower(v, t + 0.02, t + 0.06, post)
  binPower(v, t - 0.012, t + 0.012, mid)
  let cont = 0
  let held = 0
  let totPre = 0
  let totPost = 0
  for (let k = 0; k < nb; k++) {
    totPre += pre[k]
    totPost += post[k]
    let p = pre[k]
    const d = v.tol[k]
    for (let j = Math.max(0, k - d); j <= Math.min(nb - 1, k + d); j++) if (pre[j] > p) p = pre[j]
    const c = Math.min(p, post[k])
    cont += c
    held += Math.min(c, mid[k])
  }
  const low = toDb(cont) - ref
  const dip = toDb(cont) - toDb(held)
  // Share of the sound that carries on in the same bins: a held note dominates
  // (≈ 1); a chord change only overlaps through leakage / common tones.
  const share = cont / Math.max(1e-12, Math.min(totPre, totPost))
  const loud = clamp((low + 14) / 6, 0, 1)
  const noDip = clamp((6 - dip) / 4, 0, 1)
  const carried = clamp((share - 0.35) / 0.3, 0, 1)
  return loud * noDip * carried
}
