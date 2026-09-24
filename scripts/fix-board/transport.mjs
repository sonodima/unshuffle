// Findings 6/7/9: transport label never truncated, pill hit areas, per-frame writes.
import { newPage, openLab, sleep, close } from './lib.mjs'

for (const [kind, n] of [
  ['small', 16],
  ['phone', 8],
  ['phone', 16],
  ['desktop', 8],
  ['desktop', 16],
]) {
  const { page, errors } = await newPage(kind)
  await openLab(page, `audio=synth&engine=mock&n=${n}&ui=0`)
  const idle = await page.evaluate(() => {
    const l = document.querySelector('.tb-label')
    return { label: l.innerText, truncated: l.scrollWidth > l.clientWidth + 0.5 }
  })
  // count DOM writes per second during play-all
  await page.locator('.tb-play').click()
  await sleep(600)
  const m = await page.evaluate(async () => {
    const tb = document.querySelector('.tb')
    let writes = 0
    const mo = new MutationObserver((recs) => (writes += recs.length))
    mo.observe(tb, { subtree: true, attributes: true, childList: true, characterData: true })
    await new Promise((r) => setTimeout(r, 1000))
    mo.disconnect()
    const l = document.querySelector('.tb-label')
    const cells = [...document.querySelectorAll('.tb-cell')].map((c) => c.getBoundingClientRect())
    const map = document.querySelector('.tb-map').getBoundingClientRect()
    const tbr = tb.getBoundingClientRect()
    return {
      label: l.innerText,
      truncated: l.scrollWidth > l.clientWidth + 0.5,
      cell: `${Math.round(cells[0].width)}x${Math.round(cells[0].height)}`,
      mapH: Math.round(map.height),
      cellsInsideBar: cells.every((c) => c.top >= tbr.top - 0.5 && c.bottom <= tbr.bottom + 0.5),
      gapsBetweenCells: cells.slice(1).map((c, i) => Math.round(c.left - cells[i].right)).filter((g) => g > 0).length,
      domWritesPerSec: writes,
    }
  })
  // tapping between two pills still hits one of them
  const hit = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.tb-cell')]
    const a = cs[2].getBoundingClientRect()
    const el = document.elementFromPoint(a.right - 0.5, a.top + 3)
    return el?.closest('.tb-cell') ? 'cell' : el?.className
  })
  await page.locator('.tb-play').click()
  console.log(`${kind} n=${n}`.padEnd(14), JSON.stringify({ idle, playing: m, edgeHit: hit, errors: errors.filter((e) => !e.includes('404')) }))
  await page.context().close()
}
await close()
