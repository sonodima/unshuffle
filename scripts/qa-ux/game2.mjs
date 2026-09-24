// Returning players: laptop host 1280x720 + small phone 360x640 guest (reduced motion),
// 16 snippets "Folle", everybody confirms fast, final + Rigioca.
import { BASE, launch, openPlayer, shot, waitScreen, waitPhase, boardOrder, touchDrag, log, problems } from './lib.mjs'
const RUN = process.env.RUN ?? 'h'
const SNIPS = process.env.SNIPS ?? '16'
const browser = await launch()
const host = await openPlayer(browser, 'host', { viewport: { width: 1280, height: 720 } }, { onboarded: true })
const guest = await openPlayer(browser, 'guest', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }, { onboarded: true })
const both = (tag) => Promise.all([shot(host, `${RUN}-${tag}-host`), shot(guest, `${RUN}-${tag}-guest`)])
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  await guest.goto(BASE); await waitScreen(guest, 'home')
  await guest.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap()
  await guest.keyboard.type(code, { delay: 40 })
  await guest.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitScreen(guest, 'lobby')
  await host.waitForTimeout(800)
  await both('01-lobby')
  // host: featured first playlist
  const firstResult = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 })
  await firstResult.click()
  log('picked', await firstResult.getAttribute('title'))
  const setRadio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3')
  await setRadio('Spezzoni', new RegExp('^' + SNIPS))
  await setRadio('Timer finale', '10s')
  await host.waitForTimeout(800)
  await both('02-lobby-configured')
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
  for (let r = 0; r < 3; r++) {
    const R = `r${r + 1}`
    await Promise.all([waitPhase(host, 'playing', 90000), waitPhase(guest, 'playing', 90000)])
    await host.waitForTimeout(2000)
    await both(`${R}-10-playing`)
    const m = await guest.evaluate(() => {
      const items = [...document.querySelectorAll('[data-round-view="playing"] .sb-item')]
      const r0 = items[0]?.getBoundingClientRect()
      const letter = getComputedStyle(document.querySelector('.sb-letter')).fontSize
      const slot = getComputedStyle(document.querySelector('.sb-slot')).fontSize
      return { n: items.length, w: r0?.width, h: r0?.height, letter, slot, overflowX: document.documentElement.scrollWidth - innerWidth, scrollH: document.scrollingElement.scrollHeight - innerHeight }
    })
    log(R, 'guest block metrics', JSON.stringify(m))
    if (r === 0) {
      const before = await boardOrder(guest)
      await touchDrag(guest, 0, 15, 20, `${RUN}-${R}-11-guest-drag16`)
      log('drag 0→15', before.join(','), '→', (await boardOrder(guest)).join(','))
      await guest.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).tap(); await guest.waitForTimeout(1200)
      await shot(guest, `${RUN}-${R}-12-guest-playall`)
    }
    await guest.getByRole('button', { name: /^Conferma/ }).first().tap()
    await guest.waitForTimeout(600)
    await both(`${R}-13-guest-confirmed`)
    await host.getByRole('button', { name: /^Conferma/ }).first().click()
    await Promise.all([waitPhase(host, 'reveal', 40000), waitPhase(guest, 'reveal', 40000)])
    await host.waitForTimeout(5500)
    await both(`${R}-20-reveal`)
    await host.getByRole('button', { name: r === 2 ? /Classifica finale/ : /Prossimo round/ }).first().click()
  }
  await Promise.all([waitScreen(host, 'final', 20000), waitScreen(guest, 'final', 20000)])
  await host.waitForTimeout(1000)
  await both('30-final-1s')
  await host.waitForTimeout(3000)
  await both('31-final-4s')
  const ftxt = await guest.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.innerText)
  log('final text:\n', ftxt?.replace(/\n+/g, ' | ').slice(0, 2000))
  const sc = async (p, f) => p.evaluate((f) => { const fr = document.querySelector('[data-screen-frame]:not([inert])'); const s = [...fr.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) ?? document.scrollingElement; s.scrollTo({ top: s.scrollHeight * f }); return s.scrollHeight }, f)
  for (const f of [0.33, 0.66, 1]) {
    log('scrollH', await sc(host, f), await sc(guest, f))
    await host.waitForTimeout(700)
    await both(`32-final-scroll-${Math.round(f * 100)}`)
  }
  await host.getByRole('button', { name: 'Rigioca' }).click()
  await Promise.all([waitScreen(host, 'lobby', 15000), waitScreen(guest, 'lobby', 15000)])
  await host.waitForTimeout(1000)
  await both('40-lobby-again')
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await both('99-failure').catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
