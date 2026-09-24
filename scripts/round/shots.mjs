// Usage: node scripts/round/shots.mjs [filter] [--prefix=v1] [--devices=phone,desktop]
import { chromium } from 'playwright'

const BASE = 'http://localhost:5212/lab/round.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const args = process.argv.slice(2)
const filter = args.find((a) => !a.startsWith('--')) ?? ''
const prefix = (args.find((a) => a.startsWith('--prefix=')) ?? '--prefix=v1').slice(9)
const deviceList = (args.find((a) => a.startsWith('--devices=')) ?? '--devices=phone,desktop').slice(10).split(',')

const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true },
}

const jobs = [
  { name: 'preparing', qs: 's=preparing' },
  { name: 'slicing', qs: 's=slicing' },
  { name: 'syncing', qs: 's=syncing' },
  { name: 'prep-error', qs: 's=prep-error' },
  { name: 'intro-card', qs: 's=intro-card', wait: 1400 },
  { name: 'intro', qs: 's=intro&t=300', wait: 1400 },
  { name: 'intro-last', qs: 's=intro-last&t=1000', wait: 1400 },
  { name: 'playing', qs: 's=playing', wait: 1400 },
  { name: 'final', qs: 's=final', wait: 1400 },
  { name: 'mine-first', qs: 's=mine-first', wait: 1400 },
  { name: 'submitted', qs: 's=submitted', wait: 1400 },
  { name: 'spectator', qs: 's=spectator', wait: 1400 },
  { name: 'audioerror', qs: 's=audioerror', wait: 1400 },
  { name: 'timeup', qs: 's=timeup', wait: 1400 },
  { name: 'solo', qs: 's=solo', wait: 1400 },
  { name: 'n16', qs: 's=n16', wait: 1400 },
  { name: 'n6', qs: 's=n6', wait: 1400 },
]

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
let errors = 0
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
      if (m.type() === 'error') {
        errors++
        console.log('CONSOLE', job.name, m.text())
      }
    })
    await page.goto(`${BASE}?ui=0&bg=${process.env.BG ?? 'shader'}&${job.qs}`)
    await page.waitForFunction(() => window.__round, null, { timeout: 15000 })
    await page.waitForFunction(() => window.__round.audioReady() || true, null, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(job.wait ?? 1100)
    await page.screenshot({ path: `${OUT}${prefix}-${device}-${job.name}.png` })
    console.log('shot', `${prefix}-${device}-${job.name}`)
    await ctx.close()
  }
}
await browser.close()
console.log('errors', errors)
