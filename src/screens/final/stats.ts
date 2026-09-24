// Pure derivations for the final screen: standings, per-round matrix, awards and
// the headline. Only plain RoomState data in, plain data out, so this file can be
// tested headless. Texts and numbers come out in the current language (callers
// that memoize them depend on the locale).

import { MAX_ROUND_POINTS } from '../../game/constants'
import { formatList, formatOrdinal, localeTag, t } from '../../i18n'
import { compareStanding } from '../../game/standing'
import type { Player, PlayerId, RoomState, RoundResult, TrackInfo } from '../../game/types'

export type FinalSource = Pick<RoomState, 'players' | 'results' | 'rounds' | 'tracks' | 'settings'>

export interface PlayerSummary {
  player: Player
  /** 1-based (game/standing compareStanding); identical score, rounds played and total time share a rank. */
  rank: number
  score: number
  /** Sum of confirmation times (tie-breaker, lower is better). */
  totalTimeMs: number
  roundsPlayed: number
  perfectRounds: number
  /** Mean snippets in the exact position per played round. */
  avgCorrect: number
  /** Mean share of snippets in the exact position (0..1). */
  accuracy: number
  /** Mean confirmation time over rounds actually confirmed; null if never confirmed. */
  avgConfirmMs: number | null
  /**
   * Mean confirmation time over confirmed rounds that scored points; null if none.
   * Speed awards use this, so confirming an untouched board (always 0) never wins them.
   */
  avgScoringConfirmMs: number | null
  timeouts: number
}

export interface RoundRow {
  /** 0-based round index. */
  index: number
  track: TrackInfo | null
  /** Snippets the song was cut into. */
  snippets: number
  byPlayer: Record<PlayerId, RoundResult>
  /** Players with the best (non-zero) score of the round. */
  topIds: PlayerId[]
}

export type AwardId = 'golden-ear' | 'lightning' | 'sniper' | 'last-second'
export type AwardTone = 'gold' | 'cyan' | 'lime' | 'coral'

export interface Award {
  id: AwardId
  title: string
  /** How it is earned. */
  description: string
  emoji: string
  tone: AwardTone
  winners: Player[]
  /** Winning figure, e.g. "3 round perfetti" (current language). */
  value: string
}

export type HeadlineTone = 'win' | 'lose' | 'tie' | 'solo' | 'zero'

export interface Headline {
  title: string
  subtitle: string
  tone: HeadlineTone
}

export interface FinalSummary {
  standings: PlayerSummary[]
  /** Shared first place (usually one entry). */
  winners: PlayerSummary[]
  rounds: RoundRow[]
  awards: Award[]
  /** Completed rounds. */
  roundsPlayed: number
  /** Best possible total (roundsPlayed × MAX_ROUND_POINTS). */
  maxScore: number
  /** Snippet count if every round used the same one, else null. */
  snippets: number | null
}

const EPS = 1e-6

const NUMBER_FORMATS = {
  // Always group thousands (it-IT alone leaves 4-digit numbers ungrouped: 4428 vs 18.571).
  points: { maximumFractionDigits: 0, useGrouping: 'always' },
  seconds: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  average: { maximumFractionDigits: 1 },
  percent: { style: 'percent', maximumFractionDigits: 0 },
} satisfies Record<string, Intl.NumberFormatOptions>

// Formatters per language (points are formatted on every frame of the count-ups).
const numberFormats = new Map<string, Intl.NumberFormat>()
function formatAs(kind: keyof typeof NUMBER_FORMATS, n: number): string {
  const tag = localeTag()
  const id = `${tag}|${kind}`
  let fmt = numberFormats.get(id)
  if (!fmt) numberFormats.set(id, (fmt = new Intl.NumberFormat(tag, NUMBER_FORMATS[kind])))
  return fmt.format(n)
}

/** 4428 → "4.428". */
export function formatPoints(n: number): string {
  return formatAs('points', Math.round(n))
}

/** 32400 → "32,4 s" (no-break space: the unit never wraps away from its number). */
export function formatSeconds(ms: number): string {
  return t('final.units.seconds', { value: formatAs('seconds', ms / 1000) })
}

/** 6.8 of 8 → "6,8/8" (7.0 → "7/8"); mixed snippet counts → "85%". */
export function formatAccuracy(s: Pick<PlayerSummary, 'avgCorrect' | 'accuracy'>, snippets: number | null): string {
  if (snippets) return `${formatAs('average', s.avgCorrect)}/${snippets}`
  return formatAs('percent', s.accuracy)
}

/** "Giulia", "Giulia e Tommy", "Giulia, Tommy e Marco" (in the current language). */
export function joinNames(names: readonly string[]): string {
  return formatList(names)
}

/** A points phrase's params: the plural follows the score, the text shows it formatted. */
function pointsParams(score: number): { count: number; points: string } {
  return { count: score, points: formatPoints(score) }
}

export function computeFinalSummary(room: FinalSource): FinalSummary {
  const rounds: RoundRow[] = []
  const acc = new Map<
    PlayerId,
    { time: number; played: number; perfect: number; correct: number; share: number; confirmTime: number; confirmed: number; scoringTime: number; scoring: number; timeouts: number }
  >()
  const snippetCounts = new Set<number>()

  room.results.forEach((results, index) => {
    if (!results?.length) return
    const round = room.rounds[index] ?? null
    const snippets = round?.segments.length || results[0]?.order.length || room.settings.snippets
    snippetCounts.add(snippets)
    const byPlayer: Record<PlayerId, RoundResult> = {}
    let top = 0
    for (const r of results) {
      byPlayer[r.playerId] = r
      top = Math.max(top, r.points)
      const a = acc.get(r.playerId) ?? { time: 0, played: 0, perfect: 0, correct: 0, share: 0, confirmTime: 0, confirmed: 0, scoringTime: 0, scoring: 0, timeouts: 0 }
      a.time += r.timeMs
      a.played++
      if (r.perfect) a.perfect++
      a.correct += r.correct
      a.share += snippets > 0 ? r.correct / snippets : 0
      if (r.timedOut) a.timeouts++
      else {
        a.confirmTime += r.timeMs
        a.confirmed++
        if (r.points > 0) {
          a.scoringTime += r.timeMs
          a.scoring++
        }
      }
      acc.set(r.playerId, a)
    }
    rounds.push({
      index,
      track: round?.track ?? room.tracks[index] ?? null,
      snippets,
      byPlayer,
      topIds: top > 0 ? results.filter((r) => r.points === top).map((r) => r.playerId) : [],
    })
  })

  const standings: PlayerSummary[] = room.players.map((player) => {
    const a = acc.get(player.id)
    return {
      player,
      rank: 0,
      score: player.score,
      totalTimeMs: a?.time ?? 0,
      roundsPlayed: a?.played ?? 0,
      perfectRounds: a?.perfect ?? 0,
      avgCorrect: a && a.played ? a.correct / a.played : 0,
      accuracy: a && a.played ? a.share / a.played : 0,
      avgConfirmMs: a && a.confirmed ? a.confirmTime / a.confirmed : null,
      avgScoringConfirmMs: a && a.scoring ? a.scoringTime / a.scoring : null,
      timeouts: a?.timeouts ?? 0,
    }
  })
  standings.sort(compareStanding)
  standings.forEach((row, i) => {
    const prev = standings[i - 1]
    row.rank = prev && compareStanding(prev, row) === 0 ? prev.rank : i + 1
  })

  const snippets = snippetCounts.size === 1 ? [...snippetCounts][0] : null
  return {
    standings,
    winners: standings.filter((s) => s.rank === 1),
    rounds,
    awards: computeAwards(standings, snippets),
    roundsPlayed: rounds.length,
    maxScore: rounds.length * MAX_ROUND_POINTS,
    snippets,
  }
}

/** Players sharing the best value of `metric` (null = not eligible); ties broken by standing order. */
function best(rows: PlayerSummary[], metric: (s: PlayerSummary) => number | null, dir: 1 | -1): PlayerSummary[] {
  let bestValue: number | null = null
  let winners: PlayerSummary[] = []
  for (const row of rows) {
    const v = metric(row)
    if (v == null || !Number.isFinite(v)) continue
    if (bestValue == null || (v - bestValue) * dir > EPS) {
      bestValue = v
      winners = [row]
    } else if (Math.abs(v - bestValue) <= EPS) winners.push(row)
  }
  return winners
}

/** Awards compare players: none when fewer than two of them actually played. */
function computeAwards(standings: PlayerSummary[], snippets: number | null): Award[] {
  const played = standings.filter((s) => s.roundsPlayed > 0)
  const awards: Award[] = []
  if (played.length < 2) return awards
  const push = (a: Omit<Award, 'winners'>, winners: PlayerSummary[]) => {
    if (winners.length) awards.push({ ...a, winners: winners.map((w) => w.player) })
  }

  const ear = best(played, (s) => (s.perfectRounds > 0 ? s.perfectRounds : null), 1)
  push(
    {
      id: 'golden-ear',
      title: t('final.awards.goldenEar.title'),
      description: t('final.awards.goldenEar.description'),
      emoji: '👂',
      tone: 'gold',
      value: ear[0] ? t('final.awards.goldenEar.value', { count: ear[0].perfectRounds }) : '',
    },
    ear,
  )

  // Only rounds that scored count: a quick confirm of an untouched board is not "fast", it's a give-up.
  const fast = best(played, (s) => s.avgScoringConfirmMs, -1)
  push(
    {
      id: 'lightning',
      title: t('final.awards.lightning.title'),
      description: t('final.awards.lightning.description'),
      emoji: '⚡',
      tone: 'cyan',
      value: fast[0]?.avgScoringConfirmMs != null ? t('final.awards.lightning.value', { time: formatSeconds(fast[0].avgScoringConfirmMs) }) : '',
    },
    fast,
  )

  const sniper = best(played, (s) => (s.accuracy > 0 ? s.accuracy : null), 1)
  push(
    {
      id: 'sniper',
      title: t('final.awards.sniper.title'),
      description: t('final.awards.sniper.description'),
      emoji: '🎯',
      tone: 'lime',
      value: sniper[0] ? t('final.awards.sniper.value', { accuracy: formatAccuracy(sniper[0], snippets) }) : '',
    },
    sniper,
  )

  const late = best(played, (s) => (s.timeouts > 0 ? s.timeouts : null), 1)
  push(
    {
      id: 'last-second',
      title: t('final.awards.lastSecond.title'),
      description: t('final.awards.lastSecond.description'),
      emoji: '⏱️',
      tone: 'coral',
      value: late[0] ? t('final.awards.lastSecond.value', { count: late[0].timeouts }) : '',
    },
    late,
  )

  return awards
}

export function computeHeadline(summary: FinalSummary, me: PlayerId): Headline {
  const { standings, winners, roundsPlayed } = summary
  const top = standings[0]
  const mine = standings.find((s) => s.player.id === me)
  if (!top) return { title: t('final.headline.over'), subtitle: t('final.headline.noPlayers'), tone: 'zero' }

  const pointsInRounds = () => t('final.headline.pointsInRounds', { ...pointsParams(top.score), rounds: t('final.headline.rounds', { count: roundsPlayed }) })
  if (standings.length === 1) {
    if (top.score <= 0) return { title: t('final.headline.soloZero'), subtitle: t('final.headline.soloZeroSub'), tone: 'zero' }
    const avg = roundsPlayed ? top.score / roundsPlayed : 0
    const title = avg >= MAX_ROUND_POINTS * 0.9 ? t('final.headline.soloGreat') : avg >= MAX_ROUND_POINTS * 0.6 ? t('final.headline.soloGood') : t('final.headline.soloOk')
    return { title, subtitle: pointsInRounds(), tone: 'solo' }
  }

  if (top.score <= 0) {
    return { title: t('final.headline.allZero'), subtitle: t('final.headline.allZeroSub'), tone: 'zero' }
  }

  if (winners.length > 1) {
    const names = winners.map((w) => w.player.name)
    if (winners.some((w) => w.player.id === me)) {
      const others = winners.filter((w) => w.player.id !== me).map((w) => w.player.name)
      return { title: t('final.headline.tie'), subtitle: t('final.headline.tieWithMe', { names: joinNames(others) }), tone: 'tie' }
    }
    return { title: t('final.headline.tie'), subtitle: t('final.headline.tieOthers', { names: joinNames(names) }), tone: 'tie' }
  }

  const second = standings[1]
  if (top.player.id === me) {
    const gap = second ? top.score - second.score : 0
    const subtitle = !second
      ? t('final.headline.youWinPoints', pointsParams(top.score))
      : gap > 0
        ? t('final.headline.youWinLead', { ...pointsParams(top.score), gap: formatPoints(gap), name: second.player.name })
        : t('final.headline.youWinFaster', { name: second.player.name })
    return { title: t('final.headline.youWin'), subtitle, tone: 'win' }
  }

  const subtitle = !mine
    ? pointsInRounds()
    : mine.score === top.score
      ? t('final.headline.sameScore', { name: top.player.name })
      : t('final.headline.myRank', { ...pointsParams(mine.score), rank: formatOrdinal(mine.rank), total: standings.length })
  // FinalView colors {name} in this title for the 'lose' tone (see final.headline.theyWin).
  return { title: t('final.headline.theyWin', { name: top.player.name }), subtitle, tone: 'lose' }
}
