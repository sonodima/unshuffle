import { motion } from 'motion/react'
import { useRef } from 'react'
import { Avatar, Badge, Panel, cn } from '../../components/ui'
import type { PlayerId } from '../../game/types'
import { useRevealDelay, type Cue } from './reveal'
import { SectionHeading } from './SectionHeading'
import { joinNames, type Award, type AwardTone } from './stats'

const TONE: Record<AwardTone, { text: string; medal: string; glow: string }> = {
  gold: {
    text: 'text-gold',
    medal: 'from-gold/45 to-gold-deep/25 ring-gold/45',
    glow: 'var(--color-gold)',
  },
  cyan: {
    text: 'text-cyan',
    medal: 'from-cyan/40 to-cyan-deep/25 ring-cyan/45',
    glow: 'var(--color-cyan)',
  },
  lime: {
    text: 'text-lime',
    medal: 'from-lime/40 to-lime-deep/25 ring-lime/45',
    glow: 'var(--color-lime)',
  },
  coral: {
    text: 'text-coral',
    medal: 'from-coral/40 to-coral-deep/25 ring-coral/45',
    glow: 'var(--color-coral)',
  },
}

export interface AwardsProps {
  awards: Award[]
  me: PlayerId
  reduced: boolean
  /** Cards already on screen wait for the podium to land (they name the winners). */
  cue: Cue
  className?: string
}

export function Awards({ awards, me, reduced, cue, className }: AwardsProps) {
  if (!awards.length) return null
  return (
    <section className={cn(className, 'lg:sticky lg:top-6 lg:self-start')} aria-labelledby="fp-awards">
      <SectionHeading id="fp-awards" icon="sparkles" title="Premi" aside="Menzioni speciali" />
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-1">
        {awards.map((a, i) => (
          <AwardItem key={a.id} award={a} me={me} index={i} reduced={reduced} cue={cue} />
        ))}
      </ul>
    </section>
  )
}

function AwardItem({ award, me, index, reduced, cue }: { award: Award; me: PlayerId; index: number; reduced: boolean; cue: Cue }) {
  const ref = useRef<HTMLLIElement>(null)
  const { visible, delay } = useRevealDelay(ref, cue, index * 0.07)
  return (
    <motion.li
      ref={ref}
      className="min-w-0"
      initial={reduced ? false : { opacity: 0, y: 18, scale: 0.96 }}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay }}
    >
      <AwardCard award={award} me={me} />
    </motion.li>
  )
}

function AwardCard({ award, me }: { award: Award; me: PlayerId }) {
  const t = TONE[award.tone]
  const mine = award.winners.some((w) => w.id === me)
  const shown = award.winners.slice(0, 3)
  const extra = award.winners.length - shown.length
  const names = award.winners.length > 2 ? `${award.winners[0].name} e altri ${award.winners.length - 1}` : joinNames(award.winners.map((w) => w.name))

  return (
    <Panel padding="none" radius="block" glow={t.glow} className="flex h-full flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:gap-4 lg:py-3.5">
      <div className="flex items-start gap-2.5 lg:min-w-0 lg:flex-1 lg:items-center lg:gap-3">
        <span
          aria-hidden
          className={cn('emoji grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-b text-[20px] ring-1 sm:size-11 sm:text-[22px]', t.medal)}
          style={{ boxShadow: `0 0 18px -4px ${t.glow}, inset 0 1px 0 rgb(255 255 255 / 0.3)` }}
        >
          {award.emoji}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className={cn('display display-skew text-[12px] leading-[1.1] sm:text-[13px] lg:text-sm', t.text)}>{award.title}</h3>
          <p className="mt-1 text-[12px] leading-snug font-semibold text-ink-300 sm:text-[13px]">{award.description}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 lg:mt-0 lg:w-[168px] lg:shrink-0 xl:w-[200px]">
        <div className="flex shrink-0 items-center pl-1.5">
          {shown.map((w, i) => (
            <Avatar key={w.id} avatar={w.avatar} color={w.color} name={w.name} size="sm" connected={w.connected} style={{ marginLeft: i ? -12 : -6, zIndex: shown.length - i }} />
          ))}
          {extra > 0 && (
            <span className="num relative -ml-3 grid size-8 place-items-center rounded-full bg-ink-700 text-[12px] font-bold text-ink-100 shadow-[0_0_0_2px_var(--color-ink-950)]">
              +{extra}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[13px] font-extrabold text-ink-50">{names}</span>
            {mine && (
              <Badge tone="violet" variant="solid" size="md" className="max-[360px]:hidden">
                Tu
              </Badge>
            )}
          </div>
          <div className={cn('num text-[12px] leading-snug font-bold', t.text)}>{award.value}</div>
        </div>
      </div>
    </Panel>
  )
}
