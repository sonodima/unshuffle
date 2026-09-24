// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: 'Loading…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: 'Please wait…',
  /**
   * Joins separate facts in one screen-reader label ("Marco, host, disconnected") and
   * lists of snippet letters ("A, C, B"). Keep the space if your language uses one.
   */
  listSeparator: ', ',
  /**
   * How a position or rank is written: 1 → "1st". Read by formatOrdinal(), which picks
   * the form with the language's ORDINAL plural rules (English: one "{n}st", two "{n}nd",
   * few "{n}rd", other "{n}th"; languages with a single form only need other). Messages
   * that show a rank ({rank}, {pos}) receive it already written this way, so they add
   * only the words around it ("{rank} place"). Keep the ordinal neutral if your language
   * marks gender or case: it is used for places in a ranking and positions in a sequence.
   */
  ordinal: { one: '{n}st', two: '{n}nd', few: '{n}rd', other: '{n}th' },
  modal: {
    /** Round × button of dialogs and bottom sheets. */
    close: 'Close',
  },
  toast: {
    /** Landmark name of the notification stack. */
    region: 'Notifications',
    /** × button of one notification. */
    dismiss: 'Dismiss notification',
  },
  avatar: {
    /** Accessible name of an avatar with no player name. */
    fallback: 'Avatar',
    /** States read after the player's name, joined with listSeparator ("Marco, host"). */
    host: 'host',
    submitted: 'locked in',
    disconnected: 'disconnected',
    /** Final ranking. {rank} = the place, already an ordinal (ui.ordinal: "1st"). */
    rank: '{rank} place',
    /** The "+3" bubble at the end of a stack of avatars. {count} = hidden players. */
    more: { one: 'and one more', other: 'and {count} more' },
  },
  avatarPicker: {
    /** Section eyebrows (shown uppercase). */
    avatar: 'Avatar',
    color: 'Color',
    /** Dice button that picks a random avatar and color. Short: ~12 characters. */
    random: 'Surprise me',
    /** Radio group names. */
    avatarGroup: 'Choose an avatar',
    colorGroup: 'Choose a color',
    /** One avatar option. {emoji} = the avatar emoji. */
    avatarOption: 'Avatar {emoji}',
    /** One color swatch. {number} = 1…12. */
    colorOption: 'Color {number}',
  },
  codeInput: {
    /** Default name of the 5-box room code field. */
    label: 'Room code',
    /** One box of the field. {label} = the field name, {index} = 1…5, {count} = 5. */
    letter: '{label}: letter {index} of {count}',
  },
  input: {
    /** Character counter above a text field ("12/20"). */
    counter: '{count}/{max}',
  },
  timer: {
    /** Countdown ring / bar, read by screen readers. */
    secondsLeft: { one: '{count} second left', other: '{count} seconds left' },
  },
  progressDots: {
    /** Round progress dots. {current} = 1-based round, {total} = rounds in the game. */
    label: 'Round {current} of {total}',
  },
  language: {
    /** Title of the language sheet, and name of its list. */
    title: 'Language',
    /** Language button in the headers. {language} = the current language's own name ("English"). */
    button: 'Language: {language}',
    /** The chosen language could not be downloaded. */
    failed: 'Couldn’t load that language. Try again.',
  },
} satisfies Catalog['ui']
