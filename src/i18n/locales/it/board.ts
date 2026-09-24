// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
export default {
  item: {
    /** aria-roledescription of a draggable block: a lowercase noun ("snippet"). */
    roleDescription: 'spezzone',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: 'Spezzone {letter}, posizione {position} di {total}',
    playing: 'in riproduzione',
    correct: 'corretto',
    wrong: 'sbagliato',
    locked: 'bloccato',
  },
  /** Name of the grid of blocks. */
  grid: 'Spezzoni da riordinare',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: 'Hai sollevato lo spezzone {letter}, in posizione {position} di {total}.',
    dragOver: 'Spezzone {letter} sopra la posizione {position} di {total}.',
    dragOutside: 'Spezzone {letter} fuori dalla griglia.',
    drop: 'Spezzone {letter} rilasciato in posizione {position} di {total}.',
    dropOutside: 'Spezzone {letter} rilasciato.',
    cancel: 'Spostamento annullato. Lo spezzone {letter} torna in posizione {position} di {total}.',
    /** Read when a block gets keyboard focus. Name the keys as your keyboards label them. */
    instructions:
      'Premi Invio per ascoltare lo spezzone, Maiusc+Invio per ascoltare la sequenza da qui. Premi la barra spaziatrice per sollevarlo, usa le frecce per spostarlo, poi premi di nuovo la barra spaziatrice per rilasciarlo, oppure Esc per annullare.',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Visible label (shown uppercase, one line: ~16 characters before it is cut). */
    playAll: 'Ascolta tutto',
    playing: 'In riproduzione',
    /** Shorter "playing" label for phones: ~11 characters. */
    playingShort: 'In ascolto',
    /** Round play button: accessible names. */
    playAllAction: 'Ascolta tutti gli spezzoni in ordine',
    stopAction: 'Ferma la riproduzione',
    /** Desktop tooltips of the play button, with its keyboard shortcut (the space bar). */
    playAllTitle: 'Ascolta tutto (Spazio)',
    stopTitle: 'Ferma (Spazio)',
    /** Snippet being played, e.g. "3/8" (<b> = the current one). */
    position: '<b>{position}</b>/{total}',
    /** Mini-map of the positions (tap one to play from there). */
    positions: 'Posizioni',
    playFrom: 'Ascolta dalla posizione {position}',
  },
  /** Compact row of snippets (results): read by screen readers. {letters} = "D, A, C…". */
  strip: {
    order: 'Ordine: {letters}',
    /** {count} = snippets in the right place, {total} = all snippets. */
    orderScored: {
      one: 'Ordine: {letters} — {count} su {total} al posto giusto',
      other: 'Ordine: {letters} — {count} su {total} al posto giusto',
    },
  },
}
