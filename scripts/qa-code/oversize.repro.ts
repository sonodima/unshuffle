// QA "code": the host reassembles and JSON.parses client messages of up to 8 M chars (bun test ./scripts/qa-code/oversize.repro.ts).
import { expect, test } from 'bun:test'
import { Reassembler, encodeMessage } from '../../src/net/wire'

test('a single 7.9 M-char client message is accepted and parsed by the host reassembler', () => {
  const big = { t: 'reaction', emoji: 'x'.repeat(7_900_000) }
  let id = 0
  const frames = encodeMessage(big, () => ++id)
  const r = new Reassembler()
  const t0 = performance.now()
  let out: { value: unknown } | undefined
  for (const f of frames) if (f.k === 'c') out = r.push(f) ?? out
  const ms = performance.now() - t0
  console.log(`[qa] ${frames.length} chunks → reassembled + parsed in ${ms.toFixed(1)} ms (desktop, bun)`)
  expect(out).toBeDefined()
  expect(frames.length).toBeGreaterThan(500)
})
