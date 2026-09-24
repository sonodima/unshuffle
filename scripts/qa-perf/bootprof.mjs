// CPU profile of a cold boot (phone emulation, 4x CPU) → self time per original source file.
import { chromium } from 'playwright'
import { lookup } from './smap.mjs'
const BASE = process.argv[2] ?? 'http://127.0.0.1:5318/'
const CPU = Number(process.env.CPU ?? 4)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
await cdp.send('Profiler.start')
await page.goto(BASE, { waitUntil: 'load' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(Number(process.env.WAIT ?? 1500))
const { profile } = await cdp.send('Profiler.stop')
const dt = new Map()
for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0))
const bySrc = new Map(), byFn = new Map()
let total = 0
for (const n of profile.nodes) {
  const us = dt.get(n.id) ?? 0
  if (!us) continue
  total += us
  const cf = n.callFrame
  let key
  const f = cf.url.split('/').pop()
  if (!cf.url) key = `(${cf.functionName || 'native'})`
  else {
    const o = lookup(f, cf.lineNumber, cf.columnNumber)
    key = o ? o.source : f
    const fk = (o ? `${o.source}:${o.line}` : f) + ' ' + (cf.functionName || '')
    byFn.set(fk, (byFn.get(fk) ?? 0) + us)
  }
  bySrc.set(key, (bySrc.get(key) ?? 0) + us)
}
console.log(`total sampled ${(total / 1000).toFixed(0)} ms (cpu ${CPU}x)`)
for (const [k, v] of [...bySrc].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`${(v / 1000).toFixed(1).padStart(8)} ms  ${k}`)
console.log('--- top functions')
for (const [k, v] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(v / 1000).toFixed(1).padStart(8)} ms  ${k}`)
await browser.close()
