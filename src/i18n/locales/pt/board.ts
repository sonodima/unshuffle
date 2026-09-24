// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable block: a lowercase noun ("snippet"). */
    roleDescription: 'trecho',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: 'Trecho {letter}, posição {position} de {total}',
    playing: 'tocando',
    correct: 'certo',
    wrong: 'errado',
    locked: 'travado',
  },
  /** Name of the grid of blocks. */
  grid: 'Trechos para reordenar',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: 'Você pegou o trecho {letter}, na posição {position} de {total}.',
    dragOver: 'Trecho {letter} sobre a posição {position} de {total}.',
    dragOutside: 'Trecho {letter} fora da grade.',
    drop: 'Trecho {letter} solto na posição {position} de {total}.',
    dropOutside: 'Trecho {letter} solto.',
    cancel: 'Movimento cancelado. O trecho {letter} volta para a posição {position} de {total}.',
    /** Read when a block gets keyboard focus. Name the keys as your keyboards label them. */
    instructions:
      'Pressione Enter para ouvir o trecho e Shift+Enter para ouvir a sequência a partir dele. Pressione a barra de espaço para pegá-lo, use as setas para movê-lo e pressione a barra de espaço de novo para soltá-lo, ou Esc para cancelar.',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Visible label (shown uppercase, one line: ~16 characters before it is cut). */
    playAll: 'Ouvir tudo',
    playing: 'Tocando agora',
    /** Shorter "playing" label for phones: ~11 characters. */
    playingShort: 'Tocando',
    /** Round play button: accessible names. */
    playAllAction: 'Ouvir todos os trechos em ordem',
    stopAction: 'Parar a reprodução',
    /** Desktop tooltips of the play button, with its keyboard shortcut (the space bar). */
    playAllTitle: 'Ouvir tudo (Espaço)',
    stopTitle: 'Parar (Espaço)',
    /** Snippet being played, e.g. "3/8" (<b> = the current one). */
    position: '<b>{position}</b>/{total}',
    /** Mini-map of the positions (tap one to play from there). */
    positions: 'Posições',
    playFrom: 'Ouvir a partir da posição {position}',
  },
  /** Compact row of snippets (results): read by screen readers. {letters} = "D, A, C…". */
  strip: {
    order: 'Ordem: {letters}',
    /** {count} = snippets in the right place, {total} = all snippets. */
    orderScored: {
      one: 'Ordem: {letters} — {count} de {total} no lugar certo',
      other: 'Ordem: {letters} — {count} de {total} no lugar certo',
    },
  },
} satisfies Catalog['board']
