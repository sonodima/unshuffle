// Timer write-throttling helpers (src/components/ui/timerMath.ts).
// bun test scripts/fix-ui/timer.test.ts
import { describe, expect, test } from 'bun:test'
import { barTransform, shouldWriteArc, timerFraction } from '../../src/components/ui/timerMath'

describe('timerFraction', () => {
  test('clamps and handles a zero total', () => {
    expect(timerFraction(45_000, 90_000)).toBe(0.5)
    expect(timerFraction(-5, 90_000)).toBe(0)
    expect(timerFraction(120_000, 90_000)).toBe(1)
    expect(timerFraction(10, 0)).toBe(0)
  })
})

describe('shouldWriteArc', () => {
  test('first write always happens', () => {
    expect(shouldWriteArc(10, Number.NaN, 2, 0.5)).toBe(true)
  })
  test('skips sub half-device-pixel moves, writes bigger ones', () => {
    expect(shouldWriteArc(10.2, 10, 2, 0.5)).toBe(false) // 0.4 device px
    expect(shouldWriteArc(10.25, 10, 2, 0.5)).toBe(true) // 0.5 device px
    expect(shouldWriteArc(10.4, 10, 1, 0.5)).toBe(false)
    expect(shouldWriteArc(10.5, 10, 1, 0.5)).toBe(true)
  })
  test('ends are always exact, identical values never written', () => {
    expect(shouldWriteArc(320, 319.99, 3, 0)).toBe(true)
    expect(shouldWriteArc(0, 0.01, 3, 1)).toBe(true)
    expect(shouldWriteArc(5, 5, 3, 0)).toBe(false)
  })
  test('a missing devicePixelRatio falls back to 1', () => {
    expect(shouldWriteArc(10.4, 10, 0, 0.5)).toBe(false)
  })
  test('a 90 s round on a 112px ring at DPR 2 writes ~12-15 times per second', () => {
    const circ = 2 * Math.PI * ((112 - 8) / 2 - 1)
    let last = Number.NaN
    let writes = 0
    for (let frame = 0; frame <= 60; frame++) {
      const f = timerFraction(60_000 - (frame * 1000) / 60, 90_000)
      const offset = circ * (1 - f)
      if (shouldWriteArc(offset, last, 2, f)) {
        last = offset
        writes++
      }
    }
    expect(writes).toBeGreaterThanOrEqual(10)
    expect(writes).toBeLessThanOrEqual(16)
  })
})

describe('barTransform', () => {
  test('slides the full-width fill left by the elapsed share', () => {
    expect(barTransform(1)).toBe('translate3d(0.000%,0,0)')
    expect(barTransform(0.25)).toBe('translate3d(-75.000%,0,0)')
    expect(barTransform(0)).toBe('translate3d(-100.000%,0,0)')
  })
})
