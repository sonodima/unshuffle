// Test harness for HostGame: fake PeerJS host server, fake clock/timers and
// fake Deezer/audio/analysis deps. Everything is deterministic and headless.

import type { CutPlan } from '../../src/audio/analysis'
import type { HostGameDeps } from '../../src/game/host'
import type { GameEvent, PlayerProfile, RoomState, TrackInfo } from '../../src/game/types'
import type { ClientMsg, HostMsg } from '../../src/net/protocol'
import type { ConnStatus, HostServer } from '../../src/net/transport'

export const T0 = 1_800_000_000_000

/** Drain the microtask queue (and promise chains) completely. */
async function drain(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise<void>((resolve) => setImmediate(resolve))
}

interface FakeTimer {
  id: number
  at: number
  fn: () => void
}

export class FakeClock {
  now = T0
  private seq = 0
  private readonly timers = new Map<number, FakeTimer>()

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = ++this.seq
    this.timers.set(id, { id, at: this.now + Math.max(0, Number.isFinite(ms) ? ms : 0), fn })
    return id
  }

  clearTimeout = (handle: unknown): void => {
    this.timers.delete(handle as number)
  }

  get pending(): number {
    return this.timers.size
  }

  /** Advance fake time by `ms`, firing due timers in order and draining microtasks between them. */
  async advance(ms: number): Promise<void> {
    const target = this.now + ms
    for (;;) {
      await drain()
      let next: FakeTimer | null = null
      for (const t of this.timers.values()) {
        if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t
      }
      if (!next) break
      this.timers.delete(next.id)
      this.now = Math.max(this.now, next.at)
      next.fn()
    }
    this.now = target
    await drain()
  }
}

type Cb<A extends unknown[]> = (...args: A) => void

function listen<A extends unknown[]>(set: Set<Cb<A>>, cb: Cb<A>): () => void {
  set.add(cb)
  return () => {
    set.delete(cb)
  }
}

/** In-memory HostServer. Messages are JSON round-tripped like on the wire. */
export class FakeHostServer implements HostServer {
  readonly code: string
  readonly inbox = new Map<string, HostMsg[]>()
  readonly dropped: { connId: string; finalMsg?: HostMsg }[] = []
  readonly broadcasts: HostMsg[] = []
  closed = false
  private readonly open = new Set<string>()
  private readonly msgCbs = new Set<Cb<[string, ClientMsg]>>()
  private readonly connectCbs = new Set<Cb<[string]>>()
  private readonly disconnectCbs = new Set<Cb<[string]>>()
  private readonly statusCbs = new Set<Cb<[ConnStatus, string?]>>()

  constructor(code = 'KXQPM') {
    this.code = code
  }

  onMessage(cb: (connId: string, msg: ClientMsg) => void): () => void {
    return listen(this.msgCbs, cb)
  }
  onConnect(cb: (connId: string) => void): () => void {
    return listen(this.connectCbs, cb)
  }
  onDisconnect(cb: (connId: string) => void): () => void {
    return listen(this.disconnectCbs, cb)
  }
  onStatus(cb: (status: ConnStatus, detail?: string) => void): () => void {
    return listen(this.statusCbs, cb)
  }
  send(connId: string, msg: HostMsg): void {
    if (this.open.has(connId)) this.box(connId).push(JSON.parse(JSON.stringify(msg)) as HostMsg)
  }
  broadcast(msg: HostMsg): void {
    this.broadcasts.push(msg)
    for (const connId of this.open) this.send(connId, msg)
  }
  drop(connId: string, finalMsg?: HostMsg): void {
    if (finalMsg) this.send(connId, finalMsg)
    this.dropped.push({ connId, finalMsg })
    // Like a real DataConnection: closing it fires the disconnect callback.
    if (this.open.delete(connId)) for (const cb of [...this.disconnectCbs]) cb(connId)
  }
  close(): void {
    this.closed = true
    this.open.clear()
  }

  get listenerCount(): number {
    return this.msgCbs.size + this.connectCbs.size + this.disconnectCbs.size
  }

  // ---- test controls ----
  connect(connId: string): void {
    this.open.add(connId)
    for (const cb of [...this.connectCbs]) cb(connId)
  }
  deliver(connId: string, msg: ClientMsg): void {
    const wire = JSON.parse(JSON.stringify(msg)) as ClientMsg
    for (const cb of [...this.msgCbs]) cb(connId, wire)
  }
  /** Connection lost (timeout / tab closed). */
  lose(connId: string): void {
    if (this.open.delete(connId)) for (const cb of [...this.disconnectCbs]) cb(connId)
  }
  isOpen(connId: string): boolean {
    return this.open.has(connId)
  }
  box(connId: string): HostMsg[] {
    let list = this.inbox.get(connId)
    if (!list) this.inbox.set(connId, (list = []))
    return list
  }
  of<K extends HostMsg['t']>(connId: string, t: K): Extract<HostMsg, { t: K }>[] {
    return this.box(connId).filter((m): m is Extract<HostMsg, { t: K }> => m.t === t)
  }
  lastState(connId: string): RoomState | undefined {
    const states = this.of(connId, 'state')
    return states[states.length - 1]?.state
  }
  events(connId: string): GameEvent[] {
    return this.of(connId, 'event').map((m) => m.event)
  }
  clear(): void {
    this.inbox.clear()
  }
}

export function profile(id: string, name: string, avatar = 1, color = 2): PlayerProfile {
  return { id, name, avatar, color }
}

function makeTrack(id: number): TrackInfo {
  return {
    id,
    title: `Canzone ${id}`,
    artist: `Artista ${id}`,
    album: `Album ${id}`,
    cover: `https://cdn.example/${id}/1000.jpg`,
    coverSmall: `https://cdn.example/${id}/250.jpg`,
    preview: `https://preview.example/${id}.mp3`,
    link: `https://www.deezer.com/track/${id}`,
    rank: 1_000_000 - id,
    durationSec: 200,
  }
}

export function makeTracks(count: number, first = 1): TrackInfo[] {
  return Array.from({ length: count }, (_, i) => makeTrack(first + i))
}

export interface FakeBuffer {
  duration: number
  trackId: number
}

function fakeBuffer(trackId: number, duration = 30): AudioBuffer {
  return { duration, trackId } as FakeBuffer as unknown as AudioBuffer
}

function uniformPlan(duration: number, n: number, bpm = 120): CutPlan {
  const start = 0.5
  const step = (duration - 1) / n
  const segments = Array.from({ length: n }, (_, i) => ({ start: start + i * step, end: start + (i + 1) * step, beats: 8 }))
  for (let i = 1; i < n; i++) segments[i].start = segments[i - 1].end
  return {
    bpm,
    confidence: 0.9,
    beats: [],
    downbeats: [],
    segments,
    usableStart: start,
    usableEnd: duration - 0.5,
    method: 'beat-grid',
  }
}

/** Mutable fake behaviours; `deps` delegates to them at call time. */
export interface FakeControl {
  tracks: TrackInfo[]
  failLoad: Set<number>
  failAnalysis: Set<number>
  loads: string[]
  analyses: number[]
  getPlaylistTracks: (id: number) => Promise<TrackInfo[]>
  loadAudio: (key: string, url: string, refresh: () => Promise<string>) => Promise<AudioBuffer>
  analyzeAndCut: (buffer: AudioBuffer, n: number) => Promise<CutPlan>
}

export function makeDeps(clock: FakeClock, tracks: TrackInfo[] = makeTracks(20)): { deps: HostGameDeps; ctl: FakeControl } {
  const ctl: FakeControl = {
    tracks,
    failLoad: new Set(),
    failAnalysis: new Set(),
    loads: [],
    analyses: [],
    getPlaylistTracks: async () => ctl.tracks,
    loadAudio: async (key) => {
      ctl.loads.push(key)
      const id = Number(key.replace('track:', ''))
      if (ctl.failLoad.has(id)) throw new Error(`HTTP 403 ${key}`)
      return fakeBuffer(id)
    },
    analyzeAndCut: async (buffer, n) => {
      const { trackId, duration } = buffer as unknown as FakeBuffer
      ctl.analyses.push(trackId)
      if (ctl.failAnalysis.has(trackId)) throw new Error(`analysis failed ${trackId}`)
      return uniformPlan(duration, n, 123.456)
    },
  }
  const deps: HostGameDeps = {
    getPlaylistTracks: (id) => ctl.getPlaylistTracks(id),
    pickGameTracks: (list, count) => list.slice(0, count),
    refreshPreview: async (id) => `https://fresh.example/${id}.mp3`,
    loadAudio: (key, url, refresh) => ctl.loadAudio(key, url, refresh),
    analyzeAndCut: (buffer, n) => ctl.analyzeAndCut(buffer, n),
    now: () => clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  }
  return { deps, ctl }
}

export function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export function deepFreeze<T>(x: T): T {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x)
    for (const v of Object.values(x)) deepFreeze(v)
  }
  return x
}

/** Minimal Storage for sessionStorage-based tests. */
export class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>()
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
}
