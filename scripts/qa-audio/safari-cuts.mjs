// A Chrome host's cut plan applied to a WebKit (Safari) guest's decode of the same MP3:
// does the end of each snippet now contain the start of the next attack?
import { chromium, webkit } from 'playwright'
import { readFileSync } from 'node:fs'
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
      out.push({ label: u.label, url: u.url, n, cuts: r.plan.segments.slice(1).map((s) => s.start) })
    }
  }
  return out
}, urls)
const measure = (plans) => {
  // tail ratio: RMS of the last 8 ms before the cut vs RMS of 8..40 ms before the cut (dB)
  return (async () => {
    const dec = new OfflineAudioContext(1, 1, 44100)
    const cache = new Map()
    const res = []
    for (const p of plans) {
      let x = cache.get(p.url)
      if (!x) { const b = await dec.decodeAudioData(await (await fetch(p.url)).arrayBuffer()); x = b.getChannelData(0).slice(); cache.set(p.url, x) }
      const sr = 44100
      const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)) }
      for (const c of p.cuts) {
        const i = Math.round(c * sr)
        const tail = rms(i - Math.round(0.008 * sr), i), before = rms(i - Math.round(0.04 * sr), i - Math.round(0.008 * sr))
        const head = rms(i, i + Math.round(0.008 * sr))
        res.push({ tailDb: 20 * Math.log10((tail + 1e-9) / (before + 1e-9)), headDb: 20 * Math.log10((head + 1e-9) / (before + 1e-9)) })
      }
    }
    return res
  })()
}
const inChrome = await cp.evaluate(measure, plans)
const wb = await webkit.launch()
const wp = await wb.newPage()
await wp.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
const inWebkit = await wp.evaluate(measure, plans)
const stats = (a, k) => {
  const v = a.map((x) => x[k]).sort((p, q) => p - q)
  const gt = (t) => v.filter((x) => x > t).length
  return `median ${v[v.length >> 1].toFixed(1)} dB, p90 ${v[Math.floor(v.length * 0.9)].toFixed(1)} dB, >+6 dB: ${gt(6)}/${v.length}, >+10 dB: ${gt(10)}/${v.length}`
}
console.log('last 8 ms of a snippet vs the 32 ms before it (a rise = the next attack leaked into this snippet):')
console.log('  Chrome decode (host = guest):', stats(inChrome, 'tailDb'))
console.log('  WebKit decode (Safari guest):', stats(inWebkit, 'tailDb'))
await cb.close(); await wb.close()
