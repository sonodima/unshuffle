# UNSHUFFLE

> *La hit è stata fatta a pezzi. Rimettila in ordine prima degli altri.*

**▶ Gioca: [pages.arm.re/unshuffle](https://pages.arm.re/unshuffle/)**

A browser-only, peer-to-peer multiplayer music game. A famous song's 30 s Deezer
preview is cut on beats / bar lines into 6–16 snippets, shuffled, and every player
races to drag them back into the right order. GeoGuessr-style rounds: a time
limit, and as soon as the first player confirms, a short final timer starts for
everyone else. Italian UI, phone and desktop.

- 100 % static SPA (Vite + React 19 + TypeScript) — no backend. Networking is
  WebRTC (PeerJS, rooms brokered by the public PeerJS cloud); music metadata comes
  from the public Deezer API over JSONP. A public deployment needs a TURN relay
  for players on mobile data: see [Deploy](#deploy).
- Architecture, product spec and module contracts: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Features

- **Rooms without accounts**: a 5-letter code, an invite link (`#/r/CODE`) and a
  QR code; up to 10 players; late joiners watch the current round and play from
  the next. Solo play works too.
- **Any Deezer playlist**: search, category chips, featured playlists, or paste a
  playlist link. Settings: 3/5/7/10 rounds, 6/8/12/16 snippets
  (Facile → Folle), 60–180 s per round, 10–30 s final timer.
- **Musical cuts**: beat and bar tracking (4/4, plus 3/4 and 5/4 when clear) in a
  Web Worker. Cuts avoid chopping held vocal notes, snippets have near-even
  lengths, and every guest re-aligns the host's cuts to its own browser's decode
  (Safari/iOS decode MP3s ~12 ms earlier than Chrome).
- **Gapless playback**: in the right order the snippets sound exactly like the
  original. Every track is loudness-normalised (−14 LUFS), so rounds sound
  equally loud.
- **Reveal**: the song plays while your blocks flip ✓/✗ and slide into place. Tap
  a block to jump the song there, and switch between *Il tuo ordine* and
  *Ordine giusto*. Round leaderboard with rank changes.
- **Final**: podium with confetti, per-round breakdown, awards, replayable song
  previews, **Rigioca** (host) and **Rivincita!** requests (guests).
- **Resilient networking**: reloads and short drops keep your seat and score (12 s
  grace in game). Late moves up to 400 ms after the deadline still count. A host
  on a phone that briefly goes to the background is waited for up to 3 minutes,
  and guests are told within ~15 s when the host has really left.
- **Phone first**: touch drag with no scroll conflicts, safe areas, landscape
  layouts, 44–48 px touch targets, and an installable home-screen app with icons
  and a manifest.
- **Light on the device**: no persistent `backdrop-filter`, a shader that drops to
  30 fps when nothing plays, and an idle Home screen that parks its demo.

## How to play

1. **Crea stanza** on Home, then share the code, the link or the QR code. Friends
   open the link, or type the code and press **Entra**.
2. The host picks a playlist and the settings, then presses **Inizia partita**.
3. Each round, a song is cut into snippets and shuffled. **Tap/click** a block to
   hear it, **drag** it to its place, and use **▶ Ascolta tutto** (space bar) to
   hear the current order. **Long-press** a block (or Shift+Enter) to listen from
   that position onwards.
4. Press **CONFERMA** (⌘/Ctrl+Enter) when you think it's right. The first confirm
   starts a short final timer for everyone else. On an untouched board CONFERMA
   asks for a second press.
5. Points per round: up to 2500 for snippets in the exact position plus up to 2500
   for adjacent pairs in the right sequence (5000 for a perfect board). Ties go to
   whoever played more rounds, then to the lower total confirm time.
6. The top-left exit button leaves the game (guests) or ends it: **Torna alla
   lobby** or **Chiudi la stanza** (host).

## Run

```sh
npm install
npm run dev            # http://localhost:5173 — open it in two browsers/devices to play together
npm run build          # type-check + production build into dist/
npm run preview        # serve dist/
npm run typecheck      # tsc -b only
npm run lint           # oxlint
npm test               # unit tests (needs bun, see Tests)
```

## Deploy

`npm run build` writes a fully static site to `dist/`. It uses a relative base
(`./`) and hash routing, so it can be hosted from any folder of any static host
(GitHub Pages, Netlify, S3, a plain directory). Serve it over HTTPS: the game
itself also runs on plain `http://`, but clipboard access and installing it as an
app need a secure origin.

Deploy-time options are `VITE_*` environment variables read by `vite build`
(export them in the shell, or put them in `.env.production.local`, which is
git-ignored). Everything they contain ends up **public in the JS bundle**, so use
only keys meant for the browser.

### GitHub Pages (CI/CD)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and
pull request: `npm ci`, type-check, lint, the bun unit tests and a production
build. On `main` it then publishes `dist/` to GitHub Pages with the official
`actions/deploy-pages` flow, and sets `VITE_SITE_URL` from the Pages URL so link
previews get an absolute share image.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions**. The deploy options below are read from repository **variables**
(Settings → Secrets and variables → Actions → Variables), for example
`VITE_TURN_CREDENTIALS_URL`. They end up in the public bundle anyway, so they
are variables, not secrets. After changing one, re-run the workflow (Actions →
CI → Run workflow).

The end-to-end suites (`scripts/e2e/*.mjs`) need a real Chrome, the public PeerJS
cloud and the Deezer API, so they run locally, not in CI.

### TURN relay (needed for a public deployment)

WebRTC connects players directly whenever it can: same Wi-Fi, ordinary home
routers. Two groups of players can only reach the host through a TURN relay:

- players on **mobile data** (carrier-grade / symmetric NAT, i.e. most 4G/5G), and
- players on networks that **block UDP** (offices, schools, hotels, some public
  Wi-Fi), which need TURN over TCP 80 or TLS 443.

By default the app uses STUN only (Google + Cloudflare) and ships no TURN server.
PeerJS' old public relays no longer resolve, and
no free relay still works without an account. A build without TURN plays fine at
home, but those players see *“Impossibile collegarsi all’host”* after about 12 s.
Configure at least one of the options below. The full variable list is in the
header comment of [`src/net/peer.ts`](src/net/peer.ts).

**A. Credentials endpoint (recommended).** The app fetches short-lived TURN
credentials at runtime: in the background on the home screen, and again when a
room is created or joined (waiting at most 2.5 s for them). It caches them until
they expire, and a host keeps them fresh during a long game for players who join
later. With Metered (the free "Open Relay" tier needs a sign-up: create an app and
copy its API key):

```sh
VITE_TURN_CREDENTIALS_URL="https://<app>.metered.live/api/v1/turn/credentials?apiKey=<key>" npm run build
```

The endpoint must answer CORS requests (`fetch` without cookies). Accepted
response shapes: `RTCIceServer[]` (Metered, callable straight from the browser),
`{ iceServers }` (Cloudflare), `{ ice_servers }` (Twilio), `{ v: { iceServers } }`
(Xirsys) and the TURN REST shape `{ username, password, ttl, uris }`. Providers
whose API needs a secret (Cloudflare, Twilio) must sit behind your own small proxy
or worker, never in the bundle. Optional: `VITE_TURN_CREDENTIALS_METHOD=POST`,
and `VITE_TURN_CREDENTIALS_TTL=<seconds>` for responses without a `ttl`
(default 3600).

**B. Static credentials** (for example the ExpressTURN free tier, or your own
[coturn](https://github.com/coturn/coturn)):

```sh
VITE_TURN_URLS="turn:relay.example.com:80,turn:relay.example.com:80?transport=tcp,turns:relay.example.com:443?transport=tcp" \
VITE_TURN_USERNAME=user VITE_TURN_CREDENTIAL=secret npm run build
```

A and B can be combined; the browser then gathers relay candidates from both.

Getting the URLs right:

- **List UDP, then TCP 80, then TLS 443**: `turn:h:80` (or `:3478`),
  `turn:h:80?transport=tcp`, `turns:h:443?transport=tcp`. UDP is the fastest;
  TCP 80 and TLS 443 get through firewalls that block everything else.
  Unreachable entries don't slow down direct connections, so listing all three
  costs nothing.
- **A `turns:` hostname must match the relay's TLS certificate**, otherwise the
  TLS handshake fails and only that fallback silently stops working. For
  Metered that is `global.relay.metered.ca`, not `openrelay.metered.ca`.
- There is no `?transport=tls`: TLS is `turns:` with `?transport=tcp`.
- Malformed entries (unknown scheme, missing username or credential, a URL the
  browser rejects) are dropped with a `[net] …` console warning instead of
  breaking every connection. After a deploy, check the console for such warnings.
- **Static credentials are public.** Anyone who opens the site can read them and
  use your relay's quota. The credentials endpoint (A) limits this to
  short-lived credentials; with B, rotate them if the quota starts draining.
  A game uses very little relay traffic (≈ 35 KB per round per guest, about 2 MB
  for a 10-player, 5-round game), so free tiers are plenty.

**Check that the relay really works.** Run the dev server with the same
variables (e.g. in `.env.local`), open `http://localhost:5173/lab/net.html` in
two tabs, run `netLab.forceRelay(true)` in both consoles, press *Crea stanza* in
one tab and join its code from the other. `await netLab.icePaths()` should then
print `relay/…` pairs. Without a working relay, the join fails.

### Own signaling server (optional)

Rooms are brokered by the public PeerJS cloud (`0.peerjs.com`). To use your own
[PeerServer](https://github.com/peers/peerjs-server) instead
(`npx -p peer peerjs --port 9000 --path /app`):

```sh
VITE_PEERJS_HOST=peer.example.com VITE_PEERJS_PORT=443 VITE_PEERJS_PATH=/app npm run build
```

`VITE_PEERJS_HOST` also accepts a full URL (`wss://peer.example.com:9000/app`),
or `/` for the page's own host (a PeerServer behind the same domain).
Also available: `VITE_PEERJS_KEY` and `VITE_PEERJS_SECURE` (`true`/`false`; the
default follows the page, so HTTPS uses `wss`). All players must use the same
build: players on different signaling servers can't see each other's rooms.

### Link previews and home-screen app

Invite links shared in chats get a title, a description and a share card
(`public/og-image.jpg`, 1200×630). WhatsApp, Facebook and some other apps only
load the image from an absolute URL, so tell the build where the site lives:

```sh
VITE_SITE_URL=https://giochi.example.com/unshuffle/ npm run build
```

Without it the image URL stays relative, and only the apps that resolve
relative URLs show the card. `public/` also holds the icons and
`manifest.webmanifest`, so "Aggiungi a Home" (iOS) and "Installa app"
(Android, desktop Chrome) give a full-screen app with the UNSHUFFLE icon.

`vite.config.ts` writes the generated part of the page `<head>`: the
`og:image` tags, a preload for the two fonts of the home screen (so the first
paint already uses them), and `preconnect` hints for the signaling server, the
TURN credentials endpoint and Deezer, derived from the variables above.

### Connection behaviour

A guest whose link drops reconnects on its own: quickly for 30 s, then every 5 s
for up to 3 minutes of visible time, so a phone host that switched apps can come
back. Both sides say goodbye on `pagehide`, so a closed tab is noticed at once.
When the signaling server reports the host's code as gone for 10 s, guests stop
retrying and see *“L’host ha lasciato la partita”* (~14 s after the host tab closed).
A host reload keeps the room code and the game.

## Tests

End-to-end (Playwright with the installed Chrome, real PeerJS cloud + Deezer):

```sh
UNSHUFFLE_VITE_CACHE=node_modules/.vite-integrate npx vite --port 5220 --strictPort &
node scripts/e2e/smoke.mjs        # full 2-player game: desktop host + phone guest, 3 rounds → podium → Rigioca
npm run build && npx vite preview --port 5221 --strictPort &
SUBPATH=1 node scripts/e2e/static.mjs   # production build: home, analysis worker, solo game (also from a sub-path)
node scripts/e2e/check-bundle.mjs       # dist/: no lab / dev code, relative URLs, separate worker chunk
CHAOS=1 node scripts/e2e/smoke.mjs      # the same game, with both tabs reloaded at once mid-round
node scripts/e2e/reload.mjs             # host + guest reload at the same moment → both back in the room
node scripts/release/shots.mjs          # every screen of a real 3-player game: desktop 1440×900 + phone 390×844
```

Every script takes the base URL as its first argument (e.g.
`node scripts/e2e/smoke.mjs http://127.0.0.1:5500/`). Screenshots of every phase
land in `scripts/e2e/shots/`.

Deeper QA scenarios (same setup, `BASE=http://127.0.0.1:<port>/` in the environment):
`scripts/qa-multiplayer/game4.mjs` (4 players: first-confirm pull-in on every peer,
a late joiner, a round with no confirms, last-second confirms, Rigioca and a second game), plus
`s6b-hostgone`, `s8b-16snip-phone`, `s9b-lastsecond`, `s10b-dup`, `s11b-host-refresh`,
`s12-ghost` and `s13-clockskew`. These all use the current `lib.mjs`. The older `s1`,
`s3`, `s5`, `s7`–`s11` scripts import helpers that no longer exist. In
`scripts/qa-ux/` there are `confirm`, `a11y` and `game`. `scripts/qa-mobile/` holds
`real` (a real 3-player game with phones, `BASE` without a trailing slash; pass
`IOS_ENGINE=chromium`, because Playwright's WebKit can't open WebRTC data channels, see
`webrtc-probe.mjs`), `webkit-unlock` (`PBASE=`), `reveal-scroll`, and `sweep`
(`ENGINE=chromium|webkit`, `VPS=…`: every screen over fixture states in the shell lab,
the way to get WebKit/iPhone screenshots, with overflow/overlap checks).
`node scripts/net/run.mjs` exercises the transport (reconnect, host-gone, limits).

Unit tests use [bun](https://bun.sh); run each file on its own (several suites
mock shared modules with `mock.module`, which leaks across files in one bun process):

```sh
npm test               # = for f in $(find ./scripts -name '*.test.ts' | sort); do bun test "$f" || exit 1; done
```

Module labs (`lab/*.html`, served by the dev server at `/lab/<name>.html`) and
their helpers in `src/dev/` are development tools only and never part of the build.
