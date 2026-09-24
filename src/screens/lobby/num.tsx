import type { ReactNode } from 'react'
import { cn } from '../../components/ui'
import { rich } from '../../i18n/react'

/** A translated message whose `<num>…</num>` parts are shown in monospace digits (plus `className`). */
export function withNum(text: string, className?: string): ReactNode {
  return rich(text, { num: (chunk) => <span className={cn('num', className)}>{chunk}</span> })
}
