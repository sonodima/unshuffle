// Screenshots of the final lab. Usage: node scripts/final/shoot.mjs <tag> [variant=final] [me=p-host] [--full] [--mid] [--reduced]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const [tag = 'v', variant = 'final', me = 'p-host'] = args.filter((a) => !a.startsWith('--'))
const PAGE = `http://localhost:5214/lab/final.html?ui=0&v=${variant}&me=${me}`
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []

async function run(name, viewport, dsf) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: dsf,
    hasTouch: name === 'phone',
    isMobile: name === 'phone',
    reducedMotion: flags.has('--reduced') ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  if (flags.has('--mid')) {
    await page.waitForTimeout(1250)
    await page.screenshot({ path: `${OUT}${tag}-${name}-mid.png` })
  }
  await page.waitForTimeout(flags.has('--mid') ? 3200 : 4400)
  await page.screenshot({ path: `${OUT}${tag}-${name}-top.png` })
  if (flags.has('--full')) {
    const scroller = 'main'
    const h = await page.evaluate((sel) => document.querySelector(sel).parentElement.scrollHeight, scroller)
    let y = viewport.height * 0.85
    let i = 1
    while (y < h) {
      await page.evaluate(([sel, top]) => document.querySelector(sel).parentElement.scrollTo(0, top), [scroller, y])
      await page.waitForTimeout(1700)
      await page.screenshot({ path: `${OUT}${tag}-${name}-s${i}.png` })
      y += viewport.height * 0.85
      i++
    }
  }
  await ctx.close()
}

if (!flags.has('--desk-only')) await run('phone', { width: 390, height: 844 }, 2)
if (!flags.has('--phone-only')) await run('desk', { width: 1440, height: 900 }, 1)
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
