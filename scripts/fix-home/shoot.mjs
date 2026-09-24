// fix-home lab screenshots. node scripts/fix-home/shoot.mjs <tag> [states=idle] [views=phone,desk] [waitMs=2600] [extra query]
import { chromium } from 'playwright'
const [tag = 'x', statesArg = 'idle', viewsArg = 'phone,desk', wait = '2600', extra = ''] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const PORT = process.env.PORT ?? '5404'
const VIEWS = {
  phone: [{ width: 390, height: 844 }, 2, true],
  small: [{ width: 360, height: 740 }, 2, true],
  se: [{ width: 375, height: 667 }, 2, true],
  desk: [{ width: 1440, height: 900 }, 1, false],
  laptop: [{ width: 1280, height: 720 }, 1, false],
  tablet: [{ width: 820, height: 1180 }, 1, true],
  ipadl: [{ width: 1024, height: 768 }, 1, true],
  land: [{ width: 844, height: 390 }, 2, true],
  landse: [{ width: 667, height: 375 }, 2, true],
  landmax: [{ width: 932, height: 430 }, 2, true],
  landand: [{ width: 740, height: 360 }, 2, true],
  short: [{ width: 1280, height: 480 }, 1, false],
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
    await page.goto(`http://127.0.0.1:${PORT}/lab/fix-home.html?state=${state}${extra ? '&' + extra : ''}`, { waitUntil: 'load' })
    await page.waitForTimeout(Number(wait))
    await page.screenshot({ path: `${OUT}${tag}-${state}-${v}.png` })
    const info = await page.evaluate(() => {
      const sc = document.querySelector('.h-dvh')
      const cta = [...document.querySelectorAll('button')].find((b) => /Crea (una )?stanza|Entra/.test(b.textContent ?? ''))
      const r = cta?.getBoundingClientRect()
      return { docW: document.documentElement.scrollWidth, winW: innerWidth, vh: innerHeight, scrollH: sc?.scrollHeight, clientH: sc?.clientHeight, cta: cta ? `${cta.textContent?.trim()} ${Math.round(r.top)}-${Math.round(r.bottom)}` : null }
    })
    if (info.docW > info.winW) errors.push(`[${state}/${v}] horizontal overflow ${info.docW} > ${info.winW}`)
    console.log(`${state}/${v}`, JSON.stringify(info))
    await ctx.close()
  }
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
