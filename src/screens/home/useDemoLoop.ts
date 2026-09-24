// Choreography of the decorative Home demo: a timed loop (listen → drag the
// blocks back one by one → solved → reshuffle) that only runs while its element
// is on screen and the tab is visible, and that comes to rest on the solved
// board once the user is idle (it wakes up with a reshuffle on the next input).
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { applyMove, identity, makeShuffle, planSort } from './demoScript'

export type DemoPhase = 'listen' | 'sort' | 'solved' | 'shuffle'

export interface DemoState {
  /** order[position] = block id. */
  order: number[]
  phase: DemoPhase
  /** Position currently "playing" (-1 = none). */
  playing: number
  /** Block id being dragged (-1 = none). */
  lifted: number
  /** Loop counter (bumps on every reshuffle). */
  cycle: number
  /** Date.now() when the current round started (listen) and when it was solved (0 = not yet). */
  startedAt: number
  solvedAt: number
  /** Parked on the solved board because the user is idle (nothing animates). */
  resting: boolean
  /** Temporarily stopped: off-screen, hidden tab or `paused` (freeze clocks too). */
  frozen: boolean
}

interface DemoTiming {
  playMs: number
  liftMs: number
  moveMs: number
  settleMs: number
  solvedMs: number
  shuffleMs: number
}

export const DEMO_TIMING: DemoTiming = { playMs: 240, liftMs: 260, moveMs: 520, settleMs: 200, solvedMs: 2700, shuffleMs: 1150 }

function movesFor(n: number): [number, number] {
  return n >= 8 ? [4, 5] : n >= 6 ? [3, 4] : [2, 3]
}

type LoopState = Omit<DemoState, 'frozen'>

/**
 * Runs the demo choreography while `ref` is on screen and the tab is visible.
 * `rest`: finish the current cycle, then park on the solved board until it
 * turns false again. With reduced motion it rests on the solved board.
 */
export function useDemoLoop(n: number, ref: RefObject<Element | null>, paused = false, rest = false): DemoState {
  const reduce = useReducedMotion()
  const [state, setState] = useState<LoopState>(() => ({
    order: makeShuffle(n, ...movesFor(n)),
    phase: 'shuffle',
    playing: -1,
    lifted: -1,
    cycle: 0,
    startedAt: 0,
    solvedAt: 0,
    resting: false,
  }))
  const [hidden, setHidden] = useState(false)

  const visible = useRef(true)
  const pausedRef = useRef(paused)
  const restRef = useRef(rest)
  const waiters = useRef(new Set<() => void>())
  const wakers = useRef(new Set<() => void>())

  const release = (set: Set<() => void>) => {
    const pending = [...set]
    set.clear()
    for (const resolve of pending) resolve()
  }
  const flush = () => {
    if (visible.current && !pausedRef.current) release(waiters.current)
  }

  useEffect(() => {
    pausedRef.current = paused
    flush()
  }, [paused])

  useEffect(() => {
    restRef.current = rest
    if (!rest) release(wakers.current)
  }, [rest])

  useEffect(() => {
    const el = ref.current
    let onScreen = true
    const update = () => {
      visible.current = onScreen && document.visibilityState !== 'hidden'
      setHidden(!visible.current)
      flush()
    }
    const io =
      el && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting)
            update()
          })
        : null
    if (el && io) io.observe(el)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      io?.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [ref])

  useEffect(() => {
    if (reduce) return
    const pending = waiters.current
    const sleeping = wakers.current
    let alive = true
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const STOP = Symbol('stop')
    const gate = () =>
      visible.current && !pausedRef.current ? Promise.resolve() : new Promise<void>((resolve) => waiters.current.add(resolve))
    const wait = async (ms: number) => {
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          timers.delete(t)
          resolve()
        }, ms)
        timers.add(t)
      })
      await gate()
      if (!alive) throw STOP
    }
    const patch = (p: Partial<LoopState>) => {
      if (alive) setState((s) => ({ ...s, ...p }))
    }
    // Idle: stay on the solved board until the user is back.
    const restIfIdle = async () => {
      if (!restRef.current) return
      patch({ resting: true })
      await new Promise<void>((resolve) => (restRef.current ? sleeping.add(resolve) : resolve()))
      await gate()
      if (!alive) throw STOP
      patch({ resting: false })
    }

    const run = async () => {
      let order = makeShuffle(n, ...movesFor(n))
      let cycle = 0
      patch({ order, phase: 'shuffle', playing: -1, lifted: -1, cycle, startedAt: 0, solvedAt: 0, resting: false })
      await wait(700)
      for (;;) {
        patch({ phase: 'listen', startedAt: Date.now(), solvedAt: 0 })
        for (let p = 0; p < n; p++) {
          patch({ playing: p })
          await wait(DEMO_TIMING.playMs)
        }
        patch({ playing: -1, phase: 'sort' })
        await wait(360)
        for (const move of planSort(order)) {
          patch({ lifted: move.id })
          await wait(DEMO_TIMING.liftMs)
          order = applyMove(order, move.from, move.to)
          patch({ order })
          await wait(DEMO_TIMING.moveMs)
          patch({ lifted: -1 })
          await wait(DEMO_TIMING.settleMs)
        }
        patch({ phase: 'solved', solvedAt: Date.now() })
        await wait(DEMO_TIMING.solvedMs)
        await restIfIdle()
        order = makeShuffle(n, ...movesFor(n))
        cycle++
        patch({ order, phase: 'shuffle', cycle, startedAt: 0, solvedAt: 0 })
        await wait(DEMO_TIMING.shuffleMs)
      }
    }
    run().catch((err) => {
      if (err !== STOP) console.warn('[home] demo stopped', err)
    })
    return () => {
      alive = false
      for (const t of timers) clearTimeout(t)
      timers.clear()
      pending.clear()
      sleeping.clear()
    }
  }, [n, reduce])

  const frozen = hidden || paused
  // Reduced motion: rest on the solved board (no loop at all).
  return useMemo(() => (reduce ? solvedState(n) : { ...state, frozen }), [reduce, n, state, frozen])
}

function solvedState(n: number): DemoState {
  return { order: identity(n), phase: 'solved', playing: -1, lifted: -1, cycle: 0, startedAt: 0, solvedAt: 0, resting: true, frozen: false }
}
