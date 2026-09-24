// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: '加载中…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: '请稍候…',
  /**
   * Joins separate facts in one screen-reader label ("Marco，房主，已断开") and
   * lists of snippet letters ("A，C，B"). Full-width comma, no space.
   */
  listSeparator: '，',
  /**
   * How a position or rank is written: 1 → "第1". Messages add the counter word
   * around it: ranks "{rank}名" (第1名), positions "{pos}位" (第3位). The bare
   * "第2" is also shown alone, as the rank pill next to the running total.
   */
  ordinal: { other: '第{n}' },
  modal: {
    /** Round × button of dialogs and bottom sheets. */
    close: '关闭',
  },
  toast: {
    /** Landmark name of the notification stack. */
    region: '通知',
    /** × button of one notification. */
    dismiss: '关闭通知',
  },
  avatar: {
    /** Accessible name of an avatar with no player name. */
    fallback: '头像',
    /** States read after the player's name, joined with listSeparator ("Marco，房主"). */
    host: '房主',
    submitted: '已确认',
    disconnected: '已断开',
    /** Final ranking. {rank} = the place, already an ordinal (ui.ordinal: "第1"). */
    rank: '{rank}名',
    /** The "+3" bubble at the end of a stack of avatars. {count} = hidden players. */
    more: { other: '还有{count}人' },
  },
  avatarPicker: {
    /** Section eyebrows (shown uppercase). */
    avatar: '头像',
    color: '颜色',
    /** Dice button that picks a random avatar and color. Short: ~12 characters. */
    random: '随机',
    /** Radio group names. */
    avatarGroup: '选择头像',
    colorGroup: '选择颜色',
    /** One avatar option. {emoji} = the avatar emoji. */
    avatarOption: '头像{emoji}',
    /** One color swatch. {number} = 1…12. */
    colorOption: '颜色{number}',
  },
  codeInput: {
    /** Default name of the 5-box room code field. */
    label: '房间码',
    /** One box of the field. {label} = the field name, {index} = 1…5, {count} = 5. */
    letter: '{label}：第{index}个字母，共{count}个',
  },
  input: {
    /** Character counter above a text field ("12/20"). */
    counter: '{count}/{max}',
  },
  timer: {
    /** Countdown ring / bar, read by screen readers. */
    secondsLeft: { other: '还剩{count}秒' },
  },
  progressDots: {
    /** Round progress dots. {current} = 1-based round, {total} = rounds in the game. */
    label: '第{current}回合，共{total}回合',
  },
  language: {
    /** Title of the language sheet, and name of its list. */
    title: '语言',
    /** Language button in the headers. {language} = the current language's own name ("简体中文"). */
    button: '语言：{language}',
    /** The chosen language could not be downloaded. */
    failed: '语言包加载失败，请重试。',
  },
} satisfies Catalog['ui']
