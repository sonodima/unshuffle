// Network errors surfaced to the app. Messages are user-facing (Italian).

export class NetError extends Error {
  readonly code: 'room-not-found' | 'network' | 'server' | 'timeout' | 'unsupported' | 'unknown'
  constructor(code: NetError['code'], message: string) {
    super(message)
    this.name = 'NetError'
    this.code = code
  }
}

export const NET_MESSAGES = {
  network: 'Connessione di rete non disponibile. Controlla la connessione e riprova.',
  server: 'Il server di collegamento non risponde. Riprova tra qualche secondo.',
  /** The device is online but the signaling server can't be reached at all (down, DNS, filtered). */
  signaling: 'Server di collegamento irraggiungibile. Riprova tra poco o cambia rete (Wi‑Fi o dati mobili).',
  createTimeout: 'Il server di collegamento non risponde. Riprova tra qualche secondo.',
  /** Registered fine, the host answered, but no data path could be opened (NAT / firewall). */
  joinTimeout:
    'Impossibile collegarsi all’host. Riprova; se non funziona, prova un’altra rete (Wi‑Fi o dati mobili).',
  /** Offers reached the room's id but nobody answered (host on a very slow link, or its tab asleep). */
  hostNoAnswer: 'L’host non risponde. Controlla il codice, oppure riprova tra poco.',
  roomNotFound: 'Stanza non trovata. Controlla il codice.',
  invalidCode: 'Codice stanza non valido. Sono 5 lettere, ad esempio KXQPM.',
  unsupported:
    'Questo browser non supporta le connessioni peer-to-peer (WebRTC). Prova con Chrome, Safari o Firefox aggiornati.',
  loadFailed: 'Impossibile caricare il modulo di rete. Ricarica la pagina.',
  unknown: 'Errore di connessione imprevisto. Riprova.',
} as const

/** PeerJS error types that are worth retrying (flaky network / public server hiccups). */
const TRANSIENT = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected', 'timeout'])

export function isTransientPeerError(type: string): boolean {
  return TRANSIENT.has(type)
}

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

/** Maps a PeerJS error type (or our own 'timeout') to a NetError. */
export function netErrorFromPeer(type: string, timeoutMessage: string = NET_MESSAGES.createTimeout): NetError {
  switch (type) {
    case 'network':
    case 'disconnected':
      return new NetError('network', NET_MESSAGES.network)
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
    case 'invalid-key':
    case 'ssl-unavailable':
      return new NetError('server', NET_MESSAGES.server)
    case 'browser-incompatible':
      return new NetError('unsupported', NET_MESSAGES.unsupported)
    case 'peer-unavailable':
      return new NetError('room-not-found', NET_MESSAGES.roomNotFound)
    case 'timeout':
      return new NetError('timeout', timeoutMessage)
    default:
      return new NetError('unknown', NET_MESSAGES.unknown)
  }
}

/**
 * A failure to register on the signaling server (before any host was involved).
 * PeerJS reports an unreachable server as 'network', which is only true when the
 * device itself is offline; otherwise it is the server (down, DNS, filtered).
 */
export function signalingError(type: string): NetError {
  if (isOffline()) return new NetError('network', NET_MESSAGES.network)
  switch (type) {
    case 'browser-incompatible':
      return new NetError('unsupported', NET_MESSAGES.unsupported)
    case 'server-error':
    case 'invalid-key':
    case 'ssl-unavailable':
      // The server answered, but refused us.
      return new NetError('server', NET_MESSAGES.server)
    case 'aborted':
      return new NetError('unknown', NET_MESSAGES.unknown)
    default:
      // network / socket-error / socket-closed / disconnected / timeout / anything else.
      return new NetError('server', NET_MESSAGES.signaling)
  }
}
