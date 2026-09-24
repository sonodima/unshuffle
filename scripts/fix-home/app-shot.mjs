// Real app Home screenshots (shell included). node scripts/fix-home/app-shot.mjs <tag> [views] [base] [hash]
import { chromium } from 'playwright'
const [tag = 'app', viewsArg = 'land', base = 'http://127.0.0.1:5404/', hash = ''] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const VIEWS = {
  phone: [{ width: 390, height: 844 }, 2, true], small: [{ width: 360, height: 740 }, 2, true],
  desk: [{ width: 1440, height: 900 }, 1, false], laptop: [{ width: 1280, height: 720 }, 1, false],
  land: [{ width: 844, height: 390 }, 2, true], landse: [{ width: 667, height: 375 }, 2, true],
  landmax: [{ width: 932, height: 430 }, 2, true], ipadl: [{ width: 1024, height: 768 }, 1, true],
  tablet: [{ width: 820, height: 1180 }, 1, true],
}
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const v of viewsArg.split(',')) {
  const [viewport, dsf, mobile] = VIEWS[v]
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: mobile, isMobile: mobile })
  await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${v}] ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${v}] pageerror: ${e.message}`))
  await page.goto(base + hash, { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}${tag}-${v}.png` })
  const info = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /^Crea (una )?stanza$/.test(b.textContent?.trim() ?? ''))
    const r = btn?.getBoundingClientRect()
    return { docW: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight, crea: r ? [Math.round(r.top), Math.round(r.bottom)] : null }
  })
  console.log(v, JSON.stringify(info))
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
