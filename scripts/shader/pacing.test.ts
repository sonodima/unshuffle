// Frame pacing / adaptive quality (pacing.ts) and non-blocking shader compiles (renderer.ts).
// bun test scripts/shader/pacing.test.ts
import { expect, test } from 'bun:test'
import { QUALITY, budgetFor, createGovernor, initialLevel, isQuiet, levelWork } from '../../src/components/background/pacing'
import type { Governor } from '../../src/components/background/pacing'
import { createReactor } from '../../src/components/background/reactor'
import { createRenderer } from '../../src/components/background/renderer'

/* ------------------------------------------------------------------ governor */

const VSYNC = 1000 / 60

/** Frame interval of a loop paced at `fps` whose frame costs `workMs`: whole vsyncs, never faster than the pace. */
function interval(workMs: number, fps: number): number {
  const pace = 1000 / fps
  const vsyncs = Math.max(Math.round(pace / VSYNC), Math.ceil(workMs / VSYNC - 1e-6))
  return vsyncs * VSYNC
}

/** Drives a governor for `seconds` with a frame-cost model; returns the level trace (one sample per second). */
function run(gov: Governor, workMs: (level: number) => number, seconds: number, t0 = 0, cap?: (t: number) => number) {
  let t = t0
  const trace: number[] = []
  let nextSample = t0 + 1000
  while (t < t0 + seconds * 1000) {
    if (cap) gov.setCap(cap(t), t)
    const dt = interval(workMs(gov.level), gov.fps)
    t += dt
    gov.frame(dt, t)
    if (t >= nextSample) {
      trace.push(gov.level)
      nextSample += 1000
    }
  }
  return { t, trace }
}

function started(initial = 0): Governor {
  const gov = createGovernor({ initial })
  gov.restart(0)
  return gov
}

test('fast GPU: stays at the best level at 60 fps', () => {
  const gov = started()
  run(gov, () => 3, 20)
  expect(gov.level).toBe(0)
  expect(gov.fps).toBe(60)
  expect(gov.locked).toBe(false)
})

test('nothing is measured before restart() or during the warmup', () => {
  const gov = createGovernor()
  for (let i = 1; i < 200; i++) gov.frame(100, i * 100)
  expect(gov.level).toBe(0)
  gov.restart(0)
  // 10 fps for the whole warmup: still untouched.
  for (let t = 100; t < 1000; t += 100) gov.frame(100, t)
  expect(gov.level).toBe(0)
})

test('weak GPU (software GL numbers): lowest level, then 30 fps, within ~3 s', () => {
  const gov = started()
  // Cost ∝ work: 100 ms at q0 → ~21 ms at q3, like SwiftShader at 1440x900.
  const work = (l: number) => (100 * levelWork(l)) / levelWork(0)
  let settledAt = -1
  let t = 0
  while (t < 12000) {
    const dt = interval(work(gov.level), gov.fps)
    t += dt
    gov.frame(dt, t)
    if (settledAt < 0 && gov.throttled) settledAt = t
  }
  expect(gov.level).toBe(QUALITY.length - 1)
  expect(gov.throttled).toBe(true)
  expect(gov.fps).toBe(30)
  expect(settledAt).toBeGreaterThan(0)
  expect(settledAt).toBeLessThan(3500)
  // At 30 fps every frame is on time again.
  expect(interval(work(gov.level), gov.fps)).toBeLessThanOrEqual(budgetFor(30))
})

test('GPU-bound page (cost ∝ pixels): steps down and keeps up at 60 fps', () => {
  const gov = started()
  const work = (l: number) => 24 * QUALITY[l].scale ** 2
  const { trace } = run(gov, work, 10)
  expect(gov.level).toBeGreaterThan(0)
  expect(gov.throttled).toBe(false)
  expect(interval(work(gov.level), gov.fps)).toBeLessThan(budgetFor(60))
  // Converges in the first few seconds, not after 8 s.
  expect(trace[3]).toBe(gov.level)
})

test('CPU-bound page: lowering never helps → back to the best level, locked', () => {
  const gov = started()
  const { trace } = run(gov, () => 26, 12)
  expect(gov.level).toBe(0)
  expect(gov.locked).toBe(true)
  expect(gov.throttled).toBe(false)
  expect(gov.fps).toBe(60)
  expect(Math.max(...trace)).toBeLessThanOrEqual(3)
})

test('last steps stop helping (a fixed cost that isn\'t ours): keeps the better level at 30 fps', () => {
  const gov = started()
  // 40 ms at q0, but nothing gets below a 20.5 ms floor (e.g. a software compositor).
  const work = (l: number) => Math.max(20.5, (40 * levelWork(l)) / levelWork(0))
  run(gov, work, 8)
  expect(gov.throttled).toBe(true)
  expect(gov.fps).toBe(30)
  expect(gov.level).toBeLessThan(QUALITY.length - 1)
  expect(gov.level).toBeGreaterThan(0)
})

test('throttled, then the GPU frees up: back to 60 fps, then back up in quality', () => {
  const gov = started()
  const { t } = run(gov, (l) => (100 * levelWork(l)) / levelWork(0), 5)
  expect(gov.throttled).toBe(true)
  run(gov, () => 3, 30, t)
  expect(gov.throttled).toBe(false)
  expect(gov.fps).toBe(60)
  expect(gov.level).toBeLessThan(QUALITY.length - 1)
})

test('transient slowdown: probes back up once frames are fast again', () => {
  const gov = started()
  const { t } = run(gov, (l) => (l === 0 ? 30 : 10), 4)
  expect(gov.level).toBeGreaterThan(0)
  run(gov, () => 3, 20, t)
  expect(gov.level).toBe(0)
})

test('failed upgrade restores the lower level and locks', () => {
  const gov = started()
  // q0 too slow, q1+ fine: goes down, probes up after 8 good windows, fails, stays down.
  const work = (l: number) => (l === 0 ? 24 : 12)
  run(gov, work, 30)
  expect(gov.level).toBe(1)
  expect(gov.locked).toBe(true)
})

test('30 fps cap: paces at 30, never upgrades while capped, and budget follows the cap', () => {
  const gov = started(1)
  run(gov, () => 3, 20, 0, () => 30)
  expect(gov.fps).toBe(30)
  expect(gov.level).toBe(1)
  // Uncapped: fast frames → probes up to 0.
  run(gov, () => 3, 20, 20000, () => 60)
  expect(gov.fps).toBe(60)
  expect(gov.level).toBe(0)
})

test('cap change cancels a probe in flight without touching the level', () => {
  const gov = started()
  // Slow first window → a down probe starts.
  run(gov, () => 30, 1.7)
  const lvl = gov.level
  expect(lvl).toBeGreaterThan(0)
  gov.setCap(30, 1700)
  // Now fast at 30 fps: the stale probe must not restore/lock anything.
  run(gov, () => 3, 5, 1700, () => 30)
  expect(gov.level).toBe(lvl)
  expect(gov.locked).toBe(false)
})

test('weak GPU while idle (30 fps cap), then music: throttles within a second', () => {
  const gov = started()
  const work = (l: number) => (100 * levelWork(l)) / levelWork(0)
  const { t } = run(gov, work, 8, 0, () => 30)
  expect(gov.fps).toBe(30)
  expect(gov.level).toBe(QUALITY.length - 1)
  expect(gov.throttled).toBe(false)
  run(gov, work, 1.2, t, () => 60)
  expect(gov.throttled).toBe(true)
  expect(gov.fps).toBe(30)
})

test('initial level: one step down only on clearly low-end hardware', () => {
  expect(initialLevel(8, 8)).toBe(0)
  expect(initialLevel(undefined, undefined)).toBe(0)
  expect(initialLevel(4, 4)).toBe(0)
  expect(initialLevel(2, 8)).toBe(1)
  expect(initialLevel(undefined, 2)).toBe(1)
  expect(initialLevel(0, 0)).toBe(0)
})

/* ------------------------------------------------------------------ quiet detection */

const ZERO = { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 }

test('quiet: silence with a settled reactor', () => {
  const r = createReactor()
  for (let i = 0; i < 60; i++) r.update(ZERO, 1 / 60, i / 60)
  expect(isQuiet(ZERO, r.state)).toBe(true)
})

test('not quiet: music, a beat, a ring on screen, or presence still fading out', () => {
  const r = createReactor()
  const music = { bass: 0.4, mid: 0.3, treble: 0.2, energy: 0.5, beat: 0 }
  expect(isQuiet(music, r.state)).toBe(false)
  expect(isQuiet({ ...ZERO, beat: 1 }, r.state)).toBe(false)
  r.pulse(1, 0)
  r.update(ZERO, 1 / 60, 0.5)
  expect(isQuiet(ZERO, r.state)).toBe(false) // ring alive
  const r2 = createReactor()
  for (let i = 0; i < 120; i++) r2.update(music, 1 / 60, i / 60)
  r2.update(ZERO, 1 / 60, 2.1)
  expect(isQuiet(ZERO, r2.state)).toBe(false) // presence fading
  let t = 2.1
  while (!isQuiet(ZERO, r2.state) && t < 30) r2.update(ZERO, 1 / 60, (t += 1 / 60))
  // Back to idle once the flow has slowed down (~3 s after the music stops).
  expect(t - 2.1).toBeGreaterThan(1.5)
  expect(t - 2.1).toBeLessThan(4)
  expect(r2.state.energy).toBeLessThan(0.1)
})

/* ------------------------------------------------------------------ renderer compile polling */

const COMPLETION = 0x91b1

interface FakeOpts {
  parallel: boolean
  /** Polls of COMPLETION_STATUS_KHR before a link reports complete. */
  latency?: number
  failOctaves?: number[]
}

function fakeGl(o: FakeOpts) {
  const log = { linkStatusReads: 0, completionReads: 0, links: [] as number[], used: [] as number[], errors: 0 }
  let nextId = 1
  const shaders = new Map<number, { src: string }>()
  const programs = new Map<number, { shaders: number[]; octaves: number; polls: number }>()
  const octOf = (src: string) => Number(/#define OCTAVES (\d+)/.exec(src)?.[1] ?? 0)
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    DEPTH_TEST: 8,
    BLEND: 9,
    TRIANGLES: 10,
    RENDERER: 11,
    isContextLost: () => false,
    getExtension: (name: string) => (name === 'KHR_parallel_shader_compile' && o.parallel ? { COMPLETION_STATUS_KHR: COMPLETION } : null),
    getParameter: () => 'Fake GPU',
    createBuffer: () => ({}),
    bindBuffer() {},
    bufferData() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    disable() {},
    deleteBuffer() {},
    createShader: () => {
      const id = nextId++
      shaders.set(id, { src: '' })
      return id
    },
    shaderSource: (sh: number, src: string) => {
      shaders.get(sh)!.src = src
    },
    compileShader() {},
    createProgram: () => {
      const id = nextId++
      programs.set(id, { shaders: [], octaves: 0, polls: 0 })
      return id
    },
    attachShader: (p: number, sh: number) => {
      programs.get(p)!.shaders.push(sh)
    },
    bindAttribLocation() {},
    linkProgram: (p: number) => {
      const prog = programs.get(p)!
      prog.octaves = Math.max(...prog.shaders.map((s) => octOf(shaders.get(s)!.src)))
      log.links.push(prog.octaves)
    },
    getProgramParameter: (p: number, pname: number) => {
      const prog = programs.get(p)!
      if (pname === COMPLETION) {
        log.completionReads++
        return ++prog.polls > (o.latency ?? 0)
      }
      log.linkStatusReads++
      return !(o.failOctaves ?? []).includes(prog.octaves)
    },
    getShaderParameter: (sh: number) => !(o.failOctaves ?? []).includes(octOf(shaders.get(sh)!.src)),
    getShaderInfoLog: () => 'fake error',
    getProgramInfoLog: () => 'fake link error',
    deleteShader() {},
    deleteProgram() {},
    getUniformLocation: () => ({}),
    useProgram: (p: number) => {
      log.used.push(programs.get(p)!.octaves)
    },
    viewport() {},
    uniform1f() {},
    uniform2f() {},
    uniform3f() {},
    uniform4f() {},
    uniform4fv() {},
    drawArrays() {},
  }
  const canvas = { width: 0, height: 0, getContext: (t: string) => (t === 'webgl2' ? gl : null) } as unknown as HTMLCanvasElement
  return { canvas, log }
}

function quietErrors<T>(fn: () => T): T {
  const orig = console.error
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.error = orig
  }
}

test('renderer: with KHR_parallel_shader_compile nothing blocks until the link completes', () => {
  const { canvas, log } = fakeGl({ parallel: true, latency: 3 })
  const r = createRenderer(canvas)!
  expect(r.parallel).toBe(true)
  expect(r.init(5)).toBe(true)
  expect(log.linkStatusReads).toBe(0)
  expect(r.poll()).toBe('pending')
  expect(r.poll()).toBe('pending')
  expect(r.poll()).toBe('pending')
  expect(log.linkStatusReads).toBe(0)
  expect(r.poll()).toBe('ready')
  expect(r.octaves).toBe(5)
  expect(log.linkStatusReads).toBe(1)
  expect(r.compiling).toBe(false)
})

test('renderer: variant switch compiles in the background, old program keeps drawing', () => {
  const { canvas, log } = fakeGl({ parallel: true, latency: 2 })
  const r = createRenderer(canvas)!
  r.init(5)
  while (r.poll() !== 'ready');
  r.setOctaves(3)
  expect(r.compiling).toBe(true)
  expect(r.poll()).toBe('ready')
  expect(r.octaves).toBe(5)
  r.poll()
  expect(r.poll()).toBe('ready')
  expect(r.octaves).toBe(3)
  expect(r.compiling).toBe(false)
  // Cached: switching back is immediate, no new link.
  const links = log.links.length
  r.setOctaves(5)
  expect(r.poll()).toBe('ready')
  expect(r.octaves).toBe(5)
  expect(log.links.length).toBe(links)
})

test('renderer: a failing preferred variant falls back to fewer octaves', () => {
  const { canvas, log } = fakeGl({ parallel: true, failOctaves: [5] })
  const r = createRenderer(canvas)!
  r.init(5)
  let s = quietErrors(() => r.poll())
  for (let i = 0; i < 10 && s === 'pending'; i++) s = quietErrors(() => r.poll())
  expect(s).toBe('ready')
  expect(r.octaves).toBe(4)
  expect(log.used).toEqual([4])
})

test('renderer: a failing switch keeps the current program', () => {
  const { canvas } = fakeGl({ parallel: false, failOctaves: [3] })
  const r = createRenderer(canvas)!
  r.init(5)
  expect(r.poll()).toBe('ready')
  r.setOctaves(3)
  expect(quietErrors(() => r.poll())).toBe('ready')
  expect(r.octaves).toBe(5)
  expect(r.compiling).toBe(false)
})

test('renderer: every variant failing reports failed', () => {
  const { canvas } = fakeGl({ parallel: false, failOctaves: [3, 4, 5] })
  const r = createRenderer(canvas)!
  r.init(5)
  expect(quietErrors(() => r.poll())).toBe('failed')
})

test('renderer: without the extension the first poll links synchronously', () => {
  const { canvas, log } = fakeGl({ parallel: false })
  const r = createRenderer(canvas)!
  expect(r.parallel).toBe(false)
  r.init(4)
  expect(log.linkStatusReads).toBe(0) // init only queues the work
  expect(r.poll()).toBe('ready')
  expect(r.octaves).toBe(4)
})
