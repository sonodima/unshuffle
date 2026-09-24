// Landscape Home with iPhone-like safe-area insets. node scripts/fix-home/safe-shot.mjs <tag> <w> <h> [base] [hash]
import { chromium } from 'playwright'
const [tag = 'safe', w = '844', h = '390', base = 'http://127.0.0.1:5404/', hash = ''] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const I = Number(process.env.INSET ?? 47); await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: I ? 21 : 0, left: I, right: I } })
await page.goto(base + hash, { waitUntil: 'load' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(3000)
await page.screenshot({ path: `${OUT}${tag}.png` })
const info = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Crea (una )?stanza|Entra/.test(b.textContent?.trim() ?? ''))
  const r = btn?.getBoundingClientRect()
  return { docW: document.documentElement.scrollWidth, crea: r ? [btn.textContent.trim(), Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)] : null }
})
console.log(tag, JSON.stringify(info))
await browser.close()
