// Function-level CPU profile of the playing→reveal transition (phone, 4x CPU, prod build).
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import * as G from './game.mjs'
import { lookup } from './smap.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const CPU = Number(process.env.CPU ?? 4)
const DEVICE = process.env.DEVICE ?? 'phone'
const inst = readFileSync(new URL('./instrument.js', import.meta.url), 'utf8')
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const { ctx, page } = await G.newPlayer(browser, DEVICE)
await ctx.addInitScript({ content: inst })
await page.goto(BASE); await G.waitScreen(page, 'home')
await G.createRoom(page)
await G.pickPlaylist(page)
if (DEVICE === 'phone') await page.getByRole('tab', { name: /Regole/ }).click()
await G.setRadio(page, 'Spezzoni', new RegExp('^' + (process.env.SNIP ?? '16')))
await G.start(page)
const cdp = await ctx.newCDPSession(page)
const rounds = Number(process.env.N ?? 2)
for (let r = 0; r < rounds; r++) {
  await G.boardReady(page)
  await page.waitForTimeout(2500)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
  await cdp.send('Profiler.start')
  await page.evaluate(() => window.__perf.start())
  await G.confirm(page)
  await G.waitPhase(page, 'reveal', 30000)
  await page.waitForTimeout(3000)
  const perf = await page.evaluate(() => window.__perf.stop())
  const { profile } = await cdp.send('Profiler.stop')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  console.log(`\n=== round ${r + 1} reveal: longtasks ${JSON.stringify(perf.longtasks)} maxFrame ${perf.max} over50 ${perf.over50}`)
  const dt = new Map()
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0))
  // inclusive time per app-source function: walk parents
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const incl = new Map(), self = new Map()
  const keyOf = (n) => { const cf = n.callFrame; if (!cf.url) return `(${cf.functionName || 'native'})`; const f = cf.url.split('/').pop(); const o = lookup(f, cf.lineNumber, cf.columnNumber); return o ? `${o.source}:${o.line} ${cf.functionName}` : `${f} ${cf.functionName}` }
  for (const [id, us] of dt) {
    const n = byId.get(id); if (!n || n.callFrame.functionName === '(idle)' || n.callFrame.functionName === '(program)') continue
    self.set(keyOf(n), (self.get(keyOf(n)) ?? 0) + us)
    const seen = new Set(); let cur = id
    while (cur != null) { const k = keyOf(byId.get(cur)); if (k.startsWith('src/') && !seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + us) } cur = parent.get(cur) }
  }
  console.log('inclusive (app code):'); for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${(v / 1000).toFixed(0).padStart(5)}ms ${k}`)
  console.log('self:'); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / 1000).toFixed(0).padStart(5)}ms ${k}`)
  if (r < rounds - 1) { await G.nextRound(page, false) }
}
await browser.close()
