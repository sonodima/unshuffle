// Screenshots + layout measurements of the fix-final lab.
// Usage: node scripts/fix-final/shoot.mjs <tag> [variant=final] [me=p-host] [--sizes=390x844@2,1440x900] [--wait=4600] [--scroll=0.9,1.8] [--reduced] [--at=1.2,2.4]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)] }))
const [tag = 'v', variant = 'final', me = 'p-host'] = args.filter((a) => !a.startsWith('--'))
const BASE = process.env.BASE ?? 'http://localhost:5405'
const PAGE = `${BASE}/lab/fix-final.html?ui=0&v=${variant}&me=${me}${opt.celebrate === '0' ? '&celebrate=0' : ''}${opt.q ? '&' + opt.q : ''}`
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const sizes = (opt.sizes ?? '390x844@2,1440x900').split(',').map((s) => { const [wh, d = '1'] = s.split('@'); const [w, h] = wh.split('x').map(Number); return { w, h, dsf: Number(d) } })
const wait = Number(opt.wait ?? 4600)
const scrolls = opt.scroll ? opt.scroll.split(',').map(Number) : []
const ats = opt.at ? opt.at.split(',').map(Number) : []

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const { w, h, dsf } of sizes) {
  const phone = w < 768
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, hasTouch: phone, isMobile: phone && w < 640, reducedMotion: opt.reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${w}] ${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => errors.push(`[${w}] pageerror: ${e.message}`))
  await page.goto(PAGE, { waitUntil: 'load' })
  const t0 = Date.now()
  for (const at of ats) {
    const dt = at * 1000 - (Date.now() - t0)
    if (dt > 0) await page.waitForTimeout(dt)
    await page.screenshot({ path: `${OUT}${tag}-${w}x${h}-t${at}.png` })
  }
  const rest = wait - (Date.now() - t0)
  if (rest > 0) await page.waitForTimeout(rest)
  const m = await page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    const scroller = document.querySelector('main').parentElement
    return {
      vh: innerHeight,
      docOverflowX: document.documentElement.scrollWidth - innerWidth,
      scrollerOverflowX: scroller.scrollWidth - scroller.clientWidth,
      scrollH: scroller.scrollHeight,
      h1: r(document.querySelector('h1')),
      h1sw: document.querySelector('h1')?.scrollWidth, h1cw: document.querySelector('h1')?.clientWidth, h1fs: getComputedStyle(document.querySelector('h1')).fontSize,
      dock: r(document.querySelector('[role="group"][aria-label="Azioni"]')),
      heads: [...document.querySelectorAll('h2')].map((e) => [e.textContent.trim(), ...r(e)]),
      plates: [...document.querySelectorAll('.fp-plate')].map(r),
      sound: r(document.querySelector('[data-sound-controls], button[aria-label*="Audio"], button[aria-label*="audio"]')),
    }
  })
  console.log(`${w}x${h}`, JSON.stringify(m))
  await page.screenshot({ path: `${OUT}${tag}-${w}x${h}.png` })
  for (const [i, f] of scrolls.entries()) {
    await page.evaluate((y) => document.querySelector('main').parentElement.scrollTo(0, y * innerHeight), f)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}${tag}-${w}x${h}-s${i + 1}.png` })
  }
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
