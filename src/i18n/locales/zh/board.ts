// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable block: a lowercase noun ("snippet"). */
    roleDescription: '片段',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: '片段{letter}，第{position}个，共{total}个',
    playing: '正在播放',
    correct: '位置正确',
    wrong: '位置错误',
    locked: '已锁定',
  },
  /** Name of the grid of blocks. */
  grid: '待排序的片段',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: '已拿起片段{letter}，当前在第{position}个，共{total}个。',
    dragOver: '片段{letter}移到了第{position}个，共{total}个。',
    dragOutside: '片段{letter}已移出网格。',
    drop: '片段{letter}已放到第{position}个，共{total}个。',
    dropOutside: '已放下片段{letter}。',
    cancel: '已取消移动。片段{letter}回到第{position}个，共{total}个。',
    /** Read when a block gets keyboard focus. Name the keys as your keyboards label them. */
    instructions:
      '按 Enter 试听这个片段，按 Shift+Enter 从这里开始连续播放。按空格键拿起片段，用方向键移动，再按一次空格键放下，或按 Esc 取消。',
  },
  /** Play-all bar under the board. */
  transport: {
    /** Visible label (shown uppercase, one line: ~16 characters before it is cut). */
    playAll: '播放全部',
    playing: '正在播放',
    /** Shorter "playing" label for phones: ~11 characters. */
    playingShort: '播放中',
    /** Round play button: accessible names. */
    playAllAction: '按顺序播放全部片段',
    stopAction: '停止播放',
    /** Desktop tooltips of the play button, with its keyboard shortcut (the space bar). */
    playAllTitle: '播放全部（空格）',
    stopTitle: '停止（空格）',
    /** Snippet being played, e.g. "3/8" (<b> = the current one). */
    position: '<b>{position}</b>/{total}',
    /** Mini-map of the positions (tap one to play from there). */
    positions: '位置',
    playFrom: '从第{position}个开始播放',
  },
  /** Compact row of snippets (results): read by screen readers. {letters} = "D, A, C…". */
  strip: {
    order: '顺序：{letters}',
    /** {count} = snippets in the right place, {total} = all snippets. */
    orderScored: {
      other: '顺序：{letters}——{total}个中有{count}个位置正确',
    },
  },
} satisfies Catalog['board']
