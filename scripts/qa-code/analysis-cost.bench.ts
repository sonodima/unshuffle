// QA "code": main-thread cost of the analysis pipeline (bun run scripts/qa-code/analysis-cost.bench.ts)
import { analyzeSync } from '../../src/audio/analysis/pipeline'
const sr = 44100
const n = sr * 30
const s = new Float32Array(n)
// 120 BPM kick + hat + noise bed
for (let i = 0; i < n; i++) {
  const t = i / sr
  const beat = t % 0.5
  s[i] = 0.6 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-beat * 18) + 0.05 * (Math.random() * 2 - 1) + 0.2 * Math.sin(2 * Math.PI * 440 * t) * 0.3
}
for (const count of [8, 16]) {
  const t0 = performance.now()
  const { plan } = analyzeSync({ samples: s, sampleRate: sr, n: count })
  console.log(`n=${count}: ${(performance.now() - t0).toFixed(0)} ms, method=${plan.method}, bpm=${plan.bpm}`)
}
