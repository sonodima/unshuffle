# fix-lobby progress log

Owner-fixer for src/screens/lobby/**. Findings 1-6 from QA (mobile/design/ux).

## Status
- [x] 1 MAJOR roster overflow: PlayerList ul grid-cols-1 (minmax(0,1fr)) + li min-w-0. Verified 360/390: no offscreen kick/edit buttons, names truncate (shots/after-long-*).
- [x] 2 MAJOR desktop layout: host >=1280 = [code+players | picker | rules], no PlaylistHero for host anywhere
      (dock/sheet summary now shows the chosen record w/ vinyl = single "chosen" display + grid check). Host 1024-1279 = [code+players+rules | picker].
      Guest >=1280 = [code+players | hero(row)+HowToPlay | rules]. Side cols clamp(300px,26vw,368px). max-height:800 "dense": header h-16,
      compact RoomCodeCard, SettingsPanel density=compact (Segmented sm), dock py-2.5 + lg CTA. Picker title nowrap, caption via @container.
      RoomCodeCard compact: tiles + button icons sized by @container (fits 320px column).
- [x] 3 MINOR phones: useTypingInLobby() hides the sheet (translate-y-full, opacity 0, inert) while a text field has focus; on layout-viewport resize the focused field is scrollIntoView(center). interact.mjs verifies.
- [x] 4 MINOR rules.ts playlistShortfall(): StartBar disables start + gold notice; "Gioca N round" shortcut (StartBar.onUpdateSettings) when a smaller round option fits. Host-side preview check kept.
- [x] 5 MINOR plural: rules.ts tracksWord() used in PlaylistHero badge + PlaylistCard (+ gold "troppo corta" on cards with < MIN_ROUNDS tracks).
- [x] 6 POLISH invite link: invite.ts splitDisplayUrl() + CSS middle truncation in the QR sheet (head truncates, #/r/CODE tail fixed).

## Notes
- Backups of original lobby files: scripts/fix-lobby/orig/
- Lab: /lab/fix-lobby.html (src/dev/fix-lobby/main.tsx) params role, pl=1|0|tiny|long, n, names=long, tab, rounds, fail, url=long
- Screens: node scripts/fix-lobby/shoot.mjs <tag> "<query>" p390 p360 d1440 d1280 d1366 d1024 (dev server :5403)
- Unit tests: scripts/lobby/lobby.test.ts (rules + invite helpers) - 9 pass
- Interaction checks: node scripts/fix-lobby/interact.mjs (ALL PASS at first run)
- interact.mjs: 34 checks ALL PASS (short playlist, typing hide incl. narrow-desktop no-hide, long-name kick, QR tail, rules above dock at 1440x900/1280x720/1366x768/1536x864/1280x800 host+guest, picker title 1 line)
- Snapshot build scripts/fix-lobby/dist + preview :5453: scripts/e2e/static.mjs PASS; scripts/e2e/smoke.mjs lobby+3 rounds pass, then FAILS at Final
  ("Rigioca" strict-mode: 2 buttons on the final screen) -> final area, reported cross-area. Log: scripts/fix-lobby/smoke-run2.log
- Extra polish: guest empty hero copy no longer repeats the start bar; small empty sleeve hides the disc; code-card button icons hidden by @container
  (fixes cramped "Copia link" at 390 and in the 320px desktop column); "Tempo per round" hint shortened to "Per riordinare".
- Typing-hide gated to touch devices (!useCanHover) so narrow desktop windows keep the CTA.
## DONE
