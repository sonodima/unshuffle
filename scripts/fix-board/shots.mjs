// Board lab screenshots at 390x844@2x and 1440x900 (+360x740 for tight cases).
// TAG=before|after node scripts/fix-board/shots.mjs   → scripts/fix-board/shots/<tag>-*.png
// AUDIO=deezer uses the real Deezer preview (waveforms of a real master).
import { newPage, openLab, sleep, close, SHOTS, center } from './lib.mjs'

const TAG = process.env.TAG ?? 'after'
const AUDIO = process.env.AUDIO ?? 'synth'
const Q = process.env.Q ? `&q=${encodeURIComponent(process.env.Q)}` : ''
const ONLY = process.env.ONLY?.split(',')
const cases = [
  { id: 'p390-n8', kind: 'phone', q: 'n=8' },
  { id: 'p390-n16', kind: 'phone', q: 'n=16' },
  { id: 'p390-n8-marks', kind: 'phone', q: 'n=8&marks=1&locked=1' },
  { id: 'p390-n16-marks', kind: 'phone', q: 'n=16&marks=1&locked=1' },
  { id: 'p360-n12-marks', kind: 'small', q: 'n=12&marks=1&locked=1' },
  { id: 'd1440-n8', kind: 'desktop', q: 'n=8' },
  { id: 'd1440-n6-marks', kind: 'desktop', q: 'n=6&marks=1&locked=1' },
  { id: 'd1440-n16-marks', kind: 'desktop', q: 'n=16&marks=1&locked=1' },
  { id: 'p390-n8-playall', kind: 'phone', q: 'n=8', playAll: true },
  { id: 'p390-n16-playall', kind: 'phone', q: 'n=16', playAll: true },
  { id: 'd1440-n8-playall', kind: 'desktop', q: 'n=8', playAll: true },
  { id: 'p390-n8-press', kind: 'phone', q: 'n=8', press: true },
]
for (const c of cases) {
  if (ONLY && !ONLY.some((o) => c.id.includes(o))) continue
  const { page, cdp, errors } = await newPage(c.kind)
  try {
    await openLab(page, `audio=${AUDIO}&engine=mock&${c.q}${Q}`)
    await sleep(1200)
    if (c.playAll) {
      await page.locator('.tb-play').click()
      await sleep(4600)
    }
    if (c.press) {
      const p = await center(page, 2)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] })
      await sleep(300)
    }
    await page.screenshot({ path: `${SHOTS}${TAG}-${c.id}.png` })
    if (c.press) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    if (errors.length) console.log(c.id, 'errors', errors.filter((e) => !e.includes('404')))
    console.log('shot', `${TAG}-${c.id}.png`)
  } finally {
    await page.context().close()
  }
}
await close()
