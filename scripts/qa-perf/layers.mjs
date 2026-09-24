// Composited layers per screen (phone DPR3): biggest layers and estimated GPU memory (w*h*dpr^2*4).
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'phone'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const { ctx, page } = await G.newPlayer(browser, DEVICE)
const cdp = await ctx.newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('LayerTree.enable')
let layers = []
let ev = 0
cdp.on('LayerTree.layerTreeDidChange', (e) => { ev++; if (e.layers) layers = e.layers })
const dpr = DEVICE === 'phone' ? 3 : 1
async function report(label) {
  await cdp.send('LayerTree.disable'); layers = []; await cdp.send('LayerTree.enable')
  await page.waitForTimeout(1500)
  await cdp.send('DOM.getDocument', { depth: -1, pierce: true })
  const rows = []
  for (const l of layers.filter((l) => l.drawsContent)) {
    let name = '?'
    if (l.backendNodeId) {
      try {
        const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: l.backendNodeId })
        const { result } = await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: 'function(){ const e = this.nodeType === 1 ? this : this.parentElement; return e ? e.localName + "." + String(e.className?.baseVal ?? e.className ?? "").split(" ").slice(0, 2).join(".") : "#" + this.nodeName }', returnByValue: true })
        name = result.value
      } catch (e) { name = 'err:' + String(e.message).slice(0, 30) }
    }
    rows.push({ name, w: Math.round(l.width), h: Math.round(l.height), MB: +((l.width * l.height * dpr * dpr * 4) / 1048576).toFixed(1) })
  }
  rows.sort((a, b) => b.MB - a.MB)
  const total = rows.reduce((a, r) => a + r.MB, 0)
  console.log(`${DEVICE} ${label}: ${rows.length} drawing layers, est ${total.toFixed(0)} MB; top: ` + rows.slice(0, 6).map((r) => `${r.name} ${r.w}x${r.h}css ${r.MB}MB`).join(' | '))
}
await page.goto(BASE); await G.waitScreen(page, 'home'); await page.waitForTimeout(2000)
await report('home')
await G.createRoom(page)
await report('lobby')
await browser.close()
