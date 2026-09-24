// Main-thread fallback of analyzeAndCut when the worker is missing or broken.
// Separate file (own module instance). Run: bun test scripts/analysis/fallback
import { expect, test } from 'bun:test'
import { synthLoop } from '../synth'

function fakeBuffer(x: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: x.length,
    duration: x.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => x,
  } as unknown as AudioBuffer
}

class ErroringWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage(): void {
    setTimeout(() => this.onerror?.({ message: 'boom', preventDefault() {} }), 5)
  }
  terminate(): void {}
}

test('worker that errors → main-thread result identical to the worker result', async () => {
  const g = globalThis as unknown as { Worker: unknown }
  const real = g.Worker
  const s = synthLoop({ bpm: 121 })
  const { analyzeAndCut } = await import('../../../src/audio/analysis')
  const viaWorker = await analyzeAndCut(fakeBuffer(s.samples, s.sampleRate), 8)
  g.Worker = ErroringWorker
  try {
    // A new module instance so the worker singleton is re-created with the fake.
    const mod = await import('../../../src/audio/analysis/index.ts?fallback')
    const t0 = performance.now()
    const viaMain = await mod.analyzeAndCut(fakeBuffer(s.samples.slice(), s.sampleRate), 8)
    expect(viaMain.segments.length).toBe(8)
    expect(JSON.stringify(viaMain)).toBe(JSON.stringify(viaWorker))
    console.log(`fallback after worker error: ${Math.round(performance.now() - t0)} ms, method ${viaMain.method}, bpm ${viaMain.bpm}`)
  } finally {
    g.Worker = real
  }
})

test('no Worker global and a throwing constructor both fall back', async () => {
  const g = globalThis as unknown as { Worker: unknown }
  const real = g.Worker
  const s = synthLoop({ bpm: 97 })
  try {
    g.Worker = undefined
    const a = await import('../../../src/audio/analysis/index.ts?noworker')
    const p1 = await a.analyzeAndCut(fakeBuffer(s.samples, s.sampleRate), 12)
    expect(p1.segments.length).toBe(12)
    expect(p1.method).toBe('beat-grid')
    g.Worker = class {
      constructor() {
        throw new Error('CSP says no')
      }
    }
    const b = await import('../../../src/audio/analysis/index.ts?throwing')
    const p2 = await b.analyzeAndCut(fakeBuffer(s.samples.slice(), s.sampleRate), 12)
    expect(JSON.stringify(p2)).toBe(JSON.stringify(p1))
  } finally {
    g.Worker = real
  }
})
