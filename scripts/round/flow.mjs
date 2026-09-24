// Live flow: preparing → intro → VIA → playing → first submit → my confirm.
// Usage: node scripts/round/flow.mjs [phone|desktop] [prefix]
import { chromium } from 'playwright'

const device = process.argv[2] ?? 'phone'
const prefix = process.argv[3] ?? 'f1'
const OUT = new URL('./shots/', import.meta.url).pathname
const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext(devices[device])
const page = await ctx.newPage()
let errors = 0
page.on('pageerror', (e) => (errors++, console.log('PAGEERROR', e.message)))
page.on('console', (m) => m.type() === 'error' && (errors++, console.log('CONSOLE', m.text())))
await page.goto(`http://localhost:5212/lab/round.html?ui=0&s=flow&bg=${process.env.BG ?? 'shader'}`)
await page.waitForFunction(() => window.__round, null, { timeout: 15000 })
const t0 = Date.now()
const at = async (ms, name) => {
  const wait = ms - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  await page.screenshot({ path: `${OUT}${prefix}-${device}-${String(ms).padStart(5, '0')}-${name}.png` })
  console.log('shot', ms, name, await page.evaluate(() => window.__round.phase()))
}
await at(700, 'picking')
await at(2200, 'slicing')
await at(3700, 'syncing')
await at(4700, 'intro-card')
await at(5500, 'count3')
await at(7400, 'count1')
await at(8350, 'via')
await at(8700, 'via2')
await at(9300, 'board-in')
await at(11000, 'playing')
// Drag one block onto another (pointer)
const a = await page.locator('.sb-item').nth(0).boundingBox()
const b = await page.locator('.sb-item').nth(3).boundingBox()
if (a && b) {
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * i) / 10, a.y + a.height / 2 + ((b.y - a.y) * i) / 10)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}
await at(17600, 'first-submit')
await at(19000, 'first-submit2')
await page.getByRole('button', { name: /conferma/i }).click()
await at(19400, 'confirm-burst')
await at(20500, 'confirmed')
console.log('sfx', await page.evaluate(() => window.__round.sfx.join(',')))
console.log('errors', errors)
await browser.close()
