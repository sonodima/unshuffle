// Small React helpers for the round views.
import { useEffect, useLayoutEffect, useRef } from 'react'

/** Calls `fn(value, previous)` whenever `value` changes after mount (not on mount). */
export function useOnChange<T>(value: T, fn: (value: T, previous: T) => void): void {
  const prev = useRef(value)
  const fnRef = useRef(fn)
  useLayoutEffect(() => {
    fnRef.current = fn
  })
  useEffect(() => {
    if (Object.is(prev.current, value)) return
    const p = prev.current
    prev.current = value
    fnRef.current(value, p)
  }, [value])
}

/**
 * Keeps the previous reference while the value is structurally equal. RoomState
 * arrives as fresh JSON on every host broadcast; stable segment / hue arrays spare
 * the board needless recomputation.
 */
export function useStable<T>(value: T): T {
  const ref = useRef<{ value: T; key: string } | null>(null)
  const key = JSON.stringify(value)
  if (!ref.current || ref.current.key !== key) ref.current = { value, key }
  return ref.current.value
}
