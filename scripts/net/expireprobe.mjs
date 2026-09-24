// Measures how the public PeerJS server answers offers to unknown ids.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:5205/lab/net.html')
await page.waitForFunction(() => !!window.netLab)
const mode = process.argv[2] ?? 'same'
const out = await page.evaluate(async (mode) => {
  const { Peer } = await window.netLab.peerjs()
  const peer = new Peer('unshuffle-v1-probe-' + Math.random().toString(36).slice(2))
  await new Promise((r) => peer.on('open', r))
  const start = performance.now()
  const errs = []
  peer.on('error', (e) => errs.push({ at: performance.now() - start, msg: e.message }))
  const base = 'unshuffle-v1-NOPE' + Math.random().toString(36).slice(2, 6)
  const log = []
  for (let i = 0; i < 5; i++) {
    const target = mode === 'same' ? base : base + i
    const t0 = performance.now() - start
    const before = errs.length
    const c = peer.connect(target, { reliable: true, serialization: 'json' })
    await new Promise((r) => { const iv = setInterval(() => { if (errs.length > before || performance.now() - start - t0 > 20000) { clearInterval(iv); r() } }, 20) })
    log.push(errs.length > before ? `#${i} answered after ${Math.round(errs[before].at - t0)} ms` : `#${i} no answer in 20 s`)
    c.close()
  }
  peer.destroy()
  return log
}, mode)
console.log(mode, '\n' + out.join('\n'))
await browser.close()
