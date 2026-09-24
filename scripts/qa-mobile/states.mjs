// In-page state setup for the shell lab (/lab/shell.html?real=1&panel=0): the REAL
// screens rendered over tweaked fixture store states. Everything here runs in the page.

/** Installs window.__qa (idempotent). */
export async function installQa(page) {
  await page.waitForFunction(() => !!window.__shell, null, { timeout: 20_000 })
  await page.evaluate(async () => {
    if (window.__qa) return
    const fx = await import('/src/dev/fixtures.ts')
    const { scoreArrangement } = await import('/src/game/scoring.ts')
    const G = window.__shell.useGame
    const LONG_NAMES = [
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
      'Wolfgang Amadeus',
      'QQQQQQQQQQQQQQQQ',
      'Nonna Pistacchio',
      'WWWW WWWW WWWW W',
      'Lady Fenicottero',
      'Capitan Cannolo',
      'ÀÈÌÒÙ ÀÈÌÒÙ ÀÈÌÒ',
      'Mega Giradischi',
    ]
    const LONG_TRACK = {
      title: 'Supercalifragilisticexpialidocious (Extended Club Mix) [feat. Somebody Famous]',
      artist: 'The Extraordinarily Long Named Band & The Philharmonic Orchestra',
      album: 'A Very Long Album Title — Remastered 2011 Deluxe Anniversary Edition',
    }
    const derange = (n) => {
      // deterministic: rotate by ceil(n/2)+1 then swap to avoid adjacent pairs
      const out = Array.from({ length: n }, (_, i) => (i * 5 + 3) % n)
      const ok = new Set(out).size === n
      return ok ? out : Array.from({ length: n }, (_, i) => (i + Math.ceil(n / 2)) % n)
    }
    const segs = (n) => {
      const a = 0.5
      const b = 29.5
      const len = (b - a) / n
      return Array.from({ length: n }, (_, i) => ({ index: i, start: a + i * len, end: a + (i + 1) * len, beats: 4 }))
    }
    const hues = (n) => Array.from({ length: n }, (_, i) => Math.round((i * 137.5 + 20) % 360))
    const result = (playerId, order, timeMs, timedOut = false) => ({ playerId, order, ...scoreArrangement(order, order.length), timeMs, timedOut })

    function build(kind, { n = 8, long = false, meId = 'p-host' } = {}) {
      const src = {
        lobby: fx.fxLobby,
        preparing: fx.fxPreparing,
        intro: fx.fxIntro,
        playing: fx.fxPlaying,
        finalTimer: fx.fxPlayingFinal,
        submitted: fx.fxPlaying,
        reveal: fx.fxReveal,
        final: fx.fxFinal,
      }[kind]
      const room = structuredClone(src)
      const now = Date.now()
      const shift = now - fx.FX_NOW
      for (const k of ['endsAt', 'startedAt', 'nextAt']) if (typeof room.phase[k] === 'number') room.phase[k] += shift
      if (room.phase.firstSubmit) room.phase.firstSubmit.at = now - 400
      if (kind === 'intro') room.phase.endsAt = now + 3600
      if (kind === 'reveal') room.phase.nextAt = now + 25_000
      if (kind === 'playing' || kind === 'submitted') room.phase.endsAt = now + 60_000
      // snippets
      if (room.rounds[2] && n !== 8) {
        room.rounds[2] = { ...room.rounds[2], segments: segs(n), initialOrder: derange(n), hues: hues(n) }
      }
      room.settings = { ...room.settings, snippets: n }
      if (long) {
        const base = room.players
        room.players = LONG_NAMES.map((name, i) => ({
          ...(base[i] ?? base[1]),
          id: i === 0 ? 'p-host' : i < base.length ? base[i].id : `p-x${i}`,
          name,
          avatar: (i * 5) % 24,
          color: i % 12,
          isHost: i === 0,
          connected: i !== 3,
          score: room.phase.kind === 'lobby' ? 0 : 24000 - i * 1731,
          activeFromRound: 0,
        }))
        room.settings.playlist = {
          ...room.settings.playlist,
          title: 'The Ultimate Mega Playlist of 2000s Hits Remastered Deluxe Edition Vol. 3',
          creator: 'Deezer Pop Editor With A Really Long Name',
        }
        room.tracks = room.tracks.map((t) => ({ ...t, ...LONG_TRACK }))
        room.rounds = room.rounds.map((r) => (r ? { ...r, track: { ...r.track, ...LONG_TRACK } } : r))
        if (room.results.length) {
          const nn = room.rounds[2]?.segments.length ?? 8
          room.results = room.results.map((_, ri) =>
            room.players.map((p, i) => {
              const order = Array.from({ length: nn }, (_, k) => k)
              for (let s = 0; s < i; s++) {
                const a = (s * 3 + ri) % nn
                const b = (a + 1 + ((i + ri) % 3)) % nn
                ;[order[a], order[b]] = [order[b], order[a]]
              }
              return result(p.id, order, 20_000 + i * 6100, i === 7)
            }),
          )
        }
        if (room.submissions) room.submissions = { 'p-2': { submitted: true, atMs: 28_000 }, 'p-x5': { submitted: true, atMs: 30_000 } }
      }
      if (kind === 'submitted') room.submissions = { ...room.submissions, [meId]: { submitted: true, atMs: 31_000 } }
      room.seq = (G.getState().room?.seq ?? 1) + 1
      return room
    }

    function apply(kind, opts = {}) {
      const meId = opts.meId ?? 'p-host'
      const room = build(kind, { ...opts, meId })
      const round = 'round' in room.phase ? room.phase.round : -1
      G.setState({
        role: meId === room.hostId ? 'host' : 'client',
        connection: 'open',
        error: null,
        room,
        roomCode: room.code,
        me: meId,
        toasts: [],
        arrangement: kind === 'submitted' ? room.rounds[2].initialOrder : [],
        arrangementRound: round,
        submitted: kind === 'submitted',
        audio: { [room.rounds[2]?.track.id ?? 0]: 'ready' },
      })
      return room
    }

    let audioReady = null
    async function loadAudio() {
      audioReady ??= (async () => {
        const { audioEngine } = await import('/src/audio/engine.ts')
        const { refreshPreview } = await import('/src/lib/deezer.ts')
        const t0 = performance.now()
        const url = await refreshPreview(3135556)
        await audioEngine.load('track:3135556', url)
        return { ok: true, ms: Math.round(performance.now() - t0) }
      })().catch((e) => ({ ok: false, err: String(e?.message ?? e) }))
      return audioReady
    }

    window.__qa = { build, apply, loadAudio, G }
  })
}

export async function setState(page, kind, opts = {}) {
  return page.evaluate(([k, o]) => {
    window.__qa.apply(k, o)
    return true
  }, [kind, opts])
}

export async function goHome(page) {
  await page.evaluate(() => window.__shell.home())
}
