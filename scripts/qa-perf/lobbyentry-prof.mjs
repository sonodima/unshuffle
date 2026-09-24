// Home -> "Crea stanza" -> Lobby at 4x CPU (phone): time to lobby, long tasks, and picker search responsiveness.
import { chromium } from 'playwright'
import * as G from './game.mjs'
import { lookup } from './smap.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'phone'
const CPU = Number(process.env.CPU ?? 4)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const { ctx, page } = await G.newPlayer(browser, DEVICE)
await ctx.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask' }) })
await page.goto(BASE); await G.waitScreen(page, 'home'); await page.waitForTimeout(3000)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start')
const t0 = await page.evaluate(() => performance.now())
await G.createRoom(page)
const t1 = await page.evaluate(() => performance.now())
await page.waitForTimeout(2500)
const lt1 = await page.evaluate((t) => window.__lt.filter((x) => x[0] >= t).map((x) => [x[0] - Math.round(t), x[1]]), t0)
{
const { profile } = await cdp.send('Profiler.stop')
const dt = new Map(); for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0))
const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const keyOf = (n) => { const cf = n.callFrame; if (!cf.url) return `(${cf.functionName || 'native'})`; const f = cf.url.split('/').pop(); const o = lookup(f, cf.lineNumber, cf.columnNumber); return o ? `${o.source}:${o.line} ${cf.functionName}` : `${f} ${cf.functionName}` }
const self = new Map(), incl = new Map()
for (const [id, us] of dt) { const n = byId.get(id); const fn = n.callFrame.functionName; if (fn === '(idle)' || fn === '(program)') continue; const k = keyOf(n).replace(/:\d+ .*$/, ''); self.set(k, (self.get(k) ?? 0) + us); const seen = new Set(); let cur = id; while (cur != null) { const kk = keyOf(byId.get(cur)); if (kk.startsWith('src/') && !seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) ?? 0) + us) } cur = parent.get(cur) } }
console.log('inclusive app:'); for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / 1000).toFixed(0).padStart(5)}ms ${k}`)
console.log('self by file:'); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${(v / 1000).toFixed(0).padStart(5)}ms ${k}`)
}
console.log(`${DEVICE} cpu${CPU}x click->lobby ${Math.round(t1 - t0)} ms; long tasks after click:`, JSON.stringify(lt1))
const t2 = await page.evaluate(() => performance.now())
await G.pickPlaylist(page, 'rock')
await page.waitForTimeout(1500)
const lt2 = await page.evaluate((t) => window.__lt.filter((x) => x[0] >= t).map((x) => [x[0] - Math.round(t), x[1]]), t2)
console.log(`search+pick playlist long tasks:`, JSON.stringify(lt2))
await browser.close()
