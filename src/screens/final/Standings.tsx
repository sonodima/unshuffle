import { motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { Avatar, Badge, Icon, Panel, cn, type IconName } from '../../components/ui'
import type { PlayerId } from '../../game/types'
import { useRevealDelay, type Cue } from './reveal'
import { CountUp, SectionHeading } from './SectionHeading'
import { formatAccuracy, formatPoints, formatSeconds, type FinalSummary, type PlayerSummary } from './stats'

const RANK_TEXT: Record<number, string> = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
}
const BAR: Record<number, string> = {
  1: 'from-gold-deep to-gold',
  2: 'from-ink-400 to-silver',
  3: 'from-bronze/60 to-bronze',
}

interface StandingsProps {
  summary: FinalSummary
  me: PlayerId
  reduced: boolean
  cue: Cue
  className?: string
}

export function Standings({ summary, me, reduced, cue, className }: StandingsProps) {
  const { standings } = summary
  const panel = useRef<HTMLDivElement>(null)
  // On screen during the podium drop (phones): the whole card waits, not just its rows.
  const { visible, delay } = useRevealDelay(panel, cue)
  return (
    <section className={className} aria-labelledby="fp-standings">
      <SectionHeading id="fp-standings" icon="trophy" title="Classifica" aside={`${standings.length} ${standings.length === 1 ? 'giocatore' : 'giocatori'}`} />
      <motion.div
        ref={panel}
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={visible ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.4, delay: Math.max(0, delay - 0.1), ease: [0.16, 1, 0.3, 1] }}
      >
        <Panel padding="none" className="overflow-hidden">
          <ol className="divide-y divide-white/[0.06]">
            {standings.map((s, i) => (
              <StandingRow key={s.player.id} s={s} index={i} summary={summary} isMe={s.player.id === me} reduced={reduced} cue={cue} />
            ))}
          </ol>
        </Panel>
      </motion.div>
    </section>
  )
}

interface RowProps {
  s: PlayerSummary
  index: number
  summary: FinalSummary
  isMe: boolean
  reduced: boolean
  cue: Cue
}

function StandingRow({ s, index, summary, isMe, reduced, cue }: RowProps) {
  const ref = useRef<HTMLLIElement>(null)
  const stagger = Math.min(index, 8) * 0.06
  const { visible, delay } = useRevealDelay(ref, cue, stagger)
  const share = summary.maxScore > 0 ? Math.max(0, Math.min(1, s.score / summary.maxScore)) : 0
  const lateFrom = s.player.activeFromRound > 0 && s.roundsPlayed > 0 ? s.player.activeFromRound + 1 : 0

  return (
    <motion.li
      ref={ref}
      className={cn('relative flex items-center gap-3 px-3.5 py-3 sm:gap-4 sm:px-5 sm:py-3.5', isMe && 'bg-violet/[0.13]')}
      initial={reduced ? false : { opacity: 0, x: -14 }}
      animate={visible ? { opacity: 1, x: 0 } : undefined}
      // Rows already on screen wait for the podium (they'd name the winner before the drop).
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {isMe && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-violet-bright shadow-[0_0_12px_var(--color-violet)]" />}
      <span className={cn('display display-skew w-6 shrink-0 text-center text-lg sm:w-7 sm:text-xl', RANK_TEXT[s.rank] ?? 'text-ink-400')}>
        <span className="sr-only">Posizione </span>
        {s.rank}
      </span>
      <Avatar avatar={s.player.avatar} color={s.player.color} name={s.player.name} size="md" connected={s.player.connected} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-extrabold text-ink-50">{s.player.name}</span>
          {isMe && (
            <Badge tone="violet" variant="solid" size="md">
              Tu
            </Badge>
          )}
          {!s.player.connected && (
            <Badge tone="coral" size="md">
              Offline
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ink-300">
          {s.roundsPlayed === 0 ? (
            <span className="text-ink-400">Non ha giocato</span>
          ) : (
            <>
              <Stat icon="star" filled title="Round perfetti" className={s.perfectRounds ? 'text-lime' : undefined}>
                {s.perfectRounds}
              </Stat>
              <Stat icon="check" title="Spezzoni al posto giusto, in media">
                {formatAccuracy(s, summary.snippets)}
              </Stat>
              {s.avgConfirmMs != null && (
                <Stat icon="bolt" title="Tempo medio di conferma" className="max-[380px]:hidden">
                  {formatSeconds(s.avgConfirmMs)}
                </Stat>
              )}
              {lateFrom > 0 && <span className="text-ink-400">dal round {lateFrom}</span>}
            </>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
          <motion.div
            className={cn('h-full origin-left rounded-full bg-linear-to-r', BAR[s.rank] ?? 'from-violet to-violet-bright')}
            initial={{ scaleX: reduced ? share : 0 }}
            animate={visible ? { scaleX: share } : undefined}
            transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <CountUp
          value={s.score}
          cue={cue}
          stagger={stagger}
          reveal={{ visible, delay }}
          reduced={reduced}
          format={formatPoints}
          className={cn('num block text-[17px] font-bold sm:text-lg', s.rank === 1 ? 'text-gold' : 'text-ink-50')}
        />
        <div className="text-[11px] font-bold tracking-[0.14em] text-ink-400 uppercase">punti</div>
      </div>
    </motion.li>
  )
}

function Stat({ icon, filled, title, className, children }: { icon: IconName; filled?: boolean; title: string; className?: string; children: ReactNode }) {
  return (
    <span className={cn('num inline-flex items-center gap-1', className)} title={title}>
      <Icon name={icon} size={12} filled={filled} strokeWidth={2.6} label={title} />
      {children}
    </span>
  )
}
