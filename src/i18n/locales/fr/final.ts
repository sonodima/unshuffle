// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18 304"); plural forms are
// chosen by the score itself (French "one" also covers 0: "0 point"). Uppercase
// comes from CSS: write normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row. Very short (≈ 4 characters). */
  you: 'Toi',
  /** A late joiner who never played a round (standings row, empty table cell). */
  didNotPlay: 'N’a pas joué',
  /** Round shorthand on covers and table rows ("M3" = manche 3). Keep it 1–2 letters plus the number. */
  roundShort: 'M{round}',
  /** Round count: top bar chip (after the playlist name) and next to the "Manche par manche" title (uppercase). */
  roundCount: { one: '{count} manche', other: '{count} manches' },

  topBar: {
    /** Eyebrow next to the logo (uppercase, small). */
    gameOver: 'Partie terminée',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. Short: big display type. */
    teaser: 'Et la victoire va à',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short (≈ 16 characters). */
  headline: {
    /** Nobody in the standings (should not happen). */
    over: 'Partie terminée !',
    noPlayers: 'Aucun joueur au classement.',
    /** Solo game, zero points. */
    soloZero: 'Zéro pointé !',
    soloZeroSub: 'Réessaie : la prochaine fois, tu remets tout dans l’ordre.',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: 'Du grand art !',
    soloGood: 'Bien joué !',
    soloOk: 'Partie terminée !',
    /** Subtitle "18 304 points en 5 manches" (solo game, or a viewer who didn't play). {rounds} is the phrase headline.rounds. */
    pointsInRounds: { one: '{points} point en {rounds}', other: '{points} points en {rounds}' },
    /** "5 manches" inside headline.pointsInRounds. */
    rounds: { one: '{count} manche', other: '{count} manches' },
    /** Several players, nobody scored. */
    allZero: 'Zéro partout !',
    allZeroSub: 'Pas un seul point cette fois : rejoue et prends ta revanche.',
    /** Shared first place. */
    tie: 'Ex æquo !',
    /** I'm one of the tied winners. {names}: the other winners, already joined ("Giulia et Marco"). */
    tieWithMe: 'Victoire partagée avec {names}',
    /** {names}: all the tied winners, already joined ("Tommy et Giulia"). Always two or more. */
    tieOthers: '{names} gagnent ex æquo',
    /** I won alone. */
    youWin: 'Tu as gagné !',
    /** Subtitle when I won and nobody else is in the standings. */
    youWinPoints: { one: '{points} point', other: '{points} points' },
    /** Subtitle when I won: my total, then my lead {gap} (formatted points) over the runner-up {name}. */
    youWinLead: { one: '{points} point · +{gap} devant {name}', other: '{points} points · +{gap} devant {name}' },
    /** I won with the same points as {name}, thanks to the faster confirmations. */
    youWinFaster: 'Même score que {name}, mais tu as validé plus vite',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name} gagne !',
    /** I have the winner's points but lost on time. */
    sameScore: 'Même score que {name}, qui a validé plus vite',
    /** My place: {rank} (already an ordinal, ui.ordinal: "2e"; always 2nd or lower here) out of {total} players, with my points. */
    myRank: { one: 'Tu finis {rank} sur {total} avec {points} point', other: 'Tu finis {rank} sur {total} avec {points} points' },
  },

  /** Action bar pinned under the podium / at the bottom of the screen. */
  dock: {
    /** Accessible name of the button group. */
    label: 'Actions',
    leave: 'Quitter',
    /** Host: main button, back to the lobby with the same players. Keep it short. */
    playAgain: 'Rejouer',
    /** Guest: nudge the host for a rematch. */
    rematch: 'Revanche !',
    /** Guest: the rematch button right after tapping it (disabled for a few seconds). */
    rematchSent: 'Envoyé !',
    /** Guest: next to an animated equalizer while the host decides. */
    waiting: 'En attente de l’hôte pour rejouer…',
    /** Host: who asked for a rematch. {names}: one or two names, already joined ("Giulia et Marco"); plural by how many. */
    rematchNamed: { one: '{names} veut remettre ça !', other: '{names} veulent remettre ça !' },
    /** Host: three or more players asked for a rematch. */
    rematchMany: { one: '{count} joueur veut remettre ça !', other: '{count} joueurs veulent remettre ça !' },
  },

  /** Host leaving while others are still connected. */
  leaveDialog: {
    title: 'Fermer le salon ?',
    /** {count}: connected players other than the host (1–9). The "one" form is for exactly one. */
    body: {
      one: 'L’autre joueur sera déconnecté et la partie ne pourra pas être rejouée.',
      other: 'Les {count} autres joueurs seront déconnectés et la partie ne pourra pas être rejouée.',
    },
    cancel: 'Annuler',
    confirm: 'Fermer le salon',
  },

  podium: {
    /** Accessible name of the podium list. */
    label: 'Podium',
    /** Screen readers, one podium step. {rank}: the place, already an ordinal (ui.ordinal: "1er"). */
    slot: { one: '{rank} : {name}, {points} point', other: '{rank} : {name}, {points} points' },
    /** Same, for my own step. */
    slotMe: { one: '{rank} : {name} (toi), {points} point', other: '{rank} : {name} (toi), {points} points' },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: 'Acclamer {name}',
  },

  standings: {
    title: 'Classement',
    /** Next to the title (small, uppercase). */
    players: { one: '{count} joueur', other: '{count} joueurs' },
    /** Screen readers, before a row: "Position 2" ({rank} is a plain number). */
    position: 'Position {rank}',
    /** Badge on a disconnected player. Short. */
    offline: 'Hors ligne',
    /** Tooltips / screen-reader labels of the small stats under each name. */
    perfectRounds: 'Manches parfaites',
    accuracy: 'Extraits à la bonne place, en moyenne',
    avgTime: 'Temps moyen de validation',
    /** Late joiner: the first round they played. */
    lateFrom: 'dès la manche {round}',
    /** Unit under each total (tiny, uppercase); plural by the score. */
    points: { one: 'point', other: 'points' },
  },

  /** Award cards. Titles are small display type in a half-width card on phones: keep them short. */
  awards: {
    title: 'Trophées',
    /** Next to the title (small, uppercase). */
    aside: 'Mentions spéciales',
    /** Three or more winners of an award: "Giulia et 2 autres". {count}: how many besides {name}. */
    nameAndOthers: { one: '{name} et un autre', other: '{name} et {count} autres' },
    goldenEar: {
      title: 'Oreille absolue',
      description: 'Le plus de manches parfaites',
      value: { one: '{count} manche parfaite', other: '{count} manches parfaites' },
    },
    lightning: {
      title: 'Éclair',
      description: 'Validation la plus rapide, hors manches à zéro',
      /** {time}: average time, e.g. "38,3 s". */
      value: '{time} en moyenne',
    },
    sniper: {
      title: 'Dans le mille',
      description: 'Le plus d’extraits à la bonne place',
      /** {accuracy}: snippets in place per round ("6,8/8") or a percentage ("85 %"). */
      value: '{accuracy} en moyenne',
    },
    lastSecond: {
      title: 'À la bourre',
      description: 'Le plus de manches finies hors délai',
      value: { one: '{count} fois hors délai', other: '{count} fois hors délai' },
    },
  },

  /** Rounds × players points table. */
  rounds: {
    title: 'Manche par manche',
    /** Accessible name of the table when it scrolls sideways. */
    scrollLabel: 'Points par manche, fais défiler pour voir tous les joueurs',
    /** Table caption (screen readers only). */
    caption: 'Points de chaque joueur à chaque manche',
    /** Header of the song column (small, uppercase). */
    song: 'Titre',
    /** Row title when the song is unknown. */
    fallbackTitle: 'Manche {round}',
    /** Crown icon on the round's best score, and its legend. */
    best: 'Meilleur score de la manche',
    /** Badge in a narrow cell (≈ 70px, tiny uppercase) and legend entry. Short. */
    perfect: 'Parfait',
    /** Clock icon, and its legend. */
    timedOut: 'Temps écoulé',
    /** Footer row label (uppercase). */
    total: 'Total',
  },

  /** Song tiles at the bottom. */
  songs: {
    title: 'Les titres de la partie',
    /** Next to the title (small, uppercase; hidden on phones). */
    aside: 'Réécoute-les ici ou sur Deezer',
    /** Cover button, screen readers. {title} / {artist}: the song; {round}: its round number. */
    play: 'Écouter l’extrait de {title} par {artist}, manche {round}',
    stop: 'Arrêter l’extrait de {title} par {artist}, manche {round}',
    /** Link to the song on Deezer (screen readers). */
    open: 'Ouvrir {title} sur Deezer (nouvel onglet)',
    /** Tooltip of the same link. */
    openTooltip: 'Ouvrir sur Deezer',
    /** Under a song whose preview couldn't be loaded. */
    unavailable: 'Extrait indisponible',
  },

  units: {
    /** Seconds with one decimal ("38,3 s"): {value} is already formatted. Keep the no-break space before the unit. */
    seconds: '{value} s',
  },
} satisfies Catalog['final']
