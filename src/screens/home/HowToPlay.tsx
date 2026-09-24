// "Come si gioca": three illustrated steps with tiny looping animations,
// plus the scoring rule in one line. Sheet on phones, dialog on desktop.
import type { CSSProperties, ReactNode } from 'react'
import { MAX_ROUND_POINTS } from '../../game/constants'
import { Button, Icon, Modal, cn, formatNumber, useCanHover } from '../../components/ui'
import { rich, useT } from '../../i18n/react'
import { DemoBlock } from './ShuffleDemo'
import { DEMO_HUES, songEnvelope } from './demoScript'
import './home.css'

interface HowToPlayProps {
  open: boolean
  onClose(): void
}

const BARS = songEnvelope(3, 7)

/** Block size comes from CSS (--bw/--bh/--gap on .ht-art), so the art scales with the layout. */
const BLOCK: CSSProperties = { width: 'var(--bw)', height: 'var(--bh)' }

function ListenArt() {
  return (
    <div className="ht-stage ht-listen grid h-full w-full place-items-center">
      <div className="flex" style={{ gap: 'var(--gap)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...BLOCK, '--seq': `${i * 0.8}s` } as CSSProperties}>
            <DemoBlock hue={DEMO_HUES[i * 2 + 1]} letter="" bars={BARS[i]} compact />
          </div>
        ))}
      </div>
      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-cyan/15 text-cyan">
        <Icon name="headphones" size={13} strokeWidth={2.4} />
      </span>
    </div>
  )
}

function DragArt() {
  // Three blocks on fixed slots; the last one is carried to the front while the others make room.
  const slot = (i: number): CSSProperties => ({
    ...BLOCK,
    left: `calc(50% - (var(--bw) * 1.5 + var(--gap)) + ${i} * (var(--bw) + var(--gap)))`,
  })
  return (
    <div className="ht-stage h-full w-full" style={{ '--step': 'calc(var(--bw) + var(--gap))' } as CSSProperties}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: 'var(--bh)' }}>
        <div className="ht-drag-a absolute" style={slot(0)}>
          <DemoBlock hue={DEMO_HUES[4]} letter="" bars={BARS[1]} compact />
        </div>
        <div className="ht-drag-b absolute" style={slot(1)}>
          <DemoBlock hue={DEMO_HUES[2]} letter="" bars={BARS[2]} compact />
        </div>
        <div className="ht-drag-c absolute" style={slot(2)}>
          <DemoBlock hue={DEMO_HUES[0]} letter="" bars={BARS[0]} compact />
        </div>
      </div>
      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-magenta/15 text-magenta">
        <Icon name="grip" size={13} strokeWidth={2.4} />
      </span>
    </div>
  )
}

function ConfirmArt() {
  const t = useT()
  return (
    <div className="ht-stage flex h-full w-full flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
      <svg viewBox="0 0 40 40" className="size-7 -rotate-90 sm:size-9" aria-hidden>
        <circle cx="20" cy="20" r="15.9" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="5" />
        <circle className="ht-ring" cx="20" cy="20" r="15.9" fill="none" strokeWidth="5" strokeLinecap="round" pathLength={100} />
      </svg>
      <div className="relative">
        <span className="ht-press flex h-7 items-center rounded-full bg-linear-to-b from-[color-mix(in_oklab,var(--color-lime)_62%,white)] to-lime px-2 font-display text-[9px] font-extrabold tracking-wide text-ink-950 uppercase sm:h-8 sm:px-3 sm:text-[10px]">
          <span className="-skew-x-[7deg] whitespace-nowrap">{t('home.howTo.confirmButton')}</span>
        </span>
        <span className="ht-done absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_0_2px_var(--color-ink-900),0_0_14px_rgb(166_255_63/0.7)]">
          <Icon name="check" size={12} strokeWidth={3.8} />
        </span>
      </div>
    </div>
  )
}

interface Step {
  title: string
  body: ReactNode
  art: ReactNode
  /** Accent of the step number. */
  tone: string
}

const stepsFor = (t: ReturnType<typeof useT>, canHover: boolean): Step[] => [
  {
    title: t('home.howTo.steps.listen.title'),
    body: canHover ? t('home.howTo.steps.listen.bodyMouse') : t('home.howTo.steps.listen.bodyTouch'),
    art: <ListenArt />,
    tone: 'bg-cyan text-ink-950',
  },
  {
    title: t('home.howTo.steps.sort.title'),
    body: rich(t('home.howTo.steps.sort.body'), {
      play: () => <Icon name="play" size={11} className="inline align-[-1px]" aria-hidden />,
    }),
    art: <DragArt />,
    tone: 'bg-magenta text-white',
  },
  {
    title: t('home.howTo.steps.confirm.title'),
    body: t('home.howTo.steps.confirm.body'),
    art: <ConfirmArt />,
    tone: 'bg-lime text-ink-950',
  },
]

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const t = useT()
  const canHover = useCanHover()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('home.howTo.title')}
      description={t('home.howTo.description')}
      size="lg"
      footer={
        <Button variant="primary" size="lg" rightIcon="arrow-right" onClick={onClose}>
          {t('home.howTo.gotIt')}
        </Button>
      }
    >
      <ol className="ht-art grid gap-2.5 sm:grid-cols-3 sm:gap-3.5">
        {stepsFor(t, canHover).map((step, i) => (
          <li
            key={i}
            className="flex items-center gap-3.5 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-2.5 sm:flex-col sm:items-stretch sm:gap-3 sm:p-3"
          >
            <div className="relative h-[84px] w-[112px] shrink-0 sm:h-[112px] sm:w-full">
              {step.art}
              <span
                className={cn(
                  'display absolute top-2 left-2 grid size-6 place-items-center rounded-full text-[11px] shadow-[0_0_0_2px_var(--color-ink-900)]',
                  step.tone,
                )}
              >
                {i + 1}
              </span>
            </div>
            <div className="min-w-0 pr-1 sm:px-1 sm:pb-1">
              <h3 className="display display-skew text-[13px] leading-tight text-ink-50 sm:text-[15px]">{step.title}</h3>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-300 sm:mt-1.5 sm:text-[13px]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-center gap-3 rounded-3xl border border-gold/20 bg-gold/[0.07] p-3 sm:mt-4 sm:p-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
          <Icon name="trophy" size={18} strokeWidth={2.2} />
        </span>
        <p className="text-[12.5px] leading-snug text-ink-200 sm:text-[13px]">
          {rich(t('home.howTo.scoring', { count: MAX_ROUND_POINTS, points: formatNumber(MAX_ROUND_POINTS) }), {
            b: (c) => <strong className="num font-bold text-gold">{c}</strong>,
          })}
        </p>
      </div>
    </Modal>
  )
}
