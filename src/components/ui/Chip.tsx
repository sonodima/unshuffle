import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'
import { playSfx } from './sound'

export type Tone = 'neutral' | 'violet' | 'magenta' | 'cyan' | 'lime' | 'gold' | 'coral'

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  ref?: Ref<HTMLButtonElement>
  /** Toggle state (aria-pressed). */
  selected?: boolean
  icon?: IconName
  /** Emoji or small node before the label. */
  leading?: ReactNode
  /** Accent used when selected. Default violet. */
  tone?: Exclude<Tone, 'neutral'>
  size?: 'sm' | 'md'
  children?: ReactNode
}

const SELECTED: Record<Exclude<Tone, 'neutral'>, string> = {
  violet: 'border-violet/80 bg-violet/25 text-white shadow-[0_0_0_1px_rgb(123_92_255/0.4),0_6px_20px_-6px_rgb(123_92_255/0.7)]',
  magenta: 'border-magenta/80 bg-magenta/20 text-white shadow-[0_0_0_1px_rgb(255_63_209/0.35),0_6px_20px_-6px_rgb(255_63_209/0.7)]',
  cyan: 'border-cyan/80 bg-cyan/15 text-white shadow-[0_0_0_1px_rgb(46_230_255/0.35),0_6px_20px_-6px_rgb(46_230_255/0.6)]',
  lime: 'border-lime/80 bg-lime/15 text-lime shadow-[0_0_0_1px_rgb(166_255_63/0.35),0_6px_20px_-6px_rgb(166_255_63/0.6)]',
  gold: 'border-gold/80 bg-gold/15 text-gold shadow-[0_0_0_1px_rgb(255_210_63/0.35),0_6px_20px_-6px_rgb(255_210_63/0.6)]',
  coral: 'border-coral/80 bg-coral/15 text-white shadow-[0_0_0_1px_rgb(255_84_112/0.35),0_6px_20px_-6px_rgb(255_84_112/0.6)]',
}

/** Selectable pill (category filters, quick picks). */
export function Chip({ ref, selected = false, icon, leading, tone = 'violet', size = 'md', className, children, onClick, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      onClick={(e) => {
        playSfx('click', { pitch: 1.25, gain: 0.8 })
        onClick?.(e)
      }}
      className={cn(
        'hit-slop relative inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 tap-none active:scale-95 disabled:opacity-40 disabled:active:scale-100',
        size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs',
        selected ? SELECTED[tone] : 'border-white/10 bg-white/[0.06] text-ink-100 hover:border-white/20 hover:bg-white/10 hover:text-white',
        className,
      )}
      {...rest}
    >
      {leading != null && <span className="emoji -ml-0.5 text-[1.1em]">{leading}</span>}
      {icon && <Icon name={icon} size={size === 'md' ? 16 : 14} strokeWidth={2.4} className="-ml-0.5" />}
      {children}
    </button>
  )
}

export interface BadgeProps {
  tone?: Tone
  /** soft = tinted (default) · solid = filled · outline = border only. */
  variant?: 'soft' | 'solid' | 'outline'
  size?: 'sm' | 'md'
  icon?: IconName
  /** Blinking dot before the text (e.g. "LIVE"). */
  dot?: boolean
  className?: string
  children?: ReactNode
  title?: string
}

const SOFT: Record<Tone, string> = {
  neutral: 'bg-white/10 text-ink-100 border-white/10',
  violet: 'bg-violet/20 text-violet-bright border-violet/30',
  magenta: 'bg-magenta/15 text-magenta border-magenta/30',
  cyan: 'bg-cyan/12 text-cyan border-cyan/30',
  lime: 'bg-lime/12 text-lime border-lime/30',
  gold: 'bg-gold/12 text-gold border-gold/30',
  coral: 'bg-coral/15 text-coral border-coral/30',
}
const SOLID: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-950 border-transparent',
  violet: 'bg-violet text-white border-transparent',
  magenta: 'bg-magenta text-white border-transparent',
  cyan: 'bg-cyan text-ink-950 border-transparent',
  lime: 'bg-lime text-ink-950 border-transparent',
  gold: 'bg-gold text-ink-950 border-transparent',
  coral: 'bg-coral text-white border-transparent',
}
const OUTLINE: Record<Tone, string> = {
  neutral: 'text-ink-200 border-white/20',
  violet: 'text-violet-bright border-violet/60',
  magenta: 'text-magenta border-magenta/60',
  cyan: 'text-cyan border-cyan/60',
  lime: 'text-lime border-lime/60',
  gold: 'text-gold border-gold/60',
  coral: 'text-coral border-coral/60',
}
const DOT: Record<Tone, string> = {
  neutral: 'bg-ink-100',
  violet: 'bg-violet-bright',
  magenta: 'bg-magenta',
  cyan: 'bg-cyan',
  lime: 'bg-lime',
  gold: 'bg-gold',
  coral: 'bg-coral',
}

/** Small non-interactive label ("HOST", "TEMPO SCADUTO", "LIVE"...). */
export function Badge({ tone = 'neutral', variant = 'soft', size = 'sm', icon, dot, className, children, title }: BadgeProps) {
  const palette = variant === 'solid' ? SOLID[tone] : variant === 'outline' ? OUTLINE[tone] : SOFT[tone]
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border font-extrabold tracking-[0.08em] whitespace-nowrap uppercase',
        size === 'sm' ? 'h-5 px-2 text-[10px]' : 'h-6 px-2.5 text-[11px]',
        palette,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 animate-blink rounded-full', variant === 'solid' ? 'bg-current' : DOT[tone])} />}
      {icon && <Icon name={icon} size={size === 'sm' ? 11 : 13} strokeWidth={2.8} />}
      {children}
    </span>
  )
}

/** Alias: some screens call it a pill. */
export const Pill = Badge
