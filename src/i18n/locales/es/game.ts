// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'Barajando la playlist…',
    slicing: 'Haciendo pedazos el hit…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'Esperando a que todos estén listos…',
  },
  host: {
    noPlaylist: 'Elige una playlist antes de empezar.',
    alreadyStarted: 'La partida ya está en marcha.',
    closed: 'La sala está cerrada.',
    playlistFailed: 'No se puede cargar la playlist de Deezer. Revisa la conexión e inténtalo de nuevo.',
    prepareFailed: 'No se pudieron preparar las canciones de esta playlist; volvemos al lobby. Prueba con otra playlist.',
    notEnoughTracks: 'Esta playlist no tiene suficientes canciones con vista previa (hacen falta al menos {count}).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Jugador',
    /** {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: 'Playlist {id}',
  },
  store: {
    invalidCode: 'Código de sala no válido.',
    cancelled: 'Operación cancelada.',
    hostLost: 'Conexión con el anfitrión perdida.',
    hostGone: 'El anfitrión ya no está en la partida.',
    welcomeTimeout: 'El anfitrión no responde. Inténtalo de nuevo en un momento.',
    joinFailed: 'No fue posible unirse a la sala. Inténtalo de nuevo.',
    createFailed: 'No se pudo crear la sala. Inténtalo de nuevo.',
    startFailed: 'No se pudo iniciar la partida.',
    rejected: 'El anfitrión ha rechazado la conexión.',
    signalingLost: 'Conexión con el servidor perdida: no pueden unirse jugadores nuevos.',
    actionFailed: 'No se pudo completar la acción.',
    audioUnavailable: 'El audio de esta ronda no está disponible, pero puedes jugar igualmente.',
    audioUnavailableTitled: 'El audio de «{title}» no está disponible.',
  },
  net: {
    network: 'No hay conexión de red. Revisa la conexión e inténtalo de nuevo.',
    server: 'El servidor de conexión no responde. Inténtalo de nuevo en unos segundos.',
    signaling: 'No se puede contactar con el servidor de conexión. Inténtalo en un momento o cambia de red (wifi o datos móviles).',
    createTimeout: 'El servidor de conexión no responde. Inténtalo de nuevo en unos segundos.',
    joinTimeout: 'No se puede conectar con el anfitrión. Inténtalo de nuevo; si no funciona, prueba con otra red (wifi o datos móviles).',
    hostNoAnswer: 'El anfitrión no responde. Revisa el código o inténtalo de nuevo en un momento.',
    roomNotFound: 'Sala no encontrada. Revisa el código.',
    invalidCode: 'Código de sala no válido. Son 5 letras, por ejemplo KXQPM.',
    unsupported: 'Este navegador no admite conexiones peer-to-peer (WebRTC). Prueba con una versión actualizada de Chrome, Safari o Firefox.',
    loadFailed: 'No se pudo cargar el módulo de red. Recarga la página.',
    unknown: 'Error de conexión inesperado. Inténtalo de nuevo.',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'Sala no encontrada. Revisa el código.',
      network: 'Problema de red. Revisa la conexión e inténtalo de nuevo.',
      server: 'No se puede contactar con el servidor de conexión. Inténtalo en un momento.',
      timeout: 'Sin respuesta del servidor de conexión. Inténtalo de nuevo.',
      unsupported: 'Tu navegador no admite conexiones peer-to-peer (WebRTC).',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'La sala está llena.',
    version: 'Tu versión del juego no coincide con la del anfitrión. Recarga la página.',
    kicked: 'El anfitrión te ha expulsado de la sala.',
    closed: 'El anfitrión ha cerrado la sala.',
    duplicate: 'Tu perfil ya está en esta sala desde otra pestaña u otro dispositivo.',
  },
  deezer: {
    timeout: 'Deezer no responde. Revisa la conexión e inténtalo de nuevo.',
    network: 'No se puede contactar con Deezer. Revisa la conexión (o tu bloqueador de anuncios, si usas uno) e inténtalo de nuevo.',
    invalid: 'Respuesta inesperada de Deezer. Inténtalo de nuevo en un momento.',
    quota: 'Demasiadas solicitudes a Deezer en poco tiempo. Espera unos segundos e inténtalo de nuevo.',
    busy: 'Deezer está saturado en este momento. Inténtalo de nuevo en un rato.',
    notFound: 'Contenido no encontrado en Deezer.',
    forbidden: 'Contenido no accesible: puede ser privado o no estar disponible en tu país.',
    badRequest: 'Solicitud no válida para Deezer.',
    api: 'Error de Deezer. Inténtalo de nuevo en un momento.',
    playlistNotFound: 'Playlist no encontrada: revisa el enlace (las playlists privadas no son accesibles).',
    noPreview: 'Vista previa no disponible para esta canción.',
    trackNotFound: 'Esta canción ya no está disponible en Deezer.',
    featured: 'No se pudieron cargar las playlists destacadas.',
    /** Stand-ins for empty Deezer fields (in the host's language), shown as a title / artist. */
    fallback: {
      playlist: 'Playlist sin título',
      track: 'Sin título',
      artist: 'Artista desconocido',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16); lowercased in the lobby dock. */
  difficulty: {
    easy: 'Fácil',
    normal: 'Normal',
    hard: 'Difícil',
    insane: 'Locura',
  },
  cut: {
    beat: 'Bisturí',
    free: 'Hacha',
  },
} satisfies Catalog['game']
