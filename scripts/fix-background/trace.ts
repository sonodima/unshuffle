import { QUALITY, createGovernor, levelWork } from '../../src/components/background/pacing'
const VSYNC = 1000 / 60
const interval = (w: number, fps: number) => Math.max(Math.round(1000 / fps / VSYNC), Math.ceil(w / VSYNC - 1e-6)) * VSYNC
function sim(name: string, work: (l: number) => number, secs = 12, initial = 0) {
  const g = createGovernor({ initial }); g.restart(0)
  let t = 0; const ev: string[] = []; let last = g.level; let lf = g.fps
  while (t < secs * 1000) { const dt = interval(work(g.level), g.fps); t += dt; g.frame(dt, t); if (g.level !== last || g.fps !== lf) { ev.push(`${(t/1000).toFixed(2)}s q${g.level}@${g.fps}`); last = g.level; lf = g.fps } }
  console.log(name.padEnd(28), ev.join(', ') || '(no change)', `| final q${g.level} ${g.fps}fps locked=${g.locked}`)
}
sim('fast', () => 3)
sim('swiftshader-like', (l) => (100 * levelWork(l)) / levelWork(0))
sim('pixels 24ms', (l) => 24 * QUALITY[l].scale ** 2)
sim('cpu bound 26ms', () => 26)
sim('floor 20.5 (not ours)', (l) => Math.max(20.5, (40 * levelWork(l)) / levelWork(0)))
sim('marginal 20.7 at q3', (l) => (20.7 * levelWork(l)) / levelWork(3))
sim('slightly slow q0 (19ms)', (l) => (19 * levelWork(l)) / levelWork(0), 30)
sim('q0 24 else 12', (l) => (l === 0 ? 24 : 12), 30)
function simCap(name: string, work: (l: number) => number, cap: (t: number) => number, secs = 60) {
  const g = createGovernor(); g.restart(0)
  let t = 0; const ev: string[] = []; let last = g.level; let lastFps = g.fps
  while (t < secs * 1000) { g.setCap(cap(t), t); const dt = interval(work(g.level), g.fps); t += dt; g.frame(dt, t); if (g.level !== last || g.fps !== lastFps) { ev.push(`${(t/1000).toFixed(1)}s q${g.level}@${g.fps}`); last = g.level; lastFps = g.fps } }
  console.log(name.padEnd(28), ev.join(', ') || '(no change)', `| final q${g.level} ${g.fps}fps locked=${g.locked}`)
}
sim('pixels 24ms long', (l) => 24 * QUALITY[l].scale ** 2, 40)
simCap('weak, idle then music', (l) => (100 * levelWork(l)) / levelWork(0), (t) => (t < 8000 ? 30 : 60), 30)
simCap('pixels, music on/off', (l) => 24 * QUALITY[l].scale ** 2, (t) => (Math.floor(t / 7000) % 2 ? 30 : 60), 60)
simCap('fast, music on/off', () => 4, (t) => (Math.floor(t / 3000) % 2 ? 30 : 60), 60)
