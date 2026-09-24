// Screenshots of the reveal lab (fix-reveal). Usage:
//   node scripts/fix-reveal/shoot.mjs <tag> "<query>" <times ms,comma> <sizes,comma> [scrollTo: top|bottom|score|lead]
import { chromium } from 'playwright'

const tag = process.argv[2] ?? 'r'
const query = process.argv[3] ?? 'me=p-host'
const times = (process.argv[4] ?? '1800,7000').split(',').map(Number)
const sizes = (process.argv[5] ?? 'phone,desktop').split(',')
const scroll = process.argv[6] ?? ''
const base = process.env.BASE ?? 'http://localhost:5402/lab/fix-reveal.html'

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  ipadl: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  l800: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  l1536: { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  full: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
}

if (process.env.SCALE) for (const v of Object.values(VIEWPORTS)) v.deviceScaleFactor = Number(process.env.SCALE)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle'] })
const errors = []
for (const size of sizes) {
  const ctx = await browser.newContext({ ...VIEWPORTS[size], reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${size}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${size}] pageerror: ${e.message}`))
  await page.goto(`${base}?ui=0&${query}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => (window.__fixReveal ?? window.__revealLab)?.audio === 'ready' || (window.__fixReveal ?? window.__revealLab)?.audio === 'error', null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(300)
  await page.evaluate(() => (window.__fixReveal ?? window.__revealLab)?.replay())
  const t0 = Date.now()
  for (const t of times) {
    const wait = t - (Date.now() - t0)
    if (wait > 0) await page.waitForTimeout(wait)
    if (scroll) {
      await page.evaluate((where) => {
        const root = document.querySelector('.rv-root')
        if (!root) return
        if (where === 'bottom') root.scrollTop = root.scrollHeight
        else if (where === 'top') root.scrollTop = 0
        else if (where === 'score') document.querySelector('.rv-area-score')?.scrollIntoView({ block: 'center' })
        else if (where === 'lead') document.querySelector('.rv-area-lead')?.scrollIntoView({ block: 'center' })
        else if (/^\d+$/.test(where)) root.scrollTop = Number(where)
      }, scroll)
      await page.waitForTimeout(250)
    }
    const file = `scripts/fix-reveal/shots/${tag}-${size}-${t}.png`
    const clip = process.env.CLIP ? (([x, y, width, height]) => ({ x, y, width, height }))(process.env.CLIP.split(',').map(Number)) : undefined
    const sel = process.env.SEL
    if (sel) await page.locator(sel).first().screenshot({ path: file })
    else await page.screenshot({ path: file, fullPage: false, clip })
    console.log(file)
  }
  await ctx.close()
}
await browser.close()
if (errors.length) console.log('CONSOLE:\n' + [...new Set(errors)].join('\n'))
