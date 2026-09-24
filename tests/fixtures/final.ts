// Rich final-screen fixtures for the lab: distinct songs, consistent scores,
// late joiner, disconnected player, ties, solo and crowded variants.
import { fxFinal, fxPlayers } from './room'
import { scoreArrangement } from '../../src/game/scoring'
import type { Player, RoomState, RoundPublic, RoundResult, TrackInfo } from '../../src/game/types'

const cover = (hash: string, size: number) => `https://cdn-images.dzcdn.net/images/cover/${hash}/${size}x${size}-000000-80-0-0.jpg`
const track = (id: number, title: string, artist: string, album: string, hash: string): TrackInfo => ({
  id,
  title,
  artist,
  album,
  cover: cover(hash, 1000),
  coverSmall: cover(hash, 250),
  preview: '',
  link: `https://www.deezer.com/track/${id}`,
  rank: 900000,
  durationSec: 200,
})

export const labTracks: TrackInfo[] = [
  track(908604612, 'Blinding Lights', 'The Weeknd', 'After Hours', 'fd00ebd6d30d7253f813dba3bb1c66a9'),
  track(8086126, 'Rolling in the Deep', 'Adele', '21', 'dc1ce848d830ecc93521be5a78350364'),
  track(3135556, 'Harder, Better, Faster, Stronger', 'Daft Punk', 'Discovery', '2e018122cb56986277102d2041a592c8'),
  track(1153182282, 'Seven Nation Army', 'The White Stripes', 'The White Stripes Greatest Hits', 'ed0929a4c44d77c4dc524a10748fc2f6'),
  track(655095912, 'bad guy', 'Billie Eilish', 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', '6630083f454d48eadb6a9b53f035d734'),
  track(92734438, 'Uptown Funk (feat. Bruno Mars)', 'Mark Ronson', 'Uptown Special', '3734366a73152d0367a83a4b09fd163f'),
  track(13791930, 'Smells Like Teen Spirit', 'Nirvana', 'Nevermind (Remastered)', 'f0282817b697279e56df13909962a54a'),
]

function round(index: number, t: TrackInfo, n: number): RoundPublic {
  return {
    index,
    track: t,
    segments: Array.from({ length: n }, (_, i) => ({ index: i, start: i * 3, end: (i + 1) * 3, beats: 8 })),
    initialOrder: Array.from({ length: n }, (_, i) => (i * 3 + 1) % n),
    hues: Array.from({ length: n }, (_, i) => (i * 47) % 360),
    bpm: 120,
  }
}

const PERFECT = [0, 1, 2, 3, 4, 5, 6, 7]
const NEAR = [0, 1, 2, 4, 3, 5, 6, 7]
const HALF = [1, 0, 2, 3, 6, 7, 4, 5]
const RUNS = [4, 5, 6, 7, 0, 1, 2, 3]
const MESS = [5, 2, 7, 0, 3, 6, 1, 4]
const SWAP_END = [0, 1, 2, 3, 4, 5, 7, 6]

function res(playerId: string, order: number[], timeMs: number, timedOut = false): RoundResult {
  return { playerId, order, ...scoreArrangement(order, order.length), timeMs, timedOut }
}

type Plan = [string, number[], number, boolean?][][]

const plan: Plan = [
  [['p-2', PERFECT, 38_400], ['p-host', NEAR, 52_100], ['p-3', HALF, 71_000], ['p-4', MESS, 90_000, true]],
  [['p-2', NEAR, 44_000], ['p-host', PERFECT, 33_900], ['p-3', RUNS, 88_000], ['p-4', HALF, 90_000, true]],
  [['p-2', PERFECT, 29_800], ['p-host', HALF, 41_500], ['p-3', NEAR, 64_200], ['p-4', RUNS, 77_700]],
  [['p-2', HALF, 60_000], ['p-host', PERFECT, 27_300], ['p-3', MESS, 90_000, true], ['p-4', NEAR, 58_000], ['p-5', RUNS, 49_500]],
  [['p-2', PERFECT, 35_100], ['p-host', NEAR, 36_800], ['p-3', SWAP_END, 70_400], ['p-4', HALF, 90_000, true], ['p-5', NEAR, 61_000]],
]

function build(players: Player[], p: Plan, tracks = labTracks): RoomState {
  const results = p.map((r) => r.map(([id, order, t, to]) => res(id, order, t, to)))
  const totals = new Map<string, number>()
  for (const r of results) for (const x of r) totals.set(x.playerId, (totals.get(x.playerId) ?? 0) + x.points)
  const n = p.length
  return {
    ...fxFinal,
    phase: { kind: 'final' },
    settings: { ...fxFinal.settings, rounds: n },
    players: players.map((pl) => ({ ...pl, score: totals.get(pl.id) ?? 0 })),
    tracks: tracks.slice(0, n),
    rounds: tracks.slice(0, n).map((t, i) => round(i, t, 8)),
    results,
  }
}

/** Full 5-player game: Giulia wins, Tommy (host) 2nd, Sofi joined at round 4, Marco offline. */
export const labFinal: RoomState = build(fxPlayers, plan)

/** Tommy wins (for "Hai vinto!" as host). */
export const labHostWins: RoomState = build(
  fxPlayers,
  plan.map((r) => r.map(([id, order, t, to]) => [id === 'p-2' ? 'p-host' : id === 'p-host' ? 'p-2' : id, order, t, to] as [string, number[], number, boolean?])),
)

/** Giulia and Tommy perfectly tied (same score and same total time). */
export const labTie: RoomState = build(fxPlayers.slice(0, 3), [
  [['p-2', PERFECT, 40_000], ['p-host', NEAR, 30_000], ['p-3', HALF, 70_000]],
  [['p-2', NEAR, 30_000], ['p-host', PERFECT, 40_000], ['p-3', RUNS, 80_000]],
  [['p-2', HALF, 50_000], ['p-host', HALF, 50_000], ['p-3', MESS, 90_000, true]],
])

/** Solo game. */
export const labSolo: RoomState = build(fxPlayers.slice(0, 1), [
  [['p-host', PERFECT, 31_000]],
  [['p-host', NEAR, 44_000]],
  [['p-host', PERFECT, 28_000]],
])

/** Two players. */
export const labDuo: RoomState = build(fxPlayers.slice(0, 2), plan.slice(0, 3).map((r) => r.filter(([id]) => id === 'p-host' || id === 'p-2')))

/** Nobody scored. */
export const labZero: RoomState = build(fxPlayers.slice(0, 3), [
  [['p-host', MESS, 90_000, true], ['p-2', MESS, 90_000, true], ['p-3', MESS, 90_000, true]],
  [['p-host', MESS, 90_000, true], ['p-2', MESS, 90_000, true], ['p-3', MESS, 90_000, true]],
  [['p-host', MESS, 90_000, true], ['p-2', MESS, 90_000, true], ['p-3', MESS, 90_000, true]],
])

const extraNames = ['Federico Maria', 'Ale', 'Chiara', 'Lorenzo il Magnifico', 'Bea']
const crowdPlayers: Player[] = [
  ...fxPlayers.map((p) => ({ ...p, activeFromRound: 0, connected: true })),
  ...extraNames.map((name, i) => ({
    id: `p-x${i}`,
    name,
    avatar: 16 + i,
    color: 5 + i,
    isHost: false,
    connected: true,
    score: 0,
    activeFromRound: 0,
  })),
]
const orders = [PERFECT, NEAR, HALF, RUNS, MESS, SWAP_END]

/** Ten players, seven rounds. */
export const labCrowd: RoomState = build(
  crowdPlayers,
  Array.from({ length: 7 }, (_, r) =>
    crowdPlayers.map((p, i) => {
      const k = (i * 7 + r * 3) % orders.length
      const to = (i + r) % 5 === 4
      return [p.id, orders[k], to ? 90_000 : 25_000 + ((i * 13 + r * 29) % 60) * 1000, to] as [string, number[], number, boolean?]
    }),
  ),
)

/** Longest allowed names (16 chars) on the podium and in the headline. */
export const labLongNames: RoomState = {
  ...labFinal,
  players: labFinal.players.map((p) =>
    p.id === 'p-2' ? { ...p, name: 'Massimiliano XVI' } : p.id === 'p-host' ? { ...p, name: 'WWWWWWWWWWWWWWWW' } : p,
  ),
}

export const LAB_ROOMS: Record<string, RoomState> = {
  final: labFinal,
  hostwins: labHostWins,
  tie: labTie,
  solo: labSolo,
  duo: labDuo,
  zero: labZero,
  crowd: labCrowd,
  long: labLongNames,
  fixture: fxFinal,
}
