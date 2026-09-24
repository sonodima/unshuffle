// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  /** Buttons shared by the shell's dialogs and the crash screen. */
  action: {
    home: 'Back to home',
    retry: 'Retry',
    ok: 'OK',
    cancel: 'Cancel',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE (never translated); {code} a room code. */
  title: {
    lobby: '{brand} · Lobby',
    lobbyRoom: '{brand} · Lobby {code}',
    round: '{brand} · Round',
    /** Round {round} of {rounds}. */
    roundOf: '{brand} · Round {round}/{rounds}',
    roundReveal: '{brand} · Round {round}/{rounds} · Results',
    roundPreparing: '{brand} · Round {round}/{rounds} · Getting ready',
    final: '{brand} · Final standings',
    /** A player lost the link to the host. */
    lost: '{brand} · Connection lost',
  },

  /**
   * Floating status pill at the top while the link is down. On phones it sits between
   * the corner buttons (~230px): titles ≤ 24 characters (one line), details ≤ 40 where
   * possible (they wrap to 2 lines at most, then are cut).
   */
  banner: {
    /** aria-label of the pill's close button. */
    dismiss: 'Hide notice',
    /** Seconds since the link dropped, next to the title. */
    elapsed: '{seconds}s',
    /** Host: the signaling server dropped; the game goes on. */
    hostReconnecting: 'Server lost, retrying…',
    hostReconnectingDetail: 'The game goes on',
    /** Player: first connection attempt still running. */
    connecting: 'Reconnecting…',
    /** Player: link to the host lost, retrying on its own. */
    lost: 'Connection lost',
    lostDetail: 'Trying to reconnect…',
    /** After ~5 s: the player will be let back in automatically. */
    lostDetailLong: 'Retrying… you’ll rejoin automatically.',
    /** After ~30 s of retries. */
    hostSilent: 'Host not responding',
    hostSilentDetail: 'Waiting for them to come back…',
    /** Small button in the pill after ~30 s: leave the room. */
    leave: 'Leave',
    /** Host only: nobody new can join, the players already in keep playing. */
    signalingTitle: 'New joins paused',
    signalingDetail: 'Connection server lost: players already in can keep playing.',
    /** Title of any other host-side warning (the detail is the error itself). */
    warning: 'Heads up',
  },

  /** Room code line in the connection dialogs (small caps label). */
  dialogRoom: 'Room <b>{code}</b>',

  /** Blocking dialog: a player lost the host for good. */
  lost: {
    title: 'Connection lost',
    /** The host left for good, the player was in the lobby. */
    hostClosedTitle: 'The host closed the room',
    /** The host left for good during or after the game. */
    hostLeftTitle: 'The host has left',
    hostGoneDescription: 'This room is no longer available.',
    /** Hint when the game had already ended (otherwise exit.gone.hint is shown). */
    hostGoneHintFinal: 'The game’s over. Create a new room for a rematch.',
    /** No "Retry" possible (e.g. on the host's own tab). */
    noRetryDescription: 'The connection to the room dropped.',
    noRetryHint: 'Check your connection, then try again from the home screen.',
    descriptionLobby: 'The host isn’t responding: they may have closed the room.',
    description: 'The host hasn’t responded in a while.',
    hintLobby: 'Try again in a moment, or head home and create your own room.',
    hintGame: 'If the host is still in the game, rejoin to pick up right where you left off, score and all.',
    hintFinal: 'If the host is still connected, rejoin to play the rematch.',
  },

  /** Dialog after being dropped out of a room, by reason. */
  exit: {
    kicked: {
      title: 'Kicked out',
      hint: 'You can always create your own room, or join with a different code.',
    },
    closed: {
      title: 'Room closed',
      hint: 'The game’s over for everyone. Create a new room or join with a different code.',
    },
    /** The same profile joined from another tab or device. */
    duplicate: {
      title: 'Already playing',
      hint: 'Close the other tab to play here.',
    },
    /** The room no longer exists (host left, or a rejoin found nothing). */
    gone: {
      title: 'Room no longer available',
      description: 'The host closed the room or lost their connection.',
      hint: 'Create a new room from the home screen or join with a different code.',
    },
    /** Rejoining failed (network). */
    failed: {
      title: 'Couldn’t rejoin',
      hint: 'Check your connection, then try the code again from the home screen.',
    },
    /** Any other reason. */
    generic: {
      title: 'You’re out of the room',
      hint: 'You can rejoin with the same code from the home screen.',
    },
  },

  /** Overlay while a reloaded tab re-enters its room, and the notice if that fails. */
  resume: {
    title: 'Reconnecting',
    host: 'Reopening your room',
    hostRoom: 'Reopening your room <b>{code}</b>',
    client: 'Rejoining the room',
    clientRoom: 'Rejoining room <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'Room <b>{code}</b> is gone. {hint}',
    failedRoom:
      'Couldn’t get you back into room <b>{code}</b>. If the game is still on, rejoin with the code from the home screen.',
    failed: 'If the game is still on, rejoin with the code from the home screen.',
  },

  /** Full-screen crash fallback. */
  crash: {
    eyebrow: 'Unexpected error',
    title: 'Something went wrong',
    body: 'The record skipped. Reload the page: if you were in a room, we’ll try to get you back in.',
    reload: 'Reload',
    showDetails: 'Technical details',
    hideDetails: 'Hide details',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    /** Stands in for {name} when the player's nickname is unknown. */
    someone: 'A player',
    joined: '{name} joined the room',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { one: 'There’s {count} of you now', other: 'There are {count} of you now' },
    left: '{name} left the room',
    submitted: '{name} locked in',
    /** Under "submitted" for the first one: the short final countdown started. */
    lastSeconds: { one: '{count} second left for everyone!', other: '{count} seconds left for everyone!' },
    lastSecondsSoon: 'Last seconds for everyone!',
    kicked: 'The host kicked {name}',
    kickedSomeone: 'The host kicked a player',
  },

  /** Toast while the browser keeps audio locked (touch screens say "tap", others "click"). */
  audioCue: {
    tapToListen: 'Tap to hear the song',
    clickToListen: 'Click to hear the song',
    tapToEnable: 'Tap to turn on audio',
    clickToEnable: 'Click to turn on audio',
    tapBody: 'Your browser keeps audio paused until you tap the screen.',
    clickBody: 'Your browser keeps audio paused until you interact with the page.',
  },

  /** Sound button and its popover. */
  sound: {
    /** Button label and tooltip. */
    button: 'Sound',
    buttonMuted: 'Sound off',
    buttonLocked: 'Audio blocked by your browser: tap to turn it on',
    /** aria-label of the popover. */
    panel: 'Sound settings',
    /** Popover heading (small caps). */
    heading: 'Sound',
    /** Next to the "M" key badge (the shortcut key itself is always M). */
    muteShortcut: 'Mute',
    mute: 'Turn sound off',
    unmute: 'Turn sound on',
    volume: 'Volume',
    sfx: 'Sound effects',
    sfxDetail: 'Clicks, timer, reactions',
    /** Small pill next to the button while the browser keeps audio locked (one line). */
    unlock: 'Turn on audio',
    unlockTitle: 'Your browser blocks audio until you tap the page',
  },

  /** Emoji reaction bar and the floating reactions. */
  reactions: {
    /** aria-label of the bar. */
    group: 'Reactions',
    /** aria-label of each button; {name} is one of the names below. */
    button: 'Reaction: {name}',
    /** Name tag under your own floating reaction. */
    you: 'You',
    /** Tooltip and accessible name of each emoji. */
    names: {
      fire: 'Fire',
      laugh: 'Laughing',
      shock: 'Shocked',
      clap: 'Applause',
      dead: 'Dying laughing',
      party: 'Party',
      mindBlown: 'Mind blown',
      cool: 'Too cool',
      rematch: 'Rematch',
    },
  },

  /** Native "leave page?" prompt while hosting a game (most browsers show their own text). */
  leaveWarning: 'If you leave, the game ends for everyone',
} satisfies Catalog['shell']
