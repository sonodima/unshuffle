import { expect, test } from 'bun:test'
import { applyMove, identity, makeShuffle, planSort, songEnvelope } from '../../src/screens/home/demoScript'

test('planSort always sorts', () => {
  for (let k = 0; k < 500; k++) {
    const n = 4 + (k % 9)
    const o = identity(n)
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] }
    let cur = o
    for (const m of planSort(o)) { expect(cur[m.from]).toBe(m.id); cur = applyMove(cur, m.from, m.to) }
    expect(cur).toEqual(identity(n))
  }
})

test('makeShuffle respects bounds', () => {
  for (const [n, lo, hi] of [[8, 4, 5], [6, 3, 4], [4, 2, 3]] as const) {
    for (let k = 0; k < 200; k++) {
      const s = makeShuffle(n, lo, hi)
      const steps = planSort(s).length
      expect(steps).toBeGreaterThanOrEqual(lo)
      expect(steps).toBeLessThanOrEqual(hi)
      expect([...s].sort((a, b) => a - b)).toEqual(identity(n))
      expect(s.filter((v, i) => v !== i).length).toBeGreaterThanOrEqual(n - 2)
    }
  }
})

test('envelope shape', () => {
  const e = songEnvelope(8, 14)
  expect(e.length).toBe(8)
  expect(e.every((b) => b.length === 14 && b.every((v) => v >= 0.12 && v <= 1))).toBe(true)
})
