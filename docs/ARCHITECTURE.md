# UNSHUFFLE — architecture & product spec

> *La hit è stata fatta a pezzi. Rimettila in ordine prima degli altri.*

A browser-only, peer-to-peer multiplayer music game. A famous song's 30s Deezer
preview is cut into musically-sensible snippets (on beats / bar lines), the
snippets are shuffled, and every player races to drag them back into the right
order. GeoGuessr-style rounds: a time limit, and as soon as the first player
confirms, a short final timer starts for everyone else. 5 rounds (configurable),
highest total wins.

**Hard constraints**
- 100% static SPA (Vite + React 19 + TypeScript). No backend of ours. `npm run build` → `dist/` hostable anywhere (relative `base: './'`, hash routing only).
- Deezer public API with **no API key**. `api.deezer.com` has **no CORS** → use **JSONP** (`output=jsonp&callback=fn`). Preview MP3s (`cdnt-preview.dzcdn.net`) and covers (`cdn-images.dzcdn.net`) **do** send `Access-Control-Allow-Origin: *` → `fetch()` + `decodeAudioData` and canvas pixel reads work.
- Preview URLs are **signed and expire ~15 minutes** after the API call (`hdnea=exp=...`). Download audio as early as possible; on failure re-fetch `/track/{id}` for a fresh URL.
- Deezer's `bpm` field is usually 0 → we do our own beat tracking.
- Networking: **PeerJS** (`peerjs` 1.5). Signaling on the **public PeerJS cloud** (0.peerjs.com; a self-hosted PeerServer is a build-time option). No backend of ours. ICE: Google + Cloudflare STUN only by default. PeerJS' old public TURN servers no longer resolve, so a **TURN relay is a deploy-time requirement** for players behind carrier-grade NAT (mobile data) or UDP-blocking firewalls: runtime credentials from `VITE_TURN_CREDENTIALS_URL` and/or static `VITE_TURN_URLS` + credentials (`src/net/peer.ts`; setup in README → Deploy).
- Fully **responsive**: phone portrait (≥ 360px wide) through desktop. Touch-first drag & drop. Safe-area insets. `100dvh`.
- UI language: **Italian** (gaming loanwords like "round", "lobby", "host" are fine).

**TS config gotchas**: `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly`
(NO `enum`, NO constructor parameter properties, NO namespaces), `noUnusedLocals/Parameters`.
Strict TS. No `any` unless truly unavoidable.

---

## 1. Product & UX

### Flow
1. **Home** — animated logo over the shader background. Nickname input, avatar
   picker (emoji in a colored badge, pick color too). Primary CTA **Crea stanza**,
   secondary **Entra** with a 5-letter room code input. Opening `#/r/CODE`
   pre-fills the code and focuses "Entra". First visit shows a 3-step
   "Come si gioca" overlay (skippable, re-openable from a `?` button).
   Only the CTAs (**Crea stanza**, **Entra**, Enter/Go in the code field) do the
   full `audioEngine.unlock()`. Home holds `useSoftAudioUnlock()`, so other taps
   (nickname, avatar) only wake the context and never claim the iOS audio session.
   The looping shuffle demo parks on its solved board after 15 s without input
   (`useUserIdle`), and the PeerJS chunk is warmed after boot idle (`afterBootIdle`:
   3 s, fonts ready, then idle) or at once on intent (hover/focus/tap on create or join).
2. **Lobby** — big room code + "Copia link" + QR code (join from phone), player
   list (avatar, name, host crown, connection dot; the host can kick after a
   "Rimuovere X?" confirmation), emoji
   reactions. Host sees: **playlist picker** (search with debounce, featured/top
   playlists shelf, quick category chips e.g. "Hit 2000", "Anni 80", "Rap
   italiano", "Rock classics", "Pop", "Dance", "Indie"; paste a Deezer playlist
   link), and **settings** (rounds 3/5/7/10, snippets 6/8/12/16 = Facile/Normale/
   Difficile/Folle, round time 60/90/120/180s, final timer 10/15/20/30s).
   Non-hosts see the same, read-only. Host CTA **Inizia partita** (enabled with a
   playlist; solo play allowed). The host's chosen playlist shows in the StartBar
   summary (record sleeve) and as the ✓ in the grid; guests get the `PlaylistHero`.
   A playlist with fewer previews than rounds disables the CTA with a gold notice
   and a "Gioca N round" shortcut (`rules.ts playlistShortfall`). On touch phones
   the bottom dock slides away while a text field has focus.
3. **Preparing** — host fetches playlist tracks, picks `rounds` popular tracks
   (+ spares), broadcasts them so every peer starts downloading all previews
   immediately. Host decodes + analyzes round 0. Tasteful loader ("Sto affettando
   la traccia…" with a spinning vinyl / equalizer).
4. **Round intro** (4s) — GeoGuessr-like card: "ROUND 2 / 5", dots progress,
   "8 spezzoni · 90s", then 3-2-1-VIA with SFX.
5. **Playing** — HUD: round x/y, my total score, big timer (ring or bar; turns
   coral + pulses in the last 10s, tick SFX), players strip (avatar gets a ✓ when
   they confirm). Center: the **snippet board**. Bottom: transport (▶ play all in
   current order / ■ stop, space bar) + big **CONFERMA** CTA. When anyone
   confirms first: banner "Giulia ha confermato — 15s!" inside the HUD (it never
   covers the countdown) and the timer jumps.
   After confirming: board locks, "In attesa degli altri…" with who's still
   playing. Late joiners spectate this round.
   - Keyboard: **⌘/Ctrl + Invio** confirms from anywhere; plain Enter belongs to
     the focused control (Enter on the focused CONFERMA button still confirms).
   - CONFERMA on an **untouched board** only arms the button ("Non hai spostato
     nulla · tocca di nuovo per confermare", 2.6 s); a second press submits, any
     move disarms it. The host also refuses to let such a submit start the final
     timer (see `game/host.ts`).
   - Confirming while the link is down shows "Invio appena torni online"; the store
     sends the queued submit right after reconnecting.
   - An exit button (top-left of the HUD, the Preparing screen and the reveal
     header, `screens/round/GameMenu.tsx`) opens "Uscire dalla partita?" for guests
     (with the rejoin code) or "Terminare la partita?" for the host (**Torna alla
     lobby** or **Chiudi la stanza**).
6. **Reveal** — album cover + title + artist (the song is finally revealed),
   the original preview plays from the start (shader reacts). Your arrangement
   animates: each block flips ✓ (lime) or ✗ (coral), then slides into the correct
   order. Points count up (correct × position points + sequence bonus). Round
   leaderboard with rank deltas. Host: **Prossimo round** (auto-advance after 25s,
   visible countdown).
   - Tapping a block **seeks the reveal song** to that snippet (the song carries on
     from there); tapping the block that is playing pauses. The song button pauses
     and resumes from the same spot ("Ferma / Riprendi / Riascolta la canzone").
     Once sorted, the block the song is in glows with a playhead sweep. Long-press
     play-all works as on the play screen.
   - After the sort beat a **"Il tuo ordine / Ordine giusto"** toggle replaces the
     tally. *Il tuo ordine*: misplaced blocks show ✗ plus a "→ Nº" chip (where they
     belong). *Ordine giusto*: correct blocks keep their ✓, misplaced ones are
     neutral with an **"era Nº"** chip (where you had put them). The chips come
     from `SnippetBoard`'s `labels` prop.
   - "Più veloce" counts only confirms that scored (points > 0), like the final
     Fulmine award, so an instant confirm of an untouched board never wins.
7. **Final** — podium (1-2-3) with confetti, total scores, per-round breakdown,
   fun stats (perfect rounds, fastest scoring confirm). Host: **Rigioca** (back to lobby,
   same players/settings, scores reset). Everyone: **Esci**. The headline teases
   "E il vincitore è…" until the winner lands on the podium. Song tiles replay each
   30 s preview on tap. Guests get a **Rivincita!** button (sends the `🔁` reaction,
   8 s cooldown) and the host sees who asked. From 768 px wide the action dock sits in
   the flow under the podium, and a floating copy slides in once it scrolls away; the
   inactive copy is `inert` + `aria-hidden`, so exactly one **Rigioca** is in the
   accessibility tree.

### Snippet board interactions (the core — must feel *satisfying*)
- Blocks in a grid, read left→right, top→bottom. Columns adapt to width and
  snippet count (e.g. desktop 8 → 4×2 or 8×1, 16 → 8×2; phone 8 → 2×4, 16 → 4×4).
- Each block: rounded, colored by its hue (random, never order-revealing), a
  crisp mirrored waveform, a subtle glossy gradient, a letter/glyph label. Bars are
  on a per-track dB scale (`board/waveLevels.ts`: RMS dB mapped between the
  track's p5 and p99.5, gamma 1.6, peak envelope on its own range), so blocks of
  the same song look clearly different while loudness still compares across them.
- Drag to reorder (insertion), neighbours animate out of the way with springs,
  lifted block scales up + tilts slightly + casts a glow, drop settles with a
  bounce. SFX pickup/swap/drop. Works with mouse, touch (no scroll conflict:
  `touch-action: none` on blocks; a drag activates after 4px with a mouse and
  10px with touch/pen, and a tiny drag that ends on its own slot counts as a
  tap) and keyboard (focus a block, space to lift, arrows to move, space to drop).
  Read-only (locked) blocks use `touch-action: pan-x pan-y`, so a swipe that
  starts on one still scrolls the page (the reveal on phones).
- Tap/click (no drag) on a block → plays that snippet alone; its waveform fills
  with a progress sweep. Tap again → stop.
- **Long-press** a block (450 ms; it visibly sinks from 140 ms) or **Shift+Enter**
  on a focused block → play-all from that position. Movement over 10 px or a
  drag cancels it; the click that follows is swallowed.
- ▶ Play all → plays snippets in the CURRENT order back-to-back, gapless; the
  playing block glows and its waveform sweeps; reordering during playback
  affects upcoming positions. When the order is correct it sounds exactly like
  the original. The TransportBar's position map cells ("Ascolta dalla posizione
  N") have 40 px-tall hit areas.

### Scoring (implemented in `src/game/scoring.ts`)
`points = 2500 × correct/n + 2500 × pairs/(n−1)` (`POSITION_WEIGHT = 0.5` of
`MAX_ROUND_POINTS`), perfect = 5000. `correct` =
exact positions; `pairs` = adjacent pairs in the right sequence. The initial
shuffle is a derangement with zero correct pairs, so an untouched board = 0.
Players who don't confirm before time's up get their last arrangement scored
(marked "tempo scaduto"). A player who was gone for the whole round and never
moved gets no result ("Nessuna risposta") instead of a 0-point timeout.
Every leaderboard ranks with `compareStanding` (`game/standing.ts`, re-exported
from `game/selectors`): score desc, then rounds played desc (spectators and late
joiners never outrank players who played), then total confirm time asc; exact
ties share a rank.

### Visual design language
**"GeoGuessr × neon club."** Deep violet-black backgrounds, a full-screen
audio-reactive WebGL shader (liquid neon plasma, violet/magenta/cyan, reacts to
bass/beat), glassy dark panels, chunky playful controls.
- Display type: **Unbounded** (`font-display`), heavy (800–900), UPPERCASE,
  slight skew (`-skew-x-6` feel) for headlines — sporty like GeoGuessr's italics.
  Body: **Manrope** (`font-sans`). Numbers/timers: **JetBrains Mono** (`font-mono`, tabular).
- Tokens live in `src/index.css` `@theme` (`ink-950…ink-50`, `violet`, `magenta`,
  `cyan`, `lime`, `gold`, `coral`, `orange`, `rounded-block`, `rounded-panel`,
  `shadow-glow-*`, `ease-spring`). Use them; don't invent new hex colors in
  components (except computed hues for snippets / album-derived accents).
- Buttons: GeoGuessr-like pill buttons with a gradient face, top inner highlight,
  a darker 4px "3D" bottom edge, press = sink 2–3px. Primary = lime (dark text),
  secondary = violet, danger = coral, ghost = glass.
- Panels: tinted glass (`bg-ink-900/70 border border-white/10`), large radius,
  soft inner highlight. **Blur is expensive**: any `backdrop-filter` on screen costs
  about 5 % GPU per frame, so persistent UI never blurs. Use `glass-flat` for
  in-flow panels, `glass-dock` (no blur, 0.95 tint) for docks and sticky bars that
  content scrolls under, and plain `glass` (real blur) only for short-lived
  overlays (popovers, the Modal backdrop). Nested glass never blurs
  (`:where(.glass,.glass-flat,.glass-dock) .glass`). `Panel variant="glass"`
  renders `glass-flat`.
- Touch targets: on `(pointer: coarse)` every `btn-sm` gets an invisible 6px
  hit-slop (36 → 48px); custom controls can use the `hit-slop` utility (needs a
  positioned element whose `::after` is free). Short landscape layouts use the
  `short:` variant (`max-height: 500px`).
- Motion: `motion` (framer-motion successor: `import { motion, AnimatePresence } from 'motion/react'`).
  Springy, snappy, never sluggish. Staggered entrances. Respect
  `prefers-reduced-motion` (reduce transforms, keep fades).
- Mobile: thumb-reachable CTAs at the bottom, ≥44px targets, safe-area padding
  (`env(safe-area-inset-*)`), no horizontal scroll, no hover-only affordances.

---

## 2. Code map & ownership

```
src/
  main.tsx, App.tsx            app shell, hash routing (#/, #/r/CODE), screen switch by store state
  index.css                    Tailwind v4 + design tokens + base/component CSS
  game/
    types.ts        (DONE)     domain types — the contract
    constants.ts    (DONE)     settings options, avatars, colors, timings
    scoring.ts      (DONE)     scoreArrangement / markPositions
    shuffle.ts                 seeded RNG, derangement-without-pairs, hue assignment
    clock.ts                   host clock offset estimation, hostNow(), useHostNow()
    host.ts                    HostGame: authoritative state machine (host only; lazy chunk)
    store.ts                   useGame zustand store (both roles) — see stub for shape
    selectors.ts, standing.ts  derived standings/stats; compareStanding = THE leaderboard order
    prefetch.ts                compressed Blob-URL prefetch of later rounds' previews
    persist.ts                 profile + session persistence (localStorage/sessionStorage)
  net/
    protocol.ts     (DONE)     ClientMsg / HostMsg
    transport.ts               public API: createHost / joinRoom / preloadTransport
    peer.ts, host.ts, client.ts  PeerJS config (VITE_PEERJS_* / VITE_TURN_*), host server (lazy), client link
    wire.ts, timing.ts, errors.ts  framing/chunking + limits, every net timing, Italian NetError copy
  lib/
    deezer.ts                  JSONP client + endpoints + track picking
    coverColor.ts              dominant/vibrant colors from a cover image (canvas)
  audio/
    engine.ts                  AudioContext singleton, load/decode cache, scheduled playback, analyser, levels
    usePlayback.ts             React hook over engine state
    sfx.ts                     synthesized UI SFX
    peaks.ts                   waveform peaks
    analysis/                  onset/tempo/beat tracking/downbeats/cutting (+ worker)
  components/
    ui/                        design-system primitives (Button, Panel, Input, Avatar, TimerRing, …) + index.ts barrel
    brand/                     Logo (animated wordmark), Vinyl, Equalizer loaders
    background/                ShaderBackground (WebGL, audio-reactive) + useBackground accent store
    board/                     SnippetBoard, SnippetBlock, Waveform, TransportBar, SnippetStrip (read-only)
    shell/                     ScreenRouter, SoundControls, ToastLayer, Connection/Resume overlays, hudInset
    reactions/                 ReactionBar + floating reactions
  screens/                     Home, Lobby (+ PlaylistPicker, Settings), Round (Intro, Play, Reveal, GameMenu), Final
```

Files marked (DONE) are the contract; don't change their exported shapes (you
may ADD exports). Stub files document the signatures you must keep: replace the
bodies, keep names/types; you may add more exports.

---

## 3. Module contracts (read the stub files for exact TypeScript)

### `lib/deezer.ts`
JSONP with unique callback names, script tag cleanup, timeout (default 10s),
Deezer error payloads (`{error:{type,message,code}}`) → `DeezerError`. Quota is
50 req / 5s per IP — the picker debounces. `TrackInfo.preview` must be non-empty
and track `readable !== false`. `pickGameTracks`: sort by `rank`, take a random
sample from the top ~50% (min pool 20), distinct artists where possible.

### `audio/analysis` + `audio/peaks.ts`
`analyzeAndCut(buffer, n)` → `CutPlan` with **exactly n contiguous segments**
(segment[i].end === segment[i+1].start). Pipeline (in a Web Worker, created with
`new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`):
mono mixdown → STFT (≈2048/512) → log-magnitude spectral flux onset envelope
(+ low-band kick envelope) → tempo via autocorrelation / comb with a log-Gaussian
prior around 120 BPM (range ~70–180, handle octave errors) → DP beat tracking
(Ellis) → meter + downbeat phase (`structure.ts estimateMeter`: 4/4 unless a 3-
or 5-beat bar is clearly better, by ≥ 0.1; strongest low-band + novelty at bar
starts) → usable region (trim quiet fade-in/out) → choose boundaries on beat
times via DP minimizing (length deviation from target)² + penalties (not on a
downbeat, low novelty, cutting mid-note, cutting through a **held centred note**)
plus a whole-plan balance penalty (`7·(max/min − 1.5)²`, re-solved inside length
windows) so snippets are ~equal length and land on bar lines (or half bars)
when possible → snap each boundary to the nearest
low-energy point within a few ms (click-free). The held-note track
(`vocal.ts`) needs the stereo side channel `(L−R)/2`, which `index.ts` sends to the
worker next to the mono mixdown (`sideOf()`; mono input still works). Fallbacks: weak beat
confidence → onset/novelty peaks; nothing → uniform. Deterministic.
`computePeaks` is cheap and cached. `plan.ts` holds the tiny helpers
(`uniformPlan`, `isValidPlan`…) so the main-thread fallback lazy-imports the pipeline.

**Guests re-align the host's cuts** (`realign.ts`): browsers decode the same MP3
with different offsets (WebKit ≈ 12 ms earlier than Chrome), so the host's cut
times would land just after each attack on an iPhone. `realignSegments(buffer,
segments)` re-snaps the host's boundaries onto this peer's decode (one shared
shift, ±30 ms max, contiguity kept) and returns the same array when the decoders
agree or the evidence is weak. Only playback times change, never segment identity
or order, so scoring is unaffected. Every screen that plays or draws a round's
segments goes through `useLocalSegments(trackKey, segments)` (`components/board`).

### `audio/engine.ts`
One `AudioContext` (lazy). On Chromium it is pre-created, suspended, at idle after
first contentful paint (`prewarm()`: the first `new AudioContext()` blocks the main
thread for ~180 ms), skipped on iOS/Firefox. `unlock()` resumes it on a gesture,
plays a silent buffer, and alone claims the audio session
(`navigator.audioSession.type = 'playback'`; on iOS < 17 a looping silent
`<audio>` element). `holdSoftUnlock()` / `useSoftAudioUnlock()` (Home): while held,
stray taps never claim the session. Graph: per-track loudness trim (BS.1770-4
integrated loudness measured once per decode, towards `TARGET_LUFS` −14, clamped
−12/+6 dB, boosts never lift the peak above −1 dBFS) → music bus → analyser → duck
→ master → safety limiter → destination; SFX have their own bus into the limiter.
Lookahead scheduler (25 ms timer, keeps ~1 s scheduled ahead, 2.5 s while the tab
is hidden) for `playSequence`, asking `getSegmentAt(pos)` each tick and re-planning
snippets that have not started yet (> 50 ms away) when the order changed.
3–5ms fades at non-contiguous joins; contiguous joins scheduled
sample-exactly with no fade (seamless). `getLevels()` from an AnalyserNode
(bass/mid/treble/energy + beat pulse via bass flux), delayed by the output latency
so visuals match what is heard (Bluetooth). `PlaybackState.pending` is true while
playback was started but the context isn't running yet (locked or interrupted):
UI shows "tocca per ascoltare" instead of a pause control. `usePlayback()` via
`useSyncExternalStore`. `sfx.ts`: tasteful synthesized sounds (oscillators +
noise + envelopes), separate gain bus, never harsh; persisted enable toggle.
`duckMusic` merges overlapping ducks (deepest dip, latest release).

### `net/transport.ts`
Host: `new Peer(PEER_PREFIX + code)`, on `unavailable-id` retry another code.
Accept connections (`reliable: true`, JSON serialization). Keepalive: a frame at
least every 2 s each way; a link silent for 10 s is dead (fires `onDisconnect`).
Handle signaling `disconnected` → `peer.reconnect()`; the host also quietly
recycles a signaling socket it has reason to doubt (thaw, back online, visible
after ≥ 20 s hidden, clients timing out together; at most once per 10 s).
`net/host.ts` (`HostServerImpl`) is lazy-loaded inside `createHost`.
Client: `new Peer()` → `connect(hostId)`; `peer-unavailable` → `NetError('room-not-found')`;
join deadline 12 s; two unanswered offers → `hostNoAnswer` ("L’host non
risponde…", code `timeout`); signaling-server failures → `NET_MESSAGES.signaling`.
Links also die early on ICE `failed` (or `disconnected` for 3 s) and on a failed
5 s probe after a network change / thaw. Reconnect: a 30 s fast phase (backoff),
then one attempt every 5 s up to 3 min of visible time (20 min wall clock), status
`reconnecting` → `open` (store re-sends `hello`) or `closed`. `closed` carries a
`ClientCloseDetail`: `host-gone` (the server answered "no such peer" for 10 s: tab
closed or left; a reloading host reclaims its code sooner), `host-closed`,
`rejected`, `dropped`, `gave-up`. Both sides send a `bye 'away'` on `pagehide`, so
the other end reacts at once instead of after the 10 s heartbeat; a bfcache
restore reconnects. The host caps client frames (`UPSTREAM_LIMITS`: 8 chunks /
64 K chars) and drops oversize connections. Timings live in `net/timing.ts`.
Peers are created by `net/peer.ts`, which owns the deploy-time configuration
(`VITE_PEERJS_*` signaling server, `VITE_TURN_*` relay, see README → Deploy; the
full variable list is its header comment) and
validates every ICE server before use, so a malformed TURN entry is dropped with a
console warning instead of breaking every connection. Default ICE: Google +
Cloudflare STUN, no TURN. Runtime TURN credentials (`VITE_TURN_CREDENTIALS_URL`)
are fetched in `preloadTransport` (no wait) and before create/join (waits ≤ 2.5 s),
cached until they expire and refreshed by a long-lived host; order: STUN, fetched
TURN, static TURN.

### `game/host.ts` — HostGame (authoritative)
Lives only on the host. Owns `RoomState`, applies `ClientMsg`s from remote
connections AND from the host's own UI (local loopback), broadcasts
`{t:'state'}` on every change (throttle to ≤ 20/s), sends `{t:'event'}`s.
Timeline: lobby → preparing(0) → intro → playing → reveal → preparing/intro(1)
… → final. Details:
- `startGame`: fetch tracks (`getPlaylistTracks` + `pickGameTracks(rounds + 4 spares)`),
  set `state.tracks` (clients prefetch all previews immediately), prepare round
  0: `audioEngine.load` → `analyzeAndCut(buffer, snippets)` → segments,
  `initialOrder` (derangement w/o correct pairs), random `hues`. On any failure
  swap in a spare track. Prepare round r+1 in the background during round r.
- Wait until every connected active player sent `ready` for the round (or
  `READY_TIMEOUT_MS`) → `intro` (`INTRO_MS`) → `playing` (`endsAt = now + roundTime`).
- `submit`: record; the first submit pulls `endsAt` in to `now + finalTimer`
  (only if that's sooner) and emits `first-submit` — except a submit whose order
  equals `round.initialOrder` (untouched board, 0 points), which never starts the
  final timer. All active connected
  players submitted → end round immediately. Timer expiry → end round using
  last `arrange` (or initialOrder) for non-submitters (`timedOut`).
  `arrange`/`submit` arriving up to `ARRIVAL_GRACE_MS` (400 ms) after `endsAt`
  still count (the round really ends at `endsAt + grace`); a confirm inside the
  grace is timed at the deadline. The host remembers its next timeline step and
  runs any overdue one before handling a message or a wake event
  (visibilitychange, pageshow, focus, online), so a throttled host tab catches up.
- End round → `results[round]` via `scoreArrangement`, add to scores, phase
  `reveal` with `nextAt = now + REVEAL_AUTO_ADVANCE_MS`. Last round → reveal
  then `final`. Only players still connected or who made a move are scored.
- Players: `hello` with known `profile.id` re-attaches (keeps score). Each hello
  carries a private `secret` (`persist.loadPlayerSecret`, localStorage, never
  broadcast); the host binds a seat to the first secret it sees for an id (saved
  in its snapshot), so a copied id with the wrong secret is rejected `duplicate`
  (two tabs of the same browser still hand the seat over). Ids are checked
  strictly (1–64 URL-safe chars), one remote tab = one identity. Mid-round the
  `welcome` carries `mine` (the player's last arrangement), so a new tab continues
  the old tab's board.
  New players mid-game get `activeFromRound = current + 1`. Lobby: remove
  disconnected players after a 15s grace (`LOBBY_GRACE_MS`), and announce the
  drop (`player-left`) only if they are still gone after `LEFT_NOTICE_MS` (3.5 s:
  a guest reload re-attaches within 1–3 s). In game: a dropped link keeps its seat
  silently for `DISCONNECT_GRACE_MS` (12 s; still shown connected, still counted
  for "everyone confirmed", the ready wait doesn't wait for it), then the player is
  marked disconnected. Players who leave (or never come back) without having played
  are removed. An explicit leave or a kick is immediate.
  Kick → `reject kicked` + drop. Max `MAX_PLAYERS`.
- Persist host state to sessionStorage so a host refresh can best-effort
  reclaim the same code and continue. After a restore only players connected in
  the snapshot are waited for (`RESTORE_GRACE_MS`).
- The store loads HostGame with `import('./host')` inside `openHost`, in parallel
  with creating the PeerJS host, so it stays out of the index chunk.

### `game/store.ts` — useGame
See stub for the exact shape. Host role: creates `HostServer` + `HostGame`, the
host's own actions call HostGame directly, and HostGame's state updates set
`room`. Client role: `joinRoom` → `hello` → `welcome`; `state` → `room`;
ping every 2s feeding `clock.ts`. Arrangement resets to
`round.initialOrder` when a new round starts; `setArrangement` sends the
`arrange` on the drop itself (changes closer than 100 ms are merged into one
trailing send; in the last 2 s every change goes out at once), and a failed send
stays pending. A `submit` (and any pending arrangement) made while the link is down
is queued and sent right after the next `hello`, without waiting for the welcome.
Audio: only the current and the next round are decoded (`decodeAhead: 1`); later
previews are prefetched as compressed Blob URLs (`game/prefetch.ts`, one download
at a time, only while nothing is decoding) and decoded from those bytes when their
round comes up. Blobs are freed after decode, on eviction and on teardown (keys:
`track:${id}`), and clients send `ready` for the
current round once its track is decoded. Toasts from events auto-expire (4s).
Errors are Italian, user-facing. A welcomed client whose link closes with
`host-gone` / `host-closed` gets `STORE_MESSAGES.hostGone` (the overlay then offers
only "Torna alla home"); other drops get `hostLost` (with Riprova). Profile persisted in localStorage (random
default name like "DJ Pinguino"). URL hash kept in sync: `#/r/CODE` while in a room.

Audio buffer key convention everywhere: **`track:${trackId}`**.

### `components/ui` (design system) — `index.ts` barrel
Button (variants primary/secondary/danger/ghost, sizes sm/md/lg, loading,
icon), IconButton, Panel, Input, CodeInput (5 boxes, paste-friendly), Avatar
(emoji+color badge, sizes, ring states: host crown, submitted ✓, disconnected
dim), AvatarPicker, Segmented (settings pills), Chip, Badge, Modal/Sheet
(bottom sheet on mobile), ToastViewport (presentational; `components/shell/ToastLayer` maps `useGame().toasts` to it),
TimerRing (+ TimerBar), AnimatedNumber (count-up), Kbd, Tooltip (desktop only),
Spinner/Equalizer, Icon set (inline SVG: play, stop, pause, check, x, crown,
copy, link, qr, users, settings, music, search, volume, mute, logout, help,
refresh, lock, trophy, clock, chevron-*, plus, kick). Styleguide page at `#/styleguide`
(documents `glass` / `glass-flat` / `glass-dock` and the `btn-sm` hit-slop).
TimerBar and TimerRing never lay out per frame: the bar is a full-width fill
translated out of a clipped track (transform only), its sweep runs only while
`running`, and the ring writes `stroke-dashoffset` only after the arc moved ≥ 0.5
device px (pure helpers in `ui/timerMath.ts`). Modal/Sheet on short screens
(`short:`) scroll as a whole with a pinned footer.

### `components/background`
`<ShaderBackground />` fixed full-screen canvas behind everything (z-index −1),
WebGL2 (WebGL1 fallback, CSS gradient fallback). Domain-warped FBM neon plasma
+ subtle grain + vignette; uniforms from `audioEngine.getLevels()` each frame
(bass → warp/brightness, beat → radial pulse, energy → flow speed). Accent
colors from `useBackground` store (`setAccent(hexA, hexB)`, e.g. album colors on
reveal) lerped smoothly. DPR-aware with a render-scale cap (≈0.5 on mobile),
pauses when hidden, reduced-motion → very slow.
- Boot: the runtime starts only after first contentful paint (PerformanceObserver
  `paint`, 800 ms timeout, two-rAF fallback) and compiles/links without blocking
  (`KHR_parallel_shader_compile`, polled each frame); the canvas fades in once the
  program links. Quality switches also compile in the background.
- Pacing (`pacing.ts`): 60 fps while something reacts; 30 fps once the scene has
  been quiet for 1 s (no music, flash, rings or accent/intensity tween, flow back
  to its idle drift). Back to 60 within a frame when music or a pulse starts.
- Adaptive quality (0 = best … 3): time-based windows, the first step jumps to the
  level a cost model says will fit, and the last resort is a 30 fps `throttled`
  flag on weak GPUs. A CPU-bound page restores the level and locks. Very low-end
  devices (deviceMemory ≤ 2 or ≤ 2 cores) start at q1. `BackgroundStats` exposes
  `targetFps`, `throttled`, `idle` and `parallelCompile`.
- Grain: a one-tile overscan layer (128 px, 64 px on retina) instead of a large
  moving layer.

### `components/board`
`<SnippetBoard trackKey segments hues order onOrderChange locked marks? />`
(marks: per-position `'correct'|'wrong'` for reveal), `<TransportBar />`,
`<SnippetStrip />` (small read-only row for results), `<Waveform />` (canvas,
DPR-aware, draws precomputed bar heights and the progress sweep via rAF from
`audioEngine.getPosition()`).
dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`, `rectSortingStrategy`) with a
`BoardPointerSensor` (activation distance per pointer type). Optional props for
screens that drive the board from outside (the reveal):
`labels?: (string|null)[]` (a per-position chip that replaces the slot badge),
`highlight?: { seg, progress() }` (a block glows and sweeps with an external
playhead), `onTapSegment?(seg)` (replaces tap-to-play). PlayView renders it through `memo`, so keep
its props referentially stable. `useLocalSegments(trackKey, segments)` (see audio/analysis) re-aligns the host's
cuts onto this peer's decode. DOM contract other areas rely on (keep stable):
`.sb-item[data-seg]` (+ `data-locked`, `data-pressing`), `.sb-slot` (and its
`::after`), `.sb-face::before`, `.sb-glow`, `.sb-block` as a size container,
`.tb-label-long` / `.tb-label-short` inside `.tb-label`, and block taps calling
`engine.playSegment(key, …, { tag: 'block:N' })`.

---

## 4. Conventions
- Functional React components, hooks, no class components. Named exports.
- Tailwind utility classes first; component-specific CSS allowed via small CSS
  files next to the component when utilities get unreadable (keyframes, masks).
- No new runtime deps without a strong reason (installed: react 19, zustand 5,
  peerjs, @dnd-kit/*, motion, canvas-confetti, qrcode, fontsource fonts).
- Everything must degrade gracefully: failed track → spare track; no WebGL →
  gradient; no audio → still playable UI with error toast.
- Keep `npx tsc -b` and `npm run build` green.

---

## 5. Dev workflow (parallel team)
- **Presentational vs connected**: screens are split into a pure `XxxView`
  (props only: room state, me, now, callbacks) and a thin connected `XxxScreen`
  that reads `useGame()` / `useHostNow()`. Views are previewable with
  `src/dev/fixtures.ts` (realistic RoomState for every phase, `FX_NOW`).
- **Labs**: throwaway preview pages as `lab/<name>.html` + `src/dev/<name>/…`
  (served by the dev server at `/lab/<name>.html`, never part of the build).
- **Dev servers side by side**: `UNSHUFFLE_VITE_CACHE=node_modules/.vite-<name> npx vite --port <port> --strictPort`.
- **Headless tests**: Playwright with the installed Chrome (`chromium.launch({ channel: 'chrome' })`).
  Pure TS logic can be run with bun: `/Users/tom/.local/share/mise/installs/bun/latest/bin/bun run file.ts`.
- **Type-check**: `npx tsc -p tsconfig.app.json --noEmit`.
- **Scripts that read the store** (`page.evaluate(() => import('/src/game/store.ts'))`,
  e.g. `scripts/qa-multiplayer/*`) need a dev server that has not hot-updated since it
  started: after an HMR update the app imports `store.ts?t=…` and the script's
  plain URL loads a second, idle store instance (it reads `role: 'none'`). Restart
  the dev server after editing `src/`, before running them.

---

## 6. Integration & end-to-end checks
- **App shell** (`src/App.tsx`, `components/shell/**`): mounts the shader, the
  screen router (Home · Lobby · Round · Final, chosen from store state), floating
  reactions, sound controls, connection/resume overlays and toasts — once. Screens
  never mount these themselves (exception: `<SoundControls placement="inline" />`
  in the lobby header, the play HUD, the reveal header and the final header — any
  inline one hides the floating control; `shellState.floatingDock` therefore
  returns `hidden` on the final screen). The floating top-right control belongs
  to the page's header area: it slides away (inert, popover closed) as soon as the
  live screen scrolls down and comes back at the top (`shell/screenScroll.ts`).
- **HUD opt-in** (`data-shell-hud`): a screen marks its pinned HUD with
  `data-shell-hud` (both `PlayHud` variants do; the fallback is
  `[data-round-view="playing"] > header`, so keep PlayView's root
  `data-round-view="playing"` with the HUD header as its first child). The shell
  measures it (`shell/hudInset.ts`) and stacks toasts and the reconnect banner
  under it, so round, score and timer stay readable. On the cramped play screen
  (phones, short landscape) at most one toast shows, and join/leave/kick toasts
  are held back while playing.
- **Toasts on the round screen**: `first-submit` / `submitted` are not toasted
  (the FirstSubmitBanner and the HUD ✓ badges say it already).
- **Audio-unlock cue**: on every in-room screen, if the AudioContext is still
  locked after 1.2 s of visible time with an open link, `ToastLayer` shows a
  persistent "Tocca/Clicca per ascoltare" toast (on the reveal: "…la canzone").
  Any tap removes it and calls `audioEngine.unlock()`; it can come back after a
  later interruption.
- **Connection overlay**: one Modal goes lost → retrying → failed ("Stanza non più
  disponibile", only "Torna alla home"). `STORE_MESSAGES.hostGone` / host left /
  closed skip straight to "L’host ha lasciato la partita" (lobby: "L’host ha chiuso
  la stanza") with no Riprova. The reconnect banner sits under the HUD; after 30 s
  it reads "L’host non risponde" and offers a small non-blocking **Esci**, while the
  transport keeps retrying for up to 3 min (a phone host may come back).
  Copy is picked by context (lobby / game / final) in `shell/connectionCopy.ts`.
- **Install prompt**: the app is installable (manifest + icons); while in a room
  `useInstallPromptGuard` suppresses Chrome's `beforeinstallprompt` mini-infobar so
  it never covers a docked CTA.
- **Audio memory**: the store decodes only the current and the next round,
  prefetches later previews as compressed Blob URLs, and evicts decoded buffers and
  blobs of finished rounds (everything on lobby/final).
- **Resume**: a client reloading its tab retries "room not found" for ~15 s,
  so a host reloading at the same time is picked up again.
- **E2E**: `node scripts/e2e/smoke.mjs` (dev server on :5220) plays a full real
  2-player game over the public PeerJS cloud — desktop host + touch phone guest,
  3 rounds, reveal, podium, Rigioca — and screenshots every phase for both
  (`scripts/e2e/shots/`). `CHAOS=1` also reloads both tabs mid-round.
  `node scripts/e2e/static.mjs` (after `npm run build`, `vite preview` on :5221;
  `SUBPATH=1` adds a deep sub-path) checks the production build: home, the
  analysis worker chunk, a solo game with waveforms. `node scripts/e2e/check-bundle.mjs`
  asserts no `lab/` / `src/dev/` code reaches `dist/`.
- **Page head** (`index.html` + `vite.config.ts`): `index.html` holds the static
  tags (viewport, theme colour, icons, `manifest.webmanifest`, `og:` text). The
  `unshuffle:head-tags` plugin in `vite.config.ts` adds the rest at build time:
  `<link rel=preload>` for the emitted latin Unbounded + Manrope files (looked up
  in the bundle, so they always match the CSS's hashed URLs), `preconnect` /
  `dns-prefetch` for the signaling server (from `VITE_PEERJS_*`, same rules as
  `net/peer.ts`), the TURN credentials endpoint and Deezer, and the `og:image` tags
  (absolute with `VITE_SITE_URL`). Keep every URL relative (`./`): the build must
  work from any sub-path. `index.html` also carries a tiny inline boot screen
  (`#boot`, right after `#root`) for the gap between the stylesheet and React's
  first render on slow connections; `#root:not(:empty) + #boot` hides it, so the
  shell must render into `#root` at once and nothing may be inserted between the two.
- **Tailwind sources**: `src/index.css` scans only `src/` and `lab/`. Scanned files
  become watch dependencies, and editing one outside the module graph (it used to
  be `README.md`, reports in `scripts/`…) full-reloads every open dev page.
  `node scripts/e2e/reload.mjs` checks that a host and a guest reloading at the
  same moment both land back in the room.
