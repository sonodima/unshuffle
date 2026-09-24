import type { ReactNode, SVGProps } from 'react'

// Inline SVG icon set on a 24px grid, 2px rounded strokes. Transport glyphs
// (play / pause / stop / next) are solid so they read at a glance.

const F = { fill: 'currentColor', stroke: 'none' } as const

const ICONS = {
  play: <path {...F} d="M7.2 5.6v12.8c0 1.1 1.2 1.8 2.2 1.2l10.3-6.4c.9-.6.9-1.9 0-2.4L9.4 4.4c-1-.6-2.2.1-2.2 1.2Z" />,
  pause: (
    <>
      <rect {...F} x="6" y="4.5" width="4.4" height="15" rx="1.4" />
      <rect {...F} x="13.6" y="4.5" width="4.4" height="15" rx="1.4" />
    </>
  ),
  stop: <rect {...F} x="5.5" y="5.5" width="13" height="13" rx="2.8" />,
  next: (
    <>
      <path {...F} d="M5.5 6.4v11.2c0 1 1.1 1.6 1.9 1.1l8.6-5.6c.8-.5.8-1.7 0-2.2L7.4 5.3c-.8-.5-1.9.1-1.9 1.1Z" />
      <rect {...F} x="16.8" y="5" width="2.8" height="14" rx="1.2" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  crown: (
    <>
      <path d="M4 8.2l4.2 3.6L12 5.5l3.8 6.3L20 8.2l-1.6 9.3H5.6L4 8.2Z" />
      <path d="M6 20.5h12" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.6" />
      <path d="M15.5 8.5V6.6A2.6 2.6 0 0 0 12.9 4H6.6A2.6 2.6 0 0 0 4 6.6v6.3a2.6 2.6 0 0 0 2.6 2.6h1.9" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.4 4.4 0 0 0 6.3 0l3.1-3.1a4.4 4.4 0 0 0-6.3-6.3l-1.2 1.2" />
      <path d="M14 10a4.4 4.4 0 0 0-6.3 0l-3.1 3.1a4.4 4.4 0 0 0 6.3 6.3l1.2-1.2" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <path d="M13.5 13.5h3v3M20 13.5v.01M13.5 20h.01M17 20h3v-3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.6" />
      <path d="M2.5 19.5c.8-3.4 3.4-5.6 6.5-5.6s5.7 2.2 6.5 5.6" />
      <path d="M15.6 4.7a3.6 3.6 0 0 1 0 6.6M18.2 14.4c1.7.8 2.9 2.6 3.3 5.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1-3.7 3.9-6 7.5-6s6.5 2.3 7.5 6" />
    </>
  ),
  kick: (
    <>
      <circle cx="10" cy="8" r="3.6" />
      <path d="M3.5 19.5c.8-3.4 3.3-5.6 6.5-5.6 1.3 0 2.5.3 3.5 1" />
      <path d="M16.5 14.5l4.5 4.5M21 14.5L16.5 19" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20" />
      <circle cx="15" cy="7" r="2.5" />
      <circle cx="9" cy="17" r="2.5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.8l11-2.3V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.6v4.8c0 .6.4 1 1 1h2.8l4.3 3.5c.6.5 1.4.1 1.4-.7V5.8c0-.8-.8-1.2-1.4-.7L7.8 8.6H5c-.6 0-1 .4-1 1Z" />
      <path d="M16.6 9a4.2 4.2 0 0 1 0 6M19.2 6.4a7.8 7.8 0 0 1 0 11.2" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.6v4.8c0 .6.4 1 1 1h2.8l4.3 3.5c.6.5 1.4.1 1.4-.7V5.8c0-.8-.8-1.2-1.4-.7L7.8 8.6H5c-.6 0-1 .4-1 1Z" />
      <path d="M16.8 9.5l4.7 5M21.5 9.5l-4.7 5" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15.5V12a8 8 0 0 1 16 0v3.5" />
      <rect x="3.5" y="13.5" width="4.6" height="7" rx="2" />
      <rect x="15.9" y="13.5" width="4.6" height="7" rx="2" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 6.6A5.4 5.4 0 0 0 6.6 12" />
    </>
  ),
  wave: <path d="M3.5 11v2M7 8v8M10.5 4.5v15M14 8.5v7M17.5 6v12M21 10.5v3" />,
  scissors: (
    <>
      <circle cx="6" cy="6.5" r="2.6" />
      <circle cx="6" cy="17.5" r="2.6" />
      <path d="M8.2 8L20 17.5M8.2 16L20 6.5" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3.5 7H6c2 0 3.1 1 4.1 2.5l3.3 5c1 1.5 2.1 2.5 4.1 2.5h3" />
      <path d="M3.5 17H6c1.5 0 2.5-.6 3.3-1.6M14.3 8.6c.8-1 1.8-1.6 3.2-1.6h3" />
      <path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 20H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4h3" />
      <path d="M15 16.5l4.5-4.5L15 7.5M19.5 12H9.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 3.9" />
      <path d="M12 17.3h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3l7.4-12.8Z" />
      <path d="M12 9.5v4M12 16.8h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 10.5A7.8 7.8 0 0 0 5.6 7.4L4 9.2M4 4.5v4.7h4.7" />
      <path d="M4.5 13.5a7.8 7.8 0 0 0 13.9 3.1l1.6-1.8M20 19.5v-4.7h-4.7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.6" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.6a.6.6 0 0 0-.6.6A3.5 3.5 0 0 0 8.3 10M16 6h2.4a.6.6 0 0 1 .6.6 3.5 3.5 0 0 1-3.3 3.4" />
      <path d="M12 13.2v3.3M8.5 20.5h7M9.5 20.5c0-2.2 1.1-4 2.5-4s2.5 1.8 2.5 4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  'chevron-left': <path d="M14.5 6l-6 6 6 6" />,
  'chevron-right': <path d="M9.5 6l6 6-6 6" />,
  'chevron-up': <path d="M6 14.5l6-6 6 6" />,
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  'arrow-left': <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />,
  'arrow-right': <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  sparkles: (
    <>
      <path d="M10 3.5c.6 4 3.5 6.9 7.5 7.5-4 .6-6.9 3.5-7.5 7.5-.6-4-3.5-6.9-7.5-7.5 4-.6 6.9-3.5 7.5-7.5Z" />
      <path d="M18.5 2.8c.25 1.3 1 2 2.2 2.2-1.3.25-2 1-2.2 2.2-.25-1.3-1-2-2.2-2.2 1.3-.25 2-1 2.2-2.2Z" />
      <path d="M18.6 16.4c.2 1 .8 1.6 1.8 1.8-1 .2-1.6.8-1.8 1.8-.2-1-.8-1.6-1.8-1.8 1-.2 1.6-.8 1.8-1.8Z" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4.6" />
      <path d="M5.5 4.6c2-1.2 4-1.2 6 0s4 1.2 7 0v9.2c-3 1.2-5 1.2-7 0s-4-1.2-6 0" />
    </>
  ),
  send: <path d="M20.5 3.5L10.6 13.4M20.5 3.5l-6.3 17-3.6-7.1-7.1-3.6 17-6.3Z" />,
  share: (
    <>
      <path d="M12 3.8v11M8 7.8l4-4 4 4" />
      <path d="M8 10.5H6.8a2.3 2.3 0 0 0-2.3 2.3v5.4a2.3 2.3 0 0 0 2.3 2.3h10.4a2.3 2.3 0 0 0 2.3-2.3v-5.4a2.3 2.3 0 0 0-2.3-2.3H16" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5L11 13" />
      <path d="M17 13.5v4A2.5 2.5 0 0 1 14.5 20h-8A2.5 2.5 0 0 1 4 17.5v-8A2.5 2.5 0 0 1 6.5 7h4" />
    </>
  ),
  star: <path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9L12 3.6Z" />,
  bolt: <path d="M13.5 2.8L4.8 13.6h6.8l-1.1 7.6 8.7-10.8h-6.8l1.1-7.6Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4.5 19.5l1-4.4L15.8 4.8a2.1 2.1 0 0 1 3 3L8.6 18.1l-4.1 1.4Z" />
      <path d="M13.8 6.8l3 3" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path {...F} d="M8.5 7.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM15.5 14.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 10.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z" />
    </>
  ),
  grip: (
    <path
      {...F}
      d="M9 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-6 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
    />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.3 14.2a4.6 4.6 0 0 0 7.4 0M9 9.6h.01M15 9.6h.01" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M2.5 9a14.5 14.5 0 0 1 19 0M5.8 12.5a9.6 9.6 0 0 1 12.4 0M9.1 16a4.7 4.7 0 0 1 5.8 0M12 19.6h.01" />
      <path d="M4 4l16 16" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.5L12 4l8 6.5V18a2 2 0 0 1-2 2h-3.5v-5.5h-5V20H6a2 2 0 0 1-2-2v-7.5Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17" />
      <path d="M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9c2.4-2.5 3.6-5.5 3.6-9S14.4 5.5 12 3Z" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'fill'> {
  name: IconName
  /** Pixel size (width = height). Default 20. */
  size?: number
  /** Fills closed shapes (star, crown, bolt, flag, trophy...) with currentColor. */
  filled?: boolean
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string
  strokeWidth?: number
}

export function Icon({ name, size = 20, filled = false, label, strokeWidth = 2, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {ICONS[name]}
    </svg>
  )
}
