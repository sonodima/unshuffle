// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS: write them normally.
import type { Catalog } from '../../catalog'

export default {
  header: {
    /** Small label above the round title. */
    eyebrow: 'Resultados',
    /** Page title, e.g. "Rodada 3 / 5". The <dim> part is shown dimmed. */
    round: 'Rodada {round}<dim> / {total}</dim>',
  },

  song: {
    /** Screen-reader name of the song card. */
    region: 'A música',
    /** Small label above the song title. */
    eyebrow: 'A música era',
    /** Alt text of the album cover; {name} is the album (or the song title). */
    coverAlt: 'Capa de {name}',
    /** Status of the original song (equalizer label, now-playing bar). */
    playing: 'Tocando',
    paused: 'Em pausa',
    /** Now-playing bar when the song is not playing (“parada” = stopped, the song). */
    stopped: 'Parada',
    /** Button while the browser still blocks the audio: one tap starts it. */
    unlock: {
      hover: 'Clique para ouvir',
      touch: 'Toque para ouvir',
    },
    /** Round play/pause button (screen-reader labels). */
    pause: 'Pausar a música',
    resume: 'Retomar a música',
    replay: 'Ouvir a música de novo',
    /**
     * Small button that opens the song on Deezer. The <wide> part is hidden on
     * phones narrower than 420 px, so what is outside it must work alone (keep it short).
     */
    deezer: 'Ouvir<wide> no Deezer</wide>',
    /** Screen-reader label of the Deezer button; {title} is the song. */
    deezerAria: 'Ouvir {title} no Deezer (abre em uma nova aba)',
    /** Fact chips under the song (small). */
    snippets: { one: '{count} trecho', other: '{count} trechos' },
    /** Tempo chip: “BPM” stays as is. */
    bpm: '{bpm} BPM',
  },

  board: {
    /** Screen-reader name of the board section. */
    region: 'Sua sequência',
    /** Board title, depending on which arrangement is shown. */
    titleMine: 'Sua ordem',
    titleCorrect: 'A ordem certa',
    /**
     * Two-option toggle above the board, once sorted. Each option is ~120 px wide
     * on tablets/desktop and ~80 px on phones (the short forms).
     */
    toggle: {
      /** Screen-reader name of the toggle. */
      label: 'Ordem exibida',
      mine: 'Sua ordem',
      mineShort: 'Sua',
      correct: 'Ordem certa',
      correctShort: 'Certa',
    },
    /** Screen-reader labels of the two counters while the ✓ / ✗ pop in. */
    tallyCorrect: { one: '{count} no lugar certo', other: '{count} no lugar certo' },
    tallyWrong: { zero: '{count} errados', one: '{count} errado', other: '{count} errados' },
    /**
     * Tiny chips in the corner of a misplaced block (~6 characters).
     * `was`: on the right order, where the player had put that snippet.
     * `goes`: on the player's order, where the snippet belongs.
     * {pos} = the position, already an ordinal (ui.ordinal: "5º").
     */
    was: 'era {pos}',
    goes: '→ {pos}',
    /**
     * One line under the board title (truncated beyond ~60 characters on phones):
     * how it went · what a click (mouse) / tap (touch screens) on a block does.
     */
    hint: {
      /** Before the blocks sort themselves. */
      intro: {
        hover: 'Clique num trecho para ouvir a música a partir dali',
        touch: 'Toque num trecho para ouvir a música a partir dali',
      },
      /** The player's own arrangement is shown. */
      mine: {
        hover: 'Como ficaram seus trechos · clique para ouvir',
        touch: 'Como ficaram seus trechos · toque para ouvir',
      },
      perfect: {
        hover: 'Tudo no lugar certo! · clique para ouvir de novo',
        touch: 'Tudo no lugar certo! · toque para ouvir de novo',
      },
      none: {
        hover: 'Nenhuma posição certa · clique para ouvir de novo',
        touch: 'Nenhuma posição certa · toque para ouvir de novo',
      },
      /** {count} right positions out of {n} blocks. */
      partial: {
        hover: {
          one: 'Você acertou {count} posição de {n} · clique para ouvir de novo',
          other: 'Você acertou {count} posições de {n} · clique para ouvir de novo',
        },
        touch: {
          one: 'Você acertou {count} posição de {n} · toque para ouvir de novo',
          other: 'Você acertou {count} posições de {n} · toque para ouvir de novo',
        },
      },
    },
  },

  /** In place of the board for a late joiner (plays from the next round). */
  spectator: {
    title: 'Você está assistindo',
    body: 'Nesta rodada você só assiste: joga a partir da próxima.',
  },
  /** In place of the board when the host got no arrangement from me. */
  missing: {
    title: 'Sem resposta',
    body: 'Dessa vez, sua sequência não chegou até nós.',
  },

  score: {
    /** Screen-reader name of the points panel. */
    region: 'Seus pontos',
    /** Small label over the big number (one line, keep it short). */
    eyebrow: 'Pontos da rodada',
    /** Badge: the timer ran out before I confirmed (also a leaderboard icon label). */
    timedOut: 'Tempo esgotado',
    /**
     * Small pill: how long I took to confirm. The <wide> part is hidden below 400 px;
     * <num> wraps {time}, e.g. “55,8 s”. Keep all the text inside the two tags (either
     * order): the pill spaces them itself.
     */
    confirmedIn: '<wide>Confirmou em</wide> <num>{time}</num>',
    /** Screen-reader label of the 0–5000 bar ("0 de 5.000 pontos": reads well for 0 too). */
    barAria: { one: '{points} de {max} pontos', other: '{points} de {max} pontos' },
    /** Label under the “6/8” stat (small, one line). */
    correct: 'no lugar certo',
    /** Label under the pair count (small, one line); the number is shown above it. */
    pairs: { zero: 'pares em sequência', one: 'par em sequência', other: 'pares em sequência' },
    /** My overall total after this round. */
    total: 'Total da partida',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}',
    /** Stamp on a perfect round (big, slanted). */
    stamp: 'Perfeito!',
  },

  /** One line under my points, by how well the round went (“perfeita” = the sequence). */
  verdict: {
    perfect: 'Sequência perfeita!',
    almost: 'Quase perfeita!',
    good: 'Ouvido afiado!',
    close: 'Quase lá…',
    more: 'Vale dar mais uma ouvida',
    none: 'Nenhum trecho no lugar certo',
  },

  /** Screen-reader label of the rank-change arrow. */
  rankUp: { one: 'Sobe {count} posição', other: 'Sobe {count} posições' },
  rankDown: { one: 'Desce {count} posição', other: 'Desce {count} posições' },

  /** A duration in seconds; {seconds} is already formatted (“55,8”). */
  seconds: '{seconds} s',

  /** Screen-reader summary once my points are shown. */
  announce: {
    /** {points} = round points, {correct} of {n} blocks right, {pairs} = announce.pairs. */
    result: {
      zero: '{points} pontos: {correct} de {n} no lugar certo, {pairs}.',
      one: '{points} ponto: {correct} de {n} no lugar certo, {pairs}.',
      other: '{points} pontos: {correct} de {n} no lugar certo, {pairs}.',
    },
    pairs: { zero: '{count} pares em sequência', one: '{count} par em sequência', other: '{count} pares em sequência' },
    /** Wraps the summary on a perfect round. */
    perfect: 'Sequência perfeita! {result}',
    /** Wraps the summary when the timer ran out. */
    timedOut: '{result} Tempo esgotado.',
  },

  lead: {
    /** Leaderboard title (and screen-reader name of the panel). */
    title: 'Ranking',
    /** Small label on the right of the title. */
    after: 'após a rodada {round}',
    /** Badge next to my own name (tiny: 2–4 letters). */
    you: 'você',
    /** Icon label on the best score(s) of the round. */
    top: 'Melhor pontuação da rodada',
    /** Under the name of a player without a result. */
    spectator: 'Assistindo',
    /** Late joiner, seen by the others; {round} = the round they start playing. */
    spectatorFrom: 'Assistindo · entra na rodada {round}',
    noAnswer: 'Sem resposta',
    /** Round stats under the leaderboard (tiny labels, one line each, three columns). */
    stats: {
      average: 'Média',
      perfect: 'Perfeitos',
      fastest: 'Mais veloz',
    },
    /**
     * Screen-reader label of a leaderboard row. {rank} = the place, already an ordinal (ui.ordinal: "1º"),
     * {name} = player (or lead.row.me for me), {total} = overall points.
     */
    row: {
      /** {points} this round, {correct} of {n} blocks in the right place. */
      played: {
        zero: '{rank}, {name}: {points} pontos nesta rodada, {correct} de {n} no lugar certo, total {total}',
        one: '{rank}, {name}: {points} ponto nesta rodada, {correct} de {n} no lugar certo, total {total}',
        other: '{rank}, {name}: {points} pontos nesta rodada, {correct} de {n} no lugar certo, total {total}',
      },
      spectator: '{rank}, {name}: assistindo, total {total}',
      noAnswer: '{rank}, {name}: sem resposta, total {total}',
      /** My own name in the row label. */
      me: '{name} (você)',
    },
  },

  footer: {
    /** Host's button: next round, or the final standings after the last round. */
    next: 'Próxima rodada',
    final: 'Ranking final',
    /** Auto-advance countdown beside the host's button; <num> wraps the seconds. */
    nextIn: { one: 'Próxima rodada em <num>{count}</num> s', other: 'Próxima rodada em <num>{count}</num> s' },
    finalIn: { one: 'Ranking final em <num>{count}</num> s', other: 'Ranking final em <num>{count}</num> s' },
    /** Guests, while the host decides. */
    waiting: 'Esperando o host…',
    /** Guests, with the auto-advance countdown; <num> is the dimmed seconds. */
    waitingIn: { one: 'Esperando o host…<num>({count} s)</num>', other: 'Esperando o host…<num>({count} s)</num>' },
  },
} satisfies Catalog['reveal']
