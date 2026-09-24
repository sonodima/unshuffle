// Browser checks for the store lab (http://localhost:5207/lab/store.html):
//  1. every selector hook renders fixture states without loops / console errors
//  2. a real host ↔ client session over the public PeerJS cloud: join, reaction,
//     profile edit, client refresh resume, host refresh resume, leave.
// Run: node scripts/store/lab.mjs   (dev server on :5207 must be running)

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const LAB_URL = 'http://localhost:5207/lab/store.html'
const SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const problems = []
let failed = false
const check = (ok, label) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`)
  if (!ok) failed = true
}

function watch(page, name) {
  page.on('console', (m) => {
    const text = m.text()
    if (m.type() === 'error' || /Maximum update depth|getSnapshot should be cached|infinite loop/i.test(text)) {
      problems.push(`[${name}] ${m.type()}: ${text}`)
    }
  })
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 1. fixtures ------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  watch(page, 'fixtures')
  await page.goto(LAB_URL)
  await page.waitForSelector('[data-testid="fx-lobby"]')
  const timerCards = ['useRemainingMs / useSecondsLeft', 'useSecondsLeft (isolated)']
  for (const name of ['lobby', 'preparing', 'intro', 'playing', 'finalTimer', 'reveal', 'final']) {
    await page.click(`[data-testid="fx-${name}"]`)
    await sleep(400)
    const a = await page.evaluate(() => window.__lab.renders())
    await sleep(1500)
    const b = await page.evaluate(() => window.__lab.renders())
    const moved = Object.keys(b).filter((k) => b[k] !== a[k] && !timerCards.includes(k))
    check(moved.length === 0, `${name}: idle re-renders only in timer cards ${moved.length ? JSON.stringify(moved) : ''}`)
    const secsDelta = (b['useSecondsLeft (isolated)'] ?? 0) - (a['useSecondsLeft (isolated)'] ?? 0)
    check(secsDelta <= 6, `${name}: useSecondsLeft re-rendered ${secsDelta}× in 1.5s (≤ 6 with StrictMode)`)
  }
  await page.click('[data-testid="fx-reveal"]')
  await sleep(300)
  await page.screenshot({ path: `${SHOTS}fixtures-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.click('[data-testid="fx-playing"]')
  await sleep(300)
  await page.screenshot({ path: `${SHOTS}fixtures-phone.png` })
  await ctx.close()
}

// ---- 2. real session ------------------------------------------------------------------
const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const clientCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const host = await hostCtx.newPage()
const client = await clientCtx.newPage()
watch(host, 'host')
watch(client, 'client')
await Promise.all([host.goto(LAB_URL), client.goto(LAB_URL)])

const state = (page) => page.evaluate(() => {
  const s = window.__lab.useGame.getState()
  return {
    role: s.role,
    connection: s.connection,
    error: s.error,
    code: s.room?.code ?? null,
    players: s.room?.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, connected: p.connected })) ?? [],
    toasts: s.toasts.map((t) => t.event.type),
    me: s.me,
    hash: location.hash,
  }
})
async function until(page, pred, label, timeout = 30_000) {
  const t0 = Date.now()
  let last
  while (Date.now() - t0 < timeout) {
    last = await state(page)
    if (pred(last)) {
      check(true, `${label} (${Date.now() - t0} ms)`)
      return last
    }
    await sleep(150)
  }
  check(false, `${label} — last: ${JSON.stringify(last)}`)
  return last
}

await host.click('[data-testid="create"]')
const h1 = await until(host, (s) => s.role === 'host' && s.connection === 'open' && !!s.code, 'host: room created')
const code = h1.code
check(h1.hash === `#/r/${code}`, `host: hash is #/r/${code}`)

await client.fill('[data-testid="code"]', code.toLowerCase())
await client.click('[data-testid="join"]')
const c1 = await until(client, (s) => s.role === 'client' && s.connection === 'open' && s.players.length === 2, 'client: welcomed with 2 players')
check(c1.hash === `#/r/${code}`, 'client: hash synced')
await until(host, (s) => s.players.length === 2 && s.players[1].connected, 'host: sees the client')
await until(host, (s) => s.toasts.includes('player-joined'), 'host: player-joined toast')

await client.click('[data-testid="react-🔥"]')
await until(host, (s) => s.toasts.includes('reaction'), 'host: receives reaction toast')
await host.click('[data-testid="react-🎉"]')
await until(client, (s) => s.toasts.includes('reaction'), 'client: receives host reaction toast')

const avatarBefore = c1.players.find((p) => p.id === c1.me).avatar
await client.click('text=Cambia avatar')
await until(host, (s) => s.players.find((p) => p.id === c1.me)?.avatar === (avatarBefore + 1) % 24, 'host: sees client profile edit')

const clockOffset = await client.evaluate(async () => {
  const { hostNow } = await import('/src/game/clock.ts')
  return Math.abs(hostNow() - Date.now())
})
check(clockOffset < 250, `client: clock offset vs host ${Math.round(clockOffset)} ms (same machine → ~0)`)
await host.screenshot({ path: `${SHOTS}live-host-phone.png` })
await client.screenshot({ path: `${SHOTS}live-client-phone.png` })

// Client refresh → resumeSession re-attaches the same player (no duplicate).
await client.reload()
await client.waitForSelector('[data-testid="create"]')
const resumedClient = await client.evaluate(() => window.__lab.useGame.getState().resumeSession())
check(resumedClient === true, 'client: resumeSession() after refresh → true')
await until(client, (s) => s.connection === 'open' && s.players.length === 2, 'client: back in the room after refresh')
await until(host, (s) => s.players.length === 2 && s.players.every((p) => p.connected), 'host: still 2 players, all connected')

// Host refresh → reclaims the code with its snapshot; the client reconnects by itself.
await host.reload()
await host.waitForSelector('[data-testid="create"]')
const resumedHost = await host.evaluate(() => window.__lab.useGame.getState().resumeSession())
check(resumedHost === true, 'host: resumeSession() after refresh → true')
const h2 = await until(host, (s) => s.role === 'host' && s.connection === 'open' && s.code === code, 'host: same code reclaimed')
check(h2.players.length === 2, 'host: restored player list')
await until(client, (s) => s.connection === 'open' && s.players.length === 2, 'client: survived the host refresh', 45_000)
await until(host, (s) => s.players.length === 2 && s.players.every((p) => p.connected), 'host: client re-attached', 45_000)

// Client leaves → host sees it; client is home.
await client.click('[data-testid="leave"]')
const c3 = await state(client)
check(c3.role === 'none' && c3.connection === 'idle' && c3.hash === '#/', 'client: leave resets state and hash')
const leftSession = await client.evaluate(() => sessionStorage.getItem('unshuffle:session'))
check(leftSession === null, 'client: session key cleared')
await until(host, (s) => s.toasts.includes('player-left') || s.players.length === 1, 'host: notices the client leaving')

// Rejoin, then the host closes the room → client gets the "closed" reject.
await client.fill('[data-testid="code"]', code)
await client.click('[data-testid="join"]')
await until(client, (s) => s.connection === 'open', 'client: joined again')
await host.click('[data-testid="leave"]')
await until(client, (s) => s.role === 'none' && !!s.error, 'client: room closed by host → error shown')
const c4 = await state(client)
console.log('   client error:', c4.error)

// Unknown room → Italian error.
await client.fill('[data-testid="code"]', 'ZZZZZ')
await client.click('[data-testid="join"]')
await until(client, (s) => s.connection === 'error' && !!s.error, 'client: unknown room → error', 40_000)
console.log('   client error:', (await state(client)).error)

await browser.close()
if (problems.length) {
  console.log('\nConsole problems:')
  for (const p of problems) console.log('  ' + p)
}
const benign = (p) => /peerjs|WebRTC|ERR_|Failed to load resource|Could not connect to peer|Lost connection to server/i.test(p)
const serious = problems.filter((p) => !benign(p))
check(serious.length === 0, `no unexpected console errors (${serious.length})`)
process.exit(failed ? 1 : 0)
