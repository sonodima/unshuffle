// Host kicks a guest; host closes the room from the lobby; host leaves from the final screen.
import { BASE, DESKTOP, PHONE, launch, openPlayer, shot, waitScreen, log, problems } from './lib.mjs'
const RUN = 'c'
const browser = await launch()
const host = await openPlayer(browser, 'host', DESKTOP, { onboarded: true })
const g1 = await openPlayer(browser, 'g1', PHONE, { onboarded: true })
const join = async (g, code) => { await g.goto(`${BASE}#/r/${code}`); await waitScreen(g, 'home'); await g.getByRole('button', { name: /^Entra/ }).first().tap(); await waitScreen(g, 'lobby') }
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  await join(g1, code)
  await host.waitForTimeout(1000)
  // kick
  await host.getByRole('button', { name: /Rimuovi/ }).first().click()
  await host.waitForTimeout(500)
  await shot(host, `${RUN}-01-kick-confirm`)
  await host.getByRole('dialog').getByRole('button', { name: /Rimuovi/ }).click()
  const t0 = Date.now()
  await waitScreen(g1, 'home', 20000)
  log('kicked → home ms', Date.now() - t0)
  await g1.waitForTimeout(800)
  await shot(g1, `${RUN}-02-kicked-home`)
  // rejoin after kick
  await g1.getByRole('button', { name: 'OK' }).tap(); await g1.waitForTimeout(500)
  await g1.getByRole('button', { name: /^Entra/ }).first().tap()
  await g1.waitForTimeout(5000)
  await shot(g1, `${RUN}-03-rejoin-after-kick`)
  log('g1 after rejoin', await g1.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.getAttribute('data-screen')), (await g1.getByRole('alert').allTextContents()).join(' | '))
  // new guest joins, host closes room
  const g2 = await openPlayer(browser, 'g2', PHONE, { onboarded: true })
  await join(g2, code)
  await host.waitForTimeout(800)
  await host.getByRole('button', { name: /Chiudi stanza/ }).first().click()
  await host.waitForTimeout(400)
  await shot(host, `${RUN}-04-close-confirm`)
  await host.getByRole('dialog').getByRole('button', { name: /Chiudi stanza/ }).click()
  const t1 = Date.now()
  await waitScreen(g2, 'home', 40000).catch(() => log('g2 never went home'))
  log('host closed → guest home ms', Date.now() - t1)
  await g2.waitForTimeout(800)
  await shot(g2, `${RUN}-05-guest-after-close`)
  await shot(host, `${RUN}-06-host-after-close`)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(host, `${RUN}-99-host`).catch(() => {})
  await shot(g1, `${RUN}-99-g1`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
