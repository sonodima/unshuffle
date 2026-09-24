// Demo idle rest + wake-up, on the lab page. node scripts/fix-home/idle-behaviour.mjs [desk|phone]
import { chromium } from 'playwright'
const view = process.argv[2] ?? 'desk'
const PORT = process.env.PORT ?? '5404'
const URL_ = process.env.URL ?? `http://127.0.0.1:${PORT}/lab/fix-home.html?state=idle`
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext(view === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
const t0 = Date.now()
await page.goto(URL_, { waitUntil: 'load' })
const snap = () => page.evaluate(() => {
  const root = document.querySelector('.hm-root')
  const demo = document.querySelector('[data-demo-rest]')
  const cap = document.querySelector('[aria-label="Anteprima di un round"] p, .hm-strip p')?.textContent
  const fill = document.querySelector('.hm-timer-fill')
  const glow = document.querySelector('.hm-hero-glow')
  return {
    idle: root?.hasAttribute('data-idle') ?? false,
    rest: !!demo,
    cap,
    fill: fill ? getComputedStyle(fill).transform : null,
    fillPlay: fill ? getComputedStyle(fill).animationPlayState : null,
    glowPlay: glow ? getComputedStyle(glow).animationPlayState : null,
    anims: document.getAnimations().filter((a) => a.playState === 'running').length,
  }
})
let restAt = null
let last = ''
for (;;) {
  const s = await snap()
  const line = JSON.stringify(s)
  if (line !== last) console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5), line)
  last = line
  if (s.rest && !restAt) restAt = Date.now()
  if (restAt && Date.now() - restAt > 3000) break
  if (Date.now() - t0 > 45000) { console.log('FAIL: never rested'); break }
  await page.waitForTimeout(250)
}
console.log('--- wiggle')
const tw = Date.now()
if (view === 'phone') await page.touchscreen.tap(200, 30)
else {
  await page.mouse.move(700, 450)
  await page.mouse.move(720, 460)
}
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(250)
  const s = await snap()
  const line = JSON.stringify(s)
  if (line !== last) console.log('+' + ((Date.now() - tw) / 1000).toFixed(2), line)
  last = line
}
console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
