// PeerJS transport over the public PeerJS cloud signaling server
// (0.peerjs.com:443, TLS) + Google STUN, with an optional build-time TURN relay
// (VITE_TURN_URLS / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL, see peer.ts).
// Star topology: host peer id = PEER_PREFIX + roomCode; clients connect to it
// with one reliable, ordered JSON data channel each.
//
// On the wire every app message is wrapped in a small envelope (see wire.ts)
// so the transport can run its own heartbeats (2 s, link dead after 10 s of
// silence), send goodbyes, and chunk messages larger than PeerJS' 16 KB JSON
// frame limit (a full RoomState easily exceeds it).

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../game/constants'
import type { ClientMsg, HostMsg } from './protocol'
import { ClientConnectionImpl, connectClient } from './client'
import { NetError, NET_MESSAGES } from './errors'
import { HostServerImpl, createHostServer } from './host'
import { getIceServers, loadPeerJs, setIceServers, setIceTransportPolicy } from './peer'
import type { PeerModule } from './peer'
import { netStats, readNetLog } from './runtime'
import type { NetLogEntry } from './runtime'

export { NetError }

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error'

/** Host side: accepts client data connections. */
export interface HostServer {
  readonly code: string
  /** Called for every message from any client connection. connId is opaque & unique per connection. */
  onMessage(cb: (connId: string, msg: ClientMsg) => void): () => void
  onConnect(cb: (connId: string) => void): () => void
  /** Connection closed / timed out (no traffic for ~10s). */
  onDisconnect(cb: (connId: string) => void): () => void
  /** Signaling-server status (data connections survive short signaling drops). */
  onStatus(cb: (status: ConnStatus, detail?: string) => void): () => void
  send(connId: string, msg: HostMsg): void
  broadcast(msg: HostMsg): void
  /** Close one client connection (after optionally sending a final message). */
  drop(connId: string, finalMsg?: HostMsg): void
  close(): void
  /**
   * PeerJS id of the tab behind a connection. Stable across that tab's
   * automatic reconnections, different for another tab / device. Optional so
   * test doubles don't have to implement it.
   */
  remotePeerId?(connId: string): string | null
}

/**
 * Create a host with a fresh random room code (retries on id collision).
 * Pass `code` to try to reclaim a specific code (host refresh recovery).
 */
export async function createHost(opts?: { code?: string }): Promise<HostServer> {
  const requested = opts?.code ? normalizeRoomCode(opts.code) : null
  const mod = await loadModule()
  return createHostServer(mod, requested)
}

/** Client side: one reliable data channel to the host, with automatic reconnection. */
export interface ClientConnection {
  readonly code: string
  send(msg: ClientMsg): void
  onMessage(cb: (msg: HostMsg) => void): () => void
  /** 'open' fires on first connect AND after each successful reconnect (re-send hello then). */
  onStatus(cb: (status: ConnStatus, detail?: string) => void): () => void
  close(): void
}

/** Connect to a room. Rejects with NetError('room-not-found') if no host with that code. */
export async function joinRoom(code: string): Promise<ClientConnection> {
  const normalized = normalizeRoomCode(code)
  if (!normalized) throw new NetError('room-not-found', NET_MESSAGES.invalidCode)
  const mod = await loadModule()
  return connectClient(mod, normalized)
}

const CODE_IN_URL = [/[#/]r\/([A-Za-z]+)/, /[?&]r=([A-Za-z]+)/]

/** Normalize user input into a room code (uppercase, strip spaces/URL). Null if invalid. */
export function normalizeRoomCode(input: string): string | null {
  if (typeof input !== 'string') return null
  const text = input.trim()
  let candidate = text.replace(/[\s\-_.·]+/g, '')
  for (const re of CODE_IN_URL) {
    const m = re.exec(text)
    if (m) {
      candidate = m[1]
      break
    }
  }
  candidate = candidate.toUpperCase()
  if (candidate.length !== ROOM_CODE_LENGTH) return null
  for (const ch of candidate) if (!ROOM_CODE_ALPHABET.includes(ch)) return null
  return candidate
}

/**
 * Overrides the ICE servers (STUN/TURN) for connections created from now on,
 * e.g. with TURN credentials fetched at runtime. null restores the defaults.
 */
export function configureIceServers(servers: RTCIceServer[] | null): void {
  setIceServers(servers)
}

/**
 * Starts downloading the PeerJS chunk ahead of time (e.g. when Home mounts),
 * so "Crea stanza" / "Entra" don't wait for it. Never rejects.
 */
export function preloadTransport(): Promise<void> {
  return loadPeerJs().then(
    () => undefined,
    () => undefined,
  )
}

async function loadModule(): Promise<PeerModule> {
  if (typeof RTCPeerConnection === 'undefined') throw new NetError('unsupported', NET_MESSAGES.unsupported)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new NetError('network', NET_MESSAGES.network)
  }
  let mod: PeerModule
  try {
    mod = await loadPeerJs()
  } catch {
    throw new NetError('network', NET_MESSAGES.loadFailed)
  }
  if (!mod.util.supports.data) throw new NetError('unsupported', NET_MESSAGES.unsupported)
  return mod
}

/** Diagnostics & fault injection for labs / tests. Not used by the game. */
export const netDebug = {
  /** Live resource counters: Peers, timers, DOM listeners, open hosts / clients. */
  stats: (): typeof netStats => ({ ...netStats }),
  /** Recent transport events (ring buffer, newest last). */
  log: (): NetLogEntry[] => readNetLog(),
  /** Client: close the underlying DataConnection (the transport should reconnect). */
  breakLink: (conn: ClientConnection): boolean => conn instanceof ClientConnectionImpl && conn.debugBreak(),
  /** Client: stop all traffic on the current link silently (heartbeat timeout path). */
  freezeLink: (conn: ClientConnection): boolean => conn instanceof ClientConnectionImpl && conn.debugFreeze(),
  /** Client: reconnect but leave the old channel open (the host must retire it). */
  abandonLink: (conn: ClientConnection): boolean => conn instanceof ClientConnectionImpl && conn.debugAbandon(),
  /** Host: close one client's DataConnection from the host side. */
  breakHostLink: (server: HostServer, connId: string): boolean =>
    server instanceof HostServerImpl && server.debugBreak(connId),
  /** Drop the signaling socket (tests peer.reconnect(); data channels must survive). */
  dropSignaling: (target: HostServer | ClientConnection): boolean =>
    target instanceof HostServerImpl
      ? target.debugDropSignaling()
      : target instanceof ClientConnectionImpl && target.debugDropSignaling(),
  /** Host: ids of the currently open connections. */
  connIds: (server: HostServer): string[] => (server instanceof HostServerImpl ? server.debugConnIds() : []),
  /** Client: this tab's PeerJS id. */
  peerId: (conn: ClientConnection): string | null =>
    conn instanceof ClientConnectionImpl ? conn.debugPeerId() : null,
  /** Force TURN relaying for Peers created from now on (verifies a relay works). */
  forceRelay: (on: boolean): void => setIceTransportPolicy(on ? 'relay' : 'all'),
  /** ICE servers new Peers will use. */
  iceServers: (): RTCIceServer[] => getIceServers(),
}
