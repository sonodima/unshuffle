// QA "code": does locking the board mid-drag (time's up) cancel the drag?
// SnippetBoard dispatches a synthetic Escape on `window`; dnd-kit listens on `document`.
// Usage: node scripts/qa-code/lock-mid-drag.mjs [baseUrl]  (default http://127.0.0.1:5305/)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5305/'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
try {
  await page.goto(`${BASE}lab/board.html?audio=synth&engine=mock&n=8`)
  await page.locator('.sb-item').first().waitFor({ timeout: 20_000 })
  await page.waitForTimeout(800)
  const box = await page.locator('.sb-item[data-pos="0"]').boundingBox()
  const target = await page.locator('.sb-item[data-pos="3"]').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width / 2 + ((target.x - box.x) * i) / 10, box.y + box.height / 2 + ((target.y - box.y) * i) / 10)
    await page.waitForTimeout(16)
  }
  const draggingBefore = await page.evaluate(() => !!document.querySelector('.sb-board[data-dragging]'))
  // Time's up: the parent locks the board while the block is still held.
  await page.evaluate(() => window.__lab.setLocked(true))
  await page.waitForTimeout(400)
  const draggingAfterLock = await page.evaluate(() => !!document.querySelector('.sb-board[data-dragging]'))
  const overlay = await page.evaluate(() => !!document.querySelector('.sb-overlay .sb-lift'))
  await page.screenshot({ path: `${OUT}lock-mid-drag.png` })
  // Control: a real Escape keydown dispatched on document does cancel.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })))
  await page.waitForTimeout(400)
  const draggingAfterDocEsc = await page.evaluate(() => !!document.querySelector('.sb-board[data-dragging]'))
  await page.mouse.up()
  console.log(JSON.stringify({ draggingBefore, draggingAfterLock, liftedOverlayStillShown: overlay, draggingAfterDocumentEscape: draggingAfterDocEsc }))
} finally {
  await browser.close()
}
