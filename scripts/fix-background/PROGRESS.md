# fix-background progress

Area: src/components/background/**. Findings: F1 idle 30 fps (major), F2 WebGL init before first paint (minor),
F3 adaptive quality convergence (minor), F4 grain layer oversize (minor).

## Log
- [start] No earlier attempt found. Read runtime/renderer/ShaderBackground/background.css/reactor.
- [impl] New src/components/background/pacing.ts: pure governor (30 fps cap while quiet/reduced, time-based
  windows 0.5 s first / 1 s, cost-model jump on first step down, 30 fps last level, isQuiet, initialLevel).
- [impl] renderer.ts: non-blocking compile/link (KHR_parallel_shader_compile, one LINK_STATUS read),
  poll() per frame, variant switches compile in the background; fallback chain [preferred,4,3] kept.
- [impl] runtime.ts: uses governor + poll(); canvas fades in once linked; paused mount keeps polling until
  first frame; stats gain targetFps/idle/parallelCompile; quality 4 = lowest at 30 fps.
- [impl] ShaderBackground.tsx: startBackground deferred via rAF -> setTimeout(0) (after first paint);
  grain opacity steps of 1/400.
- [impl] background.css: grain overscan = one tile (128/64px) up-left only, offsets mod tile.
- TODO: bun tests for pacing (scripts/shader/pacing.test.ts), lab + verify on :5413, screenshots.
- [test] scripts/shader/pacing.test.ts (19 tests: governor convergence sims, quiet detection, renderer polling
  with a fake GL) + scripts/shader/logic.test.ts pass.
- [verify] scripts/fix-background/verify.mjs (port of scripts/shader/verify.mjs + new checks) on :5413:
  first run 26/29; fixed: (a) idle threshold presence<0.25 & energy<0.08 (idle ~3-4 s after music stops
  instead of ~8 s), (b) start now waits for the FCP entry (Chrome's GPU process presents frames and creates
  contexts on one thread, so rAF+setTimeout still overlapped FCP). Rerun of idle/boot/pausedmount: 8/8.
- NOTE scripts/shader/verify.mjs (old) expects 60 fps idle: superseded by scripts/fix-background/verify.mjs.
- [verify F2] Same-tree A/B builds (scratchpad/ab/{old,new}, old background restored from the QA build's
  sourcemap), cold browser per run, 5 runs, rIC neutralized so audio prewarm lands at 1.2 s:
  old: 180-237 ms boot long task (getContext 124-185 + status waits 9-21 ms), context before FCP 0/5.
  new: no background long task (context 7-59 ms, created after FCP 5/5), status waits 0 ms.
  FCP median desktop 336->316, phone 420->344 (noisy). Results: boot-ab-noric.txt / boot-ab.txt.
  CROSS-AREA: src/audio/engine.ts prewarm() (requestIdleCallback) creates the AudioContext BEFORE FCP in
  prod (250-420 ms long task at ~200 ms: bootprof shows ensureGraph 285 ms self). See boot-ab.txt.
- [verify F1] idle-ab.txt (same-tree A/B, 10 s, current tree already has the ui area's glass changes):
  lobby desktop GPU 15.1->8.4 %, renderer 7.6->5.3 %; lobby phone GPU 15.5->10.4 %; home desktop GPU
  12.3->9.6 %; home phone GPU 10.1->7.3 %, renderer 10.5->8.4 %.
- [impl] grain tile generated after first paint too (5-20 ms off the first render).
- [fix F3 v2] SwiftShader run showed a noisy probe (q2->q3 gain 14% vs 10% threshold) restoring q2 and
  LOCKING at ~36 fps. Reworked: 30 fps is now a separate `throttled` flag (not a level). Descent helped but the
  last steps didn't -> keep the better level and throttle; lowest level still over budget -> throttle; never
  helped -> restore + lock (CPU-bound). Also 250 ms settle after a variant lands (driver JIT hitches).
  SwiftShader desktop now: q0 -> q3 -> q3@30 within ~3 s of first draw (swiftshader-after.txt).
- [verify] verify.mjs 29/29 (idle poll at 250 ms); scripts/shader/verify.mjs updated (idle pages 30 fps,
  frame-count blocks use music=1) and passes against :5413 via verify-orig-5413.mjs. Real audioEngine path:
  engine-idle.mjs -> 60 fps while playing, idle ~5 s after stop.
- [verify F4] layers-ab.txt (CDP LayerTree, phone DPR3, same-tree A/B): grain layer 582x1036 css 20.7 MB ->
  454x908 css 14.2 MB (-6.5 MB, -31%) on home and lobby. Visuals identical (shots/old-*, new-*).
- [done] All 4 findings fixed. Servers on 5413/5463/5464/5465 stopped; stale dist snapshot removed.
  Skipped parts: F3 "start at q1 on (pointer: coarse) or <=4 cores" -> only <=2 GB / <=2 cores start at q1
  (real phones cost 0.28 ms/frame at q0; faster convergence covers weak ones). F4 "grain off on coarse
  pointers / in-shader dither" -> not done (design texture kept; shader renders at 0.5 px so grain would blur).
  Cross-area: audio prewarm() before FCP; ARCHITECTURE.md background section wording.
