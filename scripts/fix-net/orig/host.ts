// Host side of the transport: owns the room's Peer (id = PEER_PREFIX + code),
// accepts client data channels, runs heartbeats, keeps the signaling socket
// alive, and frames/chunks every message.

import { PEER_PREFIX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../game/constants'
import { isClientMsg } from './protocol'
import type { ClientMsg, HostMsg } from './protocol'
import { NetError, NET_MESSAGES, isTransientPeerError, netErrorFromPeer } from './errors'
import { closeConnection, createPeer, destroyPeer, openPeer } from './peer'
import type { DataConnection, Peer, PeerModule } from './peer'
import { Listeners, Scope, netLog, netStats, now, randomString, randomToken, reportListenerError } from './runtime'
import { NET_TIMING } from './timing'
import { HEARTBEAT, Reassembler, encodeMessage, isFrame } from './wire'
import type { Frame } from './wire'
import type { ConnStatus, HostServer } from './transport'

interface HostConn {
  readonly id: string
  readonly conn: DataConnection
  readonly remotePeer: string
  state: 'pending' | 'open' | 'dropping' | 'closed'
  lastRx: number
  lastTx: number
  readonly rx: Reassembler
  cancelTimer: () => void
}

/** Hard cap on simultaneous data channels (MAX_PLAYERS is enforced by the game). */
const MAX_CONNECTIONS = 40
/** Events kept while nobody listens yet (the app subscribes right after createHost resolves). */
const BACKLOG_MAX = 500
const TOKEN_KEY = (code: string): string => `unshuffle:net:host-token:${code}`

function loadToken(code: string): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY(code))
  } catch {
    return null
  }
}

function saveToken(code: string, token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY(code), token)
  } catch {
    // Private mode / storage disabled: reclaiming after a refresh just gets slower.
  }
}

function forgetToken(code: string): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY(code))
  } catch {
    // ignore
  }
}

// A Web Lock per hosted code, held for the host's lifetime. It is released
// when the tab closes or reloads, so a refreshed tab can reclaim its code,
// while a *duplicated* tab (which inherits sessionStorage, token included)
// sees the lock taken and won't hijack the live room.
const LOCK_NAME = (code: string): string => `unshuffle:net:host:${code}`

function locks(): LockManager | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
}

async function isHostedElsewhere(code: string): Promise<boolean> {
  const lm = locks()
  if (!lm) return false
  try {
    const { held = [] } = await lm.query()
    return held.some((l) => l.name === LOCK_NAME(code))
  } catch {
    return false
  }
}

/** Holds the code's lock until the returned release function is called. */
function holdHostLock(code: string): () => void {
  const lm = locks()
  if (!lm) return () => {}
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  lm.request(LOCK_NAME(code), { ifAvailable: true }, (lock) => (lock ? held : undefined)).catch(() => {})
  return release
}

export function randomRoomCode(): string {
  return randomString(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Registers PEER_PREFIX + code on the signaling server.
 * - `requested`: retried while the server still holds it (e.g. right after a
 *   refresh), then we fall back to a fresh random code.
 * - transient network/server failures are retried with backoff until the deadline.
 */
async function claimHostPeer(
  mod: PeerModule,
  requested: string | null,
): Promise<{ peer: Peer; code: string; token: string }> {
  const start = now()
  const deadline = start + NET_TIMING.createTimeoutMs
  const reclaimUntil = start + NET_TIMING.reclaimWindowMs
  const takenHere = requested !== null && (await isHostedElsewhere(requested))
  if (takenHere) netLog('host', `${requested} is hosted by another tab of this browser`)
  let code = requested !== null && !takenHere ? requested : randomRoomCode()
  let reclaiming = requested !== null && !takenHere
  let transientFailures = 0
  let collisions = 0
  let lastError: NetError | null = null

  for (;;) {
    const remaining = deadline - now()
    if (remaining <= 250) throw lastError ?? new NetError('timeout', NET_MESSAGES.createTimeout)
    const token = (reclaiming ? loadToken(code) : null) ?? randomToken()
    const result = await openPeer(mod, PEER_PREFIX + code, token, Math.min(NET_TIMING.attemptTimeoutMs, remaining))
    if (result.ok) {
      saveToken(code, token)
      netLog('host', `registered ${code}${requested && code !== requested ? ` (requested ${requested})` : ''}`)
      return { peer: result.peer, code, token }
    }
    netLog('host', `register ${code} failed: ${result.type}`)

    if (result.type === 'unavailable-id') {
      if (reclaiming && now() + NET_TIMING.reclaimRetryMs < reclaimUntil) {
        await sleep(NET_TIMING.reclaimRetryMs)
        continue
      }
      reclaiming = false
      if (++collisions > 20) throw new NetError('server', NET_MESSAGES.server)
      code = randomRoomCode()
      continue
    }
    if (result.type === 'browser-incompatible') throw new NetError('unsupported', NET_MESSAGES.unsupported)
    if (!isTransientPeerError(result.type)) throw netErrorFromPeer(result.type)

    lastError = netErrorFromPeer(result.type)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new NetError('network', NET_MESSAGES.network)
    const backoff = NET_TIMING.retryDelaysMs[Math.min(transientFailures++, NET_TIMING.retryDelaysMs.length - 1)]
    if (now() + backoff + 250 >= deadline) throw lastError
    await sleep(backoff)
  }
}

export async function createHostServer(mod: PeerModule, requested: string | null): Promise<HostServer> {
  const { peer, code, token } = await claimHostPeer(mod, requested)
  return new HostServerImpl(mod, peer, code, token)
}

export class HostServerImpl implements HostServer {
  readonly code: string
  private readonly mod: PeerModule
  private readonly token: string
  private readonly peerId: string
  private peer: Peer
  private readonly conns = new Map<string, HostConn>()
  private readonly scope = new Scope()
  private readonly messageL = new Listeners<[string, ClientMsg]>()
  private readonly connectL = new Listeners<[string]>()
  private readonly disconnectL = new Listeners<[string]>()
  private readonly statusL = new Listeners<[ConnStatus, string | undefined]>()
  private status: ConnStatus = 'open'
  private statusDetail: string | undefined
  private closed = false
  private chunkSeq = 0
  /** Events that happened before the app subscribed to onMessage; flushed once it does. */
  private backlog: (() => void)[] | null = []
  private reconnectAttempts = 0
  private cancelReconnect: (() => void) | null = null
  private reconnectStartedAt = 0
  private lastTick = now()
  private readonly releaseLock: () => void

  constructor(mod: PeerModule, peer: Peer, code: string, token: string) {
    this.mod = mod
    this.peer = peer
    this.code = code
    this.token = token
    this.peerId = PEER_PREFIX + code
    this.releaseLock = holdHostLock(code)
    netStats.hosts++
    this.attach(peer)
    this.scope.interval(() => this.tick(), NET_TIMING.tickMs)
    const wake = (): void => this.reconnectNow()
    this.scope.listen(typeof window === 'undefined' ? undefined : window, 'online', wake)
    this.scope.listen(typeof document === 'undefined' ? undefined : document, 'visibilitychange', () => {
      if (!document.hidden) wake()
    })
  }

  // ---- public API ----

  onMessage(cb: (connId: string, msg: ClientMsg) => void): () => void {
    const off = this.messageL.add(cb)
    this.flushBacklogSoon()
    return off
  }

  onConnect(cb: (connId: string) => void): () => void {
    return this.connectL.add(cb)
  }

  onDisconnect(cb: (connId: string) => void): () => void {
    return this.disconnectL.add(cb)
  }

  /** Replays the current status to the new listener immediately. */
  onStatus(cb: (status: ConnStatus, detail?: string) => void): () => void {
    const off = this.statusL.add(cb)
    try {
      cb(this.status, this.statusDetail)
    } catch (err) {
      reportListenerError(err)
    }
    return off
  }

  send(connId: string, msg: HostMsg): void {
    const hc = this.conns.get(connId)
    if (!hc || hc.state !== 'open') return
    const frames = encodeMessage(msg, () => ++this.chunkSeq)
    this.sendFrames(hc, frames)
  }

  broadcast(msg: HostMsg): void {
    let frames: Frame[] | null = null
    for (const hc of this.conns.values()) {
      if (hc.state !== 'open') continue
      frames ??= encodeMessage(msg, () => ++this.chunkSeq)
      this.sendFrames(hc, frames)
    }
  }

  drop(connId: string, finalMsg?: HostMsg): void {
    const hc = this.conns.get(connId)
    if (!hc) return
    if (hc.state !== 'open') {
      if (hc.state === 'pending') this.finalize(hc, 'dropped')
      return
    }
    if (finalMsg) this.sendFrames(hc, encodeMessage(finalMsg, () => ++this.chunkSeq))
    // The client closes the channel as soon as it reads 'bye' (one trip later,
    // so finalMsg is guaranteed to have arrived); force-close if it doesn't.
    this.sendFrames(hc, [{ k: 'bye', r: 'dropped' }])
    hc.state = 'dropping'
    hc.cancelTimer()
    hc.cancelTimer = this.scope.timeout(() => this.finalize(hc, 'dropped'), NET_TIMING.dropForceMs)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    netLog('host', `close ${this.code}`)
    this.messageL.clear()
    this.connectL.clear()
    this.disconnectL.clear()
    this.statusL.clear()
    this.backlog = null
    this.status = 'closed'
    this.scope.dispose()
    this.releaseLock()
    forgetToken(this.code)
    netStats.hosts--
    const conns = [...this.conns.values()]
    this.conns.clear()
    for (const hc of conns) {
      if (hc.state === 'open') this.sendFrames(hc, [{ k: 'bye', r: 'closed' }])
      hc.state = 'closed'
      hc.conn.removeAllListeners()
    }
    // Let the goodbyes flush (clients close on 'bye'), then tear everything down.
    const peer = this.peer
    peer.removeAllListeners()
    peer.on('connection', (c) => closeConnection(c))
    netStats.timers++
    setTimeout(() => {
      netStats.timers--
      for (const hc of conns) closeConnection(hc.conn)
      destroyPeer(peer)
    }, conns.length ? NET_TIMING.flushMs : 0)
  }

  /** Remote PeerJS id of a connection (stable across that tab's reconnects). */
  remotePeerId(connId: string): string | null {
    return this.conns.get(connId)?.remotePeer ?? null
  }

  // ---- debug hooks (netDebug) ----

  debugBreak(connId: string): boolean {
    const hc = this.conns.get(connId)
    if (!hc) return false
    hc.conn.close()
    return true
  }

  debugDropSignaling(): boolean {
    if (this.closed || this.peer.disconnected) return false
    this.peer.disconnect()
    return true
  }

  debugConnIds(): string[] {
    return [...this.conns.values()].filter((c) => c.state === 'open').map((c) => c.id)
  }

  // ---- internals ----

  private setStatus(status: ConnStatus, detail?: string): void {
    if (this.closed || (status === this.status && detail === this.statusDetail)) return
    this.status = status
    this.statusDetail = detail
    netLog('host', `status ${status}${detail ? ` (${detail})` : ''}`)
    this.statusL.emit(status, detail)
  }

  private deliver(fn: () => void): void {
    if (!this.backlog) return fn()
    this.backlog.push(fn)
    if (this.backlog.length > BACKLOG_MAX) this.backlog.shift()
  }

  private flushBacklogSoon(): void {
    if (!this.backlog) return
    queueMicrotask(() => {
      const backlog = this.backlog
      this.backlog = null
      if (backlog) for (const fn of backlog) fn()
    })
  }

  private attach(peer: Peer): void {
    peer.on('connection', (conn) => {
      if (peer === this.peer) this.accept(conn)
      else closeConnection(conn)
    })
    peer.on('open', () => {
      if (peer !== this.peer) return
      this.reconnectAttempts = 0
      this.reconnectStartedAt = 0
      this.setStatus('open')
    })
    peer.on('disconnected', () => {
      if (peer === this.peer) this.onSignalingLost('signaling-lost')
    })
    peer.on('close', () => {
      if (peer === this.peer) this.onSignalingLost('peer-destroyed')
    })
    peer.on('error', (err) => {
      if (peer !== this.peer) return
      netLog('host', `peer error ${err.type}`)
      // Someone else grabbed our id while our socket was down: keep retrying,
      // the server frees it once that socket goes away.
      if (err.type === 'unavailable-id') this.setStatus('reconnecting', 'id-taken')
    })
  }

  private onSignalingLost(detail: string): void {
    if (this.closed) return
    this.setStatus('reconnecting', this.statusDetail === 'id-taken' ? 'id-taken' : detail)
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.closed || this.cancelReconnect) return
    const delays = NET_TIMING.hostReconnectDelaysMs
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)]
    this.cancelReconnect = this.scope.timeout(() => {
      this.cancelReconnect = null
      this.reconnect()
    }, delay)
  }

  /** Skip the backoff (tab visible again / back online). */
  private reconnectNow(): void {
    if (this.closed || this.status !== 'reconnecting' || !this.cancelReconnect) return
    this.cancelReconnect()
    this.cancelReconnect = null
    this.reconnect()
  }

  private reconnect(): void {
    if (this.closed) return
    this.reconnectAttempts++
    this.reconnectStartedAt = now()
    const peer = this.peer
    if (!peer.destroyed && peer.disconnected) {
      try {
        netLog('host', `signaling reconnect #${this.reconnectAttempts}`)
        peer.reconnect()
        return
      } catch {
        // Fall through and replace the Peer.
      }
    }
    if (!peer.destroyed && !peer.disconnected) return // already (re)connecting
    // The Peer is gone (its data channels died with it); register a fresh one
    // under the same id + token. Clients reconnect to it on their own.
    netLog('host', `recreate peer #${this.reconnectAttempts}`)
    destroyPeer(peer)
    const next = createPeer(this.mod, this.peerId, this.token)
    this.peer = next
    this.attach(next)
  }

  private accept(conn: DataConnection): void {
    if (this.closed || this.conns.size >= MAX_CONNECTIONS) {
      closeConnection(conn)
      return
    }
    const existing = this.conns.get(conn.connectionId)
    if (existing) this.finalize(existing, 'replaced')
    const hc: HostConn = {
      id: conn.connectionId,
      conn,
      remotePeer: conn.peer,
      state: 'pending',
      lastRx: now(),
      lastTx: now(),
      rx: new Reassembler(),
      cancelTimer: () => {},
    }
    this.conns.set(hc.id, hc)
    hc.cancelTimer = this.scope.timeout(() => {
      if (hc.state === 'pending') this.finalize(hc, 'open-timeout')
    }, NET_TIMING.pendingOpenTimeoutMs)

    conn.on('open', () => {
      if (hc.state !== 'pending') return
      hc.cancelTimer()
      hc.state = 'open'
      hc.lastRx = hc.lastTx = now()
      // A tab keeps a single link to us: a new one means its previous link is
      // dead even if our heartbeat hasn't noticed yet. Retire it first so the
      // app sees disconnect(old) → connect(new).
      for (const other of [...this.conns.values()]) {
        if (other !== hc && other.remotePeer === hc.remotePeer && other.state !== 'closed') {
          this.finalize(other, 'superseded')
        }
      }
      netLog('host', `connect ${hc.id} from ${hc.remotePeer}`)
      this.deliver(() => this.connectL.emit(hc.id))
    })
    conn.on('data', (data) => this.onData(hc, data))
    conn.on('close', () => this.finalize(hc, 'close'))
    conn.on('error', (err) => {
      // Send-side hiccups are not fatal; negotiation failures are followed by close().
      if (err.type === 'not-open-yet' || err.type === 'message-too-big') return
      this.finalize(hc, `error:${err.type}`)
    })
  }

  private onData(hc: HostConn, data: unknown): void {
    if (hc.state === 'closed') return
    hc.lastRx = now()
    if (!isFrame(data)) return
    switch (data.k) {
      case 'm':
        this.onAppMessage(hc, data.m)
        break
      case 'c': {
        const done = hc.rx.push(data)
        if (done) this.onAppMessage(hc, done.value)
        break
      }
      case 'bye':
        this.finalize(hc, `bye:${data.r}`)
        break
      case 'hb':
        break
    }
  }

  private onAppMessage(hc: HostConn, msg: unknown): void {
    if (hc.state !== 'open' || !isClientMsg(msg)) return
    this.deliver(() => {
      if (hc.state === 'open') this.messageL.emit(hc.id, msg)
    })
  }

  private sendFrames(hc: HostConn, frames: Frame[]): void {
    if (!hc.conn.open) return
    try {
      for (const f of frames) void hc.conn.send(f)
      hc.lastTx = now()
    } catch {
      this.finalize(hc, 'send-failed')
    }
  }

  /** Ends a connection exactly once; onDisconnect only for channels that opened. */
  private finalize(hc: HostConn, reason: string): void {
    if (hc.state === 'closed') return
    const wasOpen = hc.state === 'open' || hc.state === 'dropping'
    hc.state = 'closed'
    hc.cancelTimer()
    hc.rx.clear()
    if (this.conns.get(hc.id) === hc) this.conns.delete(hc.id)
    closeConnection(hc.conn)
    netLog('host', `disconnect ${hc.id} (${reason})`)
    if (wasOpen) this.deliver(() => this.disconnectL.emit(hc.id))
  }

  private tick(): void {
    const t = now()
    // Timers were frozen (tab suspended, laptop asleep): don't declare everyone
    // dead on the first tick back, give the channels a fresh window instead.
    const suspended = t - this.lastTick > NET_TIMING.suspendGapMs
    this.lastTick = t
    for (const hc of [...this.conns.values()]) {
      if (hc.state !== 'open') continue
      if (suspended) {
        hc.lastRx = t
        continue
      }
      if (t - hc.lastRx > NET_TIMING.deadAfterMs) this.finalize(hc, 'heartbeat-timeout')
      else if (t - hc.lastTx >= NET_TIMING.heartbeatMs) this.sendFrames(hc, [HEARTBEAT])
    }
    // A reconnect that neither opened nor failed: abort it and try again.
    if (
      this.status === 'reconnecting' &&
      !this.cancelReconnect &&
      this.reconnectStartedAt &&
      t - this.reconnectStartedAt > NET_TIMING.attemptTimeoutMs
    ) {
      this.reconnectStartedAt = 0
      if (!this.peer.destroyed && !this.peer.disconnected) this.peer.disconnect()
      else this.scheduleReconnect()
    }
  }
}
