// QA (network): time from tapping "Entra" to the inline error, under a signaling fault.
//   node scripts/qa-network/join-timing.mjs <sigblack|sigdown|nohost>
import { chromium } from 'playwright'
const MODE = process.argv[2] ?? 'sigblack'
const BASE = process.argv[3] ?? 'http://127.0.0.1:5306/'
const args = []
if (MODE === 'sigblack') args.push('--host-resolver-rules=MAP 0.peerjs.com 192.0.2.1')
if (MODE === 'sigdown') args.push('--host-resolver-rules=MAP 0.peerjs.com ~NOTFOUND')
const browser = await chromium.launch({ channel: 'chrome', headless: true, args })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
const page = await ctx.newPage()
await page.goto(BASE)
await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
await page.waitForTimeout(1500)
await page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap()
await page.keyboard.type('kxqpm', { delay: 30 })
await page.waitForTimeout(300)
const t = Date.now()
await page.getByRole('button', { name: /^Entra/ }).tap()
const msg = await page.waitForFunction(() => document.querySelector('[role="alert"], .text-coral')?.textContent?.trim() || null, null, { timeout: 60000, polling: 50 })
console.log(MODE, `"${await msg.jsonValue()}"`, `${Date.now() - t} ms after tap`)
await browser.close()
