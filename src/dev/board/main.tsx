// Board lab: the snippet board on a real Deezer preview (or synthetic audio), in a
// game-like layout. Query params: n, audio=deezer|synth, q, engine=mock|real,
// locked=1, marks=1, ui=0, delay=<ms before audio is available>.
import { StrictMode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { BoardAudioProvider, SnippetBoard, SnippetStrip, TransportBar } from '../../components/board'
import type { SnippetMark } from '../../components/board'
import type { AudioEngine } from '../../audio/engine'
import { audioEngine } from '../../audio/engine'
import { randomHues, scrambledOrder } from '../../game/shuffle'
import type { Segment } from '../../game/types'
import { findPreview } from './deezer'
import type { LabTrack } from './deezer'
import { createMockEngine, synthSong } from './mockEngine'

const params = new URLSearchParams(location.search)
const initialN = Number(params.get('n') ?? 8)
const audioSource = params.get('audio') ?? 'deezer'
const query = params.get('q') ?? 'daft punk harder better faster stronger'
const showUi = params.get('ui') !== '0'
const delayMs = Number(params.get('delay') ?? 0)
const freeHeight = params.get('free') === '1'

const sfxLog: string[] = []
const mock = createMockEngine()
const real = audioEngine as AudioEngine | null
const engine: AudioEngine = params.get('engine') === 'real' && real && typeof real.load === 'function' ? real : mock

function makeSegments(n: number, duration = 30): Segment[] {
  const a = 0.4
  const b = duration - 0.4
  const len = (b - a) / n
  return Array.from({ length: n }, (_, i) => ({ index: i, start: a + i * len, end: a + (i + 1) * len, beats: 0 }))
}

function marksFor(order: number[]): SnippetMark[] {
  return order.map((s, p) => (s === p ? 'correct' : 'wrong'))
}

interface Round {
  n: number
  segments: Segment[]
  hues: number[]
  initial: number[]
}

function newRound(n: number): Round {
  return { n, segments: makeSegments(n), hues: randomHues(n), initial: scrambledOrder(n) }
}

function Lab() {
  const [round, setRound] = useState<Round>(() => newRound(initialN))
  const [order, setOrder] = useState<number[]>(round.initial)
  const [locked, setLocked] = useState(params.get('locked') === '1')
  const [marks, setMarks] = useState<SnippetMark[] | null>(params.get('marks') === '1' ? marksFor(round.initial) : null)
  const [track, setTrack] = useState<LabTrack | null>(null)
  const [status, setStatus] = useState('Carico l’audio…')
  const trackKey = track ? `track:${track.id}` : 'track:synth'
  const orderRef = useRef(order)
  useLayoutEffect(() => {
    orderRef.current = order
  })

  useEffect(() => {
    let cancelled = false
    const inject = async () => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      if (audioSource === 'synth') {
        const ctx = mock.context()
        mock.inject('track:synth', synthSong(ctx))
        if (!cancelled) setStatus('Audio sintetico')
        return
      }
      try {
        const t = await findPreview(query)
        if (cancelled) return
        setTrack(t)
        await engine.load(`track:${t.id}`, t.preview)
        if (!cancelled) setStatus(`${t.artist} — ${t.title}`)
      } catch (e) {
        mock.inject('track:synth', synthSong(mock.context()))
        if (!cancelled) setStatus(`Deezer non disponibile (${(e as Error).message}): audio sintetico`)
      }
    }
    void inject()
    return () => {
      cancelled = true
    }
  }, [])

  const reset = useCallback((n: number) => {
    const r = newRound(n)
    setRound(r)
    setOrder(r.initial)
    setMarks(null)
  }, [])

  const reveal = useCallback(() => {
    setLocked(true)
    setMarks(marksFor(orderRef.current))
    setTimeout(() => {
      const correct = orderRef.current.map((_, i) => i)
      setOrder(correct)
      setMarks(marksFor(correct))
    }, 1700)
  }, [])

  useEffect(() => {
    ;(window as unknown as { __lab: unknown }).__lab = {
      order: () => orderRef.current,
      setOrder,
      setLocked,
      engine,
      sfx: sfxLog,
      trackKey: () => trackKey,
      ready: () => engine.has(trackKey),
    }
  }, [trackKey])

  const sfx = useCallback((name: string) => {
    sfxLog.push(name)
  }, [])

  const correctCount = useMemo(() => order.filter((s, p) => s === p).length, [order])

  return (
    <BoardAudioProvider engine={engine} sfx={sfx}>
      <div className="lab-bg flex h-dvh flex-col overflow-hidden text-ink-50">
        {showUi && (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-xs">
            {[6, 8, 12, 16].map((n) => (
              <button key={n} className="lab-chip" data-on={round.n === n || undefined} onClick={() => reset(n)}>
                {n}
              </button>
            ))}
            <button className="lab-chip" data-on={locked || undefined} onClick={() => setLocked((v) => !v)}>
              Blocca
            </button>
            <button
              className="lab-chip"
              data-on={!!marks || undefined}
              onClick={() => setMarks((m) => (m ? null : marksFor(orderRef.current)))}
            >
              Segni
            </button>
            <button className="lab-chip" onClick={reveal}>
              Rivela
            </button>
            <button className="lab-chip" onClick={() => reset(round.n)}>
              Mescola
            </button>
            <span className="truncate text-ink-300">{status}</span>
          </div>
        )}
        <header className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="font-display text-[13px] font-extrabold uppercase tracking-wider text-ink-200 -skew-x-6">
            Round <span className="text-white">2</span>/5
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-white">1:12</div>
          <div className="font-mono text-sm text-ink-300">
            <span className="text-gold">13 840</span> pt
          </div>
        </header>
        <main className={freeHeight ? 'overflow-auto px-4 py-3' : 'min-h-0 flex-1 px-4 py-3'}>
          <SnippetBoard
            className={freeHeight ? 'sb-free-test' : 'h-full'}
            trackKey={trackKey}
            segments={round.segments}
            hues={round.hues}
            order={order}
            onOrderChange={setOrder}
            locked={locked}
            marks={marks}
          />
        </main>
        <footer className="mx-auto flex w-full max-w-[980px] flex-col gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
          <TransportBar className="min-w-0 sm:flex-1" trackKey={trackKey} segments={round.segments} order={order} hues={round.hues} />
          <button className="lab-confirm">Conferma</button>
        </footer>
        {showUi && (
          <div className="px-4 pb-3" data-testid="strip">
            <SnippetStrip segments={round.segments} hues={round.hues} order={order} marks={marksFor(order)} trackKey={trackKey} size="md" />
            <div className="mt-2 flex items-center gap-4">
              <SnippetStrip className="flex-1" segments={round.segments} hues={round.hues} order={order} marks={marksFor(order)} trackKey={trackKey} />
              <SnippetStrip className="w-40" segments={round.segments} hues={round.hues} order={round.segments.map((_, i) => i)} marks={round.segments.map(() => 'correct' as const)} size="xs" />
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink-400">
              {correctCount}/{round.n} al posto giusto · [{order.join(' ')}]
            </div>
          </div>
        )}
      </div>
    </BoardAudioProvider>
  )
}

const style = (document.getElementById('board-lab-style') as HTMLStyleElement | null) ?? document.createElement('style')
style.id = 'board-lab-style'
style.textContent = `
  .lab-bg { background:
    radial-gradient(1100px 620px at 12% -12%, rgb(123 92 255 / .38), transparent 62%),
    radial-gradient(900px 560px at 108% 112%, rgb(255 63 209 / .26), transparent 60%),
    radial-gradient(700px 400px at 90% 0%, rgb(46 230 255 / .10), transparent 60%),
    var(--color-ink-950); }
  .sb-free-test { height: auto; }
  .lab-chip { padding: 6px 12px; border-radius: 999px; background: rgb(255 255 255 / .07); border: 1px solid rgb(255 255 255 / .1); font-weight: 700; }
  .lab-chip[data-on] { background: var(--color-violet); border-color: transparent; }
  .lab-confirm { height: 60px; padding: 0 36px; border-radius: 999px; font-family: var(--font-display); font-weight: 900; font-size: 16px;
    letter-spacing: .04em; text-transform: uppercase; color: var(--color-ink-950);
    background: linear-gradient(180deg, var(--color-lime), var(--color-lime-deep));
    box-shadow: inset 0 2px 0 rgb(255 255 255 / .5), 0 4px 0 #3f7a0c, 0 14px 30px -10px rgb(166 255 63 / .6); }
`
document.head.appendChild(style)

// Other modules change under the dev server while the team works: reuse the root on re-execution.
const w = window as unknown as { __boardLabRoot?: ReturnType<typeof createRoot> }
w.__boardLabRoot ??= createRoot(document.getElementById('root') as HTMLElement)
w.__boardLabRoot.render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
