// Keyboard-only solo game on desktop + unlabeled-control scan on each screen.
import { BASE, DESKTOP, launch, openPlayer, shot, waitScreen, waitPhase, boardOrder, log, problems } from './lib.mjs'
const RUN = 'k'
const browser = await launch()
const p = await openPlayer(browser, 'kbd', DESKTOP, { onboarded: true })
const scan = (label) => p.evaluate((label) => {
  const root = document.querySelector('[data-screen-frame]:not([inert])') ?? document.body
  const els = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="radio"], [tabindex]:not([tabindex="-1"])')]
    .filter((e) => !e.closest('[inert]') && e.getClientRects().length)
  const name = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'))?.textContent) || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || (e.labels && e.labels[0]?.textContent) || '').trim()
  const unnamed = els.filter((e) => !name(e)).map((e) => e.outerHTML.slice(0, 160))
  const imgs = [...root.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(0, 80))
  const small = els.filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) }).map((e) => `${name(e).slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
  const h = [...root.querySelectorAll('h1,h2,h3')].map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 30))
  return { label, lang: document.documentElement.lang, title: document.title, controls: els.length, unnamed, imgsNoAlt: imgs, small, headings: h }
}, label)
const tabTo = async (pred, max = 60) => {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab')
    const info = await p.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, name: (a?.getAttribute('aria-label') || a?.textContent || '').trim().slice(0, 60), role: a?.getAttribute('role') } })
    if (pred(info)) return { i: i + 1, info }
  }
  return null
}
const focusRing = () => p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, shadow: cs.boxShadow.slice(0, 80) } })
try {
  await p.goto(BASE); await waitScreen(p, 'home'); await p.waitForTimeout(800)
  console.log(JSON.stringify(await scan('home')))
  const order = []
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => { const a = document.activeElement; return (a?.getAttribute('aria-label') || a?.textContent || a?.tagName || '').trim().slice(0, 40) })) }
  log('home tab order:', order.join(' → '))
  await p.keyboard.press('Shift+Tab')
  await shot(p, `${RUN}-01-home-focus`)
  // Create via keyboard
  await p.goto(BASE); await waitScreen(p, 'home'); await p.waitForTimeout(500)
  const c = await tabTo((x) => /Crea stanza/.test(x.name))
  log('Tabs to Crea stanza', c?.i, JSON.stringify(await focusRing()))
  await shot(p, `${RUN}-02-crea-focused`)
  await p.keyboard.press('Enter')
  await waitScreen(p, 'lobby'); await p.waitForTimeout(1200)
  console.log(JSON.stringify(await scan('lobby-host')))
  const s = await tabTo((x) => /Cerca/.test(x.name) || x.tag === 'INPUT')
  log('Tabs to search', s?.i, s?.info?.name)
  // go to first featured card
  const f = await tabTo((x) => x.tag === 'BUTTON' && /brani|Top/i.test(x.name), 40)
  log('Tabs to first playlist card', f?.i, f?.info?.name)
  await p.keyboard.press('Enter'); await p.waitForTimeout(800)
  await shot(p, `${RUN}-03-lobby-kbd-picked`)
  const st = await tabTo((x) => /Inizia partita/.test(x.name), 80)
  log('Tabs to Inizia partita', st?.i)
  await shot(p, `${RUN}-04-start-focused`)
  await p.keyboard.press('Enter')
  await waitPhase(p, 'playing', 90000); await p.waitForTimeout(2200)
  console.log(JSON.stringify(await scan('playing')))
  // arrange by keyboard: move block at pos 1 to pos 0
  const b = await tabTo((x) => /Spezzone/.test(x.name), 10)
  log('Tabs to first block', b?.i, b?.info?.name)
  await p.keyboard.press('Tab'); // second block
  const before = await boardOrder(p)
  await p.keyboard.press('Space'); await p.waitForTimeout(250)
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250)
  await p.keyboard.press('Space'); await p.waitForTimeout(500)
  const after = await boardOrder(p)
  log('kbd move pos1→pos0', before.join(','), '→', after.join(','))
  // where is focus now?
  log('focus after drop', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')))
  // arrow down on 4-col grid
  await p.keyboard.press('Space'); await p.waitForTimeout(250)
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250)
  await p.keyboard.press('Space'); await p.waitForTimeout(500)
  log('kbd ArrowDown', after.join(','), '→', (await boardOrder(p)).join(','))
  // Space when block not focused = play all?
  await p.keyboard.press('Escape')
  await p.evaluate(() => document.activeElement?.blur())
  await p.keyboard.press('Space'); await p.waitForTimeout(800)
  log('play-all via Space pressed:', await p.getByRole('button', { name: 'Ferma la riproduzione' }).count())
  await shot(p, `${RUN}-05-space-playall`)
  await p.keyboard.press('Space')
  // Confirm from anywhere is Cmd/Ctrl+Enter (plain Enter belongs to the focused control);
  // pressed twice in case the board is still the untouched shuffle (first press only arms).
  await p.keyboard.press('ControlOrMeta+Enter'); await p.waitForTimeout(250)
  await p.keyboard.press('ControlOrMeta+Enter')
  await waitPhase(p, 'reveal', 20000); await p.waitForTimeout(6000)
  console.log(JSON.stringify(await scan('reveal')))
  const nx = await tabTo((x) => /Prossimo round|Classifica finale/.test(x.name), 60)
  log('Tabs to Prossimo round', nx?.i)
  await shot(p, `${RUN}-06-reveal-focus`)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(p, `${RUN}-99`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
