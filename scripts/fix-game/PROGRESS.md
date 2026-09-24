# fix-game progress log

Started fresh (no earlier attempt found). Baseline: host.test 41 pass, store.test 29 pass.

## Plan (all findings verified against the code first)
- F1/F3 late drops lost: host ARRIVAL_GRACE_MS (endRound at endsAt+400ms, arrivals accepted until then);
  store sends arrange at once (leading edge, 100ms coalescing, always immediate near the deadline).
- F12 overdue: host phaseDue + catchUp() on every message / handleLocal / visibility wake; no firstSubmit after endsAt.
- F2 disconnect grace: in game a dropped link keeps the seat (connected stays true, no toast) for DISCONNECT_GRACE_MS;
  still blocks "everyone confirmed", not the ready wait; leave/kick immediate.
- F7 ghosts: scoring only for players with a live link or activity in the round; never-played players that are gone are removed.
- F4/F10 seat takeover: per-profile secret in hello (localStorage, never broadcast), TOFU on host, kept in snapshot; strict ids.
- F13 hello abuse: one identity per connection and per remote peer; no flushNow/second welcome on re-hello.
- F15 restore: only players connected in the snapshot are restoredPending; host ready flag not restored.
- F9 takeover arrangement: welcome carries the player's own host-side arrangement; resync always sends the shown one.
- F14 confirm offline: submit/arrange kept pending, flushed right after hello when the link reopens.
- F11 spoiler toast: neutral copy before the reveal.
- F6/F16 memory: decode only current + next round; compressed bytes of later rounds prefetched as Blob URLs.
- F18 lazy HostGame import.
- F8/F17 ranking: score desc, rounds played desc, total time asc.
- F5 scoring: POSITION_WEIGHT 0.5.

## Status per finding
(updated as work proceeds)
- [host done] F1/F3 host side (ARRIVAL_GRACE_MS 400 in constants.ts, armRoundEnd, atMs clamped to endsAt), F12 (phaseDue + catchUp on
  onMessage/handleLocal/wake events; pastDeadline guard; no firstSubmit after endsAt), F2 (DISCONNECT_GRACE_MS 12 s, armDrop/departed,
  isReachable for ready wait), F7 (endRound scores only link-or-moved players; neverPlayed players removed on departure / restore grace),
  F4/F10 (secret TOFU, snapshot secrets, strict isPlayerId in persist.ts), F13 (one id per connection + per remote peer, no flushNow),
  F15 (restoredPending = connected in snapshot; host ready dropped), F9 host side (welcome.mine), F5 (POSITION_WEIGHT 0.5).
  scripts/host/host.test.ts updated + 14 new tests: 57 pass.
- [store done] F1/F3 client (arrangeMinIntervalMs 100 leading-edge + arrangeUrgentMs 2000), F14 (sendSubmit/submitPending/submitOnLink,
  flushPendingMoves right after hello on 'open', failed arrange stays dirty), F9 (resync always sends; welcome.mine adopted by a tab new
  to the round), F11 (neutral toast), F6/F16 (decodeAhead 1 + src/game/prefetch.ts Blob-URL byte prefetch, released on decode/evict/
  teardown), F18 (dynamic import('./host') in openHost), F4/F10 client (hello.secret via persist.loadPlayerSecret).
- [selectors done] F8/F17 compareStanding (score, roundsPlayed desc, totalTimeMs) exported; used by computeStandings/RoundStandings.
  scripts/store/store.test.ts updated + 8 new tests: 36 pass.
- [F18 verified] plain build: host-*.js chunk = game/host.ts + hostRules.ts + scoring.ts (35 kB); index 409.9 → 388 kB.
- [E2E] snapshot build (scripts/fix-game/vite.fix-game.config.ts → scripts/fix-game/dist, lab/fix-game.html exposes window.__fg),
  vite preview :5458, node scripts/fix-game/e2e.mjs → all 17 checks pass (log e2e-run1.log, shots/): late drop 118 ms before endsAt
  scored; guest reload during final timer → round kept, no player-left, scored on post-reload confirm; decoded ≤ 2 tracks, 3/3 previews
  downloaded; copied id refused with 'duplicate'; seat moved to a 2nd tab keeps the arrangement and is scored on it; 0 console errors.
- [E2E 2] scripts/fix-game/e2e-ghost.mjs (store.ts gained a tiny `storeDebug` export for labs): ghost closing its tab right before the
  start is removed ~12 s after the start and never scored; netDebug.breakLink on the guest mid-final-timer → host keeps the round
  running, guest stays connected (16 samples), no player-left toast, guest confirms after the reconnect. All pass (only 404 = favicon probe).
- [extra] host ignores anything a rejected connection still sends (rejectedConns); all 7 scripts/qa-code/*.repro.ts (which assert the
  old bugs) now fail = bugs gone. e2e.mjs re-run on the final code: all pass (e2e-run2.log). Toast copy screenshots: shots/toast-*.png.
  Preview server on :5458 stopped.

## Skipped / partial
- F12 optional "host in pausa" hint: needs a protocol field + UI in other areas; the correctness part (catch-up) is done.
- F14 UI part ("Invio appena torni online" on CONFERMA while offline): round UI area → crossAreaRequests.
- F5 docs: ARCHITECTURE.md formula (4000/1000 → 2500/2500) → crossAreaRequests. HowToPlay copy is still accurate.
- F8/F17 other rankers: screens/final/stats.ts + screens/round/model.ts rankOf still use score/time only → crossAreaRequests
  (use compareStanding from game/selectors).
- F18 net/host.ts is still in the index chunk (imported statically by net/transport.ts) → crossAreaRequests.
