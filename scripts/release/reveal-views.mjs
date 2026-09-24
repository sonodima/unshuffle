// Reveal lab: settle the choreography, then shoot the board in both views
// ('Ordine giusto' and 'Il tuo ordine') on a phone and a desktop.
//   BASE=http://localhost:5500/lab/fix-reveal.html node scripts/release/reveal-views.mjs [tag]
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:5500/lab/fix-reveal.html'
const tag = process.argv[2] ?? 'rv'
const query = process.env.Q ?? 'me=p-host'
const sizes = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const errors = []
for (const [name, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${name}] ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
  await page.goto(`${base}?ui=0&${query}`)
  await page.waitForFunction(() => window.__fixReveal?.audio === 'ready', null, { timeout: 30000 }).catch(() => {})
  await page.evaluate(() => window.__fixReveal?.replay())
  await page.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25000 })
  await page.waitForTimeout(900)
  const board = page.locator('.rv-area-board').first()
  await board.scrollIntoViewIfNeeded()
  await board.screenshot({ path: `scripts/release/shots/${tag}-${name}-correct.png` })
  const mine = page.getByRole('radio', { name: /Il tuo ordine/ })
  if (await mine.count()) {
    await mine.first().click()
    await page.waitForTimeout(1200)
    await board.screenshot({ path: `scripts/release/shots/${tag}-${name}-mine.png` })
  } else console.log(name, 'no view toggle')
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.rv-board .sb-item')].map((el) => {
      const slot = el.querySelector('.sb-slot, .sb-chip')
      const cs = slot ? getComputedStyle(slot) : null
      const after = slot ? getComputedStyle(slot, '::after').content : null
      return { seg: el.getAttribute('data-seg'), mark: el.querySelector('.sb-block')?.getAttribute('data-mark'), text: slot?.textContent, opacity: cs?.opacity, after }
    }),
  )
  console.log(name, JSON.stringify(chips))
  await ctx.close()
}
await browser.close()
console.log(errors.length ? `console: ${errors.join(' | ')}` : 'console clean')
