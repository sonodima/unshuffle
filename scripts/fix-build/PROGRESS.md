# fix-build progress log

Area: index.html, public/**, vite.config.ts, package.json scripts, README.md, docs/**.

| # | Finding | Status | Notes |
|---|---------|--------|-------|
| 1 | README/ARCHITECTURE TURN docs stale | done | README "Deploy" section (TURN A/B, URL order, cert name, public creds, relay check via lab/net.html, own PeerServer with `npx -p peer peerjs`); ARCHITECTURE constraint line 17 + transport contract note |
| 2 | Web fonts requested late (preload) | done | vite.config.ts `headTags` plugin injects `<link rel=preload as=font crossorigin>` for the emitted unbounded/manrope latin woff2 (found in the bundle, so always the CSS's hashed file). fonts-ab.mjs (562 ms RTT, 1.44 Mbps, 3 runs, medians): A none FCP 2636 / settled 4066 (fallback fonts on first paint, 2 swaps); B Unbounded FCP 2924 / Manrope swaps 3768; C both FCP 3044 = settled 3044 (no swap). Chose C. Shots shots/fonts-a-home.png vs fonts-c-home.png |
| 3 | No apple-touch-icon / manifest | done | public/apple-touch-icon.png 180 (full bleed), icon-192/512 (rounded plate), icon-maskable-512, manifest.webmanifest (relative start_url/scope/icons, standalone, #06040f). Rendered by scripts/fix-build/icons.mjs. Extra: share card public/og-image.jpg (1200x630, 73 KB) from lab/fix-build.html via og.mjs; og:* tags; absolute og:image/og:url when VITE_SITE_URL is set |
| 4 | No preconnect hints | done | same plugin: preconnect signaling origin (derived from VITE_PEERJS_* like peer.ts, default 0.peerjs.com) + api.deezer.com, preconnect crossorigin TURN credentials origin when configured, dns-prefetch cdn-images/cdnt-preview.dzcdn.net |

Extra polish (done):
- index.html inline boot screen (#boot after #root, hidden by `#root:not(:empty) + #boot`, compositor-only equalizer, fades in after 150 ms so fast loads never see it: boot-fast.mjs max opacity 0; throttled boot-throttle.mjs shows it ~0.7 s before the home) + Italian <noscript>.
- package.json: `typecheck`, `test` (bun loop) scripts; README Run/Tests updated.
- signalingOrigin handles VITE_PEERJS_HOST='/' (net fixer added it) → no preconnect.

Verification (done): tsc node config clean; app tsc errors only in src/dev/net/main.ts (net fixer, mid-edit); bun head-tags.test.ts 6 pass; npm test all pass; verify.mjs all checks passed (root desktop/phone + sub-path: console clean, fonts once, manifest OK, installable, icons 200, boot hidden); check-bundle on snapshot OK; scripts/e2e/static.mjs against snapshot :5474 PASS.
Ports: dev 5414, snapshot preview 5474 (5464 is taken by someone's qa-perf preview).

Final state (all four findings fixed, verified on the final snapshot). Cross-area notes handed back:
- shell: ScreenRouter's whenIdle(preloadScreens) could also wait for document.fonts.ready (lower priority now that the fonts are preloaded and finish before the first render).
- net: peer.ts header says `npx peerjs …`; the PeerServer binary lives in the `peer` package → `npx -p peer peerjs …` (README uses that).
- shell (optional): the app is now installable, so Chrome Android may show its install mini-infobar; `beforeinstallprompt` → preventDefault() during rounds if it ever covers the CONFERMA CTA.
- everyone: #boot contract (render into #root immediately, nothing between #root and #boot).
