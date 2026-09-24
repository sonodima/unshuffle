// Waveform peaks for drawing snippet blocks. The mono mix and its absolute
// max are computed once per AudioBuffer; peak arrays are cached per
// (buffer, start, end, bins), so redrawing 16 blocks per render is free.

export interface Peaks {
  /** Per-bin peak amplitude 0..1, normalized to the WHOLE buffer's max (so loudness is comparable across snippets). */
  max: Float32Array
  /** Per-bin RMS 0..1 (same normalization). */
  rms: Float32Array
}

interface MonoEntry {
  mono: Float32Array
  absMax: number
  results: Map<string, Peaks>
}

const MAX_CACHED_RESULTS = 256
const MAX_BINS = 16384
const cache = new WeakMap<AudioBuffer, MonoEntry>()

function entryFor(buffer: AudioBuffer): MonoEntry {
  let e = cache.get(buffer)
  if (e) return e
  const len = buffer.length
  const channels = Math.max(1, buffer.numberOfChannels)
  let mono: Float32Array
  if (channels === 1) {
    mono = buffer.getChannelData(0)
  } else {
    mono = new Float32Array(len)
    for (let c = 0; c < channels; c++) {
      const d = buffer.getChannelData(c)
      for (let i = 0; i < len; i++) mono[i] += d[i]
    }
    const k = 1 / channels
    for (let i = 0; i < len; i++) mono[i] *= k
  }
  let absMax = 0
  for (let i = 0; i < len; i++) {
    const a = mono[i] < 0 ? -mono[i] : mono[i]
    if (a > absMax) absMax = a
  }
  e = { mono, absMax, results: new Map() }
  cache.set(buffer, e)
  return e
}

/**
 * Mono mix (channel average) of `buffer`, cached. Shared — never mutate it;
 * copy (`.slice()`) before transferring it to a worker.
 */
export function getMono(buffer: AudioBuffer): Float32Array {
  return entryFor(buffer).mono
}

/** Compute `bins` peaks for [start, end) seconds of `buffer`. Cached per (buffer, start, end, bins). */
export function computePeaks(buffer: AudioBuffer, start: number, end: number, bins: number): Peaks {
  const count = Math.max(1, Math.min(MAX_BINS, Math.floor(Number.isFinite(bins) ? bins : 1)))
  const e = entryFor(buffer)
  const key = `${start}|${end}|${count}`
  const hit = e.results.get(key)
  if (hit) return hit

  const { mono, absMax } = e
  const len = mono.length
  const sr = buffer.sampleRate
  const toIndex = (t: number): number => Math.min(len, Math.max(0, Math.round((Number.isFinite(t) ? t : 0) * sr)))
  const s0 = toIndex(start)
  const s1 = Math.max(s0, toIndex(end))
  const span = s1 - s0
  const max = new Float32Array(count)
  const rms = new Float32Array(count)
  const norm = absMax > 0 ? 1 / absMax : 0

  if (span > 0 && norm > 0) {
    for (let b = 0; b < count; b++) {
      const a = s0 + Math.floor((b * span) / count)
      let z = s0 + Math.floor(((b + 1) * span) / count)
      if (z <= a) z = Math.min(s1, a + 1)
      let peak = 0
      let sq = 0
      for (let i = a; i < z; i++) {
        const v = mono[i]
        const av = v < 0 ? -v : v
        if (av > peak) peak = av
        sq += v * v
      }
      const n = z - a
      max[b] = Math.min(1, peak * norm)
      rms[b] = n > 0 ? Math.min(1, Math.sqrt(sq / n) * norm) : 0
    }
  }

  const peaks: Peaks = { max, rms }
  if (e.results.size >= MAX_CACHED_RESULTS) {
    const oldest = e.results.keys().next().value
    if (oldest !== undefined) e.results.delete(oldest)
  }
  e.results.set(key, peaks)
  return peaks
}
