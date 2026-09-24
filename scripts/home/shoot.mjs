// Home lab screenshots. Usage: node scripts/home/shoot.mjs <tag> [states=idle] [views=phone,small,desk] [waitMs=2600] [extra query]
import { chromium } from 'playwright'
const [tag = 'x', statesArg = 'idle', viewsArg = 'phone,small,desk', wait = '2600', extra = ''] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const VIEWS = {
  phone: [{ width: 390, height: 844 }, 2, true],
  small: [{ width: 360, height: 740 }, 2, true],
  desk: [{ width: 1440, height: 900 }, 1, false],
  laptop: [{ width: 1280, height: 720 }, 1, false],
  tablet: [{ width: 820, height: 1180 }, 1, true],
}
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const state of statesArg.split(',')) {
  for (const v of viewsArg.split(',')) {
    const [viewport, dsf, mobile] = VIEWS[v]
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: mobile, isMobile: mobile })
    await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
    const page = await ctx.newPage()
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${state}/${v}] ${m.text()}`))
    page.on('pageerror', (e) => errors.push(`[${state}/${v}] pageerror: ${e.message}`))
    await page.goto(`http://127.0.0.1:5210/lab/home.html?state=${state}${extra ? '&' + extra : ''}`, { waitUntil: 'load' })
    await page.waitForTimeout(Number(wait))
    await page.screenshot({ path: `${OUT}${tag}-${state}-${v}.png` })
    const overflow = await page.evaluate(() => {
      const sc = document.querySelector('.h-dvh')
      return { docW: document.documentElement.scrollWidth, winW: innerWidth, scrollH: sc?.scrollHeight, clientH: sc?.clientHeight }
    })
    if (overflow.docW > overflow.winW) errors.push(`[${state}/${v}] horizontal overflow ${overflow.docW} > ${overflow.winW}`)
    console.log(`${state}/${v}`, JSON.stringify(overflow))
    await ctx.close()
  }
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
