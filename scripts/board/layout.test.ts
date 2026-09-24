import { fitGrid, snippetLetters } from '../../src/components/board/layout'
const sizes: [string, number, number][] = [
  ['phone 390x844', 358, 560],
  ['phone SE', 343, 440],
  ['phone small', 328, 400],
  ['tablet', 720, 700],
  ['desktop', 1100, 560],
  ['desktop big', 1300, 640],
  ['free phone', 358, Infinity],
  ['free desktop', 1100, Infinity],
]
for (const [name, w, h] of sizes) {
  const row = [6, 8, 12, 16].map((n) => {
    const l = fitGrid(n, w, h)
    return `${n}:${l.cols}x${l.rows} ${l.w}x${l.h} (${(l.w / l.h).toFixed(2)}) H${l.height}`
  })
  console.log(name.padEnd(14), row.join(' | '))
}
console.log(snippetLetters([312, 22, 190, 95, 258, 140, 48, 5]).join(''))
