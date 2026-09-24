// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS: write them normally.
export default {
  header: {
    /** Small label above the round title. */
    eyebrow: 'Risultati',
    /** Page title, e.g. "Round 3 / 5". The <dim> part is shown dimmed. */
    round: 'Round {round}<dim> / {total}</dim>',
  },

  song: {
    /** Screen-reader name of the song card. */
    region: 'La canzone',
    /** Small label above the song title. */
    eyebrow: 'La canzone era',
    /** Alt text of the album cover; {name} is the album (or the song title). */
    coverAlt: 'Copertina di {name}',
    /** Status of the original song (equalizer label, now-playing bar). */
    playing: 'In riproduzione',
    paused: 'In pausa',
    /** Now-playing bar when the song is not playing (Italian “ferma” = stopped, the song). */
    stopped: 'Ferma',
    /** Button while the browser still blocks the audio: one tap starts it. */
    unlock: {
      hover: 'Clicca per ascoltare',
      touch: 'Tocca per ascoltare',
    },
    /** Round play/pause button (screen-reader labels). */
    pause: 'Ferma la canzone',
    resume: 'Riprendi la canzone',
    replay: 'Riascolta la canzone',
    /**
     * Small button that opens the song on Deezer. The <wide> part is hidden on
     * phones narrower than 420 px, so what is outside it must work alone (keep it short).
     */
    deezer: 'Ascolta<wide> su Deezer</wide>',
    /** Screen-reader label of the Deezer button; {title} is the song. */
    deezerAria: 'Ascolta {title} su Deezer (si apre in una nuova scheda)',
    /** Fact chips under the song (small). */
    snippets: { one: '{count} spezzone', other: '{count} spezzoni' },
    /** Tempo chip: “BPM” stays as is. */
    bpm: '{bpm} BPM',
  },

  board: {
    /** Screen-reader name of the board section. */
    region: 'La tua sequenza',
    /** Board title, depending on which arrangement is shown. */
    titleMine: 'Il tuo ordine',
    titleCorrect: 'L’ordine giusto',
    /**
     * Two-option toggle above the board, once sorted. Each option is ~120 px wide
     * on tablets/desktop and ~80 px on phones (the short forms).
     */
    toggle: {
      /** Screen-reader name of the toggle. */
      label: 'Ordine mostrato',
      mine: 'Il tuo ordine',
      mineShort: 'Il tuo',
      correct: 'Ordine giusto',
      correctShort: 'Giusto',
    },
    /** Screen-reader labels of the two counters while the ✓ / ✗ pop in. */
    tallyCorrect: { one: '{count} al posto giusto', other: '{count} al posto giusto' },
    tallyWrong: { one: '{count} sbagliato', other: '{count} sbagliati' },
    /**
     * Tiny chips in the corner of a misplaced block (~6 characters; ~10 still fit, in a small monospace font).
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
        hover: 'Clicca uno spezzone per ascoltare la canzone da lì',
        touch: 'Tocca uno spezzone per ascoltare la canzone da lì',
      },
      /** The player's own arrangement is shown. */
      mine: {
        hover: 'Com’erano i tuoi spezzoni · clicca per ascoltarli',
        touch: 'Com’erano i tuoi spezzoni · tocca per ascoltarli',
      },
      perfect: {
        hover: 'Tutti al posto giusto! · clicca per riascoltare',
        touch: 'Tutti al posto giusto! · tocca per riascoltare',
      },
      none: {
        hover: 'Nessuna posizione azzeccata · clicca per riascoltare',
        touch: 'Nessuna posizione azzeccata · tocca per riascoltare',
      },
      /** {count} right positions out of {n} blocks. */
      partial: {
        hover: {
          one: 'Hai azzeccato {count} posizione su {n} · clicca per riascoltare',
          other: 'Hai azzeccato {count} posizioni su {n} · clicca per riascoltare',
        },
        touch: {
          one: 'Hai azzeccato {count} posizione su {n} · tocca per riascoltare',
          other: 'Hai azzeccato {count} posizioni su {n} · tocca per riascoltare',
        },
      },
    },
  },

  /** In place of the board for a late joiner (plays from the next round). */
  spectator: {
    title: 'Sei spettatore',
    body: 'Questo round lo guardi da fuori: giocherai dal prossimo.',
  },
  /** In place of the board when the host got no arrangement from me. */
  missing: {
    title: 'Nessuna risposta',
    body: 'Questa volta non abbiamo ricevuto la tua sequenza.',
  },

  score: {
    /** Screen-reader name of the points panel. */
    region: 'I tuoi punti',
    /** Small label over the big number (one line, keep it short). */
    eyebrow: 'Punti del round',
    /** Badge: the timer ran out before I confirmed (also a leaderboard icon label). */
    timedOut: 'Tempo scaduto',
    /**
     * Small pill: how long I took to confirm. The <wide> part is hidden below 400 px;
     * <num> wraps {time}, e.g. “55,8 s”. Keep all the text inside the two tags (either
     * order): the pill spaces them itself.
     */
    confirmedIn: '<wide>Confermato in</wide> <num>{time}</num>',
    /** Screen-reader label of the 0–5000 bar. */
    barAria: { one: '{points} punto su {max}', other: '{points} punti su {max}' },
    /** Label under the “6/8” stat (small, one line). */
    correct: 'al posto giusto',
    /** Label under the pair count (small, one line); the number is shown above it. */
    pairs: { one: 'coppia in sequenza', other: 'coppie in sequenza' },
    /** My overall total after this round. */
    total: 'Totale partita',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}',
    /** Stamp on a perfect round (big, slanted). */
    stamp: 'Perfetto!',
  },

  /** One line under my points, by how well the round went (“perfetta” = the sequence). */
  verdict: {
    perfect: 'Sequenza perfetta!',
    almost: 'Quasi perfetta!',
    good: 'Bell’orecchio!',
    close: 'Ci sei quasi…',
    more: 'Serve un altro ascolto',
    none: 'Nessuno spezzone al posto giusto',
  },

  /** Screen-reader label of the rank-change arrow. */
  rankUp: { one: 'Sale di {count} posizione', other: 'Sale di {count} posizioni' },
  rankDown: { one: 'Scende di {count} posizione', other: 'Scende di {count} posizioni' },

  /** A duration in seconds; {seconds} is already formatted (“55,8”). */
  seconds: '{seconds} s',

  /** Screen-reader summary once my points are shown. */
  announce: {
    /** {points} = round points, {correct} of {n} blocks right, {pairs} = announce.pairs. */
    result: {
      one: '{points} punto: {correct} su {n} al posto giusto, {pairs}.',
      other: '{points} punti: {correct} su {n} al posto giusto, {pairs}.',
    },
    pairs: { one: '{count} coppia in sequenza', other: '{count} coppie in sequenza' },
    /** Wraps the summary on a perfect round. */
    perfect: 'Sequenza perfetta! {result}',
    /** Wraps the summary when the timer ran out. */
    timedOut: '{result} Tempo scaduto.',
  },

  lead: {
    /** Leaderboard title (and screen-reader name of the panel). */
    title: 'Classifica',
    /** Small label on the right of the title. */
    after: 'dopo il round {round}',
    /** Badge next to my own name (tiny: 2–4 letters). */
    you: 'tu',
    /** Icon label on the best score(s) of the round. */
    top: 'Miglior punteggio del round',
    /** Under the name of a player without a result. */
    spectator: 'Spettatore',
    /** Late joiner, seen by the others; {round} = the round they start playing. */
    spectatorFrom: 'Spettatore · gioca dal round {round}',
    noAnswer: 'Nessuna risposta',
    /** Round stats under the leaderboard (tiny labels, one line each, three columns). */
    stats: {
      /** Average points of the round. */
      average: 'Media',
      /** How many players got the whole order right this round (the number is shown above). */
      perfect: 'Perfetti',
      fastest: 'Più veloce',
    },
    /**
     * Screen-reader label of a leaderboard row. {rank} = the place, already an ordinal (ui.ordinal: "1º"),
     * {name} = player (or lead.row.me for me), {total} = overall points.
     */
    row: {
      /** {points} this round, {correct} of {n} blocks in the right place. */
      played: {
        one: '{rank}, {name}: {points} punto in questo round, {correct} su {n} al posto giusto, totale {total}',
        other: '{rank}, {name}: {points} punti in questo round, {correct} su {n} al posto giusto, totale {total}',
      },
      spectator: '{rank}, {name}: spettatore, totale {total}',
      noAnswer: '{rank}, {name}: nessuna risposta, totale {total}',
      /** My own name in the row label. */
      me: '{name} (tu)',
    },
  },

  footer: {
    /** Host's button: next round, or the final standings after the last round. */
    next: 'Prossimo round',
    final: 'Classifica finale',
    /** Auto-advance countdown beside the host's button; <num> wraps the seconds. */
    nextIn: { one: 'Prossimo round tra <num>{count}</num> s', other: 'Prossimo round tra <num>{count}</num> s' },
    finalIn: { one: 'Classifica finale tra <num>{count}</num> s', other: 'Classifica finale tra <num>{count}</num> s' },
    /** Guests, while the host decides. */
    waiting: 'In attesa dell’host…',
    /** Guests, with the auto-advance countdown; <num> is the dimmed seconds. */
    waitingIn: { one: 'In attesa dell’host…<num>({count} s)</num>', other: 'In attesa dell’host…<num>({count} s)</num>' },
  },
}
