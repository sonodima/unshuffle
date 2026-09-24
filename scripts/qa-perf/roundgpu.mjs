// Renderer/GPU-process CPU during the playing phase: idle board, play-all, with/without backdrop-filter.
import { chromium } from 'playwright'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5318/'
const DEVICE = process.env.DEVICE ?? 'desktop'
const SECS = 8
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const bcdp = await browser.newBrowserCDPSession()
const cpuTimes = async () => { const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo'); const o = {}; for (const p of processInfo) o[p.type] = (o[p.type] ?? 0) + p.cpuTime; return o }
const { page } = await G.newPlayer(browser, DEVICE)
await page.goto(BASE); await G.waitScreen(page, 'home')
await G.createRoom(page); await G.pickPlaylist(page)
if (DEVICE === 'phone') await page.getByRole('tab', { name: /Regole/ }).click()
await G.setRadio(page, 'Spezzoni', /^16/)
await G.setRadio(page, 'Tempo per round', '180s')
await G.start(page); await G.boardReady(page); await page.waitForTimeout(3000)
const bf = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const b = getComputedStyle(e).backdropFilter; return b && b !== 'none' && !e.closest('[inert]') && e.getBoundingClientRect().width > 0 }).length)
const run = async (label) => {
  const a = await cpuTimes(); await page.waitForTimeout(SECS * 1000); const b = await cpuTimes()
  console.log(`${DEVICE} ${label.padEnd(36)} renderer ${(((b.renderer - a.renderer) / SECS) * 100).toFixed(1)}%  gpu ${(((b.GPU - a.GPU) / SECS) * 100).toFixed(1)}%`)
}
console.log(`backdrop-filter elements on the playing screen: ${bf}`)
await run('playing, idle board')
await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
await run('playing, play-all')
await page.addStyleTag({ content: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' })
await run('play-all, NO backdrop-filter')
await page.getByRole('button', { name: 'Ferma la riproduzione' }).click().catch(() => {})
await run('idle board, NO backdrop-filter')
await page.addStyleTag({ content: '.ushf-bg{display:none!important}' })
await run('idle board, no backdrop, NO background')
await browser.close()
