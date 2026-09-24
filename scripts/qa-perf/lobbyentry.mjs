// Home -> "Crea stanza" -> Lobby at 4x CPU (phone): time to lobby, long tasks, and picker search responsiveness.
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'phone'
const CPU = Number(process.env.CPU ?? 4)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const { ctx, page } = await G.newPlayer(browser, DEVICE)
await ctx.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask' }) })
await page.goto(BASE); await G.waitScreen(page, 'home'); await page.waitForTimeout(3000)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const t0 = await page.evaluate(() => performance.now())
await G.createRoom(page)
const t1 = await page.evaluate(() => performance.now())
await page.waitForTimeout(2500)
const lt1 = await page.evaluate((t) => window.__lt.filter((x) => x[0] >= t).map((x) => [x[0] - Math.round(t), x[1]]), t0)
console.log(`${DEVICE} cpu${CPU}x click->lobby ${Math.round(t1 - t0)} ms; long tasks after click:`, JSON.stringify(lt1))
const t2 = await page.evaluate(() => performance.now())
await G.pickPlaylist(page, 'rock')
await page.waitForTimeout(1500)
const lt2 = await page.evaluate((t) => window.__lt.filter((x) => x[0] >= t).map((x) => [x[0] - Math.round(t), x[1]]), t2)
console.log(`search+pick playlist long tasks:`, JSON.stringify(lt2))
await browser.close()
