// "⚡ Giulia ha confermato! Ti restano 15 secondi" — GeoGuessr's final-countdown
// moment. The HUD gives it a slot that never covers the timer or the board: on
// phones it takes over the HUD card's first row (the timer bar stays visible
// right below), on wide screens it covers the left stat panel next to the ring.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Avatar, Icon, cn } from '../../components/ui'
import type { Player } from '../../game/types'

export interface FirstSubmitInfo {
  key: string
  player: Player | undefined
  /** The viewer confirmed first. */
  mine: boolean
  /** The viewer still has to confirm (else: neutral wording). */
  playing: boolean
  /** Whole seconds left in the round (live). */
  secondsLeft: number
}

interface FirstSubmitBannerProps {
  /** null hides the banner (with its exit animation). */
  info: FirstSubmitInfo | null
  /** Phone HUD row (one-line title, ≤ 58px tall) instead of the wide HUD panel. */
  compact: boolean
  className?: string
}

export function FirstSubmitBanner({ info, compact, className }: FirstSubmitBannerProps) {
  const reduce = useReducedMotion()
  return (
    // Never blocks anything: pointer events pass through.
    <div className={cn('pointer-events-none', className)}>
      <AnimatePresence>
        {info && (
          <motion.div
            key={info.key}
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: compact ? -18 : 0, x: compact ? 0 : -24, scale: 0.9, rotate: compact ? 0 : -1.5 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: compact ? -10 : 0, x: compact ? 0 : -12, scale: 0.96, transition: { duration: 0.22 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            // Phones: the full HUD row. Wide: as long as the message, never past the slot.
            className={compact ? 'relative w-full' : 'relative max-w-full'}
            data-first-submit-banner=""
          >
            <Content player={info.player} mine={info.mine} playing={info.playing} secondsLeft={info.secondsLeft} compact={compact} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Content({ player, mine, playing, secondsLeft, compact }: Omit<FirstSubmitInfo, 'key'> & { compact: boolean }) {
  const name = player?.name ?? 'Qualcuno'
  const tone = mine ? 'var(--color-lime)' : 'var(--color-gold)'
  const s = Math.max(0, secondsLeft)
  const secs = (
    <span key={s} className="rs-pop num inline-block font-bold">
      {s}
    </span>
  )
  const body = mine ? (
    <>Gli altri hanno ancora {secs} s</>
  ) : playing ? (
    s === 1 ? (
      <>Ti resta {secs} secondo!</>
    ) : (
      <>Ti restano {secs} secondi</>
    )
  ) : (
    <>Timer finale: {secs} s</>
  )
  return (
    <div
      className="relative overflow-hidden rounded-[22px] p-[1.5px]"
      style={{
        background: `linear-gradient(110deg, ${tone}, var(--color-magenta) 55%, var(--color-coral))`,
        boxShadow: `0 18px 50px -14px color-mix(in oklab, ${mine ? 'var(--color-lime)' : 'var(--color-magenta)'} 70%, transparent), 0 0 0 1px rgb(0 0 0 / 0.4)`,
      }}
    >
      <div
        className={cn(
          'relative flex items-center overflow-hidden rounded-[20.5px] bg-ink-950/92',
          compact ? 'h-[55px] gap-2.5 px-3' : 'min-h-[80px] gap-3.5 px-4 py-3',
        )}
      >
        <span aria-hidden className="rs-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-white/14 to-transparent" />
        <span className="relative shrink-0">
          {player && !mine ? (
            <Avatar avatar={player.avatar} color={player.color} name={player.name} size={compact ? 'sm' : 'md'} />
          ) : (
            <span className={cn('grid place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_18px_rgb(166_255_63/0.6)]', compact ? 'size-8' : 'size-11')}>
              <Icon name="check" size={compact ? 18 : 24} strokeWidth={3.2} />
            </span>
          )}
          <span
            aria-hidden
            className="absolute -right-1.5 -bottom-1 grid size-5 place-items-center rounded-full text-ink-950 shadow-[0_0_0_2px_var(--color-ink-950)]"
            style={{ background: tone }}
          >
            <Icon name="bolt" size={12} filled strokeWidth={2} />
          </span>
        </span>
        <div className="relative min-w-0 flex-1">
          {compact ? (
            // One line, so the timer bar below stays visible: only the name gives way.
            <p className="display display-skew flex min-w-0 text-[13.5px] leading-tight text-white">
              {mine ? (
                <span className="truncate pr-1">Hai confermato per primo!</span>
              ) : (
                <>
                  <span className="min-w-0 truncate pr-[0.28em]">{name}</span>
                  <span className="shrink-0 pr-1">ha confermato!</span>
                </>
              )}
            </p>
          ) : (
            // Wide HUD slot: a long name wraps to a second line instead of vanishing.
            <p className="display display-skew line-clamp-2 pr-1 text-[15px] leading-[1.15] text-white xl:text-[17px]">
              {mine ? 'Hai confermato per primo!' : `${name} ha confermato!`}
            </p>
          )}
          <p className={cn('mt-1 flex items-center gap-1.5 truncate font-extrabold', compact ? 'text-[12.5px]' : 'text-[15px]')} style={{ color: tone }}>
            <Icon name="clock" size={compact ? 13 : 15} strokeWidth={2.8} />
            <span className="truncate">{body}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
