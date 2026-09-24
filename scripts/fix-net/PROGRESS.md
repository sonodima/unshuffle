# fix-net progress log

Owner: net area (src/net/**). Originals backed up in scripts/fix-net/orig/ (no git repo).
Lab: lab/fix-net.html + src/dev/fix-net/main.ts (copy of the net lab, no fixtures import, extra probes).
Dev server: UNSHUFFLE_VITE_CACHE=node_modules/.vite-fix-net npx vite --port 5409 --strictPort

## Server facts measured (scripts/fix-net/probe-server*.mjs, public 0.peerjs.com)
- Offers to an unknown id: the server answers peer-unavailable (~45 ms) only EVERY OTHER time
  per target id (regardless of source); fresh targets are always answered.
- A bare CANDIDATE or raw OFFER over the socket to an unknown id gets NO expire → no cheap
  self-probe possible; recycle triggers used instead.

## Code changes (status per finding) — ALL DONE except #7 fallback list (optional)
1 TURN (critical): runtime creds VITE_TURN_CREDENTIALS_URL (+METHOD, TTL) fetched in loadModule /
  preloadTransport (2.5 s cap), cached, refreshed in place on live Peers; static VITE_TURN_* kept. DONE, verified (turn-relay.mjs relay-only PASS). A working relay still needs a deployer key (no zero-signup TURN exists).
2 host leaves: host pagehide → bye 'away'; client reconnect ends 'host-gone' after 10 s of
  peer-unavailable streak (no-answer neutral because of server alternation). DONE, verified: tab close → host-gone 14.0 s (was 31–39 s); renderer crash → ice-disconnected 8.5 s, host-gone 22.6 s (was ~40 s).
3/11 suspended host: fast 30 s phase, then slow retries every 5 s up to 3 min visible (20 min wall). DONE (code)
4 bad TURN config: normalize + RTCPeerConnection-constructor validation per server/url, warn once. DONE (code)
5 half-dead host socket: quiet recycle (disconnect+reconnect same id/token) on thaw, online,
  visible after >=20 s hidden, pageshow persisted, all clients timed out. DONE (code)
6 signaling outage messages: stage tagging, signalingError(), maxSignalingFailures/Timeouts,
  registerTimeoutMs 5 s, create deadline counts module load. DONE (code)
7 signaling config: VITE_PEERJS_HOST/PORT/PATH/KEY/SECURE (+ lab override). Fallback list NOT done (optional).
8 guest closed tab: client pagehide → bye 'away' (host finalizes at once). DONE (code)
9 upstream limits: UPSTREAM_LIMITS 8 chunks / 64 K chars, host finalizes 'oversize'. DONE (code)
10 client re-registers on suspect-path losses + after first no-answer. DONE (code)
12 slow host: answer wait 4 s then 6 s; room-not-found only on explicit peer-unavailable,
  else "L’host non risponde…". DONE (code)
13 STUN google + cloudflare. DONE
14 ICE disconnected 3 s / failed, network change / online / thaw / signaling-lost probes (5 s). DONE (code)
Extra: host finalizes older pending offers of the same tab (burst after a thaw can't fill MAX_CONNECTIONS).

## Verification so far
- bun: scripts/fix-net/net-logic.test.ts 23 pass; scripts/net/wire.test.ts 23 pass (API compatible).
- lab snapshot (vite.lab.config.mjs → lab-dist, preview :5459): scripts/fix-net/run.mjs --skip-slow ALL PASSED
  (run-fast-1.log); slow set ALL PASSED (run-slow-1.log): host tab closes → host-gone 14.0 s;
  host frozen 45 s → back open (now ~0.1 s after resume with recycleThawDelayMs + superseded offers);
  host WS half-dead + link dead → recycled (185 ms), client back 9.9 s.
- turn-relay.mjs: runtime creds (TURN REST shape) → relay-only join + traffic PASS.
- env-config.mjs: VITE_TURN_* bad entries dropped + creds URL merged; VITE_PEERJS_* reach PeerJS WS URL; PASS.
- app snapshot (vite build → scripts/fix-net/dist, preview :5459): app-e2e.mjs ALL PASSED (app-e2e-2.log):
  closed guest tab → host roster "Riconnessione…" in 76 ms (was ~10–15 s); host tab closed → guest banner
  63 ms, dialog 14.1 s (was 31–39 s); host reload → same code, guest back 2.0 s; guest reload → listed once.
  Shots: scripts/fix-net/shots/app-*.png (read: OK).
- lab snapshot moved to :5460. Original scripts/net/run.mjs vs new code: all pass except its last step,
  which expects the OLD 'gave-up' after ~30 s (now 'host-gone' at ~14–16 s, by design) → flagged cross-area.
- run-full-2.log: full fix-net suite (30 steps) ALL PASSED.
- peer.ts: IPv6 host keeps brackets (PeerJS builds wss://host:port); VITE_PEERJS_HOST='/' = page host.

## Final checks
- Copy polish: NET_MESSAGES.signaling shortened to "Server di collegamento irraggiungibile. Riprova tra poco o
  cambia rete (Wi‑Fi o dati mobili)." (2 lines on desktop Home instead of 3; shots/home-signaling-*.png read OK).
- crash-host.mjs: Page.crash on the host → client 'ice-disconnected' at 8.5 s, 'host-gone' at 22.6 s (PASS).
- Fixed a TS clash I introduced: my lab no longer re-declares Window.netLab (clashed with src/dev/net/main.ts).
- tsc -p tsconfig.app.json: 0 errors (whole project at the time of the check); oxlint src/net src/dev/fix-net: clean.
- bun: fix-net/net-logic 23 pass, net/wire 23 pass, store/store 36 pass.

## INCIDENT (needs the orchestrator)
While stopping my servers I ran `kill 5082`, believing it was my lab preview on :5460. It was the fix-audio
fixer's `vite preview --outDir scripts/fix-audio/dist --port 5460 --strictPort` (it listened on IPv6 *:5460,
mine on 127.0.0.1:5460). Restarting it for them was (rightly) refused by the permission system, so fix-audio must
restart it: `npx vite preview --outDir scripts/fix-audio/dist --port 5460 --strictPort`.
My own servers (dev :5409, previews :5459 / 127.0.0.1:5460) are stopped.
