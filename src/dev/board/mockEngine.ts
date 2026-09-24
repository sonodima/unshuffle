// Lab-only AudioEngine: a small but faithful Web Audio implementation of the
// engine contract (lookahead scheduler, just-in-time getSegmentAt, seamless
// contiguous joins) so the board can be exercised before the real engine lands.
import type {
  AudioEngine,
  AudioLevels,
  PlaybackMode,
  PlaybackPosition,
  PlaybackState,
  SequenceOptions,
  TimeRange,
} from '../../audio/engine'

interface Item {
  pos: number
  t0: number
  t1: number
  range: TimeRange
  src: AudioBufferSourceNode
  gain: GainNode
}

interface Run {
  mode: PlaybackMode
  key: string
  tag: string | null
  index: number
  startedAt: number
  items: Item[]
  nextPos: number
  nextTime: number
  exhausted: boolean
  getSegmentAt: ((p: number) => TimeRange | null) | null
  onPosition?: (p: number) => void
  onEnded?: () => void
  timer: ReturnType<typeof setInterval> | null
}

const IDLE: PlaybackState = { playing: false, mode: null, key: null, tag: null, index: 0 }
const FADE = 0.004
const LOOKAHEAD = 0.2

export interface MockEngine extends AudioEngine {
  /** Register an already-decoded buffer (synthetic audio). */
  inject(key: string, buffer: AudioBuffer): void
  context(): AudioContext
}

export function createMockEngine(): MockEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let vol = 0.9
  let unlocked = false
  const buffers = new Map<string, AudioBuffer>()
  const loading = new Map<string, Promise<AudioBuffer>>()
  const listeners = new Set<(s: PlaybackState) => void>()
  let state: PlaybackState = IDLE
  let run: Run | null = null

  function ensure(): { c: AudioContext; out: GainNode } {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = vol
      master.connect(ctx.destination)
    }
    return { c: ctx, out: master as GainNode }
  }

  function setState(s: PlaybackState) {
    if (
      s.playing === state.playing &&
      s.mode === state.mode &&
      s.key === state.key &&
      s.tag === state.tag &&
      s.index === state.index
    )
      return
    state = s
    listeners.forEach((l) => l(state))
  }

  function schedule(r: Run, range: TimeRange, pos: number, at: number, fadeIn: boolean): Item {
    const { c, out } = ensure()
    const buf = buffers.get(r.key) as AudioBuffer
    const dur = Math.max(0.01, range.end - range.start)
    const src = c.createBufferSource()
    src.buffer = buf
    const gain = c.createGain()
    src.connect(gain).connect(out)
    if (fadeIn) {
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(1, at + FADE)
    } else gain.gain.setValueAtTime(1, at)
    src.start(at, range.start, dur)
    const item = { pos, t0: at, t1: at + dur, range, src, gain }
    r.items.push(item)
    return item
  }

  function fadeOutAt(item: Item) {
    item.gain.gain.setValueAtTime(1, item.t1 - FADE)
    item.gain.gain.linearRampToValueAtTime(0, item.t1)
  }

  function tick() {
    const r = run
    if (!r || !ctx) return
    const now = ctx.currentTime
    while (r.getSegmentAt && !r.exhausted && r.nextTime < now + LOOKAHEAD) {
      const range = r.getSegmentAt(r.nextPos)
      const prev = r.items[r.items.length - 1]
      if (!range) {
        r.exhausted = true
        if (prev) fadeOutAt(prev)
        break
      }
      const contiguous = !!prev && Math.abs(prev.range.end - range.start) < 1e-4
      if (prev && !contiguous) fadeOutAt(prev)
      schedule(r, range, r.nextPos, r.nextTime, !contiguous)
      r.nextTime += range.end - range.start
      r.nextPos++
    }
    const cur = r.items.find((it) => now >= it.t0 && now < it.t1)
    if (cur && r.mode === 'sequence' && cur.pos !== r.index) {
      r.index = cur.pos
      setState({ playing: true, mode: r.mode, key: r.key, tag: r.tag, index: r.index })
      r.onPosition?.(r.index)
    }
    const last = r.items[r.items.length - 1]
    if ((r.exhausted || !r.getSegmentAt) && (!last || now >= last.t1)) {
      finish(r)
    }
    // Drop finished items (keep the last for contiguity checks).
    while (r.items.length > 2 && r.items[0].t1 < now - 0.5) r.items.shift()
  }

  function finish(r: Run) {
    if (r.timer) clearInterval(r.timer)
    if (run === r) {
      run = null
      setState(IDLE)
    }
    r.onEnded?.()
  }

  function halt(fadeMs: number) {
    const r = run
    if (!r) return
    run = null
    if (r.timer) clearInterval(r.timer)
    const now = ctx ? ctx.currentTime : 0
    const f = Math.max(0.005, fadeMs / 1000)
    for (const it of r.items) {
      try {
        it.gain.gain.cancelScheduledValues(now)
        it.gain.gain.setValueAtTime(it.gain.gain.value, now)
        it.gain.gain.linearRampToValueAtTime(0, now + f)
        it.src.stop(now + f + 0.01)
      } catch {
        // already stopped
      }
    }
  }

  function startRun(r: Run) {
    run = r
    r.timer = setInterval(tick, 25)
    tick()
    setState({ playing: true, mode: r.mode, key: r.key, tag: r.tag, index: r.index })
  }

  const engine: MockEngine = {
    async unlock() {
      const { c } = ensure()
      if (c.state !== 'running') await c.resume()
      unlocked = true
    },
    get unlocked() {
      return unlocked
    },
    load(key, url) {
      const have = buffers.get(key)
      if (have) return Promise.resolve(have)
      const pending = loading.get(key)
      if (pending) return pending
      const p = (async () => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.arrayBuffer()
        const buf = await ensure().c.decodeAudioData(data)
        buffers.set(key, buf)
        return buf
      })()
      loading.set(key, p)
      p.finally(() => loading.delete(key)).catch(() => {})
      return p
    },
    get: (key) => buffers.get(key),
    has: (key) => buffers.has(key),
    playSequence(key, getSegmentAt, opts: SequenceOptions = {}) {
      halt(15)
      if (!buffers.has(key)) return
      const { c } = ensure()
      const at = c.currentTime + 0.05
      const from = opts.fromPosition ?? 0
      startRun({
        mode: 'sequence',
        key,
        tag: opts.tag ?? null,
        index: from,
        startedAt: at,
        items: [],
        nextPos: from,
        nextTime: at,
        exhausted: false,
        getSegmentAt,
        onPosition: opts.onPosition,
        onEnded: opts.onEnded,
        timer: null,
      })
    },
    playSegment(key, range, opts = {}) {
      halt(15)
      if (!buffers.has(key)) return
      const { c } = ensure()
      const at = c.currentTime + 0.03
      const r: Run = {
        mode: 'segment',
        key,
        tag: opts.tag ?? null,
        index: opts.index ?? 0,
        startedAt: at,
        items: [],
        nextPos: 0,
        nextTime: at,
        exhausted: true,
        getSegmentAt: null,
        onEnded: opts.onEnded,
        timer: null,
      }
      fadeOutAt(schedule(r, range, 0, at, true))
      startRun(r)
    },
    playFull(key, opts = {}) {
      halt(15)
      const buf = buffers.get(key)
      if (!buf) return
      const { c } = ensure()
      const at = c.currentTime + 0.03
      const r: Run = {
        mode: 'full',
        key,
        tag: opts.tag ?? null,
        index: 0,
        startedAt: at,
        items: [],
        nextPos: 0,
        nextTime: at,
        exhausted: true,
        getSegmentAt: null,
        onEnded: opts.onEnded,
        timer: null,
      }
      fadeOutAt(schedule(r, { start: opts.from ?? 0, end: opts.to ?? buf.duration }, 0, at, true))
      startRun(r)
    },
    stop(fadeMs = 60) {
      halt(fadeMs)
      setState(IDLE)
    },
    getState: () => state,
    getPosition(): PlaybackPosition | null {
      const r = run
      if (!r || !ctx) return null
      const now = ctx.currentTime
      const cur = r.items.find((it) => now >= it.t0 && now < it.t1) ?? r.items[0]
      if (!cur) return null
      const progress = Math.min(1, Math.max(0, (now - cur.t0) / (cur.t1 - cur.t0)))
      return {
        mode: r.mode,
        key: r.key,
        tag: r.tag,
        index: r.mode === 'sequence' ? cur.pos : r.index,
        progress,
        elapsed: Math.max(0, now - r.startedAt),
      }
    },
    subscribe(l) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    setVolume(v) {
      vol = Math.min(1, Math.max(0, v))
      if (master) master.gain.value = vol
    },
    get volume() {
      return vol
    },
    getLevels(): AudioLevels {
      return { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 }
    },
    inject(key, buffer) {
      buffers.set(key, buffer)
    },
    context: () => ensure().c,
  }
  return engine
}

/** 30s synthetic "song": a 120 BPM beat with a melody that changes every 2 bars. */
export function synthSong(c: BaseAudioContext, seconds = 30): AudioBuffer {
  const sr = c.sampleRate
  const buf = c.createBuffer(1, Math.floor(seconds * sr), sr)
  const d = buf.getChannelData(0)
  const beat = 0.5
  const notes = [220, 247, 262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784, 880, 988]
  for (let i = 0; i < d.length; i++) {
    const t = i / sr
    const bt = t % beat
    const kick = Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-bt * 30)) * bt) * Math.exp(-bt * 9)
    const section = Math.floor(t / 4) % notes.length
    const f = notes[section]
    const env = 0.45 + 0.35 * Math.sin((2 * Math.PI * t) / 4)
    const tone = Math.sin(2 * Math.PI * f * t) * 0.25 * env * (1 - Math.exp(-bt * 40))
    const swell = Math.min(1, t / 1.5) * Math.min(1, (seconds - t) / 1.5)
    d[i] = (kick * 0.7 + tone) * swell * (0.5 + 0.5 * ((section % 5) / 4))
  }
  return buf
}
