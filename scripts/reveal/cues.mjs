// Records the choreography cues (sfx calls) without screenshots, plus console errors.
import { chromium } from 'playwright'
const query = process.argv[2] ?? 'me=p-host'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
await page.goto(`http://localhost:5213/lab/reveal.html?ui=0&${query}`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => ['ready', 'error'].includes(window.__revealLab?.audio), null, { timeout: 20000 }).catch(() => {})
const t0 = await page.evaluate(() => {
  window.__revealLab.replay()
  return performance.now()
})
await page.waitForTimeout(8000)
const cues = await page.evaluate(() => window.__revealLab.cues)
console.log(cues.map((c) => { const [t, n] = c.split(':'); return `${Math.round(Number(t) - t0)}:${n}` }).join(' '))
const state = await page.evaluate(() => ({ stage: document.querySelector('.rv-root')?.getAttribute('data-stage'), audio: window.__revealLab.audio }))
console.log(state)
console.log(errors.length ? 'CONSOLE:\n' + errors.join('\n') : 'no console errors')
await browser.close()
