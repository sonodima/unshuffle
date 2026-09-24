// Synthetic "club track" level driver for the shader lab: 4-on-the-floor kick,
// off-beat hats, a breakdown every 4 bars. Mimics audioEngine.getLevels() semantics
// (smoothed 0..1 bands, beat = 1 on the kick decaying over ~250 ms).
import type { AudioLevels } from '../../audio/engine'

export interface SynthDriver {
  levels(): AudioLevels
  setPlaying(on: boolean): void
  readonly playing: boolean
  setBpm(bpm: number): void
  readonly bpm: number
  /** Restart the bar so the next kick lands `ms` from now (for on-beat screenshots). */
  alignKick(ms?: number): void
  /** Seconds since the last kick (Infinity when stopped). */
  sinceKick(): number
}

const ZERO: AudioLevels = Object.freeze({ bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 })

export function createSynth(initialBpm = 120): SynthDriver {
  let bpm = initialBpm
  let playing = false
  let t0 = performance.now()
  let fade = 0
  let lastAt = performance.now()

  const clock = () => (performance.now() - t0) / 1000

  return {
    levels() {
      const now = performance.now()
      const dt = Math.min(0.1, (now - lastAt) / 1000)
      lastAt = now
      // Fade in/out like a real track starting and stopping.
      fade += ((playing ? 1 : 0) - fade) * (1 - Math.exp(-dt / (playing ? 0.15 : 0.5)))
      if (!playing && fade < 0.005) return ZERO
      const t = clock()
      const beatLen = 60 / bpm
      const beatIdx = Math.floor(t / beatLen)
      const inBeat = t - beatIdx * beatLen
      const bar = Math.floor(beatIdx / 4)
      const breakdown = bar % 4 === 3 && beatIdx % 4 >= 2
      const kickOn = playing && !breakdown
      const kick = kickOn ? Math.exp(-inBeat / 0.11) : 0
      const hatPhase = Math.abs(inBeat - beatLen / 2)
      const hat = Math.exp(-hatPhase / 0.035)
      const swell = 0.5 + 0.5 * Math.sin(t * 0.7)
      const bass = (breakdown ? 0.12 : 0.28) + 0.62 * kick
      const mid = 0.32 + 0.14 * swell + 0.1 * kick
      const treble = 0.18 + 0.42 * hat + 0.1 * swell
      const energy = breakdown ? 0.32 : 0.58 + 0.12 * swell
      const x = inBeat / 0.25
      const beat = kickOn && x < 1 ? (1 - x) * (1 - x) : 0
      return { bass: bass * fade, mid: mid * fade, treble: treble * fade, energy: energy * fade, beat: beat * fade }
    },
    setPlaying(on) {
      if (on && !playing) t0 = performance.now()
      playing = on
    },
    get playing() {
      return playing
    },
    setBpm(v) {
      if (!Number.isFinite(v) || v <= 0) return
      // Keep the phase continuous.
      const t = clock()
      const beats = t / (60 / bpm)
      bpm = v
      t0 = performance.now() - beats * (60 / bpm) * 1000
    },
    get bpm() {
      return bpm
    },
    alignKick(ms = 0) {
      const beatLen = 60 / bpm
      // Beat 0 of a bar that is not a breakdown, landing `ms` from now.
      t0 = performance.now() + ms - beatLen * 4 * 1000
    },
    sinceKick() {
      if (!playing) return Infinity
      const t = clock()
      if (t < 0) return Infinity
      const beatLen = 60 / bpm
      return t - Math.floor(t / beatLen) * beatLen
    },
  }
}
