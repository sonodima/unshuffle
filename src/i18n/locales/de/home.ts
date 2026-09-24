// Home screen: hero, profile card, "Raum erstellen" / join box, the decorative
// demo round and the "So geht’s" dialog. Uppercase labels come from CSS.
import type { Catalog } from '../../catalog'

export default {
  help: 'So geht’s',
  hero: {
    eyebrow: 'Musik-Partyspiel',
    tagline: 'Der Hit wurde zerschnipselt. <b>Bring ihn wieder in Ordnung.</b>',
  },
  cardLabel: 'Spielen',
  demoLabel: 'Vorschau einer Runde',
  offline: 'Du bist offline – zum Spielen brauchst du eine Verbindung.',
  dismissNotice: 'Hinweis schließen',
  or: 'oder',
  cancel: 'Abbrechen',
  create: {
    button: 'Raum erstellen',
    buttonInvited: 'Eigenen Raum erstellen',
    pending: 'Raum wird erstellt…',
    solo: '<b>Allein spielen:</b> Raum erstellen, sofort loslegen.',
  },
  join: {
    divider: 'Code zur Hand?',
    invited: 'Du bist eingeladen!',
    button: 'Beitreten',
    buttonCode: '{code} beitreten',
    pending: 'Verbinde mit dem Raum…',
    incomplete: {
      one: 'Gib den Buchstaben des Codes ein.',
      other: 'Gib alle {count} Buchstaben des Codes ein.',
    },
  },
  footer: {
    players: {
      one: 'Für 1 Person',
      other: 'Für 1–{count} Personen',
    },
    noAccount: 'Ohne Account, direkt im Browser',
    deezer: 'Hörproben von Deezer',
  },
  profile: {
    changeAvatar: 'Avatar und Farbe ändern',
    nameLabel: 'Dein Name',
    namePlaceholder: 'Wähl einen Namen',
    randomName: 'Zufallsname',
    lookTitle: 'Dein Look',
    lookDescription: 'Wähl Emoji und Farbe – so sehen dich die anderen.',
    done: 'Fertig',
    preview: 'Vorschau',
  },
  demo: {
    badge: 'Demo',
    caption: {
      shuffle: 'Der Hit wird zerschnipselt…',
      listen: 'Hör dir die Schnipsel an',
      sort: 'Zieh sie an die richtige Stelle',
      solved: 'Perfekt! Jetzt schnell bestätigen',
    },
    solvedPoints: 'Perfekt! +{points}',
    stepsLabel: 'So geht’s – ganz kurz',
    steps: {
      listen: 'Anhören',
      sort: 'Sortieren',
      confirm: 'Bestätigen',
    },
  },
  howTo: {
    title: 'So geht’s',
    description: 'Ein Hit pro Runde, in Schnipsel zerlegt. Wer ihn am besten und am schnellsten wieder zusammensetzt, gewinnt.',
    gotIt: 'Alles klar, los geht’s!',
    confirmButton: 'Bestätigen',
    steps: {
      listen: {
        /** No-break space before "an": the particle never sits alone on the second line. */
        title: 'Hör dir die Schnipsel an',
        bodyMouse: 'Ein bekannter Hit wird im Takt zerschnitten und gemischt. Klick auf einen Block, um ihn anzuhören.',
        bodyTouch: 'Ein bekannter Hit wird im Takt zerschnitten und gemischt. Tipp auf einen Block, um ihn anzuhören.',
      },
      sort: {
        title: 'Zieh sie an die richtige Stelle',
        body: 'Verschieb die Blöcke, bis der Song wieder wie das Original klingt. Mit <play></play> hörst du deine Reihenfolge.',
      },
      confirm: {
        title: 'Bestätige vor den anderen',
        body: 'Wer zuerst bestätigt, läutet für alle den Endspurt ein.',
      },
    },
    scoring: {
      one: 'Bis zu <b>{points}</b> Punkt pro Runde: Es zählen richtig platzierte Schnipsel und passende Paare (Nachbarn in richtiger Folge). Klappt auch allein.',
      other: 'Bis zu <b>{points}</b> Punkte pro Runde: Es zählen richtig platzierte Schnipsel und passende Paare (Nachbarn in richtiger Folge). Klappt auch allein.',
    },
  },
} satisfies Catalog['home']
