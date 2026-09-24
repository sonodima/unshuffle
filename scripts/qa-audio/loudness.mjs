// Integrated loudness (BS.1770-ish, K-weighted, gated) of each QA preview at unit gain, as decoded by Chrome.
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const lib = readFileSync(new URL('./qa-lib.js', import.meta.url), 'utf8')
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const urls = []
for (const t of tracks) urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview })
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext()
await ctx.addInitScript({ content: lib })
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
const res = await p.evaluate(async (urls) => {
  const out = []
  const dec = new OfflineAudioContext(2, 1, 48000)
  for (const u of urls) {
    const buf = await dec.decodeAudioData(await (await fetch(u.url)).arrayBuffer())
    const l = buf.getChannelData(0), r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l
    let over = 0
    for (let i = 0; i < l.length; i++) if (Math.abs(l[i]) > 1 || Math.abs(r[i]) > 1) over++
    out.push({ label: u.label, ...window.__qa.loud(l, r, buf.sampleRate), samplesOver0dBFS: over })
  }
  return out
}, urls)
writeFileSync(new URL('./loudness-results.json', import.meta.url), JSON.stringify(res, null, 1))
for (const r of res) console.log(r.label.slice(0, 36).padEnd(36), 'LUFS', r.integratedLUFS, 'maxST', r.maxShortTermLUFS, 'peak', r.peakDbfs, 'over', r.samplesOver0dBFS)
const v = res.map((r) => r.integratedLUFS).sort((a, b) => a - b)
console.log('min', v[0], 'median', v[v.length >> 1], 'max', v.at(-1), 'spread', (v.at(-1) - v[0]).toFixed(1))
await b.close()
