import { analyzeSync } from '../../src/audio/analysis/pipeline'
async function run(urls: { label: string; url: string }[]) {
  const dec = new OfflineAudioContext(1, 1, 44100)
  const out: { label: string; n: number; preroll: number[]; strongPreroll: number[] }[] = []
  for (const u of urls) {
    let buf: AudioBuffer
    try { buf = await dec.decodeAudioData(await (await fetch(u.url)).arrayBuffer()) } catch (e) { console.error("decode failed", u.label, String(e)); continue }
    const x = buf.getChannelData(0).slice()
    for (const n of [8, 16]) {
      const r = analyzeSync({ samples: x, sampleRate: buf.sampleRate, n }, true)
      const cuts = r.plan.segments.slice(1).map((s) => s.start)
      const att = r.debug!.attacks.slice(1, -1)
      const pre = cuts.map((c, i) => +((att[i] - c) * 1000).toFixed(1))
      out.push({ label: u.label, n, preroll: pre, strongPreroll: [] })
    }
  }
  return out
}
;(window as unknown as { __pre: unknown }).__pre = { run }
