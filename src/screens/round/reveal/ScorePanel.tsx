// My points for the round: GeoGuessr-style big count-up over a 0–5000 bar, the
// breakdown (exact positions / pairs in sequence), verdict and badges.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useRef } from 'react'
import { AnimatedNumber, Badge, Icon, cn } from '../../../components/ui'
import { MAX_ROUND_POINTS } from '../../../game/constants'
import { formatOrdinal } from '../../../i18n'
import { rich, useT } from '../../../i18n/react'
import type { LeaderRow, ScoreBreakdown } from './model'
import { formatPoints, formatSeconds, pairsLabel, verdictFor } from './model'

interface ScorePanelProps {
  breakdown: ScoreBreakdown
  /** My leaderboard row (overall total + rank after this round). */
  row: LeaderRow | undefined
  /** Start counting. */
  counting: boolean
  durationS: number
  /** Show the overall total line (hidden while it would spoil the leaderboard). */
  showTotal: boolean
  onTick?: (value: number, target: number) => void
  onDone?: () => void
  className?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

export const ScorePanel = memo(function ScorePanel({
  breakdown: b,
  row,
  counting,
  durationS,
  showTotal,
  onTick,
  onDone,
  className,
}: ScorePanelProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const pct = Math.max(0, Math.min(1, b.points / MAX_ROUND_POINTS))
  const doneRef = useRef(false)
  const handleDone = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone?.()
  }, [onDone])
  const tick = useCallback((v: number) => onTick?.(v, b.points), [onTick, b.points])
  const tone = b.perfect ? 'gold' : 'lime'

  return (
    <section
      aria-label={t('reveal.score.region')}
      className={cn('rv-score glass-flat relative overflow-hidden rounded-panel p-4 md:p-5', b.perfect && 'rv-score-perfect', className)}
      data-counting={counting || undefined}
    >
      <div aria-hidden className="rv-score-wash" />
      <div className="rv-score-body relative">
        <div className="rv-score-head relative flex items-start justify-between gap-3">
          <p className="eyebrow pt-1 whitespace-nowrap">{t('reveal.score.eyebrow')}</p>
          <div className="flex flex-wrap justify-end gap-1.5">
            {b.timedOut ? (
              <Badge tone="coral" icon="clock" size="sm">
                {t('reveal.score.timedOut')}
              </Badge>
            ) : (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 text-[11px] font-bold whitespace-nowrap text-ink-100">
                <Icon name="check" size={11} strokeWidth={3} />
                {rich(t('reveal.score.confirmedIn', { time: formatSeconds(b.timeMs) }), {
                  wide: (c) => <span className="hidden min-[400px]:inline">{c}</span>,
                  num: (c) => <span className="rv-tnum">{c}</span>,
                })}
              </span>
            )}
          </div>
        </div>

        <div className="rv-score-points relative mt-1 flex flex-nowrap items-end gap-2">
          <span className={cn('rv-points', b.perfect ? 'text-gold' : 'text-lime')}>
            <AnimatedNumber value={counting ? b.points : 0} from={0} duration={durationS} signed format={formatPoints} onTick={tick} onDone={handleDone} className="rv-points-num" />
          </span>
          <span className="rv-tnum mb-[0.45em] shrink-0 text-sm font-bold whitespace-nowrap text-ink-300 md:text-base">/ {formatPoints(MAX_ROUND_POINTS)}</span>
          <AnimatePresence>
            {b.perfect && counting && <Stamp key="perfect" delay={durationS * 0.85} className="rv-stamp-lg ml-auto hidden self-center md:inline-block" />}
          </AnimatePresence>
        </div>

        {/* 0 → 5000 bar */}
        <div className="rv-bar rv-score-bar relative mt-2" role="img" aria-label={t('reveal.score.barAria', { count: b.points, points: formatPoints(b.points), max: formatPoints(MAX_ROUND_POINTS) })}>
          <motion.div
            className={cn('rv-bar-fill', `rv-bar-${tone}`)}
            initial={{ width: '0%' }}
            animate={{ width: `${(counting ? pct : 0) * 100}%` }}
            transition={reduce ? { duration: 0 } : { duration: durationS, ease: EASE }}
          />
          {[0.25, 0.5, 0.75].map((x) => (
            <span key={x} aria-hidden className="rv-bar-tick" style={{ left: `${x * 100}%` }} />
          ))}
        </div>

        <div className="rv-score-verdict relative mt-3 flex min-h-5 items-center gap-3">
          <AnimatePresence>
            {b.perfect && counting && <Stamp key="perfect-sm" delay={durationS * 0.85} className="rv-stamp-sm inline-block md:hidden" />}
          </AnimatePresence>
          <motion.p
            className={cn('text-sm font-extrabold md:text-[15px]', b.perfect ? 'text-gold' : 'text-ink-50')}
            initial={false}
            animate={{ opacity: counting ? 1 : 0, y: counting ? 0 : 6 }}
            transition={{ duration: 0.35, delay: counting && !reduce ? durationS * 0.6 : 0 }}
          >
            {verdictFor(b)}
          </motion.p>
        </div>

        <div className="rv-score-stats relative mt-3 grid grid-cols-2 gap-2">
          <Stat
            icon="check"
            tone="lime"
            value={`${b.correct}/${b.n}`}
            label={t('reveal.score.correct')}
            points={b.positionPoints}
            shown={counting}
            delay={0}
          />
          <Stat
            icon="link"
            tone="cyan"
            value={String(b.pairs)}
            label={pairsLabel(b.pairs)}
            points={b.pairPoints}
            shown={counting}
            delay={0.12}
          />
        </div>

        {row && (
          <motion.div
            className="rv-score-total relative mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3 text-sm"
            initial={false}
            animate={{ opacity: showTotal ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="font-bold text-ink-300">{t('reveal.score.total')}</span>
            <span className="flex items-center gap-2">
              <span className="rv-tnum text-base font-extrabold text-white">{formatPoints(row.totalAfter)}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-extrabold text-ink-100">{t('reveal.score.rank', { rank: formatOrdinal(row.rank) })}</span>
              {row.rankDelta !== 0 && <RankDelta delta={row.rankDelta} />}
            </span>
          </motion.div>
        )}
      </div>
    </section>
  )
})

function Stat({
  icon,
  tone,
  value,
  label,
  points,
  shown,
  delay,
}: {
  icon: 'check' | 'link'
  tone: 'lime' | 'cyan'
  value: string
  label: string
  points: number
  shown: boolean
  delay: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="rv-stat min-w-0 rounded-2xl px-3 py-2.5 md:px-3.5 md:py-3"
      data-tone={tone}
      initial={false}
      animate={{ opacity: shown ? 1 : 0.4, y: shown || reduce ? 0 : 4 }}
      transition={{ duration: 0.35, delay: shown ? delay : 0 }}
    >
      <span className="flex items-center gap-1.5">
        <span className="rv-stat-icon grid size-5 shrink-0 place-items-center rounded-md">
          <Icon name={icon} size={13} strokeWidth={3.2} />
        </span>
        <span className="rv-tnum text-lg leading-none font-extrabold text-white md:text-xl">{shown ? value : '–'}</span>
        <span className="rv-tnum ml-auto pl-1 text-[11px] font-bold text-ink-300 md:text-xs">{shown ? `+${formatPoints(points)}` : ''}</span>
      </span>
      <span className="mt-1.5 block truncate text-[11px] font-bold text-ink-200 md:text-xs">{label}</span>
    </motion.div>
  )
}

function Stamp({ delay, className }: { delay: number; className?: string }) {
  const t = useT()
  const reduce = useReducedMotion()
  return (
    <motion.span
      className={cn('rv-stamp display display-skew shrink-0', className)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: -14 }}
      animate={{ opacity: 1, scale: 1, rotate: -6 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 380, damping: 17, delay }}
    >
      {t('reveal.score.stamp')}
    </motion.span>
  )
}

export function RankDelta({ delta, className }: { delta: number; className?: string }) {
  const t = useT()
  if (!delta) return null
  const up = delta > 0
  return (
    <span
      className={cn('rv-delta rv-tnum inline-flex items-center gap-0.5 text-xs font-extrabold', up ? 'text-lime' : 'text-coral', className)}
      aria-label={t(up ? 'reveal.rankUp' : 'reveal.rankDown', { count: Math.abs(delta) })}
    >
      <Icon name={up ? 'chevron-up' : 'chevron-down'} size={13} strokeWidth={3.4} />
      {Math.abs(delta)}
    </span>
  )
}
