// Decode the same Deezer MP3 previews in Chrome and WebKit and measure the sample
// offset between the two decodes (encoder delay / padding handling).
import { chromium, webkit } from 'playwright'
import { readFileSync } from 'node:fs'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8')).slice(0, 6)
const urls = []
for (const t of tracks) urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview })
async function decodeIn(bt, opts) {
  const b = await bt.launch(opts)
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:5304/scripts/qa-audio/vocal.html')
  const out = await p.evaluate(async (urls) => {
    const res = []
    for (const u of urls) {
      const bytes = await (await fetch(u.url)).arrayBuffer()
      const ctx = new OfflineAudioContext(2, 1, 44100)
      const buf = await ctx.decodeAudioData(bytes)
      const d = buf.getChannelData(0)
      res.push({ label: u.label, length: buf.length, sr: buf.sampleRate, head: Array.from(d.subarray(0, 8000)), win: Array.from(d.subarray(441000, 441000 + 4096)), mid: Array.from(d.subarray(430000, 460000)) })
    }
    return res
  }, urls)
  await b.close()
  return out
}
const C = await decodeIn(chromium, { channel: 'chrome' })
const W = await decodeIn(webkit, {})
for (let i = 0; i < C.length; i++) {
  const c = C[i], w = W[i]
  // Find lag of chrome's 4096-sample window (at 441000) inside webkit's 30000-sample block starting at 430000.
  let best = -Infinity, lag = 0
  for (let k = 0; k + 4096 <= w.mid.length; k++) {
    let s = 0, ea = 0, eb = 0
    for (let j = 0; j < 4096; j += 2) { s += c.win[j] * w.mid[k + j]; ea += c.win[j] ** 2; eb += w.mid[k + j] ** 2 }
    const r = s / Math.sqrt(ea * eb + 1e-12)
    if (r > best) { best = r; lag = k }
  }
  const offset = 430000 + lag - 441000 // webkit index - chrome index for the same audio
  const firstNz = (a) => a.findIndex((v) => Math.abs(v) > 1e-4)
  console.log(c.label.padEnd(36), `chrome len ${c.length} webkit len ${w.length} (Δ ${w.length - c.length})`, `offset webkit-chrome ${offset} samples = ${(offset / 44.1).toFixed(2)} ms (corr ${best.toFixed(3)})`, `first>1e-4 chrome ${firstNz(c.head)} webkit ${firstNz(w.head)}`)
}
