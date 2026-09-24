// Finding 1/8: real CDP touch taps with finger jitter must play the snippet (not a lost
// zero-length drag); long-press plays from that position; drags still reorder.
// Usage: node scripts/fix-board/tap.mjs   (dev server on :5400)
import { newPage, openLab, center, order, engineState, stopAudio, touchPath, line, sleep, close, pt } from './lib.mjs'

const N = Number(process.env.N ?? 8)
const { page, cdp, errors } = await newPage(process.env.KIND ?? 'phone')
const results = []
const log = (name, data) => {
  results.push({ name, ...data })
  console.log(name.padEnd(28), JSON.stringify(data))
}
try {
  await openLab(page, process.env.LABQ ?? `audio=synth&engine=mock&n=${N}&ui=0`)
  for (const j of [0, 3, 5, 8, 10, 12, 15]) {
    await stopAudio(page)
    await sleep(150)
    const before = await order(page)
    const c = await center(page, 1)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.x, c.y) })
    if (j) {
      await sleep(30)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(c.x + j * 0.6, c.y + j * 0.8) })
    }
    await sleep(70)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(450)
    const s = await engineState(page)
    const after = await order(page)
    const lifted = await page.evaluate(() => !!document.querySelector('.sb-lift'))
    log(`tap-jitter-${j}px`, {
      plays: s.playing && s.tag === `block:${before[1]}`,
      tag: s.tag,
      orderChanged: before.join() !== after.join(),
      overlayLeft: lifted,
    })
  }
  // tap twice (slow) toggles off
  await stopAudio(page)
  {
    const c = await center(page, 2)
    await touchPath(cdp, [c])
    await sleep(450)
    const s1 = await engineState(page)
    await touchPath(cdp, [c])
    await sleep(450)
    const s2 = await engineState(page)
    log('tap-twice-toggles', { first: s1.playing && s1.tag?.startsWith('block:'), second: s2.playing })
  }
  // long-press → play-all from that position
  await stopAudio(page)
  {
    const c = await center(page, 3)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.x, c.y) })
    await sleep(200)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(c.x + 3, c.y + 2) })
    await sleep(450)
    const mid = await engineState(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(400)
    const s = await engineState(page)
    log('long-press-play-from', { duringHold: mid, afterRelease: s, ok: s.playing && s.tag === 'board' && s.mode === 'sequence' && s.index === 3 })
  }
  // long-press then drag: plays and still reorders
  await stopAudio(page)
  {
    const before = await order(page)
    const a = await center(page, 0)
    const b = await center(page, N - 1)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
    await sleep(600)
    for (const p of line(a, b, 30).slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p.x, p.y) })
      await sleep(16)
    }
    await sleep(150)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(600)
    const after = await order(page)
    const s = await engineState(page)
    const expect = [...before.slice(1), before[0]]
    log('long-press-then-drag', { reordered: after.join() === expect.join(), playing: s.tag })
  }
  // plain drags still reorder
  for (const [from, to, steps] of [
    [0, 1, 12],
    [0, N - 1, 40],
    [N - 1, 0, 40],
  ]) {
    await stopAudio(page)
    const before = await order(page)
    const a = await center(page, from)
    const b = await center(page, to)
    await touchPath(cdp, line(a, b, steps))
    await sleep(600)
    const after = await order(page)
    const expect = before.slice()
    const [x] = expect.splice(from, 1)
    expect.splice(to, 0, x)
    const s = await engineState(page)
    log(`drag ${from}->${to}`, { ok: after.join() === expect.join(), playingAfter: s.playing, overlayLeft: await page.evaluate(() => !!document.querySelector('.sb-lift')) })
  }
  // a quick short flick that returns (12px out and back) is a tap, not a lost drag
  await stopAudio(page)
  {
    const c = await center(page, 4)
    const before = await order(page)
    await touchPath(cdp, [c, { x: c.x + 7, y: c.y + 9 }, { x: c.x + 13, y: c.y + 5 }, { x: c.x + 6, y: c.y + 2 }], 20)
    await sleep(450)
    const s = await engineState(page)
    log('wobble-13px-tap', { plays: s.playing && s.tag === `block:${before[4]}`, orderChanged: (await order(page)).join() !== before.join() })
  }
  console.log('errors', JSON.stringify(errors))
} finally {
  await close()
}
