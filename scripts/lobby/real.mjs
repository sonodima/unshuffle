// Real Deezer (JSONP) smoke test of the picker. Usage: node scripts/lobby/real.mjs <tag>
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'r'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (/LanguageModel|text session|AudioContext was not allowed/.test(m.text())) return
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
const t0 = Date.now()
await page.goto('http://127.0.0.1:5211/lab/lobby.html?role=host&pl=0&n=3&catalog=real', { waitUntil: 'domcontentloaded' })
await page.locator('button[aria-pressed]').filter({ hasText: 'brani' }).first().waitFor({ timeout: 20000 })
console.log('featured loaded in', Date.now() - t0, 'ms:', await page.locator('button[aria-pressed]').filter({ hasText: 'brani' }).count(), 'cards')
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}${tag}-featured.png` })
await page.getByRole('searchbox', { name: 'Cerca playlist' }).fill('vasco rossi')
await page.waitForTimeout(400)
await page.getByRole('heading', { name: /vasco rossi/ }).waitFor({ timeout: 15000 })
await page.waitForTimeout(2500)
console.log('search cards:', await page.locator('button[aria-pressed]').filter({ hasText: 'brani' }).count())
await page.screenshot({ path: `${OUT}${tag}-search.png` })
await page.getByRole('searchbox', { name: 'Cerca playlist' }).fill('https://www.deezer.com/it/playlist/878989033')
await page.getByText('Playlist scelta dal link').waitFor({ timeout: 15000 })
console.log('link hero:', await page.locator('section[aria-label="Playlist scelta"] h2').textContent())
await page.getByRole('searchbox', { name: 'Cerca playlist' }).fill('https://www.deezer.com/it/playlist/1')
await page.waitForTimeout(3500)
console.log('bad id notice:', await page.getByRole('alert').allTextContents())
await page.screenshot({ path: `${OUT}${tag}-badid.png` })
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
