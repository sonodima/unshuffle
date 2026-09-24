// Activation distance per pointer type: mouse drags after 4px, touch only after 10px.
import { newPage, openLab, center, sleep, close, pt } from './lib.mjs'
const dragging = (page) => page.evaluate(() => !!document.querySelector('.sb-board[data-dragging]'))
{
  const { page } = await newPage('desktop')
  await openLab(page, 'audio=synth&engine=mock&n=8&ui=0')
  const c = await center(page, 1)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x + 6, c.y, { steps: 3 })
  await sleep(150)
  console.log('mouse 6px → dragging', await dragging(page))
  await page.mouse.up()
  await page.context().close()
}
{
  const { page, cdp } = await newPage('phone')
  await openLab(page, 'audio=synth&engine=mock&n=8&ui=0')
  const c = await center(page, 1)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.x, c.y) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(c.x + 8, c.y) })
  await sleep(150)
  const d8 = await dragging(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(c.x + 14, c.y) })
  await sleep(150)
  console.log('touch 8px → dragging', d8, '| 14px → dragging', await dragging(page))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.context().close()
}
await close()
