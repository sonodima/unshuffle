import type { Catalog } from '../../catalog'

// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: 'Загрузка…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: 'Секунду…',
  /**
   * Joins separate facts in one screen-reader label ("Марк, хост, не в сети") and
   * lists of snippet letters ("A, C, B"). Keep the space if your language uses one.
   */
  listSeparator: ', ',
  /**
   * How a position or rank is written. Russian ordinals change with gender and case
   * ("2-е место", "на 2-м месте", "2-я позиция"), so formatOrdinal() gives the bare
   * number and every message that shows {rank} / {pos} adds the ending it needs:
   * "{rank}-е место", "был {pos}-м". The number also stands alone in a small pill
   * next to the total on the reveal.
   */
  ordinal: { other: '{n}' },
  modal: {
    /** Round × button of dialogs and bottom sheets. */
    close: 'Закрыть',
  },
  toast: {
    /** Landmark name of the notification stack. */
    region: 'Уведомления',
    /** × button of one notification. */
    dismiss: 'Закрыть уведомление',
  },
  avatar: {
    /** Accessible name of an avatar with no player name. */
    fallback: 'Аватар',
    /** States read after the player's name, joined with listSeparator ("Марк, хост"). */
    host: 'хост',
    submitted: 'готово',
    disconnected: 'не в сети',
    /** Final ranking. {rank} = the place (bare number, ending added here). */
    rank: '{rank}-е место',
    /** The "+3" bubble at the end of a stack of avatars. {count} = hidden players. */
    more: {
      one: 'и ещё {count}',
      few: 'и ещё {count}',
      many: 'и ещё {count}',
      other: 'и ещё {count}',
    },
  },
  avatarPicker: {
    /** Section eyebrows (shown uppercase). */
    avatar: 'Аватар',
    color: 'Цвет',
    /** Dice button that picks a random avatar and color. Short: ~12 characters. */
    random: 'Наугад',
    /** Radio group names. */
    avatarGroup: 'Выбери аватар',
    colorGroup: 'Выбери цвет',
    /** One avatar option. {emoji} = the avatar emoji. */
    avatarOption: 'Аватар {emoji}',
    /** One color swatch. {number} = 1…12. */
    colorOption: 'Цвет {number}',
  },
  codeInput: {
    /** Default name of the 5-box room code field. */
    label: 'Код комнаты',
    /** One box of the field. {label} = the field name, {index} = 1…5, {count} = 5. */
    letter: '{label}: буква {index} из {count}',
  },
  input: {
    /** Character counter above a text field ("12/20"). */
    counter: '{count}/{max}',
  },
  timer: {
    /** Countdown ring / bar, read by screen readers. */
    secondsLeft: {
      one: 'Осталась {count} секунда',
      few: 'Осталось {count} секунды',
      many: 'Осталось {count} секунд',
      other: 'Осталось {count} секунды',
    },
  },
  progressDots: {
    /** Round progress dots. {current} = 1-based round, {total} = rounds in the game. */
    label: 'Раунд {current} из {total}',
  },
  language: {
    /** Title of the language sheet, and name of its list. */
    title: 'Язык',
    /** Language button in the headers. {language} = the current language's own name ("Русский"). */
    button: 'Язык: {language}',
    /** The chosen language could not be downloaded. */
    failed: 'Не удалось загрузить язык. Попробуй ещё раз.',
  },
} satisfies Catalog['ui']
