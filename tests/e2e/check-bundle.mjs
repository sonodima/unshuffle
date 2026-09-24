// Guards the production bundle (run after `npm run build`, no server needed):
//   node tests/e2e/check-bundle.mjs
// dist/ has a single HTML entry point, no test code (tests/**) is bundled, the
// analysis worker is emitted as its own chunk and referenced, and index.html uses
// relative asset URLs (base './'), so the build works from any sub-path.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = new URL('../../dist/', import.meta.url).pathname
const problems = []
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else files.push(p.slice(DIST.length))
  }
})(DIST)

const html = files.filter((f) => f.endsWith('.html'))
if (html.join() !== 'index.html') problems.push(`unexpected HTML entry points: ${html.join(', ')}`)

let sources = 0
for (const f of files.filter((f) => f.endsWith('.js.map'))) {
  const map = JSON.parse(readFileSync(join(DIST, f), 'utf8'))
  sources += map.sources.length
  for (const s of map.sources) if (/(^|\/)tests\//.test(s)) problems.push(`${f} bundles test source ${s}`)
}

const worker = files.find((f) => /^assets\/worker-[\w-]+\.js$/.test(f))
if (!worker) problems.push('no analysis worker chunk in dist/assets')
else {
  const name = worker.slice('assets/'.length)
  const refs = files.filter((f) => f.endsWith('.js') && readFileSync(join(DIST, f), 'utf8').includes(name))
  if (refs.length === 0) problems.push(`nothing references ${name}`)
}
const idx = readFileSync(join(DIST, 'index.html'), 'utf8')
if (/(src|href)="\/(?!\/)/.test(idx)) problems.push('index.html has root-absolute asset URLs (base must be ./)')

console.log(`${files.length} files, ${sources} bundled sources, worker: ${worker ?? '—'}`)
console.log(problems.length ? problems.join('\n') : 'bundle OK: one entry point, no test code, relative URLs, separate worker chunk')
process.exit(problems.length ? 1 : 0)
