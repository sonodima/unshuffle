// Real-browser check of the decoder offset fix: Chrome (host) cuts the previews,
// WebKit (iPhone-like guest) re-aligns them to its own decode; Chrome re-aligning
// its own plan must be a no-op. Also confirms the analysis worker (now fed a side
// channel) runs in both engines.
// Usage: node scripts/fix-analysis/browsers.mjs [count=8] (dev server on :5411)
import { chromium, webkit } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5411'
const count = Number(process.argv[2] ?? 8)
const tracks = JSON.parse(readFileSync(new URL('../qa-audio/tracks.json', import.meta.url), 'utf8')).slice(0, count)
const urls = []
for (const t of tracks) {
  const info = await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()
  if (info.preview) urls.push({ label: t.label, url: info.preview })
}

async function open(bt, opts) {
  const b = await bt.launch(opts)
  const p = await b.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await p.goto(`${BASE}/lab/fix-analysis.html`)
  await p.waitForFunction(() => window.__fixAnalysis?.ready === true, null, { timeout: 60000 })
  return { b, p, errors }
}

const C = await open(chromium, { channel: 'chrome' })
const W = await open(webkit, {})
const out = { chrome: [], webkit: [], identity: [], guest: [], reverse: [] }
for (const n of [8, 16]) {
  const hostPlans = await C.p.evaluate(([u, n]) => window.__fixAnalysis.decode(u.map((x) => x.url), n), [urls, n])
  const webkitPlans = await W.p.evaluate(([u, n]) => window.__fixAnalysis.decode(u.map((x) => x.url), n), [urls, n])
  out.chrome.push(...hostPlans.map((r) => ({ n, ms: Math.round(r.ms), method: r.method, error: r.error })))
  out.webkit.push(...webkitPlans.map((r) => ({ n, ms: Math.round(r.ms), method: r.method, error: r.error })))
  const items = hostPlans.filter((r) => r.cuts.length).map((r) => ({ url: r.url, cuts: r.cuts }))
  const id = await C.p.evaluate((it) => window.__fixAnalysis.realign(it), items)
  const guest = await W.p.evaluate((it) => window.__fixAnalysis.realign(it), items)
  // WebKit host → Chrome guest.
  const rev = await C.p.evaluate((it) => window.__fixAnalysis.realign(it), webkitPlans.filter((r) => r.cuts.length).map((r) => ({ url: r.url, cuts: r.cuts })))
  out.identity.push(...id.map((r) => ({ n, ...r })))
  out.guest.push(...guest.map((r) => ({ n, ...r })))
  out.reverse.push(...rev.map((r) => ({ n, ...r })))
}
writeFileSync(new URL('./out/browsers.json', import.meta.url), JSON.stringify(out, null, 1))
const fmt = (rs) => rs.map((r) => (r.changed ? r.offsetMs.toFixed(2) : '·')).join(' ')
console.log('decode sr chrome/webkit:', 'worker plans ok chrome', out.chrome.filter((r) => !r.error && r.method !== 'uniform').length, '/', out.chrome.length, 'webkit', out.webkit.filter((r) => !r.error && r.method !== 'uniform').length, '/', out.webkit.length)
console.log('analysis ms chrome', out.chrome.map((r) => r.ms).join(' '))
console.log('analysis ms webkit', out.webkit.map((r) => r.ms).join(' '))
console.log('Chrome plan on Chrome (identity, · = unchanged):', fmt(out.identity), '| same array:', out.identity.every((r) => r.sameArray))
console.log('Chrome plan on WebKit (offset ms):', fmt(out.guest))
console.log('WebKit plan on Chrome (offset ms):', fmt(out.reverse))
console.log('errors chrome:', C.errors.length ? C.errors : 'none', '| webkit:', W.errors.length ? W.errors : 'none')
await C.b.close()
await W.b.close()
