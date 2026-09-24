import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
for (const cpu of [1, 4]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
    window.__lt = []
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true })
    // time peer connection constructions
    const RPC = window.RTCPeerConnection
    window.__rpc = []
    window.RTCPeerConnection = function (...a) { const t = performance.now(); const pc = new RPC(...a); window.__rpc.push([Math.round(t), +(performance.now() - t).toFixed(1)]); return pc }
    window.RTCPeerConnection.prototype = RPC.prototype
    // time shader compile/link
    window.__gl = { compile: 0, link: 0, status: 0, n: 0 }
    for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
      for (const [m, k] of [['compileShader', 'compile'], ['linkProgram', 'link'], ['getShaderParameter', 'status'], ['getProgramParameter', 'status']]) {
        const orig = P[m]
        P[m] = function (...a) { const t = performance.now(); const r = orig.apply(this, a); window.__gl[k] += performance.now() - t; if (k === 'status') window.__gl.n++; return r }
      }
    }
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.goto('http://127.0.0.1:5318/', { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  await page.waitForTimeout(4000)
  const r = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime), lt: window.__lt, rpc: window.__rpc, gl: Object.fromEntries(Object.entries(window.__gl).map(([k, v]) => [k, +v.toFixed(1)])) }))
  console.log(`cpu ${cpu}x`, JSON.stringify(r))
  await ctx.close()
}
await browser.close()
