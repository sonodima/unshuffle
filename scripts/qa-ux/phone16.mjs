// Phone (390x844) solo host, 16 snippets: touch-target sizes of blocks and "Ascolta dalla posizione" pills,
// tap a pill, tap a block during play-all, color-only cues.
import { BASE, PHONE, launch, openPlayer, shot, waitScreen, waitPhase, log, problems } from './lib.mjs'
const RUN = 'p'
const browser = await launch()
const p = await openPlayer(browser, 'phone', PHONE, { onboarded: true })
const eng = (fn) => p.evaluate(async (src) => { const m = await import('/src/audio/engine.ts'); return (0, eval)(src)(m.audioEngine, m) }, fn.toString())
try {
  await p.goto(BASE); await waitScreen(p, 'home')
  await p.getByRole('button', { name: 'Crea stanza', exact: true }).tap()
  await waitScreen(p, 'lobby')
  await p.getByRole('tab', { name: /Playlist/ }).tap()
  const firstResult = p.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 }); await firstResult.tap()
  await p.getByRole('tab', { name: /Regole/ }).tap()
  await p.getByRole('radiogroup', { name: 'Spezzoni' }).first().getByRole('radio', { name: /^16/ }).first().tap()
  await p.getByRole('radiogroup', { name: 'Tempo per round' }).first().getByRole('radio', { name: '180s' }).first().tap()
  await p.getByRole('button', { name: /Inizia partita/ }).first().tap()
  await waitPhase(p, 'playing', 90000); await p.waitForTimeout(2500)
  const m = await p.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}` }
    const blocks = [...document.querySelectorAll('[data-screen-frame]:not([inert]) .sb-item')]
    const pills = [...document.querySelectorAll('[data-screen-frame]:not([inert]) .tb-cell')]
    const btns = [...document.querySelectorAll('[data-screen-frame]:not([inert]) button')].filter((b) => b.getClientRects().length).map((b) => ({ n: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30), s: r(b) }))
    return { blocks: blocks.length, block: blocks[0] && r(blocks[0]), pills: pills.length, pill: pills[0] && r(pills[0]), small: btns.filter((b) => { const [w, h] = b.s.split('x').map(Number); return w < 44 || h < 44 }) }
  })
  log('phone 16 metrics', JSON.stringify(m))
  await shot(p, `${RUN}-01-playing16`)
  // tap pill #9
  const pill = p.locator('[data-screen-frame]:not([inert]) .tb-cell').nth(8)
  await pill.tap(); await p.waitForTimeout(600)
  log('after tapping pill 9', JSON.stringify(await eng((e) => e.getState())))
  await shot(p, `${RUN}-02-pill-tap`)
  // tap a block during play-all
  const blk = p.locator('[data-screen-frame]:not([inert]) .sb-item[data-pos="2"]')
  await blk.tap(); await p.waitForTimeout(600)
  log('after tapping block pos2 during play-all', JSON.stringify(await eng((e) => e.getState())))
  await shot(p, `${RUN}-03-block-during-playall`)
  // stop via transport button
  await p.getByRole('button', { name: /Ferma|Stop|Interrompi/i }).first().tap().catch((e) => log('no stop button', e.message.slice(0, 80)))
  await p.waitForTimeout(400)
  log('after stop', JSON.stringify(await eng((e) => e.getState())))
  const names = await p.evaluate(() => [...document.querySelectorAll('[data-screen-frame]:not([inert]) button')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()).filter(Boolean).slice(0, 40))
  log('buttons', names.join(' | '))
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(p, `${RUN}-99`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
