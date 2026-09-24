// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…), positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    roleDescription: 'Schnipsel',
    label: 'Schnipsel {letter}, Position {position} von {total}',
    playing: 'wird abgespielt',
    correct: 'richtig',
    wrong: 'falsch',
    locked: 'fixiert',
  },
  grid: 'Schnipsel zum Sortieren',
  announce: {
    dragStart: 'Schnipsel {letter} aufgenommen, Position {position} von {total}.',
    dragOver: 'Schnipsel {letter} über Position {position} von {total}.',
    dragOutside: 'Schnipsel {letter} außerhalb des Rasters.',
    drop: 'Schnipsel {letter} auf Position {position} von {total} abgelegt.',
    dropOutside: 'Schnipsel {letter} abgelegt.',
    cancel: 'Verschieben abgebrochen. Schnipsel {letter} ist zurück auf Position {position} von {total}.',
    instructions:
      'Drücke Enter, um den Schnipsel anzuhören, oder Umschalt+Enter, um die Folge ab hier zu hören. Drücke die Leertaste, um ihn aufzunehmen, verschiebe ihn mit den Pfeiltasten und drücke erneut die Leertaste, um ihn abzulegen – oder Esc, um abzubrechen.',
  },
  transport: {
    playAll: 'Alles anhören',
    playing: 'Wiedergabe',
    playingShort: 'Läuft',
    playAllAction: 'Alle Schnipsel der Reihe nach anhören',
    stopAction: 'Wiedergabe stoppen',
    playAllTitle: 'Alles anhören (Leertaste)',
    stopTitle: 'Stopp (Leertaste)',
    position: '<b>{position}</b>/{total}',
    positions: 'Positionen',
    playFrom: 'Ab Position {position} anhören',
  },
  strip: {
    order: 'Reihenfolge: {letters}',
    orderScored: {
      one: 'Reihenfolge: {letters} – {count} von {total} an der richtigen Stelle',
      other: 'Reihenfolge: {letters} – {count} von {total} an der richtigen Stelle',
    },
  },
} satisfies Catalog['board']
