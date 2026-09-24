// Client side of the transport: one reliable JSON data channel to the host,
// heartbeats both ways, and automatic reconnection (same PeerJS id + token, so
// the host can tell a reconnecting tab from a new one).

import { PEER_PREFIX } from '../game/constants'
import { isHostMsg } from './protocol'
import type { ClientMsg, HostMsg } from './protocol'
import { NetError, NET_MESSAGES, isTransientPeerError, netErrorFromPeer } from './errors'
import { closeConnection, destroyPeer, openPeer, waitForOpen } from './peer'
import type { DataConnection, OpenResult, Peer, PeerModule } from './peer'
import { Listeners, Scope, netLog, netStats, now, race, randomToken, reportListenerError } from './runtime'
import { NET_TIMING } from './timing'
import { HEARTBEAT, Reassembler, encodeMessage, isFrame } from './wire'
import type { ByeReason, Frame } from './wire'
import type { ClientConnection, ConnStatus } from './transport'

interface Link {
  readonly conn: DataConnection
  lastRx: number
  lastTx: number
  readonly rx: Reassembler
  /** Debug: behave like a silently dead network path. */
  frozen: boolean
}

type AttemptResult = { ok: true; conn: DataConnection } | { ok: false; type: string }

/** Absolute cap on one reconnect episode, hidden time included. */
const RECONNECT_HARD_CAP_MS = 3 * 60_000

const newClientId = (): string => `${PEER_PREFIX}p-${randomToken(14)}`
const isSoftChannelError = (type: string): boolean => type === 'not-open-yet' || type === 'message-too-big'

export async function connectClient(mod: PeerModule, code: string): Promise<ClientConnectionImpl> {
  const client = new ClientConnectionImpl(mod, code)
  try {
    await client.start()
  } catch (err) {
    client.close()
    throw err
  }
  return client
}

export class ClientConnectionImpl implements ClientConnection {
  readonly code: string
  private readonly mod: PeerModule
  private readonly hostId: string
  private myId = newClientId()
  private token = randomToken()
  private peer: Peer | null = null
  private link: Link | null = null
  private readonly scope = new Scope()
  private readonly abort = new AbortController()
  private readonly messageL = new Listeners<[HostMsg]>()
  private readonly statusL = new Listeners<[ConnStatus, string | undefined]>()
  private status: ConnStatus = 'connecting'
  private statusDetail: string | undefined
  /** Messages received before the app subscribed to onMessage; flushed once it does. */
  private backlog: HostMsg[] | null = []
  private done = false
  private rejected = false
  private reconnecting = false
  private chunkSeq = 0
  private lastTick = now()
  private retryDeadline = 0
  private hiddenAt = 0
  private signalingRetries = 0
  private cancelSignalingRetry: (() => void) | null = null
  /** Debug: links left open on purpose by debugAbandon(); closed on teardown. */
  private abandoned: DataConnection[] = []

  constructor(mod: PeerModule, code: string) {
    this.mod = mod
    this.code = code
    this.hostId = PEER_PREFIX + code
    netStats.clients++
    this.scope.interval(() => this.tick(), NET_TIMING.tickMs)
    this.scope.listen(typeof window === 'undefined' ? undefined : window, 'online', () => this.scope.wake())
    this.scope.listen(typeof document === 'undefined' ? undefined : document, 'visibilitychange', () =>
      this.onVisibility(),
    )
  }

  // ---- public API ----

  send(msg: ClientMsg): void {
    const link = this.link
    if (this.done || this.status !== 'open' || !link) return
    this.sendFrames(link, encodeMessage(msg, () => ++this.chunkSeq))
  }

  onMessage(cb: (msg: HostMsg) => void): () => void {
    const off = this.messageL.add(cb)
    if (this.backlog) {
      queueMicrotask(() => {
        const backlog = this.backlog
        this.backlog = null
        if (backlog) for (const msg of backlog) this.messageL.emit(msg)
      })
    }
    return off
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

  /** Leaves silently: no status events after this, no reconnection. */
  close(): void {
    if (this.done) return
    this.done = true
    this.status = 'closed'
    this.statusDetail = 'closed-by-app'
    netLog('client', `close ${this.code}`)
    this.messageL.clear()
    this.statusL.clear()
    this.teardown('leave')
  }

  // ---- debug hooks (netDebug) ----

  debugBreak(): boolean {
    if (!this.link) return false
    this.link.conn.close()
    return true
  }

  debugFreeze(): boolean {
    if (!this.link) return false
    this.link.frozen = true
    return true
  }

  /** Reconnect while leaving the old channel open (host must supersede it). */
  debugAbandon(): boolean {
    const link = this.link
    if (!link || this.done) return false
    link.conn.removeAllListeners()
    this.abandoned.push(link.conn)
    this.link = null
    void this.reconnectLoop('debug-abandon')
    return true
  }

  debugDropSignaling(): boolean {
    const peer = this.peer
    if (!peer || peer.destroyed || peer.disconnected) return false
    peer.disconnect()
    return true
  }

  debugPeerId(): string {
    return this.myId
  }

  // ---- connection lifecycle ----

  /** First connection: resolves when the channel is open, rejects with a NetError. */
  async start(): Promise<void> {
    const deadline = now() + NET_TIMING.joinTimeoutMs
    let failures = 0
    let unanswered = 0
    for (;;) {
      const remaining = deadline - now()
      if (remaining <= 0) throw new NetError('timeout', NET_MESSAGES.joinTimeout)
      const r = await this.attempt(remaining)
      if (r.ok) {
        this.adopt(r.conn)
        this.setStatus('open')
        return
      }
      netLog('client', `join attempt failed: ${r.type}`)
      if (r.type === 'peer-unavailable') throw new NetError('room-not-found', NET_MESSAGES.roomNotFound)
      // The public server sometimes swallows an offer to an unknown id instead
      // of answering "peer-unavailable"; the next offer gets the answer.
      if (r.type === 'no-answer') {
        if (++unanswered > 1 || deadline - now() < NET_TIMING.answerTimeoutMs + 500) {
          throw new NetError('room-not-found', NET_MESSAGES.roomNotFound)
        }
        continue
      }
      if (r.type === 'timeout') throw new NetError('timeout', NET_MESSAGES.joinTimeout)
      if (r.type === 'aborted') throw new NetError('unknown', NET_MESSAGES.unknown)
      if (r.type === 'browser-incompatible') throw new NetError('unsupported', NET_MESSAGES.unsupported)
      if (r.type === 'unavailable-id') this.renewIdentity()
      else if (!isTransientPeerError(r.type) && r.type !== 'channel-failed') {
        throw netErrorFromPeer(r.type, NET_MESSAGES.joinTimeout)
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new NetError('network', NET_MESSAGES.network)
      }
      const backoff = NET_TIMING.retryDelaysMs[Math.min(failures++, NET_TIMING.retryDelaysMs.length - 1)]
      if (now() + backoff + 500 >= deadline) {
        throw r.type === 'channel-failed'
          ? new NetError('timeout', NET_MESSAGES.joinTimeout)
          : netErrorFromPeer(r.type, NET_MESSAGES.joinTimeout)
      }
      await this.scope.sleep(backoff)
    }
  }

  /** One try: make sure signaling is up, then open a data channel to the host. */
  private async attempt(timeoutMs: number): Promise<AttemptResult> {
    const deadline = now() + timeoutMs
    const opened = await this.ensurePeer(timeoutMs)
    if (!opened.ok) return opened
    if (this.done) return { ok: false, type: 'aborted' }
    const remaining = deadline - now()
    if (remaining <= 0) return { ok: false, type: 'timeout' }
    const peer = opened.peer

    let conn: DataConnection | undefined
    try {
      conn = peer.connect(this.hostId, { reliable: true, serialization: 'json' })
    } catch {
      conn = undefined
    }
    if (!conn) return { ok: false, type: 'network' }
    const c = conn
    const result = await race<AttemptResult>(
      {
        timeoutMs: remaining,
        onTimeout: { ok: false, type: 'timeout' },
        signal: this.abort.signal,
        onAbort: { ok: false, type: 'aborted' },
      },
      (settle) => {
        // A live host answers the SDP offer within a few hundred ms, long
        // before ICE completes; no answer at all means nobody is there.
        const answered = (): boolean => !!c.peerConnection?.remoteDescription
        const answerTimer = setTimeout(() => {
          if (!answered()) settle({ ok: false, type: 'no-answer' })
        }, Math.min(NET_TIMING.answerTimeoutMs, remaining))
        netStats.timers++
        const onOpen = (): void => settle({ ok: true, conn: c })
        const onConnError = (err: { type: string }): void => {
          if (!isSoftChannelError(err.type)) settle({ ok: false, type: 'channel-failed' })
        }
        const onConnClose = (): void => settle({ ok: false, type: 'channel-failed' })
        const onPeerError = (err: { type: string }): void => {
          // "Unknown id" from the signaling server. Once the host has answered
          // this offer it can only be a late reply to an earlier attempt.
          if (err.type === 'peer-unavailable' && !answered()) settle({ ok: false, type: 'peer-unavailable' })
        }
        const onPeerGone = (): void => settle({ ok: false, type: 'network' })
        c.on('open', onOpen)
        c.on('error', onConnError)
        c.on('close', onConnClose)
        peer.on('error', onPeerError)
        peer.on('disconnected', onPeerGone)
        peer.on('close', onPeerGone)
        return () => {
          clearTimeout(answerTimer)
          netStats.timers--
          c.off('open', onOpen)
          c.off('error', onConnError)
          c.off('close', onConnClose)
          peer.off('error', onPeerError)
          peer.off('disconnected', onPeerGone)
          peer.off('close', onPeerGone)
        }
      },
    )
    if (!result.ok || this.done) {
      closeConnection(c)
      return result.ok ? { ok: false, type: 'aborted' } : result
    }
    return result
  }

  /** A Peer registered on the signaling server, reusing ours when possible. */
  private async ensurePeer(timeoutMs: number): Promise<OpenResult> {
    const current = this.peer
    if (current && !current.destroyed) {
      if (current.open) return { ok: true, peer: current }
      if (current.disconnected && !this.link) {
        // Nothing alive on it: a fresh Peer (same id + token) is the most reliable path.
        this.dropPeer()
      } else {
        if (current.disconnected) {
          try {
            current.reconnect()
          } catch {
            this.dropPeer()
          }
        }
        if (this.peer === current) {
          const r = await waitForOpen(current, timeoutMs, this.abort.signal)
          if (!r.ok && this.peer === current && !this.link) this.dropPeer()
          return r
        }
      }
    } else if (current) {
      this.dropPeer()
    }

    const r = await openPeer(this.mod, this.myId, this.token, timeoutMs, this.abort.signal)
    if (!r.ok) {
      if (r.type === 'unavailable-id') this.renewIdentity()
      return r
    }
    if (this.done) {
      destroyPeer(r.peer)
      return { ok: false, type: 'aborted' }
    }
    this.peer = r.peer
    this.attachPeer(r.peer)
    return r
  }

  private attachPeer(peer: Peer): void {
    peer.on('connection', (c) => closeConnection(c))
    peer.on('open', () => {
      if (peer === this.peer) this.signalingRetries = 0
    })
    peer.on('disconnected', () => this.onSignalingLost(peer))
    peer.on('close', () => {
      if (peer === this.peer) this.dropPeer()
    })
    peer.on('error', (err) => netLog('client', `peer error ${err.type}`))
  }

  /**
   * Signaling dropped while the data channel is fine: the channel keeps
   * working, but reconnect the socket in the background so a later
   * reconnection to the host doesn't have to wait for it.
   */
  private onSignalingLost(peer: Peer): void {
    if (this.done || peer !== this.peer || !this.link || this.cancelSignalingRetry) return
    const delays = [1_000, 2_000, 5_000, 10_000, 20_000]
    const delay = delays[Math.min(this.signalingRetries, delays.length - 1)]
    this.cancelSignalingRetry = this.scope.timeout(() => {
      this.cancelSignalingRetry = null
      if (this.done || peer !== this.peer || peer.destroyed || !peer.disconnected || !this.link) return
      this.signalingRetries++
      try {
        peer.reconnect()
      } catch {
        // Replaced on the next host reconnection.
      }
    }, delay)
  }

  private dropPeer(): void {
    const peer = this.peer
    this.peer = null
    this.cancelSignalingRetry?.()
    this.cancelSignalingRetry = null
    destroyPeer(peer)
  }

  private renewIdentity(): void {
    this.dropPeer()
    this.myId = newClientId()
    this.token = randomToken()
  }

  private adopt(conn: DataConnection): void {
    const link: Link = { conn, lastRx: now(), lastTx: now(), rx: new Reassembler(), frozen: false }
    this.link = link
    conn.on('data', (data) => this.onData(link, data))
    conn.on('close', () => this.onLinkLost(link, 'link-closed'))
    conn.on('error', (err) => {
      if (!isSoftChannelError(err.type)) this.onLinkLost(link, `link-error:${err.type}`)
    })
    netLog('client', `connected to ${this.code} as ${this.myId}`)
  }

  private onData(link: Link, data: unknown): void {
    if (this.done || link !== this.link || link.frozen) return
    link.lastRx = now()
    if (!isFrame(data)) return
    switch (data.k) {
      case 'm':
        this.onAppMessage(data.m)
        break
      case 'c': {
        const done = link.rx.push(data)
        if (done) this.onAppMessage(done.value)
        break
      }
      case 'bye':
        this.finish(this.rejected ? 'rejected' : data.r === 'closed' ? 'host-closed' : 'dropped')
        break
      case 'hb':
        break
    }
  }

  private onAppMessage(msg: unknown): void {
    if (this.done || !isHostMsg(msg)) return
    if (msg.t === 'reject' && !this.rejected) {
      this.rejected = true
      this.scope.timeout(() => this.finish('rejected'), NET_TIMING.rejectCloseMs)
    }
    if (!this.backlog) return this.messageL.emit(msg)
    this.backlog.push(msg)
    if (this.backlog.length > 500) this.backlog.shift()
  }

  private onLinkLost(link: Link, reason: string): void {
    if (link !== this.link) return
    this.link = null
    link.rx.clear()
    closeConnection(link.conn)
    if (this.done) return
    netLog('client', `link lost (${reason})`)
    if (this.rejected) {
      this.finish('rejected')
      return
    }
    void this.reconnectLoop(reason)
  }

  private remainingBudget(): number {
    const t = now()
    const hidden = this.hiddenAt ? t - this.hiddenAt : 0
    return this.retryDeadline + hidden - t
  }

  private onVisibility(): void {
    if (typeof document === 'undefined') return
    const t = now()
    if (document.hidden) {
      if (!this.hiddenAt) this.hiddenAt = t
      return
    }
    if (this.hiddenAt) {
      this.retryDeadline += t - this.hiddenAt
      this.hiddenAt = 0
    }
    this.scope.wake()
  }

  private async reconnectLoop(reason: string): Promise<void> {
    if (this.reconnecting || this.done) return
    this.reconnecting = true
    this.setStatus('reconnecting', reason)
    const startedAt = now()
    this.retryDeadline = startedAt + NET_TIMING.reconnectBudgetMs
    this.hiddenAt = typeof document !== 'undefined' && document.hidden ? startedAt : 0
    const delays = NET_TIMING.reconnectDelaysMs
    let attempts = 0
    let unanswered = 0
    try {
      while (!this.done) {
        const delay = delays[Math.min(attempts, delays.length - 1)]
        if (this.remainingBudget() <= delay || now() - startedAt > RECONNECT_HARD_CAP_MS) break
        await this.scope.sleep(delay)
        if (this.done) return
        const budget = this.remainingBudget()
        if (budget <= 0) break
        attempts++
        const r = await this.attempt(Math.min(NET_TIMING.attemptTimeoutMs, budget))
        if (this.done) {
          if (r.ok) closeConnection(r.conn)
          return
        }
        if (r.ok) {
          this.adopt(r.conn)
          netLog('client', `reconnected after ${attempts} attempt(s), ${Math.round(now() - startedAt)} ms`)
          this.setStatus('open', 'reconnected')
          return
        }
        netLog('client', `reconnect attempt ${attempts} failed: ${r.type}`)
        if (r.type === 'browser-incompatible') break
        // Offers keep vanishing: our signaling socket may be half-dead even
        // though PeerJS thinks it's open. Re-register (same id + token).
        unanswered = r.type === 'no-answer' ? unanswered + 1 : 0
        if (unanswered >= 2) {
          unanswered = 0
          this.dropPeer()
        }
      }
      if (!this.done) this.finish('gave-up')
    } finally {
      this.reconnecting = false
    }
  }

  // ---- plumbing ----

  private setStatus(status: ConnStatus, detail?: string): void {
    if (this.done || (status === this.status && detail === this.statusDetail)) return
    this.status = status
    this.statusDetail = detail
    netLog('client', `status ${status}${detail ? ` (${detail})` : ''}`)
    this.statusL.emit(status, detail)
  }

  private sendFrames(link: Link, frames: Frame[]): void {
    if (link.frozen || !link.conn.open) return
    try {
      for (const f of frames) void link.conn.send(f)
      link.lastTx = now()
    } catch {
      this.onLinkLost(link, 'send-failed')
    }
  }

  private tick(): void {
    const t = now()
    const suspended = t - this.lastTick > NET_TIMING.suspendGapMs
    this.lastTick = t
    const link = this.link
    if (!link) return
    if (suspended) {
      link.lastRx = t
      return
    }
    if (t - link.lastRx > NET_TIMING.deadAfterMs) this.onLinkLost(link, 'heartbeat-timeout')
    else if (t - link.lastTx >= NET_TIMING.heartbeatMs) this.sendFrames(link, [HEARTBEAT])
  }

  /** Terminal 'closed' (host closed / rejected / gave up). */
  private finish(detail: string): void {
    if (this.done) return
    this.done = true
    this.status = 'closed'
    this.statusDetail = detail
    netLog('client', `closed (${detail})`)
    this.teardown()
    this.statusL.emit('closed', detail)
    this.messageL.clear()
    this.statusL.clear()
  }

  private teardown(bye?: ByeReason): void {
    this.abort.abort()
    this.scope.dispose()
    this.backlog = null
    netStats.clients--
    const link = this.link
    const peer = this.peer
    this.link = null
    this.peer = null
    this.cancelSignalingRetry = null
    for (const c of this.abandoned.splice(0)) closeConnection(c)
    if (!link) {
      destroyPeer(peer)
      return
    }
    link.conn.removeAllListeners()
    if (bye && link.conn.open) {
      try {
        void link.conn.send({ k: 'bye', r: bye } satisfies Frame)
      } catch {
        // Channel already failing; the host's heartbeat will notice.
      }
    }
    // Give queued frames (the app's 'leave', our 'bye') a moment to flush.
    netStats.timers++
    setTimeout(() => {
      netStats.timers--
      closeConnection(link.conn)
      destroyPeer(peer)
    }, NET_TIMING.flushMs)
  }
}
