// QA: do Deezer previews fade in/out, and does the first/last snippet carry the fade (an order tell)?
import { analyzeAndCut } from '../../src/audio/analysis'
async function run(urls: { label: string; url: string }[]) {
  const dec = new OfflineAudioContext(2, 1, 44100)
  const out: unknown[] = []
  for (const u of urls) {
    try {
      const buf = await dec.decodeAudioData(await (await fetch(u.url)).arrayBuffer())
      const sr = buf.sampleRate
      const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
      const db = (a: number, b: number) => { a = Math.max(0, Math.round(a * sr)); b = Math.min(L.length, Math.round(b * sr)); let s = 0; for (let i = a; i < b; i++) s += (L[i] * L[i] + R[i] * R[i]) / 2; return +(10 * Math.log10(s / Math.max(1, b - a) + 1e-12)).toFixed(1) }
      const d = buf.duration
      const blocks: number[] = []
      for (let t = d - 3; t < d - 0.01; t += 0.25) blocks.push(db(t, t + 0.25))
      const head: number[] = []
      for (let t = 0; t < 1.5; t += 0.25) head.push(db(t, t + 0.25))
      const whole = db(0, d)
      const res: Record<string, unknown> = { label: u.label, dur: +d.toFixed(2), whole, tail3s: blocks, head: head }
      for (const n of [8, 16]) {
        const plan = await analyzeAndCut(buf, n)
        const segs = plan.segments
        const lvl = segs.map((s) => db(s.start, s.end))
        const last = segs[segs.length - 1]
        const lastEnd = db(last.end - 0.5, last.end), lastStart = db(last.start, Math.min(last.end, last.start + 1))
        const first = segs[0]
        res[`n${n}`] = { usable: [+plan.usableStart.toFixed(2), +plan.usableEnd.toFixed(2)], lastEnd: +last.end.toFixed(2), lastDropDb: +(lastEnd - lastStart).toFixed(1), firstStart: +first.start.toFixed(2), segDb: lvl, spreadDb: +(Math.max(...lvl) - Math.min(...lvl)).toFixed(1) }
      }
      out.push(res)
    } catch (e) { out.push({ label: u.label, error: String(e) }) }
  }
  return out
}
;(window as unknown as { __fade: unknown }).__fade = { run }
