// Synthesized UI sound effects (Web Audio, no assets). Routed through the engine's
// context at its own volume bus. Every function is safe to call before unlock (no-op).
//
// Chain per context: voices → (dry | reverb send) → soft high-shelf → level →
// safety soft-clip → engine SFX bus (volume) → speakers. Voices are tiny
// oscillator / filtered-noise / FM-bell layers with click-free envelopes.

import { duckMusic, getSfxOutput } from './engine'

export type SfxName =
  | 'click'      // generic button
  | 'hover'      // very subtle tick
  | 'pickup'     // start dragging a snippet
  | 'drop'       // snippet dropped
  | 'swap'       // neighbour shifted during drag (throttle internally)
  | 'tick'       // countdown second (last 10s)
  | 'tickUrgent' // last 3s
  | 'go'         // round start
  | 'submit'     // confirm
  | 'alarm'      // someone else confirmed → final timer
  | 'correct'    // reveal: snippet right
  | 'wrong'      // reveal: snippet wrong
  | 'score'      // points counter tick
  | 'fanfare'    // perfect round / winner
  | 'join'       // player joined
  | 'leave'      // player left
  | 'pop'        // reaction

export const SFX_NAMES: readonly SfxName[] = [
  'click', 'hover', 'pickup', 'drop', 'swap', 'tick', 'tickUrgent', 'go', 'submit',
  'alarm', 'correct', 'wrong', 'score', 'fanfare', 'join', 'leave', 'pop',
]

const STORAGE_KEY = 'unshuffle:sfx'
const SFX_LEVEL = 0.85
const REVERB_LEVEL = 0.2
const MAX_SOURCES = 96
/** Minimum spacing between two plays of the same sound. */
const MIN_GAP_MS: Partial<Record<SfxName, number>> = { swap: 60, score: 18, hover: 45, tick: 120, tickUrgent: 120, pop: 40 }
const DEFAULT_GAP_MS = 30
/**
 * Loudness trims (dB) so peaks sit in a consistent hierarchy over music normalised to -14 LUFS:
 * hover ≈ -31 dBFS, swap ≈ -27, score ≈ -17 (at its in-app 0.7), UI ≈ -17…-15, cues ≈ -14,
 * countdown ticks ≈ -12…-10 (in the bright 2.5–3.5 kHz band, so they cut through a song), fanfare ≈ -10.
 */
const TRIM_DB: Partial<Record<SfxName, number>> = {
  tick: 3.5,
  tickUrgent: 2,
  score: 6,
  click: -1.5,
  pickup: -1.5,
  drop: -4,
  wrong: -2.5,
  correct: 3.5,
  alarm: 4,
  fanfare: 3,
  join: 1.5,
  leave: 1,
}
/**
 * Music ducking [dB, hold s] for the one-off sounds that must cut through a playing song,
 * scaled by the call's gain. The reveal flips (correct/wrong, one every 0.2 s) don't duck:
 * back-to-back dips would make the song pump, and they are audible without.
 */
const DUCK: Partial<Record<SfxName, readonly [number, number]>> = {
  tick: [1.5, 0.05],
  tickUrgent: [2.5, 0.08],
  submit: [3, 0.22],
  go: [3, 0.3],
  alarm: [4, 0.42],
  fanfare: [5, 0.9],
}

// Note frequencies (Hz).
const C3 = 130.81
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const A5 = 880
const B5 = 987.77
const C6 = 1046.5
const E6 = 1318.51
const G6 = 1567.98
const SPARKLE = [2093, 2349.3, 2637, 3136, 3520, 4186]

/* ------------------------------------------------------------------ bus */

interface Bus {
  dry: GainNode
  wet: GainNode
  noise: AudioBuffer
}

const buses = new WeakMap<BaseAudioContext, Bus>()

function impulse(ctx: BaseAudioContext): AudioBuffer {
  // Small bright room: 0.8s of decaying noise that darkens as it fades.
  const sr = ctx.sampleRate
  const len = Math.floor(sr * 0.8)
  const buf = ctx.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr
      const env = Math.exp(-t / 0.2) * Math.min(1, t / 0.004)
      const k = 0.55 - 0.4 * Math.min(1, t / 0.5)
      lp += (Math.random() * 2 - 1 - lp) * k
      d[i] = lp * env
    }
  }
  return buf
}

let clipCurve: Float32Array<ArrayBuffer> | null = null

function softClipCurve(): Float32Array<ArrayBuffer> {
  if (clipCurve) return clipCurve
  const n = 2049
  const knee = 0.63
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee))
    curve[i] = Math.sign(x) * y
  }
  clipCurve = curve
  return curve
}

function busFor(ctx: BaseAudioContext, out: AudioNode): Bus {
  const existing = buses.get(ctx)
  if (existing) return existing
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const verb = ctx.createConvolver()
  verb.buffer = impulse(ctx)
  const verbLevel = ctx.createGain()
  verbLevel.gain.value = REVERB_LEVEL
  const shelf = ctx.createBiquadFilter()
  shelf.type = 'highshelf'
  shelf.frequency.value = 8500
  shelf.gain.value = -4
  // Safety soft-clip instead of a compressor (whose automatic makeup gain would
  // boost everything): transparent below -4 dBFS, rounds off pile-ups above.
  const clip = ctx.createWaveShaper()
  clip.curve = softClipCurve()
  clip.oversample = '2x'
  const level = ctx.createGain()
  level.gain.value = SFX_LEVEL
  dry.connect(shelf)
  wet.connect(verb)
  verb.connect(verbLevel)
  verbLevel.connect(shelf)
  shelf.connect(level)
  level.connect(clip)
  clip.connect(out)
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const bus: Bus = { dry, wet, noise }
  buses.set(ctx, bus)
  return bus
}

/* ------------------------------------------------------------------ voices */

interface Voice {
  ctx: BaseAudioContext
  bus: Bus
  /** Start time (context seconds). */
  t: number
  pitch: number
  gain: number
}

interface ToneSpec {
  /** Offset from the sound's start (s). */
  at?: number
  type?: OscillatorType
  f: number
  /** Glide target frequency (exponential). */
  f2?: number
  glide?: number
  /** Attack (s), linear. */
  a?: number
  /** Decay to silence (s), exponential. */
  d: number
  g: number
  lp?: number
  hp?: number
  q?: number
  pan?: number
  /** Reverb send 0..1. */
  verb?: number
  detune?: number
  /** FM bell: modulator at f·ratio, peak deviation index·f, decaying faster than the carrier. */
  fm?: { ratio: number; index: number }
}

interface NoiseSpec {
  at?: number
  type: BiquadFilterType
  f: number
  f2?: number
  q?: number
  a?: number
  d: number
  g: number
  pan?: number
  verb?: number
}

let activeSources = 0

function envelope(p: AudioParam, t: number, a: number, d: number, peak: number): void {
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(peak, t + a)
  p.exponentialRampToValueAtTime(0.0001, t + a + d)
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
  const n = ctx.createBiquadFilter()
  n.type = type
  n.frequency.value = Math.min(f, ctx.sampleRate * 0.45)
  n.Q.value = q
  return n
}

/** Wire `head` → optional panner → dry bus (+ reverb send); returns the extra nodes for cleanup. */
function route(v: Voice, head: AudioNode, pan: number | undefined, verb: number, nodes: AudioNode[]): void {
  const { ctx, bus } = v
  let last = head
  if (pan && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    last.connect(p)
    last = p
    nodes.push(p)
  }
  last.connect(bus.dry)
  if (verb > 0) {
    const send = ctx.createGain()
    send.gain.value = verb
    last.connect(send)
    send.connect(bus.wet)
    nodes.push(send)
  }
}

function track(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  activeSources++
  src.onended = () => {
    activeSources--
    for (const n of nodes) {
      try {
        n.disconnect()
      } catch {
        // already disconnected
      }
    }
  }
}

function tone(v: Voice, s: ToneSpec): void {
  const { ctx } = v
  const t = v.t + (s.at ?? 0)
  const a = s.a ?? 0.002
  const end = t + a + s.d
  const f = s.f * v.pitch
  const osc = ctx.createOscillator()
  osc.type = s.type ?? 'sine'
  osc.frequency.setValueAtTime(f, t)
  if (s.f2) osc.frequency.exponentialRampToValueAtTime(s.f2 * v.pitch, t + (s.glide ?? s.d * 0.5))
  if (s.detune) osc.detune.value = s.detune
  const amp = ctx.createGain()
  const nodes: AudioNode[] = [osc, amp]
  let head: AudioNode = osc
  if (s.lp) {
    const n = filter(ctx, 'lowpass', s.lp, s.q ?? 0.7)
    head.connect(n)
    head = n
    nodes.push(n)
  }
  if (s.hp) {
    const n = filter(ctx, 'highpass', s.hp, s.q ?? 0.7)
    head.connect(n)
    head = n
    nodes.push(n)
  }
  head.connect(amp)
  envelope(amp.gain, t, a, s.d, s.g * v.gain)
  route(v, amp, s.pan, s.verb ?? 0.2, nodes)
  if (s.fm) {
    const mod = ctx.createOscillator()
    mod.frequency.setValueAtTime(f * s.fm.ratio, t)
    const depth = ctx.createGain()
    envelope(depth.gain, t, a, s.d * 0.6, f * s.fm.index)
    mod.connect(depth)
    depth.connect(osc.frequency)
    mod.start(t)
    mod.stop(end + 0.03)
    track(mod, [mod, depth])
  }
  osc.start(t)
  osc.stop(end + 0.03)
  track(osc, nodes)
}

function noise(v: Voice, s: NoiseSpec): void {
  const { ctx, bus } = v
  const t = v.t + (s.at ?? 0)
  const a = s.a ?? 0.002
  const end = t + a + s.d
  const src = ctx.createBufferSource()
  src.buffer = bus.noise
  src.loop = true
  const flt = filter(ctx, s.type, s.f * v.pitch, s.q ?? 0.8)
  flt.frequency.setValueAtTime(flt.frequency.value, t)
  if (s.f2) flt.frequency.exponentialRampToValueAtTime(Math.min(s.f2 * v.pitch, ctx.sampleRate * 0.45), end)
  const amp = ctx.createGain()
  const nodes: AudioNode[] = [src, flt, amp]
  src.connect(flt)
  flt.connect(amp)
  envelope(amp.gain, t, a, s.d, s.g * v.gain)
  route(v, amp, s.pan, s.verb ?? 0.15, nodes)
  src.start(t, Math.random() * 0.9)
  src.stop(end + 0.03)
  track(src, nodes)
}

const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount

/* ------------------------------------------------------------------ recipes */

const RECIPES: Record<SfxName, (v: Voice) => void> = {
  click(v) {
    tone(v, { f: 1250, f2: 820, glide: 0.035, a: 0.0015, d: 0.07, g: 0.2, verb: 0.12 })
    tone(v, { type: 'triangle', f: 2500, a: 0.001, d: 0.02, g: 0.035, verb: 0 })
  },
  hover(v) {
    tone(v, { f: 2100, a: 0.001, d: 0.03, g: 0.035, verb: 0.05 })
  },
  pickup(v) {
    tone(v, { f: 380, f2: 760, glide: 0.075, a: 0.004, d: 0.13, g: 0.24, lp: 2600 })
    tone(v, { type: 'triangle', f: 760, f2: 1520, glide: 0.075, a: 0.004, d: 0.07, g: 0.04, lp: 4000 })
    noise(v, { type: 'bandpass', f: 1200, f2: 3200, q: 1.2, a: 0.02, d: 0.06, g: 0.025 })
  },
  drop(v) {
    tone(v, { f: 660, f2: 300, glide: 0.06, a: 0.0015, d: 0.11, g: 0.26, lp: 3000 })
    tone(v, { f: 150, f2: 110, a: 0.002, d: 0.08, g: 0.14, verb: 0 })
    noise(v, { type: 'bandpass', f: 2600, q: 1.4, a: 0.001, d: 0.018, g: 0.05, verb: 0.1 })
  },
  swap(v) {
    tone(v, { type: 'triangle', f: 1180 * jitter(0.04), a: 0.001, d: 0.035, g: 0.06, lp: 3800, verb: 0.08 })
  },
  tick(v) {
    // A crisp clock "tink": its energy sits above the vocal band (2.5–3.5 kHz), so it cuts
    // through a playing song without having to be loud. Only a small body below.
    tone(v, { f: 2637, a: 0.0008, d: 0.11, g: 0.2, verb: 0.08 })
    noise(v, { type: 'bandpass', f: 3500, q: 1.5, a: 0.0005, d: 0.01, g: 0.05, verb: 0 })
    tone(v, { f: 1318.5, a: 0.001, d: 0.04, g: 0.05, verb: 0.05 })
  },
  tickUrgent(v) {
    // Higher and doubled: a heartbeat-like "ti-tick" in the same bright band.
    for (const [at, lvl] of [[0, 1], [0.085, 0.5]] as const) {
      tone(v, { at, f: 3136, a: 0.0008, d: 0.11, g: 0.2 * lvl, verb: 0.12 })
      tone(v, { at, type: 'triangle', f: 1568, a: 0.001, d: 0.06, g: 0.07 * lvl, lp: 5000 })
      noise(v, { at, type: 'bandpass', f: 4200, q: 2, a: 0.0005, d: 0.01, g: 0.05 * lvl, verb: 0 })
    }
  },
  go(v) {
    const notes = [C5, E5, G5, C6]
    notes.forEach((f, i) => {
      tone(v, { at: i * 0.045, type: 'triangle', f, a: 0.004, d: i === 3 ? 0.55 : 0.2, g: 0.1, lp: 5000, verb: 0.3 })
      tone(v, { at: i * 0.045, f: f * 2, a: 0.003, d: 0.12, g: 0.035, verb: 0.3 })
    })
    noise(v, { type: 'bandpass', f: 500, f2: 6000, q: 0.9, a: 0.12, d: 0.22, g: 0.045, verb: 0.3 })
    tone(v, { f: 110, f2: 55, glide: 0.12, a: 0.003, d: 0.25, g: 0.18, verb: 0 })
  },
  submit(v) {
    tone(v, { f: E5, a: 0.004, d: 0.16, g: 0.16, fm: { ratio: 2, index: 0.8 }, verb: 0.25 })
    tone(v, { at: 0.075, f: B5, a: 0.005, d: 0.32, g: 0.16, fm: { ratio: 2, index: 0.6 }, verb: 0.3 })
    tone(v, { f: 330, f2: 220, a: 0.002, d: 0.09, g: 0.12, verb: 0 })
  },
  alarm(v) {
    const notes = [A5, E5, A5, E5]
    notes.forEach((f, i) => {
      const at = i * 0.12
      tone(v, { at, type: 'triangle', f, a: 0.006, d: 0.11, g: 0.14, lp: 3200, verb: 0.2 })
      tone(v, { at, f: f * 2, a: 0.004, d: 0.06, g: 0.03, verb: 0.2 })
    })
  },
  correct(v) {
    tone(v, { f: A5, f2: A5 * 2, glide: 0.05, a: 0.002, d: 0.14, g: 0.16, verb: 0.2 })
    tone(v, { at: 0.05, f: E6, a: 0.004, d: 0.22, g: 0.1, fm: { ratio: 3, index: 0.4 }, verb: 0.3 })
    tone(v, { at: 0.05, f: E6 * 2, a: 0.001, d: 0.06, g: 0.025, verb: 0.3 })
  },
  wrong(v) {
    tone(v, { f: 200, f2: 105, glide: 0.12, a: 0.003, d: 0.2, g: 0.28, lp: 900, verb: 0.1 })
    tone(v, { type: 'triangle', f: 150, f2: 90, glide: 0.1, a: 0.003, d: 0.14, g: 0.07, lp: 700, verb: 0 })
    noise(v, { type: 'lowpass', f: 500, a: 0.002, d: 0.05, g: 0.06, verb: 0 })
  },
  score(v) {
    // Count-up tick: short and bright (2–3.7 kHz as the pitch rises), audible over the reveal song.
    tone(v, { f: 2400, a: 0.0008, d: 0.05, g: 0.12, verb: 0.04 })
    noise(v, { type: 'bandpass', f: 4800, q: 2.2, a: 0.0004, d: 0.006, g: 0.03, verb: 0 })
  },
  fanfare(v) {
    const arp = [C5, E5, G5, C6]
    arp.forEach((f, i) => {
      const at = i * 0.075
      tone(v, { at, type: 'triangle', f, a: 0.004, d: 0.28, g: 0.09, lp: 5200, verb: 0.35 })
      tone(v, { at, f: f * 2, a: 0.003, d: 0.14, g: 0.03, verb: 0.35 })
    })
    for (const f of [C5, E5, G5, C6, E6]) {
      tone(v, { at: 0.3, f, a: 0.012, d: 1.0, g: 0.05, fm: { ratio: 2, index: 0.5 }, verb: 0.45, detune: (Math.random() * 2 - 1) * 6 })
    }
    tone(v, { at: 0.3, f: C3, a: 0.006, d: 0.6, g: 0.12, verb: 0.1 })
    for (let i = 0; i < 9; i++) {
      tone(v, {
        at: 0.32 + Math.random() * 0.6,
        f: SPARKLE[Math.floor(Math.random() * SPARKLE.length)],
        a: 0.002,
        d: 0.05 + Math.random() * 0.08,
        g: 0.02 + Math.random() * 0.02,
        pan: Math.random() * 1.4 - 0.7,
        verb: 0.5,
      })
    }
    noise(v, { at: 0.28, type: 'highpass', f: 7000, a: 0.15, d: 0.6, g: 0.018, verb: 0.4 })
  },
  join(v) {
    tone(v, { f: C6, a: 0.003, d: 0.1, g: 0.12, verb: 0.2 })
    tone(v, { at: 0.07, f: G6, a: 0.004, d: 0.18, g: 0.12, fm: { ratio: 2, index: 0.3 }, verb: 0.25 })
  },
  leave(v) {
    tone(v, { f: G5, a: 0.004, d: 0.1, g: 0.1, lp: 3000, verb: 0.2 })
    tone(v, { at: 0.08, f: C5, a: 0.005, d: 0.2, g: 0.1, lp: 2400, verb: 0.2 })
  },
  pop(v) {
    const r = 0.9 + Math.random() * 0.25
    tone(v, { f: 280 * r, f2: 900 * r, glide: 0.045, a: 0.001, d: 0.085, g: 0.2, verb: 0.15 })
    noise(v, { type: 'bandpass', f: 3200, q: 1.5, a: 0.0006, d: 0.008, g: 0.025, verb: 0 })
  },
}

/* ------------------------------------------------------------------ public API */

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

let enabled = readEnabled()
const lastPlayed = new Map<SfxName, number>()
const playCounts = new Map<SfxName, number>()
const listeners = new Set<() => void>()

const clampOpt = (x: number | undefined, def: number, lo: number, hi: number) =>
  x === undefined || !Number.isFinite(x) ? def : Math.max(lo, Math.min(hi, x))

const voiceGain = (name: SfxName, gain: number | undefined) => clampOpt(gain, 1, 0, 2) * Math.pow(10, (TRIM_DB[name] ?? 0) / 20)

export const sfx: { play(name: SfxName, opts?: { pitch?: number; gain?: number }): void; setEnabled(on: boolean): void; readonly enabled: boolean } = {
  play(name, opts) {
    if (!enabled) return
    const recipe = RECIPES[name]
    if (!recipe) return
    const out = getSfxOutput()
    if (!out) return
    const now = performance.now()
    if (now - (lastPlayed.get(name) ?? -1e9) < (MIN_GAP_MS[name] ?? DEFAULT_GAP_MS)) return
    if (activeSources > MAX_SOURCES) return
    lastPlayed.set(name, now)
    playCounts.set(name, (playCounts.get(name) ?? 0) + 1)
    try {
      recipe({
        ctx: out.ctx,
        bus: busFor(out.ctx, out.input),
        t: out.ctx.currentTime + 0.003,
        pitch: clampOpt(opts?.pitch, 1, 0.25, 4),
        gain: voiceGain(name, opts?.gain),
      })
      const duck = DUCK[name]
      if (duck) duckMusic(duck[0] * Math.min(1, clampOpt(opts?.gain, 1, 0, 2)), duck[1])
    } catch (err) {
      console.error('[sfx]', name, err)
    }
  },
  setEnabled(on) {
    enabled = !!on
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {
      // not persisted
    }
    for (const l of [...listeners]) l()
  },
  get enabled() {
    return enabled
  },
}

/** Fires when `sfx.enabled` changes (for React hooks). */
export function subscribeSfx(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Render one sound offline (same chain, unit volume) — for labs, tests and level checks. */
export function renderSfx(name: SfxName, opts?: { pitch?: number; gain?: number }, sampleRate = 48000): Promise<AudioBuffer> {
  const seconds = name === 'fanfare' ? 2.2 : 1.3
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  RECIPES[name]({
    ctx,
    bus: busFor(ctx, ctx.destination),
    t: 0.005,
    pitch: clampOpt(opts?.pitch, 1, 0.25, 4),
    gain: voiceGain(name, opts?.gain),
  })
  return ctx.startRendering()
}

/** Diagnostics for labs/tests. */
export const sfxDebug = {
  /** How many times each sound actually played (after enable/unlock/throttle checks). */
  plays: (): Partial<Record<SfxName, number>> => Object.fromEntries(playCounts),
  activeSources: () => activeSources,
}
