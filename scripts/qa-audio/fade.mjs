import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const urls = []
for (const t of tracks) urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview })
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/fade.html')
await p.waitForFunction(() => window.__fade)
const res = await p.evaluate((u) => window.__fade.run(u), urls)
writeFileSync(new URL('./fade-results.json', import.meta.url), JSON.stringify(res, null, 1))
for (const r of res) {
  if (r.error) { console.log(r.label, r.error); continue }
  console.log(r.label.slice(0, 30).padEnd(30), 'whole', r.whole, 'tail3s', r.tail3s.join(' '), '| head', r.head.join(' '), '| n8 usable', r.n8.usable.join('-'), 'lastEnd', r.n8.lastEnd, 'drop', r.n8.lastDropDb, 'spread', r.n8.spreadDb, '| n16 lastEnd', r.n16.lastEnd, 'drop', r.n16.lastDropDb)
}
await b.close()
