// Shader lab: the background with a synthetic 120 BPM driver, accent presets,
// intensity, reduced motion, CSS fallback and live stats.
// Query params: music=1, bpm=120, accent=<preset>, intensity=0.55, ui=0,
// mock=home|play|reveal, fallback=1, reduced=1. "Engine" plays a synthesized loop
// through the real audioEngine so the default getLevels() path is exercised.
import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import type { BackgroundStats } from '../../components/background/ShaderBackground'
import { useBackground } from '../../components/background/useBackground'
import { audioEngine } from '../../audio/engine'
import { createSynth } from './synth'
import { makeClubLoopUrl } from './wav'

const params = new URLSearchParams(location.search)
const synth = createSynth(Number(params.get('bpm') ?? 120))
if (params.get('music') === '1') synth.setPlaying(true)

const PRESETS: Record<string, [string, string, string?] | null> = {
  default: null,
  sunset: ['#ff6a3d', '#ff2e63'],
  ocean: ['#1f6fff', '#19e3c4'],
  gold: ['#b8860b', '#ffcf40'],
  lime: ['#4caf50', '#c6ff3f'],
  grey: ['#3a3a3a', '#9a9a9a'],
  noir: ['#0a0a0a', '#1b1b1b'],
}

function applyPreset(name: string) {
  const p = PRESETS[name]
  if (p) useBackground.getState().setAccent(p[0], p[1], p[2])
  else useBackground.getState().resetAccent()
}

if (params.get('accent')) applyPreset(params.get('accent')!)
if (params.get('intensity')) useBackground.getState().setIntensity(Number(params.get('intensity')))

declare global {
  interface Window {
    __shaderLab?: {
      synth: typeof synth
      stats: BackgroundStats | null
      preset(name: string): void
      intensity(x: number): void
      pulse(strength?: number): void
      pause(on: boolean): void
      fallback(on: boolean): void
      reduced(on: boolean): void
      ui(on: boolean): void
      /** Play the synthesized loop through the real audio engine (call from a user gesture). */
      engine(on: boolean): Promise<void>
      /** Current real-engine levels (what the shader reads by default). */
      levels(): ReturnType<typeof audioEngine.getLevels>
    }
  }
}

function MockHome() {
  return (
    <div className="flex h-full flex-col items-center justify-between px-safe-5 pt-safe-10 pb-safe-8">
      <div className="text-center">
        <h1 className="display display-skew text-gradient-brand inline-block text-5xl sm:text-7xl">UNSHUFFLE</h1>
        <p className="mt-3 text-sm text-ink-200 sm:text-base">La hit è stata fatta a pezzi. Rimettila in ordine prima degli altri.</p>
      </div>
      <div className="glass w-full max-w-md rounded-panel p-5">
        <p className="eyebrow">Il tuo nome</p>
        <div className="mt-2 rounded-2xl bg-ink-950/60 px-4 py-3 font-semibold text-ink-50 shadow-well">DJ Pinguino</div>
        <div className="mt-5 flex flex-col gap-3">
          <button className="btn btn-primary btn-lg w-full">
            <span className="btn-label">Crea stanza</span>
          </button>
          <button className="btn btn-glass btn-lg w-full">
            <span className="btn-label">Entra</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-ink-400">Musica: anteprime Deezer · 2–10 giocatori</p>
    </div>
  )
}

function MockPlay() {
  const hues = [12, 205, 290, 48, 330, 160, 250, 95]
  return (
    <div className="flex h-full flex-col px-safe-4 pt-safe-4 pb-safe-4">
      <div className="glass flex items-center justify-between rounded-panel px-4 py-3">
        <span className="eyebrow">Round 2 / 5</span>
        <span className="num text-2xl font-bold text-ink-50">1:12</span>
        <span className="num text-sm text-gold">7.420</span>
      </div>
      <div className="grid flex-1 grid-cols-2 content-center gap-3 py-6 sm:grid-cols-4">
        {hues.map((h, i) => (
          <div
            key={i}
            className="grid h-20 place-items-center rounded-block font-display text-xl font-extrabold text-white/90 shadow-lift sm:h-28"
            style={{ background: `linear-gradient(160deg, oklch(0.72 0.17 ${h}), oklch(0.5 0.17 ${h}))` }}
          >
            {'ABCDEFGH'[i]}
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-xl w-full">
        <span className="btn-label">Conferma</span>
      </button>
    </div>
  )
}

function MockReveal() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-safe-5">
      <div className="h-48 w-48 rounded-3xl shadow-lift sm:h-64 sm:w-64" style={{ background: 'linear-gradient(135deg, #ff6a3d, #ff2e63 60%, #3a0d2e)' }} />
      <div className="text-center">
        <p className="eyebrow">Era…</p>
        <h2 className="display display-skew mt-2 inline-block text-3xl text-ink-50 sm:text-5xl">Blinding Lights</h2>
        <p className="mt-2 text-ink-200">The Weeknd</p>
      </div>
      <div className="num text-5xl font-bold text-lime">+4.250</div>
    </div>
  )
}

function Lab() {
  const [music, setMusic] = useState(synth.playing)
  const [bpm, setBpm] = useState(synth.bpm)
  const [preset, setPreset] = useState(params.get('accent') ?? 'default')
  const intensity = useBackground((s) => s.intensity)
  const [paused, setPaused] = useState(false)
  const [fallback, setFallback] = useState(params.get('fallback') === '1')
  const [reduced, setReduced] = useState<boolean | undefined>(params.get('reduced') === '1' ? true : undefined)
  const [ui, setUi] = useState(params.get('ui') !== '0')
  const [mock, setMock] = useState(params.get('mock') ?? '')
  const [stats, setStats] = useState<BackgroundStats | null>(null)
  const [source, setSource] = useState<'synth' | 'engine'>('synth')

  const toggleEngine = useCallback(async (on: boolean) => {
    if (!on) {
      audioEngine.stop()
      setSource('synth')
      return
    }
    synth.setPlaying(false)
    setMusic(false)
    await audioEngine.unlock()
    await audioEngine.load('lab:club', makeClubLoopUrl(synth.bpm))
    audioEngine.playFull('lab:club', { tag: 'lab', onEnded: () => setSource('synth') })
    setSource('engine')
  }, [])

  useEffect(() => {
    window.__shaderLab = {
      synth,
      stats: null,
      preset: (n) => {
        setPreset(n)
        applyPreset(n)
      },
      intensity: (x) => useBackground.getState().setIntensity(x),
      pulse: (s) => useBackground.getState().pulse(s),
      pause: setPaused,
      fallback: setFallback,
      reduced: (on) => setReduced(on),
      ui: setUi,
      engine: toggleEngine,
      levels: () => audioEngine.getLevels(),
    }
  }, [toggleEngine])

  const onStats = (s: BackgroundStats) => {
    if (window.__shaderLab) window.__shaderLab.stats = s
    setStats(s)
  }

  return (
    <>
      <ShaderBackground getLevels={source === 'synth' ? synth.levels : undefined} paused={paused} forceFallback={fallback} reducedMotion={reduced} onStats={onStats} />
      <div className="h-dvh">
        {mock === 'home' && <MockHome />}
        {mock === 'play' && <MockPlay />}
        {mock === 'reveal' && <MockReveal />}
      </div>
      {ui && (
        <div className="glass fixed right-3 bottom-3 left-3 z-10 rounded-2xl p-3 text-xs text-ink-100 sm:right-4 sm:left-auto sm:w-80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`btn btn-sm ${music ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                synth.setPlaying(!music)
                setMusic(!music)
              }}
            >
              <span className="btn-label">{music ? 'Musica on' : 'Musica off'}</span>
            </button>
            <button className="btn btn-sm btn-glass" onClick={() => void toggleEngine(source !== 'engine')}>
              <span className="btn-label">{source === 'engine' ? 'Engine on' : 'Engine'}</span>
            </button>
            <button className="btn btn-sm btn-glass" onClick={() => useBackground.getState().pulse(1)}>
              <span className="btn-label">Pulse</span>
            </button>
            <button className="btn btn-sm btn-glass" onClick={() => useBackground.getState().setIntensity(intensity > 0.8 ? 0.55 : 1)}>
              <span className="btn-label">Int {intensity.toFixed(2)}</span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                className={`rounded-full px-2 py-1 ${preset === name ? 'bg-white/20 text-white' : 'bg-white/5 text-ink-300'}`}
                onClick={() => {
                  setPreset(name)
                  applyPreset(name)
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1">
              BPM
              <input
                type="range"
                min={70}
                max={180}
                value={bpm}
                onChange={(e) => {
                  synth.setBpm(Number(e.target.value))
                  setBpm(Number(e.target.value))
                }}
              />
              <span className="num w-8">{bpm}</span>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> pausa
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={!!reduced} onChange={(e) => setReduced(e.target.checked ? true : undefined)} /> reduced
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} /> CSS
            </label>
            <select className="rounded bg-ink-900 px-1" value={mock} onChange={(e) => setMock(e.target.value)}>
              <option value="">nessuna UI</option>
              <option value="home">home</option>
              <option value="play">play</option>
              <option value="reveal">reveal</option>
            </select>
          </div>
          <div className="num mt-2 leading-5 text-ink-300">
            {fallback ? (
              'CSS fallback'
            ) : stats ? (
              <>
                {stats.mode} · {stats.fps} fps · {stats.frameMs} ms · cpu {stats.cpuMs} ms · gpu {stats.gpuMs ?? '—'} ms
                <br />
                q{stats.quality} · {stats.width}×{stats.height} (×{stats.scale}) · {stats.octaves} oct · lost {stats.contextLosses}
                <br />
                <span className="text-ink-400">{stats.gpu}</span>
              </>
            ) : (
              '…'
            )}
          </div>
        </div>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
