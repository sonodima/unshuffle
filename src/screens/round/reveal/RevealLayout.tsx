// Round reveal — presentational. Renders entirely from props (RoomState, my id,
// host clock). The choreography (~4 s):
//   1. song card: cover flips over, vinyl slides out
//   2. my arrangement appears, each position pops ✓ / ✗ (rising pitch on streaks)
//   3. blocks slide into the correct order (misplaced ones turn neutral with an
//      "era Nº" chip; a toggle flips back to "Il tuo ordine")
//   4. round points count up over the 0–5000 bar (+ confetti on a perfect round)
//   5. leaderboard (shown dimmed in the old ranking since step 2) lights up with
//      the round points and reshuffles into the new ranking
// The song keeps playing throughout; once sorted, the block it is in lights up and
// a tap on a block jumps the song there (see revealAudio). Spectators (late
// joiners) get the song and the leaderboard only. The header hosts the inline
// sound control, so the shell's floating one never covers the page.
import { t } from '../../../i18n'
import { rich, useLocale, useT } from '../../../i18n/react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SfxName } from '../../../audio/sfx'
import { useLocalSegments } from '../../../components/board'
import { SoundControls } from '../../../components/shell/SoundControls'
import { Icon, ProgressDots, Segmented, cn, playSfx, useCanHover, useIsWide, useMediaQuery } from '../../../components/ui'
import { REVEAL_AUTO_ADVANCE_MS, SNIPPET_DIFFICULTY } from '../../../game/constants'
import type { PlayerId, RoomState, Segment } from '../../../game/types'
import { DEFAULT_COVER_COLORS } from '../../../lib/coverColor'
import { GameMenuButton } from '../GameMenu'
import { BoardStage } from './BoardStage'
import { createRevealConfetti } from './confetti'
import type { RevealConfetti } from './confetti'
import {
  boardLabels,
  boardOrderFor,
  buildRevealModel,
  buildTimeline,
  formatPoints,
  secondsUntil,
  shouldSkipChoreography,
  sortedViewMarks,
  streakPitch,
  streaks,
} from './model'
import type { BoardView, RevealMark, RevealModel } from './model'
import { RevealFooter } from './RevealFooter'
import { RoundLeaderboard } from './RoundLeaderboard'
import { ScorePanel } from './ScorePanel'
import { SongCard } from './SongCard'
import type { RevealAccent, SongCardVariant, SongProgressFn } from './SongCard'
import { useRevealProgress } from './useRevealProgress'
import type { RevealCue } from './useRevealProgress'
import './reveal.css'

/** Side effects the choreography triggers; all optional and never allowed to throw. */
export interface RevealEffects {
  sfx(name: SfxName, opts?: { pitch?: number; gain?: number }): void
  /** Light burst in the shader background (0..1.5). */
  pulse(strength: number): void
}

interface RevealLayoutProps {
  /** Room in the `reveal` phase (anything else renders nothing). */
  room: RoomState
  me: PlayerId
  /** Host clock (ms), for the auto-advance countdown. Update ~4×/s. */
  now: number
  isHost: boolean
  /** Host: advance to the next round / final standings. */
  onNext?: () => void
  /** Album-derived accents (default brand violet / magenta). */
  accent?: RevealAccent | null
  /** The original song is playing (tag 'reveal'). */
  songPlaying?: boolean
  /** …but not audible yet (audio still locked): the song button says "tocca per ascoltare". */
  songPending?: boolean
  /** The song was paused part-way (the song button resumes it). */
  songPaused?: boolean
  /** Pause / resume the song. Omit to hide the control. */
  onToggleSong?: () => void
  /** Segment index audible in the song right now (-1 = none): lights that block up once the board is sorted. */
  songSegment?: number
  /** Per-frame 0..1 progress of the song inside a segment (sweeps the lit block's waveform). */
  songSegmentProgress?: (segment: number) => number | null
  /** Tap on a board block (the connected view seeks the song there). Default: the board plays the lone snippet. */
  onTapSegment?: (segment: number) => void
  /** Per-frame song position for the now-playing bar (md+). */
  songProgress?: SongProgressFn
  effects?: Partial<RevealEffects>
  className?: string
}

const NO_EFFECTS: RevealEffects = { sfx: playSfx, pulse: () => {} }

/** Same array reference for as long as `key` (its content) doesn't change. */
function useStableArray<T>(value: T[] | null | undefined, key: string): T[] | null {
  const [stable, setStable] = useState(() => ({ key, value: value ?? null }))
  if (stable.key !== key) {
    const next = { key, value: value ?? null }
    setStable(next)
    return next.value
  }
  return stable.value
}

function safe(fn: () => void) {
  try {
    fn()
  } catch {
    // effects are decoration
  }
}

function vibrate(ms: number) {
  try {
    // Without a prior gesture Chrome blocks (and logs) the call: skip it.
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    if (activation && !activation.hasBeenActive) return
    navigator.vibrate?.(ms)
  } catch {
    // unsupported
  }
}

export function RevealLayout(props: RevealLayoutProps) {
  const model = useMemo(() => buildRevealModel(props.room, props.me), [props.room, props.me])
  if (!model) return null
  return <RevealContent {...props} model={model} key={`${model.round}:${model.track.id}`} />
}

function RevealContent({
  room,
  now,
  isHost,
  onNext,
  accent: accentProp,
  songPlaying = false,
  songPending = false,
  songPaused = false,
  onToggleSong,
  songSegment = -1,
  songSegmentProgress,
  onTapSegment,
  songProgress,
  effects,
  className,
  model,
}: RevealLayoutProps & { model: RevealModel }) {
  const t = useT()
  const locale = useLocale()
  const reduce = useReducedMotion()
  const accent = accentProp ?? DEFAULT_COVER_COLORS
  const personal = model.mode === 'player' && !!model.myOrder && !!model.data
  const n = model.n

  // Mount-time decision: replay the choreography or jump to the end state.
  const nextAt = room.phase.kind === 'reveal' ? room.phase.nextAt : null
  const [skip] = useState(() => !!reduce || shouldSkipChoreography(nextAt, now, REVEAL_AUTO_ADVANCE_MS))
  const timeline = useMemo(() => buildTimeline(n, personal), [n, personal])

  // Network updates re-create every array: keep the board's inputs referentially
  // stable, otherwise it would treat the reveal reorder as a brand-new round.
  const data = model.data
  const segKey = data ? `${data.track.id}|${data.segments.map((s) => `${s.start},${s.end}`).join(';')}` : ''
  // …and re-snapped onto this peer's own decode (same array on the host / same decoder).
  const segments = useLocalSegments(data ? `track:${data.track.id}` : null, useStableArray<Segment>(data?.segments, segKey))
  const hues = useStableArray<number>(data?.hues, `${segKey}|${data?.hues.join(',') ?? ''}`)
  const myOrder = useStableArray<number>(model.myOrder, model.myOrder?.join(',') ?? '')

  const fx = useRef<RevealEffects>(NO_EFFECTS)
  useLayoutEffect(() => {
    fx.current = { ...NO_EFFECTS, ...effects }
  })

  // --- confetti -----------------------------------------------------------------
  const confettiRef = useRef<RevealConfetti | null>(null)
  useEffect(() => {
    return () => {
      confettiRef.current?.destroy()
      confettiRef.current = null
    }
  }, [])
  const scoreRef = useRef<HTMLDivElement>(null)

  // --- auto-scroll (stacked layouts) until the user scrolls on their own -------------
  const rootRef = useRef<HTMLDivElement>(null)
  const leadRef = useRef<HTMLDivElement>(null)
  const userScrolled = useRef(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const mark = () => {
      userScrolled.current = true
    }
    el.addEventListener('wheel', mark, { passive: true })
    el.addEventListener('touchstart', mark, { passive: true })
    el.addEventListener('keydown', mark)
    return () => {
      el.removeEventListener('wheel', mark)
      el.removeEventListener('touchstart', mark)
      el.removeEventListener('keydown', mark)
    }
  }, [])
  const revealInView = useCallback((target: HTMLElement | null) => {
    const root = rootRef.current
    if (!root || !target || userScrolled.current) return
    if (root.scrollHeight <= root.clientHeight + 4) return
    try {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
    } catch {
      // old browsers
    }
  }, [reduce])

  // --- choreography cues ---------------------------------------------------------------
  const marks = model.myMarks
  const streakList = useMemo(() => (marks ? streaks(marks) : []), [marks])
  const onCue = (cue: RevealCue) => {
    const { sfx, pulse } = fx.current
    switch (cue.type) {
      case 'board':
        // The song is out: a light burst behind the cover flip.
        safe(() => pulse(0.8))
        break
      case 'mark': {
        const m = marks?.[cue.index]
        if (m === 'correct') {
          const s = streakList[cue.index] ?? 0
          safe(() => sfx('correct', { pitch: streakPitch(s, n), gain: 0.9 }))
          safe(() => pulse(Math.min(0.55, 0.16 + s * 0.05)))
        } else if (m === 'wrong') {
          safe(() => sfx('wrong', { gain: 0.85 }))
          vibrate(10)
        }
        break
      }
      case 'sort':
        if (marks?.some((m) => m === 'wrong')) safe(() => sfx('pickup', { gain: 0.8 }))
        break
      case 'score':
        revealInView(scoreRef.current)
        break
      case 'lead':
        safe(() => sfx('pop', { gain: 0.55 }))
        break
      case 'ranks': {
        if (model.myRow && model.myRow.rankDelta > 0) safe(() => sfx('swap', { pitch: 1.3 }))
        // Stacked layouts scroll on to the leaderboard; where it sits beside the
        // score (desktop) the score keeps the stage.
        const lead = leadRef.current
        const score = scoreRef.current
        const beside = !!lead && !!score && lead.getBoundingClientRect().left >= score.getBoundingClientRect().right - 1
        if (!beside) revealInView(lead)
        break
      }
      case 'done':
        break
    }
  }
  const progress = useRevealProgress(timeline, skip, onCue)

  // Count-up ticks: at most ~one every 3 % of the way, so the ease-out tail doesn't buzz.
  const lastTick = useRef(-1)
  const onScoreTick = useCallback((v: number, target: number) => {
    const frac = target > 0 ? Math.max(0, Math.min(1, v / target)) : 0
    if (frac - lastTick.current < 0.03 && frac < 1) return
    lastTick.current = frac
    safe(() => fx.current.sfx('score', { pitch: 0.85 + frac * 0.7, gain: 0.7 }))
  }, [])
  const perfect = !!model.breakdown?.perfect
  const onScoreDone = useCallback(() => {
    if (!perfect || skip) return
    safe(() => fx.current.sfx('fanfare'))
    safe(() => fx.current.pulse(1.3))
    if (!confettiRef.current) confettiRef.current = createRevealConfetti()
    const r = scoreRef.current?.getBoundingClientRect()
    const origin = r
      ? { x: (r.left + r.width / 2) / window.innerWidth, y: Math.max(0.2, (r.top + r.height * 0.3) / window.innerHeight) }
      : { x: 0.5, y: 0.45 }
    confettiRef.current.burst(origin, [accent.primary, accent.secondary])
  }, [perfect, skip, accent.primary, accent.secondary])

  // --- board inputs --------------------------------------------------------------------
  // After the sort beat the board shows the right order; the player can flip back to
  // their own arrangement (the blocks fly between the two with the board's FLIP).
  const [chosenView, setChosenView] = useState<BoardView | null>(null)
  const view: BoardView = progress.sorted ? (chosenView ?? 'correct') : 'mine'
  const correctOrder = useMemo(() => (myOrder ? boardOrderFor(myOrder, 'correct') : null), [myOrder])
  const boardOrder = (view === 'correct' ? correctOrder : myOrder) ?? []
  const sortedMarks = useMemo(() => (myOrder ? sortedViewMarks(myOrder) : null), [myOrder])
  const boardMarks = useMemo<(RevealMark | null)[] | null>(() => {
    if (!marks) return null
    if (!progress.sorted) return marks.map((m, i) => (i < progress.marks ? m : null))
    return view === 'correct' ? sortedMarks : marks
  }, [marks, sortedMarks, progress.sorted, progress.marks, view])
  // `locale` (here and below): the memoized values hold text, recomputed on a language change.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => (myOrder && progress.sorted ? boardLabels(myOrder, view) : null), [myOrder, progress.sorted, view, locale])
  const shownCorrect = boardMarks ? boardMarks.filter((m) => m === 'correct').length : 0
  const shownWrong = boardMarks ? boardMarks.filter((m) => m === 'wrong').length : 0
  const md = useMediaQuery('(min-width: 768px)')
  const wideHeader = useIsWide()
  const xl = useMediaQuery('(min-width: 1280px)')
  const threeCols = useMediaQuery('(min-width: 1440px) and (min-height: 800px)')
  // Desktop players: three columns on big screens, the song on a banner otherwise (see reveal.css).
  const songVariant: SongCardVariant = !xl ? 'row' : personal && !threeCols ? 'banner' : 'stack'
  const viewOptions = useMemo(
    () =>
      [
        { value: 'mine' as const, label: t(md ? 'reveal.board.toggle.mine' : 'reveal.board.toggle.mineShort'), ariaLabel: t('reveal.board.titleMine') },
        { value: 'correct' as const, label: t(md ? 'reveal.board.toggle.correct' : 'reveal.board.toggle.correctShort'), ariaLabel: t('reveal.board.titleCorrect') },
      ] satisfies { value: BoardView; label: string; ariaLabel: string }[],
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [md, t, locale],
  )

  const secondsLeft = secondsUntil(nextAt, now)
  const trackKey = `track:${model.track.id}`
  const canHover = useCanHover()
  const facts = useMemo(() => {
    const out = [t('reveal.song.snippets', { count: n })]
    if (SNIPPET_DIFFICULTY[n]) out.push(t(SNIPPET_DIFFICULTY[n]))
    if (data && data.bpm > 0) out.push(t('reveal.song.bpm', { bpm: Math.round(data.bpm) }))
    return out
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [n, data, t, locale])

  // Round progress dots: my perfect rounds in gold.
  const myPerfect = useMemo(() => {
    const set = new Set<number>()
    room.results.forEach((rs, i) => {
      if (rs?.some((r) => r.playerId === model.me && r.perfect)) set.add(i)
    })
    return set
  }, [room.results, model.me])
  const doneTone = useCallback((i: number) => (myPerfect.has(i) ? 'gold' : 'lime') as 'gold' | 'lime', [myPerfect])

  const enter = !skip && !reduce
  const section = (delay: number) =>
    enter
      ? { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring' as const, stiffness: 240, damping: 26, delay } }
      : { initial: false as const }

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className={cn('rv-root relative h-dvh w-full overflow-x-hidden overflow-y-auto', className)}
        data-mode={model.mode}
        data-stage={progress.done ? 'done' : progress.ranks ? 'ranks' : progress.lead ? 'lead' : progress.score ? 'score' : progress.sorted ? 'sorted' : progress.board ? 'marks' : 'song'}
      >
        <div className="rv-shell mx-auto flex min-h-full w-full max-w-[1560px] flex-col px-safe-4 pt-safe-3 md:px-safe-8 md:pt-safe-6 xl:px-safe-10">
          {/* Header */}
          <motion.header className="flex items-center gap-4 md:gap-6" {...section(0)}>
            <div className="min-w-0">
              <p className="eyebrow">{t('reveal.header.eyebrow')}</p>
              <h1 className="display display-skew mt-1 text-[22px] text-white md:text-[26px]">
                {rich(t('reveal.header.round', { round: model.round + 1, total: model.totalRounds }), {
                  dim: (c) => <span className="text-ink-400">{c}</span>,
                })}
              </h1>
            </div>
            <ProgressDots total={model.totalRounds} current={model.round} doneTone={doneTone} size="md" className="mt-4 hidden min-[380px]:flex" />
            {/* Exit menu (only inside the round screen's provider) + the inline sound control. */}
            <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
              <GameMenuButton size={wideHeader ? 'md' : 'sm'} />
              <SoundControls placement="inline" />
            </div>
          </motion.header>

          <main className="rv-grid mt-3 min-h-0 flex-1 pb-4 md:mt-5 xl:pb-2" data-mode={model.mode}>
            <SongCard
              className="rv-area-song"
              track={model.track}
              accent={accent}
              playing={songPlaying && !songPending}
              pending={songPlaying && songPending}
              paused={songPaused}
              onToggleSong={onToggleSong}
              songProgress={songProgress}
              facts={facts}
              animate={enter}
              variant={songVariant}
            />

            {personal && segments && hues && myOrder ? (
              <>
                <motion.section className="rv-area-board flex min-h-0 flex-col" aria-label={t('reveal.board.region')} {...section(0.3)}>
                  <div className="mb-4 px-1 xl:mt-4">
                    <div className="flex min-h-10 items-center justify-between gap-3">
                      <h3 className="display display-skew min-w-0 truncate text-[13px] text-white md:text-[15px]">
                        {t(view === 'correct' ? 'reveal.board.titleCorrect' : 'reveal.board.titleMine')}
                      </h3>
                      {progress.sorted ? (
                        <motion.div
                          className="shrink-0"
                          initial={enter ? { opacity: 0, scale: 0.92 } : false}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        >
                          <Segmented
                            size="sm"
                            label={t('reveal.board.toggle.label')}
                            options={viewOptions}
                            value={view}
                            onChange={setChosenView}
                            className="w-[172px] md:w-[252px]"
                          />
                        </motion.div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1.5" aria-live="polite">
                          <Tally tone="lime" icon="check" value={shownCorrect} label={t('reveal.board.tallyCorrect', { count: shownCorrect })} />
                          <Tally tone="coral" icon="x" value={shownWrong} label={t('reveal.board.tallyWrong', { count: shownWrong })} />
                        </div>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] font-semibold text-ink-400 md:text-xs">
                      {boardHint(model, progress.sorted, view, canHover)}
                    </p>
                  </div>
                  <BoardStage
                    className="xl:min-h-0 xl:flex-1"
                    trackKey={trackKey}
                    segments={segments}
                    hues={hues}
                    order={boardOrder}
                    marks={boardMarks}
                    labels={labels}
                    nowPlaying={progress.sorted ? songSegment : -1}
                    nowPlayingProgress={songSegmentProgress}
                    onTapSegment={onTapSegment}
                    visible={progress.board}
                    sorted={progress.sorted}
                  />
                </motion.section>

                {model.breakdown && (
                  <motion.div ref={scoreRef} className="rv-area-score rv-scroll-target" {...section(0.45)}>
                    <ScorePanel
                      breakdown={model.breakdown}
                      row={model.myRow}
                      counting={progress.score}
                      durationS={skip ? 0 : timeline.scoreDurationS}
                      showTotal={progress.ranks}
                      onTick={skip ? undefined : onScoreTick}
                      onDone={onScoreDone}
                    />
                  </motion.div>
                )}
              </>
            ) : (
              <motion.div className="rv-area-board" {...section(0.3)}>
                <SpectatorNote mode={model.mode} />
              </motion.div>
            )}

            <motion.div ref={leadRef} className="rv-area-lead rv-scroll-target flex min-h-0 flex-col" {...section(0.55)}>
              <RoundLeaderboard
                className="xl:flex-1"
                rows={model.rows}
                prevOrder={model.prevOrder}
                me={model.me}
                round={model.round}
                segments={segments}
                hues={hues}
                primed={progress.board}
                entered={progress.lead}
                ranked={progress.ranks}
              />
            </motion.div>
          </main>

          <p className="sr-only" aria-live="polite">
            {progress.score && model.breakdown ? resultAnnouncement(model.breakdown) : ''}
          </p>

          <motion.footer className="rv-footer-wrap" {...section(0.2)}>
            <RevealFooter isHost={isHost} isLast={model.isLast} secondsLeft={secondsLeft} onNext={onNext} />
          </motion.footer>
        </div>
      </div>
    </MotionConfig>
  )
}

/** One line under the board title: how it went, and what a click (mouse) / tap (touch) does. */
function boardHint(model: RevealModel, sorted: boolean, view: BoardView, canHover: boolean): string {
  const input = canHover ? 'hover' : 'touch'
  const b = model.breakdown
  if (!sorted || !b) return t(`reveal.board.hint.intro.${input}`)
  if (view === 'mine') return t(`reveal.board.hint.mine.${input}`)
  if (b.perfect) return t(`reveal.board.hint.perfect.${input}`)
  if (b.correct === 0) return t(`reveal.board.hint.none.${input}`)
  return t(`reveal.board.hint.partial.${input}`, { count: b.correct, n: b.n })
}

function resultAnnouncement(b: NonNullable<RevealModel['breakdown']>): string {
  const pairs = t('reveal.announce.pairs', { count: b.pairs })
  let result = t('reveal.announce.result', { count: b.points, points: formatPoints(b.points), correct: b.correct, n: b.n, pairs })
  if (b.perfect) result = t('reveal.announce.perfect', { result })
  if (b.timedOut) result = t('reveal.announce.timedOut', { result })
  return result
}

/** `label`: the whole screen-reader text, count included ("3 al posto giusto"). */
function Tally({ tone, icon, value, label }: { tone: 'lime' | 'coral'; icon: 'check' | 'x'; value: number; label: string }) {
  return (
    <span className="rv-tally rv-tnum inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-extrabold" data-tone={tone} aria-label={label}>
      <Icon name={icon} size={13} strokeWidth={3.2} />
      {value}
    </span>
  )
}

function SpectatorNote({ mode }: { mode: RevealModel['mode'] }) {
  const t = useT()
  const spectator = mode === 'spectator'
  return (
    <div className="glass-flat flex items-center gap-4 rounded-panel p-4 md:p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet/20 text-violet-bright">
        <Icon name={spectator ? 'eye' : 'clock'} size={24} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="display display-skew text-sm text-white md:text-base">{t(spectator ? 'reveal.spectator.title' : 'reveal.missing.title')}</p>
        <p className="mt-1 text-sm font-semibold text-ink-200">
          {t(spectator ? 'reveal.spectator.body' : 'reveal.missing.body')}
        </p>
      </div>
    </div>
  )
}
