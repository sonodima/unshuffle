// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'Shuffling the playlist…',
    slicing: 'Chopping up the hit…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'Waiting for everyone to be ready…',
  },
  host: {
    noPlaylist: 'Pick a playlist before you start.',
    alreadyStarted: 'The game has already started.',
    closed: 'The room has been closed.',
    playlistFailed: 'Couldn’t load the playlist from Deezer. Check your connection and try again.',
    prepareFailed: 'Couldn’t get this playlist’s songs ready, so it’s back to the lobby. Try a different playlist.',
    notEnoughTracks: 'This playlist doesn’t have enough tracks with a preview (you need at least {count}).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Player',
    /** Name of a playlist whose title is missing. {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: 'Playlist {id}',
  },
  store: {
    invalidCode: 'Invalid room code.',
    cancelled: 'Canceled.',
    hostLost: 'Lost the connection to the host.',
    hostGone: 'The host left the game.',
    welcomeTimeout: 'The host isn’t responding. Try again in a moment.',
    joinFailed: 'Couldn’t join the room. Try again.',
    createFailed: 'Couldn’t create the room. Try again.',
    startFailed: 'Couldn’t start the game.',
    rejected: 'The host turned down the connection.',
    signalingLost: 'Lost the connection to the server: new players can’t join.',
    actionFailed: 'That didn’t work.',
    audioUnavailable: 'Audio isn’t available for this round, but you can still play.',
    audioUnavailableTitled: 'Audio for “{title}” isn’t available.',
  },
  net: {
    network: 'No network connection. Check your connection and try again.',
    server: 'The connection server isn’t responding. Try again in a few seconds.',
    signaling: 'Can’t reach the connection server. Try again soon or switch networks (Wi‑Fi or mobile data).',
    createTimeout: 'The connection server isn’t responding. Try again in a few seconds.',
    joinTimeout: 'Couldn’t reach the host. Try again; if that doesn’t work, try another network (Wi‑Fi or mobile data).',
    hostNoAnswer: 'The host isn’t answering. Check the code, or try again in a moment.',
    roomNotFound: 'Room not found. Check the code.',
    invalidCode: 'Invalid room code. It’s 5 letters, like KXQPM.',
    unsupported: 'This browser doesn’t support peer-to-peer connections (WebRTC). Try an up-to-date Chrome, Safari, or Firefox.',
    loadFailed: 'Couldn’t load the network module. Reload the page.',
    unknown: 'Unexpected connection error. Try again.',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'Room not found. Check the code.',
      network: 'Network problem. Check your connection and try again.',
      server: 'Can’t reach the connection server. Try again soon.',
      timeout: 'No answer from the connection server. Try again.',
      unsupported: 'Your browser doesn’t support peer-to-peer connections (WebRTC).',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'The room is full.',
    version: 'Your game version doesn’t match the host’s. Reload the page.',
    kicked: 'The host kicked you from the room.',
    closed: 'The host closed the room.',
    duplicate: 'Your profile is already in this room from another tab or device.',
  },
  deezer: {
    timeout: 'Deezer isn’t responding. Check your connection and try again.',
    network: 'Couldn’t reach Deezer. Check your connection (or any ad blockers) and try again.',
    invalid: 'Unexpected response from Deezer. Try again in a moment.',
    quota: 'Deezer got too many requests at once. Wait a few seconds and try again.',
    busy: 'Deezer is overloaded right now. Try again in a moment.',
    notFound: 'Not found on Deezer.',
    forbidden: 'Can’t access this content: it may be private or unavailable in your country.',
    badRequest: 'Invalid request to Deezer.',
    api: 'Deezer error. Try again in a moment.',
    playlistNotFound: 'Playlist not found: check the link (private playlists can’t be opened).',
    noPreview: 'No preview available for this track.',
    trackNotFound: 'This track is no longer available on Deezer.',
    featured: 'Couldn’t load the featured playlists.',
    /**
     * Stand-ins for empty Deezer fields, written into the song / playlist data (in the
     * host's language, like a player's default name) and shown as a title / artist.
     */
    fallback: {
      playlist: 'Untitled playlist',
      track: 'Untitled',
      artist: 'Unknown artist',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16). */
  difficulty: {
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    insane: 'Insane',
  },
} satisfies Catalog['game']
