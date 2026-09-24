// Home lab: HomeView with fake props (?state=…) or the real connected
// HomeScreen (?connected=1), over a CSS stand-in for the WebGL shader.
// States: idle · invited · join-error · create-error · creating · joining · notice · offline · howto
import { MotionConfig } from 'motion/react'
import { StrictMode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import '../../index.css'
import type { PlayerProfile } from '../../game/types'
import { HomeScreen } from '../../screens/home/HomeScreen'
import { HomeView, type HomePending } from '../../screens/home/HomeView'

const css = `
.lab-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: var(--color-ink-950); }
.lab-bg::before, .lab-bg::after { content: ''; position: absolute; inset: -30%; filter: blur(60px); }
.lab-bg::before {
  background:
    radial-gradient(40% 35% at 20% 25%, rgb(123 92 255 / 0.55), transparent 70%),
    radial-gradient(35% 30% at 80% 20%, rgb(255 63 209 / 0.38), transparent 70%),
    radial-gradient(45% 40% at 70% 85%, rgb(46 230 255 / 0.22), transparent 70%),
    radial-gradient(40% 40% at 15% 90%, rgb(255 63 209 / 0.25), transparent 70%);
  animation: lab-drift 18s ease-in-out infinite alternate;
}
.lab-bg::after { background: radial-gradient(120% 90% at 50% 40%, transparent 40%, rgb(6 4 15 / 0.85) 100%); inset: 0; filter: none; }
@keyframes lab-drift {
  0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  50% { transform: translate3d(4%, -3%, 0) rotate(8deg) scale(1.08); }
  100% { transform: translate3d(-3%, 4%, 0) rotate(-6deg) scale(1.02); }
}
`

const params = new URLSearchParams(location.search)
const state = params.get('state') ?? 'idle'

function FakeHome() {
  const [profile, setProfile] = useState<PlayerProfile>({ id: 'lab', name: 'DJ Pinguino', avatar: 12, color: 5 })
  const [code, setCode] = useState(state === 'invited' || state === 'joining' ? 'KXQPM' : state === 'join-error' ? 'KXQPA' : '')
  const [pending, setPending] = useState<HomePending>(state === 'creating' ? 'create' : state === 'joining' ? 'join' : null)
  const [joinError, setJoinError] = useState<string | null>(state === 'join-error' ? 'Stanza non trovata. Controlla il codice.' : null)
  const [createError, setCreateError] = useState<string | null>(state === 'create-error' ? 'Server di collegamento non raggiungibile. Riprova tra poco.' : null)
  const [notice, setNotice] = useState<string | null>(state === 'notice' ? 'L’host ha chiuso la stanza.' : null)
  const [howTo, setHowTo] = useState(state === 'howto')

  return (
    <HomeView
      profile={profile}
      onProfileChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
      code={code}
      onCodeChange={(c) => {
        setCode(c)
        setJoinError(null)
      }}
      onCreate={() => {
        setCreateError(null)
        setPending('create')
        setTimeout(() => {
          setPending(null)
          setCreateError('Server di collegamento non raggiungibile. Riprova tra poco.')
        }, 1600)
      }}
      onJoin={(c) => {
        setJoinError(null)
        setPending('join')
        setTimeout(() => {
          setPending(null)
          setJoinError(c === 'KXQPM' ? 'L’host non risponde. Riprova tra poco.' : 'Stanza non trovata. Controlla il codice.')
        }, 1400)
      }}
      onCancel={() => setPending(null)}
      pending={pending}
      joinError={joinError}
      createError={createError}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      invited={state === 'invited' || state === 'joining'}
      offline={state === 'offline'}
      howToOpen={howTo}
      onHowToOpenChange={setHowTo}
    />
  )
}

function Lab() {
  return (
    <MotionConfig reducedMotion="user">
      <style>{css}</style>
      <div className="lab-bg" aria-hidden />
      <div className="grain-fixed" aria-hidden />
      {params.get('connected') ? <HomeScreen /> : <FakeHome />}
    </MotionConfig>
  )
}

// Reuse the root when HMR re-runs this entry (other people's edits can trigger it).
const root: Root = (import.meta.hot?.data.root as Root | undefined) ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
