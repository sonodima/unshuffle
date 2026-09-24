// Confetti for the podium. Owns a private full-screen canvas (so resetting it never
// touches anyone else's confetti) and honours prefers-reduced-motion.
import confetti from 'canvas-confetti'

export interface Celebration {
  /** Big burst from a point (viewport fractions, 0..1). */
  burst(origin: { x: number; y: number }, extraColor?: string): void
  /** Side cannons from the bottom corners for `ms`. */
  cannons(ms: number): void
  destroy(): void
}

const TOKENS = ['--color-gold', '--color-magenta', '--color-cyan', '--color-lime', '--color-violet-bright', '--color-coral']

function palette(extra?: string): string[] {
  const css = getComputedStyle(document.documentElement)
  const colors = TOKENS.map((t) => css.getPropertyValue(t).trim()).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))
  if (extra && /^#[0-9a-f]{6}$/i.test(extra)) colors.push(extra, extra)
  return colors.length ? colors : ['#ffffff']
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const NOOP: Celebration = { burst() {}, cannons() {}, destroy() {} }

export function createCelebration(): Celebration {
  if (typeof document === 'undefined' || prefersReducedMotion()) return NOOP
  let fire: confetti.CreateTypes
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60'
  try {
    document.body.appendChild(canvas)
    fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })
  } catch {
    canvas.remove()
    return NOOP
  }

  const small = window.innerWidth < 640
  const scale = small ? 0.8 : 1
  let raf = 0
  let destroyed = false
  const shoot = (opts: confetti.Options) => {
    if (destroyed) return
    try {
      void fire(opts)
    } catch {
      // Confetti is decoration only.
    }
  }

  return {
    burst(origin, extraColor) {
      const colors = palette(extraColor)
      const base = { origin, colors, scalar: scale, disableForReducedMotion: true, zIndex: 60 }
      shoot({ ...base, particleCount: Math.round(90 * scale), spread: 75, startVelocity: small ? 38 : 48, ticks: 260 })
      shoot({ ...base, particleCount: Math.round(40 * scale), spread: 120, startVelocity: small ? 26 : 32, decay: 0.92, ticks: 240, shapes: ['star'], scalar: scale * 1.2 })
    },
    cannons(ms) {
      const colors = palette()
      const end = performance.now() + ms
      let last = 0
      const frame = (t: number) => {
        if (destroyed) return
        if (t - last > 90) {
          last = t
          const common = { colors, scalar: scale, particleCount: small ? 4 : 6, spread: 55, startVelocity: small ? 48 : 62, ticks: 220, zIndex: 60 }
          shoot({ ...common, angle: 60, origin: { x: -0.02, y: 0.92 } })
          shoot({ ...common, angle: 120, origin: { x: 1.02, y: 0.92 } })
        }
        if (t < end) raf = requestAnimationFrame(frame)
      }
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      try {
        fire.reset()
      } catch {
        // already gone
      }
      canvas.remove()
    },
  }
}
