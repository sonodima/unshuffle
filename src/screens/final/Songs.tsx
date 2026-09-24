import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine, evictAudio } from '../../audio/engine'
import { usePlayback } from '../../audio/usePlayback'
import { Equalizer, Icon, Spinner, cn } from '../../components/ui'
import type { TrackInfo } from '../../game/types'
import { useT } from '../../i18n/react'
import { previewExpiresAt, refreshPreview } from '../../lib/deezer'
import { Cover } from './Cover'
import { dzCoverSize } from './dzImage'
import { SectionHeading } from './SectionHeading'
import type { RoundRow } from './stats'

interface SongsProps {
  rounds: RoundRow[]
  reduced: boolean
  className?: string
}

function deezerLink(row: RoundRow): string | null {
  const t = row.track
  if (!t) return null
  if (t.link && /^https:\/\/(www\.)?deezer\.com\//.test(t.link)) return t.link
  return t.id > 0 ? `https://www.deezer.com/track/${t.id}` : null
}

const TAG = 'final-song:'

interface Session {
  request: number
  decoded: Set<string>
}
const newSession = (): Session => ({ request: 0, decoded: new Set() })

/**
 * Play / stop a song's 30 s preview from the final screen. The store has already freed the
 * rounds' decoded audio, so a preview is fetched again on demand (with a fresh signed URL
 * when the old one has expired) and freed again when the screen goes away.
 */
function useSongPreview() {
  const playback = usePlayback()
  const playingId = playback.playing && playback.tag?.startsWith(TAG) ? Number(playback.tag.slice(TAG.length)) : null
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)
  // One session per mount: the latest request id (a newer tap or unmounting cancels older
  // ones) and the buffers we decoded (freed on unmount).
  const session = useRef<Session>(newSession())

  useEffect(() => {
    const s = newSession()
    session.current = s
    return () => {
      s.request++
      try {
        if (audioEngine.getState().tag?.startsWith(TAG)) audioEngine.stop(200)
        for (const key of s.decoded) evictAudio(key)
      } catch {
        // audio is optional
      }
      s.decoded.clear()
    }
  }, [])

  const toggle = useCallback(
    async (t: TrackInfo) => {
      const s = session.current
      if (playingId === t.id) {
        s.request++
        audioEngine.stop(180)
        return
      }
      const id = ++s.request
      setFailedId(null)
      setLoadingId(t.id)
      try {
        // Still inside the tap: iOS only unlocks audio from a gesture.
        void audioEngine.unlock().catch(() => {})
        const key = `track:${t.id}`
        const cached = audioEngine.has(key)
        if (!cached) {
          const fresh = t.preview && (previewExpiresAt(t.preview) ?? Infinity) > Date.now() + 20_000
          const url = fresh ? t.preview : await refreshPreview(t.id)
          if (id !== s.request) return
          await audioEngine.load(key, url, () => refreshPreview(t.id))
          s.decoded.add(key)
        }
        if (id !== s.request) return
        audioEngine.playFull(key, { tag: `${TAG}${t.id}`, fadeInMs: 250 })
      } catch {
        if (id === s.request) setFailedId(t.id)
      } finally {
        if (id === s.request) setLoadingId(null)
      }
    },
    [playingId],
  )

  return { playingId, loadingId, failedId, toggle }
}

/** The songs of the game: replay each preview right here, or open it on Deezer. */
export function Songs({ rounds, reduced, className }: SongsProps) {
  const t = useT()
  const rows = rounds.filter((r) => r.track)
  const { playingId, loadingId, failedId, toggle } = useSongPreview()
  if (!rows.length) return null
  return (
    <section className={className} aria-labelledby="fp-songs">
      <SectionHeading id="fp-songs" icon="disc" title={t('final.songs.title')} aside={<span className="max-sm:hidden">{t('final.songs.aside')}</span>} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {rows.map((r, i) => {
          const track = r.track!
          const href = deezerLink(r)
          const playing = playingId === track.id
          const loading = loadingId === track.id
          const failed = failedId === track.id
          const song = { title: track.title, artist: track.artist, round: r.index + 1 }
          return (
            <motion.li
              key={r.index}
              className="min-w-0"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -6% 0px' }}
              transition={{ duration: 0.5, delay: Math.min(i, 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative transition-transform duration-300 ease-out hover:-translate-y-1 has-[:focus-visible]:-translate-y-1">
                <button
                  type="button"
                  onClick={() => void toggle(track)}
                  aria-pressed={playing}
                  aria-label={t(playing ? 'final.songs.stop' : 'final.songs.play', song)}
                  className="group/cover tap-none relative block w-full rounded-block outline-offset-4 transition-transform duration-150 active:scale-[0.98]"
                >
                  {/* 500px is plenty for tiles of ~170–210 CSS px, even at 3x (Deezer's default here is 1000px). */}
                  <Cover
                    src={dzCoverSize(track.cover || track.coverSmall, 500)}
                    className="aspect-square w-full rounded-block shadow-lift"
                    iconSize={36}
                  />
                  <span className="num absolute top-2 left-2 rounded-full bg-ink-950/85 px-2 py-0.5 text-[11px] font-bold tracking-wider whitespace-nowrap text-ink-100 ring-1 ring-white/15">
                    {t('final.roundShort', { round: r.index + 1 })}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'absolute bottom-2 left-2 grid size-10 place-items-center rounded-full ring-1 transition-colors duration-200',
                      playing ? 'bg-lime text-ink-950 ring-lime' : 'bg-ink-950/70 text-ink-50 ring-white/20 group-hover/cover:bg-lime group-hover/cover:text-ink-950 group-hover/cover:ring-lime',
                    )}
                  >
                    {loading ? <Spinner size={16} label={null} /> : <Icon name={playing ? 'stop' : 'play'} size={16} filled strokeWidth={2.4} />}
                  </span>
                  {playing && (
                    <>
                      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-block shadow-glow-lime ring-2 ring-lime" />
                      <Equalizer bars={4} size={16} tone="lime" label={null} className="absolute top-2.5 right-2.5 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]" />
                      <PreviewProgress tag={`${TAG}${track.id}`} />
                    </>
                  )}
                </button>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2 bottom-2 grid size-10 place-items-center rounded-full bg-ink-950/85 text-ink-50 ring-1 ring-white/20 transition-colors duration-200 outline-offset-2 hover:bg-white hover:text-ink-950 hover:ring-white"
                    aria-label={t('final.songs.open', { title: track.title })}
                    title={t('final.songs.openTooltip')}
                  >
                    <Icon name="external" size={15} strokeWidth={2.4} />
                  </a>
                )}
              </div>
              <div className="mt-2.5 min-w-0 px-0.5">
                <div className="line-clamp-2 text-[13.5px] leading-snug font-extrabold text-ink-50 sm:text-sm">{track.title}</div>
                <div className="mt-0.5 truncate text-[12px] font-semibold text-ink-300">{track.artist}</div>
                <div aria-live="polite" className="text-[12px] leading-snug font-bold text-coral empty:hidden">
                  {failed ? t('final.songs.unavailable') : ''}
                </div>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}

/** Thin progress bar along the bottom of the cover while its preview plays. */
function PreviewProgress({ tag }: { tag: string }) {
  const bar = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = audioEngine.getPosition()
      if (bar.current) bar.current.style.transform = `scaleX(${p && p.tag === tag ? Math.max(0, Math.min(1, p.progress)) : 0})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tag])
  return (
    <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 overflow-hidden rounded-full bg-white/15">
      <span ref={bar} className="block h-full origin-left scale-x-0 rounded-full bg-lime" />
    </span>
  )
}
