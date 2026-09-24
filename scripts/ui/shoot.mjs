// Screenshots of the UI lab. Usage: node scripts/ui/shoot.mjs [tag] [--sections]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const tag = process.argv[2] ?? 'v'
const sections = process.argv.includes('--sections')
const PAGE = 'http://localhost:5201/lab/ui.html'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []

async function run(name, viewport, dsf) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: name === 'phone', isMobile: name === 'phone' })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${OUT}${tag}-${name}-top.png` })
  if (sections) {
    const ids = await page.$$eval('section[id^="sg-"]', (els) => els.map((e) => e.id))
    for (const id of ids) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), id)
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${OUT}${tag}-${name}-${id}.png` })
    }
  }
  await ctx.close()
}

await run('phone', { width: 390, height: 844 }, 2)
await run('desk', { width: 1440, height: 900 }, 1)
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
