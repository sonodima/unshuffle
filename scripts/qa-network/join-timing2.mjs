// QA (network): time from tapping "Entra" / "Crea stanza" to the inline error, under a signaling fault.
// Waits for one of the transport's known Italian messages (join-timing.mjs matched the coral code boxes).
//   node scripts/qa-network/join-timing2.mjs <sigblack|sigdown|nohost> [join|create]
import { chromium } from 'playwright'
const MODE = process.argv[2] ?? 'sigblack'
const ACTION = process.argv[3] ?? 'join'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5306/'
const MESSAGES = ['Connessione di rete non disponibile', 'Il server di connessione non risponde', 'Impossibile collegarsi all’host', 'Stanza non trovata', 'Errore di connessione imprevisto', 'Impossibile caricare il modulo di rete']
const args = []
if (MODE === 'sigblack') args.push('--host-resolver-rules=MAP 0.peerjs.com 192.0.2.1')
if (MODE === 'sigdown') args.push('--host-resolver-rules=MAP 0.peerjs.com ~NOTFOUND')
const browser = await chromium.launch({ channel: 'chrome', headless: true, args })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
const page = await ctx.newPage()
await page.goto(BASE)
await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
await page.waitForTimeout(1500)
let t
if (ACTION === 'join') {
  await page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap()
  await page.keyboard.type('kxqpm', { delay: 30 })
  await page.waitForTimeout(300)
  t = Date.now()
  await page.getByRole('button', { name: /^Entra/ }).tap()
} else {
  t = Date.now()
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).tap()
}
const h = await page.waitForFunction((msgs) => { const tx = document.body.innerText; const m = msgs.find((x) => tx.includes(x)); return m ? tx.slice(tx.indexOf(m), tx.indexOf(m) + 140).split('\n')[0] : null }, MESSAGES, { timeout: 60000, polling: 50 })
const ms = Date.now() - t
const logs = await page.evaluate(async () => { try { const m = await import('/src/net/runtime.ts'); return m.readNetLog().map((e) => `${e.scope}: ${e.msg}`) } catch (e) { return [String(e)] } })
console.log(`${MODE} ${ACTION}: "${await h.jsonValue()}" ${ms} ms after tap`)
console.log('  net log:', logs.slice(-12).join(' | '))
await browser.close()
