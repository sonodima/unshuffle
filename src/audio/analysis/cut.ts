// Boundary selection: choose n+1 cut points among musically meaningful
// candidates (beats, bar lines, onsets) with dynamic programming, trading off
// equal snippet lengths (per snippet, and max/min over the whole plan) against
// metrical strength, phrase boundaries, clean attacks and held (sung) notes.
// The same DP places the free cuts, with the preferences turned around
// (FREE_WEIGHTS).

export interface Candidate {
  /** Seconds. */
  time: number
  /** Metrical strength: 1 bar line, ≈0.45 half bar, < 0 weak beats and off the beat grid. */
  metric: number
  /** Structural novelty 0..1 (phrase / section boundary evidence). */
  novelty: number
  /** Onset strength at the cut 0..1 (a clear attack starts the next snippet). */
  onset: number
  /** 0..1, high when the cut would chop a sustained loud sound. */
  sustain: number
  /** 0..1, high when the cut would chop a held centred (sung) note. */
  vocal: number
  /** Position on the beat grid (fractional for subdivisions); NaN if not on the grid. */
  beat: number
}

interface CutWeights {
  length: number
  short: number
  long: number
  metric: number
  novelty: number
  onset: number
  sustain: number
  vocal: number
  wholeBars: number
  edge: number
  /**
   * Path-level balance: cost per unit of (max/min snippet length − balanceFree)².
   * Keeps the puzzle rhythm even: no 2:1 mixes of 2-bar and 1-bar snippets
   * when an even plan on bar lines / half bars exists. Deliberately not scaled
   * with n: at 16 snippets an even plan would need many weak-beat cuts, so a
   * 1-bar / half-bar mix may stay.
   */
  balance: number
  balanceFree: number
}

export const BEAT_WEIGHTS: CutWeights = {
  length: 1,
  short: 6,
  long: 6,
  metric: 0.5,
  novelty: 0.3,
  onset: 0.12,
  sustain: 0.15,
  vocal: 0.4,
  wholeBars: 0.2,
  edge: 0.4,
  balance: 7,
  balanceFree: 1.5,
}

export const ONSET_WEIGHTS: CutWeights = {
  length: 1,
  short: 6,
  long: 6,
  metric: 0.3,
  novelty: 0.25,
  onset: 0.5,
  sustain: 0.3,
  vocal: 0.4,
  wholeBars: 0,
  edge: 0.4,
  balance: 7,
  balanceFree: 1.5,
}

/**
 * Free cuts (CutStyle 'free'): the boundary preferences turned around. The
 * candidates are a fine time grid whose `metric` is minus the closeness to a
 * beat, so a positive weight keeps cuts off the beat; the negative weights
 * make attacks and section changes costly and sustained sound and held sung
 * notes attractive, so a snippet ends in the middle of something its
 * neighbour finishes. Lengths may drift more than on the beat grid, within
 * the same balance rule.
 */
export const FREE_WEIGHTS: CutWeights = {
  length: 0.6,
  short: 6,
  long: 6,
  metric: 0.8,
  novelty: -0.3,
  onset: -0.6,
  sustain: -0.5,
  vocal: -0.8,
  wholeBars: 0,
  edge: 0.4,
  balance: 5,
  balanceFree: 1.5,
}

const EDGE_METRIC_BOOST = 1
/**
 * Whole-bar bonus multipliers (× weights.wholeBars) by snippet length:
 * phrase-like chunks (1, 2, 4 bars), 3 bars, other whole bars, 1½ / 2½ … bars
 * (cut on the half bar: what makes an even plan possible when the preview
 * holds, say, 61 beats for 8 snippets), and a lone half bar.
 */
const BAR_BONUS = { phrase: 1.4, three: 1.25, other: 1, halves: 0.7, half: 0.4 }
/** Length-ratio caps and lower bounds (× target) of the balanced re-solves. */
const BALANCE_CAPS = [1.2, 1.35, 1.5, 1.7, 1.9, 2.1, 2.6]
const BALANCE_STEP = 0.05

interface CutProblem {
  candidates: Candidate[]
  n: number
  /** Usable region (seconds). */
  start: number
  end: number
  /** Beats per bar on the grid (4 for 4/4), used by the whole-bar bonus. */
  beatsPerBar: number
  /**
   * Bar length in seconds (0 if unknown). Leaving less than one bar unused at
   * either edge is almost free, so the plan can start on the first downbeat.
   */
  barSec: number
  weights: CutWeights
}

interface CutSolution {
  /** Indices into `candidates` of the n+1 boundaries (increasing). */
  path: number[]
  /** Total cost, balance penalty included. */
  cost: number
  /** max / min snippet length of the plan. */
  ratio: number
}

/** max / min consecutive gap of a boundary path. */
function pathRatio(c: Candidate[], path: number[]): number {
  let lo = Infinity
  let hi = 0
  for (let k = 1; k < path.length; k++) {
    const len = c[path[k]].time - c[path[k - 1]].time
    if (len < lo) lo = len
    if (len > hi) hi = len
  }
  return lo > 0 ? hi / lo : Infinity
}

/**
 * Optimal boundaries, or null if no feasible plan exists. The per-segment /
 * per-boundary costs are additive (one DP); the balance of the whole plan is
 * not, so the DP is re-solved inside length windows [a, cap·a] and the best
 * total (cost + balance penalty of the actual plan) wins.
 */
export function chooseBoundaries(p: CutProblem): CutSolution | null {
  const { candidates: c, n, weights: w } = p
  const m = c.length
  const span = p.end - p.start
  if (m < n + 1 || span <= 0 || n < 1) return null
  const target = span / n
  const minLen = 0.35 * target
  const maxLen = 2.2 * target

  const bCost = new Float64Array(m)
  for (let j = 0; j < m; j++) {
    const k = c[j]
    bCost[j] = -w.metric * k.metric - w.novelty * k.novelty - w.onset * k.onset + w.sustain * k.sustain + w.vocal * k.vocal
  }
  const segCost = (i: number, j: number): number => {
    const len = c[j].time - c[i].time
    const r = len / target
    let s = w.length * (r - 1) * (r - 1)
    if (r < 0.6) s += w.short * (0.6 - r) * (0.6 - r)
    if (r > 1.6) s += w.long * (r - 1.6) * (r - 1.6)
    if (w.wholeBars > 0 && Number.isFinite(c[i].beat) && Number.isFinite(c[j].beat)) {
      const beats = c[j].beat - c[i].beat
      const bars = beats / p.beatsPerBar
      const whole = Math.round(bars)
      if (Math.abs(bars - whole) < 1e-6) {
        // Phrase-like lengths (1, 2, 4 bars) are the most natural chunks.
        s -= (whole === 1 || whole === 2 || whole === 4 ? BAR_BONUS.phrase : whole === 3 ? BAR_BONUS.three : BAR_BONUS.other) * w.wholeBars
      } else {
        const halves = beats / (p.beatsPerBar / 2)
        if (Math.abs(halves - Math.round(halves)) < 1e-6) s -= (halves > 1.5 ? BAR_BONUS.halves : BAR_BONUS.half) * w.wholeBars
      }
    }
    return s
  }
  const freeEdge = 0.9 * p.barSec
  const edgeCost = (unused: number): number =>
    (w.edge * (Math.max(0, unused - freeEdge) + 0.15 * Math.min(unused, freeEdge))) / target
  const startWindow = p.start + Math.max(1.5 * target, 1.2 * p.barSec)
  const endWindow = p.end - Math.max(1.5 * target, 1.2 * p.barSec)
  // The first and last cuts frame the whole puzzle: they get extra weight
  // for landing on strong metrical positions (start on the first downbeat).
  const edgeMetric = (j: number): number => -w.metric * EDGE_METRIC_BOOST * c[j].metric
  const first = new Float64Array(m)
  const last = new Float64Array(m)
  for (let j = 0; j < m; j++) {
    const t = c[j].time
    first[j] = t < p.start - 0.03 || t > startWindow ? Infinity : edgeCost(Math.max(0, t - p.start)) + bCost[j] + edgeMetric(j)
    last[j] = t > p.end + 0.03 || t < endWindow ? Infinity : edgeCost(Math.max(0, p.end - t)) + edgeMetric(j)
  }

  // Feasible predecessors of each candidate (increasing i) with their segment cost.
  const predFrom = new Int32Array(m)
  const predCost: Float64Array[] = []
  for (let j = 0; j < m; j++) {
    const tj = c[j].time
    let lo = j
    while (lo > 0 && tj - c[lo - 1].time <= maxLen) lo--
    let hi = j
    while (hi > lo && tj - c[hi - 1].time < minLen) hi--
    predFrom[j] = lo
    const costs = new Float64Array(hi - lo)
    for (let i = lo; i < hi; i++) costs[i - lo] = segCost(i, j)
    predCost.push(costs)
  }

  const solve = (lenLo: number, lenHi: number): { path: number[]; cost: number } | null => {
    let prev = Float64Array.from(first)
    const back: Int32Array[] = []
    for (let k = 1; k <= n; k++) {
      const cur = new Float64Array(m).fill(Infinity)
      const bk = new Int32Array(m).fill(-1)
      for (let j = 0; j < m; j++) {
        const tj = c[j].time
        const lo = predFrom[j]
        const costs = predCost[j]
        let best = Infinity
        let arg = -1
        for (let q = costs.length - 1; q >= 0; q--) {
          const i = lo + q
          const len = tj - c[i].time
          if (len < lenLo) continue
          if (len > lenHi) break
          const v = prev[i] + costs[q]
          if (v < best) {
            best = v
            arg = i
          }
        }
        if (arg >= 0) {
          cur[j] = best + bCost[j]
          bk[j] = arg
        }
      }
      back.push(bk)
      prev = cur
    }
    let bestEnd = -1
    let bestCost = Infinity
    for (let j = 0; j < m; j++) {
      const v = prev[j] + last[j]
      if (v < bestCost) {
        bestCost = v
        bestEnd = j
      }
    }
    if (bestEnd < 0 || !Number.isFinite(bestCost)) return null
    const path = [bestEnd]
    for (let k = n - 1; k >= 0; k--) {
      const j = back[k][path[path.length - 1]]
      if (j < 0) return null
      path.push(j)
    }
    return { path: path.reverse(), cost: bestCost }
  }

  const penalty = (ratio: number): number => (n > 1 ? w.balance * Math.max(0, ratio - w.balanceFree) ** 2 : 0)
  const base = solve(minLen, maxLen)
  if (!base) return null
  const baseRatio = pathRatio(c, base.path)
  let best: CutSolution = { path: base.path, cost: base.cost + penalty(baseRatio), ratio: baseRatio }
  if (w.balance > 0 && n > 1 && penalty(baseRatio) > 0) {
    const seen = new Set<string>([base.path.join(',')])
    for (const cap of BALANCE_CAPS) {
      if (cap >= baseRatio) break
      for (let a = 1; a >= 1 / cap - 1e-9; a -= BALANCE_STEP) {
        const lo = Math.max(minLen, a * target)
        const hi = Math.min(maxLen, cap * a * target)
        if (hi < 0.85 * target) break
        const sol = solve(lo, hi)
        if (!sol) continue
        const key = sol.path.join(',')
        if (seen.has(key)) continue
        seen.add(key)
        const ratio = pathRatio(c, sol.path)
        const total = sol.cost + penalty(ratio)
        if (total < best.cost) best = { path: sol.path, cost: total, ratio }
      }
    }
  }
  return best
}
