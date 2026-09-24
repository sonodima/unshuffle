// CPU profile of cold boot, timeline of dominant sources per 100ms window (4x CPU, phone).
import { chromium } from 'playwright'
import { lookup } from './smap.mjs'
const CPU = Number(process.env.CPU ?? 4)
const URL_ = process.env.URL ?? 'http://127.0.0.1:5318/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
// warm-up context: initialise the browser's WebRTC/GPU once, like an already-running browser
{
  const c = await browser.newContext(); const p = await c.newPage(); await p.goto(URL_); await p.waitForTimeout(1500); await c.close()
}
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
await cdp.send('Profiler.start')
await page.goto(URL_, { waitUntil: 'load' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(3000)
const { profile } = await cdp.send('Profiler.stop')
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const parent = new Map()
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const srcOf = (n) => {
  const cf = n.callFrame
  if (!cf.url) return null
  const f = cf.url.split('/').pop()
  const o = lookup(f, cf.lineNumber, cf.columnNumber)
  return o ? o.source : f
}
// for each sample: leaf source (self) and the "module" = first app/nm frame from the bottom of stack that is not runtime
let t = profile.startTime
const win = new Map()
const W = 100_000
let first = null
for (let i = 0; i < profile.samples.length; i++) {
  t += profile.timeDeltas[i]
  const n = byId.get(profile.samples[i])
  const fn = n.callFrame.functionName
  if (fn === '(idle)' || fn === '(program)') continue
  if (first == null) first = t
  // walk up to find the outermost non-empty source
  let id = n.id, outer = null, leaf = null
  while (id != null) { const s = srcOf(byId.get(id)); if (s) { outer = s; leaf ??= s } id = parent.get(id) }
  const k = Math.floor((t - first) / W)
  const m = win.get(k) ?? new Map()
  const key = `${leaf ?? fn}`
  m.set(key, (m.get(key) ?? 0) + profile.timeDeltas[i])
  win.set(k, m)
}
for (const [k, m] of [...win].sort((a, b) => a[0] - b[0])) {
  const tot = [...m.values()].reduce((a, b) => a + b, 0)
  if (tot < 20_000) continue
  const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, v]) => `${s} ${(v / 1000).toFixed(0)}`).join(' | ')
  console.log(`${String(k * 100).padStart(5)}ms busy ${(tot / 1000).toFixed(0).padStart(3)}ms: ${top}`)
}
await browser.close()
