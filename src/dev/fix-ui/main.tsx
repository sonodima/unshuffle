// fix-ui lab (throwaway): /lab/fix-ui.html?view=timers|modal|controls|glass
//   modal=avatar|howto|short  sheet=1 (force sheet)  bg=css (no WebGL shader)
import { MotionConfig } from 'motion/react'
import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ShaderBackground } from '../../components/background'
import {
  Avatar,
  AvatarPicker,
  Badge,
  Button,
  Chip,
  IconButton,
  Modal,
  Panel,
  Segmented,
  TimerBar,
  TimerRing,
  ToastViewport,
} from '../../components/ui'
import { HowToPlay } from '../../screens/home/HowToPlay'

const q = new URLSearchParams(location.search)
const view = q.get('view') ?? 'timers'

function useTicker(total: number, start: number) {
  const [left, setLeft] = useState(start)
  useEffect(() => {
    const t0 = performance.now()
    const id = window.setInterval(() => setLeft(Math.max(0, start - (performance.now() - t0))), 250)
    return () => window.clearInterval(id)
  }, [start, total])
  return left
}

function Timers() {
  const TOTAL = 90_000
  const left = useTicker(TOTAL, Number(q.get('start') ?? 62_000))
  const fin = useTicker(TOTAL, 9_000)
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 p-4 sm:p-8">
      <Panel className="flex flex-col gap-5">
        <p className="eyebrow">TimerBar md · running</p>
        <TimerBar remainingMs={left} totalMs={TOTAL} />
        <p className="eyebrow">TimerBar md · urgent running</p>
        <TimerBar remainingMs={fin} totalMs={TOTAL} />
        <p className="eyebrow">static 100% · 60% · 25% · 6% · 1% · 0</p>
        <TimerBar remainingMs={90_000} totalMs={TOTAL} running={false} />
        <TimerBar remainingMs={54_000} totalMs={TOTAL} running={false} />
        <TimerBar remainingMs={22_500} totalMs={TOTAL} running={false} size="sm" />
        <TimerBar remainingMs={5_400} totalMs={TOTAL} running={false} />
        <TimerBar remainingMs={900} totalMs={TOTAL} running={false} />
        <TimerBar remainingMs={0} totalMs={TOTAL} running={false} />
      </Panel>
      <div className="glass flex flex-wrap items-center justify-center gap-6 rounded-panel p-5">
        <TimerRing remainingMs={left} totalMs={TOTAL} size={112} caption="Tempo" />
        <TimerRing remainingMs={fin} totalMs={TOTAL} size={100} caption="Finale" />
        <TimerRing remainingMs={75_000} totalMs={TOTAL} size={72} running={false} />
        <TimerRing remainingMs={20_000} totalMs={TOTAL} size={56} running={false} />
      </div>
    </div>
  )
}

function ModalView() {
  const kind = q.get('modal') ?? 'avatar'
  const [open, setOpen] = useState(true)
  const [look, setLook] = useState({ avatar: 3, color: 2 })
  const presentation = q.get('sheet') === '1' ? 'sheet' : 'auto'
  if (kind === 'howto') return <HowToPlay open={open} onClose={() => setOpen(false)} />
  return (
    <>
      <div className="p-6">
        <Button onClick={() => setOpen(true)}>Apri</Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        presentation={presentation}
        title="Il tuo look"
        description="Scegli emoji e colore: gli altri giocatori ti vedranno così."
        footer={
          kind === 'two' ? (
            <>
              <Button variant="glass" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Rimuovi
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" onClick={() => setOpen(false)} rightIcon="check">
              Fatto
            </Button>
          )
        }
      >
        <div className="mb-5 flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-ink-950/40 p-3.5 shadow-well sm:p-4">
          <Avatar avatar={look.avatar} color={look.color} size="lg" active />
          <div className="min-w-0">
            <p className="eyebrow">Anteprima</p>
            <p className="display display-skew mt-1.5 truncate text-xl text-ink-50">DJ Pinguino</p>
          </div>
        </div>
        <AvatarPicker avatar={look.avatar} color={look.color} onChange={setLook} />
      </Modal>
    </>
  )
}

function Controls() {
  const [seg, setSeg] = useState(8)
  const [chip, setChip] = useState(1)
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 p-4 sm:p-8">
      <Panel className="flex flex-col gap-4">
        <p className="eyebrow">Buttons sm (hit-slop on touch)</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="glass" size="sm" leftIcon="help">
            Come si gioca
          </Button>
          <Button variant="glass" size="sm" leftIcon="link">
            Invita
          </Button>
          <IconButton icon="x" label="Rimuovi Giulia" size="sm" variant="ghost" className="text-ink-400 hover:text-coral" />
          <IconButton icon="dice" label="Nome a caso" size="sm" />
          <Button size="sm" variant="danger" leftIcon="refresh">
            Riprova
          </Button>
        </div>
        <p className="eyebrow">Primary disabled · secondary · ghost</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" leftIcon="play" disabled>
            Inizia partita
          </Button>
          <Button variant="secondary">Entra</Button>
          <Button variant="ghost">Annulla</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Hit del momento', 'Hit 2000', 'Anni 90', 'Rap italiano'].map((c, i) => (
            <Chip key={c} selected={chip === i} onClick={() => setChip(i)}>
              {c}
            </Chip>
          ))}
          <Chip size="sm">Piccolo</Chip>
        </div>
        <Segmented
          label="Spezzoni"
          value={seg}
          onChange={setSeg}
          tone="magenta"
          options={[
            { value: 6, label: '6', sublabel: 'Facile' },
            { value: 8, label: '8', sublabel: 'Normale' },
            { value: 12, label: '12', sublabel: 'Difficile' },
            { value: 16, label: '16', sublabel: 'Folle' },
          ]}
        />
        <div className="flex flex-col gap-1">
          <p className="text-xs text-ink-400">Clicca uno spezzone per riascoltarlo · ink-400 12px</p>
          <p className="text-[11px] font-bold text-ink-400 uppercase">Spettatore · gioca dal round 4</p>
          <p className="text-xs text-ink-300">ink-300 12px, for comparison</p>
          <div className="flex gap-2">
            <Badge tone="violet" variant="solid">
              Tu
            </Badge>
            <Badge tone="gold" icon="crown">
              Host
            </Badge>
          </div>
        </div>
      </Panel>
      <ToastViewport
        items={[{ id: 1, tone: 'success', title: 'Giulia ha confermato', body: 'Restano 15 secondi per tutti.' }]}
        onDismiss={() => {}}
      />
    </div>
  )
}

function Glass() {
  return (
    <div className="mx-auto grid max-w-[980px] gap-5 p-4 sm:grid-cols-3 sm:p-8">
      <div className="glass rounded-panel p-5">
        <p className="eyebrow">glass (blur)</p>
        <p className="mt-2 text-sm text-ink-300">Floating surfaces over content.</p>
        <p className="mt-2 text-xs text-ink-400">Secondary label, 12px</p>
      </div>
      <div className="glass-flat rounded-panel p-5">
        <p className="eyebrow">glass-flat</p>
        <p className="mt-2 text-sm text-ink-300">In-flow panels on the background.</p>
        <p className="mt-2 text-xs text-ink-400">Secondary label, 12px</p>
      </div>
      <Panel glow="magenta">
        <p className="eyebrow">Panel glow</p>
        <p className="mt-2 text-sm text-ink-300">Panel = glass-flat.</p>
        <div className="glass mt-3 rounded-2xl p-3 text-xs text-ink-400">nested .glass → no blur</div>
      </Panel>
    </div>
  )
}

/** The pre-fix bar/ring write pattern (width / dashoffset every frame), for A/B paint counts. */
function OldWrites({ ring }: { ring: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      const f = Math.max(0, 1 - (performance.now() - t0) / 90_000)
      if (ref.current) ref.current.style.width = `${f * 100}%`
      arc.current?.setAttribute('stroke-dashoffset', String(320 * (1 - f)))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return ring ? (
    <svg width={112} height={112} className="-rotate-90">
      <circle ref={arc} cx={56} cy={56} r={51} fill="none" stroke="var(--color-lime)" strokeWidth={8} strokeLinecap="round" strokeDasharray={320} style={{ filter: 'drop-shadow(0 0 7px var(--color-lime))' }} />
    </svg>
  ) : (
    <div className="relative h-2.5 rounded-full bg-ink-950/60">
      <div ref={ref} className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-linear-to-r from-lime-deep to-lime shadow-[0_0_14px_rgb(166_255_63/0.55)]">
        <span className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/40 to-transparent" style={{ animation: 'bar-sweep 2.4s linear infinite' }} />
      </div>
    </div>
  )
}

/** One running timer, nothing else animating (for paint counting). */
function Perf() {
  const TOTAL = 90_000
  const left = useTicker(TOTAL, 80_000)
  const which = q.get('which') ?? 'bar'
  return (
    <div className="mx-auto max-w-[520px] p-6">
      <Panel>
        {which === 'bar' ? (
          <TimerBar remainingMs={left} totalMs={TOTAL} />
        ) : which === 'ring' ? (
          <TimerRing remainingMs={left} totalMs={TOTAL} size={112} caption="Tempo" />
        ) : which === 'oldbar' || which === 'oldring' ? (
          <OldWrites ring={which === 'oldring'} />
        ) : null}
      </Panel>
    </div>
  )
}

/** Content scrolling under a bottom dock: glass (blur) vs glass-dock (opaque, no blur). ?dock=glass|glass-dock */
function Dock() {
  const cls = q.get('dock') ?? 'glass-dock'
  const covers = ['#e33', '#fc2', '#2c8', '#39f', '#c3f', '#f6a', '#fff', '#111']
  return (
    <div className="relative flex h-dvh flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-40">
        <Panel className="grid grid-cols-2 gap-3">
          {covers.map((c, i) => (
            <div key={i}>
              <div className="aspect-square rounded-2xl" style={{ background: `linear-gradient(135deg, ${c}, #000)` }}>
                <p className="p-3 font-display text-2xl font-black text-white">TOP {i + 1}00</p>
              </div>
              <p className="mt-2 text-[13px] font-extrabold text-ink-50">Top Italy {i}</p>
              <p className="text-xs text-ink-400">100 brani · Deezer Charts</p>
            </div>
          ))}
        </Panel>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className={`${cls} pointer-events-auto rounded-t-[26px] rounded-b-none border-b-0 px-safe-4 pt-3 pb-safe-3`}>
          <p className="px-1 pb-3 text-sm font-extrabold text-ink-50">
            Nessuna playlist <span className="block text-xs font-semibold text-ink-400">Scegli una playlist per iniziare</span>
          </p>
          <Button size="lg" fullWidth leftIcon="play" disabled>
            Inizia partita
          </Button>
        </div>
      </div>
    </div>
  )
}

function Lab() {
  return (
    <MotionConfig reducedMotion="user">
      {q.get('bg') === 'css' ? null : <ShaderBackground />}
      {view === 'dock' ? <Dock /> : view === 'perf' ? <Perf /> : view === 'timers' ? <Timers /> : view === 'modal' ? <ModalView /> : view === 'controls' ? <Controls /> : <Glass />}
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
