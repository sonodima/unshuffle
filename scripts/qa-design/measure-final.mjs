// Final screen: where does the fixed action dock (and its gradient) land vs. the podium plates and the first section heading?
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h] of [[1440, 900], [1280, 720], [1366, 768], [1536, 864], [1920, 1080], [390, 844], [360, 740]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(`${BASE}/lab/final.html?v=final&ui=0&celebrate=0`, { waitUntil: 'load' })
  await page.waitForTimeout(4500)
  const m = await page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) } }
    const dock = r(document.querySelector('[role="group"][aria-label="Azioni"]'))
    const heads = [...document.querySelectorAll('h2')].map((e) => ({ t: e.textContent.trim(), ...r(e) }))
    const plates = [...document.querySelectorAll('main button')].slice(0, 3).map(r)
    const fade = [...document.querySelectorAll('div[aria-hidden]')].find((e) => getComputedStyle(e).position === 'fixed')
    return { vh: innerHeight, dock, fade: r(fade), heads: heads.slice(0, 2), podiumButtons: plates }
  })
  console.log(`${w}x${h}`, JSON.stringify(m))
  await page.close()
}
await browser.close()
