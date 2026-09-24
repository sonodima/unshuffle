// Error & edge states: tiny playlist, late joiner (spectator), guest drop, host gone mid-round.
import { BASE, DESKTOP, PHONE, launch, openPlayer, shot, waitScreen, waitPhase, log, problems } from './lib.mjs'
const RUN = 'e'
const browser = await launch()
const host = await openPlayer(browser, 'host', DESKTOP, { onboarded: true })
const guest = await openPlayer(browser, 'guest', PHONE, { onboarded: true })
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  // tiny playlist by link
  const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click(); await search.fill('https://www.deezer.com/it/playlist/15779000621')
  await host.waitForTimeout(3500)
  await shot(host, `${RUN}-01-link-tiny`)
  await host.getByRole('button', { name: /Inizia partita/ }).first().click().catch((e) => log('start click', e.message))
  await host.waitForTimeout(5000)
  await shot(host, `${RUN}-02-tiny-start`)
  log('alerts', await host.getByRole('alert').allTextContents(), 'status', await host.getByRole('status').allTextContents())
  // invalid link
  await search.fill('https://www.deezer.com/it/playlist/99999999999999')
  await host.waitForTimeout(3500)
  await shot(host, `${RUN}-03-link-bad`)
  // gibberish search
  await search.fill('qwxzqwxzqwxz')
  await host.waitForTimeout(3000)
  await shot(host, `${RUN}-04-search-empty`)
  // real playlist
  await search.fill('')
  const firstResult = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 })
  await firstResult.click()
  const setRadio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3'); await setRadio('Spezzoni', /^6/)
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
  await waitPhase(host, 'playing', 90000)
  await host.waitForTimeout(1500)
  // late joiner
  await guest.goto(`${BASE}#/r/${code}`); await waitScreen(guest, 'home')
  await guest.getByRole('button', { name: /^Entra/ }).first().tap()
  await guest.waitForTimeout(5000)
  await shot(guest, `${RUN}-05-late-joiner`)
  await shot(host, `${RUN}-06-host-sees-late`)
  // host confirms, reveal
  await host.getByRole('button', { name: /^Conferma/ }).first().click()
  await waitPhase(host, 'reveal', 40000)
  await host.waitForTimeout(4000)
  await shot(guest, `${RUN}-07-late-joiner-reveal`)
  await host.getByRole('button', { name: /Prossimo round/ }).first().click()
  await Promise.all([waitPhase(host, 'playing', 90000), waitPhase(guest, 'playing', 90000)])
  await host.waitForTimeout(1500)
  await shot(guest, `${RUN}-08-late-joiner-r2`)
  // guest goes offline mid-round
  await guest.context().setOffline(true)
  await host.waitForTimeout(3000)
  await shot(guest, `${RUN}-09-guest-offline-3s`)
  await host.waitForTimeout(9000)
  await shot(host, `${RUN}-10-host-sees-guest-dropped-12s`)
  await shot(guest, `${RUN}-11-guest-offline-12s`)
  await guest.context().setOffline(false)
  await host.waitForTimeout(8000)
  await shot(guest, `${RUN}-12-guest-back-online`)
  await shot(host, `${RUN}-13-host-after-guest-back`)
  // host tab closes
  await host.close()
  for (const s of [3, 12, 30]) {
    await guest.waitForTimeout(s === 3 ? 3000 : s === 12 ? 9000 : 18000)
    await shot(guest, `${RUN}-14-host-gone-${s}s`)
    log('guest text', s, (await guest.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 400))
  }
  await guest.waitForTimeout(15000)
  await shot(guest, `${RUN}-15-host-gone-45s`)
  log('guest text 45', (await guest.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 400))
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(guest, `${RUN}-99-guest`).catch(() => {})
  await shot(host, `${RUN}-99-host`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
