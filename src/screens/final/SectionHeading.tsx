import { useRef, type ReactNode } from 'react'
import { AnimatedNumber, Icon, type IconName } from '../../components/ui'
import { useRevealDelay, type Cue } from './reveal'

export function SectionHeading({ id, icon, title, aside }: { id: string; icon: IconName; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1 sm:mb-4">
      <h2 id={id} className="display display-skew flex min-w-0 items-center gap-2.5 text-[17px] text-ink-50 sm:text-xl">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.07] text-ink-200 ring-1 ring-white/10 sm:size-8">
          <Icon name={icon} size={15} strokeWidth={2.4} />
        </span>
        {title}
      </h2>
      {/* Longer languages: the title and the aside share the row, the aside wraps under itself. */}
      {aside != null && <div className="eyebrow min-w-0 pb-0.5 text-right">{aside}</div>}
    </div>
  )
}

interface CountUpProps {
  value: number
  cue: Cue
  stagger?: number
  reduced: boolean
  className?: string
  format(n: number): string
  /** Reveal driven by a parent (e.g. its row), so the number starts with the rest of it. */
  reveal?: { visible: boolean; delay: number }
}

/** Count-up that starts when visible; screen readers always get the final value. */
export function CountUp({ value, cue, stagger = 0, reduced, className, format, reveal }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const own = useRevealDelay(ref, cue, stagger)
  const { visible, delay } = reveal ?? own
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>
        <AnimatedNumber value={visible || reduced ? value : 0} from={reduced ? value : 0} delay={delay} duration={1.2} format={format} />
      </span>
    </span>
  )
}
