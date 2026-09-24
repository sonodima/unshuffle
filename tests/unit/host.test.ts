// HostGame state machine tests (bun test tests/unit/host.test.ts).
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Keep the real Deezer / audio modules (and any import-time side effects) out
// of these tests entirely. HostGame must never call them when deps are
// injected — the mocks throw if it does.
const untouchable = (name: string) => () => {
  throw new Error(`real ${name} must not be called`)
}
mock.module('../../src/lib/deezer', () => ({
  DeezerError: class DeezerError extends Error {},
  getPlaylistTracks: untouchable('getPlaylistTracks'),
  pickGameTracks: untouchable('pickGameTracks'),
  refreshPreview: untouchable('refreshPreview'),
}))
mock.module('../../src/audio/engine', () => ({ audioEngine: null }))
mock.module('../../src/audio/analysis', () => ({ analyzeAndCut: untouchable('analyzeAndCut') }))

import type { GameEvent, PlaylistRef, RoomState } from '../../src/game/types'
import type { HostMsg } from '../../src/net/protocol'
import {
  FakeClock,
  FakeHostServer,
  MemoryStorage,
  T0,
  deepFreeze,
  deferred,
  makeDeps,
  makeTracks,
  profile,
  type FakeControl,
} from '../support/host-harness'

const { HostGame, HOST_MESSAGES, LOBBY_GRACE_MS, RESTORE_GRACE_MS, DISCONNECT_GRACE_MS, LEFT_NOTICE_MS } = await import('../../src/game/host')
const { ARRIVAL_GRACE_MS, INTRO_MS, MAX_PLAYERS, PROTOCOL_VERSION, READY_TIMEOUT_MS, REVEAL_AUTO_ADVANCE_MS, AVATARS } = await import(
  '../../src/game/constants'
)
const { scoreArrangement } = await import('../../src/game/scoring')
const { loadHostSnapshot } = await import('../../src/game/persist')

type Game = InstanceType<typeof HostGame>

const HOST = profile('p-host', 'Tommy', 0, 0)
const PLAYLIST: PlaylistRef = { id: 908622995, title: 'Hit 2000', picture: 'https://cdn.example/pl.jpg', nbTracks: 80 }

interface World {
  clock: FakeClock
  server: FakeHostServer
  game: Game
  ctl: FakeControl
  states: RoomState[]
  events: GameEvent[]
}

let consoleErrors: unknown[][] = []
const realConsoleError = console.error
beforeEach(() => {
  consoleErrors = []
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args)
  }
})
afterEach(() => {
  console.error = realConsoleError
  // Any error swallowed by HostGame's guards (e.g. a write to a frozen state) fails the test.
  expect(consoleErrors).toEqual([])
  delete (globalThis as { sessionStorage?: Storage }).sessionStorage
})

function world(opts: { tracks?: number; restore?: RoomState | null; server?: FakeHostServer; clock?: FakeClock } = {}): World {
  const clock = opts.clock ?? new FakeClock()
  const server = opts.server ?? new FakeHostServer()
  const { deps, ctl } = makeDeps(clock, makeTracks(opts.tracks ?? 20))
  const game = new HostGame({ server, hostProfile: HOST, deps, restore: opts.restore })
  const states: RoomState[] = []
  const events: GameEvent[] = []
  // Freeze everything the host publishes: any later in-place mutation throws.
  game.subscribe((s) => states.push(deepFreeze(s)))
  game.onEvent((e) => events.push(e))
  return { clock, server, game, ctl, states, events }
}

function hello(w: World, connId: string, id: string, name = id, version = PROTOCOL_VERSION): void {
  w.server.connect(connId)
  w.server.deliver(connId, { t: 'hello', profile: profile(id, name), version })
}

function lastEvent(list: GameEvent[]): GameEvent | undefined {
  return list[list.length - 1]
}

function player(w: World, id: string) {
  return w.game.state.players.find((p) => p.id === id)
}

function playing(w: World) {
  const phase = w.game.state.phase
  if (phase.kind !== 'playing') throw new Error(`expected playing, got ${phase.kind}`)
  return phase
}

function solved(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

function isContiguous(state: RoomState, r: number): boolean {
  const segs = state.rounds[r]!.segments
  return segs.every((s, i) => s.index === i && (i === 0 || segs[i - 1].end === s.start) && s.end - s.start >= 0.4)
}

/** Everyone listed sends `ready` for round r (host via handleLocal). */
function readyAll(w: World, r: number, conns: string[], host = true): void {
  if (host) w.game.handleLocal({ t: 'ready', round: r })
  for (const c of conns) w.server.deliver(c, { t: 'ready', round: r })
}

async function startAndPlay(w: World, conns: string[], settings: Partial<Parameters<Game['updateSettings']>[0]> = {}) {
  w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 8, roundTime: 90, finalTimer: 15, ...settings })
  await w.game.startGame()
  await w.clock.advance(0)
  expect(w.game.state.phase).toMatchObject({ kind: 'preparing', round: 0, message: HOST_MESSAGES.syncing })
  readyAll(w, 0, conns)
  expect(w.game.state.phase.kind).toBe('intro')
  await w.clock.advance(INTRO_MS)
  return playing(w)
}

// -----------------------------------------------------------------------------

describe('joining', () => {
  test('hello → welcome, state broadcast, player-joined; names and indices sanitized', async () => {
    const w = world()
    w.server.connect('c1')
    w.server.deliver('c1', {
      t: 'hello',
      profile: { id: 'p-a', name: '   DJ   Pinguino \n Stratosferico Supremo ', avatar: 999, color: -3 },
      version: PROTOCOL_VERSION,
    })
    const [welcome, state, event] = w.server.box('c1')
    expect(welcome.t).toBe('welcome')
    if (welcome.t !== 'welcome') return
    expect(welcome.you).toBe('p-a')
    expect(welcome.hostNow).toBe(T0)
    const a = welcome.state.players.find((p) => p.id === 'p-a')!
    expect(a).toMatchObject({ name: 'DJ Pinguino Stra', avatar: AVATARS.length - 1, color: 0, isHost: false, connected: true, score: 0, activeFromRound: 0 })
    expect(state.t).toBe('state')
    expect(event).toEqual({ t: 'event', event: { type: 'player-joined', playerId: 'p-a', name: 'DJ Pinguino Stra' } })
    expect(lastEvent(w.events)).toMatchObject({ type: 'player-joined', playerId: 'p-a' })
    expect(w.states[w.states.length - 1].players).toHaveLength(2)

    hello(w, 'c2', 'p-b', '    ')
    expect(player(w, 'p-b')!.name).toBe('Giocatore')
    expect(w.game.state.code).toBe('KXQPM')
    expect(w.game.state.players[0]).toMatchObject({ id: 'p-host', isHost: true, connected: true })
  })

  test('re-attach keeps the player (no join event) and drops the older live connection', async () => {
    const w = world()
    hello(w, 'c1', 'p-a', 'Giulia')
    w.server.lose('c1')
    expect(player(w, 'p-a')!.connected).toBe(false)
    // The leave notice waits LEFT_NOTICE_MS: a reload that re-attaches in time is silent.
    expect(w.events.some((e) => e.type === 'player-left')).toBe(false)
    await w.clock.advance(LEFT_NOTICE_MS - 500)
    expect(w.events.some((e) => e.type === 'player-left')).toBe(false)

    const before = w.events.length
    hello(w, 'c2', 'p-a', 'Giulia 2')
    await w.clock.advance(LEFT_NOTICE_MS)
    expect(w.events.some((e) => e.type === 'player-left')).toBe(false)
    expect(w.game.state.players).toHaveLength(2)
    expect(player(w, 'p-a')).toMatchObject({ connected: true, name: 'Giulia 2' })
    expect(w.events.length).toBe(before)
    expect(w.server.of('c2', 'welcome')[0].you).toBe('p-a')

    // Second tab / stale connection: the older one gets 'duplicate' and is closed.
    hello(w, 'c3', 'p-a', 'Giulia 2')
    expect(w.server.dropped).toContainEqual({ connId: 'c2', finalMsg: { t: 'reject', reason: 'duplicate' } })
    expect(w.server.isOpen('c2')).toBe(false)
    expect(player(w, 'p-a')!.connected).toBe(true)
    // The old connection's close must not mark the re-attached player as gone.
    w.server.lose('c2')
    expect(player(w, 'p-a')!.connected).toBe(true)
    w.server.deliver('c3', { t: 'reaction', emoji: '🔥' })
    expect(lastEvent(w.events)).toEqual({ type: 'reaction', playerId: 'p-a', emoji: '🔥' })
  })

  test('lobby: a dropped link is announced once it has stayed down for LEFT_NOTICE_MS', async () => {
    const w = world()
    hello(w, 'c1', 'p-a', 'Giulia')
    w.server.lose('c1')
    await w.clock.advance(LEFT_NOTICE_MS + 10)
    expect(lastEvent(w.events)).toEqual({ type: 'player-left', playerId: 'p-a', name: 'Giulia' })
    expect(w.events.filter((e) => e.type === 'player-left')).toHaveLength(1)
  })

  test('lobby: disconnected players are removed after the grace period unless they come back', async () => {
    const w = world()
    hello(w, 'c1', 'p-a')
    hello(w, 'c2', 'p-b')
    w.server.lose('c1')
    w.server.lose('c2')
    await w.clock.advance(LOBBY_GRACE_MS - 1000)
    hello(w, 'c3', 'p-b')
    await w.clock.advance(5000)
    expect(player(w, 'p-a')).toBeUndefined()
    expect(player(w, 'p-b')).toMatchObject({ connected: true })
  })

  test('leave: removed at once in the lobby', async () => {
    const w = world()
    hello(w, 'c1', 'p-a', 'Marco')
    w.server.deliver('c1', { t: 'leave' })
    expect(player(w, 'p-a')).toBeUndefined()
    expect(w.server.isOpen('c1')).toBe(false)
    expect(lastEvent(w.events)).toEqual({ type: 'player-left', playerId: 'p-a', name: 'Marco' })
  })

  test('full room, version mismatch, host id reuse', async () => {
    const w = world()
    for (let i = 1; i < MAX_PLAYERS; i++) hello(w, `c${i}`, `p-${i}`)
    expect(w.game.state.players).toHaveLength(MAX_PLAYERS)
    hello(w, 'c-late', 'p-late')
    expect(w.server.box('c-late')).toEqual([{ t: 'reject', reason: 'full' }])
    expect(w.server.isOpen('c-late')).toBe(false)
    expect(w.game.state.players).toHaveLength(MAX_PLAYERS)
    // A known player can always come back, even when the room is full.
    w.server.lose('c3')
    hello(w, 'c3b', 'p-3')
    expect(player(w, 'p-3')!.connected).toBe(true)

    hello(w, 'c-old', 'p-old', 'Vecchio', PROTOCOL_VERSION + 1)
    expect(w.server.box('c-old')).toEqual([{ t: 'reject', reason: 'version' }])
    expect(w.server.isOpen('c-old')).toBe(false)

    hello(w, 'c-twin', 'p-host')
    expect(w.server.box('c-twin')).toEqual([{ t: 'reject', reason: 'duplicate' }])
    expect(w.game.state.players.filter((p) => p.id === 'p-host')).toHaveLength(1)
  })

  test('ping, reactions (throttled), messages before hello are ignored', async () => {
    const w = world()
    w.server.connect('c0')
    w.server.deliver('c0', { t: 'ping', c: 42 })
    expect(w.server.box('c0')).toEqual([{ t: 'pong', c: 42, h: T0 }])
    w.server.deliver('c0', { t: 'reaction', emoji: '🔥' })
    expect(w.events).toHaveLength(0)

    hello(w, 'c1', 'p-a')
    w.events.length = 0
    w.server.deliver('c1', { t: 'reaction', emoji: '🔥' })
    await w.clock.advance(100)
    w.server.deliver('c1', { t: 'reaction', emoji: '😂' })
    await w.clock.advance(300)
    w.server.deliver('c1', { t: 'reaction', emoji: '😂' })
    w.server.deliver('c1', { t: 'reaction', emoji: '🍆' })
    w.game.handleLocal({ t: 'reaction', emoji: '🎉' })
    expect(w.events).toEqual([
      { type: 'reaction', playerId: 'p-a', emoji: '🔥' },
      { type: 'reaction', playerId: 'p-a', emoji: '😂' },
      { type: 'reaction', playerId: 'p-host', emoji: '🎉' },
    ])
    expect(w.server.events('c1').filter((e) => e.type === 'reaction')).toHaveLength(3)
  })

  test('connections that never say hello are dropped', async () => {
    const w = world()
    w.server.connect('c-mute')
    await w.clock.advance(20_000)
    expect(w.server.isOpen('c-mute')).toBe(false)
  })
})

describe('settings', () => {
  test('clamped to SETTINGS_OPTIONS, playlist sanitized, lobby only', async () => {
    const w = world()
    w.game.updateSettings({
      rounds: 6,
      snippets: 100,
      roundTime: -5,
      finalTimer: Number.NaN,
      playlist: { id: 5, title: '  Rap   italiano ', picture: 'x.jpg', nbTracks: -1 } as PlaylistRef,
    })
    expect(w.game.state.settings).toEqual({
      rounds: 5,
      snippets: 16,
      roundTime: 60,
      finalTimer: 15,
      playlist: { id: 5, title: 'Rap italiano', picture: 'x.jpg', nbTracks: 0 },
    })
    const seq = w.game.state.seq
    w.game.updateSettings({ playlist: { id: -1 } as PlaylistRef })
    w.game.updateSettings({ rounds: 5 })
    expect(w.game.state.seq).toBe(seq)
    w.game.updateSettings({ playlist: null })
    expect(w.game.state.settings.playlist).toBeNull()
  })

  test('profile updates from clients and from the host UI', async () => {
    const w = world()
    hello(w, 'c1', 'p-a', 'Giulia')
    w.server.deliver('c1', { t: 'profile', profile: { id: 'hijack', name: 'Giuly', avatar: 3, color: 50 } })
    expect(player(w, 'p-a')).toMatchObject({ name: 'Giuly', avatar: 3, color: 11 })
    expect(player(w, 'hijack')).toBeUndefined()
    w.game.handleLocal({ t: 'profile', profile: { ...HOST, name: 'Tom' } })
    expect(player(w, 'p-host')!.name).toBe('Tom')
  })
})

describe('starting', () => {
  test('rejects without a playlist', async () => {
    const w = world()
    await expect(w.game.startGame()).rejects.toThrow(HOST_MESSAGES.noPlaylist)
    expect(w.game.state.phase.kind).toBe('lobby')
  })

  test('too few playable tracks → back to lobby with an Italian error', async () => {
    const w = world({ tracks: 4 })
    hello(w, 'c1', 'p-a')
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 5 })
    const phases: string[] = []
    w.game.subscribe((s) => phases.push(s.phase.kind))
    await expect(w.game.startGame()).rejects.toThrow(
      'Questa playlist non ha abbastanza brani con anteprima (servono almeno 5).',
    )
    expect(phases).toEqual(['preparing', 'lobby'])
    expect(w.game.state).toMatchObject({ phase: { kind: 'lobby' }, tracks: [], rounds: [] })
    // Clients learn why; the host UI gets the rejection instead of a duplicate toast.
    expect(lastEvent(w.server.events('c1'))).toMatchObject({ type: 'info' })
    expect(w.events.some((e) => e.type === 'info')).toBe(false)
  })

  test('double click on start: one game, same promise', async () => {
    const w = world()
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    const a = w.game.startGame()
    const b = w.game.startGame()
    expect(b).toBe(a)
    await a
    await w.clock.advance(0)
    expect(w.ctl.loads.filter((k) => k === 'track:1')).toHaveLength(1)
  })

  test('Deezer failure → rejects, lobby', async () => {
    const w = world()
    w.ctl.getPlaylistTracks = async () => {
      throw new Error('jsonp timeout')
    }
    w.game.updateSettings({ playlist: PLAYLIST })
    await expect(w.game.startGame()).rejects.toThrow(HOST_MESSAGES.playlistFailed)
    expect(w.game.state.phase.kind).toBe('lobby')
    await expect(w.game.startGame()).rejects.toThrow(HOST_MESSAGES.playlistFailed)
  })

  test('tracks broadcast first (prefetch), round 0 prepared with a valid board', async () => {
    const w = world()
    hello(w, 'c1', 'p-a')
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 12 })
    await w.game.startGame()
    const s = w.game.state
    expect(s.tracks.map((t) => t.id)).toEqual([1, 2, 3])
    expect(s.rounds).toEqual([null, null, null])
    expect(s.phase).toEqual({ kind: 'preparing', round: 0, message: HOST_MESSAGES.slicing })
    expect(w.server.lastState('c1')!.tracks).toHaveLength(3)

    await w.clock.advance(0)
    const round = w.game.state.rounds[0]!
    expect(round.index).toBe(0)
    expect(round.track.id).toBe(1)
    expect(round.segments).toHaveLength(12)
    expect(isContiguous(w.game.state, 0)).toBe(true)
    expect(round.bpm).toBe(123.5)
    expect(round.hues).toHaveLength(12)
    expect(scoreArrangement(round.initialOrder, 12).points).toBe(0)
    expect([...round.initialOrder].sort((a, b) => a - b)).toEqual(solved(12))
    expect(w.ctl.loads).toEqual(['track:1'])
    // Nobody else's ready yet → still waiting, then the ready timeout forces the intro.
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', message: HOST_MESSAGES.syncing })
    w.game.handleLocal({ t: 'ready', round: 0 })
    expect(w.game.state.phase.kind).toBe('preparing')
    await w.clock.advance(READY_TIMEOUT_MS)
    expect(w.game.state.phase).toEqual({ kind: 'intro', round: 0, endsAt: w.clock.now + INTRO_MS })
    await expect(w.game.startGame()).rejects.toThrow(HOST_MESSAGES.alreadyStarted)
  })

  test('ready messages that arrive while the round is still being cut are kept', async () => {
    const w = world()
    hello(w, 'c1', 'p-a')
    const load = deferred<AudioBuffer>()
    const realLoad = w.ctl.loadAudio
    w.ctl.loadAudio = (key, url, refresh) => (key === 'track:1' ? load.promise : realLoad(key, url, refresh))
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    readyAll(w, 0, ['c1'])
    expect(w.game.state.ready).toEqual({ 'p-host': true, 'p-a': true })
    load.resolve((await realLoad('track:1', '', async () => '')) as AudioBuffer)
    await w.clock.advance(0)
    expect(w.game.state.phase.kind).toBe('intro')
  })
})

describe('a full game', () => {
  test('3 rounds, 4 players: early submit pulls the timer in, time-out uses the last arrangement, disconnects never block', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cB', 'p-b', 'Marco')
    hello(w, 'cC', 'p-c', 'Sofi')
    const n = 8

    // ---- round 0 ----
    const p0 = await startAndPlay(w, ['cA', 'cB', 'cC'])
    expect(p0).toEqual({ kind: 'playing', round: 0, startedAt: w.clock.now, endsAt: w.clock.now + 90_000, firstSubmit: null })
    const start0 = w.clock.now
    // Round 1 is prepared in the background while round 0 plays.
    await w.clock.advance(0)
    expect(w.ctl.loads).toContain('track:2')
    expect(w.game.state.rounds[1]).toBeNull()

    const init0 = w.game.state.rounds[0]!.initialOrder
    const bArrangement = [0, 1, 2, 3, 4, 5, 7, 6]
    const cArrangement = [1, 0, 3, 2, 4, 5, 6, 7]
    w.server.deliver('cB', { t: 'arrange', round: 0, order: [...init0] })
    w.server.deliver('cB', { t: 'arrange', round: 0, order: bArrangement })
    w.server.deliver('cB', { t: 'arrange', round: 0, order: [0, 0, 1, 2, 3, 4, 5, 6] }) // invalid: ignored
    w.server.deliver('cC', { t: 'arrange', round: 0, order: cArrangement })
    w.server.deliver('cA', { t: 'submit', round: 1, order: solved(n) }) // wrong round: ignored
    expect(w.game.state.submissions).toEqual({})

    await w.clock.advance(20_000)
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(n) })
    const firstAt = w.clock.now
    expect(playing(w)).toMatchObject({ endsAt: firstAt + 15_000, firstSubmit: { playerId: 'p-a', at: firstAt } })
    expect(w.game.state.submissions['p-a']).toEqual({ submitted: true, atMs: 20_000 })
    expect(lastEvent(w.events)).toEqual({ type: 'first-submit', playerId: 'p-a', name: 'Giulia', endsAt: firstAt + 15_000 })
    // Phase changes are broadcast immediately, not coalesced.
    expect(w.server.lastState('cB')!.phase).toMatchObject({ firstSubmit: { playerId: 'p-a' } })
    // Double submit is ignored.
    w.server.deliver('cA', { t: 'submit', round: 0, order: init0 })
    expect(w.game.state.submissions['p-a'].atMs).toBe(20_000)

    await w.clock.advance(2_000)
    w.server.lose('cC')
    // A dropped link keeps the seat silently for a while (reload / network handover)…
    expect(player(w, 'p-c')!.connected).toBe(true)
    expect(w.events.some((e) => e.type === 'player-left')).toBe(false)
    expect(w.game.state.phase.kind).toBe('playing')

    await w.clock.advance(3_000)
    const hostOrder = solved(n)
    w.game.handleLocal({ t: 'submit', round: 0, order: hostOrder })
    expect(lastEvent(w.events)).toEqual({ type: 'submitted', playerId: 'p-host', name: 'Tommy' })
    expect(w.game.state.phase.kind).toBe('playing') // Marco is still arranging

    // …until the reconnect grace runs out: then she is shown as gone.
    await w.clock.advance(DISCONNECT_GRACE_MS - 3_000)
    expect(player(w, 'p-c')!.connected).toBe(false)
    expect(lastEvent(w.events)).toEqual({ type: 'player-left', playerId: 'p-c', name: 'Sofi' })

    await w.clock.advance(firstAt + 15_000 - w.clock.now)
    // The deadline passed: moves still in transit count for ARRIVAL_GRACE_MS more.
    expect(w.game.state.phase.kind).toBe('playing')
    await w.clock.advance(ARRIVAL_GRACE_MS - 1)
    expect(w.game.state.phase.kind).toBe('playing')
    await w.clock.advance(1)
    const reveal0 = w.game.state.phase
    expect(reveal0).toEqual({ kind: 'reveal', round: 0, nextAt: w.clock.now + REVEAL_AUTO_ADVANCE_MS })

    const res0 = w.game.state.results[0]
    // Same points → the faster confirm ranks first.
    expect(res0.map((r) => r.playerId)).toEqual(['p-a', 'p-host', 'p-b', 'p-c'])
    const byId = Object.fromEntries(res0.map((r) => [r.playerId, r]))
    expect(byId['p-a']).toMatchObject({ points: 5000, perfect: true, timeMs: 20_000, timedOut: false, order: solved(n) })
    expect(byId['p-host']).toMatchObject({ points: 5000, timeMs: 25_000, timedOut: false })
    expect(byId['p-b']).toMatchObject({ ...scoreArrangement(bArrangement, n), order: bArrangement, timeMs: 90_000, timedOut: true })
    expect(byId['p-c']).toMatchObject({ ...scoreArrangement(cArrangement, n), order: cArrangement, timedOut: true })
    expect(start0 + 90_000).toBeGreaterThan(w.clock.now)
    for (const r of res0) expect(player(w, r.playerId)!.score).toBe(r.points)

    // ---- round 1: auto-advance, instantly prepared; C (disconnected) doesn't block ready ----
    await w.clock.advance(REVEAL_AUTO_ADVANCE_MS)
    expect(w.game.state.phase).toEqual({ kind: 'preparing', round: 1, message: HOST_MESSAGES.syncing })
    expect(w.game.state.rounds[1]!.track.id).toBe(2)
    expect(w.game.state.ready).toEqual({})
    expect(w.game.state.submissions).toEqual({})
    w.server.deliver('cA', { t: 'ready', round: 0 }) // stale round: ignored
    readyAll(w, 1, ['cA', 'cB'])
    expect(w.game.state.phase.kind).toBe('intro')
    await w.clock.advance(INTRO_MS)
    playing(w)
    // Everyone connected submits → the round ends right away.
    await w.clock.advance(5_000)
    w.server.deliver('cA', { t: 'submit', round: 1, order: solved(n) })
    w.server.deliver('cB', { t: 'submit', round: 1, order: solved(n) })
    expect(w.game.state.phase.kind).toBe('playing')
    await w.clock.advance(1_000)
    w.game.handleLocal({ t: 'submit', round: 1, order: solved(n) })
    expect(w.game.state.phase).toMatchObject({ kind: 'reveal', round: 1 })
    const res1 = w.game.state.results[1]
    // Sofi was gone for the whole round: no result for her ("nessuna risposta"), not a 0.
    expect(res1.map((r) => r.playerId)).toEqual(['p-a', 'p-b', 'p-host'])
    expect(player(w, 'p-c')).toMatchObject({ connected: false, score: byId['p-c'].points })

    // C comes back during the reveal: re-attached with score, still active.
    hello(w, 'cC2', 'p-c', 'Sofi')
    expect(player(w, 'p-c')).toMatchObject({ connected: true, activeFromRound: 0, score: byId['p-c'].points })

    // ---- round 2: host skips the countdown; C never reports ready → timeout ----
    w.game.nextRound()
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', round: 2 })
    readyAll(w, 2, ['cA', 'cB'])
    expect(w.game.state.phase.kind).toBe('preparing')
    await w.clock.advance(READY_TIMEOUT_MS)
    expect(w.game.state.phase.kind).toBe('intro')
    await w.clock.advance(INTRO_MS)
    for (const c of ['cA', 'cB', 'cC2']) w.server.deliver(c, { t: 'submit', round: 2, order: solved(n) })
    expect(w.game.state.phase.kind).toBe('playing')
    w.game.handleLocal({ t: 'submit', round: 2, order: solved(n) })
    expect(w.game.state.phase).toMatchObject({ kind: 'reveal', round: 2 })
    w.game.nextRound()
    expect(w.game.state.phase).toEqual({ kind: 'final' })
    expect(w.game.state.results).toHaveLength(3)
    for (const p of w.game.state.players) {
      const total = w.game.state.results.flat().filter((r) => r.playerId === p.id).reduce((sum, r) => sum + r.points, 0)
      expect(p.score).toBe(total)
    }
    // Nothing left ticking.
    const seq = w.game.state.seq
    await w.clock.advance(120_000)
    expect(w.game.state.phase.kind).toBe('final')
    expect(w.game.state.seq).toBe(seq)

    // Emitted states: seq strictly increasing, all frozen (never mutated afterwards).
    for (let i = 1; i < w.states.length; i++) expect(w.states[i].seq).toBeGreaterThan(w.states[i - 1].seq)
    expect(w.states[w.states.length - 1]).toBe(w.game.state)
  })

  test('a player refreshing right when the game starts keeps their seat and plays round 0', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    w.server.lose('cB')
    await startAndPlay(w, ['cA'])
    expect(player(w, 'p-b')).toMatchObject({ connected: false, activeFromRound: 0 })
    await w.clock.advance(DISCONNECT_GRACE_MS - INTRO_MS - 1000)
    expect(player(w, 'p-b')).toBeDefined()
    hello(w, 'cB2', 'p-b')
    expect(player(w, 'p-b')).toMatchObject({ connected: true, activeFromRound: 0 })
    await w.clock.advance(LOBBY_GRACE_MS * 2)
    expect(player(w, 'p-b')).toMatchObject({ connected: true })
    w.server.deliver('cB2', { t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.submissions['p-b']).toMatchObject({ submitted: true })
  })

  test('a player gone when the game starts and never back leaves the room (no 0-point ghost)', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cG', 'p-ghost', 'Fantasma')
    w.server.lose('cG')
    await startAndPlay(w, ['cA'])
    // The ready wait never waited for the ghost.
    expect(player(w, 'p-ghost')).toMatchObject({ connected: false })
    await w.clock.advance(DISCONNECT_GRACE_MS)
    expect(player(w, 'p-ghost')).toBeUndefined()
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.results[0].map((r) => r.playerId).sort()).toEqual(['p-a', 'p-host'])
    // Coming back later = a late joiner.
    hello(w, 'cG2', 'p-ghost', 'Fantasma')
    expect(player(w, 'p-ghost')).toMatchObject({ connected: true, activeFromRound: 1, score: 0 })
  })

  test('an undetected ghost (tab closed right before the start) is not scored and then removed', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cG', 'p-ghost', 'Fantasma')
    // The host has not noticed yet: the ghost still looks connected when the game starts.
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 8, roundTime: 60, finalTimer: 10 })
    await w.game.startGame()
    await w.clock.advance(0)
    readyAll(w, 0, ['cA'])
    expect(w.game.state.phase.kind).toBe('preparing') // still waiting for the ghost's audio…
    w.server.lose('cG') // …heartbeat timeout: the link is gone, the ready wait stops waiting
    expect(w.game.state.phase.kind).toBe('intro')
    await w.clock.advance(INTRO_MS)
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    // Everyone else confirmed; the ghost's seat is held until the final timer runs out.
    expect(w.game.state.phase.kind).toBe('playing')
    await w.clock.advance(10_000 + ARRIVAL_GRACE_MS)
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].map((r) => r.playerId).sort()).toEqual(['p-a', 'p-host'])
    await w.clock.advance(DISCONNECT_GRACE_MS)
    expect(player(w, 'p-ghost')).toBeUndefined()
    expect(w.events.filter((e) => e.type === 'player-left').map((e) => (e as { name: string }).name)).toEqual(['Fantasma'])
  })

  test('solo: the only confirm ends the round immediately (no first-submit banner)', async () => {
    const w = world()
    await startAndPlay(w, [])
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.events.filter((e) => e.type === 'first-submit')).toHaveLength(0)
    expect(lastEvent(w.events)).toMatchObject({ type: 'submitted', playerId: 'p-host' })
  })

  test('an untouched-board confirm does not start the final timer; the next real one does', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cB', 'p-b', 'Marco')
    const p0 = await startAndPlay(w, ['cA', 'cB'])
    const init0 = w.game.state.rounds[0]!.initialOrder
    await w.clock.advance(5_000)
    w.server.deliver('cA', { t: 'submit', round: 0, order: [...init0] })
    expect(w.game.state.submissions['p-a']).toEqual({ submitted: true, atMs: 5_000 })
    expect(playing(w)).toMatchObject({ endsAt: p0.kind === 'playing' ? p0.endsAt : -1, firstSubmit: null })
    expect(w.events.some((e) => e.type === 'first-submit')).toBe(false)
    expect(lastEvent(w.events)).toMatchObject({ type: 'submitted', playerId: 'p-a' })

    await w.clock.advance(5_000)
    w.server.deliver('cB', { t: 'submit', round: 0, order: solved(8) })
    const at = w.clock.now
    expect(playing(w)).toMatchObject({ endsAt: at + 15_000, firstSubmit: { playerId: 'p-b', at } })
    expect(lastEvent(w.events)).toMatchObject({ type: 'first-submit', playerId: 'p-b' })
  })

  test('in-game leave keeps the player (disconnected) and unblocks the round at once', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    await startAndPlay(w, ['cA', 'cB'])
    const moved = [1, 0, 2, 3, 4, 5, 6, 7]
    w.server.deliver('cA', { t: 'arrange', round: 0, order: moved })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('playing')
    // B leaves without having touched anything: nothing to keep, the seat goes.
    w.server.deliver('cB', { t: 'leave' })
    expect(player(w, 'p-b')).toBeUndefined()
    expect(w.game.state.phase.kind).toBe('playing')
    // A leaves after playing: kept (disconnected) and scored with the last arrangement.
    w.server.deliver('cA', { t: 'leave' })
    expect(player(w, 'p-a')).toMatchObject({ connected: false })
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].find((r) => r.playerId === 'p-a')).toMatchObject({ order: moved, timedOut: true })
  })

  test('final timer never extends the round', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    const p = await startAndPlay(w, ['cA'])
    await w.clock.advance(80_000)
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    expect(playing(w).endsAt).toBe(p.endsAt)
    await w.clock.advance(p.endsAt + ARRIVAL_GRACE_MS - w.clock.now)
    expect(w.game.state.phase.kind).toBe('reveal')
  })
})

describe('preparation failures', () => {
  test('load / analysis failures swap in spare tracks', async () => {
    const w = world()
    hello(w, 'c1', 'p-a')
    w.ctl.failLoad.add(1)
    w.ctl.failAnalysis.add(4)
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    await w.clock.advance(0)
    const s = w.game.state
    expect(s.tracks.map((t) => t.id)).toEqual([5, 2, 3])
    expect(s.rounds[0]!.track.id).toBe(5)
    expect(w.ctl.loads.slice(0, 3)).toEqual(['track:1', 'track:4', 'track:5'])
    expect(w.server.lastState('c1')!.tracks[0].id).toBe(5)
    expect(isContiguous(s, 0)).toBe(true)
  })

  test('invalid cut plans count as failures; last resort is an equal cut of audio that decoded', async () => {
    const w = world()
    const real = w.ctl.analyzeAndCut
    w.ctl.analyzeAndCut = async (buffer, n) => {
      const plan = await real(buffer, n)
      return { ...plan, segments: plan.segments.slice(1) } // n − 1 segments: invalid
    }
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 6 })
    await w.game.startGame()
    await w.clock.advance(0)
    const round = w.game.state.rounds[0]!
    expect(w.ctl.analyses).toEqual([1, 4, 5, 6])
    expect(round.track.id).toBe(1)
    expect(w.game.state.tracks[0].id).toBe(1)
    expect(round.bpm).toBe(0)
    expect(round.segments.map((s) => s.end - s.start).every((d) => Math.abs(d - 5) < 1e-9)).toBe(true)
    expect(isContiguous(w.game.state, 0)).toBe(true)
  })

  test('every track fails → back to the lobby with an info event', async () => {
    const w = world()
    hello(w, 'c1', 'p-a')
    for (let id = 1; id <= 20; id++) w.ctl.failLoad.add(id)
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    await w.clock.advance(0)
    expect(w.game.state).toMatchObject({ phase: { kind: 'lobby' }, tracks: [], rounds: [] })
    expect(lastEvent(w.events)).toEqual({ type: 'info', message: HOST_MESSAGES.prepareFailed })
    expect(lastEvent(w.server.events('c1'))).toEqual({ type: 'info', message: HOST_MESSAGES.prepareFailed })
    expect(player(w, 'p-a')!.connected).toBe(true)
  })

  test('a hung download times out and falls back to a spare', async () => {
    const w = world()
    const real = w.ctl.loadAudio
    w.ctl.loadAudio = (key, url, refresh) => (key === 'track:1' ? new Promise<AudioBuffer>(() => {}) : real(key, url, refresh))
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    await w.clock.advance(60_000)
    expect(w.game.state.rounds[0]!.track.id).toBe(4)
  })

  test('a background failure of the next round is retried when it is needed', async () => {
    const w = world()
    // Track 2 and the spares fail in the background (2 → 4 → 5 → 6, max 3 swaps); the network
    // "comes back" for the foreground retry, which retries the current track first.
    for (const id of [2, 4, 5, 6, 7]) w.ctl.failLoad.add(id)
    await startAndPlay(w, [])
    await w.clock.advance(0)
    w.ctl.failLoad.clear()
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    w.game.nextRound()
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', round: 1, message: HOST_MESSAGES.slicing })
    await w.clock.advance(0)
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', round: 1, message: HOST_MESSAGES.syncing })
    expect(w.game.state.rounds[1]!.track.id).toBe(6)
    expect(w.game.state.tracks.map((t) => t.id)).toEqual([1, 6, 3])
  })
})

describe('late joiners, kicks, lobby resets', () => {
  test('late joiner spectates until the next round', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    await startAndPlay(w, ['cA'])
    hello(w, 'cD', 'p-d', 'Dario')
    expect(player(w, 'p-d')).toMatchObject({ activeFromRound: 1, connected: true, score: 0 })
    expect(lastEvent(w.events)).toMatchObject({ type: 'player-joined', playerId: 'p-d' })
    w.server.deliver('cD', { t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.submissions['p-d']).toBeUndefined()
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].map((r) => r.playerId).sort()).toEqual(['p-a', 'p-host'])

    w.game.nextRound()
    readyAll(w, 1, ['cA'])
    expect(w.game.state.phase.kind).toBe('preparing') // waits for Dario too now
    w.server.deliver('cD', { t: 'ready', round: 1 })
    expect(w.game.state.phase.kind).toBe('intro')

    // Joining while a round is being prepared → plays that round.
    await w.clock.advance(INTRO_MS)
    for (const c of ['cA', 'cD']) w.server.deliver(c, { t: 'submit', round: 1, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 1, order: solved(8) })
    expect(w.game.state.results[1].map((r) => r.playerId).sort()).toEqual(['p-a', 'p-d', 'p-host'])
    w.game.nextRound()
    hello(w, 'cE', 'p-e')
    expect(player(w, 'p-e')!.activeFromRound).toBe(2)
  })

  test('kick: reject + drop + remove + event; kicked players cannot rejoin; host cannot be kicked', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cB', 'p-b', 'Marco')
    w.server.clear()
    w.game.kick('p-a')
    expect(w.server.box('cA')).toEqual([{ t: 'reject', reason: 'kicked' }])
    expect(w.server.isOpen('cA')).toBe(false)
    expect(player(w, 'p-a')).toBeUndefined()
    expect(lastEvent(w.events)).toEqual({ type: 'kicked', playerId: 'p-a' })
    expect(w.server.events('cB')).toContainEqual({ type: 'kicked', playerId: 'p-a' })
    expect(w.events.some((e) => e.type === 'player-left')).toBe(false)

    hello(w, 'cA2', 'p-a', 'Giulia')
    expect(w.server.box('cA2')).toEqual([{ t: 'reject', reason: 'kicked' }])
    expect(player(w, 'p-a')).toBeUndefined()

    w.game.kick('p-host')
    w.game.kick('nobody')
    expect(player(w, 'p-host')).toBeDefined()
  })

  test('kicking the last player still arranging ends the round', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    await startAndPlay(w, ['cA', 'cB'])
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    w.game.kick('p-b')
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].map((r) => r.playerId).sort()).toEqual(['p-a', 'p-host'])
  })

  test('backToLobby resets the game and removes disconnected players', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    await startAndPlay(w, ['cA', 'cB'])
    w.server.deliver('cB', { t: 'arrange', round: 0, order: [1, 0, 2, 3, 4, 5, 6, 7] })
    w.server.lose('cB')
    for (const c of ['cA']) w.server.deliver(c, { t: 'submit', round: 0, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('playing') // B's seat is held while B may reconnect
    await w.clock.advance(DISCONNECT_GRACE_MS)
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(player(w, 'p-b')).toMatchObject({ connected: false })
    expect(player(w, 'p-a')!.score).toBe(5000)
    hello(w, 'cD', 'p-d')
    expect(player(w, 'p-d')!.activeFromRound).toBe(1)

    w.game.backToLobby()
    const s = w.game.state
    expect(s).toMatchObject({ phase: { kind: 'lobby' }, tracks: [], rounds: [], results: [], submissions: {}, ready: {} })
    expect(s.players.map((p) => [p.id, p.score, p.activeFromRound])).toEqual([
      ['p-host', 0, 0],
      ['p-a', 0, 0],
      ['p-d', 0, 0],
    ])
    expect(s.settings.playlist).toEqual(PLAYLIST)
    // No leftover timers fire (reveal auto-advance, background prep…).
    await w.clock.advance(REVEAL_AUTO_ADVANCE_MS * 2)
    expect(w.game.state.phase.kind).toBe('lobby')
    expect(w.game.state.rounds).toEqual([])

    // And a new game starts cleanly.
    await startAndPlay(w, ['cA', 'cD'])
    expect(w.game.state.tracks.map((t) => t.id)).toEqual([1, 2, 3])
  })
})

describe('stale async continuations', () => {
  test('backToLobby while picking tracks', async () => {
    const w = world()
    const tracks = deferred<ReturnType<typeof makeTracks>>()
    w.ctl.getPlaylistTracks = () => tracks.promise
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    const started = w.game.startGame()
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', message: HOST_MESSAGES.picking })
    w.game.backToLobby()
    tracks.resolve(makeTracks(20))
    await started
    await w.clock.advance(60_000)
    expect(w.game.state).toMatchObject({ phase: { kind: 'lobby' }, tracks: [], rounds: [] })
    expect(w.ctl.loads).toEqual([])
  })

  test('backToLobby while cutting round 0, then a new game: the old download cannot leak in', async () => {
    const w = world()
    const slow = deferred<AudioBuffer>()
    const real = w.ctl.loadAudio
    let first = true
    w.ctl.loadAudio = (key, url, refresh) => {
      if (first) {
        first = false
        w.ctl.loads.push(key)
        return slow.promise
      }
      return real(key, url, refresh)
    }
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', message: HOST_MESSAGES.slicing })
    w.game.backToLobby()
    expect(w.game.state.phase.kind).toBe('lobby')

    w.ctl.tracks = makeTracks(20, 100)
    await w.game.startGame()
    await w.clock.advance(0)
    expect(w.game.state.rounds[0]!.track.id).toBe(100)
    const seq = w.game.state.seq
    slow.resolve((await real('track:1', '', async () => '')) as AudioBuffer)
    await w.clock.advance(0)
    expect(w.game.state.seq).toBe(seq)
    expect(w.game.state.tracks[0].id).toBe(100)
    expect(w.game.state.rounds[0]!.track.id).toBe(100)
  })

  test('destroy: closes the room, stops every timer, ignores later messages', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    await startAndPlay(w, ['cA'])
    w.game.destroy()
    expect(w.server.broadcasts).toContainEqual({ t: 'reject', reason: 'closed' })
    expect(w.server.closed).toBe(true)
    expect(w.server.listenerCount).toBe(0)
    const seq = w.game.state.seq
    await w.clock.advance(200_000)
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    w.game.nextRound()
    w.game.backToLobby()
    expect(w.game.state.seq).toBe(seq)
    expect(w.clock.pending).toBe(0)
    await expect(w.game.startGame()).rejects.toThrow(HOST_MESSAGES.closed)
  })
})

describe('publication', () => {
  test('state broadcasts are coalesced (≤ 20/s); phase changes go out synchronously', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    await w.clock.advance(1000)
    w.server.clear()
    const before = w.states.length
    for (let i = 0; i < 10; i++) w.game.handleLocal({ t: 'profile', profile: { ...HOST, name: `Tommy ${i}` } })
    expect(w.states.length).toBe(before) // nothing synchronous
    await w.clock.advance(0)
    expect(w.states.length).toBe(before + 1)
    expect(w.server.of('cA', 'state')).toHaveLength(1)
    expect(w.server.lastState('cA')!.players[0].name).toBe('Tommy 9')

    // Burst for one second: at most one broadcast per 50 ms.
    for (let t = 0; t < 1000; t += 10) {
      w.game.handleLocal({ t: 'profile', profile: { ...HOST, avatar: (t / 10) % 20 } })
      await w.clock.advance(10)
    }
    expect(w.server.of('cA', 'state').length).toBeLessThanOrEqual(21)
    expect(w.server.of('cA', 'state').length).toBeGreaterThanOrEqual(15)

    w.game.updateSettings({ playlist: PLAYLIST })
    const pending = w.game.startGame()
    // preparing is visible immediately to subscribers and clients.
    expect(w.states[w.states.length - 1].phase.kind).toBe('preparing')
    expect(w.server.lastState('cA')!.phase.kind).toBe('preparing')
    await pending
  })

  test('a host UI that reacts synchronously to states never makes clients see states out of order', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    const readied = new Set<number>()
    // Like the real store: send `ready` as soon as the round is public, from inside the listener.
    w.game.subscribe((s) => {
      if (s.phase.kind === 'preparing' && s.rounds[s.phase.round] && !readied.has(s.phase.round)) {
        readied.add(s.phase.round)
        w.game.handleLocal({ t: 'ready', round: s.phase.round })
        w.server.deliver('cA', { t: 'ready', round: s.phase.round })
      }
    })
    // …and confirm right after someone else did (a phase change nested inside a flush).
    w.game.subscribe((s) => {
      if (s.phase.kind === 'playing' && s.phase.firstSubmit && !s.submissions['p-host']) {
        w.game.handleLocal({ t: 'submit', round: s.phase.round, order: solved(8) })
      }
    })
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    await w.clock.advance(0)
    expect(w.game.state.phase.kind).toBe('intro')
    await w.clock.advance(INTRO_MS + 1000)
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    await w.clock.advance(0)
    const seqs = w.server.of('cA', 'state').map((m) => m.state.seq)
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
    expect(w.server.lastState('cA')).toEqual(JSON.parse(JSON.stringify(w.game.state)))
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.server.lastState('cA')!.phase.kind).toBe('reveal')
    for (let i = 1; i < w.states.length; i++) expect(w.states[i].seq).toBeGreaterThan(w.states[i - 1].seq)
    // The round ended at once, so nobody gets a "15s!" banner.
    expect(w.server.events('cA').some((e) => e.type === 'first-submit')).toBe(false)
  })

  test('events caused by an event listener reach clients after their cause', async () => {
    const w = world()
    w.game.onEvent((e) => {
      if (e.type === 'player-joined') w.game.handleLocal({ t: 'reaction', emoji: '👏' })
    })
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    expect(w.server.events('cA').map((e) => e.type)).toEqual(['player-joined', 'reaction', 'player-joined'])
  })

  test('host events are delivered to the host UI and to every welcomed client', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    w.server.connect('c-anon')
    hello(w, 'cB', 'p-b')
    const aEvents = w.server.events('cA')
    expect(aEvents).toContainEqual({ type: 'player-joined', playerId: 'p-b', name: 'p-b' })
    expect(w.server.box('c-anon')).toEqual([])
  })
})

describe('host refresh recovery', () => {
  test('snapshot → restore mid-round keeps confirmed answers, re-arms the timer, players re-attach', async () => {
    const storage = new MemoryStorage()
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = storage
    const clock = new FakeClock()
    const w = world({ clock })
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cB', 'p-b', 'Marco')
    const p = await startAndPlay(w, ['cA', 'cB'])
    await clock.advance(10_000)
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    const bOrder = [0, 1, 2, 3, 4, 5, 7, 6]
    w.server.deliver('cB', { t: 'arrange', round: 0, order: bOrder })
    await clock.advance(1_000)

    const snapshot = loadHostSnapshot('KXQPM', undefined, clock.now)
    expect(snapshot).not.toBeNull()
    expect(snapshot!.phase).toMatchObject({ kind: 'playing', round: 0, firstSubmit: { playerId: 'p-a' } })

    // "Refresh": the old instance is gone without a goodbye; a new one resumes from the snapshot.
    const server2 = new FakeHostServer('KXQPM')
    const w2 = world({ clock, server: server2, restore: snapshot })
    expect(w2.game.state.seq).toBeGreaterThan(snapshot!.seq)
    expect(w2.game.state.players.map((pl) => [pl.id, pl.connected])).toEqual([
      ['p-host', true],
      ['p-a', false],
      ['p-b', false],
    ])
    expect(w2.game.state.phase).toEqual(snapshot!.phase)

    hello(w2, 'cA2', 'p-a', 'Giulia')
    expect(server2.of('cA2', 'welcome')[0].state.phase.kind).toBe('playing')
    expect(w2.game.state.players.find((pl) => pl.id === 'p-a')!.connected).toBe(true)
    // Marco hasn't reconnected yet but still blocks the early end for a moment.
    w2.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w2.game.state.phase.kind).toBe('playing')

    const phase = w2.game.state.phase
    if (phase.kind !== 'playing') throw new Error('expected playing')
    expect(phase.endsAt).toBeLessThan(p.endsAt)
    await clock.advance(phase.endsAt - clock.now)
    expect(w2.game.state.phase.kind).toBe('reveal')
    const res = Object.fromEntries(w2.game.state.results[0].map((r) => [r.playerId, r]))
    expect(res['p-a']).toMatchObject({ points: 5000, timedOut: false, timeMs: 10_000 })
    expect(res['p-b']).toMatchObject({ order: bOrder, timedOut: true, points: scoreArrangement(bOrder, 8).points })
    expect(RESTORE_GRACE_MS).toBeGreaterThan(0)
    w.game.destroy()
  })

  test('restore in the lobby: players get the normal grace period', async () => {
    const storage = new MemoryStorage()
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = storage
    const clock = new FakeClock()
    const w = world({ clock })
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 7 })
    await clock.advance(1_000)
    const snapshot = loadHostSnapshot('KXQPM', undefined, clock.now)!
    const w2 = world({ clock, server: new FakeHostServer('KXQPM'), restore: snapshot })
    expect(w2.game.state.settings).toMatchObject({ rounds: 7, playlist: PLAYLIST })
    hello(w2, 'cA2', 'p-a')
    await clock.advance(LOBBY_GRACE_MS + 1)
    expect(w2.game.state.players.map((pl) => pl.id)).toEqual(['p-host', 'p-a'])
  })

  test('restore while preparing restarts the preparation', async () => {
    const storage = new MemoryStorage()
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = storage
    const clock = new FakeClock()
    const w = world({ clock })
    const hang = deferred<AudioBuffer>()
    w.ctl.loadAudio = () => hang.promise
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w.game.startGame()
    await clock.advance(1_000)
    const snapshot = loadHostSnapshot('KXQPM', undefined, clock.now)!
    expect(snapshot.phase).toMatchObject({ kind: 'preparing', round: 0 })
    w.game.destroy()
    const w2 = world({ clock, server: new FakeHostServer('KXQPM'), restore: snapshot })
    await clock.advance(0)
    expect(w2.game.state.rounds[0]!.track.id).toBe(1)
    expect(w2.game.state.phase).toMatchObject({ kind: 'preparing', round: 0, message: HOST_MESSAGES.syncing })
    w2.game.handleLocal({ t: 'ready', round: 0 })
    expect(w2.game.state.phase.kind).toBe('intro')
  })

  test('snapshots are written (throttled) and removed on destroy', async () => {
    const storage = new MemoryStorage()
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = storage
    const w = world()
    hello(w, 'cA', 'p-a')
    await w.clock.advance(1_000)
    const raw = JSON.parse(storage.getItem('unshuffle:host:KXQPM')!) as { v: number; savedAt: number; state: RoomState }
    expect(raw.v).toBe(1)
    expect(raw.state.players).toHaveLength(2)
    w.game.destroy()
    expect(storage.getItem('unshuffle:host:KXQPM')).toBeNull()
  })

  test('messages from the host UI that make no sense are ignored safely', async () => {
    const w = world()
    const junk = [
      { t: 'submit', round: 0, order: [0] },
      { t: 'arrange', round: 'x', order: null },
      { t: 'ready', round: 99 },
      { t: 'nope' },
      null,
    ] as unknown as HostMsg[]
    for (const m of junk) w.game.handleLocal(m as never)
    w.server.connect('c1')
    for (const m of junk) w.server.deliver('c1', m as never)
    expect(w.game.state.phase.kind).toBe('lobby')
  })
})

const SECRET_A = 'a'.repeat(32)
const SECRET_B = 'b'.repeat(32)

function helloWith(w: World, connId: string, id: string, secret: string | undefined, name = id): void {
  w.server.connect(connId)
  w.server.deliver(connId, { t: 'hello', profile: profile(id, name), version: PROTOCOL_VERSION, ...(secret ? { secret } : {}) } as never)
}

function rejectOf(w: World, connId: string) {
  return w.server.dropped.find((d) => d.connId === connId)?.finalMsg
}

describe('round deadline: moves in transit, late timers', () => {
  test('a drop that arrives just after the deadline still counts; after the grace nothing does', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    const p = await startAndPlay(w, ['cA', 'cB'], { roundTime: 60 })
    await w.clock.advance(p.endsAt - w.clock.now)
    expect(w.game.state.phase.kind).toBe('playing')
    // Sent ~100 ms before time's up, arrives 150 ms after it.
    const last = [0, 1, 2, 3, 4, 5, 7, 6]
    await w.clock.advance(150)
    w.server.deliver('cA', { t: 'arrange', round: 0, order: last })
    // A confirm in transit too: accepted, timed at the deadline, and no "final timer" for it.
    w.server.deliver('cB', { t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.submissions['p-b']).toEqual({ submitted: true, atMs: 60_000 })
    expect(playing(w).firstSubmit).toBeNull()
    expect(w.events.some((e) => e.type === 'first-submit')).toBe(false)
    await w.clock.advance(ARRIVAL_GRACE_MS - 150)
    expect(w.game.state.phase.kind).toBe('reveal')
    const res = Object.fromEntries(w.game.state.results[0].map((r) => [r.playerId, r]))
    expect(res['p-a']).toMatchObject({ order: last, timedOut: true, points: scoreArrangement(last, 8).points })
    expect(res['p-b']).toMatchObject({ perfect: true, timedOut: false })
    // Anything later is ignored.
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.results[0].find((r) => r.playerId === 'p-a')!.timedOut).toBe(true)
  })

  test('a late phase timer (throttled host tab) never lets a message land in a phase that should be over', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    const p = await startAndPlay(w, ['cA'])
    // The wall clock passes the deadline but the timer has not fired yet.
    w.clock.now = p.endsAt + ARRIVAL_GRACE_MS + 500
    w.server.deliver('cA', { t: 'arrange', round: 0, order: solved(8) })
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    // The pending step ran first: the round is over and scored without those moves.
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].find((r) => r.playerId === 'p-a')).toMatchObject({ timedOut: true, points: 0 })
    const reveal = w.game.state.phase
    if (reveal.kind !== 'reveal') throw new Error('expected reveal')
    // Same for the reveal countdown: a ping after nextAt starts the next round.
    w.clock.now = reveal.nextAt! + 10
    w.server.deliver('cA', { t: 'ping', c: 1 })
    expect(w.game.state.phase).toMatchObject({ kind: 'preparing', round: 1 })
  })

  test('the first confirm after the clock ran out does not start a final timer', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    const p = await startAndPlay(w, ['cA'], { roundTime: 60, finalTimer: 10 })
    w.clock.now = p.endsAt + 100 // inside the arrival grace, timer not fired yet
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    const after = playing(w)
    expect(after.firstSubmit).toBeNull()
    expect(after.endsAt).toBe(p.endsAt)
    expect(lastEvent(w.events)).toMatchObject({ type: 'submitted', playerId: 'p-host' })
    await w.clock.advance(ARRIVAL_GRACE_MS)
    expect(w.game.state.phase.kind).toBe('reveal')
  })
})

describe('reconnect grace in game', () => {
  test('a link blip of the last player still arranging does not end the round; they come back and confirm', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    await startAndPlay(w, ['cA'])
    await w.clock.advance(10_000)
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) }) // host first → 15 s final timer
    w.server.lose('cA')
    expect(w.game.state.phase.kind).toBe('playing')
    expect(player(w, 'p-a')!.connected).toBe(true)
    await w.clock.advance(1_000)
    hello(w, 'cA2', 'p-a', 'Giulia')
    expect(w.game.state.phase.kind).toBe('playing')
    const mine = [0, 1, 2, 3, 4, 5, 7, 6]
    w.server.deliver('cA2', { t: 'submit', round: 0, order: mine })
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].find((r) => r.playerId === 'p-a')).toMatchObject({ order: mine, timedOut: false })
    // Nobody was told she left.
    expect(w.events.some((e) => e.type === 'player-left')).toBe(false)
  })

  test('the seat is held at most until the round clock runs out, and a kick is immediate', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    await startAndPlay(w, ['cA', 'cB'], { roundTime: 60, finalTimer: 10 })
    w.server.deliver('cA', { t: 'arrange', round: 0, order: [1, 0, 2, 3, 4, 5, 6, 7] })
    w.server.lose('cA')
    w.server.deliver('cB', { t: 'submit', round: 0, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('playing')
    await w.clock.advance(10_000 + ARRIVAL_GRACE_MS) // final timer < DISCONNECT_GRACE_MS
    expect(w.game.state.phase.kind).toBe('reveal')
    expect(w.game.state.results[0].find((r) => r.playerId === 'p-a')).toMatchObject({ timedOut: true })

    w.game.nextRound()
    readyAll(w, 1, ['cB'])
    await w.clock.advance(INTRO_MS)
    hello(w, 'cA2', 'p-a')
    w.server.lose('cA2')
    w.server.deliver('cB', { t: 'submit', round: 1, order: solved(8) })
    w.game.handleLocal({ t: 'submit', round: 1, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('playing')
    w.game.kick('p-a')
    expect(w.game.state.phase.kind).toBe('reveal')
  })

  test('Rigioca while a dropped link is still in its grace: that player counts as gone', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    await startAndPlay(w, ['cA', 'cB'], { rounds: 3 })
    w.server.deliver('cB', { t: 'arrange', round: 0, order: [1, 0, 2, 3, 4, 5, 6, 7] })
    w.server.lose('cB')
    expect(player(w, 'p-b')!.connected).toBe(true)
    w.game.backToLobby()
    expect(w.game.state.players.map((p) => p.id)).toEqual(['p-host', 'p-a'])
    // Nothing fires later on behalf of the old game.
    const seq = w.game.state.seq
    await w.clock.advance(DISCONNECT_GRACE_MS * 2)
    expect(w.game.state.seq).toBe(seq)
  })
})

describe('identity: seats cannot be taken with a copied player id', () => {
  test('without the owner’s secret a known id is refused (the owner keeps playing); the same secret may take the seat back', async () => {
    const w = world()
    helloWith(w, 'cA', 'p-a', SECRET_A, 'Giulia')
    helloWith(w, 'cM', 'p-m', SECRET_B, 'Mallory')
    await startAndPlay(w, ['cA', 'cM'])
    // Mallory copies Giulia's public id, without or with a wrong secret.
    w.server.deliver('cM', { t: 'hello', profile: profile('p-a', 'Giulia'), version: PROTOCOL_VERSION } as never)
    expect(rejectOf(w, 'cM')).toEqual({ t: 'reject', reason: 'version' }) // a connection can't switch identity
    helloWith(w, 'cM2', 'p-a', undefined, 'Giulia')
    expect(rejectOf(w, 'cM2')).toEqual({ t: 'reject', reason: 'duplicate' })
    helloWith(w, 'cM3', 'p-a', SECRET_B, 'Giulia')
    expect(rejectOf(w, 'cM3')).toEqual({ t: 'reject', reason: 'duplicate' })
    expect(w.server.isOpen('cA')).toBe(true)
    w.server.deliver('cA', { t: 'submit', round: 0, order: [7, 6, 5, 4, 3, 2, 1, 0] })
    expect(w.game.state.submissions['p-a']).toMatchObject({ submitted: true })

    // Giulia's second tab (same browser → same secret) takes the seat over.
    helloWith(w, 'cA2', 'p-a', SECRET_A, 'Giulia')
    expect(rejectOf(w, 'cA')).toEqual({ t: 'reject', reason: 'duplicate' })
    expect(w.server.of('cA2', 'welcome')[0].you).toBe('p-a')
  })

  test('seats that never had a secret (older clients) keep the old behaviour; the first secret claims them', async () => {
    const w = world()
    helloWith(w, 'cA', 'p-a', undefined)
    w.server.lose('cA')
    helloWith(w, 'cA2', 'p-a', undefined)
    expect(player(w, 'p-a')!.connected).toBe(true)
    helloWith(w, 'cA3', 'p-a', SECRET_A)
    expect(w.server.of('cA3', 'welcome')).toHaveLength(1)
    helloWith(w, 'cA4', 'p-a', undefined)
    expect(rejectOf(w, 'cA4')).toEqual({ t: 'reject', reason: 'duplicate' })
  })

  test('secrets survive a host refresh (snapshot), never reach any client', async () => {
    const storage = new MemoryStorage()
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = storage
    const clock = new FakeClock()
    const w = world({ clock })
    helloWith(w, 'cA', 'p-a', SECRET_A)
    await startAndPlay(w, ['cA'])
    await clock.advance(1_000)
    for (const m of w.server.box('cA')) expect(JSON.stringify(m)).not.toContain(SECRET_A)
    const snapshot = loadHostSnapshot('KXQPM', undefined, clock.now)!
    expect(JSON.stringify(snapshot)).not.toContain(SECRET_A) // the public part
    const w2 = world({ clock, server: new FakeHostServer('KXQPM'), restore: snapshot })
    helloWith(w2, 'cM', 'p-a', SECRET_B)
    expect(w2.server.dropped.find((d) => d.connId === 'cM')?.finalMsg).toEqual({ t: 'reject', reason: 'duplicate' })
    helloWith(w2, 'cA2', 'p-a', SECRET_A)
    expect(w2.game.state.players.find((p) => p.id === 'p-a')!.connected).toBe(true)
    w.game.destroy()
    w2.game.destroy()
  })

  test('player ids are taken as they are: padded ids and Object.prototype names are refused', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cPad', ' p-a')
    expect(w.server.box('cPad')).toEqual([{ t: 'reject', reason: 'version' }])
    for (const id of ['toString', '__proto__', 'constructor', 'has space', 'x'.repeat(65)]) {
      hello(w, `c-${id.length}-${id.slice(0, 3)}`, id)
    }
    expect(w.game.state.players.map((p) => p.id)).toEqual(['p-host', 'p-a'])
  })
})

describe('hello abuse', () => {
  test('a connection cannot switch identity (no ghost flood); re-hello with the same id is a coalesced profile update', async () => {
    const w = world()
    hello(w, 'cM', 'ghost-0', 'Mallory')
    w.server.deliver('cM', { t: 'hello', profile: profile('ghost-1', 'Mallory'), version: PROTOCOL_VERSION })
    expect(rejectOf(w, 'cM')).toEqual({ t: 'reject', reason: 'version' })
    expect(w.server.isOpen('cM')).toBe(false)
    // Even a transport that still delivered from the rejected connection gets nowhere.
    for (let i = 2; i < 20; i++) w.server.deliver('cM', { t: 'hello', profile: profile(`ghost-${i}`, 'Mallory'), version: PROTOCOL_VERSION })
    expect(w.game.state.players.filter((p) => p.id.startsWith('ghost-')).map((p) => p.id)).toEqual(['ghost-0'])
    hello(w, 'cA', 'p-a', 'Giulia')
    expect(player(w, 'p-a')).toMatchObject({ connected: true })

    hello(w, 'cB', 'p-b', 'Bob')
    await w.clock.advance(1000)
    const before = w.server.of('cA', 'state').length
    for (let i = 0; i < 100; i++) w.server.deliver('cB', { t: 'hello', profile: profile('p-b', `Bob${i % 2}`), version: PROTOCOL_VERSION })
    await w.clock.advance(0)
    expect(w.server.of('cA', 'state').length - before).toBeLessThanOrEqual(2)
    expect(w.server.of('cB', 'welcome')).toHaveLength(1)
    expect(player(w, 'p-b')!.name).toBe('Bob1')
  })

  test('one identity per browser tab (remote peer id)', async () => {
    const w = world()
    const peers = new Map<string, string>([['c1', 'peer-X'], ['c2', 'peer-X'], ['c3', 'peer-X'], ['c4', 'peer-Y']])
    Object.assign(w.server, { remotePeerId: (connId: string) => peers.get(connId) ?? null })
    hello(w, 'c1', 'p-1')
    hello(w, 'c2', 'p-2') // same tab, another id
    expect(w.server.box('c2')).toEqual([{ t: 'reject', reason: 'version' }])
    w.server.lose('c1')
    hello(w, 'c3', 'p-1') // the tab reconnecting as itself is fine
    expect(player(w, 'p-1')!.connected).toBe(true)
    hello(w, 'c4', 'p-2') // another tab
    expect(player(w, 'p-2')).toBeDefined()
  })
})

describe('host refresh: who is still expected, and whose audio is ready', () => {
  test('players who had left before the refresh do not hold the round; the host’s ready flag is not restored', async () => {
    const storage = new MemoryStorage()
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = storage
    const clock = new FakeClock()
    const w = world({ clock })
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cC', 'p-c', 'Sofi')
    await startAndPlay(w, ['cA', 'cC'])
    w.server.deliver('cC', { t: 'arrange', round: 0, order: [1, 0, 2, 3, 4, 5, 6, 7] })
    w.server.deliver('cC', { t: 'leave' })
    await clock.advance(1_000)
    const snapshot = loadHostSnapshot('KXQPM', undefined, clock.now)!
    const w2 = world({ clock, server: new FakeHostServer('KXQPM'), restore: snapshot })
    hello(w2, 'cA2', 'p-a', 'Giulia')
    w2.server.deliver('cA2', { t: 'submit', round: 0, order: solved(8) })
    w2.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    expect(w2.game.state.phase.kind).toBe('reveal')
    w.game.destroy()
    w2.game.destroy()

    // Refresh while preparing a round the host had already decoded: it must say ready again.
    const w3 = world({ clock })
    hello(w3, 'cA', 'p-a')
    w3.game.updateSettings({ playlist: PLAYLIST, rounds: 3 })
    await w3.game.startGame()
    await clock.advance(0)
    w3.game.handleLocal({ t: 'ready', round: 0 })
    expect(w3.game.state.ready).toEqual({ 'p-host': true })
    await clock.advance(1_000)
    const snap3 = loadHostSnapshot('KXQPM', undefined, clock.now)!
    w3.game.destroy()
    const w4 = world({ clock, server: new FakeHostServer('KXQPM'), restore: snap3 })
    await clock.advance(0)
    expect(w4.game.state.ready['p-host']).toBeUndefined()
    hello(w4, 'cA2', 'p-a')
    w4.server.deliver('cA2', { t: 'ready', round: 0 })
    expect(w4.game.state.phase.kind).toBe('preparing')
    w4.game.handleLocal({ t: 'ready', round: 0 })
    expect(w4.game.state.phase.kind).toBe('intro')
    w4.game.destroy()
  })
})

describe('welcome', () => {
  test('mid-round, a (re)attaching player gets their own last arrangement back — nobody else sees it', async () => {
    const w = world()
    hello(w, 'cA', 'p-a')
    hello(w, 'cB', 'p-b')
    await startAndPlay(w, ['cA', 'cB'])
    const mine = [1, 0, 2, 3, 4, 5, 7, 6]
    w.server.deliver('cA', { t: 'arrange', round: 0, order: mine })
    hello(w, 'cA2', 'p-a') // another tab takes over
    const welcome = w.server.of('cA2', 'welcome')[0] as { mine?: unknown }
    expect(welcome.mine).toEqual({ round: 0, order: mine })
    for (const m of w.server.box('cB')) expect(JSON.stringify(m)).not.toContain(JSON.stringify(mine))
    // In the lobby / for players without moves: nothing.
    hello(w, 'cB2', 'p-b')
    expect((w.server.of('cB2', 'welcome')[0] as { mine?: unknown }).mine).toBeUndefined()
  })
})

describe('listening history', () => {
  test('the picker sees what the whole room heard: host history + guest digests (validated)', async () => {
    const w = world()
    w.ctl.localHistory = { '1': 1, '2': 0.5 }
    w.server.connect('c1')
    w.server.deliver('c1', { t: 'hello', profile: profile('p-a', 'A'), version: PROTOCOL_VERSION, history: { '1': 2, '3': 1 } })
    w.server.connect('c2')
    // Untrusted input: junk keys and values are dropped, huge weights capped.
    const junk = { '2': 1, abc: 5, '4': -1, '5': Number.NaN, '6': 1e9 } as unknown as Record<string, number>
    w.server.deliver('c2', { t: 'hello', profile: profile('p-b', 'B'), version: PROTOCOL_VERSION, history: junk })
    await startAndPlay(w, ['c1', 'c2'])
    const exposure = w.ctl.exposure!
    expect(exposure(1)).toBeCloseTo(3)
    expect(exposure(2)).toBeCloseTo(1.5)
    expect(exposure(3)).toBeCloseTo(1)
    expect(exposure(4)).toBe(0)
    expect(exposure(6)).toBe(100)
    expect(exposure(99)).toBe(0)
  })

  test('songs played in this room count for the next game', async () => {
    const w = world()
    hello(w, 'c1', 'p-a', 'A')
    const { round } = await startAndPlay(w, ['c1'], { rounds: 3 })
    const trackId = w.game.state.rounds[round]!.track.id
    w.game.handleLocal({ t: 'submit', round, order: solved(8) })
    w.server.deliver('c1', { t: 'submit', round, order: solved(8) })
    expect(w.game.state.phase.kind).toBe('reveal')
    w.game.backToLobby()
    await w.game.startGame()
    expect(w.ctl.exposure!(trackId)).toBeCloseTo(1) // guest heard it here (the host records its own locally)
  })
})
