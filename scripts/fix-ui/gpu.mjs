// Idle GPU/renderer cost of home / lobby with CSS variants injected (test-only).
// Usage: node scripts/fix-ui/gpu.mjs [base]   env: SCREEN=home|lobby DEVICE=desktop|phone ONLY=a,b SECS=8
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://localhost:5407/'
const SECS = Number(process.env.SECS ?? 8)
const SCREEN = process.env.SCREEN ?? 'lobby'
const DEVICE = process.env.DEVICE ?? 'desktop'
async function cpuTimes(bcdp) {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo')
  const out = {}
  for (const p of processInfo) out[p.type] = (out[p.type] ?? 0) + p.cpuTime
  return out
}
const NONE = 'backdrop-filter:none!important;-webkit-backdrop-filter:none!important'
const VARIANTS = {
  default: '',
  'no-backdrop-filter': `*,*::before,*::after{${NONE}}`,
  'top-level-only': `:is(.glass,.glass-subtle) *{${NONE}} .btn-glass{${NONE}}`,
  'no-bg-at-all': '.ushf-bg{display:none!important}',
  // What the cross-area requests would add: in-flow `glass` sections -> glass-flat, top-level backdrop-blur-* on in-flow chrome removed.
  'nested-bb-none': `:where(.glass,.glass-flat) [class*=backdrop-blur]{${NONE}}`,
  'only-startbar': `*:not(.glass.rounded-\\[26px\\]){${NONE}}`,
  'only-tiny': `*:not(.backdrop-blur-sm){${NONE}}`,
  'only-picker': `*:not(section.glass){${NONE}}`,
  // Docks (StartBar) as glass-dock, the picker section as glass-flat, nested hover labels / hero / tab bar without blur.
  'dock-sim': `.glass.rounded-t-\\[26px\\], .glass.rounded-\\[26px\\] { ${NONE}; background-color: rgb(15 11 33 / 0.95) !important; background-image: linear-gradient(180deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0) 55%) } section.glass { ${NONE}; background-color: rgb(13 10 31 / 0.74) } [class*=backdrop-blur]{${NONE}}`,
  'plus-cross-area': `section[aria-label="Scegli la playlist"].glass{${NONE}} [class*=backdrop-blur-xl].shadow-well{${NONE}}`,
}
const count = (page) => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight
  let n = 0, area = 0
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    const bf = cs.backdropFilter || cs.webkitBackdropFilter
    if (!bf || bf === 'none') continue
    const r = el.getBoundingClientRect()
    const w = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)), h = Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top))
    if (w * h < 1 || cs.visibility === 'hidden') continue
    n++; area += (w * h) / (vw * vh)
  }
  return `${n} blurred, ${Math.round(area * 100)}% vp`
})
for (const [name, css] of Object.entries(VARIANTS)) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
  const ctx = await browser.newContext(DEVICE === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript((css) => {
    try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
    if (css) document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) })
  }, css)
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  if (SCREEN === 'lobby') {
    await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
    await page.locator('[data-screen-frame][data-screen="lobby"]').waitFor({ timeout: 30000 })
  }
  await page.waitForTimeout(4000)
  if (process.env.SHOT) await page.screenshot({ path: `scripts/fix-ui/shots/gpu-${process.env.SHOT}-${SCREEN}-${DEVICE}-${name}.png` })
  const bcdp = await browser.newBrowserCDPSession()
  const res = []
  for (let rep = 0; rep < 2; rep++) {
    const a = await cpuTimes(bcdp)
    await new Promise((r) => setTimeout(r, SECS * 1000))
    const b = await cpuTimes(bcdp)
    res.push({ r: ((b.renderer - a.renderer) / SECS) * 100, g: ((b.GPU - a.GPU) / SECS) * 100 })
  }
  console.log(`${SCREEN} ${DEVICE} ${name.padEnd(20)} ${(await count(page)).padEnd(22)} renderer ${res.map((x) => x.r.toFixed(1)).join('/')}%  gpu ${res.map((x) => x.g.toFixed(1)).join('/')}%`)
  await browser.close()
}
