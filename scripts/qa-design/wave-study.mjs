// Waveform readability study: real Deezer previews, current rendering (src/audio/peaks.ts + Waveform.tsx
// mapping) vs. proposed mappings. Renders a comparison PNG and prints contrast metrics.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const OUT = new URL('./shots/', import.meta.url).pathname
const QUERIES = (process.env.Q ?? 'hey there delilah plain white|take me out franz ferdinand|blinding lights weeknd|titanium guetta sia|she will be loved maroon').split('|')
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(`${BASE}/lab/board.html?audio=synth&ui=0`, { waitUntil: 'load' })
await page.waitForTimeout(1000)
const res = await page.evaluate(async (queries) => {
  const { computePeaks } = await import('/src/audio/peaks.ts')
  let seq = 0
  const jsonp = (url) => new Promise((resolve, reject) => {
    const name = `__qaW${seq++}`
    const s = document.createElement('script')
    const t = setTimeout(() => reject(new Error('timeout')), 12000)
    window[name] = (d) => { clearTimeout(t); delete window[name]; s.remove(); resolve(d) }
    s.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${name}`
    document.head.appendChild(s)
  })
  const ac = new AudioContext()
  const N = 8, BINS = 58 // ≈ bars in a 250px-wide desktop block (Waveform: bar ≈ w/58)
  const out = []
  // canvas for the comparison sheet
  const rowH = 88, colW = 150, pad = 10, labelW = 190
  const modes = ['current', 'dbPct', 'bands']
  const cv = document.createElement('canvas')
  cv.width = labelW + N * (colW + pad)
  cv.height = queries.length * modes.length * (rowH + pad) + 20
  const g = cv.getContext('2d')
  g.fillStyle = '#0d0a1f'; g.fillRect(0, 0, cv.width, cv.height)
  let y = 10
  for (const q of queries) {
    const s = await jsonp(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`)
    const t = s.data?.[0]
    if (!t) { out.push({ q, err: 'no result' }); continue }
    const buf = await ac.decodeAudioData(await (await fetch(t.preview)).arrayBuffer())
    const dur = buf.duration, a0 = 0.4, len = (dur - 0.8) / N
    // --- mono + bands for the proposals
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
    const n = buf.length, sr = buf.sampleRate
    const mono = new Float32Array(n)
    for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) / 2
    const lp = (x, fc) => { const a = 1 - Math.exp(-2 * Math.PI * fc / sr); const y = new Float32Array(x.length); let v = 0; for (let i = 0; i < x.length; i++) { v += a * (x[i] - v); y[i] = v } return y }
    const low = lp(lp(mono, 160), 160)
    const lp3k = lp(lp(mono, 3500), 3500)
    const high = new Float32Array(n); for (let i = 0; i < n; i++) high[i] = mono[i] - lp3k[i]
    const binRms = (x, s0, s1, bins) => { const o = new Float32Array(bins); for (let b = 0; b < bins; b++) { const a = s0 + Math.floor(b * (s1 - s0) / bins), z = s0 + Math.floor((b + 1) * (s1 - s0) / bins); let q2 = 0; for (let i = a; i < z; i++) q2 += x[i] * x[i]; o[b] = Math.sqrt(q2 / Math.max(1, z - a)) } return o }
    const db = (v) => 20 * Math.log10(Math.max(1e-6, v))
    // track-wide percentiles of bin dB (same bin duration as blocks)
    const binDur = len / BINS
    const allBins = Math.floor((dur - 0.8) / binDur)
    const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] }
    const trackRmsDb = [...binRms(mono, Math.round(a0 * sr), Math.round((dur - 0.4) * sr), allBins)].map(db)
    const lowDb = [...binRms(low, Math.round(a0 * sr), Math.round((dur - 0.4) * sr), allBins)].map(db)
    const highDb = [...binRms(high, Math.round(a0 * sr), Math.round((dur - 0.4) * sr), allBins)].map(db)
    const P = { lo: pct(trackRmsDb, 0.05), hi: pct(trackRmsDb, 0.995), llo: pct(lowDb, 0.05), lhi: pct(lowDb, 0.995), hlo: pct(highDb, 0.05), hhi: pct(highDb, 0.995) }
    const map = (v, lo, hi, gamma = 1.6) => Math.max(0.06, Math.pow(Math.min(1, Math.max(0, (v - lo) / Math.max(1e-3, hi - lo))), gamma))
    const blocks = { current: [], currentRms: [], dbPct: [], bandsLow: [], bandsHigh: [] }
    for (let k = 0; k < N; k++) {
      const st = a0 + k * len, en = st + len
      const p = computePeaks(buf, st, en, BINS)
      // Waveform.tsx drawBars: a = pow(clamp(v*gain), 0.8); gain 1 (max) / 1.9 (rms); full = H*0.94
      blocks.current.push([...p.max].map((v) => Math.pow(Math.min(1, v), 0.8) * 0.94))
      blocks.currentRms.push([...p.rms].map((v) => Math.pow(Math.min(1, v * 1.9), 0.8) * 0.94))
      const s0 = Math.round(st * sr), s1 = Math.round(en * sr)
      blocks.dbPct.push([...binRms(mono, s0, s1, BINS)].map((v) => map(db(v), P.lo, P.hi) * 0.94))
      blocks.bandsLow.push([...binRms(low, s0, s1, BINS)].map((v) => map(db(v), P.llo, P.lhi, 1.4) * 0.94))
      blocks.bandsHigh.push([...binRms(high, s0, s1, BINS)].map((v) => map(db(v), P.hlo, P.hhi, 1.4) * 0.94))
    }
    // metrics: within-block contrast (std of heights), share of bars ≥ 85% of full, between-block distance of 12-pt profiles
    const std = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) }
    const prof = (a, k = 12) => Array.from({ length: k }, (_, i) => { const s = a.slice(Math.floor(i * a.length / k), Math.floor((i + 1) * a.length / k)); return s.reduce((x, y) => x + y, 0) / s.length })
    const between = (bs) => { let d = 0, c = 0; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const A = prof(bs[i]), B = prof(bs[j]); d += A.reduce((s, v, x) => s + Math.abs(v - B[x]), 0) / A.length; c++ } return d / c }
    const metric = (bs) => ({ withinStd: +(bs.reduce((s, b) => s + std(b), 0) / bs.length).toFixed(3), tallShare: +(bs.flat().filter((v) => v >= 0.85 * 0.94).length / bs.flat().length).toFixed(2), between: +between(bs).toFixed(3), meanH: +(bs.flat().reduce((s, v) => s + v, 0) / bs.flat().length).toFixed(2) })
    const m = { current_peak: metric(blocks.current), current_rms: metric(blocks.currentRms), dbPct: metric(blocks.dbPct), bandsLow: metric(blocks.bandsLow), bandsHigh: metric(blocks.bandsHigh) }
    out.push({ q, title: `${t.title} — ${t.artist.name}`, rank: t.rank, percentilesDb: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, +v.toFixed(1)])), metrics: m })
    // draw rows
    for (const mode of modes) {
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(t.title.slice(0, 24), 8, y + 30)
      g.fillStyle = '#a99be0'; g.font = '11px monospace'; g.fillText(mode === 'current' ? 'CURRENT' : mode === 'dbPct' ? 'dB pct p5–p99.5 γ1.6' : 'bands: low↓ / high↑', 8, y + 48)
      for (let k = 0; k < N; k++) {
        const x0 = labelW + k * (colW + pad)
        g.fillStyle = `hsl(${(k * 47) % 360} 70% 45%)`; g.beginPath(); g.roundRect(x0, y, colW, rowH, 12); g.fill()
        const bw = 1.6, pitch = colW * 0.82 / BINS, xs = x0 + colW * 0.09, mid = y + rowH / 2, H = rowH * 0.8
        for (let b = 0; b < BINS; b++) {
          const X = xs + b * pitch
          if (mode === 'current') {
            g.fillStyle = 'rgba(255,255,255,0.42)'; const h1 = Math.max(bw, blocks.current[k][b] * H); g.fillRect(X, mid - h1 / 2, bw, h1)
            g.fillStyle = 'rgba(255,255,255,0.95)'; const h2 = Math.max(bw, blocks.currentRms[k][b] * H); g.fillRect(X, mid - h2 / 2, bw, h2)
          } else if (mode === 'dbPct') {
            g.fillStyle = 'rgba(255,255,255,0.95)'; const h = Math.max(bw, blocks.dbPct[k][b] * H); g.fillRect(X, mid - h / 2, bw, h)
          } else {
            const hl = Math.max(bw, blocks.bandsLow[k][b] * H / 2), hh = Math.max(bw, blocks.bandsHigh[k][b] * H / 2)
            g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(X, mid, bw, hl)
            g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(X, mid - hh, bw, hh)
          }
        }
      }
      y += rowH + pad
    }
  }
  return { out, png: cv.toDataURL('image/png') }
}, QUERIES)
writeFileSync(`${OUT}wave-study.png`, Buffer.from(res.png.split(',')[1], 'base64'))
console.log(JSON.stringify(res.out, null, 1))
await browser.close()
