// Main-thread CPU profile of an idle Home (prod build, sourcemapped): what runs every frame?
import { chromium } from 'playwright'
import { lookup } from './smap.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const CPU = Number(process.env.CPU ?? 1)
const SECS = Number(process.env.SECS ?? 6)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext(DEVICE === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
await page.goto(BASE); await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(4000)
const cdp = await ctx.newCDPSession(page)
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
await cdp.send('Performance.enable')
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
const m0 = await met()
await cdp.send('Profiler.start')
await page.waitForTimeout(SECS * 1000)
const { profile } = await cdp.send('Profiler.stop')
const m1 = await met()
const dt = new Map()
for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0))
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const keyOf = (n) => { const cf = n.callFrame; if (!cf.url) return `(${cf.functionName || 'native'})`; const f = cf.url.split('/').pop(); const o = lookup(f, cf.lineNumber, cf.columnNumber); return o ? `${o.source}:${o.line}` : `${f}` }
const self = new Map(), incl = new Map(); let busy = 0
for (const [id, us] of dt) {
  const n = byId.get(id); const fn = n.callFrame.functionName
  if (fn === '(idle)' || fn === '(program)') continue
  busy += us
  const k = keyOf(n).replace(/:\d+$/, ''); self.set(k, (self.get(k) ?? 0) + us)
  const seen = new Set(); let cur = id
  while (cur != null) { const kk = keyOf(byId.get(cur)); if (kk.startsWith('src/') && !seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) ?? 0) + us) } cur = parent.get(cur) }
}
const per = (k) => (((m1[k] - m0[k]) * 1000) / SECS).toFixed(0)
console.log(`home ${DEVICE} cpu${CPU}x: JS busy ${(busy / 1000 / SECS).toFixed(0)}ms/s | Task ${per('TaskDuration')}ms/s Script ${per('ScriptDuration')} Layout ${per('LayoutDuration')} Style ${per('RecalcStyleDuration')} ms/s`)
console.log('self by file:'); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / 1000 / SECS).toFixed(1).padStart(6)}ms/s ${k}`)
console.log('inclusive app functions:'); for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / 1000 / SECS).toFixed(1).padStart(6)}ms/s ${k}`)
await browser.close()
