// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
export default {
  /** Buttons shared by the shell's dialogs and the crash screen. */
  action: {
    home: 'Torna alla home',
    retry: 'Riprova',
    ok: 'Ok',
    cancel: 'Annulla',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE (never translated); {code} a room code. */
  title: {
    lobby: '{brand} · Lobby',
    lobbyRoom: '{brand} · Lobby {code}',
    round: '{brand} · Round',
    /** Round {round} of {rounds}. */
    roundOf: '{brand} · Round {round}/{rounds}',
    roundReveal: '{brand} · Round {round}/{rounds} · Risultati',
    roundPreparing: '{brand} · Round {round}/{rounds} · Preparazione',
    final: '{brand} · Classifica finale',
    /** A player lost the link to the host. */
    lost: '{brand} · Connessione persa',
  },

  /**
   * Floating status pill at the top while the link is down. On phones it sits between
   * the corner buttons (~230px): titles ≤ 24 characters (one line), details ≤ 40 where
   * possible (they wrap to 2 lines at most, then are cut).
   */
  banner: {
    /** aria-label of the pill's close button. */
    dismiss: 'Nascondi avviso',
    /** Seconds since the link dropped, next to the title. */
    elapsed: '{seconds}s',
    /** Host: the signaling server dropped; the game goes on. */
    hostReconnecting: 'Server perso, riprovo…',
    hostReconnectingDetail: 'La partita continua',
    /** Player: first connection attempt still running. */
    connecting: 'Riconnessione…',
    /** Player: link to the host lost, retrying on its own. */
    lost: 'Connessione persa',
    lostDetail: 'Riprovo a collegarmi…',
    /** After ~5 s: the player will be let back in automatically. */
    lostDetailLong: 'Riprovo… rientri da solo.',
    /** After ~30 s of retries. */
    hostSilent: 'L’host non risponde',
    hostSilentDetail: 'Aspetto che torni…',
    /** Small button in the pill after ~30 s: leave the room. */
    leave: 'Esci',
    /** Host only: nobody new can join, the players already in keep playing. */
    signalingTitle: 'Nuovi ingressi in pausa',
    signalingDetail: 'Server di collegamento perso: chi è già dentro continua a giocare.',
    /** Title of any other host-side warning (the detail is the error itself). */
    warning: 'Attenzione',
  },

  /** Room code line in the connection dialogs (small caps label). */
  dialogRoom: 'Stanza <b>{code}</b>',

  /** Blocking dialog: a player lost the host for good. */
  lost: {
    title: 'Connessione persa',
    /** The host left for good, the player was in the lobby. */
    hostClosedTitle: 'L’host ha chiuso la stanza',
    /** The host left for good during or after the game. */
    hostLeftTitle: 'L’host ha lasciato la partita',
    hostGoneDescription: 'La stanza non è più disponibile.',
    /** Hint when the game had already ended (otherwise exit.gone.hint is shown). */
    hostGoneHintFinal: 'La partita era finita: crea una nuova stanza per la rivincita.',
    /** No "Riprova" possible (e.g. on the host's own tab). */
    noRetryDescription: 'La connessione con la stanza si è interrotta.',
    noRetryHint: 'Controlla la connessione, poi riprova dalla home.',
    descriptionLobby: 'L’host non risponde: forse ha chiuso la stanza.',
    description: 'L’host non risponde da un po’.',
    hintLobby: 'Riprova tra un attimo, oppure torna alla home e creane una tua.',
    hintGame: 'Se l’host è ancora in partita, rientrando riprendi da dove eri, con il tuo punteggio.',
    hintFinal: 'Se l’host è ancora collegato, rientrando potrai giocare la rivincita.',
  },

  /** Dialog after being dropped out of a room, by reason. */
  exit: {
    kicked: {
      title: 'Fuori dalla stanza',
      hint: 'Puoi sempre crearne una tua, o entrare con un altro codice.',
    },
    closed: {
      title: 'Stanza chiusa',
      hint: 'La partita è finita per tutti. Crea una nuova stanza o entra con un altro codice.',
    },
    /** The same profile joined from another tab or device. */
    duplicate: {
      title: 'Già in partita',
      hint: 'Chiudi l’altra scheda per giocare da qui.',
    },
    /** The room no longer exists (host left, or a rejoin found nothing). */
    gone: {
      title: 'Stanza non più disponibile',
      description: 'L’host ha chiuso la stanza o ha perso la connessione.',
      hint: 'Crea una nuova stanza dalla home o entra con un altro codice.',
    },
    /** Rejoining failed (network). */
    failed: {
      title: 'Impossibile rientrare',
      hint: 'Controlla la connessione, poi riprova col codice dalla home.',
    },
    /** Any other reason. */
    generic: {
      title: 'Sei fuori dalla stanza',
      hint: 'Puoi rientrare con lo stesso codice dalla home.',
    },
  },

  /** Overlay while a reloaded tab re-enters its room, and the notice if that fails. */
  resume: {
    title: 'Riconnessione',
    host: 'Riapro la tua stanza',
    hostRoom: 'Riapro la tua stanza <b>{code}</b>',
    client: 'Rientro nella stanza',
    clientRoom: 'Rientro nella stanza <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'La stanza <b>{code}</b> non c’è più. {hint}',
    failedRoom:
      'Non sono riuscito a riportarti nella stanza <b>{code}</b>. Se la partita è ancora in corso, rientra col codice dalla home.',
    failed: 'Se la partita è ancora in corso, rientra col codice dalla home.',
  },

  /** Full-screen crash fallback. */
  crash: {
    eyebrow: 'Errore imprevisto',
    title: 'Qualcosa è andato storto',
    body: 'La traccia si è inceppata. Ricarica la pagina: se eri in una stanza provo a riportarti dentro.',
    reload: 'Ricarica',
    showDetails: 'Dettagli tecnici',
    hideDetails: 'Nascondi dettagli',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    /** Stands in for {name} when the player's nickname is unknown. */
    someone: 'Un giocatore',
    joined: '{name} è in stanza',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { one: 'Ora siete in {count}', other: 'Ora siete in {count}' },
    left: '{name} ha lasciato la stanza',
    submitted: '{name} ha confermato',
    /** Under "submitted" for the first one: the short final timer started. */
    lastSeconds: { one: 'Ultimo secondo per tutti!', other: 'Ultimi {count} secondi per tutti!' },
    lastSecondsSoon: 'Ultimi secondi per tutti!',
    kicked: 'L’host ha rimosso {name}',
    kickedSomeone: 'L’host ha rimosso un giocatore',
  },

  /** Toast while the browser keeps audio locked (touch screens say "tap", others "click"). */
  audioCue: {
    tapToListen: 'Tocca per ascoltare la canzone',
    clickToListen: 'Clicca per ascoltare la canzone',
    tapToEnable: 'Tocca per attivare l’audio',
    clickToEnable: 'Clicca per attivare l’audio',
    tapBody: 'Il browser tiene l’audio in pausa finché non tocchi lo schermo.',
    clickBody: 'Il browser tiene l’audio in pausa finché non interagisci con la pagina.',
  },

  /** Sound button and its popover. */
  sound: {
    /** Button label and tooltip. */
    button: 'Audio',
    buttonMuted: 'Audio disattivato',
    buttonLocked: 'Audio bloccato dal browser: tocca per attivarlo',
    /** aria-label of the popover. */
    panel: 'Impostazioni audio',
    /** Popover heading (small caps). */
    heading: 'Audio',
    /** Next to the "M" key badge (the shortcut key itself is always M). */
    muteShortcut: 'Muto',
    mute: 'Disattiva audio',
    unmute: 'Riattiva audio',
    volume: 'Volume',
    sfx: 'Effetti sonori',
    sfxDetail: 'Click, timer, reazioni',
    /** Small pill next to the button while the browser keeps audio locked (one line). */
    unlock: 'Attiva audio',
    unlockTitle: 'Il browser blocca l’audio finché non tocchi la pagina',
  },

  /** Emoji reaction bar and the floating reactions. */
  reactions: {
    /** aria-label of the bar. */
    group: 'Reazioni',
    /** aria-label of each button; {name} is one of the names below. */
    button: 'Reazione: {name}',
    /** Name tag under your own floating reaction. */
    you: 'Tu',
    /** Tooltip and accessible name of each emoji. */
    names: {
      fire: 'Fuoco',
      laugh: 'Risata',
      shock: 'Shock',
      clap: 'Applausi',
      dead: 'Morto dal ridere',
      party: 'Festa',
      mindBlown: 'Mente esplosa',
      cool: 'Troppo forte',
      rematch: 'Rivincita',
    },
  },

  /** Native "leave page?" prompt while hosting a game (most browsers show their own text). */
  leaveWarning: 'Se esci la partita finisce per tutti',
}
