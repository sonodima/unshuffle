// What still runs on a resting Home (prod snapshot)? node scripts/fix-home/rest-probe.mjs [base]
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://127.0.0.1:5454/'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForTimeout(26000)
const r = await page.evaluate(async () => {
  const anims = document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
    const t = a.effect?.target
    return `${a.animationName ?? a.constructor.name} on ${t?.className?.baseVal ?? t?.className ?? t?.tagName}`.slice(0, 140)
  })
  let raf = 0
  const t0 = performance.now()
  await new Promise((res) => { const tick = () => { raf++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res() }; requestAnimationFrame(tick) })
  return { rest: !!document.querySelector('[data-demo-rest]'), idle: !!document.querySelector('.hm-root[data-idle]'), anims, rafPerSec: raf / 2 }
})
console.log(JSON.stringify(r, null, 1))
// Main-thread activity breakdown over 5 s
const cdp = await ctx.newCDPSession(page)
await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReturnAsStream' })
await page.waitForTimeout(5000)
const done = new Promise((res) => cdp.once('Tracing.tracingComplete', res))
await cdp.send('Tracing.end')
const { stream } = await done
let data = ''
for (;;) { const { data: d, eof } = await cdp.send('IO.read', { handle: stream }); data += d; if (eof) break }
const events = JSON.parse(data).traceEvents ?? JSON.parse(data)
const agg = {}
for (const e of events) if (e.ph === 'X' && e.dur) { const k = e.name; agg[k] = (agg[k] ?? 0) + e.dur / 1000 }
const fnAgg = {}
for (const e of events) if (e.name === 'FunctionCall' && e.dur) { const k = `${e.args?.data?.functionName || '?'} ${String(e.args?.data?.url ?? '').split('/').pop()}:${e.args?.data?.lineNumber}`; fnAgg[k] = (fnAgg[k] ?? 0) + e.dur / 1000 }
console.log(Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k.padEnd(34)} ${(v / 5).toFixed(1)} ms/s`).join('\n'))
console.log('-- functions')
console.log(Object.entries(fnAgg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k.padEnd(50)} ${(v / 5).toFixed(1)} ms/s`).join('\n'))
await browser.close()
