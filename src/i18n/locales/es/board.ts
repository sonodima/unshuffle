// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable block: a lowercase noun. */
    roleDescription: 'fragmento',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: 'Fragmento {letter}, posición {position} de {total}',
    playing: 'en reproducción',
    correct: 'correcto',
    wrong: 'incorrecto',
    locked: 'bloqueado',
  },
  grid: 'Fragmentos para ordenar',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: 'Fragmento {letter} levantado, en la posición {position} de {total}.',
    dragOver: 'Fragmento {letter} sobre la posición {position} de {total}.',
    dragOutside: 'Fragmento {letter} fuera de la cuadrícula.',
    drop: 'Fragmento {letter} soltado en la posición {position} de {total}.',
    dropOutside: 'Fragmento {letter} soltado.',
    cancel: 'Movimiento cancelado. El fragmento {letter} vuelve a la posición {position} de {total}.',
    instructions:
      'Presiona Enter para escuchar el fragmento y Mayús+Enter para escuchar la secuencia desde aquí. Presiona la barra espaciadora para levantarlo, muévelo con las flechas y vuelve a presionar la barra espaciadora para soltarlo, o Esc para cancelar.',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Uppercase, one line: ~16 characters. */
    playAll: 'Escuchar todo',
    playing: 'Reproduciendo',
    /** Phones: ~11 characters. */
    playingShort: 'Sonando',
    playAllAction: 'Escuchar todos los fragmentos en orden',
    stopAction: 'Detener la reproducción',
    playAllTitle: 'Escuchar todo (Espacio)',
    stopTitle: 'Detener (Espacio)',
    position: '<b>{position}</b>/{total}',
    positions: 'Posiciones',
    playFrom: 'Escuchar desde la posición {position}',
  },
  /** Compact row of snippets (results): read by screen readers. */
  strip: {
    order: 'Orden: {letters}',
    orderScored: {
      one: 'Orden: {letters} — {count} de {total} en su lugar',
      other: 'Orden: {letters} — {count} de {total} en su lugar',
    },
  },
} satisfies Catalog['board']
