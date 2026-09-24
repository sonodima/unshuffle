import { motion } from 'motion/react'
import { useId, useRef, type CSSProperties, type Ref } from 'react'
import { AnimatedNumber, Avatar, useMediaQuery, type AvatarSize } from '../../components/ui'
import type { PlayerId } from '../../game/types'
import { formatOrdinal } from '../../i18n'
import { useT } from '../../i18n/react'
import { useFitWords } from './fit'
import { formatPoints, type PlayerSummary } from './stats'
import { PODIUM_TIMING, landingTime } from './timing'

/** Display order of the three podium places: 2nd, 1st, 3rd. */
const SLOT_ORDER = [1, 0, 2]

interface PodiumProps {
  /** Standings, best first (only the first three are shown). */
  standings: PlayerSummary[]
  me: PlayerId
  reduced: boolean
  /** Nobody scored: dull metal, no crown. */
  muted?: boolean
  /** Ref on the first-place avatar (confetti origin). */
  winnerRef?: Ref<HTMLButtonElement>
  /** Winner avatar tapped: celebrate again. */
  onCheer?(): void
  /** Wide but short viewport (laptops ≤ 820px tall): lower blocks so the plates clear the action dock. */
  compact?: boolean
  /** Phone-sized blocks whatever the width (landscape phones). */
  small?: boolean
}

interface Dims {
  heights: Record<number, number>
  width: number
  centerWidth: number
  top: number
  num: number
  name: string
  score: string
  avatar: AvatarSize
  winnerAvatar: AvatarSize
  /** Extra scale for the winner (Avatar sizes are fixed presets). */
  winnerScale: number
  /** Smallest name size before a long word may break (px). */
  nameMin: number
}

// Names get up to two lines on the plate (long single words shrink, then break) instead of "DJ PINGUI…".
const PHONE: Dims = {
  heights: { 1: 162, 2: 128, 3: 106 },
  width: 104,
  centerWidth: 118,
  top: 12,
  num: 30,
  name: 'text-[12px]',
  score: 'text-[14px]',
  avatar: 'lg',
  winnerAvatar: 'xl',
  winnerScale: 1,
  nameMin: 10,
}
const WIDE: Dims = {
  heights: { 1: 218, 2: 166, 3: 130 },
  width: 176,
  centerWidth: 204,
  top: 18,
  num: 56,
  name: 'text-[14px]',
  score: 'text-[17px]',
  avatar: 'xl',
  winnerAvatar: 'xl',
  winnerScale: 1.28,
  nameMin: 11,
}
const WIDE_SHORT: Dims = {
  heights: { 1: 168, 2: 134, 3: 112 },
  width: 168,
  centerWidth: 196,
  top: 16,
  num: 40,
  name: 'text-[13px]',
  score: 'text-[16px]',
  avatar: 'xl',
  winnerAvatar: 'xl',
  winnerScale: 1.1,
  nameMin: 11,
}

export function Podium({ standings, me, reduced, muted = false, winnerRef, onCheer, compact = false, small = false }: PodiumProps) {
  const t = useT()
  const wide = useMediaQuery('(min-width: 768px)') && !small
  const d = wide ? (compact ? WIDE_SHORT : WIDE) : PHONE
  const top = standings.slice(0, 3)
  const slots = SLOT_ORDER.filter((place) => place < top.length)

  return (
    <div className="relative mx-auto w-full max-w-[680px]" role="list" aria-label={t('final.podium.label')}>
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        {slots.map((place) => {
          const s = top[place]
          const rank = Math.min(3, Math.max(1, s.rank))
          return (
            <PodiumSlot
              key={s.player.id}
              summary={s}
              place={place}
              rank={rank}
              count={top.length}
              isMe={s.player.id === me}
              muted={muted}
              dims={d}
              reduced={reduced}
              winnerRef={place === 0 ? winnerRef : undefined}
              onCheer={rank === 1 ? onCheer : undefined}
            />
          )
        })}
      </div>
      {/* Stage floor */}
      <div aria-hidden className="relative -mt-px h-px bg-linear-to-r from-transparent via-white/35 to-transparent" />
      <div aria-hidden className="fp-floor pointer-events-none mx-auto -mb-4 h-14 w-[92%] opacity-90 sm:-mb-2 sm:h-24" />
    </div>
  )
}

interface SlotProps {
  summary: PlayerSummary
  place: number
  rank: number
  count: number
  isMe: boolean
  muted: boolean
  dims: Dims
  reduced: boolean
  winnerRef?: Ref<HTMLButtonElement>
  onCheer?(): void
}

function PodiumSlot({ summary, place, rank, count, isMe, muted, dims, reduced, winnerRef, onCheer }: SlotProps) {
  const t = useT()
  const { player } = summary
  const first = rank === 1 && !muted
  const h = dims.heights[muted ? 3 : rank] ?? dims.heights[3]
  const width = place === 0 ? dims.centerWidth : dims.width
  const land = landingTime(place, count, reduced)
  const rise = reduced ? 0 : PODIUM_TIMING.riseStart + (Math.min(count, 3) - 1 - place) * PODIUM_TIMING.riseStagger
  const avatarSize = first ? dims.winnerAvatar : dims.avatar
  const label = t(isMe ? 'final.podium.slotMe' : 'final.podium.slot', { rank: formatOrdinal(summary.rank), name: player.name, count: summary.score, points: formatPoints(summary.score) })
  const nameRef = useRef<HTMLSpanElement>(null)
  useFitWords(nameRef, `${player.name}|${dims.name}`, { min: dims.nameMin })

  const avatar = (
    <Avatar avatar={player.avatar} color={player.color} name={player.name} size={avatarSize} connected={player.connected} active={isMe} />
  )

  return (
    <div role="listitem" aria-label={label} className="fp-slot flex min-w-0 flex-col items-center" data-rank={muted ? 0 : rank} style={{ width, flex: `0 1 ${width}px` }}>
      {/* Avatar falls onto the block */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        style={{ marginBottom: -Math.round(dims.top * 0.55) }}
        initial={reduced ? { opacity: 0 } : { y: -260, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { y: [-260, 0, -16, 0], opacity: [0, 1, 1, 1] }}
        transition={
          reduced
            ? { duration: 0.3, delay: land - 0.25 }
            : { duration: PODIUM_TIMING.fall + 0.34, times: [0, 0.575, 0.78, 1], ease: ['easeIn', 'easeOut', 'easeIn'], delay: land - PODIUM_TIMING.fall }
        }
      >
        <div style={first && dims.winnerScale !== 1 ? { transform: `scale(${dims.winnerScale})`, transformOrigin: '50% 100%' } : undefined} className="relative">
          {first && <WinnerFlair reduced={reduced} delay={land} big={avatarSize === 'xl'} />}
          <motion.div
            style={{ transformOrigin: '50% 100%' }}
            initial={false}
            animate={reduced ? undefined : { scaleY: [1, 0.8, 1.07, 1], scaleX: [1, 1.14, 0.96, 1] }}
            transition={{ duration: 0.42, delay: land, ease: 'easeOut' }}
          >
            {onCheer ? (
              <button
                ref={winnerRef}
                type="button"
                onClick={onCheer}
                aria-label={t('final.podium.cheer', { name: player.name })}
                className="tap-none block rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
              >
                {avatar}
              </button>
            ) : (
              avatar
            )}
          </motion.div>
        </div>
        {/* Landing puff */}
        {!reduced && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-[120%] -translate-x-1/2 rounded-[50%] bg-white/50 blur-[6px]"
            initial={{ opacity: 0, scaleX: 0.3 }}
            animate={{ opacity: [0, 0.8, 0], scaleX: [0.3, 1.1, 1.5] }}
            transition={{ duration: 0.55, delay: land, ease: 'easeOut' }}
          />
        )}
      </motion.div>

      {/* The block springs up from the stage floor */}
      <div className="w-full" style={{ height: h + dims.top }}>
        <motion.div
          className="fp-block"
          style={{ '--top': `${dims.top}px`, '--shine-delay': `${rise + 0.6}s` } as CSSProperties}
          initial={reduced ? { opacity: 0 } : { scaleY: 0 }}
          animate={reduced ? { opacity: 1 } : { scaleY: 1 }}
          transition={reduced ? { duration: 0.3 } : { type: 'spring', stiffness: 170, damping: 15, mass: 0.9, delay: rise }}
        >
          <div className="fp-top" />
          <motion.div
            className="fp-front flex flex-col items-center px-1 pt-2.5 sm:px-2.5 sm:pt-4"
            initial={reduced ? false : { opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: rise }}
          >
            <motion.span
              aria-hidden
              className="fp-num display-skew relative block"
              style={{ fontSize: dims.num }}
              initial={reduced ? false : { opacity: 0, y: 8, scale: 0.7 }}
              animate={{ opacity: 0.9, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: rise + 0.3 }}
            >
              {summary.rank}
            </motion.span>
            {/* Pinned to the bottom: a two-line name grows the plate upward over the number, never off the block.
                The name appears as its avatar lands (not before: the drop is the reveal). */}
            <motion.div
              className="fp-plate absolute inset-x-1 bottom-1 flex min-w-0 flex-col items-center rounded-[9px] px-1 py-1 sm:inset-x-2.5 sm:bottom-2.5 sm:rounded-xl sm:px-1.5 sm:py-1.5"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: reduced ? rise : Math.max(rise + 0.4, land - 0.06), ease: [0.16, 1, 0.3, 1] }}
            >
              <span
                ref={nameRef}
                title={player.name}
                className={`display line-clamp-2 max-w-full text-center leading-[1.12] font-extrabold text-balance text-ink-50 ${dims.name}`}
              >
                {player.name}
              </span>
              <AnimatedNumber
                value={summary.score}
                from={reduced ? summary.score : 0}
                delay={land}
                duration={1.2}
                format={formatPoints}
                className={`fp-metal-text leading-tight font-extrabold ${dims.score}`}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function WinnerFlair({ reduced, delay, big }: { reduced: boolean; delay: number; big: boolean }) {
  const rays = big ? 230 : 170
  return (
    <>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10"
        style={{ width: rays, height: rays, marginLeft: -rays / 2, marginTop: -rays / 2 - 6 }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="fp-rays absolute inset-0 rounded-full" />
        <span className="absolute inset-[22%] rounded-full bg-gold/25 blur-2xl" />
      </motion.span>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 z-20 drop-shadow-[0_4px_10px_rgb(0_0_0/0.45)]"
        style={{ top: big ? -40 : -30, marginLeft: big ? -26 : -20 }}
        initial={{ opacity: 0, y: -26, rotate: -34, scale: 0.4 }}
        animate={{ opacity: 1, y: 0, rotate: -12, scale: 1 }}
        transition={reduced ? { duration: 0.3 } : { type: 'spring', stiffness: 420, damping: 14, delay: delay + 0.12 }}
      >
        <Crown size={big ? 52 : 40} />
      </motion.span>
    </>
  )
}

function Crown({ size }: { size: number }) {
  const id = useId()
  const stroke = { stroke: 'var(--color-ink-950)' }
  return (
    <svg viewBox="0 0 48 38" width={size} height={(size * 38) / 48} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--color-gold) 40%, white)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--color-gold)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-gold-deep)' }} />
        </linearGradient>
      </defs>
      <path d="M5 12l10 9 9-16 9 16 10-9-4 21H9L5 12Z" fill={`url(#${id})`} style={stroke} strokeWidth="3.2" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M11 27.5h26" stroke="rgb(0 0 0 / 0.28)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="5" r="3" style={{ ...stroke, fill: 'var(--color-gold)' }} strokeWidth="2.4" paintOrder="stroke" />
      <circle cx="5" cy="12" r="2.6" style={{ ...stroke, fill: 'var(--color-gold)' }} strokeWidth="2.2" paintOrder="stroke" />
      <circle cx="43" cy="12" r="2.6" style={{ ...stroke, fill: 'var(--color-gold)' }} strokeWidth="2.2" paintOrder="stroke" />
      <circle cx="24" cy="24" r="2.4" style={{ fill: 'var(--color-magenta)' }} stroke="rgb(0 0 0 / 0.3)" strokeWidth="1" />
    </svg>
  )
}
