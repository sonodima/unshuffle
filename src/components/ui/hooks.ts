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
