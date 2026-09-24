// Boot-time session resume: after a refresh the tab re-enters its previous
// room (store.resumeSession). A tiny external store drives ResumeOverlay.

import { useSyncExternalStore } from 'react'
import { loadSession } from '../../game/persist'
import { useGame } from '../../game/store'

export interface ResumeState {
  /** idle = never started · running = resumeSession pending · done = settled (or skipped). */
  phase: 'idle' | 'running' | 'done'
  /** Room being resumed, if known. */
  code: string | null
  /** Host or client session being resumed. */
  role: 'host' | 'client' | null
  startedAt: number
  /** Italian message when resuming failed with a store error (shown once, then dismissed). */
  failure: string | null
}

let state: ResumeState = { phase: 'idle', code: null, role: null, startedAt: 0, failure: null }
const listeners = new Set<() => void>()
let started = false
let cancelled = false

function patch(next: Partial<ResumeState>): void {
  state = { ...state, ...next }
  for (const l of [...listeners]) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getState = () => state

export function useResumeState(): ResumeState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function getResumeState(): ResumeState {
  return state
}

/** Calls `useGame.getState().resumeSession()` exactly once per page load (idempotent). */
export function startResume(): void {
  if (started) return
  started = true
  const resumeSession = (useGame.getState() as { resumeSession?: () => Promise<boolean> }).resumeSession
  if (typeof resumeSession !== 'function') {
    patch({ phase: 'done' })
    return
  }
  let saved: ReturnType<typeof loadSession> = null
  try {
    saved = loadSession()
  } catch {
    saved = null
  }
  patch({ phase: 'running', code: saved?.code ?? null, role: saved?.role ?? null, startedAt: Date.now() })
  let pending: Promise<boolean>
  try {
    pending = Promise.resolve(resumeSession())
  } catch (err) {
    pending = Promise.reject(err)
  }
  pending.then(
    (resumed) => settle(resumed),
    (err) => {
      console.warn('[shell] resumeSession failed', err)
      settle(false)
    },
  )
}

function settle(resumed: boolean): void {
  if (cancelled) return
  const st = useGame.getState()
  const failure = !resumed && state.code && st.connection === 'error' && st.error ? st.error : null
  patch({ phase: 'done', failure })
}

/** "Annulla" while resuming: drop the half-open session and stay home. */
export function cancelResume(): void {
  if (state.phase !== 'running') return
  cancelled = true
  patch({ phase: 'done', failure: null })
  try {
    useGame.getState().leave()
  } catch (err) {
    console.warn('[shell] leave failed', err)
  }
}

export function dismissResumeFailure(): void {
  if (!state.failure) return
  patch({ failure: null })
  try {
    useGame.getState().clearError()
  } catch {
    // ignore
  }
}

/** Test/lab helper: drive the overlay without a real session. */
export function __setResumeStateForLab(next: Partial<ResumeState>): void {
  started = true
  cancelled = false
  patch(next)
}
