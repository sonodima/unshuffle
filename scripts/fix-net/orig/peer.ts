// PeerJS plumbing: lazy module load (keeps ~100 kB of WebRTC code and its
// import-time RTCPeerConnection probe off the initial page load), ICE config,
// tracked Peer creation/destruction and a typed "wait until open" helper.

import type { DataConnection, Peer } from 'peerjs'
import { netStats, race } from './runtime'

export type PeerModule = typeof import('peerjs')
export type { DataConnection, Peer }

let modulePromise: Promise<PeerModule> | null = null

export function loadPeerJs(): Promise<PeerModule> {
  modulePromise ??= import('peerjs').catch((err: unknown) => {
    modulePromise = null
    throw err
  })
  return modulePromise
}

const env: Record<string, string | undefined> =
  (import.meta as { env?: Record<string, string | undefined> }).env ?? {}

/**
 * Optional TURN relay supplied at build time, e.g.
 *   VITE_TURN_URLS="turn:eu.relay.example:3478,turns:eu.relay.example:443?transport=tcp"
 *   VITE_TURN_USERNAME=… VITE_TURN_CREDENTIAL=…
 * Needed only for players behind symmetric NAT / carrier-grade NAT, where a
 * direct path can't be punched. (The relays PeerJS 1.5.5 ships as defaults,
 * {eu-0,us-0}.turn.peerjs.com, no longer resolve in DNS.)
 */
function turnFromEnv(): RTCIceServer[] {
  const urls = (env.VITE_TURN_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (!urls.length) return []
  return [{ urls, username: env.VITE_TURN_USERNAME ?? '', credential: env.VITE_TURN_CREDENTIAL ?? '' }]
}

/** Google STUN (what PeerJS uses by default) + the optional TURN relay. */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ...turnFromEnv(),
]

let iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS
let iceTransportPolicy: RTCIceTransportPolicy = 'all'

/** Replaces the ICE servers for Peers created from now on (null → defaults). */
export function setIceServers(servers: RTCIceServer[] | null): void {
  iceServers = servers ?? DEFAULT_ICE_SERVERS
}

export function getIceServers(): RTCIceServer[] {
  return iceServers
}

/** Debug override (lab only): force TURN relaying to verify a relay works. */
export function setIceTransportPolicy(policy: RTCIceTransportPolicy): void {
  iceTransportPolicy = policy
}

const livePeers = new Set<Peer>()

/**
 * Creates a Peer on the public PeerJS cloud (0.peerjs.com:443, TLS).
 * `token` lets the signaling server hand the same id back to us after a
 * refresh or a dropped socket, even before it noticed the old socket died.
 */
export function createPeer(mod: PeerModule, id: string, token: string): Peer {
  const peer = new mod.Peer(id, {
    debug: 0,
    token,
    config: { iceServers, iceTransportPolicy, sdpSemantics: 'unified-plan' },
  })
  livePeers.add(peer)
  netStats.peers = livePeers.size
  return peer
}

export function destroyPeer(peer: Peer | null | undefined): void {
  if (!peer || !livePeers.delete(peer)) return
  netStats.peers = livePeers.size
  try {
    peer.destroy()
  } catch {
    // Already torn down by PeerJS.
  }
  peer.removeAllListeners()
}

/** Closes a data connection and detaches our listeners. Safe to call repeatedly. */
export function closeConnection(conn: DataConnection | null | undefined): void {
  if (!conn) return
  conn.removeAllListeners()
  try {
    conn.close()
  } catch {
    // PeerJS may throw while its negotiator is half torn down.
  }
}

export type OpenResult = { ok: true; peer: Peer } | { ok: false; type: string }

/**
 * Creates a Peer and waits for the signaling server to confirm its id.
 * On failure the Peer is destroyed and the PeerJS error type is returned
 * ('unavailable-id', 'network', 'server-error', …, or our own 'timeout' / 'aborted').
 */
export async function openPeer(
  mod: PeerModule,
  id: string,
  token: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<OpenResult> {
  const peer = createPeer(mod, id, token)
  const result = await waitForOpen(peer, timeoutMs, signal)
  if (!result.ok) destroyPeer(peer)
  return result
}

/** Waits until `peer` is registered on the signaling server (already open → immediate). */
export function waitForOpen(peer: Peer, timeoutMs: number, signal?: AbortSignal): Promise<OpenResult> {
  if (peer.open) return Promise.resolve({ ok: true, peer })
  if (peer.destroyed) return Promise.resolve({ ok: false, type: 'network' })
  return race<OpenResult>(
    { timeoutMs, onTimeout: { ok: false, type: 'timeout' }, signal, onAbort: { ok: false, type: 'aborted' } },
    (settle) => {
      const onOpen = (): void => settle({ ok: true, peer })
      const onError = (err: { type: string }): void => {
        // peer-unavailable / webrtc errors concern connections, not our registration.
        if (err.type === 'peer-unavailable' || err.type === 'webrtc') return
        settle({ ok: false, type: err.type })
      }
      const onGone = (): void => settle({ ok: false, type: 'network' })
      peer.on('open', onOpen)
      peer.on('error', onError)
      peer.on('disconnected', onGone)
      peer.on('close', onGone)
      return () => {
        peer.off('open', onOpen)
        peer.off('error', onError)
        peer.off('disconnected', onGone)
        peer.off('close', onGone)
      }
    },
  )
}
