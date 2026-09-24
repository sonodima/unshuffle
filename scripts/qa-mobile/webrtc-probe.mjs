// Does Playwright's WebKit support RTCPeerConnection data channels (loopback, host candidates)?
import { webkit, chromium, devices } from 'playwright'
const html = `<!doctype html><script>
window.run = async () => {
  const out = { hasRTC: typeof RTCPeerConnection }
  try {
    const cfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    const a = new RTCPeerConnection(cfg), b = new RTCPeerConnection(cfg)
    const cands = []
    a.onicecandidate = e => { if (e.candidate) { cands.push(e.candidate.candidate.split(' ').slice(4,8).join(' ')); b.addIceCandidate(e.candidate) } }
    b.onicecandidate = e => e.candidate && a.addIceCandidate(e.candidate)
    const ch = a.createDataChannel('x')
    const opened = new Promise((res) => { ch.onopen = () => res('open'); setTimeout(() => res('timeout:' + a.iceConnectionState + '/' + a.connectionState), 8000) })
    b.ondatachannel = e => { e.channel.onmessage = m => (out.msg = m.data) }
    const o = await a.createOffer(); await a.setLocalDescription(o); await b.setRemoteDescription(o)
    const an = await b.createAnswer(); await b.setLocalDescription(an); await a.setRemoteDescription(an)
    out.open = await opened
    if (out.open === 'open') { ch.send('hi'); await new Promise(r => setTimeout(r, 300)) }
    out.cands = cands.slice(0, 6)
  } catch (e) { out.err = String(e) }
  return out
}</script>`
for (const [name, launch, opts] of [['webkit', () => webkit.launch(), { ...devices['iPhone 14'] }], ['chrome', () => chromium.launch({ channel: 'chrome' }), {}]]) {
  const b = await launch()
  const ctx = await b.newContext(opts)
  const p = await ctx.newPage()
  await p.goto('http://127.0.0.1:5302/?probe')
  await p.addScriptTag({ content: html.replace(/^.*?<script>/s, '').replace('</script>', '') })
  console.log(name, JSON.stringify(await p.evaluate(() => window.run())))
  await b.close()
}
