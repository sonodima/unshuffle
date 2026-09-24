// Full 2-player game as a first-time Italian player:
// host = desktop, keyboard-heavy; guest = phone joined through the invite link.
import { BASE, DESKTOP, PHONE, launch, openPlayer, shot, waitScreen, waitPhase, boardOrder, center, mouseDrag, touchDrag, arrayMove, log, problems } from './lib.mjs'
const RUN = process.env.RUN ?? 'g'
const browser = await launch()
const host = await openPlayer(browser, 'host', { ...DESKTOP, permissions: ['clipboard-read', 'clipboard-write'] }, { onboarded: true })
const guest = await openPlayer(browser, 'guest', PHONE)
const both = (tag) => Promise.all([shot(host, `${RUN}-${tag}-host`), shot(guest, `${RUN}-${tag}-guest`)])
const secsLeft = (p) => p.evaluate(() => {
  const t = document.querySelector('[data-screen-frame]:not([inert]) [role="timer"]')
  return t ? t.textContent : null
})
try {
  await host.goto(BASE); await waitScreen(host, 'home')
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1])
  log('code', code)
  await host.waitForTimeout(1200)
  await shot(host, `${RUN}-01-lobby-host-alone`)
  // copy link
  await host.getByRole('button', { name: /Copia link/ }).first().click().catch((e) => log('copy link fail', e.message))
  await host.waitForTimeout(400)
  const clip = await host.evaluate(() => navigator.clipboard.readText()).catch(() => null)
  log('clipboard', clip)
  await shot(host, `${RUN}-02-lobby-copied`)
  // QR
  await host.getByRole('button', { name: 'Ingrandisci QR code' }).click().catch(() => log('no QR btn'))
  await host.waitForTimeout(700)
  await shot(host, `${RUN}-03-lobby-qr`)
  await host.keyboard.press('Escape'); await host.waitForTimeout(400)

  // guest via invite link
  const invite = clip && clip.includes('#/r/') ? clip.replace(/^https?:\/\/[^/]+\//, BASE) : `${BASE}#/r/${code}`
  await guest.goto(invite); await waitScreen(guest, 'home')
  await guest.waitForTimeout(2600)
  await shot(guest, `${RUN}-04-guest-invited-home`)
  const dlg = await guest.getByRole('dialog').count()
  log('guest onboarding dialog open on invite:', dlg)
  if (dlg) { await guest.getByRole('button', { name: /Ho capito/ }).tap(); await guest.waitForTimeout(500) }
  await guest.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitScreen(guest, 'lobby')
  await guest.waitForTimeout(1200)
  await both('05-lobby-joined')

  // host chip
  const chip = host.getByRole('button', { name: /Anni 80/ }).first()
  await chip.click().catch(async () => { log('chip as button failed, try text'); await host.getByText('Anni 80').first().click() })
  const firstResult = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 })
  await host.waitForTimeout(900)
  await shot(host, `${RUN}-06-picker-chip`)
  await firstResult.click()
  log('picked', await firstResult.getAttribute('title'))
  const setRadio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3')
  await setRadio('Spezzoni', /^8/)
  await setRadio('Tempo per round', '60s')
  await setRadio('Timer finale', '15s')
  await host.waitForTimeout(900)
  await both('07-lobby-configured')
  // guest tabs on phone
  const tabs = await guest.getByRole('tab').allTextContents()
  log('guest tabs', tabs)
  await guest.evaluate(() => document.querySelector('[data-screen-frame]:not([inert]) .overflow-y-auto')?.scrollTo({ top: 99999 }))
  await guest.waitForTimeout(400)
  await shot(guest, `${RUN}-08-lobby-guest-bottom`)

  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
  const tStart = Date.now()
  await Promise.all([waitScreen(host, 'round'), waitScreen(guest, 'round')])
  await host.waitForTimeout(600)
  await both('09-preparing')
  for (let r = 0; r < 3; r++) {
    const R = `r${r + 1}`
    await Promise.all([waitPhase(host, 'intro', 60000), waitPhase(guest, 'intro', 60000)])
    if (r === 0) log('start → intro', Date.now() - tStart, 'ms')
    await host.waitForTimeout(700)
    await both(`${R}-10-intro`)
    await host.waitForTimeout(1900)
    await both(`${R}-11-intro-countdown`)
    await Promise.all([waitPhase(host, 'playing', 60000), waitPhase(guest, 'playing', 60000)])
    await host.waitForTimeout(250)
    await both(`${R}-12-playing-go`)
    await host.waitForTimeout(1800)
    await both(`${R}-13-playing`)
    log(R, 'timer text host', await secsLeft(host))
    if (r === 0) {
      // ---- keyboard only on host
      let tabs = 0, onBlock = false
      for (; tabs < 40; tabs++) {
        await host.keyboard.press('Tab')
        onBlock = await host.evaluate(() => !!document.activeElement?.closest('[data-snippet-block]'))
        if (onBlock) break
      }
      log('Tabs to reach first block:', tabs + 1, onBlock)
      await host.waitForTimeout(200)
      await shot(host, `${RUN}-${R}-14-kbd-focus`)
      const before = await boardOrder(host)
      await host.keyboard.press('Enter'); await host.waitForTimeout(700)
      await shot(host, `${RUN}-${R}-15-kbd-enter-play`)
      await host.keyboard.press('Space'); await host.waitForTimeout(300)
      await host.keyboard.press('ArrowRight'); await host.waitForTimeout(300)
      await shot(host, `${RUN}-${R}-16-kbd-lifted`)
      await host.keyboard.press('Space'); await host.waitForTimeout(600)
      const after = await boardOrder(host)
      log('kbd reorder', before.join(','), '→', after.join(','))
      const live = await host.evaluate(() => [...document.querySelectorAll('[id^="DndLiveRegion"], [aria-live]')].map((e) => e.textContent).filter(Boolean).join(' | '))
      log('live regions:', live.slice(0, 300))
      // guest taps a block to play it
      const c = await center(guest, 2)
      await guest.touchscreen.tap(c.x, c.y); await guest.waitForTimeout(900)
      await shot(guest, `${RUN}-${R}-17-guest-tap-play`)
      await touchDrag(guest, 0, 5, 16, `${RUN}-${R}-18-guest-dragging`)
      await shot(guest, `${RUN}-${R}-19-guest-after-drag`)
      // guest play-all
      await guest.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).tap(); await guest.waitForTimeout(1500)
      await shot(guest, `${RUN}-${R}-20-guest-playall`)
      // guest confirms first
      await guest.getByRole('button', { name: /^Conferma/ }).first().tap()
      await host.waitForTimeout(700)
      await both(`${R}-21-guest-confirmed`)
      log(R, 'host timer after first confirm', await secsLeft(host))
      // wait for last 5 s on host
      await host.waitForFunction(() => { const t = document.querySelector('[data-screen-frame]:not([inert]) [role="timer"]'); const m = t?.textContent?.match(/(\d+):(\d\d)|(\d+)/); if (!m) return false; const s = m[1] ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3]); return s <= 5 }, null, { timeout: 30000, polling: 200 }).catch(() => log('timer read failed'))
      await both(`${R}-22-last-seconds`)
      await waitPhase(host, 'reveal', 30000).catch(() => {})
      await host.waitForTimeout(100)
      await shot(host, `${RUN}-${R}-23-timeup-host`)
    } else if (r === 1) {
      // perfect solve by host with mouse (checks perfect reveal)
      for (let target = 0; target < 8; target++) {
        const ord = await boardOrder(host)
        const from = ord.indexOf(target)
        if (from !== target) await mouseDrag(host, from, target)
      }
      log('host order', (await boardOrder(host)).join(','))
      await shot(host, `${RUN}-${R}-14-host-solved`)
      await host.getByRole('button', { name: /^Conferma/ }).first().click()
      await guest.waitForTimeout(700)
      await both(`${R}-21-host-confirmed`)
      await guest.waitForTimeout(3000)
      await shot(guest, `${RUN}-${R}-22-guest-after-banner`)
      await guest.waitForFunction(() => { const t = document.querySelector('[data-screen-frame]:not([inert]) [role="timer"]'); const m = t?.textContent?.match(/(\d+):(\d\d)|(\d+)/); if (!m) return false; const s = m[1] ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3]); return s <= 4 }, null, { timeout: 30000, polling: 200 }).catch(() => log('timer read failed'))
      await shot(guest, `${RUN}-${R}-23-guest-last-seconds`)
      await guest.waitForFunction(() => /Tempo scaduto/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {})
      await shot(guest, `${RUN}-${R}-24-guest-timeup`)
    } else {
      // both confirm without touching anything: an untouched board needs a second press
      // (the first only arms CONFERMA), and only Cmd/Ctrl+Enter confirms from the keyboard.
      await guest.getByRole('button', { name: /^Conferma|Non hai spostato/ }).first().tap()
      await guest.waitForTimeout(250)
      await guest.getByRole('button', { name: /^Conferma|Non hai spostato/ }).first().tap()
      await host.waitForTimeout(400)
      await host.keyboard.press('ControlOrMeta+Enter')
      await host.waitForTimeout(250)
      await host.keyboard.press('ControlOrMeta+Enter')
      await host.waitForTimeout(300)
    }
    await Promise.all([waitPhase(host, 'reveal', 40000), waitPhase(guest, 'reveal', 40000)])
    for (const ms of [300, 1500, 3000, 5000]) {
      await host.waitForTimeout(ms === 300 ? 300 : ms - [300, 1500, 3000, 5000][[300, 1500, 3000, 5000].indexOf(ms) - 1])
      await both(`${R}-30-reveal-${ms}`)
    }
    await Promise.all([
      host.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25000 }),
      guest.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25000 }),
    ])
    await host.waitForTimeout(800)
    await both(`${R}-31-reveal-done`)
    const txt = await guest.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.innerText)
    log(R, 'guest reveal text:\n', txt?.replace(/\n+/g, ' | ').slice(0, 900))
    await guest.evaluate(() => { const root = document.querySelector('[data-screen-frame]:not([inert]) .rv-root'); const sc = root?.closest('.overflow-y-auto') ?? root?.parentElement; sc?.scrollTo({ top: sc.scrollHeight }) })
    await guest.waitForTimeout(500)
    await shot(guest, `${RUN}-${R}-32-reveal-guest-bottom`)
    const last = r === 2
    if (r === 0) {
      // let auto-advance show its countdown for a while
      await host.waitForTimeout(4000)
      await both(`${R}-33-reveal-countdown`)
    }
    await host.getByRole('button', { name: last ? /Classifica finale/ : /Prossimo round/ }).first().click()
    if (!last) await host.waitForFunction(() => !document.querySelector('[data-phase="reveal"]'), null, { timeout: 15000 })
  }
  await Promise.all([waitScreen(host, 'final', 20000), waitScreen(guest, 'final', 20000)])
  await host.waitForTimeout(1200)
  await both('40-final-early')
  await host.waitForTimeout(2500)
  await both('41-final-podium')
  const ftxt = await guest.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.innerText)
  log('final text:\n', ftxt?.replace(/\n+/g, ' | ').slice(0, 1500))
  for (const p of [host, guest]) await p.evaluate(() => { const f = document.querySelector('[data-screen-frame]:not([inert])'); const sc = f?.querySelector('.overflow-y-auto') ?? f; sc?.scrollTo({ top: sc.scrollHeight / 2 }) })
  await host.waitForTimeout(800)
  await both('42-final-mid')
  for (const p of [host, guest]) await p.evaluate(() => { const f = document.querySelector('[data-screen-frame]:not([inert])'); const sc = f?.querySelector('.overflow-y-auto') ?? f; sc?.scrollTo({ top: sc.scrollHeight }) })
  await host.waitForTimeout(800)
  await both('43-final-bottom')
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await both('99-failure').catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
