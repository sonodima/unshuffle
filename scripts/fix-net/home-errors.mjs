// fix-net: how the new transport error messages look on Home (phone + desktop).
//   node scripts/fix-net/home-errors.mjs   (app snapshot on :5459)
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5459/'
const SHOTS = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', headless: true })
for (const [tag, device] of [
  ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 } }],
]) {
  const ctx = await browser.newContext(device)
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
  const page = await ctx.newPage()
  // The signaling server refuses every WebSocket (down / filtered network).
  await page.routeWebSocket(/0\.peerjs\.com/, (ws) => ws.close())
  await page.goto(BASE)
  await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
  const t = Date.now()
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  const msg = page.getByText(/server di collegamento/i).first()
  await msg.waitFor({ timeout: 20000 })
  console.log(tag, 'create error after', Date.now() - t, 'ms:', await msg.innerText())
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}home-signaling-create-${tag}.png` })
  // Join with a code.
  await page.reload()
  await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
  const box = page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  await box.click()
  await page.keyboard.type('kxqpm', { delay: 20 })
  const t2 = Date.now()
  await page.getByRole('button', { name: /^Entra/ }).click()
  const msg2 = page.getByText(/server di collegamento/i).first()
  await msg2.waitFor({ timeout: 20000 })
  console.log(tag, 'join error after', Date.now() - t2, 'ms:', await msg2.innerText())
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}home-signaling-join-${tag}.png` })
  await ctx.close()
}
await browser.close()
