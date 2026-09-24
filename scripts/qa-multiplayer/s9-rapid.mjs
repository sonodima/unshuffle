// Scenario 9: rapid-fire / adversarial timing: reaction spam, double confirm, drag held
// across the deadline, drag + confirm in the last ~100 ms.
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, check, log, shot, finish, sleep, boardReady, waitPlayingOrPast, waitRevealOrPast, hostNext,
  boardOrder, center, confirm, placeSegment, recordTimeline, timeline, scoreArrangement,
} from './lib.mjs'

const browser = await launch()
let ok = false
const all = []
const out = {}
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const gio = await openPlayer(browser, 'Gio', PHONE)
  all.push(host, gio)
  const code = await createRoom(host)
  await joinByLink(gio, code)
  await waitStore(host, '(s) => s.room?.players.length === 2', null, 20_000)
  await Promise.all(all.map(recordTimeline))
  const ids = { Host: (await snap(host)).me, Gio: (await snap(gio)).me }

  // ---------------------------------------------------------------- reaction spam (lobby)
  const countEvents = (p) => p.evaluate(async () => {
    const { useGame } = await import('/src/game/store.ts')
    window.__qaReactions = window.__qaReactions ?? 0
    if (!window.__qaReactOff) window.__qaReactOff = useGame.subscribe((s, prev) => {
      const n = s.toasts.filter((t) => t.event.type === 'reaction' && !prev.toasts.some((q) => q.id === t.id)).length
      window.__qaReactions += n
    })
    return window.__qaReactions
  })
  await countEvents(host)
  await countEvents(gio)
  const bar = (p) => p.locator('[role="group"][aria-label="Reazioni"] button').first()
  const t0 = Date.now()
  const spam = async (p, n, touch) => {
    const b = await bar(p).boundingBox()
    for (let i = 0; i < n; i++) {
      if (touch) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
      else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    }
  }
  await Promise.all([spam(host, 40, false), spam(gio, 40, true)])
  const spamMs = Date.now() - t0
  await sleep(800)
  const hostGot = await countEvents(host)
  const gioGot = await countEvents(gio)
  const toastsNow = (await snap(host)).toasts.filter((t) => t.type === 'reaction').length
  out.reactions = { spamMs, hostGot, gioGot, toastsNow }
  log('reaction spam', out.reactions)
  check(toastsNow <= 8, `reaction toasts capped (${toastsNow})`)
  check(hostGot <= Math.ceil(spamMs / 400) * 2 + 4, `reactions throttled (${hostGot} received in ${spamMs} ms)`)
  await shot(host, 's9-reaction-spam')
  await shot(gio, 's9-reaction-spam')

  await pickPlaylist(host)
  await setSettings(host, { rounds: 3, snippets: 6, roundTime: 60, finalTimer: 10 })
  await startGame(host)

  // ---------------------------------------------------------------- round 1: double confirm
  await Promise.all(all.map((p) => waitPlayingOrPast(p, 0)))
  await Promise.all(all.map((p) => boardReady(p)))
  await sleep(1500)
  const cbox = async (p) => p.locator('[data-round-view="playing"] button').filter({ hasText: /^\s*Conferma\s*$/ }).first().boundingBox()
  const g = await cbox(gio)
  const h = await cbox(host)
  await Promise.all([
    (async () => {
      // Untouched board: the first tap arms CONFERMA, the second confirms.
      await gio.touchscreen.tap(g.x + g.width / 2, g.y + g.height / 2)
      await gio.touchscreen.tap(g.x + g.width / 2, g.y + g.height / 2)
      await gio.keyboard.press('ControlOrMeta+Enter')
    })(),
    (async () => {
      await sleep(200)
      await host.mouse.dblclick(h.x + h.width / 2, h.y + h.height / 2)
      await host.keyboard.press('ControlOrMeta+Enter')
    })(),
  ])
  await waitRevealOrPast(host, 0, 30_000)
  const tl1 = await timeline(host)
  const firsts = new Set(tl1.map((x) => JSON.parse(x.k)).filter((k) => k[0] === 'playing' && k[1] === 0 && k[3]).map((k) => k[2]))
  check(firsts.size === 1, `double confirm: endsAt pulled in exactly once (${[...firsts]})`)
  let s = await snap(host)
  check(s.room.results[0].length === 2 && s.room.results[0].every((r) => !r.timedOut), 'double confirm: one result per player, both confirmed')
  await sleep(1500)
  await hostNext(host, 0, false)

  // ---------------------------------------------------------------- round 2: drag held across the deadline
  await Promise.all(all.map((p) => waitPlayingOrPast(p, 1)))
  await Promise.all(all.map((p) => boardReady(p)))
  await sleep(1200)
  await confirm(host) // final timer: 10 s
  await waitStore(gio, '(s) => !!s.room?.phase.firstSubmit', null, 10_000)
  s = await snap(gio)
  const endsLocal = s.room.phase.endsAt - (s.hostNow - s.now)
  const beforeDrag = await boardOrder(gio)
  // start a touch drag 1.2 s before the end, move it, hold past the deadline, release 400 ms after
  const cdp = await gio.context().newCDPSession(gio)
  const a = await center(gio, 0)
  const b = await center(gio, 4)
  await sleep(Math.max(0, endsLocal - 1200 - Date.now()))
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10) })
    await sleep(16)
  }
  await sleep(Math.max(0, endsLocal + 400 - Date.now()))
  const lockedAtRelease = await gio.locator('[data-round-view="playing"][data-locked]').count()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(500)
  const afterRelease = await boardOrder(gio).catch(() => null)
  await cdp.detach()
  await waitRevealOrPast(host, 1, 20_000)
  s = await snap(host)
  const gr = s.room.results[1].find((x) => x.playerId === ids.Gio)
  out.dragAcrossDeadline = { beforeDrag, afterRelease, lockedAtRelease, scored: gr.order, timedOut: gr.timedOut }
  log('drag across deadline', out.dragAcrossDeadline)
  check(JSON.stringify(gr.order) === JSON.stringify(beforeDrag), 'drag still held at the deadline: host scores the pre-drag arrangement (drop after time-up ignored)', out.dragAcrossDeadline)
  await shot(gio, 's9-r2-after-deadline-drag')
  await sleep(1500)
  await hostNext(host, 1, false)

  // ---------------------------------------------------------------- round 3: drag + confirm in the last ~100 ms (nobody else confirms)
  await Promise.all(all.map((p) => waitPlayingOrPast(p, 2)))
  await Promise.all(all.map((p) => boardReady(p)))
  s = await snap(gio)
  const ends3 = s.room.phase.endsAt - (s.hostNow - s.now)
  const initial3 = await boardOrder(gio)
  // Put segment 0 in place with a drag that ends ~150 ms before the deadline, then confirm ~60 ms before it.
  const from = initial3.indexOf(0)
  const A = await center(gio, from)
  const B = await center(gio, 0)
  const cdp2 = await gio.context().newCDPSession(gio)
  await sleep(Math.max(0, ends3 - 900 - Date.now()))
  await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(A.x, A.y) })
  for (let i = 1; i <= 8; i++) {
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(A.x + ((B.x - A.x) * i) / 8, A.y + ((B.y - A.y) * i) / 8) })
    await sleep(12)
  }
  await sleep(Math.max(0, ends3 - 170 - Date.now()))
  await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp2.detach()
  const cb3 = await cbox(gio)
  await sleep(Math.max(0, ends3 - 60 - Date.now()))
  const tTap = Date.now()
  if (cb3) await gio.touchscreen.tap(cb3.x + cb3.width / 2, cb3.y + cb3.height / 2)
  const tapLateBy = tTap - ends3
  await sleep(300)
  const gs = await snap(gio)
  const boardAtEnd = gs.arrangement
  await waitRevealOrPast(host, 2, 20_000)
  s = await snap(host)
  const r3 = s.room.results[2].find((x) => x.playerId === ids.Gio)
  out.lastMs = { tapRelativeToEndsMs: tapLateBy, localSubmitted: gs.submitted, localArrangement: boardAtEnd, scored: r3.order, timedOut: r3.timedOut, points: r3.points, localPoints: scoreArrangement(boardAtEnd, 6).points }
  log('drag+confirm in the last 100 ms', out.lastMs)
  check(JSON.stringify(r3.order) === JSON.stringify(boardAtEnd), 'last-100ms: host scored exactly the arrangement on the player\'s board', out.lastMs)
  await sleep(6000)
  await shot(gio, 's9-r3-reveal')
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) await shot(p, 's9-FAIL')
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
finish('s9-rapid', { out })
process.exit(ok ? 0 : 1)
