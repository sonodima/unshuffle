// Rate limiter + error-path probes against the live API (run with the dev server up).
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:5208/lab/deezer.html')
await page.waitForFunction(() => window.__deezerReport?.done === true, null, { timeout: 120_000 })
await page.waitForTimeout(5500) // let the lab's rate window drain
const out = await page.evaluate(async () => {
  const dz = await import('/src/lib/deezer.ts')
  const tracks = await dz.getPlaylistTracks(3155776842)
  const ids = tracks.slice(0, 70).map((t) => t.id)
  const t0 = performance.now()
  const results = await Promise.allSettled(ids.map((id) => dz.dzGet(`/track/${id}`)))
  const ms = Math.round(performance.now() - t0)
  const failed = results.filter((r) => r.status === 'rejected').map((r) => `${r.reason?.kind}:${r.reason?.message}`)
  let imageProbe = ''
  try { await dz.dzGet('/playlist/1116187241/image') } catch (e) { imageProbe = `${e.kind}: ${e.message}` }
  let emptyTracks = ''
  try { emptyTracks = String((await dz.getPlaylistTracks(99999999999)).length) } catch (e) { emptyTracks = `${e.kind}: ${e.message}` }
  let noPreview = ''
  try { await dz.refreshPreview(1) } catch (e) { noPreview = `${e.kind}: ${e.message}` }
  return { requests: ids.length, ms, failed, imageProbe, emptyTracks, noPreview, scripts: document.querySelectorAll('script[src*="api.deezer.com"]').length }
})
console.log(JSON.stringify(out, null, 2))
await browser.close()
