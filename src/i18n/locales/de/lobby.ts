// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
// <num>…</num> wraps a number shown in monospace digits. Uppercase comes from CSS.
import type { Catalog } from '../../catalog'

export default {
  start: 'Spiel starten',
  players: { one: '<num>{count}</num> Person', other: '<num>{count}</num> Personen' },
  tracks: { one: '<num>{count}</num> Song', other: '<num>{count}</num> Songs' },
  cancel: 'Abbrechen',

  header: {
    badge: 'Lobby',
  },

  leave: {
    closeRoom: 'Raum schließen',
    exit: 'Verlassen',
    exitRoom: 'Raum verlassen',
    hostTitle: 'Raum schließen?',
    guestTitle: 'Raum verlassen?',
    hostBody: 'Du bist Host: Wenn du gehst, wird der Raum geschlossen und alle anderen fliegen raus.',
    hostAloneBody: 'Der Raum wird geschlossen.',
    guestBody: 'Mit dem Code {code} kommst du wieder rein, solange das Spiel noch nicht läuft.',
    stay: 'Bleiben',
  },

  /** Phone tabs (~10 characters each). "Mit dabei" = who's in: the player list. */
  tabs: {
    label: 'Lobby-Bereiche',
    players: 'Mit dabei',
    playlist: 'Playlist',
    rules: 'Regeln',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, noch offen',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { one: '{tab}, {count} Person', other: '{tab}, {count} Personen' },
  },

  invite: {
    linkCopied: 'Raumlink kopiert!',
    copyFailed: 'Kopieren fehlgeschlagen – über den QR-Button siehst du den Link.',
    shareText: 'Fordere mich bei UNSHUFFLE heraus! Komm in Raum {code}:',
  },

  code: {
    title: 'Raumcode',
    clickToCopy: 'Zum Kopieren klicken',
    tapToCopy: 'Zum Kopieren tippen',
    copied: 'Code kopiert!',
    copyFailed: 'Kopieren fehlgeschlagen',
    copyLabel: 'Raumcode {code}. Code kopieren',
    /** Phone row with "Teilen" and the QR button (~10 characters, the icon hides on narrow cards). */
    copyLink: 'Kopieren',
    linkCopied: 'Kopiert!',
    share: 'Teilen',
    showQr: 'QR-Code zeigen',
    enlargeQr: 'QR-Code vergrößern',
    phoneTitle: 'Übers Handy beitreten',
    phoneBody: 'Scanne den QR-Code oder öffne den Link: Du bist sofort drin, ganz ohne Account.',
  },

  qr: {
    title: 'Freunde einladen',
    description: 'Scanne den QR-Code mit der Handykamera oder teile den Link.',
    code: 'Code',
    copy: 'Kopieren',
    copied: 'Kopiert',
    copyFailed: 'Kopieren fehlgeschlagen – markiere den Link und kopiere ihn von Hand.',
    shareLink: 'Link teilen',
    imageLabel: 'QR-Code zum Beitreten',
  },

  roster: {
    title: 'Mit dabei',
    online: { one: '<num>{count}</num> online', other: '<num>{count}</num> online' },
    capacity: { one: '{count} von {max} Plätzen belegt', other: '{count} von {max} Plätzen belegt' },
    listLabel: 'Liste der Mitspielenden',
    you: 'Du',
    host: 'Host',
    reconnecting: 'Verbindet neu…',
    editProfile: 'Profil bearbeiten',
    kickLabel: '{name} entfernen',
    freeSeats: { one: '<num>{count}</num> Platz frei', other: '<num>{count}</num> Plätze frei' },
    invite: 'Einladen',
    kick: {
      title: '{name} entfernen?',
      titleFallback: 'Person entfernen?',
      body: 'Die Person fliegt sofort aus dem Raum und kann nicht wieder beitreten.',
      confirm: 'Entfernen',
    },
  },

  profile: {
    title: 'Dein Profil',
    name: 'Name',
    namePlaceholder: 'Wie heißt du?',
    nameRequired: 'Mindestens ein Zeichen, bitte.',
    save: 'Speichern',
  },

  picker: {
    title: 'Playlist wählen',
    source: 'Songs von Deezer · 30-Sekunden-Hörproben',
    searchLabel: 'Playlists suchen',
    /** Must fit a ~260 px field on phones: ≤ 26 characters. */
    searchPlaceholder: 'Suchen oder Link einfügen',
    searching: 'Suche läuft',
    clear: 'Suche leeren',
    featured: 'Empfohlen',
    fromLink: 'Von deinem Link',
    resultsFor: 'Ergebnisse für „{query}“',
    count: { one: '{count} Playlist', other: '{count} Playlists' },
    loading: 'Wird geladen…',
    invalidLink: 'Ungültiger Link',
    pickedFromLink: 'Playlist per Link gewählt',
    retry: 'Nochmal',
    pick: 'Wählen',
    tracksTooShort: { one: '<num>{count}</num> Song · zu kurz', other: '<num>{count}</num> Songs · zu kurz' },
    tracksBy: { one: '<num>{count}</num> Song · {creator}', other: '<num>{count}</num> Songs · {creator}' },
    chips: 'Kategorien',
    chipsPrev: 'Vorherige Kategorien',
    chipsNext: 'Weitere Kategorien',
    shortLink: {
      title: 'Füge den vollständigen Playlist-Link ein',
      body: 'Kurzlinks (link.deezer.com) lassen sich hier nicht öffnen. Öffne den Link im Browser oder in der Deezer-App und kopiere die vollständige Adresse: deezer.com/…/playlist/123456.',
    },
    foreignLink: {
      title: 'Dieser Link ist keine Playlist',
      body: 'Füge den Link einer öffentlichen Deezer-Playlist ein, etwa deezer.com/de/playlist/123456 – oder suche nach Name, Artist oder Genre.',
    },
    notFound: {
      title: 'Playlist nicht gefunden',
      body: 'Prüf den Link (private Playlists sind nicht zugänglich).',
    },
    offline: 'Deezer antwortet nicht',
    empty: {
      title: 'Keine Playlists',
      titleFor: 'Keine Playlists für „{query}“',
      body: 'Versuch’s mit einem Artist, einem Genre oder einem Jahrzehnt – oder füge den Link einer Deezer-Playlist ein.',
    },
  },

  hero: {
    label: 'Gewählte Playlist',
    eyebrow: 'Playlist',
    none: 'Keine Playlist',
    incoming: 'Playlist kommt gleich',
    by: 'von {creator}',
    hostEmpty: 'Such eine Playlist, tipp auf eine Kategorie oder füge einen Deezer-Link ein.',
    guestEmpty: 'Die Playlist erscheint hier, sobald der Host wählt – Ohren spitzen!',
    change: 'Ändern',
  },

  /** "Endspurt" = the final timer that starts after the first confirmation. */
  rules: {
    title: 'Regeln',
    duration: 'Dauer: max. <num>~{minutes}</num> Min.',
    hostDecides: 'Host bestimmt',
    seconds: '{seconds} s',
    snippetsOption: '{snippets} · {difficulty}',
    rounds: { title: 'Runden', hint: 'Ein Song pro Runde' },
    snippets: { title: 'Schnipsel', hint: 'Mehr Teile, mehr Chaos' },
    roundTime: { title: 'Zeit pro Runde', hint: 'Zum Sortieren' },
    finalTimer: { title: 'Endspurt', hint: 'Sobald jemand bestätigt' },
  },

  howTo: {
    title: 'So geht’s',
    perfect: 'Perfekte Reihenfolge = <num>{points}</num> Punkte',
    listen: {
      title: 'Anhören',
      bodyClick: {
        one: 'Jeder Song wird in {count} Schnipsel zerlegt. Klick auf einen Block, um ihn anzuhören.',
        other: 'Jeder Song wird in {count} gemischte Schnipsel zerlegt. Klick auf einen Block, um ihn anzuhören.',
      },
      bodyTap: {
        one: 'Jeder Song wird in {count} Schnipsel zerlegt. Tipp auf einen Block, um ihn anzuhören.',
        other: 'Jeder Song wird in {count} gemischte Schnipsel zerlegt. Tipp auf einen Block, um ihn anzuhören.',
      },
    },
    reorder: {
      title: 'Sortieren',
      body: 'Schieb die Blöcke hin und her, bis der Song wieder richtig klingt. Mit ▶ hörst du alles am Stück.',
    },
    confirm: {
      title: 'Bestätigen',
      body: {
        one: 'Wer zuerst bestätigt, startet den Endspurt: Allen anderen bleibt dann noch {count} Sekunde.',
        other: 'Wer zuerst bestätigt, startet den Endspurt: Allen anderen bleiben dann noch {count} Sekunden.',
      },
    },
  },

  bar: {
    // Rules summary items, joined with " · ": "5 Runden · 8 Schnipsel (normal) · 90 s".
    rounds: { one: '<num>{count}</num> Runde', other: '<num>{count}</num> Runden' },
    snippets: { one: '<num>{count}</num> Schnipsel', other: '<num>{count}</num> Schnipsel' },
    snippetsLevel: { one: '<num>{count}</num> Schnipsel ({difficulty})', other: '<num>{count}</num> Schnipsel ({difficulty})' },
    roundTime: '<num>{seconds}</num> s',
    waitingStart: 'Warten, bis der Host loslegt',
    waitingPlaylist: 'Der Host wählt die Playlist',
    pickPlaylist: 'Wähl eine Playlist, um zu starten',
    solo: 'Du kannst auch allein spielen',
    noPlaylist: 'Keine Playlist',
    playRounds: { one: '{count} Runde spielen', other: '{count} Runden spielen' },
    shortfall: {
      one: 'Playlist zu kurz: <num>{count}</num> Song, nötig sind <num>{need}</num>.',
      other: 'Playlist zu kurz: <num>{count}</num> Songs, nötig sind <num>{need}</num>.',
    },
    shortfallMin: {
      one: 'Playlist zu kurz: nur <num>{count}</num> Song, nötig sind mindestens <num>{min}</num>.',
      other: 'Playlist zu kurz: nur <num>{count}</num> Songs, nötig sind mindestens <num>{min}</num>.',
    },
  },

  /**
   * Category chips for German speakers (Germany, Austria, Switzerland): charts,
   * decades, German-language genres and a few international ones. Each query was
   * checked on the Deezer playlist search (top results: real playlists, 30+ tracks).
   */
  chips: [
    { label: 'Hits von heute', query: 'hits von heute', emoji: '🔥' },
    { label: '2000er', query: '2000er hits', emoji: '💿' },
    { label: '90er', query: '90er hits', emoji: '📼' },
    { label: '80er', query: '80er hits', emoji: '🕺' },
    { label: '70er', query: '70er hits', emoji: '🪩' },
    { label: 'Deutschrap', query: 'deutschrap', emoji: '🎤' },
    { label: 'Deutschpop', query: 'deutschpop', emoji: '🇩🇪' },
    { label: 'NDW', query: 'neue deutsche welle', emoji: '🎹' },
    { label: 'Schlager', query: 'schlager', emoji: '💖' },
    { label: 'Austropop', query: 'austropop', emoji: '🇦🇹' },
    { label: 'Mundart', query: 'mundart', emoji: '🇨🇭' },
    { label: 'Ballermann', query: 'ballermann', emoji: '🍻' },
    { label: 'Rock-Klassiker', query: 'rock klassiker', emoji: '🎸' },
    { label: 'Dance / EDM', query: 'dance hits', emoji: '🎧' },
    { label: 'Techno', query: 'techno', emoji: '🔊' },
    { label: 'Disney', query: 'disney hits deutschland', emoji: '🏰' },
    { label: 'Filmhits', query: 'film hits', emoji: '🎬' },
  ],

  /**
   * Featured shelf: the Deezer charts of Germany, Austria and Switzerland, the
   * worldwide chart, then big German-language editorial playlists and a couple
   * of international ones. All public, 50+ tracks, previews checked.
   */
  featured: [
    1111143121, // Top Germany — Deezer Charts
    1313615765, // Top Austria — Deezer Charts
    1313617925, // Top Switzerland — Deezer Charts
    3155776842, // Top Worldwide — Deezer Charts
    65490170, // Hits von heute — Deezer Deutschland
    10578289242, // Deutschrap Super Hits — Deezer Deutschland
    11242422704, // Deutschpop Super Hits — Deezer Deutschland
    8699026122, // Schlager Super Hits — Deezer Deutschland
    10328601542, // Endlich wieder Malle — Deezer Deutschland
    3829647662, // 90er Party Hits — Deezer Deutschland
    1306931615, // Rock Essentials — Deezer Rock
    706093725, // Global Dance Hits — Deezer Dance & EDM
  ],
} satisfies Catalog['lobby']
