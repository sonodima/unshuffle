# fix-board progress log

Owner-fixer for src/components/board/**. Running log (newest last).

## Status
- [x] 1 MAJOR tap-to-play lost on 5px+ finger jitter
- [x] 2 MAJOR locked reveal blocks swallow vertical swipes
- [x] 3 MAJOR waveforms of loud masters look identical
- [x] 4 MINOR reveal badges hang outside blocks
- [x] 5 MINOR lock mid-drag does not cancel the drag
- [x] 6 MINOR tiny "Ascolta dalla posizione N" targets
- [x] 7 POLISH transport label truncated on 390px
- [x] 8 POLISH long-press / double-click → play from here
- [x] 9 POLISH TransportBar per-frame DOM writes
- [x] extra: board.css has duplicated blocks (merge artifact) → dedupe

## Log
- started; no earlier PROGRESS.md existed.
- 1: BoardPointerSensor (PointerSensor subclass) picks activation distance by pointerType: mouse 4px, touch/pen 10px.
  Backup: a pointer drag that ends on its own slot with travel <16px and <600ms is treated as a tap (toggleSegment).
  tap.mjs: jitter 0..15px all play, drags still reorder (tap-before.log vs tap-after.log).
- 5: synthetic Escape now dispatched on document (non-bubbling). desktop.mjs lock-mid-drag ok.
- 8: long-press 450ms (press sinks after 140ms via data-pressing) → play-all from that position (usePlayAll in SnippetBoard);
  click after a fired long-press is swallowed; Shift+Enter = keyboard equivalent (SR instructions updated).
- 2: .sb-item[data-locked] { touch-action: pan-x pan-y } (verify on reveal lab pending).
- 4: mark badge moved inside the block, replaces the slot chip (chip fades out); ring inset -2px. Screens after1-*.
- 6: .tb-cell 40px-tall gapless hit area (negative margins keep row 20px); focus ring moved to the bar.
- 7: short playing label 'In ascolto' under 400px container width. transport.mjs: no truncation 360..1440.
- 9: TransportBar paint() writes only on change (121 mutations/s vs ~60×(n+2) before).
- extra: board.css duplicated drag/locked/marks sections removed (kept the effective cascade).
- 2 verified on lab/reveal.html (real RevealLayout): swipe starting on a block scrolls 145px at 390/360 × n8/n16; tap still plays (reveal-scroll.log).
- 3: new src/components/board/waveLevels.ts: bars = per-bin dB mapped between the track's p5..p99.5 (γ1.6, floor .06),
  halo = peaks on their own track range (never below core). One fine 5ms pass per buffer, aggregated per bin factor
  (exact RMS/max), cached in a WeakMap. Waveform.tsx draws precomputed heights (cheaper per frame). Skeleton keeps
  the linear look. Tests: scripts/board/waveLevels.test.ts (11 pass). Cost: first pass 15ms @1x / 56ms @4x CPU incl.
  the mono mixdown the block peaks pay anyway. Before/after: shots/{before,after}-wave-*.png (She Will Be Loved,
  Titanium, Daft Punk). Skipped the optional smooth-path-for-thin-bars and band split: bars read well at 16 snippets.
- long-press guarded on audio readiness; Enter with Mod/Alt passes through (Mod+Enter = confirm in PlayView).
- transport: map margin-inline -2px so outer bars align with the text above.
- E2E on a prod snapshot (vite preview :5450, solo game, 390x844 touch): jitter 0/6/9/13px taps play, long-press
  plays from pos 5 ('IN ASCOLTO 5/8'), drag reorders, no console errors (solo.log, shots/solo-*.png).
- tsc clean for src/components/board; oxlint clean; build ok.
## Done. Cross-area requests: docs/ARCHITECTURE.md activation text; ConfirmDock/Intro/Preparing hint copy for
   long-press; RevealLayout header mb-3→mb-4.
