// Interaction tests for the snippet board lab. Usage: node scripts/board/interact.mjs
import { chromium } from 'playwright'
const BASE = 'http://localhost:5202/lab/board.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
let failures = 0
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`)
  if (!cond) failures++
}
const arrayMove = (a, f, t) => {
  const r = a.slice()
  r.splice(t, 0, r.splice(f, 1)[0])
  return r
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function open(device, qs) {
  const opts =
    device === 'phone'
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } }
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => {
    console.log('PAGEERROR', e.message)
    failures++
  })
  await page.goto(`${BASE}?${qs}`)
  await page.waitForFunction(() => window.__lab && window.__lab.ready(), null, { timeout: 20000 })
  await page.waitForTimeout(300)
  return { ctx, page }
}
const order = (page) => page.evaluate(() => window.__lab.order())
const state = (page) => page.evaluate(() => window.__lab.engine.getState())
const center = async (page, pos) => {
  const b = await page.locator(`.sb-item[data-pos="${pos}"]`).boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function mouseDrag(page, from, to, steps = 14) {
  const a = await center(page, from)
  const b = await center(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(450)
}

async function touchDrag(page, from, to, steps = 16) {
  const cdp = await page.context().newCDPSession(page)
  const a = await center(page, from)
  const b = await center(page, to)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps),
    })
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(120)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(450)
  return cdp
}

// ---------------- desktop ----------------
{
  const { ctx, page } = await open('desktop', 'n=8&audio=synth&ui=0')
  const o0 = await order(page)
  await mouseDrag(page, 0, 3)
  const o1 = await order(page)
  ok(eq(o1, arrayMove(o0, 0, 3)), `desktop mouse drag 0→3: ${o0} → ${o1}`)
  const sfx = await page.evaluate(() => window.__lab.sfx.slice())
  ok(sfx.includes('pickup') && sfx.includes('drop') && sfx.includes('swap'), `sfx during drag: ${sfx.join(',')}`)
  const domOrder = await page.$$eval('.sb-item', (els) => els.map((e) => Number(e.dataset.seg)))
  ok(eq(domOrder, o1), 'DOM order matches state')

  // drag across rows
  await mouseDrag(page, 6, 1)
  const o2 = await order(page)
  ok(eq(o2, arrayMove(o1, 6, 1)), `desktop mouse drag 6→1 (row up): ${o2}`)

  // tap plays / tap again stops
  const seg = o2[2]
  await page.locator('.sb-item[data-pos="2"]').click()
  await page.waitForTimeout(250)
  let s = await state(page)
  ok(s.playing && s.tag === `block:${seg}`, `click plays single block: ${JSON.stringify(s)}`)
  const playingAttr = await page.locator('.sb-item[data-pos="2"] .sb-block').getAttribute('data-playing')
  ok(playingAttr !== null, 'playing block marked')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}i-desktop-playing.png` })
  await page.locator('.sb-item[data-pos="2"]').click()
  await page.waitForTimeout(200)
  s = await state(page)
  ok(!s.playing, 'second click stops')
  ok(eq(await order(page), o2), 'clicks did not reorder')

  // keyboard: focus pos 2, space, right, space
  await page.locator('.sb-item[data-pos="2"]').focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(250)
  await page.keyboard.press('Space')
  await page.waitForTimeout(450)
  const o3 = await order(page)
  ok(eq(o3, arrayMove(o2, 2, 3)), `keyboard move 2→3: ${o3}`)
  s = await state(page)
  ok(!s.playing || s.tag !== 'board', 'space on block did not trigger play-all')
  const focused = await page.evaluate(() => document.activeElement?.dataset?.seg)
  ok(Number(focused) === o2[2], `focus stays on moved block (${focused})`)
  // keyboard down (row change)
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  await page.keyboard.press('Space')
  await page.waitForTimeout(450)
  const o4 = await order(page)
  ok(eq(o4, arrayMove(o3, 3, 7)), `keyboard move 3→7 (down): ${o4}`)
  // Enter plays
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  s = await state(page)
  ok(s.playing && s.tag === `block:${o4[7]}`, `Enter plays focused block: ${s.tag}`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  ok(!(await state(page)).playing, 'Enter again stops')

  // Space hotkey with focus on body → play all
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  s = await state(page)
  ok(s.playing && s.tag === 'board' && s.mode === 'sequence', `space → play all: ${JSON.stringify(s)}`)
  const lit = await page.$$eval('.sb-block[data-playing]', (els) => els.length)
  ok(lit === 1, `exactly one block lit during play-all (${lit})`)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}i-desktop-playall.png` })
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  ok(!(await state(page)).playing, 'space again stops')

  // programmatic reorder (reveal) animates without errors
  await page.evaluate(() => window.__lab.setOrder(window.__lab.order().map((_, i) => i)))
  await page.waitForTimeout(260)
  await page.screenshot({ path: `${OUT}i-desktop-reveal-mid.png` })
  await page.waitForTimeout(900)
  const o5 = await order(page)
  ok(eq(o5, [0, 1, 2, 3, 4, 5, 6, 7]), 'programmatic order applied')
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => !a.animationName).length)
  ok(anims === 0, `FLIP animations finished (${anims})`)
  await ctx.close()
}

// ---------------- lock while dragging cancels ----------------
{
  const { ctx, page } = await open('desktop', 'n=8&audio=synth&ui=0')
  const o0 = await order(page)
  const a = await center(page, 0)
  const b = await center(page, 3)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10)
    await page.waitForTimeout(16)
  }
  await page.evaluate(() => window.__lab.setLocked(true))
  await page.waitForTimeout(400)
  await page.mouse.up()
  await page.waitForTimeout(400)
  ok(eq(await order(page), o0), 'locking mid-drag cancels the drop')
  const overlays = await page.$$eval('.sb-overlay .sb-block', (els) => els.length)
  ok(overlays === 0, 'no overlay left behind')
  // mouse click does not steal focus (Space stays play-all)
  await page.evaluate(() => window.__lab.setLocked(false))
  await page.locator('.sb-item[data-pos="1"]').click()
  await page.waitForTimeout(150)
  const focusedBlock = await page.evaluate(() => !!document.activeElement?.closest('[data-snippet-block]'))
  ok(!focusedBlock, 'mouse click does not focus the block')
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  const s = await state(page)
  ok(s.playing && s.tag === 'board', `space after clicking a block plays all (${s.tag})`)
  await ctx.close()
}

// ---------------- locked ----------------
{
  const { ctx, page } = await open('desktop', 'n=8&audio=synth&ui=0&locked=1')
  const o0 = await order(page)
  await mouseDrag(page, 0, 3)
  ok(eq(await order(page), o0), 'locked: drag does nothing')
  await page.locator('.sb-item[data-pos="1"]').click()
  await page.waitForTimeout(200)
  ok((await state(page)).playing, 'locked: tap still plays')
  await ctx.close()
}

// ---------------- phone (touch) ----------------
{
  const { ctx, page } = await open('phone', 'n=8&audio=synth&ui=0')
  const o0 = await order(page)
  const cdp = await touchDrag(page, 0, 5)
  const o1 = await order(page)
  ok(eq(o1, arrayMove(o0, 0, 5)), `touch drag 0→5: ${o0} → ${o1}`)
  const scrollY = await page.evaluate(() => window.scrollY + document.scrollingElement.scrollTop)
  ok(scrollY === 0, `no page scroll during touch drag (${scrollY})`)
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)
  ok(overflow, 'no vertical page overflow on phone')
  const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ok(hOverflow, 'no horizontal overflow on phone')
  // tap to play
  const c = await center(page, 3)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 2 }] })
  await page.waitForTimeout(60)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(350)
  const s = await state(page)
  ok(s.playing && s.tag === `block:${o1[3]}`, `touch tap plays: ${s.tag}`)
  ok(eq(await order(page), o1), 'tap did not reorder')
  // a mid-drag screenshot on phone
  const a = await center(page, 1)
  const b = await center(page, 4)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 3 }] })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10, id: 3 }],
    })
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${OUT}i-phone-touchdrag.png` })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(450)
  ok(eq(await order(page), arrayMove(o1, 1, 4)), 'second touch drag 1→4')
  await ctx.close()
}

// ---------------- 16 on phone ----------------
{
  const { ctx, page } = await open('phone', 'n=16&audio=synth&ui=0')
  const o0 = await order(page)
  await touchDrag(page, 15, 0)
  ok(eq(await order(page), arrayMove(o0, 15, 0)), 'n=16 touch drag 15→0')
  await ctx.close()
}

await browser.close()
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS')
process.exit(failures ? 1 : 0)
