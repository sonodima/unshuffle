// Background fix lab: ShaderBackground mounted with props from the query string.
// ?paused=1 (mounted paused) · music=1 (synth levels) · strict=0 · glass=1 (a frosted panel on top)
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import type { BackgroundStats } from '../../components/background/ShaderBackground'
import { useBackground } from '../../components/background/useBackground'
import { createSynth } from '../shader/synth'

const params = new URLSearchParams(location.search)
const synth = createSynth(120)
if (params.get('music') === '1') synth.setPlaying(true)

declare global {
  interface Window {
    __bg?: {
      stats: BackgroundStats | null
      history: BackgroundStats[]
      music(on: boolean): void
      pulse(s?: number): void
      pause(on: boolean): void
      accent(a: string, b: string): void
    }
  }
}

function Lab() {
  const [paused, setPaused] = useState(params.get('paused') === '1')
  useEffect(() => {
    window.__bg = {
      stats: null,
      history: [],
      music: (on) => synth.setPlaying(on),
      pulse: (s) => useBackground.getState().pulse(s),
      pause: setPaused,
      accent: (a, b) => useBackground.getState().setAccent(a, b),
    }
  }, [])
  return (
    <>
      <ShaderBackground
        getLevels={synth.levels}
        paused={paused}
        onStats={(s) => {
          if (!window.__bg) return
          window.__bg.stats = s
          window.__bg.history.push(s)
        }}
      />
      {params.get('glass') === '1' && (
        <div className="flex h-dvh items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-panel p-6">
            <p className="eyebrow">Sfondo</p>
            <h1 className="display display-skew mt-2 text-3xl text-ink-50">UNSHUFFLE</h1>
            <p className="mt-2 text-sm text-ink-200">Pannello di prova sopra lo shader.</p>
          </div>
        </div>
      )}
    </>
  )
}

const app = <Lab />
createRoot(document.getElementById('root')!).render(params.get('strict') === '0' ? app : <StrictMode>{app}</StrictMode>)
