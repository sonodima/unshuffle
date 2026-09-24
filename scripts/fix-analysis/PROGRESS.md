# fix-analysis progress log

Area: src/audio/analysis/**, src/audio/peaks.ts

## Status
- [x] 1 Safari decode offset: src/audio/analysis/realign.ts (alignCuts, realignSegments; exported from index.ts). Mode-of-votes offset over re-snapped cuts, 3 search centres. Sim on 64 tracks x n8/16: identity 0/128 changed; -529 → -12.00 ms on 126/128, tail>6dB 171→2 (host 2). Tests: scripts/analysis/realign.test.ts (9 pass). TODO: real WebKit-vs-Chrome browser check; crossArea: board/PlayView/Reveal must call realignSegments(buffer, segments) for playback+waveforms.
- [x] 2 Snippet length balance: cut.ts DP refactor (pred table, identical results with balance 0) + path-level balance penalty via windowed re-solves (balance 7, free 1.5, n-independent), BAR_BONUS (3 bars 1.25, 1.5-bar 0.7), weak-beat metric -0.3 / odd -0.2 (METRIC_TUNE in pipeline). Corpus (out/w3.json): ratio>=1.9 n6 23→0, n8 48→0, n12 43→5, n16 51→30 (inherent at ~120 BPM); weak cuts n8 0.3%, n16 2.8%. analysis.test.ts expectations updated (onBar>=0.6, n<=8 ratio<1.56). TODO: finalize constants (remove tune hooks?), re-check after vocal feature.
- [x] 3 Vocal continuity: new src/audio/analysis/vocal.ts (centre-weighted mid/side STFT 250-4000 Hz @11k, sliding temporal median, throughAt soft verdict); Candidate.vocal + CutWeights.vocal 0.4; side channel (L-R)/2 sent to worker (protocol.side) and main-thread fallback. QA proxy through-rate (out/v04b.json): n8 34%→25%, n16 37%→28% (base 41%); total 877→642. Cost ≈20-40 ms in worker. Pickup candidates NOT done (vocal onset timing ±20 ms + snap to drum hits could chop the pickup: risky).
- [x] 4 Main-thread fallback code-split: new src/audio/analysis/plan.ts (clampCount/uniformPlan/isValidPlan/uniformBoundaries); index.ts lazy-imports ./pipeline in runOnMainThread; pipeline.ts + cut.ts re-export for compat. Build: host chunk now carries only plan.ts+index.ts (~7k src), pipeline is its own lazy chunk (26.3k) + worker.
- [x] 5 Odd meters: structure.ts estimateMeter (beat-lag self-similarity, P in 3/4/5, adopt 3/5 only if score>=0.1 and >=0.1 over 4/4) + estimateBarPhase(bf, novelty, P) generic templates (4/4 path unchanged); pipeline P-phase hypotheses. Corpus: only Take Five→5 and Satie Gymnopédie→3 (both correct), 0 false positives on 60+ 4/4 tracks. Take Five n16 all 5-beat bars.

## Log
- started (fresh; no earlier PROGRESS.md)
- corpus: node scripts/fix-analysis/fetch-corpus.mjs $SCRATCH/corpus (64 tracks, stereo int16 wav, afconvert)
- bench: bun run scripts/fix-analysis/bench.ts <corpus> <tag>; baseline in out/baseline.json: n8 ratio med 2.01 (48/64 >=1.9), through 34% vs base 41%
- constants finalized (BAR_METRIC [1,-0.3,0.45,-0.3], OFFBEAT -0.2, BAR_BONUS const, BALANCE_CAPS up to 2.6); out/final.json = current state. TODO: tests (meter synth, vocal unit, balance unit), browser checks (realign WebKit vs Chrome, lab screenshots), build.
- vocal.ts v2: psi^4 centre weight (psi = 2r-1 from mid/side), 46 ms window / 23 ms hop @11k, per-bin continuity (same bins ±3% pitch) + carried-share factor so chord changes of pads are NOT penalised. Eval: new strict 'held note' proxy (scripts/fix-analysis/vocalProxy.ts heldThrough, eval-held.ts): baseline 15-18% of cuts chop a held note (base rate over beats 20%) → now 8-12%. QA energy proxy 34-37% → 27-30%.
- tests: scripts/analysis/{cut,meter,vocal,realign}.test.ts new; analysis.test.ts: onBar>=0.6 + new 'even snippets' test on chord-stab synth (synth.ts: stabs + beatsPerBar options, 4/4 default output unchanged). All analysis tests pass.
- out/final5.json = current state.
- vocal feature moved to its own yielded stage ('vocal', ≈30 ms under load) so the main-thread fallback stays responsive; results identical (out/final6.json).
- REAL BROWSERS (scripts/fix-analysis/browsers.mjs, lab/fix-analysis.html on :5411): Chrome plan on WebKit decode → offset -12.00 ms 16/16; WebKit plan on Chrome → +12.00 16/16; Chrome on Chrome unchanged 16/16 (same array). Worker (with side channel) OK in Chrome and WebKit.
- visual.mjs screenshots (shots/d-n8-*.png, m-n8-*.png): Billie Jean 4/2 mix → 6/8-beat even plan; Take Five 2-bar (10-beat) snippets; Pendulum ratio 2 → 1.5; Annalisa new cuts at phrase starts.
- build snapshot + copy of scripts/e2e/static.mjs (static-copy.mjs) on preview :5461 → STATIC PASS (worker chunk loads, solo game board 8/8 waveforms). Servers stopped, dist removed.
- DONE. Remaining = cross-area: call realignSegments(buffer, segments) where guests play/draw round segments; src/dev/analysis lab passes no side channel (its determinism check will differ); docs mention.
