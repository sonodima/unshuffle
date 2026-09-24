// Compare two bench outputs: node scripts/fix-analysis/compare.mjs out/a.json out/b.json [--list]
import { readFileSync } from 'node:fs'
const [a, b] = process.argv.slice(2, 4).map((f) => JSON.parse(readFileSync(f, 'utf8')))
const key = (r) => `${r.id}|${r.n}`
const mb = new Map(b.map((r) => [key(r), r]))
let same = 0, diff = 0
const list = process.argv.includes('--list')
for (const r of a) {
  const q = mb.get(key(r))
  if (!q) continue
  const eq = JSON.stringify(r.cuts) === JSON.stringify(q.cuts)
  if (eq) same++
  else {
    diff++
    if (list) console.log(r.label.slice(0, 28).padEnd(28), String(r.n).padStart(2), r.ratio.toFixed(2), '→', q.ratio.toFixed(2), `db ${(r.onDown * 100).toFixed(0)}→${(q.onDown * 100).toFixed(0)}`, `thr ${r.through}→${q.through}`, r.lens, '→', q.lens)
  }
}
console.log(`identical ${same}, changed ${diff}`)
