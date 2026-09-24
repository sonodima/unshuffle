// Cost of the track-wide level pass (first Waveform of a track) at 1x and 4x CPU.
import { newPage, openLab, close } from './lib.mjs'
const { page, cdp } = await newPage('phone')
await openLab(page, 'audio=deezer&engine=mock&n=16&ui=0')
for (const rate of [1, 4]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  const r = await page.evaluate(async () => {
    const { trackLevels } = await import('/src/components/board/waveLevels.ts')
    const { computePeaks } = await import('/src/audio/peaks.ts')
    const buf = window.__lab.engine.get(window.__lab.trackKey())
    // fresh copy so neither cache is warm
    const copy = new AudioBuffer({ length: buf.length, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels })
    for (let c = 0; c < buf.numberOfChannels; c++) copy.copyToChannel(buf.getChannelData(c), c)
    const fn = (b, s, e, n) => computePeaks(b, s, e, n)
    const t0 = performance.now()
    const lv = trackLevels(copy, 0.06, fn)
    const t1 = performance.now()
    for (const bs of [0.03, 0.05, 0.08, 0.12, 0.2, 0.3]) trackLevels(copy, bs, fn)
    const t2 = performance.now()
    const blocks = performance.now()
    for (let i = 0; i < 16; i++) computePeaks(copy, i * 1.8, i * 1.8 + 1.8, 30)
    const t3 = performance.now()
    return { firstPassMs: +(t1 - t0).toFixed(1), sixMoreFactorsMs: +(t2 - t1).toFixed(1), sixteenBlockPeaksMs: +(t3 - blocks).toFixed(1), lv }
  })
  console.log(`cpu x${rate}`, JSON.stringify(r))
}
await close()
