import { describe, expect, test } from 'bun:test'
import type { PlaylistRef } from '../../src/game/types'
import { prettyUrl, splitDisplayUrl } from '../../src/screens/lobby/invite'
import { MIN_ROUNDS, estimateMinutes, playlistShortfall, tracksWord } from '../../src/screens/lobby/rules'

const pl = (nbTracks: number): PlaylistRef => ({ id: 1, title: 'x', picture: '', nbTracks })

describe('tracksWord', () => {
  test('singular only for exactly one', () => {
    expect(tracksWord(1)).toBe('brano')
    expect(tracksWord(0)).toBe('brani')
    expect(tracksWord(2)).toBe('brani')
    expect(tracksWord(100)).toBe('brani')
  })
})

describe('playlistShortfall', () => {
  test('no playlist / enough tracks → null', () => {
    expect(playlistShortfall(null, 5)).toBeNull()
    expect(playlistShortfall(pl(5), 5)).toBeNull()
    expect(playlistShortfall(pl(100), 10)).toBeNull()
  })
  test('unknown count (0 / NaN) is left to the host', () => {
    expect(playlistShortfall(pl(0), 5)).toBeNull()
    expect(playlistShortfall(pl(Number.NaN), 5)).toBeNull()
  })
  test('too short → largest round option that fits', () => {
    expect(playlistShortfall(pl(4), 5)).toEqual({ have: 4, need: 5, fitRounds: 3 })
    expect(playlistShortfall(pl(9), 10)).toEqual({ have: 9, need: 10, fitRounds: 7 })
    expect(playlistShortfall(pl(6), 7)).toEqual({ have: 6, need: 7, fitRounds: 5 })
  })
  test('shorter than the smallest option → no shortcut', () => {
    expect(MIN_ROUNDS).toBe(3)
    expect(playlistShortfall(pl(1), 5)).toEqual({ have: 1, need: 5, fitRounds: null })
    expect(playlistShortfall(pl(2), 3)).toEqual({ have: 2, need: 3, fitRounds: null })
  })
})

describe('estimateMinutes', () => {
  test('at least one minute, grows with rounds', () => {
    expect(estimateMinutes({ rounds: 3, roundTime: 60 })).toBeGreaterThanOrEqual(1)
    expect(estimateMinutes({ rounds: 10, roundTime: 180 })).toBeGreaterThan(estimateMinutes({ rounds: 3, roundTime: 60 }))
  })
})

describe('invite link display', () => {
  test('splitDisplayUrl keeps the room tail separate', () => {
    expect(splitDisplayUrl('https://example.com/#/r/KXQPM')).toEqual({ head: 'example.com', tail: '#/r/KXQPM' })
    expect(splitDisplayUrl('http://127.0.0.1:5173/unshuffle/#/r/ABCDE')).toEqual({ head: '127.0.0.1:5173/unshuffle', tail: '#/r/ABCDE' })
    expect(splitDisplayUrl('https://a.b/games/unshuffle/#/r/ZZZZZ')).toEqual({ head: 'a.b/games/unshuffle', tail: '#/r/ZZZZZ' })
  })
  test('splitDisplayUrl without a room hash keeps the last characters', () => {
    const { head, tail } = splitDisplayUrl('https://example.com/some/very/long/path')
    expect(head + tail).toBe('example.com/some/very/long/path')
    expect(tail.length).toBe(12)
    expect(splitDisplayUrl('https://a.io/')).toEqual({ head: 'a.io', tail: '' })
  })
  test('prettyUrl still keeps both ends', () => {
    expect(prettyUrl('https://example.com/#/r/KXQPM')).toBe('example.com#/r/KXQPM')
    const long = prettyUrl('https://unshuffle.example-party-games.com/games/unshuffle/#/r/KXQPM')
    expect(long.length).toBeLessThanOrEqual(36)
    expect(long.endsWith('…#/r/KXQPM')).toBe(true)
  })
})
