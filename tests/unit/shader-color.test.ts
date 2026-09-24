import { expect, test } from 'bun:test'
import { createReactor, MAX_RINGS, RING_LIFETIME } from '../../src/components/background/reactor'
import { mixOklab, neonize, parseHex, rgbToOklab, rotateHue, toHex } from '../../src/components/background/color'

const lv = (bass: number, beat: number, energy = 0.5) => ({ bass, mid: 0.3, treble: 0.2, energy, beat })

test('beat rising edge spawns one ring, refractory blocks doubles', () => {
  const r = createReactor()
  let t = 0
  const step = (l: ReturnType<typeof lv>) => {
    t += 1 / 60
    r.update(l, 1 / 60, t)
  }
  step(lv(0.3, 0))
  step(lv(0.9, 1)) // kick
  const live = () => [...r.state.ringAmp].filter((a) => a > 0).length
  expect(live()).toBe(1)
  expect(r.state.flash).toBeGreaterThan(0.5)
  step(lv(0.9, 0.9)) // decaying pulse: no new ring
  step(lv(0.9, 0.2))
  step(lv(0.9, 1)) // 50 ms later: refractory
  expect(live()).toBe(1)
  for (let i = 0; i < 30; i++) step(lv(0.3, 0))
  step(lv(0.9, 1))
  expect(live()).toBe(2)
})

test('rings expire after their lifetime and slots are reused', () => {
  const r = createReactor()
  for (let i = 0; i < MAX_RINGS + 2; i++) r.pulse(1, i * 0.3)
  expect([...r.state.ringAmp].filter((a) => a > 0).length).toBe(MAX_RINGS)
  r.update(lv(0, 0, 0), 1 / 60, 10 + RING_LIFETIME)
  expect([...r.state.ringAmp].every((a) => a === 0)).toBe(true)
})

test('garbage levels are sanitized', () => {
  const r = createReactor()
  r.update({ bass: NaN, mid: Infinity, treble: -3, energy: 9, beat: NaN }, NaN, 1)
  for (const k of ['bass', 'mid', 'treble', 'energy', 'flash', 'presence'] as const) {
    expect(Number.isFinite(r.state[k])).toBe(true)
    expect(r.state[k]).toBeGreaterThanOrEqual(0)
    expect(r.state[k]).toBeLessThanOrEqual(1)
  }
})

test('presence fades in with music and out in silence', () => {
  const r = createReactor()
  for (let i = 0; i < 120; i++) r.update(lv(0.5, 0, 0.6), 1 / 60, i / 60)
  expect(r.state.presence).toBeGreaterThan(0.8)
  for (let i = 0; i < 600; i++) r.update(lv(0, 0, 0), 1 / 60, 2 + i / 60)
  expect(r.state.presence).toBeLessThan(0.05)
})

test('hex parsing and round trip', () => {
  expect(toHex(parseHex('#7b5cff')!)).toBe('#7b5cff')
  expect(toHex(parseHex('abc')!)).toBe('#aabbcc')
  expect(toHex(parseHex('#ff3fd1cc')!)).toBe('#ff3fd1')
  expect(parseHex('nope')).toBeNull()
  expect(parseHex('#12345')).toBeNull()
})

test('neonize keeps brand colors, lifts dark ones, tints greys', () => {
  expect(toHex(neonize(parseHex('#7b5cff')!, 0.5, 0.8, 0.12))).toBe('#7b5cff')
  const dark = rgbToOklab(neonize(parseHex('#0a0a0a')!, 0.5, 0.8, 0.12))
  expect(dark[0]).toBeGreaterThan(0.49)
  expect(Math.hypot(dark[1], dark[2])).toBeGreaterThan(0.03)
  const rgb = neonize(parseHex('#00ff00')!, 0.5, 0.8, 0.12)
  expect(rgb.every((c) => c >= 0 && c <= 1)).toBe(true)
})

test('derived third light from the default violet is cyan-ish', () => {
  const c = rgbToOklab(rotateHue(parseHex('#7b5cff')!, -85))
  const hue = (Math.atan2(c[2], c[1]) * 180) / Math.PI
  expect(hue).toBeGreaterThan(-175)
  expect(hue).toBeLessThan(-125)
})

test('oklab mix endpoints', () => {
  const a = parseHex('#ff0000')!
  const b = parseHex('#0000ff')!
  expect(toHex(mixOklab(a, b, 0))).toBe('#ff0000')
  expect(toHex(mixOklab(a, b, 1))).toBe('#0000ff')
})
