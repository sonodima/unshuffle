// "Riconnessione…" overlay shown while the boot-time resumeSession() runs
// (after a refresh inside a room), plus a notice if it failed.

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Msg } from '../../i18n'
import { rich, useT } from '../../i18n/react'
import { Button, Equalizer, Modal, Vinyl } from '../ui'
import { exitNoticeCopy, isRoomGoneMessage } from './connectionCopy'
import { cancelResume, dismissResumeFailure, useResumeState } from './resume'

/** The overlay only appears if resuming takes longer than this (no flash on fast paths). */
const SHOW_AFTER_MS = 180
/** "Annulla" appears once the wait starts to feel long. */
const CANCEL_AFTER_MS = 3500

interface ResumeCardProps {
  code: string | null
  role: 'host' | 'client' | null
  canCancel: boolean
  onCancel(): void
}

/** The room code inside a sentence. */
const roomCode = (className: string) => ({ b: (c: string): ReactNode => <span className={className}>{c}</span> })

/** Presentational overlay (render inside AnimatePresence). */
function ResumeCard({ code, role, canCancel, onCancel }: ResumeCardProps) {
  const t = useT()
  const host = role === 'host'
  return (
    <motion.div
      key="resume"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[850] grid place-items-center bg-ink-950/55 px-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="glass-flat relative flex w-full max-w-[340px] flex-col items-center overflow-hidden rounded-panel px-6 pt-8 pb-6 text-center"
      >
        <span aria-hidden className="absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full bg-violet/35 blur-3xl" />
        <Vinyl size={112} period={1.6} glow="var(--color-violet)" className="relative" />
        <p className="display display-skew relative mt-6 inline-flex items-center gap-2.5 text-xl">
          {t('shell.resume.title')}
          <Equalizer bars={3} size={16} tone="lime" label={null} />
        </p>
        <p className="relative mt-2 text-sm text-ink-300">
          {code
            ? rich(t(host ? 'shell.resume.hostRoom' : 'shell.resume.clientRoom', { code }), roomCode('num font-bold tracking-[0.12em] text-ink-50'))
            : t(host ? 'shell.resume.host' : 'shell.resume.client')}
        </p>
        <div className="relative mt-6 h-12">
          <AnimatePresence>
            {canCancel && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  {t('shell.action.cancel')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ResumeOverlay() {
  const t = useT()
  const st = useResumeState()
  const running = st.phase === 'running'
  const [visible, setVisible] = useState(false)
  const [canCancel, setCanCancel] = useState(false)

  useEffect(() => {
    if (!running) {
      setVisible(false)
      setCanCancel(false)
      return
    }
    const elapsed = Date.now() - st.startedAt
    const show = setTimeout(() => setVisible(true), Math.max(0, SHOW_AFTER_MS - elapsed))
    const cancel = setTimeout(() => setCanCancel(true), Math.max(0, CANCEL_AFTER_MS - elapsed))
    return () => {
      clearTimeout(show)
      clearTimeout(cancel)
    }
  }, [running, st.startedAt])

  // Keep the last failure while the modal animates out.
  const [lastFailure, setLastFailure] = useState<Msg | null>(null)
  if (st.failure && st.failure !== lastFailure) setLastFailure(st.failure)
  const failure = st.failure ?? lastFailure
  // After ~15 s of "room not found" the room is gone: say so (the player never typed a code).
  const gone = isRoomGoneMessage(failure)
  const shown = exitNoticeCopy(gone ? 'gone' : 'failed', failure)

  return (
    <>
      <AnimatePresence>{running && visible && <ResumeCard code={st.code} role={st.role} canCancel={canCancel} onCancel={cancelResume} />}</AnimatePresence>
      <Modal
        open={!!st.failure}
        onClose={dismissResumeFailure}
        size="sm"
        title={shown.title}
        description={shown.description || undefined}
        footer={
          <Button variant="primary" onClick={dismissResumeFailure}>
            {t('shell.action.ok')}
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-pretty text-ink-300">
          {gone
            ? st.code
              ? rich(t('shell.resume.goneRoom', { code: st.code, hint: shown.hint }), roomCode('num font-bold text-ink-100'))
              : shown.hint
            : st.code
              ? rich(t('shell.resume.failedRoom', { code: st.code }), roomCode('num font-bold text-ink-100'))
              : t('shell.resume.failed')}
        </p>
      </Modal>
    </>
  )
}
