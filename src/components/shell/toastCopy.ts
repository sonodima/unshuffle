// Italian toast copy for store events (pure: no React), used by ToastLayer.

import { tm } from '../../i18n'
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
  /** Players currently in the room (for "ora siete N"). */
  playerCount: number
  /** Host-clock offset (hostNow() − Date.now()) used to turn `endsAt` into seconds. */
  clockOffset: number
}

const WARN_RE = /(impossibil|non disponibil|non riuscit|errore|fallit|non valid|scadut|non trovat|persa|perso)/i
const OK_RE = /(copiat|salvat|pronto|pront[ai]|fatto)/i

/** Split a long info message into a short title + body ("A: b" / "A. B" / "A — b"). */
export function splitMessage(message: string): { title: string; body?: string } {
  const text = message.trim().replace(/\s+/g, ' ')
  if (text.length <= 44) return { title: text }
  const m = /^(.{6,90}?)(?::\s+|\.\s+|\s+—\s+|;\s+)(.+)$/.exec(text)
  if (!m) return { title: text }
  const body = m[2].trim()
  return { title: m[1].trim(), body: body.charAt(0).toUpperCase() + body.slice(1) }
}

function nameOf(ctx: ToastCopyContext, id: PlayerId, fallback?: string): string {
  return (fallback && fallback.trim()) || ctx.player(id)?.name || 'Un giocatore'
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
        title: `${nameOf(ctx, e.playerId, e.name)} è in stanza`,
        body: ctx.playerCount > 1 ? `Ora siete in ${ctx.playerCount}` : undefined,
      }
    case 'player-left':
      return {
        id: toast.id,
        tone: 'neutral',
        icon: emojiOf(ctx, e.playerId) ?? 'logout',
        title: `${nameOf(ctx, e.playerId, e.name)} ha lasciato la stanza`,
      }
    case 'submitted':
      return { id: toast.id, tone: 'info', icon: 'check', title: `${nameOf(ctx, e.playerId, e.name)} ha confermato` }
    case 'first-submit': {
      const secs = Math.ceil((e.endsAt - (toast.at + ctx.clockOffset)) / 1000)
      return {
        id: toast.id,
        tone: 'warning',
        icon: 'clock',
        title: `${nameOf(ctx, e.playerId, e.name)} ha confermato`,
        body: Number.isFinite(secs) && secs > 0 ? `Ultimi ${secs} secondi per tutti!` : 'Ultimi secondi per tutti!',
      }
    }
    case 'kicked': {
      const who = ctx.player(e.playerId)?.name
      return { id: toast.id, tone: 'neutral', icon: 'kick', title: who ? `L’host ha rimosso ${who}` : 'L’host ha rimosso un giocatore' }
    }
    case 'info': {
      const text = tm(e.message)
      const { title, body } = splitMessage(text)
      const warn = WARN_RE.test(text)
      const ok = !warn && OK_RE.test(text)
      return { id: toast.id, tone: warn ? 'warning' : ok ? 'success' : 'info', icon: warn ? 'alert' : ok ? 'check' : 'info', title, body }
    }
    case 'reaction':
      return null
    default:
      return null
  }
}

