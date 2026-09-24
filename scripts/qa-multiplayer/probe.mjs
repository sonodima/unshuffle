import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
const p = await ctx.newPage()
p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 200)))
await p.goto('http://127.0.0.1:5301/')
await p.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
await p.getByRole('button', { name: 'Crea stanza', exact: true }).click()
await p.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').waitFor({ timeout: 30000 })
const r = await p.evaluate(async () => {
  const m = await import('/src/game/store.ts')
  const s = m.useGame.getState()
  const scripts = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('game/store'))
  return { role: s.role, code: s.room?.code, players: s.room?.players.length, scripts }
})
console.log(r)
await b.close()
