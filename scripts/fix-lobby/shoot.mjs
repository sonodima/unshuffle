// fix-lobby screenshots: node scripts/fix-lobby/shoot.mjs <tag> "<query>" [vp...]
// vp: p390 (390x844@2x), p360 (360x740@2x), d1440, d1280 (1280x720), d1366 (1366x768), d1024 (1024x768)
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5403'
const [tag, query = '', ...vps] = process.argv.slice(2)
const VP = {
  p390: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p360: { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d1440: { width: 1440, height: 900 },
  d1536: { width: 1536, height: 864 },
  d1280: { width: 1280, height: 720 },
  d1280t: { width: 1280, height: 800 },
  d1366: { width: 1366, height: 768 },
  d1024: { width: 1024, height: 768 },
  d1920: { width: 1920, height: 1080 },
  t768: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  l844: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const list = vps.length ? vps : ['p390', 'd1440']
const browser = await chromium.launch({ channel: 'chrome' })
for (const v of list) {
  const o = VP[v]
  const ctx = await browser.newContext({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: o.deviceScaleFactor ?? 1, isMobile: !!o.isMobile, hasTouch: !!o.hasTouch })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
  await page.goto(`${BASE}/lab/fix-lobby.html?${query}`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  if (process.env.ACTION) await new Function('page', `return (async () => { ${process.env.ACTION} })()`)(page)
  const m = await page.evaluate(() => {
    const vw = innerWidth
    const off = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && !b.closest('[aria-label="Categorie"]') && (r.right > vw + 0.5 || r.left < -0.5) }).map((b) => `${b.getAttribute('aria-label') ?? b.textContent.trim().slice(0, 20)} [${Math.round(b.getBoundingClientRect().left)},${Math.round(b.getBoundingClientRect().right)}]`)
    const sc = document.querySelector('.h-dvh')
    return { vw, docOverflowX: document.documentElement.scrollWidth - vw, scrollerOverflowX: sc ? sc.scrollWidth - sc.clientWidth : null, offscreen: off }
  })
  const file = `scripts/fix-lobby/shots/${tag}-${v}.png`
  await page.screenshot({ path: file, fullPage: false })
  console.log(v, file, JSON.stringify(m), errors.length ? 'ERR ' + errors.slice(0, 3).join(' | ') : '')
  await ctx.close()
}
await browser.close()
