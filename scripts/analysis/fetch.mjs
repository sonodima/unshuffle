// Resolve the test tracks on Deezer, download their 30 s previews and convert
// them to mono float WAV (afconvert, macOS) for headless benchmarking with bun.
// Usage: node scripts/analysis/fetch.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cache = join(here, 'cache')
const tracks = JSON.parse(readFileSync(join(here, 'tracks.json'), 'utf8'))
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const resolved = []
for (const t of tracks) {
  const r = await fetch('https://api.deezer.com/search?q=' + encodeURIComponent(t.q) + '&limit=15')
  const d = await r.json()
  const list = (d.data ?? []).filter((x) => x.preview && x.readable !== false)
  const bad = /\b(live|acoustic|remix|karaoke|instrumental|cover|version)\b/
  const ok = (x) => norm(x.artist.name).includes(norm(t.artist)) && (!t.title || norm(x.title).includes(t.title))
  const hit = list.find((x) => ok(x) && !bad.test(norm(x.title))) ?? list.find(ok) ?? list[0]
  if (!hit) { console.log('NOT FOUND', t.q); continue }
  const mp3 = join(cache, `${hit.id}.mp3`)
  const wav = join(cache, `${hit.id}.wav`)
  if (!existsSync(mp3)) {
    const a = await fetch(hit.preview)
    writeFileSync(mp3, Buffer.from(await a.arrayBuffer()))
  }
  if (!existsSync(wav)) execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEF32', '-c', '1', mp3, wav])
  resolved.push({ ...t, id: hit.id, title: hit.title, artistName: hit.artist.name })
  console.log(hit.id, '|', hit.artist.name, '–', hit.title)
}
writeFileSync(join(cache, 'resolved.json'), JSON.stringify(resolved, null, 2))
