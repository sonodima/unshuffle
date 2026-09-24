// Screenshots of new vs old cuts (waveform + spectrogram strips) for a few tracks.
// New cuts: analyzeAndCut live in Chrome. Old cuts: out/baseline.json (afconvert
// decode = WebKit clock, +12 ms to Chrome's). Usage: node scripts/fix-analysis/visual.mjs [n=8]
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5411'
const n = Number(process.argv[2] ?? 8)
const pick = (process.env.PICK ?? 'Bellissima,Andromeda,Pendulum,Take Five,Billie Jean,Zitti').split(',')
const base = JSON.parse(readFileSync(new URL('./out/baseline.json', import.meta.url), 'utf8'))
const rows = base.filter((r) => r.n === n && pick.some((p) => r.label.includes(p)))
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
for (const vp of [{ width: 1440, height: 900, tag: 'd' }, { width: 390, height: 844, tag: 'm' }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/lab/fix-analysis.html`)
  await page.waitForFunction(() => window.__fixAnalysis?.ready === true)
  for (const r of rows) {
    const info = await (await fetch(`https://api.deezer.com/track/${r.id}`)).json()
    const [plan] = await page.evaluate(([u, n]) => window.__fixAnalysis.decode([u], n), [info.preview, n])
    const old = r.cuts.map((t) => t + 529 / 44100)
    await page.evaluate(([u, l, a, b, note]) => window.__fixAnalysis.visual(u, l, a, b, note), [info.preview, `${r.label} · n=${n}`, plan.cuts, old, `${plan.method} ${plan.bpm} BPM`])
  }
  const cards = await page.$$('section.card')
  for (let i = 0; i < cards.length; i++) await cards[i].screenshot({ path: new URL(`./shots/${vp.tag}-n${n}-${i}.png`, import.meta.url).pathname })
  await page.close()
}
await browser.close()
console.log('shots:', rows.map((r) => r.label).join(' | '))
