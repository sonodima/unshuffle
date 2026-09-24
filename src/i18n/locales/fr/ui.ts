// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  /** Screen-reader label of spinners and loaders; also the play-all bar while the audio loads. */
  loading: 'Chargement…',
  /** Screen-reader label of a busy button (a spinner replaces its text). */
  wait: 'Un instant…',
  /** Joins separate facts in one screen-reader label ("Marco, hôte, hors ligne") and snippet letters ("A, C, B"). */
  listSeparator: ', ',
  /**
   * How a position or rank is written: 1 → "1er", 2 → "2e" (French ordinal rules: one / other).
   * "1er" is masculine: never put {rank} / {pos} before a feminine noun ("1re place"),
   * reword around the number instead ("{rank} au classement", "était {pos}").
   */
  ordinal: { one: '{n}er', other: '{n}e' },
  modal: {
    /** Round × button of dialogs and bottom sheets. */
    close: 'Fermer',
  },
  toast: {
    /** Landmark name of the notification stack. */
    region: 'Notifications',
    /** × button of one notification. */
    dismiss: 'Fermer la notification',
  },
  avatar: {
    /** Accessible name of an avatar with no player name. */
    fallback: 'Avatar',
    /** States read after the player's name, joined with listSeparator ("Marco, hôte"). */
    host: 'hôte',
    submitted: 'a validé',
    disconnected: 'hors ligne',
    /** Final ranking. {rank} = the place, already an ordinal (ui.ordinal: "1er"). */
    rank: '{rank} au classement',
    /** The "+3" bubble at the end of a stack of avatars. {count} = hidden players. */
    more: { one: 'et un autre', other: 'et {count} autres' },
  },
  avatarPicker: {
    /** Section eyebrows (shown uppercase). */
    avatar: 'Avatar',
    color: 'Couleur',
    /** Dice button that picks a random avatar and color. Short: ~12 characters. */
    random: 'Au hasard',
    /** Radio group names. */
    avatarGroup: 'Choisis un avatar',
    colorGroup: 'Choisis une couleur',
    /** One avatar option. {emoji} = the avatar emoji. */
    avatarOption: 'Avatar {emoji}',
    /** One color swatch. {number} = 1…12. */
    colorOption: 'Couleur {number}',
  },
  codeInput: {
    /** Default name of the 5-box room code field. */
    label: 'Code du salon',
    /** One box of the field. {label} = the field name, {index} = 1…5, {count} = 5. */
    letter: '{label} : lettre {index} sur {count}',
  },
  input: {
    /** Character counter above a text field ("12/20"). */
    counter: '{count}/{max}',
  },
  timer: {
    /** Countdown ring / bar, read by screen readers. */
    secondsLeft: { one: '{count} seconde restante', other: '{count} secondes restantes' },
  },
  progressDots: {
    /** Round progress dots. {current} = 1-based round, {total} = rounds in the game. */
    label: 'Manche {current} sur {total}',
  },
  language: {
    /** Title of the language sheet, and name of its list. */
    title: 'Langue',
    /** Language button in the headers. {language} = the current language's own name ("Français"). */
    button: 'Langue : {language}',
    /** The chosen language could not be downloaded. */
    failed: 'Impossible de charger la langue. Réessaie.',
  },
} satisfies Catalog['ui']
