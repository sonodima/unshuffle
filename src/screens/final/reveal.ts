// "Count when visible, but not before the podium has landed" helpers.
import { useInView } from 'motion/react'
import { useState, type RefObject } from 'react'

/** Shared clock for "don't start counting before the podium has landed". */
export interface Cue {
  /** performance.now() when the view mounted. */
  mountedAt: number
  /** Seconds after mount before below-the-podium counters may start. */
  revealAt: number
}

/** Seconds to wait (from now) so an element that just became visible respects the cue. */
function cueDelay(cue: Cue, stagger = 0): number {
  const elapsed = (performance.now() - cue.mountedAt) / 1000
  return Math.max(0, cue.revealAt - elapsed) + stagger
}

/**
 * Becomes true (once) when the element scrolls into view and returns the delay
 * frozen at that moment, so count-ups start when the user can actually see them.
 */
export function useRevealDelay(ref: RefObject<Element | null>, cue: Cue, stagger = 0): { visible: boolean; delay: number } {
  const visible = useInView(ref, { once: true, margin: '0px 0px -8% 0px' })
  const [delay, setDelay] = useState<number | null>(null)
  if (visible && delay === null) setDelay(cueDelay(cue, stagger))
  return { visible, delay: delay ?? 0 }
}
