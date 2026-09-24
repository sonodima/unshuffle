// Lobby at intermediate sizes + reduced motion. Usage: node scripts/lobby/sizes.mjs <tag>
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'z'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
const sizes = [
  { name: 'tablet', w: 768, h: 1024, dsf: 2, q: 'role=host&pl=1&n=5&tab=playlist', touch: true },
  { name: 'lg', w: 1024, h: 768, dsf: 1, q: 'role=host&pl=1&n=5' },
  { name: 'lg-guest', w: 1024, h: 768, dsf: 1, q: 'role=guest&pl=1&n=5' },
  { name: 'xl', w: 1280, h: 800, dsf: 1, q: 'role=host&pl=1&n=3' },
  { name: 'small', w: 360, h: 740, dsf: 2, q: 'role=host&pl=1&n=4', touch: true },
  { name: 'small-guest', w: 360, h: 740, dsf: 2, q: 'role=guest&pl=1&n=4', touch: true },
  { name: 'reduced', w: 390, h: 844, dsf: 2, q: 'role=host&pl=1&n=4&tab=playlist', touch: true, reduced: true },
]
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf, hasTouch: !!s.touch, isMobile: !!s.touch, reducedMotion: s.reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (/LanguageModel|text session|AudioContext was not allowed|reduced motion/i.test(m.text())) return
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${s.name}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${s.name}] pageerror: ${e.message}`))
  await page.goto(`http://127.0.0.1:5211/lab/lobby.html?${s.q}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('main')?.parentElement
    return el ? el.scrollWidth - el.clientWidth : 0
  })
  if (overflow > 0) errors.push(`[${s.name}] horizontal overflow ${overflow}px`)
  await page.screenshot({ path: `${OUT}${tag}-${s.name}.png` })
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors, no overflow')
