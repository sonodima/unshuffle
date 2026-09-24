// Net lab: drives the real transport against the public PeerJS server.
// Exposes window.netLab for scripts/net/run.mjs (Playwright), plus a tiny UI.

import { configureIceServers, createHost, joinRoom, netDebug, NetError } from '../../net/transport'
import type { ClientConnection, ConnStatus, HostServer } from '../../net/transport'
import type { ClientMsg, HostMsg } from '../../net/protocol'
import { fxFinal, fxTrack } from '../fixtures'

interface LabEvent {
  t: number
  wall: number
  kind: string
  data?: unknown
}

// Track every RTCPeerConnection so the lab can report which ICE path was used.
const pcs: RTCPeerConnection[] = []
const NativePC = window.RTCPeerConnection
window.RTCPeerConnection = class extends NativePC {
  constructor(config?: RTCConfiguration) {
    super(config)
    pcs.push(this)
  }
} as typeof RTCPeerConnection

const events: LabEvent[] = []
let host: HostServer | null = null
let client: ClientConnection | null = null
let hostStatus: string = 'none'
let clientStatus: string = 'none'
const offs: (() => void)[] = []

function push(kind: string, data?: unknown): void {
  events.push({ t: Math.round(performance.now()), wall: Date.now(), kind, data })
  render()
}

function errInfo(e: unknown): { code: string; message: string } {
  if (e instanceof NetError) return { code: e.code, message: e.message }
  return { code: 'exception', message: String(e) }
}

function bigState(): HostMsg {
  const tracks = Array.from({ length: 14 }, (_, i) => ({
    ...fxTrack,
    id: 1000 + i,
    title: `Brano «${i}» 😀`,
    preview: `https://cdnt-preview.dzcdn.net/api/1/1/${'x'.repeat(260)}?hdnea=exp=${i}~acl=/api/1/1/*~data=user_id=0,application_id=42~hmac=${'f'.repeat(64)}`,
  }))
  return {
    t: 'state',
    hostNow: Date.now(),
    state: { ...fxFinal, tracks, results: Array.from({ length: 10 }, () => [...fxFinal.results[0], ...fxFinal.results[0]]) },
  }
}

const lab = {
  events,
  clear(): void {
    events.length = 0
    render()
  },
  status: () => ({ host: hostStatus, client: clientStatus, code: host?.code ?? client?.code ?? null }),

  async createHost(code?: string) {
    const t = performance.now()
    try {
      const h = await createHost(code ? { code } : undefined)
      host = h
      offs.push(
        h.onStatus((s: ConnStatus, d?: string) => {
          hostStatus = s
          push('host:status', { s, d })
        }),
        h.onConnect((id) => push('host:connect', id)),
        h.onDisconnect((id) => push('host:disconnect', id)),
        h.onMessage((id, msg: ClientMsg) => {
          push('host:message', { id, msg })
          // Echo pings like the real host does, so the client sees traffic.
          if (msg.t === 'ping') h.send(id, { t: 'pong', c: msg.c, h: Date.now() })
        }),
      )
      return { ok: true, code: h.code, ms: Math.round(performance.now() - t) }
    } catch (e) {
      return { ok: false, ...errInfo(e), ms: Math.round(performance.now() - t) }
    }
  },

  async joinRoom(code: string) {
    const t = performance.now()
    try {
      const c = await joinRoom(code)
      client = c
      offs.push(
        c.onMessage((msg) => push('client:message', msg)),
        c.onStatus((s, d) => {
          clientStatus = s
          push('client:status', { s, d })
        }),
      )
      return { ok: true, ms: Math.round(performance.now() - t) }
    } catch (e) {
      return { ok: false, ...errInfo(e), ms: Math.round(performance.now() - t) }
    }
  },

  hostConnIds: (): string[] => (host ? netDebug.connIds(host) : []),
  hostSend: (connId: string, msg: HostMsg): void => host?.send(connId, msg),
  hostBroadcast: (msg: HostMsg): void => host?.broadcast(msg),
  hostBroadcastBig: (): number => {
    const msg = bigState()
    host?.broadcast(msg)
    return JSON.stringify(msg).length
  },
  hostDrop: (connId: string, msg?: HostMsg): void => host?.drop(connId, msg),
  hostRemotePeer: (connId: string): string | null => host?.remotePeerId?.(connId) ?? null,
  hostClose(): void {
    host?.close()
    host = null
    hostStatus = 'closed-by-app'
    render()
  },
  clientSend: (msg: ClientMsg): void => client?.send(msg),
  clientClose(): void {
    client?.close()
    client = null
    clientStatus = 'closed-by-app'
    render()
  },
  clientPeerId: (): string | null => (client ? netDebug.peerId(client) : null),
  breakLink: (): boolean => (client ? netDebug.breakLink(client) : false),
  freezeLink: (): boolean => (client ? netDebug.freezeLink(client) : false),
  abandonLink: (): boolean => (client ? netDebug.abandonLink(client) : false),
  sessionDump: (): Record<string, string> => ({ ...sessionStorage }),
  sessionLoad: (data: Record<string, string>): void => {
    for (const [k, v] of Object.entries(data)) sessionStorage.setItem(k, v)
  },
  dropSignaling: (who: 'host' | 'client'): boolean => {
    const target = who === 'host' ? host : client
    return target ? netDebug.dropSignaling(target) : false
  },
  forceRelay: (on: boolean): void => netDebug.forceRelay(on),
  setIce: (servers: RTCIceServer[] | null): void => configureIceServers(servers),
  stats: () => netDebug.stats(),
  peerjs: () => import('peerjs'),
  log: () => netDebug.log(),
  unsubscribeAll(): void {
    for (const off of offs.splice(0)) off()
  },

  /** ICE candidate types of the selected pairs on every live RTCPeerConnection. */
  async icePaths(): Promise<string[]> {
    const out: string[] = []
    for (const pc of pcs) {
      if (pc.connectionState !== 'connected') continue
      const stats = await pc.getStats()
      stats.forEach((r) => {
        if (r.type !== 'candidate-pair' || !(r as RTCIceCandidatePairStats).nominated) return
        const pair = r as RTCIceCandidatePairStats
        if (pair.state !== 'succeeded') return
        const local = stats.get(pair.localCandidateId) as { candidateType?: string; protocol?: string } | undefined
        const remote = stats.get(pair.remoteCandidateId) as { candidateType?: string } | undefined
        out.push(`${local?.candidateType}/${local?.protocol} ↔ ${remote?.candidateType}`)
      })
    }
    return out
  },

  /** Runs N quick create/join/close cycles inside this one page (host + client in the same tab). */
  async cycles(n: number) {
    const timings: number[] = []
    for (let i = 0; i < n; i++) {
      const t = performance.now()
      const h = await createHost()
      const c = await joinRoom(h.code)
      await new Promise<void>((resolve) => {
        const off = h.onMessage((_id, msg) => {
          if (msg.t === 'ping' && msg.c === i) {
            off()
            resolve()
          }
        })
        c.send({ t: 'ping', c: i })
      })
      c.close()
      h.close()
      timings.push(Math.round(performance.now() - t))
    }
    return timings
  },
}

declare global {
  interface Window {
    netLab: typeof lab
  }
}
window.netLab = lab

// ---- minimal UI ----

const app = document.getElementById('app') as HTMLDivElement
document.body.style.cssText =
  'margin:0;background:#0d0a18;color:#e9e4ff;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace'
app.innerHTML = `
  <div style="padding:16px;max-width:980px;margin:0 auto">
    <h1 style="font:800 18px system-ui;letter-spacing:.08em;margin:0 0 12px">UNSHUFFLE · NET LAB</h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button data-a="host">Crea stanza</button>
      <input id="code" placeholder="CODICE" maxlength="40" style="width:110px;text-transform:uppercase" />
      <button data-a="join">Entra</button>
      <button data-a="ping">Ping</button>
      <button data-a="bcast">Broadcast grande</button>
      <button data-a="break">Rompi link</button>
      <button data-a="freeze">Congela link</button>
      <button data-a="sig">Stacca signaling</button>
      <button data-a="closeh">Chiudi host</button>
      <button data-a="closec">Chiudi client</button>
    </div>
    <div id="st" style="margin-bottom:8px;color:#a6ff3f"></div>
    <pre id="log" style="background:#15102a;border:1px solid #ffffff1a;border-radius:12px;padding:12px;height:70vh;overflow:auto;white-space:pre-wrap;margin:0"></pre>
  </div>`
for (const el of app.querySelectorAll<HTMLElement>('button,input')) {
  el.style.cssText +=
    ';background:#231a45;color:inherit;border:1px solid #ffffff22;border-radius:999px;padding:8px 14px;font:inherit;min-height:36px'
}
const $ = (id: string) => document.getElementById(id) as HTMLElement
const codeInput = $('code') as HTMLInputElement
app.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).dataset.a
  if (a === 'host') void lab.createHost().then((r) => r.ok && r.code && (codeInput.value = r.code))
  if (a === 'join') void lab.joinRoom(codeInput.value).then((r) => push('join', r))
  if (a === 'ping') client ? lab.clientSend({ t: 'ping', c: Date.now() }) : lab.hostBroadcast({ t: 'pong', c: 0, h: Date.now() })
  if (a === 'bcast') push('big', lab.hostBroadcastBig())
  if (a === 'break') lab.breakLink()
  if (a === 'freeze') lab.freezeLink()
  if (a === 'sig') lab.dropSignaling(host ? 'host' : 'client')
  if (a === 'closeh') lab.hostClose()
  if (a === 'closec') lab.clientClose()
})

let raf = 0
function render(): void {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    $('st').textContent = `host: ${hostStatus}${host ? ` [${host.code}]` : ''} · client: ${clientStatus} · ${JSON.stringify(netDebug.stats())}`
    $('log').textContent = events
      .slice(-300)
      .map((e) => `${String(e.t).padStart(7)}  ${e.kind.padEnd(16)} ${e.data === undefined ? '' : JSON.stringify(e.data).slice(0, 180)}`)
      .join('\n')
  })
}
render()
