// Resolve QA test tracks to Deezer ids (server-side fetch; no CORS issue in node).
import { writeFileSync } from 'node:fs'
const Q = [
  ['vasco rossi vita spericolata', 'vasco rossi', 'vita spericolata', 'Vasco Rossi – Vita spericolata'],
  ['laura pausini la solitudine', 'laura pausini', 'solitudine', 'Laura Pausini – La solitudine'],
  ['eros ramazzotti piu bella cosa', 'eros ramazzotti', 'bella cosa', 'Eros Ramazzotti – Più bella cosa'],
  ['maneskin zitti e buoni', 'maneskin', 'zitti e buoni', 'Måneskin – Zitti e buoni (rock)'],
  ['mahmood soldi', 'mahmood', 'soldi', 'Mahmood – Soldi'],
  ['blanco notti in bianco', 'blanco', 'notti in bianco', 'Blanco – Notti in bianco'],
  ['ultimo alba', 'ultimo', 'alba', 'Ultimo – Alba (ballad)'],
  ['elodie andromeda', 'elodie', 'andromeda', 'Elodie – Andromeda'],
  ['annalisa bellissima', 'annalisa', 'bellissima', 'Annalisa – Bellissima'],
  ['sfera ebbasta tran tran', 'sfera ebbasta', 'tran tran', 'Sfera Ebbasta – Tran Tran (trap)'],
  ['lazza cenere', 'lazza', 'cenere', 'Lazza – Cenere'],
  ['geolier i p me tu p te', 'geolier', '', 'Geolier – I p\' me, tu p\' te'],
  ['metallica enter sandman', 'metallica', 'enter sandman', 'Metallica – Enter Sandman (metal)'],
  ['guns n roses sweet child o mine', 'guns n', 'sweet child', 'Guns N\' Roses – Sweet Child O\' Mine'],
  ['dave brubeck take five', 'brubeck', 'take five', 'Dave Brubeck – Take Five (jazz 5/4)'],
  ['miles davis so what', 'miles davis', 'so what', 'Miles Davis – So What (jazz)'],
  ['shakira hips dont lie', 'shakira', 'hips', 'Shakira – Hips Don\'t Lie (latin)'],
  ['bad bunny titi me pregunto', 'bad bunny', 'pregunt', 'Bad Bunny – Tití Me Preguntó (latin)'],
  ['bts dynamite', 'bts', 'dynamite', 'BTS – Dynamite (k-pop)'],
  ['blackpink how you like that', 'blackpink', 'how you like that', 'BLACKPINK – How You Like That (k-pop)'],
  ['pendulum watercolour', 'pendulum', 'watercolour', 'Pendulum – Watercolour (dnb)'],
  ['netsky come alive', 'netsky', 'come alive', 'Netsky – Come Alive (dnb)'],
  ['eagles hotel california live hell freezes over', 'eagles', 'hotel california', 'Eagles – Hotel California (live)', true],
  ['queen we are the champions live aid', 'queen', 'champions', 'Queen – We Are the Champions (live)', true],
  ['jeff buckley hallelujah', 'jeff buckley', 'hallelujah', 'Jeff Buckley – Hallelujah (6/8)'],
]
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const out = []
for (const [q, artist, title, label, wantLive] of Q) {
  const r = await fetch('https://api.deezer.com/search?q=' + encodeURIComponent(q) + '&limit=25')
  const d = await r.json()
  const list = (d.data ?? []).filter((x) => x.preview && x.readable !== false)
  const ok = (x) => norm(x.artist.name).includes(norm(artist)) && (!title || norm(x.title).includes(norm(title)))
  const bad = /\b(live|acoustic|remix|karaoke|instrumental|cover|version|sped|slowed)\b/
  const live = (x) => /live|aid|wembley|hell freezes/i.test(x.title + ' ' + (x.album?.title ?? ''))
  const hit = wantLive ? (list.find((x) => ok(x) && live(x)) ?? list.find(ok)) : (list.find((x) => ok(x) && !bad.test(norm(x.title))) ?? list.find(ok))
  if (!hit) { console.log('NOT FOUND', q); continue }
  out.push({ id: hit.id, label, title: hit.title, artist: hit.artist.name, album: hit.album?.title, rank: hit.rank })
  console.log(hit.id, '|', hit.artist.name, '–', hit.title, '|', hit.album?.title)
  await new Promise((r) => setTimeout(r, 150))
}
writeFileSync(new URL('./tracks.json', import.meta.url), JSON.stringify(out, null, 2))
