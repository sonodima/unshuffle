// PeerJS transport. Signaling defaults to the public PeerJS cloud
// (0.peerjs.com:443, TLS) and ICE to Google + Cloudflare STUN; a self-hosted
// PeerServer and a TURN relay (runtime credentials endpoint or static
// credentials) are build-time options, see peer.ts for the VITE_* variables.
// Star topology: host peer id = PEER_PREFIX + roomCode; clients connect to it
// with one reliable, ordered JSON data channel each.
//
// On the wire every app message is wrapped in a small envelope (see wire.ts)
// so the transport can run its own heartbeats (2 s, link dead after 10 s of
// silence), send goodbyes (also when a page is going away, so the other side
// reacts at once instead of after the heartbeat timeout), and chunk messages
// larger than PeerJS' 16 KB JSON frame limit (a full RoomState easily exceeds it).

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../game/constants'
import type { ClientMsg, HostMsg } from './protocol'
import { connectClient } from './client'
import { NetError, NET_MESSAGES } from './errors'
import { loadPeerJs, prepareIceServers } from './peer'
import type { PeerModule } from './peer'
import { now } from './runtime'

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
  const startedAt = now()
  const requested = opts?.code ? normalizeRoomCode(opts.code) : null
  // The host side is loaded only by the tab that creates a room (guests never need it).
  const [mod, host] = await Promise.all([loadModule(), loadHostImpl()])
  return host.createHostServer(mod, requested, startedAt)
}

type HostImplModule = typeof import('./host')
let hostImplLoad: Promise<HostImplModule> | null = null

function loadHostImpl(): Promise<HostImplModule> {
  hostImplLoad ??= import('./host').catch((err: unknown) => {
    hostImplLoad = null
    console.warn('[net] host module failed to load', err)
    throw new NetError('network', NET_MESSAGES.loadFailed)
  })
  return hostImplLoad
}

/** Client side: one reliable data channel to the host, with automatic reconnection. */
export interface ClientConnection {
  readonly code: string
  send(msg: ClientMsg): void
  onMessage(cb: (msg: HostMsg) => void): () => void
  /**
   * 'open' fires on first connect AND after each successful reconnect (re-send hello then).
   * 'reconnecting' while the link is down: fast retries for ~30 s, then one every
   * ~5 s for up to 3 minutes (a phone host that switched apps comes back by itself).
   * 'closed' is terminal; `detail` says why (see ClientCloseDetail).
   */
  onStatus(cb: (status: ConnStatus, detail?: string) => void): () => void
  close(): void
}

/**
 * `detail` of the terminal 'closed' status:
 * - host-gone:   the host's code no longer exists on the signaling server for
 *                longer than a reload takes (tab closed, left, lost its code)
 * - host-closed: the host closed the room
 * - rejected:    the host sent a reject (kicked, full, duplicate…)
 * - dropped:     the host closed our connection on purpose
 * - gave-up:     no way back to the host within the reconnect budget
 */
export type ClientCloseDetail = 'host-gone' | 'host-closed' | 'rejected' | 'dropped' | 'gave-up'

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
 * Starts downloading the PeerJS chunk (and runtime TURN credentials, when
 * configured) ahead of time, e.g. when Home mounts, so "Crea stanza" / "Entra"
 * don't wait for them. Never rejects.
 */
export function preloadTransport(): Promise<void> {
  void prepareIceServers(0)
  void loadHostImpl().catch(() => {})
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
    // TURN credentials are waited for briefly (prepareIceServers never rejects):
    // without them players behind carrier-grade NAT can't connect at all.
    const [loaded] = await Promise.all([loadPeerJs(), prepareIceServers()])
    mod = loaded
  } catch {
    throw new NetError('network', NET_MESSAGES.loadFailed)
  }
  if (!mod.util.supports.data) throw new NetError('unsupported', NET_MESSAGES.unsupported)
  return mod
}
