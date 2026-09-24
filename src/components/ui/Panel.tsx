import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'

export type PanelVariant = 'glass' | 'solid' | 'inset' | 'outline'
export type PanelPadding = 'none' | 'sm' | 'md' | 'lg'
/** Named accent or any CSS color (e.g. an album-derived hex). */
export type GlowColor = 'violet' | 'magenta' | 'cyan' | 'lime' | 'gold' | 'coral' | (string & {})

type PanelTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'form' | 'li' | 'ul' | 'nav'

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>
  as?: PanelTag
  /**
   * glass = tinted glass card (default) · solid = opaque ink card ·
   * inset = recessed well for nesting inside a panel · outline = transparent with border.
   */
  variant?: PanelVariant
  /** none · sm 12px · md 16→20px · lg 20→28px (responsive). Default md. */
  padding?: PanelPadding
  /** Colored halo + tinted top edge. */
  glow?: GlowColor
  /** Hover lift + pointer (for clickable cards). */
  interactive?: boolean
  /** Radius: panel (28px, default) or block (18px). */
  radius?: 'panel' | 'block'
  children?: ReactNode
}

const NAMED: Record<string, string> = {
  violet: 'var(--color-violet)',
  magenta: 'var(--color-magenta)',
  cyan: 'var(--color-cyan)',
  lime: 'var(--color-lime)',
  gold: 'var(--color-gold)',
  coral: 'var(--color-coral)',
}

export function resolveColor(c: string): string {
  return NAMED[c] ?? c
}

const VARIANT: Record<PanelVariant, string> = {
  // No backdrop blur: in-flow panels sit on the (already soft) background; see glass-flat in index.css.
  glass: 'glass-flat',
  solid: 'border border-white/10 bg-ink-900 shadow-panel',
  inset: 'border border-white/[0.06] bg-ink-950/45 shadow-well',
  outline: 'border border-white/12 bg-transparent',
}

const PADDING: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-7',
}

/** Glass surface. Adds a hairline top highlight, optional colored glow. */
export function Panel({
  ref,
  as = 'div',
  variant = 'glass',
  padding = 'md',
  glow,
  interactive,
  radius = 'panel',
  className,
  style,
  children,
  ...rest
}: PanelProps) {
  const Tag = as as 'div'
  const c = glow ? resolveColor(glow) : null
  const glowStyle: CSSProperties | undefined = c
    ? {
        boxShadow: `inset 0 1px 0 0 color-mix(in oklab, ${c} 45%, transparent), 0 0 0 1px color-mix(in oklab, ${c} 30%, transparent), 0 18px 60px -18px color-mix(in oklab, ${c} 60%, transparent), 0 12px 32px -12px rgb(0 0 0 / 0.6)`,
        backgroundImage: `radial-gradient(120% 60% at 50% -10%, color-mix(in oklab, ${c} 16%, transparent), transparent 70%)`,
      }
    : undefined

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={cn(
        'relative',
        radius === 'panel' ? 'rounded-panel' : 'rounded-block',
        VARIANT[variant],
        PADDING[padding],
        variant !== 'inset' &&
          "before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/25 before:to-transparent before:content-['']",
        interactive &&
          'cursor-pointer transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-ink-850/80 active:translate-y-0 active:scale-[0.99]',
        className,
      )}
      style={glowStyle ? { ...glowStyle, ...style } : style}
      {...rest}
    >
      {children}
    </Tag>
  )
}
