import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const urls = []
for (const t of tracks) urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview })
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
await p.waitForFunction(() => window.__pre)
const res = await p.evaluate((u) => window.__pre.run(u), urls)
const all = res.flatMap((r) => r.preroll)
const lt = (v) => all.filter((x) => x < v).length
console.log('cuts', all.length, 'preroll ms: <0', lt(0), '<4', lt(4), '<8', lt(8), '<12', lt(12), '<16', lt(16), 'median', all.sort((a, b) => a - b)[all.length >> 1])
for (const r of res) console.log(r.label.slice(0, 30).padEnd(30), 'n' + r.n, r.preroll.join(' '))
await b.close()
