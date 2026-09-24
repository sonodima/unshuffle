// fix-net: end-to-end validation of src/net against the REAL public PeerJS
// server (copy of scripts/net/run.mjs with the new behaviour + new scenarios).
// Against the frozen lab snapshot:
//   npx vite build --config scripts/fix-net/vite.lab.config.mjs
//   npx vite preview --config scripts/fix-net/vite.lab.config.mjs --outDir scripts/fix-net/lab-dist --port 5460 --strictPort &
//   node scripts/fix-net/run.mjs [--skip-slow] [--only=<substring>]
import { chromium } from 'playwright'

const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5460/lab/fix-net.html'
const SKIP_SLOW = process.argv.includes('--skip-slow')
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7)

const results = []
let failures = 0
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const consoleLines = []
async function newPage(label, { setup } = {}) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`[${label}] pageerror`, e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleLines.push({ label, type: m.type(), text: m.text() })
      console.log(`[${label}] ${m.type()}: ${m.text().slice(0, 200)}`)
    }
  })
  if (setup) await setup(page)
  await page.goto(URL)
  await page.waitForFunction(() => !!window.netLab)
  return { ctx, page, label }
}

/** Waits until an event matching kind (+ optional data predicate source) appears after index `from`. */
async function waitEvent(p, kind, { from = 0, pred = 'true', timeout = 20000 } = {}) {
  const handle = await p.page.waitForFunction(
    ([kind, from, pred]) => {
      const fn = new Function('d', `return (${pred})`)
      const evs = window.netLab.events
      for (let i = from; i < evs.length; i++) if (evs[i].kind === kind && fn(evs[i].data)) return evs[i]
      return null
    },
    [kind, from, pred],
    { timeout, polling: 50 },
  )
  return handle.jsonValue()
}
const evCount = (p) => p.page.evaluate(() => window.netLab.events.length)
const lab = (p, fn, arg) => p.page.evaluate(fn, arg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function step(name, fn) {
  if (ONLY && !new RegExp(ONLY).test(name)) return
  const t = Date.now()
  try {
    const detail = await fn()
    record(name, true, `${Date.now() - t} ms${detail ? ` · ${detail}` : ''}`)
  } catch (e) {
    record(name, false, `${Date.now() - t} ms · ${e.message.split('\n')[0]}`)
  }
}

const host = await newPage('host')
const a = await newPage('A')
let b = await newPage('B')
let code = null

await step('create host', async () => {
  const r = await lab(host, () => window.netLab.createHost())
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  code = r.code
  return `code ${code}, createHost ${r.ms} ms`
})

await step('A and B join', async () => {
  const [ra, rb] = await Promise.all([
    lab(a, (c) => window.netLab.joinRoom(c), code.toLowerCase()),
    lab(b, (c) => window.netLab.joinRoom(c), ` ${code.slice(0, 2)} ${code.slice(2)} `),
  ])
  if (!ra.ok || !rb.ok) throw new Error(JSON.stringify({ ra, rb }))
  await host.page.waitForFunction(() => window.netLab.hostConnIds().length === 2, null, { timeout: 5000 })
  const sa = await lab(a, () => window.netLab.status().client)
  if (sa !== 'open') throw new Error(`A status ${sa}`)
  return `joinRoom A ${ra.ms} ms, B ${rb.ms} ms`
})

await step('messages both ways + broadcast + chunked state', async () => {
  const h0 = await evCount(host)
  const a0 = await evCount(a)
  const b0 = await evCount(b)
  const t = Date.now()
  await lab(a, () => window.netLab.clientSend({ t: 'ping', c: 4242 }))
  await waitEvent(host, 'host:message', { from: h0, pred: 'd.msg.t === "ping" && d.msg.c === 4242' })
  await waitEvent(a, 'client:message', { from: a0, pred: 'd.t === "pong" && d.c === 4242' })
  const rtt = Date.now() - t
  await lab(b, () => window.netLab.clientSend({ t: 'reaction', emoji: '🔥' }))
  await waitEvent(host, 'host:message', { from: h0, pred: 'd.msg.t === "reaction" && d.msg.emoji === "🔥"' })
  await lab(host, () => window.netLab.hostBroadcast({ t: 'event', event: { type: 'info', message: 'Ciao a tutti è 😀' } }))
  await Promise.all([
    waitEvent(a, 'client:message', { from: a0, pred: 'd.t === "event" && d.event.message === "Ciao a tutti è 😀"' }),
    waitEvent(b, 'client:message', { from: b0, pred: 'd.t === "event" && d.event.message === "Ciao a tutti è 😀"' }),
  ])
  const size = await lab(host, () => window.netLab.hostBroadcastBig())
  const [ea, eb] = await Promise.all([
    waitEvent(a, 'client:message', { from: a0, pred: 'd.t === "state" && d.state.tracks.length === 14' }),
    waitEvent(b, 'client:message', { from: b0, pred: 'd.t === "state" && d.state.tracks.length === 14' }),
  ])
  const ok = ea.data.state.tracks[3].title === 'Brano «3» 😀' && eb.data.state.results.length === 10
  if (!ok) throw new Error('big state corrupted')
  // A big client→host message too (chunked upstream).
  const order = Array.from({ length: 5000 }, (_, i) => i)
  await lab(a, (o) => window.netLab.clientSend({ t: 'arrange', round: 1, order: o }), order)
  await waitEvent(host, 'host:message', { from: h0, pred: 'd.msg.t === "arrange" && d.msg.order.length === 5000 && d.msg.order[4999] === 4999' })
  return `ping RTT ${rtt} ms, big state ${size} chars delivered to both`
})

await step('remotePeerId matches client peer id', async () => {
  const ids = await lab(host, () => window.netLab.hostConnIds())
  const peers = await lab(host, (ids) => ids.map((id) => window.netLab.hostRemotePeer(id)), ids)
  const pa = await lab(a, () => window.netLab.clientPeerId())
  if (!peers.includes(pa)) throw new Error(`${pa} not in ${peers}`)
  return pa
})

await step('ICE path', async () => {
  const paths = await lab(a, () => window.netLab.icePaths())
  return paths.join(', ')
})

await step('unknown code → room-not-found', async () => {
  const probe = await newPage('probe')
  let bogus = 'ZZZZZ'
  if (bogus === code) bogus = 'YYYYY'
  const r = await lab(probe, (c) => window.netLab.joinRoom(c), bogus)
  // Same wrong code again, twice (the server swallows every other offer to an unknown id).
  const r2 = await lab(probe, (c) => window.netLab.joinRoom(c), bogus)
  const r3 = await lab(probe, (c) => window.netLab.joinRoom(c), bogus)
  const bad = await lab(probe, () => window.netLab.joinRoom('AB1'))
  const stats = await lab(probe, () => new Promise((res) => setTimeout(() => res(window.netLab.stats()), 400)))
  await probe.ctx.close()
  for (const x of [r, r2, r3]) if (x.ok || x.code !== 'room-not-found') throw new Error(JSON.stringify(x))
  if (bad.ok || bad.code !== 'room-not-found') throw new Error(JSON.stringify(bad))
  if (stats.peers !== 0 || stats.timers !== 0 || stats.clients !== 0) throw new Error(`leak after failed join ${JSON.stringify(stats)}`)
  return `rejected in ${r.ms} / ${r2.ms} / ${r3.ms} ms: "${r.message}" · invalid code: "${bad.message}"`
})

await step('client link broken in-page → reconnecting → open', async () => {
  const h0 = await evCount(host)
  const a0 = await evCount(a)
  const peerBefore = await lab(a, () => window.netLab.clientPeerId())
  const t = Date.now()
  await lab(a, () => window.netLab.breakLink())
  await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "reconnecting"', timeout: 3000 })
  const open = await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "open"', timeout: 20000 })
  const tOpen = Date.now() - t
  await waitEvent(host, 'host:disconnect', { from: h0, timeout: 12000 })
  await waitEvent(host, 'host:connect', { from: h0, timeout: 12000 })
  await lab(a, () => window.netLab.clientSend({ t: 'ping', c: 777 }))
  await waitEvent(host, 'host:message', { from: h0, pred: 'd.msg.c === 777' })
  const peerAfter = await lab(a, () => window.netLab.clientPeerId())
  if (peerAfter !== peerBefore) throw new Error('client peer id changed across reconnect')
  return `reopened in ${tOpen} ms (detail ${open.data.d}), same peer id`
})

await step('silent dead link (freeze) → host onDisconnect via heartbeat ≤ 12 s, client recovers', async () => {
  const h0 = await evCount(host)
  const a0 = await evCount(a)
  const t = Date.now()
  await lab(a, () => window.netLab.freezeLink())
  const disc = await waitEvent(host, 'host:disconnect', { from: h0, timeout: 16000 })
  const tDisc = Date.now() - t
  await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "reconnecting"', timeout: 16000 })
  const tRec = Date.now() - t
  await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "open"', timeout: 20000 })
  const tOpen = Date.now() - t
  if (tDisc > 12500) throw new Error(`host noticed after ${tDisc} ms`)
  return `host onDisconnect(${disc.data}) after ${tDisc} ms, client reconnecting after ${tRec} ms, open after ${tOpen} ms`
})

await step('stale link superseded: host retires old conn before the new one', async () => {
  const h0 = await evCount(host)
  const a0 = await evCount(a)
  const t = Date.now()
  await lab(a, () => window.netLab.abandonLink())
  await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "open"', timeout: 15000 })
  const disc = await waitEvent(host, 'host:disconnect', { from: h0, timeout: 5000 })
  const conn = await waitEvent(host, 'host:connect', { from: h0, timeout: 5000 })
  const evs = (await lab(host, () => window.netLab.events)).slice(h0).map((e) => e.kind)
  if (evs.indexOf('host:disconnect') > evs.indexOf('host:connect')) throw new Error(`order ${evs}`)
  if (disc.t > conn.t) throw new Error('disconnect after connect')
  return `disconnect(old) → connect(new) in ${Date.now() - t} ms`
})

await step('duplicated host tab (same sessionStorage) does not hijack the live code', async () => {
  const dup = await host.ctx.newPage()
  await dup.goto(URL)
  await dup.waitForFunction(() => !!window.netLab)
  const session = await lab(host, () => window.netLab.sessionDump())
  await dup.evaluate((d) => window.netLab.sessionLoad(d), session)
  const r = await dup.evaluate((c) => window.netLab.createHost(c), code)
  await dup.evaluate(() => window.netLab.hostClose())
  await dup.close()
  if (!r.ok || r.code === code) throw new Error(`dup got ${JSON.stringify(r)}`)
  // Original host still serves its clients.
  const a0 = await evCount(a)
  await lab(a, () => window.netLab.clientSend({ t: 'ping', c: 999 }))
  await waitEvent(a, 'client:message', { from: a0, pred: 'd.t === "pong" && d.c === 999', timeout: 5000 })
  return `duplicate got fresh code ${r.code} in ${r.ms} ms; original room unaffected`
})

await step('signaling drop (host + client) → reconnect, data channels keep working', async () => {
  const h0 = await evCount(host)
  const a0 = await evCount(a)
  const t = Date.now()
  await lab(host, () => window.netLab.dropSignaling('host'))
  await waitEvent(host, 'host:status', { from: h0, pred: 'd.s === "reconnecting"', timeout: 3000 })
  // Traffic during the signaling outage.
  await lab(a, () => window.netLab.clientSend({ t: 'ping', c: 31337 }))
  await waitEvent(a, 'client:message', { from: a0, pred: 'd.t === "pong" && d.c === 31337', timeout: 5000 })
  await waitEvent(host, 'host:status', { from: h0, pred: 'd.s === "open"', timeout: 20000 })
  const tHost = Date.now() - t
  const dropped = await lab(a, () => window.netLab.dropSignaling('client'))
  await sleep(2500)
  await lab(a, () => window.netLab.clientSend({ t: 'ping', c: 31338 }))
  await waitEvent(a, 'client:message', { from: a0, pred: 'd.t === "pong" && d.c === 31338', timeout: 5000 })
  const disconnects = (await lab(host, () => window.netLab.events)).slice(h0).filter((e) => e.kind === 'host:disconnect').length
  if (disconnects) throw new Error('a data channel dropped during the signaling outage')
  return `host signaling back in ${tHost} ms; client signaling dropped=${dropped}, channel unaffected`
})

await step('client context closed abruptly → host onDisconnect ≤ 12 s', async () => {
  const h0 = await evCount(host)
  const t = Date.now()
  await b.ctx.close()
  await waitEvent(host, 'host:disconnect', { from: h0, timeout: 14000 })
  const ms = Date.now() - t
  if (ms > 12500) throw new Error(`took ${ms} ms`)
  return `onDisconnect after ${ms} ms`
})

await step('kick: drop(conn, reject) → client gets reject, closes, no reconnect', async () => {
  b = await newPage('B2')
  const r = await lab(b, (c) => window.netLab.joinRoom(c), code)
  if (!r.ok) throw new Error(JSON.stringify(r))
  await host.page.waitForFunction(() => window.netLab.hostConnIds().length === 2, null, { timeout: 8000 })
  const pb = await lab(b, () => window.netLab.clientPeerId())
  const ids = await lab(host, () => window.netLab.hostConnIds())
  const idB = (await lab(host, (ids) => ids.map((id) => [id, window.netLab.hostRemotePeer(id)]), ids)).find(([, p]) => p === pb)[0]
  const h0 = await evCount(host)
  const b0 = await evCount(b)
  const t = Date.now()
  await lab(host, (id) => window.netLab.hostDrop(id, { t: 'reject', reason: 'kicked' }), idB)
  await waitEvent(b, 'client:message', { from: b0, pred: 'd.t === "reject" && d.reason === "kicked"', timeout: 5000 })
  const closed = await waitEvent(b, 'client:status', { from: b0, pred: 'd.s === "closed"', timeout: 5000 })
  await waitEvent(host, 'host:disconnect', { from: h0, pred: `d === ${JSON.stringify(idB)}`, timeout: 5000 })
  const tHost = Date.now() - t
  await sleep(1500)
  const later = (await lab(b, () => window.netLab.events)).slice(b0).filter((e) => e.kind === 'client:status')
  const stats = await lab(b, () => window.netLab.stats())
  if (later.some((e) => e.data.s === 'reconnecting')) throw new Error('client tried to reconnect after reject')
  if (stats.peers || stats.timers || stats.clients) throw new Error(`leak ${JSON.stringify(stats)}`)
  await b.ctx.close()
  return `closed (${closed.data.d}) · host onDisconnect after ${tHost} ms · client resources freed`
})

await step('host page reload + createHost({code}) → same code, client reconnects', async () => {
  const a0 = await evCount(a)
  const t = Date.now()
  await host.page.reload()
  await host.page.waitForFunction(() => !!window.netLab)
  const r = await lab(host, (c) => window.netLab.createHost(c), code)
  const tHost = Date.now() - t
  if (!r.ok || r.code !== code) throw new Error(`reclaim failed ${JSON.stringify(r)}`)
  await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "reconnecting"', timeout: 5000 })
  await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "open"', timeout: 30000 })
  const tClient = Date.now() - t
  await lab(a, () => window.netLab.clientSend({ t: 'hello', profile: { id: 'p1', name: 'Test', avatar: 0, color: 0 }, version: 1 }))
  await waitEvent(host, 'host:message', { pred: 'd.msg.t === "hello"', timeout: 5000 })
  return `code ${code} reclaimed in ${tHost} ms (createHost ${r.ms} ms); client open again after ${tClient} ms`
})

await step('host close() → client closed immediately, no retries', async () => {
  const a0 = await evCount(a)
  const t = Date.now()
  await lab(host, () => window.netLab.hostClose())
  const closed = await waitEvent(a, 'client:status', { from: a0, pred: 'd.s === "closed"', timeout: 5000 })
  const ms = Date.now() - t
  await sleep(1500)
  const evs = (await lab(a, () => window.netLab.events)).slice(a0).filter((e) => e.kind === 'client:status')
  if (evs.some((e) => e.data.s === 'reconnecting')) throw new Error('client retried')
  const [sa, sh] = await Promise.all([lab(a, () => window.netLab.stats()), lab(host, () => window.netLab.stats())])
  if (sa.peers || sa.timers || sa.listeners || sa.clients) throw new Error(`client leak ${JSON.stringify(sa)}`)
  if (sh.peers || sh.timers || sh.listeners || sh.hosts) throw new Error(`host leak ${JSON.stringify(sh)}`)
  return `client 'closed' (${closed.data.d}) after ${ms} ms, all resources freed on both sides`
})

await step('repeated create/join cycles in one tab → no leaks', async () => {
  const p = await newPage('cycles')
  const timings = await lab(p, () => window.netLab.cycles(4))
  const stats = await lab(p, () => new Promise((res) => setTimeout(() => res(window.netLab.stats()), 800)))
  await p.ctx.close()
  if (stats.peers || stats.timers || stats.listeners || stats.hosts || stats.clients) throw new Error(`leak ${JSON.stringify(stats)}`)
  return `cycles ${timings.join(' / ')} ms, stats ${JSON.stringify(stats)}`
})

// Relay-only run, needs a TURN server: NET_TURN='[{"urls":"turn:…","username":"…","credential":"…"}]'
if (process.env.NET_TURN) await step('TURN relay only', async () => {
  const turn = JSON.parse(process.env.NET_TURN)
  const h = await newPage('relay-host')
  const c = await newPage('relay-client')
  for (const p of [h, c]) await lab(p, (t) => { window.netLab.setIce(t); window.netLab.forceRelay(true) }, turn)
  const r = await lab(h, () => window.netLab.createHost())
  if (!r.ok) throw new Error(JSON.stringify(r))
  const j = await lab(c, (code) => window.netLab.joinRoom(code), r.code)
  if (!j.ok) {
    await h.ctx.close()
    await c.ctx.close()
    throw new Error(`relay join failed: ${JSON.stringify(j)}`)
  }
  const c0 = await evCount(c)
  await lab(c, () => window.netLab.clientSend({ t: 'ping', c: 5 }))
  await waitEvent(c, 'client:message', { from: c0, pred: 'd.t === "pong"', timeout: 8000 })
  const paths = await lab(c, () => window.netLab.icePaths())
  await h.ctx.close()
  await c.ctx.close()
  if (!paths.some((p) => p.startsWith('relay'))) throw new Error(`not relayed: ${paths}`)
  return `join ${j.ms} ms via ${paths.join(', ')}`
})


// ---------------------------------------------------------------- fix-net: new behaviour

/** A fresh host + one client in their own contexts. */
async function pair(tag, { hostSetup, clientSetup } = {}) {
  const h = await newPage(`${tag}-host`, { setup: hostSetup })
  const c = await newPage(`${tag}-client`, { setup: clientSetup })
  const r = await lab(h, () => window.netLab.createHost())
  if (!r.ok) throw new Error(`createHost ${JSON.stringify(r)}`)
  const j = await lab(c, (code) => window.netLab.joinRoom(code), r.code)
  if (!j.ok) throw new Error(`joinRoom ${JSON.stringify(j)}`)
  await h.page.waitForFunction(() => window.netLab.hostConnIds().length === 1, null, { timeout: 8000 })
  const close = async () => {
    await h.ctx.close().catch(() => {})
    await c.ctx.close().catch(() => {})
  }
  return { h, c, code: r.code, close }
}

await step('client pagehide → bye away → host onDisconnect at once; page lives on → client back', async () => {
  const { h, c, close } = await pair('ph')
  try {
    const h0 = await evCount(h)
    const c0 = await evCount(c)
    const t = Date.now()
    await lab(c, () => window.netLab.pageHide())
    const disc = await waitEvent(h, 'host:disconnect', { from: h0, timeout: 5000 })
    const tDisc = Date.now() - t
    // Not unloaded after all (bfcache-like): the host closed that link, the client comes back.
    await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "open"', timeout: 15000 })
    const tBack = Date.now() - t
    await waitEvent(h, 'host:connect', { from: h0, timeout: 5000 })
    if (tDisc > 2000) throw new Error(`host noticed after ${tDisc} ms`)
    const hostLog = (await lab(h, () => window.netLab.log())).map((l) => l.msg).filter((m) => m.startsWith('disconnect'))
    if (!hostLog.some((m) => m.includes('bye:away'))) throw new Error(`no bye:away in ${hostLog}`)
    return `host onDisconnect(${disc.data}) after ${tDisc} ms (bye:away), client open again after ${tBack} ms`
  } finally {
    await close()
  }
})

await step('host pagehide → clients reconnecting at once (host-away), back open when the page lives on', async () => {
  const { h, c, close } = await pair('hph')
  try {
    const c0 = await evCount(c)
    const t = Date.now()
    await lab(h, () => window.netLab.pageHide())
    const rec = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "reconnecting"', timeout: 5000 })
    const tRec = Date.now() - t
    await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "open"', timeout: 20000 })
    const tOpen = Date.now() - t
    if (rec.data.d !== 'host-away') throw new Error(`detail ${rec.data.d}`)
    if (tRec > 1500) throw new Error(`reconnecting after ${tRec} ms`)
    return `reconnecting (${rec.data.d}) after ${tRec} ms, open after ${tOpen} ms`
  } finally {
    await close()
  }
})

await step('oversized client → host message: host drops that connection instead of parsing it', async () => {
  const { h, c, close } = await pair('big')
  try {
    const h0 = await evCount(h)
    const c0 = await evCount(c)
    const t = Date.now()
    await lab(c, () => window.netLab.clientSend({ t: 'reaction', emoji: '🔥'.repeat(60000) }))
    const disc = await waitEvent(h, 'host:disconnect', { from: h0, timeout: 5000 })
    const got = (await lab(h, () => window.netLab.events)).slice(h0).filter((e) => e.kind === 'host:message' && e.data.msg.t === 'reaction')
    if (got.length) throw new Error('the oversized reaction was delivered')
    const why = (await lab(h, () => window.netLab.log())).map((l) => l.msg).find((m) => m.includes('oversize'))
    if (!why) throw new Error('no oversize disconnect in host log')
    // A normal-size message from the reconnected client still works.
    await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "open" && d.d === "reconnected"', timeout: 15000 })
    const c1 = await evCount(c)
    await lab(c, () => window.netLab.clientSend({ t: 'ping', c: 1 }))
    await waitEvent(c, 'client:message', { from: c1, pred: 'd.t === "pong" && d.c === 1', timeout: 5000 })
    return `host "${why}" after ${Date.now() - t} ms (conn ${disc.data}); client reconnected and works`
  } finally {
    await close()
  }
})

await step('malformed TURN entries are dropped: joins still work (client AND host with a bad config)', async () => {
  const bad = [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['tun:relay.example.com:3478'], username: 'u', credential: 'p' },
    { urls: ['turns:relay.example.com:443?transport=tls'], username: 'u', credential: 'p' },
    { urls: ['turn:relay.example.com:3478'], username: '', credential: '' },
  ]
  const h = await newPage('badice-host')
  const c = await newPage('badice-client')
  try {
    for (const p of [h, c]) await lab(p, (ice) => window.netLab.setIce(ice), bad)
    const used = await lab(c, () => window.netLab.iceServers())
    const r = await lab(h, () => window.netLab.createHost())
    if (!r.ok) throw new Error(JSON.stringify(r))
    const j = await lab(c, (code) => window.netLab.joinRoom(code), r.code)
    if (!j.ok) throw new Error(`join failed ${JSON.stringify(j)}`)
    const c0 = await evCount(c)
    await lab(c, () => window.netLab.clientSend({ t: 'ping', c: 9 }))
    await waitEvent(c, 'client:message', { from: c0, pred: 'd.t === "pong"', timeout: 5000 })
    const warns = consoleLines.filter((l) => l.label.startsWith('badice') && l.text.startsWith('[net]'))
    if (!warns.length) throw new Error('no console warning about the bad entries')
    return `join ${j.ms} ms with ${JSON.stringify(used)}; ${warns.length} warning(s)`
  } finally {
    await h.ctx.close()
    await c.ctx.close()
  }
})

await step('runtime TURN credentials endpoint (mocked): fetched, merged after STUN, applied to live Peers', async () => {
  let hits = 0
  const setup = async (page) => {
    await page.route('https://turn.fixnet.test/**', async (route) => {
      hits++
      const n = hits
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify([
          { urls: 'stun:stun.relay.metered.ca:80' },
          { urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turns:global.relay.metered.ca:443?transport=tcp'], username: `user${n}`, credential: `cred${n}` },
        ]),
      })
    })
  }
  const p = await newPage('turn', { setup })
  try {
    await lab(p, () => window.netLab.setTurnUrl('https://turn.fixnet.test/api/v1/turn/credentials?apiKey=k'))
    const t = Date.now()
    await lab(p, () => window.netLab.prepareIce(2500))
    const ms = Date.now() - t
    const servers = await lab(p, () => window.netLab.iceServers())
    const flat = JSON.stringify(servers)
    if (!flat.includes('user1') || !flat.startsWith('[{"urls":["stun:stun.l.google.com:19302","stun:stun.cloudflare.com:3478"]}')) throw new Error(flat)
    // A host created now uses it for every incoming connection.
    const r = await lab(p, () => window.netLab.createHost())
    if (!r.ok) throw new Error(JSON.stringify(r))
    // A broken endpoint keeps the previous servers (no crash, a warning).
    await p.page.unroute('https://turn.fixnet.test/**')
    await p.page.route('https://turn.fixnet.test/**', (route) => route.fulfill({ status: 500, body: 'nope' }))
    await lab(p, () => window.netLab.setTurnUrl('https://turn.fixnet.test/other'))
    await lab(p, () => window.netLab.prepareIce(2500))
    const after = JSON.stringify(await lab(p, () => window.netLab.iceServers()))
    await lab(p, () => window.netLab.hostClose())
    return `fetched in ${ms} ms (${hits} hit): ${servers.length} servers; failing endpoint → ${after.includes('turn:') ? 'kept TURN' : 'STUN only'}`
  } finally {
    await p.ctx.close()
  }
})

await step('signaling server unreachable (DNS) → create & join say "server di collegamento", fast', async () => {
  const p = await newPage('sigdown')
  try {
    await lab(p, () => window.netLab.setSignaling({ host: 'peer.fixnet.invalid', port: 443, secure: true }))
    const r = await lab(p, () => window.netLab.createHost())
    const j = await lab(p, () => window.netLab.joinRoom('KXQPM'))
    if (r.ok || j.ok) throw new Error(JSON.stringify({ r, j }))
    for (const x of [r, j]) if (!/Server di collegamento irraggiungibile/.test(x.message)) throw new Error(JSON.stringify(x))
    if (r.ms > 8000 || j.ms > 8000) throw new Error(`slow: create ${r.ms} ms, join ${j.ms} ms`)
    return `create ${r.ms} ms, join ${j.ms} ms: "${j.message}"`
  } finally {
    await p.ctx.close()
  }
})

await step('signaling server black-holed → create & join say "server di collegamento" within ~11 s', async () => {
  const setup = async (page) => {
    // Accept the WebSocket but never connect it anywhere (nothing ever comes back).
    await page.routeWebSocket(/0\.peerjs\.com/, () => {})
  }
  const p = await newPage('sigblack', { setup })
  try {
    const [r, j] = [await lab(p, () => window.netLab.createHost()), await lab(p, () => window.netLab.joinRoom('KXQPM'))]
    if (r.ok || j.ok) throw new Error(JSON.stringify({ r, j }))
    for (const x of [r, j]) if (!/server di collegamento/i.test(x.message)) throw new Error(JSON.stringify(x))
    if (r.ms > 12500 || j.ms > 12500) throw new Error(`slow: create ${r.ms} ms, join ${j.ms} ms`)
    return `create ${r.ms} ms "${r.message}", join ${j.ms} ms`
  } finally {
    await p.ctx.close()
  }
})

await step('host on a slow signaling link (1.6 s each way) → guests still get in', async () => {
  const delay = 1600
  const setup = async (page) => {
    await page.routeWebSocket(/0\.peerjs\.com/, (ws) => {
      const server = ws.connectToServer()
      ws.onMessage((m) => setTimeout(() => server.send(m), delay))
      server.onMessage((m) => setTimeout(() => ws.send(m), delay))
    })
  }
  const h = await newPage('slow-host', { setup })
  const c = await newPage('slow-client')
  try {
    const r = await lab(h, () => window.netLab.createHost())
    if (!r.ok) throw new Error(JSON.stringify(r))
    const j = await lab(c, (code) => window.netLab.joinRoom(code), r.code)
    if (!j.ok) throw new Error(`join ${JSON.stringify(j)}`)
    return `create ${r.ms} ms, join ${j.ms} ms`
  } finally {
    await h.ctx.close()
    await c.ctx.close()
  }
})

await step('offline → createHost / joinRoom fail fast with network', async () => {
  const p = await newPage('offline')
  await p.ctx.setOffline(true)
  const r = await lab(p, () => window.netLab.createHost())
  const j = await lab(p, () => window.netLab.joinRoom('KXQPM'))
  await p.ctx.close()
  if (r.ok || r.code !== 'network' || j.ok || j.code !== 'network') throw new Error(JSON.stringify({ r, j }))
  return `createHost ${r.ms} ms, joinRoom ${j.ms} ms: "${r.message}"`
})

if (!SKIP_SLOW) {
  await step('requested code held by another live host → falls back to a fresh code', async () => {
    const h1 = await newPage('holder')
    const h2 = await newPage('claimer')
    const r1 = await lab(h1, () => window.netLab.createHost())
    const r2 = await lab(h2, (c) => window.netLab.createHost(c), r1.code)
    await h1.ctx.close()
    await h2.ctx.close()
    if (!r2.ok || r2.code === r1.code) throw new Error(JSON.stringify({ r1, r2 }))
    return `held ${r1.code} → got ${r2.code} after ${r2.ms} ms`
  })

  await step('host tab closes (pagehide + gone) → client closed (host-gone) in ~10–16 s', async () => {
    const { h, c, close } = await pair('gone')
    try {
      const c0 = await evCount(c)
      const t = Date.now()
      await lab(h, () => window.netLab.pageHide())
      await h.ctx.close()
      const rec = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "reconnecting"', timeout: 3000 })
      const tRec = Date.now() - t
      const closed = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "closed"', timeout: 40000 })
      const tClosed = Date.now() - t
      const attempts = (await lab(c, () => window.netLab.log())).filter((l) => l.msg.startsWith('reconnect attempt')).map((l) => l.msg.replace('reconnect attempt ', '#'))
      await sleep(1000)
      const stats = await lab(c, () => window.netLab.stats())
      if (closed.data.d !== 'host-gone') throw new Error(`detail ${closed.data.d}`)
      if (tClosed > 17000) throw new Error(`took ${tClosed} ms`)
      if (stats.peers || stats.timers || stats.clients) throw new Error(`leak ${JSON.stringify(stats)}`)
      return `reconnecting (${rec.data.d}) after ${tRec} ms, closed (host-gone) after ${tClosed} ms; ${attempts.join(', ')}`
    } finally {
      await close()
    }
  })

  await step('host vanishes without any goodbye (context closed) → client closed (host-gone) ≤ 30 s', async () => {
    const { h, c, close } = await pair('ghost')
    try {
      const c0 = await evCount(c)
      const t = Date.now()
      await h.ctx.close()
      const rec = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "reconnecting"', timeout: 14000 })
      const tRec = Date.now() - t
      const closed = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "closed"', timeout: 45000 })
      const tClosed = Date.now() - t
      if (closed.data.d !== 'host-gone') throw new Error(`detail ${closed.data.d}`)
      if (tClosed > 30000) throw new Error(`took ${tClosed} ms`)
      return `reconnecting (${rec.data.d}) after ${tRec} ms, closed (host-gone) after ${tClosed} ms`
    } finally {
      await close()
    }
  })

  await step('host JS frozen 45 s (phone host in another app) → client keeps retrying, back open after resume', async () => {
    const { h, c, close } = await pair('freeze')
    try {
      const cdp = await h.ctx.newCDPSession(h.page)
      await cdp.send('Debugger.enable')
      const c0 = await evCount(c)
      const t = Date.now()
      await cdp.send('Debugger.pause')
      await sleep(45000)
      const mid = (await lab(c, () => window.netLab.events)).slice(c0).filter((e) => e.kind === 'client:status').map((e) => `${e.data.s}(${e.data.d ?? ''})`)
      await cdp.send('Debugger.resume')
      const tResume = Date.now() - t
      const open = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "open" || d.s === "closed"', timeout: 30000 })
      const tOpen = Date.now() - t
      if (mid.some((x) => x.startsWith('closed'))) throw new Error(`closed while frozen: ${mid}`)
      if (open.data.s !== 'open') throw new Error(`ended ${open.data.s} (${open.data.d})`)
      const c1 = await evCount(c)
      await lab(c, () => window.netLab.clientSend({ t: 'ping', c: 45 }))
      await waitEvent(c, 'client:message', { from: c1, pred: 'd.t === "pong" && d.c === 45', timeout: 5000 })
      return `during freeze: ${mid.join(' → ')}; resumed at ${tResume} ms, open again at ${tOpen} ms (${tOpen - tResume} ms after resume)`
    } finally {
      await close()
    }
  })

  await step('host signaling half-dead + link dead (handover) → host recycles its socket, client back', async () => {
    const sockets = []
    const hostSetup = async (page) => {
      await page.routeWebSocket(/0\.peerjs\.com/, (ws) => {
        const server = ws.connectToServer()
        const entry = { dead: false }
        sockets.push(entry)
        ws.onMessage((m) => {
          if (!entry.dead) server.send(m)
        })
        server.onMessage((m) => {
          if (!entry.dead) ws.send(m)
        })
        server.onClose(() => {
          if (!entry.dead) ws.close()
        })
      })
    }
    const { h, c, close } = await pair('handover', { hostSetup })
    try {
      await sleep(1500)
      const c0 = await evCount(c)
      const t = Date.now()
      for (const s of sockets) s.dead = true
      await lab(c, () => window.netLab.freezeLink())
      const res = await waitEvent(c, 'client:status', { from: c0, pred: 'd.s === "open" || d.s === "closed"', timeout: 90000 })
      const tRes = Date.now() - t
      const hostLog = (await lab(h, () => window.netLab.log())).map((l) => l.msg).filter((m) => /recycle|disconnect|status/.test(m))
      const hostStatus = (await lab(h, () => window.netLab.events)).filter((e) => e.kind === 'host:status').map((e) => e.data.s)
      if (res.data.s !== 'open') throw new Error(`client ${res.data.s} (${res.data.d}) after ${tRes} ms; host: ${hostLog.join(' / ')}`)
      return `client open again after ${tRes} ms; host: ${hostLog.join(' / ')}; host statuses ${hostStatus.join(',')}`
    } finally {
      await close()
    }
  })
}

await browser.close()
console.log('\n=== SUMMARY ===')
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}\n    ${r.detail}`)
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
