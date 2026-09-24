// Checks the fix-build snapshot (npx vite build --outDir scripts/fix-build/dist):
//  - static: head tags, preloaded fonts = the CSS's fonts, manifest + icon sizes, relative URLs
//  - browser (root via `vite preview --outDir scripts/fix-build/dist --port 5474`, and a deep
//    sub-path from a tiny server): home renders with no console errors / warnings (incl.
//    "preloaded but not used"), each font fetched once, CDP manifest without errors,
//    every icon / share image URL resolves.
//   node scripts/fix-build/verify.mjs
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const DIST = new URL('./dist/', import.meta.url).pathname
const ROOT_URL = process.env.BASE ?? 'http://localhost:5474/'
const problems = []
const ok = (cond, msg) => {
  if (!cond) problems.push(msg)
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`)
}

// ---------------------------------------------------------------- static
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const head = html.slice(0, html.indexOf('</head>'))
const attr = (tagSrc, name) => tagSrc.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? (new RegExp(`\\s${name}(\\s|>|/)`).test(tagSrc) ? '' : null)
const tags = [...head.matchAll(/<(link|meta)\b[^>]*>/g)].map((m) => m[0])
const links = (rel) => tags.filter((t) => t.startsWith('<link') && attr(t, 'rel') === rel)

const cssFile = readdirSync(join(DIST, 'assets')).find((f) => /^index-[\w-]+\.css$/.test(f))
const css = readFileSync(join(DIST, 'assets', cssFile), 'utf8')
const preloads = links('preload')
ok(preloads.length === 2, `2 font preloads (got ${preloads.length})`)
for (const t of preloads) {
  const href = attr(t, 'href')
  const name = href.split('/').pop()
  ok(attr(t, 'as') === 'font' && attr(t, 'type') === 'font/woff2' && attr(t, 'crossorigin') !== null, `${name}: as=font type=font/woff2 crossorigin`)
  ok(href.startsWith('./assets/') && statSync(join(DIST, href)).isFile(), `${name}: relative and emitted`)
  ok(css.includes(name), `${name}: the same file the CSS uses`)
}
const pre = links('preconnect').map((t) => attr(t, 'href'))
ok(pre.includes('https://0.peerjs.com') && pre.includes('https://api.deezer.com'), `preconnect ${pre.join(' ')}`)
const dns = links('dns-prefetch').map((t) => attr(t, 'href'))
ok(dns.includes('https://cdn-images.dzcdn.net') && dns.includes('https://cdnt-preview.dzcdn.net'), `dns-prefetch ${dns.join(' ')}`)
ok(!/(src|href)="\/(?!\/)/.test(html), 'no root-absolute URLs')
ok(links('apple-touch-icon').length === 1 && links('manifest').length === 1, 'apple-touch-icon + manifest links')

/** Width × height from a PNG's IHDR / a baseline JPEG's SOF0. */
function imageSize(file) {
  const b = readFileSync(file)
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)]
  for (let i = 2; i < b.length; ) {
    const marker = b[i + 1]
    const len = b.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]
    i += 2 + len
  }
  return [0, 0]
}
const [aw, ah] = imageSize(join(DIST, 'apple-touch-icon.png'))
ok(aw === 180 && ah === 180, `apple-touch-icon.png ${aw}x${ah}`)
const png = readFileSync(join(DIST, 'apple-touch-icon.png'))
ok(png[25] === 2, 'apple-touch-icon.png is opaque RGB (iOS paints transparency black)')
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'))
for (const icon of manifest.icons) {
  ok(!icon.src.startsWith('/') && statSync(join(DIST, icon.src)).isFile(), `manifest icon ${icon.src} exists (relative)`)
  if (icon.type === 'image/png') {
    const [w, h] = imageSize(join(DIST, icon.src))
    ok(icon.sizes === `${w}x${h}`, `manifest icon ${icon.src} declared ${icon.sizes}, is ${w}x${h}`)
  }
}
ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest has a maskable icon')
const [ow, oh] = imageSize(join(DIST, 'og-image.jpg'))
ok(ow === 1200 && oh === 630, `og-image.jpg ${ow}x${oh}`)
ok(statSync(join(DIST, 'og-image.jpg')).size < 300_000, 'og-image.jpg < 300 KB (WhatsApp)')

// ---------------------------------------------------------------- browser
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.map': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' }
async function subpathServer(prefix) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    if (!url.pathname.startsWith(prefix)) return void res.writeHead(404).end('outside the sub-path')
    let rel = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!rel || rel.endsWith('/')) rel += 'index.html'
    const file = join(DIST, normalize(rel).replace(/^(\.\.[/\\])+/, ''))
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

const browser = await chromium.launch({ channel: 'chrome' })
async function check(label, base, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('unshuffle:onboarded', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  const messages = []
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && messages.push(`${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  const cdp = await ctx.newCDPSession(page)
  await page.goto(base)
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor({ timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  // Chrome reports unused preloads ~3 s after load.
  await page.waitForTimeout(4500)
  const r = await page.evaluate(() => ({
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    fontFetches: performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.woff2')).map((e) => e.name.split('/').pop()),
  }))
  const counts = {}
  for (const f of r.fontFetches) counts[f] = (counts[f] ?? 0) + 1
  ok(Object.values(counts).every((n) => n === 1), `${label}: each font fetched once ${JSON.stringify(counts)}`)
  ok(r.fonts.some((f) => /Unbounded/.test(f)) && r.fonts.some((f) => /Manrope/.test(f)), `${label}: Unbounded + Manrope loaded`)
  const { url: manifestUrl, errors, data } = await cdp.send('Page.getAppManifest')
  ok(!!data && errors.length === 0, `${label}: manifest ${manifestUrl} parsed, errors ${JSON.stringify(errors)}`)
  const inst = await cdp.send('Page.getInstallabilityErrors').catch(() => ({ installabilityErrors: [] }))
  // Playwright contexts are incognito-like: that one is expected.
  const instErrors = inst.installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')
  ok(instErrors.length === 0, `${label}: installability errors ${JSON.stringify(instErrors)}`)
  const urls = await page.evaluate(() => {
    const abs = (sel, a) => [...document.querySelectorAll(sel)].map((el) => new URL(el.getAttribute(a), document.baseURI).href)
    return [...abs('link[rel="icon"]', 'href'), ...abs('link[rel="apple-touch-icon"]', 'href'), ...abs('meta[property="og:image"]', 'content')]
  })
  const man = JSON.parse(data)
  for (const icon of man.icons) urls.push(new URL(icon.src, manifestUrl).href)
  urls.push(new URL(man.start_url, manifestUrl).href)
  for (const u of urls) {
    const res = await page.request.get(u)
    ok(res.status() === 200, `${label}: ${u.replace(base, './')} → ${res.status()}`)
  }
  const boot = await page.evaluate(() => getComputedStyle(document.getElementById('boot')).display)
  ok(boot === 'none', `${label}: boot screen hidden once the app rendered (display ${boot})`)
  ok(messages.length === 0, `${label}: console clean ${messages.length ? JSON.stringify(messages) : ''}`)
  await ctx.close()
}
await check('root desktop', ROOT_URL, { width: 1440, height: 900 })
await check('root phone', ROOT_URL, { width: 390, height: 844 })
const sub = await subpathServer('/giochi/party/unshuffle/')
await check('sub-path', sub.url, { width: 390, height: 844 })
sub.server.close()
await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall checks passed')
process.exit(problems.length ? 1 : 0)
