// Emoji reactions floating up from the bottom of the screen (Twitch/Instagram
// live style), glowing in the sender's player color. Driven by the store's
// 'reaction' toasts; the store already plays the 'pop' sfx when one arrives.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../game/store'
import type { Player, PlayerId } from '../../game/types'
import { playerColor } from '../ui'

export interface Floater {
  id: number
  emoji: string
  /** Sender's accent color (hex). */
  color: string
  /** Sender's name (small tag under the emoji), if known. */
  name?: string
  /** Horizontal start position, 0..1 of the viewport width. */
  x: number
  /** Side-to-side wobble amplitude (px, signed). */
  sway: number
  /** Rise height in px. */
  rise: number
  duration: number
  tilt: number
  size: number
}

const MAX_FLOATERS = 24
const GOLDEN = 0.618033988749895

let seed = Math.random()
/** Well-spread pseudo-random x (golden-ratio sequence + jitter) so bursts don't stack. */
function spreadX(): number {
  seed = (seed + GOLDEN) % 1
  return 0.08 + 0.84 * ((seed + (Math.random() - 0.5) * 0.12 + 1) % 1)
}

function viewport(): { w: number; h: number } {
  try {
    return { w: window.innerWidth || 1024, h: window.innerHeight || 800 }
  } catch {
    return { w: 1024, h: 800 }
  }
}

export function makeFloater(id: number, emoji: string, color: string, name?: string): Floater {
  const r = Math.random
  const { w, h } = viewport()
  const phone = w < 640
  return {
    id,
    emoji,
    color,
    name,
    x: spreadX(),
    sway: (r() < 0.5 ? -1 : 1) * (phone ? 10 + r() * 14 : 14 + r() * 22),
    rise: h * (0.42 + r() * 0.2),
    duration: 2.5 + r() * 0.8,
    tilt: (r() - 0.5) * 24,
    size: phone ? 32 + r() * 10 : 40 + r() * 14,
  }
}

export interface FloatingReactionsViewProps {
  floaters: readonly Floater[]
  onDone(id: number): void
  /** Show the sender's name under each emoji. Default true. */
  showNames?: boolean
}

/** Presentational layer: full-viewport, click-through, above screens and below the chrome. */
export function FloatingReactionsView({ floaters, onDone, showNames = true }: FloatingReactionsViewProps) {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[650] overflow-hidden">
      <AnimatePresence>
        {floaters.map((f) => (
          <motion.div
            key={f.id}
            className="absolute bottom-safe-20 flex -translate-x-1/2 flex-col items-center will-change-transform sm:bottom-safe-12"
            style={{ left: `clamp(56px, ${(f.x * 100).toFixed(2)}%, calc(100% - 56px))` }}
            // Reduced motion: no flight, just a fade in place (a little above the bottom controls).
            initial={reduce ? { opacity: 0, y: -f.rise * 0.3, scale: 1 } : { opacity: 0, y: 24, scale: 0.3 }}
            animate={
              reduce
                ? { opacity: [0, 1, 1, 0], transition: { duration: 1.8, times: [0, 0.15, 0.7, 1] } }
                : {
                    opacity: [0, 1, 1, 0],
                    y: [24, -40, -f.rise * 0.55, -f.rise],
                    x: [0, f.sway * 0.4, -f.sway, f.sway * 0.6],
                    scale: [0.3, 1.2, 1, 0.82],
                    transition: { duration: f.duration, times: [0, 0.14, 0.62, 1], ease: ['backOut', 'easeInOut', 'easeIn'] },
                  }
            }
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onAnimationComplete={() => onDone(f.id)}
          >
            <motion.span
              className="relative grid place-items-center"
              style={{ width: f.size * 1.5, height: f.size * 1.5 }}
              initial={{ rotate: 0 }}
              animate={reduce ? undefined : { rotate: [0, f.tilt, -f.tilt * 0.6, f.tilt * 0.3], transition: { duration: f.duration, times: [0, 0.14, 0.62, 1] } }}
            >
              <span
                className="absolute inset-[12%] rounded-full opacity-60 blur-xl"
                style={{ background: `radial-gradient(circle, ${f.color} 0%, transparent 70%)` }}
              />
              <span
                className="emoji relative select-none"
                style={{
                  fontSize: f.size,
                  filter: `drop-shadow(0 0 10px ${f.color}) drop-shadow(0 4px 10px rgb(0 0 0 / 0.45))`,
                }}
              >
                {f.emoji}
              </span>
            </motion.span>
            {showNames && f.name && (
              // The name tag reads early, then leaves the emoji alone.
              <motion.span
                className="-mt-1.5 max-w-[120px] truncate rounded-full bg-ink-950/80 px-2 py-0.5 text-[11px] leading-4 font-extrabold"
                style={{ color: f.color, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${f.color} 45%, transparent)` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0], transition: { duration: f.duration, times: [0, 0.12, 0.42, 0.58] } }}
              >
                {f.name}
              </motion.span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function senderOf(players: readonly Player[] | undefined, id: PlayerId): Player | undefined {
  return players?.find((p) => p.id === id)
}

/** Connected layer: turns new 'reaction' toasts into floaters. Mount once. */
export function FloatingReactions() {
  const toasts = useGame((s) => s.toasts)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const lastId = useRef(0)

  useEffect(() => {
    const fresh = toasts.filter((t) => t.id > lastId.current && t.event.type === 'reaction')
    if (toasts.length) lastId.current = Math.max(lastId.current, ...toasts.map((t) => t.id))
    if (!fresh.length) return
    const { room, me } = useGame.getState()
    const add: Floater[] = []
    for (const t of fresh) {
      if (t.event.type !== 'reaction') continue
      const p = senderOf(room?.players, t.event.playerId)
      const name = p ? (p.id === me ? 'Tu' : p.name) : undefined
      add.push(makeFloater(t.id, t.event.emoji, p ? playerColor(p.color) : 'var(--color-magenta)', name))
    }
    setFloaters((cur) => [...cur, ...add].slice(-MAX_FLOATERS))
  }, [toasts])

  const done = (id: number) => setFloaters((cur) => cur.filter((f) => f.id !== id))

  return <FloatingReactionsView floaters={floaters} onDone={done} />
}
