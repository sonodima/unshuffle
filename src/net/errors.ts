// Network errors surfaced to the app. `message` is a catalog key (see NET_MESSAGES).

import type { MessageKey } from '../i18n'

export class NetError extends Error {
  readonly code: 'room-not-found' | 'network' | 'server' | 'timeout' | 'unsupported' | 'unknown'
  constructor(code: NetError['code'], message: MessageKey) {
    super(message)
    this.name = 'NetError'
    this.code = code
  }
}

/** Keys into the game.net catalog: the UI shows them in the viewer's language. */
export const NET_MESSAGES = {
  network: 'game.net.network',
  server: 'game.net.server',
  signaling: 'game.net.signaling',
  createTimeout: 'game.net.createTimeout',
  joinTimeout: 'game.net.joinTimeout',
  hostNoAnswer: 'game.net.hostNoAnswer',
  roomNotFound: 'game.net.roomNotFound',
  invalidCode: 'game.net.invalidCode',
  unsupported: 'game.net.unsupported',
  loadFailed: 'game.net.loadFailed',
  unknown: 'game.net.unknown',
} as const satisfies Record<string, MessageKey>

/** PeerJS error types that are worth retrying (flaky network / public server hiccups). */
const TRANSIENT = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected', 'timeout'])

export function isTransientPeerError(type: string): boolean {
  return TRANSIENT.has(type)
}

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

/** Maps a PeerJS error type (or our own 'timeout') to a NetError. */
export function netErrorFromPeer(type: string, timeoutMessage: MessageKey = NET_MESSAGES.createTimeout): NetError {
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
