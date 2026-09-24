// Scenario 5 + 6: host kicks a player in the lobby (message, can the kicked profile rejoin?
// can a fresh profile?), then the host closes its tab mid-game (what guests see, how fast,
// can they go home).
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, check, log, shot, finish, recordTimeline, timeline, waitScreen, sleep, boardReady, waitPlayingOrPast, BASE,
} from './lib.mjs'

const timings = {}
const browser = await launch()
let ok = false
const all = []
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const kim = await openPlayer(browser, 'Kim', PHONE)
  const eva = await openPlayer(browser, 'Eva', PHONE)
  all.push(host, kim, eva)
  const code = await createRoom(host)
  await Promise.all([kim, eva].map((g) => joinByLink(g, code)))
  await waitStore(host, '(s) => s.room?.players.length === 3', null, 20_000)
  const kimId = (await snap(kim)).me

  // ---------------------------------------------------------------- kick
  await host.getByRole('button', { name: 'Rimuovi Kim' }).click()
  await shot(host, 's5-kick-dialog')
  const tKick = Date.now()
  await host.getByRole('dialog').getByRole('button', { name: 'Rimuovi' }).click()
  await waitStore(kim, '(s) => s.role === "none"', null, 10_000)
  timings.kickedSeesMs = Date.now() - tKick
  await sleep(800)
  const kimText = await kim.locator('[role="dialog"]').allInnerTexts()
  log('kicked player dialog', kimText)
  check(kimText.some((t) => /rimosso/i.test(t)), 'kicked player sees "L’host ti ha rimosso"', kimText)
  const hash = await kim.evaluate(() => location.hash)
  check(!/#\/r\//.test(hash), `kicked player is back home (hash ${hash})`)
  await shot(kim, 's5-kicked')
  const hs = await snap(host)
  check(hs.room.players.length === 2 && !hs.room.players.some((p) => p.id === kimId), 'host roster without Kim')
  const es = await snap(eva)
  check(es.room.players.length === 2, 'other guest roster updated')
  const evaToasts = es.toasts
  log('eva toasts', evaToasts)

  // Kicked profile tries the invite link again.
  await kim.getByRole('dialog').getByRole('button', { name: 'Ok' }).tap().catch(() => {})
  await kim.goto(`${BASE}#/r/${code}`, { waitUntil: 'load' })
  await waitScreen(kim, 'home')
  await sleep(400)
  const tRe = Date.now()
  await kim.getByRole('button', { name: /^Entra/ }).first().tap()
  await sleep(4000)
  const ks = await snap(kim)
  const kimRejoinText = await kim.locator('[role="dialog"], [role="alert"]').allInnerTexts()
  log('kicked rejoin attempt', ks.role, ks.connection, ks.error, kimRejoinText, Date.now() - tRe)
  check(ks.role === 'none', 'kicked profile cannot rejoin the same room', { role: ks.role, error: ks.error })
  timings.kickedRejoinError = ks.error
  await shot(kim, 's5-kicked-rejoin')
  // Same device, fresh profile (cleared storage) → allowed.
  const kim2 = await openPlayer(browser, 'Kim2', PHONE, { url: null })
  all.push(kim2)
  await joinByLink(kim2, code).then(() => check(true, 'a fresh profile on the kicked device can join (ban is per profile id)'), () => check(false, 'fresh profile join'))

  // ---------------------------------------------------------------- host closes tab mid-game
  await pickPlaylist(host)
  await setSettings(host, { rounds: 3, snippets: 6, roundTime: 90, finalTimer: 15 })
  await startGame(host)
  await Promise.all([host, eva, kim2].map((p) => waitPlayingOrPast(p, 0)))
  await Promise.all([eva, kim2].map(recordTimeline))
  await boardReady(eva)
  await sleep(1500)
  const tClose = Date.now()
  await host.close({ runBeforeUnload: false })
  all.splice(all.indexOf(host), 1)
  const firstSign = await Promise.all([eva, kim2].map((p) => waitStore(p, '(s) => s.connection !== "open"', null, 30_000).then(() => Date.now() - tClose, () => null)))
  timings.guestNoticesLinkDownMs = firstSign
  await sleep(1000)
  await shot(eva, 's5-hostgone-reconnecting')
  const banner = await eva.locator('[role="status"]').allInnerTexts()
  log('guest banner while reconnecting', banner)
  const lost = await Promise.all([eva, kim2].map((p) => waitStore(p, '(s) => s.connection === "closed" || s.connection === "error" || s.role === "none"', null, 90_000).then(() => Date.now() - tClose, () => null)))
  timings.guestFinalDialogMs = lost
  check(lost.every((x) => x != null && x < 15_000), `guests get a definitive "host gone" message quickly (${lost} ms)`, lost)
  await sleep(1200)
  const dlg = await eva.locator('[role="dialog"]').allInnerTexts()
  log('guest dialog', dlg)
  await shot(eva, 's5-hostgone-dialog')
  await shot(kim2, 's5-hostgone-dialog')
  // "Torna alla home"
  const home = eva.getByRole('button', { name: /Torna alla home/ })
  if (await home.count()) {
    await home.first().tap()
    await waitScreen(eva, 'home', 10_000).then(() => check(true, 'guest can go home after the host left'), () => check(false, 'guest can go home'))
    await shot(eva, 's5-home-after')
  } else check(false, 'no "Torna alla home" button', dlg)
  // What does "Riprova" do?
  const retry = kim2.getByRole('button', { name: /Riprova/ })
  if (await retry.count()) {
    const tR = Date.now()
    await retry.first().tap()
    await waitStore(kim2, '(s) => s.role === "none"', null, 30_000).catch(() => {})
    timings.retryAfterHostGoneMs = Date.now() - tR
    await sleep(800)
    log('after Riprova', (await snap(kim2)).error, await kim2.locator('[role="dialog"]').allInnerTexts())
    await shot(kim2, 's5-after-riprova')
  }
  timings.evaTimeline = await timeline(eva)
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) {
    try {
      await shot(p, 's5-FAIL')
      const sn = await snap(p)
      console.log('SNAP', p.__name, JSON.stringify({ phase: sn.room?.phase, conn: sn.connection, err: sn.error, role: sn.role }))
    } catch {
      /* ignore */
    }
  }
} finally {
  await browser.close()
}
console.log('timings', JSON.stringify(timings))
finish('s5-kick-hostclose', { timings })
process.exit(ok ? 0 : 1)
