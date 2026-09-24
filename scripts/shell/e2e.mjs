// Real store over PeerJS: host + client tabs → lobby, join toast, reaction floaters, kick → exit notice.
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const logs = []
async function tab(name, opts) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${name}] ${m.type()} ${m.text().slice(0, 300)}`))
  page.on('pageerror', (e) => logs.push(`[${name}] pageerror ${e.message}`))
  await page.goto('http://localhost:5215/', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    // Same module instance as the app (the dev server may have appended ?t= after HMR).
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/game\/store\.ts(\?|$)/.test(n)) ?? '/src/game/store.ts'
    const m = await import(/* @vite-ignore */ url)
    window.__useGame = m.useGame
  })
  return page
}
const host = await tab('host', { viewport: { width: 1440, height: 900 } })
const client = await tab('client', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await host.evaluate(() => window.__useGame.getState().setProfile({ name: 'Tommy' }))
const code = await host.evaluate(() => window.__useGame.getState().createRoom())
console.log('room', code)
await host.waitForTimeout(800)
console.log('host screen', await host.getAttribute('[data-screen-frame]:not([inert])', 'data-screen'), await host.title())
await client.evaluate(() => window.__useGame.getState().setProfile({ name: 'Giulia' }))
await client.evaluate((c) => window.__useGame.getState().joinRoom(c), code)
await client.waitForTimeout(800)
console.log('client screen', await client.getAttribute('[data-screen-frame]:not([inert])', 'data-screen'), await client.title())
await host.waitForTimeout(300)
await host.screenshot({ path: `${OUT}e2e-host-joined.png` })
// reactions both ways
for (const e of ['🔥', '😂', '🎉']) {
  await client.evaluate((x) => window.__useGame.getState().react(x), e)
  await client.waitForTimeout(450)
}
await host.evaluate(() => window.__useGame.getState().react('😎'))
await host.waitForTimeout(700)
await host.screenshot({ path: `${OUT}e2e-host-reactions.png` })
await client.screenshot({ path: `${OUT}e2e-client-reactions.png` })
// kick the client → exit notice on the client
const clientId = await client.evaluate(() => window.__useGame.getState().me)
await host.evaluate((id) => window.__useGame.getState().kick(id), clientId)
await client.waitForTimeout(1200)
console.log('client after kick', await client.getAttribute('[data-screen-frame]:not([inert])', 'data-screen'), await client.getByRole('dialog').allInnerTexts())
await client.screenshot({ path: `${OUT}e2e-client-kicked.png` })
await host.waitForTimeout(400)
await host.screenshot({ path: `${OUT}e2e-host-after-kick.png` })
await browser.close()
console.log(logs.join('\n') || 'no console errors')
