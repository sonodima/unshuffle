// QA check: the sorted reveal board (sortedViewMarks) keeps exactly the ✓ of the player's
// own arrangement (marksFor) and never shows a ✗. (It used to compare the removed
// marksInCorrectOrder, which was always identical to marksFor.)
import { marksFor, sortedViewMarks } from '../../src/screens/round/reveal/model'
function* perms(a: number[]): Generator<number[]> {
  if (a.length <= 1) { yield a; return }
  for (let i = 0; i < a.length; i++) for (const p of perms([...a.slice(0, i), ...a.slice(i + 1)])) yield [a[i], ...p]
}
let total = 0, diff = 0
for (const n of [4, 6, 7]) for (const p of perms(Array.from({ length: n }, (_, i) => i))) {
  total++
  const mine = marksFor(p)
  const sorted = sortedViewMarks(p)
  if (sorted.some((m, i) => (m === 'correct') !== (mine[i] === 'correct') || m === 'wrong')) diff++
}
console.log({ permutations: total, different: diff })
