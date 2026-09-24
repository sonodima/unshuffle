# fix-round progress log

Area: src/screens/round/** (except reveal/**). 2026-09-24. STATUS: DONE (all 14 findings fixed and verified).

## Fixed
1. [MAJOR] Exit during a match — new GameMenu.tsx (RoundMenuProvider in RoundView wraps preparing/intro/playing/reveal;
   GameMenuButton in the play HUD top-left and on the Preparing screen) + menuContext.ts. Guest: sheet "Uscire dalla partita?"
   → leave() (host marks disconnected at once, rejoin code shown). Host: "Terminare la partita?" → "Torna alla lobby"
   (backToLobby) or "Chiudi la stanza" (leave → reject 'closed'). RoundScreen passes leave/backToLobby. Ctrl+Enter paused while open.
2. [MAJOR] Phone banner hid the countdown — banner now lives in PlayHud: compact = takes over the HUD card's first row only
   (58px, one-line title, name truncates, "ha confermato!" never), timer bar below stays visible; seconds are live.
3. [MAJOR] Wide HUD overflow on tablets — minmax(0,1fr) side tracks, md tier (<1024): ring 100, tighter panels, 22px numbers,
   strip max 4 overlapped, sound button moves to the left column; lg: 6 overlapped; xl: 7. Ring centred (offset 0) and no
   overflow at 768/820/1024/1180/1440 with 10 players.
4. [MAJOR] Untouched CONFERMA — first press on the initial shuffle arms the button ("Non hai spostato nulla · Tocca/Clicca di
   nuovo per confermare", violet, shake, 2.6 s); second press submits. Keyboard: Ctrl/⌘+Enter twice.
5. [MINOR] Intro 3-2-1 — headline recedes (scale .64, origin bottom), facts dim, ring grows to clamp(150px,24vh,220px) (CSS
   .rs-cd), digit = 56% of ring, per-tick punch + shader pulse(0.35), 3 violet-white / 2 magenta / 1 lime (ring + glow too).
   'staged' holds through 0 so nothing bounces back during the exit; ring glow no longer clipped (svg overflow-visible).
6. [MINOR] Plain Enter confirm removed — only Ctrl/⌘+Enter (or Enter on the focused button). Hint row: "⌘/Ctrl + Invio conferma".
7./11. Desktop banner over the board — wide banner covers the left stat panel (panel fades), next to the ring; never reaches
   the board (banner bottom 118-120 vs board top 152); title wraps to 2 lines instead of losing the name; exit button stays
   uncovered from lg. "Ultimi secondi" pill moved to -bottom-[18px].
8. [POLISH] 'Confermato' spill — title truncates, side slot 300→320px below lg, aside strip max 3 there.
9. [POLISH] Copy — Clicca/Tocca by useCanHover in preparing tip, intro, dock hints, spectator card.
10. [POLISH] Desktop preparing — ≥1024×700: vinyl 420, 40px heading, 60px step rows / 16px labels, md avatars, grid
   min(1100px,90vw), tip under the checklist. Also tightened for ≤500px-tall landscape.
12. [POLISH] HUD rank tie-break — rankOf uses score desc + total confirm time asc (model.ts totalTimes), same as computeStandings.
13. [POLISH] Spectator card — steps aside after 3.5 s or on the first tap on the board (taps pass through to the board).
14. [POLISH] Re-renders — memo(SnippetBoard) as Board, memo(ConfirmDock), stable waiting list: connected RoundScreen idle =
   0 renders/s for SnippetBoard/DndContext/SortableContext/ConfirmDock/TransportBar (was 4–6/s).

## Verification
- tsc -p tsconfig.app.json: my files clean. oxlint: no new warnings in my files.
- bun test scripts/round/model.test.ts: 17/17 (added tie-break, totalTimes, sameOrder tests).
- lab: lab/fix-round.html (+ src/dev/fix-round/main.tsx: players=N, me=, name2=, tie=1, menu events).
- scripts/fix-round/shots.mjs (screens + measurements on 10 viewports), interact.mjs (21 checks, all PASS),
  armed-measure.mjs (armed label fits 360→1440), renders.mjs, flow-frames.mjs.
- exit-e2e.mjs vs snapshot build (real PeerJS + Deezer, 3 players): all PASS.
- scripts/e2e/smoke.mjs vs snapshot: every round check PASS (3 rounds); fails later on the final screen
  (two "Rigioca" buttons — final area, in progress by another fixer).
