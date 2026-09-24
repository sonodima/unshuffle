// Extra: guests whose device clock is wrong (+7 s and −4 s). The host-clock estimate must hide it:
// remaining time and the displayed timer must agree with the host; the final-timer pull-in too.
import {
  DESKTOP, PHONE, browser, check, configure, confirm, createRoom, displayedTimer, gotoHome, joinByCode, launch, log,
  openPlayer, pickPlaylist, placeCorrect, shot, startGame, summary, waitBoard, waitPhase, waitScreen, waitStore,
} from './lib.mjs'

const tag = Math.random().toString(36).slice(2, 6)
const P = (id, name, a) => ({ id: `qa-${id}-${tag}`, name, avatar: a, color: a })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = {}
await launch()
async function skewed(name, dev, prof, skewMs) {
  const p = await openPlayer(name, dev, { profile: prof })
  await p.context().addInitScript((skew) => {
    const RealDate = Date
    const realNow = RealDate.now.bind(RealDate)
    class SkewDate extends RealDate {
      constructor(...a) {
        if (a.length === 0) super(realNow() + skew)
        else super(...a)
      }
      static now() {
        return realNow() + skew
      }
    }
    // eslint-disable-next-line no-global-assign
    Date = SkewDate
  }, skewMs)
  return p
}
const host = await openPlayer('host', DESKTOP, { profile: P('h', 'Host', 0) })
const fast = await skewed('fast', PHONE, P('f', 'Avanti', 1), 7000)
const slow = await skewed('slow', PHONE, P('s', 'Indietro', 2), -4000)
fast.__touch = slow.__touch = true
const all = [host, fast, slow]
async function remaining(p) {
  return p.evaluate(async () => {
    const m = await import('/src/game/store.ts')
    const c = await import('/src/game/clock.ts')
    const ph = m.useGame.getState().room?.phase
    return ph && 'endsAt' in ph ? ph.endsAt - c.hostNow() : null
  })
}
try {
  await Promise.all(all.map(gotoHome))
  const code = await createRoom(host)
  await Promise.all([joinByCode(fast, code, { touch: true }), joinByCode(slow, code, { touch: true })])
  await Promise.all([fast, slow].map((p) => waitScreen(p, 'lobby')))
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: 3, snippets: 6, roundTime: 60, finalTimer: 10 })
  await startGame(host)
  // Intro countdown: all peers should show the same intro remaining.
  await Promise.all(all.map((p) => waitPhase(p, 'intro', 0, 120_000)))
  const intro = await Promise.all(all.map(remaining))
  out.introRemaining = intro.map(Math.round)
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 0, 30_000)))
  await Promise.all(all.map((p) => waitBoard(p)))
  await sleep(3000)
  const [rem, disp] = await Promise.all([Promise.all(all.map(remaining)), Promise.all(all.map(displayedTimer))])
  out.playingRemaining = rem.map(Math.round)
  out.playingShown = disp.map((d) => d.secs)
  const spread = Math.max(...rem) - Math.min(...rem)
  check('13: remaining time agrees across skewed clocks (≤ 300 ms)', spread <= 300, `remaining ${out.playingRemaining} shown ${out.playingShown}`)
  check('13: intro countdown agrees (≤ 300 ms)', Math.max(...intro) - Math.min(...intro) <= 300, `${out.introRemaining}`)
  await Promise.all(all.map((p) => shot(p, 's13-playing')))
  // A real move first: an untouched-board confirm never starts the final timer.
  await placeCorrect(fast, 0)
  await confirm(fast)
  await waitStore(host, '(s) => !!s.room.phase.firstSubmit', null, 5000)
  await sleep(400)
  const [rem2, disp2] = await Promise.all([Promise.all(all.map(remaining)), Promise.all(all.map(displayedTimer))])
  out.afterPullIn = rem2.map(Math.round)
  out.afterPullInShown = disp2.map((d) => d.secs)
  check('13: final-timer pull-in agrees across skewed clocks', Math.max(...rem2) - Math.min(...rem2) <= 300 && Math.max(...rem2) <= 10_000, `${out.afterPullIn} shown ${out.afterPullInShown}`)
  await Promise.all(all.map((p) => shot(p, 's13-pullin')))
  const t = Date.now()
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 0, 20_000)))
  out.revealAfterMs = Date.now() - t
  log(JSON.stringify(out))
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 's13-FAIL')
} finally {
  summary(`s13 ${JSON.stringify(out)}`)
  await browser.close()
}
