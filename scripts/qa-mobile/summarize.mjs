// Summarize sweep JSON: flagged layout issues per state × viewport.
import { readFileSync } from 'node:fs'
const file = process.argv[2]
const r = JSON.parse(readFileSync(file, 'utf8'))
const only = process.argv[3]
for (const e of r) {
  if (e.state === '_audio') { console.log(e.vp, 'audio', JSON.stringify(e.audio)); continue }
  if (e.failed) { console.log(e.vp, e.state, 'FAILED', e.failed); continue }
  for (const k of ['top', 'mid', 'bottom']) {
    const m = e[k]
    if (!m) continue
    const parts = []
    if (m.docOverflowX > 0) parts.push(`docOverflowX=${m.docOverflowX}`)
    if (m.offscreen.length) parts.push(`offscreen=${m.offscreen.map((o) => `${o.el}[${o.left},${o.right}]`).slice(0, 3).join(' | ')}`)
    if (m.textSpill.length) parts.push(`spill=${m.textSpill.map((o) => `${o.el}(${o.sw}>${o.cw})`).slice(0, 3).join(' | ')}`)
    if (m.soundOverlap.length) parts.push(`sound@${m.sound?.x},${m.sound?.y} over ${m.soundOverlap.slice(0, 3).join(' | ')}`)
    if (only === 'cta' && m.cta) parts.push(`cta=${JSON.stringify(m.cta)}`)
    if (only === 'small' && m.smallTargets.length) parts.push(`small=${m.smallTargets.map((s) => `${s.el}${s.w}x${s.h}`).slice(0, 5).join(' | ')}`)
    if (parts.length) console.log(`${e.vp.padEnd(9)} ${e.state.padEnd(22)} ${k.padEnd(6)} ${parts.join('  ##  ')}`)
  }
  if (e.errors?.length) console.log(e.vp, e.state, 'ERRORS', e.errors.slice(0, 3))
}
