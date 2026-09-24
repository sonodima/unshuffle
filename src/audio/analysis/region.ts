// Usable region of a preview: trims leading/trailing silence and detects
// monotonic fade-ins / fade-outs so the first and last snippets start and end
// on full-level audio.

import { dbPow, percentile } from './dsp'

export interface Region {
  start: number
  end: number
  /** Reference loudness (≈ 90th percentile, dB). */
  refDb: number
  /** True when the whole signal is (near) digital silence. */
  silent: boolean
}

const SILENCE_BELOW_REF_DB = 24
const FADE_TARGET_BELOW_REF_DB = 8
const FADE_MIN_RISE_DB = 6
const FADE_MAX_SEC = 3.5
const BLOCK_SEC = 0.25

export function usableRegion(rmsDb: Float32Array, fps: number, duration: number): Region {
  const n = rmsDb.length
  // Loudness smoothed over ~100 ms (power domain).
  const r = Math.max(1, Math.round(fps * 0.05))
  const smooth = new Float32Array(n)
  const pw = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) pw[i + 1] = pw[i] + 10 ** (rmsDb[i] / 10)
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - r)
    const hi = Math.min(n, i + r + 1)
    smooth[i] = dbPow((pw[hi] - pw[lo]) / (hi - lo))
  }
  const refDb = percentile(smooth, 0.9)
  if (!(refDb > -60)) return { start: 0, end: duration, refDb, silent: true }

  const silence = refDb - SILENCE_BELOW_REF_DB
  let first = 0
  while (first < n - 1 && smooth[first] < silence) first++
  let last = n - 1
  while (last > first && smooth[last] < silence) last--

  const block = Math.max(1, Math.round(fps * BLOCK_SEC))
  const levelAt = (i: number): number => {
    const lo = Math.max(0, Math.min(n - 1, i))
    const hi = Math.max(lo + 1, Math.min(n, i + block))
    return dbPow((pw[hi] - pw[lo]) / (hi - lo))
  }
  const target = refDb - FADE_TARGET_BELOW_REF_DB
  const maxFade = Math.round(FADE_MAX_SEC * fps)

  // Fade-in: consecutive non-decreasing blocks rising to near reference level.
  let start = first
  {
    let i = first
    let prev = levelAt(i)
    const startLevel = prev
    while (i - first < maxFade && prev < target) {
      const next = levelAt(i + block)
      if (next < prev - 1) break
      prev = next
      i += block
    }
    if (prev >= target && i - first <= maxFade && prev - startLevel >= FADE_MIN_RISE_DB && i > first) start = i
  }
  // Fade-out: same, walking backwards from the end.
  let end = last
  {
    let i = last
    let prev = levelAt(i - block)
    const endLevel = prev
    while (last - i < maxFade && prev < target) {
      const next = levelAt(i - 2 * block)
      if (next < prev - 1) break
      prev = next
      i -= block
    }
    if (prev >= target && last - i <= maxFade && prev - endLevel >= FADE_MIN_RISE_DB && i < last) end = i
  }

  const toSec = (f: number): number => Math.min(duration, Math.max(0, f / fps))
  let s = toSec(start)
  let e = toSec(end)
  if (e - s < Math.min(2, duration * 0.5)) {
    s = 0
    e = duration
  }
  return { start: s, end: e, refDb, silent: false }
}
