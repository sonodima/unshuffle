import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.FAKE_AUDIO ? ['--disable-audio-output'] : [])] })
const p = await b.newPage()
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
console.log(await p.evaluate(async () => { const c = new AudioContext(); await c.resume(); const t0 = c.currentTime; await new Promise((r) => setTimeout(r, 2000)); return { state: c.state, advanced: c.currentTime - t0, sr: c.sampleRate } }))
await b.close()
