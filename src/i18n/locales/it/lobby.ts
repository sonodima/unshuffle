// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
export default {
  /** Host's start button (dock / bottom sheet). Short: ~16 characters. */
  start: 'Inizia partita',
  /** Player count in the desktop start dock. */
  players: { one: '<num>{count}</num> giocatore', other: '<num>{count}</num> giocatori' },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: { one: '<num>{count}</num> brano', other: '<num>{count}</num> brani' },
  /** Dismiss button of the lobby dialogs (remove a player, edit your profile). */
  cancel: 'Annulla',

  header: {
    /** Small pill next to the logo. */
    badge: 'Lobby',
  },

  /** Leave / close the room: header button and confirmation dialog. */
  leave: {
    /** Host button (header on desktop, dialog confirm). Short. */
    closeRoom: 'Chiudi stanza',
    /** Guest button (header on desktop, dialog confirm). Short. */
    exit: 'Esci',
    /** Guest back button on phones (screen readers only). */
    exitRoom: 'Esci dalla stanza',
    hostTitle: 'Chiudere la stanza?',
    guestTitle: 'Uscire dalla stanza?',
    /** Host, other players in the room. */
    hostBody: 'Sei l’host: se esci la stanza si chiude e tutti gli altri giocatori verranno disconnessi.',
    /** Host alone in the room. */
    hostAloneBody: 'La stanza verrà chiusa.',
    /** {code}: the 5-letter room code. */
    guestBody: 'Potrai rientrare con il codice {code}, finché la partita non inizia.',
    stay: 'Resta',
  },

  /** Phone tabs. Labels must stay short (~10 characters): three tabs share a 360px bar. */
  tabs: {
    /** Tab bar name (screen readers). */
    label: 'Sezioni della lobby',
    players: 'Giocatori',
    playlist: 'Playlist',
    rules: 'Regole',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, da scegliere',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { one: '{tab}, {count} giocatore', other: '{tab}, {count} giocatori' },
  },

  /** Invite link (the "Invita" button and the free seats). */
  invite: {
    /** Toast. */
    linkCopied: 'Link della stanza copiato!',
    /** Toast. */
    copyFailed: 'Copia non riuscita: usa il pulsante QR per vedere il link.',
    /** Native share sheet text; the join link follows it. {code}: the room code. */
    shareText: 'Sfidami a UNSHUFFLE! Entra nella stanza {code}:',
  },

  /** Room code card. */
  code: {
    title: 'Codice stanza',
    /** Hint next to the title (top right of the card, short). */
    clickToCopy: 'Clicca per copiarlo',
    tapToCopy: 'Tocca per copiarlo',
    copied: 'Codice copiato!',
    copyFailed: 'Copia non riuscita',
    /** Screen readers. {code}: the room code spelled letter by letter ("K X Q P M"). */
    copyLabel: 'Codice stanza {code}. Copia codice',
    /** Button (phones: shares the row with "Condividi" and the QR button). Short. */
    copyLink: 'Copia link',
    /** "Copia link" right after a successful copy. */
    linkCopied: 'Copiato!',
    share: 'Condividi',
    showQr: 'Mostra QR code',
    enlargeQr: 'Ingrandisci QR code',
    /** Desktop card, next to the QR code. */
    phoneTitle: 'Entra dal telefono',
    phoneBody: 'Inquadra il QR o apri il link: si entra al volo, senza account.',
  },

  /** QR code dialog. */
  qr: {
    title: 'Invita gli amici',
    description: 'Inquadra il QR con la fotocamera del telefono, oppure condividi il link.',
    /** Label above the room code. */
    code: 'Codice',
    /** Button next to the link. */
    copy: 'Copia',
    copied: 'Copiato',
    copyFailed: 'Copia non riuscita: seleziona il link e copialo a mano.',
    shareLink: 'Condividi link',
    /** The QR image (screen readers). */
    imageLabel: 'Codice QR per entrare nella stanza',
  },

  /** Player list. */
  roster: {
    title: 'Giocatori',
    /** Shown when someone is reconnecting: how many players are connected. */
    online: { one: '<num>{count}</num> online', other: '<num>{count}</num> online' },
    /** Screen readers, for the "3/10" pill. {max}: room capacity. */
    capacity: { one: '{count} giocatore su {max}', other: '{count} giocatori su {max}' },
    listLabel: 'Elenco giocatori',
    /** Badge on your own row. Very short. */
    you: 'Tu',
    /** Badge on the host's row. Very short. */
    host: 'Host',
    reconnecting: 'Riconnessione…',
    editProfile: 'Modifica profilo',
    /** Kick button (screen readers / tooltip). {name}: player name. */
    kickLabel: 'Rimuovi {name}',
    freeSeats: { one: '<num>{count}</num> posto libero', other: '<num>{count}</num> posti liberi' },
    /** Button next to the free seats. Short. */
    invite: 'Invita',
    /** Kick confirmation dialog. */
    kick: {
      /** {name}: player name. */
      title: 'Rimuovere {name}?',
      titleFallback: 'Rimuovere il giocatore?',
      body: 'Esce subito dalla stanza e non potrà più rientrare.',
      confirm: 'Rimuovi',
    },
  },

  /** Your profile dialog (name + avatar). */
  profile: {
    title: 'Il tuo profilo',
    name: 'Nome',
    namePlaceholder: 'Come ti chiami?',
    nameRequired: 'Scrivi almeno un carattere.',
    save: 'Salva',
  },

  /** Playlist picker (host). */
  picker: {
    title: 'Scegli la playlist',
    /** Next to the title on wide screens. */
    source: 'Brani da Deezer · anteprime di 30 secondi',
    searchLabel: 'Cerca playlist',
    /** Must fit a 300px-wide field on phones (~32 characters). */
    searchPlaceholder: 'Cerca o incolla un link Deezer',
    searching: 'Ricerca in corso',
    clear: 'Svuota ricerca',
    /** Shelf heading while the search box is empty. */
    featured: 'In evidenza',
    /** Heading of a pasted playlist link. */
    fromLink: 'Dal tuo link',
    /** {query}: what the host typed. */
    resultsFor: 'Risultati per “{query}”',
    /** Result count (next to the heading, and for screen readers). */
    count: { one: '{count} playlist', other: '{count} playlist' },
    /** Screen readers. */
    loading: 'Caricamento…',
    /** Screen readers. */
    invalidLink: 'Link non valido',
    pickedFromLink: 'Playlist scelta dal link',
    retry: 'Riprova',
    /** Hover label on a cover. Very short. */
    pick: 'Scegli',
    /** Card subtitle of a playlist shorter than the shortest game. */
    tracksTooShort: { one: '<num>{count}</num> brano · troppo corta', other: '<num>{count}</num> brani · troppo corta' },
    /** Card subtitle. {creator}: Deezer user / curator name. */
    tracksBy: { one: '<num>{count}</num> brano · {creator}', other: '<num>{count}</num> brani · {creator}' },
    /** Category chips row (screen readers). */
    chips: 'Categorie',
    chipsPrev: 'Categorie precedenti',
    chipsNext: 'Altre categorie',
    /** A share short link was pasted (link.deezer.com). */
    shortLink: {
      title: 'Incolla il link completo della playlist',
      body: 'I link brevi (link.deezer.com) non si possono aprire da qui. Aprilo nel browser o nell’app Deezer e copia l’indirizzo completo: deezer.com/…/playlist/123456.',
    },
    /** A link that is not a Deezer playlist was pasted. Adapt the example's country part (/it/) to your language, or drop it. */
    foreignLink: {
      title: 'Questo link non è una playlist',
      body: 'Incolla il link di una playlist pubblica di Deezer, tipo deezer.com/it/playlist/123456 — oppure cerca per nome, artista o genere.',
    },
    /** A pasted playlist link failed. */
    notFound: {
      title: 'Playlist non trovata',
      /** The playlist doesn't exist or is private. */
      body: 'Controlla il link (le playlist private non sono accessibili).',
    },
    /** A search / the shelf failed (the error message follows). */
    offline: 'Deezer non risponde',
    empty: {
      title: 'Nessuna playlist',
      /** {query}: what the host typed. */
      titleFor: 'Nessuna playlist per “{query}”',
      body: 'Prova con un artista, un genere o un decennio, oppure incolla il link di una playlist Deezer.',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: 'Playlist scelta',
    /** Small label above the title (uppercase by CSS). */
    eyebrow: 'Playlist',
    /** The same eyebrow while the host hasn't picked one yet (host's view). */
    none: 'Nessuna playlist',
    incoming: 'Playlist in arrivo',
    /** {creator}: Deezer user / curator name. */
    by: 'di {creator}',
    hostEmpty: 'Cerca una playlist, tocca una categoria o incolla un link Deezer.',
    guestEmpty: 'Apparirà qui appena l’host la sceglie: preparati ad ascoltare.',
    change: 'Cambia',
  },

  /** Game rules panel: four pickers. */
  rules: {
    title: 'Regole',
    /** Host only: upper bound of the game length. {minutes}: a number. */
    duration: 'Durata max <num>~{minutes} min</num>',
    /** Guests: the rules are read-only. Short pill. */
    hostDecides: 'Decide l’host',
    /** Option label in seconds, e.g. "90s". Keep it very short (4 options share a row). */
    seconds: '{seconds}s',
    /** Screen readers, a snippets option: "8 · Normale". */
    snippetsOption: '{snippets} · {difficulty}',
    /** Row titles are also the pickers' names. Hints are one short line (they truncate). */
    rounds: { title: 'Round', hint: 'Una canzone per round' },
    snippets: { title: 'Spezzoni', hint: 'Più pezzi, più difficile' },
    roundTime: { title: 'Tempo per round', hint: 'Per riordinare' },
    finalTimer: { title: 'Timer finale', hint: 'Dopo la prima conferma' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: 'Come si gioca',
    /** {points}: the maximum score of a round (5.000). */
    perfect: 'Ordine perfetto = <num>{points}</num> punti',
    listen: {
      title: 'Ascolta',
      /** Mouse / trackpad. {count}: snippets per song (6–16). */
      bodyClick: {
        one: 'Ogni canzone è tagliata in {count} spezzone. Clicca un blocco per ascoltarlo.',
        other: 'Ogni canzone è tagliata in {count} spezzoni mescolati. Clicca un blocco per ascoltarlo.',
      },
      /** Touch screens. {count}: snippets per song (6–16). */
      bodyTap: {
        one: 'Ogni canzone è tagliata in {count} spezzone. Tocca un blocco per ascoltarlo.',
        other: 'Ogni canzone è tagliata in {count} spezzoni mescolati. Tocca un blocco per ascoltarlo.',
      },
    },
    reorder: {
      title: 'Riordina',
      body: 'Trascina i blocchi finché la canzone torna a suonare giusta. Con ▶ la senti tutta in fila.',
    },
    confirm: {
      title: 'Conferma',
      /** {count}: seconds of the final timer (10–30). */
      body: {
        one: 'Chi conferma per primo fa partire il timer finale: agli altri resta {count} secondo.',
        other: 'Chi conferma per primo fa partire il timer finale: agli altri restano {count} secondi.',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5 round · 8 spezzoni (normale) · 90s".
    rounds: { one: '<num>{count}</num> round', other: '<num>{count}</num> round' },
    snippets: { one: '<num>{count}</num> spezzone', other: '<num>{count}</num> spezzoni' },
    /** Desktop dock. {difficulty}: difficulty name, lowercased ("normale"). */
    snippetsLevel: { one: '<num>{count}</num> spezzone ({difficulty})', other: '<num>{count}</num> spezzoni ({difficulty})' },
    /** Seconds per round, e.g. "90s". */
    roundTime: '<num>{seconds}s</num>',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingStart: 'In attesa che l’host avvii la partita',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingPlaylist: 'L’host sta scegliendo la playlist',
    pickPlaylist: 'Scegli una playlist per iniziare',
    solo: 'Puoi giocare anche da solo',
    /** In place of the playlist title in the dock, before one is picked. */
    noPlaylist: 'Nessuna playlist',
    /** One-tap fix when the playlist is too short for the chosen rounds. Short button. */
    playRounds: { one: 'Gioca {count} round', other: 'Gioca {count} round' },
    /** {count}: tracks the playlist has, {need}: tracks needed (one per round). */
    shortfall: {
      one: 'Playlist troppo corta: ha <num>{count}</num> brano, ne servono <num>{need}</num>.',
      other: 'Playlist troppo corta: ha <num>{count}</num> brani, ne servono <num>{need}</num>.',
    },
    /** Even the shortest game doesn't fit. {count}: tracks the playlist has, {min}: fewest rounds. */
    shortfallMin: {
      one: 'Playlist troppo corta: ha solo <num>{count}</num> brano, ne servono almeno <num>{min}</num>.',
      other: 'Playlist troppo corta: ha solo <num>{count}</num> brani, ne servono almeno <num>{min}</num>.',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Per language: pick genres and searches that make sense there
   * (a query should return relevant, sizeable playlists as its first results).
   */
  chips: [
    { label: 'Hit del momento', query: 'hit del momento', emoji: '🔥' },
    { label: 'Hit 2000', query: '00s hits', emoji: '💿' },
    { label: 'Anni 90', query: '90s hits', emoji: '📼' },
    { label: 'Anni 80', query: '80s hits', emoji: '🕺' },
    { label: 'Anni 70', query: '70s hits', emoji: '🪩' },
    { label: 'Rap italiano', query: 'rap italiano', emoji: '🎤' },
    { label: 'Pop italiano', query: 'pop italiano', emoji: '🇮🇹' },
    { label: 'Cantautori', query: 'cantautori italiani', emoji: '✍️' },
    { label: 'Sanremo', query: 'sanremo', emoji: '🌺' },
    { label: 'Tormentoni', query: 'tormentoni estivi', emoji: '🏖️' },
    { label: 'Rock classics', query: 'rock classics', emoji: '🎸' },
    { label: 'Dance / EDM', query: 'dance hits', emoji: '🎧' },
    { label: 'Indie', query: 'indie italiano', emoji: '🌙' },
    { label: 'Reggaeton', query: 'reggaeton', emoji: '💃' },
    { label: 'Party', query: 'party hits', emoji: '🎉' },
    { label: 'Disney', query: 'disney hits', emoji: '🏰' },
    { label: 'Colonne sonore', query: 'film soundtrack', emoji: '🎬' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order.
   * Per language: the country's tops first, then worldwide ones. Use public,
   * editorial playlists with ≥ 40 tracks (check https://api.deezer.com/playlist/<id>).
   * An empty list falls back to the default shelf (FEATURED_PLAYLIST_IDS).
   */
  featured: [
    1116187241, // Top Italy — Deezer Charts
    3155776842, // Top Worldwide — Deezer Charts
    579513551, // Top Hits Italy (hit del momento) — Filtr Italy
    1363560485, // Deezer Hits
    4403076402, // TikTok Hits World
    248297032, // 00s Hits
    878989033, // 90s Hits
    867825522, // 80s Hits
    8282573142, // 10s Pop
    1470022445, // 70s Hits
    1306931615, // Rock Essentials
    12797956601, // Italo Hits: Best of Italia
    4562471864, // Musica Italiana — Best Of Italo Hits & Classics
    1931998962, // Cantautori Italiani
    822101931, // Pop Italiano
    1303152955, // Rap Italiano Game Over
    1977689462, // 00s Party Hits
    706093725, // Global Dance Hits
    1273315391, // Reggaeton Hits
    7624119742, // Disney Hits Italia
    754776991, // Film Classics
  ],
}
