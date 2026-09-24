// Finding 5 + mouse/keyboard regressions on the board lab (1440x900, mouse).
// - locking mid-drag cancels the drag (overlay gone, order unchanged, no stuck cursor)
// - mouse click / 6px wobble click plays; long press plays from position; drags reorder
// - keyboard: Enter toggles, Shift+Enter plays from position, Space-arrow-Space moves
import { newPage, openLab, center, order, engineState, stopAudio, sleep, close } from './lib.mjs'

const { page, errors } = await newPage('desktop')
const log = (name, data) => console.log(name.padEnd(30), JSON.stringify(data))
try {
  await openLab(page, 'audio=synth&engine=mock&n=8&ui=0')

  // --- lock mid-drag
  {
    const before = await order(page)
    const a = await center(page, 0)
    const b = await center(page, 3)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10)
      await sleep(16)
    }
    const draggingBefore = await page.evaluate(() => !!document.querySelector('.sb-board[data-dragging]'))
    await page.evaluate(() => window.__lab.setLocked(true))
    await sleep(450)
    const st = await page.evaluate(() => ({
      dragging: !!document.querySelector('.sb-board[data-dragging]'),
      overlay: !!document.querySelector('.sb-overlay .sb-lift'),
      grabbing: document.documentElement.classList.contains('sb-grabbing'),
    }))
    await page.mouse.up()
    await sleep(300)
    const after = await order(page)
    log('lock-mid-drag', { draggingBefore, ...st, orderUnchanged: before.join() === after.join(), ok: draggingBefore && !st.dragging && !st.overlay && !st.grabbing })
    await page.evaluate(() => window.__lab.setLocked(false))
    await sleep(300)
  }

  // --- mouse click, wobble click
  for (const wob of [0, 6, 12]) {
    await stopAudio(page)
    const c = await center(page, 2)
    const seg = (await order(page))[2]
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    if (wob) {
      await page.mouse.move(c.x + wob * 0.6, c.y + wob * 0.8, { steps: 3 })
      await sleep(30)
    }
    await page.mouse.up()
    await sleep(350)
    const s = await engineState(page)
    log(`mouse-click-wobble-${wob}px`, { plays: s.playing && s.tag === `block:${seg}` })
  }
  // --- mouse long-press
  await stopAudio(page)
  {
    const c = await center(page, 5)
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    await sleep(250)
    const pressing = await page.evaluate(() => !!document.querySelector('.sb-item[data-pressing]'))
    await sleep(350)
    await page.mouse.up()
    await sleep(300)
    const s = await engineState(page)
    const leftover = await page.evaluate(() => !!document.querySelector('.sb-item[data-pressing]'))
    log('mouse-long-press', { pressingFeedback: pressing, leftover, ok: s.playing && s.tag === 'board' && s.index === 5 })
  }
  // --- mouse drag still works
  await stopAudio(page)
  {
    const before = await order(page)
    const a = await center(page, 1)
    const b = await center(page, 6)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 20 })
    await sleep(120)
    await page.mouse.up()
    await sleep(500)
    const after = await order(page)
    const exp = before.slice()
    const [x] = exp.splice(1, 1)
    exp.splice(6, 0, x)
    log('mouse-drag 1->6', { ok: after.join() === exp.join() })
  }
  // --- keyboard
  await stopAudio(page)
  {
    await page.locator('.sb-item[data-pos="0"]').focus()
    const seg0 = (await order(page))[0]
    await page.keyboard.press('Enter')
    await sleep(200)
    const s1 = await engineState(page)
    await page.keyboard.press('Enter')
    await sleep(200)
    const s2 = await engineState(page)
    await page.keyboard.press('Shift+Enter')
    await sleep(200)
    const s3 = await engineState(page)
    log('keyboard Enter/Enter/Shift+Enter', { plays: s1.tag === `block:${seg0}`, stops: !s2.playing, playFrom0: s3.tag === 'board' && s3.index === 0 })
    await stopAudio(page)
    const before = await order(page)
    await page.keyboard.press('Space')
    await sleep(250)
    await page.keyboard.press('ArrowRight')
    await sleep(250)
    await page.keyboard.press('Space')
    await sleep(500)
    const after = await order(page)
    const s4 = await engineState(page)
    log('keyboard lift/move/drop', { moved: after[1] === before[0] && after[0] === before[1], audioStartedByDrop: s4.playing })
  }
  console.log('errors', JSON.stringify(errors))
} finally {
  await close()
}
