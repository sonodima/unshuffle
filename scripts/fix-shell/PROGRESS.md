# fix-shell progress log

Run 1 started (no previous log found).

## Findings
1. [MINOR] Connection-lost dialog false promise — FIXED (copy by context; failed Riprova morphs the same dialog into "Stanza non più disponibile", home only)
2. [MINOR] Phone toasts cover HUD during round — FIXED (stack under measured HUD, 1 toast on cramped play, roster toasts quiet while playing)
3. [MINOR] Floating sound button covers reveal content — FIXED jointly: reveal fixer now mounts an inline control in the reveal header (floating hides); shell adds scroll-away for the top-right floating control everywhere else
4. [MINOR] Connessione persa copy in lobby / host gone — FIXED (lobby/game/final copy; host-gone cause → home-only; needs store message for host-gone → crossArea)
5. [POLISH] Reconnecting pill covers phone HUD — FIXED (banner under HUD; toasts under banner when they'd collide; 'Ti ricolleghi da solo…' detail after 5 s)
6. [POLISH] No 'Attiva audio' cue after resume on phone — FIXED (persistent toast cue on every in-room screen after 1.2 s locked; reveal: 'Tocca per ascoltare la canzone'); engine 'pending' state → crossArea

### Run 1 — implementation notes
- New pure module src/components/shell/connectionCopy.ts (dialog copy by context lobby/game/final × cause network/host-gone; exit notices incl. new 'gone' reason).
- ConnectionOverlay rewritten: one dialog morphs lost → retrying → failure (no second dialog); host-gone cause detected via optional STORE_MESSAGES.hostGone/hostLeft/hostClosed keys (cross-area request to store); banner hidden while dialog open; banner under play HUD.
- New src/components/shell/hudInset.ts: lazy tracker of the pinned play HUD bottom ([data-shell-hud] or [data-round-view="playing"] > header) + banner-bottom store.
- ToastLayer: under HUD/banner, 1 toast max on cramped play screen, roster toasts quiet while playing on phones; audio unlock cue (persistent toast) on all in-room screens.
- New src/components/shell/screenScroll.ts + SoundControls: top-right floating button scrolls away with the page (reveal/final/home), returns at top.

- Tests: scripts/shell/connection.test.ts (12 pass), scripts/shell/shell.test.ts (7 pass). Lab: lab/fix-shell.html + scripts/fix-shell/shoot.mjs (30/30 checks).
- Banner polish: phones keep both top corners free (px-16), meta never truncates, compact copy ('Connessione persa' + 'Riprovo a collegarmi…' → after 5 s 'Riprovo… rientri da solo.'); host: 'Server perso, riprovo…'.
- Toasts only stack under the banner when the toast column would hit it (desktop right column clears a centered banner).
- Audio cue hidden while the link is not open (no toast over the connection dialog).
- ResumeOverlay failure: room-not-found → 'Stanza non più disponibile' (no 'Controlla il codice'); scripts/shell/resume.mjs accepts both titles.
- Real E2E (prod snapshot scripts/fix-shell/dist on :5456, PeerJS cloud): scripts/fix-shell/hostgone.mjs ALL OK (host closes tab in lobby → one dialog with lobby copy after ~38 s; Riprova → same dialog becomes 'Stanza non più disponibile' in 4.7 s; home closes it).
- Resume failure check (scripts/fix-shell/resume-5406.mjs): OK.
- Lab suite scripts/fix-shell/shoot.mjs: 32/32.
- Re-ran hostgone E2E on a fresh snapshot after the net fixer's edits settled: ALL OK (dialog after 39.8 s, retry answer in 5.2 s, single dialog throughout).
- Lab flakes seen only when other fixers' builds/edits trigger dev-server page reloads (vite.log 'page reload'); scenarios pass when re-run.
- Lint (oxlint) on my files: warnings only (same classes as pre-existing ones), no errors. tsc: my files clean.

## Status: DONE (all 6 findings fixed). Servers :5406 / :5456 stopped at the end of run 1.
