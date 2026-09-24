// Between rounds / before the first one: the host picks and slices the song while
// every peer downloads it. A spinning record, a live checklist, who's ready.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAudioBuffer } from '../../components/board'
import { Button, Equalizer, Icon, ProgressDots, Spinner, Vinyl, cn, useCanHover, useMediaQuery } from '../../components/ui'
import type { AudioStatus } from '../../game/store'
import type { PlayerId, RoomState } from '../../game/types'
import { GameMenuButton } from './GameMenu'
import { activePlayers, readyCount, roundInfo } from './model'
import { PlayersStrip } from './PlayersStrip'
import './round.css'

interface PreparingViewProps {
  room: RoomState
  me: PlayerId
  /** Download status per track id (useGame().audio). */
  audio: Record<number, AudioStatus>
  /** Download the round's audio again; resolve when decoded. */
  onRetryAudio?(): Promise<unknown>
}

type StepState = 'done' | 'active' | 'pending' | 'error'

const TIPS = [
  '', // how to play, worded for the device (see tipText)
  '“Ascolta tutto” suona i blocchi nell’ordine attuale: se fila liscio, ci sei quasi.',
  'Tieni premuto un blocco per ascoltare la sequenza da lì.',
  'Due blocchi vicini nell’ordine giusto valgono punti anche se sono fuori posto.',
  'Chi conferma per primo fa partire il timer finale per tutti.',
  'Cerca l’attacco della canzone e il punto in cui sfuma: sono i primi e gli ultimi blocchi.',
  'Ordine perfetto = 5.000 punti. Nessuna pressione.',
]
const TIP_MS = 5200

function tipText(i: number, canHover: boolean): string {
  if (i === 0) return canHover ? 'Clicca un blocco per ascoltarlo, trascinalo per spostarlo.' : 'Tocca un blocco per ascoltarlo, trascinalo per spostarlo.'
  return TIPS[i] ?? ''
}

export function PreparingView({ room, me, audio, onRetryAudio }: PreparingViewProps) {
  const reduce = useReducedMotion()
  const phase = room.phase
  const index = phase.kind === 'preparing' ? phase.round : 0
  const info = roundInfo(room, index)
  const trackId = info.track?.id
  const buffer = useAudioBuffer(trackId != null ? `track:${trackId}` : '')
  const status: AudioStatus | undefined = buffer ? 'ready' : trackId != null ? audio[trackId] : undefined
  const [retrying, setRetrying] = useState(false)
  const wide = useMediaQuery('(min-width: 768px) and (min-height: 600px)')
  // Desktop: a record that owns the screen, big type, the tip right under the checklist.
  const big = useMediaQuery('(min-width: 1024px) and (min-height: 700px)')
  const tall = useMediaQuery('(min-height: 760px)')
  const short = useMediaQuery('(max-height: 700px)')
  const vinylSize = big ? 420 : wide ? 300 : tall ? 196 : short ? 116 : 150

  const players = activePlayers(room, index).filter((p) => p.connected)
  const ready = readyCount(room, index)
  const readySet = new Set(players.filter((p) => room.ready[p.id]).map((p) => p.id))

  const song: StepState = info.track ? 'done' : 'active'
  const download: StepState = !info.track ? 'pending' : status === 'ready' ? 'done' : status === 'error' && !retrying ? 'error' : 'active'
  const slice: StepState = info.data ? 'done' : info.track ? 'active' : 'pending'
  const allReady = ready.total > 0 && ready.ready >= ready.total
  // Once the round is cut only the others can hold us up; before that the host's message tells the story.
  const message = info.data
    ? allReady
      ? 'Tutti pronti, si parte!'
      : 'Aspetto che tutti siano pronti…'
    : (phase.kind === 'preparing' && phase.message) || 'Preparo il round…'

  const retry = () => {
    if (!onRetryAudio || retrying) return
    setRetrying(true)
    onRetryAudio()
      .catch(() => {})
      .finally(() => setRetrying(false))
  }

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay } } }
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 30, delay } } }

  const header = (
    <>
      <span className={cn('display display-skew block text-[15px] text-ink-200 md:text-lg', big && 'md:text-xl')}>
        Round <span className="text-white">{info.number}</span>
        <span className="text-ink-400"> / {info.total}</span>
      </span>
      <ProgressDots total={info.total} current={info.index} size="md" />
    </>
  )

  return (
    <div className="relative flex h-full flex-col overflow-y-auto px-safe-4 pt-safe-6 pb-safe-5 md:px-safe-10" data-round-view="preparing">
      <div className="absolute top-safe-3 left-[calc(12px+env(safe-area-inset-left,0px))] z-10 md:top-safe-5 md:left-[calc(24px+env(safe-area-inset-left,0px))]">
        <GameMenuButton size={wide ? 'md' : 'sm'} />
      </div>
      <div
        className={cn(
          'my-auto flex w-full flex-col items-center md:mx-auto md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-16',
          big ? 'md:max-w-[min(1100px,90vw)]' : 'md:max-w-[980px] lg:gap-20',
        )}
      >
        <motion.header {...rise(0)} className="flex flex-col items-center gap-2.5 md:hidden">
          {header}
        </motion.header>

        <motion.div
          className="relative my-6 md:my-0 [@media(max-height:700px)]:my-4"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, rotate: -30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        >
          <Vinyl size={vinylSize} cover={room.settings.playlist?.picture} arm glow="var(--color-violet)" />
          {/* Cutting glint */}
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
            <span className="rs-slice absolute top-0 left-1/2 h-full w-[3px] -translate-x-1/2 bg-linear-to-b from-transparent via-white to-transparent opacity-0 shadow-[0_0_14px_2px_rgb(255_255_255/0.7)]" />
          </span>
        </motion.div>

        <div className="flex w-full min-w-0 flex-col items-center text-center md:items-start md:text-left">
          <motion.header {...rise(0)} className={cn('hidden flex-col items-start gap-2.5 md:flex [@media(max-height:500px)]:mb-3', big ? 'mb-7' : 'mb-6')}>
            {header}
          </motion.header>

          <motion.div {...rise(0.1)} className="flex max-w-[30ch] flex-col items-center gap-3 md:max-w-none md:flex-row md:items-center md:gap-4">
            <Equalizer bars={5} size={big ? 32 : 26} playing tone="gradient" label={null} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={message}
                className={cn('display display-skew text-[22px] leading-tight text-white md:text-[30px] [@media(max-height:500px)]:text-[20px]!', big && 'md:text-[40px]')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                aria-live="polite"
              >
                {message}
              </motion.h1>
            </AnimatePresence>
          </motion.div>

          <motion.ol
            {...rise(0.2)}
            className={cn('glass-flat mt-6 flex w-full flex-col gap-1 rounded-[24px] p-2 text-left md:mt-7 [@media(max-height:500px)]:mt-4!', big ? 'max-w-[480px] md:mt-8' : 'max-w-[420px]')}
          >
            <Step big={big} state={song} label={song === 'done' ? 'Canzone scelta' : 'Scelgo la canzone…'} detail={song === 'done' ? 'Top secret fino alla fine' : undefined} />
            <Step
              big={big}
              state={download}
              label={download === 'done' ? 'Spezzoni scaricati' : download === 'error' ? 'Download fallito' : 'Scarico gli spezzoni…'}
              detail={download === 'error' ? 'Si gioca anche senza audio' : undefined}
              action={
                download === 'error' && onRetryAudio ? (
                  <Button size="sm" variant="danger" leftIcon="refresh" loading={retrying} onClick={retry}>
                    Riprova
                  </Button>
                ) : null
              }
            />
            <Step
              big={big}
              state={slice}
              label={slice === 'done' ? 'Traccia affettata' : 'Sto affettando la traccia…'}
              detail={slice === 'done' ? `${info.snippets} spezzoni a tempo di musica` : undefined}
            />
          </motion.ol>

          {players.length > 0 && (
            <motion.div {...rise(0.3)} className={cn('flex flex-col items-center gap-2.5 md:flex-row md:gap-4', big ? 'mt-6' : 'mt-5')}>
              <span className="eyebrow">
                Pronti <span className="num text-ink-50">{ready.ready}</span>
                <span className="num text-ink-300">/{ready.total}</span>
              </span>
              <PlayersStrip players={players} checked={readySet} me={me} size={big ? 'md' : 'sm'} max={10} label="Giocatori pronti" />
            </motion.div>
          )}

          {big && (
            <motion.div {...rise(0.4)} className="mt-10 w-full max-w-[480px]">
              <Tips />
            </motion.div>
          )}
        </div>
      </div>

      {!big && (
        <motion.div {...rise(0.4)} className="mx-auto w-full max-w-[440px] pt-7 md:max-w-[560px] md:pt-10 [@media(max-height:700px)]:hidden">
          <Tips />
        </motion.div>
      )}
    </div>
  )
}

function Step({ state, label, detail, action, big = false }: { state: StepState; label: string; detail?: string; action?: ReactNode; big?: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-[18px] px-3 py-2 transition-colors duration-300',
        big ? 'min-h-[60px] gap-3.5 px-3.5' : 'min-h-[52px]',
        state === 'active' && 'bg-white/[0.05]',
        state === 'error' && 'bg-coral/[0.08]',
      )}
      aria-current={state === 'active' ? 'step' : undefined}
    >
      <StepIcon state={state} />
      <div className="min-w-0 flex-1">
        <p className={cn('leading-tight font-bold', big ? 'text-[16px]' : 'text-[14px]', state === 'pending' ? 'text-ink-400' : state === 'error' ? 'text-coral' : 'text-ink-50')}>{label}</p>
        {detail && <p className={cn('mt-0.5 truncate font-semibold text-ink-400', big ? 'text-[13px]' : 'text-[12px]')}>{detail}</p>}
      </div>
      {action}
    </li>
  )
}

function StepIcon({ state }: { state: StepState }) {
  return (
    <span className="relative grid size-7 shrink-0 place-items-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {state === 'done' ? (
          <motion.span
            key="done"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}
            className="grid size-7 place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_14px_rgb(166_255_63/0.5)]"
          >
            <Icon name="check" size={16} strokeWidth={3.4} />
          </motion.span>
        ) : state === 'active' ? (
          <motion.span key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid size-7 place-items-center text-violet-bright">
            <Spinner size={22} />
          </motion.span>
        ) : state === 'error' ? (
          <motion.span key="error" initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-7 place-items-center rounded-full bg-coral text-white">
            <Icon name="alert" size={15} strokeWidth={2.8} />
          </motion.span>
        ) : (
          <motion.span key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="size-7 rounded-full border-2 border-dashed border-white/15" />
        )}
      </AnimatePresence>
    </span>
  )
}

function Tips() {
  const canHover = useCanHover()
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % TIPS.length), TIP_MS)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="glass-subtle flex items-start gap-3 rounded-[20px] px-4 py-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
        <Icon name="sparkles" size={15} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-[10px] text-gold/80">Lo sapevi?</p>
        <div className="relative mt-1 min-h-[2.8em] text-[13px] leading-snug font-semibold text-ink-100">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              {tipText(i, canHover)}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
