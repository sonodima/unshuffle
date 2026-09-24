// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: 'Caricamento…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: 'Attendere…',
  /**
   * Joins separate facts in one screen-reader label ("Marco, host, disconnesso") and
   * lists of snippet letters ("A, C, B"). Keep the space if your language uses one.
   */
  listSeparator: ', ',
  /**
   * How a position or rank is written: 1 → "1º". Read by formatOrdinal(), which picks
   * the form with the language's ORDINAL plural rules (English: one "{n}st", two "{n}nd",
   * few "{n}rd", other "{n}th"; languages with a single form only need other). Messages
   * that show a rank ({rank}, {pos}) receive it already written this way, so they add
   * only the words around it ("{rank} posto"). Keep the ordinal neutral if your language
   * marks gender or case: it is used for places in a ranking and positions in a sequence.
   */
  ordinal: { other: '{n}º' },
  modal: {
    /** Round × button of dialogs and bottom sheets. */
    close: 'Chiudi',
  },
  toast: {
    /** Landmark name of the notification stack. */
    region: 'Notifiche',
    /** × button of one notification. */
    dismiss: 'Chiudi notifica',
  },
  avatar: {
    /** Accessible name of an avatar with no player name. */
    fallback: 'Avatar',
    /** States read after the player's name, joined with listSeparator ("Marco, host"). */
    host: 'host',
    submitted: 'ha confermato',
    disconnected: 'disconnesso',
    /** Final ranking. {rank} = the place, already an ordinal (ui.ordinal: "1º"). */
    rank: '{rank} posto',
    /** The "+3" bubble at the end of a stack of avatars. {count} = hidden players. */
    more: { one: 'e un altro', other: 'e altri {count}' },
  },
  avatarPicker: {
    /** Section eyebrows (shown uppercase). */
    avatar: 'Avatar',
    color: 'Colore',
    /** Dice button that picks a random avatar and color. Short: ~12 characters. */
    random: 'Casuale',
    /** Radio group names. */
    avatarGroup: 'Scegli avatar',
    colorGroup: 'Scegli colore',
    /** One avatar option. {emoji} = the avatar emoji. */
    avatarOption: 'Avatar {emoji}',
    /** One color swatch. {number} = 1…12. */
    colorOption: 'Colore {number}',
  },
  codeInput: {
    /** Default name of the 5-box room code field. */
    label: 'Codice stanza',
    /** One box of the field. {label} = the field name, {index} = 1…5, {count} = 5. */
    letter: '{label}: lettera {index} di {count}',
  },
  input: {
    /** Character counter above a text field ("12/20"). */
    counter: '{count}/{max}',
  },
  timer: {
    /** Countdown ring / bar, read by screen readers. */
    secondsLeft: { one: '{count} secondo rimasto', other: '{count} secondi rimasti' },
  },
  progressDots: {
    /** Round progress dots. {current} = 1-based round, {total} = rounds in the game. */
    label: 'Round {current} di {total}',
  },
  language: {
    /** Title of the language sheet, and name of its list. */
    title: 'Lingua',
    /** Language button in the headers. {language} = the current language's own name ("Italiano"). */
    button: 'Lingua: {language}',
    /** The chosen language could not be downloaded. */
    failed: 'Impossibile caricare la lingua. Riprova.',
  },
}
