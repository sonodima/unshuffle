// Deterministic synthetic "pop loop" with known tempo and bar phase:
// kick on 1 & 3, snare on 2 & 4, hats on 8ths, a chord + bass change every bar.

export interface SynthOptions {
  bpm: number
  sampleRate?: number
  duration?: number
  /** Time of the first downbeat (s). */
  firstDownbeat?: number
  /** Omit the drums (harmonic content only). */
  noDrums?: boolean
  /** Short chord stabs on every beat instead of a chord held for the whole bar. */
  stabs?: boolean
  /** Beats per bar (default 4). Kick on 1 & 3 (4/4), 1 (3/4) or 1 & 4 (5/4 as 3+2); snare on the other beats. */
  beatsPerBar?: number
}

export function synthLoop(o: SynthOptions): { samples: Float32Array; sampleRate: number; downbeats: number[]; beat: number } {
  const sr = o.sampleRate ?? 44100
  const dur = o.duration ?? 30
  const beat = 60 / o.bpm
  const bpb = o.beatsPerBar ?? 4
  const t0 = o.firstDownbeat ?? 0.37
  const n = Math.round(sr * dur)
  const x = new Float32Array(n)
  let seed = 1234567
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff - 0.5
  }
  const add = (start: number, len: number, fn: (t: number) => number): void => {
    const a = Math.max(0, Math.round(start * sr))
    const b = Math.min(n, Math.round((start + len) * sr))
    for (let i = a; i < b; i++) x[i] += fn((i - a) / sr)
  }
  // Chords (C, F, G, Am) as triads + bass root, one per bar.
  const chords = [
    [261.63, 329.63, 392.0, 65.41],
    [349.23, 440.0, 523.25, 87.31],
    [392.0, 493.88, 587.33, 98.0],
    [440.0, 523.25, 659.25, 110.0],
  ]
  const downbeats: number[] = []
  const firstBar = -Math.ceil(t0 / (bpb * beat))
  for (let bar = firstBar; ; bar++) {
    const bt = t0 + bar * bpb * beat
    if (bt > dur) break
    if (bt >= 0) downbeats.push(bt)
    const ch = chords[((bar % 4) + 4) % 4]
    const voice = (tt: number, env: number): number =>
      env * (0.05 * (Math.sin(2 * Math.PI * ch[0] * tt) + Math.sin(2 * Math.PI * ch[1] * tt) + Math.sin(2 * Math.PI * ch[2] * tt)) + 0.12 * Math.sin(2 * Math.PI * ch[3] * tt))
    if (o.stabs) {
      for (let k = 0; k < bpb; k++) {
        const st = bt + k * beat
        if (st >= 0) add(st, 0.6 * beat, (tt) => voice(tt, Math.min(1, tt / 0.005) * Math.exp(-tt * 9)))
      }
    } else {
      add(Math.max(0, bt), bpb * beat - Math.max(0, -bt), (t) => {
        const tt = t + Math.max(0, -bt)
        return voice(tt, Math.min(1, tt / 0.01) * (0.6 + 0.4 * Math.exp(-tt * 2)))
      })
    }
    if (o.noDrums) continue
    const kicks = bpb === 4 ? [0, 2] : bpb === 5 ? [0, 3] : [0]
    for (let k = 0; k < 2 * bpb; k++) {
      const t = bt + (k * beat) / 2
      if (t < 0 || t > dur) continue
      if (k % 2 === 0) {
        const pos = k / 2
        if (kicks.includes(pos)) {
          add(t, 0.15, (u) => 0.8 * Math.exp(-u * 30) * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-u * 40)) * u))
        } else {
          add(t, 0.12, (u) => 0.35 * Math.exp(-u * 35) * (rnd() + 0.5 * Math.sin(2 * Math.PI * 190 * u)))
        }
      }
      add(t, 0.03, (u) => 0.08 * Math.exp(-u * 150) * rnd())
    }
  }
  return { samples: x, sampleRate: sr, downbeats, beat }
}
