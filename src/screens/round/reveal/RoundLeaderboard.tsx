// Round leaderboard: rows show up early (dimmed, previous ranking and totals) so
// the panel is never an empty box, light up with this round's points, then
// reshuffle into the new ranking while totals count up (rank arrows = movement
// caused by this round).
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { SnippetStrip } from '../../../components/board'
import { AnimatedNumber, Avatar, Icon, cn, playerColor } from '../../../components/ui'
import type { PlayerId, Segment } from '../../../game/types'
import type { LeaderRow } from './model'
import { formatPoints, formatSeconds, roundStats } from './model'
import { RankDelta } from './ScorePanel'

export interface RoundLeaderboardProps {
  rows: LeaderRow[]
  prevOrder: PlayerId[]
  me: PlayerId
  round: number
  segments: Segment[] | null
  hues: number[] | null
  /** Rows visible but waiting (dimmed, previous ranking, no round points yet). Default: `entered`. */
  primed?: boolean
  /** Rows lit, round points popped in. */
  entered: boolean
  /** New ranking applied (reshuffle + totals). */
  ranked: boolean
  className?: string
}

const MEDAL: Record<number, string> = { 1: 'rv-medal-gold', 2: 'rv-medal-silver', 3: 'rv-medal-bronze' }

export const RoundLeaderboard = memo(function RoundLeaderboard({
  rows,
  prevOrder,
  me,
  round,
  segments,
  hues,
  primed: primedProp,
  entered,
  ranked,
  className,
}: RoundLeaderboardProps) {
  const primed = primedProp ?? entered
  const reduce = useReducedMotion()
  const byId = useMemo(() => new Map(rows.map((r) => [r.player.id, r])), [rows])
  const shown = useMemo(() => {
    if (ranked) return rows
    const prev = prevOrder.map((id) => byId.get(id)).filter((r): r is LeaderRow => !!r)
    return prev.length === rows.length ? prev : rows
  }, [ranked, rows, prevOrder, byId])
  const stats = useMemo(() => roundStats(rows), [rows])

  return (
    <section aria-label="Classifica" className={cn('rv-lead glass-flat flex min-h-0 flex-col rounded-panel', className)}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 md:px-5 md:pt-5">
        <h3 className="display display-skew flex items-center gap-2 text-[15px] text-white md:text-base">
          <Icon name="trophy" size={17} strokeWidth={2.4} className="text-gold" />
          Classifica
        </h3>
        <span className="eyebrow">dopo il round {round + 1}</span>
      </header>
      <LayoutGroup>
        <ol className="rv-lead-list min-h-0 flex-1 overflow-y-auto px-2 pb-2 md:px-3 md:pb-3" aria-live="polite">
          {shown.map((row, i) => (
            <Row
              key={row.player.id}
              row={row}
              index={i}
              me={row.player.id === me}
              ranked={ranked}
              primed={primed || entered}
              entered={entered}
              reduce={!!reduce}
              segments={segments}
              hues={hues}
            />
          ))}
        </ol>
      </LayoutGroup>
      {stats && (
        <motion.footer
          className="grid shrink-0 grid-cols-3 gap-2 border-t border-white/8 px-4 py-3 md:px-5 md:py-4"
          initial={false}
          animate={{ opacity: ranked ? 1 : 0 }}
          transition={{ duration: 0.5, delay: ranked && !reduce ? 0.6 : 0 }}
        >
          <MiniStat label="Media" value={formatPoints(stats.average)} mono />
          <MiniStat label="Perfetti" value={String(stats.perfect)} gold={stats.perfect > 0} mono />
          <MiniStat label="Più veloce" value={stats.fastest?.name ?? '—'} sub={stats.fastest ? formatSeconds(stats.fastest.timeMs) : undefined} />
        </motion.footer>
      )}
    </section>
  )
})

interface RowProps {
  row: LeaderRow
  index: number
  me: boolean
  ranked: boolean
  primed: boolean
  entered: boolean
  reduce: boolean
  segments: Segment[] | null
  hues: number[] | null
}

function Row({ row, index, me, ranked, primed, entered, reduce, segments, hues }: RowProps) {
  const { player, result } = row
  const rank = ranked ? row.rank : row.prevRank
  const color = playerColor(player.color)
  const style = { '--pc': color } as CSSProperties
  const n = segments?.length ?? 0
  const label =
    `${rank}º, ${player.name}${me ? ' (tu)' : ''}: ` +
    (result ? `${formatPoints(result.points)} punti in questo round, ${result.correct} su ${n} al posto giusto` : row.spectator ? 'spettatore' : 'nessuna risposta') +
    `, totale ${formatPoints(ranked ? row.totalAfter : row.totalBefore)}`

  return (
    <motion.li
      layout={reduce ? false : 'position'}
      className="rv-row relative flex items-center gap-2.5 rounded-2xl px-2 py-2 md:gap-3 md:px-2.5 xl:py-2.5"
      data-me={me || undefined}
      data-connected={player.connected || undefined}
      style={style}
      aria-label={label}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={entered ? { opacity: 1, x: 0 } : primed ? { opacity: 0.5, x: 0 } : { opacity: 0, x: reduce ? 0 : 24 }}
      transition={{
        opacity: { duration: 0.3, delay: primed ? index * 0.06 : 0 },
        x: { type: 'spring', stiffness: 300, damping: 28, delay: primed ? index * 0.06 : 0 },
        layout: { type: 'spring', stiffness: 260, damping: 30 },
      }}
    >
      <span aria-hidden className={cn('rv-rank rv-tnum grid shrink-0 place-items-center rounded-full font-extrabold', MEDAL[rank] ?? 'rv-medal-none')}>
        {rank}
      </span>
      <Avatar avatar={player.avatar} color={player.color} size="sm" connected={player.connected} host={player.isHost} />
      <div aria-hidden className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('truncate text-sm font-extrabold md:text-[15px]', me ? 'text-white' : 'text-ink-50')}>{player.name}</span>
          {me && <span className="rv-you shrink-0 rounded-full px-1.5 py-px text-[9px] font-black tracking-wider">TU</span>}
          {row.top && <Icon name="bolt" filled size={13} className="shrink-0 text-gold" label="Miglior punteggio del round" />}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          {result && row.order && segments && hues ? (
            <>
              <SnippetStrip segments={segments} hues={hues} order={row.order} marks={row.marks} size="xs" className="rv-row-strip" />
              <span className={cn('rv-tnum shrink-0 text-[11px] font-bold', result.perfect ? 'text-gold' : 'text-ink-200')}>
                {result.correct}/{n}
              </span>
              {result.timedOut && <Icon name="clock" size={12} strokeWidth={2.6} className="shrink-0 text-coral" label="Tempo scaduto" />}
            </>
          ) : (
            <span className="truncate text-[11px] font-bold text-ink-400">
              {row.spectator ? (me ? 'Spettatore' : `Spettatore · gioca dal round ${player.activeFromRound + 1}`) : 'Nessuna risposta'}
            </span>
          )}
        </div>
      </div>
      <div aria-hidden className="shrink-0 text-right leading-tight">
        <motion.div
          className={cn('rv-tnum origin-right text-xs font-extrabold md:text-[13px]', !result ? 'text-ink-400' : result.perfect ? 'text-gold' : result.points > 0 ? 'text-lime' : 'text-ink-300')}
          initial={false}
          animate={entered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reduce ? 1 : 0.6 }}
          transition={entered && !reduce ? { type: 'spring', stiffness: 520, damping: 20, delay: 0.12 + index * 0.06 } : { duration: 0.2 }}
        >
          {result ? `+${formatPoints(result.points)}` : '—'}
        </motion.div>
        <div className="rv-tnum text-[15px] font-extrabold text-white md:text-base">
          <AnimatedNumber value={ranked ? row.totalAfter : row.totalBefore} from={row.totalBefore} duration={1.1} format={formatPoints} className="rv-tnum" />
        </div>
      </div>
      <span aria-hidden className="grid w-6 shrink-0 place-items-center">
        {ranked && row.rankDelta !== 0 ? (
          <motion.span initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.35 }}>
            <RankDelta delta={row.rankDelta} className="flex-col gap-0 leading-none" />
          </motion.span>
        ) : (
          <span className="h-0.5 w-2.5 rounded-full bg-white/15" />
        )}
      </span>
    </motion.li>
  )
}

function MiniStat({ label, value, sub, gold, mono }: { label: string; value: string; sub?: string; gold?: boolean; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-extrabold tracking-[0.12em] text-ink-400 uppercase">{label}</p>
      <p className={cn('mt-1 flex min-w-0 items-baseline text-sm font-extrabold', gold ? 'text-gold' : 'text-white', mono && 'rv-tnum')}>
        <span className="min-w-0 truncate">{value}</span>
        {sub && <span className="rv-tnum ml-1 shrink-0 text-[11px] font-bold text-ink-300">{sub}</span>}
      </p>
    </div>
  )
}
