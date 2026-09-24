import { useT } from '../../i18n/react'
import { cn } from './cn'

export interface SpinnerProps {
  /** Pixel size. Default 20. */
  size?: number
  className?: string
  /** Screen-reader label. Default "Caricamento…" (ui.loading). Pass null to mark decorative. */
  label?: string | null
}

/** Minimal arc spinner in currentColor. */
export function Spinner({ size = 20, className, label }: SpinnerProps) {
  const t = useT()
  const name = label === undefined ? t('ui.loading') : label
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={cn('shrink-0 animate-spin', className)}
      style={{ animationDuration: '0.8s' }}
      data-motion-essential=""
      role={name ? 'status' : undefined}
      aria-label={name ?? undefined}
      aria-hidden={name ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
