# fix-audio progress log

Owner files: src/audio/engine.ts, src/audio/sfx.ts, src/audio/usePlayback.ts
Originals kept for diffing: scripts/fix-audio/*.ts.orig. Dev server: :5410 (cache node_modules/.vite-fix-audio).

## Status
- [x] 1 MAJOR loudness normalisation — engine measures BS.1770-4 integrated loudness after decode
      (sliced, ~11 ms CPU per preview, exact spec coefficients at any rate), per-session trim node towards
      -14 LUFS (clamp -12/+6, boosts capped at -1 dBFS peak). Output DynamicsCompressor limiter (-1 dB, 20:1,
      knee 0; +0.57 dB makeup, transparent below: distortion -90 dB). Levels mapping offset +5 dB.
      25 previews: spread 18.6 → 5.3 LU (20/25 at -14.0), 0 tracks peaking > 0 dBFS. (survey-out.txt)
      bun: scripts/fix-audio/loudness.test.ts (15 pass).
- [x] 2 MAJOR ticks: redesigned tick/tickUrgent (2.6/3.1 kHz tonal ping + click, small body), trims +3.5/+2,
      duck [1.5,.05]/[2.5,.08] scaled by gain; score brighter + trim +6. Normalised-music audibility:
      tick 17% → 93%, tickUrgent 37% → 93%, @0.6 → 75%, score@0.7 1% → 18-24% per single tick.
- [x] 5 POLISH flips: correct/wrong no longer duck; duckMusic merges overlapping calls (deepest wins).
- [x] 3 MINOR stalls: AHEAD_S 1 s (hidden 2.5 s) + revise(): not-yet-started snippets (> now+50 ms) are re-checked
      against getSegmentAt every tick and re-planned (tails/fades undone). Resync joins now fade the previous item.
- [x] 4 MINOR pre-warm AudioContext at idle on Chromium (not iOS/Firefox). ctx-warn.mjs: first ctor 175-190 ms.
- [x] 6 POLISH levels delayed by the smoothed output latency (ring of analyses).
- [x] 7 POLISH unlock(): session + iOS<17 keep-alive <audio>; holdSoftUnlock()/useSoftAudioUnlock() for Home
      (cross-area: HomeScreen must adopt it and drop its own catch-all unlock).
- [x] verification (below)

## Verification so far
- Original engine lab (scripts/fix-audio/engine-lab.mjs): NORM=0 → 14/14 pass; default → 13/14, the only fail is the
  sample-exact comparison vs the RAW buffer (expected: output = trim × original).
- live.mjs (Chrome, Nirvana, trim -6.35 dB): music-tap output == trim × original sample-for-sample (max err 2e-8, 383k samples).
- Stalls 150/350/600/900/1300 ms around boundaries (16 × 1.5 s, correct + shuffled): 0 gaps, 0 resyncs, no digital silence.
  QA drag-stall at 6× CPU (drag-stall.mjs, real app, 16 snippets): long tasks up to 215 ms, joins all crossfade, gaps 0 (QA: resync, 32.6 ms gap).
- Reorders during play-all: land when made ≥ ~116 ms before the boundary (old commit point: 200 ms); later ones are
  committed; audio stays contiguous, no clicks at the re-planned join (slope ratio 0.5).
- Levels latency: simulated +200 ms output latency → levels lag the live analysis by 233 ms (measured delay 0.231 s).
- levels-ab.mjs: shader energy mean raw 0.08…0.88 → normalised 0.29…0.87; loud masters no longer saturate (beats found).
- outpeak.mjs: volume 1.0 + ticks/alarm/go/fanfare on top: output peaks -1.3…-6 dBFS, 0 samples over 0 dBFS.
- duck.mjs: 8 reveal flips → music gain within ±0.3 dB (was -3/-1.4 dB 5 Hz tremolo); duck 5 dB + light duck → holds -5 dB.
- unlock.mjs (WebKit iPhone 14): no hold → tap anywhere = running + 'playback' (unchanged); with hold → nickname/avatar taps
  leave ctx null + 'auto', CTA → running + 'playback'; iOS16 (no audioSession) → keep-alive <audio> plays on unlock,
  pauses when hidden, resumes when visible. Chrome desktop/Android 1×/4×: ctx pre-created ~1 s after load, first
  pointerdown capture→bubble 0.1–4 ms (was ~175 ms ctor), console clean.
- Original engine lab: NORM=0 LONG=1 → 15/15.
- Snapshot build scripts/fix-audio/dist + vite preview (localhost:5460): scripts/e2e/smoke.mjs PASS (3 rounds, 2 players, no console errors).
