// (1) fresh source id → same unknown target: answered fast?
// (2) unanswered (queued) offer: delivered when the target registers later?
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:5205/lab/net.html')
await page.waitForFunction(() => !!window.netLab)
const out = await page.evaluate(async () => {
  const { Peer } = await window.netLab.peerjs()
  const open = (id) => new Promise((r) => { const p = new Peer(id); p.on('open', () => r(p)) })
  const rnd = () => Math.random().toString(36).slice(2, 8)
  const log = []
  const target = 'unshuffle-v1-NOPE' + rnd()
  // (1)
  for (let i = 0; i < 3; i++) {
    const p = await open('unshuffle-v1-src-' + rnd())
    const t0 = performance.now()
    const got = await new Promise((r) => { p.on('error', (e) => r(`${e.type} after ${Math.round(performance.now() - t0)} ms`)); p.connect(target, { serialization: 'json', reliable: true }); setTimeout(() => r('no answer in 8 s'), 8000) })
    log.push(`fresh src #${i}: ${got}`)
    p.destroy()
  }
  // (2) same src twice, then target comes online after 2 s
  const target2 = 'unshuffle-v1-LATE' + rnd()
  const src = await open('unshuffle-v1-src-' + rnd())
  const errs = []
  src.on('error', (e) => errs.push(e.type))
  const c1 = src.connect(target2, { serialization: 'json', reliable: true })
  await new Promise((r) => setTimeout(r, 600))
  c1.close()
  const c2 = src.connect(target2, { serialization: 'json', reliable: true })
  const t0 = performance.now()
  let opened = null
  c2.on('open', () => (opened = Math.round(performance.now() - t0)))
  await new Promise((r) => setTimeout(r, 2000))
  const late = await open(target2)
  let incoming = 0
  late.on('connection', (c) => { incoming++; c.on('open', () => {}) })
  await new Promise((r) => setTimeout(r, 6000))
  log.push(`queued offer: errors=${JSON.stringify(errs)} incoming=${incoming} c2 opened=${opened} ms`)
  src.destroy(); late.destroy()
  return log
})
console.log(out.join('\n'))
await browser.close()
