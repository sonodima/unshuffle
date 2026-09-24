// Drives lab/analysis.html (?ids=) on new Deezer previews for n=8,16; saves results + card screenshots.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const here = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://127.0.0.1:5304'
const tracks = JSON.parse(readFileSync(join(here, 'tracks.json'), 'utf8'))
const ns = process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? '8,16'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('pageerror:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()) })
await page.goto(`${BASE}/lab/analysis.html?ids=${tracks.map((t) => t.id).join(',')}&n=${ns}`)
await page.waitForFunction(() => window.__analysis?.done === true, null, { timeout: 15 * 60_000, polling: 1000 })
const results = await page.evaluate(() => window.__analysis.results.map((r) => ({ ...r, cuts: r.cuts.map(({ plan, ...c }) => ({ ...c, plan })) })))
results.forEach((r, i) => (r.label = tracks[i].label))
writeFileSync(join(here, 'cut-results.json'), JSON.stringify(results, null, 1))
mkdirSync(join(here, 'shots'), { recursive: true })
const cards = await page.$$('section.card')
for (let i = 0; i < cards.length; i++) {
  const slug = tracks[i].label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  await cards[i].screenshot({ path: join(here, 'shots', `cut-${String(i).padStart(2, '0')}-${slug}.png`) })
}
await page.screenshot({ path: join(here, 'shots', 'cut-summary.png'), fullPage: false })
for (const r of results) {
  if (r.error) { console.log(r.label, 'ERROR', r.error); continue }
  const line = r.cuts.map((c) => {
    const L = c.lengths
    return `n${c.n} ${c.plan.method} db%${Math.round(c.downbeatPct * 100)} beat%${Math.round(c.beatPct * 100)} min${Math.min(...L).toFixed(2)} max${Math.max(...L).toFixed(2)} str${c.cutStrength}`
  }).join(' | ')
  console.log(r.label.padEnd(44), 'bpm', r.bpm?.toFixed(1), 'conf', r.confidence?.toFixed(2), r.method, `reg ${r.cuts[0].plan.usableStart.toFixed(2)}-${r.cuts[0].plan.usableEnd.toFixed(2)}/${r.duration?.toFixed(2)}`, '|', line, '|', r.tempoDecision)
}
await browser.close()
