// Frame loop for the WebGL background: levels → reactor → uniforms, accent
// tweens, frame pacing (60 fps, 30 when silent), adaptive quality, visibility
// pause, resize and context loss. Pacing/quality decisions live in pacing.ts.

import type { AudioLevels } from '../../audio/engine'
import { mixOklab, neonize, parseHex, rotateHue, shadeOf } from './color'
import type { Rgb } from './color'
import { IDLE_AFTER_MS, QUALITY, createGovernor, initialLevel, isQuiet, shaderWork } from './pacing'
import { createReactor } from './reactor'
import { createRenderer } from './renderer'
import type { FrameUniforms, GlRenderer } from './renderer'
import { DEFAULT_ACCENT_A, DEFAULT_ACCENT_B, useBackground } from './useBackground'

interface RuntimeOptions {
  getLevels: () => AudioLevels
  reducedMotion: () => boolean
  /** Called (always asynchronously) when WebGL is unusable: no context, compile failure, context never restored. */
  onFatal: () => void
  /** Per-frame grain strength hook (0..1), so the CSS grain overlay follows the treble. */
  onGrain?: (strength: number) => void
}

export interface BackgroundRuntime {
  setPaused(paused: boolean): void
  destroy(): void
}

const MAX_PIXELS = 1_300_000
const ACCENT_TWEEN_S = 1.2
const RESTORE_TIMEOUT_MS = 5000
const TIME_WRAP = 3600

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => x * x * (3 - 2 * x)

function baseScale(): number {
  try {
    const coarse = matchMedia('(pointer: coarse)').matches
    const small = Math.min(window.innerWidth, window.innerHeight) < 600
    return coarse || small ? 0.5 : 0.75
  } catch {
    return 0.6
  }
}

function startLevel(): number {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    return initialLevel(nav.deviceMemory, nav.hardwareConcurrency)
  } catch {
    return 0
  }
}

/** Accent tween in OKLab with an ease-in-out over ACCENT_TWEEN_S. */
function accentTween(initial: Rgb) {
  let from: Rgb = initial
  let to: Rgb = initial
  let start = -1e9
  let value: Rgb = initial
  return {
    get value() {
      return value
    },
    set(target: Rgb, now: number) {
      if (target.every((c, i) => Math.abs(c - to[i]) < 1e-4)) return
      from = value
      to = target
      start = now
    },
    update(now: number) {
      const k = clamp01((now - start) / ACCENT_TWEEN_S)
      value = k >= 1 ? to : mixOklab(from, to, smooth(k))
    },
    moving(now: number) {
      return now - start < ACCENT_TWEEN_S
    },
  }
}

const neonA = (c: Rgb) => neonize(c, 0.5, 0.8, 0.12)
const neonB = (c: Rgb) => neonize(c, 0.56, 0.84, 0.12)
const neonC = (c: Rgb) => neonize(c, 0.62, 0.9, 0.1)

/** Store hex values → the three neon-safe linear RGB lights actually rendered. */
export function resolveAccents(a: string, b: string, c: string | null): [Rgb, Rgb, Rgb] {
  const ra = neonA(parseHex(a) ?? parseHex(DEFAULT_ACCENT_A)!)
  const rb = neonB(parseHex(b) ?? parseHex(DEFAULT_ACCENT_B)!)
  const pc = c ? parseHex(c) : null
  const rc = pc ? neonC(pc) : rotateHue(ra, -85)
  return [ra, rb, rc]
}

const INERT: BackgroundRuntime = { setPaused() {}, destroy() {} }

/**
 * Creates the context and queues the shader compile, then draws from the next
 * frames on. With KHR_parallel_shader_compile nothing here waits for the GPU:
 * the canvas stays transparent (host background shows) until the program links.
 */
export function startBackground(host: HTMLElement, opts: RuntimeOptions): BackgroundRuntime {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 900ms ease-out'

  let base = baseScale()
  let cssW = 0
  let cssH = 0
  let px = 1

  /** Internal pixel count at a level, after the MAX_PIXELS cap. */
  function levelPixels(level: number): number {
    const s = base * QUALITY[level].scale
    return Math.min(MAX_PIXELS, (cssW || 1) * s * (cssH || 1) * s)
  }
  const gov = createGovernor({ initial: startLevel(), cost: (l) => levelPixels(l) * shaderWork(QUALITY[l].octaves) })

  const created = createRenderer(canvas)
  if (!created || !created.init(QUALITY[gov.level].octaves)) {
    created?.dispose()
    queueMicrotask(opts.onFatal)
    return INERT
  }
  const renderer: GlRenderer = created
  host.appendChild(canvas)

  const reactor = createReactor()
  const store = useBackground.getState()
  const [a0, b0, c0] = resolveAccents(store.accentA, store.accentB, store.accentC)
  const colA = accentTween(a0)
  const colB = accentTween(b0)
  const colC = accentTween(c0)
  let intensity = store.intensity
  let intensityTarget = store.intensity
  let lastPulseSeq = store.pulseSeq

  const clock0 = performance.now()
  const nowS = () => (performance.now() - clock0) / 1000

  // ---------------------------------------------------------------- state
  let raf = 0
  let destroyed = false
  let paused = false
  let lost = false
  let broken = false
  let restoreTimer = 0
  let shown = false
  let flowTime = 0
  let lastTick = 0
  let lastRaf = 0
  /** Smoothed display frame interval (ms), from raw rAF deltas. */
  let displayMs = 1000 / 60
  let lastDraw = 0
  /** When the scene went quiet (performance.now() ms), -1 while something reacts. */
  let quietSince = -1
  /** Octave count of the program last drawn with (a change = a variant switch landed). */
  let drawnOctaves = 0

  const unsubscribe = useBackground.subscribe((s) => {
    const t = nowS()
    const [a, b, c] = resolveAccents(s.accentA, s.accentB, s.accentC)
    colA.set(a, t)
    colB.set(b, t)
    colC.set(c, t)
    intensityTarget = s.intensity
    // Accent, intensity and pulse changes are moments to render smoothly: back to 60 fps now.
    quietSince = -1
    if (s.pulseSeq !== lastPulseSeq) {
      lastPulseSeq = s.pulseSeq
      if (opts.reducedMotion()) reactor.state.flash = Math.max(reactor.state.flash, 0.3 * s.pulseStrength)
      else reactor.pulse(s.pulseStrength, t)
    }
  })

  const uniforms: FrameUniforms = {
    px: 1,
    time: 0,
    clock: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    flash: 0,
    presence: 0,
    intensity,
    motion: 1,
    ringAge: reactor.state.ringAge,
    ringAmp: reactor.state.ringAmp,
    colA: colA.value,
    colB: colB.value,
    colC: colC.value,
    shadeA: shadeOf(colA.value),
    shadeB: shadeOf(colB.value),
  }

  let shadeSrcA: Rgb = colA.value
  let shadeSrcB: Rgb = colB.value

  function applySize(): void {
    if (!cssW || !cssH) return
    let scale = base * QUALITY[gov.level].scale
    const pixels = cssW * scale * cssH * scale
    if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels)
    const w = Math.max(2, Math.round(cssW * scale))
    const h = Math.max(2, Math.round(cssH * scale))
    renderer.setSize(w, h)
    px = cssW / w
    uniforms.px = px
  }

  /** The governor picked another level: new resolution now, new variant once compiled. */
  function applyLevel(): void {
    renderer.setOctaves(QUALITY[gov.level].octaves)
    applySize()
  }

  function readLevels(): AudioLevels {
    try {
      const l = opts.getLevels()
      if (l && typeof l === 'object') return l
    } catch {
      // engine not ready: silence
    }
    return ZERO
  }

  function idle(now: number): boolean {
    return quietSince >= 0 && now - quietSince >= IDLE_AFTER_MS
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    const delta = now - lastRaf
    lastRaf = now
    if (delta > 0 && delta < 50) displayMs += (delta - displayMs) * 0.1

    const status = renderer.poll()
    if (status === 'failed') return fail()
    if (status === 'pending') return
    if (renderer.octaves !== drawnOctaves) {
      // A variant switch landed: the frames before it measured the old one.
      if (drawnOctaves !== 0) gov.switched(now)
      drawnOctaves = renderer.octaves
    }
    if (paused) {
      // Mounted paused: show the first frame, then stop.
      repaint()
      sync()
      return
    }

    const reduced = opts.reducedMotion()
    gov.setCap(reduced || idle(now) ? 30 : 60, now)
    const interval = 1000 / gov.fps
    if (displayMs > interval - 2.5) {
      // Display at or below the target rate: draw every frame, never skip.
      lastTick = now
    } else {
      // High refresh rate (or 30 fps target): fixed-step pacing without drift.
      if (now - lastTick < interval - 1.5) return
      lastTick = now - lastTick > interval * 2 ? now : lastTick + interval
    }
    const since = lastDraw ? now - lastDraw : interval
    lastDraw = now
    render(since, reduced, now)
    if (renderer.compiling) gov.discard()
    else if (gov.frame(since, now)) applyLevel()
  }

  function render(sinceMs: number, reduced: boolean, now: number): void {
    const dt = Math.min(0.1, Math.max(0, sinceMs / 1000))
    const t = nowS()
    const motion = reduced ? 0.15 : 1

    const lv = readLevels()
    const r = reactor.state
    if (reduced) {
      // No rings or flashes: only a gentle swell follows the music.
      reactor.update({ ...lv, beat: 0 }, dt, t)
    } else reactor.update(lv, dt, t)

    intensity += (intensityTarget - intensity) * (1 - Math.exp(-dt / 0.4))
    colA.update(t)
    colB.update(t)
    colC.update(t)

    const quiet =
      isQuiet(lv, r) && Math.abs(intensityTarget - intensity) < 0.005 && !colA.moving(t) && !colB.moving(t) && !colC.moving(t)
    if (!quiet) quietSince = -1
    else if (quietSince < 0) quietSince = now

    const liveK = r.presence * (0.4 + 0.6 * intensity)
    const speed = (0.3 + 0.95 * r.energy * liveK + 0.12 * r.bass * liveK) * motion
    flowTime = (flowTime + dt * speed) % TIME_WRAP

    uniforms.px = px
    uniforms.time = flowTime
    uniforms.clock = t % TIME_WRAP
    uniforms.bass = r.bass
    uniforms.mid = r.mid
    uniforms.treble = r.treble
    uniforms.energy = r.energy
    uniforms.flash = r.flash
    uniforms.presence = r.presence
    uniforms.intensity = intensity
    uniforms.motion = motion
    uniforms.colA = colA.value
    uniforms.colB = colB.value
    uniforms.colC = colC.value
    if (uniforms.colA !== shadeSrcA) uniforms.shadeA = shadeOf((shadeSrcA = colA.value))
    if (uniforms.colB !== shadeSrcB) uniforms.shadeB = shadeOf((shadeSrcB = colB.value))

    renderer.draw(uniforms)
    opts.onGrain?.(clamp01((0.55 + 0.45 * intensity) * (0.6 + 0.9 * r.treble * r.presence)))

    reveal()
  }

  function wantsFrames(): boolean {
    if (destroyed || broken || lost || document.visibilityState === 'hidden') return false
    // Paused: keep polling only until the first frame is on screen.
    return !paused || !shown
  }

  function sync(): void {
    if (wantsFrames()) {
      if (!raf) {
        lastTick = 0
        lastDraw = 0
        gov.restart(performance.now())
        raf = requestAnimationFrame(frame)
      }
    } else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  /** WebGL turned out unusable (no variant links): hand over to the CSS fallback. */
  function fail(): void {
    if (broken || destroyed) return
    broken = true
    sync()
    queueMicrotask(() => {
      if (!destroyed) opts.onFatal()
    })
  }

  function reveal(): void {
    if (shown) return
    shown = true
    canvas.style.opacity = '1'
  }

  /** Paint once without advancing (resize while paused clears the canvas). */
  function repaint(): void {
    if (destroyed || lost || broken || !cssW) return
    const status = renderer.poll()
    if (status === 'failed') return fail()
    if (status !== 'ready') return
    renderer.draw(uniforms)
    reveal()
  }

  // ---------------------------------------------------------------- events
  const onVisibility = () => sync()
  document.addEventListener('visibilitychange', onVisibility)

  const measure = () => {
    const rect = host.getBoundingClientRect()
    const w = rect.width || window.innerWidth
    const h = rect.height || window.innerHeight
    if (Math.abs(w - cssW) < 0.5 && Math.abs(h - cssH) < 0.5) return
    cssW = w
    cssH = h
    base = baseScale()
    applySize()
    gov.restart(performance.now())
    // Only once something is on screen: the first paint waits for the compile, off this task.
    if (!raf && shown) repaint()
  }
  let ro: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(host)
  } else window.addEventListener('resize', measure)
  measure()

  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    sync()
    clearTimeout(restoreTimer)
    restoreTimer = window.setTimeout(() => {
      if (lost && !destroyed) opts.onFatal()
    }, RESTORE_TIMEOUT_MS)
  }
  const onRestored = () => {
    clearTimeout(restoreTimer)
    if (destroyed) return
    if (!renderer.init(QUALITY[gov.level].octaves)) {
      opts.onFatal()
      return
    }
    drawnOctaves = 0
    lost = false
    applySize()
    sync()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  sync()

  return {
    setPaused(p) {
      paused = p
      sync()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      sync()
      clearTimeout(restoreTimer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', measure)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      renderer.dispose()
      canvas.remove()
    },
  }
}

const ZERO: AudioLevels = Object.freeze({ bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 })
