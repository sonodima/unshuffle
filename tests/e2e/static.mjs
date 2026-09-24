// Production build check (run `npm run build` first, then `npm run preview`):
//   node tests/e2e/static.mjs [baseUrl]   (default http://localhost:4173/ = `npm run preview`)
//   env SUBPATH=1 additionally serves dist/ under a deep sub-path from a tiny static
//   server, proving the relative base ('./') works from any folder.
// Checks: home renders with no console errors; the analysis worker chunk loads
// (relative URL) and runs; a SOLO game starts: create room → pick a playlist →
// start → the board renders with real waveforms.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { mkdirSync } from 'node:fs'

const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const DIST = new URL('../../dist/', import.meta.url).pathname
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.map': 'application/json', '.png': 'image/png' }
async function subpathServer(prefix) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404).end('outside the sub-path')
      return
    }
    let rel = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!rel || rel.endsWith('/')) rel += 'index.html'
    rel = normalize(rel).replace(/^(\.\.[/\\])+/, '')
    const file = join(DIST, rel)
    try {
      if (!(await stat(file)).isFile()) throw new Error('nope')
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(await readFile(file))
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { server, url: `http://127.0.0.1:${server.address().port}${prefix}` }
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const problems = []

async function runCheck(label, base, { solo }) {
  log(`== ${label}: ${base}`)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('unshuffle:onboarded', '1')
    } catch {
      /* ignore */
    }
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)))
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  const bad = []
  page.on('response', (r) => {
    const u = r.url()
    if (u.startsWith(base.replace(/\/[^/]*$/, '')) && r.status() >= 400) bad.push(`${r.status()} ${u}`)
  })
  const workers = []
  page.on('worker', (w) => workers.push(w.url()))

  await page.goto(base, { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).waitFor()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}static-${label}-home.png` })
  log('home rendered')

  if (solo) {
    await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
    await page.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').waitFor({ timeout: 30_000 })
    const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
    await search.fill('rock classics')
    const first = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
    await first.waitFor({ timeout: 20_000 })
    await page.waitForTimeout(500)
    log('playlist:', await first.getAttribute('title'))
    await first.click()
    await page.getByRole('radiogroup', { name: 'Spezzoni' }).getByRole('radio', { name: /^8/ }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /Inizia partita/ }).first().click()
    await page.waitForFunction(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase="playing"]'), null, { timeout: 90_000 })
    await page.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10_000 })
    await page.waitForTimeout(2200)
    const board = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-round-view="playing"] .sb-item')]
      // A waveform is drawn when its canvas has non-transparent pixels.
      const drawn = items.filter((it) => {
        const c = it.querySelector('canvas')
        if (!c || !c.width || !c.height) return false
        const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data
        if (!d) return false
        let lit = 0
        for (let i = 3; i < d.length; i += 16) if (d[i] > 40) lit++
        return lit > 50
      }).length
      return { n: items.length, drawn }
    })
    log('board', board)
    if (board.n !== 8) problems.push(`[${label}] expected 8 blocks, got ${board.n}`)
    if (board.drawn !== board.n) problems.push(`[${label}] waveforms drawn on ${board.drawn}/${board.n} blocks`)
    await page.screenshot({ path: `${OUT}static-${label}-board.png` })
    const w = workers.filter((u) => /worker-[\w-]+\.js/.test(u))
    log('workers', workers)
    if (w.length === 0) problems.push(`[${label}] the analysis worker chunk never started`)
    else if (!w[0].startsWith(base.replace(/[^/]*$/, ''))) problems.push(`[${label}] worker not loaded relative to the page: ${w[0]}`)
  }
  if (errors.length) problems.push(...errors.map((e) => `[${label}] console: ${e}`))
  if (bad.length) problems.push(...bad.map((e) => `[${label}] http: ${e}`))
  await ctx.close()
}

try {
  await runCheck('preview', process.argv[2] ?? 'http://localhost:4173/', { solo: true })
  if (process.env.SUBPATH) {
    const { server, url } = await subpathServer('/giochi/unshuffle/')
    try {
      await runCheck('subpath', url, { solo: true })
    } finally {
      server.close()
    }
  }
} catch (err) {
  problems.push(`FATAL ${err?.stack ?? err}`)
} finally {
  await browser.close()
}
console.log('\n---- problems ----')
console.log(problems.length ? problems.join('\n') : '(none)')
console.log(`STATIC ${problems.length ? 'FAIL' : 'PASS'} in ${((Date.now() - T0) / 1000).toFixed(1)}s`)
process.exit(problems.length ? 1 : 0)
