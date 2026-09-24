// Does creating an AudioContext before any gesture log a console warning in Chrome? How long does it take?
import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome' })
const html = `<html><body>hi<script>
setTimeout(() => {
  const t0 = performance.now()
  const ctx = new AudioContext({ latencyHint: 'interactive' })
  const t1 = performance.now()
  window.__r = { ctorMs: t1 - t0, state: ctx.state, hb: navigator.userActivation.hasBeenActive }
  window.__ctx = ctx
  document.addEventListener('pointerdown', () => { const t = performance.now(); ctx.resume(); window.__r.resumeMs = performance.now() - t }, { once: true })
}, 500)
</script></body></html>`
for (const cpu of [1, 4]) {
  const p = await b.newPage()
  const msgs = []
  p.on('console', (m) => msgs.push(`${m.type()}: ${m.text()}`))
  const cdp = await p.context().newCDPSession(p)
  await cdp.send('Log.enable')
  cdp.on('Log.entryAdded', (e) => msgs.push(`LOG ${e.entry.level}: ${e.entry.text}`))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await p.route('http://x.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }))
  await p.goto('http://x.test/')
  await p.waitForTimeout(1000)
  const before = await p.evaluate(() => ({ ...window.__r }))
  await p.mouse.click(10, 10)
  await p.waitForTimeout(300)
  const after = await p.evaluate(() => ({ ...window.__r, state: window.__ctx.state }))
  console.log(`cpu x${cpu}`, JSON.stringify(before), '→ after click', JSON.stringify(after))
  console.log('  console:', msgs.length ? msgs.join(' | ') : '(none)')
  await p.close()
}
await b.close()
