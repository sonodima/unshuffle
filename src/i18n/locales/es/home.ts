// Home screen: hero, profile card, "Crear sala" / join box, the decorative
// round demo and the "Cómo se juega" dialog. Labels marked "uppercase" are
// shown in capitals by CSS: write them in normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Small pill, keep short. */
  help: 'Cómo se juega',
  hero: {
    /** Uppercase, letter-spaced: ~24 characters. */
    eyebrow: 'Party game musical',
    /** <b>…</b> is the highlighted second sentence. */
    tagline: 'El hit está hecho pedazos. <b>Ponlo en orden.</b>',
  },
  cardLabel: 'Jugar',
  demoLabel: 'Ronda de demostración',
  offline: 'Estás sin conexión: necesitas internet para jugar.',
  dismissNotice: 'Cerrar aviso',
  /** Divider (uppercase). */
  or: 'o',
  cancel: 'Cancelar',
  create: {
    /** Big button, uppercase: ~16 characters. */
    button: 'Crear sala',
    buttonInvited: 'Crear una sala',
    pending: 'Abriendo la sala…',
    /** One line on phones (~50 characters). */
    solo: '<b>Juega en solitario:</b> crea la sala y empieza ya.',
  },
  join: {
    divider: '¿Tienes un código?',
    invited: '¡Tienes una invitación!',
    button: 'Unirse',
    /** {code} = 5-letter room code (uppercase). */
    buttonCode: 'Unirse a {code}',
    pending: 'Conectando con la sala…',
    incomplete: {
      one: 'Escribe la letra del código.',
      other: 'Escribe las {count} letras del código.',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    players: {
      one: '1 jugador',
      other: 'De 1 a {count} jugadores',
    },
    noAccount: 'Sin cuentas: se juega en el navegador',
    deezer: 'Vistas previas musicales de Deezer',
  },
  profile: {
    changeAvatar: 'Cambiar avatar y color',
    /** Uppercase. */
    nameLabel: 'Tu nombre',
    namePlaceholder: 'Elige un nombre',
    randomName: 'Nombre al azar',
    lookTitle: 'Tu estilo',
    lookDescription: 'Elige emoji y color: así te verán los demás jugadores.',
    done: 'Listo',
    /** Uppercase. */
    preview: 'Vista previa',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    badge: 'Demo',
    /** One line: ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: 'Hacemos pedazos el hit…',
      listen: 'Escucha los fragmentos',
      sort: 'Arrástralos al orden correcto',
      solved: '¡Perfecto! Confirma primero',
    },
    solvedPoints: '¡Perfecto! +{points}',
    stepsLabel: 'Cómo se juega, en resumen',
    /** One word each, ~12 characters. */
    steps: {
      listen: 'Escucha',
      sort: 'Ordena',
      confirm: 'Confirma',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: 'Cómo se juega',
    description: 'Un hit por ronda, hecho pedazos. Gana quien lo ordene mejor y más rápido.',
    gotIt: '¡Entendido, a jugar!',
    /** Tiny pill, uppercase: very short. */
    confirmButton: 'Confirmar',
    steps: {
      listen: {
        title: 'Escucha los fragmentos',
        bodyMouse: 'Un hit famoso se corta al compás y se baraja. Haz clic en un bloque para escucharlo.',
        bodyTouch: 'Un hit famoso se corta al compás y se baraja. Toca un bloque para escucharlo.',
      },
      sort: {
        title: 'Arrástralos al orden correcto',
        /** <play></play> is replaced by a small ▶ icon. Keep it empty. */
        body: 'Mueve los bloques hasta que la canción suene como la original. Con <play></play> escuchas tu orden.',
      },
      confirm: {
        title: 'Confirma antes que nadie',
        body: 'Quien confirma primero activa el temporizador final para todos.',
      },
    },
    /** {points} = maximum points per round, already formatted (5.000). */
    scoring: {
      one: 'Hasta <b>{points}</b> punto por ronda: cuentan los fragmentos en su lugar y los pares en secuencia. También se puede jugar en solitario.',
      other: 'Hasta <b>{points}</b> puntos por ronda: cuentan los fragmentos en su lugar y los pares en secuencia. También se puede jugar en solitario.',
    },
  },
} satisfies Catalog['home']
