// Drag 16 blocks / play-all / idle-in-round: long tasks, frame times, React commits + renders.
// BASE=http://127.0.0.1:5308/ (dev: component names) or :5318 (prod timings). DEVICE=desktop|phone CPU=1|4
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import * as G from './game.mjs'
import { lookup } from './smap.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5308/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const CPU = Number(process.env.CPU ?? 1)
const SNIP = process.env.SNIP ?? '16'
const OUT = new URL('./shots/', import.meta.url).pathname
const inst = readFileSync(new URL('./instrument.js', import.meta.url), 'utf8')
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const { ctx, page } = await G.newPlayer(browser, DEVICE)
await ctx.addInitScript({ content: inst })
await page.goto(BASE, { waitUntil: 'load' })
await G.waitScreen(page, 'home')
await G.createRoom(page)
await G.pickPlaylist(page, process.env.QUERY ?? 'hits 2000')
if (DEVICE === 'phone') await page.getByRole('tab', { name: /Regole/ }).click()
await G.setRadio(page, 'Round', '3')
await G.setRadio(page, 'Spezzoni', new RegExp('^' + SNIP))
await G.setRadio(page, 'Tempo per round', '180s')
await page.waitForTimeout(300)
await G.start(page)
await G.boardReady(page)
await page.waitForTimeout(2500)
const cdp = await ctx.newCDPSession(page)
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
await page.screenshot({ path: `${OUT}drag-${DEVICE}-${SNIP}-board.png` })
const n = await page.locator('[data-round-view="playing"] .sb-item').count()
console.log(`board has ${n} blocks, device ${DEVICE}, cpu ${CPU}x, base ${BASE}`)
const PROFILE = !!process.env.PROFILE
if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }) }
function summarize(profile) {
  const dt = new Map()
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0))
  const by = new Map(); let busy = 0
  for (const n of profile.nodes) {
    const us = dt.get(n.id) ?? 0; if (!us) continue
    const cf = n.callFrame
    if (cf.functionName === '(idle)' || cf.functionName === '(program)') continue
    busy += us
    let k = `(${cf.functionName || 'native'})`
    if (cf.url) { const f = cf.url.split('/').pop(); const o = lookup(f, cf.lineNumber, cf.columnNumber); k = o ? o.source : f }
    by.set(k, (by.get(k) ?? 0) + us)
  }
  return `busy ${(busy / 1000).toFixed(0)}ms: ` + [...by].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / 1000).toFixed(0)}`).join(' | ')
}
const measure = async (label, fn) => {
  if (PROFILE) await cdp.send('Profiler.start')
  await page.evaluate(() => window.__perf.start())
  await fn()
  const r = await page.evaluate(() => window.__perf.stop())
  console.log(`\n## ${label}\n` + JSON.stringify(r))
  if (PROFILE) { const { profile } = await cdp.send('Profiler.stop'); console.log('   profile ' + summarize(profile)) }
  return r
}
// idle in round (timer ticking, nothing else)
await measure('idle in playing phase 3s', () => page.waitForTimeout(3000))
// long drag across the grid, 0 -> last, 100 steps
const drag = async (from, to, steps) => {
  const a = await G.center(page, from)
  const b = await G.center(page, to)
  if (DEVICE === 'phone') {
    const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
    for (let i = 1; i <= steps; i++) {
      // zig-zag through every row
      const k = i / steps
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + (b.x - a.x) * k + Math.sin(k * 20) * 60, a.y + (b.y - a.y) * k) })
      await page.waitForTimeout(12)
    }
    await page.waitForTimeout(100)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) {
      const k = i / steps
      await page.mouse.move(a.x + (b.x - a.x) * k + Math.sin(k * 20) * 120, a.y + (b.y - a.y) * k)
      await page.waitForTimeout(12)
    }
    await page.waitForTimeout(100)
    await page.mouse.up()
  }
  await page.waitForTimeout(500)
}
await measure(`drag pos0 -> pos${n - 1} (100 moves, zig-zag)`, () => drag(0, n - 1, 100))
await measure(`drag pos${n - 1} -> pos0 (100 moves)`, () => drag(n - 1, 0, 100))
// play all
await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
await page.waitForTimeout(300)
await measure('play-all 4s', () => page.waitForTimeout(4000))
await measure('drag during play-all', () => drag(2, n - 3, 60))
await page.screenshot({ path: `${OUT}drag-${DEVICE}-${SNIP}-cpu${CPU}-playing.png` })
await measure('confirm -> reveal animation (8s)', async () => {
  await G.confirm(page)
  await G.waitPhase(page, 'reveal', 40_000)
  await page.waitForTimeout(8000)
})
await page.screenshot({ path: `${OUT}drag-${DEVICE}-${SNIP}-cpu${CPU}-reveal.png` })
await browser.close()
