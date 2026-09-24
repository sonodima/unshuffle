// Does Chrome complain when a static server sends the manifest as application/octet-stream
// (like scripts/e2e/static.mjs's sub-path server, whose type table lacks .webmanifest)?
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
const DIST = new URL('./dist/', import.meta.url).pathname
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  let rel = new URL(req.url, 'http://x').pathname.slice(1) || 'index.html'
  try {
    const body = await readFile(join(DIST, rel))
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const msgs = []
page.on('console', (m) => msgs.push(`${m.type()}: ${m.text()}`))
await page.goto(`http://127.0.0.1:${server.address().port}/`)
await page.waitForTimeout(4000)
const cdp = await page.context().newCDPSession(page)
const m = await cdp.send('Page.getAppManifest')
console.log('manifest errors', JSON.stringify(m.errors), 'parsed', !!m.data)
console.log(msgs.join('\n') || 'console clean')
await browser.close()
server.close()
