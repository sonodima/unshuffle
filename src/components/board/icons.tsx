// Tiny inline glyphs used by the board (kept local: the board is self-contained).
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const

export function PlayGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M8.2 4.9c-.9-.55-2.05.1-2.05 1.15v11.9c0 1.05 1.15 1.7 2.05 1.15l9.7-5.95c.85-.52.85-1.78 0-2.3z" fill="currentColor" />
    </svg>
  )
}

export function StopGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2.6" fill="currentColor" />
    </svg>
  )
}

export function LockGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <path
        d="M7.5 10V8a4.5 4.5 0 0 1 9 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" fill="currentColor" />
    </svg>
  )
}

export function CheckGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5l4.4 4.4L19 7.4" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CrossGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}
