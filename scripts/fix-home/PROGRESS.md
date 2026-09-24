# fix-home progress log

Findings: 1 MAJOR idle demo CPU, 2 MINOR landscape CTA fold, 3 MINOR peerjs preload, 4 POLISH gendered copy.

## Status
- [x] 1 idle demo CPU: idle.ts (createIdleTracker, afterBootIdle; tests scripts/home/idle.test.ts) + useUserIdle (15s). Demo rests on solved board at cycle end (data-demo-rest), wakes w/ reshuffle on input. CSS pauses hero glow / invite halo (.hm-root[data-idle]). DemoTimer (compositor CSS transform) replaces TimerBar. layoutDependency=pos + will-change on demo blocks. Prod numbers idle-after.txt: desktop at rest 7.8% renderer / 8.5% gpu (before 15.2/24.6, forever); running gpu ~halved, layouts/s 45->10. At rest only shader rAF + ushf-grain remain (not home).
- [x] 2 landscape fold: home.css media (landscape, max-h 500, <1024): 2-col grid, hero (+strip moved into hero via useMediaQuery) | card; tighter card; card offset 14px for the sound button; container queries hide eyebrow <250px col, strip <190px. Verified 568x320, 640x360, 667x375, 812x375(+insets), 844x390(+insets), 932x430(+insets); portrait/desktop CTA positions unchanged.
- [x] 3 preloadTransport: HomeScreen afterBootIdle(3s + fonts + rIC<=4s) + onIntent prop (pointerenter/down/focus on create/join sections). preload-probe.mjs: chunk at 3.35s idle (before 0.4s); hover/focus/tap -> immediate.
- [x] 4 gendered copy: 'Hai un invito!' (other files -> crossAreaRequests)

## Log
- Baseline prod build: scripts/fix-home/dist-before, idle numbers in idle-before.txt (desktop 16%/26% renderer/gpu, runs forever).
- Lab: lab/fix-home.html + src/dev/fix-home/main.tsx (copy of home lab). Dev server :5404, preview :5454.
- Polish: HeroLogo memo (typing no longer re-measures the 9 layout-projected letters), ShuffleDemo/DemoStrip memo; lint clean (no setState-in-effect).
- Final prod snapshot (scripts/fix-home/dist): at rest desktop 5.1% renderer / 6.2% gpu, phone 4.6/5.7 (reduced-motion ref 3.8/4.3). static.mjs copy (scripts/fix-home/static.mjs) PASS against it.
- Tests: bun scripts/home/idle.test.ts (7 pass), scripts/home/demoScript.test.ts (3 pass). tsc clean, oxlint clean on src/screens/home.
- Servers stopped (5404, 5454, 5455). DONE.
