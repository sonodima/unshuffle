// One solo game (12 snippets); the same page resized through phone landscape / tablet / small laptop.
import { BASE, launch, openPlayer, shot, waitScreen, waitPhase, log, problems } from './lib.mjs'
const RUN = 'v'
const browser = await launch()
const p = await openPlayer(browser, 'v', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { onboarded: true })
const sizes = [[844, 390], [667, 375], [768, 1024], [1024, 768], [1366, 768], [360, 740]]
const metrics = () => p.evaluate(() => {
  const items = [...document.querySelectorAll('[data-screen-frame]:not([inert]) .sb-item')]
  const r = items[0]?.getBoundingClientRect()
  const last = items.at(-1)?.getBoundingClientRect()
  const cta = [...document.querySelectorAll('button')].find((b) => /^Conferma/i.test(b.textContent.trim()))?.getBoundingClientRect()
  return { block: r && `${Math.round(r.width)}x${Math.round(r.height)}`, lastBottom: last && Math.round(last.bottom), ctaTop: cta && Math.round(cta.top), ctaBottom: cta && Math.round(cta.bottom), vh: innerHeight, ox: document.documentElement.scrollWidth - innerWidth }
})
try {
  await p.goto(BASE); await waitScreen(p, 'home'); await p.waitForTimeout(800)
  await shot(p, `${RUN}-01-home-landscape`)
  await p.getByRole('button', { name: 'Crea stanza', exact: true }).tap()
  await waitScreen(p, 'lobby'); await p.waitForTimeout(1000)
  await shot(p, `${RUN}-02-lobby-landscape`)
  await p.setViewportSize({ width: 390, height: 844 })
  await p.getByRole('tab', { name: /Playlist/ }).tap().catch(() => {})
  const firstResult = p.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 })
  await firstResult.tap()
  await p.getByRole('tab', { name: /Regole/ }).tap().catch(() => {})
  await p.getByRole('radiogroup', { name: 'Spezzoni' }).first().getByRole('radio', { name: /^12/ }).first().tap()
  await p.getByRole('radiogroup', { name: 'Tempo per round' }).first().getByRole('radio', { name: '180s' }).first().tap()
  await p.getByRole('button', { name: /Inizia partita/ }).first().tap()
  await waitPhase(p, 'playing', 90000); await p.waitForTimeout(2000)
  for (const [w, h] of sizes) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(900)
    log(`${w}x${h}`, JSON.stringify(await metrics()))
    await shot(p, `${RUN}-10-play-${w}x${h}`)
  }
  await p.setViewportSize({ width: 844, height: 390 })
  await p.getByRole('button', { name: /^Conferma/ }).first().tap()
  await waitPhase(p, 'reveal', 20000); await p.waitForTimeout(6000)
  await shot(p, `${RUN}-20-reveal-landscape`)
  await p.setViewportSize({ width: 768, height: 1024 }); await p.waitForTimeout(800)
  await shot(p, `${RUN}-21-reveal-tablet`)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(p, `${RUN}-99`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
