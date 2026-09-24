// Fixed full-screen audio-reactive background ("liquid neon club"), rendered
// behind the whole app (z-index −1, no pointer events). WebGL2 → WebGL1 →
// animated CSS gradient. Colors/intensity come from `useBackground`.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { audioEngine } from '../../audio/engine'
import type { AudioEngine, AudioLevels } from '../../audio/engine'
import { toHex } from './color'
import { resolveAccents, startBackground } from './runtime'
import type { BackgroundRuntime } from './runtime'
import { useBackground } from './useBackground'
import './background.css'

export interface ShaderBackgroundProps {
  /** Level source, read every frame. Default: `audioEngine.getLevels()` (silence when unavailable). */
  getLevels?: () => AudioLevels
  /** Freeze on the current frame (stops the render loop). */
  paused?: boolean
  /** Force reduced motion on/off. Default: follows `prefers-reduced-motion`. */
  reducedMotion?: boolean
  /** Skip WebGL and use the CSS gradient fallback. */
  forceFallback?: boolean
  /** Animated film grain overlay (default true). */
  grain?: boolean
  className?: string
}

const ZERO: AudioLevels = Object.freeze({ bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 })

function engineLevels(): AudioLevels {
  try {
    const engine = audioEngine as AudioEngine | null | undefined
    return engine?.getLevels?.() ?? ZERO
  } catch {
    return ZERO
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = matchMedia('(prefers-reduced-motion: reduce)')
    } catch {
      return
    }
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Longest wait for the first contentful paint (hidden tab, nothing contentful on screen yet). */
const FIRST_PAINT_TIMEOUT_MS = 800

/**
 * Runs `fn` once the page's first contentful paint is on screen, so creating the
 * WebGL context (50-200 ms of main-thread and GPU-process work) can't delay it.
 * In Chrome the GPU process presents frames and creates contexts on the same
 * thread, so "after the next rAF" isn't enough: wait for the FCP entry itself.
 * Without paint timing: two frames. Returns a canceller.
 */
function afterFirstPaint(fn: () => void): () => void {
  let done = false
  let raf = 0
  let timer = 0
  let observer: PerformanceObserver | null = null
  const go = () => {
    if (done) return
    done = true
    observer?.disconnect()
    cancelAnimationFrame(raf)
    clearTimeout(timer)
    timer = window.setTimeout(fn, 0)
  }
  try {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('paint')) {
      observer = new PerformanceObserver((list) => {
        if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) go()
      })
      observer.observe({ type: 'paint', buffered: true })
      timer = window.setTimeout(go, FIRST_PAINT_TIMEOUT_MS)
    }
  } catch {
    observer = null
  }
  if (!observer) raf = requestAnimationFrame(() => (raf = requestAnimationFrame(go)))
  return () => {
    done = true
    observer?.disconnect()
    cancelAnimationFrame(raf)
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ grain tile */

let grainUrl: string | null | undefined

/** 128² gaussian-ish noise tile (white/black speckles with varying alpha), generated once. */
function grainTile(): string | null {
  if (grainUrl !== undefined) return grainUrl
  grainUrl = null
  try {
    const size = 128
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    if (!g) return null
    const img = g.createImageData(size, size)
    let s = 0x2545f491
    const rnd = () => {
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      return (s >>> 0) / 4294967296
    }
    for (let i = 0; i < size * size; i++) {
      const n = rnd() + rnd() + rnd() - 1.5
      const v = n > 0 ? 255 : 0
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = Math.min(255, Math.round(Math.abs(n) * 1.6 * 255))
    }
    g.putImageData(img, 0, 0)
    grainUrl = c.toDataURL('image/png')
  } catch {
    grainUrl = null
  }
  return grainUrl
}

/* ------------------------------------------------------------------ CSS fallback */

function CssFallback({ getLevels, reduced }: { getLevels: () => AudioLevels; reduced: boolean }) {
  const pulseRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = pulseRef.current
    if (!el || reduced) return
    let raf = 0
    let bass = 0
    let beat = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      let lv = ZERO
      try {
        lv = getLevels() ?? ZERO
      } catch {
        lv = ZERO
      }
      bass += ((Number(lv.bass) || 0) - bass) * (1 - Math.exp(-dt / 0.12))
      beat = Math.max(beat * Math.exp(-dt / 0.18), Number(lv.beat) || 0)
      el.style.opacity = String(Math.min(1, 0.35 + 0.45 * bass + 0.3 * beat))
      el.style.transform = `scale(${1 + 0.12 * bass + 0.06 * beat})`
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (document.visibilityState !== 'hidden') {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [getLevels, reduced])

  return (
    <div className="ushf-bg-fallback">
      <div className="ushf-bg-blob" data-blob="c" />
      <div className="ushf-bg-blob" data-blob="a" />
      <div className="ushf-bg-blob" data-blob="b" />
      <div ref={pulseRef} className="ushf-bg-pulse" />
      <div className="ushf-bg-vignette" />
    </div>
  )
}

/* ------------------------------------------------------------------ component */

export function ShaderBackground({
  getLevels,
  paused = false,
  reducedMotion,
  forceFallback = false,
  grain = true,
  className,
}: ShaderBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const grainRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<BackgroundRuntime | null>(null)
  const [failed, setFailed] = useState(false)
  const useCss = forceFallback || failed

  const prefersReduced = usePrefersReducedMotion()
  const reduced = reducedMotion ?? prefersReduced

  // Latest props for the imperative loop (no restart on every render).
  const live = useRef({ getLevels, reduced, paused })
  useLayoutEffect(() => {
    live.current = { getLevels, reduced, paused }
  })
  const [levelSource] = useState(() => () => (live.current.getLevels ?? engineLevels)())

  const accentA = useBackground((s) => s.accentA)
  const accentB = useBackground((s) => s.accentB)
  const accentC = useBackground((s) => s.accentC)

  useEffect(() => {
    const host = hostRef.current
    if (useCss || !host) return
    let grainShown = -1
    let dead = false
    let runtime: BackgroundRuntime | null = null
    // Creating the context blocks for 50-200 ms: let the first paint happen first
    // (the host shows the same dark base, and the canvas fades in anyway).
    const cancelStart = afterFirstPaint(() => {
      if (dead) return
      const rt = startBackground(host, {
        getLevels: levelSource,
        reducedMotion: () => live.current.reduced,
        onFatal: () => {
          if (dead) return
          rt.destroy()
          if (runtimeRef.current === rt) runtimeRef.current = null
          setFailed(true)
        },
        onGrain: (k) => {
          const el = grainRef.current
          if (!el) return
          // Coarse steps: an opacity write per frame would restyle the layer for no visible change.
          const o = Math.round((0.03 + 0.035 * k) * 400) / 400
          if (o !== grainShown) {
            grainShown = o
            el.style.opacity = String(o)
          }
        },
      })
      rt.setPaused(live.current.paused)
      runtime = rt
      runtimeRef.current = rt
    })
    return () => {
      dead = true
      cancelStart()
      runtime?.destroy()
      if (runtimeRef.current === runtime) runtimeRef.current = null
    }
  }, [useCss, levelSource])

  useEffect(() => {
    runtimeRef.current?.setPaused(paused)
  }, [paused])

  // The noise tile (~5-20 ms to generate and encode) isn't needed for the first paint either.
  const [tile, setTile] = useState<string | null>(() => grainUrl ?? null)
  useEffect(() => {
    if (!grain || tile || grainUrl === null) return
    return afterFirstPaint(() => setTile(grainTile()))
  }, [grain, tile])

  let style: CSSProperties | undefined
  if (useCss) {
    const [a, b, c] = resolveAccents(accentA, accentB, accentC)
    style = { ['--bg-a' as string]: toHex(a), ['--bg-b' as string]: toHex(b), ['--bg-c' as string]: toHex(c) }
  }

  return (
    <div
      aria-hidden="true"
      className={className ? `ushf-bg ${className}` : 'ushf-bg'}
      data-mode={useCss ? 'css' : 'webgl'}
      data-reduced={reduced ? '' : undefined}
      style={style}
    >
      {useCss ? <CssFallback getLevels={levelSource} reduced={reduced} /> : <div ref={hostRef} className="ushf-bg-layer" />}
      {grain && tile && <div ref={grainRef} className="ushf-bg-grain" style={{ backgroundImage: `url(${tile})` }} />}
    </div>
  )
}
