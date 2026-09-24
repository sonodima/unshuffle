// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18.304"); plural forms are
// chosen by the score itself. pt-BR `one` covers 0 too, so every points plural has a
// `zero` form ("0 pontos", not "0 ponto"). Uppercase comes from CSS.
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row. Very short (≈ 4 characters). */
  you: 'Você',
  /** A late joiner who never played a round (standings row, empty table cell). */
  didNotPlay: 'Não jogou',
  /** Round shorthand on covers and table rows ("R3"). Keep it 1–2 letters plus the number. */
  roundShort: 'R{round}',
  /** Round count: top bar chip (after the playlist name) and next to the "Rodada a rodada" title (uppercase). */
  roundCount: { one: '{count} rodada', other: '{count} rodadas' },

  topBar: {
    /** Eyebrow next to the logo (uppercase, small). */
    gameOver: 'Fim de jogo',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. Short: big display type. */
    teaser: 'E a vitória vai para',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short (≈ 16 characters). */
  headline: {
    /** Nobody in the standings (should not happen). */
    over: 'Fim de jogo!',
    noPlayers: 'Ninguém no ranking.',
    /** Solo game, zero points. */
    soloZero: 'Nenhum ponto!',
    soloZeroSub: 'Tente de novo: na próxima, a ordem sai certinha.',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: 'Mandou demais!',
    soloGood: 'Mandou bem!',
    soloOk: 'Fim de jogo!',
    /** Subtitle "18.304 pontos em 5 rodadas". {rounds} is the phrase headline.rounds. */
    pointsInRounds: { zero: '{points} pontos em {rounds}', one: '{points} ponto em {rounds}', other: '{points} pontos em {rounds}' },
    /** "5 rodadas" inside headline.pointsInRounds. */
    rounds: { one: '{count} rodada', other: '{count} rodadas' },
    /** Several players, nobody scored. */
    allZero: 'Tudo zerado!',
    allZeroSub: 'Ninguém pontuou dessa vez: joguem de novo e deem a volta por cima.',
    /** Shared first place. */
    tie: 'Empate!',
    /** I'm one of the tied winners. {names}: the other winners, already joined ("Giulia e Marco"). */
    tieWithMe: 'Você venceu junto com {names}',
    /** {names}: all the tied winners, already joined ("Tommy e Giulia"). Always two or more. */
    tieOthers: '{names} dividem a vitória',
    /** I won alone. */
    youWin: 'Você venceu!',
    /** Subtitle when I won and nobody else is in the standings. */
    youWinPoints: { zero: '{points} pontos', one: '{points} ponto', other: '{points} pontos' },
    /** Subtitle when I won: my total, then my lead {gap} (formatted points) over the runner-up {name}. */
    youWinLead: {
      zero: '{points} pontos · +{gap} à frente de {name}',
      one: '{points} ponto · +{gap} à frente de {name}',
      other: '{points} pontos · +{gap} à frente de {name}',
    },
    /** I won with the same points as {name}, thanks to the faster confirmations. */
    youWinFaster: 'Empate em pontos com {name}, mas você confirmou antes',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name} vence!',
    /** I have the winner's points but lost on time. */
    sameScore: 'Mesmos pontos que {name}: vence quem confirmou antes',
    /** My place: {rank} (already an ordinal, ui.ordinal: "2º") out of {total} players, with my points. */
    myRank: {
      zero: 'Você ficou em {rank} de {total}, com {points} pontos',
      one: 'Você ficou em {rank} de {total}, com {points} ponto',
      other: 'Você ficou em {rank} de {total}, com {points} pontos',
    },
  },

  /** Action bar pinned under the podium / at the bottom of the screen. */
  dock: {
    /** Accessible name of the button group. */
    label: 'Ações',
    leave: 'Sair',
    /** Host: main button, back to the lobby with the same players. Keep it short. */
    playAgain: 'Jogar de novo',
    /** Guest: nudge the host for a rematch. */
    rematch: 'Revanche!',
    /** Guest: the rematch button right after tapping it (disabled for a few seconds). */
    rematchSent: 'Pedido enviado',
    /** Guest: next to an animated equalizer while the host decides. */
    waiting: 'Esperando o host começar a revanche…',
    /** Host: who asked for a rematch. {names}: one or two names, already joined ("Giulia e Marco"); plural by how many. */
    rematchNamed: { one: '{names} quer revanche!', other: '{names} querem revanche!' },
    /** Host: three or more players asked for a rematch. */
    rematchMany: { one: '{count} pessoa quer revanche!', other: '{count} pessoas querem revanche!' },
  },

  /** Host leaving while others are still connected. */
  leaveDialog: {
    title: 'Fechar a sala?',
    /** {count}: connected players other than the host (1–9). The "one" form is for exactly one. */
    body: {
      one: 'A outra pessoa será desconectada e a partida não poderá ser jogada de novo.',
      other: 'Os outros {count} jogadores serão desconectados e a partida não poderá ser jogada de novo.',
    },
    cancel: 'Cancelar',
    confirm: 'Fechar sala',
  },

  podium: {
    /** Accessible name of the podium list. */
    label: 'Pódio',
    /** Screen readers, one podium step. {rank}: the place, already an ordinal (ui.ordinal: "1º"). */
    slot: { zero: '{rank} lugar: {name}, {points} pontos', one: '{rank} lugar: {name}, {points} ponto', other: '{rank} lugar: {name}, {points} pontos' },
    /** Same, for my own step. */
    slotMe: {
      zero: '{rank} lugar: {name} (você), {points} pontos',
      one: '{rank} lugar: {name} (você), {points} ponto',
      other: '{rank} lugar: {name} (você), {points} pontos',
    },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: 'Aplaudir {name}',
  },

  standings: {
    title: 'Ranking',
    /** Next to the title (small, uppercase). */
    players: { one: '{count} jogador', other: '{count} jogadores' },
    /** Screen readers, before a row: "Posição 2". */
    position: 'Posição {rank}',
    /** Badge on a disconnected player. Short. */
    offline: 'Offline',
    /** Tooltips / screen-reader labels of the small stats under each name. */
    perfectRounds: 'Rodadas perfeitas',
    accuracy: 'Trechos no lugar certo, em média',
    avgTime: 'Tempo médio para confirmar',
    /** Late joiner: the first round they played. */
    lateFrom: 'desde a rodada {round}',
    /** Unit under each total (tiny, uppercase); plural by the score. */
    points: { zero: 'pontos', one: 'ponto', other: 'pontos' },
  },

  /** Award cards. Titles are small display type in a half-width card on phones: keep them short. */
  awards: {
    title: 'Prêmios',
    /** Next to the title (small, uppercase). */
    aside: 'Menções honrosas',
    /** Three or more winners of an award: "Giulia e mais 2". {count}: how many besides {name}. */
    nameAndOthers: { one: '{name} e mais {count}', other: '{name} e mais {count}' },
    goldenEar: {
      title: 'Ouvido de ouro',
      description: 'Mais rodadas perfeitas',
      value: { one: '{count} rodada perfeita', other: '{count} rodadas perfeitas' },
    },
    lightning: {
      /** One word that fits the half-width card at 360px ("Relâmpago" broke mid-word there). */
      title: 'Turbo',
      description: 'Mais veloz nas rodadas com pontos',
      /** {time}: average time, e.g. "38,3 s". */
      value: 'média de {time}',
    },
    sniper: {
      title: 'Na mosca',
      description: 'Mais trechos no lugar certo',
      /** {accuracy}: snippets in place per round ("6,8/8") or a percentage ("85%"). */
      value: '{accuracy} em média',
    },
    lastSecond: {
      title: 'Último segundo',
      description: 'Mais rodadas com tempo esgotado',
      value: { one: '{count} vez com tempo esgotado', other: '{count} vezes com tempo esgotado' },
    },
  },

  /** Rounds × players points table. */
  rounds: {
    title: 'Rodada a rodada',
    /** Accessible name of the table when it scrolls sideways. */
    scrollLabel: 'Pontos por rodada; role para ver todos os jogadores',
    /** Table caption (screen readers only). */
    caption: 'Pontos de cada jogador em cada rodada',
    /** Header of the song column (small, uppercase). */
    song: 'Música',
    /** Row title when the song is unknown. */
    fallbackTitle: 'Rodada {round}',
    /** Crown icon on the round's best score, and its legend. */
    best: 'Melhor da rodada',
    /** Badge in a narrow cell (≈ 70px, tiny uppercase) and legend entry. Short. */
    perfect: 'Perfeita',
    /** Clock icon, and its legend. */
    timedOut: 'Tempo esgotado',
    /** Footer row label (uppercase). */
    total: 'Total',
  },

  /** Song tiles at the bottom. */
  songs: {
    title: 'As músicas da partida',
    /** Next to the title (small, uppercase; hidden on phones). */
    aside: 'Ouça de novo aqui ou no Deezer',
    /** Cover button, screen readers. {title} / {artist}: the song; {round}: its round number. */
    play: 'Ouvir a prévia de {title}, de {artist}, rodada {round}',
    stop: 'Parar a prévia de {title}, de {artist}, rodada {round}',
    /** Link to the song on Deezer (screen readers). */
    open: 'Abrir {title} no Deezer (nova aba)',
    /** Tooltip of the same link. */
    openTooltip: 'Abrir no Deezer',
    /** Under a song whose preview couldn't be loaded. */
    unavailable: 'Prévia indisponível',
  },

  units: {
    /** Seconds with one decimal ("38,3 s"): {value} is already formatted. Keep the no-break space before the unit. */
    seconds: '{value} s',
  },
} satisfies Catalog['final']
