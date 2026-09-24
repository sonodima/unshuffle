// Tiny shell-wide state: which screen is on stage (set by ScreenRouter), so
// global chrome can adapt its placement without screens knowing about it.

import { useSyncExternalStore } from 'react'
import type { ScreenKey } from './routing'

let screen: ScreenKey = 'home'
const listeners = new Set<() => void>()

export function setCurrentScreen(next: ScreenKey): void {
  if (next === screen) return
  screen = next
  for (const l of [...listeners]) l()
}

/** Non-React subscription to screen changes (the HUD tracker uses it). */
export function subscribeCurrentScreen(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const getCurrentScreen = (): ScreenKey => screen

export function useCurrentScreen(): ScreenKey {
  return useSyncExternalStore(subscribeCurrentScreen, getCurrentScreen, getCurrentScreen)
}

export type FloatingDock = 'top-right' | 'bottom-right' | 'hidden'

/**
 * Where the floating sound control may sit without covering a screen's HUD.
 * Screens that mount <SoundControls placement="inline" /> override this entirely.
 * - round: the HUD owns the top corners → bottom-right corner on large screens (≥ 1180px);
 *   below that hidden while playing (the HUD mounts an inline control), top-right otherwise.
 *   (The reveal header mounts an inline control at every width.)
 * - final: the header mounts an inline control at every width → never floating.
 */
export function floatingDock(current: ScreenKey, viewportWidth: number, phaseKind?: string | null): FloatingDock {
  switch (current) {
    case 'round':
      // Only the play phase's HUD owns the top corners (and hosts an inline control below 1180px).
      if (viewportWidth >= 1180) return 'bottom-right'
      return phaseKind === 'playing' ? 'hidden' : 'top-right'
    case 'final':
      return 'hidden'
    default:
      return 'top-right'
  }
}
