// Touch drag / tap audit on the real PlayView (shell lab, fixture state, real audio).
// Chromium: real touch via CDP Input.dispatchTouchEvent (+ optional CPU throttle).
// WebKit: page.touchscreen.tap for taps; drags via synthetic PointerEvents (no touch-move API).
// Usage: ENGINE=chromium|webkit [VP=360x740] [N=16] [CPU=4] node scripts/qa-mobile/drag.mjs
import { BASE, OUT, VIEWPORTS, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'

const ENGINE = process.env.ENGINE ?? 'chromium'
const VPID = process.env.VP ?? '390x844'
const N = Number(process.env.N ?? 8)
const CPU = Number(process.env.CPU ?? 1)
const vp = VPID === 'iphone14' ? 'iphone14' : VIEWPORTS.find((v) => v.id === VPID)
const { ctx, page, errors } = await newContext(ENGINE, vp)
const tag = `drag-${ENGINE}-${VPID}-n${N}${CPU > 1 ? `-cpu${CPU}` : ''}`
const report = { tag, tests: [] }
const log = (name, data) => {
  report.tests.push({ name, ...data })
  console.log(name, JSON.stringify(data))
}

await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
await installQa(page)
const audio = await page.evaluate(() => window.__qa.loadAudio())
log('audio-load', audio)

async function freshBoard(n = N) {
  await goHome(page)
  await sleep(400)
  await setState(page, 'playing', { n })
  await page.evaluate(() => {
    const G = window.__qa.G
    G.setState({ setArrangement: (order) => G.setState({ arrangement: [...order] }) })
  })
  await page.locator('[data-round-view="playing"] .sb-item').first().waitFor()
  await sleep(1600)
}

const order = () =>
  page.$$eval('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item', (els) =>
    els.map((e) => ({ pos: +e.dataset.pos, seg: +e.dataset.seg })).sort((a, b) => a.pos - b.pos).map((e) => e.seg),
  )
const center = async (pos) => {
  const b = await page.locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }
}
const arrayMove = (a, f, t) => {
  const c = a.slice()
  const [x] = c.splice(f, 1)
  c.splice(t, 0, x)
  return c
}

// ---- in-page instrumentation
async function startRec() {
  await page.evaluate(() => {
    const st = (window.__rec = { frames: [], ts: [], events: [], long: [], scroll: 0, vv: [], dragSeen: false, lag: [], act: null })
    let last = 0
    st.mo = new MutationObserver(() => {
      if (st.act == null && document.querySelector('.sb-board[data-dragging]')) st.act = performance.now()
    })
    st.mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-dragging'] })
    const loop = (t) => {
      if (last) {
        st.frames.push(t - last)
        st.ts.push(t)
      }
      last = t
      if (document.querySelector('.sb-board[data-dragging]')) st.dragSeen = true
      const sc = [document.scrollingElement, ...document.querySelectorAll('[data-screen-frame] , [data-screen-frame] *')].filter((e) => e.scrollTop || e.scrollLeft)
      st.scroll = Math.max(st.scroll, ...sc.map((e) => Math.abs(e.scrollTop) + Math.abs(e.scrollLeft)), window.scrollY)
      if (window.visualViewport) st.vv.push(visualViewport.scale)
      if (!st.stop) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    try {
      st.po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) st.events.push({ name: e.name, d: Math.round(e.duration) })
      })
      st.po.observe({ type: 'event', durationThreshold: 16 })
    } catch {}
    try {
      st.lt = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) st.long.push(Math.round(e.duration))
      })
      st.lt.observe({ type: 'longtask' })
    } catch {}
  })
}
async function stopRec() {
  return page.evaluate(() => {
    const st = window.__rec
    st.stop = true
    st.po?.disconnect()
    st.lt?.disconnect()
    st.mo.disconnect()
    let pickupHitch = null
    if (st.act != null) {
      const after = st.ts.map((t, i) => [t, st.frames[i]]).filter(([t]) => t >= st.act && t <= st.act + 400)
      pickupHitch = after.length ? Math.round(Math.max(...after.map((x) => x[1]))) : null
    }
    const f = st.frames.slice(1)
    const sorted = [...f].sort((a, b) => a - b)
    const pct = (p) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 10) / 10 : null)
    return {
      frames: f.length,
      p50: pct(0.5),
      p95: pct(0.95),
      max: pct(1),
      over33: f.filter((x) => x > 33.4).length,
      slowEvents: [...new Set(st.events.map((e) => `${e.name}:${e.d}`))].slice(0, 6),
      longTasks: st.long,
      maxScroll: st.scroll,
      zoomed: st.vv.some((s) => Math.abs(s - 1) > 0.001),
      dragSeen: st.dragSeen,
      pickupHitch,
    }
  })
}

// ---- input drivers
let cdp = null
if (ENGINE === 'chromium') {
  cdp = await ctx.newCDPSession(page)
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
}
const pt = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]

async function sampleLag(fx, fy) {
  return page.evaluate(([x, y]) => {
    const o = document.querySelector('.sb-lift')
    if (!o) return null
    const r = o.getBoundingClientRect()
    return Math.round(Math.hypot(r.x + r.width / 2 - x, r.y + r.height / 2 - y))
  }, [fx, fy])
}

/** Drag along a path of points (viewport coords). Returns lag samples. */
async function drag(path, { stepMs = 16, holdMs = 120 } = {}) {
  const lags = []
  const [a] = path
  if (ENGINE === 'chromium') {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
    for (let i = 1; i < path.length; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(path[i].x, path[i].y) })
      await sleep(stepMs)
      if (i % 8 === 0) lags.push(await sampleLag(path[i].x, path[i].y))
    }
    await sleep(holdMs)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.evaluate((p) => {
      const el = document.elementFromPoint(p.x, p.y)
      const init = (x, y, t) => ({ bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: t === 'up' ? 0 : 1 })
      el.dispatchEvent(new PointerEvent('pointerdown', init(p.x, p.y, 'down')))
    }, a)
    for (let i = 1; i < path.length; i++) {
      await page.evaluate((p) => {
        const init = { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: 1 }
        ;(document.elementFromPoint(p.x, p.y) ?? document).dispatchEvent(new PointerEvent('pointermove', init))
      }, path[i])
      await sleep(stepMs)
      if (i % 8 === 0) lags.push(await sampleLag(path[i].x, path[i].y))
    }
    await sleep(holdMs)
    await page.evaluate((p) => {
      const init = { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: 0 }
      ;(document.elementFromPoint(p.x, p.y) ?? document).dispatchEvent(new PointerEvent('pointerup', init))
    }, path[path.length - 1])
  }
  await sleep(500)
  return lags.filter((l) => l != null)
}
const line = (a, b, steps) => Array.from({ length: steps + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }))

async function tap(p, jitter = 0) {
  if (ENGINE === 'chromium') {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(p.x, p.y) })
    if (jitter) {
      await sleep(30)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p.x + jitter * 0.6, p.y + jitter * 0.8) })
    }
    await sleep(70)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.touchscreen.tap(p.x, p.y)
  }
  await sleep(450)
}
const engineState = () =>
  page.evaluate(async () => {
    const { audioEngine } = await import('/src/audio/engine.ts')
    const s = audioEngine.getState()
    return { playing: s.playing, tag: s.tag ?? null }
  })
const stopAudio = () => page.evaluate(async () => (await import('/src/audio/engine.ts')).audioEngine.stop(0))

// ===================================================================== tests
try {
  await freshBoard()
  const n = (await order()).length
  const vw = await page.evaluate(() => innerWidth)
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.sb-grid')).gridTemplateColumns.split(' ').length)
  const size = await center(0)
  log('board', { n, cols, blockW: Math.round(size.w), blockH: Math.round(size.h) })

  // 1. tap to play (with jitter levels)
  for (const j of ENGINE === 'chromium' ? [0, 3, 5, 8, 12] : [0]) {
    await stopAudio()
    await freshBoard()
    const before = await order()
    const c = await center(1)
    await tap(c, j)
    const s = await engineState()
    const after = await order()
    const lifted = await page.evaluate(() => !!document.querySelector('.sb-lift'))
    log(`tap-jitter-${j}px`, { plays: s.playing && /^block:/.test(s.tag ?? ''), tag: s.tag, orderChanged: JSON.stringify(before) !== JSON.stringify(after), overlayLeft: lifted })
  }
  await stopAudio()

  // 2. tap same block twice -> stops
  await freshBoard()
  {
    const c = await center(2)
    await tap(c)
    const s1 = await engineState()
    await tap(c)
    const s2 = await engineState()
    log('tap-twice-toggles', { first: s1, second: s2 })
  }
  await stopAudio()

  // 3. drags: adjacent, cross-row diagonal, first->last, last->first, slow long drag
  const cases = [
    ['adjacent 0->1', 0, 1, 12],
    ['cross-row 0->cols+1', 0, Math.min(n - 1, cols + 1), 20],
    ['first->last', 0, n - 1, 40],
    ['last->first', n - 1, 0, 40],
    ['slow long first->last (90 steps)', 0, n - 1, 90],
  ]
  for (const [name, from, to, steps] of cases) {
    await freshBoard()
    const before = await order()
    const a = await center(from)
    const b = await center(to)
    await startRec()
    const lag = await drag(line(a, b, steps))
    const rec = await stopRec()
    const after = await order()
    const ok = JSON.stringify(after) === JSON.stringify(arrayMove(before, from, to))
    log(`drag ${name}`, { ok, before: before.join(''), after: after.join(''), lagPx: lag, ...rec })
  }

  // 4. drag to screen edges and beyond the board (overlay clamp, no page scroll)
  await freshBoard()
  {
    const before = await order()
    const a = await center(0)
    const vh = await page.evaluate(() => innerHeight)
    const path = [...line(a, { x: 2, y: a.y }, 12), ...line({ x: 2, y: a.y }, { x: 2, y: vh - 2 }, 30), ...line({ x: 2, y: vh - 2 }, { x: vw - 2, y: vh - 2 }, 20), ...line({ x: vw - 2, y: vh - 2 }, { x: vw - 2, y: 2 }, 30)]
    await startRec()
    await drag(path)
    const rec = await stopRec()
    const after = await order()
    await page.screenshot({ path: `${OUT}${tag}-after-edge-drag.png` })
    log('drag along screen edges', { before: before.join(''), after: after.join(''), ...rec })
  }

  // 5. a drag that starts on the gap between blocks: must not scroll/zoom anything
  await freshBoard()
  {
    const a = await center(0)
    const gapPt = { x: a.x + a.w / 2 + 3, y: a.y }
    await startRec()
    if (ENGINE === 'chromium') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(gapPt.x, gapPt.y) })
      for (let i = 1; i <= 20; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(gapPt.x, gapPt.y - i * 15) })
        await sleep(16)
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await sleep(400)
    const rec = await stopRec()
    log('swipe on board gap', { maxScroll: rec.maxScroll, zoomed: rec.zoomed })
  }

  // 6. screenshot mid-drag
  await freshBoard()
  {
    const a = await center(0)
    const b = await center(Math.min(n - 1, cols + 1))
    if (ENGINE === 'chromium') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
      for (const p of line(a, b, 16).slice(1)) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p.x, p.y) })
        await sleep(16)
      }
      await sleep(250)
      await page.screenshot({ path: `${OUT}${tag}-mid-drag.png` })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
  }
} catch (e) {
  console.log('FATAL', e.stack)
}
log('errors', { errors })
const { writeFileSync } = await import('node:fs')
writeFileSync(new URL(`./out/${tag}.json`, import.meta.url), JSON.stringify(report, null, 1))
await ctx.close()
await closeBrowsers()
