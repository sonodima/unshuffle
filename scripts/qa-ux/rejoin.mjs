// Returning player: guest reloads mid-round (arrangement + score kept?), then host refreshes mid-round.
import { BASE, DESKTOP, PHONE, launch, openPlayer, shot, waitScreen, waitPhase, boardOrder, touchDrag, mouseDrag, log, problems } from './lib.mjs'
const RUN = 'r'
const browser = await launch()
const host = await openPlayer(browser, 'host', DESKTOP, { onboarded: true })
const guest = await openPlayer(browser, 'guest', PHONE, { onboarded: true })
const both = (tag) => Promise.all([shot(host, `${RUN}-${tag}-host`), shot(guest, `${RUN}-${tag}-guest`)])
const frameOf = (p) => p.evaluate(() => { const f = document.querySelector('[data-screen-frame]:not([inert])'); return f?.getAttribute('data-screen') + ' / ' + (f?.querySelector('[data-phase]')?.getAttribute('data-phase') ?? '-') })
const txt = (p) => p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 400))
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  await guest.goto(`${BASE}#/r/${code}`); await waitScreen(guest, 'home')
  const guestName = await guest.getByRole('textbox', { name: /nome/i }).first().inputValue().catch(() => null)
  await guest.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitScreen(guest, 'lobby')
  const firstResult = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 }); await firstResult.click()
  const setRadio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3'); await setRadio('Spezzoni', /^6/); await setRadio('Tempo per round', '120s')
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
  await Promise.all([waitPhase(host, 'playing', 90000), waitPhase(guest, 'playing', 90000)])
  await host.waitForTimeout(1200)
  // guest arranges 2 moves
  await touchDrag(guest, 0, 3); await touchDrag(guest, 5, 1)
  const before = await boardOrder(guest)
  log('guest order before reload', before.join(','), 'name', guestName)
  await guest.waitForTimeout(800)
  const tReload = Date.now()
  await guest.reload()
  await waitScreen(guest, 'home', 15000).catch(() => {})
  log('after reload screen', await frameOf(guest))
  await guest.waitForTimeout(1500)
  await shot(guest, `${RUN}-01-guest-after-reload`)
  log('after reload text', await txt(guest))
  // wait up to 20s to be back in the round
  let back = false
  for (let i = 0; i < 40; i++) { const f = await frameOf(guest); if (/round \/ playing/.test(f)) { back = true; break } await guest.waitForTimeout(500) }
  log('guest back in round:', back, 'after ms', Date.now() - tReload)
  if (!back) {
    // try the obvious user action
    const btns = await guest.getByRole('button').allTextContents()
    log('guest buttons', btns.join(' | ').slice(0, 300))
  }
  await guest.waitForTimeout(800)
  await shot(guest, `${RUN}-02-guest-back`)
  if (back) log('guest order after reload', (await boardOrder(guest)).join(','))
  await shot(host, `${RUN}-03-host-during-guest-reload`)
  // host refresh mid-round
  const tH = Date.now()
  await host.reload()
  await host.waitForTimeout(2500)
  await shot(host, `${RUN}-04-host-after-reload`)
  log('host after reload', await frameOf(host), await txt(host))
  let hb = false
  for (let i = 0; i < 40; i++) { const f = await frameOf(host); if (/round/.test(f)) { hb = true; break } await host.waitForTimeout(500) }
  log('host back in round:', hb, Date.now() - tH, 'ms', await frameOf(host))
  await host.waitForTimeout(3000)
  await both('05-after-host-reload')
  log('guest after host reload', await frameOf(guest), await txt(guest))
  // finish round
  await guest.getByRole('button', { name: /^Conferma/ }).first().tap().catch((e) => log('guest confirm fail', e.message))
  await host.getByRole('button', { name: /^Conferma/ }).first().click().catch((e) => log('host confirm fail', e.message))
  await Promise.all([waitPhase(host, 'reveal', 40000), waitPhase(guest, 'reveal', 40000)]).catch((e) => log('reveal wait fail', e.message))
  await host.waitForTimeout(5000)
  await both('06-reveal')
  log('guest reveal', await txt(guest))
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await both('99-failure').catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
