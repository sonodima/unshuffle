// App-wide side effects owned by the shell.

import { useEffect } from 'react'
import { useGame } from '../../game/store'
import type { PhaseKind } from '../../game/types'
import { startResume } from './resume'

export const LEAVE_WARNING = 'Se esci la partita finisce per tutti'

const IN_PROGRESS: ReadonlySet<PhaseKind> = new Set<PhaseKind>(['preparing', 'intro', 'playing', 'reveal'])

/** True while this tab hosts a game that is running (closing it ends it for everyone). */
export function isHostingGame(s: { role: string; room: { phase: { kind: PhaseKind } } | null }): boolean {
  return s.role === 'host' && !!s.room && IN_PROGRESS.has(s.room.phase.kind)
}

/** Native "leave page?" confirmation while hosting a game in progress. */
export function useLeaveGuard(): void {
  const guard = useGame(isHostingGame)
  useEffect(() => {
    if (!guard) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy browsers show (or at least require) returnValue; modern ones use their own text.
      e.returnValue = LEAVE_WARNING
      return LEAVE_WARNING
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [guard])
}

/**
 * The app is installable (manifest + icons), so Chrome on Android may slide its install
 * mini-infobar up from the bottom — right over the docked CONFERMA / Inizia partita.
 * Suppress it while in a room; the browser menu still offers "Installa app".
 */
export function useInstallPromptGuard(): void {
  const inRoom = useGame((s) => s.room !== null)
  useEffect(() => {
    if (!inRoom) return
    const onPrompt = (e: Event) => e.preventDefault()
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [inRoom])
}

/** Resume this tab's previous room once per page load. */
export function useBootResume(): void {
  useEffect(() => {
    startResume()
  }, [])
}
