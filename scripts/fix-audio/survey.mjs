// Loudness survey (before/after normalisation), limiter transparency and SFX audibility over the 25 QA previews.
// usage: node scripts/fix-audio/survey.mjs [--sfx] [--raw]
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const args = new Set(process.argv.slice(2))
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const urls = []
for (const t of tracks) {
  const j = await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()
  if (j.preview) urls.push({ label: t.label, url: j.preview })
}
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()) })
p.on('pageerror', (e) => console.log('[pageerror]', e.message))
await p.goto(`${BASE}/lab/fix-audio.html`)
await p.waitForFunction(() => window.__fixAudio?.ready)
const sv = await p.evaluate((u) => window.__fixAudio.survey(u), urls)
console.log('sampleRate', sv.sampleRate)
for (const r of sv.rows) console.log(r.label.padEnd(38), r.error ?? `LUFS ${String(r.lufs).padStart(6)} peak ${String(r.peakDb).padStart(5)} → trim ${String(r.gainDb).padStart(6)} dB → ${String(r.afterLufs).padStart(6)} LUFS peak ${String(r.afterPeakDb).padStart(5)}   (cpu ${r.measureCpuMs} ms, load ${r.loadMs} ms)`)
console.log('before', JSON.stringify(sv.before), '\nafter ', JSON.stringify(sv.after), '\npeaks after', JSON.stringify(sv.peaksAfter), 'tracks with peak > 0 dBFS after:', sv.over0After)
writeFileSync(new URL('./survey-out.json', import.meta.url), JSON.stringify(sv, null, 1))
const lim = await p.evaluate(() => window.__fixAudio.limiter())
console.log('\nlimiter (threshold -1, ratio 20, knee 0):')
for (const r of lim) console.log(`  in ${String(r.inDb).padStart(5)} dBFS → out peak ${String(r.outPeakDb).padStart(6)} (gain ${r.gainDb}) first-50ms peak ${r.firstMsPeakDb} distortion ${r.distortionDb} dB`)
if (args.has('--sfx')) {
  const flows = JSON.parse(process.env.FLOWS ?? 'null') ?? [
    ...['click', 'hover', 'pickup', 'drop', 'swap', 'tick', 'tickUrgent', 'go', 'submit', 'alarm', 'correct', 'wrong', 'score', 'fanfare', 'join', 'leave', 'pop'].map((n) => [n, {}]),
    ['tick', { gain: 0.6 }], ['tickUrgent', { gain: 0.6 }], ['score', { gain: 0.7, pitch: 0.85 }], ['score', { gain: 0.7, pitch: 1.2 }], ['score', { gain: 0.7, pitch: 1.55 }],
    ['correct', { gain: 0.9 }], ['wrong', { gain: 0.85 }], ['tick', {}, 1.5], ['tickUrgent', {}, 2.5],
  ]
  const tab = await p.evaluate(({ f, norm }) => window.__fixAudio.sfxTable(f, { normalized: norm }), { f: flows, norm: !args.has('--raw') })
  const med = args.has('--raw') ? sv.before.median : sv.after.median
  console.log(`\nSFX vs ${args.has('--raw') ? 'RAW' : 'NORMALISED'} music (integrated median ${med} LUFS)`)
  console.log('name'.padEnd(24), 'peak'.padStart(6), 'L100'.padStart(6), 'L400'.padStart(6), 'L100-mus'.padStart(9), 'snrMed'.padStart(7), 'p10'.padStart(6), 'aud%'.padStart(5), '2-5k'.padStart(5), '<1k5'.padStart(5), 'band')
  for (const [k, v] of Object.entries(tab)) console.log(k.padEnd(24), String(v.peakDb).padStart(6), String(v.loud100ms).padStart(6), String(v.loud400ms).padStart(6), String((v.loud100ms - med).toFixed(1)).padStart(9), String(v.snrMedian).padStart(7), String(v.snrP10).padStart(6), String(Math.round(v.shareAudible * 100)).padStart(5), String(v.share2to5k).padStart(5), String(v.shareBelow1k5).padStart(5), v.topBandHz)
  writeFileSync(new URL(`./sfx-${args.has('--raw') ? 'raw' : 'norm'}${process.env.TAG ? '-' + process.env.TAG : ''}.json`, import.meta.url), JSON.stringify(tab, null, 1))
}
await b.close()
