// Host and guest reload their tabs at the same moment while in the lobby: the host
// reclaims its code, the guest's resume retries until the room is back.
//   node tests/e2e/reload.mjs [baseUrl]   (default http://localhost:5173/ = `npm run dev`)
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://localhost:5173/'
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const errors = []
async function open(name, opts) {
  const ctx = await b.newContext({ locale: 'it-IT', ...opts })
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text().slice(0, 200)}`))
  p.on('pageerror', (e) => errors.push(`[${name}] pageerror ${e.message}`))
  await p.goto(BASE)
  return p
}
const screen = (p) => p.getAttribute('[data-screen-frame]:not([inert])', 'data-screen')
let ok = false
try {
  const host = await open('host', { viewport: { width: 1280, height: 800 } })
  const guest = await open('guest', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await host.locator('[data-screen="lobby"]:not([inert])').waitFor()
  const code = await host.evaluate(() => location.hash.slice(4))
  await guest.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap()
  await guest.keyboard.type(code)
  await guest.getByRole('button', { name: /^Entra/ }).tap()
  await guest.locator('[data-screen="lobby"]:not([inert])').waitFor()
  console.log('room', code, '— reloading both tabs')
  const t0 = Date.now()
  await Promise.all([guest.reload(), host.reload()])
  await guest.locator('[data-screen="lobby"]:not([inert])').waitFor({ timeout: 20_000 })
  await host.locator('[data-screen="lobby"]:not([inert])').waitFor({ timeout: 20_000 })
  const hostCode = await host.evaluate(() => location.hash.slice(4))
  const guestName = await guest.evaluate(() => JSON.parse(localStorage.getItem('unshuffle:profile') ?? '{}').name)
  // The guest re-attaches to its old player (same id): the host lists it once, connected.
  await host.getByText(guestName, { exact: true }).first().waitFor({ timeout: 15_000 })
  const rows = await host.getByText(guestName, { exact: true }).count()
  console.log(`back in ${Date.now() - t0} ms · host code ${hostCode} · guest ${await screen(guest)} · host lists "${guestName}" ×${rows}`)
  ok = hostCode === code && rows >= 1
} catch (err) {
  console.log('FAIL', err.message)
} finally {
  await b.close()
}
if (errors.length) console.log(errors.join('\n'))
console.log(ok && !errors.length ? 'RELOAD PASS' : 'RELOAD FAIL')
process.exit(ok && !errors.length ? 0 : 1)
