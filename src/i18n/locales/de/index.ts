// Deutsch: mirrors the Italian source catalog (../it) key by key.
//
// Glossary (keep these consistent):
//   round → Runde (R3 = "Runde 3")        snippet → Schnipsel (der, pl. die Schnipsel)
//   block (draggable tile) → Block/Blöcke  shuffle/slice → zerschnipseln
//   order → Reihenfolge (short: Folge)     in the right place → an der richtigen Stelle / richtig platziert
//   reveal board: mine → Deine Version, correct → (Das) Original (titles and toggle)
//   pair in sequence → passendes Paar      confirm → bestätigen, Bestätigen (button)
//   final timer → Endspurt                 host → Host (no article in "Du bist Host")
//   lobby → Lobby   room → Raum, Raumcode  playlist → Playlist(s)   track/song → Song(s)
//   preview → Hörprobe                     reveal → Auflösung       leaderboard → Rangliste
//   final standings → Endstand             rematch → Revanche       spectator → "Du schaust zu" / "Schaut zu"
//   points → Punkte   home → Startseite    rejoin → Wiedereinstieg  audio → Ton
//   players → Personen (counts), Mitspielende (prose), "Mit dabei" (roster title / tab)
//   rank → "{rank} Platz" (ui.ordinal "1."), plain numbers → "Platz 2"
//   retry → Nochmal   leave → Verlassen (tight docks / pills: Raus)   play again → Nochmal!
// Style: informal "du", gender-neutral wording (Personen, jemand, alle, wer …),
// „…“ quotes, en dash " – ", "…", ’ apostrophe, no-break space before "s" / "Min.".
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
