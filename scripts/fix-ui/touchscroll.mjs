// Touch-scroll the landscape dialog (CDP synthesized gesture) from the body and from the header.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h] of [[844, 390], [568, 320]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5407/lab/fix-ui.html?view=modal&modal=avatar', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const cdp = await ctx.newCDPSession(page)
  const st = () => page.evaluate(() => document.querySelector('[role=dialog]').scrollTop)
  const box = await page.locator('[data-modal-body]').boundingBox()
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(box.x + box.width / 2), y: Math.round(Math.min(box.y + 60, h - 120)), yDistance: -160, gestureSourceType: 'touch', speed: 800 })
  await page.waitForTimeout(500)
  const afterBody = await st()
  await page.evaluate(() => (document.querySelector('[role=dialog]').scrollTop = 0))
  const head = await page.locator('[role=dialog] h2').boundingBox()
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(head.x + 20), y: Math.round(head.y + 8), yDistance: -120, gestureSourceType: 'touch', speed: 800 })
  await page.waitForTimeout(500)
  const afterHead = await st()
  const open = await page.locator('[role=dialog]').count()
  console.log(`${w}x${h} scrollTop after body swipe=${afterBody} after header swipe=${afterHead} dialogOpen=${open}`)
  await ctx.close()
}
await browser.close()
