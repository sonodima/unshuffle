// Screenshots: app home (old vs new build) and the lab, at 390x844@2x and 1440x900.
import { chromium } from 'playwright'
const out = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] })
const VIEWS = [['p390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['d1440', { viewport: { width: 1440, height: 900 } }]]
const PAGES = (process.env.PAGES ?? 'old:http://localhost:5464/,new:http://localhost:5465/,labglass:http://localhost:5413/lab/fix-background.html?glass=1&music=1').split(',').map((s) => { const i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)] })
for (const [vname, opts] of VIEWS) {
  for (const [name, url] of PAGES) {
    const ctx = await browser.newContext(opts)
    await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForTimeout(Number(process.env.WAIT ?? 3500))
    await page.screenshot({ path: `${out}${name}-${vname}.png` })
    console.log(name, vname, errors.length ? errors.join(' | ') : 'no console errors')
    await ctx.close()
  }
}
await browser.close()
