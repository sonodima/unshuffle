// List elements that still have a backdrop-filter on home / lobby of the real app.
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://localhost:5407/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext(DEVICE === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const list = () => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    const bf = cs.backdropFilter || cs.webkitBackdropFilter
    if (!bf || bf === 'none') continue
    const r = el.getBoundingClientRect()
    const w = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)), h = Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top))
    if (w * h < 1 || cs.visibility === 'hidden') continue
    out.push(`${Math.round((w * h) / (vw * vh) * 100)}% ${bf} <${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') ?? '')}> ${String(el.className).slice(0, 110)}`)
  }
  return out
})
await page.goto(BASE); await page.locator('[data-screen-frame][data-screen="home"]').waitFor(); await page.waitForTimeout(1500)
console.log('HOME', DEVICE, '\n ' + (await list()).join('\n '))
await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
await page.locator('[data-screen-frame][data-screen="lobby"]').waitFor({ timeout: 30000 }); await page.waitForTimeout(2000)
console.log('LOBBY', DEVICE, '\n ' + (await list()).join('\n '))
await browser.close()
