import { expect, test } from 'bun:test'
import { BOOT_IDLE_TIMEOUT_MS, afterBootIdle, createIdleTracker, type BootIdleEnv, type Clock } from '../../src/screens/home/idle'

/** Deterministic clock: timers fire only when `advance` passes them. */
function fakeClock() {
  let t = 0
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const clock: Clock = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = ++seq
      timers.set(id, { at: t + ms, fn })
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout: (id) => {
      if (id !== undefined) timers.delete(id as unknown as number)
    },
  }
  const advance = (ms: number) => {
    const end = t + ms
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null
      for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e
      if (!next) break
      timers.delete(next[0])
      t = next[1].at
      next[1].fn()
    }
    t = end
  }
  return { clock, advance, pending: () => timers.size }
}

test('idle fires after a quiet period, once', () => {
  const { clock, advance } = fakeClock()
  const changes: boolean[] = []
  const tracker = createIdleTracker(15_000, (v) => changes.push(v), clock)
  advance(14_999)
  expect(changes).toEqual([])
  advance(1)
  expect(changes).toEqual([true])
  expect(tracker.isIdle()).toBe(true)
  advance(60_000)
  expect(changes).toEqual([true])
})

test('activity pushes the deadline back without re-arming per event', () => {
  const { clock, advance, pending } = fakeClock()
  const changes: boolean[] = []
  const tracker = createIdleTracker(10_000, (v) => changes.push(v), clock)
  for (let i = 0; i < 50; i++) {
    advance(1_000)
    tracker.activity()
    expect(pending()).toBe(1)
  }
  expect(changes).toEqual([])
  advance(9_999)
  expect(changes).toEqual([])
  advance(1)
  expect(changes).toEqual([true])
})

test('the first input after idle wakes it and starts a new quiet period', () => {
  const { clock, advance } = fakeClock()
  const changes: boolean[] = []
  const tracker = createIdleTracker(5_000, (v) => changes.push(v), clock)
  advance(5_000)
  tracker.activity()
  tracker.activity()
  expect(changes).toEqual([true, false])
  expect(tracker.isIdle()).toBe(false)
  advance(5_000)
  expect(changes).toEqual([true, false, true])
})

test('dispose stops everything', () => {
  const { clock, advance, pending } = fakeClock()
  const changes: boolean[] = []
  const tracker = createIdleTracker(5_000, (v) => changes.push(v), clock)
  tracker.dispose()
  expect(pending()).toBe(0)
  advance(20_000)
  tracker.activity()
  expect(changes).toEqual([])
})

function bootEnv(opts: { idle: boolean }) {
  const { clock, advance } = fakeClock()
  let fontsResolve: () => void = () => {}
  const fonts = new Promise<void>((r) => (fontsResolve = r))
  const idleCalls: { fn: () => void; timeout: number }[] = []
  const cancelled: number[] = []
  const env: BootIdleEnv = {
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    fontsReady: () => fonts,
    ...(opts.idle
      ? {
          requestIdleCallback: (fn: () => void, o: { timeout: number }) => idleCalls.push({ fn, timeout: o.timeout }),
          cancelIdleCallback: (id: number) => cancelled.push(id),
        }
      : {}),
  }
  return { env, advance, fontsResolve: () => fontsResolve(), idleCalls, cancelled }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

test('afterBootIdle waits for the delay, then the fonts, then an idle slot', async () => {
  const b = bootEnv({ idle: true })
  let ran = 0
  afterBootIdle(3_000, () => ran++, b.env)
  b.fontsResolve()
  await flush()
  expect(b.idleCalls.length).toBe(0) // fonts are ready, but the delay isn't over
  b.advance(3_000)
  await flush()
  expect(b.idleCalls.length).toBe(1)
  expect(b.idleCalls[0].timeout).toBe(BOOT_IDLE_TIMEOUT_MS)
  expect(ran).toBe(0)
  b.idleCalls[0].fn()
  expect(ran).toBe(1)
})

test('afterBootIdle: slow fonts hold it back; without requestIdleCallback a short timeout runs it', async () => {
  const b = bootEnv({ idle: false })
  let ran = 0
  afterBootIdle(1_000, () => ran++, b.env)
  b.advance(5_000)
  await flush()
  expect(ran).toBe(0) // still waiting for the fonts
  b.fontsResolve()
  await flush()
  b.advance(199)
  expect(ran).toBe(0)
  b.advance(1)
  expect(ran).toBe(1)
})

test('afterBootIdle can be cancelled at any stage', async () => {
  const early = bootEnv({ idle: true })
  let ran = 0
  const cancelEarly = afterBootIdle(1_000, () => ran++, early.env)
  cancelEarly()
  early.fontsResolve()
  early.advance(10_000)
  await flush()
  expect(early.idleCalls.length).toBe(0)

  const late = bootEnv({ idle: true })
  const cancelLate = afterBootIdle(1_000, () => ran++, late.env)
  late.fontsResolve()
  late.advance(1_000)
  await flush()
  expect(late.idleCalls.length).toBe(1)
  cancelLate()
  expect(late.cancelled.length).toBe(1)
  late.idleCalls[0].fn() // a callback that slipped through still does nothing
  expect(ran).toBe(0)
})
