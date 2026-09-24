# QA "network" — findings (appended as confirmed)

Scope: connectivity for real-world players (mobile data / CGNAT / symmetric NAT) + PeerJS robustness.
Dev server: http://127.0.0.1:5306 (lab: /lab/net.html). Scripts + logs: scripts/qa-network/.

## 1. [critical][net] No working TURN relay by default: players behind CGNAT / symmetric NAT (typical 4G/5G) cannot join at all
- Detail: `DEFAULT_ICE_SERVERS` (src/net/peer.ts:42-45) = Google STUN only + optional build-time `VITE_TURN_*`. When no direct path can be punched (symmetric/CGNAT on one side and a port-restricted NAT on the other, or both on mobile data) the guest just fails. Nothing ships that works out of the box, and the README presents TURN as "optional".
- Evidence: `node scripts/qa-network/net-e2e.mjs noturn` (guest forced relay-only with STUN only = no relay path) → log `net-e2e-noturn.log`: guest shows "Impossibile collegarsi all’host…" after **12.9 s**; shots/noturn-join-error.png; host lobby still 1/10 (shots/noturn-host-lobby.png). Same flow through a working TURN (elixir dev relay, relay-only both sides) plays a full round: shots/turn-lobby-*.png, shots/turn-reveal-*.png.
- Research (Sept 2026, verified live, see turn-alloc.log / turn-probe.json / turn-probe-elixir.log): NO zero-signup free TURN works: Open Relay static `openrelayproject` creds → 400 on udp/tcp 80/443/3478 (Metered now needs a free account + API key); `turns:openrelay.metered.ca:443` fails TLS name check (cert is `*.relay.metered.ca`); `staticauth.openrelay.metered.ca` resolves but every port times out; freestun.net now points at Cloudflare's HTTP proxy (UDP 3478 timeout, TCP reset); freeturn.net / eu-0.turn.peerjs.com / numb.viagenie.ca NXDOMAIN; turn.anyfirewall.com refuses; ExpressTURN / Twilio / Cloudflare answer 401/400 (account needed). Only turn.elixir-webrtc.org works (relay in 182 ms, relay-only DC open 593 ms, RTT 95 ms) but its README says "DO NOT use this deployment in production" and it is UDP-only.
- Fix: add runtime TURN credentials: `VITE_TURN_CREDENTIALS_URL` (e.g. Metered/Open Relay free tier `https://<app>.metered.live/api/v1/turn/credentials?apiKey=<key>` — CORS `*`, returns an `RTCIceServer[]`, key is meant for front-end use, 20 GB/month free) fetched once in `loadModule()` (transport.ts:116) with a ~2.5 s timeout and cached until expiry, merged after STUN; keep static `VITE_TURN_*` as alternative (ExpressTURN free: 1000 GB/month, one static credential). Order: STUN, turn udp:80/3478, turn tcp:80, turns tcp:443. Make README say production deployments need one.

## 2. [major][net] Signaling-server outage is reported as "your internet is down" / "host unreachable"
- Detail: 0.peerjs.com NXDOMAIN → PeerJS 'network' → `NET_MESSAGES.network` "Connessione di rete non disponibile. Controlla la connessione" although the device is online (Deezer, page load all work). 0.peerjs.com black-holed → join shows `joinTimeout` "Impossibile collegarsi all’host…" (the host was never reached — we never registered on signaling), create shows the correct server message but only after 16 s.
- Evidence: `node scripts/qa-network/join-timing2.mjs <sigdown|sigblack> <join|create>` (join-timing2.log): sigdown join 9.7 s / create 13.0 s → network message; sigblack join 12.2 s → host message; sigblack create 16.2 s → server message. Screenshots shots/sigdown-join-error.png, shots/sigdown-create-error.png, shots/sigblack-join-error.png. Code: errors.ts:36-38 ('network'/'disconnected' → network), client.ts:190 (any 'timeout', incl. signaling registration, → joinTimeout), client.ts:204.
- Fix: in `ClientConnectionImpl.attempt()` tag failures from `ensurePeer()` as signaling failures (e.g. type `signaling:<peerjs type>`); in `start()` and `claimHostPeer()` map signaling failures to a dedicated message when `navigator.onLine !== false`: "Il server di collegamento non è raggiungibile. Riprova tra poco (reti aziendali/scolastiche possono bloccarlo)." Keep "Impossibile collegarsi all’host" only for failures after registration (no answer / ICE).

## 3. [major][net] Host whose signaling socket goes half-dead never notices: every dropped player is locked out, room silently dies
- Detail: the host only reacts to PeerJS 'disconnected'/'close' (host.ts:349-354). A half-open WebSocket (Wi-Fi degraded, NAT mapping expired after sleep, network handover without RST) keeps `status: open`, so offers from reconnecting / new players vanish. The host sees no banner; clients give up; a manual "Riprova" then ends in "Stanza non trovata" (2× no-answer → room-not-found, client.ts:184-187) although the room exists.
- Evidence: `node scripts/qa-network/handover-host.mjs` (handover-host.log): host WS black-holed + link frozen → client heartbeat-timeout at +8.8 s, 5× `no-answer` + 1× timeout, **closed (gave-up) after 38.8 s**; host status still `{"host":"open"}`, host log only "disconnect … (heartbeat-timeout)".
- Fix (host.ts): recycle the signaling socket whenever the host has reason to doubt it — on any `heartbeat-timeout` finalize (host.ts:522), on a detected suspend gap (host.ts:514) and on 'online' — i.e. `peer.disconnect(); peer.reconnect()` (same id + token, ~300 ms). Optionally a periodic self-probe: `peer.connect('<prefix>probe-<rand>')` must yield 'peer-unavailable' within 5 s, two misses → recycle.

## 4. [major][net] A malformed TURN config (typo / `?transport=tls` / missing username) breaks every connection, even on the same Wi-Fi
- Detail: `turnFromEnv()` (peer.ts:32-39) passes `VITE_TURN_*` straight to PeerJS; missing `VITE_TURN_USERNAME` becomes `''`. Chrome throws in the `RTCPeerConnection` constructor for such entries, so no peer connection can be created at all.
- Evidence: bad-ice.log (client with bad config, host default): `tun:` scheme / space in host / `turns:…?transport=tls` / empty creds → constructor throws SyntaxError / InvalidAccessError ("TURN server with empty username or password") → join fails after ~9.6 s with the wrong "Connessione di rete non disponibile". bad-ice-host.log (host with empty creds): createHost succeeds, every incoming connection throws an uncaught pageerror, guests get "Stanza non trovata" after 6.2 s.
- Fix: in peer.ts validate once at startup — for each configured server try `new RTCPeerConnection({ iceServers: [s] }).close()` in try/catch, drop invalid entries with a `console.warn`, skip TURN entries whose username/credential is empty; wrap `createPeer` config so a bad TURN entry can never remove STUN/host connectivity.

## 5. [major][net] UDP-blocking networks (corporate/school/hotel Wi-Fi) cannot connect at all; no TCP/TLS-443 relay path
- Detail: WebRTC with UDP blocked only works through TURN over TCP/TLS (ideally `turns:…:443?transport=tcp`). The shipped config has none, and README's example uses `turns:…:5349` (often blocked) rather than 443.
- Evidence: udp-blocked.log: Chrome `--webrtc-ip-handling-policy=disable_non_proxied_udp`, default ICE → zero candidates gathered, join fails after 12.0 s with "Impossibile collegarsi all’host". dead-turn.log: adding unreachable TURN udp/tcp/tls entries does not slow normal joins (314/278/373 ms vs 367/249/288 ms), so listing TCP/TLS fallbacks costs nothing.
- Fix: default/README config must include TCP 80 and TLS 443 variants (`turn:<h>:80?transport=tcp`, `turns:<h>:443?transport=tcp`); use hostnames whose TLS cert matches (Metered: `*.relay.metered.ca`, not `openrelay.metered.ca`).

## 6. [major][net] Signaling server is hard-wired to the public PeerJS cloud — no config, no fallback
- Detail: `createPeer()` (peer.ts:71-76) passes only `debug/token/config`, so PeerJS always uses `0.peerjs.com:443`, path `/`, key `peerjs` (node_modules/peerjs/dist/bundler.mjs:164,1483). When it is down or filtered (school/corporate DNS filters), 100 % of create/join fail and a deployer has no knob (see finding 2 timings).
- Evidence: join-timing2.log (sigdown/sigblack: every create/join fails); grep: no `host:`/`port:`/`path:`/`key:` anywhere in src/net.
- Fix: read `VITE_PEERJS_HOST`, `VITE_PEERJS_PORT`, `VITE_PEERJS_PATH`, `VITE_PEERJS_KEY`, `VITE_PEERJS_SECURE` in peer.ts and pass them to `new Peer(id, {...})`; document self-hosting (`npx peerjs --port 9000`). Optional ordered fallback list: a role only moves to server #2 when #1's WebSocket cannot open (network/socket-error/timeout, never on unavailable-id/peer-unavailable), and the invite link carries the index (`#/r/CODE?s=1`) so guests go straight to the host's server.

## 7. [minor][net] Client reconnect wastes ~7.5 s offering into a half-dead signaling socket
- Detail: after the data path dies, the client re-uses its existing Peer and only re-registers after **two** consecutive `no-answer`s (client.ts:477-481, 3.5–4 s each).
- Evidence: handover.log (link frozen + WS black-holed): link lost +8.7 s → no-answer +12.2 s → no-answer +16.2 s → fresh Peer, open at **+18.5 s**. handover-clean.log (OS closes the socket cleanly): reconnect itself takes 669 ms (open at +9.7 s).
- Fix: when the link is lost via `heartbeat-timeout` (the WS usually rides the same dead path) call `this.dropPeer()` before the first attempt, or re-register after the first `no-answer` (same id + token, the server hands the id back; ~300 ms).

## 8. [minor][net] Guests give up after 30 s when the host's phone is backgrounded (e.g. sharing the invite on WhatsApp)
- Evidence: host-freeze.log — host JS frozen (CDP Debugger.pause) 20 s → guest back `open` at +20.2 s (good); frozen 45 s → guest `closed (gave-up)` at **+38.9 s**, host resumes at +45 s to find the guest gone (must tap "Riprova"). timing.ts:30 `reconnectBudgetMs: 30_000`.
- Fix: after the 30 s fast phase keep retrying every ~5 s up to `RECONNECT_HARD_CAP_MS` (3 min, client.ts:29) while the "Connessione persa, riprovo…" banner stays up, instead of finishing 'gave-up'.

### (addendum to 3) handover-host-rejoin.log: after the guest gave up (38.7 s), a fresh join to the live host → "Stanza non trovata. Controlla il codice." after 6.1 s while host status is still `open`.

## 9. [minor][net] A host on a very slow link makes guests see "Stanza non trovata" for a room that exists
- Detail: an offer with no SDP answer within `answerTimeoutMs` (3 s, timing.ts:28) counts as "nobody there"; two of them → `room-not-found` (client.ts:184-187).
- Evidence: slow-host.log (host's signaling WS delayed D ms each way via routeWebSocket): 600 ms → join ok in 1.5 s; 1200 ms → ok in 2.7 s; **1600 ms → "Stanza non trovata" after 6.2 s** (2× no-answer). Same outcome when the host tab is briefly frozen.
- Fix: only report `room-not-found` on the server's explicit `peer-unavailable` (EXPIRE, arrives in ~0.4 s: join-timing2.log "nohost 449 ms"); on no-answer escalate the wait (3 s → 6 s) and finally show a "L’host non risponde" style message instead.

## 10. [minor][build] README/ARCHITECTURE TURN docs are stale and steer to a config that fails on locked-down networks
- Evidence: README.md:29-37 presents TURN as "Optional" with `turns:relay.example.com:5349` (no TCP/443 variant, no credentials-URL option, no provider names); docs/ARCHITECTURE.md:17 still says "default STUN/TURN" although PeerJS's TURN hosts are NXDOMAIN (turn-probe.json "peerjs eu-0").
- Fix: document the required production setup (free Metered/Open Relay key or ExpressTURN static creds or own coturn), the URL order `turn:h:80`, `turn:h:80?transport=tcp`, `turns:h:443?transport=tcp`, that the TLS hostname must match the cert, and that creds end up public in the bundle.

## 11. [polish][net] The two default STUN URLs are the same server
- Evidence: `dig stun.l.google.com` and `dig stun1.l.google.com` → both 74.125.250.129 (peer.ts:43). `stun:stun.cloudflare.com:3478` returns srflx (turn-probe.json "stun cloudflare 3478": types host,srflx).
- Fix: `{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }` for provider diversity.

## 12. [polish][net] Dead-link detection relies only on the 10 s app heartbeat
- Evidence: handover-clean.log — sockets closed cleanly, reconnect itself 669 ms but link loss detected only at +9.1 s. client.ts:519 / host.ts:522 (`deadAfterMs: 10_000`).
- Fix: also treat `conn.peerConnection.iceConnectionState === 'disconnected'` for > 3 s or `'failed'` (and `navigator.connection` 'change') as link loss; keep the 10 s heartbeat as the backstop.

---
### Verified working (notes)
- recommended-ice.log: STUN(Google+Cloudflare) + working TURN + unreachable TCP/TLS fallbacks → relay-forced joins 726–780 ms (relay/udp), policy 'all' joins 199–256 ms on host candidates (TURN not used when a direct path exists).
- net-e2e-turn.log: full real-app round relay-only through TURN: guest in lobby 2.6 s, start→playing 8.5 s, idle lobby 372 B / 10 s, one round ≈ 35 KB host→guest, max frame 4.6 KB, RTT 96 ms. A 10-player 5-round game ≈ 2 MB relayed → free tiers (Metered 500 MB, Open Relay 20 GB, ExpressTURN 1000 GB) are ample.
- bigstate-relay.log: 24 KB state → 2 chunks (max 13.6 KB) delivered in 248 ms over TURN; 60 states at 20/s all delivered, no backlog. Data channel ordered+reliable (PeerJS `reliable:true` → `ordered:true`, no maxRetransmits); SCTP maxMessageSize 262144; 15 KB frames are well under PeerJS' 16300 B JSON limit.
- dead-turn.log: unreachable TURN entries don't slow direct joins. nohost join → "Stanza non trovata" in 449 ms. host-freeze 20 s → guest recovers on resume.
