// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Key names as printed on German keyboards. */
  keys: {
    space: 'Leertaste',
    enter: 'Enter',
    ctrl: 'Strg',
  },
  retry: 'Nochmal',

  preparing: {
    header: 'Runde <b>{number}</b><dim> / {total}</dim>',
    allReady: 'Alle bereit, los geht’s!',
    waiting: 'Warten, bis alle bereit sind…',
    fallback: 'Runde wird vorbereitet…',
    steps: {
      songActive: 'Song wird ausgewählt…',
      songDone: 'Song ausgewählt',
      songDetail: 'Streng geheim bis zur Auflösung',
      downloadActive: 'Schnipsel werden geladen…',
      downloadDone: 'Schnipsel geladen',
      downloadError: 'Download fehlgeschlagen',
      downloadErrorDetail: 'Spielen geht auch ohne Ton',
      sliceActive: 'Song wird zerschnipselt…',
      sliceDone: 'Song zerschnipselt',
      sliceDetail: { one: '{count} Schnipsel im Takt der Musik', other: '{count} Schnipsel im Takt der Musik' },
    },
    ready: 'Bereit <b>{ready}</b><dim>/{total}</dim>',
    readyPlayers: 'Schon bereit',
  },

  tips: {
    title: 'Schon gewusst?',
    howToHover: 'Klicken spielt einen Block ab, Ziehen verschiebt ihn.',
    howToTouch: 'Antippen spielt einen Block ab, Ziehen verschiebt ihn.',
    playAll: '„Alles anhören“ spielt die Blöcke in deiner aktuellen Reihenfolge: Klingt es rund, bist du fast am Ziel.',
    hold: 'Halte einen Block gedrückt, um die Folge ab dort zu hören.',
    pairs: 'Zwei Blöcke in richtiger Folge nebeneinander bringen Punkte – auch an der falschen Stelle.',
    firstConfirm: 'Wer zuerst bestätigt, startet den Endspurt für alle.',
    edges: 'Achte auf den Einstieg und das Ausklingen des Songs: Das sind die ersten und die letzten Blöcke.',
    perfect: 'Perfekte Reihenfolge = {points} Punkte. Nur kein Druck.',
  },

  intro: {
    lastRound: 'Letzte Runde',
    headlineLabel: 'Runde {number} von {total}',
    headline: '<word>Runde</word> <n>{number}</n><total>/{total}</total>',
    rulesLabel: 'Regeln der Runde',
    snippets: { one: '<b>{count}</b> Schnipsel', other: '<b>{count}</b> Schnipsel' },
    seconds: '<b>{seconds}</b> s',
    spectator: 'In dieser Runde schaust du zu – ab der nächsten spielst du mit.',
    howToHover: 'Klick auf einen Block, um ihn zu hören – dann zieh ihn an seinen Platz.',
    howToTouch: 'Tipp auf einen Block, um ihn zu hören – dann zieh ihn an seinen Platz.',
    ready: 'Bereit?',
    readyLabel: 'Bereit',
    countdownLabel: 'Los geht’s in {seconds}',
  },

  go: 'Los!',
  syncing: 'Runde wird synchronisiert…',

  hud: {
    round: 'Runde',
    snippets: 'Schnipsel',
    points: 'Punkte',
    time: 'Zeit',
    finalTime: 'Endspurt',
    lastSeconds: 'Letzte Sekunden',
    confirmed: 'Bestätigt {done}/{total}',
    rank: '{rank} Platz',
    players: 'Mitspielende dieser Runde',
  },

  players: {
    me: '{name} (du)',
    more: { one: 'und noch jemand', other: 'und {count} weitere' },
  },

  banner: {
    someone: 'Jemand',
    mine: 'Du warst am schnellsten!',
    confirmedBy: '<name>{name}</name> hat bestätigt!',
    othersLeft: 'Die anderen haben noch <n>{seconds}</n> s',
    youLeft: { one: 'Dir bleibt <n>{count}</n> Sekunde', other: 'Dir bleiben <n>{count}</n> Sekunden' },
    finalTimer: 'Endspurt: <n>{seconds}</n> s',
  },

  dock: {
    confirm: 'Bestätigen',
    unchanged: 'Du hast nichts verschoben',
    armTap: 'Zum Bestätigen nochmal tippen',
    armClick: 'Zum Bestätigen nochmal klicken',
    armKey: 'Nochmal {mod} + {enter} drücken',
    confirmed: 'Bestätigt',
    queued: 'Wird gesendet, wenn du online bist',
    waitingFor: 'Warten auf {names}',
    waitingForCount: { one: 'Warten auf {count} Person', other: 'Warten auf {count} Personen' },
    allConfirmed: 'Alle haben bestätigt!',
    stillPlaying: 'Noch am Spielen',
    timeUp: 'Zeit abgelaufen!',
    timedOut: 'Deine letzte Reihenfolge zählt',
    computing: 'Punkte werden berechnet…',
    spectator: 'Du schaust zu',
    spectatorBody: 'Ab nächster Runde dabei',
    audioFailed: 'Kein Ton verfügbar',
    audioFailedBody: 'Nochmal laden oder ohne Ton spielen',
    retryAudio: 'Ton erneut laden',
    hints: {
      playAll: '<kbd>{space}</kbd> alles anhören',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>bestätigen</action>',
      /** Legend style, like the key hints: "gesture: action". */
      pointer: 'Block anklicken: anhören · gedrückt halten: ab dort abspielen · ziehen: verschieben',
      pointerLocked: 'Block anklicken: anhören · gedrückt halten: ab dort abspielen',
    },
  },

  spectator: {
    title: 'Du schaust zu',
    bodyHover: 'Ab der nächsten Runde spielst du mit. Bis dahin: Klick auf die Blöcke und hör in die Schnipsel rein.',
    bodyTouch: 'Ab der nächsten Runde spielst du mit. Bis dahin: Tipp auf die Blöcke und hör in die Schnipsel rein.',
  },

  menu: {
    endButton: 'Spiel beenden',
    leaveButton: 'Spiel verlassen',
    hostTitle: 'Spiel beenden?',
    guestTitle: 'Spiel verlassen?',
    hostBody: 'Du bist Host: Das Spiel endet für alle.',
    hostAloneBody: 'Das Spiel endet hier.',
    guestBody: 'Das Spiel läuft ohne dich weiter. Solange es läuft, kannst du zurückkommen und mit deinem Punktestand weiterspielen.',
    keepPlaying: 'Weiterspielen',
    stay: 'Bleiben',
    leave: 'Spiel verlassen',
    toLobby: 'Zurück in die Lobby',
    toLobbyBody: 'Punkte auf null, alle bleiben dabei: Playlist wechseln und neu starten.',
    toLobbyAloneBody: 'Punkte auf null: Playlist wechseln und neu starten.',
    close: 'Raum schließen',
    closeBodyOne: 'Die andere Person wird getrennt.',
    closeBodyMany: 'Alle anderen werden getrennt.',
    closeAloneBody: 'Du kehrst zur Startseite zurück.',
    rejoinCode: 'Code zum Wiedereinstieg',
  },
} satisfies Catalog['round']
