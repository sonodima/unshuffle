// Scenario 8 (ported to the current lib): 16 snippets + 60 s round, host desktop + phone 390x844
// + small phone 360x640. Board usable (sizes, viewport, overflow), all 16 waveforms drawn,
// long touch drags, tap plays, then everyone confirms → reveal.
import {
  DESKTOP, PHONE, arrayMove, boardOrder, browser, check, configure, confirm, createRoom, gotoHome, joinByCode,
  launch, log, openPlayer, pickPlaylist, shot, startGame, summary, touchDrag, waitBoard, waitPhase, waitScreen,
} from './lib.mjs'

const tag = Math.random().toString(36).slice(2, 6)
const prof = (id, name, avatar) => ({ id: `qa-${id}-${tag}`, name, avatar, color: avatar })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const metrics = {}

await launch()
const host = await openPlayer('host', DESKTOP, { profile: prof('h', 'Host', 0) })
const phone = await openPlayer('phone', PHONE, { profile: prof('p', 'Phone', 1) })
const small = await openPlayer('small', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { profile: prof('s', 'Small', 2) })
phone.__touch = small.__touch = true
const all = [host, phone, small]
try {
  await Promise.all(all.map(gotoHome))
  const code = await createRoom(host)
  await Promise.all([joinByCode(phone, code, { touch: true }), joinByCode(small, code, { touch: true })])
  await Promise.all([waitScreen(phone, 'lobby'), waitScreen(small, 'lobby')])
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: 3, snippets: 16, roundTime: 60, finalTimer: 30 })
  await startGame(host)
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 0, 120_000)))
  await Promise.all(all.map((p) => waitBoard(p)))
  for (const p of [phone, small]) {
    const t0 = Date.now()
    await p
      .waitForFunction(() => {
        const w = [...document.querySelectorAll('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-wf')]
        return w.length === 16 && w.every((x) => !x.hasAttribute('data-loading'))
      }, null, { timeout: 30_000 })
      .catch(() => {})
    metrics[`${p.__name}-waveformsReadyMs`] = Date.now() - t0
  }
  await sleep(1200)
  for (const p of [phone, small]) {
    const m = await p.evaluate(() => {
      const root = document.querySelector('[data-screen-frame]:not([inert]) [data-round-view="playing"]')
      const items = [...root.querySelectorAll('.sb-item')]
      const rects = items.map((e) => e.getBoundingClientRect())
      const canv = [...root.querySelectorAll('.sb-item canvas')]
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
      const vw = window.innerWidth
      const vh = window.innerHeight
      const confirmBtn = [...root.querySelectorAll('button')].find((b) => /^\s*Conferma\s*$/i.test(b.textContent ?? ''))
      const cb = confirmBtn?.getBoundingClientRect()
      const play = [...root.querySelectorAll('button')].find((b) => /Ascolta tutto|Riproduci/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))
      const pb = play?.getBoundingClientRect()
      return {
        n: items.length,
        minW: Math.min(...rects.map((r) => r.width)),
        minH: Math.min(...rects.map((r) => r.height)),
        cols: new Set(rects.map((r) => Math.round(r.left))).size,
        rows: new Set(rects.map((r) => Math.round(r.top))).size,
        allInViewport: rects.every((r) => r.top >= 0 && r.bottom <= vh + 1 && r.left >= 0 && r.right <= vw + 1),
        maxBottom: Math.round(Math.max(...rects.map((r) => r.bottom))),
        confirm: cb ? { top: Math.round(cb.top), bottom: Math.round(cb.bottom), h: Math.round(cb.height) } : null,
        playAll: pb ? { top: Math.round(pb.top), h: Math.round(pb.height), w: Math.round(pb.width) } : null,
        overlapConfirm: cb ? rects.some((r) => r.bottom > cb.top + 1) : null,
        overflowX: document.documentElement.scrollWidth - vw,
        canvases: canv.length,
        drawnCanvases: drawn.filter((x) => x > 20).length,
        loading: root.querySelectorAll('.sb-wf[data-loading]').length,
        vw,
        vh,
      }
    })
    metrics[p.__name] = m
    log(p.__name, JSON.stringify(m))
    check(`8: ${p.__name}: 16 blocks`, m.n === 16)
    check(`8: ${p.__name}: all 16 waveforms drawn`, m.drawnCanvases === 16 && m.loading === 0, `${m.drawnCanvases} drawn, ${m.loading} skeleton, ready after ${metrics[`${p.__name}-waveformsReadyMs`]} ms`)
    check(`8: ${p.__name}: all blocks inside the viewport`, m.allInViewport, `maxBottom ${m.maxBottom} vh ${m.vh}`)
    check(`8: ${p.__name}: blocks ≥ 44 px`, m.minW >= 44 && m.minH >= 44, `${m.minW.toFixed(0)}×${m.minH.toFixed(0)} (${m.cols}x${m.rows})`)
    check(`8: ${p.__name}: no horizontal overflow`, m.overflowX <= 0, `${m.overflowX}`)
    check(`8: ${p.__name}: blocks don't overlap CONFERMA`, m.overlapConfirm === false, JSON.stringify(m.confirm))
    await shot(p, 's8b-16-playing')
  }
  for (const p of [phone, small]) {
    const before = await boardOrder(p)
    await touchDrag(p, 0, 15, { steps: 16, settle: 600 })
    const mid = await boardOrder(p)
    check(`8: ${p.__name}: touch drag 0 → 15`, JSON.stringify(mid) === JSON.stringify(arrayMove(before, 0, 15)), `before ${before} after ${mid}`)
    await touchDrag(p, 12, 1, { steps: 16, settle: 600 })
    const after = await boardOrder(p)
    check(`8: ${p.__name}: touch drag 12 → 1`, JSON.stringify(after) === JSON.stringify(arrayMove(mid, 12, 1)), `before ${mid} after ${after}`)
    const box = await p.locator('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="5"]').boundingBox()
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await sleep(500)
    const eng = await p.evaluate(async () => (await import('/src/audio/engine.ts')).audioEngine.getState())
    check(`8: ${p.__name}: tap plays a snippet without reordering`, eng.playing === true && JSON.stringify(await boardOrder(p)) === JSON.stringify(after), `playing=${eng.playing} tag=${eng.tag}`)
  }
  await shot(phone, 's8b-16-after-drags')
  await shot(small, 's8b-16-after-drags')
  for (const p of all) await confirm(p)
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 0, 30_000)))
  await sleep(7000)
  await shot(phone, 's8b-16-reveal')
  await shot(small, 's8b-16-reveal')
  await shot(host, 's8b-16-reveal')
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 's8b-FAIL')
} finally {
  summary(`metrics ${JSON.stringify(metrics)}`)
  await browser.close()
}
