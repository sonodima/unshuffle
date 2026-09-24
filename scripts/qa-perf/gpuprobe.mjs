import { chromium } from 'playwright'
for (const args of [[], ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']]) {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', ...args] })
  const page = await browser.newPage()
  await page.goto('about:blank')
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2')
    const d = gl.getExtension('WEBGL_debug_renderer_info')
    return { r: gl.getParameter(d.UNMASKED_RENDERER_WEBGL), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2') }
  })
  console.log(args.join(' ') || '(default)', r)
  await browser.close()
}
