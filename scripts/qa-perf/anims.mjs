// List running (infinite / long) animations per screen, and paint-invalidation hot spots via Paint events count.
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const { ctx, page } = await G.newPlayer(browser, DEVICE)
const list = (label) => page.evaluate((label) => {
  const out = new Map()
  for (const a of document.getAnimations()) {
    if (a.playState !== 'running') continue
    const t = a.effect?.target
    if (!t || t.closest?.('[inert]')) continue
    const timing = a.effect.getComputedTiming()
    if (timing.iterations !== Infinity && (timing.endTime ?? 0) < 5000) continue
    const props = a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k))
    const key = `${a.animationName ?? a.constructor.name}{${[...new Set(props)].join(',')}} on ${t.tagName}.${String(t.className?.baseVal ?? t.className ?? '').split(' ').slice(0, 2).join('.')}`
    out.set(key, (out.get(key) ?? 0) + 1)
  }
  return `${label}: ` + [...out].map(([k, v]) => `${v}× ${k}`).join('\n   ')
}, label)
const cdp = await ctx.newCDPSession(page)
async function paints(label) {
  const events = []
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value))
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' })
  await page.waitForTimeout(3000)
  await cdp.send('Tracing.end'); await done
  const p = events.filter((e) => e.name === 'Paint')
  const byNode = new Map()
  for (const e of p) { const k = e.args?.data?.nodeName ?? e.args?.data?.layerId ?? '?'; byNode.set(k, (byNode.get(k) ?? 0) + 1) }
  const raster = events.filter((e) => e.name === 'RasterTask').length
  console.log(`${label}: Paint events/s ${(p.length / 3).toFixed(0)}, RasterTask/s ${(raster / 3).toFixed(0)}; top paint nodes: ` + [...byNode].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}×${v}`).join(', '))
  cdp.removeAllListeners('Tracing.dataCollected')
}
await page.goto(BASE); await G.waitScreen(page, 'home'); await page.waitForTimeout(3000)
console.log(await list('HOME')); await paints('HOME')
await G.createRoom(page); await page.waitForTimeout(2500)
console.log(await list('LOBBY')); await paints('LOBBY')
await G.pickPlaylist(page)
if (DEVICE === 'phone') await page.getByRole('tab', { name: /Regole/ }).click()
await G.setRadio(page, 'Spezzoni', /^16/)
await G.setRadio(page, 'Tempo per round', '180s')
await G.start(page); await G.boardReady(page); await page.waitForTimeout(3000)
console.log(await list('PLAYING')); await paints('PLAYING')
await page.screenshot({ path: new URL(`./shots/anims-${DEVICE}-playing.png`, import.meta.url).pathname })
await G.confirm(page); await G.waitPhase(page, 'reveal'); await page.waitForTimeout(9000)
console.log(await list('REVEAL (after 9s)')); await paints('REVEAL')
await G.nextRound(page, false)
await page.waitForTimeout(1500)
await browser.close()
