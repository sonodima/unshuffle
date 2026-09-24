import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar, AvatarPicker, Badge, Button, Icon, IconButton, Input, Modal, Panel, cn, playerColor } from '../../components/ui'
import { MAX_NAME_LENGTH, MAX_PLAYERS } from '../../game/constants'
import type { Player, PlayerId, PlayerProfile } from '../../game/types'
import { formatNumber } from '../../i18n'
import { useT } from '../../i18n/react'
import { withNum } from './num'

export type ProfilePatch = Partial<Omit<PlayerProfile, 'id'>>

interface PlayerListProps {
  players: Player[]
  me: PlayerId
  /** Host view: shows the kick buttons (never on yourself). */
  canKick: boolean
  /** Called after the host confirmed in the dialog. */
  onKick(playerId: PlayerId): void
  /** Empty seat pressed: copy the invite link. */
  onInvite(): void
  /** Enables the "modifica profilo" button on your own row. */
  onEditProfile?(patch: ProfilePatch): void
  maxPlayers?: number
  /** Rendered under the grid (the reactions bar). */
  footer?: ReactNode
  className?: string
}

/** Player roster with free seats, kick (host) and profile editing (you). */
export function PlayerList({ players, me, canKick, onKick, onInvite, onEditProfile, maxPlayers = MAX_PLAYERS, footer, className }: PlayerListProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const titleId = useId()
  const [kickId, setKickId] = useState<PlayerId | null>(null)
  const [lastKick, setLastKick] = useState<Player | null>(null)
  const [editing, setEditing] = useState(false)
  const free = Math.max(0, maxPlayers - players.length)
  const online = players.filter((p) => p.connected).length
  const mine = players.find((p) => p.id === me)
  const kickTarget = players.find((p) => p.id === kickId) ?? null
  // Keep the name on screen while the dialog animates out.
  if (kickTarget && kickTarget !== lastKick) setLastKick(kickTarget)
  const shownKick = kickTarget ?? lastKick

  const item = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.86, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.86, transition: { duration: 0.18 } },
      }

  return (
    <Panel as="section" aria-labelledby={titleId} padding="lg" className={cn('flex flex-col', className)}>
      <header className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="display display-skew text-lg text-ink-50 sm:text-xl">
          {t('lobby.roster.title')}
        </h2>
        <div className="flex items-center gap-2">
          {online < players.length && (
            <span className="text-xs font-semibold text-ink-400">{withNum(t('lobby.roster.online', { count: online }), 'text-ink-200')}</span>
          )}
          <span className="num rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[13px] font-bold text-ink-100">
            <span aria-hidden>
              {formatNumber(players.length)}
              <span className="text-ink-400">/{formatNumber(maxPlayers)}</span>
            </span>
            <span className="sr-only">{t('lobby.roster.capacity', { count: players.length, max: maxPlayers })}</span>
          </span>
        </div>
      </header>

      {/* grid-cols-1 = minmax(0,1fr): a long (nowrap, truncated) name must not widen the track past the panel. */}
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label={t('lobby.roster.listLabel')}>
        <AnimatePresence initial={false} mode="popLayout">
          {players.map((p) => (
            <motion.li key={p.id} layout={!reduce} {...item} transition={{ type: 'spring', stiffness: 520, damping: 34 }} className="min-w-0">
              <PlayerRow
                player={p}
                isMe={p.id === me}
                canKick={canKick && p.id !== me && !p.isHost}
                onKick={() => setKickId(p.id)}
                onEdit={p.id === me && onEditProfile ? () => setEditing(true) : undefined}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {free > 0 && <FreeSeats free={free} onInvite={onInvite} />}

      {/* `empty:hidden`: the reactions bar may render nothing. */}
      {footer && <div className="mt-5 border-t border-white/[0.07] pt-4 empty:hidden">{footer}</div>}

      <Modal
        open={!!kickTarget}
        onClose={() => setKickId(null)}
        size="sm"
        title={shownKick ? t('lobby.roster.kick.title', { name: shownKick.name }) : t('lobby.roster.kick.titleFallback')}
        description={t('lobby.roster.kick.body')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setKickId(null)}>
              {t('lobby.cancel')}
            </Button>
            <Button
              variant="danger"
              leftIcon="kick"
              onClick={() => {
                if (kickId) onKick(kickId)
                setKickId(null)
              }}
            >
              {t('lobby.roster.kick.confirm')}
            </Button>
          </>
        }
      >
        {shownKick && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-ink-950/40 p-3">
            <Avatar avatar={shownKick.avatar} color={shownKick.color} name={shownKick.name} size="md" connected={shownKick.connected} />
            <span className="truncate font-bold text-ink-50">{shownKick.name}</span>
          </div>
        )}
      </Modal>

      {onEditProfile && mine && <ProfileEditor open={editing} onClose={() => setEditing(false)} player={mine} onSave={onEditProfile} />}
    </Panel>
  )
}

interface PlayerRowProps {
  player: Player
  isMe: boolean
  canKick: boolean
  onKick(): void
  onEdit?: () => void
}

function PlayerRow({ player, isMe, canKick, onKick, onEdit }: PlayerRowProps) {
  const t = useT()
  const c = playerColor(player.color)
  const style: CSSProperties | undefined = isMe
    ? {
        borderColor: `color-mix(in oklab, ${c} 45%, transparent)`,
        backgroundImage: `linear-gradient(100deg, color-mix(in oklab, ${c} 20%, transparent) 0%, transparent 70%)`,
        boxShadow: `0 8px 26px -14px color-mix(in oklab, ${c} 80%, transparent)`,
      }
    : undefined
  return (
    <div
      className={cn(
        'relative flex h-16 items-center gap-3 rounded-block border border-white/[0.07] bg-white/[0.035] pr-2 pl-3 transition-colors',
        !player.connected && 'border-dashed bg-transparent',
      )}
      style={style}
    >
      <Avatar avatar={player.avatar} color={player.color} name={player.name} size="md" host={player.isHost} connected={player.connected} showStatus />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[15px] leading-tight font-extrabold', player.connected ? 'text-ink-50' : 'text-ink-300')} title={player.name}>
          {player.name}
        </p>
        {(isMe || player.isHost || !player.connected) && (
          <div className="mt-1 flex items-center gap-1.5">
            {isMe && (
              <Badge tone="violet" variant="solid">
                {t('lobby.roster.you')}
              </Badge>
            )}
            {player.isHost && (
              <Badge tone="gold" icon="crown">
                {t('lobby.roster.host')}
              </Badge>
            )}
            {!player.connected && (
              <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-coral">
                <Icon name="wifi-off" size={12} strokeWidth={2.6} className="shrink-0" />
                <span className="truncate">{t('lobby.roster.reconnecting')}</span>
              </span>
            )}
          </div>
        )}
      </div>
      {onEdit && <IconButton icon="pencil" label={t('lobby.roster.editProfile')} size="sm" variant="ghost" onClick={onEdit} className="text-ink-300" />}
      {canKick && <IconButton icon="x" label={t('lobby.roster.kickLabel', { name: player.name })} size="sm" variant="ghost" onClick={onKick} className="text-ink-400 hover:text-coral" />}
    </div>
  )
}

/** Empty seats as dashed avatar placeholders; any of them (or the button) copies the invite link. */
function FreeSeats({ free, onInvite }: { free: number; onInvite(): void }) {
  const t = useT()
  const reduce = useReducedMotion()
  return (
    <div className="mt-3 rounded-block border border-dashed border-white/[0.12] p-3">
      <div className="flex items-center justify-between gap-3 pl-1">
        <p className="min-w-0 text-[13px] font-bold text-ink-300">{withNum(t('lobby.roster.freeSeats', { count: free }), 'text-ink-100')}</p>
        <Button variant="glass" size="sm" leftIcon="link" onClick={onInvite} className="-mb-[3px]">
          {t('lobby.roster.invite')}
        </Button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-hidden>
        <AnimatePresence initial={false} mode="popLayout">
          {Array.from({ length: free }, (_, i) => (
            <motion.li
              key={i}
              layout={!reduce}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={onInvite}
                className="group grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-white/20 text-ink-500 transition-[border-color,color,transform,background-color] duration-200 tap-none hover:scale-110 hover:border-lime/60 hover:bg-lime/[0.06] hover:text-lime active:scale-95"
              >
                <Icon name="plus" size={14} strokeWidth={2.6} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function ProfileEditor({ open, onClose, player, onSave }: { open: boolean; onClose(): void; player: Player; onSave(patch: ProfilePatch): void }) {
  const t = useT()
  const [draft, setDraft] = useState({ name: player.name, avatar: player.avatar, color: player.color })
  const [wasOpen, setWasOpen] = useState(open)
  // Re-seed the draft each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft({ name: player.name, avatar: player.avatar, color: player.color })
  }
  const name = draft.name.trim()
  const save = () => {
    if (!name) return
    onSave({ name, avatar: draft.avatar, color: draft.color })
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('lobby.profile.title')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('lobby.cancel')}
          </Button>
          <Button leftIcon="check" disabled={!name} onClick={save}>
            {t('lobby.profile.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar avatar={draft.avatar} color={draft.color} size="lg" host={player.isHost} />
          <Input
            label={t('lobby.profile.name')}
            value={draft.name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            containerClassName="flex-1"
            placeholder={t('lobby.profile.namePlaceholder')}
            error={name ? undefined : t('lobby.profile.nameRequired')}
          />
        </div>
        <AvatarPicker avatar={draft.avatar} color={draft.color} onChange={(v) => setDraft((d) => ({ ...d, ...v }))} />
      </form>
    </Modal>
  )
}
