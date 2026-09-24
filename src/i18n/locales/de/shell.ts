// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  action: {
    home: 'Zur Startseite',
    retry: 'Nochmal',
    ok: 'OK',
    cancel: 'Abbrechen',
  },

  title: {
    lobby: '{brand} · Lobby',
    lobbyRoom: '{brand} · Lobby {code}',
    round: '{brand} · Runde',
    roundOf: '{brand} · Runde {round}/{rounds}',
    roundReveal: '{brand} · Runde {round}/{rounds} · Auflösung',
    roundPreparing: '{brand} · Runde {round}/{rounds} · Vorbereitung',
    final: '{brand} · Endstand',
    lost: '{brand} · Verbindung verloren',
  },

  /** Status pill: titles ≤ 24 characters, details ≤ 40 on phones. */
  banner: {
    dismiss: 'Hinweis ausblenden',
    elapsed: '{seconds} s',
    hostReconnecting: 'Server weg, verbinde…',
    hostReconnectingDetail: 'Das Spiel läuft weiter',
    connecting: 'Verbinde neu…',
    lost: 'Verbindung verloren',
    lostDetail: 'Neuer Verbindungsversuch…',
    lostDetailLong: 'Verbinde… du kommst von allein zurück.',
    hostSilent: 'Host antwortet nicht',
    hostSilentDetail: 'Warten auf den Host…',
    leave: 'Raus',
    signalingTitle: 'Neue Beitritte pausiert',
    signalingDetail: 'Server weg – wer drin ist, spielt weiter.',
    warning: 'Achtung',
  },

  dialogRoom: 'Raum <b>{code}</b>',

  lost: {
    title: 'Verbindung verloren',
    hostClosedTitle: 'Der Host hat den Raum geschlossen',
    hostLeftTitle: 'Der Host hat das Spiel verlassen',
    hostGoneDescription: 'Den Raum gibt es nicht mehr.',
    hostGoneHintFinal: 'Das Spiel war schon vorbei: Erstell einen neuen Raum für die Revanche.',
    noRetryDescription: 'Die Verbindung zum Raum ist abgebrochen.',
    noRetryHint: 'Prüf deine Verbindung und versuch es dann auf der Startseite nochmal.',
    descriptionLobby: 'Der Host antwortet nicht – vielleicht wurde der Raum geschlossen.',
    description: 'Der Host antwortet schon eine Weile nicht.',
    hintLobby: 'Versuch es gleich nochmal oder geh zur Startseite und erstell deinen eigenen Raum.',
    hintGame: 'Ist der Host noch im Spiel, steigst du wieder ein und machst mit deinem Punktestand weiter.',
    hintFinal: 'Ist der Host noch da, kannst du nach dem Wiedereinstieg bei der Revanche mitspielen.',
  },

  exit: {
    kicked: {
      title: 'Aus dem Raum entfernt',
      hint: 'Du kannst jederzeit einen eigenen Raum erstellen oder mit einem anderen Code beitreten.',
    },
    closed: {
      title: 'Raum geschlossen',
      hint: 'Das Spiel ist für alle vorbei. Erstell einen neuen Raum oder tritt mit einem anderen Code bei.',
    },
    duplicate: {
      title: 'Schon im Spiel',
      hint: 'Schließ den anderen Tab, um hier zu spielen.',
    },
    gone: {
      title: 'Raum nicht mehr verfügbar',
      description: 'Der Host hat den Raum geschlossen oder die Verbindung verloren.',
      hint: 'Erstell auf der Startseite einen neuen Raum oder tritt mit einem anderen Code bei.',
    },
    failed: {
      title: 'Wiedereinstieg fehlgeschlagen',
      hint: 'Prüf deine Verbindung und versuch es dann auf der Startseite mit dem Code nochmal.',
    },
    generic: {
      title: 'Du bist nicht mehr im Raum',
      hint: 'Auf der Startseite kommst du mit demselben Code wieder rein.',
    },
  },

  resume: {
    title: 'Verbinde neu',
    host: 'Dein Raum wird wieder geöffnet',
    hostRoom: 'Dein Raum <b>{code}</b> wird wieder geöffnet',
    client: 'Wiedereinstieg in den Raum',
    clientRoom: 'Wiedereinstieg in Raum <b>{code}</b>',
    goneRoom: 'Den Raum <b>{code}</b> gibt es nicht mehr. {hint}',
    failedRoom:
      'Wir konnten dich nicht zurück in den Raum <b>{code}</b> bringen. Läuft das Spiel noch, tritt auf der Startseite mit dem Code wieder bei.',
    failed: 'Läuft das Spiel noch, tritt auf der Startseite mit dem Code wieder bei.',
  },

  crash: {
    eyebrow: 'Unerwarteter Fehler',
    title: 'Da ist was schiefgelaufen',
    body: 'Die Platte hat einen Sprung. Lade die Seite neu – warst du in einem Raum, bringen wir dich wieder rein.',
    reload: 'Neu laden',
    showDetails: 'Technische Details',
    hideDetails: 'Details ausblenden',
  },

  toast: {
    someone: 'Jemand',
    joined: '{name} ist dabei',
    roomCount: { one: 'Jetzt seid ihr zu {count}', other: 'Jetzt seid ihr zu {count}' },
    left: '{name} hat den Raum verlassen',
    submitted: '{name} hat bestätigt',
    lastSeconds: { one: 'Letzte Sekunde für alle!', other: 'Letzte {count} Sekunden für alle!' },
    lastSecondsSoon: 'Letzte Sekunden für alle!',
    kicked: 'Der Host hat {name} entfernt',
    kickedSomeone: 'Der Host hat jemanden entfernt',
  },

  audioCue: {
    tapToListen: 'Tippen, um den Song zu hören',
    clickToListen: 'Klicken, um den Song zu hören',
    tapToEnable: 'Tippen, um den Ton einzuschalten',
    clickToEnable: 'Klicken, um den Ton einzuschalten',
    tapBody: 'Der Browser hält den Ton an, bis du den Bildschirm berührst.',
    clickBody: 'Der Browser hält den Ton an, bis du mit der Seite interagierst.',
  },

  sound: {
    button: 'Ton',
    buttonMuted: 'Ton aus',
    buttonLocked: 'Ton vom Browser blockiert: tippen zum Einschalten',
    panel: 'Toneinstellungen',
    heading: 'Ton',
    muteShortcut: 'Stumm',
    mute: 'Stummschalten',
    unmute: 'Ton wieder an',
    volume: 'Lautstärke',
    sfx: 'Soundeffekte',
    sfxDetail: 'Klicks, Timer, Reaktionen',
    unlock: 'Ton an',
    unlockTitle: 'Der Browser blockiert den Ton, bis du die Seite antippst',
  },

  reactions: {
    group: 'Reaktionen',
    button: 'Reaktion: {name}',
    you: 'Du',
    names: {
      fire: 'Feuer',
      laugh: 'Lachen',
      shock: 'Schock',
      clap: 'Applaus',
      dead: 'Totgelacht',
      party: 'Party',
      mindBlown: 'Kopf explodiert',
      cool: 'Echt stark',
      rematch: 'Revanche',
    },
  },

  leaveWarning: 'Wenn du gehst, ist das Spiel für alle vorbei',
} satisfies Catalog['shell']
