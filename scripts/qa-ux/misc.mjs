// Deezer quota burst via category chips; audio levels during play-all (shader input).
import { BASE, DESKTOP, launch, openPlayer, shot, waitScreen, waitPhase, log, problems } from './lib.mjs'
const RUN = 'm'
const browser = await launch()
const p = await openPlayer(browser, 'm', DESKTOP, { onboarded: true })
try {
  await p.goto(BASE); await waitScreen(p, 'home')
  await p.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(p, 'lobby'); await p.waitForTimeout(1500)
  const chips = p.locator('[aria-label="Categorie"] button')
  const n = await chips.count()
  log('chips', n)
  let clicks = 0
  for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) { const c = chips.nth(i); if (await c.isVisible()) { await c.click({ force: true }).catch(() => {}); clicks++; await p.waitForTimeout(60) } }
  // also rapid search typing
  const search = p.getByRole('searchbox', { name: 'Cerca playlist' })
  for (const q of ['a', 'ab', 'abb', 'abba', 'queen', 'vasco', 'mina', 'lucio', 'eros', 'laura']) { await search.fill(q); await p.waitForTimeout(90) }
  log('clicked chips', clicks)
  await p.waitForTimeout(2500)
  await shot(p, `${RUN}-01-after-burst`)
  const txt = await p.evaluate(() => document.querySelector('section[aria-label="Scegli la playlist"]')?.innerText)
  log('picker text:', txt?.replace(/\n+/g, ' | ').slice(0, 500))
  // Try chips again after the burst
  for (let i = 0; i < 8; i++) { const c = chips.nth(i); if (await c.isVisible()) { await c.click({ force: true }).catch(() => {}); await p.waitForTimeout(300) } }
  await p.waitForTimeout(3000)
  await shot(p, `${RUN}-02-after-burst2`)
  const txt2 = await p.evaluate(() => document.querySelector('section[aria-label="Scegli la playlist"]')?.innerText)
  log('picker text 2:', txt2?.replace(/\n+/g, ' | ').slice(0, 500))
  await search.fill('')
  const firstResult = p.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 30000 })
  await firstResult.click()
  await p.getByRole('button', { name: /Inizia partita/ }).first().click()
  await waitPhase(p, 'playing', 90000); await p.waitForTimeout(2000)
  await p.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  const samples = []
  for (let i = 0; i < 25; i++) { samples.push(await p.evaluate(async () => { const m = await import('/src/audio/engine.ts'); const l = m.audioEngine.getLevels(); return [l.bass, l.energy, l.beat].map((x) => +x.toFixed(2)).join('/') })); await p.waitForTimeout(120) }
  log('levels bass/energy/beat during play-all:', samples.join(' '))
  const bg = await p.evaluate(async () => { const m = await import('/src/components/background/useBackground.ts'); return JSON.stringify(m.useBackground.getState()).slice(0, 300) })
  log('background state', bg)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(p, `${RUN}-99`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
