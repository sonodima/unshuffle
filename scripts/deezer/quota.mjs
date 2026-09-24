// Simulates a Deezer quota error (code 4) on the first JSONP response and checks the single retry.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:5208/lab/deezer.html')
await page.waitForFunction(() => window.__deezerReport?.done === true, null, { timeout: 120_000 })
const out = await page.evaluate(async () => {
  const dz = await import('/src/lib/deezer.ts')
  const realAppend = HTMLHeadElement.prototype.appendChild
  let fakeQuota = 0
  const log = []
  HTMLHeadElement.prototype.appendChild = function (node) {
    const src = node instanceof HTMLScriptElement ? node.src : ''
    if (src.includes('quota-probe')) {
      const cb = new URL(src).searchParams.get('callback')
      log.push({ at: Math.round(performance.now()), cb })
      if (src.includes('always') || fakeQuota++ === 0) {
        setTimeout(() => window[cb]({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }), 5)
        return node
      }
    }
    return realAppend.call(this, node)
  }
  const t0 = performance.now()
  const ok = await dz.searchPlaylists('quota-probe hits')
  const once = { results: ok.length, ms: Math.round(performance.now() - t0), attempts: log.length }
  log.length = 0
  let twice = ''
  try { await dz.dzGet('/search/playlist', { q: 'quota-probe always' }) } catch (e) { twice = `${e.kind} ${e.code}: ${e.message} after ${log.length} attempts` }
  HTMLHeadElement.prototype.appendChild = realAppend
  return { once, twice }
})
console.log(JSON.stringify(out, null, 2))
await browser.close()
