// Wide play HUD vs player count on tablets: right edge of the HUD / Audio button vs viewport, timer ring centring.
import { BASE, OUT, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'
const NAMES = ['Tommy', 'Giulia', 'DJ Pinguino', 'Marco', 'Sofi', 'Luca', 'Anna', 'Zia Babà', 'Super Diesis', 'MC Basilico']
for (const [w, h] of [[768, 1024], [820, 1180], [1024, 768], [1180, 820]]) {
  const { ctx, page } = await newContext('chromium', { id: `${w}x${h}`, width: w, height: h, mobile: true, dpr: 2, safe: { top: 24, bottom: 20, left: 0, right: 0 } })
  await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
  await installQa(page)
  for (const count of [2, 4, 5, 6, 8, 10]) {
    await goHome(page)
    await sleep(350)
    await page.evaluate(([count, NAMES]) => {
      window.__qa.apply('playing', { n: 8 })
      const G = window.__qa.G
      const r = structuredClone(G.getState().room)
      const base = r.players[1]
      r.players = NAMES.slice(0, count).map((name, i) => ({ ...(r.players[i] ?? base), id: i === 0 ? 'p-host' : r.players[i]?.id ?? `p-x${i}`, name, avatar: i * 3, color: i, isHost: i === 0, connected: true, activeFromRound: 0, score: 9000 - i * 700 }))
      r.seq++
      G.setState({ room: r })
    }, [count, NAMES])
    await sleep(1300)
    const m = await page.evaluate(() => {
      const hud = document.querySelector('[data-round-view="playing"] header')
      const kids = [...hud.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
      const right = Math.max(...kids.map((r) => r.right))
      const audio = [...hud.querySelectorAll('button')].find((b) => /^Audio/.test(b.getAttribute('aria-label') || ''))?.getBoundingClientRect()
      const ring = hud.querySelector('svg')?.closest('div')?.getBoundingClientRect()
      const timer = [...hud.querySelectorAll('*')].find((e) => /^(TEMPO|Tempo)$/.test((e.textContent || '').trim()))?.getBoundingClientRect()
      return { vw: innerWidth, hudRight: Math.round(right), overflowPx: Math.max(0, Math.round(right - innerWidth)), audio: audio && [Math.round(audio.left), Math.round(audio.right)], timerCenterOffset: timer ? Math.round(timer.x + timer.width / 2 - innerWidth / 2) : null, docScrollX: document.documentElement.scrollWidth - innerWidth }
    })
    if (count === 6 || count === 10) await page.screenshot({ path: `${OUT}hud-${w}x${h}-p${count}.png`, clip: { x: 0, y: 0, width: w, height: 200 } })
    console.log(`${w}x${h}`, `players=${count}`, JSON.stringify(m))
  }
  await ctx.close()
}
await closeBrowsers()
