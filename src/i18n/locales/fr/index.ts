// Français (France): mirrors the Italian source catalog exactly.
//
// Glossary — keep these consistent:
//   round → manche (f.) · "Manche 3/5", "Manche suivante", "M3" on covers
//   snippet → extrait (m.) · the draggable piece; also the Deezer 30 s preview
//   block → bloc · a snippet on the board ("Touche un bloc pour l’écouter")
//   hit → tube · "Le tube est en morceaux" (morceau = piece and song)
//   song / track → chanson / titre (Deezer counts "titres")
//   room, lobby → salon (m.) · "Code du salon", "Retour au salon"
//   host → hôte · player → joueur (neutral rewording where it reads naturally)
//   confirm → valider / validation · "Valider", "a validé", "la première validation"
//   final timer → chrono final · countdown → compte à rebours
//   right place → à la bonne place (invariable) · pair in sequence → paire enchaînée
//   playlist → playlist (f.) · reveal → résultats · leaderboard → classement
//   nickname → pseudo · you (badge) → toi · spectator → « en tribune » (gender-neutral)
//   difficulty → Facile / Normal / Difficile / Infernal (masculine, like "mode")
// Register: "tu", imperative for instructions, infinitive for buttons ("Valider").
// Typography: U+202F narrow no-break space before ! ? ; : and inside « »,
// U+00A0 no-break space between a number and its unit ("90 s"), apostrophe ’.
// Ordinals: "1er", "2e" (masculine) — reword around {rank} instead of "1re place".
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
