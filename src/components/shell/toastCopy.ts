// Toast copy for store events (pure: no React), used by ToastLayer. Strings come
// from the catalog at call time; info messages are Msg values from the store.

import { msgKey, t, tm } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { AVATARS } from '../../game/constants'
import type { ToastItem } from '../../game/store'
import type { Player, PlayerId } from '../../game/types'

type ToastCopyTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

/** Plain-data toast: `icon` is a UI-kit IconName or an emoji. */
export interface ToastCopy {
  id: number
  tone: ToastCopyTone
  icon: string
  title: string
  body?: string
}

export interface ToastCopyContext {
  /** Name / avatar lookup (current room, plus players seen earlier in this session). */
  player(id: PlayerId): Pick<Player, 'name' | 'avatar'> | undefined
  /** Players currently in the room (for "Ora siete in N"). */
  playerCount: number
  /** Host-clock offset (hostNow() − Date.now()) used to turn `endsAt` into seconds. */
  clockOffset: number
}

/**
 * Tone of an info toast, from its message key. Messages from the host / store / network /
 * Deezer (`game.*`) report something that went wrong; the UI's own notices (store.notify)
 * confirm an action, unless their key says it failed (`…Failed` / `…Error`).
 */
function infoLook(key: MessageKey | null): Pick<ToastCopy, 'tone' | 'icon'> {
  if (!key) return { tone: 'info', icon: 'info' }
  if (key.startsWith('game.') || /(Failed|Error)$/.test(key)) return { tone: 'warning', icon: 'alert' }
  return { tone: 'success', icon: 'check' }
}

/** Split a long (translated) info message into a short title + body ("A: b" / "A. B" / "A — b" / "A。B"). */
export function splitMessage(message: string): { title: string; body?: string } {
  const text = message.trim().replace(/\s+/g, ' ')
  if (text.length <= 44) return { title: text }
  const m = /^(.{6,90}?)(?::\s+|\.\s+|\s+—\s+|;\s+|[。：；]\s*)(.+)$/.exec(text)
  if (!m) return { title: text }
  const body = m[2].trim()
  return { title: m[1].trim(), body: body.charAt(0).toUpperCase() + body.slice(1) }
}

function nameOf(ctx: ToastCopyContext, id: PlayerId, fallback?: string): string {
  return (fallback && fallback.trim()) || ctx.player(id)?.name || t('shell.toast.someone')
}

function emojiOf(ctx: ToastCopyContext, id: PlayerId): string | undefined {
  const p = ctx.player(id)
  return p ? AVATARS[((Math.trunc(p.avatar) % AVATARS.length) + AVATARS.length) % AVATARS.length] : undefined
}

/** Toast item for one store toast, or null when it should not be shown as a toast. */
export function toastForEvent(toast: ToastItem, ctx: ToastCopyContext): ToastCopy | null {
  const e = toast.event
  switch (e.type) {
    case 'player-joined':
      return {
        id: toast.id,
        tone: 'success',
        icon: emojiOf(ctx, e.playerId) ?? 'user',
        title: t('shell.toast.joined', { name: nameOf(ctx, e.playerId, e.name) }),
        body: ctx.playerCount > 1 ? t('shell.toast.roomCount', { count: ctx.playerCount }) : undefined,
      }
    case 'player-left':
      return {
        id: toast.id,
        tone: 'neutral',
        icon: emojiOf(ctx, e.playerId) ?? 'logout',
        title: t('shell.toast.left', { name: nameOf(ctx, e.playerId, e.name) }),
      }
    case 'submitted':
      return { id: toast.id, tone: 'info', icon: 'check', title: t('shell.toast.submitted', { name: nameOf(ctx, e.playerId, e.name) }) }
    case 'first-submit': {
      const secs = Math.ceil((e.endsAt - (toast.at + ctx.clockOffset)) / 1000)
      return {
        id: toast.id,
        tone: 'warning',
        icon: 'clock',
        title: t('shell.toast.submitted', { name: nameOf(ctx, e.playerId, e.name) }),
        body: Number.isFinite(secs) && secs > 0 ? t('shell.toast.lastSeconds', { count: secs }) : t('shell.toast.lastSecondsSoon'),
      }
    }
    case 'kicked': {
      const who = ctx.player(e.playerId)?.name
      return { id: toast.id, tone: 'neutral', icon: 'kick', title: who ? t('shell.toast.kicked', { name: who }) : t('shell.toast.kickedSomeone') }
    }
    case 'info': {
      const { title, body } = splitMessage(tm(e.message))
      return { id: toast.id, ...infoLook(msgKey(e.message)), title, body }
    }
    case 'reaction':
      return null
    default:
      return null
  }
}

