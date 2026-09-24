// fix-net: build-time configuration (VITE_*) of the transport, checked on real builds.
//   node scripts/fix-net/env-config.mjs   (rebuilds scripts/fix-net/lab-dist twice, then restores it)
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:5460/lab/fix-net.html'
const root = new globalThis.URL('../..', import.meta.url).pathname
const build = (env) =>
  execSync('npx vite build --config scripts/fix-net/vite.lab.config.mjs', { cwd: root, env: { ...process.env, ...env }, stdio: 'pipe' })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
let failures = 0
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`)
  if (!ok) failures++
}
async function page(label, { mock } = {}) {
  const p = await (await browser.newContext()).newPage()
  const logs = []
  const sockets = []
  p.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
  p.on('websocket', (ws) => sockets.push(ws.url()))
  if (mock) await p.route('https://turn.fixnet.test/**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(mock) }))
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return { p, logs, sockets, label }
}

try {
  // A: a broken static TURN config + a runtime credentials endpoint.
  build({
    VITE_TURN_URLS: 'tun:bad.example.com:3478, turn:relay.example.com:80?transport=tcp',
    VITE_TURN_USERNAME: '',
    VITE_TURN_CREDENTIAL: '',
    VITE_TURN_CREDENTIALS_URL: 'https://turn.fixnet.test/api/v1/turn/credentials?apiKey=k',
  })
  const turn = { urls: ['turn:global.relay.metered.ca:80', 'turns:global.relay.metered.ca:443?transport=tcp'], username: 'u', credential: 'c' }
  const h = await page('A-host', { mock: [turn] })
  const c = await page('A-client', { mock: [turn] })
  const r = await h.p.evaluate(() => window.netLab.createHost())
  const j = await c.p.evaluate((code) => window.netLab.joinRoom(code), r.code)
  const ice = await c.p.evaluate(() => window.netLab.iceServers())
  check(r.ok && j.ok, `A: create + join with a broken static TURN config (${r.ms} / ${j.ms} ms)`)
  check(JSON.stringify(ice) === JSON.stringify([{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, turn]), `A: ICE = STUN + fetched TURN, bad static entries dropped: ${JSON.stringify(ice)}`)
  const warns = c.logs.filter((l) => l.includes('[net]'))
  check(warns.length >= 2, `A: deployer warnings: ${warns.join(' / ')}`)
  await h.p.context().close()
  await c.p.context().close()

  // B: self-hosted PeerServer settings reach PeerJS (host unresolvable → fast, honest error).
  build({ VITE_PEERJS_HOST: 'wss://peer.fixnet.invalid:9000/app', VITE_PEERJS_KEY: 'unshuffle' })
  const b = await page('B')
  const sig = await b.p.evaluate(() => window.netLab.signaling())
  check(JSON.stringify(sig) === JSON.stringify({ host: 'peer.fixnet.invalid', port: 9000, path: '/app', key: 'unshuffle', secure: true }), `B: signaling config ${JSON.stringify(sig)}`)
  const cr = await b.p.evaluate(() => window.netLab.createHost())
  check(!cr.ok && /Server di collegamento irraggiungibile/.test(cr.message) && cr.ms < 6000, `B: create → ${cr.ms} ms "${cr.message}"`)
  check(b.sockets.some((u) => u.startsWith('wss://peer.fixnet.invalid:9000/app/peerjs?key=unshuffle&id=')), `B: WebSocket URL ${b.sockets[0]}`)
  await b.p.context().close()

  // C: host only (plain ws on a custom port, no scheme) + an invalid port.
  build({ VITE_PEERJS_HOST: 'localhost', VITE_PEERJS_PORT: '9', VITE_PEERJS_SECURE: 'false' })
  const d = await page('C')
  const sig2 = await d.p.evaluate(() => window.netLab.signaling())
  check(sig2.host === 'localhost' && sig2.port === 9 && sig2.secure === false && sig2.path === '/', `C: ${JSON.stringify(sig2)}`)
  const cr2 = await d.p.evaluate(() => window.netLab.createHost())
  check(!cr2.ok && cr2.ms < 6000, `C: create on a closed port → ${cr2.ms} ms "${cr2.message}"`)
  check(d.sockets.some((u) => u.startsWith('ws://localhost:9/peerjs?key=peerjs&id=')), `C: WebSocket URL ${d.sockets[0]}`)
  await d.p.context().close()
} finally {
  await browser.close()
  build({})
}
console.log(failures ? `${failures} FAILED` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
