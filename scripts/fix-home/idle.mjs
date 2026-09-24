// Idle CPU of Home (renderer + GPU process), early window (demo running) and late window (after idle rest).
// node scripts/fix-home/idle.mjs [baseUrl]   env: SECS=10 ONLY=substring
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://127.0.0.1:5454/'
const SECS = Number(process.env.SECS ?? 10)
async function cpuTimes(bcdp) {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo')
  const out = {}
  for (const p of processInfo) out[p.type] = (out[p.type] ?? 0) + p.cpuTime
  return out
}
async function scenario(name, { device = 'desktop', warm = 4000, reduced = false, wiggle = false }) {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
  const ctx = await browser.newContext({
    ...(device === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }),
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  await page.waitForTimeout(warm)
  let wig = null
  if (wiggle) {
    // keep the mouse moving during the window (an active user)
    wig = (async () => { for (let i = 0; i < SECS * 4; i++) { await page.mouse.move(300 + (i % 20) * 20, 400 + (i % 7) * 10).catch(() => {}); await page.waitForTimeout(250).catch(() => {}) } })()
  }
  const bcdp = await browser.newBrowserCDPSession()
  const a = await cpuTimes(bcdp)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
  await new Promise((r) => setTimeout(r, SECS * 1000))
  const b = await cpuTimes(bcdp)
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
  await wig
  const pct = (k) => (((b[k] ?? 0) - (a[k] ?? 0)) / SECS * 100).toFixed(1)
  const per = (k) => (((m1[k] - m0[k]) * 1000) / SECS).toFixed(0)
  const rest = await page.evaluate(() => document.querySelector('[data-demo-rest]') ? 'rest' : 'run')
  console.log(`${name.padEnd(36)} demo=${rest}  renderer=${pct('renderer').padStart(5)}%  gpu=${pct('GPU').padStart(5)}%  main: layout ${per('LayoutDuration')}ms/s style ${per('RecalcStyleDuration')}ms/s task ${per('TaskDuration')}ms/s  layouts/s ${((m1.LayoutCount - m0.LayoutCount) / SECS).toFixed(0)}`)
  await browser.close()
}
const only = process.env.ONLY
const S = [
  ['desktop early (4-14s)', {}],
  ['desktop late (30-40s)', { warm: 30000 }],
  ['desktop late + mouse moving', { warm: 30000, wiggle: true }],
  ['desktop mid (8-18s)', { warm: 8000 }],
  ['desktop reduced-motion', { reduced: true }],
  ['phone early (4-14s)', { device: 'phone' }],
  ['phone mid (8-18s)', { device: 'phone', warm: 8000 }],
  ['phone late (30-40s)', { device: 'phone', warm: 30000 }],
]
for (const [n, o] of S) if (!only || n.includes(only)) await scenario(n, o)
