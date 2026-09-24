import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const V = JSON.parse(readFileSync(new URL('./vocal-results.json', import.meta.url), 'utf8'))
const pick = [['Annalisa', 'n8'], ['Pausini', 'n8'], ['Elodie', 'n8'], ['Sfera', 'n8']]
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto('http://127.0.0.1:5304/scripts/qa-audio/vocal.html')
await page.waitForFunction(() => window.__qa?.spectro)
for (const [name, k] of pick) {
  const r = V.find((x) => x.label.includes(name))
  const d = await (await fetch(`https://api.deezer.com/track/${r.id}`)).json()
  const times = r[k].cuts.slice(0, 6).map((c) => c.t)
  const label = `${r.label} ${k}: ` + r[k].cuts.slice(0, 6).map((c) => `${c.t}${c.through ? '(THROUGH)' : ''}`).join(' ')
  await page.evaluate(async ({ url, times, label }) => { document.body.innerHTML = ''; await window.__qa.spectro(url, times, label) }, { url: d.preview, times, label })
  await page.locator('body > div').screenshot({ path: new URL(`./shots/spectro-${name}.png`, import.meta.url).pathname })
}
await browser.close()
