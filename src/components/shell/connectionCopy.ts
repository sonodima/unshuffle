// Italian copy for the connection dialogs (pure: no React, no store), chosen by
// where the player was (lobby / game / final) and by why the link is gone.
// Used by ConnectionOverlay; exported for tests.

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

export function lostContextFor(phase: Pick<Phase, 'kind'> | null | undefined): LostContext {
  if (!phase || phase.kind === 'lobby') return 'lobby'
  return phase.kind === 'final' ? 'final' : 'game'
}

const ROOM_NOT_FOUND_RE = /stanza non trovata/i

/** "Stanza non trovata. Controlla il codice." after a rejoin means the room is gone, not a typo. */
export function isRoomGoneMessage(message: string | null | undefined): boolean {
  return !!message && ROOM_NOT_FOUND_RE.test(message)
}

/**
 * @param hostGone store messages that mean the host left for good (see ConnectionOverlay).
 */
export function exitReasonFor(message: string, connection: Connection, hostGone: ReadonlySet<string> = new Set()): ExitReason {
  if (message === REJECT_MESSAGES.kicked) return 'kicked'
  if (message === REJECT_MESSAGES.closed) return 'closed'
  if (message === REJECT_MESSAGES.duplicate) return 'duplicate'
  if (hostGone.has(message) || isRoomGoneMessage(message)) return 'gone'
  if (connection === 'error') return 'failed'
  return 'other'
}

/** Blocking dialog while the link to the host is down for good (the transport gave up). */
export function lostDialogCopy(context: LostContext, cause: LostCause, canRetry: boolean): DialogCopy {
  if (cause === 'host-gone') {
    return {
      title: context === 'lobby' ? 'L’host ha chiuso la stanza' : 'L’host ha lasciato la partita',
      description: 'La stanza non è più disponibile.',
      hint:
        context === 'final'
          ? 'La partita era finita: crea una nuova stanza per la rivincita.'
          : 'Crea una nuova stanza dalla home o entra con un altro codice.',
      icon: 'logout',
      tone: 'coral',
      canRetry: false,
    }
  }
  if (!canRetry) {
    return {
      title: 'Connessione persa',
      description: 'La connessione con la stanza si è interrotta.',
      hint: 'Controlla la connessione, poi riprova dalla home.',
      icon: 'wifi-off',
      tone: 'coral',
      canRetry: false,
    }
  }
  const hint: Record<LostContext, string> = {
    lobby: 'Riprova tra un attimo, oppure torna alla home e creane una tua.',
    game: 'Se l’host è ancora in partita, rientrando riprendi da dove eri, con il tuo punteggio.',
    final: 'Se l’host è ancora collegato, rientrando potrai giocare la rivincita.',
  }
  return {
    title: 'Connessione persa',
    description: context === 'lobby' ? 'L’host non risponde: forse ha chiuso la stanza.' : 'L’host non risponde da un po’.',
    hint: hint[context],
    icon: 'wifi-off',
    tone: 'coral',
    canRetry: true,
  }
}

const EXIT_COPY: Record<ExitReason, Omit<DialogCopy, 'description' | 'canRetry'>> = {
  kicked: { title: 'Fuori dalla stanza', icon: 'kick', tone: 'coral', hint: 'Puoi sempre crearne una tua, o entrare con un altro codice.' },
  closed: { title: 'Stanza chiusa', icon: 'lock', tone: 'violet', hint: 'La partita è finita per tutti. Crea una nuova stanza o entra con un altro codice.' },
  duplicate: { title: 'Già in partita', icon: 'users', tone: 'violet', hint: 'Chiudi l’altra scheda per giocare da qui.' },
  gone: { title: 'Stanza non più disponibile', icon: 'logout', tone: 'coral', hint: 'Crea una nuova stanza dalla home o entra con un altro codice.' },
  failed: { title: 'Impossibile rientrare', icon: 'wifi-off', tone: 'coral', hint: 'Controlla la connessione, poi riprova col codice dalla home.' },
  other: { title: 'Sei fuori dalla stanza', icon: 'logout', tone: 'violet', hint: 'Puoi rientrare con lo stesso codice dalla home.' },
}

/** After being dropped out of a room (kicked, room closed, a rejoin that failed). */
export function exitNoticeCopy(reason: ExitReason, message: string | null | undefined): DialogCopy {
  const base = EXIT_COPY[reason] ?? EXIT_COPY.other
  // "Controlla il codice" makes no sense when the player never typed one.
  const description = reason === 'gone' && (!message || isRoomGoneMessage(message)) ? 'L’host ha chiuso la stanza o ha perso la connessione.' : (message ?? '')
  return { ...base, description, canRetry: false }
}
