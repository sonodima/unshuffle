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
  server: 'Il server di connessione non risponde. Riprova tra qualche secondo.',
  createTimeout: 'Il server di connessione non risponde. Riprova tra qualche secondo.',
  joinTimeout:
    'Impossibile collegarsi all’host. Riprova; se non funziona, prova un’altra rete (Wi‑Fi o dati mobili).',
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
