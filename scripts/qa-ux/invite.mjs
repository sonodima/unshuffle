// First-time invitee on phone: invite link → how-to → home state (code prefilled? CTA?), then
// returning visit (profile kept? how-to not shown again?), and a dead-room invite link.
import { BASE, PHONE, DESKTOP, launch, openPlayer, shot, waitScreen, log, problems } from './lib.mjs'
const RUN = 'i'
const browser = await launch()
const host = await openPlayer(browser, 'host', DESKTOP, { onboarded: true })
const ctx = await browser.newContext({ locale: 'it-IT', ...PHONE })
const g = await ctx.newPage()
g.on('pageerror', (e) => problems.push('pageerror ' + e.message))
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  await g.goto(`${BASE}#/r/${code}`); await waitScreen(g, 'home'); await g.waitForTimeout(2000)
  await g.getByRole('button', { name: /Ho capito/ }).tap().catch(() => log('no how-to'))
  await g.waitForTimeout(800)
  await shot(g, `${RUN}-01-invitee-home`)
  const st = await g.evaluate(() => ({
    codes: [...document.querySelectorAll('input[aria-label^="Codice stanza"]')].map((i) => i.value).join(''),
    active: (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 40),
    ctas: [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()).filter(Boolean).slice(0, 12),
  }))
  log('invitee home', JSON.stringify(st))
  // change name, join
  const name = g.getByRole('textbox', { name: /nome/i }).first()
  await name.fill('Tommaso QA')
  await g.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitScreen(g, 'lobby'); await g.waitForTimeout(800)
  // leave, come back later
  await g.goto(BASE); await g.waitForTimeout(500); await g.reload(); await waitScreen(g, 'home'); await g.waitForTimeout(1500)
  const again = await g.evaluate(() => ({ name: document.querySelector('input[aria-label*="nome" i], input[name="name"]')?.value, dialog: !!document.querySelector('[role="dialog"]'), screen: document.querySelector('[data-screen-frame]:not([inert])')?.getAttribute('data-screen') }))
  log('returning visit', JSON.stringify(again))
  await shot(g, `${RUN}-02-returning-home`)
  // host closes room → invitee opens old link
  await host.close()
  await g.waitForTimeout(3000)
  await g.goto(`${BASE}#/r/${code}`); await g.waitForTimeout(1500)
  await g.getByRole('button', { name: /^Entra/ }).first().tap().catch(() => {})
  const t0 = Date.now()
  await g.getByRole('alert').first().waitFor({ timeout: 40000 }).catch(() => log('no alert'))
  log('dead room link →', Date.now() - t0, 'ms', await g.getByRole('alert').allTextContents())
  await shot(g, `${RUN}-03-dead-room-link`)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(g, `${RUN}-99`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
