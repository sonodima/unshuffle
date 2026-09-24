// CutPlan helpers shared by the main thread and the pipeline. Deliberately tiny
// and dependency-free: index.ts imports it statically, while the heavy pipeline
// (features, tempo, beats, cutting) only loads in the worker or, lazily, in the
// rare main-thread fallback.

import type { CutPlan } from './types'

export function clampCount(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : 8)
  return Math.max(1, Math.min(64, v))
}

/** Evenly spaced boundaries over [start, end]. */
export function uniformBoundaries(start: number, end: number, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(start + ((end - start) * i) / n)
  return out
}

export function uniformPlan(n: number, duration: number, start = 0, end = duration): CutPlan {
  const d = Math.max(0, Number.isFinite(duration) ? duration : 0)
  const s = start > d ? d : start > 0 ? start : 0
  const e = end > s ? Math.min(end, d) : d
  const b = uniformBoundaries(s, e, n)
  b[0] = s
  b[n] = e
  return {
    bpm: 0,
    confidence: 0,
    beats: [],
    downbeats: [],
    segments: b.slice(0, n).map((t, i) => ({ start: t, end: b[i + 1], beats: 0 })),
    usableStart: s,
    usableEnd: e,
    method: 'uniform',
  }
}

/** Checks every CutPlan invariant; returns false on any violation. */
export function isValidPlan(plan: CutPlan, n: number, duration: number): boolean {
  const s = plan.segments
  if (!Array.isArray(s) || s.length !== n) return false
  for (let i = 0; i < n; i++) {
    const g = s[i]
    if (!Number.isFinite(g.start) || !Number.isFinite(g.end) || !Number.isFinite(g.beats)) return false
    if (g.start < 0 || g.end > duration + 1e-9 || g.end <= g.start) return false
    if (i < n - 1 && g.end !== s[i + 1].start) return false
  }
  return true
}
