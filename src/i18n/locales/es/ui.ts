// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  loading: 'Cargando…',
  wait: 'Un momento…',
  listSeparator: ', ',
  /**
   * Ordinal pattern (Spanish has a single ordinal category): "1.º". The masculine
   * indicator reads as neutral here: it serves places in a ranking and positions
   * in a sequence.
   */
  ordinal: { other: '{n}.º' },
  modal: {
    close: 'Cerrar',
  },
  toast: {
    region: 'Notificaciones',
    dismiss: 'Cerrar notificación',
  },
  avatar: {
    fallback: 'Avatar',
    /** States read after the player's name, joined with listSeparator ("Marco, anfitrión"). */
    host: 'anfitrión',
    submitted: 'ha confirmado',
    disconnected: 'sin conexión',
    rank: '{rank} puesto',
    more: { one: 'y uno más', other: 'y {count} más' },
  },
  avatarPicker: {
    avatar: 'Avatar',
    color: 'Color',
    /** Short: ~12 characters. */
    random: 'Al azar',
    avatarGroup: 'Elige avatar',
    colorGroup: 'Elige color',
    avatarOption: 'Avatar {emoji}',
    colorOption: 'Color {number}',
  },
  codeInput: {
    label: 'Código de sala',
    letter: '{label}: letra {index} de {count}',
  },
  input: {
    counter: '{count}/{max}',
  },
  timer: {
    secondsLeft: { one: 'Queda {count} segundo', other: 'Quedan {count} segundos' },
  },
  progressDots: {
    label: 'Ronda {current} de {total}',
  },
  language: {
    title: 'Idioma',
    button: 'Idioma: {language}',
    failed: 'No se pudo cargar el idioma. Inténtalo de nuevo.',
  },
} satisfies Catalog['ui']
