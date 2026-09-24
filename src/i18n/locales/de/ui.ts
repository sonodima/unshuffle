// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels.
import type { Catalog } from '../../catalog'

export default {
  loading: 'Wird geladen…',
  wait: 'Bitte warten…',
  listSeparator: ', ',
  /** German ordinals: "1." for every number (ranks and positions alike). */
  ordinal: { other: '{n}.' },
  modal: {
    close: 'Schließen',
  },
  toast: {
    region: 'Benachrichtigungen',
    dismiss: 'Benachrichtigung schließen',
  },
  avatar: {
    fallback: 'Avatar',
    host: 'Host',
    submitted: 'hat bestätigt',
    disconnected: 'Verbindung getrennt',
    rank: '{rank} Platz',
    more: { one: 'und noch jemand', other: 'und {count} weitere' },
  },
  avatarPicker: {
    avatar: 'Avatar',
    color: 'Farbe',
    random: 'Zufall',
    avatarGroup: 'Avatar wählen',
    colorGroup: 'Farbe wählen',
    avatarOption: 'Avatar {emoji}',
    colorOption: 'Farbe {number}',
  },
  codeInput: {
    label: 'Raumcode',
    letter: '{label}: Buchstabe {index} von {count}',
  },
  input: {
    counter: '{count}/{max}',
  },
  timer: {
    secondsLeft: { one: 'Noch {count} Sekunde', other: 'Noch {count} Sekunden' },
  },
  progressDots: {
    label: 'Runde {current} von {total}',
  },
  language: {
    title: 'Sprache',
    button: 'Sprache: {language}',
    failed: 'Die Sprache konnte nicht geladen werden. Versuch es nochmal.',
  },
} satisfies Catalog['ui']
