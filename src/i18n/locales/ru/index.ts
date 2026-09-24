// Русский: mirrors the Italian source catalog exactly (`satisfies Catalog`).
//
// Glossary (keep these consistent):
//   round → раунд · snippet → фрагмент (playful lines: кусочки) · block (the tile you
//   drag) → блок · host → хост · lobby → лобби · room / room code → комната / код
//   комнаты · playlist → плейлист · track / song → трек / песня · preview → отрывок ·
//   confirm button → «Готово» (verb in prose: подтвердить; "X confirmed" → «X жмёт
//   «Готово»») · final timer → финальный таймер · reveal → результаты · leaderboard →
//   рейтинг · final standings → итоги · points → очки (очко / очка / очков) · right
//   place → на своём месте · pair in sequence → верная пара · perfect → идеально ·
//   spectator → зритель («Ты в зрителях») · rematch → реванш · play again → «Ещё раз» ·
//   difficulty → Легко / Средне / Сложно / Хардкор (they sit under the numbers of a
//   4-way picker, ~55 px on phones: «Нормально» did not fit).
// Register: «ты», lively; «…» quotes (nested „…“); NBSP between a number and «с»/«мин».
// Players' gender is unknown: no past-tense verbs or adjectives agreeing with the
// player (use present tense, impersonal or plural forms: «жмёт», «угадано», «все
// ответили»). Nicknames never decline, so {name} / {names} always sit where the
// nominative fits («Ждём: {names}», «игрока {name}»).
// Ordinals: ui.ordinal is the bare number; messages add the ending («{rank}-е место»).
// Plurals: one / few / many / other (other = fractions, worded like few).
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
