// QA (network): does Chrome warn about the number of ICE server URLs we'd configure?
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const p = await browser.newPage()
const msgs = []
p.on('console', (m) => msgs.push(`${m.type()}: ${m.text()}`))
await p.goto('http://127.0.0.1:5306/lab/net.html')
for (const n of [3, 4, 5, 6]) {
  await p.evaluate((n) => {
    const urls = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'turn:a.example.com:80', 'turn:a.example.com:80?transport=tcp', 'turns:a.example.com:443?transport=tcp', 'turn:a.example.com:3478'].slice(0, n)
    console.log(`--- ${n} urls`)
    const pc = new RTCPeerConnection({ iceServers: [{ urls: urls.filter((u) => u.startsWith('stun')) }, { urls: urls.filter((u) => u.startsWith('turn')), username: 'u', credential: 'p' }].filter((s) => s.urls.length) })
    pc.close()
  }, n)
  await p.waitForTimeout(200)
}
console.log(msgs.filter((m) => !m.includes('[vite]')).join('\n'))
await browser.close()
