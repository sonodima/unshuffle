// Drag smoothness on the PRODUCTION build (vite preview of a scratch build on :5303):
// solo game on a 390x844 touch phone (Chrome emulation), 16 snippets, CPU throttle.
// Measures rAF frame times idle vs during a long touch drag, long tasks, and the
// JS self-time profile of the drag.  Usage: [CPU=4] [N=16] [ENGINE=chromium|webkit] node scripts/qa-mobile/perf-prod.mjs
import { VIEWPORTS, newContext, sleep, closeBrowsers, OUT } from './lib.mjs'

const BASE = process.env.PBASE ?? 'http://127.0.0.1:5303/'
const CPU = Number(process.env.CPU ?? 4)
const N = Number(process.env.N ?? 16)
const ENGINE = process.env.ENGINE ?? 'chromium'
const vp = ENGINE === 'webkit' ? 'iphone14' : VIEWPORTS.find((v) => v.id === '390x844')
const { ctx, page, errors } = await newContext(ENGINE, vp)
page.setDefaultTimeout(120_000)
const workers = []
page.on('worker', (w) => workers.push(w.url()))
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a)

await page.goto(BASE)
await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
await page.getByRole('button', { name: 'Crea stanza', exact: true }).tap()
await page.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').waitFor()
await sleep(800)
const tab = async (n) => {
  const t = page.getByRole('tab', { name: new RegExp(`^${n}`) })
  if (await t.count()) await t.first().tap()
  await sleep(400)
}
await tab('Playlist')
const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
await search.tap()
await search.fill(process.env.QUERY ?? 'rock classics')
const first = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
await first.waitFor({ timeout: 20_000 })
await sleep(600)
await first.tap()
await tab('Regole')
await page.getByRole('radiogroup', { name: 'Spezzoni' }).getByRole('radio', { name: new RegExp(`^${N}`) }).tap()
await page.getByRole('radiogroup', { name: 'Tempo per round' }).getByRole('radio', { name: '180s' }).tap()
await sleep(400)
await page.getByRole('button', { name: /Inizia partita/ }).first().tap()
const tPrep = Date.now()
await page.waitForFunction(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase="intro"]'), null, { timeout: 120_000 })
log('preparing → intro took', ((Date.now() - tPrep) / 1000).toFixed(1), 's; workers', workers)
await page.waitForFunction(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase="playing"]'), null, { timeout: 60_000 })
await page.locator('[data-round-view="playing"] .sb-item').first().waitFor()
await sleep(2500)
await page.screenshot({ path: `${OUT}perf-${ENGINE}-playing.png` })

let cdp = null
if (ENGINE === 'chromium') {
  cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
}
const rec = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((res) => {
        const f = []
        const ts = []
        const lt = []
        let act = null
        const mo = new MutationObserver(() => {
          if (act == null && document.querySelector('.sb-board[data-dragging]')) act = performance.now()
        })
        mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-dragging'] })
        let po
        try {
          po = new PerformanceObserver((l) => l.getEntries().forEach((e) => lt.push(Math.round(e.duration))))
          po.observe({ type: 'longtask' })
        } catch {}
        let last = 0
        const t0 = performance.now()
        const loop = (t) => {
          if (last) {
            f.push(t - last)
            ts.push(t)
          }
          last = t
          if (performance.now() - t0 < ms) requestAnimationFrame(loop)
          else {
            po?.disconnect()
            mo.disconnect()
            const pick = act == null ? null : Math.round(Math.max(0, ...ts.map((x, i) => (x >= act && x <= act + 300 ? f[i] : 0))))
            const s = [...f].sort((a, b) => a - b)
            const q = (p) => Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))])
            res({ frames: f.length, fps: Math.round((f.length / ms) * 1000), p50: q(0.5), p95: q(0.95), max: q(1), over33: f.filter((x) => x > 33.4).length, longTasks: lt.length, longMax: Math.max(0, ...lt), pickupHitch: pick })
          }
        }
        requestAnimationFrame(loop)
      }),
    ms,
  )
log('idle', JSON.stringify(await rec(3000)))

const box = async (pos) => page.locator(`[data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
const a = await box(0)
const b = await box(N - 1)
const A = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
const B = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
const pt = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]
if (cdp) {
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
  await cdp.send('Profiler.start')
}
const recP = rec(3000)
const steps = 150
const send = async (type, x, y) => {
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pt(x, y) })
  else
    await page.evaluate(
      ([type, x, y]) => {
        const map = { touchStart: 'pointerdown', touchMove: 'pointermove', touchEnd: 'pointerup' }
        const init = { bubbles: true, cancelable: true, composed: true, pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'touchEnd' ? 0 : 1 }
        ;(document.elementFromPoint(x, y) ?? document).dispatchEvent(new PointerEvent(map[type], init))
      },
      [type, x, y],
    )
}
await send('touchStart', A.x, A.y)
for (let i = 1; i <= steps; i++) {
  const t = i / steps
  await send('touchMove', A.x + (B.x - A.x) * t + Math.sin(t * 18) * 50, A.y + (B.y - A.y) * t)
  await sleep(16)
}
const during = await recP
await send('touchEnd', B.x, B.y)
log('drag', JSON.stringify(during))
if (cdp) {
  const { profile } = await cdp.send('Profiler.stop')
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const self = new Map()
  profile.samples.forEach((id, i) => {
    const cf = byId.get(id).callFrame
    const key = `${cf.functionName || '(anon)'} @ ${cf.url.replace(/^.*\/assets\//, '')}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`
    self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0))
  })
  const top = [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, 16)
  log('drag self-time top:\n' + top.map(([k, us]) => `${(us / 1000).toFixed(0).padStart(6)}ms ${k}`).join('\n'))
}
log('errors', errors)
await ctx.close()
await closeBrowsers()
