// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'Playlist wird gemischt…',
    slicing: 'Der Hit wird zerlegt…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'Warten, bis alle bereit sind…',
  },
  host: {
    noPlaylist: 'Wähl vor dem Start eine Playlist.',
    alreadyStarted: 'Das Spiel läuft schon.',
    closed: 'Der Raum wurde geschlossen.',
    playlistFailed: 'Die Playlist lässt sich nicht von Deezer laden. Prüf deine Verbindung und versuch es nochmal.',
    prepareFailed: 'Die Songs dieser Playlist ließen sich nicht vorbereiten – zurück in die Lobby. Versuch es mit einer anderen Playlist.',
    notEnoughTracks: 'Diese Playlist hat zu wenige Songs mit Hörprobe (mindestens {count} nötig).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Namenlos',
    untitledPlaylist: 'Playlist {id}',
  },
  store: {
    invalidCode: 'Ungültiger Raumcode.',
    cancelled: 'Vorgang abgebrochen.',
    hostLost: 'Verbindung zum Host verloren.',
    hostGone: 'Der Host hat das Spiel verlassen.',
    welcomeTimeout: 'Der Host antwortet nicht. Versuch es gleich nochmal.',
    joinFailed: 'Beitreten fehlgeschlagen. Versuch es nochmal.',
    createFailed: 'Der Raum konnte nicht erstellt werden. Versuch es nochmal.',
    startFailed: 'Das Spiel konnte nicht gestartet werden.',
    rejected: 'Der Host hat die Verbindung abgelehnt.',
    signalingLost: 'Verbindung zum Server verloren: Neue Leute können nicht mehr beitreten.',
    actionFailed: 'Aktion fehlgeschlagen.',
    audioUnavailable: 'Kein Ton für diese Runde – spielen kannst du trotzdem.',
    audioUnavailableTitled: 'Kein Ton für „{title}“.',
  },
  net: {
    network: 'Keine Netzwerkverbindung. Prüf deine Verbindung und versuch es nochmal.',
    server: 'Der Verbindungsserver antwortet nicht. Versuch es in ein paar Sekunden nochmal.',
    signaling: 'Verbindungsserver nicht erreichbar. Versuch es gleich nochmal oder wechsle das Netz (WLAN oder mobile Daten).',
    createTimeout: 'Der Verbindungsserver antwortet nicht. Versuch es in ein paar Sekunden nochmal.',
    joinTimeout: 'Keine Verbindung zum Host. Versuch es nochmal – klappt es nicht, probier ein anderes Netz (WLAN oder mobile Daten).',
    hostNoAnswer: 'Der Host antwortet nicht. Prüf den Code oder versuch es gleich nochmal.',
    roomNotFound: 'Raum nicht gefunden. Prüf den Code.',
    invalidCode: 'Ungültiger Raumcode. Er hat 5 Buchstaben, zum Beispiel KXQPM.',
    unsupported: 'Dieser Browser unterstützt keine Peer-to-Peer-Verbindungen (WebRTC). Probier es mit einem aktuellen Chrome, Safari oder Firefox.',
    loadFailed: 'Das Netzwerkmodul konnte nicht geladen werden. Lade die Seite neu.',
    unknown: 'Unerwarteter Verbindungsfehler. Versuch es nochmal.',
    short: {
      roomNotFound: 'Raum nicht gefunden. Prüf den Code.',
      network: 'Netzwerkproblem. Prüf deine Verbindung und versuch es nochmal.',
      server: 'Verbindungsserver nicht erreichbar. Versuch es gleich nochmal.',
      timeout: 'Keine Antwort vom Verbindungsserver. Versuch es nochmal.',
      unsupported: 'Dein Browser unterstützt keine Peer-to-Peer-Verbindungen (WebRTC).',
    },
  },
  reject: {
    full: 'Der Raum ist voll.',
    version: 'Deine Spielversion passt nicht zu der des Hosts. Lade die Seite neu.',
    kicked: 'Der Host hat dich aus dem Raum entfernt.',
    closed: 'Der Host hat den Raum geschlossen.',
    duplicate: 'Dein Profil ist schon in diesem Raum – in einem anderen Tab oder auf einem anderen Gerät.',
  },
  deezer: {
    timeout: 'Deezer antwortet nicht. Prüf deine Verbindung und versuch es nochmal.',
    network: 'Deezer ist nicht erreichbar. Prüf deine Verbindung (oder deinen Adblocker) und versuch es nochmal.',
    invalid: 'Unerwartete Antwort von Deezer. Versuch es gleich nochmal.',
    quota: 'Zu viele Anfragen an Deezer in kurzer Zeit. Warte ein paar Sekunden und versuch es nochmal.',
    busy: 'Deezer ist gerade überlastet. Versuch es gleich nochmal.',
    notFound: 'Auf Deezer nicht gefunden.',
    forbidden: 'Kein Zugriff: Der Inhalt ist vielleicht privat oder in deinem Land nicht verfügbar.',
    badRequest: 'Ungültige Anfrage an Deezer.',
    api: 'Deezer-Fehler. Versuch es gleich nochmal.',
    playlistNotFound: 'Playlist nicht gefunden: Prüf den Link (private Playlists sind nicht zugänglich).',
    noPreview: 'Für diesen Song gibt es keine Hörprobe.',
    trackNotFound: 'Dieser Song ist auf Deezer nicht mehr verfügbar.',
    featured: 'Die empfohlenen Playlists konnten nicht geladen werden.',
    fallback: {
      playlist: 'Playlist ohne Titel',
      track: 'Ohne Titel',
      artist: 'Unbekannt',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16); lowercased in "(normal)". */
  difficulty: {
    easy: 'Leicht',
    normal: 'Normal',
    hard: 'Schwer',
    insane: 'Extrem',
  },
  cut: {
    beat: 'Skalpell',
    free: 'Hackbeil',
  },
} satisfies Catalog['game']
