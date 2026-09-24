// Lobby/home idle cost attribution by switching features off with injected CSS (test-only).
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://127.0.0.1:5318/'
const SECS = Number(process.env.SECS ?? 10)
const SCREEN = process.env.SCREEN ?? 'lobby'
const DEVICE = process.env.DEVICE ?? 'desktop'
async function cpuTimes(bcdp) {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo')
  const out = {}
  for (const p of processInfo) out[p.type] = (out[p.type] ?? 0) + p.cpuTime
  return out
}
const VARIANTS = {
  default: '',
  'no-backdrop-filter': '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'no-grain': '.ushf-bg-grain{display:none!important}',
  'no-bg-canvas': '.ushf-bg-layer{display:none!important}',
  'no-bg-at-all': '.ushf-bg{display:none!important}',
  'no-backdrop+no-grain': '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.ushf-bg-grain{display:none!important}',
}
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
  await page.waitForTimeout(5000)
  const bcdp = await browser.newBrowserCDPSession()
  const res = []
  for (let rep = 0; rep < 2; rep++) {
    const a = await cpuTimes(bcdp)
    await new Promise((r) => setTimeout(r, SECS * 1000))
    const b = await cpuTimes(bcdp)
    res.push({ r: ((b.renderer - a.renderer) / SECS) * 100, g: ((b.GPU - a.GPU) / SECS) * 100 })
  }
  const canvas = await page.evaluate(() => { const c = document.querySelector('.ushf-bg canvas'); return c ? `${c.width}x${c.height}` : '-' })
  console.log(`${SCREEN} ${DEVICE} ${name.padEnd(22)} canvas=${canvas.padEnd(9)} renderer ${res.map((x) => x.r.toFixed(1)).join('/')}%  gpu ${res.map((x) => x.g.toFixed(1)).join('/')}%`)
  await browser.close()
}
