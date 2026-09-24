import { describe, expect, test } from 'bun:test'
import { FX_NOW, fxIntro, fxPlaying, fxPlayingFinal, fxPreparing, fxRound } from '../fixtures/room'
import {
  activePlayers,
  boardOrder,
  finalWindowSec,
  isPermutation,
  joinNames,
  rankOf,
  readyCount,
  roundInfo,
  roundTotalMs,
  sameOrder,
  totalTimes,
  waitingPlayers,
} from '../../src/screens/round/model'
import { computeStandings } from '../../src/game/selectors'

describe('roundInfo', () => {
  test('prepared round', () => {
    const info = roundInfo(fxIntro, 2)
    expect(info.number).toBe(3)
    expect(info.total).toBe(5)
    expect(info.snippets).toBe(8)
    expect(info.difficulty).toBe('Normale')
    expect(info.isLast).toBe(false)
    expect(info.track?.id).toBe(fxRound.track.id)
  })
  test('unprepared round falls back to settings / tracks', () => {
    const info = roundInfo(fxPreparing, 2)
    expect(info.data).toBeNull()
    expect(info.track).toBeNull()
    expect(info.snippets).toBe(8)
    expect(roundInfo({ ...fxPreparing, tracks: fxIntro.tracks }, 2).track?.id).toBe(fxRound.track.id)
  })
  test('last round', () => {
    expect(roundInfo(fxIntro, 4).isLast).toBe(true)
    expect(roundInfo(fxIntro, 7).total).toBe(8)
  })
})

describe('players', () => {
  test('spectators are excluded', () => {
    expect(activePlayers(fxPlaying, 2).map((p) => p.id)).toEqual(['p-host', 'p-2', 'p-3', 'p-4'])
    expect(activePlayers(fxPlaying, 3).map((p) => p.id)).toContain('p-5')
  })
  test('waiting = connected, active, not submitted, not me', () => {
    expect(waitingPlayers(fxPlaying, 2, 'p-host').map((p) => p.id)).toEqual(['p-3'])
    expect(waitingPlayers(fxPlaying, 2, 'p-3').map((p) => p.id)).toEqual(['p-host'])
  })
  test('ready count ignores disconnected', () => {
    expect(readyCount(fxPlaying, 2)).toEqual({ ready: 3, total: 3 })
  })
  test('rank by score', () => {
    expect(rankOf(fxPlaying, 'p-2')).toBe(1)
    expect(rankOf(fxPlaying, 'p-host')).toBe(2)
    expect(rankOf(fxPlaying, 'nobody')).toBe(0)
  })
})

describe('orders', () => {
  test('isPermutation', () => {
    expect(isPermutation([1, 0, 2], 3)).toBe(true)
    expect(isPermutation([1, 1, 2], 3)).toBe(false)
    expect(isPermutation([0, 1], 3)).toBe(false)
    expect(isPermutation([0, 1, 3], 3)).toBe(false)
    expect(isPermutation(null, 3)).toBe(false)
  })
  test('boardOrder falls back to the initial order', () => {
    expect(boardOrder([], fxRound.initialOrder, 8)).toEqual(fxRound.initialOrder)
    expect(boardOrder([0, 1, 2, 3, 4, 5, 6, 7], fxRound.initialOrder, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(boardOrder([0, 1, 2], fxRound.initialOrder, 8)).toEqual(fxRound.initialOrder)
    expect(boardOrder(null, [9, 9], 3)).toEqual([0, 1, 2])
  })
})

describe('timer', () => {
  test('ring total is the round length', () => {
    if (fxPlaying.phase.kind !== 'playing' || fxPlayingFinal.phase.kind !== 'playing') throw new Error('fixture')
    expect(roundTotalMs(fxPlaying, fxPlaying.phase)).toBe(90_000)
    expect(roundTotalMs(fxPlayingFinal, fxPlayingFinal.phase)).toBe(90_000)
  })
  test('final window', () => {
    if (fxPlayingFinal.phase.kind !== 'playing' || fxPlaying.phase.kind !== 'playing') throw new Error('fixture')
    expect(finalWindowSec(fxPlaying.phase)).toBeNull()
    expect(finalWindowSec(fxPlayingFinal.phase)).toBe(15)
    expect(finalWindowSec({ ...fxPlayingFinal.phase, endsAt: FX_NOW + 4000, firstSubmit: { playerId: 'x', at: FX_NOW } })).toBe(4)
  })
})

test('joinNames', () => {
  expect(joinNames([])).toBe('')
  expect(joinNames(['A'])).toBe('A')
  expect(joinNames(['A', 'B'])).toBe('A e B')
  expect(joinNames(['A', 'B', 'C'])).toBe('A, B e C')
})

describe('rank tie-break (same rule as computeStandings)', () => {
  const res = (playerId: string, timeMs: number) => ({ playerId, order: [], correct: 0, pairs: 0, points: 0, perfect: false, timeMs, timedOut: false })
  const tied = {
    ...fxPlaying,
    players: fxPlaying.players.map((p) => (p.id === 'p-2' ? { ...p, score: 13840 } : p)),
    results: [[res('p-2', 30_000), res('p-host', 50_000)], [res('p-2', 20_000), res('p-host', 10_000)]],
  }
  test('equal score: the lower total confirm time ranks first', () => {
    expect(rankOf(tied, 'p-2')).toBe(1)
    expect(rankOf(tied, 'p-host')).toBe(2)
    expect(rankOf(tied, 'p-3')).toBe(3)
  })
  test('equal score and time share the rank', () => {
    const same = { ...tied, results: [[res('p-2', 30_000), res('p-host', 30_000)]] }
    expect(rankOf(same, 'p-2')).toBe(1)
    expect(rankOf(same, 'p-host')).toBe(1)
    expect(rankOf(same, 'p-3')).toBe(3)
  })
  test('agrees with computeStandings', () => {
    const ranks = new Map(computeStandings(tied).map((s) => [s.player.id, s.rank]))
    for (const p of tied.players) expect(rankOf(tied, p.id)).toBe(ranks.get(p.id)!)
  })
  test('totalTimes sums every round', () => {
    expect(totalTimes(tied).get('p-2')).toBe(50_000)
    expect(totalTimes(tied).get('p-host')).toBe(60_000)
  })
})

test('sameOrder', () => {
  expect(sameOrder([1, 0, 2], [1, 0, 2])).toBe(true)
  expect(sameOrder([1, 0, 2], [0, 1, 2])).toBe(false)
  expect(sameOrder([1, 0], [1, 0, 2])).toBe(false)
  expect(sameOrder(fxRound.initialOrder, [...fxRound.initialOrder])).toBe(true)
})
