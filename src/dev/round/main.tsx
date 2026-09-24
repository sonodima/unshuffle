// Round lab: renders RoundView from fixtures with a controllable host clock and
// the real audio engine on a real Deezer preview. Query params:
//   s=flow|preparing|slicing|syncing|prep-error|intro-card|intro|playing|final|mine-first|submitted|spectator|audioerror|timeup|solo|n16
//   t=<ms offset from FX_NOW>   live=0|1 (clock runs; default: only for flow)
//   engine=real|mock|none       bg=shader|css   ui=0 (hide lab controls)
import { MotionConfig } from 'motion/react'
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { audioEngine } from '../../audio/engine'
import type { AudioEngine } from '../../audio/engine'
import { sfx as appSfx } from '../../audio/sfx'
import type { SfxName } from '../../audio/sfx'
import { BoardAudioProvider } from '../../components/board'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import { FX_NOW, fxIntro, fxPlaying, fxPlayingFinal, fxPreparing, fxRound, fxTrack } from '../fixtures'
import type { AudioStatus } from '../../game/store'
import type { RoomState, RoundPublic } from '../../game/types'
import { randomHues, scrambledOrder } from '../../game/shuffle'
import { RoundView } from '../../screens/round/RoundView'
import { createMockEngine, synthSong } from '../board/mockEngine'
import { loadPreview } from './deezer'
import { resetClock } from '../../game/clock'
import { useGame } from '../../game/store'
import { RoundScreen } from '../../screens/round/RoundScreen'

const params = new URLSearchParams(location.search)
const initialScenario = params.get('s') ?? 'flow'
const engineMode = params.get('engine') ?? 'real'
const showUi = params.get('ui') !== '0'
const bgMode = params.get('bg') ?? 'shader'

const mock = createMockEngine()
const engine: AudioEngine | null = engineMode === 'none' ? null : engineMode === 'mock' ? mock : audioEngine
const KEY = `track:${fxTrack.id}`
const sfxLog: string[] = []

// ---- clock ------------------------------------------------------------------

const clockState = { base: FX_NOW + Number(params.get('t') ?? 0), perf: performance.now(), live: params.get('live') === '1' || (params.get('live') !== '0' && initialScenario === 'flow') }
function labNow(): number {
  return clockState.base + (clockState.live ? performance.now() - clockState.perf : 0)
}
function setLabTime(ms: number, live = clockState.live) {
  clockState.base = ms
  clockState.perf = performance.now()
  clockState.live = live
}

// ---- scenarios --------------------------------------------------------------

interface Scene {
  room: RoomState
  me: string
  submitted: boolean
  arrangement: number[]
  audio: Record<number, AudioStatus>
}

const roundCache = new Map<number, RoundPublic>()
function withRound(n: number): RoundPublic {
  if (n === fxRound.segments.length) return fxRound
  const cached = roundCache.get(n)
  if (cached) return cached
  const round = makeRound(n)
  roundCache.set(n, round)
  return round
}

function makeRound(n: number): RoundPublic {
  const len = 28 / n
  return {
    ...fxRound,
    segments: Array.from({ length: n }, (_, i) => ({ index: i, start: 1 + i * len, end: 1 + (i + 1) * len, beats: 4 })),
    initialOrder: scrambledOrder(n),
    hues: randomHues(n),
  }
}

/** A round whose audio never loads (no buffer under its key). */
const brokenTrack = { ...fxTrack, id: 999_001 }
const brokenRound: RoundPublic = { ...fxRound, track: brokenTrack }

function scene(name: string, audioStatus: AudioStatus): Scene {
  const base: Scene = { room: fxPlaying, me: 'p-host', submitted: false, arrangement: [...fxRound.initialOrder], audio: { [fxTrack.id]: audioStatus } }
  switch (name) {
    case 'preparing':
      return { ...base, room: { ...fxPreparing, phase: { kind: 'preparing', round: 2, message: 'Scelgo le canzoni…' } }, audio: {} }
    case 'slicing':
      return { ...base, room: { ...fxPreparing, tracks: fxIntro.tracks, ready: { 'p-2': true } }, audio: { [fxTrack.id]: 'loading' } }
    case 'syncing':
      return {
        ...base,
        room: { ...fxPreparing, phase: { kind: 'preparing', round: 2, message: 'Aspetto che tutti siano pronti…' }, tracks: fxIntro.tracks, rounds: fxIntro.rounds, ready: { 'p-host': true, 'p-2': true } },
        audio: { [fxTrack.id]: 'ready' },
      }
    case 'prep-error':
      return { ...base, room: { ...fxPreparing, tracks: [fxTrack, fxTrack, brokenTrack], rounds: [null, null, brokenRound], ready: { 'p-2': true, 'p-3': true } }, audio: { [brokenTrack.id]: 'error' } }
    case 'intro-card':
      return { ...base, room: { ...fxIntro, phase: { kind: 'intro', round: 2, endsAt: FX_NOW + 3600 } } }
    case 'intro':
      return { ...base, room: fxIntro }
    case 'intro-last':
      return { ...base, room: { ...fxIntro, phase: { kind: 'intro', round: 4, endsAt: FX_NOW + 2400 }, rounds: [null, null, null, null, fxRound] } }
    case 'final':
      return { ...base, room: fxPlayingFinal }
    case 'mine-first':
      return {
        ...base,
        submitted: true,
        room: {
          ...fxPlayingFinal,
          phase: { kind: 'playing', round: 2, startedAt: FX_NOW - 30_000, endsAt: FX_NOW + 13_000, firstSubmit: { playerId: 'p-host', at: FX_NOW - 2000 } },
          submissions: { 'p-host': { submitted: true, atMs: 28_000 } },
        },
      }
    case 'submitted':
      return {
        ...base,
        submitted: true,
        room: { ...fxPlayingFinal, submissions: { 'p-2': { submitted: true, atMs: 28_000 }, 'p-host': { submitted: true, atMs: 31_000 } }, phase: { ...fxPlayingFinal.phase, firstSubmit: { playerId: 'p-2', at: FX_NOW - 9000 } } as RoomState['phase'] },
      }
    case 'spectator':
      return { ...base, me: 'p-5' }
    case 'audioerror':
      return { ...base, room: { ...fxPlaying, rounds: [null, null, brokenRound] }, audio: { [brokenTrack.id]: 'error' } }
    case 'timeup':
      return { ...base, room: { ...fxPlaying, phase: { ...fxPlaying.phase, endsAt: FX_NOW - 200 } as RoomState['phase'] } }
    case 'solo':
      return { ...base, room: { ...fxPlaying, players: fxPlaying.players.slice(0, 1), submissions: {} } }
    case 'n16': {
      const r = withRound(16)
      return { ...base, room: { ...fxPlaying, settings: { ...fxPlaying.settings, snippets: 16 }, rounds: [null, null, r] }, arrangement: r.initialOrder }
    }
    case 'n6': {
      const r = withRound(6)
      return { ...base, room: { ...fxPlaying, settings: { ...fxPlaying.settings, snippets: 6 }, rounds: [null, null, r] }, arrangement: r.initialOrder }
    }
    default:
      return base
  }
}

// ---- flow: a whole round against the lab clock ---------------------------------

const FLOW_TIMELINE = { picking: 1400, slicing: 1600, syncing: 1200, intro: 4000, play: 40_000, firstBy: 9000, reveal: 3500 }

function flowScene(t0: number, now: number, mySubmitAt: number | null, arrangement: number[], audioStatus: AudioStatus): Scene {
  const T = FLOW_TIMELINE
  const tPrep = t0
  const tSlice = tPrep + T.picking
  const tSync = tSlice + T.slicing
  const tIntro = tSync + T.syncing
  const tPlay = tIntro + T.intro
  const tFirst = tPlay + T.firstBy
  const base = { ...fxPlaying, settings: { ...fxPlaying.settings, roundTime: T.play / 1000 } }
  const audio = { [fxTrack.id]: now < tSlice ? ('idle' as AudioStatus) : audioStatus }
  const common = { me: 'p-host', arrangement, audio, submitted: mySubmitAt != null }
  if (now < tSlice) return { ...common, room: { ...base, phase: { kind: 'preparing', round: 2, message: 'Scelgo le canzoni…' }, tracks: [], rounds: [], ready: {}, submissions: {} } }
  if (now < tSync) return { ...common, room: { ...base, phase: { kind: 'preparing', round: 2, message: 'Sto affettando la traccia…' }, rounds: [], ready: { 'p-2': true }, submissions: {} } }
  if (now < tIntro)
    return { ...common, room: { ...base, phase: { kind: 'preparing', round: 2, message: 'Aspetto che tutti siano pronti…' }, ready: { 'p-host': true, 'p-2': true, 'p-3': now > tSync + 600 }, submissions: {} } }
  if (now < tPlay) return { ...common, room: { ...base, phase: { kind: 'intro', round: 2, endsAt: tPlay }, submissions: {} } }
  const first = mySubmitAt != null && mySubmitAt < tFirst ? { playerId: 'p-host', at: mySubmitAt } : now >= tFirst ? { playerId: 'p-2', at: tFirst } : null
  const endsAt = first ? Math.min(tPlay + T.play, first.at + base.settings.finalTimer * 1000) : tPlay + T.play
  const submissions: RoomState['submissions'] = {}
  if (now >= tFirst) submissions['p-2'] = { submitted: true, atMs: tFirst - tPlay }
  if (mySubmitAt != null) submissions['p-host'] = { submitted: true, atMs: mySubmitAt - tPlay }
  if (now < endsAt + 300) return { ...common, room: { ...base, phase: { kind: 'playing', round: 2, startedAt: tPlay, endsAt, firstSubmit: first }, submissions } }
  return { ...common, room: { ...base, phase: { kind: 'reveal', round: 2, nextAt: null }, submissions } }
}

// ---- lab --------------------------------------------------------------------

function useLabAudio(): AudioStatus {
  const [status, setStatus] = useState<AudioStatus>('loading')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!engine) return setStatus('error')
      try {
        if (engine === mock) mock.inject(KEY, synthSong(mock.context()))
        else await engine.load(KEY, await loadPreview(fxTrack.id))
        if (!cancelled) setStatus('ready')
      } catch (e) {
        console.warn('[round lab] audio', e)
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return status
}

function Lab() {
  const [name, setName] = useState(initialScenario)
  const [now, setNow] = useState(labNow)
  const [flowT0, setFlowT0] = useState(() => labNow())
  const [myArrangement, setMyArrangement] = useState<number[] | null>(null)
  const [mySubmitAt, setMySubmitAt] = useState<number | null>(null)
  const loadStatus = useLabAudio()

  useEffect(() => {
    const id = setInterval(() => setNow(labNow()), 250)
    return () => clearInterval(id)
  }, [])

  const s = useMemo(() => {
    if (name === 'flow') return flowScene(flowT0, now, mySubmitAt, myArrangement ?? [...fxRound.initialOrder], loadStatus)
    const sc = scene(name, loadStatus)
    return { ...sc, arrangement: myArrangement ?? sc.arrangement, submitted: sc.submitted || mySubmitAt != null }
  }, [name, now, flowT0, mySubmitAt, myArrangement, loadStatus])

  const restart = useCallback((next: string) => {
    setName(next)
    setMyArrangement(null)
    setMySubmitAt(null)
    if (next === 'flow') {
      setLabTime(labNow(), true)
      setFlowT0(labNow())
    }
    setNow(labNow())
  }, [])

  const room = useMemo(() => {
    // Local submit shows up in the room like the host would echo it.
    if (mySubmitAt == null || name === 'flow' || s.room.phase.kind !== 'playing') return s.room
    return { ...s.room, submissions: { ...s.room.submissions, [s.me]: { submitted: true, atMs: 30_000 } } }
  }, [s, mySubmitAt, name])

  const api = useRef({})
  useEffect(() => {
    api.current = {
      scenario: restart,
      setTime: (offset: number, live = false) => {
        setLabTime(FX_NOW + offset, live)
        setNow(labNow())
      },
      sfx: sfxLog,
      audioReady: () => loadStatus === 'ready',
      phase: () => room.phase.kind,
    }
    ;(window as unknown as { __round: unknown }).__round = api.current
  })

  const sfx = useCallback((n: SfxName, o?: { pitch?: number; gain?: number }) => {
    sfxLog.push(n)
    try {
      appSfx.play(n, o)
    } catch {
      // Lab: SFX optional.
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <BoardAudioProvider engine={engine} sfx={sfx}>
        {bgMode === 'shader' ? <ShaderBackground /> : <div className="lab-bg" aria-hidden />}
        <RoundView
          room={room}
          me={s.me}
          now={now}
          clock={labNow}
          arrangement={s.arrangement}
          submitted={s.submitted}
          audio={s.audio}
          onArrange={(o) => setMyArrangement(o)}
          onSubmit={() => setMySubmitAt(labNow())}
          onRetryAudio={() => new Promise((resolve, reject) => setTimeout(() => (engine?.has(KEY) ? resolve(true) : reject(new Error('ancora niente'))), 900))}
          reveal={<RevealPlaceholder onNext={() => restart('flow')} />}
        />
        {showUi && <Controls current={name} onPick={restart} />}
      </BoardAudioProvider>
    </MotionConfig>
  )
}

function RevealPlaceholder({ onNext }: { onNext: () => void }) {
  return (
    <div className="grid h-full place-items-center">
      <button className="rounded-full bg-white/10 px-6 py-3 font-display text-sm font-extrabold uppercase" onClick={onNext}>
        Reveal (placeholder) · ricomincia
      </button>
    </div>
  )
}

const SCENARIOS = ['flow', 'preparing', 'slicing', 'syncing', 'prep-error', 'intro-card', 'intro', 'intro-last', 'playing', 'final', 'mine-first', 'submitted', 'spectator', 'audioerror', 'timeup', 'solo', 'n6', 'n16']

function Controls({ current, onPick }: { current: string; onPick: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed right-2 bottom-2 z-[1000] flex max-w-[92vw] flex-col items-end gap-1.5 text-[11px]">
      {open && (
        <div className="flex max-w-[420px] flex-wrap justify-end gap-1 rounded-2xl bg-black/80 p-2 backdrop-blur">
          {SCENARIOS.map((s) => (
            <button key={s} onClick={() => onPick(s)} className={`rounded-full px-2.5 py-1 font-bold ${s === current ? 'bg-violet text-white' : 'bg-white/10 text-ink-100'}`}>
              {s}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} className="rounded-full bg-black/70 px-3 py-1.5 font-bold text-ink-100">
        lab · {current}
      </button>
    </div>
  )
}

const css = `
.lab-bg { position: fixed; inset: 0; z-index: -1; background:
  radial-gradient(1100px 620px at 12% -12%, rgb(123 92 255 / .38), transparent 62%),
  radial-gradient(900px 560px at 108% 112%, rgb(255 63 209 / .26), transparent 60%),
  radial-gradient(700px 400px at 90% 0%, rgb(46 230 255 / .10), transparent 60%),
  var(--color-ink-950); }
`
const style = (document.getElementById('round-lab-style') as HTMLStyleElement | null) ?? document.createElement('style')
style.id = 'round-lab-style'
style.textContent = css
document.head.appendChild(style)

/** ?connected=1: the real RoundScreen over a store seeded from the scenario (no network session). */
function ConnectedLab() {
  const loadStatus = useLabAudio()
  useState(() => {
    const sc = scene(initialScenario, 'ready')
    const r = 'round' in sc.room.phase ? sc.room.phase.round : -1
    resetClock(FX_NOW + Number(params.get('t') ?? 0) - Date.now())
    useGame.setState({ room: sc.room, me: sc.me, arrangement: sc.arrangement, arrangementRound: r, submitted: sc.submitted, audio: sc.audio })
    return null
  })
  useEffect(() => {
    if (loadStatus === 'ready') useGame.setState({ audio: { ...useGame.getState().audio, [fxTrack.id]: 'ready' } })
    ;(window as unknown as { __round: unknown }).__round = { audioReady: () => loadStatus === 'ready', sfx: sfxLog, phase: () => useGame.getState().room?.phase.kind }
  }, [loadStatus])
  return (
    <MotionConfig reducedMotion="user">
      {bgMode === 'shader' ? <ShaderBackground /> : <div className="lab-bg" aria-hidden />}
      <RoundScreen />
    </MotionConfig>
  )
}

const w = window as unknown as { __roundLabRoot?: ReturnType<typeof createRoot> }
w.__roundLabRoot ??= createRoot(document.getElementById('root') as HTMLElement)
w.__roundLabRoot.render(<StrictMode>{params.get('connected') === '1' ? <ConnectedLab /> : <Lab />}</StrictMode>)
