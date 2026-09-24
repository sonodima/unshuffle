// Copy for the connection dialogs (pure: no React, no store), chosen by where the
// player was (lobby / game / final) and by why the link is gone. Reasons are read
// from message keys, never from translated text; strings come from the catalog at
// call time. Used by ConnectionOverlay and ResumeOverlay; exported for tests.

import { msgKey, t, tm } from '../../i18n'
import type { MessageKey, Msg } from '../../i18n'
import type { Connection } from '../../game/store'
import type { Phase } from '../../game/types'
import { REJECT_MESSAGES } from '../../net/protocol'

/** Where the player was when the link dropped. */
export type LostContext = 'lobby' | 'game' | 'final'

/** Why the link is gone: a network problem (the host may still be there) or the host left for good. */
export type LostCause = 'network' | 'host-gone'

/** gone = the room no longer exists for us (host left, or a rejoin found nothing). */
export type ExitReason = 'kicked' | 'closed' | 'duplicate' | 'gone' | 'failed' | 'other'

type CopyIcon = 'wifi-off' | 'kick' | 'lock' | 'users' | 'logout'

export interface DialogCopy {
  title: string
  description: string
  hint: string
  icon: CopyIcon
  /** Coral (lost / removed) or violet (neutral) badge. */
  tone: 'coral' | 'violet'
  /** Offer "Riprova" next to "Torna alla home". */
  canRetry: boolean
}

/** Store errors meaning the host left for good (STORE_MESSAGES.hostGone): no "Riprova". */
const HOST_GONE: ReadonlySet<MessageKey> = new Set<MessageKey>(['game.store.hostGone'])

/** "Room not found" (full and short NetError message): after a rejoin, the room is gone. */
const ROOM_NOT_FOUND: ReadonlySet<MessageKey> = new Set<MessageKey>(['game.net.roomNotFound', 'game.net.short.roomNotFound'])

export function lostContextFor(phase: Pick<Phase, 'kind'> | null | undefined): LostContext {
  if (!phase || phase.kind === 'lobby') return 'lobby'
  return phase.kind === 'final' ? 'final' : 'game'
}

/** The store error says the host left for good. */
export function isHostGoneMessage(msg: Msg | null | undefined): boolean {
  const key = msgKey(msg)
  return key !== null && HOST_GONE.has(key)
}

/** "Room not found" after a rejoin means the room is gone, not a typo in the code. */
export function isRoomGoneMessage(msg: Msg | null | undefined): boolean {
  const key = msgKey(msg)
  return key !== null && ROOM_NOT_FOUND.has(key)
}

/** Why we were dropped out of a room, from the store error that came with it. */
export function exitReasonFor(msg: Msg | null | undefined, connection: Connection): ExitReason {
  const key = msgKey(msg)
  if (key === REJECT_MESSAGES.kicked) return 'kicked'
  if (key === REJECT_MESSAGES.closed) return 'closed'
  if (key === REJECT_MESSAGES.duplicate) return 'duplicate'
  if (isHostGoneMessage(msg) || isRoomGoneMessage(msg)) return 'gone'
  if (connection === 'error') return 'failed'
  return 'other'
}

const LOST_HINT: Record<LostContext, MessageKey> = {
  lobby: 'shell.lost.hintLobby',
  game: 'shell.lost.hintGame',
  final: 'shell.lost.hintFinal',
}

/** Blocking dialog while the link to the host is down for good (the transport gave up). */
export function lostDialogCopy(context: LostContext, cause: LostCause, canRetry: boolean): DialogCopy {
  if (cause === 'host-gone') {
    return {
      title: t(context === 'lobby' ? 'shell.lost.hostClosedTitle' : 'shell.lost.hostLeftTitle'),
      description: t('shell.lost.hostGoneDescription'),
      hint: t(context === 'final' ? 'shell.lost.hostGoneHintFinal' : 'shell.exit.gone.hint'),
      icon: 'logout',
      tone: 'coral',
      canRetry: false,
    }
  }
  if (!canRetry) {
    return {
      title: t('shell.lost.title'),
      description: t('shell.lost.noRetryDescription'),
      hint: t('shell.lost.noRetryHint'),
      icon: 'wifi-off',
      tone: 'coral',
      canRetry: false,
    }
  }
  return {
    title: t('shell.lost.title'),
    description: t(context === 'lobby' ? 'shell.lost.descriptionLobby' : 'shell.lost.description'),
    hint: t(LOST_HINT[context]),
    icon: 'wifi-off',
    tone: 'coral',
    canRetry: true,
  }
}

interface ExitStyle {
  title: MessageKey
  hint: MessageKey
  icon: CopyIcon
  tone: DialogCopy['tone']
}

const EXIT_COPY: Record<ExitReason, ExitStyle> = {
  kicked: { title: 'shell.exit.kicked.title', hint: 'shell.exit.kicked.hint', icon: 'kick', tone: 'coral' },
  closed: { title: 'shell.exit.closed.title', hint: 'shell.exit.closed.hint', icon: 'lock', tone: 'violet' },
  duplicate: { title: 'shell.exit.duplicate.title', hint: 'shell.exit.duplicate.hint', icon: 'users', tone: 'violet' },
  gone: { title: 'shell.exit.gone.title', hint: 'shell.exit.gone.hint', icon: 'logout', tone: 'coral' },
  failed: { title: 'shell.exit.failed.title', hint: 'shell.exit.failed.hint', icon: 'wifi-off', tone: 'coral' },
  other: { title: 'shell.exit.generic.title', hint: 'shell.exit.generic.hint', icon: 'logout', tone: 'violet' },
}

/** After being dropped out of a room (kicked, room closed, a rejoin that failed). `message`: the store error. */
export function exitNoticeCopy(reason: ExitReason, message: Msg | null | undefined): DialogCopy {
  const style = EXIT_COPY[reason] ?? EXIT_COPY.other
  // "Controlla il codice" makes no sense when the player never typed one.
  const description = reason === 'gone' && (!message || isRoomGoneMessage(message)) ? t('shell.exit.gone.description') : tm(message)
  return { title: t(style.title), hint: t(style.hint), icon: style.icon, tone: style.tone, description, canRetry: false }
}
