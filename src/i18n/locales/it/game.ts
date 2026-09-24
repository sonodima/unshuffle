// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'Mescolo la playlist…',
    slicing: 'Faccio a pezzi la hit…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'Aspetto che tutti siano pronti…',
  },
  host: {
    noPlaylist: 'Scegli una playlist prima di iniziare.',
    alreadyStarted: 'La partita è già iniziata.',
    closed: 'La stanza è stata chiusa.',
    playlistFailed: 'Non riesco a caricare la playlist da Deezer. Controlla la connessione e riprova.',
    prepareFailed: 'Non sono riuscito a preparare le canzoni di questa playlist, torniamo alla lobby. Prova con un’altra playlist.',
    notEnoughTracks: 'Questa playlist non ha abbastanza brani con anteprima (servono almeno {count}).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Giocatore',
    /** Name of a playlist whose title is missing. {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: 'Playlist {id}',
  },
  store: {
    invalidCode: 'Codice stanza non valido.',
    cancelled: 'Operazione annullata.',
    hostLost: 'Connessione con l’host persa.',
    hostGone: 'L’host ha lasciato la partita.',
    welcomeTimeout: 'L’host non risponde. Riprova tra poco.',
    joinFailed: 'Impossibile entrare nella stanza. Riprova.',
    createFailed: 'Impossibile creare la stanza. Riprova.',
    startFailed: 'Impossibile avviare la partita.',
    rejected: 'L’host ha rifiutato la connessione.',
    signalingLost: 'Connessione al server persa: i nuovi giocatori non possono entrare.',
    actionFailed: 'Azione non riuscita.',
    audioUnavailable: 'Audio di questo round non disponibile: puoi comunque giocare.',
    audioUnavailableTitled: 'Audio di “{title}” non disponibile.',
  },
  net: {
    network: 'Connessione di rete non disponibile. Controlla la connessione e riprova.',
    server: 'Il server di collegamento non risponde. Riprova tra qualche secondo.',
    signaling: 'Server di collegamento irraggiungibile. Riprova tra poco o cambia rete (Wi‑Fi o dati mobili).',
    createTimeout: 'Il server di collegamento non risponde. Riprova tra qualche secondo.',
    joinTimeout: 'Impossibile collegarsi all’host. Riprova; se non funziona, prova un’altra rete (Wi‑Fi o dati mobili).',
    hostNoAnswer: 'L’host non risponde. Controlla il codice, oppure riprova tra poco.',
    roomNotFound: 'Stanza non trovata. Controlla il codice.',
    invalidCode: 'Codice stanza non valido. Sono 5 lettere, ad esempio KXQPM.',
    unsupported: 'Questo browser non supporta le connessioni peer-to-peer (WebRTC). Prova con Chrome, Safari o Firefox aggiornati.',
    loadFailed: 'Impossibile caricare il modulo di rete. Ricarica la pagina.',
    unknown: 'Errore di connessione imprevisto. Riprova.',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'Stanza non trovata. Controlla il codice.',
      network: 'Problema di rete. Controlla la connessione e riprova.',
      server: 'Server di collegamento non raggiungibile. Riprova tra poco.',
      timeout: 'Nessuna risposta dal server di collegamento. Riprova.',
      unsupported: 'Il tuo browser non supporta le connessioni peer-to-peer (WebRTC).',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'La stanza è piena.',
    version: 'Versione del gioco diversa da quella dell’host. Ricarica la pagina.',
    kicked: 'L’host ti ha rimosso dalla stanza.',
    closed: 'L’host ha chiuso la stanza.',
    duplicate: 'Il tuo profilo è già in questa stanza da un’altra scheda o un altro dispositivo.',
  },
  deezer: {
    timeout: 'Deezer non risponde. Controlla la connessione e riprova.',
    network: 'Impossibile contattare Deezer. Controlla la connessione (o eventuali ad blocker) e riprova.',
    invalid: 'Risposta inattesa da Deezer. Riprova tra poco.',
    quota: 'Troppe richieste a Deezer in poco tempo. Aspetta qualche secondo e riprova.',
    busy: 'Deezer è momentaneamente sovraccarico. Riprova tra poco.',
    notFound: 'Contenuto non trovato su Deezer.',
    forbidden: 'Contenuto non accessibile: potrebbe essere privato o non disponibile nel tuo paese.',
    badRequest: 'Richiesta non valida per Deezer.',
    api: 'Errore di Deezer. Riprova tra poco.',
    playlistNotFound: 'Playlist non trovata: controlla il link (le playlist private non sono accessibili).',
    noPreview: 'Anteprima non disponibile per questo brano.',
    trackNotFound: 'Brano non più disponibile su Deezer.',
    featured: 'Impossibile caricare le playlist in evidenza.',
    /**
     * Stand-ins for empty Deezer fields, written into the song / playlist data (in the
     * host's language, like a player's default name) and shown as a title / artist.
     */
    fallback: {
      playlist: 'Playlist senza titolo',
      track: 'Senza titolo',
      artist: 'Artista sconosciuto',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16). */
  difficulty: {
    easy: 'Facile',
    normal: 'Normale',
    hard: 'Difficile',
    insane: 'Folle',
  },
  /** Cut styles (lobby rules, round facts): on the beat / anywhere else, the easier one. Short names. */
  cut: {
    beat: 'Bisturi',
    free: 'Mannaia',
  },
}
