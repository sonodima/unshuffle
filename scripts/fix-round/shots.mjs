// Screenshots + layout measurements of the fix-round lab.
// Usage: node scripts/fix-round/shots.mjs [filter] [--prefix=a] [--devices=phone,desktop]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5401/lab/fix-round.html'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const args = process.argv.slice(2)
const filter = args.find((a) => !a.startsWith('--')) ?? ''
const prefix = (args.find((a) => a.startsWith('--prefix=')) ?? '--prefix=a').slice(9)
const deviceList = (args.find((a) => a.startsWith('--devices=')) ?? '--devices=phone,desktop').slice(10).split(',')

const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  s740: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, hasTouch: true },
  air: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true },
  ipadland: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, hasTouch: true },
  mid: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 },
}

const jobs = [
  { name: 'preparing', qs: 's=syncing' },
  { name: 'prep-error', qs: 's=prep-error' },
  { name: 'intro-ready', qs: 's=intro-card', wait: 1400 },
  { name: 'intro-3', qs: 's=intro&t=300', wait: 900 },
  { name: 'intro-2', qs: 's=intro&t=1300', wait: 900 },
  { name: 'intro-1', qs: 's=intro&t=2300', wait: 900 },
  { name: 'playing', qs: 's=playing', wait: 1400 },
  { name: 'playing-p10', qs: 's=playing&players=10', wait: 1400 },
  { name: 'playing-p6', qs: 's=playing&players=6', wait: 1400 },
  { name: 'final', qs: 's=final&t=-2000', wait: 1100 },
  { name: 'final-long', qs: 's=final&t=-2000&name2=Signor%20Maritozzo&players=6', wait: 1100 },
  { name: 'mine-first', qs: 's=mine-first&t=-1500', wait: 1100 },
  { name: 'submitted', qs: 's=submitted', wait: 1400 },
  { name: 'submitted-p10', qs: 's=submitted&players=10', wait: 1400 },
  { name: 'spectator', qs: 's=spectator', wait: 1400 },
  { name: 'spectator-late', qs: 's=spectator', wait: 4600 },
  { name: 'audioerror', qs: 's=audioerror', wait: 1400 },
  { name: 'timeup', qs: 's=timeup', wait: 1400 },
  { name: 'solo', qs: 's=solo', wait: 1400 },
  { name: 'n16', qs: 's=n16&players=8', wait: 1400 },
  { name: 'tie', qs: 's=playing&tie=1', wait: 1400 },
]

function measure() {
  const r = (el) => {
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }
  }
  const header = document.querySelector('[data-round-view="playing"] header')
  let maxRight = 0
  if (header) for (const el of header.querySelectorAll('*')) maxRight = Math.max(maxRight, el.getBoundingClientRect().right)
  const ring = header?.querySelector('[role="timer"]')
  const ringBox = r(ring)
  return {
    vw: innerWidth,
    docOverflowX: document.documentElement.scrollWidth - innerWidth,
    headerMaxRight: Math.round(maxRight),
    ringOffset: ringBox ? Math.round(ringBox.x + ringBox.w / 2 - innerWidth / 2) : null,
    timer: ringBox,
    banner: r(document.querySelector('[data-first-submit-banner]')),
    board: r(document.querySelector('.sb-board')),
    dockTitle: (() => {
      const p = document.querySelector('footer [role="status"] p')
      return p ? { scroll: p.scrollWidth, client: p.clientWidth } : null
    })(),
    rankText: [...(header?.querySelectorAll('span') ?? [])].map((s) => s.textContent).find((t) => /posto$/.test(t ?? '')) ?? null,
  }
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
let errors = 0
const results = {}
for (const device of deviceList) {
  for (const job of jobs) {
    if (filter && !job.name.includes(filter)) continue
    const ctx = await browser.newContext(devices[device])
    const page = await ctx.newPage()
    page.on('pageerror', (e) => {
      errors++
      console.log('PAGEERROR', job.name, e.message)
    })
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        if (m.type() === 'error') errors++
        console.log(m.type().toUpperCase(), job.name, m.text().slice(0, 300))
      }
    })
    await page.goto(`${BASE}?ui=0&bg=${process.env.BG ?? 'css'}&engine=${process.env.ENGINE ?? 'mock'}&${job.qs}`)
    await page.waitForFunction(() => window.__round, null, { timeout: 15000 })
    await page.waitForTimeout(job.wait ?? 1100)
    const m = await page.evaluate(measure)
    results[`${device}-${job.name}`] = m
    await page.screenshot({ path: `${OUT}${prefix}-${device}-${job.name}.png` })
    console.log(`${prefix}-${device}-${job.name}`, JSON.stringify(m))
    await ctx.close()
  }
}
await browser.close()
console.log('errors', errors)
