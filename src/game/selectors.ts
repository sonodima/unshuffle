// Derived state + stable selector hooks over useGame. Every hook returns either
// a primitive, a reference that already lives in the store, or a memoized
// derivation — never a fresh object per render (zustand v5 would loop).
// The pure `compute*` helpers take plain RoomState data, so views fed by fixtures can use them too.

import { useEffect, useMemo, useReducer } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { hostNow } from './clock'
import { isActivePlayer, phaseRound, useGame } from './store'
import type { AudioStatus, GameStore } from './store'
import { compareStanding } from './standing'
import type { RankKey } from './standing'
import type { Phase, PhaseKind, Player, PlayerId, RoomState, RoundPublic, RoundResult, SubmissionStatus } from './types'

export { isActivePlayer, phaseRound, trackKey } from './store'
export { compareStanding } from './standing'
export type { RankKey } from './standing'

// ---- pure derivations ---------------------------------------------------------

export function findPlayer(room: RoomState | null | undefined, id: PlayerId | null | undefined): Player | undefined {
  if (!room || !id) return undefined
  return room.players.find((p) => p.id === id)
}

/** Round the current phase is about (-1 in lobby / final). */
export function currentRoundIndex(room: RoomState | null | undefined): number {
  return phaseRound(room?.phase)
}

/** The prepared round the current phase is about, if its data has arrived. */
export function getCurrentRound(room: RoomState | null | undefined): RoundPublic | null {
  const r = currentRoundIndex(room)
  return (r >= 0 && room?.rounds[r]) || null
}

/** Round results sorted best first: points desc, then faster confirmation. */
export function sortRoundResults(results: readonly RoundResult[]): RoundResult[] {
  return [...results].sort((a, b) => b.points - a.points || a.timeMs - b.timeMs)
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

/** Players ordered by overall standing. */
export function computeLeaderboard(room: ScoreSource | null | undefined): Player[] {
  return computeStandings(room).map((s) => s.player)
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

/** Active, connected players who still have to confirm the current round. */
export function waitingPlayers(room: RoomState | null | undefined): Player[] {
  if (!room || room.phase.kind !== 'playing') return []
  const r = room.phase.round
  return room.players.filter((p) => p.connected && isActivePlayer(p, r) && !room.submissions[p.id]?.submitted)
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
export const useRole = () => useGame((s) => s.role)
export const useConnection = () => useGame((s) => s.connection)
export const useError = (): string | null => useGame((s) => s.error)
export const useProfile = () => useGame((s) => s.profile)
export const useToasts = () => useGame((s) => s.toasts)
export const useRoomCode = (): string | null => useGame((s) => s.room?.code ?? s.roomCode)
export const useSettings = () => useGame((s) => s.room?.settings ?? null)
export const usePlayers = (): Player[] => useGame((s) => s.room?.players ?? EMPTY_PLAYERS)
export const useArrangement = (): number[] => useGame((s) => s.arrangement)
export const useSubmitted = (): boolean => useGame((s) => s.submitted)

const EMPTY_PLAYERS: Player[] = []

/** My Player entry in the room. */
export const useMe = (): Player | undefined => useGame((s) => findPlayer(s.room, s.me))

export const useMyId = (): PlayerId => useGame((s) => s.me)

export const usePlayer = (id: PlayerId | null | undefined): Player | undefined => useGame((s) => findPlayer(s.room, id))

export const useHostPlayer = (): Player | undefined => useGame((s) => findPlayer(s.room, s.room?.hostId))

export const useIsHost = (): boolean => useGame((s) => s.role === 'host' || (!!s.room && s.room.hostId === s.me))

export const usePhase = (): Phase | null => useGame((s) => s.room?.phase ?? null)

export const usePhaseKind = (): PhaseKind | null => useGame((s) => s.room?.phase.kind ?? null)

/** Round index of the current phase (-1 in lobby / final). */
export const useRoundIndex = (): number => useGame((s) => currentRoundIndex(s.room))

export const useCurrentRound = (): RoundPublic | null => useGame((s) => getCurrentRound(s.room))

/** Am I playing (not spectating) the current round. */
export const useAmIActive = (): boolean =>
  useGame((s) => {
    const r = currentRoundIndex(s.room)
    return r >= 0 && isActivePlayer(findPlayer(s.room, s.me), r)
  })

/** My result for `round` (default: the current phase's round). */
export function useMyResult(round?: number): RoundResult | undefined {
  return useGame((s) => {
    const r = round ?? currentRoundIndex(s.room)
    return r >= 0 ? s.room?.results[r]?.find((res) => res.playerId === s.me) : undefined
  })
}

/** All results of `round` (default: current), best first. */
export function useRoundResults(round?: number): RoundResult[] {
  const results = useGame((s) => {
    const r = round ?? currentRoundIndex(s.room)
    return r >= 0 ? s.room?.results[r] : undefined
  })
  return useMemo(() => (results ? sortRoundResults(results) : []), [results])
}

export function useSubmission(playerId: PlayerId | null | undefined): SubmissionStatus | undefined {
  return useGame((s) => (playerId ? s.room?.submissions[playerId] : undefined))
}

/** Who confirmed first in the current round (drives the "final timer" banner). */
export const useFirstSubmitter = (): Player | undefined =>
  useGame((s) => {
    const phase = s.room?.phase
    return phase?.kind === 'playing' && phase.firstSubmit ? findPlayer(s.room, phase.firstSubmit.playerId) : undefined
  })

/** Players by score desc, ties by more rounds played, then lower total confirmation time. */
export function useLeaderboard(): Player[] {
  const players = useGame((s) => s.room?.players)
  const results = useGame((s) => s.room?.results)
  return useMemo(
    () => (players && results ? computeLeaderboard({ players, results }) : EMPTY_PLAYERS),
    [players, results],
  )
}

export function useStandings(): Standing[] {
  const players = useGame((s) => s.room?.players)
  const results = useGame((s) => s.room?.results)
  return useMemo(() => (players && results ? computeStandings({ players, results }) : []), [players, results])
}

/** Leaderboard after `round` (default: current) with rank deltas — for the reveal screen. */
export function useRoundStandings(round?: number): RoundStanding[] {
  const players = useGame((s) => s.room?.players)
  const results = useGame((s) => s.room?.results)
  const r = useGame((s) => round ?? currentRoundIndex(s.room))
  return useMemo(
    () => (players && results ? computeRoundStandings({ players, results }, r) : []),
    [players, results, r],
  )
}

/** Active connected players who haven't confirmed yet ("In attesa di…"). */
export function useWaitingFor(): Player[] {
  const room = useGame((s) => s.room)
  return useMemo(() => waitingPlayers(room), [room])
}

export function useGameStats(): GameStats {
  const room = useGame((s) => s.room)
  return useMemo(() => computeGameStats(room), [room])
}

export function useAudioStatus(trackId: number | null | undefined): AudioStatus {
  return useGame((s) => (trackId == null ? 'idle' : (s.audio[trackId] ?? 'idle')))
}

/** Load status of the current round's audio. */
export const useCurrentAudioStatus = (): AudioStatus =>
  useGame((s) => {
    const r = currentRoundIndex(s.room)
    const id = r >= 0 ? (s.room?.rounds[r]?.track.id ?? s.room?.tracks[r]?.id) : undefined
    return id == null ? 'idle' : (s.audio[id] ?? 'idle')
  })

/**
 * Share of this game's tracks that are decoded right now (0..1). Only the current and the
 * next round are ever decoded at once (STORE_TIMINGS.decodeAhead), so this is not a
 * whole-game download meter — use useCurrentAudioStatus for "is this round ready".
 */
export const useAudioProgress = (): number =>
  useGame((s) => {
    const tracks = s.room?.tracks ?? []
    if (!tracks.length) return 0
    return tracks.filter((t) => s.audio[t.id] === 'ready').length / tracks.length
  })

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

// ---- time ---------------------------------------------------------------------

/** Whole seconds (ceil) left until `endsAt` on the host clock. */
function secondsLeft(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - hostNow()) / 1000))
}

/**
 * Milliseconds left until `endsAt` (host clock), re-rendering every `intervalMs`
 * while running and stopping at 0. Null/undefined `endsAt` → 0. The value is
 * derived at render time, so a jump of `endsAt` (first confirmation) shows at once.
 */
export function useRemainingMs(endsAt: number | null | undefined, intervalMs = 100): number {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (endsAt == null || hostNow() >= endsAt) return
    const id = setInterval(() => {
      rerender()
      if (hostNow() >= endsAt) clearInterval(id)
    }, intervalMs)
    return () => clearInterval(id)
  }, [endsAt, intervalMs])
  return endsAt == null ? 0 : Math.max(0, endsAt - hostNow())
}

/**
 * Whole seconds left (ceil) until `endsAt`; re-renders only when the number
 * changes, so a big "12" timer doesn't repaint ten times a second.
 */
export function useSecondsLeft(endsAt: number | null | undefined): number {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (endsAt == null) return
    let last = secondsLeft(endsAt)
    if (last === 0) return
    const id = setInterval(() => {
      const next = secondsLeft(endsAt)
      if (next !== last) {
        last = next
        rerender()
      }
      if (next === 0) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [endsAt])
  return endsAt == null ? 0 : secondsLeft(endsAt)
}
