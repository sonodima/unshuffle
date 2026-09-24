// Virtual keyboard approximation: focus an input, then shrink the viewport height by a typical
// keyboard (Android resizes-content model; iOS/Chrome≥108 default only pans the visual viewport,
// which Playwright cannot emulate). Checks the focused field + its CTA stay visible.
import { BASE, OUT, VIEWPORTS, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'
const KB = 330
const vp = VIEWPORTS.find((v) => v.id === (process.env.VP ?? '390x844'))
const { page, errors } = await newContext('chromium', vp)
await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
await installQa(page)
const probe = (sel) =>
  page.evaluate((sel) => {
    const a = document.activeElement
    const r = a?.getBoundingClientRect()
    const c = sel ? [...document.querySelectorAll('button')].find((b) => new RegExp(sel).test(b.textContent || '')) : null
    const cr = c?.getBoundingClientRect()
    return {
      vh: innerHeight,
      active: a?.getAttribute('aria-label') || a?.getAttribute('placeholder') || a?.tagName,
      field: r && { top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top >= 0 && r.bottom <= innerHeight },
      cta: cr && { text: c.textContent.trim().slice(0, 20), top: Math.round(cr.top), bottom: Math.round(cr.bottom), visible: cr.top >= 0 && cr.bottom <= innerHeight },
      meta: document.querySelector('meta[name=viewport]')?.content,
    }
  }, sel)
async function kb(tag, focus, ctaRe) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await sleep(300)
  await focus()
  await sleep(300)
  const before = await probe(ctaRe)
  await page.setViewportSize({ width: vp.width, height: vp.height - KB })
  await sleep(700)
  const after = await probe(ctaRe)
  await page.screenshot({ path: `${OUT}kb-${vp.id}-${tag}.png` })
  console.log(tag, JSON.stringify({ before, after }))
}
await goHome(page)
await sleep(800)
await kb('home-name', async () => page.getByRole('textbox', { name: /nome/i }).first().tap(), '^Crea stanza')
await goHome(page)
await sleep(800)
await kb('home-code', async () => { await page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap(); await page.keyboard.type('KXQ') }, '^Entra')
await setState(page, 'lobby')
await sleep(900)
await page.getByRole('tab', { name: /^Playlist/ }).tap().catch(() => {})
await sleep(500)
await kb('lobby-search', async () => { const s = page.getByRole('searchbox', { name: 'Cerca playlist' }); await s.tap(); await s.fill('rock'); await sleep(2500) }, 'Inizia partita')
await page.setViewportSize({ width: vp.width, height: vp.height })
console.log('errors', errors)
await closeBrowsers()
