import { useState } from 'react'
import { cn } from '../ui/cn'

export interface VinylProps {
  /** Label artwork (album cover URL). Falls back to the brand gradient. */
  cover?: string | null
  /** Diameter in px. Default 180. */
  size?: number
  /** Rotate. Stopping keeps the current angle. Default true. */
  spin?: boolean
  /** Seconds per revolution. Default 1.8 (33⅓ rpm). */
  period?: number
  /** Show the tonearm (drops onto the record while spinning). Default false. */
  arm?: boolean
  /** Colored halo under the record (CSS color). */
  glow?: string
  className?: string
  alt?: string
}

/** Spinning vinyl record with a cover label, fixed light sheen and optional tonearm. */
export function Vinyl({ cover, size = 180, spin = true, period = 1.8, arm = false, glow, className, alt = '' }: VinylProps) {
  const [broken, setBroken] = useState(false)
  const showCover = cover && !broken
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {glow && (
        <div
          aria-hidden
          className="absolute inset-[6%] rounded-full blur-2xl"
          style={{ background: glow, opacity: 0.45 }}
        />
      )}
      <div
        className="absolute inset-0 rounded-full"
        data-motion-essential=""
        style={{
          animation: `spin ${period}s linear infinite`,
          animationPlayState: spin ? 'running' : 'paused',
          background: [
            'radial-gradient(circle, transparent 0 33%, rgb(0 0 0 / 0.6) 33.5% 35%, transparent 35.5% 62%, rgb(255 255 255 / 0.05) 62.5% 63.5%, transparent 64%)',
            'repeating-radial-gradient(circle, var(--color-ink-950) 0 1.1px, var(--color-ink-800) 1.4px 2.2px, var(--color-ink-900) 2.6px 3.4px)',
          ].join(','),
          boxShadow: 'inset 0 0 0 1.5px rgb(255 255 255 / 0.14), inset 0 0 0 5px var(--color-ink-950), inset 0 0 0 6px rgb(255 255 255 / 0.05), 0 18px 40px -12px rgb(0 0 0 / 0.85), 0 0 0 1px rgb(0 0 0 / 0.6)',
        }}
      >
        {/* Label */}
        <div
          className="absolute inset-[32%] overflow-hidden rounded-full bg-gradient-brand"
          style={{ boxShadow: '0 0 0 2px rgb(0 0 0 / 0.5), inset 0 0 12px rgb(0 0 0 / 0.35)' }}
        >
          {showCover ? (
            <img src={cover} alt={alt} draggable={false} className="size-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <div className="grid size-full place-items-center">
              <span className="display text-white/90" style={{ fontSize: size * 0.07 }}>
                UN
              </span>
            </div>
          )}
          {/* Off-centre mark so rotation is visible even on plain labels */}
          <span className="absolute top-[12%] left-1/2 h-[8%] w-[3%] -translate-x-1/2 rounded-full bg-white/70 mix-blend-overlay" />
        </div>
        {/* Spindle */}
        <div className="absolute inset-[48.5%] rounded-full bg-ink-950 shadow-[0_0_0_1.5px_rgb(255_255_255/0.25)]" />
      </div>
      {/* Static sheen: reflections don't rotate with the disc */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 20deg, transparent 0deg, rgb(201 195 240 / 0.2) 30deg, transparent 64deg, transparent 180deg, rgb(255 63 209 / 0.14) 210deg, transparent 246deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle, transparent 0 32%, #000 33% 97%, transparent 98%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 0 32%, #000 33% 97%, transparent 98%)',
        }}
      />
      {arm && <Tonearm size={size} down={spin} />}
    </div>
  )
}

function Tonearm({ size, down }: { size: number; down: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size * 0.62}
      height={size * 0.62}
      className="pointer-events-none absolute drop-shadow-[0_6px_8px_rgb(0_0_0/0.6)]"
      style={{
        right: -size * 0.14,
        top: -size * 0.1,
        transformOrigin: '78% 18%',
        transform: `rotate(${down ? 0 : -26}deg)`,
        transition: 'transform 0.9s var(--ease-out-expo)',
      }}
    >
      <circle cx="78" cy="18" r="11" fill="var(--color-ink-700)" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1.5" />
      <circle cx="78" cy="18" r="4.5" fill="var(--color-ink-400)" />
      <path d="M78 18 L66 62 Q62 74 48 80" fill="none" stroke="var(--color-ink-200)" strokeWidth="4" strokeLinecap="round" />
      <rect x="36" y="74" width="16" height="10" rx="2.5" transform="rotate(-28 44 79)" fill="var(--color-ink-100)" />
      <rect x="38" y="77" width="6" height="4" rx="1" transform="rotate(-28 44 79)" fill="var(--color-magenta)" />
    </svg>
  )
}
