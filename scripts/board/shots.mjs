// Usage: node scripts/board/shots.mjs [filter]
import { chromium } from 'playwright'
const BASE = 'http://localhost:5202/lab/board.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const filter = process.argv[2] ?? ''

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
}

async function open(device, qs) {
  const ctx = await browser.newContext(devices[device])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
  await page.goto(`${BASE}?${qs}`)
  await page.waitForFunction(() => window.__lab && window.__lab.ready(), null, { timeout: 20000 })
  await page.waitForTimeout(600)
  return { ctx, page }
}

const jobs = []
for (const device of ['desktop', 'phone']) {
  for (const n of [6, 8, 12, 16]) jobs.push({ name: `${device}-n${n}`, device, qs: `n=${n}&ui=0` })
  jobs.push({ name: `${device}-locked`, device, qs: `n=8&ui=0&locked=1` })
  jobs.push({ name: `${device}-marks`, device, qs: `n=8&ui=0&marks=1`, wait: 1200 })
  jobs.push({ name: `${device}-lab`, device, qs: `n=8` })
  jobs.push({ name: `${device}-playing`, device, qs: `n=8&ui=0`, play: true })
  jobs.push({ name: `${device}-drag`, device, qs: `n=8&ui=0`, drag: true })
}

for (const job of jobs) {
  if (filter && !job.name.includes(filter)) continue
  const { ctx, page } = await open(job.device, job.qs)
  if (job.wait) await page.waitForTimeout(job.wait)
  if (job.play) {
    await page.locator('.sb-item').nth(2).click()
    await page.waitForTimeout(1300)
  }
  if (job.drag) {
    const a = await page.locator('.sb-item').nth(1).boundingBox()
    const b = await page.locator('.sb-item').nth(2).boundingBox()
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    const tx = b.x + b.width * 0.55, ty = b.y + b.height * 0.5
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(a.x + a.width / 2 + ((tx - a.x - a.width / 2) * i) / 12, a.y + a.height / 2 + ((ty - a.y - a.height / 2) * i) / 12 + 10)
      await page.waitForTimeout(16)
    }
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${OUT}${job.name}.png` })
  if (job.drag) await page.mouse.up()
  console.log('shot', job.name)
  await ctx.close()
}
await browser.close()
