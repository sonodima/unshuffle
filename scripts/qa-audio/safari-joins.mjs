// Join clicks on a Safari guest: the host (Chrome) plan applied to a WebKit decode, with the
// engine's non-contiguous join simulated offline (outgoing snippet + 4 ms sample-exact tail
// fading out, incoming snippet fading in over 4 ms). Metric = first-difference (HF) energy in
// [J-1 ms, J+5 ms] vs the louder of the two source windows (same as playback.mjs joins).
import { chromium, webkit } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8')).slice(0, 12)
const urls = []
for (const t of tracks) urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview })
const cb = await chromium.launch({ channel: 'chrome' })
const cp = await cb.newPage()
await cp.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
await cp.waitForFunction(() => window.__pre)
const plans = await cp.evaluate(async (urls) => {
  const { analyzeSync } = await import('/src/audio/analysis/pipeline.ts')
  const dec = new OfflineAudioContext(1, 1, 44100)
  const out = []
  for (const u of urls) {
    const buf = await dec.decodeAudioData(await (await fetch(u.url)).arrayBuffer())
    for (const n of [8, 16]) {
      const r = analyzeSync({ samples: buf.getChannelData(0).slice(), sampleRate: buf.sampleRate, n }, false)
      out.push({ label: u.label, url: u.url, n, segs: r.plan.segments.map((s) => [s.start, s.end]) })
    }
  }
  return out
}, urls)
const sim = (plans) => (async () => {
  const sr = 44100
  const dec = new OfflineAudioContext(2, 1, sr)
  const cache = new Map()
  const F = Math.round(0.004 * sr), w0 = Math.round(0.001 * sr), w1 = Math.round(0.005 * sr)
  const hf = (x) => { let s = 0; for (let i = 1; i < x.length; i++) s += (x[i] - x[i - 1]) ** 2; return s / Math.max(1, x.length - 1) }
  const res = []
  for (const p of plans) {
    let m = cache.get(p.url)
    if (!m) { const b = await dec.decodeAudioData(await (await fetch(p.url)).arrayBuffer()); const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L; m = L.map((v, i) => (v + R[i]) / 2); cache.set(p.url, m) }
    const n = p.segs.length
    for (let a = 0; a < n; a++) {
      const bIdx = (a + 3) % n
      if (bIdx === a + 1) continue
      const aEnd = Math.round(p.segs[a][1] * sr), bStart = Math.round(p.segs[bIdx][0] * sr)
      // simulated output around the join J (index w0+1 = J)
      const out = new Float32Array(w0 + w1 + 1)
      for (let i = 0; i < out.length; i++) {
        const j = i - w0 - 1
        let v = 0
        if (j < 0) v += m[aEnd + j]
        else {
          if (j < F) v += m[aEnd + j] * (1 - j / F) // outgoing tail
          v += m[bStart + j] * Math.min(1, j / F) // incoming fade-in
        }
        out[i] = v
      }
      const srcA = m.subarray(aEnd - w0 - 1, aEnd + w1), srcB = m.subarray(bStart - w0 - 1, bStart + w1)
      res.push(10 * Math.log10(hf(out) / (Math.max(hf(srcA), hf(srcB)) + 1e-20)))
    }
  }
  return res
})()
const C = await cp.evaluate(sim, plans)
await cb.close()
const wb = await webkit.launch()
const wp = await wb.newPage()
await wp.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
const W = await wp.evaluate(sim, plans)
await wb.close()
const st = (v) => { const s = [...v].sort((a, b) => a - b); const gt = (t) => s.filter((x) => x > t).length; return `n=${s.length} median ${s[s.length >> 1].toFixed(1)} dB, p90 ${s[Math.floor(s.length * 0.9)].toFixed(1)}, max ${s.at(-1).toFixed(1)}, >+3 dB ${gt(3)}, >+6 dB ${gt(6)}` }
console.log('HF excess at simulated crossfade joins (host plan from Chrome decode):')
console.log('  Chrome guest:', st(C))
console.log('  WebKit guest:', st(W))
writeFileSync(new URL('./safari-joins.json', import.meta.url), JSON.stringify({ chrome: C, webkit: W }))
