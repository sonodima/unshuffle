// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS: write them normally.
import type { Catalog } from '../../catalog'

export default {
  header: {
    eyebrow: 'Resultados',
    /** "Ronda 3 / 5". The <dim> part is shown dimmed. */
    round: 'Ronda {round}<dim> / {total}</dim>',
  },

  song: {
    region: 'La canción',
    eyebrow: 'La canción era',
    coverAlt: 'Portada de {name}',
    playing: 'Reproduciendo',
    paused: 'En pausa',
    /** The song (feminine) is stopped. */
    stopped: 'Detenida',
    unlock: {
      hover: 'Haz clic para escuchar',
      touch: 'Toca para escuchar',
    },
    pause: 'Pausar la canción',
    resume: 'Reanudar la canción',
    replay: 'Volver a escuchar la canción',
    /** The <wide> part is hidden on phones narrower than 420 px. */
    deezer: 'Escuchar<wide> en Deezer</wide>',
    deezerAria: 'Escuchar {title} en Deezer (se abre en una pestaña nueva)',
    snippets: { one: '{count} fragmento', other: '{count} fragmentos' },
    bpm: '{bpm} BPM',
  },

  board: {
    region: 'Tu secuencia',
    titleMine: 'Tu orden',
    titleCorrect: 'El orden correcto',
    /** ~120 px on tablets/desktop, ~80 px on phones (short forms). */
    toggle: {
      label: 'Orden mostrado',
      mine: 'Tu orden',
      mineShort: 'El tuyo',
      correct: 'El correcto',
      correctShort: 'Correcto',
    },
    tallyCorrect: { one: '{count} en su lugar', other: '{count} en su lugar' },
    tallyWrong: { one: '{count} fuera de lugar', other: '{count} fuera de lugar' },
    /**
     * Tiny chips (~6 characters). {pos} is an ordinal (ui.ordinal: "5.º").
     * "era 3.º" = that snippet was 3rd in the player's order.
     */
    was: 'era {pos}',
    goes: '→ {pos}',
    /** One line (truncated beyond ~60 characters on phones). */
    hint: {
      intro: {
        hover: 'Haz clic en un fragmento para escuchar la canción desde ahí',
        touch: 'Toca un fragmento para escuchar la canción desde ahí',
      },
      mine: {
        hover: 'Así estaban tus fragmentos · haz clic para escucharlos',
        touch: 'Así estaban tus fragmentos · toca para escucharlos',
      },
      perfect: {
        hover: '¡Todos en su lugar! · haz clic para escucharla de nuevo',
        touch: '¡Todos en su lugar! · toca para escucharla de nuevo',
      },
      none: {
        hover: 'Ninguna posición acertada · haz clic para escucharla de nuevo',
        touch: 'Ninguna posición acertada · toca para escucharla de nuevo',
      },
      partial: {
        hover: {
          one: 'Aciertas {count} posición de {n} · haz clic para escucharla de nuevo',
          other: 'Aciertas {count} posiciones de {n} · haz clic para escucharla de nuevo',
        },
        touch: {
          one: 'Aciertas {count} posición de {n} · toca para escucharla de nuevo',
          other: 'Aciertas {count} posiciones de {n} · toca para escucharla de nuevo',
        },
      },
    },
  },

  spectator: {
    title: 'Modo espectador',
    body: 'Esta ronda te toca mirar: jugarás a partir de la siguiente.',
  },
  missing: {
    title: 'Sin respuesta',
    body: 'Esta vez no nos ha llegado tu secuencia.',
  },

  score: {
    region: 'Tus puntos',
    /** One line, short. */
    eyebrow: 'Puntos de la ronda',
    timedOut: 'Tiempo agotado',
    /** The <wide> part is hidden below 400 px; <num> wraps {time} ("55,8 s"). */
    confirmedIn: '<wide>Confirmado en</wide> <num>{time}</num>',
    barAria: { one: '{points} punto de {max}', other: '{points} puntos de {max}' },
    correct: 'en su lugar',
    pairs: { one: 'par en secuencia', other: 'pares en secuencia' },
    total: 'Total de la partida',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}',
    stamp: '¡Perfecto!',
  },

  /** One line under my points (the sequence is feminine: "secuencia"). */
  verdict: {
    perfect: '¡Secuencia perfecta!',
    almost: '¡Casi perfecta!',
    good: '¡Buen oído!',
    close: 'Ya casi lo tienes…',
    more: 'Hay que escucharla otra vez',
    none: 'Ningún fragmento en su lugar',
  },

  rankUp: { one: 'Sube {count} posición', other: 'Sube {count} posiciones' },
  rankDown: { one: 'Baja {count} posición', other: 'Baja {count} posiciones' },

  seconds: '{seconds} s',

  announce: {
    result: {
      one: '{points} punto: {correct} de {n} en su lugar, {pairs}.',
      other: '{points} puntos: {correct} de {n} en su lugar, {pairs}.',
    },
    pairs: { one: '{count} par en secuencia', other: '{count} pares en secuencia' },
    perfect: '¡Secuencia perfecta! {result}',
    timedOut: '{result} Tiempo agotado.',
  },

  lead: {
    title: 'Clasificación',
    /** The no-break space keeps the number with «ronda» when the label wraps. */
    after: 'tras la ronda {round}',
    /** Tiny badge: 2–4 letters. */
    you: 'tú',
    top: 'Mejor puntuación de la ronda',
    spectator: 'Espectador',
    spectatorFrom: 'Espectador · juega desde la ronda {round}',
    noAnswer: 'Sin respuesta',
    /** Tiny labels, three columns. */
    stats: {
      average: 'Promedio',
      perfect: 'Perfectos',
      fastest: 'Más veloz',
    },
    row: {
      played: {
        one: '{rank}, {name}: {points} punto en esta ronda, {correct} de {n} en su lugar, total {total}',
        other: '{rank}, {name}: {points} puntos en esta ronda, {correct} de {n} en su lugar, total {total}',
      },
      spectator: '{rank}, {name}: espectador, total {total}',
      noAnswer: '{rank}, {name}: sin respuesta, total {total}',
      me: '{name} (tú)',
    },
  },

  footer: {
    next: 'Siguiente ronda',
    final: 'Clasificación final',
    nextIn: { one: 'Siguiente ronda en <num>{count}</num> s', other: 'Siguiente ronda en <num>{count}</num> s' },
    finalIn: { one: 'Clasificación final en <num>{count}</num> s', other: 'Clasificación final en <num>{count}</num> s' },
    waiting: 'Esperando al anfitrión…',
    waitingIn: { one: 'Esperando al anfitrión…<num>({count} s)</num>', other: 'Esperando al anfitrión…<num>({count} s)</num>' },
  },
} satisfies Catalog['reveal']
