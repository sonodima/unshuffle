// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…); positions are 1-based.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable block. */
    roleDescription: 'ピース',
    label: 'ピース{letter}、{total}個中{position}番目',
    playing: '再生中',
    correct: '正解',
    wrong: '不正解',
    locked: 'ロック中',
  },
  grid: '並べ替えるピース',
  /** Screen-reader announcements while moving a block with the keyboard (or a pointer). */
  announce: {
    dragStart: 'ピース{letter}を持ち上げました。現在{total}個中{position}番目です。',
    dragOver: 'ピース{letter}：{total}個中{position}番目の位置。',
    dragOutside: 'ピース{letter}はグリッドの外にあります。',
    drop: 'ピース{letter}を{total}個中{position}番目に置きました。',
    dropOutside: 'ピース{letter}を離しました。',
    cancel: '移動をキャンセルしました。ピース{letter}は{total}個中{position}番目に戻ります。',
    instructions:
      'Enterキーでこのピースを再生、Shift+Enterでここから続けて再生します。スペースキーで持ち上げ、矢印キーで移動し、もう一度スペースキーで置きます。Escキーでキャンセルできます。',
  },
  transport: {
    /** Visible label (one line, ~8 full-width characters). */
    playAll: '通して聴く',
    playing: '再生中',
    playingShort: '再生中',
    playAllAction: 'すべてのピースを順番に再生',
    stopAction: '再生を停止',
    playAllTitle: '通して聴く（Space）',
    stopTitle: '停止（Space）',
    position: '<b>{position}</b>/{total}',
    positions: '再生位置',
    playFrom: '{position}番目から再生',
  },
  strip: {
    order: '並び順：{letters}',
    orderScored: {
      other: '並び順：{letters}（{total}個中{count}個が正しい位置）',
    },
  },
} satisfies Catalog['board']
