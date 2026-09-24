// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button. Short: ~16 characters. */
  start: 'Empezar partida',
  players: { one: '<num>{count}</num> jugador', other: '<num>{count}</num> jugadores' },
  tracks: { one: '<num>{count}</num> canción', other: '<num>{count}</num> canciones' },
  cancel: 'Cancelar',

  header: {
    /** Small pill next to the logo. "Lobby" is the usual gamer word in Spanish. */
    badge: 'Lobby',
  },

  leave: {
    closeRoom: 'Cerrar sala',
    exit: 'Salir',
    exitRoom: 'Salir de la sala',
    hostTitle: '¿Cerrar la sala?',
    guestTitle: '¿Salir de la sala?',
    hostBody: 'La sala es tuya: si sales, se cierra y todos los demás jugadores se desconectarán.',
    hostAloneBody: 'La sala se cerrará.',
    guestBody: 'Podrás volver a entrar con el código {code} mientras la partida no haya empezado.',
    stay: 'Quedarme',
  },

  /** Phone tabs: ~10 characters. */
  tabs: {
    label: 'Secciones del lobby',
    players: 'Jugadores',
    playlist: 'Playlist',
    rules: 'Reglas',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, por elegir',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { one: '{tab}, {count} jugador', other: '{tab}, {count} jugadores' },
  },

  invite: {
    linkCopied: '¡Enlace de la sala copiado!',
    copyFailed: 'No se pudo copiar: usa el botón QR para ver el enlace.',
    /** The join link follows it. */
    shareText: '¡Te reto a UNSHUFFLE! Únete a la sala {code}:',
  },

  code: {
    title: 'Código de sala',
    clickToCopy: 'Haz clic para copiarlo',
    tapToCopy: 'Toca para copiarlo',
    copied: '¡Código copiado!',
    copyFailed: 'No se pudo copiar',
    copyLabel: 'Código de sala {code}. Copiar código',
    /**
     * Short (phones: shares a row with «Compartir» and the QR button, ~130px at 360).
     * «link» here on purpose: «Copiar enlace» does not fit; «Copiar» alone would read as copying the code.
     */
    copyLink: 'Copiar link',
    linkCopied: '¡Copiado!',
    share: 'Compartir',
    showQr: 'Mostrar código QR',
    enlargeQr: 'Ampliar código QR',
    phoneTitle: 'Únete desde el teléfono',
    phoneBody: 'Escanea el QR o abre el enlace: entras al instante, sin cuenta.',
  },

  qr: {
    title: 'Invita a tus amigos',
    description: 'Escanea el QR con la cámara del teléfono o comparte el enlace.',
    code: 'Código',
    copy: 'Copiar',
    copied: 'Copiado',
    copyFailed: 'No se pudo copiar: selecciona el enlace y cópialo a mano.',
    shareLink: 'Compartir enlace',
    imageLabel: 'Código QR para unirse a la sala',
  },

  roster: {
    title: 'Jugadores',
    online: { one: '<num>{count}</num> en línea', other: '<num>{count}</num> en línea' },
    capacity: { one: '{count} jugador de {max}', other: '{count} jugadores de {max}' },
    listLabel: 'Lista de jugadores',
    /** Very short badges. */
    you: 'Tú',
    host: 'Anfitrión',
    reconnecting: 'Reconectando…',
    editProfile: 'Editar perfil',
    kickLabel: 'Expulsar a {name}',
    freeSeats: { one: '<num>{count}</num> lugar libre', other: '<num>{count}</num> lugares libres' },
    invite: 'Invitar',
    kick: {
      title: '¿Expulsar a {name}?',
      titleFallback: '¿Expulsar al jugador?',
      body: 'Saldrá de la sala al instante y no podrá volver a entrar.',
      confirm: 'Expulsar',
    },
  },

  profile: {
    title: 'Tu perfil',
    name: 'Nombre',
    namePlaceholder: '¿Cómo te llamas?',
    nameRequired: 'Escribe al menos un carácter.',
    save: 'Guardar',
  },

  picker: {
    title: 'Elige la playlist',
    source: 'Canciones de Deezer · vistas previas de 30 segundos',
    searchLabel: 'Buscar playlists',
    /** Must fit ~215px on 360px phones: «…un enlace de Deezer» was cut. */
    searchPlaceholder: 'Busca o pega un enlace',
    searching: 'Buscando',
    clear: 'Borrar búsqueda',
    featured: 'Destacadas',
    fromLink: 'Desde tu enlace',
    resultsFor: 'Resultados para «{query}»',
    count: { one: '{count} playlist', other: '{count} playlists' },
    loading: 'Cargando…',
    invalidLink: 'Enlace no válido',
    pickedFromLink: 'Playlist elegida desde el enlace',
    retry: 'Reintentar',
    /** Hover label on a cover. Very short. */
    pick: 'Elegir',
    tracksTooShort: { one: '<num>{count}</num> canción · muy corta', other: '<num>{count}</num> canciones · muy corta' },
    tracksBy: { one: '<num>{count}</num> canción · {creator}', other: '<num>{count}</num> canciones · {creator}' },
    chips: 'Categorías',
    chipsPrev: 'Categorías anteriores',
    chipsNext: 'Más categorías',
    shortLink: {
      title: 'Pega el enlace completo de la playlist',
      body: 'Los enlaces cortos (link.deezer.com) no se pueden abrir desde aquí. Ábrelo en el navegador o en la app de Deezer y copia la dirección completa: deezer.com/…/playlist/123456.',
    },
    foreignLink: {
      title: 'Este enlace no es una playlist',
      body: 'Pega el enlace de una playlist pública de Deezer, como deezer.com/es/playlist/123456, o busca por nombre, artista o género.',
    },
    notFound: {
      title: 'Playlist no encontrada',
      body: 'Revisa el enlace (las playlists privadas no son accesibles).',
    },
    offline: 'Deezer no responde',
    empty: {
      title: 'Sin playlists',
      titleFor: 'No hay playlists para «{query}»',
      body: 'Prueba con un artista, un género o una década, o pega el enlace de una playlist de Deezer.',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: 'Playlist elegida',
    /** Small label above the title (uppercase). */
    eyebrow: 'Playlist',
    none: 'Sin playlist',
    incoming: 'Playlist en camino',
    by: 'de {creator}',
    hostEmpty: 'Busca una playlist, toca una categoría o pega un enlace de Deezer.',
    guestEmpty: 'Aparecerá aquí en cuanto el anfitrión la elija: prepara los oídos.',
    change: 'Cambiar',
  },

  rules: {
    title: 'Reglas',
    duration: 'Duración máx. <num>~{minutes} min</num>',
    /** Guests: short pill. */
    hostDecides: 'Lo decide el anfitrión',
    /** Option label, e.g. "90s": very short (4 options share a row). */
    seconds: '{seconds}s',
    snippetsOption: '{snippets} · {difficulty}',
    rounds: { title: 'Rondas', hint: 'Una canción por ronda' },
    snippets: { title: 'Fragmentos', hint: 'Más piezas, más difícil' },
    roundTime: { title: 'Tiempo por ronda', hint: 'Para ordenar' },
    /** Hints are one short line next to the title (~110px on 360px phones). */
    finalTimer: { title: 'Temporizador final', hint: 'Si alguien confirma' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: 'Cómo se juega',
    perfect: 'Orden perfecto = <num>{points}</num> puntos',
    listen: {
      title: 'Escucha',
      bodyClick: {
        one: 'Cada canción se corta en {count} fragmento. Haz clic en un bloque para escucharlo.',
        other: 'Cada canción se corta en {count} fragmentos barajados. Haz clic en un bloque para escucharlo.',
      },
      bodyTap: {
        one: 'Cada canción se corta en {count} fragmento. Toca un bloque para escucharlo.',
        other: 'Cada canción se corta en {count} fragmentos barajados. Toca un bloque para escucharlo.',
      },
    },
    reorder: {
      title: 'Ordena',
      body: 'Arrastra los bloques hasta que la canción vuelva a sonar bien. Con ▶ la escuchas entera, en tu orden.',
    },
    confirm: {
      title: 'Confirma',
      body: {
        one: 'Quien confirma primero activa el temporizador final: a los demás les queda {count} segundo.',
        other: 'Quien confirma primero activa el temporizador final: a los demás les quedan {count} segundos.',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5 rondas · 8 fragmentos (normal) · 90s".
    rounds: { one: '<num>{count}</num> ronda', other: '<num>{count}</num> rondas' },
    snippets: { one: '<num>{count}</num> fragmento', other: '<num>{count}</num> fragmentos' },
    snippetsLevel: { one: '<num>{count}</num> fragmento ({difficulty})', other: '<num>{count}</num> fragmentos ({difficulty})' },
    roundTime: '<num>{seconds}s</num>',
    /** Animated dots follow: no final punctuation. */
    waitingStart: 'Esperando al anfitrión',
    /** Animated dots follow: no final punctuation. */
    waitingPlaylist: 'El anfitrión elige la playlist',
    pickPlaylist: 'Elige una playlist para empezar',
    solo: 'También puedes jugar en solitario',
    noPlaylist: 'Sin playlist',
    /** Short button. */
    playRounds: { one: 'Jugar {count} ronda', other: 'Jugar {count} rondas' },
    shortfall: {
      one: 'Playlist demasiado corta: tiene <num>{count}</num> canción y hacen falta <num>{need}</num>.',
      other: 'Playlist demasiado corta: tiene <num>{count}</num> canciones y hacen falta <num>{need}</num>.',
    },
    shortfallMin: {
      one: 'Playlist demasiado corta: solo tiene <num>{count}</num> canción y hacen falta al menos <num>{min}</num>.',
      other: 'Playlist demasiado corta: solo tiene <num>{count}</num> canciones y hacen falta al menos <num>{min}</num>.',
    },
  },

  /**
   * Category chips above the picker: label, Deezer playlist search, emoji.
   * Every query checked on api.deezer.com/search/playlist (Sept 2026): the top
   * results are real playlists with 40+ tracks.
   */
  chips: [
    { label: 'Éxitos del momento', query: 'top éxitos', emoji: '🔥' },
    { label: 'Hits latinos', query: 'latin hits', emoji: '🌎' },
    { label: 'Reguetón', query: 'reggaeton', emoji: '🌴' },
    { label: 'Pop en español', query: 'pop en español', emoji: '🎶' },
    { label: 'Rap en español', query: 'rap en español', emoji: '🎤' },
    { label: 'Rock en español', query: 'rock en español', emoji: '🎸' },
    { label: 'Años 2000', query: '00s hits', emoji: '💿' },
    { label: 'Años 90', query: '90s hits', emoji: '📼' },
    { label: 'Años 80', query: '80s hits', emoji: '🕺' },
    { label: 'Años 70', query: '70s hits', emoji: '🪩' },
    { label: 'Baladas', query: 'baladas en español', emoji: '💘' },
    { label: 'Salsa y bachata', query: 'salsa y bachata', emoji: '🎺' },
    { label: 'Cumbia', query: 'cumbia', emoji: '🪇' },
    { label: 'Regional mexicano', query: 'regional mexicano', emoji: '🤠' },
    { label: 'Flamenco pop', query: 'flamenco pop', emoji: '💃' },
    { label: 'Rock clásico', query: 'rock classics', emoji: '🤘' },
    { label: 'Dance / EDM', query: 'dance hits', emoji: '🎧' },
  ],

  /**
   * Featured shelf: Deezer playlist ids, in shelf order. Country tops first, then
   * Latin editorial picks, then worldwide ones. All public, 49+ tracks, previews
   * on almost every track (checked Sept 2026).
   */
  featured: [
    1116190041, // Top Spain — Deezer Charts
    1111142361, // Top Mexico — Deezer Charts
    1279119721, // Top Argentina — Deezer Charts
    1116188451, // Top Colombia — Deezer Charts
    1279119121, // Top Chile — Deezer Charts
    3155776842, // Top Worldwide — Deezer Charts
    2025681806, // Top hits Latinoamérica — Deezer LATAM
    178699142, // Fuego Latino — Deezer Latin
    1273315391, // Reggaeton Hits — Deezer Latin
    9185904182, // Esenciales Pop en español — Deezer LATAM
    1711617923, // Rock en español — Deezer LATAM
    1363560485, // Deezer Hits
  ],
} satisfies Catalog['lobby']
