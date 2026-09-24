import { motion } from 'motion/react'
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { AVATARS, PLAYER_COLORS } from '../../game/constants'
import { formatOrdinal } from '../../i18n'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { formatNumber, joinFacts } from './format'
import { Icon } from './Icon'
import { playSfx } from './sound'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const AVATAR_PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96 }

/** Emoji for an AVATARS index (wraps around, safe for bad data). */
function avatarEmoji(index: number): string {
  const n = AVATARS.length
  return AVATARS[((Math.trunc(index) % n) + n) % n] ?? AVATARS[0]
}
/** Hex for a PLAYER_COLORS index (wraps around). */
export function playerColor(index: number): string {
  const n = PLAYER_COLORS.length
  return PLAYER_COLORS[((Math.trunc(index) % n) + n) % n] ?? PLAYER_COLORS[0]
}

export interface AvatarProps {
  /** Index into AVATARS. */
  avatar: number
  /** Index into PLAYER_COLORS. */
  color: number
  /** Used for the accessible label / title. */
  name?: string
  /** xs 24 · sm 32 · md 44 · lg 64 · xl 96. Default md. */
  size?: AvatarSize
  /** Gold crown on top. */
  host?: boolean
  /** Lime check badge (pops in). */
  submitted?: boolean
  /** false → dimmed + grey-scaled + coral dot. Default true. */
  connected?: boolean
  /** Show a lime "online" dot while connected. */
  showStatus?: boolean
  /** Pulsing colored ring (it's your turn / currently speaking / you). */
  active?: boolean
  /** 1, 2, 3 → gold / silver / bronze medal; others → neutral number. */
  rank?: number
  className?: string
  style?: CSSProperties
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-gold text-ink-950',
  2: 'bg-silver text-ink-950',
  3: 'bg-bronze text-ink-950',
}

/** Player badge: emoji inside a glossy colored disc, with status adornments. */
export function Avatar({
  avatar,
  color,
  name,
  size = 'md',
  host,
  submitted,
  connected = true,
  showStatus,
  active,
  rank,
  className,
  style,
}: AvatarProps) {
  const t = useT()
  const px = AVATAR_PX[size]
  const c = playerColor(color)
  const badge = Math.max(12, Math.round(px * 0.38))
  const small = px <= 32
  const label = joinFacts([
    name,
    host && t('ui.avatar.host'),
    submitted && t('ui.avatar.submitted'),
    !connected && t('ui.avatar.disconnected'),
    rank ? t('ui.avatar.rank', { rank: formatOrdinal(rank) }) : null,
  ])

  return (
    <span
      role="img"
      aria-label={label || t('ui.avatar.fallback')}
      title={name}
      className={cn('relative inline-grid shrink-0 select-none place-items-center', className)}
      style={{ width: px, height: px, ...style }}
    >
      {active && connected && (
        <>
          <span
            aria-hidden
            className="absolute -inset-[3px] rounded-full"
            style={{ boxShadow: `0 0 0 2px ${c}, 0 0 16px 2px color-mix(in oklab, ${c} 55%, transparent)` }}
          />
          <span aria-hidden className="absolute -inset-[3px] animate-pulse-ring rounded-full border-2" style={{ borderColor: c }} />
        </>
      )}
      <span
        aria-hidden
        className={cn(
          'relative grid size-full place-items-center overflow-hidden rounded-full transition-[filter,opacity] duration-300',
          !connected && 'opacity-45 grayscale-[0.85]',
        )}
        style={{
          background: `radial-gradient(120% 120% at 30% 18%, color-mix(in oklab, ${c} 50%, white) 0%, ${c} 42%, color-mix(in oklab, ${c} 55%, black) 100%)`,
          boxShadow: `inset 0 ${small ? 1 : 2}px 0 rgb(255 255 255 / 0.45), inset 0 -${Math.round(px / 12)}px ${Math.round(px / 6)}px rgb(0 0 0 / 0.22), 0 0 0 ${small ? 1.5 : 2}px var(--color-ink-950), 0 ${Math.round(px / 10)}px ${Math.round(px / 4)}px -${Math.round(px / 10)}px color-mix(in oklab, ${c} 70%, transparent)`,
        }}
      >
        {/* Top gloss */}
        <span className="absolute inset-x-[14%] top-[6%] h-[38%] rounded-full bg-linear-to-b from-white/35 to-white/0" />
        <span
          className="emoji relative"
          style={{ fontSize: Math.round(px * 0.52), filter: `drop-shadow(0 ${Math.max(1, px / 28)}px ${Math.max(1, px / 20)}px rgb(0 0 0 / 0.3))` }}
        >
          {avatarEmoji(avatar)}
        </span>
      </span>

      {host && <Crown size={Math.max(13, Math.round(px * 0.5))} />}

      {submitted ? (
        <span
          aria-hidden
          className="absolute -right-[6%] -bottom-[6%] grid animate-pop place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_0_2px_var(--color-ink-950),0_0_12px_rgb(166_255_63/0.6)]"
          style={{ width: badge, height: badge }}
        >
          <Icon name="check" size={Math.round(badge * 0.72)} strokeWidth={3.6} />
        </span>
      ) : (
        (!connected || showStatus) && (
          <span
            aria-hidden
            className={cn(
              'absolute right-[2%] bottom-[2%] rounded-full shadow-[0_0_0_2px_var(--color-ink-950)]',
              connected ? 'bg-lime' : 'bg-coral',
            )}
            style={{ width: Math.max(8, Math.round(px * 0.24)), height: Math.max(8, Math.round(px * 0.24)) }}
          />
        )
      )}

      {rank != null && rank > 0 && (
        <span
          aria-hidden
          className={cn(
            'num absolute -top-[8%] -left-[10%] grid place-items-center rounded-full font-bold shadow-[0_0_0_2px_var(--color-ink-950)]',
            RANK_STYLE[rank] ?? 'bg-ink-600 text-ink-50',
          )}
          style={{ minWidth: badge, height: badge, fontSize: Math.max(9, Math.round(badge * 0.58)), paddingInline: rank > 9 ? 3 : 0 }}
        >
          {rank}
        </span>
      )}
    </span>
  )
}

function Crown({ size }: { size: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 20"
      width={size}
      height={(size * 20) / 24}
      className="absolute left-1/2 z-10 drop-shadow-[0_2px_3px_rgb(0_0_0/0.5)]"
      style={{ top: -size * 0.58, transform: 'translateX(-50%) rotate(-10deg)' }}
    >
      <path
        d="M3 6.5l4.6 4L12 3l4.4 7.5L21 6.5l-1.8 10H4.8L3 6.5Z"
        fill="var(--color-gold)"
        stroke="var(--color-ink-950)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      <path d="M6 13.2h12" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.6" fill="var(--color-gold)" stroke="var(--color-ink-950)" strokeWidth="1.6" paintOrder="stroke" />
    </svg>
  )
}

export interface AvatarGroupProps {
  players: Array<{ id?: string; avatar: number; color: number; name?: string; connected?: boolean }>
  size?: AvatarSize
  /** Max avatars before a "+N" counter. Default 5. */
  max?: number
  className?: string
}

/** Overlapping stack of avatars with a "+N" overflow counter. */
export function AvatarGroup({ players, size = 'sm', max = 5, className }: AvatarGroupProps) {
  const t = useT()
  const px = AVATAR_PX[size]
  const shown = players.slice(0, max)
  const rest = players.length - shown.length
  return (
    <div className={cn('flex items-center', className)} style={{ paddingLeft: px * 0.28 }}>
      {shown.map((p, i) => (
        <Avatar
          key={p.id ?? i}
          avatar={p.avatar}
          color={p.color}
          name={p.name}
          connected={p.connected}
          size={size}
          style={{ marginLeft: -px * 0.28, zIndex: shown.length - i }}
        />
      ))}
      {rest > 0 && (
        <span
          className="num relative grid shrink-0 place-items-center rounded-full bg-ink-700 font-bold text-ink-100 shadow-[0_0_0_2px_var(--color-ink-950)]"
          style={{ width: px, height: px, marginLeft: -px * 0.28, fontSize: Math.max(10, px * 0.34) }}
          aria-label={t('ui.avatar.more', { count: rest })}
        >
          +{formatNumber(rest)}
        </span>
      )}
    </div>
  )
}

export interface AvatarPickerProps {
  avatar: number
  color: number
  onChange(next: { avatar: number; color: number }): void
  /** Dice button that picks a random combo. Default true. */
  showRandom?: boolean
  className?: string
}

/** Emoji grid + color swatches. Both are keyboard-navigable radio groups. */
export function AvatarPicker({ avatar, color, onChange, showRandom = true, className }: AvatarPickerProps) {
  const t = useT()
  const selectedColor = playerColor(color)
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="eyebrow">{t('ui.avatarPicker.avatar')}</span>
          {showRandom && (
            <button
              type="button"
              onClick={() => {
                playSfx('pop')
                let a = avatar
                let c = color
                while (a === avatar) a = Math.floor(Math.random() * AVATARS.length)
                while (c === color) c = Math.floor(Math.random() * PLAYER_COLORS.length)
                onChange({ avatar: a, color: c })
              }}
              className="hit-slop relative -my-2 -mr-2 flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-200 transition-colors hover:bg-white/8 hover:text-white active:scale-95"
            >
              <Icon name="dice" size={16} />
              {t('ui.avatarPicker.random')}
            </button>
          )}
        </div>
        <RadioGrid
          label={t('ui.avatarPicker.avatarGroup')}
          count={AVATARS.length}
          selected={avatar}
          onSelect={(i) => onChange({ avatar: i, color })}
          className="grid-cols-6 gap-2 sm:grid-cols-8"
          renderItem={(i, isSel) => (
            <span
              className={cn(
                'relative grid aspect-square w-full place-items-center rounded-2xl border transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-spring)]',
                isSel ? 'scale-105 border-transparent' : 'border-white/[0.07] bg-white/[0.04] group-hover:scale-105 group-hover:bg-white/10 group-active:scale-95',
              )}
              style={
                isSel
                  ? {
                      background: `radial-gradient(100% 100% at 30% 20%, color-mix(in oklab, ${selectedColor} 55%, transparent), color-mix(in oklab, ${selectedColor} 22%, transparent))`,
                      boxShadow: `0 0 0 2px ${selectedColor}, 0 8px 22px -8px ${selectedColor}`,
                    }
                  : undefined
              }
            >
              <span className={cn('emoji text-[26px] transition-transform duration-200 sm:text-[28px]', isSel && 'scale-110')}>{AVATARS[i]}</span>
            </span>
          )}
          itemLabel={(i) => t('ui.avatarPicker.avatarOption', { emoji: AVATARS[i] })}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="eyebrow px-1">{t('ui.avatarPicker.color')}</span>
        <RadioGrid
          label={t('ui.avatarPicker.colorGroup')}
          count={PLAYER_COLORS.length}
          selected={color}
          onSelect={(i) => onChange({ avatar, color: i })}
          className="grid-cols-6 gap-2.5 sm:grid-cols-12 sm:gap-2"
          renderItem={(i, isSel) => (
            <span
              className={cn(
                'relative mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full transition-transform duration-200 ease-[var(--ease-spring)]',
                isSel ? 'scale-110' : 'group-hover:scale-110 group-active:scale-95',
              )}
              style={{
                background: `radial-gradient(120% 120% at 30% 20%, color-mix(in oklab, ${PLAYER_COLORS[i]} 55%, white), ${PLAYER_COLORS[i]} 45%, color-mix(in oklab, ${PLAYER_COLORS[i]} 65%, black))`,
                boxShadow: isSel
                  ? `0 0 0 3px var(--color-ink-900), 0 0 0 5px ${PLAYER_COLORS[i]}, 0 6px 18px -4px ${PLAYER_COLORS[i]}`
                  : 'inset 0 1px 0 rgb(255 255 255 / 0.4), 0 2px 6px rgb(0 0 0 / 0.4)',
              }}
            >
              {isSel && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}>
                  <Icon name="check" size={16} strokeWidth={3.4} className="text-ink-950" />
                </motion.span>
              )}
            </span>
          )}
          itemLabel={(i) => t('ui.avatarPicker.colorOption', { number: i + 1 })}
        />
      </div>
    </div>
  )
}

interface RadioGridProps {
  label: string
  count: number
  selected: number
  onSelect(i: number): void
  renderItem(i: number, selected: boolean): ReactNode
  itemLabel(i: number): string
  className?: string
}

/** Roving-tabindex radio group laid out as a CSS grid (arrow keys follow the visual grid). */
function RadioGrid({ label, count, selected, onSelect, renderItem, itemLabel, className }: RadioGridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const focusIndex = selected >= 0 && selected < count ? selected : 0

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const grid = ref.current
    if (!grid) return
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1
    const current = Number((document.activeElement as HTMLElement | null)?.dataset.index ?? focusIndex)
    let next = current
    if (e.key === 'ArrowRight') next = current + 1
    else if (e.key === 'ArrowLeft') next = current - 1
    else if (e.key === 'ArrowDown') next = current + cols
    else if (e.key === 'ArrowUp') next = current - cols
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    else return
    e.preventDefault()
    next = Math.max(0, Math.min(count - 1, next))
    if (next !== current) {
      onSelect(next)
      playSfx('hover')
      grid.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
    }
  }

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cn('grid', className)} onKeyDown={onKeyDown}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={i === selected}
          aria-label={itemLabel(i)}
          data-index={i}
          tabIndex={i === focusIndex ? 0 : -1}
          onClick={() => {
            if (i !== selected) playSfx('pop')
            onSelect(i)
          }}
          className="group relative rounded-2xl outline-offset-2 tap-none"
        >
          {renderItem(i, i === selected)}
        </button>
      ))}
    </div>
  )
}
