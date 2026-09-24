// Headless tests for src/game/store.ts (+ persist / names / selectors).
// Run: bun test tests/unit/store.test.ts
// Every side-effect module (transport, HostGame, audio engine, sfx, deezer) is mocked.

import { afterEach, beforeEach, describe, expect, jest, mock, test } from 'bun:test'
import type { ClientMsg, HostMsg } from '../../src/net/protocol'
import type { ConnStatus } from '../../src/net/transport'
import type { GameEvent, Phase, PlayerProfile, RoomState, RoundPublic, TrackInfo } from '../../src/game/types'

// ---- browser shims -------------------------------------------------------------

class MemoryStorage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
}

const g = globalThis as Record<string, unknown>
const local = new MemoryStorage()
const sessionStore = new MemoryStorage()
const fakeLocation = { hash: '', get href() { return `http://localhost/${this.hash}` } }
const hashEvents: string[] = []
g.localStorage = local
g.sessionStorage = sessionStore
g.location = fakeLocation
g.history = { state: null, replaceState: (_s: unknown, _t: string, url: string) => { fakeLocation.hash = url } }
g.window = { dispatchEvent: (e: Event) => { hashEvents.push(e.type); return true } }

// ---- mocks -----------------------------------------------------------------------

class Emitter<A extends unknown[]> {
  private listeners = new Set<(...args: A) => void>()
  on(cb: (...args: A) => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }
  emit(...args: A) {
    for (const cb of [...this.listeners]) cb(...args)
  }
  get size() {
    return this.listeners.size
  }
}

class MockNetError extends Error {
  code: string
  constructor(code: string, message = code) {
    super(message)
    this.code = code
  }
}

class MockServer {
  code: string
  closed = false
  status = new Emitter<[ConnStatus, string?]>()
  constructor(code: string) {
    this.code = code
  }
  onMessage() {
    return () => {}
  }
  onConnect() {
    return () => {}
  }
  onDisconnect() {
    return () => {}
  }
  onStatus(cb: (s: ConnStatus, d?: string) => void) {
    return this.status.on(cb)
  }
  send() {}
  broadcast() {}
  drop() {}
  close() {
    this.closed = true
  }
}

class MockConn {
  code: string
  sent: ClientMsg[] = []
  closed = false
  /** Like the real transport: onStatus replays the current status to a new listener. */
  status: ConnStatus = 'open'
  messages = new Emitter<[HostMsg]>()
  statuses = new Emitter<[ConnStatus, string?]>()
  constructor(code: string) {
    this.code = code
  }
  send(msg: ClientMsg) {
    if (this.closed) throw new Error('send on closed connection')
    this.sent.push(structuredClone(msg))
  }
  onMessage(cb: (m: HostMsg) => void) {
    return this.messages.on(cb)
  }
  onStatus(cb: (s: ConnStatus, d?: string) => void) {
    const off = this.statuses.on(cb)
    if (net.replayStatus) cb(this.status)
    return off
  }
  close() {
    this.closed = true
  }
  deliver(msg: HostMsg) {
    this.messages.emit(structuredClone(msg))
  }
  setStatus(s: ConnStatus) {
    this.status = s
    this.statuses.emit(s)
  }
  ofType<T extends ClientMsg['t']>(t: T) {
    return this.sent.filter((m): m is Extract<ClientMsg, { t: T }> => m.t === t)
  }
}

const net = {
  servers: [] as MockServer[],
  conns: [] as MockConn[],
  createHostCalls: [] as ({ code?: string } | undefined)[],
  hostError: null as unknown,
  joinError: null as unknown,
  replayStatus: true,
}

mock.module('../../src/net/transport', () => ({
  NetError: MockNetError,
  createHost: async (opts?: { code?: string }) => {
    net.createHostCalls.push(opts)
    if (net.hostError) throw net.hostError
    const server = new MockServer(opts?.code ?? 'HQSTA')
    net.servers.push(server)
    return server
  },
  joinRoom: async (code: string) => {
    if (net.joinError) throw net.joinError
    const conn = new MockConn(code)
    net.conns.push(conn)
    return conn
  },
  normalizeRoomCode: (input: string) => {
    const code = input.trim().toUpperCase()
    return /^[A-HJ-NP-Z]{5}$/.test(code) ? code : null
  },
}))

interface HostOpts {
  server: MockServer
  hostProfile: PlayerProfile
  restore?: RoomState | null
}

class MockHostGame {
  static instances: MockHostGame[] = []
  opts: HostOpts
  current: RoomState
  handled: ClientMsg[] = []
  listeners = new Emitter<[RoomState]>()
  events = new Emitter<[GameEvent]>()
  destroyed = false
  calls: string[] = []
  startGameImpl: () => Promise<void> = async () => {}
  constructor(opts: HostOpts) {
    this.opts = opts
    this.current = opts.restore ?? lobbyRoom(opts.server.code, opts.hostProfile.id)
    MockHostGame.instances.push(this)
  }
  get state() {
    return this.current
  }
  subscribe(cb: (s: RoomState) => void) {
    return this.listeners.on(cb)
  }
  onEvent(cb: (e: GameEvent) => void) {
    return this.events.on(cb)
  }
  emit(state: RoomState) {
    this.current = state
    this.listeners.emit(state)
  }
  handleLocal(msg: ClientMsg) {
    this.handled.push(structuredClone(msg))
  }
  updateSettings(patch: unknown) {
    this.calls.push(`settings:${JSON.stringify(patch)}`)
  }
  startGame() {
    return this.startGameImpl()
  }
  nextRound() {
    this.calls.push('next')
  }
  kick(id: string) {
    this.calls.push(`kick:${id}`)
  }
  backToLobby() {
    this.calls.push('lobby')
  }
  destroy() {
    this.destroyed = true
    this.opts.server.close()
  }
}

mock.module('../../src/game/host', () => ({ HostGame: MockHostGame }))

interface PendingLoad {
  key: string
  url: string
  refresh?: () => Promise<string>
  resolve(): void
  reject(): void
}
const loads: PendingLoad[] = []
const evicted: string[] = []
mock.module('../../src/audio/engine', () => ({
  audioEngine: {
    load: (key: string, url: string, refresh?: () => Promise<string>) =>
      new Promise<AudioBuffer>((resolve, reject) => {
        loads.push({ key, url, refresh, resolve: () => resolve({} as AudioBuffer), reject: () => reject(new Error('decode failed')) })
      }),
    has: () => false,
    get: () => undefined,
  },
  evictAudio: (key: string) => void evicted.push(key),
}))

const sfxPlayed: string[] = []
mock.module('../../src/audio/sfx', () => ({
  sfx: { play: (name: string) => void sfxPlayed.push(name), setEnabled() {}, enabled: true },
}))

const refreshed: number[] = []
mock.module('../../src/lib/deezer', () => ({
  refreshPreview: async (id: number) => {
    refreshed.push(id)
    return `https://fresh.example/${id}.mp3`
  },
}))

const { useGame, STORE_TIMINGS, STORE_MESSAGES } = await import('../../src/game/store')
const persist = await import('../../src/game/persist')
const clock = await import('../../src/game/clock')
const names = await import('../../src/game/names')
const selectors = await import('../../src/game/selectors')
const { REJECT_MESSAGES, } = await import('../../src/net/protocol')
const { MAX_NAME_LENGTH, PROTOCOL_VERSION, DEFAULT_SETTINGS } = await import('../../src/game/constants')

// ---- fixtures ------------------------------------------------------------------

function track(id: number): TrackInfo {
  return {
    id,
    title: `Brano ${id}`,
    artist: `Artista ${id}`,
    album: 'Album',
    cover: '',
    coverSmall: '',
    preview: `https://cdn.example/${id}.mp3`,
    link: '',
    rank: 1000 - id,
    durationSec: 200,
  }
}

function round(index: number, t: TrackInfo, initialOrder = [3, 1, 4, 0, 2, 5]): RoundPublic {
  const n = initialOrder.length
  return {
    index,
    track: t,
    segments: Array.from({ length: n }, (_, i) => ({ index: i, start: i * 3, end: (i + 1) * 3, beats: 8 })),
    initialOrder,
    hues: Array.from({ length: n }, (_, i) => i * 40),
    bpm: 120,
  }
}

function lobbyRoom(code: string, hostId: string, extraPlayers: string[] = []): RoomState {
  return {
    code,
    hostId,
    players: [hostId, ...extraPlayers].map((id, i) => ({
      id,
      name: `P${i}`,
      avatar: i,
      color: i,
      isHost: id === hostId,
      connected: true,
      score: 0,
      activeFromRound: 0,
    })),
    settings: { ...DEFAULT_SETTINGS },
    phase: { kind: 'lobby' },
    tracks: [],
    rounds: [],
    submissions: {},
    ready: {},
    results: [],
    seq: 1,
  }
}

function withPhase(room: RoomState, phase: Phase, patch: Partial<RoomState> = {}): RoomState {
  return { ...room, ...patch, phase, seq: room.seq + 1 }
}

const tick = async (n = 30) => {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

const me = () => useGame.getState().profile.id
const st = () => useGame.getState()

async function joinWelcomed(code = 'KXQPM', room?: RoomState) {
  const p = st().joinRoom(code)
  await tick()
  const conn = net.conns.at(-1)!
  const state = room ?? lobbyRoom(code, 'host-1', [me()])
  conn.deliver({ t: 'welcome', you: me(), state, hostNow: Date.now() })
  await p
  return { conn, state }
}

beforeEach(() => {
  jest.useFakeTimers()
  clock.resetClock(0)
})

afterEach(async () => {
  st().leave()
  await tick()
  jest.useRealTimers()
  net.servers.length = 0
  net.conns.length = 0
  net.createHostCalls.length = 0
  net.hostError = null
  net.joinError = null
  net.replayStatus = true
  MockHostGame.instances.length = 0
  loads.length = 0
  sfxPlayed.length = 0
  refreshed.length = 0
  hashEvents.length = 0
  sessionStore.clear()
  fakeLocation.hash = ''
})

// ---- tests ---------------------------------------------------------------------

describe('profile', () => {
  test('generated on first load, persisted, valid', () => {
    const stored = JSON.parse(local.getItem('unshuffle:profile')!)
    const p = st().profile
    expect(stored).toEqual(p)
    expect(p.id.length).toBeGreaterThan(8)
    expect(p.name.length).toBeGreaterThan(0)
    expect([...p.name].length).toBeLessThanOrEqual(MAX_NAME_LENGTH)
    expect(st().me).toBe(p.id)
  })

  test('setProfile sanitizes, validates and persists', () => {
    const before = st().profile
    st().setProfile({ name: '   MC    Lasagna  ​ ', avatar: 999, color: 3 })
    const p = st().profile
    expect(p).toEqual({ id: before.id, name: 'MC Lasagna', avatar: before.avatar, color: 3 })
    expect(JSON.parse(local.getItem('unshuffle:profile')!)).toEqual(p)
    st().setProfile({ name: '   ' })
    expect(st().profile.name).toBe('MC Lasagna')
    st().setProfile({ name: 'Un nome davvero lunghissimo' })
    expect(st().profile.name).toBe('Un nome davvero') // cut at 16, trailing space trimmed
    st().setProfile({ name: 'Supercalifragili' + 'stico' })
    expect([...st().profile.name].length).toBe(MAX_NAME_LENGTH)
  })

  test('random names are fun and short', () => {
    for (let i = 0; i < 300; i++) {
      const n = names.randomPlayerName()
      expect([...n].length).toBeLessThanOrEqual(MAX_NAME_LENGTH)
      expect(n).toMatch(/^\S+ \S+$/)
    }
    expect(names.sanitizeName('👨‍👩‍👧 Famiglia')).toBe('👨‍👩‍👧 Famiglia')
  })

  test('normalizeProfile repairs fields, rejects missing id', () => {
    expect(persist.normalizeProfile({ name: 'x' })).toBeNull()
    const fixed = persist.normalizeProfile({ id: 'abc', name: 42, avatar: -1, color: 1 })!
    expect(fixed.id).toBe('abc')
    expect(fixed.color).toBe(1)
    expect(fixed.name.length).toBeGreaterThan(0)
    expect(fixed.avatar).toBeGreaterThanOrEqual(0)
  })
})

describe('host', () => {
  test('createRoom state flow, events, host actions, leave', async () => {
    const p = st().createRoom()
    expect(st().role).toBe('host')
    expect(st().connection).toBe('connecting')
    const code = await p
    const game = MockHostGame.instances[0]
    expect(code).toBe('HQSTA')
    expect(game.opts.hostProfile).toEqual(st().profile)
    expect(st().connection).toBe('open')
    expect(st().room).toBe(game.state)
    expect(st().me).toBe(me())
    expect(fakeLocation.hash).toBe('#/r/HQSTA')
    expect(hashEvents).toContain('hashchange')
    expect(persist.loadSession()).toEqual({ role: 'host', code: 'HQSTA' })
    expect(Math.abs(clock.hostNow() - Date.now())).toBeLessThan(2)

    // Double click while hosting does not create a second room.
    expect(await st().createRoom()).toBe('HQSTA')
    expect(MockHostGame.instances.length).toBe(1)

    const next = { ...lobbyRoom('HQSTA', me(), ['p2']), seq: 2 }
    game.emit(next)
    expect(st().room).toBe(next)
    expect(selectors.findPlayer(st().room, 'p2')?.name).toBe('P1')

    // A HostGame handing out the same mutated object must still produce a new reference.
    next.players[1].name = 'Giulia'
    game.emit(next)
    expect(st().room).not.toBe(next)
    expect(st().room!.players[1].name).toBe('Giulia')

    game.events.emit({ type: 'player-joined', playerId: 'p2', name: 'Giulia' })
    game.events.emit({ type: 'player-joined', playerId: me(), name: 'me' })
    game.events.emit({ type: 'first-submit', playerId: 'p2', name: 'Giulia', endsAt: 1 })
    game.events.emit({ type: 'submitted', playerId: 'p2', name: 'Giulia' })
    game.events.emit({ type: 'reaction', playerId: me(), emoji: '🔥' })
    expect(st().toasts.map((t) => t.event.type)).toEqual(['player-joined', 'first-submit', 'reaction'])
    expect(sfxPlayed).toEqual(['join', 'alarm', 'pop'])

    // Own profile edits go through the loopback (debounced).
    st().setProfile({ name: 'DJ Host' })
    st().setProfile({ name: 'DJ Hostone' })
    jest.advanceTimersByTime(STORE_TIMINGS.profileDebounceMs + 10)
    const profiles = game.handled.filter((m) => m.t === 'profile')
    expect(profiles.length).toBe(1)
    expect(profiles[0]).toEqual({ t: 'profile', profile: { ...st().profile, name: 'DJ Hostone' } })

    st().react('🎉')
    expect(game.handled.at(-1)).toEqual({ t: 'reaction', emoji: '🎉' })

    st().updateSettings({ rounds: 7 })
    st().nextRound()
    st().kick('p2')
    st().backToLobby()
    expect(game.calls).toEqual(['settings:{"rounds":7}', 'next', 'kick:p2', 'lobby'])

    game.startGameImpl = async () => {
      throw new Error('La playlist non ha abbastanza brani.')
    }
    await expect(st().startGame()).rejects.toThrow('La playlist non ha abbastanza brani.')

    // Signaling drop is a soft warning, never a game over.
    net.servers[0].status.emit('reconnecting')
    expect(st().connection).toBe('reconnecting')
    net.servers[0].status.emit('open')
    expect(st().connection).toBe('open')

    st().leave()
    expect(game.destroyed).toBe(true)
    expect(st().role).toBe('none')
    expect(st().connection).toBe('idle')
    expect(st().room).toBeNull()
    expect(st().toasts).toEqual([])
    expect(persist.loadSession()).toBeNull()
    expect(fakeLocation.hash).toBe('#/')
    // Late events from the destroyed game are ignored.
    game.emit(lobbyRoom('HQSTA', me()))
    expect(st().room).toBeNull()
  })

  test('createRoom failure maps NetError to Italian', async () => {
    net.hostError = new MockNetError('server')
    await expect(st().createRoom()).rejects.toThrow('Server di collegamento non raggiungibile. Riprova tra poco.')
    expect(st().role).toBe('none')
    expect(st().connection).toBe('error')
    expect(st().error).toBe('Server di collegamento non raggiungibile. Riprova tra poco.')
  })

  test('host ready + arrangement go through handleLocal', async () => {
    await st().createRoom()
    const game = MockHostGame.instances[0]
    const t = track(11)
    const base = lobbyRoom('HQSTA', me())
    game.emit(withPhase(base, { kind: 'preparing', round: 0 }, { tracks: [t], rounds: [round(0, t)] }))
    expect(st().audio[11]).toBe('loading')
    loads[0].resolve()
    await tick()
    expect(st().audio[11]).toBe('ready')
    expect(game.handled.filter((m) => m.t === 'ready')).toEqual([{ t: 'ready', round: 0 }])

    game.emit(withPhase(st().room!, { kind: 'playing', round: 0, startedAt: Date.now(), endsAt: Date.now() + 90_000, firstSubmit: null }))
    st().setArrangement([0, 1, 2, 3, 4, 5])
    // Sent at once: a drop right before the deadline must never wait behind a debounce.
    expect(game.handled.filter((m) => m.t === 'arrange')).toEqual([{ t: 'arrange', round: 0, order: [0, 1, 2, 3, 4, 5] }])
    st().submit()
    expect(game.handled.at(-1)).toEqual({ t: 'submit', round: 0, order: [0, 1, 2, 3, 4, 5] })
    expect(st().submitted).toBe(true)
  })
})

describe('client', () => {
  test('join: hello → welcome → state / event / pong / ping', async () => {
    const p = st().joinRoom(' kxqpm ')
    expect(st().role).toBe('client')
    expect(st().connection).toBe('connecting')
    expect(st().roomCode).toBe('KXQPM')
    await tick()
    const conn = net.conns[0]
    expect(conn.sent).toEqual([{ t: 'hello', profile: st().profile, version: PROTOCOL_VERSION, secret: persist.loadPlayerSecret(me()) }])
    // The re-attach secret is private: 48 hex chars, stable, stored next to the profile.
    expect(persist.loadPlayerSecret(me())).toMatch(/^[0-9a-f]{48}$/)
    expect(JSON.parse(local.getItem('unshuffle:secret')!)).toEqual({ id: me(), secret: persist.loadPlayerSecret(me()) })

    let resolved = false
    void p.then(() => (resolved = true))
    await tick()
    expect(resolved).toBe(false)

    const welcome = { ...lobbyRoom('KXQPM', 'host-1', [me()]), seq: 5 }
    conn.deliver({ t: 'welcome', you: me(), state: welcome, hostNow: Date.now() + 5000 })
    await p
    expect(st().room?.seq).toBe(5)
    expect(st().connection).toBe('open')
    expect(fakeLocation.hash).toBe('#/r/KXQPM')
    expect(persist.loadSession()).toEqual({ role: 'client', code: 'KXQPM' })
    expect(Math.round((clock.hostNow() - Date.now()) / 100)).toBe(50)
    expect(conn.ofType('ping').length).toBe(1) // immediate ping on welcome

    conn.deliver({ t: 'state', state: { ...welcome, seq: 4, code: 'KXQPM', players: [] }, hostNow: 0 })
    expect(st().room?.seq).toBe(5)
    conn.deliver({ t: 'state', state: { ...welcome, seq: 6 }, hostNow: 0 })
    expect(st().room?.seq).toBe(6)

    const c = Date.now()
    jest.advanceTimersByTime(80)
    conn.deliver({ t: 'pong', c, h: c + 40 + 3000 })
    expect(Math.round(clock.hostNow() - Date.now())).toBe(3000)

    jest.advanceTimersByTime(STORE_TIMINGS.pingMs * 2)
    expect(conn.ofType('ping').length).toBe(3)

    conn.deliver({ t: 'event', event: { type: 'reaction', playerId: 'host-1', emoji: '😂' } })
    conn.deliver({ t: 'event', event: { type: 'player-left', playerId: 'host-9', name: 'Marco' } })
    expect(st().toasts.map((t) => t.event.type)).toEqual(['reaction', 'player-left'])
    expect(sfxPlayed).toEqual(['pop', 'leave'])

    // Joining the same room again while connected is a no-op.
    await st().joinRoom('KXQPM')
    expect(net.conns.length).toBe(1)
  })

  test('exactly one hello when the transport does not replay its status', async () => {
    net.replayStatus = false
    const p = st().joinRoom('KXQPM')
    await tick()
    const conn = net.conns[0]
    expect(conn.ofType('hello').length).toBe(1)
    conn.setStatus('open') // late first 'open' on the same link
    expect(conn.ofType('hello').length).toBe(1)
    conn.deliver({ t: 'welcome', you: me(), state: lobbyRoom('KXQPM', 'h', [me()]), hostNow: Date.now() })
    await p
  })

  test('profile edited while connecting reaches the host after welcome', async () => {
    const p = st().joinRoom('KXQPM')
    await tick()
    const conn = net.conns[0]
    st().setProfile({ name: 'Lady Vinile' })
    conn.deliver({ t: 'welcome', you: me(), state: lobbyRoom('KXQPM', 'h', [me()]), hostNow: Date.now() })
    await p
    expect(conn.ofType('profile')).toEqual([{ t: 'profile', profile: { ...st().profile, name: 'Lady Vinile' } }])
  })

  test('transport NetError messages are kept as they are', async () => {
    const err = new MockNetError('timeout', 'Impossibile collegarsi alla stanza. Riprova.')
    err.name = 'NetError'
    net.joinError = err
    await expect(st().joinRoom('KXQPM')).rejects.toThrow('Impossibile collegarsi alla stanza. Riprova.')
    expect(st().error).toBe('Impossibile collegarsi alla stanza. Riprova.')
  })

  test('join errors: invalid code, room not found, welcome timeout', async () => {
    await expect(st().joinRoom('??')).rejects.toThrow(STORE_MESSAGES.invalidCode)
    expect(st().role).toBe('none')

    net.joinError = new MockNetError('room-not-found')
    await expect(st().joinRoom('ABCDE')).rejects.toThrow('Stanza non trovata. Controlla il codice.')
    expect(st().connection).toBe('error')
    expect(st().role).toBe('none')
    net.joinError = null

    const p = st().joinRoom('ABCDE')
    const caught = p.catch((e: Error) => e.message)
    await tick()
    jest.advanceTimersByTime(STORE_TIMINGS.welcomeTimeoutMs + 1)
    expect(await caught).toBe(STORE_MESSAGES.welcomeTimeout)
    expect(net.conns[0].closed).toBe(true)
    expect(st().role).toBe('none')
    expect(st().error).toBe(STORE_MESSAGES.welcomeTimeout)
  })

  test('reject before welcome rejects the join; after welcome kicks us out', async () => {
    const p = st().joinRoom('FULLX')
    const caught = p.catch((e: Error) => e.message)
    await tick()
    net.conns[0].deliver({ t: 'reject', reason: 'full' })
    expect(await caught).toBe(REJECT_MESSAGES.full)
    expect(st().role).toBe('none')
    expect(st().connection).toBe('closed')

    const { conn } = await joinWelcomed('KXQPM')
    conn.deliver({ t: 'reject', reason: 'kicked' })
    expect(st().error).toBe(REJECT_MESSAGES.kicked)
    expect(st().connection).toBe('closed')
    expect(st().role).toBe('none')
    expect(st().room).toBeNull()
    expect(conn.closed).toBe(true)
    expect(persist.loadSession()).toBeNull()
    expect(fakeLocation.hash).toBe('#/')
  })

  test('reconnect re-sends hello; closed keeps the room and allows rejoin', async () => {
    const { conn } = await joinWelcomed('KXQPM')
    expect(conn.ofType('hello').length).toBe(1)

    conn.setStatus('reconnecting')
    expect(st().connection).toBe('reconnecting')
    jest.advanceTimersByTime(STORE_TIMINGS.pingMs * 3)
    expect(conn.ofType('ping').length).toBe(1) // no pings while the link is down

    conn.setStatus('open')
    expect(conn.ofType('hello').length).toBe(2)
    expect(st().connection).toBe('open')
    conn.deliver({ t: 'welcome', you: me(), state: { ...st().room!, seq: 3 }, hostNow: Date.now() })
    expect(st().room?.seq).toBe(3)

    conn.setStatus('closed')
    expect(st().connection).toBe('closed')
    expect(st().error).toBe(STORE_MESSAGES.hostLost)
    expect(st().role).toBe('client')
    expect(st().room).not.toBeNull()

    const again = st().rejoin()
    expect(st().room).not.toBeNull() // last state stays on screen while reconnecting
    await tick()
    const conn2 = net.conns[1]
    expect(conn2.ofType('hello').length).toBe(1)
    conn2.deliver({ t: 'welcome', you: me(), state: { ...st().room!, seq: 9 }, hostNow: Date.now() })
    await again
    expect(st().connection).toBe('open')
    expect(st().error).toBeNull()
  })

  test('rejoin re-requests audio the dead session was still loading', async () => {
    const [a, b] = [track(41), track(42)]
    const { conn, state } = await joinWelcomed('KXQPM')
    conn.deliver({ t: 'state', state: withPhase(state, { kind: 'preparing', round: 0 }, { tracks: [a, b] }), hostNow: 0 })
    loads[0].resolve()
    await tick()
    expect(st().audio).toEqual({ 41: 'ready', 42: 'loading' })
    conn.setStatus('closed')
    const again = st().rejoin()
    expect(st().audio).toEqual({ 41: 'ready' })
    await tick()
    net.conns[1].deliver({ t: 'welcome', you: me(), state: { ...st().room!, seq: 50 }, hostNow: Date.now() })
    await again
    expect(st().audio).toEqual({ 41: 'ready', 42: 'loading' })
    expect(loads.filter((l) => l.key === 'track:42').length).toBe(2)
    loads[1].resolve() // completion of the dead session's download: ignored
    await tick()
    expect(st().audio).toEqual({ 41: 'ready', 42: 'loading' })
    loads.at(-1)!.resolve()
    await tick()
    expect(st().audio).toEqual({ 41: 'ready', 42: 'ready' })
  })

  test('arrangement resets per round, is debounced, submit locks it', async () => {
    const t0 = track(1)
    const t1 = track(2)
    const { conn, state } = await joinWelcomed('KXQPM')
    const r0 = round(0, t0)
    const r1 = round(1, t1, [2, 0, 5, 3, 1, 4])
    const playing0 = withPhase(state, { kind: 'playing', round: 0, startedAt: Date.now(), endsAt: Date.now() + 90_000, firstSubmit: null }, { tracks: [t0, t1], rounds: [r0] })
    conn.deliver({ t: 'state', state: playing0, hostNow: 0 })
    expect(st().arrangement).toEqual(r0.initialOrder)
    expect(st().arrangementRound).toBe(0)
    expect(st().submitted).toBe(false)

    st().setArrangement([0, 1, 2]) // wrong length
    st().setArrangement([0, 0, 1, 2, 3, 4]) // duplicate
    expect(st().arrangement).toEqual(r0.initialOrder)

    // The first drop goes out at once; a burst right behind it is coalesced into one trailing send.
    st().setArrangement([1, 3, 4, 0, 2, 5])
    expect(conn.ofType('arrange')).toEqual([{ t: 'arrange', round: 0, order: [1, 3, 4, 0, 2, 5] }])
    st().setArrangement([0, 1, 2, 3, 4, 5])
    st().setArrangement([0, 1, 2, 3, 5, 4])
    expect(st().arrangement).toEqual([0, 1, 2, 3, 5, 4])
    expect(persist.loadArrangement('KXQPM', 0, t0.id, 6)).toEqual([0, 1, 2, 3, 5, 4])
    expect(conn.ofType('arrange').length).toBe(1)
    jest.advanceTimersByTime(STORE_TIMINGS.arrangeMinIntervalMs + 1)
    expect(conn.ofType('arrange').map((m) => m.order)).toEqual([[1, 3, 4, 0, 2, 5], [0, 1, 2, 3, 5, 4]])

    jest.advanceTimersByTime(1000)
    st().setArrangement([0, 1, 2, 3, 4, 5])
    st().setArrangement([0, 1, 2, 3, 5, 4]) // queued behind the one just sent…
    st().submit() // …and folded into the submit
    expect(conn.ofType('submit')).toEqual([{ t: 'submit', round: 0, order: [0, 1, 2, 3, 5, 4] }])
    expect(st().submitted).toBe(true)
    jest.advanceTimersByTime(1000)
    expect(conn.ofType('arrange').length).toBe(3)
    st().setArrangement([5, 4, 3, 2, 1, 0])
    expect(st().arrangement).toEqual([0, 1, 2, 3, 5, 4])
    st().submit()
    expect(conn.ofType('submit').length).toBe(1)

    const reveal0 = withPhase(st().room!, { kind: 'reveal', round: 0, nextAt: null })
    conn.deliver({ t: 'state', state: reveal0, hostNow: 0 })
    expect(st().arrangement).toEqual([0, 1, 2, 3, 5, 4])

    // Next round: stale submission statuses from round 0 must not mark us as submitted.
    const prep1 = withPhase(st().room!, { kind: 'preparing', round: 1 }, { rounds: [r0, r1], submissions: { [me()]: { submitted: true, atMs: 1 } } })
    conn.deliver({ t: 'state', state: prep1, hostNow: 0 })
    expect(st().arrangementRound).toBe(1)
    expect(st().arrangement).toEqual(r1.initialOrder)
    expect(st().submitted).toBe(false)
  })

  test('spectators cannot submit; host-confirmed submission is picked up', async () => {
    const t0 = track(1)
    const base = lobbyRoom('KXQPM', 'host-1', [me()])
    base.players[1].activeFromRound = 1
    const { conn } = await joinWelcomed('KXQPM', base)
    const playing = withPhase(base, { kind: 'playing', round: 0, startedAt: 0, endsAt: Date.now() + 1000, firstSubmit: null }, { tracks: [t0], rounds: [round(0, t0)] })
    conn.deliver({ t: 'state', state: playing, hostNow: 0 })
    st().submit()
    expect(conn.ofType('submit').length).toBe(0)
    expect(st().submitted).toBe(false)

    const active = structuredClone(playing)
    active.players[1].activeFromRound = 0
    active.submissions = { [me()]: { submitted: true, atMs: 500 } }
    active.seq += 1
    conn.deliver({ t: 'state', state: active, hostNow: 0 })
    expect(st().submitted).toBe(true)
  })

  test('saved arrangement is restored and re-sent after (re)welcome', async () => {
    const t0 = track(7)
    const r0 = round(0, t0)
    persist.saveArrangement('KXQPM', 0, t0.id, [0, 1, 2, 3, 4, 5])
    persist.saveArrangement('KXQPM', 1, t0.id, [0, 1, 2]) // invalid: ignored later
    const playing = withPhase(lobbyRoom('KXQPM', 'host-1', [me()]), { kind: 'playing', round: 0, startedAt: 0, endsAt: Date.now() + 60_000, firstSubmit: null }, { tracks: [t0], rounds: [r0] })
    const { conn } = await joinWelcomed('KXQPM', playing)
    expect(st().arrangement).toEqual([0, 1, 2, 3, 4, 5])
    expect(conn.ofType('arrange')).toEqual([{ t: 'arrange', round: 0, order: [0, 1, 2, 3, 4, 5] }])
    expect(persist.loadArrangement('KXQPM', 1, t0.id, 6)).toBeNull()

    // Submitted while the link was down → sent right behind the hello once it is back,
    // without waiting for the welcome (the round may be about to end), and only once.
    conn.setStatus('reconnecting')
    st().submit()
    expect(st().submitted).toBe(true)
    expect(conn.ofType('submit').length).toBe(0)
    conn.setStatus('open')
    expect(conn.sent.slice(-2).map((m) => m.t)).toEqual(['hello', 'submit'])
    conn.deliver({ t: 'welcome', you: me(), state: { ...playing, seq: playing.seq + 5 }, hostNow: Date.now() })
    expect(conn.ofType('submit')).toEqual([{ t: 'submit', round: 0, order: [0, 1, 2, 3, 4, 5] }])
  })

  test('audio prefetch: current round first, max 2 concurrent, ready once, retry + toast on failure', async () => {
    const [a, b, c] = [track(100), track(200), track(300)]
    const { conn, state } = await joinWelcomed('KXQPM')
    // Lobby → preparing: host broadcasts the picked tracks before round 0 is analyzed.
    const prep = withPhase(state, { kind: 'preparing', round: 0 }, { tracks: [a, b, c] })
    conn.deliver({ t: 'state', state: prep, hostNow: 0 })
    expect(loads.map((l) => l.key)).toEqual(['track:100', 'track:200'])
    expect(loads[0].url).toBe(a.preview)
    expect(st().audio).toEqual({ 100: 'loading', 200: 'loading' })
    expect(await loads[0].refresh!()).toBe('https://fresh.example/100.mp3')

    loads[0].resolve()
    await tick()
    expect(st().audio[100]).toBe('ready')
    // Only the current and the next round are decoded (~11 MB of PCM each); round 2 waits.
    expect(loads.map((l) => l.key)).toEqual(['track:100', 'track:200'])
    expect(conn.ofType('ready').length).toBe(0) // round 0 not prepared yet

    const prepared = withPhase(prep, { kind: 'preparing', round: 0 }, { rounds: [round(0, a)] })
    conn.deliver({ t: 'state', state: prepared, hostNow: 0 })
    expect(conn.ofType('ready')).toEqual([{ t: 'ready', round: 0 }])
    conn.deliver({ t: 'state', state: withPhase(prepared, { kind: 'intro', round: 0, endsAt: Date.now() + 4000 }), hostNow: 0 })
    expect(conn.ofType('ready').length).toBe(1)

    // Track b fails while it is not current: silent, retried when its round comes.
    loads[1].reject()
    await tick()
    expect(st().audio[200]).toBe('error')
    expect(st().toasts.length).toBe(0)
    const prep1 = withPhase(st().room!, { kind: 'preparing', round: 1 }, { rounds: [round(0, a), round(1, b)] })
    conn.deliver({ t: 'state', state: prep1, hostNow: 0 })
    expect(st().audio[200]).toBe('loading')
    expect(loads.filter((l) => l.key === 'track:200').length).toBe(2)
    expect(loads.filter((l) => l.key === 'track:300').length).toBe(1) // now the next round
    expect(conn.ofType('ready').length).toBe(1)
    loads.filter((l) => l.key === 'track:200')[1].reject()
    await tick()
    expect(st().audio[200]).toBe('error')
    expect(st().toasts.map((t) => t.event.type)).toEqual(['info'])
    // Waiting won't help: tell the host not to wait for us.
    expect(conn.ofType('ready')).toEqual([{ t: 'ready', round: 0 }, { t: 'ready', round: 1 }])
    // Round 0 is over: its decoded audio is freed and never fetched again.
    expect(evicted).toContain('track:100')
    expect(st().audio[100]).toBeUndefined()
    expect(loads.filter((l) => l.key === 'track:100').length).toBe(1)
    // Final screen: nothing is needed any more.
    conn.deliver({ t: 'state', state: withPhase(st().room!, { kind: 'final' }), hostNow: 0 })
    expect(Object.keys(st().audio).filter((k) => st().audio[Number(k)] !== 'loading')).toEqual([])
  })

  test('selectors derive standings and round deltas', async () => {
    const t0 = track(1)
    const res = (playerId: string, points: number, timeMs: number) => ({ playerId, order: [], correct: 0, pairs: 0, points, perfect: points === 5000, timeMs, timedOut: false })
    const room = lobbyRoom('KXQPM', 'a', ['b', 'c'])
    room.players[0].score = 6000
    room.players[1].score = 6000
    room.players[2].score = 5000
    room.results = [
      [res('a', 1000, 30_000), res('b', 5000, 20_000), res('c', 0, 90_000)],
      [res('a', 5000, 10_000), res('b', 1000, 25_000), res('c', 5000, 5_000)],
    ]
    room.phase = { kind: 'reveal', round: 1, nextAt: null }
    room.rounds = [round(0, t0), round(1, t0)]
    const lb = selectors.computeStandings(room)
    expect(lb.map((s) => [s.player.id, s.rank])).toEqual([['a', 1], ['b', 2], ['c', 3]])
    const rs = selectors.computeRoundStandings(room, 1)
    expect(rs.map((r) => [r.player.id, r.prevRank, r.rank, r.rankDelta])).toEqual([['a', 2, 1, 1], ['b', 1, 2, -1], ['c', 3, 3, 0]])
    expect(selectors.computeRoundStandings(room, 0).every((r) => r.rankDelta === 0)).toBe(true)
    const stats = selectors.computeGameStats(room)
    expect(stats.fastest?.player.id).toBe('c')
    expect(stats.totalPerfect).toBe(3)
    expect(selectors.getCurrentRound(room)?.index).toBe(1)
    expect(selectors.isActivePlayer(room.players[0], 0)).toBe(true)
  })
})

describe('toasts', () => {
  test('auto-expire (reactions faster), capped, dismissable', async () => {
    const { conn } = await joinWelcomed('KXQPM')
    conn.deliver({ t: 'event', event: { type: 'reaction', playerId: 'x', emoji: '🔥' } })
    conn.deliver({ t: 'event', event: { type: 'info', message: 'Ciao' } })
    expect(st().toasts.length).toBe(2)
    expect(st().toasts[0].at).toBe(Date.now())
    jest.advanceTimersByTime(STORE_TIMINGS.reactionToastMs + 1)
    expect(st().toasts.map((t) => t.event.type)).toEqual(['info'])
    jest.advanceTimersByTime(STORE_TIMINGS.toastMs - STORE_TIMINGS.reactionToastMs)
    expect(st().toasts.length).toBe(0)

    for (let i = 0; i < 9; i++) conn.deliver({ t: 'event', event: { type: 'info', message: `m${i}` } })
    expect(st().toasts.length).toBe(STORE_TIMINGS.maxToasts)
    // A burst of reactions never pushes informational toasts out.
    for (let i = 0; i < 12; i++) conn.deliver({ t: 'event', event: { type: 'reaction', playerId: 'x', emoji: '🔥' } })
    expect(st().toasts.filter((t) => t.event.type === 'info').length).toBe(STORE_TIMINGS.maxToasts)
    expect(st().toasts.filter((t) => t.event.type === 'reaction').length).toBe(STORE_TIMINGS.maxReactionToasts)
    jest.advanceTimersByTime(STORE_TIMINGS.reactionToastMs + 1)
    expect(st().toasts[0].event).toEqual({ type: 'info', message: 'm3' })
    const ids = st().toasts.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    st().dismissToast(ids[0])
    expect(st().toasts.length).toBe(STORE_TIMINGS.maxToasts - 1)
    st().notify('  Link copiato ')
    expect(st().toasts.at(-1)?.event).toEqual({ type: 'info', message: 'Link copiato' })
    expect(conn.sent.some((m) => JSON.stringify(m).includes('Link copiato'))).toBe(false)
    jest.advanceTimersByTime(STORE_TIMINGS.toastMs + 1)
    expect(st().toasts.length).toBe(0)
  })
})

describe('leave', () => {
  test('client leave sends leave, closes, clears session and ignores late callbacks', async () => {
    const t0 = track(5)
    const playing = withPhase(lobbyRoom('KXQPM', 'host-1', [me()]), { kind: 'playing', round: 0, startedAt: 0, endsAt: Date.now() + 60_000, firstSubmit: null }, { tracks: [t0], rounds: [round(0, t0)] })
    const { conn } = await joinWelcomed('KXQPM', playing)
    st().setArrangement([0, 1, 2, 3, 4, 5])
    conn.deliver({ t: 'event', event: { type: 'info', message: 'x' } })
    st().leave()
    expect(conn.sent.at(-1)).toEqual({ t: 'leave' })
    expect(conn.closed).toBe(true)
    expect(persist.loadSession()).toBeNull()
    expect(persist.loadArrangement('KXQPM', 0, t0.id, 6)).toBeNull()
    expect(fakeLocation.hash).toBe('#/')
    expect(st()).toMatchObject({ role: 'none', connection: 'idle', error: null, room: null, arrangement: [], arrangementRound: -1, submitted: false, toasts: [], audio: {} })
    // Late messages / statuses from the dead connection change nothing.
    conn.messages.emit({ t: 'state', state: { ...playing, seq: 99 }, hostNow: 0 })
    conn.statuses.emit('closed')
    jest.advanceTimersByTime(10_000)
    expect(st()).toMatchObject({ role: 'none', connection: 'idle', error: null, room: null })
  })

  test('leaving while joining cancels the pending join', async () => {
    const p = st().joinRoom('KXQPM')
    const caught = p.catch((e: Error) => e.message)
    await tick()
    st().leave()
    expect(await caught).toBe(STORE_MESSAGES.cancelled)
    expect(net.conns[0].closed).toBe(true)
    expect(st().role).toBe('none')
  })
})

describe('resumeSession', () => {
  test('host with a fresh snapshot reclaims the code and restores', async () => {
    const snapshot = withPhase(lobbyRoom('RQSUM', me(), ['p2']), { kind: 'lobby' })
    persist.saveSession({ role: 'host', code: 'RQSUM' })
    persist.saveHostSnapshot(snapshot)
    expect(await st().resumeSession()).toBe(true)
    expect(net.createHostCalls).toEqual([{ code: 'RQSUM' }])
    expect(MockHostGame.instances[0].opts.restore).toEqual(snapshot)
    expect(st().role).toBe('host')
    expect(st().room?.players.length).toBe(2)
    expect(fakeLocation.hash).toBe('#/r/RQSUM')
  })

  test('host with a stale snapshot does not resume', async () => {
    persist.saveSession({ role: 'host', code: 'RQSUM' })
    persist.saveHostSnapshot(lobbyRoom('RQSUM', me()), Date.now() - 11 * 60_000)
    expect(await st().resumeSession()).toBe(false)
    expect(net.createHostCalls.length).toBe(0)
    expect(persist.loadSession()).toBeNull()
    expect(st().role).toBe('none')
  })

  test('client session rejoins; failures clear the session', async () => {
    persist.saveSession({ role: 'client', code: 'CLQEN' })
    const p = st().resumeSession()
    expect(st().resumeSession()).toBe(p) // concurrent boots share one attempt
    await tick()
    net.conns[0].deliver({ t: 'welcome', you: me(), state: lobbyRoom('CLQEN', 'h', [me()]), hostNow: Date.now() })
    expect(await p).toBe(true)
    expect(st().role).toBe('client')
    st().leave()

    // The room never comes back: retried for resumeRetryMs, then the session is forgotten.
    persist.saveSession({ role: 'client', code: 'CLQEN' })
    net.joinError = new MockNetError('room-not-found')
    const failing = st().resumeSession()
    for (let i = 0; i < 40; i++) {
      await tick()
      jest.advanceTimersByTime(1000)
    }
    expect(await failing).toBe(false)
    expect(persist.loadSession()).toBeNull()
    expect(st().error).toBe('Stanza non trovata. Controlla il codice.')
  })

  test('client resume survives a host that is reloading too (room briefly not found)', async () => {
    persist.saveSession({ role: 'client', code: 'CLQEN' })
    net.joinError = new MockNetError('room-not-found')
    const p = st().resumeSession()
    await tick()
    expect(st().role).toBe('none') // first attempt failed…
    net.joinError = null // …the host is back
    jest.advanceTimersByTime(700)
    await tick()
    const conn = net.conns.at(-1)!
    conn.deliver({ t: 'welcome', you: me(), state: lobbyRoom('CLQEN', 'h', [me()]), hostNow: Date.now() })
    expect(await p).toBe(true)
    expect(st().role).toBe('client')
    expect(persist.loadSession()).toEqual({ role: 'client', code: 'CLQEN' })
  })

  test('leaving while a resume waits to retry cancels it', async () => {
    persist.saveSession({ role: 'client', code: 'CLQEN' })
    net.joinError = new MockNetError('room-not-found')
    const p = st().resumeSession()
    await tick()
    st().leave()
    net.joinError = null
    jest.advanceTimersByTime(2000)
    expect(await p).toBe(false)
    expect(net.conns.length).toBe(0)
    expect(st().role).toBe('none')
  })

  test('nothing to resume, or the tab now points at another room', async () => {
    expect(await st().resumeSession()).toBe(false)
    persist.saveSession({ role: 'client', code: 'CLQEN' })
    fakeLocation.hash = '#/r/QTHER'
    expect(await st().resumeSession()).toBe(false)
    expect(net.conns.length).toBe(0)
    expect(persist.loadSession()).toBeNull()
  })
})

describe('moves near the deadline and across link drops', () => {
  function playingRoom(state: RoomState, t: TrackInfo, endsIn: number) {
    return withPhase(state, { kind: 'playing', round: 0, startedAt: Date.now(), endsAt: Date.now() + endsIn, firstSubmit: null }, { tracks: [t], rounds: [round(0, t)] })
  }

  test('close to the deadline every drop goes out immediately, no coalescing', async () => {
    const t = track(5)
    const { conn, state } = await joinWelcomed('KXQPM')
    conn.deliver({ t: 'state', state: playingRoom(state, t, STORE_TIMINGS.arrangeUrgentMs - 500), hostNow: 0 })
    const sentBefore = conn.ofType('arrange').length
    st().setArrangement([0, 1, 2, 3, 4, 5])
    st().setArrangement([0, 1, 2, 3, 5, 4])
    st().setArrangement([1, 0, 2, 3, 5, 4])
    expect(conn.ofType('arrange').slice(sentBefore).map((m) => m.order)).toEqual([
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 5, 4],
      [1, 0, 2, 3, 5, 4],
    ])
  })

  test('a drop made while the link is down goes out right behind the hello when it is back', async () => {
    const t = track(5)
    const { conn, state } = await joinWelcomed('KXQPM')
    conn.deliver({ t: 'state', state: playingRoom(state, t, 60_000), hostNow: 0 })
    conn.setStatus('reconnecting')
    const before = conn.sent.length
    st().setArrangement([0, 1, 2, 3, 4, 5])
    jest.advanceTimersByTime(1000)
    expect(conn.sent.length).toBe(before)
    conn.setStatus('open')
    expect(conn.sent.slice(before).map((m) => m.t)).toEqual(['hello', 'arrange'])
    expect(conn.ofType('arrange').at(-1)).toEqual({ t: 'arrange', round: 0, order: [0, 1, 2, 3, 4, 5] })
  })

  test('after a (re)attach the host always learns the arrangement on screen, even an untouched board', async () => {
    const t = track(9)
    const r0 = round(0, t)
    const playing = withPhase(lobbyRoom('KXQPM', 'host-1', [me()]), { kind: 'playing', round: 0, startedAt: 0, endsAt: Date.now() + 60_000, firstSubmit: null }, { tracks: [t], rounds: [r0] })
    const { conn } = await joinWelcomed('KXQPM', playing)
    expect(conn.ofType('arrange')).toEqual([{ t: 'arrange', round: 0, order: r0.initialOrder }])
  })

  test('a tab new to the round continues from the arrangement the host kept for me (seat moved here)', async () => {
    const t = track(9)
    const r0 = round(0, t)
    const mine = [0, 1, 2, 3, 5, 4]
    const playing = withPhase(lobbyRoom('KXQPM', 'host-1', [me()]), { kind: 'playing', round: 0, startedAt: 0, endsAt: Date.now() + 60_000, firstSubmit: null }, { tracks: [t], rounds: [r0] })
    const p = st().joinRoom('KXQPM')
    await tick()
    const conn = net.conns.at(-1)!
    conn.deliver({ t: 'welcome', you: me(), state: playing, hostNow: Date.now(), mine: { round: 0, order: mine } } as HostMsg)
    await p
    expect(st().arrangement).toEqual(mine)
    expect(persist.loadArrangement('KXQPM', 0, t.id, 6)).toEqual(mine)
    expect(conn.ofType('arrange')).toEqual([{ t: 'arrange', round: 0, order: mine }])
    // Junk from the host is ignored (wrong round / not a permutation).
    st().leave()
    sessionStore.clear()
    const p2 = st().joinRoom('KXQPM')
    await tick()
    net.conns.at(-1)!.deliver({ t: 'welcome', you: me(), state: playing, hostNow: Date.now(), mine: { round: 0, order: [0, 0, 1] } } as HostMsg)
    await p2
    expect(st().arrangement).toEqual(r0.initialOrder)
  })

  test('audio failure toast never names the song before its reveal', async () => {
    const a = track(100)
    const { conn, state } = await joinWelcomed('KXQPM')
    const prep = withPhase(state, { kind: 'preparing', round: 0 }, { tracks: [a], rounds: [round(0, a)] })
    conn.deliver({ t: 'state', state: prep, hostNow: 0 })
    for (let i = 0; i < STORE_TIMINGS.maxLoadAttempts; i++) {
      loads.filter((l) => l.key === 'track:100').at(-1)!.reject()
      await tick()
      conn.deliver({ t: 'state', state: { ...st().room!, seq: st().room!.seq + 1 }, hostNow: 0 })
    }
    const messages = st().toasts.map((x) => (x.event.type === 'info' ? x.event.message : ''))
    expect(messages).toEqual(['Audio di questo round non disponibile: puoi comunque giocare.'])
    expect(messages.join()).not.toContain(a.title)
  })
})

describe('compressed prefetch of later rounds', () => {
  test('later rounds are downloaded as Blob URLs (one at a time) and decoded from them when their turn comes', async () => {
    const fetched: string[] = []
    const revoked: string[] = []
    const realFetch = globalThis.fetch
    const realCreate = URL.createObjectURL
    const realRevoke = URL.revokeObjectURL
    g.document = {}
    let blobs = 0
    globalThis.fetch = (async (url: string) => {
      fetched.push(String(url))
      return new Response(new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }))
    }) as typeof fetch
    URL.createObjectURL = () => `blob:test/${++blobs}`
    URL.revokeObjectURL = (u: string) => void revoked.push(u)
    try {
      const tracks = [track(1), track(2), track(3), track(4)]
      const { conn, state } = await joinWelcomed('KXQPM')
      conn.deliver({ t: 'state', state: withPhase(state, { kind: 'preparing', round: 0 }, { tracks }), hostNow: 0 })
      expect(loads.map((l) => l.key)).toEqual(['track:1', 'track:2'])
      expect(fetched).toEqual([]) // decoding the rounds that matter comes first
      loads[0].resolve()
      loads[1].resolve()
      jest.useRealTimers()
      await new Promise((r) => setTimeout(r, 20))
      expect(fetched).toEqual([tracks[2].preview, tracks[3].preview])
      expect(loads.map((l) => l.key)).toEqual(['track:1', 'track:2']) // downloaded, not decoded
      // Round 1: round 2 enters the decode window and is decoded from its downloaded bytes.
      conn.deliver({ t: 'state', state: withPhase(st().room!, { kind: 'preparing', round: 1 }), hostNow: 0 })
      await new Promise((r) => setTimeout(r, 20))
      const l3 = loads.find((l) => l.key === 'track:3')!
      expect(l3.url).toBe('blob:test/1')
      l3.resolve()
      await new Promise((r) => setTimeout(r, 20))
      expect(revoked).toContain('blob:test/1')
      // The final screen releases whatever is left.
      conn.deliver({ t: 'state', state: withPhase(st().room!, { kind: 'final' }), hostNow: 0 })
      expect(revoked).toContain('blob:test/2')
    } finally {
      globalThis.fetch = realFetch
      URL.createObjectURL = realCreate
      URL.revokeObjectURL = realRevoke
      delete g.document
      jest.useFakeTimers()
    }
  })
})

describe('leaderboard order', () => {
  test('equal score: whoever played more rounds ranks first, then the faster one; spectators last', () => {
    const t0 = track(1)
    const res = (playerId: string, points: number, timeMs: number) => ({ playerId, order: [], correct: 0, pairs: 0, points, perfect: false, timeMs, timedOut: points === 0 })
    const room = lobbyRoom('KXQPM', 'host', ['late', 'slow', 'fast'])
    room.players[1].activeFromRound = 1 // late joiner: spectated round 0
    room.results = [[res('host', 0, 68_000), res('slow', 0, 90_000), res('fast', 0, 30_000)]]
    room.phase = { kind: 'reveal', round: 0, nextAt: null }
    room.rounds = [round(0, t0)]
    const rows = selectors.computeRoundStandings(room, 0)
    expect(rows.map((r) => [r.player.id, r.rank])).toEqual([['fast', 1], ['host', 2], ['slow', 3], ['late', 4]])
    expect(selectors.computeStandings(room).map((s) => [s.player.id, s.rank])).toEqual([['fast', 1], ['host', 2], ['slow', 3], ['late', 4]])

    // Round 1: the late joiner plays too; fewer rounds never beats more rounds on equal score.
    room.results.push([res('late', 1000, 10_000), res('host', 1000, 80_000), res('slow', 0, 90_000), res('fast', 0, 90_000)])
    for (const p of room.players) p.score = room.results.flat().filter((r) => r.playerId === p.id).reduce((a, r) => a + r.points, 0)
    const after = selectors.computeRoundStandings(room, 1)
    expect(after.map((r) => [r.player.id, r.rank, r.prevRank])).toEqual([['host', 1, 2], ['late', 2, 4], ['fast', 3, 1], ['slow', 4, 3]])
    expect(selectors.compareStanding({ score: 5, roundsPlayed: 2, totalTimeMs: 9 }, { score: 5, roundsPlayed: 2, totalTimeMs: 9 })).toBe(0)
  })
})
