// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game. {points} is already formatted
// ("18.304"); plural forms follow the score. Uppercase comes from CSS.
import type { Catalog } from '../../catalog'

export default {
  you: 'Du',
  didNotPlay: 'Nicht gespielt',
  roundShort: 'R{round}',
  roundCount: { one: '{count} Runde', other: '{count} Runden' },

  topBar: {
    gameOver: 'Spiel vorbei',
  },

  hero: {
    /** Three animated dots follow: "Und gewonnen hat…". */
    teaser: 'Und gewonnen hat',
  },

  headline: {
    over: 'Spiel vorbei!',
    noPlayers: 'Niemand in der Rangliste.',
    soloZero: 'Null Punkte!',
    soloZeroSub: 'Nicht aufgeben: Den nächsten Hit bringst du in Ordnung.',
    soloGreat: 'Meisterhaft!',
    soloGood: 'Stark gespielt!',
    soloOk: 'Spiel vorbei!',
    pointsInRounds: { one: '{points} Punkt in {rounds}', other: '{points} Punkte in {rounds}' },
    /** Dative after "in": "in 5 Runden". */
    rounds: { one: '{count} Runde', other: '{count} Runden' },
    allZero: 'Alle bei null!',
    allZeroSub: 'Diesmal kein einziger Punkt – ab in die Revanche!',
    tie: 'Gleichstand!',
    tieWithMe: 'Du gewinnst zusammen mit {names}',
    tieOthers: '{names} gewinnen gemeinsam',
    youWin: 'Du gewinnst!',
    youWinPoints: { one: '{points} Punkt', other: '{points} Punkte' },
    youWinLead: { one: '{points} Punkt · +{gap} vor {name}', other: '{points} Punkte · +{gap} vor {name}' },
    youWinFaster: 'Punktgleich mit {name}, aber schneller',
    theyWin: '{name} gewinnt!',
    sameScore: 'Punktgleich mit {name}: Wer schneller bestätigt hat, gewinnt',
    myRank: {
      one: 'Du landest auf dem {rank} Platz von {total} – mit {points} Punkt',
      other: 'Du landest auf dem {rank} Platz von {total} – mit {points} Punkten',
    },
  },

  dock: {
    label: 'Aktionen',
    /** Short: shares the dock with the big replay / rematch button on phones. */
    leave: 'Raus',
    playAgain: 'Nochmal!',
    rematch: 'Revanche!',
    rematchSent: 'Anfrage gesendet',
    waiting: 'Warten, bis der Host eine Revanche startet…',
    rematchNamed: { one: '{names} will eine Revanche!', other: '{names} wollen eine Revanche!' },
    rematchMany: { one: '{count} Person will eine Revanche!', other: '{count} Leute wollen eine Revanche!' },
  },

  leaveDialog: {
    title: 'Raum schließen?',
    body: {
      one: 'Die andere Person wird getrennt, und eine Revanche ist dann nicht mehr möglich.',
      other: 'Die anderen {count} werden getrennt, und eine Revanche ist dann nicht mehr möglich.',
    },
    cancel: 'Abbrechen',
    confirm: 'Raum schließen',
  },

  podium: {
    label: 'Siegertreppchen',
    slot: { one: '{rank} Platz: {name}, {points} Punkt', other: '{rank} Platz: {name}, {points} Punkte' },
    slotMe: { one: '{rank} Platz: {name} (du), {points} Punkt', other: '{rank} Platz: {name} (du), {points} Punkte' },
    cheer: '{name} feiern',
  },

  standings: {
    title: 'Rangliste',
    players: { one: '{count} Person', other: '{count} Personen' },
    /** {rank} is a plain number here: "Platz 2". */
    position: 'Platz {rank}',
    offline: 'Offline',
    perfectRounds: 'Perfekte Runden',
    accuracy: 'Schnipsel an der richtigen Stelle, im Schnitt',
    avgTime: 'Durchschnittliche Zeit bis zur Bestätigung',
    lateFrom: 'ab Runde {round}',
    points: { one: 'Punkt', other: 'Punkte' },
  },

  awards: {
    title: 'Pokale',
    aside: 'Sonderwertung',
    nameAndOthers: { one: '{name} und noch jemand', other: '{name} und {count} weitere' },
    goldenEar: {
      title: 'Goldenes Ohr',
      description: 'Meiste perfekte Runden',
      value: { one: '{count} perfekte Runde', other: '{count} perfekte Runden' },
    },
    lightning: {
      title: 'Blitz',
      description: 'Schnellste Bestätigung mit Punkten',
      value: 'im Schnitt {time}',
    },
    sniper: {
      title: 'Volltreffer',
      description: 'Meiste Schnipsel richtig platziert',
      value: 'im Schnitt {accuracy}',
    },
    /** Most rounds that ran out of time: the slow-motion counterpart of "Blitz". */
    lastSecond: {
      title: 'Zeitlupe',
      description: 'Am häufigsten zu spät',
      value: { one: 'Einmal zu spät', other: '{count}-mal zu spät' },
    },
  },

  rounds: {
    title: 'Runde für Runde',
    scrollLabel: 'Punkte pro Runde – seitlich scrollen, um alle zu sehen',
    caption: 'Punkte aller Mitspielenden in jeder Runde',
    song: 'Song',
    fallbackTitle: 'Runde {round}',
    best: 'Top der Runde',
    perfect: 'Perfekt',
    timedOut: 'Zeit abgelaufen',
    total: 'Gesamt',
  },

  songs: {
    title: 'Diese Songs liefen',
    aside: 'Hier oder auf Deezer nachhören',
    play: 'Hörprobe abspielen: {title} von {artist}, Runde {round}',
    stop: 'Hörprobe stoppen: {title} von {artist}, Runde {round}',
    open: '{title} auf Deezer öffnen (neuer Tab)',
    openTooltip: 'Auf Deezer öffnen',
    unavailable: 'Keine Hörprobe verfügbar',
  },

  units: {
    seconds: '{value} s',
  },
} satisfies Catalog['final']
