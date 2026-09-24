// Lab "Rivela": marks on the player's order, then the slide into the correct order.
import { newPage, openLab, sleep, close, SHOTS } from './lib.mjs'
const TAG = process.env.TAG ?? 'after'
for (const [kind, n] of [['phone', 8], ['phone', 12], ['desktop', 8]]) {
  const { page } = await newPage(kind)
  await openLab(page, `audio=${process.env.AUDIO ?? 'synth'}&engine=mock&n=${n}`)
  // two correct positions so both mark colours show
  await page.evaluate(() => {
    const o = window.__lab.order().slice()
    for (const want of [0, 3]) {
      const at = o.indexOf(want)
      ;[o[at], o[want]] = [o[want], o[at]]
    }
    window.__lab.setOrder(o)
  })
  await sleep(900)
  await page.getByText('Rivela').click()
  await sleep(1300)
  await page.screenshot({ path: `${SHOTS}${TAG}-reveal-marks-${kind}-n${n}.png` })
  await sleep(2600)
  await page.screenshot({ path: `${SHOTS}${TAG}-reveal-done-${kind}-n${n}.png` })
  await page.context().close()
}
await close()
