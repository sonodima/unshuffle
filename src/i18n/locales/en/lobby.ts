// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button (dock / bottom sheet). Short: ~16 characters. */
  start: 'Start game',
  /** Player count in the desktop start dock. */
  players: { one: '<num>{count}</num> player', other: '<num>{count}</num> players' },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: { one: '<num>{count}</num> track', other: '<num>{count}</num> tracks' },
  /** Dismiss button of the lobby dialogs (kick a player, edit your profile). */
  cancel: 'Cancel',

  header: {
    /** Small pill next to the logo. */
    badge: 'Lobby',
  },

  /** Leave / close the room: header button and confirmation dialog. */
  leave: {
    /** Host button (header on desktop, dialog confirm). Short. */
    closeRoom: 'Close room',
    /** Guest button (header on desktop, dialog confirm). Short. */
    exit: 'Leave',
    /** Guest back button on phones (screen readers only). */
    exitRoom: 'Leave room',
    hostTitle: 'Close the room?',
    guestTitle: 'Leave the room?',
    /** Host, other players in the room. */
    hostBody: 'You’re the host: if you leave, the room closes and everyone else gets disconnected.',
    /** Host alone in the room. */
    hostAloneBody: 'The room will be closed.',
    /** {code}: the 5-letter room code. */
    guestBody: 'You can rejoin with the code {code} until the game starts.',
    stay: 'Stay',
  },

  /** Phone tabs. Labels must stay short (~10 characters): three tabs share a 360px bar. */
  tabs: {
    /** Tab bar name (screen readers). */
    label: 'Lobby sections',
    players: 'Players',
    playlist: 'Playlist',
    rules: 'Rules',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, not picked yet',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { one: '{tab}, {count} player', other: '{tab}, {count} players' },
  },

  /** Invite link (the "Invite" button and the open seats). */
  invite: {
    /** Toast. */
    linkCopied: 'Room link copied!',
    /** Toast. */
    copyFailed: 'Couldn’t copy: use the QR button to see the link.',
    /** Native share sheet text; the join link follows it. {code}: the room code. */
    shareText: 'Bet you can’t beat me at UNSHUFFLE! Join room {code}:',
  },

  /** Room code card. */
  code: {
    title: 'Room code',
    /** Hint next to the title (top right of the card, short). */
    clickToCopy: 'Click to copy',
    tapToCopy: 'Tap to copy',
    copied: 'Code copied!',
    copyFailed: 'Couldn’t copy',
    /** Screen readers. {code}: the room code spelled letter by letter ("K X Q P M"). */
    copyLabel: 'Room code {code}. Copy code',
    /** Button (phones: shares the row with "Share" and the QR button). Short. */
    copyLink: 'Copy link',
    /** "Copy link" right after a successful copy. */
    linkCopied: 'Copied!',
    share: 'Share',
    showQr: 'Show QR code',
    enlargeQr: 'Enlarge QR code',
    /** Desktop card, next to the QR code. */
    phoneTitle: 'Join from your phone',
    phoneBody: 'Scan the QR or open the link. No account needed.',
  },

  /** QR code dialog. */
  qr: {
    title: 'Invite your friends',
    description: 'Scan the QR with your phone’s camera, or share the link.',
    /** Label above the room code. */
    code: 'Code',
    /** Button next to the link. */
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Couldn’t copy: select the link and copy it by hand.',
    shareLink: 'Share link',
    /** The QR image (screen readers). */
    imageLabel: 'QR code to join the room',
  },

  /** Player list. */
  roster: {
    title: 'Players',
    /** Shown when someone is reconnecting: how many players are connected. */
    online: { one: '<num>{count}</num> online', other: '<num>{count}</num> online' },
    /** Screen readers, for the "3/10" pill. {max}: room capacity. */
    capacity: { one: '{count} of {max} players', other: '{count} of {max} players' },
    listLabel: 'Player list',
    /** Badge on your own row. Very short. */
    you: 'You',
    /** Badge on the host's row. Very short. */
    host: 'Host',
    reconnecting: 'Reconnecting…',
    editProfile: 'Edit profile',
    /** Kick button (screen readers / tooltip). {name}: player name. */
    kickLabel: 'Kick {name}',
    freeSeats: { one: '<num>{count}</num> open seat', other: '<num>{count}</num> open seats' },
    /** Button next to the open seats. Short. */
    invite: 'Invite',
    /** Kick confirmation dialog. */
    kick: {
      /** {name}: player name. */
      title: 'Kick {name}?',
      titleFallback: 'Kick this player?',
      body: 'They’ll be out of the room right away and won’t be able to rejoin.',
      confirm: 'Kick',
    },
  },

  /** Your profile dialog (name + avatar). */
  profile: {
    title: 'Your profile',
    name: 'Name',
    namePlaceholder: 'What’s your name?',
    nameRequired: 'Type at least one character.',
    save: 'Save',
  },

  /** Playlist picker (host). */
  picker: {
    title: 'Pick a playlist',
    /** Next to the title on wide screens. */
    source: 'Tracks from Deezer · 30-second previews',
    searchLabel: 'Search playlists',
    /** Must fit a 300px-wide field on phones (~32 characters). */
    searchPlaceholder: 'Search or paste a Deezer link',
    searching: 'Searching',
    clear: 'Clear search',
    /** Shelf heading while the search box is empty. */
    featured: 'Featured',
    /** Heading of a pasted playlist link. */
    fromLink: 'From your link',
    /** {query}: what the host typed. */
    resultsFor: 'Results for “{query}”',
    /** Result count (next to the heading, and for screen readers). */
    count: { one: '{count} playlist', other: '{count} playlists' },
    /** Screen readers. */
    loading: 'Loading…',
    /** Screen readers. */
    invalidLink: 'Invalid link',
    pickedFromLink: 'Playlist picked from your link',
    retry: 'Retry',
    /** Hover label on a cover. Very short. */
    pick: 'Pick',
    /** Card subtitle of a playlist shorter than the shortest game. */
    tracksTooShort: { one: '<num>{count}</num> track · too short', other: '<num>{count}</num> tracks · too short' },
    /** Card subtitle. {creator}: Deezer user / curator name. */
    tracksBy: { one: '<num>{count}</num> track · {creator}', other: '<num>{count}</num> tracks · {creator}' },
    /** Category chips row (screen readers). */
    chips: 'Categories',
    chipsPrev: 'Previous categories',
    chipsNext: 'More categories',
    /** A share short link was pasted (link.deezer.com). */
    shortLink: {
      title: 'Paste the full playlist link',
      body: 'Short links (link.deezer.com) can’t be opened from here. Open it in your browser or the Deezer app and copy the full address: deezer.com/…/playlist/123456.',
    },
    /** A link that is not a Deezer playlist was pasted. Adapt the example's country part to your language, or drop it. */
    foreignLink: {
      title: 'That link isn’t a playlist',
      body: 'Paste a link to a public Deezer playlist, like deezer.com/en/playlist/123456 — or search by name, artist, or genre.',
    },
    /** A pasted playlist link failed. */
    notFound: {
      title: 'Playlist not found',
      /** The playlist doesn't exist or is private. */
      body: 'Check the link (private playlists can’t be opened).',
    },
    /** A search / the shelf failed (the error message follows). */
    offline: 'Deezer isn’t responding',
    empty: {
      title: 'No playlists',
      /** {query}: what the host typed. */
      titleFor: 'No playlists for “{query}”',
      body: 'Try an artist, a genre, or a decade, or paste a Deezer playlist link.',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: 'Chosen playlist',
    /** Small label above the title (uppercase by CSS). */
    eyebrow: 'Playlist',
    /** The same eyebrow while the host hasn't picked one yet (host's view). */
    none: 'No playlist',
    incoming: 'Playlist coming up',
    /** {creator}: Deezer user / curator name. */
    by: 'by {creator}',
    hostEmpty: 'Search for a playlist, tap a category, or paste a Deezer link.',
    guestEmpty: 'It’ll show up here once the host picks one. Get your ears ready!',
    change: 'Change',
  },

  /** Game rules panel: four pickers. */
  rules: {
    title: 'Rules',
    /** Host only: upper bound of the game length. {minutes}: a number. */
    duration: 'Max length <num>~{minutes} min</num>',
    /** Guests: the rules are read-only. Short pill. */
    hostDecides: 'Host’s call',
    /** Option label in seconds, e.g. "90s". Keep it very short (4 options share a row). */
    seconds: '{seconds}s',
    /** Screen readers, a snippets option: "8 · Normal". */
    snippetsOption: '{snippets} · {difficulty}',
    /** Screen readers, a cut option: "Mannaia · Dove capita". */
    cutsOption: '{name} · {detail}',
    /** Row titles are also the pickers' names. Hints are one short line (they truncate). */
    rounds: { title: 'Rounds', hint: 'One song per round' },
    snippets: { title: 'Snippets', hint: 'More pieces = harder' },
    cuts: { title: 'Cut', hint: 'The cleaver is easier' },
    /** Under each cut style name (small, uppercase): where the cuts fall. Very short. */
    cutsDetail: { beat: 'On the beat', free: 'Anywhere' },
    roundTime: { title: 'Time per round', hint: 'To sort it out' },
    finalTimer: { title: 'Final countdown', hint: 'After the first lock-in' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: 'How to play',
    /** {points}: the maximum score of a round (5,000). */
    perfect: 'Perfect order = <num>{points}</num> points',
    listen: {
      title: 'Listen',
      /** Mouse / trackpad. {count}: snippets per song (6–16). */
      bodyClick: {
        one: 'Each song is cut into {count} snippet. Click a tile to hear it.',
        other: 'Each song is cut into {count} shuffled snippets. Click a tile to hear it.',
      },
      /** Touch screens. {count}: snippets per song (6–16). */
      bodyTap: {
        one: 'Each song is cut into {count} snippet. Tap a tile to hear it.',
        other: 'Each song is cut into {count} shuffled snippets. Tap a tile to hear it.',
      },
    },
    reorder: {
      title: 'Reorder',
      body: 'Drag the tiles until the song sounds right again. Hit ▶ to hear it all the way through.',
    },
    confirm: {
      title: 'Lock in',
      /** {count}: seconds of the final countdown (10–30). */
      body: {
        one: 'The first to lock in starts the final countdown: everyone else gets {count} second.',
        other: 'The first to lock in starts the final countdown: everyone else gets {count} seconds.',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5 rounds · 8 snippets (normal) · 90s".
    rounds: { one: '<num>{count}</num> round', other: '<num>{count}</num> rounds' },
    snippets: { one: '<num>{count}</num> snippet', other: '<num>{count}</num> snippets' },
    /** Desktop dock. {difficulty}: difficulty name, lowercased ("normal"). */
    snippetsLevel: { one: '<num>{count}</num> snippet ({difficulty})', other: '<num>{count}</num> snippets ({difficulty})' },
    /** Seconds per round, e.g. "90s". */
    roundTime: '<num>{seconds}s</num>',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingStart: 'Waiting for the host to start',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingPlaylist: 'The host is picking a playlist',
    pickPlaylist: 'Pick a playlist to start',
    solo: 'You can play solo, too',
    /** In place of the playlist title in the dock, before one is picked. */
    noPlaylist: 'No playlist',
    /** One-tap fix when the playlist is too short for the chosen rounds. Short button. */
    playRounds: { one: 'Play {count} round', other: 'Play {count} rounds' },
    /** {count}: tracks the playlist has, {need}: tracks needed (one per round). */
    shortfall: {
      one: 'Playlist too short: it has <num>{count}</num> track, you need <num>{need}</num>.',
      other: 'Playlist too short: it has <num>{count}</num> tracks, you need <num>{need}</num>.',
    },
    /** Even the shortest game doesn't fit. {count}: tracks the playlist has, {min}: fewest rounds. */
    shortfallMin: {
      one: 'Playlist too short: it has only <num>{count}</num> track, you need at least <num>{min}</num>.',
      other: 'Playlist too short: it has only <num>{count}</num> tracks, you need at least <num>{min}</num>.',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Per language: pick genres and searches that make sense there
   * (a query should return relevant, sizeable playlists as its first results).
   */
  chips: [
    { label: 'Today’s Hits', query: 'todays hits', emoji: '🔥' },
    { label: 'UK Hits', query: 'uk hits', emoji: '🇬🇧' },
    { label: '2010s', query: '10s hits', emoji: '📱' },
    { label: '2000s', query: '00s hits', emoji: '💿' },
    { label: '90s', query: '90s hits', emoji: '📼' },
    { label: '80s', query: '80s hits', emoji: '🕺' },
    { label: '70s', query: '70s hits', emoji: '🪩' },
    { label: 'Hip-Hop', query: 'hip hop hits', emoji: '🎤' },
    { label: 'R&B', query: 'r&b hits', emoji: '💜' },
    { label: 'Rock Classics', query: 'rock classics', emoji: '🎸' },
    { label: 'Country', query: 'country hits', emoji: '🤠' },
    { label: 'Dance / EDM', query: 'dance hits', emoji: '🎧' },
    { label: 'Latin', query: 'latin hits', emoji: '💃' },
    { label: 'K-Pop', query: 'k-pop', emoji: '🇰🇷' },
    { label: 'Party', query: 'party hits', emoji: '🎉' },
    { label: 'Disney', query: 'disney hits', emoji: '🏰' },
    { label: 'Movie Hits', query: 'film hits', emoji: '🎬' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order.
   * Per language: the country's tops first, then worldwide ones. Use public,
   * editorial playlists with ≥ 40 tracks (check https://api.deezer.com/playlist/<id>).
   * An empty list falls back to the default shelf (FEATURED_PLAYLIST_IDS).
   */
  featured: [
    1313621735, // Top USA — Deezer Charts
    1111142221, // Top UK — Deezer Charts
    1652248171, // Top Canada — Deezer Charts
    1313616925, // Top Australia — Deezer Charts
    3155776842, // Top Worldwide — Deezer Charts
    1363560485, // Deezer Hits
    4403076402, // TikTok Hits World
    248297032, // 00s Hits
    878989033, // 90s Hits
    867825522, // 80s Hits
    1677006641, // Hot Urban (hip-hop)
    1306931615, // Rock Essentials
  ],
} satisfies Catalog['lobby']
