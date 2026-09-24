// Count elements with backdrop-filter per screen and their visible area.
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const report = (page, label) => page.evaluate((label) => {
  const vw = innerWidth, vh = innerHeight
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    const bf = cs.backdropFilter || cs.webkitBackdropFilter
    if (!bf || bf === 'none') continue
    const r = el.getBoundingClientRect()
    const w = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)), h = Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top))
    if (w * h < 1 || cs.visibility === 'hidden' || el.closest('[inert]')) continue
    out.push({ cls: (el.className?.toString?.() ?? '').split(' ').filter((c) => /glass|backdrop|panel|btn|chip|rounded-panel|bg-ink/.test(c)).slice(0, 4).join(' ') || el.tagName, bf, area: Math.round((w * h) / (vw * vh) * 100) })
  }
  const total = out.reduce((a, x) => a + x.area, 0)
  return `${label}: ${out.length} backdrop-filter elements, summed area ${total}% of viewport; top: ` + out.sort((a, b) => b.area - a.area).slice(0, 6).map((x) => `${x.cls}[${x.bf}] ${x.area}%`).join(' ; ')
}, label)
for (const device of ['desktop', 'phone']) {
  const { page } = await G.newPlayer(browser, device)
  await page.goto(BASE); await G.waitScreen(page, 'home'); await page.waitForTimeout(1500)
  console.log(device, await report(page, 'home'))
  await G.createRoom(page); await page.waitForTimeout(1500)
  console.log(device, await report(page, 'lobby'))
}
await browser.close()
