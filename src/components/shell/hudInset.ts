// Where the on-stage screen's pinned HUD ends (px from the top of the viewport),
// so global chrome (toasts, the reconnect banner) can sit under it instead of
// covering the timer, round and score. Screens opt in with a `data-shell-hud`
// attribute on their HUD; the play screen's header is recognised as well.
//
// Measured lazily and cheaply: only while something listens, in short rAF bursts
// after a screen / phase change (entrance animations), on resize, when the HUD
// resizes, plus a 1 s heartbeat for late mounts. null = no pinned HUD on stage.

import { useSyncExternalStore } from 'react'
import { useGame } from '../../game/store'
import type { GameStore } from '../../game/store'
import { hudBottomFrom } from './layout'
import type { BannerBox } from './layout'
import { subscribeCurrentScreen } from './shellState'

export { stackTop, type BannerBox } from './layout'

const LIVE_FRAME = '[data-screen-frame]:not([inert])'
export const HUD_SELECTOR = `${LIVE_FRAME} [data-shell-hud], ${LIVE_FRAME} [data-round-view="playing"] > header`

const BURST_MS = 1600

let value: number | null = null
const listeners = new Set<() => void>()
let stopTracking: (() => void) | null = null

function publish(next: number | null): void {
  if (next === value) return
  value = next
  for (const l of [...listeners]) l()
}

function measure(): { el: Element | null; bottom: number | null } {
  let el: Element | null = null
  try {
    el = document.querySelector(HUD_SELECTOR)
  } catch {
    el = null
  }
  return { el, bottom: hudBottomFrom(el ? el.getBoundingClientRect() : null, window.innerHeight || 0) }
}

function phaseKey(s: Pick<GameStore, 'role' | 'room'>): string {
  const phase = s.room?.phase
  return `${s.role}:${phase?.kind ?? '-'}:${phase && 'round' in phase ? phase.round : ''}`
}

function start(): () => void {
  let raf = 0
  let burstUntil = 0
  let observed: Element | null = null
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => kick(300)) : null

  const tick = () => {
    raf = 0
    const { el, bottom } = measure()
    if (el !== observed) {
      if (observed) ro?.unobserve(observed)
      observed = el
      if (el) ro?.observe(el)
    }
    publish(bottom)
    if (performance.now() < burstUntil) raf = requestAnimationFrame(tick)
  }
  function kick(ms: number): void {
    burstUntil = Math.max(burstUntil, performance.now() + ms)
    if (!raf) raf = requestAnimationFrame(tick)
  }

  const onResize = () => kick(600)
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  const offScreen = subscribeCurrentScreen(() => kick(BURST_MS))
  let lastPhase = phaseKey(useGame.getState())
  const offGame = useGame.subscribe((s) => {
    const k = phaseKey(s)
    if (k === lastPhase) return
    lastPhase = k
    kick(BURST_MS)
  })
  const heartbeat = setInterval(() => kick(0), 1000)
  kick(BURST_MS)

  return () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    clearInterval(heartbeat)
    offScreen()
    offGame()
    ro?.disconnect()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  if (listeners.size === 1 && typeof window !== 'undefined' && !stopTracking) {
    try {
      stopTracking = start()
    } catch {
      stopTracking = null
    }
  }
  return () => {
    listeners.delete(l)
    if (listeners.size === 0 && stopTracking) {
      stopTracking()
      stopTracking = null
      value = null
    }
  }
}

const get = () => value
const getServer = () => null

/** Bottom edge (viewport px) of the pinned HUD on stage, or null when there is none. */
export function useHudBottom(): number | null {
  return useSyncExternalStore(subscribe, get, getServer)
}

// ---------------------------------------------------------------------------
// Top status banner (ConnectionOverlay): toasts stack under it instead of on it.

let banner: BannerBox | null = null
const bannerListeners = new Set<() => void>()

/** Where the visible status banner is, or null once it goes away. */
export function setBannerBox(next: BannerBox | null): void {
  const v = next && Number.isFinite(next.bottom) ? { bottom: Math.round(next.bottom), left: Math.round(next.left), right: Math.round(next.right) } : null
  if (v === banner || (v && banner && v.bottom === banner.bottom && v.left === banner.left && v.right === banner.right)) return
  banner = v
  for (const l of [...bannerListeners]) l()
}

function subscribeBanner(l: () => void): () => void {
  bannerListeners.add(l)
  return () => {
    bannerListeners.delete(l)
  }
}

const getBanner = () => banner

export function useBannerBox(): BannerBox | null {
  return useSyncExternalStore(subscribeBanner, getBanner, getServer)
}
