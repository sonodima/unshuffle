// Mini flip animated via rAF inline-style updates (like motion), WebKit vs Chromium.
import { webkit, chromium, devices } from 'playwright'
import { OUT, sleep } from './lib.mjs'
const MINI = `<!doctype html><html><body style="margin:0;background:#222">
<style>
.flip{perspective:900px;width:120px;height:120px;position:absolute;left:20px;top:20px}
.inner{position:relative;width:100%;height:100%;transform-style:preserve-3d}
.face{position:absolute;inset:0;border-radius:16px;-webkit-backface-visibility:hidden;backface-visibility:hidden}
.front{background:#0c0;font:bold 60px sans-serif;display:grid;place-items:center}
.back{background:#c0c;transform:rotateY(180deg);overflow:hidden;display:grid;place-items:center;font:bold 60px sans-serif;color:#fff}
</style>
<div class="flip"><div class="inner" id="i" style="transform:rotateY(180deg)"><div class="face front">F</div><div class="face back">?</div></div></div>
<script>
const i=document.getElementById('i');const t0=performance.now();
function f(t){const k=Math.min(1,(t-t0)/800);i.style.transform=k<1?'rotateY('+(180*(1-k))+'deg)':'none';if(k<1)requestAnimationFrame(f)}
setTimeout(()=>requestAnimationFrame(f),200)
</script></body></html>`
for (const engine of ['webkit', 'chromium']) {
  const b = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' })
  const ctx = await b.newContext(engine === 'webkit' ? { ...devices['iPhone 14'] } : { viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  await p.setContent(MINI)
  await sleep(100)
  await p.screenshot({ path: `${OUT}flipdiag2-${engine}-start.png`, clip: { x: 0, y: 0, width: 160, height: 160 } })
  await sleep(1600)
  await p.screenshot({ path: `${OUT}flipdiag2-${engine}-end.png`, clip: { x: 0, y: 0, width: 160, height: 160 } })
  console.log(engine, await p.evaluate(() => getComputedStyle(document.getElementById('i')).transform))
  await b.close()
}
