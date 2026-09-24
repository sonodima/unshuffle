// English (US): the default for every browser whose language we don't have.
// Mirrors the Italian source (../it) key for key.
//
// Glossary (keep these consistent):
//   spezzone → snippet (the audio piece)       blocco → tile (the thing you drag)
//   conferma / confermare → Lock in / locked in (never "confirm"/"submit" in visible copy)
//   timer finale → final countdown              Ascolta tutto → Play all
//   Riordina → Reorder                          al posto giusto → in the right spot
//   coppie in sequenza → linked pairs           punti → points
//   stanza → room · host → host · lobby → lobby · round → round · playlist → playlist
//   brano → track (counts, Deezer) / song (the reveal, the game's songs)
//   classifica → Leaderboard (reveal) / Standings, Final standings (end of game)
//   rimuovere un giocatore → kick               rivincita → rematch
//   spettatore → spectator                      anteprima → preview
// Style: US spelling (color, canceled), Oxford comma, curly quotes and apostrophes (“ ” ’),
// … for ellipses, sentence case (CSS uppercases where the design wants it), players are
// "they". Seconds are written "90s" / "38.3s" (unit attached), except the "90 sec" pill.
import type { Catalog } from '../../catalog'
import board from './board'
import final from './final'
import game from './game'
import home from './home'
import lobby from './lobby'
import names from './names'
import reveal from './reveal'
import round from './round'
import shell from './shell'
import ui from './ui'

export default { board, final, game, home, lobby, names, reveal, round, shell, ui } satisfies Catalog
