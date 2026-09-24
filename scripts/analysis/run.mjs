// Drives lab/analysis.html in headless Chrome on real Deezer previews, prints a
// results table, saves results.json and screenshots of the visual report.
// Usage: node scripts/analysis/run.mjs [--only=substring] [--shots=0,2,5] [--sr=48000] [--headed]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const PORT = 5203
const BASE = `http://localhost:${PORT}`
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const only = arg('only')
const sr = arg('sr')
const shotList = (arg('shots') ?? 'all').split(',')

async function up() {
  try {
    const r = await fetch(`${BASE}/lab/analysis.html`)
    return r.ok
  } catch {
    return false
  }
}

let server = null
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    env: { ...process.env, UNSHUFFLE_VITE_CACHE: 'node_modules/.vite-analysis' },
    stdio: 'ignore',
  })
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}

const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed') })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('pageerror:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()) })
const qs = new URLSearchParams()
if (only) qs.set('only', only)
if (sr) qs.set('sr', sr)
await page.goto(`${BASE}/lab/analysis.html?${qs}`)
await page.waitForFunction(() => window.__analysis?.done === true, null, { timeout: 15 * 60_000, polling: 1000 })
const results = await page.evaluate(() =>
  window.__analysis.results.map((r) => ({
    ...r,
    cuts: r.cuts.map(({ plan, ...c }) => ({ ...c, bpm: plan.bpm, method: plan.method, segments: plan.segments, downbeats: plan.downbeats.length, beats: plan.beats.length })),
  })),
)
writeFileSync(join(here, 'results.json'), JSON.stringify(results, null, 2))

const pad = (s, n) => String(s).slice(0, n).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
console.log(pad('track', 38), lpad('ref', 6), lpad('bpm', 7), pad(' verdict', 9), lpad('conf', 5), pad(' method', 10), pad('downbeat% n6/8/12/16', 22), pad('attack×mean', 20), pad('beats/segment n8', 28), 'worker ms')
let ok = 0, alt = 0, refs = 0, allMs = []
for (const r of results) {
  if (r.error) { console.log(pad(r.label, 38), 'ERROR', r.error); continue }
  if (r.refBpm) { refs++; if (r.verdict === 'ok') ok++; if (r.verdict === 'alt') alt++ }
  const c8 = r.cuts.find((c) => c.n === 8)
  allMs.push(...r.cuts.map((c) => c.workerMs))
  console.log(
    pad(r.label, 38), lpad(r.refBpm || '-', 6), lpad(r.bpm.toFixed(1), 7), pad(' ' + r.verdict, 9), lpad(r.confidence.toFixed(2), 5), pad(' ' + r.method, 10),
    pad(r.cuts.map((c) => Math.round(c.downbeatPct * 100)).join('/'), 22),
    pad(r.cuts.map((c) => c.cutStrength.toFixed(1)).join('/'), 20),
    pad(c8 ? c8.segments.map((s) => (r.method === 'beat-grid' ? s.beats : (s.end - s.start).toFixed(1))).join(' ') : '-', 28),
    r.cuts.map((c) => Math.round(c.workerMs)).join('/'),
    r.cuts.every((c) => c.deterministic) ? '' : ' NONDETERMINISTIC',
    process.argv.includes('--timings') ? ` sync ${r.syncMs?.join('/')} ${JSON.stringify(Object.fromEntries(Object.entries(r.stageMs ?? {}).map(([k, v]) => [k, Math.round(v)])))}` : '',
  )
}
allMs.sort((a, b) => a - b)
console.log(`\nBPM exact ${ok}/${refs}, acceptable half/double ${alt}; worker median ${Math.round(allMs[allMs.length >> 1])} ms, max ${Math.round(allMs[allMs.length - 1])} ms`)

mkdirSync(join(here, 'shots'), { recursive: true })
const cards = await page.$$('section.card')
for (let i = 0; i < cards.length; i++) {
  if (shotList[0] !== 'all' && !shotList.includes(String(i))) continue
  const slug = results[i].label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  await cards[i].screenshot({ path: join(here, 'shots', `${String(i).padStart(2, '0')}-${slug}.png`) })
}
await page.screenshot({ path: join(here, 'shots', 'summary.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } })
await browser.close()
server?.kill()
