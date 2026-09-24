# fix-ui progress log

Area: src/components/ui/**, src/components/brand/**, src/index.css, src/screens/Styleguide.tsx
Lab: lab/fix-ui.html + src/dev/fix-ui/main.tsx (?view=timers|modal|controls|glass|perf). Dev server :5407.
Scripts: scripts/fix-ui/gpu.mjs (idle GPU per CSS variant, real app), shots.mjs, zoom.mjs, paints.mjs.

## Baseline (before, dev server, real shader)
- lobby desktop default 34.5% GPU / no-backdrop 6.4% / top-level-only 14.5%
- lobby phone default 24.2% / no-backdrop 7.1% / top-level-only 15.4%
- home desktop default 25.7% / no-backdrop 16.9% / top-level-only 19.6%
- Visual: removing blur from docked bars (StartBar) shows scrolled content through -> keep blur there.

## Findings
1. [MAJOR] glass backdrop-filter GPU cost — DONE in my area, rest = cross-area requests
   - Key measurement: ANY blurred element on screen costs ~+5% GPU (fixed cost, even a 1% element);
     zero blur = ~7%. So persistent chrome must not blur at all.
   - index.css: `glass` keeps blur (transient overlays), new `glass-flat` (in-flow panels), new `glass-dock`
     (near-opaque, for docks over scrolling content), glass-subtle / btn-glass no blur, nested `.glass` never blurs.
   - Panel glass -> glass-flat; Modal dialog -> glass-flat; Chip, Tooltip, TimerRing disc: no blur.
   - After: home desktop 25.7% -> 12.5% (0 blurred). Lobby desktop 34.5 -> ~15%; phone 24.2 -> 22.5%.
     Remaining lobby blur is in other areas (picker section `glass`, StartBar `glass`, tab bar, hover labels, hero box).
     Simulated adoption (dock-sim): phone 6.6%, desktop 8.5%.
2. [MINOR] Modal on landscape phones — DONE (short: variant = max-height 500px; whole dialog scrolls, sticky opaque footer, one-row footer)
   - l844: dialog 372px scrolls 554; avatars visible; l568 sheet too. Portrait/desktop unchanged.
3. [MINOR] 36px touch targets — DONE (.btn-sm::after 48px hit-slop on pointer:coarse; `hit-slop` utility; Chip, toast close, modal close, avatar dice)
   - Kick confirmation / reactions 44px / transport cells -> cross-area.
4. [MINOR] ink-400 contrast — DONE (#8a82c4: 5.1-5.2 on tinted glass, 4.53 on ink-700; disabled btn label ink-300)
5. [MINOR] Timer repaint — DONE (TimerBar translate-only fill + separate glow layer: 181 -> 2 paints/s, 60 -> 1 layouts/s;
   TimerRing writes only on >=0.5 device px: 125 -> 27 paints/s). Helpers in timerMath.ts, tests scripts/fix-ui/timer.test.ts (7 pass).
Also: Styleguide documents glass-flat / glass-dock / glass and hit-slop.
Also: Toast -> glass-flat bg-ink-850/95 (no blur); Modal header touch-none only for sheets (centered short dialogs scroll from the header too).
Prod snapshot (scripts/fix-ui/dist, preview :5457): static e2e PASS. GPU lobby phone 17.3% (was ~24), desktop 15.2% (was ~35);
with the cross-area requests applied (dock-sim): phone 6.6%, desktop 7.1%.
Verified: tsc clean for my files, oxlint no new warnings, bun tests (timer + 12 other suites) pass, touch-scroll test of short dialogs.
STATUS: all 5 findings handled. Remaining = crossAreaRequests (see final report).
