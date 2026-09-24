import { Avatar, cn } from '../../components/ui'
import type { AvatarSize } from '../../components/ui'
import type { Player, PlayerId } from '../../game/types'
import { useT } from '../../i18n/react'

interface PlayersStripProps {
  players: readonly Player[]
  /** Players showing the lime ✓ badge (confirmed / ready). */
  checked?: ReadonlySet<PlayerId>
  me?: PlayerId
  size?: AvatarSize
  /** Show at most this many avatars, then a "+k" chip. */
  max?: number
  /** Negative spacing (stacked) instead of a gap. */
  overlap?: boolean
  className?: string
  label?: string
}

const OVERLAP: Partial<Record<AvatarSize, string>> = { xs: '-ml-1.5', sm: '-ml-2', md: '-ml-3' }
const GAP: Partial<Record<AvatarSize, string>> = { xs: 'gap-1', sm: 'gap-1.5', md: 'gap-2' }
const MORE: Partial<Record<AvatarSize, string>> = { xs: 'h-6 min-w-6 text-[10px]', sm: 'h-8 min-w-8 text-[11px]', md: 'h-11 min-w-11 text-xs' }

/** Row of player avatars with check badges; "me" gets a thin highlight ring. */
export function PlayersStrip({ players, checked, me, size = 'sm', max = 8, overlap = false, className, label }: PlayersStripProps) {
  const t = useT()
  const shown = players.length > max ? players.slice(0, max - 1) : players
  const hidden = players.length - shown.length
  return (
    <ul aria-label={label} className={cn('flex items-center', !overlap && GAP[size], className)}>
      {shown.map((p, i) => (
        <li key={p.id} className={cn('relative flex', overlap && i > 0 && OVERLAP[size])} style={{ zIndex: shown.length - i }}>
          <Avatar
            avatar={p.avatar}
            color={p.color}
            name={p.id === me ? t('round.players.me', { name: p.name }) : p.name}
            size={size}
            submitted={checked?.has(p.id)}
            connected={p.connected}
            className={cn(p.id === me && 'rounded-full shadow-[0_0_0_2px_rgb(255_255_255/0.85)]')}
          />
        </li>
      ))}
      {hidden > 0 && (
        <li
          className={cn(
            'num relative grid place-items-center rounded-full border border-white/15 bg-ink-800 px-1 font-bold text-ink-100',
            MORE[size],
            overlap ? OVERLAP[size] : '',
          )}
          aria-label={t('round.players.more', { count: hidden })}
        >
          +{hidden}
        </li>
      )}
    </ul>
  )
}
