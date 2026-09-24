// Beat-level musical structure: meter (4/4 unless 3 or 5 beats per bar are
// clearly evident), bar phase (downbeats) and a structural novelty curve
// (self-similarity + checkerboard kernel) that peaks at phrase / section
// boundaries.

import { maxIn, mean, zscore } from './dsp'
import type { Features } from './features'

export interface BeatFeatures {
  /** Kick (low-band flux) at each beat. */
  kick: Float32Array
  /** Snare / clap (high-band flux) at each beat. */
  snare: Float32Array
  /** Chord change at each beat (chroma distance, 2 beats before vs after). */
  harmonic: Float32Array
  /** Bass energy change at each beat. */
  bass: Float32Array
  /** Timbre change at each beat (1 beat before vs after). */
  timbre: Float32Array
  /** Loudness (dB) of each beat interval. */
  loudness: Float32Array
  /** Per-beat-interval feature vectors for the self-similarity matrix. */
  vectors: Float32Array[]
}

function norm(v: Float32Array): Float32Array {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i] * v[i]
  const k = s > 0 ? 1 / Math.sqrt(s) : 0
  for (let i = 0; i < v.length; i++) v[i] *= k
  return v
}

function cosDist(a: Float32Array, b: Float32Array): number {
  let d = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na > 0 && nb > 0 ? 1 - d / Math.sqrt(na * nb) : 0
}

/** Mean chroma over [t0, t1) seconds. */
function chromaBetween(f: Features, t0: number, t1: number): Float32Array {
  const out = new Float32Array(12)
  const a = Math.max(0, Math.floor(t0 * f.chromaFps))
  const b = Math.min(f.chromaFrames, Math.max(a + 1, Math.ceil(t1 * f.chromaFps)))
  for (let t = a; t < b; t++) for (let c = 0; c < 12; c++) out[c] += f.chroma[t * 12 + c]
  return out
}

function timbreBetween(f: Features, t0: number, t1: number): Float32Array {
  const nb = f.timbreBands
  const out = new Float32Array(nb)
  const a = Math.max(0, Math.floor(t0 * f.fps))
  const b = Math.min(f.frames, Math.max(a + 1, Math.ceil(t1 * f.fps)))
  for (let t = a; t < b; t++) for (let k = 0; k < nb; k++) out[k] += f.timbre[t * nb + k]
  for (let k = 0; k < nb; k++) out[k] /= b - a
  return out
}

/**
 * Beat-synchronous features. `beats` are times in seconds; `env` holds
 * normalised frame-rate onset envelopes of the kick band (`low`) and the
 * snare band (`high`).
 */
export function beatFeatures(
  f: Features,
  beats: number[],
  env: { low: Float32Array; high: Float32Array },
): BeatFeatures {
  const m = beats.length
  const kick = new Float32Array(m)
  const snare = new Float32Array(m)
  const harmonic = new Float32Array(m)
  const bass = new Float32Array(m)
  const timbre = new Float32Array(m)
  const loudness = new Float32Array(m)
  const period = m > 1 ? (beats[m - 1] - beats[0]) / (m - 1) : 0.5
  const r = Math.max(1.5, 0.035 * f.fps)
  const shift = f.onsetShift
  const edge = (i: number): number => (i < 0 ? beats[0] + i * period : i >= m ? beats[m - 1] + (i - m + 1) * period : beats[i])

  const chromaBeats: Float32Array[] = []
  const timbreBeats: Float32Array[] = []
  const lowDbBeats = new Float32Array(m)
  for (let i = 0; i < m; i++) {
    const t0 = edge(i)
    const t1 = edge(i + 1)
    chromaBeats.push(chromaBetween(f, t0, t1))
    timbreBeats.push(timbreBetween(f, t0, t1))
    const a = Math.max(0, Math.floor(t0 * f.fps))
    const b = Math.min(f.frames, Math.max(a + 1, Math.ceil(t1 * f.fps)))
    let s = 0
    for (let t = a; t < b; t++) s += 10 ** (f.lowDb[t] / 10)
    lowDbBeats[i] = 10 * Math.log10(s / (b - a) + 1e-12)
    let pw = 0
    for (let t = a; t < b; t++) pw += 10 ** (f.rmsDb[t] / 10)
    loudness[i] = 10 * Math.log10(pw / (b - a) + 1e-12)
    const fr = (beats[i] - shift) * f.fps
    kick[i] = maxIn(env.low, fr - r, fr + r)
    snare[i] = maxIn(env.high, fr - r, fr + r)
  }
  const sum = (list: Float32Array[], from: number, to: number): Float32Array => {
    const out = new Float32Array(list[0]?.length ?? 0)
    for (let i = Math.max(0, from); i < Math.min(list.length, to); i++) {
      const v = list[i]
      for (let k = 0; k < v.length; k++) out[k] += v[k]
    }
    return out
  }
  for (let i = 0; i < m; i++) {
    harmonic[i] = i >= 1 && i < m - 1 ? cosDist(sum(chromaBeats, i - 2, i), sum(chromaBeats, i, i + 2)) : 0
    bass[i] = i >= 1 ? Math.abs(lowDbBeats[i] - lowDbBeats[i - 1]) : 0
    if (i >= 1) {
      let d = 0
      const a = timbreBeats[i - 1]
      const b = timbreBeats[i]
      for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k])
      timbre[i] = d / a.length
    }
  }

  // SSM vectors: z-scored timbre bands + normalised chroma.
  const nb = f.timbreBands
  const tz: Float32Array[] = []
  for (let k = 0; k < nb; k++) tz.push(zscore(timbreBeats.map((v) => v[k])))
  const vectors = timbreBeats.map((_, i) => {
    const tv = new Float32Array(nb)
    for (let k = 0; k < nb; k++) tv[k] = tz[k][i]
    norm(tv)
    const cv = norm(Float32Array.from(chromaBeats[i]))
    const v = new Float32Array(nb + 12)
    for (let k = 0; k < nb; k++) v[k] = tv[k] * 0.8
    for (let k = 0; k < 12; k++) v[nb + k] = cv[k] * 0.6
    return v
  })
  return { kick, snare, harmonic, bass, timbre, loudness, vectors }
}

export interface BarPhase {
  /** Index (0..beatsPerBar-1) of the first beat that is a downbeat. */
  phase: number
  /** 0..1 margin between the best and the runner-up phase. */
  confidence: number
  /** Margin between the best phase and the phase half a bar away (half-bar confusion). */
  halfBarConfidence: number
  scores: number[]
}

// Templates over bar positions 1..4 (zero-mean): chords and bass change on the
// downbeat, the kick favours 1 (and 3), snare / clap sit on the backbeat 2 & 4.
const T_HARM = [1.5, -0.5, -0.5, -0.5]
const T_BASS = [1.5, -0.5, -0.5, -0.5]
const T_TIMBRE = [1.2, -0.4, -0.4, -0.4]
const T_KICK = [0.925, -0.575, 0.225, -0.575]
const T_SNARE = [-1, 1, -1, 1]
// Sections and phrases start on bar lines.
const T_NOVELTY = [1.5, -0.5, -0.5, -0.5]

/** Zero-mean "accent on the downbeat" template over `p` bar positions, peak `peak`. */
function downbeatTemplate(p: number, peak: number): number[] {
  return Array.from({ length: p }, (_, i) => (i === 0 ? peak : -peak / (p - 1)))
}

/**
 * Downbeat phase for bars of `beatsPerBar` beats (4 by default). 4/4 uses the
 * full template set (kick on 1 & 3, backbeat snare); other meters only the
 * meter-agnostic cues (chord / bass / timbre / kick / phrase changes on 1).
 */
export function estimateBarPhase(bf: BeatFeatures, novelty?: Float32Array, beatsPerBar = 4): BarPhase {
  const P = Math.max(2, Math.round(beatsPerBar))
  const m = bf.kick.length
  if (m < 2 * P) return { phase: 0, confidence: 0, halfBarConfidence: 0, scores: new Array<number>(P).fill(0) }
  const four = P === 4
  const feats: [Float32Array, number[], number][] = [
    [zscore(bf.harmonic), four ? T_HARM : downbeatTemplate(P, 1.5), 1.0],
    [zscore(bf.bass), four ? T_BASS : downbeatTemplate(P, 1.5), 0.5],
    [zscore(bf.timbre), four ? T_TIMBRE : downbeatTemplate(P, 1.2), 0.4],
    [zscore(bf.kick), four ? T_KICK : downbeatTemplate(P, 0.925), 0.7],
  ]
  if (four) feats.push([zscore(bf.snare), T_SNARE, 0.6])
  if (novelty && novelty.length === m) feats.push([zscore(novelty), four ? T_NOVELTY : downbeatTemplate(P, 1.5), 0.5])
  const scores = new Array<number>(P).fill(0)
  for (let phase = 0; phase < P; phase++) {
    let s = 0
    for (const [z, tpl, w] of feats) {
      let acc = 0
      for (let i = 0; i < m; i++) acc += z[i] * tpl[(((i - phase) % P) + P) % P]
      s += (w * acc) / m
    }
    scores[phase] = s
  }
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a])
  const best = order[0]
  const spread = Math.max(1e-6, scores[best] - Math.min(...scores))
  const confidence = Math.min(1, (scores[best] - scores[order[1]]) / spread)
  const halfBarConfidence = Math.min(1, (scores[best] - scores[(best + Math.floor(P / 2)) % P]) / spread)
  return { phase: best, confidence, halfBarConfidence, scores }
}

export interface Meter {
  /** 4, or 3 / 5 when the music clearly repeats every 3 / 5 beats. */
  beatsPerBar: number
  /** Periodicity evidence per candidate bar length (3, 4, 5). */
  scores: Record<number, number>
}

/** Evidence needed for a 3- or 5-beat bar, absolute and over 4/4. */
const METER_MIN = 0.1
const METER_MARGIN = 0.1

/**
 * Meter from beat-lag self-similarity: bars repeat, so beat vectors P, 2P, …
 * apart are more alike than at other lags. Scored per P ∈ {3, 4, 5} as the
 * mean similarity at multiples of P minus the mean at the other lags (2..12),
 * over the beats with index in [from, to). 4/4 is kept unless 3 or 5 wins
 * clearly (e.g. a 5/4 jazz vamp, a 3/4 waltz): a wrong odd meter would drift
 * every cut across the real bar lines, a missed one only loses bar alignment.
 */
export function estimateMeter(bf: BeatFeatures, from = 0, to = bf.vectors.length): Meter {
  const v = bf.vectors.slice(Math.max(0, from), Math.min(bf.vectors.length, to))
  const maxLag = 12
  const scores: Record<number, number> = { 3: 0, 4: 0, 5: 0 }
  if (v.length < 2 * maxLag) return { beatsPerBar: 4, scores }
  const S: number[] = [0]
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0
    let c = 0
    for (let i = 0; i + lag < v.length; i++) {
      s += 1 - cosDist(v[i], v[i + lag])
      c++
    }
    S.push(c ? s / c : 0)
  }
  for (const P of [3, 4, 5]) {
    let on = 0
    let nOn = 0
    let off = 0
    let nOff = 0
    for (let lag = 2; lag <= maxLag; lag++) {
      if (lag % P === 0) {
        on += S[lag]
        nOn++
      } else {
        off += S[lag]
        nOff++
      }
    }
    scores[P] = on / nOn - off / nOff
  }
  let beatsPerBar = 4
  for (const P of [3, 5]) {
    if (scores[P] >= METER_MIN && scores[P] - scores[4] >= METER_MARGIN && scores[P] > scores[beatsPerBar === 4 ? 4 : beatsPerBar]) beatsPerBar = P
  }
  return { beatsPerBar, scores }
}

/**
 * Structural novelty per beat in 0..1: checkerboard kernels (2 and 4 bars)
 * over the cosine self-similarity of beat vectors, plus loudness jumps.
 */
export function structuralNovelty(bf: BeatFeatures): Float32Array {
  const v = bf.vectors
  const m = v.length
  const out = new Float32Array(m)
  if (m < 6) return out
  const ssm = new Float32Array(m * m)
  for (let i = 0; i < m; i++) {
    for (let j = i; j < m; j++) {
      let d = 0
      const a = v[i]
      const b = v[j]
      for (let k = 0; k < a.length; k++) d += a[k] * b[k]
      ssm[i * m + j] = d
      ssm[j * m + i] = d
    }
  }
  const curves: Float32Array[] = []
  for (const w of [8, 16]) {
    const c = new Float32Array(m)
    const sigma = w * 0.6
    let full = 0
    for (let a = -w; a < w; a++) for (let b = -w; b < w; b++) full += Math.exp(-0.5 * ((a + 0.5) / sigma) ** 2 - 0.5 * ((b + 0.5) / sigma) ** 2)
    for (let i = 0; i < m; i++) {
      let s = 0
      let wsum = 0
      for (let a = -w; a < w; a++) {
        const ia = i + a
        if (ia < 0 || ia >= m) continue
        const ga = Math.exp(-0.5 * ((a + 0.5) / sigma) ** 2)
        for (let b = -w; b < w; b++) {
          const ib = i + b
          if (ib < 0 || ib >= m) continue
          const g = ga * Math.exp(-0.5 * ((b + 0.5) / sigma) ** 2)
          const sign = (a < 0) === (b < 0) ? 1 : -1
          s += sign * g * ssm[ia * m + ib]
          wsum += g
        }
      }
      // Near the edges only part of the kernel sees data: scale the evidence
      // down so truncated windows don't fake boundaries.
      c[i] = wsum > 0 ? Math.max(0, s / wsum) * (wsum / full) ** 2 : 0
    }
    curves.push(c)
  }
  let ssmMax = 0
  for (let i = 0; i < m; i++) {
    out[i] = 0.5 * curves[0][i] + 0.5 * curves[1][i]
    if (out[i] > ssmMax) ssmMax = out[i]
  }
  // Loudness jumps (a break, a drop, the band coming back in) and sudden
  // timbre changes are structural events too.
  const tz = bf.timbre
  const tm = mean(tz) || 1
  const L = bf.loudness
  const avg = (from: number, to: number): number => {
    let pw = 0
    for (let k = from; k < to; k++) pw += 10 ** (L[k] / 10)
    return 10 * Math.log10(pw / (to - from) + 1e-12)
  }
  for (let i = 0; i < m; i++) {
    const jump = i >= 2 && i + 2 <= m ? Math.min(1, Math.abs(avg(i, i + 2) - avg(i - 2, i)) / 8) : 0
    out[i] = (ssmMax > 0 ? 0.6 * (out[i] / ssmMax) : 0) + 0.4 * jump + 0.15 * Math.max(0, tz[i] / tm - 1)
  }
  let mx = 0
  for (let i = 0; i < m; i++) if (out[i] > mx) mx = out[i]
  if (mx > 0) for (let i = 0; i < m; i++) out[i] /= mx
  return out
}
