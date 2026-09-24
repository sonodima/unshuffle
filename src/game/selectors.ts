// Derived state + stable selector hooks over useGame. Every hook returns either
// a primitive or a reference that already lives in the store — never a fresh
// object per render (zustand v5 would loop).
// The pure `compute*` helpers take plain RoomState data, so views fed by fixtures can use them too.

import { useShallow } from 'zustand/react/shallow'
import { phaseRound, useGame } from './store'
import type { GameStore } from './store'
import { compareStanding } from './standing'
import type { RankKey } from './standing'
import type { Player, PlayerId, RoomState, RoundPublic, RoundResult } from './types'

export { isActivePlayer } from './store'
export { compareStanding } from './standing'

// ---- pure derivations ---------------------------------------------------------

export function findPlayer(room: RoomState | null | undefined, id: PlayerId | null | undefined): Player | undefined {
  if (!room || !id) return undefined
  return room.players.find((p) => p.id === id)
}

/** Round the current phase is about (-1 in lobby / final). */
function currentRoundIndex(room: RoomState | null | undefined): number {
  return phaseRound(room?.phase)
}

/** The prepared round the current phase is about, if its data has arrived. */
export function getCurrentRound(room: RoomState | null | undefined): RoundPublic | null {
  const r = currentRoundIndex(room)
  return (r >= 0 && room?.rounds[r]) || null
}

export interface Standing {
  player: Player
  /** 1-based; players with identical score, rounds played and total time share a rank. */
  rank: number
  score: number
  /** Sum of confirmation times over played rounds (tie-breaker, lower is better). */
  totalTimeMs: number
  roundsPlayed: number
  perfectRounds: number
}

function rankInPlace<T extends RankKey & { rank: number }>(rows: T[]): T[] {
  rows.sort(compareStanding)
  rows.forEach((row, i) => {
    const prev = rows[i - 1]
    row.rank = prev && compareStanding(prev, row) === 0 ? prev.rank : i + 1
  })
  return rows
}

/** What the leaderboard derivations need (a full RoomState fits). */
export type ScoreSource = Pick<RoomState, 'players' | 'results'>

/** Overall standings: score desc, ties broken by more rounds played, then lower total confirmation time. */
export function computeStandings(room: ScoreSource | null | undefined): Standing[] {
  if (!room) return []
  const time = new Map<PlayerId, number>()
  const played = new Map<PlayerId, number>()
  const perfect = new Map<PlayerId, number>()
  for (const round of room.results) {
    for (const r of round ?? []) {
      time.set(r.playerId, (time.get(r.playerId) ?? 0) + r.timeMs)
      played.set(r.playerId, (played.get(r.playerId) ?? 0) + 1)
      if (r.perfect) perfect.set(r.playerId, (perfect.get(r.playerId) ?? 0) + 1)
    }
  }
  return rankInPlace(
    room.players.map((player) => ({
      player,
      rank: 0,
      score: player.score,
      totalTimeMs: time.get(player.id) ?? 0,
      roundsPlayed: played.get(player.id) ?? 0,
      perfectRounds: perfect.get(player.id) ?? 0,
    })),
  )
}

export interface RoundStanding {
  player: Player
  /** Undefined if the player did not take part in this round (late joiner). */
  result: RoundResult | undefined
  /** Points earned this round (0 without a result). */
  points: number
  totalBefore: number
  totalAfter: number
  /** Overall rank after this round (1-based, ties shared). */
  rank: number
  /** Overall rank before this round (equals `rank` for the first round). */
  prevRank: number
  /** prevRank − rank: positive = climbed. */
  rankDelta: number
}

/**
 * Leaderboard as of the end of `round`, with rank movement caused by that
 * round. Totals are rebuilt from `results`, so it works for any past round too.
 */
export function computeRoundStandings(room: ScoreSource | null | undefined, round: number): RoundStanding[] {
  if (!room || round < 0) return []
  const before = new Map<PlayerId, { score: number; time: number; played: number }>()
  for (let r = 0; r < round; r++) {
    for (const res of room.results[r] ?? []) {
      const acc = before.get(res.playerId) ?? { score: 0, time: 0, played: 0 }
      before.set(res.playerId, { score: acc.score + res.points, time: acc.time + res.timeMs, played: acc.played + 1 })
    }
  }
  const thisRound = new Map<PlayerId, RoundResult>()
  for (const res of room.results[round] ?? []) thisRound.set(res.playerId, res)

  const prev = rankInPlace(
    room.players.map((player) => ({
      id: player.id,
      rank: 0,
      score: before.get(player.id)?.score ?? 0,
      roundsPlayed: before.get(player.id)?.played ?? 0,
      totalTimeMs: before.get(player.id)?.time ?? 0,
    })),
  )
  const prevRank = new Map(prev.map((p) => [p.id, p.rank]))

  const rows = rankInPlace(
    room.players.map((player) => {
      const b = before.get(player.id) ?? { score: 0, time: 0, played: 0 }
      const result = thisRound.get(player.id)
      return {
        player,
        result,
        points: result?.points ?? 0,
        totalBefore: b.score,
        totalAfter: b.score + (result?.points ?? 0),
        rank: 0,
        prevRank: 0,
        rankDelta: 0,
        score: b.score + (result?.points ?? 0),
        roundsPlayed: b.played + (result ? 1 : 0),
        totalTimeMs: b.time + (result?.timeMs ?? 0),
      }
    }),
  )
  return rows.map(({ score: _score, totalTimeMs: _time, roundsPlayed: _played, ...row }) => {
    const pr = round === 0 ? row.rank : (prevRank.get(row.player.id) ?? row.rank)
    return { ...row, prevRank: pr, rankDelta: pr - row.rank }
  })
}

export interface GameStats {
  /**
   * Fastest confirmation of the game that scored (timed-out and 0-point rounds excluded, so
   * an instant confirm of an untouched board never wins; same rule as the final Fulmine award).
   */
  fastest: { player: Player; round: number; timeMs: number } | null
  /** Best single-round score. */
  bestRound: { player: Player; round: number; points: number } | null
  /** Perfect rounds per player id. */
  perfectRounds: Record<PlayerId, number>
  totalPerfect: number
  roundsPlayed: number
}

/** Fun stats for the final screen. */
export function computeGameStats(room: RoomState | null | undefined): GameStats {
  const stats: GameStats = { fastest: null, bestRound: null, perfectRounds: {}, totalPerfect: 0, roundsPlayed: 0 }
  if (!room) return stats
  room.results.forEach((results, round) => {
    if (!results?.length) return
    stats.roundsPlayed++
    for (const r of results) {
      const player = findPlayer(room, r.playerId)
      if (!player) continue
      if (r.perfect) {
        stats.perfectRounds[r.playerId] = (stats.perfectRounds[r.playerId] ?? 0) + 1
        stats.totalPerfect++
      }
      if (!r.timedOut && r.points > 0 && (!stats.fastest || r.timeMs < stats.fastest.timeMs)) stats.fastest = { player, round, timeMs: r.timeMs }
      if (!stats.bestRound || r.points > stats.bestRound.points) stats.bestRound = { player, round, points: r.points }
    }
  })
  return stats
}

// ---- store hooks ----------------------------------------------------------------

export const useRoom = (): RoomState | null => useGame((s) => s.room)

export const useMyId = (): PlayerId => useGame((s) => s.me)

export const useIsHost = (): boolean => useGame((s) => s.role === 'host' || (!!s.room && s.room.hostId === s.me))

type Actions = Pick<
  GameStore,
  | 'setProfile'
  | 'createRoom'
  | 'joinRoom'
  | 'resumeSession'
  | 'rejoin'
  | 'leave'
  | 'clearError'
  | 'setArrangement'
  | 'submit'
  | 'react'
  | 'notify'
  | 'dismissToast'
  | 'updateSettings'
  | 'startGame'
  | 'nextRound'
  | 'kick'
  | 'backToLobby'
>

/** Every store action (stable functions; never causes re-renders). */
export function useActions(): Actions {
  return useGame(
    useShallow((s) => ({
      setProfile: s.setProfile,
      createRoom: s.createRoom,
      joinRoom: s.joinRoom,
      resumeSession: s.resumeSession,
      rejoin: s.rejoin,
      leave: s.leave,
      clearError: s.clearError,
      setArrangement: s.setArrangement,
      submit: s.submit,
      react: s.react,
      notify: s.notify,
      dismissToast: s.dismissToast,
      updateSettings: s.updateSettings,
      startGame: s.startGame,
      nextRound: s.nextRound,
      kick: s.kick,
      backToLobby: s.backToLobby,
    })),
  )
}
