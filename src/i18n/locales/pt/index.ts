// Português (Brasil): mirrors the Italian source catalog exactly.
//
// Glossary (keep these consistent):
//   round → rodada (R{n} on covers)       snippet → trecho; block → bloco
//   room → sala; lobby → lobby             host → host (no article where possible)
//   confirm → confirmar / confirmou        final timer → contagem final
//   leaderboard / standings → ranking      reveal → resultados
//   points → pontos (pts only if needed)   preview (Deezer) → prévia
//   track / song → música; playlist → playlist
//   spectator → assistindo / "você está assistindo" (gender-neutral)
//   home screen → início                   retry → tentar de novo
//   play-all → ouvir tudo                  3-2-1 → "Bora?" … "Já!"
//   share (native sheet) → enviar ("Enviar", "Enviar link": "Compartilhar" doesn't fit phones)
//   back home → "volte ao início" (not "pelo início"); object pronoun → te ("te ver")
// Tone: você, informal and lively ("bora", "galera", "dá para"), but errors stay
// plain. Prefer neutral wording (todo mundo, quem, alguém, a outra pessoa) over
// gendered adjectives. Quotes “…”, ellipsis …, ordinals via ui.ordinal ({n}º).
// Plurals: pt-BR cardinal `one` covers 0 AND 1 (CLDR). Wherever a count can be 0
// (points, pairs, wrong snippets, tracks, seconds left…) the plural has an explicit
// `zero` form, so it reads "0 pontos", never "0 ponto". A count that is never 0 needs
// no `zero`; `many` (exact millions) is left to `other`, the same text in digits.
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
