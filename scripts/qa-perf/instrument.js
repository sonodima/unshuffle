// Injected before the app: React commit counter (DevTools-hook style), long tasks, frame intervals.
(() => {
  const S = (window.__perf = { commits: 0, renders: new Map(), lt: [], frames: [], recording: false, commitTimes: [] })
  const nameOf = (f) => {
    const t = f.type
    if (!t) return null
    if (f.tag === 14) return (t.type && (t.type.displayName || t.type.name)) || 'Memo'
    if (f.tag === 11) return t.displayName || (t.render && (t.render.displayName || t.render.name)) || 'ForwardRef'
    return t.displayName || t.name || 'Anon'
  }
  const COMP = new Set([0, 1, 11, 14, 15])
  function walk(root) {
    const stack = [root]
    let n = 0
    while (stack.length) {
      const f = stack.pop()
      const alt = f.alternate
      const mounted = !alt
      if (COMP.has(f.tag) && (mounted || (f.flags & 1))) {
        const k = nameOf(f)
        S.renders.set(k, (S.renders.get(k) || 0) + 1)
        n++
      }
      // descend only if children were (re)created this commit
      if (f.child && (mounted || f.child !== alt.child)) stack.push(f.child)
      else if (f.child && alt && f.child === alt.child) {
        // bailout at this level: children untouched — but a deeper child may have updated via its own state.
        // DevTools handles this by walking children whose .alternate changed; approximate: walk children and check flags only if their memoizedProps/state changed
        let c = f.child
        while (c) { if (c.alternate && (c.memoizedProps !== c.alternate.memoizedProps || c.memoizedState !== c.alternate.memoizedState)) stack.push(c); c = c.sibling }
      }
      if (f !== root && f.sibling && f._w !== S.commits) { /* siblings pushed by parent loop below */ }
    }
    return n
  }
  // simpler, robust traversal: iterate children lists explicitly
  function walk2(rootFiber) {
    let n = 0
    const visit = (f) => {
      while (f) {
        const alt = f.alternate
        const rendered = !alt || (f.flags & 1) === 1
        if (COMP.has(f.tag) && rendered && (!alt || f.memoizedProps !== alt.memoizedProps || f.memoizedState !== alt.memoizedState || (f.flags & 1))) {
          const k = nameOf(f)
          S.renders.set(k, (S.renders.get(k) || 0) + 1)
          n++
        }
        // Skip subtree when it was bailed out wholesale (same child pointer as previous tree)
        if (f.child && (!alt || f.child !== alt.child || rendered)) visit(f.child)
        else if (f.child && alt) {
          // children not cloned: still check for nested updates (childLanes)
          if (f.childLanes) visit(f.child)
        }
        f = f.sibling
      }
    }
    visit(rootFiber.child)
    return n
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(r) { this.renderers.set(1, r); return 1 },
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      if (!S.recording) return
      S.commits++
      S.commitTimes.push(performance.now())
      try { walk2(root.current) } catch (e) { S.err = String(e) }
    },
  }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (S.recording) S.lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: false })
  } catch {}
  let last = 0
  const tick = (t) => { if (S.recording && last) S.frames.push(t - last); last = t; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  S.start = () => { S.commits = 0; S.renders = new Map(); S.lt = []; S.frames = []; S.commitTimes = []; S.recording = true; S.t0 = performance.now() }
  S.stop = () => {
    S.recording = false
    const dur = performance.now() - S.t0
    const fr = S.frames
    const sorted = [...fr].sort((a, b) => a - b)
    const top = [...S.renders].sort((a, b) => b[1] - a[1]).slice(0, 14)
    const total = [...S.renders.values()].reduce((a, b) => a + b, 0)
    return {
      durMs: Math.round(dur), frames: fr.length, fps: +(fr.length / (dur / 1000)).toFixed(1),
      p50: +(sorted[Math.floor(sorted.length * 0.5)] ?? 0).toFixed(1), p95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1), max: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
      over33: fr.filter((x) => x > 33.4).length, over50: fr.filter((x) => x > 50).length,
      longtasks: S.lt, ltTotal: S.lt.reduce((a, x) => a + x[1], 0),
      commits: S.commits, commitsPerSec: +(S.commits / (dur / 1000)).toFixed(1), componentRenders: total, rendersPerFrame: +(total / Math.max(1, fr.length)).toFixed(1),
      top: top.map(([k, v]) => `${k}:${v}`).join(' '), err: S.err,
    }
  }
})()
