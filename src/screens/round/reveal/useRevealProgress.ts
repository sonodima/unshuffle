// Drives the reveal choreography: a set of timers (one per beat of the timeline)
// that flips progress flags and fires cues for sound / light effects.
import { useEffect, useRef, useState } from 'react'
import type { RevealTimeline } from './model'

interface RevealProgress {
  board: boolean
  /** Positions whose ✓/✗ is visible (0..n). */
  marks: number
  sorted: boolean
  score: boolean
  lead: boolean
  ranks: boolean
  done: boolean
}

export type RevealCue =
  | { type: 'board' }
  | { type: 'mark'; index: number }
  | { type: 'sort' }
  | { type: 'score' }
  | { type: 'lead' }
  | { type: 'ranks' }
  | { type: 'done' }

const START: RevealProgress = { board: false, marks: 0, sorted: false, score: false, lead: false, ranks: false, done: false }

function finished(n: number): RevealProgress {
  return { board: true, marks: n, sorted: true, score: true, lead: true, ranks: true, done: true }
}

/**
 * `skip` shows the end state at once (reduced motion, late mount). Cues never
 * fire when skipping. Changing `timeline` restarts the sequence.
 */
export function useRevealProgress(timeline: RevealTimeline, skip: boolean, onCue?: (cue: RevealCue) => void): RevealProgress {
  const n = timeline.marks.length
  const [state, setState] = useState(() => ({ timeline, skip, progress: skip ? finished(n) : START }))
  // A new timeline restarts from scratch (derived during render, not in an effect).
  let current = state
  if (state.timeline !== timeline || state.skip !== skip) {
    current = { timeline, skip, progress: skip ? finished(n) : START }
    setState(current)
  }
  const cueRef = useRef(onCue)
  useEffect(() => {
    cueRef.current = onCue
  })

  useEffect(() => {
    if (skip) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, patch: (p: RevealProgress) => RevealProgress, cue: RevealCue) => {
      timers.push(
        setTimeout(() => {
          setState((s) => (s.timeline === timeline ? { ...s, progress: patch(s.progress) } : s))
          try {
            cueRef.current?.(cue)
          } catch (err) {
            console.warn('[reveal] cue failed', err)
          }
        }, Math.max(0, ms)),
      )
    }
    at(timeline.board, (p) => ({ ...p, board: true }), { type: 'board' })
    timeline.marks.forEach((ms, index) => at(ms, (p) => ({ ...p, board: true, marks: Math.max(p.marks, index + 1) }), { type: 'mark', index }))
    if (n > 0) {
      at(timeline.sort, (p) => ({ ...p, marks: n, sorted: true }), { type: 'sort' })
      at(timeline.score, (p) => ({ ...p, score: true }), { type: 'score' })
    }
    at(timeline.lead, (p) => ({ ...p, lead: true }), { type: 'lead' })
    at(timeline.ranks, (p) => ({ ...p, lead: true, ranks: true }), { type: 'ranks' })
    at(timeline.done, () => finished(n), { type: 'done' })
    return () => timers.forEach(clearTimeout)
  }, [timeline, skip, n])

  return current.progress
}
