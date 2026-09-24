// The song, finally revealed: the cover flips over from a mystery card, a vinyl
// slides out of the sleeve and spins while the original preview plays.
import { motion, useReducedMotion } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Badge, Button, Equalizer, Icon, IconButton, Vinyl, cn, useCanHover, useMediaQuery } from '../../../components/ui'
import type { TrackInfo } from '../../../game/types'
import { formatClockS } from './model'

export interface RevealAccent {
  primary: string
  secondary: string
}

/** Where the reveal song is: seconds elapsed / total, or null when silent. */
export type SongProgressFn = () => { elapsed: number; duration: number } | null

interface SongCardProps {
  track: TrackInfo
  accent: RevealAccent
  /** The reveal song is audible (vinyl spins, equalizer moves). */
  playing: boolean
  /** Paused part-way: the button resumes from there. */
  paused?: boolean
  /** Started but not audible yet (audio still locked): the button asks for the tap that unlocks it. */
  pending?: boolean
  /** Pause / resume the original preview. Omit to hide the control. */
  onToggleSong?: () => void
  /** Per-frame progress of the song (drives the now-playing bar on larger screens). */
  songProgress?: SongProgressFn
  /** Small facts shown as chips (e.g. "8 spezzoni", "124 BPM"). */
  facts?: string[]
  /** Entrance animation (false = render settled). */
  animate: boolean
  /**
   * row = cover beside the text (phones, tablets) · stack = cover on top (desktop
   * side column) · banner = wide row with the facts on the right (short desktops).
   * Default: stack from 1280px, row below.
   */
  variant?: SongCardVariant
  className?: string
}

export type SongCardVariant = 'row' | 'stack' | 'banner'

/** Title size steps: long titles shrink instead of wrapping into a tower. */
function titleClass(title: string, variant: SongCardVariant): string {
  const len = title.length
  if (variant === 'stack') {
    // The desktop side column is narrow (300–400 px).
    if (len <= 12) return 'text-[34px]'
    if (len <= 22) return 'text-[27px]'
    if (len <= 36) return 'text-[23px]'
    return 'text-[19px]'
  }
  if (len <= 12) return 'text-[22px] md:text-[34px] xl:text-[40px]'
  if (len <= 22) return 'text-[18px] md:text-[28px] xl:text-[32px]'
  if (len <= 36) return 'text-[15px] md:text-[23px] xl:text-[27px]'
  return 'text-[13px] md:text-[19px] xl:text-[22px]'
}

const SPRING = { type: 'spring', stiffness: 170, damping: 19, mass: 0.9 } as const
/** Slower, weightier spring for the cover flip so the "?" side reads for a beat. */
const FLIP = { type: 'spring', stiffness: 105, damping: 14, mass: 1, delay: 0.28 } as const

export const SongCard = memo(function SongCard({
  track,
  accent,
  playing,
  paused = false,
  pending = false,
  onToggleSong,
  songProgress,
  facts,
  animate,
  variant: variantProp,
  className,
}: SongCardProps) {
  const reduce = useReducedMotion()
  const canHover = useCanHover()
  const xl = useMediaQuery('(min-width: 1280px)')
  const md = useMediaQuery('(min-width: 768px)')
  const big = useMediaQuery('(min-width: 1600px) and (min-height: 960px)')
  const variant: SongCardVariant = variantProp ?? (xl ? 'stack' : 'row')
  const stack = variant === 'stack'
  const banner = variant === 'banner'
  const short = useMediaQuery('(max-height: 500px)')
  // Stack: the side column is ≥ 300 px wide (cover + the record peeking out must fit).
  const cover = stack ? (big ? 224 : 200) : banner ? 120 : md && !short ? 168 : 92
  const peek = Math.round(cover * (stack ? 0.3 : md ? 0.34 : 0.3))
  const vinyl = Math.round(cover * 0.94)
  const play = animate && !reduce
  const [coverBroken, setCoverBroken] = useState(false)
  const coverSrc = (md ? track.cover : track.coverSmall) || track.cover || track.coverSmall
  const vars = { '--acc': accent.primary, '--acc2': accent.secondary } as CSSProperties
  const album = track.album && track.album !== track.title ? track.album : ''

  return (
    <section aria-label="La canzone" className={cn('rv-song glass-flat relative overflow-hidden rounded-panel', className)} style={vars} data-variant={variant}>
      <div aria-hidden className="rv-song-wash" />
      <div
        className={cn(
          'relative flex h-full',
          stack ? 'flex-col items-stretch gap-6 p-6' : banner ? 'items-center gap-6 px-5 py-4' : 'items-center gap-3.5 p-3.5 md:gap-6 md:p-5',
        )}
      >
        {/* Sleeve + record */}
        <div className={cn('relative shrink-0', stack && 'self-center')} style={{ width: cover + peek, height: cover }}>
          <motion.div
            aria-hidden
            className="absolute top-1/2 left-0"
            style={{ marginTop: -vinyl / 2, marginLeft: (cover - vinyl) / 2 }}
            initial={play ? { x: 0, opacity: 0 } : false}
            animate={{ x: peek + (cover - vinyl) / 2 - 2, opacity: 1 }}
            transition={play ? { ...SPRING, delay: 0.95 } : { duration: 0 }}
          >
            <Vinyl cover={coverBroken ? null : coverSrc} size={vinyl} spin={playing} period={1.8} glow={accent.primary} />
          </motion.div>

          {/* Opacity lives on the wrapper: on the 3D element itself it would flatten the flip. */}
          <motion.div
            className="rv-flip absolute inset-y-0 left-0"
            style={{ width: cover }}
            initial={play ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="rv-flip-inner"
              initial={play ? { rotateY: 180, scale: 0.8 } : false}
              animate={{ rotateY: 0, scale: 1 }}
              transition={play ? FLIP : { duration: 0 }}
            >
              <div className="rv-face rv-face-front">
                {!coverBroken && coverSrc ? (
                  <>
                    <img aria-hidden src={coverSrc} alt="" className="rv-cover-glow" draggable={false} />
                    <img
                      src={coverSrc}
                      alt={`Copertina di ${track.album || track.title}`}
                      className="rv-cover"
                      draggable={false}
                      decoding="async"
                      onError={() => setCoverBroken(true)}
                    />
                  </>
                ) : (
                  <div className="rv-cover rv-cover-fallback">
                    <Icon name="music" size={Math.round(cover * 0.34)} strokeWidth={1.6} />
                  </div>
                )}
              </div>
              <div aria-hidden className="rv-face rv-face-back">
                <span className="display" style={{ fontSize: cover * 0.5 }}>
                  ?
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Text */}
        <motion.div
          className={cn('rv-song-text relative min-w-0 flex-1', banner ? 'grid items-center gap-x-8' : 'flex flex-col')}
          initial={play ? 'hidden' : false}
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } } }}
        >
          <Line>
            <p className="eyebrow flex h-4 items-center gap-2 text-[10px] md:text-[11px]">
              <span className="rv-acc-text">La canzone era</span>
              <Equalizer
                bars={4}
                size={12}
                playing={playing}
                tone="lime"
                label={playing ? 'In riproduzione' : null}
                className={cn('transition-opacity duration-300', playing ? 'opacity-100' : 'opacity-0')}
              />
            </p>
          </Line>
          <Line>
            <h2
              className={cn(
                'display display-skew mt-1.5 origin-left pr-1 text-balance text-white md:mt-2',
                banner ? 'line-clamp-2' : stack ? 'line-clamp-4' : 'line-clamp-3',
                titleClass(track.title, variant),
              )}
              style={{ textShadow: `0 0 28px color-mix(in oklab, ${accent.primary} 45%, transparent)` }}
            >
              {track.title}
            </h2>
          </Line>
          <Line>
            <p className="mt-1 truncate text-sm font-bold text-ink-100 md:mt-2 md:text-lg">
              {track.artist}
              {album && !stack && <span className="font-semibold text-ink-300"> · {album}</span>}
            </p>
          </Line>
          {album && stack && (
            <Line>
              <p className="truncate text-sm font-semibold text-ink-300">{album}</p>
            </Line>
          )}
          <Line className={stack ? 'order-last' : undefined}>
            <div className={cn('flex items-center gap-2', stack ? 'mt-5' : banner ? 'mt-3' : 'mt-2.5 md:mt-4')}>
              {onToggleSong && pending && (
                <Button size="sm" variant="primary" leftIcon="play" onClick={onToggleSong} sound={false} className="shrink-0">
                  {canHover ? 'Clicca per ascoltare' : 'Tocca per ascoltare'}
                </Button>
              )}
              {onToggleSong && !pending && (
                <IconButton
                  icon={playing ? 'pause' : 'play'}
                  label={playing ? 'Ferma la canzone' : paused ? 'Riprendi la canzone' : 'Riascolta la canzone'}
                  size="sm"
                  variant={playing ? 'glass' : 'secondary'}
                  onClick={onToggleSong}
                  sound={false}
                />
              )}
              {track.link && (
                <a
                  href={track.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-glass btn-sm min-w-0"
                  aria-label={`Ascolta ${track.title} su Deezer (si apre in una nuova scheda)`}
                >
                  <span className="btn-label">
                    <span>
                      Ascolta<span className="hidden min-[420px]:inline"> su Deezer</span>
                    </span>
                    <Icon name="external" size={14} strokeWidth={2.4} />
                  </span>
                </a>
              )}
            </div>
          </Line>
          {(facts?.length || songProgress) && (
            <Line className={cn('rv-song-meta hidden md:block', stack && 'mt-auto')}>
              <div className={stack ? 'mt-6' : banner ? undefined : 'md:mt-4'}>
                {facts && facts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {facts.map((f) => (
                      <Badge key={f} tone="neutral" size="sm">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
                {songProgress && <NowPlaying progress={songProgress} playing={playing} paused={paused} />}
              </div>
            </Line>
          )}
        </motion.div>
      </div>
    </section>
  )
})

function Line({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10, filter: 'blur(6px)' },
        shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 24 } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Thin progress bar + time of the reveal song, updated per frame without re-rendering. */
function NowPlaying({ progress, playing, paused }: { progress: SongProgressFn; playing: boolean; paused: boolean }) {
  const fillRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const lastText = useRef('')
  useEffect(() => {
    let raf = 0
    const draw = () => {
      const p = safeProgress(progress)
      const frac = p && p.duration > 0 ? Math.min(1, p.elapsed / p.duration) : 0
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${frac})`
      const text = p ? `${formatClockS(p.elapsed)} / ${formatClockS(p.duration)}` : ''
      if (timeRef.current && text !== lastText.current) {
        lastText.current = text
        timeRef.current.textContent = text
      }
      if (playing) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [progress, playing, paused])
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] font-bold text-ink-300">
        <span>{playing ? 'In riproduzione' : paused ? 'In pausa' : 'Ferma'}</span>
        <span ref={timeRef} className="rv-tnum" />
      </div>
      <div className="rv-np mt-1.5">
        <div ref={fillRef} className="rv-np-fill" />
      </div>
    </div>
  )
}

function safeProgress(fn: SongProgressFn) {
  try {
    return fn()
  } catch {
    return null
  }
}
