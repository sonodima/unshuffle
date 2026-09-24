// Frame sequence of the choreography at one size. Usage: node scripts/reveal/seq.mjs tag query size t1,t2,...
import { chromium } from 'playwright'
const [tag = 'seq', query = 'me=p-host', size = 'desktop', ts = '400,900,1500,2400,3100,3700,4400,5200,6000,7500'] = process.argv.slice(2)
const V = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext(V[size])
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
await page.goto(`http://localhost:5213/lab/reveal.html?ui=0&${query}`)
await page.waitForFunction(() => ['ready', 'error'].includes(window.__revealLab?.audio), null, { timeout: 20000 }).catch(() => {})
await page.evaluate(() => window.__revealLab?.replay())
const t0 = Date.now()
for (const t of ts.split(',').map(Number)) {
  const wait = t - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  await page.screenshot({ path: `scripts/reveal/shots/${tag}-${size}-${t}.png` })
}
console.log('cues', (await page.evaluate(() => window.__revealLab?.cues ?? [])).join(' '))
if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'))
await browser.close()
