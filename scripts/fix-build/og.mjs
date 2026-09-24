// Screenshots the share card lab (lab/fix-build.html on the fix-build dev server)
// into scripts/fix-build/icons/og-image.jpg (1200×630) + a grid preview.
//   node scripts/fix-build/og.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5414'
const OUT = new URL('./icons/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('[page]', m.type(), m.text()))
for (const [q, file] of [
  ['', 'og-image.jpg'],
  ['?grid=1', 'og-grid.png'],
]) {
  await page.goto(`${BASE}/lab/fix-build.html${q}`)
  await page.locator('[data-card]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(2500)
  // JPEG keeps it well under WhatsApp's ~300 KB limit for link previews.
  const jpeg = file.endsWith('.jpg')
  await page.locator('[data-card]').screenshot({ path: OUT + file, ...(jpeg ? { type: 'jpeg', quality: 86 } : {}) })
  console.log(file)
}
await browser.close()
