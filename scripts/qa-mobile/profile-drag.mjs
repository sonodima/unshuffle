// CPU-profile a touch drag on the real PlayView (Chromium, CDP) and compare with an idle baseline.
// Usage: [N=16] [CPU=4] [VP=390x844] node scripts/qa-mobile/profile-drag.mjs
import { BASE, VIEWPORTS, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'

const N = Number(process.env.N ?? 16)
const CPU = Number(process.env.CPU ?? 4)
const vp = VIEWPORTS.find((v) => v.id === (process.env.VP ?? '390x844'))
const { ctx, page } = await newContext('chromium', vp)
await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
await installQa(page)
await page.evaluate(() => window.__qa.loadAudio())
await goHome(page)
await sleep(300)
await setState(page, 'playing', { n: N })
await page.evaluate(() => {
  const G = window.__qa.G
  G.setState({ setArrangement: (order) => G.setState({ arrangement: [...order] }) })
})
await page.locator('[data-round-view="playing"] .sb-item').first().waitFor()
await sleep(2000)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 200 })

const frameStats = () =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const f = []
        let last = 0
        const t0 = performance.now()
        const loop = (t) => {
          if (last) f.push(t - last)
          last = t
          if (performance.now() - t0 < 2500) requestAnimationFrame(loop)
          else {
            const s = [...f].sort((a, b) => a - b)
            res({ n: f.length, p50: Math.round(s[Math.floor(s.length * 0.5)]), p95: Math.round(s[Math.floor(s.length * 0.95)]), over33: f.filter((x) => x > 33.4).length })
          }
        }
        requestAnimationFrame(loop)
      }),
  )

function summarize(profile) {
  const self = new Map()
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const dt = profile.timeDeltas
  const counts = new Map()
  profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0)))
  let total = 0
  for (const [id, us] of counts) {
    const n = byId.get(id)
    const cf = n.callFrame
    const url = cf.url.replace(/^.*\/(node_modules\/\.vite[^/]*\/deps\/|src\/)/, '').replace(/\?.*$/, '')
    const key = `${cf.functionName || '(anon)'} @ ${url || cf.url || '-'}:${cf.lineNumber + 1}`
    self.set(key, (self.get(key) ?? 0) + us)
    total += us
  }
  return { totalMs: Math.round(total / 1000), top: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, us]) => `${(us / 1000).toFixed(0).padStart(6)}ms  ${k}`) }
}

console.log('idle frames', await frameStats())
await cdp.send('Profiler.start')
await sleep(2500)
const idle = (await cdp.send('Profiler.stop')).profile
console.log('IDLE profile', JSON.stringify(summarize(idle), null, 1))

const box = async (pos) => page.locator(`[data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
const a = await box(0)
const b = await box(N - 1)
const A = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
const B = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
const pt = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]
const fsP = frameStats()
await cdp.send('Profiler.start')
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(A.x, A.y) })
const steps = 120
for (let i = 1; i <= steps; i++) {
  // zig-zag across rows so the over-target changes constantly
  const t = i / steps
  const x = A.x + (B.x - A.x) * t + Math.sin(t * 20) * 40
  const y = A.y + (B.y - A.y) * t
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y) })
  await sleep(16)
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
const drag = (await cdp.send('Profiler.stop')).profile
console.log('drag frames (first 2.5s of the drag)', await fsP)
console.log('DRAG profile', JSON.stringify(summarize(drag), null, 1))
await ctx.close()
await closeBrowsers()
