// Shared helpers to drive UNSHUFFLE through the UI (selectors from scripts/e2e/smoke.mjs).
export const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
export async function waitScreen(page, screen, timeout = 30_000) {
  await frame(page, screen).waitFor({ state: 'visible', timeout })
}
export async function waitPhase(page, kind, timeout = 90_000) {
  await page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, kind, { timeout, polling: 100 })
}
export async function newPlayer(browser, device, extra = {}) {
  const ctx = await browser.newContext(
    device === 'phone'
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ...extra }
      : { viewport: { width: 1440, height: 900 }, ...extra },
  )
  await ctx.addInitScript(() => {
    try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {}
  })
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  return { ctx, page }
}
export async function createRoom(page) {
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(page, 'lobby', 30_000)
  return page.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
}
export async function joinRoom(page, code) {
  const first = page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  await first.click()
  await page.keyboard.type(code.toLowerCase(), { delay: 40 })
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^Entra/ }).click()
  await waitScreen(page, 'lobby', 30_000)
}
export async function pickPlaylist(page, query = 'hits 2000') {
  const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill(query)
  const firstResult = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(500)
  await firstResult.click()
  await page.waitForFunction(() => document.querySelector('section[aria-label="Scegli la playlist"] li button[aria-pressed="true"]') !== null, null, { timeout: 5000 })
}
export async function setRadio(page, group, name) {
  const g = page.getByRole('radiogroup', { name: group }).first()
  await g.getByRole('radio', { name }).first().click()
}
export async function start(page) {
  await page.getByRole('button', { name: /Inizia partita/ }).first().click()
  await waitScreen(page, 'round', 30_000)
}
export async function boardReady(page) {
  await waitPhase(page, 'playing', 90_000)
  await page.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10_000 })
}
export async function center(page, pos) {
  const box = await page.locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
  if (!box) throw new Error(`no block at pos ${pos}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
export async function confirm(page) {
  await page.getByRole('button', { name: /^Conferma/ }).first().click()
}
export async function nextRound(page, last) {
  await page.getByRole('button', { name: last ? /Classifica finale/ : /Prossimo round/ }).first().click()
}
