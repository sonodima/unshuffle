// Picks the screen from the hash route + store state and cross-fades between
// screens (fast fade, slight scale + blur). Each screen gets a full-viewport,
// transparent frame (the shader shows through) with its own crash boundary.

import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useGame } from '../../game/store'
import { navigate, useHashRoute } from '../../lib/router'
import { HomeScreen } from '../../screens/home/HomeScreen'
import { Spinner } from '../ui'
import { CrashScreen, ErrorBoundary } from './ErrorBoundary'
import { screenTitle, selectScreen } from './routing'
import { setCurrentScreen } from './shellState'
import type { ScreenKey } from './routing'

/**
 * Code-split screen: the chunk loads on first use, or earlier via `preload()`.
 * A failed load is forgotten so the crash screen's "Riprova" can fetch it again.
 */
function lazyScreen<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  let pending: Promise<{ default: ComponentType }> | null = null
  const preload = () =>
    (pending ??= load().then(
      (m) => ({ default: pick(m) }),
      (err: unknown) => {
        pending = null
        throw err
      },
    ))
  return { Component: lazy(preload), preload }
}

// Home is what a fresh visitor (often a phone that just scanned the QR) needs first;
// everything else streams in right after boot (see preloadScreens).
const Lobby = lazyScreen(() => import('../../screens/lobby/LobbyScreen'), (m) => m.LobbyScreen)
const Round = lazyScreen(() => import('../../screens/round/RoundScreen'), (m) => m.RoundScreen)
const Final = lazyScreen(() => import('../../screens/final/FinalScreen'), (m) => m.FinalScreen)
const Styleguide = lazyScreen(() => import('../../screens/Styleguide'), (m) => m.StyleguideScreen)

const DEFAULT_SCREENS: Record<ScreenKey, ComponentType> = {
  home: HomeScreen,
  lobby: Lobby.Component,
  round: Round.Component,
  final: Final.Component,
  styleguide: Styleguide.Component,
}

/** Warm the game screens' chunks (idempotent). Called by ScreenRouter once the first screen is up. */
export function preloadScreens(): void {
  for (const s of [Lobby, Round, Final]) s.preload().catch(() => undefined)
}

/** After the web fonts (they share the connection with the chunks), then at idle. */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  let cancelled = false
  let cancelInner = () => {}
  const schedule = () => {
    if (cancelled) return
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(fn, { timeout: 2500 })
      cancelInner = () => w.cancelIdleCallback?.(id)
    } else {
      const id = setTimeout(fn, 1200)
      cancelInner = () => clearTimeout(id)
    }
  }
  let fonts: Promise<unknown> | null = null
  try {
    fonts = document.fonts?.ready ?? null
  } catch {
    fonts = null
  }
  if (fonts) {
    // Never wait forever on a font that stalls.
    const cap = setTimeout(schedule, 3000)
    void fonts.then(
      () => {
        clearTimeout(cap)
        schedule()
      },
      () => {
        clearTimeout(cap)
        schedule()
      },
    )
    cancelInner = () => clearTimeout(cap)
  } else schedule()
  return () => {
    cancelled = true
    cancelInner()
  }
}

export interface ScreenRouterProps {
  /** Replace screens (labs/tests). */
  screens?: Partial<Record<ScreenKey, ComponentType>>
  /** Force a screen instead of deriving it from route + store (labs). */
  forceScreen?: ScreenKey
}

export function ScreenRouter({ screens, forceScreen }: ScreenRouterProps) {
  const route = useHashRoute()
  // Primitive selectors: room updates (up to 20/s in game) don't re-render the router.
  const derived = useGame((s) => selectScreen({ route: route.name, role: s.role, room: s.room }))
  const screen = forceScreen ?? derived
  const lost = useGame((s) => s.room !== null && s.role === 'client' && (s.connection === 'closed' || s.connection === 'error'))
  const title = useGame((s) => screenTitle(screen, s.room, lost))
  // Screen-level crash recovery gets another chance when the phase moves on.
  const phaseKey = useGame((s) => (s.room ? `${s.room.phase.kind}:${'round' in s.room.phase ? s.room.phase.round : ''}` : 'none'))
  const Screen = screens?.[screen] ?? DEFAULT_SCREENS[screen]

  useEffect(() => setCurrentScreen(screen), [screen])
  useEffect(() => whenIdle(preloadScreens), [])

  useEffect(() => {
    try {
      document.title = title
    } catch {
      // ignore
    }
  }, [title])

  return (
    <AnimatePresence initial={false}>
      <ScreenFrame key={screen} screen={screen}>
        <ErrorBoundary
          name={`screen:${screen}`}
          resetKeys={[phaseKey]}
          fallback={({ error, reset }) => (
            <CrashScreen
              variant="screen"
              error={error}
              reset={reset}
              canRetry
              onHome={
                screen === 'home'
                  ? undefined
                  : () => {
                      try {
                        useGame.getState().leave()
                      } catch {
                        // ignore
                      }
                      navigate('/', { replace: true })
                      reset()
                    }
              }
            />
          )}
        >
          <Suspense fallback={<ScreenLoading />}>
            <Screen />
          </Suspense>
        </ErrorBoundary>
      </ScreenFrame>
    </AnimatePresence>
  )
}

function ScreenLoading() {
  return (
    <div className="grid h-dvh place-items-center text-ink-300">
      <Spinner size={28} />
    </div>
  )
}

const ENTER_EASE = [0.16, 1, 0.3, 1] as const

function ScreenFrame({ screen, children }: { screen: ScreenKey; children: ReactNode }) {
  const present = useIsPresent()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // Keyboard / screen-reader users land on the new screen instead of a dead, inert one.
  useLayoutEffect(() => {
    const frame = ref.current
    if (!frame) return
    const id = requestAnimationFrame(() => {
      const active = document.activeElement
      const stranded = !active || active === document.body || (!!active.closest('[data-screen-frame]') && !frame.contains(active))
      if (stranded) frame.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <motion.div
      ref={ref}
      data-screen-frame=""
      data-screen={screen}
      tabIndex={-1}
      inert={!present}
      aria-hidden={present ? undefined : true}
      className="fixed inset-0 overflow-x-hidden overflow-y-auto overscroll-contain outline-none"
      style={{ zIndex: present ? 1 : 0, pointerEvents: present ? undefined : 'none' }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985, filter: 'blur(8px)' }}
      animate={
        reduce
          ? { opacity: 1, transition: { duration: 0.2 } }
          : {
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)',
              // A lingering filter would make this frame a backdrop root and a
              // containing block for fixed children: drop it once settled.
              transitionEnd: { filter: 'none' },
              transition: { duration: 0.34, ease: ENTER_EASE },
            }
      }
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { opacity: 0, scale: 1.015, filter: 'blur(6px)', transition: { duration: 0.18, ease: 'easeIn' } }
      }
    >
      {children}
    </motion.div>
  )
}
