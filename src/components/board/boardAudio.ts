// Audio dependencies of the board (engine, peaks, SFX), read through a React
// context. They are the app singletons, accessed defensively (they may be
// unavailable, or throw, without breaking the UI). Also: engine-state / buffer
// hooks shared by the board parts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { audioEngine } from '../../audio/engine'
import type { AudioEngine, PlaybackState } from '../../audio/engine'
import { realignSegments } from '../../audio/analysis/realign'
import type { TimeSpan } from '../../audio/analysis/realign'
import { computePeaks } from '../../audio/peaks'
import type { Peaks } from '../../audio/peaks'
import { sfx as appSfx } from '../../audio/sfx'
import type { SfxName } from '../../audio/sfx'

export type PeaksFn = (buffer: AudioBuffer, start: number, end: number, bins: number) => Peaks
type SfxFn = (name: SfxName, opts?: { pitch?: number; gain?: number }) => void

interface BoardAudio {
  /** null = no audio available (the board stays usable, playback is a no-op). */
  readonly engine: AudioEngine | null
  readonly peaks: PeaksFn
  readonly sfx: SfxFn
}

/** Engine tag used by play-all. */
export const PLAY_ALL_TAG = 'board'
/** Engine tag used when a single block is played. */
export const blockTag = (segmentIndex: number): string => `block:${segmentIndex}`

// --- peaks -------------------------------------------------------------------

interface PeakCacheEntry {
  norm: number
  map: Map<string, Peaks>
}
const fallbackCache = new WeakMap<AudioBuffer, PeakCacheEntry>()

function monoAt(channels: Float32Array[], i: number): number {
  let v = 0
  for (let c = 0; c < channels.length; c++) v += channels[c][i]
  return v / channels.length
}

/** Local peaks (same contract as audio/peaks.ts), used when the shared one is unavailable. */
function fallbackPeaks(buffer: AudioBuffer, start: number, end: number, bins: number): Peaks {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c))
  let entry = fallbackCache.get(buffer)
  if (!entry) {
    let norm = 0
    const len = buffer.length
    for (let i = 0; i < len; i++) {
      const v = Math.abs(monoAt(channels, i))
      if (v > norm) norm = v
    }
    entry = { norm: norm || 1, map: new Map() }
    fallbackCache.set(buffer, entry)
  }
  const n = Math.max(1, Math.floor(bins))
  const cacheKey = `${start.toFixed(4)}|${end.toFixed(4)}|${n}`
  const hit = entry.map.get(cacheKey)
  if (hit) return hit
  const sr = buffer.sampleRate
  const from = Math.max(0, Math.floor(start * sr))
  const to = Math.min(buffer.length, Math.max(from + 1, Math.floor(end * sr)))
  const max = new Float32Array(n)
  const rms = new Float32Array(n)
  const per = (to - from) / n
  for (let b = 0; b < n; b++) {
    const a = from + Math.floor(b * per)
    const z = Math.max(a + 1, Math.min(to, from + Math.floor((b + 1) * per)))
    let m = 0
    let sq = 0
    let count = 0
    for (let i = a; i < z; i++) {
      const v = monoAt(channels, i)
      const abs = Math.abs(v)
      if (abs > m) m = abs
      sq += v * v
      count++
    }
    max[b] = Math.min(1, m / entry.norm)
    rms[b] = Math.min(1, Math.sqrt(sq / Math.max(1, count)) / entry.norm)
  }
  const peaks = { max, rms }
  entry.map.set(cacheKey, peaks)
  return peaks
}

let sharedPeaksBroken = false
const defaultPeaks: PeaksFn = (buffer, start, end, bins) => {
  if (!sharedPeaksBroken) {
    try {
      const p = computePeaks(buffer, start, end, bins)
      if (p && p.max instanceof Float32Array && p.rms instanceof Float32Array && p.max.length > 0) return p
    } catch {
      sharedPeaksBroken = true
    }
  }
  return fallbackPeaks(buffer, start, end, bins)
}

const defaultSfx: SfxFn = (name, opts) => {
  try {
    ;(appSfx as typeof appSfx | null)?.play(name, opts)
  } catch {
    // SFX are decoration: never let them break an interaction.
  }
}

function resolveEngine(): AudioEngine | null {
  const e = audioEngine as AudioEngine | null | undefined
  return e && typeof e.getState === 'function' ? e : null
}

const defaultAudio: BoardAudio = {
  // Getter: the singleton module may initialise after this one.
  get engine() {
    return resolveEngine()
  },
  peaks: defaultPeaks,
  sfx: defaultSfx,
}

const BoardAudioContext = createContext<BoardAudio>(defaultAudio)

export function useBoardAudio(): BoardAudio {
  return useContext(BoardAudioContext)
}

// --- engine state --------------------------------------------------------------

const IDLE: PlaybackState = { playing: false, mode: null, key: null, tag: null, index: 0 }
const noop = () => {}

/** Discrete engine playback state (re-renders only when it actually changes). */
export function useEngineState(): PlaybackState {
  const engine = useBoardAudio().engine
  const cache = useRef<PlaybackState>(IDLE)
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!engine) return noop
      try {
        return engine.subscribe(() => cb())
      } catch {
        return noop
      }
    },
    [engine],
  )
  const getSnapshot = useCallback((): PlaybackState => {
    if (!engine) return IDLE
    let s: PlaybackState
    try {
      s = engine.getState()
    } catch {
      return IDLE
    }
    const c = cache.current
    const pending = !!s.pending
    if (c.playing === s.playing && !!c.pending === pending && c.mode === s.mode && c.key === s.key && c.tag === s.tag && c.index === s.index) return c
    cache.current = { playing: s.playing, pending, mode: s.mode, key: s.key, tag: s.tag, index: s.index }
    return cache.current
  }, [engine])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// --- buffer readiness ----------------------------------------------------------

const pollers = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null

function addPoller(fn: () => void): () => void {
  pollers.add(fn)
  if (!pollTimer) pollTimer = setInterval(() => pollers.forEach((p) => p()), 250)
  return () => {
    pollers.delete(fn)
    if (pollers.size === 0 && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }
}

function readBuffer(engine: AudioEngine | null, key: string | null | undefined): AudioBuffer | undefined {
  if (!engine || !key) return undefined
  try {
    return engine.get(key)
  } catch {
    return undefined
  }
}

/** The decoded buffer for `key`, re-rendering once it becomes available (shared 250ms poll). */
export function useAudioBuffer(key: string | null | undefined): AudioBuffer | undefined {
  const engine = useBoardAudio().engine
  const [found, setFound] = useState<{ key: string | null | undefined; buffer: AudioBuffer | undefined }>(() => ({
    key,
    buffer: readBuffer(engine, key),
  }))
  useEffect(() => {
    const check = () => {
      const b = readBuffer(engine, key)
      setFound((prev) => (prev.key === key && prev.buffer === b ? prev : { key, buffer: b }))
      return b
    }
    if (check() || !engine || !key) return
    const off = addPoller(() => {
      if (check()) off()
    })
    return off
  }, [engine, key])
  return found.key === key ? found.buffer : readBuffer(engine, key)
}

/**
 * The host's segments re-snapped onto THIS peer's decode of the track (see
 * audio/analysis/realign.ts: WebKit decodes MP3s ~12 ms earlier than Chrome, so the host's
 * cut times would land just after each attack on an iPhone). The same array comes back
 * until the buffer is decoded, on the host, and whenever the decoders agree; only playback
 * times ever change, never segment identity or order. Cheap and memoised.
 */
export function useLocalSegments<T extends TimeSpan>(trackKey: string | null | undefined, segments: T[]): T[]
export function useLocalSegments<T extends TimeSpan>(trackKey: string | null | undefined, segments: T[] | null): T[] | null
export function useLocalSegments<T extends TimeSpan>(trackKey: string | null | undefined, segments: T[] | null): T[] | null {
  const buffer = useAudioBuffer(trackKey)
  return useMemo(() => (buffer && segments ? (realignSegments(buffer, segments) as T[]) : segments), [buffer, segments])
}

// --- play-all bookkeeping --------------------------------------------------------

// Segment scheduled at each position of the current play-all run, per track key.
// The engine asks for positions just in time, so after a reorder the board still
// highlights the block that is actually audible.
const scheduledRuns = new Map<string, number[]>()

export function resetScheduled(trackKey: string): void {
  scheduledRuns.set(trackKey, [])
}

export function recordScheduled(trackKey: string, position: number, segmentIndex: number): void {
  let run = scheduledRuns.get(trackKey)
  if (!run) {
    run = []
    scheduledRuns.set(trackKey, run)
  }
  run[position] = segmentIndex
}

export function scheduledSegmentAt(trackKey: string, position: number): number | undefined {
  return scheduledRuns.get(trackKey)?.[position]
}
