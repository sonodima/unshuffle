// Snippet board (src/components/board): the draggable tiles, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable tile: a lowercase noun ("snippet"). */
    roleDescription: 'snippet',
    /** Accessible name of a tile; the states below follow it, joined with ui.listSeparator. */
    label: 'Snippet {letter}, position {position} of {total}',
    playing: 'playing',
    correct: 'correct',
    wrong: 'wrong',
    locked: 'locked',
  },
  /** Name of the grid of tiles. */
  grid: 'Snippets to reorder',
  /** Screen-reader announcements while moving a tile with the keyboard (or a pointer). */
  announce: {
    dragStart: 'You picked up snippet {letter}, in position {position} of {total}.',
    dragOver: 'Snippet {letter} is over position {position} of {total}.',
    dragOutside: 'Snippet {letter} is outside the grid.',
    drop: 'Snippet {letter} dropped at position {position} of {total}.',
    dropOutside: 'Snippet {letter} dropped.',
    cancel: 'Move canceled. Snippet {letter} goes back to position {position} of {total}.',
    /** Read when a tile gets keyboard focus. Name the keys as your keyboards label them. */
    instructions:
      'Press Enter to hear the snippet, or Shift+Enter to play the sequence from here. Press Space to pick it up, use the arrow keys to move it, then press Space again to drop it, or Esc to cancel.',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Visible label (shown uppercase, one line: ~16 characters before it is cut). */
    playAll: 'Play all',
    playing: 'Now playing',
    /** Shorter "playing" label for phones: ~11 characters. */
    playingShort: 'Playing',
    /** Round play button: accessible names. */
    playAllAction: 'Play all snippets in order',
    stopAction: 'Stop playback',
    /** Desktop tooltips of the play button, with its keyboard shortcut (the space bar). */
    playAllTitle: 'Play all (Space)',
    stopTitle: 'Stop (Space)',
    /** Snippet being played, e.g. "3/8" (<b> = the current one). */
    position: '<b>{position}</b>/{total}',
    /** Mini-map of the positions (tap one to play from there). */
    positions: 'Positions',
    playFrom: 'Play from position {position}',
  },
  /** Compact row of snippets (results): read by screen readers. {letters} = "D, A, C…". */
  strip: {
    order: 'Order: {letters}',
    /** {count} = snippets in the right spot, {total} = all snippets. */
    orderScored: {
      one: 'Order: {letters} — {count} of {total} in the right spot',
      other: 'Order: {letters} — {count} of {total} in the right spot',
    },
  },
} satisfies Catalog['board']
