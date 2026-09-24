import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto('http://localhost:5202/lab/board.html?n=16&audio=synth&ui=0')
await page.waitForFunction(() => window.__lab && window.__lab.ready())
await page.waitForTimeout(500)
const cdp = await ctx.newCDPSession(page)
const c = async (pos) => { const b = await page.locator(`.sb-item[data-pos="${pos}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const a = await c(0), b = await c(5)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
const phase = process.argv[2] ?? 'start'
if (phase === 'start') await cdp.send('Profiler.start')
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] })
for (let i = 1; i <= 8; i++) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8, id: 1 }] })
  await page.waitForTimeout(16)
}
if (phase === 'start') { await page.waitForTimeout(100); }
if (phase === 'end') await cdp.send('Profiler.start')
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(400)
const { profile } = await cdp.send('Profiler.stop')
const self = new Map()
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const dt = profile.timeDeltas
const counts = new Map()
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0)))
for (const [id, t] of counts) {
  const n = byId.get(id)
  const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`
  self.set(key, (self.get(key) ?? 0) + t)
}
const top = [...self.entries()].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((x, y) => y[1] - x[1]).slice(0, 22)
for (const [k, t] of top) console.log((t / 1000).toFixed(1).padStart(7), 'ms', k)
await browser.close()
