// Lobby playlist picker: image sizes requested vs displayed (phone + desktop), bytes via CDP.
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
for (const device of ['phone', 'desktop']) {
  const { ctx, page } = await G.newPlayer(browser, device)
  const net = await ctx.newCDPSession(page)
  await net.send('Network.enable')
  const reqs = new Map()
  net.on('Network.responseReceived', (e) => { if (/dzcdn\.net\/images/.test(e.response.url)) reqs.set(e.requestId, { url: e.response.url }) })
  net.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength })
  await page.goto(BASE); await G.waitScreen(page, 'home')
  await G.createRoom(page)
  await page.waitForTimeout(4000)
  const shelf = [...reqs.values()]
  await G.pickPlaylist(page, 'hits 2000')
  await page.waitForTimeout(3000)
  const all = [...reqs.values()]
  const size = (u) => (u.match(/\/(\d+x\d+)-/) ?? [])[1] ?? '?'
  const agg = (list) => { const m = {}; for (const r of list) { const k = size(r.url); m[k] = m[k] ?? { n: 0, KB: 0 }; m[k].n++; m[k].KB += Math.round((r.bytes ?? 0) / 1024) } return JSON.stringify(m) }
  const shown = await page.evaluate(() => { const m = {}; for (const i of document.querySelectorAll('img')) { if (!/dzcdn/.test(i.currentSrc)) continue; const r = i.getBoundingClientRect(); const k = `${(i.currentSrc.match(/\/(\d+x\d+)-/) ?? [])[1]} shown ${Math.round(r.width)}css`; m[k] = (m[k] ?? 0) + 1 } return m })
  console.log(`${device} lobby: shelf-only images ${agg(shelf)} | after search+pick ${agg(all)} | displayed ${JSON.stringify(shown)} dpr=${device === 'phone' ? 3 : 1}`)
  await ctx.close()
}
await browser.close()
