// QA (network): drives lab/net.html (the real transport) under a chosen fault and
// prints timings + the transport's own log.
//   node scripts/qa-network/lab-probe.mjs <sigblack|sigdown|relay-noturn|relay-turn|bigstate> [code]
import { chromium } from 'playwright'

const MODE = process.argv[2] ?? 'sigblack'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const args = []
if (MODE === 'sigblack') args.push('--host-resolver-rules=MAP 0.peerjs.com 192.0.2.1')
if (MODE === 'sigdown') args.push('--host-resolver-rules=MAP 0.peerjs.com ~NOTFOUND')
const browser = await chromium.launch({ channel: 'chrome', headless: true, args })

async function page(label) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log(`[${label}] pageerror`, e.message))
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const fmtLog = (entries, t0) => entries.map((e) => `  +${String(e.at - t0).padStart(6)}ms ${e.scope}: ${e.msg}`).join('\n')

if (MODE === 'sigblack' || MODE === 'sigdown') {
  const c = await page('client')
  const t0 = Date.now()
  const r = await c.evaluate(() => window.netLab.joinRoom('KXQPM'))
  console.log('join result', JSON.stringify(r), `${Date.now() - t0} ms`)
  console.log(fmtLog(await c.evaluate(() => window.netLab.log()), t0))
  const t1 = Date.now()
  const h = await c.evaluate(() => window.netLab.createHost())
  console.log('create result', JSON.stringify(h), `${Date.now() - t1} ms`)
  console.log(fmtLog((await c.evaluate(() => window.netLab.log())).filter((e) => e.at >= t1), t1))
} else if (MODE === 'relay-noturn' || MODE === 'relay-turn') {
  let turn = [{ urls: 'stun:stun.l.google.com:19302' }]
  if (MODE === 'relay-turn') {
    const j = await (await fetch('https://turn.elixir-webrtc.org/?service=turn&username=qa', { method: 'POST' })).json()
    turn = [{ urls: 'turn:turn.elixir-webrtc.org:3478?transport=udp', username: j.username, credential: j.password }]
  }
  const h = await page('host')
  const c = await page('client')
  for (const p of [h, c]) await p.evaluate((t) => { window.netLab.setIce(t); window.netLab.forceRelay(true) }, turn)
  const hr = await h.evaluate(() => window.netLab.createHost())
  console.log('host', JSON.stringify(hr))
  const t0 = Date.now()
  const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
  console.log('join result', JSON.stringify(r), `${Date.now() - t0} ms`)
  console.log(fmtLog(await c.evaluate(() => window.netLab.log()), t0))
  if (r.ok) console.log('paths', await c.evaluate(() => window.netLab.icePaths()))
  await new Promise((res) => setTimeout(res, 1000))
  console.log('host log\n' + fmtLog((await h.evaluate(() => window.netLab.log())).filter((e) => e.at >= t0 - 1000), t0))
  console.log('host stats', JSON.stringify(await h.evaluate(() => window.netLab.stats())))
}
await browser.close()
