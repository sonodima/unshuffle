// Scenario 8: 16 snippets + 60 s round on a 390×844 phone: board usable, 16 waveforms drawn,
// long touch drags work, nothing overflows.
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, check, log, shot, finish, sleep, boardReady, waitPlayingOrPast, boardOrder, touchDrag, arrayMove, confirm, waitRevealOrPast,
} from './lib.mjs'

const browser = await launch()
let ok = false
const all = []
const metrics = {}
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const phone = await openPlayer(browser, 'Phone', PHONE)
  const small = await openPlayer(browser, 'Small', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  all.push(host, phone, small)
  const code = await createRoom(host)
  await Promise.all([phone, small].map((g) => joinByLink(g, code)))
  await waitStore(host, '(s) => s.room?.players.length === 3', null, 20_000)
  await pickPlaylist(host)
  await setSettings(host, { rounds: 3, snippets: 16, roundTime: 60, finalTimer: 30 })
  await startGame(host)
  await Promise.all(all.map((p) => waitPlayingOrPast(p, 0)))
  await Promise.all(all.map((p) => boardReady(p)))
  // Waveforms need the decoded buffer: wait until no waveform is in the skeleton state.
  for (const p of [phone, small]) {
    const t0 = Date.now()
    await p.waitForFunction(() => {
      const w = [...document.querySelectorAll('[data-round-view="playing"] .sb-wf')]
      return w.length === 16 && w.every((x) => !x.hasAttribute('data-loading'))
    }, null, { timeout: 30_000 }).catch(() => {})
    metrics[`${p.__name}-waveformsReadyMs`] = Date.now() - t0
  }
  await sleep(1500)
  for (const p of [phone, small]) {
    const m = await p.evaluate(() => {
      const items = [...document.querySelectorAll('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item')]
      const rects = items.map((e) => e.getBoundingClientRect())
      const canv = [...document.querySelectorAll('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item canvas')]
      const drawn = canv.map((c) => {
        try {
          const ctx = c.getContext('2d')
          if (!ctx || !c.width || !c.height) return 0
          const d = ctx.getImageData(0, 0, c.width, c.height).data
          let n = 0
          for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 40) n++
          return n
        } catch {
          return -1
        }
      })
      const loading = document.querySelectorAll('[data-round-view="playing"] .sb-wf[data-loading]').length
      const vw = window.innerWidth
      const vh = window.innerHeight
      const confirmBtn = [...document.querySelectorAll('button')].find((b) => /^\s*Conferma\s*$/.test(b.textContent ?? ''))
      const cb = confirmBtn?.getBoundingClientRect()
      return {
        n: items.length,
        minW: Math.min(...rects.map((r) => r.width)),
        minH: Math.min(...rects.map((r) => r.height)),
        cols: new Set(rects.map((r) => Math.round(r.left))).size,
        allInViewport: rects.every((r) => r.top >= 0 && r.bottom <= vh + 1 && r.left >= 0 && r.right <= vw + 1),
        maxBottom: Math.max(...rects.map((r) => r.bottom)),
        confirmTop: cb?.top ?? null,
        overlapConfirm: cb ? rects.some((r) => r.bottom > cb.top + 1) : null,
        overflowX: document.documentElement.scrollWidth - vw,
        canvases: canv.length,
        drawnCanvases: drawn.filter((x) => x > 20).length,
        drawn,
        loading,
        vw,
        vh,
      }
    })
    metrics[p.__name] = m
    log(p.__name, JSON.stringify({ ...m, drawn: undefined }))
    check(m.n === 16, `${p.__name}: 16 blocks`)
    check(m.drawnCanvases === 16 && m.loading === 0, `${p.__name}: all 16 waveforms drawn (${m.drawnCanvases}, skeleton ${m.loading})`)
    check(m.allInViewport, `${p.__name}: all blocks inside the viewport (no scroll needed)`, { maxBottom: m.maxBottom, vh: m.vh })
    check(m.minW >= 44 && m.minH >= 44, `${p.__name}: blocks ≥ 44px (${m.minW.toFixed(0)}×${m.minH.toFixed(0)})`)
    check(m.overflowX <= 0, `${p.__name}: no horizontal overflow`)
    check(m.overlapConfirm === false, `${p.__name}: blocks don't overlap CONFERMA`)
    await shot(p, 's8-16-playing')
  }
  // Long drags: first → last and last → first.
  for (const p of [phone, small]) {
    const before = await boardOrder(p)
    await touchDrag(p, 0, 15, { steps: 14, settle: 500 })
    const mid = await boardOrder(p)
    check(JSON.stringify(mid) === JSON.stringify(arrayMove(before, 0, 15)), `${p.__name}: touch drag 0 → 15`, { before, mid })
    await touchDrag(p, 12, 1, { steps: 14, settle: 500 })
    const after = await boardOrder(p)
    check(JSON.stringify(after) === JSON.stringify(arrayMove(mid, 12, 1)), `${p.__name}: touch drag 12 → 1`, { mid, after })
    // A plain tap plays a snippet (no reorder).
    const box = await p.locator('[data-round-view="playing"] .sb-item[data-pos="5"]').boundingBox()
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await sleep(600)
    const playing = await p.evaluate(async () => (await import('/src/audio/engine.ts')).audioEngine.getState())
    const after2 = await boardOrder(p)
    check(JSON.stringify(after2) === JSON.stringify(after), `${p.__name}: tap does not reorder`)
    log(p.__name, 'tap → engine', JSON.stringify({ playing: playing.playing, tag: playing.tag }))
    check(playing.playing === true, `${p.__name}: tap plays the snippet`, playing)
  }
  await shot(phone, 's8-16-after-drags')
  await shot(small, 's8-16-after-drags')
  for (const p of all) await confirm(p)
  await waitRevealOrPast(host, 0, 40_000)
  await sleep(6000)
  await shot(phone, 's8-16-reveal')
  await shot(small, 's8-16-reveal')
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) await shot(p, 's8-FAIL')
} finally {
  await browser.close()
}
finish('s8-16snip-phone', { metrics })
process.exit(ok ? 0 : 1)
