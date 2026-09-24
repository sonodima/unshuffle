// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
export default {
  /** Keyboard key names, as printed on the key caps. */
  keys: {
    space: 'Spazio',
    enter: 'Invio',
    /** The Control key (Apple keyboards show ⌘ instead). */
    ctrl: 'Ctrl',
  },
  /** Retry button (short: sits next to an error). */
  retry: 'Riprova',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: 'Round <b>{number}</b><dim> / {total}</dim>',
    /** Big headline (the host's own step messages come from game.prep). */
    allReady: 'Tutti pronti, si parte!',
    waiting: 'Aspetto che tutti siano pronti…',
    fallback: 'Preparo il round…',
    /** Checklist: three steps, each with an "in progress" and a "done" label. */
    steps: {
      songActive: 'Scelgo la canzone…',
      songDone: 'Canzone scelta',
      /** Under "Canzone scelta": the title stays hidden until the reveal. */
      songDetail: 'Top secret fino alla fine',
      downloadActive: 'Scarico gli spezzoni…',
      downloadDone: 'Spezzoni scaricati',
      downloadError: 'Download fallito',
      /** Under "Download fallito". */
      downloadErrorDetail: 'Si gioca anche senza audio',
      sliceActive: 'Sto affettando la traccia…',
      sliceDone: 'Traccia affettata',
      /** Under "Traccia affettata": the song is cut on the beat. One line, ~35 chars. */
      sliceDetail: { one: '{count} spezzone a tempo di musica', other: '{count} spezzoni a tempo di musica' },
    },
    /** Small uppercase label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: 'Pronti <b>{ready}</b><dim>/{total}</dim>',
    /** Screen-reader label of the avatar row. */
    readyPlayers: 'Giocatori pronti',
  },

  /** Rotating tips on the preparing screen (one at a time, ~2 lines on phones). */
  tips: {
    title: 'Lo sapevi?',
    howToHover: 'Clicca un blocco per ascoltarlo, trascinalo per spostarlo.',
    howToTouch: 'Tocca un blocco per ascoltarlo, trascinalo per spostarlo.',
    /** “Ascolta tutto” is the play-all button of the board. */
    playAll: '“Ascolta tutto” suona i blocchi nell’ordine attuale: se fila liscio, ci sei quasi.',
    hold: 'Tieni premuto un blocco per ascoltare la sequenza da lì.',
    pairs: 'Due blocchi vicini nell’ordine giusto valgono punti anche se sono fuori posto.',
    firstConfirm: 'Chi conferma per primo fa partire il timer finale per tutti.',
    edges: 'Cerca l’attacco della canzone e il punto in cui sfuma: sono i primi e gli ultimi blocchi.',
    /** {points} = the maximum score of a round (5000, formatted). */
    perfect: 'Ordine perfetto = {points} punti. Nessuna pressione.',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: 'Ultimo round',
    /** Screen-reader text of the headline. */
    headlineLabel: 'Round {number} di {total}',
    /**
     * Huge one-line headline: <word> white text, <n> the round number (lime),
     * <total> "/total" (small, grey). Keep the three tags; spaces between tags don't show.
     */
    headline: '<word>Round</word> <n>{number}</n><total>/{total}</total>',
    /** Screen-reader label of the round facts list. */
    rulesLabel: 'Regole del round',
    /** Fact pills. <b> = the number (white). */
    snippets: { one: '<b>{count}</b> spezzone', other: '<b>{count}</b> spezzoni' },
    /** Round duration; "s" = seconds. */
    seconds: '<b>{seconds}</b> s',
    spectator: 'Questo round lo guardi: giocherai dal prossimo.',
    howToHover: 'Clicca un blocco per ascoltarlo, poi trascinalo al suo posto.',
    howToTouch: 'Tocca un blocco per ascoltarlo, poi trascinalo al suo posto.',
    /** Shown inside the countdown ring before "3" (small, uppercase). */
    ready: 'Pronti?',
    /** Screen-reader text of the countdown ring: before the count / while counting ({seconds} = 3, 2, 1). */
    readyLabel: 'Pronti',
    countdownLabel: 'Si parte tra {seconds}',
  },

  /** Full-screen slam when the round starts. Very short (1 word, huge type). */
  go: 'Via!',
  /** Shown while the board data for the round arrives. */
  syncing: 'Sincronizzo il round…',

  /** Top bar while playing. Labels are tiny uppercase eyebrows: keep them short. */
  hud: {
    round: 'Round',
    snippets: 'Spezzoni',
    points: 'Punti',
    /** Caption inside the timer ring (1 short word): normal / after the first confirm. */
    time: 'Tempo',
    finalTime: 'Finale',
    /** Badge under the ring after the first confirm. */
    lastSeconds: 'Ultimi secondi',
    /** Eyebrow over the avatars: {done} players out of {total} confirmed. */
    confirmed: 'Confermati {done}/{total}',
    /** Standing under the score. {rank} = the place, already an ordinal (ui.ordinal: "1º"). */
    rank: '{rank} posto',
    /** Screen-reader label of the avatar row. */
    players: 'Giocatori del round',
  },

  /** Avatar rows. */
  players: {
    /** The viewer's own avatar (screen readers / tooltip). */
    me: '{name} (tu)',
    /** Chip after the last shown avatar ("+3"), for screen readers. */
    more: { one: 'e un altro', other: 'e altri {count}' },
  },

  /** "Giulia ha confermato!" — the final-countdown banner in the HUD. */
  banner: {
    /** Player without a name. */
    someone: 'Qualcuno',
    mine: 'Hai confermato per primo!',
    /** <name> is the player's name: on phones only the name is shortened (one line). */
    confirmedBy: '<name>{name}</name> ha confermato!',
    /** Line under the title; <n> is the live seconds count (animated). "s" = seconds. */
    othersLeft: 'Gli altri hanno ancora <n>{seconds}</n> s',
    youLeft: { one: 'Ti resta <n>{count}</n> secondo!', other: 'Ti restano <n>{count}</n> secondi' },
    /** For players who can't act any more (already confirmed, spectators). */
    finalTimer: 'Timer finale: <n>{seconds}</n> s',
  },

  /** Bottom dock: play-all transport + CONFERMA / status. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: 'Conferma',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: 'Non hai spostato nulla',
    armTap: 'Tocca di nuovo per confermare',
    armClick: 'Clicca di nuovo per confermare',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: 'Premi di nuovo {mod} + {enter}',
    confirmed: 'Confermato',
    /** Confirmed while offline: it is sent on reconnect. */
    queued: 'Invio appena torni online',
    /** {names} = one or two player names ("Giulia", "Giulia e Marco"). */
    waitingFor: 'In attesa di {names}',
    waitingForCount: { one: 'In attesa di {count} giocatore', other: 'In attesa di {count} giocatori' },
    allConfirmed: 'Tutti hanno confermato!',
    /** Screen-reader label of the avatars of those still playing. */
    stillPlaying: 'Ancora in gioco',
    timeUp: 'Tempo scaduto!',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: 'Vale l’ordine che hai lasciato',
    computing: 'Calcolo i risultati…',
    spectator: 'Spettatore',
    spectatorBody: 'Giocherai dal prossimo round',
    audioFailed: 'Audio non disponibile',
    audioFailedBody: 'Riprova o gioca lo stesso',
    /** Icon button (phones): screen readers / tooltip. */
    retryAudio: 'Riprova a scaricare l’audio',
    /**
     * Keyboard legend under the dock (desktop). <kbd> = a key cap. {space} / {enter} /
     * {mod} (⌘ or Ctrl) are key names. <action> = the action label after a combination.
     */
    hints: {
      playAll: '<kbd>{space}</kbd> ascolta tutto',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>conferma</action>',
      pointer: 'Clicca un blocco per ascoltarlo · tienilo premuto per ascoltare da lì · trascinalo per spostarlo',
      /** Same, after confirming (blocks can't move any more). */
      pointerLocked: 'Clicca un blocco per ascoltarlo · tienilo premuto per ascoltare da lì',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: 'Stai guardando',
    bodyHover: 'Giocherai dal prossimo round. Intanto clicca i blocchi per ascoltare gli spezzoni.',
    bodyTouch: 'Giocherai dal prossimo round. Intanto tocca i blocchi per ascoltare gli spezzoni.',
  },

  /** In-game exit menu (sheet). */
  menu: {
    /** Round button that opens it (screen readers / tooltip). */
    endButton: 'Termina partita',
    leaveButton: 'Esci dalla partita',
    hostTitle: 'Terminare la partita?',
    guestTitle: 'Uscire dalla partita?',
    hostBody: 'Sei l’host: la partita si ferma per tutti.',
    /** Host alone in the room. */
    hostAloneBody: 'La partita si ferma qui.',
    guestBody: 'La partita continua senza di te. Finché è in corso puoi rientrare e ritrovare il tuo punteggio.',
    keepPlaying: 'Continua a giocare',
    stay: 'Resta',
    /** Guest's red confirm button in the sheet (the round button above only opens it). */
    leave: 'Esci dalla partita',
    toLobby: 'Torna alla lobby',
    toLobbyBody: 'Punteggi azzerati, stessi giocatori: cambiate playlist e ripartite.',
    toLobbyAloneBody: 'Punteggio azzerato: cambia playlist e riparti.',
    close: 'Chiudi la stanza',
    /** Closing the room disconnects the one other player / all the others (2 or more). */
    closeBodyOne: 'L’altro giocatore viene disconnesso.',
    closeBodyMany: 'Tutti gli altri giocatori vengono disconnessi.',
    closeAloneBody: 'Torni alla home.',
    /** Next to the room code (guests). */
    rejoinCode: 'Codice per rientrare',
  },
}
