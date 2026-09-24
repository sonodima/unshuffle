// Live engine checks in Chrome: sample-exact output with the loudness trim, stall tolerance, reorder latency, levels latency.
// usage: node scripts/fix-audio/live.mjs [exact] [stalls] [reorders] [latency]   (CPU=4 to throttle)
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const want = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['exact', 'stalls', 'reorders', 'latency'])
const id = Number(process.env.TRACK ?? 13791930) // Nirvana: steady, loud master
const url = (await (await fetch(`https://api.deezer.com/track/${id}`)).json()).preview
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()) })
p.on('pageerror', (e) => console.log('[pageerror]', e.message))
await p.goto(`${BASE}/lab/fix-audio.html`)
await p.waitForFunction(() => window.__fixAudio?.ready)
if (process.env.CPU) {
  const cdp = await p.context().newCDPSession(p)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) })
}
const out = {}
if (want.has('exact')) { out.exact = await p.evaluate((u) => window.__fixAudio.exactWithTrim(u), url); console.log('exact', JSON.stringify(out.exact)) }
if (want.has('stalls')) { out.stalls = await p.evaluate(([u, st]) => window.__fixAudio.stalls(u, st), [url, (process.env.STALLS ?? '150,350,600,900,1300').split(',').map(Number)]); for (const r of out.stalls) console.log('stall', JSON.stringify(r)) }
if (want.has('reorders')) { out.reorders = await p.evaluate((u) => window.__fixAudio.reorders(u), url); for (const r of out.reorders) console.log('reorder', JSON.stringify(r)) }
if (want.has('latency')) { out.latency = await p.evaluate((u) => window.__fixAudio.latency(u, 0.2), url); console.log('latency', JSON.stringify(out.latency)) }
writeFileSync(new URL(`./live-out${process.env.TAG ? '-' + process.env.TAG : ''}.json`, import.meta.url), JSON.stringify(out, null, 1))
await b.close()
