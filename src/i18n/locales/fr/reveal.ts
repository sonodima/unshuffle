// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS: write them normally.
import type { Catalog } from '../../catalog'

export default {
  header: {
    /** Small label above the round title. */
    eyebrow: 'Résultats',
    /** Page title, e.g. "Manche 3 / 5". The <dim> part is shown dimmed. */
    round: 'Manche {round}<dim> / {total}</dim>',
  },

  song: {
    /** Screen-reader name of the song card. */
    region: 'La chanson',
    /** Small label above the song title. */
    eyebrow: 'C’était',
    /** Alt text of the album cover; {name} is the album (or the song title). */
    coverAlt: 'Pochette de {name}',
    /** Status of the original song (equalizer label, now-playing bar). */
    playing: 'En lecture',
    paused: 'En pause',
    /** Now-playing bar when the song is not playing. */
    stopped: 'À l’arrêt',
    /** Button while the browser still blocks the audio: one tap starts it. */
    unlock: {
      hover: 'Clique pour écouter',
      touch: 'Touche pour écouter',
    },
    /** Round play/pause button (screen-reader labels). */
    pause: 'Mettre la chanson en pause',
    resume: 'Reprendre la chanson',
    replay: 'Réécouter la chanson',
    /**
     * Small button that opens the song on Deezer. The <wide> part is hidden on
     * phones narrower than 420 px, so what is outside it must work alone (keep it short).
     */
    deezer: 'Écouter<wide> sur Deezer</wide>',
    /** Screen-reader label of the Deezer button; {title} is the song. */
    deezerAria: 'Écouter {title} sur Deezer (nouvel onglet)',
    /** Fact chips under the song (small). */
    snippets: { one: '{count} extrait', other: '{count} extraits' },
    /** Tempo chip: “BPM” stays as is. */
    bpm: '{bpm} BPM',
  },

  board: {
    /** Screen-reader name of the board section. */
    region: 'Ta séquence',
    /** Board title, depending on which arrangement is shown. */
    titleMine: 'Ton ordre',
    titleCorrect: 'Le bon ordre',
    /**
     * Two-option toggle above the board, once sorted. Each option is ~120 px wide
     * on tablets/desktop and ~80 px on phones (the short forms).
     */
    toggle: {
      /** Screen-reader name of the toggle. */
      label: 'Ordre affiché',
      mine: 'Ton ordre',
      mineShort: 'Le tien',
      correct: 'Bon ordre',
      correctShort: 'Le bon',
    },
    /** Screen-reader labels of the two counters while the ✓ / ✗ pop in. */
    tallyCorrect: { one: '{count} à la bonne place', other: '{count} à la bonne place' },
    tallyWrong: { one: '{count} mal placé', other: '{count} mal placés' },
    /**
     * Tiny chips in the corner of a misplaced block (monospace, ~6–9 characters).
     * `was`: on the right order, where the player had put that snippet.
     * `goes`: on the player's order, where the snippet belongs.
     * {pos} = the position, already an ordinal (ui.ordinal: "5e").
     */
    was: 'était {pos}',
    goes: '→ {pos}',
    /**
     * One line under the board title (truncated beyond ~60 characters on phones):
     * how it went · what a click (mouse) / tap (touch screens) on a block does.
     */
    hint: {
      /** Before the blocks sort themselves. */
      intro: {
        hover: 'Clique sur un extrait pour écouter à partir de là',
        touch: 'Touche un extrait pour écouter à partir de là',
      },
      /** The player's own arrangement is shown. */
      mine: {
        hover: 'Voici ton ordre · clique pour écouter',
        touch: 'Voici ton ordre · touche pour écouter',
      },
      perfect: {
        hover: 'Tout est à sa place ! · clique pour réécouter',
        touch: 'Tout est à sa place ! · touche pour réécouter',
      },
      none: {
        hover: 'Aucun extrait bien placé · clique pour réécouter',
        touch: 'Aucun extrait bien placé · touche pour réécouter',
      },
      /** {count} right positions out of {n} blocks. */
      partial: {
        hover: {
          one: '{count} sur {n} bien placé · clique pour réécouter',
          other: '{count} sur {n} bien placés · clique pour réécouter',
        },
        touch: {
          one: '{count} sur {n} bien placé · touche pour réécouter',
          other: '{count} sur {n} bien placés · touche pour réécouter',
        },
      },
    },
  },

  /** In place of the board for a late joiner (plays from the next round). */
  spectator: {
    title: 'Tu es en tribune',
    body: 'Cette manche, tu la regardes de loin : tu joueras dès la prochaine.',
  },
  /** In place of the board when the host got no arrangement from me. */
  missing: {
    title: 'Aucune réponse',
    body: 'Cette fois, ta séquence ne nous est pas parvenue.',
  },

  score: {
    /** Screen-reader name of the points panel. */
    region: 'Tes points',
    /** Small label over the big number (one line, keep it short). */
    eyebrow: 'Points de la manche',
    /** Badge: the timer ran out before I confirmed (also a leaderboard icon label). */
    timedOut: 'Temps écoulé',
    /**
     * Small pill: how long I took to confirm. The <wide> part is hidden below 400 px;
     * <num> wraps {time}, e.g. “55,8 s”. Keep all the text inside the two tags (either
     * order): the pill spaces them itself.
     */
    confirmedIn: '<wide>Validé en</wide> <num>{time}</num>',
    /** Screen-reader label of the 0–5000 bar. */
    barAria: { one: '{points} point sur {max}', other: '{points} points sur {max}' },
    /** Label under the “6/8” stat (small, one line). */
    correct: 'à la bonne place',
    /** Label under the pair count (small, one line); the number is shown above it. */
    pairs: { one: 'paire enchaînée', other: 'paires enchaînées' },
    /** My overall total after this round. */
    total: 'Total de la partie',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}',
    /** Stamp on a perfect round (big, slanted). */
    stamp: 'Parfait !',
  },

  /** One line under my points, by how well the round went (feminine: it describes “la séquence”). */
  verdict: {
    perfect: 'Séquence parfaite !',
    almost: 'Presque parfaite !',
    good: 'Quelle oreille !',
    close: 'Tu y es presque…',
    more: 'Une autre écoute s’impose',
    none: 'Aucun extrait à la bonne place',
  },

  /** Screen-reader label of the rank-change arrow. */
  rankUp: { one: 'Gagne {count} place', other: 'Gagne {count} places' },
  rankDown: { one: 'Perd {count} place', other: 'Perd {count} places' },

  /** A duration in seconds; {seconds} is already formatted (“55,8”). */
  seconds: '{seconds} s',

  /** Screen-reader summary once my points are shown. */
  announce: {
    /** {points} = round points, {correct} of {n} blocks right, {pairs} = announce.pairs. */
    result: {
      one: '{points} point : {correct} sur {n} à la bonne place, {pairs}.',
      other: '{points} points : {correct} sur {n} à la bonne place, {pairs}.',
    },
    pairs: { one: '{count} paire enchaînée', other: '{count} paires enchaînées' },
    /** Wraps the summary on a perfect round. */
    perfect: 'Séquence parfaite ! {result}',
    /** Wraps the summary when the timer ran out. */
    timedOut: '{result} Temps écoulé.',
  },

  lead: {
    /** Leaderboard title (and screen-reader name of the panel). */
    title: 'Classement',
    /** Small label on the right of the title. */
    after: 'après la manche {round}',
    /** Badge next to my own name (tiny: 2–4 letters). */
    you: 'toi',
    /** Icon label on the best score(s) of the round. */
    top: 'Meilleur score de la manche',
    /** Under the name of a player without a result. */
    spectator: 'En tribune',
    /** Late joiner, seen by the others; {round} = the round they start playing. */
    spectatorFrom: 'En tribune · joue dès la manche {round}',
    noAnswer: 'Aucune réponse',
    /** Round stats under the leaderboard (tiny labels, one line each, three columns). */
    stats: {
      average: 'Moyenne',
      perfect: 'Sans-faute',
      fastest: 'Plus rapide',
    },
    /**
     * Screen-reader label of a leaderboard row. {rank} = the place, already an ordinal (ui.ordinal: "1er"),
     * {name} = player (or lead.row.me for me), {total} = overall points.
     */
    row: {
      /** {points} this round, {correct} of {n} blocks in the right place. */
      played: {
        one: '{rank}, {name} : {points} point sur cette manche, {correct} sur {n} à la bonne place, total {total}',
        other: '{rank}, {name} : {points} points sur cette manche, {correct} sur {n} à la bonne place, total {total}',
      },
      spectator: '{rank}, {name} : en tribune, total {total}',
      noAnswer: '{rank}, {name} : aucune réponse, total {total}',
      /** My own name in the row label. */
      me: '{name} (toi)',
    },
  },

  footer: {
    /** Host's button: next round, or the final standings after the last round. */
    next: 'Manche suivante',
    final: 'Classement final',
    /** Auto-advance countdown beside the host's button; <num> wraps the seconds. */
    nextIn: { one: 'Manche suivante dans <num>{count}</num> s', other: 'Manche suivante dans <num>{count}</num> s' },
    finalIn: { one: 'Classement final dans <num>{count}</num> s', other: 'Classement final dans <num>{count}</num> s' },
    /** Guests, while the host decides. */
    waiting: 'En attente de l’hôte…',
    /** Guests, with the auto-advance countdown; <num> is the dimmed seconds. */
    waitingIn: { one: 'En attente de l’hôte…<num>({count} s)</num>', other: 'En attente de l’hôte…<num>({count} s)</num>' },
  },
} satisfies Catalog['reveal']
