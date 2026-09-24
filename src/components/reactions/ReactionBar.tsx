// Row of emoji reaction buttons (REACTION_BAR). Sends useGame().react(emoji),
// throttled like the host (400 ms). Each press pops the emoji and launches a
// small local "ghost" so it feels instant; everyone (me included) then sees the
// big floating reaction when the host echoes it back.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { REACTION_BAR } from '../../game/constants'
import { useGame } from '../../game/store'
import type { MessageKey } from '../../i18n'
import { useT } from '../../i18n/react'
import { cn, useIsWide } from '../ui'

/** Same spacing the host enforces per player. */
const REACTION_THROTTLE_MS = 400

/** Accessible name of each emoji (resolved at render). */
const REACTION_NAMES: Record<string, MessageKey> = {
  '🔥': 'shell.reactions.names.fire',
  '😂': 'shell.reactions.names.laugh',
  '😱': 'shell.reactions.names.shock',
  '👏': 'shell.reactions.names.clap',
  '💀': 'shell.reactions.names.dead',
  '🎉': 'shell.reactions.names.party',
  '🤯': 'shell.reactions.names.mindBlown',
  '😎': 'shell.reactions.names.cool',
  '🔁': 'shell.reactions.names.rematch',
}

export interface ReactionBarProps {
  /** Smaller buttons and tighter spacing. 'auto' (default) = compact below 640px. */
  compact?: boolean | 'auto'
  className?: string
  /** Emojis to show. Default REACTION_BAR (every relayed emoji except the rematch request). */
  emojis?: readonly string[]
  disabled?: boolean
  /** Accessible group name. Default: shell.reactions.group ("Reazioni"). */
  label?: string
}

interface Ghost {
  id: number
  emoji: string
  /** Center of the pressed button, relative to the bar (px). */
  left: number
  dx: number
}

let ghostSeq = 0

export function ReactionBar({ compact: compactProp = 'auto', className, emojis = REACTION_BAR, disabled = false, label }: ReactionBarProps) {
  const t = useT()
  const reactionName = (emoji: string) => (REACTION_NAMES[emoji] ? t(REACTION_NAMES[emoji]) : emoji)
  const reduce = useReducedMotion()
  const wide = useIsWide()
  const compact = compactProp === 'auto' ? !wide : compactProp
  const lastSent = useRef(0)
  const barRef = useRef<HTMLDivElement>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [pressed, setPressed] = useState<{ index: number; n: number } | null>(null)

  const send = (emoji: string, index: number, button: HTMLElement) => {
    if (disabled) return
    const now = performance.now()
    if (now - lastSent.current < REACTION_THROTTLE_MS) return
    lastSent.current = now
    try {
      useGame.getState().react(emoji)
    } catch (err) {
      console.warn('[reactions] react failed', err)
    }
    setPressed((p) => ({ index, n: (p?.n ?? 0) + 1 }))
    const bar = barRef.current
    if (!reduce && bar) {
      const b = button.getBoundingClientRect()
      const left = b.left + b.width / 2 - bar.getBoundingClientRect().left
      const id = ++ghostSeq
      setGhosts((g) => [...g.slice(-5), { id, emoji, left, dx: (Math.random() - 0.5) * 18 }])
    }
  }

  // Compact buttons are 36 px: on touch screens an invisible slop makes them 48 px tall
  // (the scroller gets the room for it, or its overflow would clip the slop).
  const size = compact
    ? "size-9 text-[20px] pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']"
    : 'size-11 text-[24px]'

  return (
    <div
      ref={barRef}
      role="group"
      aria-label={label ?? t('shell.reactions.group')}
      className={cn(
        'glass-subtle relative inline-flex max-w-full items-center rounded-full',
        compact ? 'gap-0.5 p-1' : 'gap-1 p-1.5',
        disabled && 'opacity-50',
        className,
      )}
    >
      <div className={cn('no-scrollbar flex max-w-full items-center overflow-x-auto', compact ? 'gap-0.5 pointer-coarse:-my-1.5 pointer-coarse:py-1.5' : 'gap-1')}>
        {emojis.map((emoji, i) => (
          <motion.button
            key={emoji}
            type="button"
            disabled={disabled}
            aria-label={t('shell.reactions.button', { name: reactionName(emoji) })}
            title={reactionName(emoji)}
            onClick={(e) => send(emoji, i, e.currentTarget)}
            whileHover={reduce || disabled ? undefined : { scale: 1.14, y: -2 }}
            whileTap={reduce || disabled ? undefined : { scale: 0.86 }}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
            className={cn(
              'tap-none relative grid shrink-0 touch-manipulation place-items-center rounded-full transition-colors',
              'hover:bg-white/10 focus-visible:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed',
              size,
            )}
          >
            <motion.span
              key={pressed?.index === i ? pressed.n : 0}
              className="emoji pointer-events-none leading-none"
              initial={pressed?.index === i && !reduce ? { scale: 1.55, rotate: -14 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 13 }}
            >
              {emoji}
            </motion.span>
          </motion.button>
        ))}
      </div>
      {/* Local ghosts rise from the pressed button (outside the scroller so they aren't clipped). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {ghosts.map((g) => (
            <motion.span
              key={g.id}
              className="emoji absolute top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none"
              style={{ left: g.left, fontSize: compact ? 20 : 24 }}
              initial={{ opacity: 0.95, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: g.dx, y: -64, scale: 1.5 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              onAnimationComplete={() => setGhosts((cur) => cur.filter((x) => x.id !== g.id))}
            >
              {g.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
