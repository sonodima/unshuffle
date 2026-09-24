// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Keyboard key names, as printed on the key caps. */
  keys: {
    space: 'Espacio',
    enter: 'Enter',
    ctrl: 'Ctrl',
  },
  /** Short: sits next to an error. */
  retry: 'Reintentar',

  preparing: {
    /** <b> = current round, <dim> = " / total". */
    header: 'Ronda <b>{number}</b><dim> / {total}</dim>',
    allReady: '¡Todo listo, empezamos!',
    waiting: 'Esperando a que todos estén listos…',
    fallback: 'Preparando la ronda…',
    steps: {
      songActive: 'Eligiendo la canción…',
      songDone: 'Canción elegida',
      songDetail: 'Alto secreto hasta el final',
      downloadActive: 'Descargando los fragmentos…',
      downloadDone: 'Fragmentos descargados',
      downloadError: 'Error en la descarga',
      downloadErrorDetail: 'Se puede jugar sin audio',
      sliceActive: 'Rebanando la pista…',
      sliceDone: 'Pista rebanada',
      /** Cut on the beat. One line, ~35 characters. */
      sliceDetail: { one: '{count} fragmento al compás', other: '{count} fragmentos al compás' },
      sliceDetailFree: { one: '{count} fragmento a hachazos', other: '{count} fragmentos a hachazos' },
    },
    /** Small uppercase label. <b> = ready players, <dim> = "/total". */
    ready: 'Listos <b>{ready}</b><dim>/{total}</dim>',
    readyPlayers: 'Jugadores listos',
  },

  /** Rotating tips (one at a time, ~2 lines on phones). */
  tips: {
    title: '¿Lo sabías?',
    howToHover: 'Haz clic en un bloque para escucharlo y arrástralo para moverlo.',
    howToTouch: 'Toca un bloque para escucharlo y arrástralo para moverlo.',
    /** «Escuchar todo» is board.transport.playAll. */
    playAll: '«Escuchar todo» reproduce los bloques en el orden actual: si fluye, ya casi lo tienes.',
    hold: 'Mantén presionado un bloque para escuchar la secuencia desde ahí.',
    pairs: 'Dos bloques vecinos en el orden correcto suman puntos aunque estén fuera de lugar.',
    firstConfirm: 'Quien confirma primero activa el temporizador final para todos.',
    edges: 'Busca el arranque de la canción y el punto donde se apaga: son los primeros y los últimos bloques.',
    cleaver: 'Con el hacha, los cortes caen a mitad de palabras y notas: busca el bloque que las completa.',
    perfect: 'Orden perfecto = {points} puntos. Sin presión.',
  },

  intro: {
    lastRound: 'Última ronda',
    headlineLabel: 'Ronda {number} de {total}',
    /** Huge one-line headline: <word> white, <n> the round number, <total> "/total". */
    headline: '<word>Ronda</word> <n>{number}</n><total>/{total}</total>',
    rulesLabel: 'Reglas de la ronda',
    snippets: { one: '<b>{count}</b> fragmento', other: '<b>{count}</b> fragmentos' },
    seconds: '<b>{seconds}</b> s',
    spectator: 'Esta ronda te toca mirar: jugarás a partir de la siguiente.',
    howToHover: 'Haz clic en un bloque para escucharlo y luego arrástralo a su lugar.',
    howToTouch: 'Toca un bloque para escucharlo y luego arrástralo a su lugar.',
    /** Inside the countdown ring before "3" (small, uppercase). */
    ready: '¿Listos?',
    readyLabel: 'Listos',
    countdownLabel: 'Empezamos en {seconds}',
  },

  /** Full-screen slam: 1 word, huge type. */
  go: '¡Ya!',
  syncing: 'Sincronizando la ronda…',

  /** Tiny uppercase eyebrows: short. */
  hud: {
    round: 'Ronda',
    snippets: 'Fragmentos',
    points: 'Puntos',
    /** Inside the timer ring (1 short word): normal / after the first confirm. */
    time: 'Tiempo',
    finalTime: 'Final',
    lastSeconds: 'Últimos segundos',
    confirmed: 'Confirmados {done}/{total}',
    /** {rank} is an ordinal (ui.ordinal: "1.º"). */
    rank: '{rank} puesto',
    players: 'Jugadores de la ronda',
  },

  players: {
    me: '{name} (tú)',
    more: { one: 'y uno más', other: 'y {count} más' },
  },

  /** The final-countdown banner in the HUD. */
  banner: {
    someone: 'Alguien',
    mine: '¡Has confirmado primero!',
    /** On phones only the name is shortened (one line). */
    confirmedBy: '¡<name>{name}</name> ha confirmado!',
    /** <n> is the live seconds count. */
    othersLeft: 'A los demás les quedan <n>{seconds}</n> s',
    youLeft: { one: 'Te queda <n>{count}</n> segundo', other: 'Te quedan <n>{count}</n> segundos' },
    finalTimer: 'Temporizador final: <n>{seconds}</n> s',
  },

  /** Bottom dock. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: 'Confirmar',
    unchanged: 'Aún no has movido nada',
    armTap: 'Toca otra vez para confirmar',
    armClick: 'Haz clic otra vez para confirmar',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: 'Presiona otra vez {mod} + {enter}',
    confirmed: 'Confirmado',
    queued: 'Se enviará al reconectar',
    waitingFor: 'Esperando a {names}',
    waitingForCount: { one: 'Esperando a {count} jugador', other: 'Esperando a {count} jugadores' },
    allConfirmed: '¡Todos han confirmado!',
    stillPlaying: 'Todavía en juego',
    timeUp: '¡Se acabó el tiempo!',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: 'Tu último orden es el que vale',
    computing: 'Calculando los resultados…',
    spectator: 'Modo espectador',
    spectatorBody: 'Jugarás a partir de la siguiente ronda',
    audioFailed: 'Audio no disponible',
    audioFailedBody: 'Reintenta o juega de todos modos',
    retryAudio: 'Volver a descargar el audio',
    /** Keyboard legend. <kbd> = a key cap, <action> = the action label after a combination. */
    hints: {
      playAll: '<kbd>{space}</kbd> escuchar todo',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>confirmar</action>',
      pointer: 'Haz clic en un bloque para escucharlo · mantenlo presionado para escuchar desde ahí · arrástralo para moverlo',
      pointerLocked: 'Haz clic en un bloque para escucharlo · mantenlo presionado para escuchar desde ahí',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: 'Estás mirando',
    bodyHover: 'Jugarás a partir de la siguiente ronda. Mientras tanto, haz clic en los bloques para escuchar los fragmentos.',
    bodyTouch: 'Jugarás a partir de la siguiente ronda. Mientras tanto, toca los bloques para escuchar los fragmentos.',
  },

  /** In-game exit menu (sheet). */
  menu: {
    endButton: 'Terminar partida',
    leaveButton: 'Salir de la partida',
    hostTitle: '¿Terminar la partida?',
    guestTitle: '¿Salir de la partida?',
    hostBody: 'La sala es tuya: la partida se detiene para todos.',
    hostAloneBody: 'La partida termina aquí.',
    guestBody: 'La partida sigue sin ti. Mientras esté en curso, puedes volver y recuperar tu puntuación.',
    keepPlaying: 'Seguir jugando',
    stay: 'Quedarme',
    leave: 'Salir de la partida',
    toLobby: 'Volver al lobby',
    toLobbyBody: 'Puntos a cero, mismos jugadores: nueva playlist y a empezar.',
    toLobbyAloneBody: 'Puntuación a cero: cambia de playlist y vuelve a empezar.',
    close: 'Cerrar la sala',
    closeBodyOne: 'El otro jugador se desconectará.',
    closeBodyMany: 'Todos los demás jugadores se desconectarán.',
    closeAloneBody: 'Vuelves al inicio.',
    rejoinCode: 'Código para volver',
  },
} satisfies Catalog['round']
