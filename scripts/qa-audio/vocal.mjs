import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const urls = []
for (const t of tracks) {
  const d = await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()
  urls.push({ id: t.id, label: t.label, url: d.preview })
}
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error(m.text()) })
await page.goto('http://127.0.0.1:5304/scripts/qa-audio/vocal.html')
await page.waitForFunction(() => window.__qa)
const res = await page.evaluate(({ urls }) => window.__qa.run(urls, [8, 16]), { urls })
writeFileSync(new URL('./vocal-results.json', import.meta.url), JSON.stringify(res, null, 1))
let T8 = 0, C8 = 0, T16 = 0, C16 = 0, A8 = 0, A16 = 0
for (const r of res) {
  if (r.error) { console.log(r.label, r.error); continue }
  console.log(r.label.padEnd(42), ['n8', 'n16'].map((k) => `${k} ${r[k].method} through ${r[k].through}/${r[k].of} (beat base ${r[k].beatThroughRate}) avoidable ${r[k].avoidable}`).join(' | '))
  T8 += r.n8.through; C8 += r.n8.of; T16 += r.n16.through; C16 += r.n16.of; A8 += r.n8.avoidable; A16 += r.n16.avoidable
}
console.log(`TOTAL n8 through ${T8}/${C8} avoidable ${A8}; n16 through ${T16}/${C16} avoidable ${A16}`)
await browser.close()
