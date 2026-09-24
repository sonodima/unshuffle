// beforeunload guard: hosting a game in progress asks before leaving; lobby doesn't.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
async function run(phase) {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
  const page = await ctx.newPage()
  await page.goto('http://localhost:5215/', { waitUntil: 'networkidle' })
  await page.evaluate(async (phase) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/game\/store\.ts(\?|$)/.test(n))
    const { useGame } = await import(/* @vite-ignore */ url)
    const now = Date.now()
    const phases = {
      lobby: { kind: 'lobby' },
      playing: { kind: 'playing', round: 0, startedAt: now, endsAt: now + 60000, firstSubmit: null },
    }
    useGame.setState({
      role: 'host',
      connection: 'open',
      room: { code: 'KXQPM', hostId: 'me', players: [], settings: { rounds: 5, snippets: 8, roundTime: 90, finalTimer: 15, playlist: null }, phase: phases[phase], tracks: [], rounds: [], submissions: {}, ready: {}, results: [], seq: 1 },
    })
  }, phase)
  await page.mouse.click(5, 5) // sticky user activation (required for the prompt)
  await page.waitForTimeout(300)
  let dialog = null
  page.on('dialog', async (d) => {
    dialog = d.type()
    await d.dismiss()
  })
  await page.close({ runBeforeUnload: true })
  await new Promise((r) => setTimeout(r, 800))
  console.log(phase, '→ dialog:', dialog)
  await ctx.close()
}
await run('lobby')
await run('playing')
await browser.close()
