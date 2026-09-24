// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18.304"); plural forms are
// chosen by the score itself. Uppercase comes from CSS: write normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row (≈ 4 characters). */
  you: 'Tú',
  didNotPlay: 'Sin jugar',
  /** Round shorthand on covers and table rows ("R3"). */
  roundShort: 'R{round}',
  roundCount: { one: '{count} ronda', other: '{count} rondas' },

  topBar: {
    gameOver: 'Fin de partida',
  },

  hero: {
    /** Three animated dots follow it. */
    teaser: 'Y gana',
  },

  /** Huge display type: keep titles ≈ 16 characters. */
  headline: {
    over: '¡Fin de partida!',
    noPlayers: 'Nadie en la clasificación.',
    soloZero: '¡Cero puntos!',
    soloZeroSub: 'Vuelve a intentarlo: la próxima la ordenas.',
    soloGreat: '¡Magistral!',
    soloGood: '¡Bien jugado!',
    soloOk: '¡Fin de partida!',
    /** {rounds} is headline.rounds. */
    pointsInRounds: { one: '{points} punto en {rounds}', other: '{points} puntos en {rounds}' },
    rounds: { one: '{count} ronda', other: '{count} rondas' },
    allZero: '¡Empate a cero!',
    allZeroSub: 'Ni un punto esta vez: juega otra y desquítate.',
    tie: '¡Empate!',
    tieWithMe: 'Compartes la victoria con {names}',
    tieOthers: '{names} comparten la victoria',
    youWin: '¡Victoria!',
    youWinPoints: { one: '{points} punto', other: '{points} puntos' },
    youWinLead: { one: '{points} punto · +{gap} sobre {name}', other: '{points} puntos · +{gap} sobre {name}' },
    youWinFaster: 'Empatas a puntos con {name}, pero ganas en velocidad',
    theyWin: '¡{name} gana!',
    sameScore: 'Mismos puntos que {name}: gana quien confirma antes',
    /** {rank} is an ordinal (ui.ordinal: "2.º"). */
    myRank: { one: 'Quedas {rank} de {total} con {points} punto', other: 'Quedas {rank} de {total} con {points} puntos' },
  },

  dock: {
    label: 'Acciones',
    leave: 'Salir',
    /** Host: back to the lobby with the same players. Short. */
    playAgain: 'Otra partida',
    rematch: '¡Revancha!',
    /** Right after tapping «¡Revancha!» (agrees with «revancha»). Short: shares the row with «Salir». */
    rematchSent: '¡Pedida!',
    waiting: 'Esperando al anfitrión para la revancha…',
    rematchNamed: { one: '¡{names} quiere la revancha!', other: '¡{names} quieren la revancha!' },
    rematchMany: { one: '¡{count} jugador quiere la revancha!', other: '¡{count} jugadores quieren la revancha!' },
  },

  leaveDialog: {
    title: '¿Cerrar la sala?',
    body: {
      one: 'El otro jugador se desconectará y ya no se podrá jugar la revancha.',
      other: 'Los otros {count} jugadores se desconectarán y ya no se podrá jugar la revancha.',
    },
    cancel: 'Cancelar',
    confirm: 'Cerrar sala',
  },

  podium: {
    label: 'Podio',
    slot: { one: '{rank} puesto: {name}, {points} punto', other: '{rank} puesto: {name}, {points} puntos' },
    slotMe: { one: '{rank} puesto: {name} (tú), {points} punto', other: '{rank} puesto: {name} (tú), {points} puntos' },
    cheer: 'Celebrar a {name}',
  },

  standings: {
    title: 'Clasificación',
    players: { one: '{count} jugador', other: '{count} jugadores' },
    position: 'Posición {rank}',
    offline: 'Sin conexión',
    perfectRounds: 'Rondas perfectas',
    accuracy: 'Fragmentos en su lugar, en promedio',
    avgTime: 'Tiempo promedio para confirmar',
    lateFrom: 'desde la ronda {round}',
    points: { one: 'punto', other: 'puntos' },
  },

  /** Titles are small display type in a half-width card on phones: short. */
  awards: {
    title: 'Premios',
    aside: 'Menciones especiales',
    nameAndOthers: { one: '{name} y uno más', other: '{name} y {count} más' },
    goldenEar: {
      title: 'Oído de oro',
      description: 'Más rondas perfectas',
      value: { one: '{count} ronda perfecta', other: '{count} rondas perfectas' },
    },
    lightning: {
      title: 'Rayo',
      description: 'Confirmación más rápida en las rondas con puntos',
      value: '{time} en promedio',
    },
    sniper: {
      title: 'Francotirador',
      description: 'Más fragmentos en su lugar',
      value: '{accuracy} en promedio',
    },
    lastSecond: {
      title: 'Último segundo',
      description: 'Más rondas sin confirmar a tiempo',
      /** Mono line under the name, ~15 characters on phones: the description says what is counted. */
      value: { one: '{count} ronda', other: '{count} rondas' },
    },
  },

  rounds: {
    title: 'Ronda a ronda',
    scrollLabel: 'Puntos por ronda; desliza para ver a todos los jugadores',
    caption: 'Puntos de cada jugador en cada ronda',
    song: 'Canción',
    fallbackTitle: 'Ronda {round}',
    best: 'Mejor de la ronda',
    /** Narrow cell (≈ 70px, tiny uppercase) and legend. */
    perfect: 'Perfecto',
    timedOut: 'Tiempo agotado',
    total: 'Total',
  },

  songs: {
    title: 'Las canciones',
    aside: 'Vuelve a escucharlas aquí o en Deezer',
    play: 'Escuchar la vista previa de {title}, de {artist}, ronda {round}',
    stop: 'Detener la vista previa de {title}, de {artist}, ronda {round}',
    open: 'Abrir {title} en Deezer (pestaña nueva)',
    openTooltip: 'Abrir en Deezer',
    unavailable: 'Vista previa no disponible',
  },

  units: {
    /** Keep the no-break space before the unit. */
    seconds: '{value} s',
  },
} satisfies Catalog['final']
