// Is the per-frame TimerRing repaint the playing-phase GPU cost? (desktop, idle board)
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
const run = async (label) => { const a = await cpuTimes(); await page.waitForTimeout(SECS * 1000); const b = await cpuTimes(); console.log(`${DEVICE} ${label.padEnd(40)} renderer ${(((b.renderer - a.renderer) / SECS) * 100).toFixed(1)}%  gpu ${(((b.GPU - a.GPU) / SECS) * 100).toFixed(1)}%`) }
await run('default (idle board)')
await page.addStyleTag({ content: '[role=timer] svg circle{filter:none!important}' })
await run('ring drop-shadow filter removed')
await page.addStyleTag({ content: '[role=timer] svg{display:none!important}' })
await run('ring svg hidden')
await page.addStyleTag({ content: '.ushf-bg{display:none!important}' })
await run('ring hidden + no background')
await browser.close()
