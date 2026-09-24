// Musical analysis + intelligent cutting of a 30s preview.
//
// analyzeAndCut() mixes the buffer down to mono (plus the stereo side channel,
// which tells centred vocals from wide sounds) on the main thread, ships the
// samples to a lazily created module worker (reused across calls) and gets
// back a CutPlan: exactly n contiguous, evenly sized segments whose boundaries
// sit just before the attacks of beats — bar lines / phrase boundaries
// whenever the music allows, never through a held sung note if it can be
// avoided. The 'free' style cuts the other way round: off the beat, through
// held notes and words (see ./types). If the worker cannot be created or
// fails, the same pure pipeline runs on the main thread, yielding between
// stages; it is imported lazily, so the entry chunk only carries the tiny
// plan helpers (the worker chunk has its own copy of the pipeline). It never
// rejects: the last resort is an even split of the usable region.
//
// realignSegments() (./realign) adapts a plan computed on another peer's
// decode to this browser's decode of the same MP3 (WebKit vs Chrome differ by
// 12 ms); call it before playing / drawing the host's segments.

import { getMono } from '../peaks'
import { clampCount, isValidPlan, uniformPlan } from './plan'
import type { AnalyzeRequest, AnalyzeResponse } from './protocol'
import type { CutPlan, CutStyle } from './types'

export type { CutPlan, CutStyle } from './types'

/** A worker that doesn't answer within this time is abandoned for the main thread. */
const WORKER_TIMEOUT_MS = 20000

interface Job {
  resolve(plan: CutPlan): void
  reject(err: Error): void
  timer: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
let workerDisabled = false
let nextId = 1
const jobs = new Map<number, Job>()
/** Plans per buffer, keyed by style and count ("beat:8"). */
const planCache = new WeakMap<AudioBuffer, Map<string, Promise<CutPlan>>>()

function failAll(err: Error): void {
  for (const [id, job] of jobs) {
    clearTimeout(job.timer)
    jobs.delete(id)
    job.reject(err)
  }
}

function disableWorker(reason: string): void {
  workerDisabled = true
  const w = worker
  worker = null
  try {
    w?.terminate()
  } catch {
    // already gone
  }
  failAll(new Error(reason))
}

function getWorker(): Worker | null {
  if (workerDisabled || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'unshuffle-analysis' })
    w.onmessage = (e: MessageEvent<AnalyzeResponse>) => {
      const msg = e.data
      const job = jobs.get(msg.id)
      if (!job) return
      jobs.delete(msg.id)
      clearTimeout(job.timer)
      if (msg.ok) job.resolve(msg.plan)
      else job.reject(new Error(msg.error))
    }
    w.onerror = (e) => {
      e.preventDefault()
      disableWorker(`analysis worker error: ${e.message || 'unknown'}`)
    }
    w.onmessageerror = () => disableWorker('analysis worker message error')
    worker = w
    return w
  } catch {
    workerDisabled = true
    return null
  }
}

/**
 * Side channel (L − R) / 2 of a stereo buffer, or null (mono, dual-mono or unreadable).
 * It lets the cutter tell a centred (sung) held note from wide pads / guitars.
 */
function sideOf(buffer: AudioBuffer): Float32Array | null {
  try {
    if (buffer.numberOfChannels < 2) return null
    const l = buffer.getChannelData(0)
    const r = buffer.getChannelData(1)
    const out = new Float32Array(l.length)
    let any = false
    for (let i = 0; i < l.length; i++) {
      const v = (l[i] - r[i]) * 0.5
      out[i] = v
      if (v !== 0) any = true
    }
    return any ? out : null
  } catch {
    return null
  }
}

function runInWorker(samples: Float32Array, side: Float32Array | null, sampleRate: number, n: number, style: CutStyle): Promise<CutPlan> {
  const w = getWorker()
  if (!w) return Promise.reject(new Error('worker unavailable'))
  return new Promise<CutPlan>((resolve, reject) => {
    const id = nextId++
    const timer = setTimeout(() => {
      if (jobs.delete(id)) reject(new Error('analysis worker timeout'))
    }, WORKER_TIMEOUT_MS)
    jobs.set(id, { resolve, reject, timer })
    const req: AnalyzeRequest = { id, samples, side, sampleRate, n, style }
    try {
      w.postMessage(req, side ? [samples.buffer, side.buffer] : [samples.buffer])
    } catch (err) {
      jobs.delete(id)
      clearTimeout(timer)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

const pause = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

async function runOnMainThread(buffer: AudioBuffer, n: number, style: CutStyle): Promise<CutPlan> {
  const { analyzeAsync } = await import('./pipeline')
  const { plan } = await analyzeAsync({ samples: getMono(buffer), side: sideOf(buffer), sampleRate: buffer.sampleRate, n, style }, pause)
  return plan
}

function clonePlan(p: CutPlan): CutPlan {
  return {
    ...p,
    beats: p.beats.slice(),
    downbeats: p.downbeats.slice(),
    segments: p.segments.map((s) => ({ ...s })),
  }
}

function durationOf(buffer: AudioBuffer | null | undefined): number {
  try {
    const d = buffer?.duration ?? 0
    return Number.isFinite(d) && d > 0 ? d : 0
  } catch {
    return 0
  }
}

async function analyze(buffer: AudioBuffer, n: number, style: CutStyle): Promise<CutPlan> {
  const duration = durationOf(buffer)
  try {
    let plan: CutPlan | null = null
    try {
      // The cached mono mix is shared with the waveform renderer: send a copy.
      plan = await runInWorker(getMono(buffer).slice(), sideOf(buffer), buffer.sampleRate, n, style)
    } catch {
      plan = null
    }
    if (!plan || !isValidPlan(plan, n, duration)) plan = await runOnMainThread(buffer, n, style)
    return isValidPlan(plan, n, duration) ? plan : uniformPlan(n, duration)
  } catch {
    return uniformPlan(n, duration)
  }
}

/**
 * Analyze the decoded preview and cut it into `n` contiguous segments: on
 * beats, preferring bar lines / phrase boundaries ('beat', the default), or
 * off the beat through held notes ('free').
 * Heavy lifting runs in a Web Worker; always resolves (falls back gracefully).
 * Results are cached per (buffer, style, n); each call gets its own copy.
 */
export function analyzeAndCut(buffer: AudioBuffer, n: number, style: CutStyle = 'beat'): Promise<CutPlan> {
  const count = clampCount(n)
  const cut: CutStyle = style === 'free' ? 'free' : 'beat'
  const key = `${cut}:${count}`
  let byKey: Map<string, Promise<CutPlan>> | undefined
  try {
    byKey = planCache.get(buffer)
    if (!byKey) {
      byKey = new Map()
      planCache.set(buffer, byKey)
    }
  } catch {
    byKey = undefined
  }
  let pending = byKey?.get(key)
  if (!pending) {
    pending = analyze(buffer, count, cut)
    byKey?.set(key, pending)
  }
  return pending.then(clonePlan).catch(() => uniformPlan(count, durationOf(buffer)))
}

export { alignCuts, realignSegments } from './realign'
