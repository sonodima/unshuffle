# fix-reveal progress log

Owner-fixer for src/screens/round/reveal/** (+ lab/fix-reveal.html, src/dev/fix-reveal/, scripts/fix-reveal/).
Dev server: UNSHUFFLE_VITE_CACHE=node_modules/.vite-fix-reveal npx vite --port 5402 --strictPort
Shots: node scripts/fix-reveal/shoot.mjs <tag> "<query>" <ms,..> <sizes,..> [scroll]

## Status
- [x] 1 MAJOR floating sound button covers reveal content (<1180px) -> inline SoundControls in header
- [x] 2 MAJOR sorted view marks every misplaced block wrong -> neutral + "era Nº" chip, toggle Il tuo ordine / Ordine giusto
- [x] 3 MAJOR desktop grid starves board; <800px tall sticky CTA covers totals
- [x] 4 MAJOR spectator reveal on laptops: pill covers note, clipped at 1280x800
- [x] 5 MAJOR tapping a snippet stops the reveal song forever -> tap = seek song to that snippet
- [x] 6 MINOR landscape leaderboard n/N collides with score
- [x] 7 MINOR landscape sticky footer covers ~30%
- [x] 8 MINOR leaderboard empty for 3.3 s / 329 px empty glass when done
- [x] 9 POLISH phone FAB over top-right block after scroll (same fix as 1)
- [x] 10 POLISH reveal cuts out instead of cross-fading (RevealView returns null on exit)
- [x] 11 POLISH BoardStage forced sync layout on mount

## Log
- run 1 started 06:20; baseline shots in shots/base-*.
- 06:50 implemented (not yet fully verified): inline SoundControls in header (#1/#9); board view toggle +
  sortedViewMarks/boardLabels + "era Nº"/"→ Nº" chips via BoardStage scoped <style> (#2); grid columns
  minmax(280,min(23%,340)) 1fr minmax(300,min(26%,360)), stack cover 172/200/224, banner song card for
  xl-short, ScorePanel 2-col container query ≥560px, boardHeightFor aspect 1.18 ≥900px (#3); spectator
  xl areas 'song lead' 'song board' + scroll (#4); revealAudio seek/pause/resume + block:N → seek
  conversion + now-playing segment highlight (#5); strip flex 0 1 (#6); footer bar + compact (#7);
  leaderboard primed rows + popping points + align-self start (#8); RevealView snapshot (#10);
  BoardStage RO-only (#11). Lab: lab/fix-reveal.html (store-driven + floating SoundControls + exit()).
- 07:05 desktop re-layout: banner layout for 1280–1439 (any height) and short screens; 3-col only ≥1440×800
  (one screen, overflow hidden). Spectator xl: 'song board' 'song lead' (note above leaderboard), centered
  on tall screens, page scrolls otherwise. Footer relative for one-screen layouts. Lead auto-scroll skipped
  when the leaderboard sits beside the score.
- verified: scripts/fix-reveal/tap.mjs PASS (desktop + TOUCH=1): block tap → song continues (tag reveal,
  full) from that snippet, highlight moves on, tapping the playing block pauses, song button resumes inside
  the same block, view toggle marks, exit keeps reveal on screen while fading + song silent.
- tests: scripts/fix-reveal/model.test.ts (5 pass), scripts/reveal/model.test.ts (11 pass).
- 07:20 polish: song meta hidden on landscape phones (cover 92), tighter chips on small blocks (container
  query), perfect stamp moves beside the verdict in the wide score panel, sampler no longer sets state in
  an effect (oxlint clean), Segmented 172px on phones. Checked: spectator/missing (phone, 1280x720/800,
  1440, 1536), n=6/8/16, perfect, reduced motion, landscape, 360 wide. scripts/fix-reveal/sound.mjs PASS
  (one sound button, in the reveal header, at 360/390/844x390/1024/1440).
- 07:40 extras: GameMenuButton (exit menu from fix-round) in the reveal header next to the sound control;
  board header mb-4 (fix-board request); "Più veloce" only counts scoring confirms (fix-final Fulmine
  cross-area note) + test; MiniStat keeps the time visible when the name truncates; softer now-playing halo.
- E2E on snapshot build (scripts/fix-reveal/dist, vite preview :5452) with scripts/fix-reveal/smoke-copy.mjs
  (copy of scripts/e2e/smoke.mjs writing to shots/e2e/): all 3 rounds' reveal checks PASS (song playing both
  sides, reveal done), 0 console errors; fails later on the final screen (two "Rigioca" buttons, final area).
- servers stopped. STATUS: DONE.
