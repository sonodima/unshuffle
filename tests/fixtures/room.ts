// Realistic RoomState fixtures for building/previewing screens in isolation
// (lab pages, styleguide). Not imported by production code.

import { DEFAULT_SETTINGS } from '../../src/game/constants'
import { scoreArrangement } from '../../src/game/scoring'
import type { Player, RoomState, RoundPublic, RoundResult, TrackInfo } from '../../src/game/types'

const NOW = 1_790_000_000_000

export const fxPlayers: Player[] = [
  { id: 'p-host', name: 'Tommy', avatar: 0, color: 0, isHost: true, connected: true, score: 13840, activeFromRound: 0 },
  { id: 'p-2', name: 'Giulia', avatar: 10, color: 1, isHost: false, connected: true, score: 15210, activeFromRound: 0 },
  { id: 'p-3', name: 'DJ Pinguino', avatar: 14, color: 2, isHost: false, connected: true, score: 9020, activeFromRound: 0 },
  { id: 'p-4', name: 'Marco', avatar: 3, color: 3, isHost: false, connected: false, score: 6400, activeFromRound: 0 },
  { id: 'p-5', name: 'Sofi', avatar: 7, color: 4, isHost: false, connected: true, score: 0, activeFromRound: 3 },
]

export const fxTrack: TrackInfo = {
  id: 3135556,
  title: 'Harder, Better, Faster, Stronger',
  artist: 'Daft Punk',
  album: 'Discovery',
  cover: 'https://cdn-images.dzcdn.net/images/cover/2e018122cb56986277102d2041a592c8/1000x1000-000000-80-0-0.jpg',
  coverSmall: 'https://cdn-images.dzcdn.net/images/cover/2e018122cb56986277102d2041a592c8/250x250-000000-80-0-0.jpg',
  preview: '',
  link: 'https://www.deezer.com/track/3135556',
  rank: 810329,
  durationSec: 226,
}

const bpm = 123.7
const bar = (60 / bpm) * 4
export const fxRound: RoundPublic = {
  index: 2,
  track: fxTrack,
  segments: Array.from({ length: 8 }, (_, i) => ({ index: i, start: 1.1 + i * bar * 1.5, end: 1.1 + (i + 1) * bar * 1.5, beats: 6 })),
  initialOrder: [5, 2, 7, 0, 3, 6, 1, 4],
  hues: [312, 22, 190, 95, 258, 140, 48, 5],
  bpm,
}

function result(playerId: string, order: number[], timeMs: number, timedOut = false): RoundResult {
  const s = scoreArrangement(order, order.length)
  return { playerId, order, ...s, timeMs, timedOut }
}

export const fxResults: RoundResult[] = [
  result('p-2', [0, 1, 2, 3, 4, 5, 6, 7], 41200),
  result('p-host', [0, 1, 2, 4, 3, 5, 6, 7], 55800),
  result('p-3', [1, 0, 2, 3, 6, 7, 4, 5], 71000),
  result('p-4', [5, 2, 7, 0, 3, 6, 1, 4], 90000, true),
]

const base: RoomState = {
  code: 'KXQPM',
  hostId: 'p-host',
  players: fxPlayers,
  settings: {
    ...DEFAULT_SETTINGS,
    playlist: {
      id: 248297032,
      title: '00s Hits',
      picture: 'https://cdn-images.dzcdn.net/images/playlist/3e4cdc7e18c4ac1163bc7247f151731c/500x500-000000-80-0-0.jpg',
      nbTracks: 100,
      creator: 'Deezer Pop Editor',
    },
  },
  phase: { kind: 'lobby' },
  tracks: [],
  rounds: [],
  submissions: {},
  ready: {},
  results: [],
  seq: 1,
}

export const fxLobby: RoomState = { ...base, players: fxPlayers.map((p) => ({ ...p, score: 0, activeFromRound: 0 })) }

export const fxPreparing: RoomState = { ...base, phase: { kind: 'preparing', round: 2, message: 'Sto affettando la traccia…' } }

export const fxIntro: RoomState = {
  ...base,
  phase: { kind: 'intro', round: 2, endsAt: NOW + 3000 },
  tracks: [fxTrack, fxTrack, fxTrack, fxTrack, fxTrack],
  rounds: [null, null, fxRound],
}

export const fxPlaying: RoomState = {
  ...fxIntro,
  phase: { kind: 'playing', round: 2, startedAt: NOW - 30_000, endsAt: NOW + 60_000, firstSubmit: null },
  submissions: { 'p-2': { submitted: true, atMs: 28_000 } },
  ready: { 'p-host': true, 'p-2': true, 'p-3': true, 'p-4': false },
}

export const fxPlayingFinal: RoomState = {
  ...fxPlaying,
  phase: { kind: 'playing', round: 2, startedAt: NOW - 30_000, endsAt: NOW + 12_000, firstSubmit: { playerId: 'p-2', at: NOW - 3000 } },
}

export const fxReveal: RoomState = {
  ...fxIntro,
  phase: { kind: 'reveal', round: 2, nextAt: NOW + 20_000 },
  results: [fxResults, fxResults, fxResults],
}

export const fxFinal: RoomState = { ...fxReveal, phase: { kind: 'final' }, results: [fxResults, fxResults, fxResults, fxResults, fxResults] }

/** Pretend "now" matching the fixtures' timestamps. */
export const FX_NOW = NOW
