// Build a stereo 16-bit WAV corpus (afconvert, macOS) for the headless analysis bench:
// the 42 previews cached by scripts/analysis + the 25 QA tracks (scripts/qa-audio/tracks.json).
// Usage: node scripts/fix-analysis/fetch-corpus.mjs <outDir>
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2]
if (!out) throw new Error('outDir?')
const list = []
const resolved = JSON.parse(readFileSync(join(here, '../analysis/cache/resolved.json'), 'utf8'))
for (const t of resolved) list.push({ id: t.id, label: t.label, bpm: t.bpm ?? 0, src: 'analysis' })
const qa = JSON.parse(readFileSync(join(here, '../qa-audio/tracks.json'), 'utf8'))
for (const t of qa) if (!list.some((x) => x.id === t.id)) list.push({ id: t.id, label: t.label, bpm: 0, src: 'qa' })
const ok = []
for (const t of list) {
  const mp3 = join(out, `${t.id}.mp3`)
  const wav = join(out, `${t.id}.wav`)
  try {
    if (!existsSync(mp3)) {
      const cached = join(here, '../analysis/cache', `${t.id}.mp3`)
      if (existsSync(cached)) copyFileSync(cached, mp3)
      else {
        const info = await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()
        if (!info.preview) throw new Error('no preview')
        const a = await fetch(info.preview)
        writeFileSync(mp3, Buffer.from(await a.arrayBuffer()))
      }
    }
    if (!existsSync(wav)) execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', '-c', '2', mp3, wav])
    ok.push(t)
    console.log('ok', t.id, t.label)
  } catch (e) {
    console.log('FAIL', t.id, t.label, e.message)
  }
}
writeFileSync(join(out, 'corpus.json'), JSON.stringify(ok, null, 1))
