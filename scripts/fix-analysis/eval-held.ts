// Re-score stored bench outputs with the vocal proxies (bun):
//   bun run scripts/fix-analysis/eval-held.ts <corpusDir> out/a.json [out/b.json …]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readWav } from '../analysis/wav'
import { heldThrough, through, vocalProxy } from './vocalProxy'
import type { Proxy } from './vocalProxy'

const [dir, ...files] = process.argv.slice(2)
const corpus: { id: number; label: string }[] = JSON.parse(readFileSync(join(dir, 'corpus.json'), 'utf8'))
const proxies = new Map<number, Proxy>()
for (const t of corpus) {
  const w = readWav(join(dir, `${t.id}.wav`))
  proxies.set(t.id, vocalProxy(w.channels[0], w.channels[1] ?? w.channels[0], w.sampleRate, join(dir, `${t.id}.vproxy`), true))
}
for (const f of files) {
  const rows: { id: number; n: number; cuts: number[] }[] = JSON.parse(readFileSync(f, 'utf8'))
  const line: string[] = []
  for (const n of [6, 8, 12, 16]) {
    let thr = 0, held = 0, of = 0
    for (const r of rows.filter((r) => r.n === n)) {
      const p = proxies.get(r.id)!
      for (const c of r.cuts.slice(1, -1)) {
        of++
        if (through(p, c)) thr++
        if (heldThrough(p, c)) held++
      }
    }
    line.push(`n${n} thr ${((100 * thr) / of).toFixed(0)}% held ${((100 * held) / of).toFixed(1)}%`)
  }
  console.log(f.padEnd(40), line.join(' | '))
}
