// QA "code" (pass 2) repro tests for HostGame: bun test ./scripts/qa-code/host-qa2.repro.ts
// Each test asserts the CURRENT (buggy) behaviour: it passes while the bug exists.
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

import type { PlaylistRef } from '../../src/game/types'
import { FakeClock, FakeHostServer, makeDeps, makeTracks, profile } from '../host/harness'

const { HostGame } = await import('../../src/game/host')
const { INTRO_MS, PROTOCOL_VERSION, READY_TIMEOUT_MS } = await import('../../src/game/constants')

const HOST = profile('p-host', 'Tommy', 0, 0)
const PLAYLIST: PlaylistRef = { id: 1, title: 'Hit', picture: '', nbTracks: 80 }

function world() {
  const clock = new FakeClock()
  const server = new FakeHostServer()
  const { deps } = makeDeps(clock, makeTracks(20))
  const game = new HostGame({ server, hostProfile: HOST, deps })
  return { clock, server, game }
}
type W = ReturnType<typeof world>
function hello(w: W, connId: string, id: string, name = id) {
  w.server.connect(connId)
  w.server.deliver(connId, { t: 'hello', profile: profile(id, name), version: PROTOCOL_VERSION })
}

describe('QA code pass 2', () => {
  test('a player id that collides with an Object.prototype key ("toString") can never become ready: every round waits the full READY_TIMEOUT', async () => {
    const w = world()
    hello(w, 'cA', 'toString', 'Grief')
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 8 })
    await w.game.startGame()
    await w.clock.advance(0)
    w.game.handleLocal({ t: 'ready', round: 0 })
    w.server.deliver('cA', { t: 'ready', round: 0 })
    // markReady() bails out on `s.ready[playerId]` = Object.prototype.toString (truthy)
    expect(Object.hasOwn(w.game.state.ready, 'toString')).toBe(false)
    expect(w.game.state.phase.kind).toBe('preparing')
    await w.clock.advance(READY_TIMEOUT_MS - 1)
    expect(w.game.state.phase.kind).toBe('preparing')
    await w.clock.advance(1)
    expect(w.game.state.phase.kind).toBe('intro')
    w.game.destroy()
  })

  test('first confirm after the round clock already ran out still (re)arms a timer instead of ending the round', async () => {
    const w = world()
    hello(w, 'cA', 'p-a', 'Giulia')
    w.game.updateSettings({ playlist: PLAYLIST, rounds: 3, snippets: 8, roundTime: 60, finalTimer: 10 })
    await w.game.startGame()
    await w.clock.advance(0)
    w.game.handleLocal({ t: 'ready', round: 0 })
    w.server.deliver('cA', { t: 'ready', round: 0 })
    await w.clock.advance(INTRO_MS)
    const p = w.game.state.phase
    if (p.kind !== 'playing') throw new Error('not playing')
    // Host tab throttled / frozen: wall clock is 3 s past endsAt but the phase timer has not run.
    w.clock.now = p.endsAt + 3000
    w.game.handleLocal({ t: 'submit', round: 0, order: [0, 1, 2, 3, 4, 5, 6, 7] })
    const after = w.game.state.phase
    expect(after.kind).toBe('playing') // still playing 3 s after the deadline, first-submit banner shown
    expect(after.kind === 'playing' && after.firstSubmit !== null).toBe(true)
    w.game.destroy()
  })
})

describe('QA code pass 2: hello abuse', () => {
  test('one connection re-sending hello with fresh ids fills the room with ghosts (legit joiners get "full")', async () => {
    const w = world()
    hello(w, 'cM', 'ghost-0', 'Mallory')
    for (let i = 1; i < 20; i++) w.server.deliver('cM', { t: 'hello', profile: profile(`ghost-${i}`, 'Mallory'), version: PROTOCOL_VERSION })
    expect(w.game.state.players.length).toBe(10)
    hello(w, 'cA', 'p-a', 'Giulia')
    expect(w.server.dropped.find((d) => d.connId === 'cA')?.finalMsg).toEqual({ t: 'reject', reason: 'full' })
    w.game.destroy()
  })
})
