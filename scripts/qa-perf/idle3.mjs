// Home idle cost attribution (desktop 1440x900 / phone): toggle suspects in the same page, 3 reps alternating.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const SECS = Number(process.env.SECS ?? 5)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const bcdp = await browser.newBrowserCDPSession()
const cpuTimes = async () => { const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo'); const o = {}; for (const p of processInfo) o[p.type] = (o[p.type] ?? 0) + p.cpuTime; return o }
const ctx = await browser.newContext(DEVICE === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
await page.goto(BASE); await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const s = document.createElement('style'); s.id = '__v'; document.head.appendChild(s)
  const ol = document.querySelector('ol[aria-label="Come si gioca, in breve"]')
  const panel = ol?.closest('.rounded-panel') ?? ol?.parentElement
  panel?.setAttribute('data-qa-demo', '')
  // phone: DemoStrip root = parent of the first .hm-block row
  const strip = document.querySelector('.hm-block')?.closest('[aria-hidden]')
  strip?.setAttribute('data-qa-strip', '')
})
const V = {
  default: '',
  'no TimerBar': '[role=timer]{display:none!important}',
  'no demo (panel/strip hidden)': '[data-qa-demo],[data-qa-strip]{visibility:hidden!important}',
  'no backdrop-filter': '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'no background': '.ushf-bg{display:none!important}',
  'no demo + no backdrop + no bg': '[data-qa-demo],[data-qa-strip]{visibility:hidden!important}*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.ushf-bg{display:none!important}',
}
const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
const res = {}
for (let rep = 0; rep < 3; rep++) for (const [k, css] of Object.entries(V)) {
  await page.evaluate((css) => { document.getElementById('__v').textContent = css }, css)
  await page.waitForTimeout(600)
  const a = await cpuTimes(); const m0 = await met()
  await page.waitForTimeout(SECS * 1000)
  const b = await cpuTimes(); const m1 = await met()
  ;(res[k] ??= []).push([((b.renderer - a.renderer) / SECS) * 100, ((b.GPU - a.GPU) / SECS) * 100, (m1.LayoutCount - m0.LayoutCount) / SECS, ((m1.TaskDuration - m0.TaskDuration) * 1000) / SECS])
}
const med = (v, i) => { const s = v.map((x) => x[i]).sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
for (const [k, v] of Object.entries(res)) console.log(`home ${DEVICE} ${k.padEnd(32)} renderer ${med(v, 0).toFixed(1).padStart(5)}%  gpu ${med(v, 1).toFixed(1).padStart(5)}%  layouts/s ${med(v, 2).toFixed(0).padStart(3)}  main-thread task ${med(v, 3).toFixed(0)}ms/s`)
await browser.close()
