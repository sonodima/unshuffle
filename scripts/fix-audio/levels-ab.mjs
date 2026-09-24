// Shader levels with loudness normalisation off vs on, for loud / median / quiet masters.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { labEval } from './lib.mjs'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const pick = ['Annalisa', 'Måneskin', 'Mahmood', 'Metallica', 'Brubeck', 'Miles', 'Eagles', 'Pendulum']
const urls = []
for (const n of pick) { const t = tracks.find((x) => x.label.includes(n)); urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview }) }
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
const rows = await labEval(p, `${BASE}/lab/fix-audio.html`, (u) => window.__fixAudio.levelsAB(u), urls)
for (const r of rows) console.log(r.label.padEnd(38), `trim ${String(r.trimDb).padStart(6)} | raw E ${r.raw.energyMean}/${r.raw.energyP90} B ${r.raw.bassMean}/${r.raw.bassP90} beats/s ${r.raw.beatsPerS} | norm E ${r.norm.energyMean}/${r.norm.energyP90} B ${r.norm.bassMean}/${r.norm.bassP90} beats/s ${r.norm.beatsPerS}`)
await b.close()
