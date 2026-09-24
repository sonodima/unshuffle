// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable block: a lowercase noun ("snippet"). */
    roleDescription: 'extrait',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: 'Extrait {letter}, position {position} sur {total}',
    playing: 'en lecture',
    correct: 'bien placé',
    wrong: 'mal placé',
    locked: 'verrouillé',
  },
  /** Name of the grid of blocks. */
  grid: 'Extraits à remettre dans l’ordre',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: 'Tu as saisi l’extrait {letter}, en position {position} sur {total}.',
    dragOver: 'Extrait {letter} au-dessus de la position {position} sur {total}.',
    dragOutside: 'Extrait {letter} hors de la grille.',
    drop: 'Extrait {letter} déposé en position {position} sur {total}.',
    dropOutside: 'Extrait {letter} déposé.',
    cancel: 'Déplacement annulé. L’extrait {letter} revient en position {position} sur {total}.',
    /** Read when a block gets keyboard focus. Key names as printed on French (AZERTY) keyboards. */
    instructions:
      'Appuie sur Entrée pour écouter l’extrait, sur Maj+Entrée pour écouter la séquence à partir d’ici. Appuie sur Espace pour le saisir, déplace-le avec les flèches, puis appuie de nouveau sur Espace pour le déposer, ou sur Échap pour annuler.',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Visible label (shown uppercase, one line: ~16 characters before it is cut). */
    playAll: 'Tout écouter',
    playing: 'Lecture en cours',
    /** Shorter "playing" label for phones: ~11 characters. */
    playingShort: 'En lecture',
    /** Round play button: accessible names. */
    playAllAction: 'Écouter tous les extraits dans l’ordre',
    stopAction: 'Arrêter la lecture',
    /** Desktop tooltips of the play button, with its keyboard shortcut (the space bar). */
    playAllTitle: 'Tout écouter (Espace)',
    stopTitle: 'Arrêter (Espace)',
    /** Snippet being played, e.g. "3/8" (<b> = the current one). */
    position: '<b>{position}</b>/{total}',
    /** Mini-map of the positions (tap one to play from there). */
    positions: 'Positions',
    playFrom: 'Écouter à partir de la position {position}',
  },
  /** Compact row of snippets (results): read by screen readers. {letters} = "D, A, C…". */
  strip: {
    order: 'Ordre : {letters}',
    /** {count} = snippets in the right place, {total} = all snippets. */
    orderScored: {
      one: 'Ordre : {letters} — {count} sur {total} à la bonne place',
      other: 'Ordre : {letters} — {count} sur {total} à la bonne place',
    },
  },
} satisfies Catalog['board']
