import { chromium } from 'playwright'
const variants = [
  [],
  ['--enable-gpu', '--use-angle=metal'],
  ['--use-gl=angle', '--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
]
for (const extra of variants) {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', ...extra] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:5303/lab/reveal.html?me=p-3&ui=0&audio=0', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2) }; requestAnimationFrame(f) }))
  const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none' })
  console.log(extra.join(' ') || '(default)', 'fps', fps, gl)
  await browser.close()
}
