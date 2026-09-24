// Frame pacing and adaptive quality for the background loop. Pure logic (no DOM,
// no GL) so it can be unit-tested with simulated frame timings.
//
// - Frame rate: 60 fps, capped at 30 while the scene is silent (nothing to react
//   to: the plasma only drifts) or with reduced motion.
// - Quality: measured in windows of about a second. Too slow → jump down to the
//   level the cost model says fits and keep stepping while it helps. Still too
//   slow at the bottom, or the last steps stopped helping (the rest of the frame
//   isn't ours) → halve the frame rate. Lowering never helped → we aren't the
//   bottleneck: restore and stop adapting. Fast for a while → probe back up.

import type { AudioLevels } from '../../audio/engine'
import type { ReactorState } from './reactor'

interface QualityLevel {
  /** Relative to the device base scale (desktop 0.75, touch 0.5 internal px per CSS px). */
  scale: number
  octaves: number
}

export const QUALITY: readonly QualityLevel[] = [
  { scale: 1, octaves: 5 },
  { scale: 0.84, octaves: 4 },
  { scale: 0.7, octaves: 4 },
  { scale: 0.56, octaves: 3 },
]
const LOWEST = QUALITY.length - 1

/** Ignore the first frames after a (re)start: compile, upload and page load noise. */
const WARMUP_MS = 1000
/** The first window after a (re)start is short, so a slow GPU is caught quickly. */
const FIRST_WINDOW_MS = 500
const WINDOW_MS = 1000
const WINDOW_FRAMES = 60
const MIN_WINDOW_FRAMES = 6
/** Frames right after a level or cap change are not representative. */
const SETTLE_MS = 120
/** After a shader variant lands: drivers finish compiling on first use (hitches). */
const SWITCH_SETTLE_MS = 250
const SLOW_FRAME_MS = 20
const GOOD_FRAME_MS = 17.6
const GOOD_WINDOWS = 8
const MAX_UPGRADES = 2
/** A silent scene switches to 30 fps after this long. */
export const IDLE_AFTER_MS = 1000

/** Longest typical frame interval (ms) that still counts as keeping up at `fps`. */
export const budgetFor = (fps: number): number => (fps >= 60 ? SLOW_FRAME_MS : 1000 / fps + 4)
const goodFor = (fps: number): number => (fps >= 60 ? GOOD_FRAME_MS : 1000 / fps + 1.5)

/** Relative shader work per internal pixel: fixed layers + the two FBM loops (OCTAVES and OCTAVES − 2 taps). */
export function shaderWork(octaves: number): number {
  return 4 + octaves + Math.max(2, octaves - 2)
}

/** Relative frame cost of a level (per CSS px², before the pixel cap). */
export function levelWork(level: number): number {
  const q = QUALITY[level]
  return q.scale * q.scale * shaderWork(q.octaves)
}

/**
 * Mean frame interval without the slowest 10% (one-off hitches). A median would
 * miss alternating 16.7/33.3 ms frames, the typical vsync pattern of a ~25 ms load.
 */
function typicalInterval(values: readonly number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const n = Math.max(1, Math.floor(s.length * 0.9))
  let sum = 0
  for (let i = 0; i < n; i++) sum += s[i]
  return sum / n
}

/**
 * True when there is nothing to react to: no music (same thresholds as the
 * reactor's presence), no beat flash and no ring on screen, and the flow has
 * slowed back to its idle drift. What's left of a fading presence is a slow
 * crossfade to the idle breathing, which 30 fps renders just as smoothly.
 */
export function isQuiet(levels: AudioLevels, r: ReactorState): boolean {
  if (levels.beat > 0.05 || levels.energy > 0.02 || levels.bass > 0.03) return false
  if (r.presence > 0.25 || r.energy > 0.08 || r.bass > 0.02 || r.flash > 0) return false
  for (let i = 0; i < r.ringAmp.length; i++) if (r.ringAmp[i] > 0) return false
  return true
}

/** Starting level: one step down on clearly low-end hardware (the governor probes back up). */
export function initialLevel(deviceMemory: number | undefined, cores: number | undefined): number {
  const low = (x: number | undefined) => typeof x === 'number' && x > 0 && x <= 2
  return low(deviceMemory) || low(cores) ? 1 : 0
}

export interface Governor {
  /** Current quality level (index into QUALITY). */
  readonly level: number
  /** Halved frame rate: the last resort once quality can't go lower (or lowering stopped helping). */
  readonly throttled: boolean
  /** Frame rate to pace at: 30 when throttled or capped by `setCap`, else 60. */
  readonly fps: number
  /** Adaptation stopped for good (lowering never helped, or an upgrade failed). */
  readonly locked: boolean
  /** External ceiling: 30 while silent or with reduced motion, else 60. A change cancels a probe in flight. */
  setCap(fps: number, now: number): void
  /** Start measuring again after a warmup (start, resize, resume). */
  restart(now: number): void
  /** Drop the window being collected (e.g. while a shader variant is compiling). */
  discard(): void
  /** A shader variant switch just landed: drop the window and skip the next frames. */
  switched(now: number): void
  /** One rendered frame, drawn `sinceMs` after the previous one. Returns true when the level changed. */
  frame(sinceMs: number, now: number): boolean
}

interface GovernorOptions {
  initial?: number
  /** Relative cost of drawing a frame at a level (default: `levelWork`). Used to size the first step down. */
  cost?: (level: number) => number
}

interface Probe {
  kind: 'down' | 'up'
  /** Level and throttle to go back to if the probe fails. */
  base: number
  baseThrottled: boolean
  /** Typical interval measured at the base. */
  baseMed: number
}

export function createGovernor(opts: GovernorOptions = {}): Governor {
  const cost = opts.cost ?? levelWork
  let level = Math.max(0, Math.min(LOWEST, Math.round(opts.initial ?? 0)))
  let throttled = false
  let cap = 60
  let intervals: number[] = []
  let sum = 0
  /** Windows closed since the last (re)start or cap change. */
  let windows = 0
  let measureFrom = Infinity
  let locked = false
  /** A step down has made frames faster at least once: the GPU is (part of) the bottleneck. */
  let gpuBound = false
  let goodWindows = 0
  let upgrades = 0
  let probe: Probe | null = null

  const fps = () => (throttled || cap < 60 ? 30 : 60)

  function clearWindow(): void {
    intervals = []
    sum = 0
  }

  function settle(now: number, ms = SETTLE_MS): void {
    clearWindow()
    measureFrom = Math.max(measureFrom, now + ms)
  }

  function set(next: number, now: number): void {
    level = next
    settle(now)
  }

  function throttle(on: boolean, now: number): void {
    throttled = on
    settle(now)
  }

  /**
   * First step of a descent: the cheapest level the cost model says is needed.
   * Vsync quantization overstates the real cost (a 17 ms frame shows as 33 ms),
   * hence the slack; if it isn't enough, the next windows keep stepping.
   */
  function jumpTarget(med: number): number {
    const goal = (1000 / fps() / med) * 1.25
    const base = cost(level)
    for (let l = level + 1; l < LOWEST; l++) if (cost(l) / base <= goal) return l
    return LOWEST
  }

  function stepDown(med: number, now: number): void {
    goodWindows = 0
    if (level < LOWEST) {
      probe = { kind: 'down', base: level, baseThrottled: throttled, baseMed: med }
      set(jumpTarget(med), now)
      return
    }
    // Nothing cheaper to draw: halve the frame rate, if lowering the quality did help before.
    if (gpuBound && !throttled) throttle(true, now)
  }

  function evaluate(now: number): void {
    const med = typicalInterval(intervals)
    clearWindow()
    windows++
    if (locked) return
    const budget = budgetFor(fps())
    if (probe?.kind === 'up') {
      const p = probe
      probe = null
      if (med > budget) {
        level = p.base
        throttle(p.baseThrottled, now)
        locked = true
      }
      return
    }
    if (probe) {
      const p = probe
      if (med < p.baseMed * 0.9) {
        gpuBound = true
        probe = null
        if (med > budget) stepDown(med, now)
        return
      }
      // Frame times are quantized to vsync: one step may not show a gain yet.
      if (level < LOWEST) {
        set(level + 1, now)
        return
      }
      probe = null
      set(p.base, now)
      // The earlier steps helped but these didn't: the rest of the frame isn't ours, so
      // keep the better picture and draw half as often. Never helped: not our bottleneck.
      if (gpuBound) throttle(true, now)
      else locked = true
      return
    }
    if (med > budget) {
      if (level < LOWEST || !throttled) stepDown(med, now)
      else goodWindows = 0
      return
    }
    // Upgrades only when uncapped: a capped loop can't show the headroom.
    if (cap >= 60 && (throttled || level > 0) && upgrades < MAX_UPGRADES && med < goodFor(fps())) {
      if (++goodWindows >= GOOD_WINDOWS) {
        goodWindows = 0
        upgrades++
        probe = { kind: 'up', base: level, baseThrottled: throttled, baseMed: med }
        if (throttled) throttle(false, now)
        else set(level - 1, now)
      }
    } else goodWindows = 0
  }

  return {
    get level() {
      return level
    },
    get throttled() {
      return throttled
    },
    get fps() {
      return fps()
    },
    get locked() {
      return locked
    },
    setCap(next, now) {
      const c = next < 60 ? 30 : 60
      if (c === cap) return
      cap = c
      // A probe compares windows at one frame rate: abandon it (the level stays).
      probe = null
      goodWindows = 0
      windows = 0
      settle(now)
    },
    restart(now) {
      probe = null
      clearWindow()
      windows = 0
      measureFrom = now + WARMUP_MS
    },
    discard() {
      clearWindow()
    },
    switched(now) {
      settle(now, SWITCH_SETTLE_MS)
    },
    frame(sinceMs, now) {
      if (now < measureFrom || !(sinceMs > 0) || sinceMs >= 250) return false
      intervals.push(sinceMs)
      sum += sinceMs
      const span = windows === 0 ? FIRST_WINDOW_MS : WINDOW_MS
      if (intervals.length < WINDOW_FRAMES && (sum < span || intervals.length < MIN_WINDOW_FRAMES)) return false
      const before = level
      evaluate(now)
      return level !== before
    },
  }
}
