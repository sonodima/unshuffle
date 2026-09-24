// QA (network): minimal RFC 5766 TURN Allocate client (node, no deps) to read the
// server's exact error code / reason for a given long-term credential.
//   node scripts/qa-network/turn-alloc.mjs <udp|tcp|tls> <host> <port> <username> <password>
import dgram from 'node:dgram'
import net from 'node:net'
import tls from 'node:tls'
import { createHash, createHmac, randomBytes } from 'node:crypto'

const [proto, host, portS, username, password] = process.argv.slice(2)
const port = Number(portS)
const MAGIC = 0x2112a442

function attr(type, value) {
  const len = value.length
  const pad = (4 - (len % 4)) % 4
  const b = Buffer.alloc(4 + len + pad)
  b.writeUInt16BE(type, 0)
  b.writeUInt16BE(len, 2)
  value.copy(b, 4)
  return b
}
function message(type, attrs, key) {
  const tid = randomBytes(12)
  let body = Buffer.concat(attrs)
  const header = (len) => {
    const h = Buffer.alloc(20)
    h.writeUInt16BE(type, 0)
    h.writeUInt16BE(len, 2)
    h.writeUInt32BE(MAGIC, 4)
    tid.copy(h, 8)
    return h
  }
  if (key) {
    const withMiLen = body.length + 24
    const hmac = createHmac('sha1', key).update(Buffer.concat([header(withMiLen), body])).digest()
    body = Buffer.concat([body, attr(0x0008, hmac)])
  }
  return Buffer.concat([header(body.length), body])
}
function parse(buf) {
  const type = buf.readUInt16BE(0)
  const len = buf.readUInt16BE(2)
  const attrs = {}
  let o = 20
  while (o < 20 + len) {
    const t = buf.readUInt16BE(o)
    const l = buf.readUInt16BE(o + 2)
    attrs[t] = buf.subarray(o + 4, o + 4 + l)
    o += 4 + l + ((4 - (l % 4)) % 4)
  }
  return { type, attrs }
}
function describe(m) {
  const out = { type: `0x${m.type.toString(16)}` }
  const err = m.attrs[0x0009]
  if (err) out.error = `${err[2] * 100 + err[3]} ${err.subarray(4).toString()}`
  if (m.attrs[0x0014]) out.realm = m.attrs[0x0014].toString()
  if (m.attrs[0x8022]) out.software = m.attrs[0x8022].toString()
  if (m.attrs[0x0016]) {
    const a = m.attrs[0x0016] // XOR-RELAYED-ADDRESS (IPv4)
    const p = a.readUInt16BE(2) ^ (MAGIC >>> 16)
    const ip = [0, 1, 2, 3].map((i) => a[4 + i] ^ ((MAGIC >>> (24 - 8 * i)) & 0xff)).join('.')
    out.relayed = `${ip}:${p}`
  }
  return out
}

// Transport abstraction: send(buf) → Promise<reply buf>
async function transport() {
  if (proto === 'udp') {
    const s = dgram.createSocket('udp4')
    return {
      send: (b) =>
        new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('udp timeout 5s')), 5000)
          s.once('message', (m) => {
            clearTimeout(t)
            res(m)
          })
          s.send(b, port, host)
        }),
      close: () => s.close(),
    }
  }
  const sock = await new Promise((res, rej) => {
    const opts = { host, port, servername: host, timeout: 5000 }
    const c = proto === 'tls' ? tls.connect(opts, () => res(c)) : net.connect(opts, () => res(c))
    c.once('error', rej)
    c.setTimeout(5000, () => rej(new Error('connect timeout')))
  })
  let buf = Buffer.alloc(0)
  let waiter = null
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d])
    if (buf.length >= 20) {
      const need = 20 + buf.readUInt16BE(2)
      if (buf.length >= need && waiter) {
        const m = buf.subarray(0, need)
        buf = buf.subarray(need)
        const w = waiter
        waiter = null
        w(m)
      }
    }
  })
  return {
    send: (b) =>
      new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('tcp reply timeout 5s')), 5000)
        waiter = (m) => {
          clearTimeout(t)
          res(m)
        }
        sock.write(b)
      }),
    close: () => sock.destroy(),
    peerCert: proto === 'tls' ? sock.getPeerCertificate()?.subject?.CN + ' / ' + (sock.getPeerCertificate()?.subjectaltname ?? '') : null,
  }
}

const REQ_TRANSPORT = attr(0x0019, Buffer.from([17, 0, 0, 0])) // UDP relay
let tr
try {
  tr = await transport()
} catch (e) {
  console.log(JSON.stringify({ proto, host, port, stage: 'connect', error: e.message }))
  process.exit(0)
}
const t0 = Date.now()
try {
  const r1 = describe(parse(await tr.send(message(0x0003, [REQ_TRANSPORT]))))
  const out = { proto, host, port, cert: tr.peerCert ?? undefined, first: r1 }
  if (r1.realm) {
    const m1 = parse(await tr.send(message(0x0003, [REQ_TRANSPORT], null))) // refresh nonce
    const nonce = m1.attrs[0x0015] ?? Buffer.alloc(0)
    const key = createHash('md5').update(`${username}:${r1.realm}:${password}`).digest()
    const r2 = parse(
      await tr.send(
        message(0x0003, [REQ_TRANSPORT, attr(0x0006, Buffer.from(username)), attr(0x0014, Buffer.from(r1.realm)), attr(0x0015, nonce)], key),
      ),
    )
    out.auth = describe(r2)
  }
  out.ms = Date.now() - t0
  console.log(JSON.stringify(out))
} catch (e) {
  console.log(JSON.stringify({ proto, host, port, stage: 'allocate', error: e.message }))
}
tr.close()
