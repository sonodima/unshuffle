// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Keyboard key names, as printed on French (AZERTY) key caps. */
  keys: {
    space: 'Espace',
    enter: 'Entrée',
    /** The Control key (Apple keyboards show ⌘ instead). */
    ctrl: 'Ctrl',
  },
  /** Retry button (short: sits next to an error). */
  retry: 'Réessayer',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: 'Manche <b>{number}</b><dim> / {total}</dim>',
    /** Big headline (the host's own step messages come from game.prep). */
    allReady: 'Au complet, c’est parti !',
    waiting: 'On attend tout le monde…',
    fallback: 'Préparation de la manche…',
    /** Checklist: three steps, each with an "in progress" and a "done" label. */
    steps: {
      songActive: 'Choix de la chanson…',
      songDone: 'Chanson choisie',
      /** Under "Chanson choisie": the title stays hidden until the reveal. */
      songDetail: 'Top secret jusqu’à la fin',
      downloadActive: 'Téléchargement des extraits…',
      downloadDone: 'Extraits téléchargés',
      downloadError: 'Échec du téléchargement',
      /** Under "Échec du téléchargement". */
      downloadErrorDetail: 'On peut jouer sans le son',
      sliceActive: 'Découpage du morceau…',
      sliceDone: 'Morceau découpé',
      /** Under "Morceau découpé": the song is cut on the beat. One line, ~35 chars. */
      sliceDetail: { one: '{count} extrait calé sur le tempo', other: '{count} extraits calés sur le tempo' },
    },
    /** Small uppercase label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: 'Prêts <b>{ready}</b><dim>/{total}</dim>',
    /** Screen-reader label of the avatar row. */
    readyPlayers: 'Joueurs prêts',
  },

  /** Rotating tips on the preparing screen (one at a time, ~2 lines on phones). */
  tips: {
    title: 'Le savais-tu ?',
    howToHover: 'Clique sur un bloc pour l’écouter, fais-le glisser pour le déplacer.',
    howToTouch: 'Touche un bloc pour l’écouter, fais-le glisser pour le déplacer.',
    /** « Tout écouter » is the play-all button of the board. */
    playAll: '« Tout écouter » joue les blocs dans l’ordre actuel : si tout s’enchaîne bien, tu y es presque.',
    hold: 'Un appui long sur un bloc lance la lecture à partir de là.',
    pairs: 'Deux blocs voisins dans le bon ordre rapportent des points, même s’ils ne sont pas à leur place.',
    firstConfirm: 'La première validation lance le chrono final pour tout le monde.',
    edges: 'Repère le début de la chanson et le fondu de fin : ce sont les premiers et les derniers blocs.',
    /** {points} = the maximum score of a round (5 000, formatted). */
    perfect: 'Ordre parfait = {points} points. Zéro pression.',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: 'Dernière manche',
    /** Screen-reader text of the headline. */
    headlineLabel: 'Manche {number} sur {total}',
    /**
     * Huge one-line headline: <word> white text, <n> the round number (lime),
     * <total> "/total" (small, grey). Keep the three tags; spaces between tags don't show.
     */
    headline: '<word>Manche</word> <n>{number}</n><total>/{total}</total>',
    /** Screen-reader label of the round facts list. */
    rulesLabel: 'Règles de la manche',
    /** Fact pills. <b> = the number (white). */
    snippets: { one: '<b>{count}</b> extrait', other: '<b>{count}</b> extraits' },
    /** Round duration; "s" = seconds. */
    seconds: '<b>{seconds}</b> s',
    spectator: 'Cette manche, tu la regardes : tu joueras dès la prochaine.',
    howToHover: 'Clique sur un bloc pour l’écouter, puis glisse-le à sa place.',
    howToTouch: 'Touche un bloc pour l’écouter, puis glisse-le à sa place.',
    /** Shown inside the countdown ring before "3" (small, uppercase). */
    ready: 'Prêts ?',
    /** Screen-reader text of the countdown ring: before the count / while counting ({seconds} = 3, 2, 1). */
    readyLabel: 'Prêts',
    countdownLabel: 'Départ dans {seconds}',
  },

  /** Full-screen slam when the round starts. Very short (1 word, huge type: ~4 characters fit a phone). */
  go: 'Go !',
  /** Shown while the board data for the round arrives. */
  syncing: 'Synchronisation de la manche…',

  /** Top bar while playing. Labels are tiny uppercase eyebrows: keep them short. */
  hud: {
    round: 'Manche',
    snippets: 'Extraits',
    points: 'Points',
    /** Caption inside the timer ring (1 short word): normal / after the first confirm. */
    time: 'Temps',
    finalTime: 'Final',
    /** Badge under the ring after the first confirm. */
    lastSeconds: 'Dernières secondes',
    /** Eyebrow over the avatars: {done} players out of {total} confirmed. */
    confirmed: 'Validations {done}/{total}',
    /** Standing under the score. {rank} = the place, already an ordinal (ui.ordinal: "1er"). */
    rank: '{rank} au classement',
    /** Screen-reader label of the avatar row. */
    players: 'Joueurs de la manche',
  },

  /** Avatar rows. */
  players: {
    /** The viewer's own avatar (screen readers / tooltip). */
    me: '{name} (toi)',
    /** Chip after the last shown avatar ("+3"), for screen readers. */
    more: { one: 'et un autre', other: 'et {count} autres' },
  },

  /** "Giulia a validé !" — the final-countdown banner in the HUD. */
  banner: {
    /** Player without a name. */
    someone: 'Quelqu’un',
    mine: 'Tu as validé en premier !',
    /** <name> is the player's name: on phones only the name is shortened (one line). */
    confirmedBy: '<name>{name}</name> a validé !',
    /** Line under the title; <n> is the live seconds count (animated). "s" = seconds. */
    othersLeft: 'Il reste <n>{seconds}</n> s aux autres',
    youLeft: { one: 'Plus que <n>{count}</n> seconde', other: 'Plus que <n>{count}</n> secondes' },
    /** For players who can't act any more (already confirmed, spectators). */
    finalTimer: 'Chrono final : <n>{seconds}</n> s',
  },

  /** Bottom dock: play-all transport + VALIDER / status. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: 'Valider',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: 'Tu n’as rien déplacé',
    armTap: 'Touche encore pour valider',
    armClick: 'Clique encore pour valider',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: 'Appuie encore sur {mod} + {enter}',
    confirmed: 'Validé',
    /** Confirmed while offline: it is sent on reconnect. */
    queued: 'Envoi dès ton retour en ligne',
    /** {names} = one or two player names ("Giulia", "Giulia et Marco"). */
    waitingFor: 'En attente de {names}',
    waitingForCount: { one: 'En attente de {count} joueur', other: 'En attente de {count} joueurs' },
    allConfirmed: 'Tout le monde a validé !',
    /** Screen-reader label of the avatars of those still playing. */
    stillPlaying: 'Encore en jeu',
    timeUp: 'Temps écoulé !',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: 'C’est ton dernier ordre qui compte',
    computing: 'Calcul des résultats…',
    spectator: 'En tribune',
    spectatorBody: 'Tu joueras dès la prochaine manche',
    audioFailed: 'Audio indisponible',
    audioFailedBody: 'Réessaie ou joue quand même',
    /** Icon button (phones): screen readers / tooltip. */
    retryAudio: 'Recharger l’audio',
    /**
     * Keyboard legend under the dock (desktop). <kbd> = a key cap. {space} / {enter} /
     * {mod} (⌘ or Ctrl) are key names. <action> = the action label after a combination.
     */
    hints: {
      playAll: '<kbd>{space}</kbd> tout écouter',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>valider</action>',
      pointer: 'Clique sur un bloc pour l’écouter · maintiens-le pour écouter la suite · fais-le glisser pour le déplacer',
      /** Same, after confirming (blocks can't move any more). */
      pointerLocked: 'Clique sur un bloc pour l’écouter · maintiens-le pour écouter la suite',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: 'Tu es en tribune',
    bodyHover: 'Tu joueras dès la prochaine manche. En attendant, clique sur les blocs pour écouter les extraits.',
    bodyTouch: 'Tu joueras dès la prochaine manche. En attendant, touche les blocs pour écouter les extraits.',
  },

  /** In-game exit menu (sheet). */
  menu: {
    /** Round button that opens it (screen readers / tooltip). */
    endButton: 'Terminer la partie',
    leaveButton: 'Quitter la partie',
    hostTitle: 'Terminer la partie ?',
    guestTitle: 'Quitter la partie ?',
    hostBody: 'Tu es l’hôte : la partie s’arrête pour tout le monde.',
    /** Host alone in the room. */
    hostAloneBody: 'La partie s’arrête ici.',
    guestBody: 'La partie continue sans toi. Tant qu’elle est en cours, tu peux revenir et retrouver ton score.',
    keepPlaying: 'Continuer à jouer',
    stay: 'Rester',
    /** Guest's red confirm button in the sheet (the round button above only opens it). */
    leave: 'Quitter la partie',
    toLobby: 'Retour au salon',
    toLobbyBody: 'Scores remis à zéro, mêmes joueurs : changez de playlist et c’est reparti.',
    toLobbyAloneBody: 'Score remis à zéro : change de playlist et c’est reparti.',
    close: 'Fermer le salon',
    /** Closing the room disconnects the one other player / all the others (2 or more). */
    closeBodyOne: 'L’autre joueur sera déconnecté.',
    closeBodyMany: 'Tous les autres joueurs seront déconnectés.',
    closeAloneBody: 'Tu retournes à l’accueil.',
    /** Next to the room code (guests). */
    rejoinCode: 'Code pour revenir',
  },
} satisfies Catalog['round']
