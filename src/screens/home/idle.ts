// Timing helpers of the Home screen, kept free of React so they can be unit
// tested with fake clocks (tests/unit/home-idle.test.ts).

type TimerId = ReturnType<typeof setTimeout>

export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): TimerId
  clearTimeout(id: TimerId | undefined): void
}

const realClock: Clock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
}

export interface IdleTracker {
  /** Record user input (cheap while active: just stamps the time). */
  activity(): void
  isIdle(): boolean
  dispose(): void
}

/**
 * Calls `onChange(true)` once nothing has called `activity()` for `ms`, and
 * `onChange(false)` on the first activity after that. One timer per quiet
 * period (re-armed lazily), not one per event.
 */
export function createIdleTracker(ms: number, onChange: (idle: boolean) => void, clock: Clock = realClock): IdleTracker {
  let last = clock.now()
  let idle = false
  let disposed = false
  let timer: TimerId | undefined

  const arm = (delay: number) => {
    clock.clearTimeout(timer)
    timer = clock.setTimeout(check, Math.max(0, delay))
  }
  function check() {
    timer = undefined
    if (disposed) return
    const quiet = clock.now() - last
    if (quiet >= ms) {
      idle = true
      onChange(true)
    } else {
      arm(ms - quiet)
    }
  }
  arm(ms)

  return {
    activity() {
      if (disposed) return
      last = clock.now()
      if (!idle) return
      idle = false
      onChange(false)
      arm(ms)
    },
    isIdle: () => idle,
    dispose() {
      disposed = true
      clock.clearTimeout(timer)
      timer = undefined
    },
  }
}

export interface BootIdleEnv {
  setTimeout(fn: () => void, ms: number): TimerId
  clearTimeout(id: TimerId | undefined): void
  requestIdleCallback?: (fn: () => void, opts: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
  /** Resolves when the web fonts are ready (never rejects). */
  fontsReady(): Promise<unknown>
}

function browserEnv(): BootIdleEnv {
  const w = (typeof window === 'undefined' ? {} : window) as Partial<
    Pick<Window, 'requestIdleCallback' | 'cancelIdleCallback'>
  >
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    requestIdleCallback: typeof w.requestIdleCallback === 'function' ? (fn, opts) => w.requestIdleCallback!(fn, opts) : undefined,
    cancelIdleCallback: typeof w.cancelIdleCallback === 'function' ? (id) => w.cancelIdleCallback!(id) : undefined,
    fontsReady: () =>
      typeof document !== 'undefined' && document.fonts ? document.fonts.ready.catch(() => undefined) : Promise.resolve(),
  }
}

/** Longest wait for an idle slot once the delay and the fonts are through. */
export const BOOT_IDLE_TIMEOUT_MS = 4000

/**
 * Runs `fn` once: after `delayMs`, then the web fonts, then an idle slot
 * (requestIdleCallback, capped; a short timeout where it doesn't exist).
 * Returns a cancel function.
 */
export function afterBootIdle(delayMs: number, fn: () => void, env: BootIdleEnv = browserEnv()): () => void {
  let cancelled = false
  let idleId: number | undefined
  let fallback: TimerId | undefined
  const run = () => {
    if (!cancelled) fn()
  }
  const timer = env.setTimeout(() => {
    void env.fontsReady().then(() => {
      if (cancelled) return
      if (env.requestIdleCallback) idleId = env.requestIdleCallback(run, { timeout: BOOT_IDLE_TIMEOUT_MS })
      else fallback = env.setTimeout(run, 200)
    })
  }, delayMs)
  return () => {
    cancelled = true
    env.clearTimeout(timer)
    env.clearTimeout(fallback)
    if (idleId !== undefined) env.cancelIdleCallback?.(idleId)
  }
}
