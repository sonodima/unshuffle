// fix-net: the real app (production snapshot, DOM only) over the public PeerJS
// cloud — how the transport changes feel in the UI.
//   npx vite build --outDir scripts/fix-net/dist
//   npx vite preview --outDir scripts/fix-net/dist --port 5459 --strictPort --host 127.0.0.1 &
//   node scripts/fix-net/app-e2e.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5459/'
const SHOTS = new URL('./shots/', import.meta.url).pathname
const DESKTOP = { viewport: { width: 1440, height: 900 } }
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const tag = Math.random().toString(36).slice(2, 6)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const consoleLines = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}

async function player(name, device, idx) {
  const ctx = await browser.newContext(device)
  await ctx.addInitScript((prof) => {
    try {
      localStorage.setItem('unshuffle:onboarded', String(Date.now()))
      if (!localStorage.getItem('unshuffle:profile')) localStorage.setItem('unshuffle:profile', JSON.stringify(prof))
    } catch {}
  }, { id: `fx-${name}-${tag}`, name, avatar: idx, color: idx })
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && consoleLines.push(`[${name}] ${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => consoleLines.push(`[${name}] PAGEERROR ${e.message}`))
  await page.goto(BASE)
  await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor({ timeout: 30000 })
  return page
}
const onScreen = (p, s, timeout = 30000) => p.locator(`[data-screen-frame][data-screen="${s}"]:not([inert])`).waitFor({ timeout })

async function room() {
  const host = await player('Host', DESKTOP, 0)
  const guest = await player('Giulia', PHONE, 3)
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await onScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  const box = guest.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  await box.tap()
  await guest.keyboard.type(code.toLowerCase(), { delay: 30 })
  await guest.getByRole('button', { name: /^Entra/ }).tap()
  await onScreen(guest, 'lobby')
  await host.getByText('Giulia').first().waitFor({ timeout: 10000 })
  return { host, guest, code }
}

// 1) A guest closes the tab in the lobby: the host must see it at once (not a ghost).
{
  const { host, guest } = await room()
  await sleep(1000)
  const t = Date.now()
  await guest.close({ runBeforeUnload: true })
  const seen = await host.getByText('Riconnessione…').first().waitFor({ timeout: 15000 }).then(() => Date.now() - t, () => null)
  await sleep(300)
  await host.screenshot({ path: `${SHOTS}app-lobby-guest-closed-host.png` })
  check('lobby: closed guest tab shows as disconnected on the host fast', seen !== null && seen < 2500, `${seen} ms`)
  const gone = await host.getByText('Giulia').first().waitFor({ state: 'detached', timeout: 25000 }).then(() => Date.now() - t, () => null)
  check('lobby: … and leaves the roster after the grace period', gone !== null, `${gone} ms`)
  await host.context().close()
  await guest.context().close()
}

// 2) The host closes the tab in the lobby: guests learn it's over in ~15 s, not ~40 s.
{
  const { host, guest } = await room()
  await sleep(1000)
  const t = Date.now()
  await host.close({ runBeforeUnload: true })
  const banner = await guest.getByText(/Riprovo a collegarmi|Connessione persa, riprovo|rientri da solo/).first().waitFor({ timeout: 15000 }).then(() => Date.now() - t, () => null)
  await sleep(600)
  await guest.screenshot({ path: `${SHOTS}app-host-closed-guest-banner.png` })
  const dialog = await guest.getByRole('dialog').first().waitFor({ timeout: 40000 }).then(() => Date.now() - t, () => null)
  await sleep(900)
  const text = (await guest.getByRole('dialog').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  await guest.screenshot({ path: `${SHOTS}app-host-closed-guest-dialog.png` })
  check('host closed: guest banner at once', banner !== null && banner < 2500, `${banner} ms`)
  check('host closed: guest dialog within ~16 s', dialog !== null && dialog < 16500, `${dialog} ms: "${text.slice(0, 160)}"`)
  await guest.context().close()
  await host.context().close().catch(() => {})
}

// 3) The host reloads in the lobby: same code, the guest is back without doing anything.
{
  const { host, guest, code } = await room()
  await sleep(1000)
  const t = Date.now()
  await host.reload()
  await onScreen(host, 'lobby', 30000)
  const code2 = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  await host.getByText('Giulia').first().waitFor({ timeout: 20000 })
  await guest.getByText(/Riprovo a collegarmi|Connessione persa, riprovo|rientri da solo/).first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  const back = Date.now() - t
  const stillLobby = await guest.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').count()
  const dialogs = await guest.getByRole('dialog').count()
  await sleep(500)
  await guest.screenshot({ path: `${SHOTS}app-host-reload-guest.png` })
  check('host reload: same code, guest back in the lobby by itself', code2 === code && stillLobby === 1 && dialogs === 0, `${back} ms, code ${code} → ${code2}`)
  await host.context().close()
  await guest.context().close()
}

// 4) A guest reloads in the lobby: back in, no duplicate.
{
  const { host, guest } = await room()
  await sleep(1000)
  const t = Date.now()
  await guest.reload()
  await onScreen(guest, 'lobby', 30000)
  await host.getByText('Riconnessione…').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  const n = await host.getByRole('list', { name: 'Elenco giocatori' }).getByText('Giulia').count()
  const ghosts = await host.getByText('Riconnessione…').count()
  check('guest reload: back in the lobby, listed once, connected', n === 1 && ghosts === 0, `${Date.now() - t} ms`)
  await host.context().close()
  await guest.context().close()
}

await browser.close()
console.log('\nconsole errors/warnings:\n' + (consoleLines.filter((l) => !/Failed to load resource.*(404|favicon)/.test(l)).join('\n') || '(none)'))
const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `${failed.length} FAILED` : 'ALL PASSED')
process.exit(failed.length ? 1 : 0)
