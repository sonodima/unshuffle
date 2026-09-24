// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18.304"); plural forms are
// chosen by the score itself. Uppercase comes from CSS: write normal case.
export default {
  /** Badge / table header for my own row. Very short (≈ 4 characters). */
  you: 'Tu',
  /** A late joiner who never played a round (standings row, empty table cell). */
  didNotPlay: 'Non ha giocato',
  /** Round shorthand on covers and table rows ("R3"). Keep it 1–2 letters plus the number. */
  roundShort: 'R{round}',
  /** Round count: top bar chip (after the playlist name) and next to the "Round per round" title (uppercase). */
  roundCount: { one: '{count} round', other: '{count} round' },

  topBar: {
    /** Eyebrow next to the logo (uppercase, small). */
    gameOver: 'Partita finita',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. Short: big display type. */
    teaser: 'E il vincitore è',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short (≈ 16 characters). */
  headline: {
    /** Nobody in the standings (should not happen). */
    over: 'Partita finita!',
    noPlayers: 'Nessun giocatore in classifica.',
    /** Solo game, zero points. */
    soloZero: 'Zero punti!',
    soloZeroSub: 'Riprova: la prossima la rimetti in ordine.',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: 'Da maestro!',
    soloGood: 'Bel colpo!',
    soloOk: 'Partita finita!',
    /** Subtitle "18.304 punti in 5 round" (solo game, or a viewer who didn't play). {rounds} is the phrase headline.rounds. */
    pointsInRounds: { one: '{points} punto in {rounds}', other: '{points} punti in {rounds}' },
    /** "5 round" inside headline.pointsInRounds (in the grammatical case that sentence needs, unlike roundCount). */
    rounds: { one: '{count} round', other: '{count} round' },
    /** Several players, nobody scored. */
    allZero: 'Tutti a zero!',
    allZeroSub: 'Nessun punto stavolta: rigioca e rifatti.',
    /** Shared first place. */
    tie: 'Pari merito!',
    /** I'm one of the tied winners. {names}: the other winners, already joined ("Giulia e Marco"). */
    tieWithMe: 'Hai vinto insieme a {names}',
    /** {names}: all the tied winners, already joined ("Tommy e Giulia"). Always two or more. */
    tieOthers: '{names} vincono a pari merito',
    /** I won alone. */
    youWin: 'Hai vinto!',
    /** Subtitle when I won and nobody else is in the standings. */
    youWinPoints: { one: '{points} punto', other: '{points} punti' },
    /** Subtitle when I won: my total, then my lead {gap} (formatted points) over the runner-up {name}. */
    youWinLead: { one: '{points} punto · +{gap} su {name}', other: '{points} punti · +{gap} su {name}' },
    /** I won with the same points as {name}, thanks to the faster confirmations. */
    youWinFaster: 'A pari punti con {name}, ma più veloce',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name} vince!',
    /** I have the winner's points but lost on time. */
    sameScore: 'Stessi punti di {name}: vince chi ha confermato prima',
    /** My place: {rank} (already an ordinal, ui.ordinal: "2º") out of {total} players, with my points. */
    myRank: { one: 'Sei {rank} su {total} con {points} punto', other: 'Sei {rank} su {total} con {points} punti' },
  },

  /** Action bar pinned under the podium / at the bottom of the screen. */
  dock: {
    /** Accessible name of the button group. */
    label: 'Azioni',
    leave: 'Esci',
    /** Host: main button, back to the lobby with the same players. Keep it short. */
    playAgain: 'Rigioca',
    /** Guest: nudge the host for a rematch. */
    rematch: 'Rivincita!',
    /** Guest: the rematch button right after tapping it (disabled for a few seconds). */
    rematchSent: 'Richiesta inviata',
    /** Guest: next to an animated equalizer while the host decides. */
    waiting: 'In attesa dell’host per rigiocare…',
    /** Host: who asked for a rematch. {names}: one or two names, already joined ("Giulia e Marco"); plural by how many. */
    rematchNamed: { one: '{names} vuole la rivincita!', other: '{names} vogliono la rivincita!' },
    /** Host: three or more players asked for a rematch. */
    rematchMany: { one: '{count} giocatore vuole la rivincita!', other: '{count} giocatori vogliono la rivincita!' },
  },

  /** Host leaving while others are still connected. */
  leaveDialog: {
    title: 'Chiudere la stanza?',
    /** {count}: connected players other than the host (1–9). The "one" form is for exactly one. */
    body: {
      one: 'L’altro giocatore verrà disconnesso e la partita non potrà essere rigiocata.',
      other: 'Gli altri {count} giocatori verranno disconnessi e la partita non potrà essere rigiocata.',
    },
    cancel: 'Annulla',
    confirm: 'Chiudi stanza',
  },

  podium: {
    /** Accessible name of the podium list. */
    label: 'Podio',
    /** Screen readers, one podium step. {rank}: the place, already an ordinal (ui.ordinal: "1º"). */
    slot: { one: '{rank} posto: {name}, {points} punto', other: '{rank} posto: {name}, {points} punti' },
    /** Same, for my own step. */
    slotMe: { one: '{rank} posto: {name} (tu), {points} punto', other: '{rank} posto: {name} (tu), {points} punti' },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: 'Festeggia {name}',
  },

  standings: {
    title: 'Classifica',
    /** Next to the title (small, uppercase). */
    players: { one: '{count} giocatore', other: '{count} giocatori' },
    /** Screen readers, before a row: "Posizione 2". {rank} is a plain number here, not an ordinal (ui.ordinal). */
    position: 'Posizione {rank}',
    /** Badge on a disconnected player. Short. */
    offline: 'Offline',
    /** Tooltips / screen-reader labels of the small stats under each name. */
    perfectRounds: 'Round perfetti',
    accuracy: 'Spezzoni al posto giusto, in media',
    avgTime: 'Tempo medio di conferma',
    /** Late joiner: the first round they played. */
    lateFrom: 'dal round {round}',
    /** Unit under each total (tiny, uppercase); plural by the score. */
    points: { one: 'punto', other: 'punti' },
  },

  /** Award cards. Titles are small display type in a half-width card on phones: keep them short. */
  awards: {
    title: 'Premi',
    /** Next to the title (small, uppercase). */
    aside: 'Menzioni speciali',
    /** Three or more winners of an award: "Giulia e altri 2". {count}: how many besides {name}. */
    nameAndOthers: { one: '{name} e un altro', other: '{name} e altri {count}' },
    goldenEar: {
      title: 'Orecchio d’oro',
      description: 'Più round perfetti',
      value: { one: '{count} round perfetto', other: '{count} round perfetti' },
    },
    lightning: {
      title: 'Fulmine',
      description: 'Conferma più rapida nei round a punti',
      /** {time}: average time, e.g. "38,3 s". */
      value: 'in media {time}',
    },
    sniper: {
      title: 'Cecchino',
      description: 'Più spezzoni al posto giusto',
      /** {accuracy}: snippets in place per round ("6,8/8") or a percentage ("85%"). */
      value: '{accuracy} di media',
    },
    lastSecond: {
      title: 'Ultimo secondo',
      description: 'Più round finiti fuori tempo',
      value: { one: '{count} volta fuori tempo', other: '{count} volte fuori tempo' },
    },
  },

  /** Rounds × players points table. */
  rounds: {
    title: 'Round per round',
    /** Accessible name of the table when it scrolls sideways. */
    scrollLabel: 'Punti per round, scorri per vedere tutti i giocatori',
    /** Table caption (screen readers only). */
    caption: 'Punti di ogni giocatore in ogni round',
    /** Header of the song column (small, uppercase). */
    song: 'Brano',
    /** Row title when the song is unknown. */
    fallbackTitle: 'Round {round}',
    /** Crown icon on the round's best score, and its legend. */
    best: 'Migliore del round',
    /** Badge in a narrow cell (≈ 70px, tiny uppercase) and legend entry. Short. */
    perfect: 'Perfetto',
    /** Clock icon, and its legend. */
    timedOut: 'Tempo scaduto',
    /** Footer row label (uppercase). */
    total: 'Totale',
  },

  /** Song tiles at the bottom. */
  songs: {
    title: 'I brani della partita',
    /** Next to the title (small, uppercase; hidden on phones). */
    aside: 'Riascoltali qui o su Deezer',
    /** Cover button, screen readers. {title} / {artist}: the song; {round}: its round number. */
    play: 'Ascolta l’anteprima di {title} di {artist}, round {round}',
    stop: 'Ferma l’anteprima di {title} di {artist}, round {round}',
    /** Link to the song on Deezer (screen readers). */
    open: 'Apri {title} su Deezer (nuova scheda)',
    /** Tooltip of the same link. */
    openTooltip: 'Apri su Deezer',
    /** Under a song whose preview couldn't be loaded. */
    unavailable: 'Anteprima non disponibile',
  },

  units: {
    /** Seconds with one decimal ("38,3 s"): {value} is already formatted. Keep the no-break space before the unit. */
    seconds: '{value} s',
  },
}
