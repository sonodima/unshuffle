import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { Icon, Panel, cn, formatNumber, useCanHover, type IconName } from '../../components/ui'
import { MAX_ROUND_POINTS } from '../../game/constants'
import type { GameSettings } from '../../game/types'

interface Step {
  icon: IconName
  title: string
  body: string
  tone: string
}

function steps(s: Pick<GameSettings, 'snippets' | 'finalTimer'>, canHover: boolean): Step[] {
  return [
    {
      icon: 'headphones',
      title: 'Ascolta',
      body: `Ogni canzone è tagliata in ${s.snippets} spezzoni mescolati. ${canHover ? 'Clicca' : 'Tocca'} un blocco per ascoltarlo.`,
      tone: 'var(--color-cyan)',
    },
    {
      icon: 'shuffle',
      title: 'Riordina',
      body: 'Trascina i blocchi finché la canzone torna a suonare giusta. Con ▶ la senti tutta in fila.',
      tone: 'var(--color-magenta)',
    },
    {
      icon: 'bolt',
      title: 'Conferma',
      body: `Chi conferma per primo fa partire il timer finale: agli altri restano ${s.finalTimer} secondi.`,
      tone: 'var(--color-lime)',
    },
  ]
}

/** "Mentre aspetti" card for guests: the three rules of the game, using the room's settings. */
export function HowToPlay({ settings, className }: { settings: Pick<GameSettings, 'snippets' | 'finalTimer'>; className?: string }) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const canHover = useCanHover()
  return (
    <Panel as="section" aria-labelledby={titleId} padding="lg" className={className}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="display display-skew text-lg text-ink-50 sm:text-xl">
          Come si gioca
        </h2>
        <p className="text-xs font-semibold text-ink-400">
          Ordine perfetto = <span className="num font-bold text-gold">{formatNumber(MAX_ROUND_POINTS)}</span> punti
        </p>
      </header>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps(settings, canHover).map((step, i) => (
          <motion.li
            key={step.title}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.25 + i * 0.08 }}
            className="relative flex gap-3.5 rounded-block border border-white/[0.07] bg-white/[0.035] p-4 sm:flex-col sm:gap-3"
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-2xl"
              style={{
                color: step.tone,
                background: `color-mix(in oklab, ${step.tone} 14%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${step.tone} 30%, transparent)`,
              }}
            >
              <Icon name={step.icon} size={22} strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <p className="flex items-baseline gap-2 font-extrabold text-ink-50">
                <span className="num text-xs text-ink-400">{i + 1}</span>
                {step.title}
              </p>
              <p className={cn('mt-1 text-[13px] leading-snug text-ink-300')}>{step.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </Panel>
  )
}
