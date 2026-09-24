// Round reveal ("Auflösung"): the revealed song, my arrangement vs the right
// order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS.
import type { Catalog } from '../../catalog'

export default {
  header: {
    eyebrow: 'Auflösung',
    round: 'Runde {round}<dim> / {total}</dim>',
  },

  song: {
    region: 'Der Song',
    eyebrow: 'Der Song war',
    coverAlt: 'Cover von {name}',
    playing: 'Läuft',
    paused: 'Pausiert',
    stopped: 'Gestoppt',
    unlock: {
      hover: 'Klicken zum Anhören',
      touch: 'Tippen zum Anhören',
    },
    pause: 'Song pausieren',
    resume: 'Song fortsetzen',
    replay: 'Song nochmal anhören',
    /** Phones show only "Anhören" (+ the external-link icon), like the "Anhören auf …" badges. */
    deezer: 'Anhören<wide> auf Deezer</wide>',
    deezerAria: '{title} auf Deezer anhören (öffnet in neuem Tab)',
    snippets: { one: '{count} Schnipsel', other: '{count} Schnipsel' },
    bpm: '{bpm} BPM',
  },

  board: {
    region: 'Deine Reihenfolge',
    titleMine: 'Deine Reihenfolge',
    titleCorrect: 'Die richtige Reihenfolge',
    toggle: {
      label: 'Angezeigte Reihenfolge',
      mine: 'Deine Version',
      mineShort: 'Deine',
      correct: 'Original',
      correctShort: 'Original',
    },
    tallyCorrect: { one: '{count} an der richtigen Stelle', other: '{count} an der richtigen Stelle' },
    tallyWrong: { one: '{count} falsch', other: '{count} falsch' },
    /** Tiny chips (~6 characters): "war 5." / "→ 5.". */
    was: 'war {pos}',
    goes: '→ {pos}',
    hint: {
      intro: {
        hover: 'Klick auf einen Schnipsel, um den Song ab dort zu hören',
        touch: 'Tipp auf einen Schnipsel, um den Song ab dort zu hören',
      },
      mine: {
        hover: 'So lagen deine Schnipsel · klicken zum Anhören',
        touch: 'So lagen deine Schnipsel · tippen zum Anhören',
      },
      perfect: {
        hover: 'Alles an der richtigen Stelle! · klicken zum Nachhören',
        touch: 'Alles an der richtigen Stelle! · tippen zum Nachhören',
      },
      none: {
        hover: 'Keine Position getroffen · klicken zum Nachhören',
        touch: 'Keine Position getroffen · tippen zum Nachhören',
      },
      partial: {
        hover: {
          one: '{count} von {n} Positionen getroffen · klicken zum Nachhören',
          other: '{count} von {n} Positionen getroffen · klicken zum Nachhören',
        },
        touch: {
          one: '{count} von {n} Positionen getroffen · tippen zum Nachhören',
          other: '{count} von {n} Positionen getroffen · tippen zum Nachhören',
        },
      },
    },
  },

  spectator: {
    title: 'Du schaust zu',
    body: 'Diese Runde verfolgst du von außen – ab der nächsten spielst du mit.',
  },
  missing: {
    title: 'Keine Antwort',
    body: 'Deine Reihenfolge ist diesmal nicht bei uns angekommen.',
  },

  score: {
    region: 'Deine Punkte',
    eyebrow: 'Rundenpunkte',
    timedOut: 'Zeit abgelaufen',
    confirmedIn: '<wide>Bestätigt in</wide> <num>{time}</num>',
    barAria: { one: '{points} von {max} Punkten', other: '{points} von {max} Punkten' },
    correct: 'richtig platziert',
    /** Two neighbouring blocks in the right order ("passende Paare", see home.howTo.scoring). */
    pairs: { one: 'passendes Paar', other: 'passende Paare' },
    total: 'Gesamtstand',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}',
    stamp: 'Perfekt!',
  },

  verdict: {
    perfect: 'Perfekte Reihenfolge!',
    almost: 'Fast perfekt!',
    good: 'Gutes Gehör!',
    close: 'Nah dran…',
    more: 'Nochmal genau hinhören',
    none: 'Kein Schnipsel an der richtigen Stelle',
  },

  rankUp: { one: '{count} Platz nach oben', other: '{count} Plätze nach oben' },
  rankDown: { one: '{count} Platz nach unten', other: '{count} Plätze nach unten' },

  seconds: '{seconds} s',

  announce: {
    result: {
      one: '{points} Punkt: {correct} von {n} an der richtigen Stelle, {pairs}.',
      other: '{points} Punkte: {correct} von {n} an der richtigen Stelle, {pairs}.',
    },
    pairs: { one: '{count} passendes Paar', other: '{count} passende Paare' },
    perfect: 'Perfekte Reihenfolge! {result}',
    timedOut: '{result} Zeit abgelaufen.',
  },

  lead: {
    title: 'Rangliste',
    after: 'nach Runde {round}',
    you: 'du',
    top: 'Bestes Ergebnis der Runde',
    spectator: 'Schaut zu',
    spectatorFrom: 'Schaut zu · spielt ab Runde {round}',
    noAnswer: 'Keine Antwort',
    stats: {
      average: 'Schnitt',
      perfect: 'Perfekt',
      fastest: 'Bestzeit',
    },
    row: {
      played: {
        one: '{rank} Platz, {name}: {points} Punkt in dieser Runde, {correct} von {n} an der richtigen Stelle, gesamt {total}',
        other: '{rank} Platz, {name}: {points} Punkte in dieser Runde, {correct} von {n} an der richtigen Stelle, gesamt {total}',
      },
      spectator: '{rank} Platz, {name}: schaut zu, gesamt {total}',
      noAnswer: '{rank} Platz, {name}: keine Antwort, gesamt {total}',
      me: '{name} (du)',
    },
  },

  footer: {
    next: 'Nächste Runde',
    final: 'Endstand',
    nextIn: { one: 'Nächste Runde in <num>{count}</num> s', other: 'Nächste Runde in <num>{count}</num> s' },
    finalIn: { one: 'Endstand in <num>{count}</num> s', other: 'Endstand in <num>{count}</num> s' },
    waiting: 'Warten auf den Host…',
    waitingIn: { one: 'Warten auf den Host…<num>({count} s)</num>', other: 'Warten auf den Host…<num>({count} s)</num>' },
  },
} satisfies Catalog['reveal']
