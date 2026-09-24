import { describe, expect, test } from 'bun:test'
import { encodeMessage, Reassembler, utf8Length, MAX_FRAME_BYTES } from '../../src/net/wire'
import { normalizeRoomCode } from '../../src/net/transport'
import { randomString } from '../../src/net/runtime'
import { fxFinal, fxReveal } from '../fixtures/room'

const enc = new TextEncoder()
const frameBytes = (f: unknown) => enc.encode(JSON.stringify(f)).byteLength

function roundTrip(msg: unknown) {
  let id = 0
  const frames = encodeMessage(msg, () => ++id)
  for (const f of frames) expect(frameBytes(f)).toBeLessThan(16300)
  for (const f of frames) expect(frameBytes(f)).toBeLessThanOrEqual(MAX_FRAME_BYTES)
  const rx = new Reassembler()
  let out: unknown
  let got = 0
  for (const f0 of frames) {
    // Simulate the JSON channel.
    const f = JSON.parse(JSON.stringify(f0))
    if (f.k === 'm') { out = f.m; got++ }
    else { const r = rx.push(f); if (r) { out = r.value; got++ } }
  }
  expect(got).toBe(1)
  expect(out).toEqual(JSON.parse(JSON.stringify(msg)))
  return frames
}

describe('wire', () => {
  test('utf8Length matches TextEncoder', () => {
    for (const s of ['abc', 'è€😀', ' "\\\n', 'ü'.repeat(1000) + '😀'.repeat(300), '\ud83d', 'a\udc00b']) {
      expect(utf8Length(s)).toBe(enc.encode(s).byteLength)
    }
  })
  test('small message inline', () => {
    const frames = roundTrip({ t: 'ping', c: 123 })
    expect(frames.length).toBe(1)
    expect(frames[0].k).toBe('m')
  })
  test('fixture states', () => {
    for (const s of [fxReveal, fxFinal]) {
      const msg = { t: 'state', state: s, hostNow: 1 }
      const frames = roundTrip(msg)
      console.log('fixture', JSON.stringify(msg).length, 'chars ->', frames.length, 'frame(s)')
    }
  })
  test('big ascii state (60 KB) chunks', () => {
    const tracks = Array.from({ length: 14 }, (_, i) => ({ id: i, title: 'Song "' + i + '"', preview: 'https://cdnt-preview.dzcdn.net/api/1/1/' + 'x'.repeat(300) + '?hdnea=exp=1&"q"', cover: 'https://cdn-images.dzcdn.net/images/cover/' + 'a'.repeat(64) + '/1000x1000.jpg' }))
    const msg = { t: 'state', state: { ...fxFinal, tracks, results: Array.from({ length: 10 }, () => fxFinal.results[0]).map((r) => [...r, ...r, ...r]) }, hostNow: 5 }
    const frames = roundTrip(msg)
    console.log('big', JSON.stringify(msg).length, 'chars ->', frames.length, 'frames')
    expect(frames.length).toBeGreaterThan(1)
  })
  test('adversarial: quotes, control chars, emoji, lone surrogates', () => {
    const nasty = ('"\\\u0001\n😀è' + '\ud83d').repeat(20000)
    const frames = roundTrip({ t: 'event', event: { type: 'info', message: nasty } })
    console.log('nasty', nasty.length, 'chars ->', frames.length, 'frames')
    roundTrip({ t: 'x', s: '😀'.repeat(30000) })
    roundTrip({ t: 'x', s: '\u0000'.repeat(50000) })
  })
  test('reassembler rejects out of sequence', () => {
    const rx = new Reassembler()
    expect(rx.push({ k: 'c', id: 1, i: 1, n: 2, d: 'x' })).toBeUndefined()
    expect(rx.push({ k: 'c', id: 1, i: 0, n: 2, d: '{"a":' })).toBeUndefined()
    expect(rx.push({ k: 'c', id: 2, i: 1, n: 2, d: '1}' })).toBeUndefined()
    expect(rx.push({ k: 'c', id: 3, i: 0, n: 2, d: '{"a":' })).toBeUndefined()
    expect(rx.push({ k: 'c', id: 3, i: 1, n: 2, d: '1}' })).toEqual({ value: { a: 1 } })
  })
  test('undefined / cyclic', () => {
    expect(encodeMessage(undefined, () => 1)).toEqual([])
    const a: Record<string, unknown> = {}
    a.self = a
    expect(encodeMessage(a, () => 1)).toEqual([])
  })
})

describe('normalizeRoomCode', () => {
  const cases: [string, string | null][] = [
    ['kxqpm', 'KXQPM'],
    [' KXQ PM ', 'KXQPM'],
    ['KXQ-PM', 'KXQPM'],
    ['https://unshuffle.app/#/r/KXQPM', 'KXQPM'],
    ['http://192.168.1.4:5173/#/r/kxqpm', 'KXQPM'],
    ['https://x.io/game/?r=KXQPM', 'KXQPM'],
    ['https://x.io/?lang=it&r=kxqpm#/', 'KXQPM'],
    ['#/r/ABCDE', 'ABCDE'],
    ['KXQP', null],
    ['KXQPMM', null],
    ['KXQPO', null], // O not in alphabet
    ['KXQP1', null],
    ['', null],
    ['https://unshuffle.app/', null],
    ['https://x.io/#/r/KXQPMZ', null],
  ]
  for (const [input, want] of cases) test(JSON.stringify(input), () => expect(normalizeRoomCode(input)).toBe(want))
  test('random codes are valid & uniform-ish', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 4000; i++) {
      const c = randomString('ABCDEFGHJKLMNPQRSTUVWXYZ', 5)
      expect(normalizeRoomCode(c)).toBe(c)
      for (const ch of c) counts[ch] = (counts[ch] ?? 0) + 1
    }
    const vals = Object.values(counts)
    expect(vals.length).toBe(24)
    expect(Math.min(...vals)).toBeGreaterThan(20000 / 24 * 0.8)
  })
})
