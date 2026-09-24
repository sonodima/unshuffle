import { useCallback, useSyncExternalStore } from 'react'

/** Subscribes to a CSS media query (SSR-safe default: false). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}

/** True on devices with a real hover-capable pointer (mouse / trackpad). */
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)')
}

/** Tailwind `sm` breakpoint and up (≥ 640px): centered modals instead of bottom sheets. */
export function useIsWide(): boolean {
  return useMediaQuery('(min-width: 640px)')
}

/**
 * Italian number formatting: 13840 → "13.840", 4428 → "4.428". Grouping is forced
 * ('always'): plain it-IT leaves 4-digit numbers ungrouped, so scores like "4428"
 * would sit next to "18.571" (Final and Reveal use the same rule).
 */
const nf = new Intl.NumberFormat('it-IT', { useGrouping: 'always' })
export function formatNumber(n: number): string {
  return nf.format(Math.round(n))
}

/** 65000 → "1:05", 9000 → "0:09". Ceil so a timer never shows 0 while time remains. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: 'translate3d(0,0,0)' },
  { transform: 'translate3d(-7px,0,0)' },
  { transform: 'translate3d(6px,0,0)' },
  { transform: 'translate3d(-5px,0,0)' },
  { transform: 'translate3d(3px,0,0)' },
  { transform: 'translate3d(-1px,0,0)' },
  { transform: 'translate3d(0,0,0)' },
]

/** Horizontal "nope" shake via the Web Animations API (no remount, keeps focus). */
export function shakeElement(el: Element | null | undefined): void {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  ;(el as HTMLElement).animate(SHAKE_KEYFRAMES, { duration: 420, easing: 'cubic-bezier(.36,.07,.19,.97)' })
}
