import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const urls = []
for (const t of tracks) urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview })
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
p.on('console', (m) => console.log('[page]', m.text()))
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/sfxlevels.html')
await p.waitForFunction(() => window.__lv)
const res = await p.evaluate((u) => window.__lv.run(u), urls)
writeFileSync(new URL('./sfx-levels.json', import.meta.url), JSON.stringify(res, null, 1))
console.log('music at unity: integrated LUFS median', res.music.integratedMedian, 'range', res.music.min, '…', res.music.max, 'peaks dBFS', res.music.peaks.join(' '))
console.log('name'.padEnd(14), 'peak', 'L100ms', 'L400ms', 'rel.music(L400-int)', 'bandSNR med', 'p10', 'audible%')
for (const [k, v] of Object.entries(res.sfx)) console.log(k.padEnd(14), String(v.peakDb).padStart(6), String(v.loud100ms).padStart(6), String(v.loud400ms).padStart(6), String((v.loud400ms - res.music.integratedMedian).toFixed(1)).padStart(8), String(v.bestBandSnrMedian).padStart(8), String(v.bestBandSnrP10).padStart(6), Math.round(v.shareAudible * 100) + '%')
await b.close()
