// Web Audio engine: loading/decoding previews, gapless scheduled playback of
// snippets in any order, full-track playback, and an analyser feeding visuals.
//
// Graph (one lazy AudioContext; pre-warmed at idle on Chromium so the first tap stays snappy):
//   voice source → voice gain (fades) → session trim (loudness) → music bus → analyser → duck → master (volume) ─┐
//   SFX bus → SFX volume ──────────────────────────────────────────────────────────────────────────────────────────┴→ limiter → destination
// Every decoded track is measured once (BS.1770 integrated loudness) and played with
// a per-track trim towards TARGET_LUFS, so rounds sound equally loud and the SFX sit
// at a stable level over the music (snippets, play-all and the reveal share the trim).
// The analyser taps the normalised music before the duck/volume stages, so the visuals
// react the same way at any volume (and keep moving when muted); SFX never reach it.
// The limiter is only a safety net for loud masters + SFX piling up at full volume.

export interface TimeRange {
  start: number
  end: number
}

export type PlaybackMode = 'sequence' | 'segment' | 'full'

/** Discrete playback state (changes at most at segment boundaries). Mirrored in usePlayback. */
export interface PlaybackState {
  playing: boolean
  /**
   * Playback was started (`playing` stays true) but the AudioContext isn't running yet —
   * still locked (no gesture so far) or interrupted — so nothing is audible. UI should offer
   * "tocca per ascoltare" instead of a pause control. Absent/false once it is audible.
   */
  pending?: boolean
  mode: PlaybackMode | null
  /** Buffer key being played. */
  key: string | null
  /** Caller-supplied tag, lets UI know who started playback (e.g. "board", "block:3", "reveal"). */
  tag: string | null
  /** In 'sequence' mode: current POSITION in the arrangement. In 'segment' mode: the segment index passed by caller (or 0). */
  index: number
}

/** Fine-grained position, read every animation frame by playheads. */
export interface PlaybackPosition {
  mode: PlaybackMode
  key: string
  tag: string | null
  index: number
  /** 0..1 progress inside the current snippet (or through the whole range in 'full' mode). */
  progress: number
  /** Seconds elapsed since this playback started. */
  elapsed: number
}

export interface SequenceOptions {
  tag?: string
  /** Position to start from (default 0). */
  fromPosition?: number
  /** Called when the playing position changes. */
  onPosition?: (position: number) => void
  onEnded?: () => void
}

export interface AudioLevels {
  /** All 0..1, smoothed. Decay to ~0 when silent. */
  bass: number
  mid: number
  treble: number
  energy: number
  /** Onset pulse: jumps to 1 on a detected beat, decays over ~250ms. */
  beat: number
}

export interface AudioEngine {
  /** Must be called from a user gesture at least once (iOS/Safari). Idempotent. */
  unlock(): Promise<void>
  readonly unlocked: boolean
  /**
   * Fetch + decode (cached by key). Retries; on HTTP 403/expired URL calls
   * `refresh()` (if given) for a fresh URL. Concurrent calls for the same key share one promise.
   */
  load(key: string, url: string, refresh?: () => Promise<string>): Promise<AudioBuffer>
  get(key: string): AudioBuffer | undefined
  has(key: string): boolean
  /**
   * Play snippets back-to-back, gapless. `getSegmentAt(position)` is asked JUST IN TIME
   * (lookahead scheduler) so reordering during playback affects upcoming positions.
   * Return null to end. Contiguous neighbours (a.end === b.start) play with no fade → seamless.
   */
  playSequence(key: string, getSegmentAt: (position: number) => TimeRange | null, opts?: SequenceOptions): void
  /** Play one snippet (short click-free fades). */
  playSegment(key: string, range: TimeRange, opts?: { tag?: string; index?: number; onEnded?: () => void }): void
  /** Play a range of the whole buffer (reveal / background music). */
  playFull(key: string, opts?: { tag?: string; from?: number; to?: number; fadeInMs?: number; onEnded?: () => void }): void
  /** Stop with a short fade (default 60ms). */
  stop(fadeMs?: number): void
  getState(): PlaybackState
  getPosition(): PlaybackPosition | null
  subscribe(listener: (s: PlaybackState) => void): () => void
  /** Master volume 0..1 (persisted). */
  setVolume(v: number): void
  readonly volume: number
  /** Smoothed spectral features for the shader background. Cheap; call every frame. */
  getLevels(): AudioLevels
}

/** Rejection reason of `audioEngine.load` once every retry failed. `message` is Italian, user-facing. */
export class AudioLoadError extends Error {
  readonly key: string
  /** Last HTTP status seen (0 = network/decode failure). */
  readonly status: number
  constructor(message: string, key: string, status: number) {
    super(message)
    this.name = 'AudioLoadError'
    this.key = key
    this.status = status
  }
}

/* ------------------------------------------------------------------ tuning */

const TICK_MS = 25
/**
 * Audio kept scheduled ahead of "now" (≥ one whole snippet at 16 snippets): a main-thread
 * stall shorter than this (slow phone, drag, GC) never opens a gap in play-all.
 */
const AHEAD_S = 1
/** Background tabs throttle timers to ~1s: schedule further ahead while hidden. */
const AHEAD_HIDDEN_S = 2.5
/**
 * Snippets starting later than now + COMMIT_S are re-checked against the live order
 * every tick and re-planned if it changed, so a reorder still lands "just in time".
 */
const COMMIT_S = 0.05
const START_DELAY_S = 0.02
const JOIN_FADE_S = 0.004
const SWITCH_FADE_S = 0.03
const CONTIGUOUS_EPS_S = 1e-4
const FFT_SIZE = 2048

const VOLUME_KEY = 'unshuffle:volume'
const DEFAULT_VOLUME = 0.9
const VOLUME_RAMP_S = 0.05

const RETRY_DELAYS_MS = [300, 1000, 2500]
const FETCH_TIMEOUT_MS = 20_000
const MAX_PARALLEL_FETCHES = 4
const MAX_PARALLEL_DECODES = 2

/** Loudness normalisation (streaming-service level: Spotify/YouTube -14, Deezer -15). */
export const TARGET_LUFS = -14
const MAX_BOOST_DB = 6
const MAX_CUT_DB = 12
/** A boost never pushes the sample peak above this. */
const PEAK_CEILING_DB = -1
/** Median loudness (unit gain) of the previews the level mapping below was tuned on. */
const LEVELS_TUNED_LUFS = -9

/** Output safety limiter (transparent below the threshold). */
const LIMITER = { threshold: -1, knee: 0, ratio: 20, attack: 0.002, release: 0.15 }

/* ------------------------------------------------------------------ utils */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const noop = () => undefined

function safeCall(fn: () => void): void {
  try {
    fn()
  } catch (err) {
    console.error('[audio] listener error', err)
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode / quota / disabled storage: the setting just won't persist
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const pageHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Same value for every call within one rendered frame (rAF time), so per-frame caches line up. */
function frameStamp(): number {
  const tl = typeof document !== 'undefined' ? document.timeline?.currentTime : null
  return typeof tl === 'number' ? tl : Math.floor(performance.now() / 4)
}

/** Let input and rendering run between slices of heavy work (not throttled in background tabs, unlike timers). */
function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (typeof sched?.yield === 'function') return sched.yield()
  if (typeof MessageChannel !== 'undefined') {
    return new Promise<void>((resolve) => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => {
        ch.port1.close()
        resolve()
      }
      ch.port2.postMessage(0)
    })
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/** Tiny FIFO semaphore: hands the slot straight to the next waiter. */
function limiter(max: number) {
  let active = 0
  const waiting: (() => void)[] = []
  const acquire = (): Promise<void> => {
    if (active < max) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => waiting.push(resolve))
  }
  const release = () => {
    const next = waiting.shift()
    if (next) next()
    else active--
  }
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    await acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }
}

/* ------------------------------------------------------------------ platform */

/** iPhone / iPad / iPod (iPadOS reports itself as a Mac with touch). Every browser there is WebKit. */
function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
}

function isChromium(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }
  if (nav.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand))) return true
  return /Chrome\//.test(nav.userAgent || '') && !isAppleMobile()
}

type SessionNavigator = Navigator & { audioSession?: { type: string } }

const hasAudioSessionApi = () => typeof navigator !== 'undefined' && !!(navigator as SessionNavigator).audioSession

/** iOS < 17: no Audio Session API, Web Audio obeys the silent switch unless a media element plays. */
const legacyIos = () => isAppleMobile() && !hasAudioSessionApi()

/* ------------------------------------------------------------------ graph */

interface Graph {
  ctx: AudioContext
  music: GainNode
  analyser: AnalyserNode
  duck: GainNode
  master: GainNode
  sfxIn: GainNode
  sfxVolume: GainNode
}

let graph: Graph | null = null
let volume = readInitialVolume()

function readInitialVolume(): number {
  const raw = readStored(VOLUME_KEY)
  const v = raw === null ? NaN : Number(raw)
  return Number.isFinite(v) ? clamp01(v) : DEFAULT_VOLUME
}

/** Perceptual taper: the slider feels linear in loudness. */
const volumeGain = (v: number) => v * v

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** iOS 17+: 'playback' makes Web Audio ignore the silent switch. Only from unlock() (a real CTA / in-room gesture). */
function setAudioSession(): void {
  const nav = typeof navigator !== 'undefined' ? (navigator as SessionNavigator) : null
  if (!nav?.audioSession) return
  try {
    if (nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback'
  } catch {
    // read-only in some embeddings
  }
}

function ensureGraph(): Graph | null {
  if (graph && graph.ctx.state !== 'closed') return graph
  const Ctor = audioContextCtor()
  if (!Ctor) return null
  let ctx: AudioContext
  try {
    ctx = new Ctor({ latencyHint: 'interactive' })
  } catch {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  const music = ctx.createGain()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = FFT_SIZE
  analyser.smoothingTimeConstant = 0.2
  analyser.minDecibels = -100
  analyser.maxDecibels = -10
  const duck = ctx.createGain()
  const master = ctx.createGain()
  master.gain.value = volumeGain(volume)
  const sfxIn = ctx.createGain()
  const sfxVolume = ctx.createGain()
  sfxVolume.gain.value = volumeGain(volume)
  let out: AudioNode = ctx.destination
  try {
    const lim = ctx.createDynamicsCompressor()
    lim.threshold.value = LIMITER.threshold
    lim.knee.value = LIMITER.knee
    lim.ratio.value = LIMITER.ratio
    lim.attack.value = LIMITER.attack
    lim.release.value = LIMITER.release
    lim.connect(ctx.destination)
    out = lim
  } catch {
    // no compressor: straight to the speakers
  }
  music.connect(analyser)
  analyser.connect(duck)
  duck.connect(master)
  master.connect(out)
  sfxIn.connect(sfxVolume)
  sfxVolume.connect(out)
  ctx.addEventListener('statechange', onContextStateChange)
  graph = { ctx, music, analyser, duck, master, sfxIn, sfxVolume }
  lastAudible = 0
  duckUntil = 0
  duckDepthDb = 0
  resetLevels()
  return graph
}

let everRunning = false
const settingsListeners = new Set<() => void>()

function emitSettings(): void {
  for (const l of [...settingsListeners]) safeCall(l)
}

function onContextStateChange(): void {
  const g = graph
  if (!g) return
  if (g.ctx.state === 'running') {
    everRunning = true
    if (current) tick()
  }
  // Locked → audible (or interrupted): refresh the `pending` flag of what's playing.
  if (state.playing) setState({ ...state })
  emitSettings()
}

/* ------------------------------------------------------------------ loudness */

/** Minimal PCM view (an AudioBuffer satisfies it), so loudness can be measured anywhere. */
export interface PcmData {
  readonly numberOfChannels: number
  readonly sampleRate: number
  readonly length: number
  getChannelData(channel: number): Float32Array
}

export interface LoudnessInfo {
  /** Integrated loudness (ITU-R BS.1770-4: K-weighted, 400 ms blocks, -70 LUFS / -10 LU gates). -Infinity when silent. */
  lufs: number
  /** Sample peak, dBFS. */
  peakDb: number
  /** Trim the engine plays this track with, dB. */
  gainDb: number
}

/** Normalised biquad [b0, b1, b2, a1, a2]. */
type Biquad = readonly [number, number, number, number, number]

/** BS.1770 K-weighting at any sample rate: +4 dB high shelf (~1.7 kHz), then the RLB high-pass (~38 Hz). */
function kWeighting(fs: number): [Biquad, Biquad] {
  // Bilinear re-derivation of the 48 kHz coefficients in the recommendation (as in libebur128),
  // so 44.1 kHz and other device rates are weighted exactly the same way.
  let K = Math.tan((Math.PI * 1681.974450955533) / fs)
  let Q = 0.7071752369554196
  const Vh = Math.pow(10, 3.999843853973347 / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  let a0 = 1 + K / Q + K * K
  const shelf: Biquad = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]
  K = Math.tan((Math.PI * 38.13547087602444) / fs)
  Q = 0.5003270373238773
  a0 = 1 + K / Q + K * K
  const hp: Biquad = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]
  return [shelf, hp]
}

const powerToLufs = (p: number) => -0.691 + 10 * Math.log10(p)

/** The trim for a measured track: towards TARGET_LUFS, clamped, and a boost never lifts the peak over PEAK_CEILING_DB. */
export function loudnessGainDb(lufs: number, peakDb: number): number {
  if (!Number.isFinite(lufs)) return 0
  let db = Math.max(-MAX_CUT_DB, Math.min(MAX_BOOST_DB, TARGET_LUFS - lufs))
  if (db > 0) db = Math.min(db, Math.max(0, PEAK_CEILING_DB - peakDb))
  return Math.round(db * 100) / 100
}

/**
 * Integrated loudness + sample peak of a buffer. ~10 ms of CPU for a 30 s stereo preview,
 * sliced (yielding every `sliceMs`) so it never becomes a long task on slow phones.
 */
export async function measureLoudness(pcm: PcmData, sliceMs = 6): Promise<LoudnessInfo> {
  const fs = pcm.sampleRate
  const chans = Math.max(0, Math.min(2, pcm.numberOfChannels))
  // A mono file plays on both speakers: count it twice, like identical L/R.
  const weight = pcm.numberOfChannels === 1 ? 2 : 1
  const data: Float32Array[] = []
  for (let ch = 0; ch < chans; ch++) data.push(pcm.getChannelData(ch))
  const [s, h] = kWeighting(fs)
  const hop = Math.max(1, Math.round(fs * 0.1))
  const nSub = Math.floor(pcm.length / hop)
  const sub = new Float64Array(nSub)
  // Per channel: x1 x2 (input), y1 y2 (shelf out), z1 z2 (high-pass out).
  const st = data.map(() => new Float64Array(6))
  let peak = 0
  let t0 = nowMs()
  for (let j = 0; j < nSub; j++) {
    let acc = 0
    for (let ch = 0; ch < chans; ch++) {
      const x = data[ch]
      const m = st[ch]
      let x1 = m[0], x2 = m[1], y1 = m[2], y2 = m[3], z1 = m[4], z2 = m[5]
      for (let i = j * hop, end = i + hop; i < end; i++) {
        const v = x[i]
        const a = v < 0 ? -v : v
        if (a > peak) peak = a
        const y = s[0] * v + s[1] * x1 + s[2] * x2 - s[3] * y1 - s[4] * y2
        x2 = x1
        x1 = v
        const z = h[0] * y + h[1] * y1 + h[2] * y2 - h[3] * z1 - h[4] * z2
        y2 = y1
        y1 = y
        z2 = z1
        z1 = z
        acc += z * z
      }
      m[0] = x1; m[1] = x2; m[2] = y1; m[3] = y2; m[4] = z1; m[5] = z2
    }
    sub[j] = acc * weight
    if ((j & 3) === 3 && nowMs() - t0 > sliceMs) {
      await yieldToMain()
      t0 = nowMs()
    }
  }
  for (let ch = 0; ch < chans; ch++) {
    const x = data[ch]
    for (let i = nSub * hop; i < x.length; i++) {
      const a = Math.abs(x[i])
      if (a > peak) peak = a
    }
  }
  // 400 ms gating blocks with 75 % overlap = 4 consecutive 100 ms sub-blocks.
  const blocks: number[] = []
  for (let k = 0; k + 4 <= nSub; k++) {
    const p = (sub[k] + sub[k + 1] + sub[k + 2] + sub[k + 3]) / (4 * hop)
    if (p > 0 && powerToLufs(p) > -70) blocks.push(p)
  }
  let lufs = -Infinity
  if (blocks.length) {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const relGate = powerToLufs(mean(blocks)) - 10
    const gated = blocks.filter((p) => powerToLufs(p) > relGate)
    if (gated.length) lufs = powerToLufs(mean(gated))
  }
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity
  return { lufs, peakDb, gainDb: loudnessGainDb(lufs, peakDb) }
}

const loudness = new WeakMap<AudioBuffer, LoudnessInfo>()
let normalizeOn = true

async function analyseLoudness(buf: AudioBuffer): Promise<void> {
  if (loudness.has(buf)) return
  try {
    loudness.set(buf, await measureLoudness(buf))
  } catch (err) {
    console.warn('[audio] loudness analysis failed', err)
  }
}

/** Linear playback trim of a buffer (1 = untouched). */
function trimOf(buf: AudioBuffer): number {
  const l = normalizeOn ? loudness.get(buf) : undefined
  return l ? Math.pow(10, l.gainDb / 20) : 1
}

/* ------------------------------------------------------------------ loading */

const buffers = new Map<string, AudioBuffer>()
const inflight = new Map<string, Promise<AudioBuffer>>()
const fetchSlot = limiter(MAX_PARALLEL_FETCHES)
const decodeSlot = limiter(MAX_PARALLEL_DECODES)

/** One failed attempt; `refresh` = the URL itself is probably bad (expired / missing). */
class AttemptError extends Error {
  readonly status: number
  readonly refresh: boolean
  readonly fatal: boolean
  constructor(reason: string, status: number, refresh: boolean, fatal = false) {
    super(reason)
    this.status = status
    this.refresh = refresh
    this.fatal = fatal
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null
  try {
    let res: Response
    try {
      res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl?.signal })
    } catch {
      throw new AttemptError(ctrl?.signal.aborted ? 'download troppo lento' : 'rete non raggiungibile', 0, true)
    }
    if (!res.ok) {
      const s = res.status
      const retrySame = s === 408 || s === 429 || s >= 500
      const reason = s === 403 || s === 404 || s === 410 ? 'link audio scaduto o non valido' : `errore del server (HTTP ${s})`
      throw new AttemptError(reason, s, !retrySame)
    }
    try {
      return await res.arrayBuffer()
    } catch {
      throw new AttemptError('download interrotto', 0, true)
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Callback + promise forms: old Safari only implements the former.
  return new Promise<AudioBuffer>((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined
      if (p && typeof p.then === 'function') p.then(resolve, reject)
    } catch (err) {
      reject(err)
    }
  })
}

async function loadWithRetry(key: string, url: string, refresh?: () => Promise<string>): Promise<AudioBuffer> {
  let href = url
  let reason = 'errore sconosciuto'
  let status = 0
  const renew = async () => {
    if (!refresh) return false
    try {
      const fresh = await refresh()
      if (fresh) href = fresh
      return !!fresh
    } catch {
      return false
    }
  }
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])
    try {
      const g = ensureGraph()
      if (!g) throw new AttemptError('Web Audio non supportato da questo browser', 0, false, true)
      if (!href && !(await renew())) throw new AttemptError('link audio mancante', 0, false, !refresh)
      const data = await fetchSlot(() => fetchBytes(href))
      let buf: AudioBuffer
      try {
        buf = await decodeSlot(() => decode(g.ctx, data))
      } catch {
        throw new AttemptError('formato audio non valido', 0, true)
      }
      await analyseLoudness(buf)
      return buf
    } catch (err) {
      const e = err instanceof AttemptError ? err : new AttemptError('errore imprevisto', 0, true)
      reason = e.message
      status = e.status || status
      if (e.fatal) break
      if (e.refresh && attempt < RETRY_DELAYS_MS.length) await renew()
    }
  }
  throw new AudioLoadError(`Impossibile caricare l'audio del brano: ${reason}.`, key, status)
}

/* ------------------------------------------------------------------ playback state */

const IDLE: PlaybackState = Object.freeze({ playing: false, mode: null, key: null, tag: null, index: 0 })
let state: PlaybackState = IDLE
const listeners = new Set<(s: PlaybackState) => void>()

/** Playback can't be heard right now: the context is missing, suspended or interrupted. */
function contextSilent(): boolean {
  return !graph || graph.ctx.state !== 'running'
}

function setState(next: PlaybackState): void {
  const c = state
  if (next.playing) next = { ...next, pending: contextSilent() }
  if (
    c.playing === next.playing &&
    !!c.pending === !!next.pending &&
    c.mode === next.mode &&
    c.key === next.key &&
    c.tag === next.tag &&
    c.index === next.index
  )
    return
  state = Object.freeze(next)
  for (const l of [...listeners]) safeCall(() => l(state))
}

/* ------------------------------------------------------------------ scheduler */

interface Voice {
  src: AudioBufferSourceNode
  gain: GainNode
  start: number
  end: number
}

type JoinKind = 'first' | 'gapless' | 'crossfade' | 'resync'
type OutroKind = 'open' | 'gapless' | 'tail' | 'fade' | 'cut'

/** Diagnostic record of one scheduled snippet (see `engineDebug.schedule()`). */
export interface ScheduledItemInfo {
  position: number
  /** Context time the snippet starts (seconds) and its sample frame. */
  when: number
  whenFrame: number
  /** Length in context sample frames. */
  frames: number
  end: number
  /** Range as returned by the caller. */
  range: TimeRange
  /** Buffer sample offsets actually played. */
  startSample: number
  endSample: number
  join: JoinKind
  outro: OutroKind
}

interface Item {
  info: ScheduledItemInfo
  voice: Voice
  /** Crossfade continuation past the cut (outro 'tail'). */
  tail: Voice | null
  /** Context time the end fade starts (outro 'fade'), 0 when none. */
  fadeAt: number
}

interface Session {
  mode: PlaybackMode
  key: string
  buffer: AudioBuffer
  tag: string | null
  /** Reported index in 'segment' / 'full' mode; null in 'sequence' mode (index = position). */
  fixedIndex: number | null
  getRange: (position: number) => TimeRange | null
  firstFadeS: number
  onPosition?: (position: number) => void
  onEnded?: () => void
  /** Loudness trim of this track; every voice of the session goes through it. */
  trim: GainNode
  trimReleased: boolean
  started: boolean
  nextPosition: number
  nextFrame: number
  startTime: number
  exhausted: boolean
  endTime: number
  items: Item[]
  voices: Set<Voice>
  firedPosition: number
  log: ScheduledItemInfo[]
}

let current: Session | null = null
let lastLog: ScheduledItemInfo[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let positionCache: { session: Session; stamp: number; at: number; value: PlaybackPosition } | null = null

const reportIndex = (s: Session, position: number) => s.fixedIndex ?? position

let lastAudible = 0

/**
 * Context time currently reaching the speakers: uses the output timestamp when
 * available (compensates Bluetooth/OS latency), monotonic.
 */
function audibleTime(ctx: AudioContext): number {
  const ct = ctx.currentTime
  let t = ct - Math.min(0.3, (ctx.outputLatency || 0) + (ctx.baseLatency || 0))
  if (ctx.state === 'running' && typeof ctx.getOutputTimestamp === 'function') {
    const ts = ctx.getOutputTimestamp()
    const pt = ts.performanceTime ?? 0
    if (pt > 0) {
      const est = (ts.contextTime ?? 0) + (performance.now() - pt) / 1000
      if (est >= ct - 0.5) t = Math.min(est, ct)
    }
  }
  if (t < lastAudible) t = lastAudible
  lastAudible = t
  return t
}

/** Disconnect a finished session's trim once nothing plays through it any more. */
function releaseTrim(s: Session): void {
  if (s.trimReleased || current === s || s.voices.size) return
  s.trimReleased = true
  try {
    s.trim.disconnect()
  } catch {
    // already disconnected
  }
}

function startVoice(s: Session, g: Graph, when: number, offset: number, duration: number, fadeIn: number): Voice {
  const { ctx } = g
  const src = ctx.createBufferSource()
  src.buffer = s.buffer
  const gain = ctx.createGain()
  if (fadeIn > 0) {
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(1, when + fadeIn)
  }
  src.connect(gain)
  gain.connect(s.trim)
  const voice: Voice = { src, gain, start: when, end: when + duration }
  s.voices.add(voice)
  src.onended = () => {
    s.voices.delete(voice)
    try {
      src.disconnect()
      gain.disconnect()
    } catch {
      // already disconnected
    }
    releaseTrim(s)
  }
  src.start(when, offset, duration)
  return voice
}

/** Cancel a voice that has not started yet (a future-scheduled source never sounds). */
function cancelVoice(v: Voice): void {
  try {
    v.src.stop(0)
  } catch {
    // already stopped
  }
}

/** Fade the tail of an item inside its own range (end of playback, or no audio left for a crossfade). */
function fadeItemEnd(item: Item, ctx: AudioContext): OutroKind {
  const { info, voice } = item
  const f = Math.min(JOIN_FADE_S, (info.end - info.when) / 2)
  const t0 = info.end - f
  if (t0 < ctx.currentTime + 0.001) return 'cut'
  voice.gain.gain.setValueAtTime(1, t0)
  voice.gain.gain.linearRampToValueAtTime(0, info.end)
  item.fadeAt = t0
  return 'fade'
}

/**
 * Non-contiguous join: let the outgoing snippet keep sounding for a few ms past
 * its cut (a sample-exact continuation) while fading out, overlapping the
 * incoming fade-in. A short crossfade instead of a dip to silence.
 */
function crossfadeOut(s: Session, g: Graph, item: Item): OutroKind {
  const { info } = item
  const bsr = s.buffer.sampleRate
  const avail = s.buffer.length - info.endSample
  const len = Math.min(Math.round(JOIN_FADE_S * bsr), avail)
  if (len < (JOIN_FADE_S * bsr) / 2) return fadeItemEnd(item, g.ctx)
  if (info.end < g.ctx.currentTime + 0.001) return 'cut'
  const dur = len / bsr
  const tail = startVoice(s, g, info.end, info.endSample / bsr, dur, 0)
  tail.gain.gain.setValueAtTime(1, info.end)
  tail.gain.gain.linearRampToValueAtTime(0, info.end + dur)
  item.tail = tail
  return 'tail'
}

/** Undo the outro planned for the (new) last item, so the next snippet can be joined again. */
function reopenOutro(item: Item): void {
  if (item.tail) {
    cancelVoice(item.tail)
    item.tail = null
  }
  if (item.fadeAt > 0) {
    try {
      item.voice.gain.gain.cancelScheduledValues(item.fadeAt)
    } catch {
      // ignore
    }
    item.fadeAt = 0
  }
  item.info.outro = 'open'
}

function safeRange(s: Session, position: number): TimeRange | null {
  let range: TimeRange | null = null
  try {
    range = s.getRange(position)
  } catch (err) {
    console.error('[audio] getSegmentAt failed', err)
  }
  return range && Number.isFinite(range.start) && Number.isFinite(range.end) ? range : null
}

const sameRange = (a: TimeRange | null, b: TimeRange) => !!a && Math.abs(a.start - b.start) < 1e-9 && Math.abs(a.end - b.end) < 1e-9

/**
 * Just-in-time order on top of a deep lookahead: every snippet that has not started
 * yet (and is not about to) is re-checked against the live order; from the first one
 * that changed, the plan is cancelled and rebuilt by the next pump().
 */
function revise(s: Session, g: Graph): void {
  if (s.mode !== 'sequence' || !s.started || !s.items.length) return
  const commit = g.ctx.currentTime + COMMIT_S
  let first = s.items.length
  while (first > 0 && s.items[first - 1].info.when > commit) first--
  let cut = -1
  for (let i = first; i < s.items.length; i++) {
    const it = s.items[i]
    if (!sameRange(safeRange(s, it.info.position), it.info.range)) {
      cut = i
      break
    }
  }
  if (cut < 0) return
  const dropped = s.items.splice(cut)
  for (const it of dropped) {
    cancelVoice(it.voice)
    if (it.tail) cancelVoice(it.tail)
    const k = s.log.indexOf(it.info)
    if (k >= 0) s.log.splice(k, 1)
  }
  const prev = s.items.length ? s.items[s.items.length - 1] : null
  if (prev) reopenOutro(prev)
  s.nextPosition = dropped[0].info.position
  s.nextFrame = dropped[0].info.whenFrame
  s.exhausted = false
  s.endTime = Infinity
  positionCache = null
}

/** Schedule every snippet that starts before the lookahead horizon. */
function pump(s: Session, g: Graph): void {
  const { ctx } = g
  const sr = ctx.sampleRate
  const bsr = s.buffer.sampleRate
  const now = ctx.currentTime
  if (!s.started) {
    s.started = true
    s.nextFrame = Math.ceil((now + START_DELAY_S) * sr)
    s.startTime = s.nextFrame / sr
  }
  const horizon = now + (pageHidden() ? AHEAD_HIDDEN_S : AHEAD_S)
  for (let guard = 0; !s.exhausted && s.nextFrame / sr < horizon && guard < 64; guard++) {
    let resync = false
    if (s.nextFrame / sr < now + 0.003) {
      // The main thread stalled past a boundary: restart cleanly just ahead of now.
      s.nextFrame = Math.ceil((now + 0.012) * sr)
      resync = true
    }
    const prev = s.items.length ? s.items[s.items.length - 1] : null
    // Not back-to-back with the previous snippet (a stall, or a re-plan after one): fade both sides.
    if (prev && prev.info.whenFrame + prev.info.frames !== s.nextFrame) resync = true
    const range = safeRange(s, s.nextPosition)
    const gapless = !!(range && prev && !resync && Math.abs(prev.info.range.end - range.start) < CONTIGUOUS_EPS_S)
    let startSample = 0
    let endSample = 0
    if (range) {
      startSample = gapless ? prev!.info.endSample : Math.round(Math.max(0, range.start) * bsr)
      endSample = Math.min(s.buffer.length, Math.round(range.end * bsr))
    }
    if (!range || endSample - startSample < 2) {
      s.exhausted = true
      if (prev) {
        if (prev.info.outro === 'open') prev.info.outro = fadeItemEnd(prev, ctx)
        s.endTime = prev.info.end
      } else s.endTime = s.startTime
      break
    }
    const frames = bsr === sr ? endSample - startSample : Math.round(((endSample - startSample) * sr) / bsr)
    const when = s.nextFrame / sr
    const dur = frames / sr
    const join: JoinKind = gapless ? 'gapless' : resync ? 'resync' : prev ? 'crossfade' : 'first'
    const fadeIn = gapless ? 0 : Math.min(join === 'first' ? s.firstFadeS : JOIN_FADE_S, dur / 2)
    if (prev) {
      if (gapless) prev.info.outro = 'gapless'
      else if (resync) prev.info.outro = fadeItemEnd(prev, ctx)
      else prev.info.outro = crossfadeOut(s, g, prev)
    }
    const voice = startVoice(s, g, when, startSample / bsr, (endSample - startSample) / bsr, fadeIn)
    const info: ScheduledItemInfo = {
      position: s.nextPosition,
      when,
      whenFrame: s.nextFrame,
      frames,
      end: (s.nextFrame + frames) / sr,
      range: { start: range.start, end: range.end },
      startSample,
      endSample,
      join,
      outro: 'open',
    }
    s.items.push({ info, voice, tail: null, fadeAt: 0 })
    if (s.log.length < 1024) s.log.push(info)
    s.nextFrame += frames
    s.nextPosition += 1
  }
}

function audibleItem(s: Session, t: number): Item | null {
  for (let i = s.items.length - 1; i >= 0; i--) if (s.items[i].info.when <= t + 1e-6) return s.items[i]
  return null
}

function nextBoundary(s: Session, t: number): number | null {
  for (const it of s.items) if (it.info.when > t) return it.info.when
  return s.exhausted ? s.endTime : null
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function tick(): void {
  clearTimer()
  const s = current
  const g = graph
  if (!s || !g || g.ctx.state !== 'running') return
  revise(s, g)
  pump(s, g)
  const t = audibleTime(g.ctx)
  const it = audibleItem(s, t)
  if (it && it.info.position !== s.firedPosition) {
    s.firedPosition = it.info.position
    const index = reportIndex(s, it.info.position)
    setState({ playing: true, mode: s.mode, key: s.key, tag: s.tag, index })
    const cb = s.onPosition
    if (cb) safeCall(() => cb(index))
    if (current !== s) return
  }
  if (s.exhausted && t >= s.endTime - 5e-4) {
    finish(s)
    return
  }
  while (s.items.length > 1 && s.items[1].info.when < t - 0.5) s.items.shift()
  let delay = TICK_MS
  const boundary = nextBoundary(s, t)
  if (boundary !== null) delay = Math.min(delay, Math.max(1, (boundary - t) * 1000 + 0.5))
  timer = setTimeout(tick, delay)
}

/** Natural end. */
function finish(s: Session): void {
  if (current !== s) return
  clearTimer()
  current = null
  positionCache = null
  releaseTrim(s)
  setState(IDLE)
  const cb = s.onEnded
  if (cb) safeCall(cb)
}

/** Interrupt a session (stop / superseded): fade what is sounding, cancel what is queued. No onEnded. */
function halt(s: Session, fadeS: number): void {
  if (current === s) {
    current = null
    clearTimer()
    positionCache = null
  }
  const g = graph
  if (!g) return
  const now = g.ctx.currentTime
  const fade = Math.max(0.002, fadeS)
  for (const v of s.voices) {
    try {
      if (v.end <= now) continue
      if (v.start > now) {
        v.src.stop(0)
        continue
      }
      const p = v.gain.gain
      const value = p.value
      p.cancelScheduledValues(now)
      p.setValueAtTime(value, now)
      p.linearRampToValueAtTime(0, now + fade)
      v.src.stop(now + fade + 0.005)
    } catch {
      // node already stopped
    }
  }
  releaseTrim(s)
}

function begin(
  mode: PlaybackMode,
  key: string,
  getRange: (position: number) => TimeRange | null,
  o: { tag?: string; fixedIndex: number | null; fromPosition: number; firstFadeS: number; onPosition?: (p: number) => void; onEnded?: () => void },
): void {
  if (current) halt(current, SWITCH_FADE_S)
  const g = ensureGraph()
  const buffer = buffers.get(key)
  if (!g || !buffer) {
    if (!buffer) console.warn(`[audio] "${key}" non è ancora caricato`)
    setState(IDLE)
    return
  }
  const trim = g.ctx.createGain()
  trim.gain.value = trimOf(buffer)
  trim.connect(g.music)
  const s: Session = {
    mode,
    key,
    buffer,
    tag: o.tag ?? null,
    fixedIndex: o.fixedIndex,
    getRange,
    firstFadeS: o.firstFadeS,
    onPosition: o.onPosition,
    onEnded: o.onEnded,
    trim,
    trimReleased: false,
    started: false,
    nextPosition: o.fromPosition,
    nextFrame: 0,
    startTime: 0,
    exhausted: false,
    endTime: Infinity,
    items: [],
    voices: new Set(),
    firedPosition: -1,
    log: [],
  }
  current = s
  lastLog = s.log
  positionCache = null
  setState({ playing: true, mode, key, tag: s.tag, index: reportIndex(s, o.fromPosition) })
  if (g.ctx.state === 'running') tick()
  else
    g.ctx.resume().then(
      () => {
        if (current === s && timer === null) tick()
      },
      () => {
        // stays pending until a gesture unlocks the context (statechange → tick)
      },
    )
}

/* ------------------------------------------------------------------ levels */

const ZERO_LEVELS: AudioLevels = Object.freeze({ bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 })

/** dB windows mapped to 0..1, tuned on real previews at unit gain (EDM, ballad, rock, rap, Italian pop). */
const BANDS = {
  bass: { lo: 20, hi: 150, floor: -62, ceil: -22, curve: 1.6 },
  mid: { lo: 150, hi: 2000, floor: -66, ceil: -32, curve: 2 },
  treble: { lo: 2000, hi: 10000, floor: -80, ceil: -44, curve: 2 },
}
const ENERGY = { floor: -36, ceil: -6, curve: 2 }

/** The analyser sees normalised music: shift it back onto the windows above. */
const levelsTrimDb = () => (normalizeOn ? LEVELS_TUNED_LUFS - TARGET_LUFS : 0)

const lv = {
  levels: ZERO_LEVELS,
  stamp: -1,
  at: 0,
  activeUntil: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
  prevBass: 0,
  fluxMean: 0,
  fluxVar: 0,
  lastBeatAt: -1e9,
  freq: null as Float32Array<ArrayBuffer> | null,
  time: null as Float32Array<ArrayBuffer> | null,
  /** Recent analyses (performance.now() stamps), for output-latency compensation. */
  hist: [] as { at: number; v: AudioLevels }[],
  /** Smoothed output latency (s), -1 until measured. */
  delayS: -1,
  /** Last raw analysis (dB / flux), exposed through engineDebug for tuning. */
  raw: { bassDb: -Infinity, midDb: -Infinity, trebleDb: -Infinity, rmsDb: -Infinity, flux: 0, threshold: 0 },
}

function resetLevels(): void {
  lv.levels = ZERO_LEVELS
  lv.bass = lv.mid = lv.treble = lv.energy = lv.prevBass = lv.fluxMean = lv.fluxVar = 0
  lv.lastBeatAt = -1e9
  lv.freq = lv.time = null
  lv.hist = []
  lv.delayS = -1
}

const mapDb = (db: number, floor: number, ceil: number, curve: number) => Math.pow(clamp01((db - floor) / (ceil - floor)), curve)

function bandDb(freq: Float32Array, binHz: number, lo: number, hi: number): number {
  const k0 = Math.max(1, Math.round(lo / binHz))
  const k1 = Math.min(freq.length, Math.max(k0 + 1, Math.round(hi / binHz)))
  let p = 0
  for (let k = k0; k < k1; k++) p += Math.pow(10, freq[k] / 10)
  return 10 * Math.log10(p / (k1 - k0))
}

function follow(cur: number, target: number, dt: number, attack: number, release: number): number {
  return cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? attack : release)))
}

/**
 * The analyser hears the music as it is rendered, which is ahead of the speakers by the
 * output latency (Bluetooth: 150-250 ms). Hand out the analysis from that long ago, so
 * bass/beat pulses land with what the player hears, like the latency-compensated playheads.
 */
function delayForOutput(g: Graph, now: number, live: AudioLevels, gap: boolean): AudioLevels {
  const h = lv.hist
  if (gap) h.length = 0
  h.push({ at: now, v: live })
  if (g.ctx.state === 'running') {
    const lat = Math.max(0, Math.min(0.5, g.ctx.currentTime - audibleTime(g.ctx)))
    lv.delayS = lv.delayS < 0 ? lat : lv.delayS + (lat - lv.delayS) * 0.05
  }
  const target = now - Math.max(0, lv.delayS) * 1000
  while (h.length > 1 && h[1].at <= target) h.shift()
  if (h.length > 90) h.splice(0, h.length - 90)
  return h[0].v
}

function computeLevels(): AudioLevels {
  const g = graph
  if (!g) return ZERO_LEVELS
  const now = performance.now()
  const stamp = frameStamp()
  if (stamp === lv.stamp && now - lv.at < 12) return lv.levels
  const gap = now - lv.at > 250
  const dt = Math.min(0.25, Math.max(0.001, (now - lv.at) / 1000))
  lv.stamp = stamp
  lv.at = now
  if (current) lv.activeUntil = now + 1500
  let rb = 0
  let rm = 0
  let rt = 0
  let re = 0
  if (now < lv.activeUntil && g.ctx.state === 'running') {
    const a = g.analyser
    if (!lv.freq || lv.freq.length !== a.frequencyBinCount) lv.freq = new Float32Array(a.frequencyBinCount)
    if (!lv.time || lv.time.length !== a.fftSize) lv.time = new Float32Array(a.fftSize)
    a.getFloatFrequencyData(lv.freq)
    a.getFloatTimeDomainData(lv.time)
    const binHz = g.ctx.sampleRate / a.fftSize
    const raw = lv.raw
    raw.bassDb = bandDb(lv.freq, binHz, BANDS.bass.lo, BANDS.bass.hi)
    raw.midDb = bandDb(lv.freq, binHz, BANDS.mid.lo, BANDS.mid.hi)
    raw.trebleDb = bandDb(lv.freq, binHz, BANDS.treble.lo, BANDS.treble.hi)
    let sum = 0
    for (let i = 0; i < lv.time.length; i++) sum += lv.time[i] * lv.time[i]
    raw.rmsDb = 10 * Math.log10(sum / lv.time.length)
    const off = levelsTrimDb()
    rb = mapDb(raw.bassDb + off, BANDS.bass.floor, BANDS.bass.ceil, BANDS.bass.curve)
    rm = mapDb(raw.midDb + off, BANDS.mid.floor, BANDS.mid.ceil, BANDS.mid.curve)
    rt = mapDb(raw.trebleDb + off, BANDS.treble.floor, BANDS.treble.ceil, BANDS.treble.curve)
    re = mapDb(raw.rmsDb + off, ENERGY.floor, ENERGY.ceil, ENERGY.curve)
    if (!Number.isFinite(rb)) rb = 0
    if (!Number.isFinite(rm)) rm = 0
    if (!Number.isFinite(rt)) rt = 0
    if (!Number.isFinite(re)) re = 0
  }

  // Beat: positive bass flux above an adaptive threshold (mean + k·σ), 200ms refractory.
  const flux = Math.max(0, rb - lv.prevBass)
  lv.prevBass = rb
  const thr = lv.fluxMean + 1.5 * Math.sqrt(lv.fluxVar) + 0.04
  lv.raw.flux = flux
  lv.raw.threshold = thr
  if (flux > thr && rb > 0.12 && now - lv.lastBeatAt > 200) lv.lastBeatAt = now
  const k = 1 - Math.exp(-dt / 0.9)
  const d = flux - lv.fluxMean
  lv.fluxMean += k * d
  lv.fluxVar = (1 - k) * (lv.fluxVar + k * d * d)

  lv.bass = follow(lv.bass, rb, dt, 0.02, 0.12)
  lv.mid = follow(lv.mid, rm, dt, 0.03, 0.16)
  lv.treble = follow(lv.treble, rt, dt, 0.02, 0.12)
  lv.energy = follow(lv.energy, re, dt, 0.04, 0.2)
  const x = (now - lv.lastBeatAt) / 250
  const beat = x < 1 ? (1 - x) * (1 - x) : 0

  let live: AudioLevels
  if (Math.max(lv.bass, lv.mid, lv.treble, lv.energy) < 0.002 && beat === 0) {
    lv.bass = lv.mid = lv.treble = lv.energy = 0
    live = ZERO_LEVELS
  } else {
    live = { bass: lv.bass, mid: lv.mid, treble: lv.treble, energy: lv.energy, beat }
  }
  lv.levels = delayForOutput(g, now, live, gap)
  return lv.levels
}

/* ------------------------------------------------------------------ unlock / audio session */

/** unlock() ran at least once: the audio session belongs to the game from now on. */
let sessionClaimed = false

// iOS < 17 fallback: a looping silent <audio> element switches the page's audio session
// to "playback", so Web Audio ignores the silent switch (what audioSession.type does on 17+).
let keepAlive: HTMLAudioElement | null = null
let keepAliveUrl: string | null = null
let keepAliveOn = false

function silentWavUrl(): string {
  const rate = 8000
  const n = rate / 2
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, n * 2, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

function playKeepAlive(): void {
  const el = keepAlive
  if (!el || !el.paused) return
  try {
    const p = el.play() as Promise<void> | undefined
    if (p && typeof p.catch === 'function') p.catch(noop)
  } catch {
    // not allowed outside a gesture: retried on the next one
  }
}

/** Must run synchronously inside the gesture. */
function claimLegacySession(): void {
  if (!legacyIos() || typeof document === 'undefined') return
  try {
    if (!keepAlive) {
      const el = document.createElement('audio')
      el.setAttribute('x-webkit-airplay', 'deny')
      el.setAttribute('playsinline', '')
      ;(el as HTMLAudioElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true
      el.controls = false
      el.loop = true
      el.preload = 'auto'
      keepAliveUrl = silentWavUrl()
      el.src = keepAliveUrl
      keepAlive = el
    }
    keepAliveOn = true
    if (!pageHidden()) playKeepAlive()
  } catch {
    // best effort
  }
}

const sessionPending = () => !sessionClaimed || (keepAliveOn && !!keepAlive && keepAlive.paused && !pageHidden())

/** Resume the context (+ the classic silent-buffer kick), without touching the audio session. */
function wake(): Promise<void> {
  // Everything up to ctx.resume() must run synchronously inside the gesture.
  const g = ensureGraph()
  if (!g) return Promise.resolve()
  const { ctx } = g
  if (ctx.state === 'running' && everRunning) return Promise.resolve()
  try {
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.start(0)
  } catch {
    // ignore: resume() below is what matters on modern browsers
  }
  return ctx.resume().then(
    () => {
      if (ctx.state === 'running') everRunning = true
      emitSettings()
    },
    () => undefined,
  )
}

function unlock(): Promise<void> {
  // Claim the session first, so the context starts with the right category (iOS).
  setAudioSession()
  claimLegacySession()
  sessionClaimed = true
  return wake()
}

let softHolds = 0

/**
 * While held (the Home screen holds it), stray taps don't claim the audio session:
 * on iOS other apps' music keeps playing until a CTA ("Crea stanza" / "Entra") calls
 * `unlock()`; elsewhere a tap just wakes the context for UI sounds. Returns the release.
 */
export function holdSoftUnlock(): () => void {
  softHolds++
  let held = true
  return () => {
    if (!held) return
    held = false
    softHolds = Math.max(0, softHolds - 1)
  }
}

/* ------------------------------------------------------------------ public API */

export const audioEngine: AudioEngine = {
  unlock,
  get unlocked() {
    return !!graph && graph.ctx.state === 'running'
  },
  load(key, url, refresh) {
    const cached = buffers.get(key)
    if (cached) return Promise.resolve(cached)
    const pending = inflight.get(key)
    if (pending) return pending
    const p = loadWithRetry(key, url, refresh)
    inflight.set(key, p)
    p.then(
      (buf) => {
        if (inflight.get(key) === p) {
          inflight.delete(key)
          buffers.set(key, buf)
        }
      },
      () => {
        if (inflight.get(key) === p) inflight.delete(key)
      },
    )
    return p
  },
  get: (key) => buffers.get(key),
  has: (key) => buffers.has(key),
  playSequence(key, getSegmentAt, opts) {
    begin('sequence', key, getSegmentAt, {
      tag: opts?.tag,
      fixedIndex: null,
      fromPosition: Math.max(0, Math.floor(opts?.fromPosition ?? 0)),
      firstFadeS: JOIN_FADE_S,
      onPosition: opts?.onPosition,
      onEnded: opts?.onEnded,
    })
  },
  playSegment(key, range, opts) {
    const r = { start: range.start, end: range.end }
    begin('segment', key, (p) => (p === 0 ? r : null), {
      tag: opts?.tag,
      fixedIndex: opts?.index ?? 0,
      fromPosition: 0,
      firstFadeS: JOIN_FADE_S,
      onEnded: opts?.onEnded,
    })
  },
  playFull(key, opts) {
    const buf = buffers.get(key)
    const r = { start: Math.max(0, opts?.from ?? 0), end: Math.min(buf?.duration ?? Infinity, opts?.to ?? buf?.duration ?? 0) }
    begin('full', key, (p) => (p === 0 ? r : null), {
      tag: opts?.tag,
      fixedIndex: 0,
      fromPosition: 0,
      firstFadeS: Math.max(JOIN_FADE_S, (opts?.fadeInMs ?? 0) / 1000),
      onEnded: opts?.onEnded,
    })
  },
  stop(fadeMs = 60) {
    const s = current
    if (!s) return
    halt(s, fadeMs / 1000)
    setState(IDLE)
  },
  getState: () => state,
  getPosition() {
    const s = current
    const g = graph
    if (!s || !g) return null
    const now = performance.now()
    const stamp = frameStamp()
    const c = positionCache
    if (c && c.session === s && c.stamp === stamp && now - c.at < 12) return c.value
    let index = reportIndex(s, s.nextPosition)
    let progress = 0
    let elapsed = 0
    if (s.started && s.items.length) {
      const t = audibleTime(g.ctx)
      const it = audibleItem(s, t) ?? s.items[0]
      index = reportIndex(s, it.info.position)
      progress = clamp01((t - it.info.when) / (it.info.end - it.info.when))
      elapsed = Math.max(0, t - s.startTime)
    }
    const value: PlaybackPosition = { mode: s.mode, key: s.key, tag: s.tag, index, progress, elapsed }
    positionCache = { session: s, stamp, at: now, value }
    return value
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  setVolume(v) {
    const nv = Number.isFinite(v) ? clamp01(v) : volume
    volume = nv
    writeStored(VOLUME_KEY, String(Math.round(nv * 1000) / 1000))
    const g = graph
    if (g) {
      const t = g.ctx.currentTime
      for (const p of [g.master.gain, g.sfxVolume.gain]) {
        const value = p.value
        p.cancelScheduledValues(t)
        p.setValueAtTime(value, t)
        p.linearRampToValueAtTime(volumeGain(nv), t + VOLUME_RAMP_S)
      }
    }
    emitSettings()
  },
  get volume() {
    return volume
  },
  getLevels: computeLevels,
}

/* ------------------------------------------------------------------ extras (beyond the AudioEngine contract) */

/** Drop a decoded buffer (and any in-flight load) to free memory, e.g. for finished rounds. */
export function evictAudio(key: string): void {
  buffers.delete(key)
  inflight.delete(key)
}

/** The shared AudioContext, or null before anything created it. */
export function getAudioContext(): AudioContext | null {
  return graph?.ctx ?? null
}

/** SFX routing (used by sfx.ts): the running context + SFX bus input, or null while locked. Never creates the context. */
export function getSfxOutput(): { ctx: AudioContext; input: AudioNode } | null {
  const g = graph
  if (!g || g.ctx.state !== 'running') return null
  return { ctx: g.ctx, input: g.sfxIn }
}

let duckUntil = 0
let duckDepthDb = 0

/**
 * Briefly lower the music (sidechain-style) so an important SFX cuts through.
 * No-op when nothing plays. Overlapping calls merge: the deepest dip and the latest
 * release win, so a light duck never pops a deeper one back up.
 */
export function duckMusic(depthDb = 3, holdS = 0.15): void {
  const g = graph
  if (!g || !current || g.ctx.state !== 'running') return
  const p = g.duck.gain
  const t = g.ctx.currentTime
  let depth = Math.max(0, Number.isFinite(depthDb) ? depthDb : 0)
  let until = t + Math.max(0.02, Number.isFinite(holdS) ? holdS : 0.15)
  if (t < duckUntil) {
    depth = Math.max(depth, duckDepthDb)
    until = Math.max(until, duckUntil)
  }
  if (depth <= 0) return
  duckDepthDb = depth
  duckUntil = until
  const value = p.value
  p.cancelScheduledValues(t)
  p.setValueAtTime(value, t)
  p.setTargetAtTime(Math.pow(10, -depth / 20), t, 0.012)
  p.setTargetAtTime(1, until, 0.12)
}

/** Fires when `unlocked` or `volume` may have changed (for React hooks). */
export function subscribeAudioSettings(listener: () => void): () => void {
  settingsListeners.add(listener)
  return () => {
    settingsListeners.delete(listener)
  }
}

/** Diagnostics for labs/tests. */
export const engineDebug = {
  /** Every snippet scheduled by the current (or last) playback, in order (re-planned ones replaced). */
  schedule: (): ScheduledItemInfo[] => lastLog.map((i) => ({ ...i, range: { ...i.range } })),
  /** Context time currently audible (latency-compensated), or null without a context. */
  audibleTime: (): number | null => (graph ? audibleTime(graph.ctx) : null),
  /** Raw analysis behind the last getLevels() (band dB, RMS dBFS, bass flux and beat threshold), before the normalisation offset. */
  levelsRaw: () => ({ ...lv.raw }),
  /** Output latency the levels are delayed by (s). */
  levelsDelay: (): number => Math.max(0, lv.delayS),
  /** The music bus (normalised, pre-volume, pass-through analyser) for recording taps in tests. */
  musicTap: (): AudioNode | null => graph?.analyser ?? null,
  /** Measured loudness and trim of a loaded track. */
  loudness: (key: string): LoudnessInfo | null => {
    const b = buffers.get(key)
    return (b && loudness.get(b)) ?? null
  },
  /** Linear trim the next playback of `key` gets (1 when normalisation is off or unmeasured). */
  trimOf: (key: string): number => {
    const b = buffers.get(key)
    return b ? trimOf(b) : 1
  },
  /** A/B switch for labs: loudness normalisation on (default) / off, from the next playback. */
  setNormalization(on: boolean): void {
    normalizeOn = !!on
  },
  /** Whether the Home screen's soft-unlock hold is active. */
  softUnlockHeld: (): boolean => softHolds > 0,
  /** iOS < 17 keep-alive element state. */
  legacySession: () => ({ applies: legacyIos(), created: !!keepAlive, playing: !!keepAlive && !keepAlive.paused }),
}

/* ------------------------------------------------------------------ gesture unlock + warm-up */

const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchend', 'click'] as const

const contextAsleep = () => !graph || graph.ctx.state !== 'running' || !everRunning

function onGesture(): void {
  if (softHolds > 0) {
    // Home: taps before a CTA never claim the session. On iOS even resuming the context would
    // start an audio session, so there UI sounds wait for the CTA; elsewhere they can play.
    if (!isAppleMobile() && contextAsleep()) void wake()
    return
  }
  if (contextAsleep() || sessionPending()) void unlock()
}

function onVisibility(): void {
  const hidden = pageHidden()
  if (keepAlive && keepAliveOn) {
    if (hidden) keepAlive.pause()
    else playKeepAlive()
  }
  // iOS suspends/interrupts the context in the background; try to come back.
  const g = graph
  if (g && everRunning && !hidden && g.ctx.state !== 'running' && g.ctx.state !== 'closed') void g.ctx.resume().catch(noop)
}

/**
 * The first `new AudioContext()` of a browser session blocks the main thread while the
 * audio device starts (~175 ms measured, even on a fast machine). On Chromium it is created
 * (suspended, silently) at idle after boot, so the first tap only has to resume it. Not on
 * iOS (created inside the gesture there, the path verified on WebKit) nor Firefox (which
 * flags blocked autoplay in the address bar).
 */
function prewarm(): void {
  if (typeof window === 'undefined' || !isChromium() || isAppleMobile()) return
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  const run = () => {
    if (graph) return
    if (pageHidden()) {
      // Prerendered / background tab: wait until it is shown.
      document.addEventListener('visibilitychange', () => later(400), { once: true })
      return
    }
    ensureGraph()
  }
  // After the boot animations (the constructor blocks the main thread), before a typical first tap.
  const later = (ms: number) =>
    setTimeout(() => (typeof w.requestIdleCallback === 'function' ? w.requestIdleCallback(run, { timeout: 1500 }) : run()), ms)
  // Never before the first contentful paint (a fast build can fire `load` and go idle
  // before it), and never before `load`.
  afterFirstContentfulPaint(() => {
    if (document.readyState === 'complete') later(900)
    else window.addEventListener('load', () => later(900), { once: true })
  })
}

/** Runs `fn` once the first contentful paint is reported (3 s cap; right away without paint timing). */
function afterFirstContentfulPaint(fn: () => void): void {
  let done = false
  const go = () => {
    if (done) return
    done = true
    fn()
  }
  try {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('paint')) {
      const observer = new PerformanceObserver((list) => {
        if (!list.getEntries().some((e) => e.name === 'first-contentful-paint')) return
        observer.disconnect()
        go()
      })
      observer.observe({ type: 'paint', buffered: true })
      setTimeout(() => {
        observer.disconnect()
        go()
      }, 3000)
      return
    }
  } catch {
    // no paint timing
  }
  go()
}

if (typeof window !== 'undefined') {
  for (const type of GESTURE_EVENTS) window.addEventListener(type, onGesture, { capture: true, passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  prewarm()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (current) halt(current, 0.01)
    for (const type of GESTURE_EVENTS) window.removeEventListener(type, onGesture, { capture: true })
    document.removeEventListener('visibilitychange', onVisibility)
    if (keepAlive) {
      keepAlive.pause()
      keepAlive.removeAttribute('src')
      keepAlive = null
    }
    if (keepAliveUrl) URL.revokeObjectURL(keepAliveUrl)
    keepAliveUrl = null
    const g = graph
    graph = null
    if (g) void g.ctx.close().catch(noop)
  })
}
