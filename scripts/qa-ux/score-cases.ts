import { scoreArrangement } from '../../src/game/scoring.ts'
const cases: [string, number[]][] = [
  ['perfect 8', [0,1,2,3,4,5,6,7]],
  ['intro moved to end (rest perfect)', [1,2,3,4,5,6,7,0]],
  ['last block moved to front', [7,0,1,2,3,4,5,6]],
  ['two halves swapped', [4,5,6,7,0,1,2,3]],
  ['one adjacent swap', [1,0,2,3,4,5,6,7]],
  ['4 random right, rest scrambled', [0,5,2,7,4,1,6,3]],
  ['16: intro moved to end', [...Array.from({length:15},(_,i)=>i+1),0]],
]
for (const [n, o] of cases) console.log(n.padEnd(36), JSON.stringify(scoreArrangement(o, o.length)))
