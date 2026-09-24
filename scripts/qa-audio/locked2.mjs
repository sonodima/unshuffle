// No user gesture (normal autoplay policy): what does the engine report when asked to play?
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const url = (await (await fetch(`https://api.deezer.com/track/${tracks[5].id}`)).json()).preview
const b = await chromium.launch({ channel: 'chrome', args: ['--disable-audio-output', '--autoplay-policy=user-gesture-required'] })
const p = await b.newPage()
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
const r1 = await p.evaluate(async (url) => {
  const eng = await import('/src/audio/engine.ts')
  await eng.audioEngine.load('k', url)
  const { useAudioUnlocked } = await import('/src/audio/usePlayback.ts')
  void useAudioUnlocked
  eng.audioEngine.playFull('k', { tag: 'reveal', fadeInMs: 400 })
  await new Promise((r) => setTimeout(r, 1500))
  return { ctx: eng.getAudioContext().state, unlocked: eng.audioEngine.unlocked, state: eng.audioEngine.getState(), pos: eng.audioEngine.getPosition() }
}, url)
console.log('without gesture:', JSON.stringify(r1))
await p.mouse.click(10, 10)
await p.waitForTimeout(1500)
const r2 = await p.evaluate(async () => {
  const eng = await import('/src/audio/engine.ts')
  return { ctx: eng.getAudioContext().state, unlocked: eng.audioEngine.unlocked, state: eng.audioEngine.getState(), elapsed: eng.audioEngine.getPosition()?.elapsed, sched: eng.engineDebug.schedule().map((i) => ({ range: i.range, when: +i.when.toFixed(3) })), now: eng.getAudioContext().currentTime }
})
console.log('after a click:', JSON.stringify(r2))
await b.close()
