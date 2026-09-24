// Finding 3: waveforms of real Deezer masters (lab board), phone + desktop.
// TAG=... Q='a|b' node scripts/fix-board/waves.mjs
import { newPage, openLab, sleep, close, SHOTS } from './lib.mjs'
const TAG = process.env.TAG ?? 'after'
const QS = (process.env.Q ?? 'she will be loved maroon|titanium guetta sia|daft punk harder better faster stronger').split('|')
const cases = (process.env.CASES ?? 'phone:8,phone:16,desktop:8,desktop:16').split(',').map((c) => c.split(':'))
for (const q of QS) {
  for (const [kind, n] of cases) {
    const { page, errors } = await newPage(kind)
    await openLab(page, `audio=deezer&engine=mock&n=${n}&ui=0&q=${encodeURIComponent(q)}`)
    await sleep(900)
    const slug = q.split(' ').slice(0, 2).join('-')
    await page.locator('.sb-grid').screenshot({ path: `${SHOTS}${TAG}-wave-${slug}-${kind}-n${n}.png` })
    const errs = errors.filter((e) => !e.includes('404'))
    if (errs.length) console.log(q, kind, n, errs)
    await page.context().close()
  }
}
await close()
console.log('done')
