// The full analysis pipeline, pure and deterministic (no DOM / AudioContext):
// mono samples (+ optional side channel) → features → usable region → tempo
// (with octave resolution) → DP beat tracking → centred held-note track →
// meter (4/4 unless 3 or 5 is clear) + bar phase + structural novelty →
// boundary DP (even lengths, bar lines, no chopped held notes) → attack
// snapping. Written as a generator so the main-thread fallback can yield
// between stages; the worker simply runs it to completion.

import { chooseBoundaries, BEAT_WEIGHTS, ONSET_WEIGHTS } from './cut'
import type { Candidate } from './cut'
import { clamp, decimate, maxIn, mean, movingAverage, percentile } from './dsp'
import { bandFlux, computeFeatures } from './features'
import type { Features } from './features'
import { extendGrid, localScore, normalizeOnset, regularizeEdges, slipAmount, strengthAt, trackBeats, trimEdgeOutliers } from './beats'
import { clampCount, isValidPlan, uniformPlan } from './plan'
import { usableRegion } from './region'
import { centreHarmonic, referenceDb, throughAt } from './vocal'
import { snapToAttack } from './snap'
import { beatFeatures, estimateBarPhase, estimateMeter, structuralNovelty } from './structure'
import type { BarPhase } from './structure'
import { analyzeTempo, highpassOnset, MAX_BPM, MIN_BPM, salienceAt, tempoPrior } from './tempo'
import type { CutMethod, CutPlan, CutSegment } from './types'

export { isValidPlan } from './plan'

interface AnalysisInput {
  /** Mono samples at `sampleRate`. */
  samples: Float32Array
  /** Optional side channel ((L − R) / 2, same length): lets the cutter tell centred vocals from wide sounds. */
  side?: Float32Array | null
  sampleRate: number
  /** Number of segments wanted. */
  n: number
}

interface AnalysisDebug {
  fps: number
  onsetShift: number
  /** High-passed, unit-std onset envelope (frame rate `fps`). */
  onset: Float32Array
  /** Same for the low band (kick). */
  low: Float32Array
  tempoCandidates: { bpm: number; salience: number; prior: number }[]
  /** How the metrical level was decided. */
  tempoDecision: string
  barPhase: BarPhase | null
  /** Structural novelty per beat. */
  novelty: number[]
  /** Cut times before attack snapping. */
  gridBoundaries: number[]
  /** Detected attack per final boundary. */
  attacks: number[]
  confidenceParts: Record<string, number>
  timings: Record<string, number>
}

interface AnalysisResult {
  plan: CutPlan
  debug?: AnalysisDebug
}

/** Minimum beat-grid confidence to cut on beats. */
const BEAT_CONFIDENCE_MIN = 0.35
const MIN_SEGMENT_SEC = 0.05
/**
 * Metrical strength per bar position (4/4): bar line, beat 2, half bar, beat 4.
 * Weak beats are slightly penalised: an even plan must use half bars before it
 * ever cuts on beat 2 or 4 (and 3- / 5-beat bars use the same weak value).
 */
const BAR_METRIC = [1, -0.3, 0.45, -0.3]
const WEAK_METRIC = BAR_METRIC[1]
/** Beats between the beats of an 8-beat (half-tempo) bar reading. */
const OFFBEAT_METRIC = -0.2
const PHASE_PRIOR_WEIGHT = 1.2
/** Below this beat confidence the grid must also prove that its beats sit on real attacks. */
const GREY_ZONE_MAX = 0.5
/** A grey-zone grid is kept only if its beats carry attacks this strong on average (0..1). */
const GRID_QUALITY_MIN = 0.6
/** Octave decisions closer than this (log-odds) keep the slower bar grid in play. */
const OCTAVE_CLOSE_CALL = 0.35

/** Softmax over bar-phase template scores, scaled by their spread. */
function phasePosterior(scores: number[]): number[] {
  const hi = Math.max(...scores)
  const spread = Math.max(1e-6, hi - Math.min(...scores))
  // Absolute evidence matters too: tiny spreads mean "no idea".
  const sharp = 3.5 * Math.min(1, spread / 0.25)
  const e = scores.map((s) => Math.exp((sharp * (s - hi)) / spread))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / z)
}

/** True when a signal is not (near) digital silence: a mono file's side channel is all zeros. */
function hasEnergy(x: Float32Array): boolean {
  for (let i = 0; i < x.length; i += 7) if (x[i] > 1e-4 || x[i] < -1e-4) return true
  return false
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

interface TempoChoice {
  bpm: number
  decision: string
  /** The chosen tempo is the faster of an octave pair that was a close call. */
  slowerPlausible: boolean
}

/** Low-band strength at beat midpoints relative to beats: high = the next faster level is real. */
function offbeatRatio(hp: Float32Array, low: Float32Array, bpm: number, fps: number): number {
  const period = (60 * fps) / bpm
  const beats = trackBeats(localScore(hp, period), period)
  if (beats.length < 4) return 0.5
  const mids = beats.slice(1).map((b, i) => (b + beats[i]) / 2)
  const on = strengthAt(low, beats)
  return on > 1e-9 ? strengthAt(low, mids) / on : 0.5
}

function chooseTempo(ta: ReturnType<typeof analyzeTempo>, hp: Float32Array, low: Float32Array, fps: number): TempoChoice {
  const top = ta.candidates[0]
  if (!top) return { bpm: 0, decision: 'none', slowerPlausible: false }
  const weight = (bpm: number): number => Math.max(1e-6, salienceAt(ta, bpm) * tempoPrior(bpm))
  const onStrength = (bpm: number): number => {
    const period = (60 * fps) / bpm
    return strengthAt(hp, trackBeats(localScore(hp, period), period))
  }
  // 1. Triple-meter confusions (3:2): at the wrong level every other beat
  //    lands between two real beats, so mean onset strength at beats drops.
  let b = top.bpm
  let decision = ''
  const family = [b, b * 1.5, b / 1.5].filter((v) => v >= MIN_BPM && v <= MAX_BPM)
  if (family.length > 1) {
    const score = (v: number): number => weight(v) * onStrength(v) ** 1.5
    const scores = family.map(score)
    const best = scores.indexOf(Math.max(...scores))
    if (best > 0) {
      decision = `3:2 ${b.toFixed(1)}→${family[best].toFixed(1)}; `
      b = family[best]
    }
  }
  // 2. Octave: positive → prefer the faster of (slow, 2·slow). Strong kicks
  //    between the slow beats mean the faster pulse is real.
  const preferFast = (slow: number): number => {
    const k = offbeatRatio(hp, low, slow, fps)
    return Math.log(weight(slow * 2) / weight(slow)) + 0.5 * clamp(k - 0.5, -0.4, 0.6)
  }
  if (b / 2 >= MIN_BPM) {
    const l = preferFast(b / 2)
    return l > 0
      ? { bpm: b, decision: `${decision}keep ${b.toFixed(1)} over half (${l.toFixed(2)})`, slowerPlausible: l < OCTAVE_CLOSE_CALL }
      : { bpm: b / 2, decision: `${decision}half (${l.toFixed(2)})`, slowerPlausible: false }
  }
  if (b * 2 <= MAX_BPM) {
    const l = preferFast(b)
    return l > 0
      ? { bpm: b * 2, decision: `${decision}double (${l.toFixed(2)})`, slowerPlausible: l < OCTAVE_CLOSE_CALL }
      : { bpm: b, decision: `${decision}keep ${b.toFixed(1)} over double (${l.toFixed(2)})`, slowerPlausible: false }
  }
  return { bpm: b, decision: `${decision}single`, slowerPlausible: false }
}

/** Least-squares beat period (seconds) of a beat sequence. */
function regressionPeriod(beats: number[]): number {
  const m = beats.length
  if (m < 2) return 0
  const xm = (m - 1) / 2
  const ym = mean(beats)
  let num = 0
  let den = 0
  for (let i = 0; i < m; i++) {
    num += (i - xm) * (beats[i] - ym)
    den += (i - xm) * (i - xm)
  }
  return den > 0 ? num / den : 0
}

function onsetPeaks(hp: Float32Array, fps: number, from: number, to: number): number[] {
  const base = movingAverage(hp, Math.round(fps * 0.5))
  const sd = Math.sqrt(mean(hp.map((v) => v * v)))
  const minDist = Math.round(fps * 0.08)
  const peaks: number[] = []
  for (let i = Math.max(1, from); i < Math.min(hp.length - 1, to); i++) {
    if (hp[i] < hp[i - 1] || hp[i] < hp[i + 1]) continue
    if (hp[i] < base[i] + 0.3 * sd) continue
    const last = peaks[peaks.length - 1]
    if (last !== undefined && i - last < minDist) {
      if (hp[i] > hp[last]) peaks[peaks.length - 1] = i
      continue
    }
    peaks.push(i)
  }
  return peaks
}

/** Share of the strongest onsets that fall within ±45 ms of the beat / 8th-note grid. */
function gridFit(hp: Float32Array, fps: number, beats: number[], from: number, to: number): number {
  if (beats.length < 4) return 0
  const base = movingAverage(hp, Math.round(fps * 0.5))
  const peaks: number[] = []
  for (let i = Math.max(1, from); i < Math.min(hp.length - 1, to); i++) {
    if (hp[i] >= hp[i - 1] && hp[i] > hp[i + 1] && hp[i] > base[i] + 0.5) peaks.push(i)
  }
  if (peaks.length < 4) return 0
  const strong = peaks.sort((a, b) => hp[b] - hp[a]).slice(0, Math.max(8, Math.round(peaks.length * 0.4)))
  const grid: number[] = []
  for (let i = 0; i < beats.length; i++) {
    grid.push(beats[i])
    if (i + 1 < beats.length) grid.push((beats[i] + beats[i + 1]) / 2)
  }
  const tol = 0.045 * fps
  let hit = 0
  for (const p of strong) {
    // grid is sorted: binary search for the nearest point.
    let lo = 0
    let hi = grid.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (grid[mid] < p) lo = mid
      else hi = mid
    }
    if (Math.min(Math.abs(grid[lo] - p), Math.abs(grid[hi] - p)) <= tol) hit++
  }
  return hit / strong.length
}

/** Timbre change between the half-second before and after `t`. */
function timbreChange(f: Features, t: number): number {
  const nb = f.timbreBands
  const w = Math.round(f.fps * 0.5)
  const c = Math.round(t * f.fps)
  if (c - w < 0 || c + w > f.frames) return 0
  let d = 0
  for (let k = 0; k < nb; k++) {
    let a = 0
    let b = 0
    for (let i = c - w; i < c; i++) a += f.timbre[i * nb + k]
    for (let i = c; i < c + w; i++) b += f.timbre[i * nb + k]
    d += Math.abs(a - b) / w
  }
  return d / nb
}

function* analysisSteps(input: AnalysisInput, wantDebug = false): Generator<void, AnalysisResult, void> {
  const timings: Record<string, number> = {}
  let t0 = now()
  const mark = (name: string): void => {
    const t = now()
    timings[name] = t - t0
    t0 = t
  }
  const n = clampCount(input.n)
  const sr = input.sampleRate
  const x = input.samples
  const duration = sr > 0 ? x.length / sr : 0
  if (!(duration > 0) || !(sr > 0)) return { plan: uniformPlan(n, Math.max(0, duration)) }
  if (duration < 1.5 || n * MIN_SEGMENT_SEC * 4 > duration) return { plan: uniformPlan(n, duration) }

  const factor = sr >= 64000 ? 4 : sr >= 32000 ? 2 : 1
  const xs = decimate(x, factor)
  const rate = sr / factor
  mark('decimate')
  yield
  const f = computeFeatures(xs, rate)
  mark('features')
  yield

  const region = usableRegion(f.rmsDb, f.fps, duration)
  if (region.silent) return { plan: uniformPlan(n, duration) }
  const fps = f.fps
  const fromF = Math.max(0, Math.floor(region.start * fps))
  const toF = Math.min(f.frames, Math.ceil(region.end * fps))

  const hpRaw = highpassOnset(f.onset, fps)
  const hp = normalizeOnset(hpRaw)
  const lowN = normalizeOnset(highpassOnset(f.low, fps))
  const ta = analyzeTempo(f.onset, fps, fromF, toF)
  const choice = chooseTempo(ta, hp, lowN, fps)
  mark('tempo')
  yield

  const shift = f.onsetShift
  const span = region.end - region.start
  const target = span / n
  const hpP95 = percentile(hp.subarray(fromF, toF), 0.95) || 1
  const onsetAt = (t: number): number => {
    const fr = (t - shift) * fps
    return clamp(maxIn(hp, fr - 2, fr + 2) / hpP95, 0, 1)
  }
  const sustainAt = (t: number): number => {
    const fr = clamp(Math.round(t * fps), 0, f.frames - 1)
    const loud = clamp((f.rmsDb[fr] - region.refDb + 15) / 15, 0, 1)
    return loud * (1 - onsetAt(t))
  }
  // Held centred notes (vocals) across a candidate cut, computed in its own
  // stage below. The cut itself lands ≈ 12 ms before the beat's attack, so
  // that is where the note must not run through.
  let vocalTrack: ReturnType<typeof centreHarmonic> | null = null
  let vocalRef = 0
  const vocalAt = (t: number): number => (vocalTrack ? throughAt(vocalTrack, vocalRef, t - 0.012) : 0)

  // Beat grid.
  let beats: number[] = []
  let confidence = 0
  let bpm = 0
  const parts: Record<string, number> = {}
  const kick = normalizeOnset(highpassOnset(bandFlux(f, 30, 110), fps))
  let slip = 0
  if (choice.bpm > 0) {
    const period = (60 * fps) / choice.bpm
    // Several trackers (tempo tightness × kick emphasis); keep the one whose
    // beats carry the strongest onsets and kicks without slipping onto the
    // off-beats half-way through (syncopated bass lines, "and" accents).
    const kickHeavy = normalizeOnset(hp.map((v, i) => v + 0.6 * kick[i]))
    let bestScore = -Infinity
    let tracked: number[] = []
    let trackedLocal = hp
    // The classic tracker (onsets only, librosa-like tightness) also serves as
    // the reference for the confidence measures below.
    let classic: number[] = []
    for (const env of [hp, kickHeavy]) {
      const local = localScore(env, period)
      for (const tightness of [100, 400, 1500]) {
        const b = trimEdgeOutliers(trackBeats(local, period, { tightness, freshUntil: fromF + 2.5 * period }))
        if (env === hp && tightness === 100) classic = b
        const inside = b.filter((v) => v >= fromF && v <= toF)
        if (inside.length < 4) continue
        // Expressive timing drifts by up to ~¼ beat; beyond that it is a slip.
        const sl = slipAmount(inside)
        const score = strengthAt(hp, inside) + 0.3 * strengthAt(kick, inside) - 3 * Math.max(0, sl - 0.3)
        if (score > bestScore) {
          bestScore = score
          tracked = b
          trackedLocal = local
          slip = sl
        }
      }
    }
    tracked = regularizeEdges(tracked, trackedLocal)
    const grid = extendGrid(tracked, period, fromF, toF)
    beats = grid.map((b) => b / fps + shift).filter((t) => t >= 0 && t <= duration)
    const periodSec = regressionPeriod(beats)
    bpm = periodSec > 0 ? 60 / periodSec : 0
    const inRegion = classic.filter((b) => b >= fromF && b <= toF)
    const mids = inRegion.slice(1).map((b, i) => (b + inRegion[i]) / 2)
    const on = strengthAt(hp, inRegion)
    const off = strengthAt(hp, mids)
    const contrast = off > 1e-9 ? on / off : 4
    const hits = inRegion.filter((b) => maxIn(hp, b - 2, b + 2) > 1).length / Math.max(1, inRegion.length)
    const fit = gridFit(hp, fps, inRegion, fromF, toF)
    parts.peakiness = ta.peakiness
    parts.contrast = contrast
    parts.hits = hits
    parts.fit = fit
    parts.slip = slip
    // Periodicity strength, beats landing on onsets, and strong onsets landing
    // on the (8th-note) grid; rubato or beatless music fails the last two.
    const cPeak = clamp((Math.log(ta.peakiness) - Math.log(1.5)) / (Math.log(8) - Math.log(1.5)), 0, 1)
    const cHits = clamp((hits - 0.15) / 0.6, 0, 1)
    const cFit = clamp((fit - 0.4) / 0.5, 0, 1)
    confidence = clamp(0.45 * cPeak + 0.3 * cHits + 0.25 * cFit, 0, 1)
  }
  mark('beats')
  yield

  const side = input.side && input.side.length === x.length && hasEnergy(input.side) ? decimate(input.side, factor) : null
  vocalTrack = centreHarmonic(xs, side, rate)
  vocalRef = referenceDb(vocalTrack, region.start, region.end)
  mark('vocal')
  yield

  let method: CutMethod = 'uniform'
  let boundaries: number[] | null = null
  let downbeats: number[] = []
  let bar: BarPhase | null = null
  let novelty: Float32Array = new Float32Array(0)
  let beatPos: number[] = []
  const quality: Record<string, number> = {}

  // Mean attack strength at the given cut times, minus chopped sustained notes.
  const cutQuality = (times: number[]): number => mean(times.map((t) => onsetAt(t) - 0.5 * sustainAt(t)))

  const onsetCut = (): number[] | null => {
    const peaks = onsetPeaks(hp, fps, fromF, toF)
    const cands: Candidate[] = peaks.map((p) => {
      const t = p / fps + shift
      return { time: t, metric: 0, novelty: 0, onset: onsetAt(t), sustain: sustainAt(t), vocal: vocalAt(t), beat: NaN }
    })
    const tc = cands.map((c) => timbreChange(f, c.time))
    const tcMax = Math.max(1e-9, ...tc)
    cands.forEach((c, i) => (c.novelty = tc[i] / tcMax))
    // A coarse time grid keeps the problem feasible when onsets are sparse.
    for (let t = region.start; t <= region.end + 1e-9; t += 0.25) {
      cands.push({ time: t, metric: -0.6, novelty: 0, onset: onsetAt(t), sustain: sustainAt(t), vocal: vocalAt(t), beat: NaN })
    }
    cands.sort((a, b) => a.time - b.time)
    const sol = chooseBoundaries({ candidates: cands, n, start: region.start, end: region.end, beatsPerBar: 4, barSec: 0, weights: ONSET_WEIGHTS })
    return sol ? sol.path.map((j) => cands[j].time) : null
  }

  // Grey zone (rubato, free time, sparse ballads): the grid is trusted only
  // if its beats really carry attacks — decided once, independently of n.
  let gridOk = confidence >= BEAT_CONFIDENCE_MIN && beats.length >= 8
  if (gridOk) {
    quality.beats = cutQuality(beats.filter((t) => t >= region.start && t <= region.end))
    if (confidence < GREY_ZONE_MAX && quality.beats < GRID_QUALITY_MIN) gridOk = false
  }

  if (gridOk) {
    const snare = normalizeOnset(highpassOnset(bandFlux(f, 180, 5000), fps))
    const env = { low: kick, high: snare }
    const bf = beatFeatures(f, beats, env)
    novelty = structuralNovelty(bf)
    const firstIn = beats.findIndex((t) => t >= region.start)
    const lastIn = beats.findIndex((t) => t > region.end)
    const meter = estimateMeter(bf, Math.max(0, firstIn), lastIn < 0 ? beats.length : lastIn)
    const P = meter.beatsPerBar
    parts.meter3 = meter.scores[3]
    parts.meter4 = meter.scores[4]
    parts.meter5 = meter.scores[5]
    bar = estimateBarPhase(bf, novelty, P)
    const beatPeriodSec = bpm > 0 ? 60 / bpm : target
    const subdivide = target < 1.6 * beatPeriodSec

    // Bar hypotheses. Normally 4 phases of a 4-beat bar. When the tempo could
    // just as well be half as fast, bars may span 8 detected beats: then each
    // hypothesis is (parity, phase) on the slower grid, and cuts prefer lines
    // that are bar lines under both readings. A clear 3- or 5-beat meter gets
    // its own P phases (bar line strong, every other beat weak).
    interface Hypothesis {
      metric: (i: number) => number
      isDownbeat: (i: number) => boolean
      prior: number
      beatsPerBar: number
    }
    const hyps: Hypothesis[] = []
    const mod = (a: number, m: number): number => ((a % m) + m) % m
    if (P !== 4) {
      const post = phasePosterior(bar.scores)
      for (let ph = 0; ph < P; ph++) {
        hyps.push({
          metric: (i) => (mod(i - ph, P) === 0 ? 1 : WEAK_METRIC),
          isDownbeat: (i) => mod(i - ph, P) === 0,
          prior: post[ph],
          beatsPerBar: P,
        })
      }
    } else if (choice.slowerPlausible) {
      const scores: number[] = []
      const slowPhase: { parity: number; phase: number }[] = []
      for (let parity = 0; parity < 2; parity++) {
        const slow = beats.filter((_, i) => i % 2 === parity)
        const sbf = beatFeatures(f, slow, env)
        const sp = estimateBarPhase(sbf, structuralNovelty(sbf))
        for (let ph = 0; ph < 4; ph++) {
          scores.push(sp.scores[ph])
          slowPhase.push({ parity, phase: ph })
        }
      }
      const post = phasePosterior(scores)
      slowPhase.forEach(({ parity, phase }, k) => {
        hyps.push({
          metric: (i) => (mod(i - parity, 2) === 1 ? OFFBEAT_METRIC : BAR_METRIC[mod((i - parity) / 2 - phase, 4)]),
          isDownbeat: (i) => mod(i - parity, 2) === 0 && mod((i - parity) / 2 - phase, 4) === 0,
          prior: post[k],
          beatsPerBar: 8,
        })
      })
    } else {
      const post = phasePosterior(bar.scores)
      for (let ph = 0; ph < 4; ph++) {
        hyps.push({
          metric: (i) => BAR_METRIC[mod(i - ph, 4)],
          isDownbeat: (i) => mod(i - ph, 4) === 0,
          prior: post[ph],
          beatsPerBar: 4,
        })
      }
    }

    // One DP per hypothesis; the prior enters as a cost, so a clear phase wins
    // and an ambiguous one is settled by how well each grid fits lengths,
    // phrase boundaries and attacks.
    let best: { cost: number; times: number[]; beats: number[]; hyp: Hypothesis } | null = null
    for (const hyp of hyps) {
      const cands: Candidate[] = []
      for (let i = 0; i < beats.length; i++) {
        const t = beats[i]
        cands.push({ time: t, metric: hyp.metric(i), novelty: novelty[i], onset: onsetAt(t), sustain: sustainAt(t), vocal: vocalAt(t), beat: i })
        if (subdivide && i + 1 < beats.length) {
          const h = (t + beats[i + 1]) / 2
          cands.push({ time: h, metric: -0.15, novelty: 0, onset: onsetAt(h), sustain: sustainAt(h), vocal: vocalAt(h), beat: i + 0.5 })
        }
      }
      const sol = chooseBoundaries({
        candidates: cands,
        n,
        start: region.start,
        end: region.end,
        beatsPerBar: hyp.beatsPerBar,
        barSec: P * beatPeriodSec,
        weights: BEAT_WEIGHTS,
      })
      if (!sol) continue
      const cost = sol.cost - PHASE_PRIOR_WEIGHT * Math.log(Math.max(1e-6, hyp.prior))
      if (!best || cost < best.cost) {
        best = { cost, times: sol.path.map((j) => cands[j].time), beats: sol.path.map((j) => cands[j].beat), hyp }
      }
    }
    if (best) {
      const chosen = best
      boundaries = chosen.times
      beatPos = chosen.beats
      downbeats = beats.filter((_, i) => chosen.hyp.isDownbeat(i))
      const firstDown = beats.findIndex((_, i) => chosen.hyp.isDownbeat(i))
      bar = { ...bar, phase: firstDown >= 0 ? firstDown % P : bar.phase }
      method = 'beat-grid'
      quality.cuts = cutQuality(chosen.times)
    }
  }
  if (!boundaries) {
    boundaries = onsetCut()
    if (boundaries) method = 'onset'
  }
  mark('cut')
  yield

  if (!boundaries) return { plan: uniformPlan(n, duration, region.start, region.end) }

  // Attack snapping on the full-rate signal, keeping order and minimum gaps.
  const grid = boundaries.slice()
  const attacks: number[] = []
  const snapped = boundaries.map((t) => {
    const s = snapToAttack(x, sr, clamp(t, 0, duration))
    attacks.push(s.attack)
    return s.time
  })
  for (let i = 0; i < snapped.length; i++) {
    const lo = i > 0 ? snapped[i - 1] + MIN_SEGMENT_SEC : 0
    if (snapped[i] < lo || snapped[i] > duration) snapped[i] = clamp(grid[i], lo, duration)
  }
  // Sample-exact boundaries: one shared float per cut.
  const cuts = snapped.map((t) => clamp(Math.round(t * sr) / sr, 0, duration))
  const segments: CutSegment[] = []
  for (let i = 0; i < n; i++) {
    const beatsIn = method === 'beat-grid' && beatPos.length === n + 1 ? beatPos[i + 1] - beatPos[i] : 0
    segments.push({ start: cuts[i], end: cuts[i + 1], beats: beatsIn })
  }
  // The tempo is reported whenever the grid is plausible, even if the cuts
  // follow onsets (e.g. a ballad whose beats carry no clear attacks).
  const reportGrid = method === 'beat-grid' || confidence >= BEAT_CONFIDENCE_MIN
  const plan: CutPlan = {
    bpm: reportGrid ? Math.round(bpm * 100) / 100 : 0,
    confidence: Math.round(confidence * 1000) / 1000,
    beats: reportGrid ? beats : [],
    downbeats: method === 'beat-grid' ? downbeats : [],
    segments,
    usableStart: region.start,
    usableEnd: region.end,
    method,
  }
  mark('snap')
  if (!isValidPlan(plan, n, duration)) return { plan: uniformPlan(n, duration, region.start, region.end) }

  const debug: AnalysisDebug | undefined = wantDebug
    ? {
        fps,
        onsetShift: shift,
        onset: hp,
        low: lowN,
        tempoCandidates: ta.candidates.map((c) => ({ bpm: c.bpm, salience: c.salience, prior: c.prior })),
        tempoDecision: choice.decision,
        barPhase: bar,
        novelty: Array.from(novelty),
        gridBoundaries: grid,
        attacks,
        confidenceParts: { ...parts, ...Object.fromEntries(Object.entries(quality).map(([k, v]) => [`q_${k}`, v])) },
        timings,
      }
    : undefined
  return { plan, debug }
}

export function analyzeSync(input: AnalysisInput, wantDebug = false): AnalysisResult {
  const it = analysisSteps(input, wantDebug)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}

export async function analyzeAsync(input: AnalysisInput, pause: () => Promise<void>, wantDebug = false): Promise<AnalysisResult> {
  const it = analysisSteps(input, wantDebug)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
    await pause()
  }
}
