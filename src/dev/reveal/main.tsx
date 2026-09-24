// Reveal lab: RevealLayout from fixtures over the real shader background, with the
// real audio engine playing the Daft Punk preview (fetched fresh via JSONP).
// Query params: me=p-host|p-2|p-3|p-4|p-5, n=6|8|12|16, last=1, auto=0, host=0|1,
// ui=0 (hide controls), audio=0 (no Deezer), skip=1, nextIn=<ms>,
// connected=1 (the real RevealView fed through the game store instead of props).
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '../../index.css'
import { audioEngine } from '../../audio/engine'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import { playSfx } from '../../components/ui'
import { FX_NOW, fxTrack } from '../fixtures'
import { resetClock } from '../../game/clock'
import { useGame } from '../../game/store'
import { RevealLayout } from '../../screens/round/reveal/RevealLayout'
import { RevealView } from '../../screens/round/reveal/RevealView'
import type { RevealEffects } from '../../screens/round/reveal/RevealLayout'
import { pulseBackground, useAlbumAccent, useRevealSong } from '../../screens/round/reveal/revealAudio'
import { revealFixture } from './fixtures'

const params = new URLSearchParams(location.search)
const showUi = params.get('ui') !== '0'
const withAudio = params.get('audio') !== '0'
const connected = params.get('connected') === '1'

declare global {
  interface Window {
    __revealLab?: { cues: string[]; audio: string; replay(): void }
  }
}
const lab = { cues: [] as string[], audio: 'idle', replay: () => {} }
window.__revealLab = lab

let seq = 0
function jsonp<T>(url: string, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__revealLabCb${seq++}`
    const w = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    const done = () => {
      clearTimeout(timer)
      delete w[name]
      script.remove()
    }
    const timer = setTimeout(() => {
      done()
      reject(new Error('timeout'))
    }, timeoutMs)
    w[name] = (data: T) => {
      done()
      resolve(data)
    }
    script.onerror = () => {
      done()
      reject(new Error('rete'))
    }
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${name}`
    document.head.appendChild(script)
  })
}

async function loadPreview(): Promise<void> {
  lab.audio = 'loading'
  const t = await jsonp<{ preview?: string }>(`https://api.deezer.com/track/${fxTrack.id}`)
  if (!t.preview) throw new Error('nessuna anteprima')
  await audioEngine.load(`track:${fxTrack.id}`, t.preview)
  lab.audio = 'ready'
}

const EFFECTS: RevealEffects = {
  sfx: (name, opts) => {
    lab.cues.push(`${Math.round(performance.now())}:${name}${opts?.pitch ? `@${opts.pitch.toFixed(2)}` : ''}`)
    playSfx(name, opts)
  },
  pulse: pulseBackground,
}

function Lab() {
  const [me, setMe] = useState(params.get('me') ?? 'p-host')
  const [n, setN] = useState(Number(params.get('n') ?? 8))
  const [last, setLast] = useState(params.get('last') === '1')
  const [auto, setAuto] = useState(params.get('auto') !== '0')
  const [hostOverride, setHostOverride] = useState<boolean | null>(params.has('host') ? params.get('host') === '1' : null)
  const [runId, setRunId] = useState(0)
  const [start, setStart] = useState(() => {
    const t = Date.now()
    if (connected) resetClock(FX_NOW - t)
    return t
  })
  const [now, setNow] = useState(FX_NOW)
  const [note, setNote] = useState('')

  const replay = useCallback(() => {
    const t = Date.now()
    // Connected mode reads the host clock: align it with the fixture before remounting.
    if (connected) resetClock(FX_NOW - t)
    setStart(t)
    setNow(FX_NOW)
    setRunId((r) => r + 1)
    lab.cues = []
  }, [])
  useEffect(() => {
    lab.replay = replay
  }, [replay])

  useEffect(() => {
    const id = setInterval(() => setNow(FX_NOW + (Date.now() - start)), 250)
    return () => clearInterval(id)
  }, [start])

  useEffect(() => {
    if (!withAudio) return
    loadPreview().then(
      () => setNote('Audio pronto'),
      (err: unknown) => {
        lab.audio = 'error'
        setNote(`Audio non disponibile: ${String(err)}`)
      },
    )
  }, [])

  const room = useMemo(
    () => revealFixture({ n, last, auto, now: FX_NOW, nextIn: Number(params.get('nextIn') ?? 20_000) }),
    [n, last, auto],
  )
  const isHost = hostOverride ?? me === room.hostId
  const round = room.phase.kind === 'reveal' ? room.phase.round : 0
  const track = room.rounds[round]?.track ?? fxTrack

  // Connected mode: put the fixture in the store and align the host clock with it.
  useEffect(() => {
    if (connected) useGame.setState({ room, me, role: isHost ? 'host' : 'client', connection: 'open' })
  }, [room, me, isHost])

  if (connected) {
    return (
      <MotionConfig reducedMotion="user">
        <ShaderBackground />
        <RevealView key={runId} />
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <ShaderBackground />
      <LabReveal
        key={`${runId}|${me}|${n}|${last}|${auto}`}
        room={room}
        me={me}
        now={now}
        isHost={isHost}
        trackKey={withAudio ? `track:${track.id}` : null}
        cover={track.cover}
        onNext={() => setNote(`nextRound() alle ${new Date().toLocaleTimeString('it-IT')}`)}
      />
      {showUi && (
        <div className="fixed bottom-3 left-3 z-[100] flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 rounded-2xl bg-black/70 p-2 text-xs text-white backdrop-blur">
          <select className="rounded bg-white/10 px-1 py-1" value={me} onChange={(e) => {
              setMe(e.target.value)
              replay()
            }}>
            {['p-host', 'p-2', 'p-3', 'p-4', 'p-5'].map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <select className="rounded bg-white/10 px-1 py-1" value={n} onChange={(e) => {
              setN(Number(e.target.value))
              replay()
            }}>
            {[6, 8, 12, 16].map((v) => (
              <option key={v} value={v}>
                n={v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={last} onChange={(e) => {
                setLast(e.target.checked)
                replay()
              }} /> ultimo
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={auto} onChange={(e) => {
                setAuto(e.target.checked)
                replay()
              }} /> auto
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={isHost} onChange={(e) => setHostOverride(e.target.checked)} /> host
          </label>
          <button className="rounded bg-white/15 px-2 py-1" onClick={replay}>
            Rigioca
          </button>
          <button className="rounded bg-white/15 px-2 py-1" onClick={() => void audioEngine.unlock()}>
            Audio
          </button>
          {note && <span className="text-ink-200">{note}</span>}
        </div>
      )}
    </MotionConfig>
  )
}

interface LabRevealProps {
  room: ReturnType<typeof revealFixture>
  me: string
  now: number
  isHost: boolean
  trackKey: string | null
  cover: string
  onNext(): void
}

/** Mirrors the connected RevealView, with fixture data instead of the store. */
function LabReveal({ room, me, now, isHost, trackKey, cover, onNext }: LabRevealProps) {
  const song = useRevealSong(trackKey)
  const accent = useAlbumAccent(cover)
  return (
    <RevealLayout
      room={room}
      me={me}
      now={now}
      isHost={isHost}
      onNext={isHost ? onNext : undefined}
      accent={accent}
      songPlaying={song.playing}
      onToggleSong={song.toggle}
      songProgress={song.progress}
      effects={EFFECTS}
      skipChoreography={params.get('skip') === '1' ? true : undefined}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
