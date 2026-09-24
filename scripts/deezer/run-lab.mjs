// Drives lab/deezer.html against the live Deezer API, prints the report and
// saves phone + desktop screenshots under scripts/deezer/shots/.
// Needs the dev server: UNSHUFFLE_VITE_CACHE=node_modules/.vite-deezer npx vite --port 5208 --strictPort
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const LAB = process.env.LAB_URL ?? 'http://localhost:5208/lab/deezer.html'
const OUT = new URL('./shots/', import.meta.url).pathname

const browser = await chromium.launch({ channel: 'chrome' })

async function run(name, contextOptions) {
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(LAB)
  await page.waitForFunction(() => window.__deezerReport?.done === true, null, { timeout: 120_000 })
  // Let cover images finish decoding before the screenshot.
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(600)
  const report = await page.evaluate(() => window.__deezerReport)
  await page.screenshot({ path: `${OUT}${name}-full.png`, fullPage: true })
  await page.screenshot({ path: `${OUT}${name}-top.png` })
  const swatches = page.locator('section', { hasText: 'Cover → accenti neon' })
  await swatches.screenshot({ path: `${OUT}${name}-swatches.png` })
  await context.close()
  return { report, errors }
}

const desktop = await run('desktop', { viewport: { width: 1440, height: 900 } })
const phone = await run('phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await browser.close()

const r = desktop.report
writeFileSync(`${OUT}report.json`, JSON.stringify(r, null, 2))
console.log('\n== checks (desktop run)')
for (const c of r.checks) console.log(`${c.status === 'ok' ? 'OK  ' : 'FAIL'} ${c.name} — ${c.detail} (${c.ms} ms)`)
console.log('\n== phone run:', phone.report.checks.filter((c) => c.status !== 'ok').map((c) => `${c.name}: ${c.detail}`).join(' | ') || 'all ok')
console.log('\n== featured:', r.featured.map((p) => `${p.title} (${p.nbTracks})`).join(' · '))
console.log('\n== chips')
for (const c of r.chips) console.log(`${c.emoji} ${c.label} [${c.query}] → ${c.playlists.slice(0, 3).map((p) => `${p.title} (${p.nbTracks})`).join(' · ')}`)
console.log('\n== distribution', JSON.stringify({ ...r.distribution, sample: r.distribution?.sample.map((t) => `${t.artist} – ${t.title}`) }))
console.log('\n== swatches', r.swatches.map((s) => `${s.track.artist}: ${s.colors.primary}/${s.colors.secondary}${s.colors.isDark ? ' dark' : ''} ${s.ms}ms`).join(' | '))
console.log('\n== leftovers', JSON.stringify(r.leftovers))
console.log('== page errors', JSON.stringify([...desktop.errors, ...phone.errors]))
