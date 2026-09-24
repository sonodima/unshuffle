// CPU side of the audio reactivity: smooths the engine levels into shader-friendly
// envelopes and turns beat pulses into expanding "bass rings".

import type { AudioLevels } from '../../audio/engine'

export const MAX_RINGS = 4
/** Seconds a ring lives before it has faded out completely. */
export const RING_LIFETIME = 2.4

export interface ReactorState {
  bass: number
  mid: number
  treble: number
  /** Slow energy envelope, drives the flow speed. */
  energy: number
  /** Quick flash envelope after each beat (0..1). */
  flash: number
  /** 0 = silence, 1 = music playing (slow crossfade between idle breathing and live mode). */
  presence: number
  /** Per ring slot: age in seconds (large when the slot is unused). */
  ringAge: Float32Array
  /** Per ring slot: strength 0..1.5 (0 = unused). */
  ringAmp: Float32Array
}

export interface Reactor {
  readonly state: ReactorState
  /** Advance by `dt` seconds with fresh levels; `now` is a monotonic clock in seconds. */
  update(levels: AudioLevels, dt: number, now: number): void
  /** Fire a ring manually (e.g. `useBackground.pulse()`). */
  pulse(strength: number, now: number): void
  reset(): void
}

const finite01 = (x: number) => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0)

function follow(cur: number, target: number, dt: number, attack: number, release: number): number {
  return cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? attack : release)))
}

export const ZERO_LEVELS: AudioLevels = Object.freeze({ bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 })

export function createReactor(): Reactor {
  const state: ReactorState = {
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    flash: 0,
    presence: 0,
    ringAge: new Float32Array(MAX_RINGS).fill(1e3),
    ringAmp: new Float32Array(MAX_RINGS),
  }
  const births = new Float64Array(MAX_RINGS).fill(-1e9)
  const amps = new Float32Array(MAX_RINGS)
  let prevBeat = 0
  let lastRingAt = -1e9

  function spawn(strength: number, now: number): void {
    // Reuse the oldest slot.
    let slot = 0
    for (let i = 1; i < MAX_RINGS; i++) if (births[i] < births[slot]) slot = i
    births[slot] = now
    amps[slot] = strength
    lastRingAt = now
  }

  function refreshRings(now: number): void {
    for (let i = 0; i < MAX_RINGS; i++) {
      const age = now - births[i]
      if (age >= 0 && age < RING_LIFETIME && amps[i] > 0) {
        state.ringAge[i] = age
        state.ringAmp[i] = amps[i]
      } else {
        state.ringAge[i] = 1e3
        state.ringAmp[i] = 0
      }
    }
  }

  return {
    state,
    update(levels, rawDt, now) {
      const dt = Math.min(0.25, Math.max(1e-4, Number.isFinite(rawDt) ? rawDt : 0.016))
      const bass = finite01(levels.bass)
      const mid = finite01(levels.mid)
      const treble = finite01(levels.treble)
      const energy = finite01(levels.energy)
      const beat = finite01(levels.beat)

      state.bass = follow(state.bass, bass, dt, 0.035, 0.22)
      state.mid = follow(state.mid, mid, dt, 0.06, 0.3)
      state.treble = follow(state.treble, treble, dt, 0.03, 0.2)
      state.energy = follow(state.energy, energy, dt, 0.35, 1.6)
      const live = energy > 0.03 || bass > 0.05 ? 1 : 0
      state.presence = follow(state.presence, live, dt, 0.5, 2.2)

      // Rising edge of the engine's beat pulse → new ring + flash.
      if (beat > 0.5 && beat > prevBeat + 0.2 && now - lastRingAt > 0.16) {
        const strength = Math.min(1, 0.5 + 0.6 * bass)
        spawn(strength, now)
        state.flash = Math.max(state.flash, strength)
      }
      prevBeat = beat
      state.flash *= Math.exp(-dt / 0.16)
      if (state.flash < 1e-3) state.flash = 0
      refreshRings(now)
    },
    pulse(strength, now) {
      const s = Number.isFinite(strength) ? Math.max(0, Math.min(1.5, strength)) : 1
      if (s <= 0) return
      spawn(s, now)
      state.flash = Math.max(state.flash, Math.min(1, s))
      refreshRings(now)
    },
    reset() {
      state.bass = state.mid = state.treble = state.energy = state.flash = state.presence = 0
      births.fill(-1e9)
      amps.fill(0)
      prevBeat = 0
      lastRingAt = -1e9
      refreshRings(0)
    },
  }
}
