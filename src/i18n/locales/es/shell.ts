// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  action: {
    home: 'Volver al inicio',
    retry: 'Reintentar',
    ok: 'Aceptar',
    cancel: 'Cancelar',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE; {code} a room code. */
  title: {
    lobby: '{brand} · Lobby',
    lobbyRoom: '{brand} · Lobby {code}',
    round: '{brand} · Ronda',
    roundOf: '{brand} · Ronda {round}/{rounds}',
    roundReveal: '{brand} · Ronda {round}/{rounds} · Resultados',
    roundPreparing: '{brand} · Ronda {round}/{rounds} · Preparación',
    final: '{brand} · Clasificación final',
    lost: '{brand} · Conexión perdida',
  },

  /** Floating status pill (phones ~230px): titles ≤ 24 characters, details ≤ 40. */
  banner: {
    dismiss: 'Ocultar aviso',
    elapsed: '{seconds}s',
    hostReconnecting: 'Buscando el servidor…',
    hostReconnectingDetail: 'La partida continúa',
    connecting: 'Reconectando…',
    lost: 'Conexión perdida',
    lostDetail: 'Intentando reconectar…',
    lostDetailLong: 'Reintentando… volverás automáticamente.',
    hostSilent: 'El anfitrión no responde',
    hostSilentDetail: 'Esperando a que vuelva…',
    leave: 'Salir',
    signalingTitle: 'Nuevas entradas en pausa',
    signalingDetail: 'Servidor de conexión perdido: quien ya está dentro sigue jugando.',
    warning: 'Atención',
  },

  dialogRoom: 'Sala <b>{code}</b>',

  lost: {
    title: 'Conexión perdida',
    hostClosedTitle: 'El anfitrión ha cerrado la sala',
    hostLeftTitle: 'El anfitrión ha abandonado la partida',
    hostGoneDescription: 'La sala ya no está disponible.',
    hostGoneHintFinal: 'La partida ya había terminado: crea una sala nueva para la revancha.',
    noRetryDescription: 'Se ha cortado la conexión con la sala.',
    noRetryHint: 'Revisa la conexión y vuelve a intentarlo desde el inicio.',
    descriptionLobby: 'El anfitrión no responde: quizá ha cerrado la sala.',
    description: 'El anfitrión no responde desde hace un rato.',
    hintLobby: 'Inténtalo de nuevo en un momento, o vuelve al inicio y crea tu propia sala.',
    hintGame: 'Si el anfitrión sigue en la partida, al volver a entrar retomas desde donde estabas, con tu puntuación.',
    hintFinal: 'Si el anfitrión sigue conectado, al volver a entrar podrás jugar la revancha.',
  },

  exit: {
    kicked: {
      title: 'Fuera de la sala',
      hint: 'Siempre puedes crear tu propia sala o unirte con otro código.',
    },
    closed: {
      title: 'Sala cerrada',
      hint: 'La partida ha terminado para todos. Crea una sala nueva o únete con otro código.',
    },
    duplicate: {
      title: 'Ya estás en la partida',
      hint: 'Cierra la otra pestaña para jugar desde aquí.',
    },
    gone: {
      title: 'La sala ya no está disponible',
      description: 'El anfitrión ha cerrado la sala o ha perdido la conexión.',
      hint: 'Crea una sala nueva desde el inicio o únete con otro código.',
    },
    failed: {
      title: 'No se pudo volver a entrar',
      hint: 'Revisa la conexión y vuelve a intentarlo con el código desde el inicio.',
    },
    generic: {
      title: 'Estás fuera de la sala',
      hint: 'Puedes volver a entrar con el mismo código desde el inicio.',
    },
  },

  resume: {
    title: 'Reconectando',
    host: 'Reabriendo tu sala',
    hostRoom: 'Reabriendo tu sala <b>{code}</b>',
    client: 'Volviendo a la sala',
    clientRoom: 'Volviendo a la sala <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'La sala <b>{code}</b> ya no existe. {hint}',
    failedRoom:
      'No se pudo volver a la sala <b>{code}</b>. Si la partida sigue en curso, vuelve a entrar con el código desde el inicio.',
    failed: 'Si la partida sigue en curso, vuelve a entrar con el código desde el inicio.',
  },

  crash: {
    eyebrow: 'Error inesperado',
    title: 'Algo salió mal',
    body: 'Se rayó el disco. Recarga la página: si estabas en una sala, intentaré llevarte de vuelta.',
    reload: 'Recargar',
    showDetails: 'Detalles técnicos',
    hideDetails: 'Ocultar detalles',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    someone: 'Un jugador',
    joined: '{name} se une a la sala',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { one: '{count} jugador en la sala', other: '{count} jugadores en la sala' },
    left: '{name} ha salido de la sala',
    submitted: '{name} ha confirmado',
    lastSeconds: { one: '¡Último segundo para todos!', other: '¡Últimos {count} segundos para todos!' },
    lastSecondsSoon: '¡Últimos segundos para todos!',
    kicked: 'El anfitrión ha expulsado a {name}',
    kickedSomeone: 'El anfitrión ha expulsado a un jugador',
  },

  audioCue: {
    tapToListen: 'Toca para escuchar la canción',
    clickToListen: 'Haz clic para escuchar la canción',
    tapToEnable: 'Toca para activar el audio',
    clickToEnable: 'Haz clic para activar el audio',
    tapBody: 'El navegador mantiene el audio en pausa hasta que toques la pantalla.',
    clickBody: 'El navegador mantiene el audio en pausa hasta que interactúes con la página.',
  },

  sound: {
    button: 'Audio',
    buttonMuted: 'Audio desactivado',
    buttonLocked: 'Audio bloqueado por el navegador: toca para activarlo',
    panel: 'Opciones de audio',
    heading: 'Audio',
    /** Next to the "M" key badge. */
    muteShortcut: 'Silenciar',
    mute: 'Desactivar audio',
    unmute: 'Activar audio',
    volume: 'Volumen',
    sfx: 'Efectos de sonido',
    sfxDetail: 'Clics, temporizador, reacciones',
    /** Small pill (one line). */
    unlock: 'Activar audio',
    unlockTitle: 'El navegador bloquea el audio hasta que toques la página',
  },

  reactions: {
    group: 'Reacciones',
    button: 'Reacción: {name}',
    you: 'Tú',
    names: {
      fire: 'Fuego',
      laugh: 'Risa',
      shock: 'Asombro',
      clap: 'Aplausos',
      dead: 'Me muero de risa',
      party: 'Fiesta',
      mindBlown: 'Me explota la cabeza',
      cool: 'Genial',
      rematch: 'Revancha',
    },
  },

  leaveWarning: 'Si sales, la partida termina para todos',
} satisfies Catalog['shell']
