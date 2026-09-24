# fix-final progress log

Area: src/screens/final/**. Findings 1-11 from QA.

## Status
- [x] 1 MAJOR dock — ActionDock placement inline (≥768: sticky in flow under podium, floating copy once scrolled past, inert swap) / fixed (phones, fade h-24). FinalView compact mode (768+ & max-height 820) + Podium WIDE_SHORT dims
- [x] 2 MINOR sound — inline SoundControls in header at all widths, pill min-w-0 truncate
- [x] 3 MINOR headline overflow — fit.ts useFitWords(min 24px, then overflow-wrap anywhere as last resort — 14px looked broken)
- [x] 4 MINOR suspense — teaser "E il vincitore è…" until landingTime(0), then spring title + color flash; subtitle +0.3s; reduced motion/solo/zero immediate
- [x] 5 MINOR typography — tiny text 103/108 → 29/36 (all remaining = 11px caps labels/badges); plates 12px phone/14px wide, 2 lines + fit (min 10/11) + plate pinned bottom; RoundBreakdown header 12px max-w-[min(100%,140px)] + title
- [x] 6 MINOR (dup of 1) — verified 1280x720: plates 481-528, dock 570-660
- [x] 7 MINOR covers — dzImage.dzCoverSize(url, 500) for Songs tiles (verified 500x500 requests)
- [x] 8 POLISH Rigioca xl in inline dock (max-w 600), lg on phones/floating
- [x] 9 POLISH solo zero headline/awards — stats.ts: solo branch first ("Zero punti!"), computeAwards returns [] when <2 played; tests in scripts/final/stats.test.ts
- [x] 10 POLISH Fulmine — new PlayerSummary.avgScoringConfirmMs (confirmed rounds with points>0) drives Fulmine; description updated. reveal/model.ts + selectors.ts = crossArea
- [x] 11 POLISH — Songs: tap cover plays preview (audioEngine.load w/ refreshPreview, tag final-song:<id>, progress bar, evicts own buffers on unmount), Deezer link separate chip. Rivincita: guest button + host hint in ActionDock, FinalScreen gated on REACTIONS.includes("🔁") (crossArea: add 🔁 to REACTIONS + label)

## Testing
- lab: /lab/fix-final.html (src/dev/fix-final/main.tsx: extra variants soloZero, duoNames, speedy, longW)
- shots: node scripts/fix-final/shoot.mjs <tag> <variant> <me> --sizes=... --at=... --scroll=...
- extra: Standings CountUp uses the row reveal (no "0 punti" next to a filled bar)
- scripts: songs-play.mjs (preview play/stop/switch), tiny.mjs (type audit)
- extra: suspense — plates show each name as its avatar lands; standings rows + award cards on screen wait for the cue (they named the winner during the drop)
- extra: landscape phones (max-height 500): phone podium/type, dock regular size and non-sticky (floating after scroll)
- e2e run 1 (snapshot build :5455, scripts/fix-final/smoke.mjs): all game checks + new final checks passed, but strict-mode failure on Rigioca at page bottom (inline+floating both in a11y tree) → fixed: inactive copy aria-hidden + visibility hidden, FloatingDock leaves a11y tree on exit; IO root = scroller w/ deep bottom rootMargin (jump from below-fold to past now detected). dock-swap.mjs verifies 1 Rigioca at top/bottom/back at 4 sizes.
- extra: standings card fades in with the cue (no empty panel), award cards use cue; formatSeconds uses nbsp before "s"; award titles no longer spill at 1024 (right block 168px below xl)
- lint: oxlint src/screens/final clean (dzCoverSize moved to dzImage.ts; Songs uses a per-mount session object)
- e2e run 2 (after fix): SMOKE PASS incl. final checks (dock below plates, heading clear, real headline after landing, guest song replay, one floating Rigioca at bottom, Rigioca → lobby)
- e2e run 3 (final code): SMOKE PASS in 90.7s
