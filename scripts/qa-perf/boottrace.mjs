// Trace a cold boot and break the main-thread long tasks down by event type.
import { chromium } from 'playwright'
import { lookup } from './smap.mjs'
const CPU = Number(process.env.CPU ?? 4)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
// warm the browser's WebRTC once (so we measure renderer-side cost, like a running browser)
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const events = []
cdp.on('Tracing.dataCollected', (d) => events.push(...d.value))
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8.execute,disabled-by-default-devtools.timeline,loading', transferMode: 'ReportEvents' })
await page.goto('http://127.0.0.1:5318/', { waitUntil: 'load' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(3000)
await cdp.send('Tracing.end')
await done
// main thread = the renderer thread with most RunTask
const mainTid = (() => {
  const c = new Map()
  for (const e of events) if (e.name === 'RunTask' || e.name === 'EvaluateScript' || e.name==='FunctionCall') c.set(`${e.pid}:${e.tid}`, (c.get(`${e.pid}:${e.tid}`) ?? 0) + (e.name === 'RunTask' ? 0 : 1))
  const best = [...c].sort((a, b) => b[1] - a[1])[0]
  return best ? [best[0]] : []
})()
const isMain = (e) => mainTid.includes(`${e.pid}:${e.tid}`)
const nav = events.find((e) => e.name === 'navigationStart' && isMain(e)) ?? events.find((e) => e.name === 'TracingStartedInBrowser')
const t0 = nav?.ts ?? events[0].ts
const NAMES = new Set(['EvaluateScript', 'v8.compile', 'v8.compileModule', 'v8.evaluateModule', 'FunctionCall', 'Layout', 'UpdateLayoutTree', 'Paint', 'ParseAuthorStyleSheet', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'MajorGC', 'MinorGC', 'Decode Image', 'PrePaint', 'Layerize', 'RunMicrotasks', 'HitTest', 'ParseHTML', 'FireIdleCallback'])
const sub = events.filter((e) => e.ph === 'X' && NAMES.has(e.name) && isMain(e))
console.log("events", events.length, "main", mainTid, "sub", sub.length)
const tasks = events.filter((e) => isMain(e) && e.name === 'RunTask' && e.dur > 50_000 * 1).sort((a, b) => a.ts - b.ts)
for (const t of tasks) {
  const inside = sub.filter((e) => e.ts >= t.ts && e.ts + (e.dur ?? 0) <= t.ts + t.dur)
  const agg = new Map()
  for (const e of inside) {
    {
      let k = e.name
      if (e.name === 'FunctionCall' || e.name === 'EvaluateScript' || e.name === 'v8.evaluateModule' || e.name === 'v8.compileModule') {
        const d = e.args?.data ?? {}
        const u = (d.url ?? d.fileName ?? '').split('/').pop()
        const o = u && d.lineNumber != null ? lookup(u, d.lineNumber - 1, (d.columnNumber ?? 1) - 1) : null
        k += ' ' + (o ? o.source + ':' + o.line : u) + (d.functionName ? ' ' + d.functionName : '')
      }
      agg.set(k, (agg.get(k) ?? 0) + e.dur)
    }
  }
  console.log(`\nTASK @${((t.ts - t0) / 1000).toFixed(0)}ms dur ${(t.dur / 1000).toFixed(0)}ms`)
  for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ${(v / 1000).toFixed(1).padStart(7)}  ${k}`)
}
await browser.close()
