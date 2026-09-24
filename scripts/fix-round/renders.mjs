// Counts how often chosen components actually render (React PerformedWork flag, as React DevTools does)
// while the play screen idles for a few seconds. Usage: node scripts/fix-round/renders.mjs [connected]
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5401/lab/fix-round.html'
const connected = process.argv[2] === 'connected'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => {
  const counts = {}
  window.__renders = counts
  const WATCH = new Set(['SnippetBoard', 'ConfirmDock', 'TransportBar', 'PlayStage', 'PlayHud', 'DndContext', 'SortableContext'])
  const nameOf = (t) => (t && (t.displayName || t.name)) || (t && t.type && (t.type.displayName || t.type.name)) || (t && t.render && (t.render.displayName || t.render.name)) || null
  const walk = (f) => {
    while (f) {
      const n = nameOf(f.type)
      if (n && WATCH.has(n) && (f.alternate === null || (f.flags & 1) === 1)) counts[n] = (counts[n] ?? 0) + 1
      if (f.child) walk(f.child)
      f = f.sibling
    }
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    inject(r) { this.renderers.set(this.renderers.size + 1, r); return this.renderers.size },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) { walk(root.current.child) },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  }
})
await page.goto(`${BASE}?ui=0&bg=css&engine=mock&s=playing${connected ? '&connected=1' : '&live=1'}`)
await page.waitForFunction(() => window.__round)
await page.waitForTimeout(2500)
const before = await page.evaluate(() => ({ ...window.__renders }))
await page.waitForTimeout(4000)
const after = await page.evaluate(() => ({ ...window.__renders }))
const delta = Object.fromEntries(Object.keys(after).map((k) => [k, ((after[k] ?? 0) - (before[k] ?? 0)) / 4]))
console.log(connected ? 'connected' : 'lab', 'renders per second while idle:', JSON.stringify(delta))
await browser.close()
