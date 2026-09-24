// fix-reveal lab: the connected RevealView fed through the game store (fixtures),
// inside a RoundView-like AnimatePresence so the exit cross-fade can be checked,
// plus the shell's floating SoundControls (the reveal's inline one must hide it).
// Query: me=p-host|p-2|p-3|p-4|p-5, n=6|8|12|16, last=1, auto=0, audio=0, nextIn=<ms>, host=0|1
// window.__fixReveal: { audio, replay(), exit(), state() }
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import '../../index.css'
import { audioEngine } from '../../audio/engine'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import { SoundControls } from '../../components/shell/SoundControls'
import { FX_NOW, fxTrack } from '../fixtures'
import { resetClock } from '../../game/clock'
import { useGame } from '../../game/store'
import type { RoomState } from '../../game/types'
import { RoundMenuProvider } from '../../screens/round/GameMenu'
import { RevealView } from '../../screens/round/reveal/RevealView'
import { revealFixture } from '../reveal/fixtures'

const params = new URLSearchParams(location.search)
const withAudio = params.get('audio') !== '0'
const me = params.get('me') ?? 'p-host'
const n = Number(params.get('n') ?? 8)

declare global {
  interface Window {
    __fixReveal?: { audio: string; replay(): void; exit(): void; state(): unknown; pos(): unknown }
  }
}
const lab = {
  audio: 'idle',
  replay: () => {},
  exit: () => {},
  state: () => audioEngine.getState() as unknown,
  pos: () => audioEngine.getPosition() as unknown,
}
window.__fixReveal = lab

let seq = 0
function jsonp<T>(url: string, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__fixRevealCb${seq++}`
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

function fixture(): RoomState {
  return revealFixture({
    n,
    last: params.get('last') === '1',
    auto: params.get('auto') !== '0',
    now: FX_NOW,
    nextIn: Number(params.get('nextIn') ?? 20_000),
  })
}

function put(room: RoomState) {
  const isHost = params.has('host') ? params.get('host') === '1' : me === room.hostId
  useGame.setState({ room, me, role: isHost ? 'host' : 'client', connection: 'open' })
}

function Lab() {
  const [run, setRun] = useState(0)
  const phase = useGame((s) => s.room?.phase)
  const room = useGame((s) => s.room)
  useEffect(() => {
    lab.replay = () => {
      resetClock(FX_NOW - Date.now())
      put(fixture())
      setRun((r) => r + 1)
    }
    lab.exit = () => {
      const room = useGame.getState().room
      if (room) useGame.setState({ room: { ...room, phase: { kind: 'preparing', round: 3, message: 'Sto affettando la traccia…' } } })
    }
    lab.replay()
    if (withAudio)
      loadPreview().catch(() => {
        lab.audio = 'error'
      })
  }, [])
  const key = phase?.kind === 'reveal' ? 'reveal' : `other-${phase?.kind}`
  return (
    <MotionConfig reducedMotion="user">
      <ShaderBackground />
      <SoundControls />
      <div className="relative h-dvh w-full overflow-hidden">
        <AnimatePresence>
          <motion.section
            key={key}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            {phase?.kind === 'reveal' && room ? (
              <RoundMenuProvider room={room} me={me} onLeave={() => console.info('[lab] leave')} onEndGame={() => console.info('[lab] end')}>
                <RevealView key={run} />
              </RoundMenuProvider>
            ) : (
              <div className="grid h-full place-items-center text-2xl font-bold text-white" data-testid="next-phase">
                Preparazione…
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
