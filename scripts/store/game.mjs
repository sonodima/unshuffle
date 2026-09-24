// End-to-end game through the store with every real module (PeerJS cloud,
// HostGame, Deezer JSONP, audio engine + analysis): prefetch → ready → intro →
// playing → arrange/submit → reveal → next round, for a host and a client.
// Run: node scripts/store/game.mjs   (isolated dev server on :5207 must be running)

import { chromium } from 'playwright'

const LAB_URL = 'http://localhost:5207/lab/store.html'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
let failed = false
const check = (ok, label) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`)
  if (!ok) failed = true
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []

async function open(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`[${name}] ${m.text()}`)
  })
  await page.goto(LAB_URL)
  await page.waitForSelector('[data-testid="create"]')
  return page
}

const snap = (page) =>
  page.evaluate(() => {
    const s = window.__lab.useGame.getState()
    const room = s.room
    return {
      role: s.role,
      connection: s.connection,
      error: s.error,
      code: room?.code ?? null,
      phase: room?.phase ?? null,
      tracks: room?.tracks.map((t) => t.id) ?? [],
      rounds: room?.rounds.map((r) => (r ? r.track.id : null)) ?? [],
      ready: room?.ready ?? {},
      submissions: room?.submissions ?? {},
      results: room?.results.map((list) => list.map((r) => ({ id: r.playerId, points: r.points, timedOut: r.timedOut }))) ?? [],
      audio: s.audio,
      arrangement: s.arrangement,
      arrangementRound: s.arrangementRound,
      submitted: s.submitted,
      me: s.me,
      toasts: s.toasts.map((t) => (t.event.type === 'info' ? `info:${t.event.message}` : t.event.type)),
    }
  })

async function until(page, pred, label, timeout = 60_000) {
  const t0 = Date.now()
  let last
  while (Date.now() - t0 < timeout) {
    last = await snap(page)
    if (pred(last)) {
      check(true, `${label} (${Date.now() - t0} ms)`)
      return last
    }
    await sleep(200)
  }
  check(false, `${label} — last: ${JSON.stringify(last).slice(0, 1500)}`)
  return last
}

const host = await open('host')
const client = await open('client')

const code = await host.evaluate(() => window.__lab.useGame.getState().createRoom())
check(/^[A-Z]{5}$/.test(code), `host: room ${code}`)
await client.evaluate((c) => window.__lab.useGame.getState().joinRoom(c), code)
await until(host, (s) => s.connection === 'open', 'host open')

// Pick a real playlist through the app's own Deezer client.
const playlist = await host.evaluate(async () => {
  const dz = await import('/src/lib/deezer.ts')
  const list = await dz.getFeaturedPlaylists(10)
  return list.find((p) => p.nbTracks >= 30) ?? list[0] ?? null
})
check(!!playlist, `host: playlist "${playlist?.title}" (${playlist?.nbTracks} brani)`)
if (!playlist) {
  await browser.close()
  process.exit(1)
}
await host.evaluate((p) => window.__lab.useGame.getState().updateSettings({ playlist: p, rounds: 3, snippets: 6, roundTime: 60, finalTimer: 10 }), playlist)
await until(client, (s) => s.phase?.kind === 'lobby', 'client: settings arrive')

const started = host.evaluate(() => window.__lab.useGame.getState().startGame().then(() => 'ok', (e) => e.message))
const prep = await until(client, (s) => s.tracks.length >= 3, 'client: tracks broadcast', 30_000)
console.log(`   tracks: ${prep.tracks.length}, phase ${prep.phase?.kind}`)
await until(client, (s) => Object.values(s.audio).some((a) => a === 'loading' || a === 'ready'), 'client: prefetch started')
const loadingNow = (await snap(client)).audio
check(Object.values(loadingNow).filter((a) => a === 'loading').length <= 2, `client: ≤ 2 concurrent downloads ${JSON.stringify(loadingNow)}`)
console.log('   startGame:', await started)

const intro = await until(client, (s) => s.phase?.kind === 'intro' || s.phase?.kind === 'playing', 'client: round 0 intro', 90_000)
const me = intro.me
const hostSnap = await snap(host)
check(intro.ready[me] === true, 'host saw client ready for round 0')
check(intro.ready[hostSnap.me] === true, 'host saw its own ready (loopback)')
check(intro.arrangementRound === 0 && intro.arrangement.length === 6, `client: arrangement for round 0 = ${JSON.stringify(intro.arrangement)}`)

await until(client, (s) => s.phase?.kind === 'playing', 'client: playing', 20_000)
// Client solves it perfectly and confirms; host confirms its untouched board.
await client.evaluate(() => {
  const g = window.__lab.useGame.getState()
  g.setArrangement([0, 1, 2, 3, 4, 5])
  g.submit()
})
await until(host, (s) => s.phase?.kind === 'playing' && s.phase.firstSubmit !== null, 'host: first submit pulls the timer in')
await until(host, (s) => s.toasts.includes('first-submit'), 'host: first-submit toast')
await host.evaluate(() => window.__lab.useGame.getState().submit())
const rev = await until(client, (s) => s.phase?.kind === 'reveal', 'client: reveal', 20_000)
const r0 = rev.results[0] ?? []
const mine = r0.find((r) => r.id === me)
check(mine?.points === 5000, `client scored ${mine?.points} (perfect)`)
check(r0.length === 2, 'both players scored')

await host.evaluate(() => window.__lab.useGame.getState().nextRound())
const r1 = await until(client, (s) => s.arrangementRound === 1 && !s.submitted, 'client: round 1 arrangement reset', 60_000)
check(JSON.stringify(r1.arrangement) !== '[0,1,2,3,4,5]', 'round 1 starts scrambled')
await until(client, (s) => s.phase?.kind === 'playing' && s.phase.round === 1, 'client: playing round 1', 60_000)

await client.evaluate(() => window.__lab.useGame.getState().leave())
await host.evaluate(() => window.__lab.useGame.getState().leave())
await browser.close()
if (errors.length) console.log('Page errors:\n  ' + errors.join('\n  '))
check(errors.length === 0, 'no page errors')
process.exit(failed ? 1 : 0)
