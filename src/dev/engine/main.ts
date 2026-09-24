// Audio engine lab: manual playground + automated in-page assertions
// (window.__engineLab.runTests()), driven headless by scripts/engine/run-lab.mjs.
import { AudioLoadError, audioEngine, engineDebug, getAudioContext, getSfxOutput, evictAudio } from '../../audio/engine'
import type { AudioLevels, PlaybackPosition, PlaybackState, ScheduledItemInfo, TimeRange } from '../../audio/engine'
import { SFX_NAMES, renderSfx, sfx, sfxDebug } from '../../audio/sfx'
import type { SfxName } from '../../audio/sfx'
import { createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { usePlayback, useAudioUnlocked, useVolume } from '../../audio/usePlayback'
import { trackPreview } from './jsonp'

const bootLevels = audioEngine.getLevels()
const bootHadContext = getAudioContext() !== null

const TRACKS = [
  { id: 3135556, label: 'Daft Punk — Harder, Better, Faster, Stronger' },
  { id: 8086136, label: 'Adele — Someone Like You' },
  { id: 13791930, label: 'Nirvana — Smells Like Teen Spirit' },
  { id: 1109731, label: 'Eminem — Lose Yourself' },
  { id: 418521572, label: 'Vasco Rossi — Albachiara' },
]

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const ctxNow = () => getAudioContext()?.currentTime ?? 0
const r2 = (x: number) => Math.round(x * 100) / 100
const toMs = (s: number) => r2(s * 1000)

function equalSegments(from: number, to: number, n: number): TimeRange[] {
  const len = (to - from) / n
  return Array.from({ length: n }, (_, i) => ({ start: from + i * len, end: i === n - 1 ? to : from + (i + 1) * len }))
}

/* ------------------------------------------------------------------ recording */

interface Sample {
  perf: number
  ct: number
  pos: PlaybackPosition | null
  lv: AudioLevels
}

function recorder() {
  const samples: Sample[] = []
  let on = true
  const loop = () => {
    if (!on) return
    samples.push({ perf: performance.now(), ct: ctxNow(), pos: audioEngine.getPosition(), lv: audioEngine.getLevels() })
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  return {
    samples,
    stop() {
      on = false
    },
  }
}

interface PosEvent {
  pos: number
  ct: number
  audible: number
}

interface SeqRun {
  events: PosEvent[]
  states: PlaybackState[]
  ended: { ct: number; audible: number } | null
  samples: Sample[]
  schedule: ScheduledItemInfo[]
  latency: number
}

async function playSeq(key: string, segs: TimeRange[], order: number[], onPos?: (p: number) => void, timeoutMs = 60000): Promise<SeqRun> {
  const events: PosEvent[] = []
  const states: PlaybackState[] = []
  const end: { v: { ct: number; audible: number } | null } = { v: null }
  const unsub = audioEngine.subscribe((s) => states.push(s))
  const rec = recorder()
  const done = new Promise<void>((resolve) => {
    audioEngine.playSequence(key, (p) => (p < order.length ? segs[order[p]] : null), {
      tag: 'lab',
      onPosition: (p) => {
        events.push({ pos: p, ct: ctxNow(), audible: engineDebug.audibleTime() ?? 0 })
        onPos?.(p)
      },
      onEnded: () => {
        end.v = { ct: ctxNow(), audible: engineDebug.audibleTime() ?? 0 }
        resolve()
      },
    })
  })
  await Promise.race([done, wait(timeoutMs)])
  rec.stop()
  unsub()
  const ctx = getAudioContext()!
  return { events, states, ended: end.v, samples: rec.samples, schedule: engineDebug.schedule(), latency: ctxNow() - (engineDebug.audibleTime() ?? ctx.currentTime) }
}

function timingRows(run: SeqRun) {
  return run.events.map((e) => {
    const it = run.schedule.find((i) => i.position === e.pos)
    return { pos: e.pos, vsCurrentTimeMs: it ? toMs(e.ct - it.when) : NaN, vsAudibleMs: it ? toMs(e.audible - it.when) : NaN }
  })
}

function progressViolations(samples: Sample[]) {
  let v = 0
  let prev: PlaybackPosition | null = null
  let count = 0
  for (const s of samples) {
    const p = s.pos
    if (!p) continue
    count++
    if (prev) {
      if (p.index === prev.index && p.progress < prev.progress - 1e-9) v++
      if (p.elapsed < prev.elapsed - 1e-9) v++
      if (p.progress < 0 || p.progress > 1) v++
    }
    prev = p
  }
  return { violations: v, samples: count }
}

function levelStats(samples: Sample[]) {
  const on = samples.filter((s) => s.pos)
  const max = { bass: 0, mid: 0, treble: 0, energy: 0 }
  const mean = { bass: 0, mid: 0, treble: 0, energy: 0 }
  let beats = 0
  let prevBeat = 0
  for (const s of on) {
    for (const k of ['bass', 'mid', 'treble', 'energy'] as const) {
      max[k] = Math.max(max[k], s.lv[k])
      mean[k] += s.lv[k] / Math.max(1, on.length)
    }
    if (s.lv.beat > 0.8 && prevBeat <= 0.8) beats++
    prevBeat = s.lv.beat
  }
  const dur = on.length > 1 ? (on[on.length - 1].perf - on[0].perf) / 1000 : 0
  const fix = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, r2(x)]))
  return { max: fix(max), mean: fix(mean), beats, beatsPerSec: dur ? r2(beats / dur) : 0, seconds: r2(dur) }
}

/* ------------------------------------------------------------------ tests */

interface TestResult {
  name: string
  pass: boolean
  failures: string[]
  details: Record<string, unknown>
}

async function runTest(name: string, fn: (check: (ok: boolean, msg: string) => void, details: Record<string, unknown>) => Promise<void>): Promise<TestResult> {
  const failures: string[] = []
  const details: Record<string, unknown> = {}
  const check = (ok: boolean, msg: string) => {
    if (!ok) failures.push(msg)
  }
  log(`▶ ${name}`)
  try {
    await fn(check, details)
  } catch (err) {
    failures.push(`threw: ${err instanceof Error ? err.message : String(err)}`)
  }
  audioEngine.stop(10)
  await wait(150)
  const res = { name, pass: failures.length === 0, failures, details }
  log(`${res.pass ? '✔' : '✘'} ${name}${res.pass ? '' : ' — ' + failures.join(' | ')}`)
  return res
}

function sameRange(a: TimeRange, b: TimeRange) {
  return Math.abs(a.start - b.start) < 1e-9 && Math.abs(a.end - b.end) < 1e-9
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const ar = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi
        const ai = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr
        re[i + k + len / 2] = re[i + k] - ar
        im[i + k + len / 2] = im[i + k] - ai
        re[i + k] += ar
        im[i + k] += ai
      }
    }
  }
}

/** Peak / RMS / audible length / spectral centroid / share of energy above 4 kHz. */
function spectrum(buf: AudioBuffer) {
  const d = buf.getChannelData(0)
  let peak = 0
  let first = -1
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i])
    if (a > peak) peak = a
    if (a > 0.001) {
      last = i
      if (first < 0) first = i
    }
  }
  first = Math.max(0, first)
  let sum = 0
  for (let i = first; i <= last; i++) sum += d[i] * d[i]
  const N = 4096
  const P = new Float64Array(N / 2)
  for (let s0 = first; s0 < last; s0 += N / 2) {
    const re = new Float64Array(N)
    const im = new Float64Array(N)
    for (let n = 0; n < N; n++) re[n] = (d[s0 + n] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N))
    fft(re, im)
    for (let k = 1; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k]
  }
  let wSum = 0
  let pSum = 0
  let hi = 0
  for (let k = 1; k < N / 2; k++) {
    const f = (k * buf.sampleRate) / N
    wSum += P[k] * f
    pSum += P[k]
    if (f > 4000) hi += P[k]
  }
  return {
    peakDb: r2(20 * Math.log10(peak || 1e-9)),
    rmsDb: r2(10 * Math.log10(sum / Math.max(1, last - first) || 1e-12)),
    durMs: Math.round(((last - first) / buf.sampleRate) * 1000),
    centroidHz: pSum ? Math.round(wSum / pSum) : 0,
    above4kPct: pSum ? r2((hi / pSum) * 100) : 0,
  }
}

async function runTests(opts: { long?: boolean; trackId?: number } = {}) {
  // The sample-exact output checks compare against the untouched original: loudness
  // normalisation (trim × original) would fail them by design.
  engineDebug.setNormalization(false)
  const results: TestResult[] = []
  const trackId = opts.trackId ?? TRACKS[0].id
  const key = `track:${trackId}`
  let buffer: AudioBuffer | null = null
  let url = ''

  results.push(
    await runTest('levels are zero before the AudioContext exists', async (check, d) => {
      d.bootHadContext = bootHadContext
      d.bootLevels = bootLevels
      check(!bootHadContext, 'context existed at boot')
      check(Object.values(bootLevels).every((x) => x === 0), 'boot levels not zero')
    }),
  )

  await audioEngine.unlock()

  results.push(
    await runTest('load: real Deezer preview, dedupe, cache', async (check, d) => {
      const meta = await trackPreview(trackId)
      url = meta.url
      let refreshes = 0
      const refresh = async () => {
        refreshes++
        return (await trackPreview(trackId)).url
      }
      const t0 = performance.now()
      const p1 = audioEngine.load(key, url, refresh)
      const p2 = audioEngine.load(key, url, refresh)
      check(p1 === p2, 'concurrent loads did not share one promise')
      buffer = await p1
      d.loadMs = Math.round(performance.now() - t0)
      d.track = `${meta.artist} — ${meta.title}`
      d.duration = r2(buffer.duration)
      d.sampleRate = buffer.sampleRate
      d.ctxSampleRate = getAudioContext()?.sampleRate
      d.channels = buffer.numberOfChannels
      check(audioEngine.has(key) && audioEngine.get(key) === buffer, 'not cached')
      check((await audioEngine.load(key, 'https://invalid.example/x.mp3')) === buffer, 'cached load returned a different buffer')
      check(refreshes === 0, 'refresh called on a good url')
      check(buffer.duration > 25, 'preview too short')
    }),
  )
  if (!buffer) return finalize(results)
  const buf: AudioBuffer = buffer
  const segs = equalSegments(2, 10, 8)

  let t1: SeqRun | null = null
  results.push(
    await runTest('playSequence: correct order is sample-contiguous, positions 0..7 on time', async (check, d) => {
      const run = await playSeq(key, segs, [0, 1, 2, 3, 4, 5, 6, 7])
      t1 = run
      const rows = timingRows(run)
      d.outputLatencyMs = toMs(run.latency)
      d.onPosition = rows
      d.positions = run.events.map((e) => e.pos).join(',')
      check(d.positions === '0,1,2,3,4,5,6,7', `positions fired ${d.positions}`)
      const worstCt = Math.max(...rows.map((r) => Math.abs(r.vsCurrentTimeMs)))
      const worstAudible = Math.max(...rows.map((r) => Math.abs(r.vsAudibleMs)))
      d.worstVsCurrentTimeMs = worstCt
      d.worstVsAudibleMs = worstAudible
      check(worstCt <= 30 + (d.outputLatencyMs as number), `onPosition off by ${worstCt}ms vs ctx.currentTime (latency ${d.outputLatencyMs}ms)`)
      check(worstAudible <= 30, `onPosition off by ${worstAudible}ms vs audible time`)
      check(run.ended !== null, 'onEnded not fired')
      const last = run.schedule[run.schedule.length - 1]
      if (run.ended) {
        d.onEndedVsCurrentTimeMs = toMs(run.ended.ct - last.end)
        d.onEndedVsAudibleMs = toMs(run.ended.audible - last.end)
        check(Math.abs(run.ended.audible - last.end) <= 0.03, 'onEnded late/early')
      }
      const s = run.schedule
      let contiguous = true
      let maxGap = 0
      for (let i = 1; i < s.length; i++) {
        if (s[i].whenFrame !== s[i - 1].whenFrame + s[i - 1].frames) contiguous = false
        if (s[i].startSample !== s[i - 1].endSample) contiguous = false
        if (s[i].join !== 'gapless' || s[i - 1].outro !== 'gapless') contiguous = false
        maxGap = Math.max(maxGap, Math.abs(s[i].when - s[i - 1].end))
      }
      d.scheduledItems = s.length
      d.frames = s.map((i) => i.frames).join(',')
      d.whenFrames = s.map((i) => i.whenFrame).join(',')
      d.maxStartGapSeconds = maxGap
      d.joins = s.map((i) => i.join).join(',')
      d.outros = s.map((i) => i.outro).join(',')
      check(s.length === 8, `scheduled ${s.length} items`)
      check(contiguous, 'correct order is not exactly contiguous')
      check(maxGap === 0, `start/end mismatch ${maxGap}s`)
      check(s[0].join === 'first' && last.outro === 'fade', 'first/last fades missing')
      const pv = progressViolations(run.samples)
      d.progress = pv
      check(pv.violations === 0 && pv.samples > 100, `progress not monotonic (${pv.violations} violations / ${pv.samples})`)
      const ls = levelStats(run.samples)
      d.levels = ls
      check(ls.max.bass > 0.2 && ls.max.mid > 0.2 && ls.max.treble > 0.1 && ls.max.energy > 0.2, 'levels too low while playing')
      check(ls.beats >= 4, `only ${ls.beats} beats detected`)
      d.stateEmissions = run.states.length
      d.stateIndexes = run.states.map((x) => (x.playing ? x.index : 'idle')).join(',')
      check(run.states.length === 9, `expected 9 state emissions (start + 7 changes + idle), got ${run.states.length}`)
      check(new Set(run.states).size === run.states.length, 'duplicate state objects emitted')
      check(audioEngine.getState() === audioEngine.getState() && !audioEngine.getState().playing, 'getState unstable or still playing')
    }),
  )

  results.push(
    await runTest('usePlayback: React re-renders only on discrete state changes', async (check, d) => {
      const host = document.createElement('div')
      document.body.appendChild(host)
      const seen: string[] = []
      let renders = 0
      let unlockedSeen = false
      let volumeSeen = -1
      function Probe() {
        const st = usePlayback()
        const unlocked = useAudioUnlocked()
        const [vol] = useVolume()
        renders++
        unlockedSeen = unlocked
        volumeSeen = vol
        useEffect(() => {
          seen.push(st.playing ? `${st.mode}:${st.index}` : 'idle')
        }, [st])
        return null
      }
      const root = createRoot(host)
      root.render(createElement(Probe))
      await wait(100)
      const r0 = renders
      await playSeq(key, segs, [0, 1, 2, 3, 4, 5, 6, 7])
      await wait(100)
      audioEngine.setVolume(0.6)
      await wait(50)
      d.rendersDuringPlayback = renders - r0
      d.statesSeen = seen.join(',')
      d.unlocked = unlockedSeen
      d.volumeSeen = volumeSeen
      check(seen.join(',') === 'idle,sequence:0,sequence:1,sequence:2,sequence:3,sequence:4,sequence:5,sequence:6,sequence:7,idle', `states ${seen}`)
      check(renders - r0 <= 10, `too many renders: ${renders - r0}`)
      check(unlockedSeen && volumeSeen === 0.6, 'unlocked/volume hooks')
      audioEngine.setVolume(0.9)
      root.unmount()
      host.remove()
    }),
  )

  results.push(
    await runTest('output: recorded correct-order playback equals the original audio sample-for-sample', async (check, d) => {
      const ctx = getAudioContext()!
      const tap = engineDebug.musicTap()!
      const sp = ctx.createScriptProcessor(4096, 1, 1)
      const chunks: Float32Array[] = []
      let firstPlaybackTime = -1
      sp.onaudioprocess = (e) => {
        if (firstPlaybackTime < 0) firstPlaybackTime = e.playbackTime
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }
      const mute = ctx.createGain()
      mute.gain.value = 0
      tap.connect(sp)
      sp.connect(mute)
      mute.connect(ctx.destination)
      await wait(300)
      const run = await playSeq(key, segs, [0, 1, 2, 3, 4, 5, 6, 7])
      await wait(400)
      tap.disconnect(sp)
      sp.disconnect()
      mute.disconnect()
      const rec = new Float32Array(chunks.reduce((a, c) => a + c.length, 0))
      let o = 0
      for (const c of chunks) {
        rec.set(c, o)
        o += c.length
      }
      // Stereo previews are recorded as the channel-0 downmix the processor receives: build the same reference.
      const L = buf.getChannelData(0)
      const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
      const ref = (i: number) => (L[i] + R[i]) / 2
      const s0 = run.schedule[0]
      const sr = ctx.sampleRate
      const base = Math.round(firstPlaybackTime * sr)
      // Find the recorder's constant latency by matching a 1024-sample template 50ms into the playback.
      const tStart = s0.whenFrame + Math.round(0.05 * sr)
      let bestLag = 0
      let bestErr = Infinity
      for (let lag = -6 * 4096; lag <= 6 * 4096; lag++) {
        let err = 0
        const at = tStart - base + lag
        if (at < 0 || at + 1024 > rec.length) continue
        for (let i = 0; i < 1024; i += 4) {
          const x = rec[at + i] - ref(s0.startSample + (tStart - s0.whenFrame) + i)
          err += x * x
          if (err > bestErr) break
        }
        if (err < bestErr) {
          bestErr = err
          bestLag = lag
        }
      }
      const fade = Math.round(0.004 * sr) + 2
      const last = run.schedule[run.schedule.length - 1]
      let maxErr = 0
      let maxJoinErr = 0
      let compared = 0
      for (let f = s0.whenFrame + fade; f < last.whenFrame + last.frames - fade; f++) {
        const at = f - base + bestLag
        if (at < 0 || at >= rec.length) continue
        const e = Math.abs(rec[at] - ref(s0.startSample + (f - s0.whenFrame)))
        compared++
        if (e > maxErr) maxErr = e
        if (run.schedule.some((it) => Math.abs(f - it.whenFrame) < 64)) maxJoinErr = Math.max(maxJoinErr, e)
      }
      d.recorderLagFrames = bestLag
      d.comparedSamples = compared
      d.maxAbsError = maxErr
      d.maxAbsErrorNearJoins = maxJoinErr
      d.maxAbsErrorDb = r2(20 * Math.log10(maxErr || 1e-12))
      check(compared > 7 * sr, `compared only ${compared} samples`)
      check(maxErr < 1e-4, `output deviates from the original by ${maxErr}`)
    }),
  )

  results.push(
    await runTest('playSequence: shuffled + reordering mid-playback changes upcoming snippets', async (check, d) => {
      const order = [5, 2, 7, 0, 3, 6, 1, 4]
      const initial = [...order]
      const swap = (a: number, b: number) => {
        const t = order[a]
        order[a] = order[b]
        order[b] = t
      }
      const run = await playSeq(key, segs, order, (p) => {
        if (p === 1) swap(2, 6)
        if (p === 4) swap(5, 7)
      })
      d.initialOrder = initial.join(',')
      d.finalOrder = order.join(',')
      d.positions = run.events.map((e) => e.pos).join(',')
      check(d.positions === '0,1,2,3,4,5,6,7', `positions fired ${d.positions}`)
      const played = run.schedule.map((i) => segs.findIndex((sg) => sameRange(sg, i.range)))
      d.playedSegments = played.join(',')
      check(played.join(',') === order.join(','), 'played segments do not follow the live order')
      check(played[2] === 1 && played[2] !== initial[2], 'swap at position 2 was not picked up')
      const joins = run.schedule.map((i) => i.join)
      const expected = order.map((segIdx, p) => (p === 0 ? 'first' : segIdx === order[p - 1] + 1 ? 'gapless' : 'crossfade'))
      d.joins = joins.join(',')
      d.outros = run.schedule.map((i) => i.outro).join(',')
      check(joins.join(',') === expected.join(','), `joins ${joins} expected ${expected}`)
      const rows = timingRows(run)
      d.onPosition = rows
      d.outputLatencyMs = toMs(run.latency)
      d.worstVsCurrentTimeMs = Math.max(...rows.map((r) => Math.abs(r.vsCurrentTimeMs)))
      d.worstVsAudibleMs = Math.max(...rows.map((r) => Math.abs(r.vsAudibleMs)))
      check((d.worstVsAudibleMs as number) <= 30, 'onPosition timing')
      check(run.ended !== null, 'onEnded not fired')
      const s = run.schedule
      let contiguousTimes = true
      for (let i = 1; i < s.length; i++) if (s[i].whenFrame !== s[i - 1].whenFrame + s[i - 1].frames) contiguousTimes = false
      check(contiguousTimes, 'shuffled start times not back-to-back')
      d.progress = progressViolations(run.samples)
    }),
  )

  results.push(
    await runTest('playSegment: single snippet, index/tag, progress, onEnded', async (check, d) => {
      const states: PlaybackState[] = []
      const unsub = audioEngine.subscribe((s) => states.push(s))
      const rec = recorder()
      const endedAt = await new Promise<number>((resolve) => {
        audioEngine.playSegment(key, segs[3], { index: 3, tag: 'block:3', onEnded: () => resolve(engineDebug.audibleTime() ?? 0) })
        const st = audioEngine.getState()
        d.stateAtStart = st
        check(st.playing && st.mode === 'segment' && st.index === 3 && st.tag === 'block:3', 'state at start')
        setTimeout(() => resolve(-1), 3000)
      })
      rec.stop()
      unsub()
      const sch = engineDebug.schedule()
      d.durationMs = toMs(endedAt - sch[0].when)
      d.onEndedVsEndMs = toMs(endedAt - sch[0].end)
      check(endedAt > 0 && Math.abs(endedAt - sch[0].end) < 0.03, 'onEnded timing')
      check(sch.length === 1 && sch[0].join === 'first' && sch[0].outro === 'fade', 'segment fades')
      const prog = rec.samples.filter((s) => s.pos).map((s) => s.pos!.progress)
      d.progressFirst = r2(prog[0] ?? -1)
      d.progressLast = r2(prog[prog.length - 1] ?? -1)
      d.progress = progressViolations(rec.samples)
      check((d.progressLast as number) > 0.9, 'progress did not reach the end')
      check(rec.samples.every((s) => !s.pos || (s.pos.index === 3 && s.pos.mode === 'segment')), 'position index/mode')
      d.states = states.map((s) => `${s.playing ? s.mode + ':' + s.index : 'idle'}`).join(',')
      check(states.length === 2, `expected start+idle emissions, got ${states.length}`)
    }),
  )

  results.push(
    await runTest('playFull: range + fade-in, progress through the range, onEnded', async (check, d) => {
      const rec = recorder()
      const endedAt = await new Promise<number>((resolve) => {
        audioEngine.playFull(key, { tag: 'reveal', from: 12, to: 14, fadeInMs: 300, onEnded: () => resolve(engineDebug.audibleTime() ?? 0) })
        check(audioEngine.getState().mode === 'full', 'mode')
        setTimeout(() => resolve(-1), 4000)
      })
      rec.stop()
      const sch = engineDebug.schedule()
      d.durationMs = toMs(endedAt - sch[0].when)
      d.onEndedVsEndMs = toMs(endedAt - sch[0].end)
      d.scheduled = sch.map((i) => ({ range: i.range, frames: i.frames }))
      check(endedAt > 0 && Math.abs(endedAt - sch[0].end) < 0.03, 'onEnded timing')
      check(Math.abs(sch[0].frames / buf.sampleRate - 2) < 0.001, 'full range length')
      const p = progressViolations(rec.samples)
      d.progress = p
      check(p.violations === 0, 'progress not monotonic')
      const mid = rec.samples.filter((s) => s.pos && s.pos.elapsed > 0.95 && s.pos.elapsed < 1.05)
      d.progressAt1s = mid.length ? r2(mid[0].pos!.progress) : null
      check(mid.length > 0 && Math.abs(mid[0].pos!.progress - 0.5) < 0.05, 'progress at 1s should be ~0.5')
      const early = rec.samples.filter((s) => s.pos && s.pos.elapsed < 0.1).map((s) => s.lv.energy)
      const later = rec.samples.filter((s) => s.pos && s.pos.elapsed > 0.5 && s.pos.elapsed < 0.7).map((s) => s.lv.energy)
      d.energyFirst100ms = r2(Math.max(0, ...early))
      d.energyAt600ms = r2(Math.max(0, ...later))
    }),
  )

  results.push(
    await runTest('stop: state idle immediately, levels decay to ~0', async (check, d) => {
      audioEngine.playFull(key, { tag: 'reveal', from: 5 })
      await wait(1500)
      const lvPlaying = audioEngine.getLevels()
      d.levelsWhilePlaying = Object.fromEntries(Object.entries(lvPlaying).map(([k, v]) => [k, r2(v)]))
      check(lvPlaying.energy > 0.2 && lvPlaying.bass > 0.1, 'levels should be > 0 while playing')
      const rec = recorder()
      const t0 = performance.now()
      audioEngine.stop()
      d.stateAfterStop = audioEngine.getState()
      check(!audioEngine.getState().playing && audioEngine.getPosition() === null, 'not idle after stop')
      await wait(1500)
      rec.stop()
      const quiet = rec.samples.find((s) => s.lv.bass < 0.02 && s.lv.mid < 0.02 && s.lv.treble < 0.02 && s.lv.energy < 0.02 && s.lv.beat < 0.02)
      d.decayToBelow002Ms = quiet ? Math.round(quiet.perf - t0) : null
      const lvEnd = audioEngine.getLevels()
      d.levelsAfter1500ms = lvEnd
      check(!!quiet && quiet.perf - t0 < 800, 'levels did not decay quickly')
      check(Object.values(lvEnd).every((x) => x === 0), 'levels not exactly 0 at rest')
    }),
  )

  results.push(
    await runTest('supersede: a new play* replaces the current one without its onEnded', async (check, d) => {
      let firstEnded = false
      audioEngine.playSequence(key, (p) => (p < 8 ? segs[p] : null), { tag: 'board', onEnded: () => (firstEnded = true) })
      await wait(400)
      const ended = await new Promise<boolean>((resolve) => {
        audioEngine.playSegment(key, segs[5], { tag: 'block:5', index: 5, onEnded: () => resolve(true) })
        const st = audioEngine.getState()
        d.stateAfterSwitch = st
        check(st.mode === 'segment' && st.index === 5 && st.tag === 'block:5', 'state after switch')
        setTimeout(() => resolve(false), 2000)
      })
      await wait(100)
      check(ended, 'second onEnded missing')
      check(!firstEnded, 'first onEnded fired although superseded')
    }),
  )

  results.push(
    await runTest('suspended context: play* resumes first', async (check, d) => {
      const ctx = getAudioContext()!
      await ctx.suspend()
      d.stateBefore = ctx.state
      const ended = await new Promise<boolean>((resolve) => {
        audioEngine.playSegment(key, segs[1], { index: 1, onEnded: () => resolve(true) })
        check(audioEngine.getState().playing, 'state should be playing immediately')
        const p = audioEngine.getPosition()
        check(!!p && p.progress === 0, 'position before start should be 0')
        setTimeout(() => resolve(false), 3000)
      })
      d.stateAfter = ctx.state
      check(ctx.state === 'running', 'context not resumed')
      check(ended, 'segment did not play to the end')
    }),
  )

  results.push(
    await runTest('load: expired URL → refresh(); dead URL → Italian error after 3 retries', async (check, d) => {
      const expired = url.replace(/hmac=[0-9a-f]+/, 'hmac=' + '0'.repeat(64))
      let refreshes = 0
      const t0 = performance.now()
      const b = await audioEngine.load('test:refresh', expired, async () => {
        refreshes++
        return (await trackPreview(trackId)).url
      })
      d.refreshRecoveredMs = Math.round(performance.now() - t0)
      d.refreshes = refreshes
      check(b.duration > 25 && refreshes === 1, `refresh path (refreshes=${refreshes})`)
      evictAudio('test:refresh')
      check(!audioEngine.has('test:refresh'), 'evict')
      let calls = 0
      const t1 = performance.now()
      try {
        await audioEngine.load('test:dead', expired, async () => {
          calls++
          return expired
        })
        check(false, 'dead url resolved')
      } catch (err) {
        d.deadMs = Math.round(performance.now() - t1)
        d.deadRefreshCalls = calls
        d.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        check(err instanceof AudioLoadError, 'not an AudioLoadError')
        check(err instanceof Error && /Impossibile caricare/.test(err.message), 'message not Italian')
        check(calls === 3, `refresh should be called 3 times, got ${calls}`)
        check(performance.now() - t1 > 3700, 'backoff too short')
      }
      check(!audioEngine.has('test:dead'), 'failed load cached')
    }),
  )

  results.push(
    await runTest('volume: clamped, persisted', async (check, d) => {
      audioEngine.setVolume(0.5)
      d.stored = localStorage.getItem('unshuffle:volume')
      check(audioEngine.volume === 0.5 && d.stored === '0.5', 'persist')
      audioEngine.setVolume(7)
      check(audioEngine.volume === 1, 'clamp')
      audioEngine.setVolume(0.9)
    }),
  )

  results.push(
    await runTest('sfx: offline levels + live playback bypasses the analyser', async (check, d) => {
      const offline: Record<string, ReturnType<typeof spectrum>> = {}
      for (const name of SFX_NAMES) offline[name] = spectrum(await renderSfx(name))
      d.offline = offline
      for (const [name, s] of Object.entries(offline)) {
        check(s.peakDb < -6 && s.peakDb > -40, `${name} peak ${s.peakDb} dBFS out of range`)
      }
      check(offline.tick.centroidHz !== offline.tickUrgent.centroidHz, 'tick vs tickUrgent identical')
      const out = getSfxOutput()
      check(!!out, 'sfx output unavailable while unlocked')
      const probe = out!.ctx.createAnalyser()
      probe.fftSize = 2048
      out!.input.connect(probe)
      const tbuf = new Float32Array(probe.fftSize)
      const live: Record<string, number> = {}
      let musicLeak = 0
      const plays0 = sfxDebug.plays()
      for (const name of SFX_NAMES) {
        sfx.play(name)
        let peak = 0
        const until = performance.now() + (name === 'fanfare' ? 1300 : 350)
        while (performance.now() < until) {
          await new Promise((r) => requestAnimationFrame(r))
          probe.getFloatTimeDomainData(tbuf)
          for (let i = 0; i < tbuf.length; i++) peak = Math.max(peak, Math.abs(tbuf[i]))
          musicLeak = Math.max(musicLeak, audioEngine.getLevels().energy, audioEngine.getLevels().bass)
        }
        live[name] = r2(20 * Math.log10(peak || 1e-9))
      }
      out!.input.disconnect(probe)
      const plays1 = sfxDebug.plays()
      d.livePeakDb = live
      d.analyserLevelDuringSfx = r2(musicLeak)
      check(musicLeak === 0, 'sfx reached the music analyser')
      for (const name of SFX_NAMES) {
        check(live[name] > -45, `${name} silent live`)
        check((plays1[name] ?? 0) - (plays0[name] ?? 0) === 1, `${name} play count`)
      }
      const before = sfxDebug.plays().swap ?? 0
      for (const at of [0, 20, 40, 70, 90]) setTimeout(() => sfx.play('swap'), at)
      await wait(200)
      d.swapPlaysOutOf5 = (sfxDebug.plays().swap ?? 0) - before
      check(d.swapPlaysOutOf5 === 2, `swap throttle: ${d.swapPlaysOutOf5}`)
      sfx.setEnabled(false)
      const c0 = sfxDebug.plays().click ?? 0
      sfx.play('click')
      check((sfxDebug.plays().click ?? 0) === c0, 'played while disabled')
      check(localStorage.getItem('unshuffle:sfx') === '0', 'toggle not persisted')
      sfx.setEnabled(true)
    }),
  )

  if (opts.long) {
    results.push(
      await runTest('long: 8 equal segments over the whole preview, correct order', async (check, d) => {
        const full = equalSegments(0, buf.duration, 8)
        const run = await playSeq(key, full, [0, 1, 2, 3, 4, 5, 6, 7])
        const rows = timingRows(run)
        d.segmentSeconds = r2(full[0].end - full[0].start)
        d.onPosition = rows
        const s = run.schedule
        let ok = s.length === 8
        for (let i = 1; i < s.length; i++) if (s[i].whenFrame !== s[i - 1].whenFrame + s[i - 1].frames || s[i].startSample !== s[i - 1].endSample) ok = false
        d.totalFrames = s.reduce((a, i) => a + i.frames, 0)
        d.bufferFrames = buf.length
        check(ok, 'not contiguous')
        check(d.totalFrames === buf.length, 'did not cover the whole buffer')
        check(run.events.map((e) => e.pos).join(',') === '0,1,2,3,4,5,6,7', 'positions')
        check(Math.max(...rows.map((r) => Math.abs(r.vsAudibleMs))) <= 30, 'timing')
        check(run.ended !== null, 'onEnded')
        d.levels = levelStats(run.samples)
      }),
    )
  }

  void t1
  return finalize(results)
}

function finalize(results: TestResult[]) {
  const summary = { passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results }
  log(`\n${summary.passed}/${results.length} test superati`)
  return summary
}

/* ------------------------------------------------------------------ tuning helper */

async function tuneLevels(seconds = 12) {
  const out: Record<string, unknown> = {}
  for (const t of TRACKS) {
    const meta = await trackPreview(t.id)
    const key = `track:${t.id}`
    const b = await audioEngine.load(key, meta.url)
    audioEngine.playFull(key, { from: Math.min(8, b.duration - seconds - 1), tag: 'tune' })
    const raws: ReturnType<typeof engineDebug.levelsRaw>[] = []
    const lvs: AudioLevels[] = []
    const t0 = performance.now()
    let beats = 0
    let prev = 0
    while (performance.now() - t0 < seconds * 1000) {
      await new Promise((r) => requestAnimationFrame(r))
      const lv = audioEngine.getLevels()
      if (performance.now() - t0 < 300) continue
      lvs.push(lv)
      raws.push(engineDebug.levelsRaw())
      if (lv.beat > 0.8 && prev <= 0.8) beats++
      prev = lv.beat
    }
    audioEngine.stop()
    const pct = (xs: number[], q: number) => {
      const s = xs.filter(Number.isFinite).sort((a, b) => a - b)
      return r2(s[Math.floor(q * (s.length - 1))] ?? NaN)
    }
    const stats = (xs: number[]) => ({ p10: pct(xs, 0.1), p50: pct(xs, 0.5), p90: pct(xs, 0.9), max: pct(xs, 1) })
    out[t.label] = {
      rawDb: {
        bass: stats(raws.map((r) => r.bassDb)),
        mid: stats(raws.map((r) => r.midDb)),
        treble: stats(raws.map((r) => r.trebleDb)),
        rms: stats(raws.map((r) => r.rmsDb)),
        flux: stats(raws.map((r) => r.flux)),
        thr: stats(raws.map((r) => r.threshold)),
      },
      mapped: {
        bass: stats(lvs.map((l) => l.bass)),
        mid: stats(lvs.map((l) => l.mid)),
        treble: stats(lvs.map((l) => l.treble)),
        energy: stats(lvs.map((l) => l.energy)),
      },
      beatsPerSec: r2(beats / (seconds - 0.3)),
    }
    await wait(300)
  }
  return out
}

/* ------------------------------------------------------------------ sfx sheet (spectrograms + WAV export) */

function encodeWav(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels
  const n = buf.length
  const bytes = new DataView(new ArrayBuffer(44 + n * ch * 2))
  const str = (o: number, t: string) => [...t].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  bytes.setUint32(4, 36 + n * ch * 2, true)
  str(8, 'WAVEfmt ')
  bytes.setUint32(16, 16, true)
  bytes.setUint16(20, 1, true)
  bytes.setUint16(22, ch, true)
  bytes.setUint32(24, buf.sampleRate, true)
  bytes.setUint32(28, buf.sampleRate * ch * 2, true)
  bytes.setUint16(32, ch * 2, true)
  bytes.setUint16(34, 16, true)
  str(36, 'data')
  bytes.setUint32(40, n * ch * 2, true)
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) bytes.setInt16(44 + (i * ch + c) * 2, Math.max(-1, Math.min(1, data[c][i])) * 32767, true)
  let bin = ''
  const u8 = new Uint8Array(bytes.buffer)
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(bin)
}

function drawSpectrogram(cv: HTMLCanvasElement, buf: AudioBuffer, seconds: number) {
  const W = cv.width
  const H = cv.height
  const g = cv.getContext('2d')!
  const img = g.createImageData(W, H)
  const d = buf.getChannelData(0)
  const N = 1024
  const fMin = 60
  const fMax = 16000
  const cols: Float64Array[] = []
  let top = -Infinity
  for (let x = 0; x < W; x++) {
    const s0 = Math.floor((x / W) * seconds * buf.sampleRate)
    const re = new Float64Array(N)
    const im = new Float64Array(N)
    for (let n = 0; n < N; n++) re[n] = (d[s0 + n] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N))
    fft(re, im)
    const col = new Float64Array(H)
    for (let y = 0; y < H; y++) {
      const f = fMin * Math.pow(fMax / fMin, 1 - y / H)
      const k = Math.min(N / 2 - 1, Math.max(1, Math.round((f * N) / buf.sampleRate)))
      col[y] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12)
      top = Math.max(top, col[y])
    }
    cols.push(col)
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const v = Math.max(0, Math.min(1, (cols[x][y] - (top - 72)) / 72))
      const i = (y * W + x) * 4
      img.data[i] = Math.round(255 * Math.min(1, v * 1.5))
      img.data[i + 1] = Math.round(255 * Math.max(0, v * 1.6 - 0.6))
      img.data[i + 2] = Math.round(255 * Math.min(1, 0.12 + v * 0.95))
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  // waveform overlay
  g.strokeStyle = 'rgba(166,255,63,.9)'
  g.lineWidth = 1
  g.beginPath()
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x / W) * seconds * buf.sampleRate)
    const b = Math.floor(((x + 1) / W) * seconds * buf.sampleRate)
    let m = 0
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(d[i] ?? 0))
    const y = H - 2 - m * (H - 4) * 2.5
    if (x) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.stroke()
}

async function sfxSheet(): Promise<Record<string, string>> {
  let sec = document.getElementById('sheet')
  if (!sec) {
    sec = document.createElement('section')
    sec.id = 'sheet'
    sec.innerHTML = '<h2>SFX — spettrogrammi (60 Hz–16 kHz, log) + inviluppo</h2><div class="sheet"></div>'
    document.querySelector('main')!.appendChild(sec)
  }
  const grid = sec.querySelector('.sheet')!
  grid.innerHTML = ''
  const wavs: Record<string, string> = {}
  for (const name of SFX_NAMES) {
    const buf = await renderSfx(name)
    wavs[name] = encodeWav(buf)
    const st = spectrum(buf)
    const card = document.createElement('div')
    card.className = 'sheet-card'
    const cv = document.createElement('canvas')
    cv.width = 320
    cv.height = 120
    card.innerHTML = `<div class="sheet-title"><b>${name}</b><span>${st.peakDb} dBFS · ${st.durMs} ms · ${st.centroidHz} Hz</span></div>`
    card.appendChild(cv)
    grid.appendChild(card)
    drawSpectrogram(cv, buf, name === 'fanfare' ? 1.6 : 0.6)
  }
  return wavs
}

/* ------------------------------------------------------------------ manual UI */

const css = `
:root { color-scheme: dark; --bg:#0b0714; --panel:#150f24; --line:#2a2140; --txt:#efe9ff; --dim:#9c90bd; --lime:#a6ff3f; --mag:#ff3fd1; --cyan:#2ee6ff; --violet:#7b5cff; }
* { box-sizing: border-box }
body { margin:0; background: radial-gradient(1200px 600px at 20% -10%, #2a1150 0%, var(--bg) 60%); color:var(--txt); font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; min-height:100dvh }
main { max-width: 1100px; margin: 0 auto; padding: 20px 16px 48px; display:grid; gap:14px }
h1 { font-size: 18px; letter-spacing: .08em; margin: 4px 0 0; font-weight: 900 }
h1 span { color: var(--mag) }
section { background: color-mix(in oklab, var(--panel) 85%, transparent); border:1px solid var(--line); border-radius: 18px; padding: 14px; }
h2 { margin:0 0 10px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim) }
.row { display:flex; flex-wrap:wrap; gap:8px; align-items:center }
button, select { font: inherit; color: var(--txt); background: #221938; border: 1px solid #3a2e5a; border-bottom-width: 3px; border-radius: 999px; padding: 8px 14px; cursor:pointer; min-height: 40px }
button:active { transform: translateY(2px); border-bottom-width: 1px }
button.primary { background: var(--lime); color: #111; border-color: #6fb01f; font-weight: 800 }
select { border-radius: 12px; max-width: 100% }
.board { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px }
@media (max-width: 600px) { .board { grid-template-columns: repeat(2, 1fr) } }
.block { position:relative; height: 76px; border-radius: 16px; overflow:hidden; border:1px solid #ffffff22; cursor:pointer; transition: transform .15s, box-shadow .15s }
.block canvas { position:absolute; inset:0; width:100%; height:100% }
.block b { position:absolute; left:10px; top:6px; font-size: 13px; font-weight: 900; text-shadow: 0 1px 2px #0008 }
.block.on { transform: scale(1.04); box-shadow: 0 0 0 2px #fff, 0 0 24px 4px var(--glow) }
#levels { width:100%; height: 140px; display:block }
.sfx { display:grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px }
pre { white-space: pre-wrap; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #d9d0f5; max-height: 420px; overflow:auto; margin:0 }
.status { color: var(--dim) }
.sheet { display:grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 10px }
.sheet-card { background:#0d0918; border:1px solid var(--line); border-radius: 12px; padding: 8px }
.sheet-card canvas { width:100%; height:auto; display:block; border-radius: 6px; image-rendering: pixelated }
.sheet-title { display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px } .sheet-title span { color: var(--dim) }
input[type=range] { accent-color: var(--lime) }
`

const logLines: string[] = []
function log(line: string) {
  logLines.push(line)
  const el = document.getElementById('log')
  if (el) el.textContent = logLines.join('\n')
}

function buildUi() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const app = document.getElementById('app')!
  app.innerHTML = `
  <main>
    <h1>UNSHUFFLE <span>·</span> audio engine lab</h1>
    <section>
      <h2>Traccia</h2>
      <div class="row">
        <select id="track">${TRACKS.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
        <button id="load" class="primary">Carica</button>
        <span id="status" class="status">—</span>
      </div>
    </section>
    <section>
      <h2>Tavola (tocca un blocco per ascoltarlo)</h2>
      <div id="board" class="board"></div>
      <div class="row" style="margin-top:12px">
        <button id="playAll" class="primary">▶ Riproduci tutto</button>
        <button id="shuffle">Mescola</button>
        <button id="sort">Ordine giusto</button>
        <button id="full">▶ Reveal (brano intero)</button>
        <button id="stop">■ Stop</button>
        <label class="row">Volume <input id="vol" type="range" min="0" max="1" step="0.01"></label>
        <label class="row"><input id="sfxOn" type="checkbox"> SFX</label>
      </div>
    </section>
    <section>
      <h2>Livelli (bass · mid · treble · energy · beat)</h2>
      <canvas id="levels"></canvas>
    </section>
    <section>
      <h2>Effetti sonori</h2>
      <div id="sfx" class="sfx"></div>
    </section>
    <section>
      <h2>Test automatici</h2>
      <div class="row" style="margin-bottom:10px"><button id="runTests" class="primary">Esegui test</button></div>
      <pre id="log"></pre>
    </section>
  </main>`

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const HUES = [312, 22, 190, 95, 258, 140, 48, 5]
  let key = ''
  let segs: TimeRange[] = []
  let order = [0, 1, 2, 3, 4, 5, 6, 7]
  let peaks: Float32Array[] = []

  const vol = $<HTMLInputElement>('vol')
  vol.value = String(audioEngine.volume)
  vol.oninput = () => audioEngine.setVolume(Number(vol.value))
  const sfxOn = $<HTMLInputElement>('sfxOn')
  sfxOn.checked = sfx.enabled
  sfxOn.onchange = () => sfx.setEnabled(sfxOn.checked)

  const sfxGrid = $('sfx')
  for (const name of SFX_NAMES) {
    const b = document.createElement('button')
    b.textContent = name
    b.onclick = () => sfx.play(name as SfxName)
    sfxGrid.appendChild(b)
  }

  function computePeaks(buf: AudioBuffer, r: TimeRange, bins: number) {
    const d = buf.getChannelData(0)
    const out = new Float32Array(bins)
    const s0 = Math.floor(r.start * buf.sampleRate)
    const len = Math.floor((r.end - r.start) * buf.sampleRate)
    for (let b = 0; b < bins; b++) {
      let m = 0
      const a = s0 + Math.floor((b * len) / bins)
      const z = s0 + Math.floor(((b + 1) * len) / bins)
      for (let i = a; i < z; i++) m = Math.max(m, Math.abs(d[i]))
      out[b] = m
    }
    return out
  }

  function renderBoard() {
    const board = $('board')
    board.innerHTML = ''
    order.forEach((segIdx, pos) => {
      const el = document.createElement('div')
      el.className = 'block'
      el.dataset.pos = String(pos)
      const hue = HUES[segIdx]
      el.style.background = `linear-gradient(160deg, hsl(${hue} 90% 62%), hsl(${hue} 80% 38%))`
      el.style.setProperty('--glow', `hsl(${hue} 100% 60% / .6)`)
      el.innerHTML = `<canvas></canvas><b>${String.fromCharCode(65 + segIdx)}</b>`
      el.onclick = () => {
        const st = audioEngine.getState()
        if (st.playing && st.tag === `block:${segIdx}`) audioEngine.stop()
        else audioEngine.playSegment(key, segs[segIdx], { tag: `block:${segIdx}`, index: segIdx })
      }
      board.appendChild(el)
    })
  }

  function drawBoard() {
    const pos = audioEngine.getPosition()
    const blocks = [...document.querySelectorAll<HTMLDivElement>('.block')]
    blocks.forEach((el, p) => {
      const segIdx = order[p]
      const cv = el.querySelector('canvas')!
      const dpr = devicePixelRatio || 1
      const w = el.clientWidth
      const h = el.clientHeight
      if (cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      const g = cv.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const pk = peaks[segIdx]
      let active = false
      let progress = 0
      if (pos) {
        if (pos.mode === 'sequence' && pos.tag === 'board' && pos.index === p) active = true
        if (pos.mode === 'segment' && pos.tag === `block:${segIdx}`) active = true
        if (active) progress = pos.progress
      }
      el.classList.toggle('on', active)
      if (!pk) return
      const bw = w / pk.length
      for (let i = 0; i < pk.length; i++) {
        const a = Math.max(0.04, pk[i]) * (h * 0.36)
        const played = active && i / pk.length < progress
        g.fillStyle = played ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.42)'
        g.fillRect(i * bw + 0.5, h / 2 + 8 - a, Math.max(1, bw - 1.5), a * 2)
      }
    })
  }

  const history: AudioLevels[] = []
  function drawLevels() {
    const cv = $<HTMLCanvasElement>('levels')
    const dpr = devicePixelRatio || 1
    const w = cv.clientWidth
    const h = cv.clientHeight
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const lv = audioEngine.getLevels()
    history.push(lv)
    if (history.length > 240) history.shift()
    const colors = { bass: '#ff3fd1', mid: '#7b5cff', treble: '#2ee6ff', energy: '#a6ff3f', beat: '#ffd23f' }
    const barsW = Math.min(220, w * 0.35)
    const keys = ['bass', 'mid', 'treble', 'energy', 'beat'] as const
    keys.forEach((k, i) => {
      const bh = lv[k] * (h - 20)
      g.fillStyle = colors[k]
      g.fillRect(i * (barsW / 5) + 4, h - 16 - bh, barsW / 5 - 8, bh)
      g.fillStyle = '#9c90bd'
      g.font = '10px system-ui'
      g.fillText(barsW < 200 ? k[0].toUpperCase() : k, i * (barsW / 5) + 4, h - 3)
    })
    const x0 = barsW + 12
    const gw = w - x0
    for (const k of ['bass', 'energy', 'beat'] as const) {
      g.strokeStyle = colors[k]
      g.lineWidth = 1.5
      g.beginPath()
      history.forEach((l, i) => {
        const x = x0 + (i / 240) * gw
        const y = h - 8 - l[k] * (h - 16)
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      })
      g.stroke()
    }
  }

  const loop = () => {
    drawBoard()
    drawLevels()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  async function load() {
    const id = Number($<HTMLSelectElement>('track').value)
    $('status').textContent = 'Carico…'
    try {
      const meta = await trackPreview(id)
      key = `track:${id}`
      const b = await audioEngine.load(key, meta.url, async () => (await trackPreview(id)).url)
      segs = equalSegments(0, b.duration, 8)
      peaks = segs.map((r) => computePeaks(b, r, 48))
      $('status').textContent = `${meta.artist} — ${meta.title} · ${b.duration.toFixed(2)}s · ${b.sampleRate} Hz`
      renderBoard()
    } catch (err) {
      $('status').textContent = err instanceof Error ? err.message : String(err)
    }
  }

  $('load').onclick = () => void load()
  $('playAll').onclick = () => audioEngine.playSequence(key, (p) => (p < order.length ? segs[order[p]] : null), { tag: 'board' })
  $('shuffle').onclick = () => {
    const o = [...order]
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[o[i], o[j]] = [o[j], o[i]]
    }
    order.splice(0, order.length, ...o)
    renderBoard()
  }
  $('sort').onclick = () => {
    order = order.sort((a, b) => a - b)
    renderBoard()
  }
  $('full').onclick = () => audioEngine.playFull(key, { tag: 'reveal', fadeInMs: 250 })
  $('stop').onclick = () => audioEngine.stop()
  $('runTests').onclick = () => void runTests()

  return { load }
}

const ui = buildUi()

declare global {
  interface Window {
    __engineLab: { runTests: typeof runTests; tuneLevels: typeof tuneLevels; sfxSheet: typeof sfxSheet; loadDefault: () => Promise<void>; ready: boolean }
  }
}
window.__engineLab = { runTests, tuneLevels, sfxSheet, loadDefault: ui.load, ready: true }
