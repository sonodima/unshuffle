// Real RoundScreen over a seeded store: node scripts/round/connected.mjs
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
let errors = 0
for (const s of ['playing', 'intro', 'syncing', 'final', 'audioerror']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => (errors++, console.log('PAGEERROR', s, e.message)))
  page.on('console', (m) => m.type() === 'error' && (errors++, console.log('CONSOLE', s, m.text())))
  await page.goto(`http://localhost:5212/lab/round.html?connected=1&bg=css&s=${s}&t=300`)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}c-${s}.png` })
  console.log('shot', s, await page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute('data-phase')))
  await page.close()
}
await browser.close()
console.log('errors', errors)
