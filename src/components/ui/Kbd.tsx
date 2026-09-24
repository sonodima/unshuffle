import type { ReactNode } from 'react'
import { cn } from './cn'

export interface KbdProps {
  children: ReactNode
  /** Hide on touch-only devices (default true) — keyboard hints are noise on phones. */
  touchHidden?: boolean
  className?: string
}

/** Keycap for shortcut hints, e.g. <Kbd>Spazio</Kbd>. */
export function Kbd({ children, touchHidden = true, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'num inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/15 border-b-white/5 bg-linear-to-b from-white/15 to-white/5 px-1.5 text-[11px] font-semibold text-ink-100 shadow-[0_2px_0_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.15)]',
        touchHidden && 'pointer-coarse:hidden',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
