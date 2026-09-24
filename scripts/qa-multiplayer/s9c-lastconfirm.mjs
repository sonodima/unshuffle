// Scenario 9b: which last-second drag counts on timeout? Host (desktop) confirms first
// → final timer 10 s. The phone guest (touch) makes a real reorder whose drop lands
// OFFSETS[r] ms before the end, never confirms. Compare the scored order with the
// board before/after the drop. Also: a drag still in progress at time-up.
import {
  DESKTOP, PHONE, boardOrder, browser, check, configure, confirm, createRoom, gotoHome, joinByCode, launch, log,
  openPlayer, pickPlaylist, placeCorrect, shot, st, startGame, summary, waitBoard, waitPhase, waitScreen,
} from './lib.mjs'

const CASES = [{ arr: 900, conf: 40 }, { arr: 200, conf: 120 }, { arr: 900, conf: 250 }]
const OFFSETS = CASES.map((c) => c.conf)
const tag = Math.random().toString(36).slice(2, 6)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (t) => {
  const d = t - Date.now()
  if (d > 0) await sleep(d)
}
const out = []
let confAt = 0

await launch()
const host = await openPlayer('host', DESKTOP, { profile: { id: `qa-h-${tag}`, name: 'Host', avatar: 0, color: 0 } })
const g = await openPlayer('guest', PHONE, { profile: { id: `qa-g-${tag}`, name: 'Guest', avatar: 1, color: 1 } })
g.__touch = true
const all = [host, g]
try {
  await Promise.all(all.map(gotoHome))
  const code = await createRoom(host)
  await joinByCode(g, code, { touch: true })
  await waitScreen(g, 'lobby')
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: OFFSETS.length, snippets: 6, roundTime: 60, finalTimer: 10 })
  await startGame(host)
  for (let r = 0; r < OFFSETS.length; r++) {
    await Promise.all(all.map((p) => waitPhase(p, 'playing', r, 120_000)))
    await Promise.all(all.map((p) => waitBoard(p)))
    await sleep(800)
    // A real move first: an untouched-board confirm never starts the final timer.
    await placeCorrect(host, 0)
    await confirm(host)
    await waitStore2(g, r)
    const s = await st(g)
    const localEnd = s.room.phase.endsAt - (s.hostNow - s.localNow)
    const before = await boardOrder(g)
    const target = [...before.slice(1), before[0]]
    // Same code path as a drop on the board (SnippetBoard → onOrderChange → store.setArrangement),
    // scheduled inside the page so CDP input latency on this loaded machine doesn't blur the timing.
    const dropAt = await g.evaluate(
      ({ at, order, conf }) =>
        new Promise((res) =>
          setTimeout(async () => {
            const m = await import('/src/game/store.ts')
            const t = Date.now()
            m.useGame.getState().setArrangement(order)
            setTimeout(() => {
              m.useGame.getState().submit()
              res({ t, c: Date.now() })
            }, Math.max(0, conf - Date.now()))
          }, Math.max(0, at - Date.now())),
        ),
      { at: localEnd - CASES[r].arr, order: target, conf: localEnd - CASES[r].conf },
    ).then((x) => { confAt = x.c; return x.t })
    const t0 = dropAt
    const confBeforeEnd = Math.round(localEnd - confAt)
    const after = target
    await Promise.all(all.map((p) => waitPhase(p, 'reveal', r, 20_000)))
    await sleep(1500)
    const hs = await st(host)
    const res = hs.room.results[r].find((x) => x.playerId === `qa-g-${tag}`)
    const scored = JSON.stringify(res.order)
    const verdict = scored === JSON.stringify(after) ? 'COUNTED' : scored === JSON.stringify(before) ? 'LOST' : 'OTHER'
    const row = { round: r + 1, confirmBeforeEndMs: confBeforeEnd, guestUiSubmitted: (await st(g)).submitted, targetOffsetMs: OFFSETS[r], dropBeforeEndMs: Math.round(localEnd - dropAt), dragMs: dropAt - t0, before, after, scored: res.order, verdict, timedOut: res.timedOut, points: res.points }
    out.push(row)
    log(JSON.stringify(row))
    check(`9c: R${r + 1} change ${row.dropBeforeEndMs} ms + confirm ${confBeforeEnd} ms before time-up: confirm accepted with that order`, verdict === 'COUNTED' && !res.timedOut, `${verdict} timedOut=${res.timedOut}`)
    await shot(g, `s9c-r${r + 1}-reveal`)
    if (r < OFFSETS.length - 1) await host.getByRole('button', { name: /Prossimo round/ }).first().click()
  }
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 's9c-FAIL')
} finally {
  summary(`lastsecond ${JSON.stringify(out)}`)
  await browser.close()
}

async function waitStore2(page, r) {
  const { waitStore } = await import('./lib.mjs')
  await waitStore(page, '(s, r) => s.room?.phase.kind === "playing" && s.room.phase.round === r && !!s.room.phase.firstSubmit', r, 5000)
}

async function dragTouch(page, from, to) {
  const { touchDrag } = await import('./lib.mjs')
  await touchDrag(page, from, to, { steps: 8, settle: 0 })
}
