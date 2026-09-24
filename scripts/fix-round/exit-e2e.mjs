// End-to-end check of the in-game exit menu over the real PeerJS cloud + Deezer,
// against a production snapshot (npx vite build --outDir scripts/fix-round/dist;
// npx vite preview --outDir scripts/fix-round/dist --port 5451).
//   1. guest (phone) leaves mid-round → back home; the host sees them "disconnesso" at once
//   2. the guest re-enters with the code → back in the round with the same score entry
//   3. host "Torna alla lobby" → everyone in the lobby, scores reset
//   4. new game, host "Chiudi la stanza" → the other guest is told the room is closed
// Also: an untouched CONFERMA on the host only arms (no first-submit for the room).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5451/'
const QUERY = process.env.QUERY ?? 'hits 2000'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const problems = []
const check = (ok, msg) => {
  if (!ok) problems.push(msg)
  log(ok ? 'PASS' : 'FAIL', msg)
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })

async function player(name, profileName, opts) {
  const ctx = await browser.newContext(opts)
  const id = `e2e-${name}-${Math.random().toString(36).slice(2, 10)}`
  await ctx.addInitScript(
    ([pid, pname]) => {
      try {
        localStorage.setItem('unshuffle:onboarded', String(Date.now()))
        if (!localStorage.getItem('unshuffle:profile')) localStorage.setItem('unshuffle:profile', JSON.stringify({ id: pid, name: pname, avatar: 3, color: 2 }))
      } catch {
        /* ignore */
      }
    },
    [id, profileName],
  )
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${name}] console.error: ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`))
  return page
}

const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
const waitScreen = (page, screen, timeout = 30_000) => frame(page, screen).waitFor({ state: 'visible', timeout })
const waitPhase = (page, kind, timeout = 90_000) =>
  page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, kind, { timeout, polling: 100 })
const shot = (page, tag) => page.screenshot({ path: `${OUT}e2e-${tag}.png` })

async function join(page, code, touch) {
  const box = page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  if (touch) await box.tap()
  else await box.click()
  await page.keyboard.type(code.toLowerCase(), { delay: 50 })
  await page.waitForTimeout(250)
  const btn = page.getByRole('button', { name: /^Entra/ })
  if (touch) await btn.tap()
  else await btn.click()
}

async function start(host) {
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
}

const host = await player('host', 'Host Tommy', { viewport: { width: 1440, height: 900 } })
const g1 = await player('g1', 'Signor Maritozzo', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const g2 = await player('g2', 'Lady Cannoli', { viewport: { width: 1280, height: 800 } })

let exit = 0
try {
  await Promise.all([host.goto(BASE), g1.goto(BASE), g2.goto(BASE)])
  await Promise.all([waitScreen(host, 'home'), waitScreen(g1, 'home'), waitScreen(g2, 'home')])
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  log('room', code)
  await join(g1, code, true)
  await join(g2, code, false)
  await Promise.all([waitScreen(g1, 'lobby'), waitScreen(g2, 'lobby')])

  const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill(QUERY)
  const first = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ state: 'visible', timeout: 20_000 })
  await host.waitForTimeout(500)
  await first.click()
  const g = host.getByRole('radiogroup', { name: 'Round' }).first()
  await g.getByRole('radio', { name: '3' }).first().click()
  await host.getByRole('radiogroup', { name: 'Spezzoni' }).first().getByRole('radio', { name: /^6/ }).first().click()
  await host.waitForTimeout(600)
  await start(host)
  await Promise.all([waitPhase(host, 'playing'), waitPhase(g1, 'playing'), waitPhase(g2, 'playing')])
  await host.waitForTimeout(1800)

  // ---- untouched confirm on the host only arms
  const confirmBtn = host.locator('[data-round-view="playing"] footer button[aria-keyshortcuts]')
  await confirmBtn.click()
  await host.waitForTimeout(700)
  const g2Final = await g2.evaluate(() => /Finale/i.test(document.querySelector('[data-round-view="playing"] header')?.textContent ?? ''))
  check(/spostato nulla/i.test(await confirmBtn.innerText()) && !g2Final, 'host untouched CONFERMA only arms (no final timer on the guests)')
  await shot(host, '01-host-armed')

  // ---- 1. guest leaves
  await g1.getByRole('button', { name: 'Esci dalla partita' }).first().tap()
  await g1.waitForTimeout(600)
  await shot(g1, '02-g1-menu')
  const tLeave = Date.now()
  await g1.getByRole('dialog').getByRole('button', { name: 'Esci dalla partita' }).tap()
  await waitScreen(g1, 'home', 10_000)
  check(true, `guest back home ${Date.now() - tLeave} ms after leaving`)
  await host.locator('[aria-label*="Signor Maritozzo"][aria-label*="disconnesso"]').first().waitFor({ state: 'attached', timeout: 6000 })
  check(Date.now() - tLeave < 5000, `host marks the guest disconnected ${Date.now() - tLeave} ms after "Esci" (was ~10 s via keepalive)`)
  await shot(host, '03-host-after-guest-left')

  // ---- 2. guest re-enters with the code
  await join(g1, code, true)
  await waitScreen(g1, 'round', 30_000)
  const back = await g1.evaluate(() => !!document.querySelector('[data-screen-frame]:not([inert]) [data-phase]'))
  check(back, 'guest re-entered the running game with the code')
  await host.locator('[aria-label*="Signor Maritozzo"]:not([aria-label*="disconnesso"])').first().waitFor({ state: 'attached', timeout: 8000 })
  check(true, 'host sees the guest connected again (same roster entry)')
  const dup = await host.evaluate(() => document.querySelectorAll('[data-round-view] header [aria-label^="Signor Maritozzo"]').length)
  check(dup === 1, `no duplicate roster entry for the returning guest (${dup})`)
  await shot(g1, '04-g1-rejoined')

  // ---- 3. host: back to the lobby
  await host.getByRole('button', { name: 'Termina partita' }).first().click()
  await host.waitForTimeout(600)
  await shot(host, '05-host-menu')
  await host.getByRole('button', { name: /Torna alla lobby/ }).click()
  await Promise.all([waitScreen(host, 'lobby', 10_000), waitScreen(g1, 'lobby', 10_000), waitScreen(g2, 'lobby', 10_000)])
  check(true, 'host "Torna alla lobby": everyone back in the lobby')
  await shot(g2, '06-g2-lobby')

  // ---- 4. new game, host closes the room
  await host.waitForTimeout(800)
  await start(host)
  await Promise.all([waitPhase(host, 'playing'), waitPhase(g2, 'playing')])
  await host.waitForTimeout(1500)
  const r1 = await host.evaluate(() => document.querySelector('[data-round-view="playing"] header')?.textContent ?? '')
  check(/1\s*\/\s*3/.test(r1), 'the new game starts again from round 1')
  await host.getByRole('button', { name: 'Termina partita' }).first().click()
  await host.waitForTimeout(500)
  const tClose = Date.now()
  await host.getByRole('button', { name: /Chiudi la stanza/ }).click()
  await waitScreen(host, 'home', 10_000)
  await g2.waitForFunction(() => /chius/i.test(document.body.innerText), null, { timeout: 8000 })
  check(Date.now() - tClose < 6000, `guest told the room is closed ${Date.now() - tClose} ms after "Chiudi la stanza"`)
  await shot(g2, '07-g2-closed')
} catch (e) {
  problems.push(`exception: ${e.message}`)
  log('EXCEPTION', e.message)
  await Promise.all([shot(host, 'x-host'), shot(g1, 'x-g1'), shot(g2, 'x-g2')]).catch(() => {})
  exit = 1
}
await browser.close()
console.log(problems.length ? `PROBLEMS:\n  ${problems.join('\n  ')}` : 'all good')
process.exit(problems.length || exit ? 1 : 0)
