// "Is anybody there?" for Home's decorative loops. The demo, the hero glow and
// the invite halo cost a steady slice of CPU/GPU (style, paint and compositing
// under glass blur every frame), so once nobody has moved, touched, typed or
// scrolled for a while they come to rest; the next gesture wakes them.
import { useEffect, useState } from 'react'
import { createIdleTracker } from './idle'

/** No input for this long = idle. Two demo cycles fit in it after load. */
export const HOME_IDLE_MS = 15_000

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin', 'input', 'scroll'] as const

/**
 * True once there has been no user input for `ms` (false again on the next
 * input, or when the tab becomes visible again).
 */
export function useUserIdle(ms: number = HOME_IDLE_MS): boolean {
  // Remembers which quiet period it belongs to, so a new `ms` starts out active.
  const [idleFor, setIdleFor] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tracker = createIdleTracker(ms, (idle) => setIdleFor(idle ? ms : null))
    const onActivity = () => tracker.activity()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tracker.activity()
    }
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, opts)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      tracker.dispose()
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity, opts)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ms])

  return idleFor === ms
}
