// Idle CPU (renderer + GPU process) on Home / Lobby (copy of scripts/qa-perf/idle-rm.mjs for the background A/B).
// node scripts/qa-perf/idle.mjs [baseUrl]
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://localhost:5465/'
const SECS = Number(process.env.SECS ?? 10)
async function cpuTimes(bcdp) {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo')
  const out = {}
  for (const p of processInfo) out[p.type] = (out[p.type] ?? 0) + p.cpuTime
  return out
}
async function scenario(name, { device = 'desktop', screen = 'home', webgl = true, hidden = false, reduced = false }) {
  const args = ['--autoplay-policy=no-user-gesture-required']
  if (!webgl) args.push('--disable-webgl', '--disable-3d-apis')
  const browser = await chromium.launch({ channel: 'chrome', args })
  const ctx = await browser.newContext({
    ...(device === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }),
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  if (screen === 'lobby') {
    await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
    await page.locator('[data-screen-frame][data-screen="lobby"]').waitFor({ timeout: 30000 })
  }
  await page.waitForTimeout(4000)
  let other = null
  if (hidden) {
    other = await ctx.newPage()
    await other.goto('about:blank')
    await other.bringToFront()
    await page.waitForTimeout(1500)
  }
  const vis = await page.evaluate(() => document.visibilityState)
  // count rAF callbacks + long tasks in the window
  await page.evaluate(() => {
    window.__raf = 0
    const tick = () => { window.__raf++; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  const bcdp = await browser.newBrowserCDPSession()
  const a = await cpuTimes(bcdp)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
  await new Promise((r) => setTimeout(r, SECS * 1000))
  const b = await cpuTimes(bcdp)
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
  const raf = await page.evaluate(() => window.__raf)
  const canvas = await page.evaluate(() => { const c = document.querySelector('.ushf-bg canvas'); return c ? `${c.width}x${c.height}` : document.querySelector('.ushf-bg')?.getAttribute('data-mode') })
  const pct = (k) => (((b[k] ?? 0) - (a[k] ?? 0)) / SECS * 100).toFixed(1)
  const per = (k) => (((m1[k] - m0[k]) * 1000) / SECS).toFixed(0)
  console.log(`${name.padEnd(34)} vis=${vis.padEnd(7)} canvas=${String(canvas).padEnd(9)} renderer=${pct('renderer').padStart(5)}%  gpu=${pct('GPU').padStart(5)}%  browser=${pct('browser').padStart(4)}%  rAF/s=${(raf / SECS).toFixed(0).padStart(3)}  main: script ${per('ScriptDuration')}ms/s layout ${per('LayoutDuration')}ms/s style ${per('RecalcStyleDuration')}ms/s task ${per('TaskDuration')}ms/s  layouts/s ${((m1.LayoutCount - m0.LayoutCount) / SECS).toFixed(0)}`)
  await browser.close()
}
const only = process.env.ONLY
const S = [
  ['home desktop webgl', {}],
  ['home phone webgl', { device: 'phone' }],
  ['lobby desktop webgl', { screen: 'lobby' }],
  ['lobby phone webgl', { screen: 'lobby', device: 'phone' }],
]
for (const [n, o] of S) if (!only || n.includes(only)) await scenario(`${n} [${BASE}]`, o)
