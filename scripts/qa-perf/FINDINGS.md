# QA "perf" — findings (performance & resource usage)

Audit resumed 2026-09-24 from the previous perf engineer's scripts in this folder.
Servers: dev :5308 (UNSHUFFLE_VITE_CACHE=node_modules/.vite-qa-perf), static preview of `scripts/qa-perf/dist` on :5318.
Raw measurement outputs: `scripts/qa-perf/*.txt`.

## F1 [major][ui] Frosted-glass `backdrop-filter` over the 60 fps WebGL canvas is the #1 idle GPU cost
- Detail: `.glass` / `.btn-glass` (src/index.css:268-278, 503-510: blur(24px) saturate(140%)) are re-blurred every frame because the shader behind them changes every frame. Lobby desktop has 28 blurred elements covering 96% of the viewport (nested glass inside glass); phone lobby 14 elements / 108%.
- Evidence: scripts/qa-perf/idle2-lobby-desktop.txt — lobby desktop GPU-process CPU 42/39% default -> 7.0/6.5% with backdrop-filter disabled (shader still running) -> 1% with no background. idle2-phone.txt: phone lobby GPU 40% -> 8.7% without backdrop-filter. backdrop-results.txt for element counts/areas. idle-results.txt: lobby desktop CSS-fallback still 52% GPU (the blur, not the shader).
- Fix: drop backdrop-filter from nested glass (anything inside a `.glass` panel, chips, buttons) and replace the panel blur with an opaque-ish tint (bg-ink-900/85-90) -- the plasma behind is already soft; or keep blur only on 1-2 top-level panels. Alternatively render the shader at 30 fps when no music plays (halves re-blur work). Expected: lobby GPU-process ~40% -> ~7-10% of a core; big battery win on phones/laptops.

## F2 [major][home] Idle Home burns ~20-24% renderer + 32-38% GPU-process CPU on desktop, even without the shader
- Detail: the always-looping ShuffleDemo panel (src/screens/home/ShuffleDemo.tsx; infinite `for (;;)` loop in useDemoLoop.ts:123, paused only when off-screen/hidden) + TimerBar (src/components/ui/Timer.tsx:238-241 writes `style.width` every rAF -> layout+paint per frame) + motion `layout="position"` projection (ShuffleDemo.tsx:112, Logo.tsx:129/223) + glass blur.
- Evidence: idle-results.txt: home desktop WebGL 23.5% renderer / 37.9% GPU; CSS fallback (no WebGL) 20.9% / 33.4%; prefers-reduced-motion 3.5% / 9.8%. anims-desktop-results.txt: 322 Paint events/s on Home, top painters = TimerBar fill (with glow box-shadow) and its bar-sweep span, hm-face. idle3-home-desktop.txt: hiding demo panel GPU 32->20%, no backdrop 32->23%, demo+backdrop+bg off 11%/4%. homeprof-*.txt: JS is small (16 ms/s desktop, 28 ms/s phone 4x), cost is style/layout/paint/composite (Task 168 ms/s desktop, 270 ms/s phone 4x).
- Fix (home): stop the demo loop after 2-3 cycles or after 20 s without pointer activity (resume on pointermove/focus/hover of the panel). The TimerBar part is F11 (ui). Expected: home idle to roughly reduced-motion levels (~4-10%).

## F3 [major][game] A 10-round game decodes all 10 previews up front: ~110 MB of PCM at game start (phones)
- Detail: `prefetchQueue` (src/game/store.ts:634-651) returns every upcoming round's track, and pumpPrefetch decodes them all (engine keeps AudioBuffers: 30 s x 2 ch x 48 kHz x 4 B = 11 MB each). Eviction of finished rounds works, so the peak is at the start.
- Evidence: scripts/qa-perf/mem10.txt (memory.mjs, 10 rounds): "main preparing+9s" buffers=10, 109.8 MB on both host and phone guest; r6: 5 buffers 54.9 MB; r10: 1 buffer 11 MB; final/lobby: 0. mem5.txt (5 rounds): 5 buffers 54.9 MB at start -> 3 (32.9 MB) at r3 -> 1 (11 MB) at r5 -> 0. Heap/DOM/listeners flat across 10 rounds + 2x Rigioca (no leak).
- Fix: keep the compressed bytes (~0.5 MB each) for all upcoming tracks (fetch early because URLs expire) but decode only current + next round (decode takes ~50-150 ms, well within the reveal). Expected peak 110 MB -> ~22 MB decoded + ~5 MB compressed for 10 rounds (and 55 -> 22 MB for 5 rounds).

## F4 [minor][background] WebGL init (context + shader compile) runs synchronously before first paint: ~190-230 ms long task, FCP gated on it
- Detail: startBackground() -> createRenderer() -> getContext('webgl2') + compileShader/linkProgram + getShaderParameter(COMPILE_STATUS) (src/components/background/renderer.ts:64-110, runtime.ts:142) runs in ShaderBackground's mount effect, in the same task as the first commit; FCP lands right after the first draw.
- Evidence: glinit-rep-results.txt (fresh browser each run, 1x CPU): getContext 53-173 ms + status waits 14-160 ms; long task at ~250 ms lasting 217-229 ms (desktop), 127-145 ms (phone); FCP (392-448 ms) == first shader draw time. glinit-results.txt: cold desktop run had a 600 ms long task and FCP 892 ms; phone 4x: getContext 156 ms. bootprof-results.txt (4x): renderer.ts:77 `createRenderer` 246 ms self.
- Fix: start the background after first paint (requestAnimationFrame -> setTimeout 0, or requestIdleCallback {timeout: 300}); use KHR_parallel_shader_compile and poll COMPLETION_STATUS_KHR across frames instead of blocking on COMPILE_STATUS. The canvas already fades in over 900 ms over #06040f, so nothing visible changes. Expected: FCP -150..-200 ms on desktop cold start, -150..-300 ms on phones; one fewer 200+ ms long task during boot.

## F5 [minor][build] Web fonts are discovered late and swap ~1.1 s after first paint on Slow 4G (visible FOUT of the logo/CTAs)
- Detail: fonts are referenced only from the 34 KB CSS via @fontsource; requests start after the JS renders text (2.6 s on Slow 4G) and then compete with the idle-preloaded lazy chunks (bundler/Lobby/Round/Final, started 2.74-2.76 s).
- Evidence: fout2-results.txt + shots/fout2-phone-t2892.png (fallback font: "UNSHUFFLE" logo rendered in system font, CTA in system italic) vs shots/fout2-phone-t3760.png; FCP 2720 ms, Unbounded loaded ~3990 ms; CLS small (0.0073). NB: the old fout.mjs shots were always post-swap because Playwright's page.screenshot waits for fonts.
- Fix: in index.html add `<link rel="preload" as="font" type="font/woff2" crossorigin href="/node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2">` (Vite rewrites/hashes it; same asset as the CSS one), optionally Manrope latin too; delay preloadScreens()/preloadTransport() until `document.fonts.ready`. Expected: Unbounded ready around FCP instead of +1.1 s on Slow 4G.

## F6 [major][background] Shader always renders at 60 fps, even when nothing plays (home/lobby/final); 30 fps when silent cuts idle GPU ~3-4x
- Detail: runtime.ts frame() targets 60 fps unless reduced motion (runtime.ts:324-345, interval at :327). With no music the plasma flows at base speed 0.3 and every frame also forces a re-blur of every glass panel above it (F1).
- Evidence: idle-rm-results.txt vs idle-results.txt: lobby with prefers-reduced-motion (shader at 30 fps, no other difference in the lobby — grain has no effect there per idle2-lobby-desktop.txt): desktop renderer 11.3% -> 4.4%, GPU 56% -> 15%; phone renderer 13.5% -> 4.6%, GPU 35% -> 12.6%.
- Fix: when `reactor.state.presence` / levels are ~0 for > 1 s (no music) use the 30 fps pacing path already implemented for reduced motion; go back to 60 fps as soon as levels rise (play-all, reveal). Expected: ~-40 points of GPU-process CPU in lobby, ~-7 points renderer, without touching the design. Complements F1.

## F7 [minor][home] PeerJS chunk is imported (and evaluated) immediately on Home mount: its import-time RTCPeerConnection probe is a 50-220 ms long task during boot
- Detail: HomeScreen.tsx:77-80 calls preloadTransport() on mount (not idle). peerjs `util.supports` runs at module evaluation and constructs `new RTCPeerConnection()` + createDataChannel (node_modules/peerjs/dist/bundler.mjs:175-190).
- Evidence: rtcprobe-results.txt: fresh browser 1x: RTCPeerConnection constructed at 536 ms taking 219 ms (long task 224 ms); 4x after warm-up: 53 ms. bootprof-results.txt (4x, cold): peerjs bundler.mjs:175 207 ms self. glinit-rep-results.txt: second boot long task 183-380 ms at ~0.45-0.6 s.
- Fix: move preloadTransport() behind the same whenIdle()/fonts-ready gate as preloadScreens, and additionally trigger it on intent (pointerenter/focus of "Crea stanza", "Entra", the code input). Expected: removes a 50-220 ms long task from the first second after load, when users start typing their name.

## F8 [minor][game] Host-only code (HostGame, hostRules, net/host) is in the critical-path index chunk
- Detail: store.ts statically imports game/host.ts (-> net/host.ts, hostRules.ts); only needed after "Crea stanza".
- Evidence: bundle-composition.txt: index chunk 409.9 KiB raw (136 KB gz): src/game/host.ts 23.3 KiB + src/net/host.ts 7.9 + src/game/hostRules.ts 4.1 = 35.3 KiB raw (~11 KB gz).
- Fix: `const { HostGame } = await import('./host')` inside startHosting() (it already awaits the PeerJS chunk there). Expected: -8% index chunk, ~-60 ms on Slow 4G, ~-10 ms eval at 4x.

## F9 [minor][analysis] Main-thread analysis fallback pulls the whole pipeline (28 KiB) into the index chunk, duplicating the worker chunk
- Detail: src/audio/analysis/index.ts:12 statically imports analyzeAsync/isValidPlan/uniformPlan from './pipeline'; the pipeline is also bundled in worker-*.js (26.3 KiB).
- Evidence: bundle-composition.txt: index chunk "src/audio/analysis 28.3 KiB"; worker chunk 26.3 KiB.
- Fix: dynamic `await import('./pipeline')` in runOnMainThread(); move clampCount/isValidPlan/uniformPlan into a tiny module. Expected: -28 KiB raw (~9 KB gz) from the first load.

## F10 [minor][audio] First tap anywhere creates the AudioContext synchronously inside pointerdown: 176 ms at 4x CPU (~45 ms at 1x)
- Detail: GESTURE_EVENTS pointerdown -> unlock() -> ensureGraph() -> `new AudioContext({latencyHint:'interactive'})` + graph setup (engine.ts:232-270, 868, 1067).
- Evidence: lobbyentry-prof-phone-cpu4.txt: "Crea stanza" tap -> 265 ms long task, of which engine.ts ensureGraph 176 ms inclusive; click->lobby 586-615 ms.
- Fix: create the context (suspended) at idle after boot (`whenIdle(() => ensureGraph())`) and keep only `ctx.resume()` + the silent buffer in the gesture. Expected: first-interaction latency -176 ms at 4x.

## F11 [minor][ui] TimerBar / TimerRing repaint (and TimerBar re-layouts) at 60 fps for ~3 px/s of visible movement
- Detail: useCountdown's rAF loop (src/components/ui/Timer.tsx:52-60) publishes every frame; TimerBar writes `style.width` (Timer.tsx:238-241 -> layout + paint of the fill, its glow shadow and the bar-sweep span); TimerRing updates stroke-dashoffset on a circle with a `drop-shadow` filter (Timer.tsx:178) -> full re-raster every frame. Used on Home (demo), the phone HUD (bar) and the desktop HUD (ring).
- Evidence: anims-desktop-results.txt: PLAYING 122 Paint events/s, ring svg painted 182x in 3 s; HOME TimerBar fill 173x/3 s. roundgpu3-phone.txt: hiding the timer: GPU 20.1% -> 16.2%, renderer 12.6% -> 10.9%; roundgpu2-desktop.txt: ring hidden GPU 21.0% -> 17.9%, renderer 10.8% -> 8.4%. idle3-home-desktop.txt: TimerBar hidden: layouts/s 27 -> 6.
- Fix: TimerBar fill -> `transform: scaleX(f)` with transform-origin left (composited, no layout) or a WAAPI animation to scaleX(0) over remainingMs; TimerRing -> only write dashoffset when it moved >= 0.5 device px (90 s round, r~45 px: ~3 px/s -> ~6 writes/s instead of 60) and put the glow on a static wrapper instead of a per-frame filter. Expected: -3..4 points GPU and -2 points renderer for the whole round (~15-20% of the playing-phase cost), home layouts/s 27 -> ~6.

## F12 [minor][final] Final "I brani della partita" downloads 1000x1000 covers for 173 CSS px tiles
- Detail: src/screens/final/Songs.tsx:35 uses `t.cover` (Deezer cover_xl, deezer.ts:325).
- Evidence: final-img-phone.txt: 3x 1000x1000 = 501 KB fetched on entering Final, displayed 173x173 CSS @3x (519 device px). Sizes measured with curl on 5 chart covers: xl 131-219 KB (avg 177 KB) vs 500x500 37-67 KB (avg 52 KB). A 10-round game: ~1.8 MB vs ~0.5 MB, decoded 4 MB vs 1 MB per image.
- Fix: rewrite the dzcdn URL to /500x500- (same trick as coverColor.ts:69-71 sampleUrl) or use srcset 500w/1000w + sizes. Expected: -70% bytes on Final (-1.3 MB on mobile data for 10 rounds), ~-30 MB decoded image memory.

## F13 [minor][background] Adaptive quality converges slowly (~8 s at 10-26 fps) and has no floor below ~46 fps on weak GPUs
- Detail: first downgrade only after WARMUP_MS 1.5 s + a 60-frame window; each step needs another window; lowest level (scale 0.56, 3 octaves) has no frame-rate fallback (runtime.ts:58-68, adapt() at 268-322).
- Evidence: shader-swiftshader.txt (software GL as a weak GPU, desktop 1440x900): q-trace 0000112333..., fps 10,26,22,22,24,32,35,34,43,46 -> settles at q3 46 fps (frameMs 20.7 > SLOW_FRAME_MS 20) with nothing left to shed. Real GPU (shader-results.txt): never leaves q0; GPU 0.28 ms/frame phone (195x422 canvas at DPR3 = 0.5 CSS px, sensible), 1.4 ms desktop 1080x675, 2.1 ms at 2560x1440 (capped 1520x855 by MAX_PIXELS).
- Fix: shorter first window (~20 frames) and start at q1 on `(pointer: coarse)` / hardwareConcurrency <= 4; add a final level that switches to the 30 fps pacing already used for reduced motion. Expected: weak GPUs settle in ~2 s instead of ~8 s and stop stealing frames from drag/reveal animations.

## F14 [minor][background] Film-grain overlay is a 582x1036 CSS px promoted layer (~21 MB raster at DPR3) blended over the canvas every frame
- Detail: `.ushf-bg-grain { inset: -96px; will-change: transform, opacity; animation: ushf-grain 0.72s steps }` (background.css). The oversize (for the jitter translate) makes the layer 1.8x the viewport area; with the canvas updating at 60 fps the compositor re-blends 5.4 Mpx/frame on a DPR3 phone.
- Evidence: layers-phone.txt (CDP LayerTree): home: `div.ushf-bg-grain 582x1036css 20.7MB` is the largest layer; lobby: third largest after glass panels. (M1 Pro shows no measurable CPU difference - idle2-lobby-desktop.txt "no-grain" - so the cost is GPU memory/fill-rate on phones.)
- Fix: jitter with `background-position` steps on an `inset:0` element (layer = viewport, 11.3 MB, -45% fill), or skip the grain under `(pointer: coarse)` where 1-device-px grain is barely visible, or fold it into the shader as ordered dither. Expected: -9..-21 MB GPU memory on phones, -45..-100% of the grain blend fill-rate.

## F15 [polish][reveal] Reveal entry long tasks (136-198 ms at 4x) include a forced synchronous layout in BoardStage
- Detail: BoardStage.tsx:27-30 measures `el.clientWidth` in useLayoutEffect on mount, forcing layout of the freshly mounted reveal tree; plus motion measureScroll and a synchronous cover decode in coverColor readCover (drawImage right after load, coverColor.ts:58-66).
- Evidence: revealprof-phone-cpu4.txt: long tasks [185, 71] (round 1), [136] (round 2); self: BoardStage.tsx:30 measure 43-44 ms, motion DocumentProjectionNode measureScroll 44-46 ms, drawImage 30 ms, getBoundingClientRect 24-28 ms. drag-prod-phone-cpu4.txt: confirm->reveal max frame 217 ms.
- Fix: size the board from the ResizeObserver callback only (contentRect, no sync read) or CSS aspect-ratio; (deezer) `await img.decode()` before drawImage. Expected: reveal entry long task 185 -> ~110 ms at 4x.

## F16 [polish][board] TransportBar rewrites its time label and all 16 progress fills every frame during play-all
- Detail: TransportBar.tsx:82-92 `paint()` sets `textContent = formatTime(elapsed)` (m:ss, changes 1x/s) and a transform on every fill span each rAF.
- Evidence: drag-prod-phone-cpu4.txt (4x): play-all 4 s: TransportBar.tsx 36 ms self, drag during play-all 38 ms; Waveform.tsx only 15 ms (the waveform sweep itself is cheap).
- Fix: cache the last label string / last value per fill and only write on change. Expected: ~-8 ms/s main thread at 4x during playback, fewer text layouts.

## F17 [polish][round] RoundScreen re-renders the whole round tree 4x/s via useHostNow(250)
- Detail: src/screens/round/RoundScreen.tsx:32 -> RoundView -> PlayStage -> SnippetBoard/DndContext/SortableContext re-render every 250 ms even though only the HUD/timer needs `now`.
- Evidence: drag-dev-desktop-cpu1.txt: idle playing 6 commits/s x ~48 components; play-all: SnippetBoard 21, DndContext 21, SortableContext 21 renders in 4 s. Drag: 30-35 commits/s, 11.7-12.6 component renders/frame (fine). JS busy idle-in-round at 4x: 183 ms / 3 s (incl. shader+timer).
- Fix: pass `clock` (already passed) and let only the HUD subscribe to a ticking hook; memo SnippetBoard. Expected: small (~-5 ms/s at 4x), mainly headroom during drags.

## F18 [polish][build] No preconnect hints for the four third-party origins used right after Home
- Detail: index.html has no `<link rel="preconnect">` for api.deezer.com (lobby shelf/JSONP), 0.peerjs.com (signalling on "Crea stanza"/"Entra"), cdn-images.dzcdn.net (covers) and cdnt-preview.dzcdn.net (preview MP3s).
- Evidence: curl handshake timings from this machine (wired): DNS+TCP+TLS = 90 ms (api.deezer.com), 145 ms (cdn-images), 72 ms (cdnt-preview), 63 ms (0.peerjs.com); on mobile RTTs (100-300 ms) that is ~0.3-0.9 s per origin paid on the critical interactions.
- Fix: `<link rel="preconnect" href="https://0.peerjs.com">` and `<link rel="preconnect" href="https://api.deezer.com">` (+ `dns-prefetch` for the two dzcdn hosts; previews need `crossorigin`). Expected: -60..-145 ms here, up to ~-0.5 s on mobile for the first lobby/playlist/preview request.
