// QA "code" repro tests for HostGame: bun test ./scripts/qa-code/host-qa.repro.ts
// Each test asserts the CURRENT (buggy) behaviour found in review: it passes while the bug exists (kept out of the *.test.ts glob on purpose).
import { describe, expect, mock, test } from 'bun:test'

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
import { FakeClock, FakeHostServer, MemoryStorage, makeDeps, makeTracks, profile } from '../host/harness'

const { HostGame } = await import('../../src/game/host')
const { INTRO_MS, PROTOCOL_VERSION } = await import('../../src/game/constants')
const { loadHostSnapshot } = await import('../../src/game/persist')

type Game = InstanceType<typeof HostGame>
const HOST = profile('p-host', 'Tommy', 0, 0)
const PLAYLIST: PlaylistRef = { id: 1, title: 'Hit', picture: '', nbTracks: 80 }

function world(opts: { clock?: FakeClock; server?: FakeHostServer; restore?: RoomState | null } = {}) {
  const clock = opts.clock ?? new FakeClock()
  const server = opts.server ?? new FakeHostServer()
  const { deps } = makeDeps(clock, makeTracks(20))
  const game: Game = new HostGame({ server, hostProfile: HOST, deps, restore: opts.restore })
  const events: GameEvent[] = []
  const states: RoomState[] = []
  game.onEvent((e) => events.push(e))
  game.subscribe((s) => states.push(s))
  return { clock, server, game, events, states }
}
type W = ReturnType<typeof world>

function hello(w: W, connId: string, id: string, name = id) {
  w.server.connect(connId)
  w.server.deliver(connId, { t: 'hello', profile: profile(id, name), version: PROTOCOL_VERSION })
}

async function startAndPlay(w: W, conns: string[]) {
  w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 8, roundTime: 90, finalTimer: 15 })
  await w.game.startGame()
  await w.clock.advance(0)
  w.game.handleLocal({ t: 'ready', round: 0 })
  for (const c of conns) w.server.deliver(c, { t: 'ready', round: 0 })
  await w.clock.advance(INTRO_MS)
  const phase = w.game.state.phase
  if (phase.kind !== 'playing') throw new Error(`expected playing, got ${phase.kind}`)
  return phase
}
const solved = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('QA code: host robustness', () => {
  test('a 1 s link blip of the last player still arranging ends the round at once (they lose the final timer)', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    await startAndPlay(w, ['cA'])
    await w.clock.advance(10_000)
    w.game.handleLocal({ t: 'submit', round: 0, order: solved(8) }) // host confirms first → 15 s final timer
    const p = w.game.state.phase
    expect(p.kind).toBe('playing')
    const finalEndsAt = p.kind === 'playing' ? p.endsAt : 0
    // Giulia's data channel drops (Wi-Fi → 4G, tab reload, phone locked…) and comes back 1 s later.
    w.server.lose('cA')
    const afterBlip = w.game.state.phase
    await w.clock.advance(1_000)
    hello(w, 'cA2', 'p-a', 'Giulia')
    console.log(`[qa] phase right after blip: ${afterBlip.kind}; ${Math.round((finalEndsAt - (w.clock.now - 1000)) / 1000)} s of final timer were left`)
    expect(afterBlip.kind).toBe('reveal')
    expect(w.game.state.results[0].find((r) => r.playerId === 'p-a')).toMatchObject({ timedOut: true })
    // Everybody saw "Giulia è uscito", nobody gets told she is back.
    const aboutA = w.events.filter((e) => 'playerId' in e && e.playerId === 'p-a').map((e) => e.type)
    expect(aboutA).toEqual(['player-joined', 'player-left'])
  })

  test('any peer can take over another player’s seat by re-using the public player id', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cM', 'p-mallory', 'Mallory')
    await startAndPlay(w, ['cA', 'cM'])
    const victimId = w.server.lastState('cM')!.players.find((p) => p.name === 'Giulia')!.id // ids are broadcast
    w.server.deliver('cM', { t: 'hello', profile: profile(victimId, 'Giulia'), version: PROTOCOL_VERSION })
    // Giulia is thrown out with the misleading "already connected from another tab" reason…
    expect(w.server.dropped.find((d) => d.connId === 'cA')?.finalMsg).toEqual({ t: 'reject', reason: 'duplicate' })
    // …and Mallory now answers for her.
    w.server.deliver('cM', { t: 'submit', round: 0, order: [7, 6, 5, 4, 3, 2, 1, 0] })
    expect(w.game.state.submissions[victimId]?.submitted).toBe(true)
  })

  test('hello floods bypass the ≤ 20/s state coalescing (one full broadcast per hello)', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cB', 'p-b', 'Bob')
    await w.clock.advance(1000)
    const before = w.server.of('cA', 'state').length
    for (let i = 0; i < 100; i++) {
      w.server.deliver('cB', { t: 'hello', profile: profile('p-b', `Bob${i % 2}`), version: PROTOCOL_VERSION })
    }
    const sent = w.server.of('cA', 'state').length - before
    console.log(`[qa] 100 hellos in one tick → ${sent} full RoomState broadcasts to every other client`)
    expect(sent).toBeGreaterThanOrEqual(100)
  })

  test('submissions / arrangements that arrive after endsAt (phase timer late, e.g. throttled host tab) are accepted', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    const p = await startAndPlay(w, ['cA'])
    // Simulate a throttled/frozen host tab: wall clock passes endsAt but the timer has not fired yet.
    w.clock.now = p.endsAt + 900
    w.server.deliver('cA', { t: 'arrange', round: 0, order: solved(8) })
    w.server.deliver('cA', { t: 'submit', round: 0, order: solved(8) })
    expect(w.game.state.submissions['p-a']).toEqual({ submitted: true, atMs: 90_000 })
    await w.clock.advance(0)
    const res = w.game.state.results[0].find((r) => r.playerId === 'p-a')!
    expect(res).toMatchObject({ perfect: true, timedOut: false, points: 5000 })
  })

  test('after a host refresh, players who had ALREADY left still block the round end for RESTORE_GRACE_MS', async () => {
    ;(globalThis as { sessionStorage?: Storage }).sessionStorage = new MemoryStorage()
    const clock = new FakeClock()
    const w = world({ clock })
    hello(w, 'cA', 'p-a', 'Giulia')
    hello(w, 'cC', 'p-c', 'Sofi')
    await startAndPlay(w, ['cA', 'cC'])
    w.server.deliver('cC', { t: 'leave' }) // Sofi quits the game for good
    await clock.advance(1_000)
    const snapshot = loadHostSnapshot('KXQPM', undefined, clock.now)!
    expect(snapshot.players.find((p) => p.id === 'p-c')!.connected).toBe(false)
    const w2 = world({ clock, server: new FakeHostServer('KXQPM'), restore: snapshot })
    hello(w2, 'cA2', 'p-a', 'Giulia')
    w2.server.deliver('cA2', { t: 'submit', round: 0, order: solved(8) })
    w2.game.handleLocal({ t: 'submit', round: 0, order: solved(8) })
    // Everyone who is actually in the game has confirmed, yet the round keeps running…
    expect(w2.game.state.phase.kind).toBe('playing')
    await clock.advance(11_999)
    expect(w2.game.state.phase.kind).toBe('playing')
    await clock.advance(1)
    // …until the 12 s restore grace for Sofi (who left before the refresh) runs out.
    expect(w2.game.state.phase.kind).toBe('reveal')
    w.game.destroy()
    w2.game.destroy()
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage
  })
})
