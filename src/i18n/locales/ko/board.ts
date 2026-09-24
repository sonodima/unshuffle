// Snippet board (src/components/board): the draggable blocks, the play-all bar and
// the compact snippet strip. {letter} is a snippet's label (A, B, C…, never
// translated); positions are 1-based. No particle ever follows a {param}.
import type { Catalog } from '../../catalog'

export default {
  item: {
    /** aria-roledescription of a draggable block. */
    roleDescription: '조각',
    /** Accessible name of a block; the states below follow it, joined with ui.listSeparator. */
    label: '조각 {letter}, {total}개 중 {position}번째',
    playing: '재생 중',
    correct: '제자리',
    wrong: '틀린 자리',
    locked: '고정됨',
  },
  grid: '순서를 맞출 조각',
  announce: {
    dragStart: '조각 {letter}, 들어 올렸어요. 지금 {total}개 중 {position}번째 자리예요.',
    dragOver: '조각 {letter}, {total}개 중 {position}번째 자리 위에 있어요.',
    dragOutside: '조각 {letter}, 보드 밖에 있어요.',
    drop: '조각 {letter}, {total}개 중 {position}번째 자리에 놓았어요.',
    dropOutside: '조각 {letter}, 내려놓았어요.',
    cancel: '이동을 취소했어요. 조각 {letter}, {total}개 중 {position}번째 자리로 돌아가요.',
    instructions:
      'Enter 키를 누르면 조각을 듣고, Shift+Enter를 누르면 여기서부터 이어서 들어요. 스페이스바를 눌러 조각을 들어 올린 뒤 방향키로 옮기고, 스페이스바를 다시 눌러 내려놓으세요. 취소하려면 Esc를 누르세요.',
  },
  transport: {
    /** Uppercase, one line (~16 characters). */
    playAll: '전체 듣기',
    playing: '재생 중',
    /** Phones: ~11 characters. */
    playingShort: '재생 중',
    playAllAction: '모든 조각을 순서대로 듣기',
    stopAction: '재생 멈추기',
    /** Keep the key name in line with round.keys.space. */
    playAllTitle: '전체 듣기 (Space)',
    stopTitle: '멈추기 (Space)',
    position: '<b>{position}</b>/{total}',
    positions: '위치',
    playFrom: '{position}번째부터 듣기',
  },
  strip: {
    order: '순서: {letters}',
    orderScored: {
      other: '순서: {letters} — {total}개 중 {count}개 제자리',
    },
  },
} satisfies Catalog['board']
