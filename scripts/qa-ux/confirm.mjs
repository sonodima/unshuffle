// Accidental confirm checks (2 players, desktop host + phone guest):
// 1) guest taps CONFERMA on an untouched board as first action → does the host's timer collapse to the final timer?
// 2) host (mouse user) clicks a block to hear it, then presses Enter → does it confirm the round?
//    (Expected now: no. Plain Enter belongs to the focused control; Cmd/Ctrl+Enter confirms,
//    and an untouched board needs a second press. 1) likewise only arms CONFERMA.)
import { BASE, DESKTOP, PHONE, launch, openPlayer, shot, waitScreen, waitPhase, boardOrder, log, problems } from './lib.mjs'
const RUN = 'q'
const browser = await launch()
const host = await openPlayer(browser, 'host', DESKTOP, { onboarded: true })
const guest = await openPlayer(browser, 'guest', PHONE, { onboarded: true })
const timer = (p) => p.evaluate(() => document.querySelector('[data-screen-frame]:not([inert]) [role="timer"]')?.textContent)
const submitted = (p) => p.evaluate(async () => { const m = await import('/src/game/store.ts'); const s = m.useGame.getState(); const r = s.room; const ph = r?.phase; return { phase: ph?.kind, first: ph?.firstSubmit ?? null, left: ph?.endsAt ? Math.round((ph.endsAt - Date.now()) / 1000) : null } })
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  await guest.goto(`${BASE}#/r/${code}`); await waitScreen(guest, 'home')
  await guest.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitScreen(guest, 'lobby')
  const firstResult = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 }); await firstResult.click()
  const setRadio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3'); await setRadio('Spezzoni', /^8/); await setRadio('Tempo per round', '90s'); await setRadio('Timer finale', '15s')
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
  await Promise.all([waitPhase(host, 'playing', 90000), waitPhase(guest, 'playing', 90000)])
  await host.waitForTimeout(1500)
  log('R1 host timer before', await timer(host))
  const untouched = await boardOrder(guest)
  await guest.getByRole('button', { name: /^Conferma/ }).first().tap()
  await host.waitForTimeout(800)
  log('R1 guest confirmed untouched board', untouched.join(','), '→ host timer', await timer(host), JSON.stringify(await submitted(host)))
  await shot(host, `${RUN}-01-host-after-untouched-confirm`)
  // 2) host clicks a block with the mouse, then presses Enter
  const blk = host.locator('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="3"]')
  await blk.click(); await host.waitForTimeout(700)
  const act = await host.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.getAttribute('aria-label') ?? ''))
  await host.keyboard.press('Enter'); await host.waitForTimeout(900)
  const after = await host.evaluate(() => document.querySelector('[data-screen-frame]:not([inert]) [data-round-view="playing"]')?.getAttribute('data-locked'))
  log('R1 host: click block → focus', act, '→ Enter → board locked?', after, JSON.stringify(await submitted(host)))
  await shot(host, `${RUN}-02-host-after-click-enter`)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(host, `${RUN}-99-host`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
