// Confetti for a perfect round. Owns a private full-screen canvas (resetting it
// never touches anyone else's confetti); no-op under prefers-reduced-motion.
import confetti from 'canvas-confetti'

export interface RevealConfetti {
  /** Celebration burst from a viewport point (fractions 0..1). */
  burst(origin: { x: number; y: number }, accents?: readonly string[]): void
  destroy(): void
}

const TOKENS = ['--color-gold', '--color-lime', '--color-magenta', '--color-cyan', '--color-violet-bright']
const NOOP: RevealConfetti = { burst() {}, destroy() {} }

function palette(accents: readonly string[] = []): string[] {
  const css = getComputedStyle(document.documentElement)
  const colors = TOKENS.map((t) => css.getPropertyValue(t).trim()).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))
  for (const a of accents) if (/^#[0-9a-f]{6}$/i.test(a)) colors.push(a)
  return colors.length ? colors : ['#ffffff']
}

function reducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function createRevealConfetti(): RevealConfetti {
  if (typeof document === 'undefined' || reducedMotion()) return NOOP
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70'
  let fire: confetti.CreateTypes
  try {
    document.body.appendChild(canvas)
    fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })
  } catch {
    canvas.remove()
    return NOOP
  }
  let destroyed = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const shoot = (opts: confetti.Options) => {
    if (destroyed) return
    try {
      void fire(opts)
    } catch {
      // decoration only
    }
  }
  return {
    burst(origin, accents) {
      const colors = palette(accents)
      const small = window.innerWidth < 640
      const scalar = small ? 0.85 : 1.05
      const base = { origin, colors, scalar, zIndex: 70, disableForReducedMotion: true }
      shoot({ ...base, particleCount: small ? 70 : 110, spread: 80, startVelocity: small ? 40 : 52, ticks: 260 })
      shoot({ ...base, particleCount: small ? 26 : 40, spread: 130, startVelocity: small ? 28 : 34, decay: 0.92, ticks: 240, shapes: ['star'], scalar: scalar * 1.25 })
      // Side cannons a beat later, from the bottom corners.
      const t = setTimeout(() => {
        timers.delete(t)
        const side = { colors, scalar, zIndex: 70, particleCount: small ? 30 : 48, spread: 58, startVelocity: small ? 52 : 66, ticks: 230 }
        shoot({ ...side, angle: 62, origin: { x: -0.02, y: 0.95 } })
        shoot({ ...side, angle: 118, origin: { x: 1.02, y: 0.95 } })
      }, 260)
      timers.add(t)
    },
    destroy() {
      destroyed = true
      for (const t of timers) clearTimeout(t)
      timers.clear()
      try {
        fire.reset()
      } catch {
        // already gone
      }
      canvas.remove()
    },
  }
}
