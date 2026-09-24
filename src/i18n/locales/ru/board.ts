import type { Catalog } from '../../catalog'

// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
export default {
  item: {
    /** aria-roledescription of a draggable block: a lowercase noun ("snippet"). */
    roleDescription: 'фрагмент',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: 'Фрагмент {letter}, позиция {position} из {total}',
    playing: 'играет',
    correct: 'на своём месте',
    wrong: 'не на своём месте',
    locked: 'закреплён',
  },
  /** Name of the grid of blocks. */
  grid: 'Перемешанные фрагменты',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: 'Фрагмент {letter} поднят с позиции {position} из {total}.',
    dragOver: 'Фрагмент {letter} над позицией {position} из {total}.',
    dragOutside: 'Фрагмент {letter} за пределами сетки.',
    drop: 'Фрагмент {letter} поставлен на позицию {position} из {total}.',
    dropOutside: 'Фрагмент {letter} отпущен.',
    cancel: 'Перемещение отменено. Фрагмент {letter} возвращается на позицию {position} из {total}.',
    /** Read when a block gets keyboard focus. Name the keys as your keyboards label them. */
    instructions:
      'Нажми Enter, чтобы послушать фрагмент, или Shift+Enter, чтобы слушать последовательность с этого места. Нажми пробел, чтобы поднять блок, двигай его стрелками, а потом снова нажми пробел, чтобы поставить, или Esc, чтобы отменить.',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Visible label (shown uppercase, one line: ~16 characters before it is cut). */
    playAll: 'Слушать всё',
    playing: 'Сейчас играет',
    /** Shorter "playing" label for phones: ~11 characters. */
    playingShort: 'Играет',
    /** Round play button: accessible names. */
    playAllAction: 'Прослушать все фрагменты по порядку',
    stopAction: 'Остановить воспроизведение',
    /** Desktop tooltips of the play button, with its keyboard shortcut (the space bar). */
    playAllTitle: 'Слушать всё (Пробел)',
    stopTitle: 'Стоп (Пробел)',
    /** Snippet being played, e.g. "3/8" (<b> = the current one). */
    position: '<b>{position}</b>/{total}',
    /** Mini-map of the positions (tap one to play from there). */
    positions: 'Позиции',
    playFrom: 'Слушать с позиции {position}',
  },
  /** Compact row of snippets (results): read by screen readers. {letters} = "D, A, C…". */
  strip: {
    order: 'Порядок: {letters}',
    /** {count} = snippets in the right place, {total} = all snippets. */
    orderScored: {
      one: 'Порядок: {letters} — {count} из {total} на своём месте',
      few: 'Порядок: {letters} — {count} из {total} на своих местах',
      many: 'Порядок: {letters} — {count} из {total} на своих местах',
      other: 'Порядок: {letters} — {count} из {total} на своих местах',
    },
  },
} satisfies Catalog['board']
