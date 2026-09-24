// Playing-phase renderer/GPU CPU, alternating variants in the same page (3 reps each).
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const SECS = 5
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const bcdp = await browser.newBrowserCDPSession()
const cpuTimes = async () => { const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo'); const o = {}; for (const p of processInfo) o[p.type] = (o[p.type] ?? 0) + p.cpuTime; return o }
const { page } = await G.newPlayer(browser, DEVICE)
await page.goto(BASE); await G.waitScreen(page, 'home')
await G.createRoom(page); await G.pickPlaylist(page)
if (DEVICE === 'phone') await page.getByRole('tab', { name: /Regole/ }).click()
await G.setRadio(page, 'Spezzoni', /^16/)
await G.setRadio(page, 'Tempo per round', '180s')
await G.start(page); await G.boardReady(page); await page.waitForTimeout(4000)
await page.evaluate(() => { const s = document.createElement('style'); s.id = '__v'; document.head.appendChild(s) })
const V = {
  default: '',
  'no backdrop-filter': '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'no timer (ring/bar hidden)': '[role=timer]{visibility:hidden!important}',
  'no background': '.ushf-bg{display:none!important}',
}
const res = {}
const measureAll = async (tag) => {
  for (let rep = 0; rep < 3; rep++) for (const [k, css] of Object.entries(V)) {
    await page.evaluate((css) => { document.getElementById('__v').textContent = css }, css)
    await page.waitForTimeout(700)
    const a = await cpuTimes(); await page.waitForTimeout(SECS * 1000); const b = await cpuTimes()
    const key = `${tag} | ${k}`
    ;(res[key] ??= []).push([((b.renderer - a.renderer) / SECS) * 100, ((b.GPU - a.GPU) / SECS) * 100])
  }
}
await measureAll('idle board')
await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
await page.waitForTimeout(500)
// only 30 s of preview: measure 2 variants during play-all
for (const k of ['default', 'no background']) {
  await page.evaluate((css) => { document.getElementById('__v').textContent = css }, V[k])
  await page.waitForTimeout(500)
  const a = await cpuTimes(); await page.waitForTimeout(SECS * 1000); const b = await cpuTimes()
  res[`play-all | ${k}`] = [[((b.renderer - a.renderer) / SECS) * 100, ((b.GPU - a.GPU) / SECS) * 100]]
}
for (const [k, v] of Object.entries(res)) {
  const med = (i) => { const s = v.map((x) => x[i]).sort((a, b) => a - b); return s[Math.floor(s.length / 2)].toFixed(1) }
  console.log(`${DEVICE} ${k.padEnd(34)} renderer ${med(0).padStart(5)}%  gpu ${med(1).padStart(5)}%   (reps gpu: ${v.map((x) => x[1].toFixed(0)).join('/')})`)
}
await browser.close()
