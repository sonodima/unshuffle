// Solo 3-round game to the Final screen (prod build): long tasks on entry, running animations and idle CPU after the show.
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const bcdp = await browser.newBrowserCDPSession()
const cpuTimes = async () => { const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo'); const o = {}; for (const p of processInfo) o[p.type] = (o[p.type] ?? 0) + p.cpuTime; return o }
const { ctx, page } = await G.newPlayer(browser, DEVICE)
const net = await ctx.newCDPSession(page)
await net.send('Network.enable')
const reqs = new Map()
net.on('Network.responseReceived', (e) => { if (/dzcdn\.net\/images/.test(e.response.url)) reqs.set(e.requestId, { url: e.response.url, t: Date.now() }) })
net.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength })
await ctx.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask' }) })
await page.goto(BASE); await G.waitScreen(page, 'home')
await G.createRoom(page); await G.pickPlaylist(page)
if (DEVICE === 'phone') await page.getByRole('tab', { name: /Regole/ }).click()
await G.setRadio(page, 'Round', '3')
await G.start(page)
for (let r = 0; r < 3; r++) {
  await G.boardReady(page)
  await page.waitForTimeout(800)
  await G.confirm(page)
  await G.waitPhase(page, 'reveal', 30000)
  await page.waitForTimeout(2500)
  await G.nextRound(page, r === 2)
  if (r < 2) await page.waitForFunction(() => !document.querySelector('[data-phase="reveal"]'), null, { timeout: 20000 })
}
const tEnterWall = Date.now()
const tEnter = await page.evaluate(() => performance.now())
await G.waitScreen(page, 'final', 30000)
await page.waitForTimeout(6000)
const lt = await page.evaluate((t) => window.__lt.filter((x) => x[0] >= t - 500), tEnter)
console.log(`${DEVICE} final entry long tasks (first 6s):`, JSON.stringify(lt))
await page.waitForTimeout(6000)
const anims = await page.evaluate(() => {
  const out = new Map()
  for (const a of document.getAnimations()) {
    if (a.playState !== 'running') continue
    const t = a.effect?.target; if (!t || t.closest?.('[inert]')) continue
    const k = `${a.animationName ?? a.constructor.name} on ${t.tagName}.${String(t.className?.baseVal ?? t.className ?? '').split(' ').slice(0, 3).join('.')}`
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  const canv = [...document.querySelectorAll('canvas')].map((c) => `${c.className || c.parentElement?.className?.split(' ')[0]}:${c.width}x${c.height}`)
  return { anims: [...out].map(([k, v]) => `${v}x ${k}`), canvases: canv }
})
console.log('running animations 12s after entry:', JSON.stringify(anims))
const a = await cpuTimes(); await page.waitForTimeout(8000); const b = await cpuTimes()
console.log(`${DEVICE} final idle (12-20s after entry): renderer ${(((b.renderer - a.renderer) / 8) * 100).toFixed(1)}%  gpu ${(((b.GPU - a.GPU) / 8) * 100).toFixed(1)}%`)
{
  const all = [...reqs.values()]
  const size = (u) => (u.match(/\/(\d+x\d+)-/) ?? [])[1] ?? '?'
  const agg = (list) => { const m = {}; for (const r of list) { const k = size(r.url); m[k] = m[k] ?? { n: 0, KB: 0 }; m[k].n++; m[k].KB += Math.round((r.bytes ?? 0) / 1024) } return JSON.stringify(m) }
  console.log('cover images whole game by size:', agg(all))
  console.log('cover images requested after entering final:', agg(all.filter((r) => r.t >= tEnterWall)))
  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => /dzcdn/.test(i.currentSrc)).map((i) => { const r = i.getBoundingClientRect(); return `${(i.currentSrc.match(/\/(\d+x\d+)-/) ?? [])[1]} natural ${i.naturalWidth} shown ${Math.round(r.width)}x${Math.round(r.height)}css@${devicePixelRatio}` }))
  console.log('final <img> covers:', JSON.stringify(imgs))
}
await page.screenshot({ path: new URL(`./shots/final-${DEVICE}-idle.png`, import.meta.url).pathname })
await browser.close()
