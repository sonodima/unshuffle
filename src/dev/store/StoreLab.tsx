// Store lab: exercises every selector hook against fixture states (render
// counters catch selector loops) and drives a real host/client session over
// PeerJS for end-to-end checks. Dev-only, never part of the build.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AVATARS, PLAYER_COLORS, REACTIONS } from '../../game/constants'
import * as selectors from '../../game/selectors'
import { useGame } from '../../game/store'
import type { GameStore } from '../../game/store'
import type { RoomState } from '../../game/types'
import { FX_NOW, fxFinal, fxIntro, fxLobby, fxPlaying, fxPlayingFinal, fxPreparing, fxReveal } from '../fixtures'

const FIXTURES: Record<string, RoomState> = {
  lobby: fxLobby,
  preparing: fxPreparing,
  intro: fxIntro,
  playing: fxPlaying,
  finalTimer: fxPlayingFinal,
  reveal: fxReveal,
  final: fxFinal,
}

/** Shift fixture timestamps so timers are live relative to now. */
function liveFixture(room: RoomState): RoomState {
  const shift = Date.now() - FX_NOW
  const phase = { ...room.phase } as Record<string, unknown>
  for (const k of ['endsAt', 'startedAt', 'nextAt']) if (typeof phase[k] === 'number') phase[k] = (phase[k] as number) + shift
  if (phase.firstSubmit && typeof phase.firstSubmit === 'object') {
    const fs = phase.firstSubmit as { playerId: string; at: number }
    phase.firstSubmit = { ...fs, at: fs.at + shift }
  }
  return { ...room, phase: phase as RoomState['phase'], seq: room.seq + Math.floor(Math.random() * 1000) }
}

function setFixture(name: string, meId = 'p-host') {
  const room = liveFixture(FIXTURES[name])
  const round = selectors.getCurrentRound(room)
  const patch: Partial<GameStore> = {
    role: meId === room.hostId ? 'host' : 'client',
    connection: 'open',
    error: null,
    room,
    roomCode: room.code,
    me: meId,
    arrangement: round ? [...round.initialOrder] : [],
    arrangementRound: round ? round.index : -1,
    submitted: !!room.submissions[meId]?.submitted,
    audio: Object.fromEntries(room.tracks.map((t, i) => [t.id, i % 2 ? 'loading' : 'ready'])),
  }
  useGame.setState(patch)
}

declare global {
  interface Window {
    __lab: {
      useGame: typeof useGame
      selectors: typeof selectors
      setFixture: typeof setFixture
      renders: () => Record<string, number>
    }
  }
}

const renderCounts: Record<string, number> = {}
window.__lab = { useGame, selectors, setFixture, renders: () => ({ ...renderCounts }) }

/** Commits per component: a selector loop shows up as a count that keeps climbing while idle. */
function useRenderCount(name: string): number {
  useEffect(() => {
    renderCounts[name] = (renderCounts[name] ?? 0) + 1
  })
  return renderCounts[name] ?? 0
}

function Card({ name, children }: { name: string; children: ReactNode }) {
  const renders = useRenderCount(name)
  return (
    <section data-card={name} className="rounded-2xl border border-white/10 bg-ink-900/70 p-3 backdrop-blur-xl">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] font-semibold tracking-wide text-cyan">{name}</h3>
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-ink-300">{renders}×</span>
      </header>
      <div className="font-mono text-[11px] leading-relaxed break-words text-ink-100">{children}</div>
    </section>
  )
}

const j = (v: unknown) => JSON.stringify(v)

function MeCard() {
  const me = selectors.useMe()
  const isHost = selectors.useIsHost()
  const active = selectors.useAmIActive()
  return (
    <Card name="useMe / useIsHost / useAmIActive">
      {me ? `${AVATARS[me.avatar]} ${me.name} · score ${me.score}` : '—'} · host {String(isHost)} · active {String(active)}
    </Card>
  )
}

function PhaseCard() {
  const phase = selectors.usePhase()
  const kind = selectors.usePhaseKind()
  const r = selectors.useRoundIndex()
  const round = selectors.useCurrentRound()
  return (
    <Card name="usePhase / useRoundIndex / useCurrentRound">
      {kind ?? '—'} · round {r} · {round ? `${round.track.title} (${round.segments.length} spezzoni)` : 'no round data'}
      <div className="text-ink-400">{j(phase)}</div>
    </Card>
  )
}

function TimerCard() {
  const phase = selectors.usePhase()
  const endsAt = phase && 'endsAt' in phase ? phase.endsAt : phase?.kind === 'reveal' ? phase.nextAt : null
  const ms = selectors.useRemainingMs(endsAt)
  const secs = selectors.useSecondsLeft(endsAt)
  return (
    <Card name="useRemainingMs / useSecondsLeft">
      <span className="text-2xl font-bold text-lime tabular-nums">{secs}s</span>{' '}
      <span className="text-ink-300 tabular-nums">{(ms / 1000).toFixed(1)}</span>
    </Card>
  )
}

function SecondsOnly() {
  const phase = selectors.usePhase()
  const endsAt = phase && 'endsAt' in phase ? phase.endsAt : null
  const secs = selectors.useSecondsLeft(endsAt)
  return <Card name="useSecondsLeft (isolated)">{secs}</Card>
}

function LeaderboardCard() {
  const lb = selectors.useLeaderboard()
  const standings = selectors.useStandings()
  return (
    <Card name="useLeaderboard / useStandings">
      {lb.map((p, i) => (
        <div key={p.id}>
          #{standings[i]?.rank} {p.name} — {p.score} ({Math.round((standings[i]?.totalTimeMs ?? 0) / 1000)}s, {standings[i]?.perfectRounds}★)
        </div>
      ))}
    </Card>
  )
}

function RoundStandingsCard() {
  const rows = selectors.useRoundStandings()
  const results = selectors.useRoundResults()
  const mine = selectors.useMyResult()
  return (
    <Card name="useRoundStandings / useRoundResults / useMyResult">
      {rows.map((r) => (
        <div key={r.player.id}>
          {r.rank}. {r.player.name} +{r.points} → {r.totalAfter} ({r.rankDelta > 0 ? '▲' : r.rankDelta < 0 ? '▼' : '='}
          {Math.abs(r.rankDelta)})
        </div>
      ))}
      <div className="text-ink-400">results {results.length} · mine {mine ? `${mine.points} pts` : '—'}</div>
    </Card>
  )
}

function WaitingCard() {
  const waiting = selectors.useWaitingFor()
  const first = selectors.useFirstSubmitter()
  const sub = selectors.useSubmission('p-2')
  return (
    <Card name="useWaitingFor / useFirstSubmitter / useSubmission">
      waiting: {waiting.map((p) => p.name).join(', ') || '—'} · first: {first?.name ?? '—'} · p-2: {j(sub)}
    </Card>
  )
}

function StatsCard() {
  const stats = selectors.useGameStats()
  return (
    <Card name="useGameStats">
      fastest {stats.fastest ? `${stats.fastest.player.name} ${stats.fastest.timeMs}ms` : '—'} · best{' '}
      {stats.bestRound ? `${stats.bestRound.player.name} ${stats.bestRound.points}` : '—'} · perfect {stats.totalPerfect}
    </Card>
  )
}

function AudioCard() {
  const current = selectors.useCurrentAudioStatus()
  const progress = selectors.useAudioProgress()
  const round = selectors.useCurrentRound()
  const byId = selectors.useAudioStatus(round?.track.id)
  return (
    <Card name="useCurrentAudioStatus / useAudioProgress / useAudioStatus">
      current {current} · by id {byId} · progress {Math.round(progress * 100)}%
    </Card>
  )
}

function MiscCard() {
  const players = selectors.usePlayers()
  const host = selectors.useHostPlayer()
  const code = selectors.useRoomCode()
  const settings = selectors.useSettings()
  const arrangement = selectors.useArrangement()
  const submitted = selectors.useSubmitted()
  const conn = selectors.useConnection()
  const role = selectors.useRole()
  const actions = selectors.useActions()
  return (
    <Card name="usePlayers / useHostPlayer / useRoomCode / useSettings / useArrangement / useActions">
      {code} · {role}/{conn} · {players.length} giocatori · host {host?.name} · {settings?.rounds} round · arr {j(arrangement)} ·
      submitted {String(submitted)} · actions {Object.keys(actions).length}
    </Card>
  )
}

function ToastsCard() {
  const toasts = selectors.useToasts()
  const dismiss = useGame((s) => s.dismissToast)
  return (
    <Card name="useToasts">
      {toasts.length === 0 && <span className="text-ink-400">nessun toast</span>}
      <div className="flex flex-col gap-1">
        {toasts.map((t) => (
          <button
            key={t.id}
            data-toast={t.event.type}
            onClick={() => dismiss(t.id)}
            className="rounded-lg bg-white/5 px-2 py-1 text-left hover:bg-white/10"
          >
            {t.event.type === 'reaction'
              ? t.event.emoji
              : t.event.type === 'info'
                ? t.event.message
                : 'name' in t.event
                  ? `${t.event.type}: ${t.event.name}`
                  : t.event.type}
          </button>
        ))}
      </div>
    </Card>
  )
}

function Btn({ children, onClick, tone = 'ghost', testId }: { children: ReactNode; onClick: () => void; tone?: 'ghost' | 'lime' | 'coral'; testId?: string }) {
  const tones = {
    ghost: 'bg-white/5 text-ink-50 hover:bg-white/10 border border-white/10',
    lime: 'bg-lime text-ink-950 hover:brightness-110',
    coral: 'bg-coral text-ink-950 hover:brightness-110',
  }
  return (
    <button data-testid={testId} onClick={onClick} className={`min-h-9 rounded-full px-3 text-xs font-bold ${tones[tone]}`}>
      {children}
    </button>
  )
}

function LivePanel() {
  useRenderCount('LivePanel')
  const { createRoom, joinRoom, leave, react, setProfile, rejoin, clearError } = selectors.useActions()
  const profile = selectors.useProfile()
  const connection = selectors.useConnection()
  const error = selectors.useError()
  const code = selectors.useRoomCode()
  const players = selectors.usePlayers()
  const [joinCode, setJoinCode] = useState('')
  const [status, setStatus] = useState('')
  const run = (label: string, p: Promise<unknown>) => {
    setStatus(`${label}…`)
    p.then(
      (v) => setStatus(`${label}: ok ${v ?? ''}`),
      (e: Error) => setStatus(`${label}: ${e.message}`),
    )
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 backdrop-blur-xl">
      <h2 className="mb-3 font-display text-sm font-extrabold tracking-wide text-ink-50 uppercase">Sessione reale (PeerJS)</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="grid size-9 place-items-center rounded-full text-lg"
          style={{ background: PLAYER_COLORS[profile.color] }}
        >
          {AVATARS[profile.avatar]}
        </span>
        <span data-testid="profile-name" className="font-sans text-sm font-bold text-ink-50">
          {profile.name}
        </span>
        <Btn onClick={() => setProfile({ avatar: (profile.avatar + 1) % AVATARS.length, color: (profile.color + 1) % PLAYER_COLORS.length })}>
          Cambia avatar
        </Btn>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn testId="create" tone="lime" onClick={() => run('createRoom', createRoom())}>
          Crea stanza
        </Btn>
        <input
          data-testid="code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="CODICE"
          className="h-9 w-28 rounded-full border border-white/10 bg-ink-950/60 px-3 font-mono text-xs text-ink-50 uppercase outline-none focus:border-cyan"
        />
        <Btn testId="join" onClick={() => run('joinRoom', joinRoom(joinCode))}>
          Entra
        </Btn>
        <Btn testId="rejoin" onClick={() => run('rejoin', rejoin())}>
          Riconnetti
        </Btn>
        <Btn testId="leave" tone="coral" onClick={() => leave()}>
          Esci
        </Btn>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {REACTIONS.map((e) => (
          <button key={e} data-testid={`react-${e}`} onClick={() => react(e)} className="size-9 rounded-full bg-white/5 text-lg hover:bg-white/10">
            {e}
          </button>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-ink-200">
        <dt className="text-ink-400">connection</dt>
        <dd data-testid="connection">{connection}</dd>
        <dt className="text-ink-400">code</dt>
        <dd data-testid="room-code">{code ?? '—'}</dd>
        <dt className="text-ink-400">players</dt>
        <dd data-testid="players">{players.map((p) => p.name).join(', ') || '—'}</dd>
        <dt className="text-ink-400">error</dt>
        <dd data-testid="error" className="text-coral">
          {error ?? '—'} {error && <button onClick={clearError} className="underline">ok</button>}
        </dd>
        <dt className="text-ink-400">last</dt>
        <dd data-testid="status">{status || '—'}</dd>
      </dl>
    </section>
  )
}

export function StoreLab() {
  useRenderCount('StoreLab')
  const [fixture, setFixtureName] = useState<string | null>(null)
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink-50">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-magenta uppercase">lab / store</p>
          <h1 className="font-display text-2xl font-black tracking-tight uppercase italic">Game store</h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(FIXTURES).map((name) => (
            <Btn
              key={name}
              testId={`fx-${name}`}
              tone={fixture === name ? 'lime' : 'ghost'}
              onClick={() => {
                setFixture(name)
                setFixtureName(name)
              }}
            >
              {name}
            </Btn>
          ))}
        </div>
      </header>
      <LivePanel />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MeCard />
        <PhaseCard />
        <TimerCard />
        <SecondsOnly />
        <LeaderboardCard />
        <RoundStandingsCard />
        <WaitingCard />
        <StatsCard />
        <AudioCard />
        <MiscCard />
        <ToastsCard />
      </div>
    </div>
  )
}
