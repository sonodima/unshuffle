# UNSHUFFLE — architecture

> *La hit è stata fatta a pezzi. Rimettila in ordine prima degli altri.*

A browser-only, peer-to-peer multiplayer music game. A song's 30 s Deezer
preview is cut on beats / bar lines into 6–16 snippets, the snippets are
shuffled, and every player races to drag them back into the right order. Rounds
have a time limit, and the first confirm starts a short final timer for everyone
else. How to play, run and deploy it: [`README.md`](../README.md).

## Constraints

- **100 % static SPA**: Vite + React 19 + TypeScript, no backend. `dist/` must
  work from any folder of any host: relative `base: './'`, hash routing (`#/`,
  `#/r/CODE`), every URL relative.
- **Deezer, no API key.** `api.deezer.com` sends no CORS headers, so the API is
  called over JSONP (`output=jsonp&callback=…`). Preview MP3s
  (`cdnt-preview.dzcdn.net`) and covers (`cdn-images.dzcdn.net`) do send
  `Access-Control-Allow-Origin: *`, so `fetch()` + `decodeAudioData` and canvas
  pixel reads work. Preview URLs are signed and expire about 15 minutes after the
  API call, so audio is downloaded early and a failed download re-fetches
  `/track/{id}` for a fresh URL. Deezer's `bpm` is usually 0: tempo and beats are
  our own analysis.
- **Networking is WebRTC via PeerJS 1.5**, signaling on the public PeerJS cloud
  (`0.peerjs.com`) unless a PeerServer is configured at build time. ICE defaults to
  Google + Cloudflare STUN only; a TURN relay (runtime credentials endpoint and/or
  static credentials) is a deploy-time option that players on mobile data or
  UDP-blocking networks need.
- **Phone first**: portrait from 360 px wide to desktop, touch-first drag & drop,
  safe-area insets, `100dvh`. **Italian UI** (loanwords like round, lobby, host are
  fine).

## Source layout

```
src/
  main.tsx, App.tsx     entry + app shell (shader, screen router, global chrome)
  index.css             Tailwind v4, design tokens (@theme), shared component CSS
  game/
    types.ts            domain types shared by host, network and UI (all JSON-serialisable)
    constants.ts        settings options, scoring weights, phase timings, avatars, colours, reactions
    host.ts             HostGame: the authoritative state machine (host only, lazy chunk)
    hostRules.ts        pure validation / sanitising / result building used by HostGame
    store.ts            useGame zustand store, both roles; owns the connection and audio loading
    selectors.ts        derived state + stable selector hooks
    standing.ts         compareStanding: the one leaderboard order
    scoring.ts          scoreArrangement
    shuffle.ts          crypto RNG, scrambledOrder (initial board), random hues
    clock.ts            host clock offset from ping/pong, hostNow(), useHostNow()
    prefetch.ts         compressed Blob-URL prefetch of later rounds' previews
    persist.ts          profile (localStorage) and session / host snapshot (sessionStorage)
    history.ts          listening history: fading play counts, digest sent in hello
    names.ts            default nicknames, name sanitising
  net/
    protocol.ts         ClientMsg / HostMsg, reject reasons
    transport.ts        public API: createHost, joinRoom, preloadTransport, normalizeRoomCode
    host.ts, client.ts  host server (lazy) and client link with auto-reconnect
    peer.ts             PeerJS loading, VITE_PEERJS_* / VITE_TURN_* config, ICE validation
    wire.ts             envelope: heartbeats, goodbyes, chunking, size limits
    timing.ts           every transport timing
    errors.ts           NetError + Italian messages
    runtime.ts          leak-proof timers/listeners, cancellable waits, crypto randomness
  lib/
    deezer.ts           JSONP client, endpoints, playlist parsing, pickGameTracks
    playlistCategories.ts  featured playlists and category chips of the picker
    coverColor.ts       vivid accent colours from an album cover
    router.ts           minimal hash router
  audio/
    engine.ts           AudioContext, loading/decoding, loudness, scheduled playback, levels
    usePlayback.ts      React hooks over the engine state
    sfx.ts              synthesised UI sounds
    peaks.ts            cached waveform peaks
    analysis/           beat tracking + cutting pipeline (Web Worker), realign.ts
  components/
    ui/                 design-system primitives, one barrel (index.ts)
    brand/              Logo, Vinyl, Equalizer
    background/         WebGL shader background + useBackground accent store
    board/              SnippetBoard, SnippetBlock, Waveform, TransportBar, SnippetStrip
    shell/              ScreenRouter, overlays, toasts, sound controls, HUD inset
    reactions/          ReactionBar
  screens/              home/, lobby/, round/ (+ reveal/), final/
```

## Game flow

The host owns one `RoomState` (`game/types.ts`) and broadcasts it whole on every
change; every screen renders from it. All timestamps in it are **host clock**
milliseconds; clients convert with the offset from `game/clock.ts`.

```
lobby → preparing(0) → intro → playing → reveal → preparing/intro(1) → … → final
```

| Phase       | What happens |
|-------------|--------------|
| `lobby`     | Players join; the host picks a playlist and settings (rounds 3/5/7/10, snippets 6/8/12/16, round time 60–180 s, final timer 10–30 s). |
| `preparing` | The host picks the tracks and publishes them (every peer starts downloading), then downloads, analyses and cuts the round's preview and waits until every active player has it decoded. |
| `intro`     | Round card and 3-2-1 countdown (`INTRO_MS`, 4 s). |
| `playing`   | Players reorder the board. `endsAt` = start + round time; the first confirm pulls it in to now + final timer. |
| `reveal`    | Song revealed, boards sorted, round leaderboard. Auto-advances after `REVEAL_AUTO_ADVANCE_MS` (25 s) or when the host skips. |
| `final`     | Podium, per-round breakdown, awards. The host can reset to the lobby (**Rigioca**) with the same players and settings. |

Screens: `ScreenRouter` picks Home / Lobby / Round / Final from the route, the
store role and the phase. Home is in the entry chunk; Lobby, Round and Final are
lazy chunks preloaded after boot. Each screen is a pure `XxxView` (props only) plus
a thin `XxxScreen` that reads the store, and the logic a view derives from
`RoomState` lives in pure modules (`screens/round/model.ts`,
`screens/round/reveal/model.ts`, `screens/final/stats.ts`, `screens/lobby/rules.ts`)
that the unit tests cover.

## Scoring and ranking

`scoreArrangement` (`game/scoring.ts`), for a board of `n` snippets:

```
points = 5000 × 0.5 × correct/n  +  5000 × 0.5 × pairs/(n − 1)      (a perfect board = 5000)
```

`MAX_ROUND_POINTS = 5000` and `POSITION_WEIGHT = 0.5` (`game/constants.ts`):
half the round for snippets in their exact position, half for adjacent pairs in
the right sequence, so a song rebuilt in order but shifted by one block still
beats a scrambled board with a few lucky spots. The initial board
(`scrambledOrder`) has no snippet in place and no correct pair, so an untouched
board scores 0.

A player who doesn't confirm is scored on their last arrangement (`timedOut`,
time = the whole round). A player who was gone for the whole round and never
moved gets no result instead of a 0. Every leaderboard ranks with
`compareStanding` (`game/standing.ts`): score, then rounds played (a late joiner
never outranks someone who played), then lower total confirm time; exact ties
share a rank.

## Networking

**Topology.** A star: the host's PeerJS id is `PEER_PREFIX + code`
(`unshuffle-v1-KXQPM`), and each client opens one reliable, ordered JSON data
channel to it. Room codes are 5 letters without I and O.

**Protocol** (`net/protocol.ts`, `PROTOCOL_VERSION = 1`):

| Client → host | |
|---|---|
| `hello {profile, version, secret?}` | first message on every connection; a known `profile.id` re-attaches its seat |
| `profile {profile}` | name / avatar / colour edited in the lobby |
| `ready {round}` | this round's audio is decoded here |
| `arrange {round, order}` | live arrangement (scored if the player never confirms) |
| `submit {round, order}` | confirm |
| `reaction {emoji}`, `ping {c}`, `leave` | |

| Host → client | |
|---|---|
| `welcome {you, state, hostNow, mine?}` | `mine` = the player's live board mid-round, so a new tab continues it |
| `state {state, hostNow}` | the full `RoomState` |
| `event {event}` | transient `GameEvent`s (joined, left, first-submit, submitted, reaction, kicked, info) |
| `pong {c, h}` | clock sync |
| `reject {reason}` | `full`, `version`, `kicked`, `closed`, `duplicate` |

Host-only actions (settings, start, next round, kick, back to lobby) never travel
over the wire: they exist only on the host, whose store calls `HostGame` directly.
The host's own player actions go through `HostGame.handleLocal`, the same path as
remote messages.

**Transport** (`net/transport.ts`, `host.ts`, `client.ts`, `wire.ts`). Every app
message rides in a small envelope: whole messages, ordered chunks for anything
near PeerJS' 16 KB frame limit (a full `RoomState` often is), heartbeats and
goodbyes. A frame goes out at least every 2 s each way and a link silent for 10 s
is dead; hints (ICE `failed`, ICE `disconnected` for 3 s, a network change, a thawed
tab) arm a 5 s probe so a dead path is noticed sooner. Both sides send `bye 'away'`
on `pagehide`, so a closed tab is noticed at once. The host caps client frames
(`UPSTREAM_LIMITS`: 8 chunks / 64 K characters) and drops oversized connections.

- **Client**: join deadline 12 s; an unknown code → `NetError('room-not-found')`.
  After a drop it reconnects with the same PeerJS id: fast retries for 30 s of
  visible time, then one attempt every 5 s up to 3 minutes (20 min wall clock), so
  a phone host that switched apps is picked up again. The terminal `closed` status
  carries a reason: `host-gone` (the signaling server reported the host's id as
  missing for 10 s), `host-closed`, `rejected`, `dropped`, `gave-up`.
- **Host**: on `unavailable-id` it picks another code (or keeps retrying its own
  for ~11 s when reclaiming after a reload). A signaling drop → `peer.reconnect()`;
  a socket it has reason to doubt (all clients timed out, frozen timers, back
  online, visible after ≥ 20 s hidden) is quietly recycled, at most once per 10 s.
  Data channels survive signaling drops.
- **Configuration** (`net/peer.ts`, whose header lists every variable):
  `VITE_PEERJS_*` for the signaling server, `VITE_TURN_CREDENTIALS_URL` /
  `VITE_TURN_URLS` + credentials for TURN. ICE order: STUN, fetched TURN, static
  TURN. Runtime credentials are fetched in the background by `preloadTransport`
  (Home) and before create/join (waiting at most 2.5 s), cached until they expire,
  and refreshed in place on a long-lived host's Peers. Every ICE server is
  validated first: a malformed entry would make `RTCPeerConnection` throw for every
  connection, so it is dropped with a `[net] …` console warning.
- PeerJS itself (~100 kB) and the host side are lazy chunks.

## Host: `HostGame` (`game/host.ts`)

Runs only in the host's tab, loaded with `import('./host')` when a room is
created. It owns the `RoomState`, applies `ClientMsg`s, broadcasts state
(coalesced to ≤ 20/s, phase changes at once) and emits events. Every side effect
(Deezer, audio, analysis, clock, timers) goes through injectable `HostGameDeps`,
so the whole machine runs headless in the unit tests.

- **Start**: `getPlaylistTracks` → `pickGameTracks(rounds + 4 spares, exposure)`.
  Exposure is how much the room has heard a track: the host's own history plus
  every guest's `hello` digest (validated, ≤ 400 entries) plus the songs played
  in this room since. Each browser records a song when its round is revealed
  (`game/history.ts`: a play weighs 1, halving every 30 days; a replay within
  15 min is the same play). Tracks are taken by rounded exposure, least heard
  first (tracks outside the popular top half count as heard by one more
  player), then by popularity-weighted random order, one per artist where
  possible. The tracks are broadcast at
  once so every peer starts prefetching, then round 0 is prepared: download →
  `analyzeAndCut(buffer, snippets)` → segments, `scrambledOrder`, random hues. A
  track that fails to download or cut (30 s per step) is replaced by a spare; if
  every analysis fails, an even split of decoded audio is used. Round r + 1 is
  prepared in the background while round r is played.
- **Ready wait**: once a round is published the host waits until every reachable
  active player sent `ready`, or `READY_TIMEOUT_MS` (15 s), then `intro` → `playing`.
- **Submit**: the first confirm pulls `endsAt` in to now + final timer (only if
  sooner) and emits `first-submit`, except a submit of the untouched initial
  board, which never starts the final timer. When every present active player has
  confirmed, the round ends at once. `arrange` / `submit` arriving up to
  `ARRIVAL_GRACE_MS` (400 ms) after `endsAt` still count, and a confirm inside that
  grace is timed at the deadline.
- **Catch-up**: timers in a hidden tab fire late or not at all, so the host
  remembers its next timeline step and runs any overdue one before handling a
  message or a wake event (`visibilitychange`, `pageshow`, `focus`, `online`).
- **Players**: a `hello` with a known id re-attaches the seat and score. Each
  hello carries a private `secret` (localStorage, never broadcast); the host binds
  a seat to the first secret it sees, so a copied id is rejected `duplicate`. Late
  joiners get `activeFromRound = current + 1` and spectate until then. At most
  `MAX_PLAYERS` (10). In the lobby a dropped player is removed after 15 s
  (`LOBBY_GRACE_MS`) and announced only if still gone after 3.5 s
  (`LEFT_NOTICE_MS`, a reload re-attaches sooner). In game a dropped link keeps its
  seat silently for 12 s (`DISCONNECT_GRACE_MS`), then shows as disconnected;
  players who leave without having played are removed. Leave and kick are
  immediate.
- **Host reload**: the state is snapshotted to sessionStorage (at most 10 minutes
  old to resume). A reloaded host reclaims its code and continues, waiting
  `RESTORE_GRACE_MS` (12 s) for the players who were connected.

## Client store: `useGame` (`game/store.ts`)

One zustand store for both roles; connections, timers and prefetch bookkeeping
live in a module-level session object so callbacks from an old room are ignored.

- **Host role**: creates the `HostServer` and `HostGame` in parallel; state
  updates from `HostGame` set `room` directly.
- **Client role**: `joinRoom` → `hello` → `welcome`; `state` → `room`; a ping every
  2 s feeds the clock offset. After a reconnect the store re-sends `hello`, then
  anything queued while offline (a pending arrangement, a confirm).
- **Arrangement**: reset to `initialOrder` at each round start, sent on every drop
  (changes less than 100 ms apart are merged, except in the last 2 s of a round)
  and saved to sessionStorage so a reload continues the board.
- **Audio**: only the current and the next round are decoded (a decoded preview is
  ~11 MB of PCM); later previews are prefetched as compressed Blob URLs
  (`game/prefetch.ts`, one at a time, only while nothing decodes). Finished rounds
  are evicted. Buffer keys are always `track:${trackId}`. A client sends `ready`
  once the current round is decoded.
- **Session**: the profile persists in localStorage (random default name like "DJ
  Pinguino"); the hash follows the room (`#/r/CODE`). After a reload
  `resumeSession` rejoins, retrying "room not found" for 15 s so a host reloading
  at the same moment is found again. Errors are Italian and user-facing.

## Audio

**Engine** (`audio/engine.ts`). One lazy `AudioContext`, pre-created (suspended)
at idle after first paint on Chromium, where creating it blocks the main thread
for ~180 ms. `unlock()` resumes it on a gesture and alone claims the audio session
(`navigator.audioSession.type = 'playback'`, or a looping silent `<audio>` on iOS
< 17); on Home, `useSoftAudioUnlock()` makes other taps only wake the context.
Graph:

```
source → fade gain → loudness trim → music bus → analyser → duck → master ─┐
SFX bus → SFX volume ──────────────────────────────────────────────────────┴→ limiter → out
```

Every decoded track is measured once (BS.1770 integrated loudness) and trimmed
towards −14 LUFS (−12 / +6 dB, boosts never push the peak above −1 dBFS). A
lookahead scheduler (25 ms tick, ~1 s ahead, 2.5 s while hidden) plays snippet
sequences, asking for the segment at each position every tick, so reordering
during play-all changes the snippets that haven't started. Contiguous joins are
sample-exact with no fade, so the right order sounds exactly like the original;
other joins get a 4 ms fade. `getLevels()` (bass/mid/treble/energy + beat pulse)
feeds the visuals, delayed by the output latency. `PlaybackState.pending` means
playback started while the context isn't running yet (the UI shows "tocca per
ascoltare").

**Analysis** (`audio/analysis/`). `analyzeAndCut(buffer, n)` returns a `CutPlan`
of exactly `n` contiguous segments. The main thread sends the mono mix plus the
stereo side channel `(L − R)/2` to a module worker (its own chunk); if the worker
fails, the same pure pipeline runs on the main thread. It never rejects: the last
resort is an even split. The pipeline (`pipeline.ts`, deterministic):

1. log-mel spectral-flux onset envelopes, full band and low band (46 ms window,
   ~86 frames/s), on a decimated signal;
2. usable region: trims silence and fade-in / fade-out;
3. tempo: autocorrelation through a comb, log-Gaussian prior around 120 BPM
   (58–205), octave errors resolved with beat-level evidence;
4. dynamic-programming beat tracking (Ellis 2007);
5. a centred held-note track (`vocal.ts`, needs the side channel) to avoid
   cutting through a sung note;
6. meter (4/4 unless a 3- or 5-beat bar is clearly better), downbeat phase and a
   structural-novelty curve;
7. boundary DP over beat / bar candidates: per-snippet length deviation, metrical
   strength, novelty, held notes, plus a whole-plan balance penalty
   (`7·(max/min − 1.5)²` above a 1.5 ratio) so snippets come out near-equal and on bar lines when
   possible. Weak beat confidence falls back to onset candidates;
8. each boundary snapped a few ms before the nearest attack, onto a quiet point.

**Realign** (`realign.ts`). Browsers decode the same MP3 with different offsets
(WebKit ≈ 12 ms earlier than Chrome), so on an iPhone the host's cuts would land
just after each attack. Every peer re-snaps the host's boundaries onto its own
decode (one shared shift, ±30 ms max) and keeps them unchanged when the evidence
is weak. Only playback times move, never segment identity, so scoring is
unaffected. Everything that plays or draws a round's segments goes through
`useLocalSegments(trackKey, segments)` (`components/board`).

**Waveforms**: `peaks.ts` caches peaks per buffer range; `board/waveLevels.ts`
maps RMS dB between the track's own p5 and p99.5 (γ 1.6), so blocks of the same
song look different while loudness still compares across them. `sfx.ts`
synthesises the UI sounds on their own bus.

## UI

**Shell** (`App.tsx`, `components/shell/`). Mounted once: the shader background,
`ScreenRouter` (cross-fading full-viewport screen frames, each with its own error
boundary), floating reactions, sound controls, the connection and resume
overlays, and toasts. Optional chrome sits behind quiet error boundaries so it
can't take a game down.

- A screen marks its pinned HUD with `data-shell-hud` (fallback:
  `[data-round-view="playing"] > header`); `hudInset.ts` measures it and toasts and
  the reconnect banner stack under it.
- The connection overlay moves lost → retrying → failed; a host that left or
  closed the room skips straight to the final message. Copy depends on where the
  player was (`connectionCopy.ts`).
- While in a room, an AudioContext still locked after 1.2 s shows a persistent "Tocca
  per ascoltare" toast; `useInstallPromptGuard` suppresses Chrome's install
  mini-infobar so it never covers a docked button.

**Board** (`components/board/`). dnd-kit (`@dnd-kit/core` + `sortable`,
`rectSortingStrategy`) with a pointer sensor that activates after 4 px (mouse) or
10 px (touch/pen); keyboard drag with space and arrows. Tap plays one snippet,
long-press (450 ms) or Shift+Enter plays from that position. Blocks use
`touch-action: none`, locked ones `pan-x pan-y` so the reveal still scrolls. The
reveal drives the board from outside (`marks`, `labels`, `highlight`,
`onTapSegment`). DOM hooks the shell and the e2e suites use: `.sb-item[data-seg]`,
`[data-screen-frame][data-screen]`, `[data-round-view]`, `[data-phase]`.

**Background** (`components/background/`). A fixed WebGL2 canvas (WebGL1, then a
CSS gradient, as fallbacks): domain-warped neon plasma reacting to
`audioEngine.getLevels()`, accents from `useBackground` (album colours on the
reveal). It starts after first paint and compiles without blocking; 60 fps while
something reacts, 30 fps after 1 s of quiet; adaptive quality levels with a cost
model, and weak devices start one level down.

**Design system** (`components/ui/`, tokens in `src/index.css` `@theme`).
"GeoGuessr × neon club": Unbounded for display type, Manrope for text, JetBrains
Mono for numbers; colour tokens `ink-*`, `violet`, `magenta`, `cyan`, `lime`,
`gold`, `coral`, `orange`. `backdrop-filter` costs about 5 % GPU per frame, so
only short-lived overlays use `glass` (real blur); in-flow panels use
`glass-flat` and docks / sticky bars `glass-dock`. On coarse pointers `btn-sm` and
the `hit-slop` utility add an invisible 6 px hit area; the `short:` variant targets
landscape phones (`max-height: 500px`). Motion via `motion/react`, honouring
`prefers-reduced-motion`.

## Build and page head

`vite.config.ts`: relative base, ES-module worker, source maps, and the
`unshuffle:head-tags` plugin, which adds the font preloads (the hashed latin
Unbounded + Manrope files of the build), `preconnect` / `dns-prefetch` for the
signaling server, the TURN credentials endpoint and Deezer, and the `og:image`
tags (absolute when `VITE_SITE_URL` is set). `index.html` holds the static tags
and a tiny inline boot screen (`#boot`, right after `#root`, hidden by
`#root:not(:empty) + #boot`), so nothing may be inserted between the two. Tailwind
scans only `src/` (`source('../src')`).

## Working on the code

- `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint` (oxlint),
  `npm test` (bun, `tests/unit/`); end-to-end suites in `tests/e2e/`. See
  README → Tests.
- TypeScript is strict, with `verbatimModuleSyntax` (use `import type`),
  `erasableSyntaxOnly` (no `enum`, namespaces or constructor parameter
  properties) and `noUnusedLocals` / `noUnusedParameters`.
- Functional components and hooks, named exports, Tailwind utilities first (small
  CSS files next to a component for keyframes, masks and the like). Use the design
  tokens rather than new hex colours (computed snippet hues and album accents
  aside).
- Everything degrades gracefully: a failed track → a spare, no WebGL → a gradient,
  no audio → a playable UI with an error toast, blocked storage → no persistence.
