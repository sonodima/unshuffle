// "Riconnessione…" overlay shown while the boot-time resumeSession() runs
// (after a refresh inside a room), plus a notice if it failed.

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button, Equalizer, Modal, Vinyl } from '../ui'
import { exitNoticeCopy, isRoomGoneMessage } from './connectionCopy'
import { cancelResume, dismissResumeFailure, useResumeState } from './resume'

/** The overlay only appears if resuming takes longer than this (no flash on fast paths). */
const SHOW_AFTER_MS = 180
/** "Annulla" appears once the wait starts to feel long. */
const CANCEL_AFTER_MS = 3500

export interface ResumeCardProps {
  code: string | null
  role: 'host' | 'client' | null
  canCancel: boolean
  onCancel(): void
}

/** Presentational overlay (render inside AnimatePresence). */
export function ResumeCard({ code, role, canCancel, onCancel }: ResumeCardProps) {
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
          Riconnessione
          <Equalizer bars={3} size={16} tone="lime" label={null} />
        </p>
        <p className="relative mt-2 text-sm text-ink-300">
          {role === 'host' ? 'Riapro la tua stanza' : 'Rientro nella stanza'}
          {code && (
            <>
              {' '}
              <span className="num font-bold tracking-[0.12em] text-ink-50">{code}</span>
            </>
          )}
        </p>
        <div className="relative mt-6 h-12">
          <AnimatePresence>
            {canCancel && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Annulla
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
  const [lastFailure, setLastFailure] = useState<string | null>(null)
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
            Ok
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-pretty text-ink-300">
          {gone ? (
            <>
              {st.code && (
                <>
                  La stanza <span className="num font-bold text-ink-100">{st.code}</span> non c’è più.{' '}
                </>
              )}
              {shown.hint}
            </>
          ) : st.code ? (
            <>
              Non sono riuscito a riportarti nella stanza <span className="num font-bold text-ink-100">{st.code}</span>. Se la partita è
              ancora in corso, rientra col codice dalla home.
            </>
          ) : (
            'Se la partita è ancora in corso, rientra col codice dalla home.'
          )}
        </p>
      </Modal>
    </>
  )
}
