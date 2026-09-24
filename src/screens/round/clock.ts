// Timing hooks for the round views. Views receive `now` (host clock, re-rendered
// ~4×/s by the connected screen); countdown steps need exact boundaries, so they
// extrapolate between updates and schedule a re-render right on each step.
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react'

export type Clock = () => number

/**
 * A stable host-clock function. With `override` (the real `hostNow`) it is
 * used as-is; otherwise it extrapolates from the latest `now` prop with
 * performance.now().
 */
export function useClock(now: number, override?: Clock): Clock {
  const base = useRef({ now, perf: typeof performance !== 'undefined' ? performance.now() : 0 })
  const overrideRef = useRef(override)
  useLayoutEffect(() => {
    base.current = { now, perf: performance.now() }
  }, [now])
  useLayoutEffect(() => {
    overrideRef.current = override
  })
  return useCallback(() => {
    const o = overrideRef.current
    if (o) return o()
    return base.current.now + (performance.now() - base.current.perf)
  }, [])
}

/**
 * Whole `stepMs` steps left until `target` (ceil, never negative). Re-renders
 * exactly when the value changes, independent of how often the parent renders.
 */
export function useStepsLeft(target: number, clock: Clock, stepMs = 1000): number {
  const [tick, bump] = useReducer((x: number) => x + 1, 0)
  const steps = Math.max(0, Math.ceil((target - clock()) / stepMs))
  useEffect(() => {
    if (steps <= 0) return
    const rem = target - clock()
    // Time until the value drops to steps-1, plus a hair so ceil() has moved on.
    const delay = Math.max(20, rem - (steps - 1) * stepMs + 4)
    const id = setTimeout(bump, delay)
    return () => clearTimeout(id)
  }, [steps, target, clock, stepMs, tick])
  return steps
}
