// Minimal sourcemap lookup: (chunk file, line0, col0) -> original source + line + name-less.
import { readFileSync, existsSync } from 'node:fs'
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const lut = {}; for (let i = 0; i < 64; i++) lut[B64[i]] = i
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const p = new URL('./dist/assets/' + file + '.map', import.meta.url).pathname
  if (!existsSync(p)) { cache.set(file, null); return null }
  const map = JSON.parse(readFileSync(p, 'utf8'))
  const lines = []
  let src = 0, ol = 0, oc = 0, nm = 0
  for (const l of map.mappings.split(';')) {
    const segs = []; let col = 0; let i = 0
    while (i < l.length) {
      const seg = []
      while (i < l.length && l[i] !== ',') { let v = 0, sh = 0, c; do { c = lut[l[i++]]; v += (c & 31) << sh; sh += 5 } while (c & 32); seg.push(v & 1 ? -(v >>> 1) : v >>> 1) }
      i++
      col += seg[0]
      if (seg.length >= 4) { src += seg[1]; ol += seg[2]; oc += seg[3]; if (seg.length >= 5) nm += seg[4]; segs.push([col, src, ol, oc, seg.length >= 5 ? nm : -1]) }
      else segs.push([col, -1, 0, 0, -1])
    }
    lines.push(segs)
  }
  const r = { map, lines }
  cache.set(file, r); return r
}
export function lookup(file, line, col) {
  const m = load(file)
  if (!m) return null
  const segs = m.lines[line]
  if (!segs || !segs.length) return null
  let lo = 0, hi = segs.length - 1, best = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (segs[mid][0] <= col) { best = mid; lo = mid + 1 } else hi = mid - 1 }
  if (best < 0) return null
  const s = segs[best]
  if (s[1] < 0) return null
  return { source: m.map.sources[s[1]].replace(/^.*node_modules\//, 'nm:').replace(/^.*\/src\//, 'src/'), line: s[2] + 1, name: s[4] >= 0 ? m.map.names[s[4]] : null }
}
