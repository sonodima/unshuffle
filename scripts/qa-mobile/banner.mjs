// First-submit banner vs the compact HUD's timer: with a realistic 2-word default name the banner
// wraps and hides the live countdown for BANNER_MS (4.6 s) of a 10-30 s final window.
import { BASE, OUT, VIEWPORTS, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'
const NAMES = ['Giulia', 'DJ Pinguino', 'Signor Maritozzo', 'WWWWWWWWWWWWWWWW']
const runs = [['chromium', VIEWPORTS[0]], ['chromium', VIEWPORTS[1]], ['chromium', VIEWPORTS[2]], ['chromium', VIEWPORTS[3]], ['webkit', 'iphone14']]
for (const [engine, vp] of runs) {
  const id = vp === 'iphone14' ? vp : vp.id
  const { ctx, page } = await newContext(engine, vp)
  await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
  await installQa(page)
  for (const name of NAMES) {
    await goHome(page)
    await sleep(400)
    await page.evaluate((name) => {
      const room = window.__qa.apply('finalTimer', { n: 8, meId: 'p-host' })
      const G = window.__qa.G
      const r = structuredClone(G.getState().room)
      const fid = r.phase.firstSubmit.playerId
      r.players = r.players.map((p) => (p.id === fid ? { ...p, name } : p))
      r.phase.firstSubmit.at = Date.now() - 200
      r.seq++
      G.setState({ room: r })
      return !!room
    }, name)
    await sleep(900)
    const m = await page.evaluate(() => {
      const banner = [...document.querySelectorAll('[role="status"][aria-live="assertive"]')].find((e) => e.getBoundingClientRect().height > 10 && /confermato/i.test(e.textContent || ''))
      const hud = document.querySelector('[data-round-view="playing"] header')
      const bar = hud && [...hud.querySelectorAll('*')].find((e) => /^\d:\d\d$/.test((e.textContent || '').trim()) && e.children.length === 0)
      const b = banner?.getBoundingClientRect()
      const t = bar?.getBoundingClientRect()
      const hit = t ? document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2) : null
      return { banner: b && [Math.round(b.top), Math.round(b.bottom)], clock: t && [Math.round(t.top), Math.round(t.bottom), bar.textContent.trim()], clockCovered: !!(hit && banner && banner.contains(hit)) || !!(b && t && b.bottom > t.top + 2 && b.top < t.bottom) }
    })
    await page.screenshot({ path: `${OUT}banner-${engine}-${id}-${name.replace(/\W+/g, '_')}.png`, clip: { x: 0, y: 0, width: page.viewportSize().width, height: Math.min(260, page.viewportSize().height) } })
    console.log(engine, id, name.padEnd(18), JSON.stringify(m))
  }
  await ctx.close()
}
await closeBrowsers()
