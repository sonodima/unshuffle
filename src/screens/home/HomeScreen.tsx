// Home — connected. Reads the store, unlocks audio on every CTA (the gesture
// iOS needs; other taps only soft-unlock, see useSoftAudioUnlock), maps async failures to inline Italian errors, pre-fills the code
// from an invite link (#/r/CODE) and shows "Come si gioca" on the first visit.
// Screen switching is the shell's job: once the store has a room, we're gone.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { audioEngine } from '../../audio/engine'
import { useSoftAudioUnlock } from '../../audio/usePlayback'
import { STORE_MESSAGES, useGame } from '../../game/store'
import { preloadTransport } from '../../net/transport'
import { HomeView, type HomePending } from './HomeView'
import { afterBootIdle } from './idle'
import { ONBOARDED_KEY, hasFlag, inviteCodeFromHash, setFlag } from './invite'
import type { ProfilePatch } from './ProfileCard'

export { HomeView } from './HomeView'
export type { HomeViewProps, HomePending } from './HomeView'

const ONBOARDING_DELAY_MS = 1400
/** Earliest background warm-up of PeerJS (after the boot work and the first keystrokes). */
const WARMUP_DELAY_MS = 3000

function unlockAudio(): void {
  try {
    const pending = audioEngine?.unlock?.()
    if (pending && typeof pending.catch === 'function') pending.catch(() => {})
  } catch {
    // Audio is optional here: the game still works (silently) if it can't start.
  }
}

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

function useOffline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
    () => false,
  )
}

/** Runs an async store action, turning a synchronous throw into a rejection. */
function attempt<T>(action: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(action())
  } catch (err) {
    return Promise.reject(err)
  }
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function HomeScreen() {
  const profile = useGame((s) => s.profile)
  const role = useGame((s) => s.role)
  const connection = useGame((s) => s.connection)
  const error = useGame((s) => s.error)
  const setProfile = useGame((s) => s.setProfile)
  const createRoom = useGame((s) => s.createRoom)
  const joinRoom = useGame((s) => s.joinRoom)
  const leave = useGame((s) => s.leave)
  const clearError = useGame((s) => s.clearError)

  const [code, setCode] = useState(() => inviteCodeFromHash() ?? '')
  const [invited, setInvited] = useState(() => inviteCodeFromHash() !== null)
  const [action, setAction] = useState<HomePending>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [howToOpen, setHowToOpen] = useState(false)
  const offline = useOffline()
  const alive = useRef(true)

  // Warm PeerJS up so "Crea stanza" / "Entra" feel instant. Not on mount: when
  // its module loads, PeerJS probes WebRTC support synchronously (a 50–220 ms
  // long task) and that must not land in the first second, while the page is
  // settling and the player starts typing a name. So: on intent (hover, focus
  // or touch on the action buttons / code boxes), else once the page is idle.
  const warmed = useRef(false)
  const warmUp = useCallback(() => {
    if (warmed.current) return
    warmed.current = true
    void preloadTransport()
  }, [])
  useEffect(() => afterBootIdle(WARMUP_DELAY_MS, warmUp), [warmUp])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Invite links opened while Home is already showing (pasted in the address bar).
  // Ignored once a session exists: then the hash is our own room's.
  useEffect(() => {
    const onHash = () => {
      const invite = inviteCodeFromHash()
      if (!invite || useGame.getState().role !== 'none') return
      setCode(invite)
      setInvited(true)
      setJoinError(null)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Stray taps on Home (nickname, avatar…) must not claim the iOS audio session, or the
  // player's own music stops while they type. The CTAs below unlock audio for real.
  useSoftAudioUnlock()

  useEffect(() => {
    if (hasFlag(ONBOARDED_KEY)) return
    const t = setTimeout(() => {
      setFlag(ONBOARDED_KEY)
      setHowToOpen(true)
    }, ONBOARDING_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  // A session started elsewhere (e.g. resume after refresh) still shows as pending here.
  const storePending: HomePending = connection === 'connecting' ? (role === 'host' ? 'create' : role === 'client' ? 'join' : null) : null
  const pending = action ?? storePending

  const onProfileChange = useCallback((patch: ProfilePatch) => setProfile(patch), [setProfile])

  const onCreate = () => {
    if (pending) return
    unlockAudio()
    setCreateError(null)
    setJoinError(null)
    clearError()
    setAction('create')
    attempt(createRoom).then(
      () => {
        if (alive.current) setAction(null)
      },
      (err: unknown) => {
        if (!alive.current) return
        setAction(null)
        const message = messageOf(err, STORE_MESSAGES.createFailed)
        if (message === STORE_MESSAGES.cancelled) return
        setCreateError(message)
        clearError()
      },
    )
  }

  const onJoin = (full: string) => {
    if (pending) return
    unlockAudio()
    setCreateError(null)
    setJoinError(null)
    clearError()
    setAction('join')
    attempt(() => joinRoom(full)).then(
      () => {
        if (alive.current) setAction(null)
      },
      (err: unknown) => {
        if (!alive.current) return
        setAction(null)
        const message = messageOf(err, STORE_MESSAGES.joinFailed)
        if (message === STORE_MESSAGES.cancelled) return
        setJoinError(message)
        clearError()
      },
    )
  }

  const onCancel = () => {
    setAction(null)
    leave()
  }

  return (
    <HomeView
      profile={profile}
      onProfileChange={onProfileChange}
      code={code}
      onCodeChange={(next) => {
        setCode(next)
        if (joinError) setJoinError(null)
      }}
      onCreate={onCreate}
      onJoin={onJoin}
      onCancel={onCancel}
      pending={pending}
      joinError={joinError}
      createError={createError}
      notice={pending ? null : error}
      onDismissNotice={clearError}
      invited={invited}
      offline={offline}
      howToOpen={howToOpen}
      onHowToOpenChange={setHowToOpen}
      onIntent={warmUp}
    />
  )
}
