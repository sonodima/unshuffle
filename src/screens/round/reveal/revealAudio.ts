// Side effects of the reveal outside the view: the original preview playing from
// the start (tag 'reveal'), and album-derived accents for the shader background.
// Every engine / store call is defensive: missing audio must never break the screen.
//
// During the reveal the song is the soundtrack. A tap on a board block (the board's
// onTapSegment) seeks: the song carries on from that snippet instead of the lone
// snippet playing. Tapping the block that is playing pauses; the song card's button
// pauses / resumes from the same spot.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { audioEngine } from '../../../audio/engine'
import type { AudioEngine, PlaybackState } from '../../../audio/engine'
import { useBackground } from '../../../components/background/useBackground'
import { DEFAULT_COVER_COLORS, extractCoverColors, peekCoverColors } from '../../../lib/coverColor'
import { segmentAt } from './model'
import type { RevealAccent, SongProgressFn } from './SongCard'

export const REVEAL_TAG = 'reveal'
const FADE_IN_MS = 400
const FADE_OUT_MS = 450
/** Fade-in when the song jumps to a snippet (short: the tap should feel immediate). */
const SEEK_FADE_MS = 90
const PAUSE_FADE_MS = 220
/** How long to wait for a buffer that is still decoding before giving up on autoplay. */
const WAIT_FOR_BUFFER_MS = 20_000
/** Resuming this close to the end restarts from the top instead. */
const END_MARGIN_S = 0.6

function engine(): AudioEngine | null {
  const e = audioEngine as AudioEngine | null | undefined
  return e && typeof e.playFull === 'function' ? e : null
}

function isReveal(s: PlaybackState | null | undefined, key: string): boolean {
  return !!s && s.playing && s.key === key && s.tag === REVEAL_TAG
}

const IDLE: PlaybackState = { playing: false, mode: null, key: null, tag: null, index: 0 }

function subscribe(listener: () => void): () => void {
  try {
    return engine()?.subscribe(() => listener()) ?? (() => {})
  } catch {
    return () => {}
  }
}

function snapshot(): PlaybackState {
  try {
    return engine()?.getState() ?? IDLE
  } catch {
    return IDLE
  }
}

export interface RevealSegmentRange {
  start: number
  end: number
}

export interface RevealSong {
  /** The reveal preview is playing (see `pending`: it may not be audible yet). */
  playing: boolean
  /** Playing, but the AudioContext is still locked / interrupted: nothing is audible until a tap. */
  pending: boolean
  /** Stopped part-way: play resumes from there (false once it ended or was never paused). */
  paused: boolean
  /** Pause / resume (or play from the top once it ended). */
  toggle(): void
  /** Play from `t` seconds of the preview and keep going to the end. */
  seek(t: number): void
  /** A tap on a board block: jump the song to that snippet (pause if it is the one playing). */
  tapSegment(segment: number): void
  /** Per-frame 0..1 progress of the song inside `segment` (null when it is elsewhere). */
  segmentProgress(segment: number): number | null
  /** Seconds elapsed / total of the reveal song (the paused spot while paused), null without a buffer. */
  progress: SongProgressFn
  /** Segment index audible right now (-1 when silent or between snippets). */
  segment: number
}

/**
 * Plays `key` from the start once its buffer is decoded (fade-in 400 ms) and
 * stops it on unmount — only if the reveal is still what's playing. With
 * `segments`, block taps on the board seek the song (see the header).
 */
export function useRevealSong(key: string | null, segments?: readonly RevealSegmentRange[] | null): RevealSong {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot)
  const keyRef = useRef(key)
  const segmentsRef = useRef(segments ?? null)
  useEffect(() => {
    keyRef.current = key
    segmentsRef.current = segments ?? null
  })

  /** Song time (s) where the current reveal session started. */
  const fromRef = useRef(0)
  /** Where a pause left the song (0 = from the top). */
  const [resumeAt, setResumeAtState] = useState(0)
  const resumeRef = useRef(0)
  const setResumeAt = useCallback((t: number) => {
    resumeRef.current = t
    setResumeAtState(t)
  }, [])
  /** Last sampled audible segment (kept by the sampler below, read by the tap handler). */
  const segRef = useRef(-1)
  const lastTimeRef = useRef(0)
  const [current, setCurrent] = useState(-1)
  const clearSegment = useCallback(() => {
    segRef.current = -1
    setCurrent(-1)
  }, [])

  const songTime = useCallback((): number | null => {
    const k = keyRef.current
    const e = engine()
    if (!k || !e) return null
    try {
      const p = e.getPosition()
      if (!p || p.key !== k || p.tag !== REVEAL_TAG || p.mode !== 'full') return null
      const duration = e.get(k)?.duration ?? Infinity
      return Math.min(duration, fromRef.current + p.elapsed)
    } catch {
      return null
    }
  }, [])

  const start = useCallback(
    (from: number, fadeInMs: number) => {
      const k = keyRef.current
      const e = engine()
      if (!k || !e || !e.has(k)) return
      const duration = e.get(k)?.duration ?? 0
      const t = from > 0 && from < duration - END_MARGIN_S ? from : 0
      fromRef.current = t
      setResumeAt(0)
      e.playFull(k, {
        tag: REVEAL_TAG,
        from: t,
        fadeInMs,
        onEnded: () => {
          if (keyRef.current !== k) return
          setResumeAt(0)
          clearSegment()
        },
      })
    },
    [setResumeAt, clearSegment],
  )

  // Autoplay from the top once decoded.
  useEffect(() => {
    if (!key) return
    let timer: ReturnType<typeof setInterval> | null = null
    const started = performance.now()
    const tryStart = (): boolean => {
      const e = engine()
      if (!e) return true
      try {
        if (!e.has(key)) return performance.now() - started > WAIT_FOR_BUFFER_MS
        start(0, FADE_IN_MS)
      } catch (err) {
        console.warn('[reveal] playback failed', err)
      }
      return true
    }
    if (!tryStart()) {
      timer = setInterval(() => {
        if (tryStart() && timer) {
          clearInterval(timer)
          timer = null
        }
      }, 250)
    }
    return () => {
      if (timer) clearInterval(timer)
      try {
        const e = engine()
        if (e && isReveal(e.getState(), key)) e.stop(FADE_OUT_MS)
      } catch {
        // ignore
      }
    }
  }, [key, start])

  const pause = useCallback(() => {
    const e = engine()
    if (!e) return
    const t = songTime()
    try {
      e.stop(PAUSE_FADE_MS)
    } catch {
      // ignore
    }
    setResumeAt(t ?? 0)
    clearSegment()
  }, [songTime, setResumeAt, clearSegment])

  const toggle = useCallback(() => {
    const k = keyRef.current
    const e = engine()
    if (!k || !e) return
    try {
      const s = e.getState()
      void e.unlock().catch(() => {})
      // Locked audio: this tap is the gesture that makes the song audible, not a pause.
      if (isReveal(s, k) && s.pending) return
      if (isReveal(s, k)) pause()
      else start(resumeRef.current, resumeRef.current > 0 ? 160 : 250)
    } catch {
      // audio unavailable
    }
  }, [pause, start])

  const seek = useCallback(
    (t: number) => {
      try {
        void engine()
          ?.unlock()
          .catch(() => {})
        start(Math.max(0, t), SEEK_FADE_MS)
      } catch {
        // audio unavailable
      }
    },
    [start],
  )

  const tapSegment = useCallback(
    (n: number) => {
      const seg = segmentsRef.current?.[n]
      const e = engine()
      if (!seg || !e) return
      try {
        void e.unlock().catch(() => {})
        const s = e.getState()
        const k = keyRef.current
        if (k && isReveal(s, k) && !s.pending && segRef.current === n) {
          // Tapping the snippet that is playing pauses the song there.
          const t = Math.max(seg.start, songTime() ?? lastTimeRef.current)
          e.stop(PAUSE_FADE_MS)
          setResumeAt(t)
          clearSegment()
        } else {
          start(seg.start, SEEK_FADE_MS)
        }
      } catch {
        // audio unavailable
      }
    },
    [start, songTime, setResumeAt, clearSegment],
  )

  const segmentProgress = useCallback(
    (n: number): number | null => {
      const seg = segmentsRef.current?.[n]
      const t = songTime()
      if (!seg || t == null || t < seg.start || t >= seg.end) return null
      return (t - seg.start) / Math.max(1e-3, seg.end - seg.start)
    },
    [songTime],
  )

  // Sampler: which segment is audible (for the board highlight and the tap logic).
  const playing = !!key && isReveal(state, key)
  useEffect(() => {
    if (!playing) {
      segRef.current = -1
      return
    }
    let raf = 0
    const loop = () => {
      const t = songTime()
      if (t != null) lastTimeRef.current = t
      const segs = segmentsRef.current
      const i = t == null ? -1 : segmentAt(segs, t)
      if (i !== segRef.current) {
        segRef.current = i
        setCurrent(i)
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [playing, songTime])

  const progress = useCallback<SongProgressFn>(() => {
    const k = keyRef.current
    const e = engine()
    if (!k || !e) return null
    try {
      const duration = e.get(k)?.duration ?? 0
      if (!duration) return null
      const t = songTime()
      return { elapsed: t ?? Math.min(duration, resumeRef.current), duration }
    } catch {
      return null
    }
  }, [songTime])

  return {
    playing,
    pending: playing && !!state.pending,
    paused: !playing && resumeAt > 0,
    toggle,
    seek,
    tapSegment,
    segmentProgress,
    progress,
    segment: playing ? current : -1,
  }
}

/**
 * Album accents: pushed to the shader background (full intensity) and returned
 * for the UI. The background accent is reset on unmount.
 */
export function useAlbumAccent(coverUrl: string | null | undefined): RevealAccent {
  const [accent, setAccent] = useState<RevealAccent>(() => {
    const known = coverUrl ? peekCoverColors(coverUrl) : undefined
    return known ?? DEFAULT_COVER_COLORS
  })

  useEffect(() => {
    let cancelled = false
    const apply = (a: RevealAccent) => {
      if (cancelled) return
      setAccent((prev) => (prev.primary === a.primary && prev.secondary === a.secondary ? prev : { primary: a.primary, secondary: a.secondary }))
      try {
        const bg = useBackground.getState()
        bg.setAccent(a.primary, a.secondary)
        bg.setIntensity(1)
      } catch {
        // background optional
      }
    }
    if (coverUrl) {
      const known = peekCoverColors(coverUrl)
      if (known) apply(known)
      extractCoverColors(coverUrl).then(apply, () => {})
    } else {
      apply(DEFAULT_COVER_COLORS)
    }
    return () => {
      cancelled = true
      try {
        useBackground.getState().resetAccent()
      } catch {
        // ignore
      }
    }
  }, [coverUrl])

  return accent
}

/** Background light burst, safe to call anytime. */
export function pulseBackground(strength: number): void {
  try {
    useBackground.getState().pulse(strength)
  } catch {
    // background optional
  }
}
