// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: '読み込み中…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: 'お待ちください…',
  /** Joins separate facts in one screen-reader label ("Marco、ホスト、切断中") and snippet letters ("A、C、B"). */
  listSeparator: '、',
  /** Japanese has no ordinal suffix: the counter (位, 番目) is written in each message. */
  ordinal: { other: '{n}' },
  modal: {
    close: '閉じる',
  },
  toast: {
    region: '通知',
    dismiss: '通知を閉じる',
  },
  avatar: {
    fallback: 'アバター',
    /** States read after the player's name, joined with listSeparator. */
    host: 'ホスト',
    submitted: '確定済み',
    disconnected: '切断中',
    /** {rank} = the place, already an ordinal ("1"). */
    rank: '{rank}位',
    more: { other: 'ほか{count}人' },
  },
  avatarPicker: {
    avatar: 'アバター',
    color: 'カラー',
    random: 'ランダム',
    avatarGroup: 'アバターを選ぶ',
    colorGroup: 'カラーを選ぶ',
    avatarOption: 'アバター：{emoji}',
    colorOption: 'カラー{number}',
  },
  codeInput: {
    label: 'ルームコード',
    letter: '{label}：{count}文字中{index}文字目',
  },
  input: {
    counter: '{count}/{max}',
  },
  timer: {
    secondsLeft: { other: '残り{count}秒' },
  },
  progressDots: {
    label: '全{total}ラウンド中{current}ラウンド目',
  },
  language: {
    title: '言語',
    button: '言語：{language}',
    failed: '言語を読み込めませんでした。もう一度お試しください。',
  },
} satisfies Catalog['ui']
