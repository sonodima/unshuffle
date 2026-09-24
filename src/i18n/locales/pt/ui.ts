// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: 'Carregando…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: 'Aguarde…',
  /**
   * Joins separate facts in one screen-reader label ("Marco, host, offline") and
   * lists of snippet letters ("A, C, B").
   */
  listSeparator: ', ',
  /**
   * How a position or rank is written: 1 → "1º". pt-BR ordinal rules have a single
   * form. Kept neutral (º) for both places in a ranking and positions in a sequence.
   */
  ordinal: { other: '{n}º' },
  modal: {
    /** Round × button of dialogs and bottom sheets. */
    close: 'Fechar',
  },
  toast: {
    /** Landmark name of the notification stack. */
    region: 'Notificações',
    /** × button of one notification. */
    dismiss: 'Fechar notificação',
  },
  avatar: {
    /** Accessible name of an avatar with no player name. */
    fallback: 'Avatar',
    /** States read after the player's name, joined with listSeparator ("Marco, host"). */
    host: 'host',
    submitted: 'confirmou',
    disconnected: 'offline',
    /** Final ranking. {rank} = the place, already an ordinal (ui.ordinal: "1º"). */
    rank: '{rank} lugar',
    /** The "+3" bubble at the end of a stack of avatars. {count} = hidden players. */
    more: { one: 'e mais {count}', other: 'e mais {count}' },
  },
  avatarPicker: {
    /** Section eyebrows (shown uppercase). */
    avatar: 'Avatar',
    color: 'Cor',
    /** Dice button that picks a random avatar and color. Short: ~12 characters. */
    random: 'Aleatório',
    /** Radio group names. */
    avatarGroup: 'Escolha o avatar',
    colorGroup: 'Escolha a cor',
    /** One avatar option. {emoji} = the avatar emoji. */
    avatarOption: 'Avatar {emoji}',
    /** One color swatch. {number} = 1…12. */
    colorOption: 'Cor {number}',
  },
  codeInput: {
    /** Default name of the 5-box room code field. */
    label: 'Código da sala',
    /** One box of the field. {label} = the field name, {index} = 1…5, {count} = 5. */
    letter: '{label}: letra {index} de {count}',
  },
  input: {
    /** Character counter above a text field ("12/20"). */
    counter: '{count}/{max}',
  },
  timer: {
    /** Countdown ring / bar, read by screen readers. */
    secondsLeft: { zero: 'Faltam {count} segundos', one: 'Falta {count} segundo', other: 'Faltam {count} segundos' },
  },
  progressDots: {
    /** Round progress dots. {current} = 1-based round, {total} = rounds in the game. */
    label: 'Rodada {current} de {total}',
  },
  language: {
    /** Title of the language sheet, and name of its list. */
    title: 'Idioma',
    /** Language button in the headers. {language} = the current language's own name ("Português (Brasil)"). */
    button: 'Idioma: {language}',
    /** The chosen language could not be downloaded. */
    failed: 'Não foi possível carregar o idioma. Tente de novo.',
  },
} satisfies Catalog['ui']
