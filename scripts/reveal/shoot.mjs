// Screenshots of the reveal lab at phone + desktop sizes, mid and after the choreography.
// Usage: node scripts/reveal/shoot.mjs [tag] [query] [times(ms,comma)] [sizes: phone,desktop]
import { chromium } from 'playwright'

const tag = process.argv[2] ?? 'r'
const query = process.argv[3] ?? 'me=p-host'
const times = (process.argv[4] ?? '1800,7000').split(',').map(Number)
const sizes = (process.argv[5] ?? 'phone,desktop').split(',')
const base = 'http://localhost:5213/lab/reveal.html'

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle'] })
const errors = []
for (const size of sizes) {
  const ctx = await browser.newContext(VIEWPORTS[size])
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${size}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${size}] pageerror: ${e.message}`))
  await page.goto(`${base}?ui=0&${query}`, { waitUntil: 'domcontentloaded' })
  // Wait for the audio (waveforms), then replay so every run starts from zero.
  await page.waitForFunction(() => window.__revealLab?.audio === 'ready' || window.__revealLab?.audio === 'error', null, { timeout: 20000 }).catch(() => {})
  await page.evaluate(() => window.__revealLab?.replay())
  const t0 = Date.now()
  for (const t of times) {
    const wait = t - (Date.now() - t0)
    if (wait > 0) await page.waitForTimeout(wait)
    const file = `scripts/reveal/shots/${tag}-${size}-${t}.png`
    await page.screenshot({ path: file, fullPage: false })
    console.log(file)
  }
  const cues = await page.evaluate(() => window.__revealLab?.cues ?? [])
  console.log(`[${size}] cues:`, cues.join(' '))
  await ctx.close()
}
await browser.close()
if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'))
