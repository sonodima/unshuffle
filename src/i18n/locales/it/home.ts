// Home screen: hero, profile card, "Crea stanza" / join box, the decorative
// round demo and the "Come si gioca" dialog. Labels marked "uppercase" are
// shown in capitals by CSS: write them in normal case.
export default {
  /** Top-left button that opens the "how to play" dialog. Small pill, keep short. */
  help: 'Come si gioca',
  hero: {
    /** Small line above the logo (uppercase, letter-spaced). Keep it short: ~24 characters. */
    eyebrow: 'Party game musicale',
    /** Under the logo. <b>…</b> is the highlighted second sentence. */
    tagline: 'La hit è stata fatta a pezzi. <b>Rimettila in ordine.</b>',
  },
  /** Screen-reader name of the card with the profile and the create / join buttons. */
  cardLabel: 'Gioca',
  /** Screen-reader name of the desktop panel with the animated demo round. */
  demoLabel: 'Anteprima di un round',
  /** Banner at the top of the card while the device has no network. */
  offline: 'Sei offline: serve una connessione per giocare.',
  /** Screen-reader label of the × that dismisses an error banner. */
  dismissNotice: 'Chiudi avviso',
  /** Divider between the join box and "Crea una stanza" when opened from an invite link (uppercase). */
  or: 'oppure',
  /** Link next to "Apro la stanza…" / "Mi collego alla stanza…" that aborts it. */
  cancel: 'Annulla',
  create: {
    /** Main call to action (big button, uppercase). Keep it short: ~16 characters. */
    button: 'Crea stanza',
    /** Secondary button when the player arrived with an invite link (uppercase). */
    buttonInvited: 'Crea una stanza',
    /** Under the button while the room is being opened. */
    pending: 'Apro la stanza…',
    /** Hint under "Crea stanza". <b>…</b> is the bold lead-in. One line on phones (~50 characters). */
    solo: '<b>Gioca da solo:</b> crea la stanza e avvia subito.',
  },
  join: {
    /** Divider above the 5 code boxes (uppercase). */
    divider: 'Hai un codice?',
    /** Label above the code boxes when opened from an invite link (uppercase). */
    invited: 'Hai un invito!',
    /** Join button (uppercase). */
    button: 'Entra',
    /** Join button once the invite code is complete. {code} = 5-letter room code, e.g. KXQPM (uppercase). */
    buttonCode: 'Entra in {code}',
    /** Under the button while connecting. */
    pending: 'Mi collego alla stanza…',
    /** Error under the code boxes when "Entra" is pressed too early. {count} = code length (5). */
    incomplete: {
      one: 'Inserisci la lettera del codice.',
      other: 'Inserisci tutte e {count} le lettere del codice.',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    /** {count} = maximum number of players (10). */
    players: {
      one: '1 giocatore',
      other: 'Da 1 a {count} giocatori',
    },
    noAccount: 'Nessun account, si gioca nel browser',
    deezer: 'Anteprime musicali da Deezer',
  },
  profile: {
    /** Screen-reader label of the avatar button (opens the avatar / colour picker). */
    changeAvatar: 'Cambia avatar e colore',
    /** Label of the nickname field (uppercase). */
    nameLabel: 'Il tuo nome',
    namePlaceholder: 'Scegli un nome',
    /** Tooltip / label of the dice button that picks a random nickname. */
    randomName: 'Nome a caso',
    /** Title of the avatar / colour picker dialog. */
    lookTitle: 'Il tuo look',
    lookDescription: 'Scegli emoji e colore: gli altri giocatori ti vedranno così.',
    /** Closes the picker. */
    done: 'Fatto',
    /** Small heading over the preview of your avatar and name (uppercase). */
    preview: 'Anteprima',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    /** Tiny badge (uppercase, ~10px). */
    badge: 'Demo',
    /** Caption of each phase of the demo: one line, cut with … beyond ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: 'La hit viene fatta a pezzi…',
      listen: 'Ascolta gli spezzoni',
      sort: 'Trascinali nell’ordine giusto',
      solved: 'Perfetto! Conferma per primo',
    },
    /** Phone caption when the demo is solved (one line). {points} = points won, already formatted (5.000). */
    solvedPoints: 'Perfetto! +{points}',
    /** Screen-reader name of the three step chips under the demo board. */
    stepsLabel: 'Come si gioca, in breve',
    /** Step chips under the desktop demo (one word each, ~12 characters). */
    steps: {
      listen: 'Ascolta',
      sort: 'Riordina',
      confirm: 'Conferma',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: 'Come si gioca',
    description: 'Una hit per round, fatta a pezzi. Vince chi la rimette in ordine meglio e più in fretta.',
    /** Closes the dialog. */
    gotIt: 'Ho capito, si gioca!',
    /** The fake "confirm" button drawn in the third illustration (tiny pill, uppercase): keep it very short. */
    confirmButton: 'Conferma',
    steps: {
      listen: {
        title: 'Ascolta gli spezzoni',
        /** Shown on devices with a mouse. */
        bodyMouse: 'Una hit famosa viene tagliata a tempo di musica e mescolata. Clicca un blocco per ascoltarlo.',
        /** Shown on touch screens. */
        bodyTouch: 'Una hit famosa viene tagliata a tempo di musica e mescolata. Tocca un blocco per ascoltarlo.',
      },
      sort: {
        title: 'Trascinali nell’ordine giusto',
        /** <play></play> is replaced by a small ▶ icon (the "play your order" button). Keep it empty. */
        body: 'Sposta i blocchi finché la canzone non suona come l’originale. Con <play></play> senti il tuo ordine.',
      },
      confirm: {
        title: 'Conferma prima degli altri',
        body: 'Chi conferma per primo fa scattare il conto alla rovescia finale per tutti.',
      },
    },
    /**
     * Scoring rule under the steps. {points} = maximum points per round, already
     * formatted (5.000); <b>…</b> highlights it. Plural chosen by that number.
     */
    scoring: {
      one: 'Fino a <b>{points}</b> punto a round: contano gli spezzoni al posto giusto e le coppie in sequenza. Si gioca anche da soli.',
      other: 'Fino a <b>{points}</b> punti a round: contano gli spezzoni al posto giusto e le coppie in sequenza. Si gioca anche da soli.',
    },
  },
}
