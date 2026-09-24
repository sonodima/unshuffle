// Spanish (neutral international: Spain + Latin America), informal "tú", no
// "vosotros"/"ustedes" (write around them: impersonal "se", "quien…", "todos").
// Mirrors the Italian source catalog exactly.
//
// Glossary (keep it consistent):
//   round → ronda (f.)            snippet → fragmento        block → bloque
//   room → sala                   lobby → lobby (m., the pre-game screen)
//   host → anfitrión (as a role; "La sala es tuya" when speaking to the host)
//   player → jugador              spectator → espectador / "Modo espectador"
//   confirm → confirmar (button "Confirmar"), confirmación
//   final timer → temporizador final     time's up → tiempo agotado
//   playlist → playlist (f., pl. playlists)   song / track → canción, audio track → pista
//   preview (Deezer 30 s clip) → vista previa   link → enlace (only the tight
//     phone button lobby.code.copyLink says «Copiar link»)
//   reveal → resultados            leaderboard / standings → clasificación
//   in the right place → en su lugar     pair in sequence → par en secuencia
//   perfect round → ronda perfecta       rematch → revancha      points → puntos
//   click → haz clic / touch → toca      press (keys) → presiona; keys: Espacio, Enter, Mayús
//   home screen → inicio           shuffle → barajar           on the beat → al compás
// Typography: ¡…! and ¿…? pairs, «…» quotes, "…" ellipsis, ordinals "1.º".
// Tense: prefer present or nominal phrasing; for recent events use the compound
// perfect ("ha confirmado"); set phrases may keep the preterite ("Algo salió mal").
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
