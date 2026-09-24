// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, lock-in dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Keyboard key names, as printed on the key caps. */
  keys: {
    space: 'Space',
    enter: 'Enter',
    /** The Control key (Apple keyboards show ⌘ instead). */
    ctrl: 'Ctrl',
  },
  /** Retry button (short: sits next to an error). */
  retry: 'Retry',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: 'Round <b>{number}</b><dim> / {total}</dim>',
    /** Big headline (the host's own step messages come from game.prep). */
    allReady: 'Everyone’s ready. Let’s go!',
    waiting: 'Waiting for everyone to be ready…',
    fallback: 'Getting the round ready…',
    /** Checklist: three steps, each with an "in progress" and a "done" label. */
    steps: {
      songActive: 'Picking the song…',
      songDone: 'Song picked',
      /** Under "Song picked": the title stays hidden until the reveal. */
      songDetail: 'Top secret till the reveal',
      downloadActive: 'Downloading the snippets…',
      downloadDone: 'Snippets downloaded',
      downloadError: 'Download failed',
      /** Under "Download failed". */
      downloadErrorDetail: 'You can still play without audio',
      sliceActive: 'Slicing up the track…',
      sliceDone: 'Track sliced',
      /** Under "Track sliced": the song is cut on the beat. One line, ~35 chars. */
      sliceDetail: { one: '{count} snippet, cut on the beat', other: '{count} snippets, cut on the beat' },
      /** Same, for the cleaver (free cuts: anywhere but on the beat). One line, ~35 chars. */
      sliceDetailFree: { one: '{count} snippet, cleaver-chopped', other: '{count} snippets, cleaver-chopped' },
    },
    /** Small uppercase label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: 'Ready <b>{ready}</b><dim>/{total}</dim>',
    /** Screen-reader label of the avatar row. */
    readyPlayers: 'Players ready',
  },

  /** Rotating tips on the preparing screen (one at a time, ~2 lines on phones). */
  tips: {
    title: 'Pro tip',
    howToHover: 'Click a tile to hear it, drag it to move it.',
    howToTouch: 'Tap a tile to hear it, drag it to move it.',
    /** “Play all” is the play-all button of the board (board.transport.playAll). */
    playAll: '“Play all” plays the tiles in their current order: if it flows, you’re almost there.',
    hold: 'Press and hold a tile to play the sequence from there.',
    pairs: 'Two neighboring tiles in the right order score points, even if they’re in the wrong spot.',
    firstConfirm: 'The first to lock in starts the final countdown for everyone.',
    edges: 'Listen for where the song kicks in and where it fades out: those are the first and last tiles.',
    /** Only in cleaver games: cuts fall mid-word and mid-note, so the edges give the order away. */
    cleaver: 'With the cleaver, cuts land mid-word and mid-note: find the tile that finishes them.',
    /** {points} = the maximum score of a round (5,000, formatted). */
    perfect: 'Perfect order = {points} points. No pressure.',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: 'Final round',
    /** Screen-reader text of the headline. */
    headlineLabel: 'Round {number} of {total}',
    /**
     * Huge one-line headline: <word> white text, <n> the round number (lime),
     * <total> "/total" (small, grey). Keep the three tags; spaces between tags don't show.
     */
    headline: '<word>Round</word> <n>{number}</n><total>/{total}</total>',
    /** Screen-reader label of the round facts list. */
    rulesLabel: 'Round rules',
    /** Fact pills. <b> = the number (white). */
    snippets: { one: '<b>{count}</b> snippet', other: '<b>{count}</b> snippets' },
    /** Round duration; "sec" = seconds. */
    seconds: '<b>{seconds}</b> sec',
    spectator: 'You’re sitting this one out. You’ll jump in next round.',
    howToHover: 'Click a tile to hear it, then drag it into place.',
    howToTouch: 'Tap a tile to hear it, then drag it into place.',
    /** Shown inside the countdown ring before "3" (small, uppercase). */
    ready: 'Ready?',
    /** Screen-reader text of the countdown ring: before the count / while counting ({seconds} = 3, 2, 1). */
    readyLabel: 'Get ready',
    countdownLabel: 'Starting in {seconds}',
  },

  /** Full-screen slam when the round starts. Very short: 1 word, huge type (only ~4 characters fit a phone). */
  go: 'Go!',
  /** Shown while the board data for the round arrives. */
  syncing: 'Syncing the round…',

  /** Top bar while playing. Labels are tiny uppercase eyebrows: keep them short. */
  hud: {
    round: 'Round',
    snippets: 'Snippets',
    points: 'Points',
    /** Caption inside the timer ring (1 short word): normal / after the first lock-in. */
    time: 'Time',
    finalTime: 'Final',
    /** Badge under the ring after the first lock-in. */
    lastSeconds: 'Last seconds',
    /** Eyebrow over the avatars: {done} players out of {total} locked in. */
    confirmed: 'Locked in {done}/{total}',
    /** Standing under the score. {rank} = the place, already an ordinal (ui.ordinal: "1st"). */
    rank: '{rank} place',
    /** Screen-reader label of the avatar row. */
    players: 'Players this round',
  },

  /** Avatar rows. */
  players: {
    /** The viewer's own avatar (screen readers / tooltip). */
    me: '{name} (you)',
    /** Chip after the last shown avatar ("+3"), for screen readers. */
    more: { one: 'and one more', other: 'and {count} more' },
  },

  /** "Giulia locked in!" — the final-countdown banner in the HUD. */
  banner: {
    /** Stands in for {name} in confirmedBy when the player has no name. */
    someone: 'Someone',
    mine: 'You locked in first!',
    /** <name> is the player's name: on phones only the name is shortened (one line). */
    confirmedBy: '<name>{name}</name> locked in!',
    /** Line under the title; <n> is the live seconds count (animated). "s" = seconds. */
    othersLeft: 'Everyone else has <n>{seconds}</n>s left',
    youLeft: { one: 'You’ve got <n>{count}</n> second left', other: 'You’ve got <n>{count}</n> seconds left' },
    /** For players who can't act any more (already locked in, spectators). */
    finalTimer: 'Final countdown: <n>{seconds}</n>s',
  },

  /** Bottom dock: play-all transport + LOCK IN / status. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: 'Lock in',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: 'Nothing’s moved yet',
    armTap: 'Tap again to lock in',
    armClick: 'Click again to lock in',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: 'Press {mod} + {enter} again',
    confirmed: 'Locked in',
    /** Locked in while offline: it is sent on reconnect. */
    queued: 'Sends when you’re back online',
    /** {names} = one or two player names ("Giulia", "Giulia and Marco"). */
    waitingFor: 'Waiting for {names}',
    waitingForCount: { one: 'Waiting for {count} player', other: 'Waiting for {count} players' },
    allConfirmed: 'Everyone’s locked in!',
    /** Screen-reader label of the avatars of those still playing. */
    stillPlaying: 'Still playing',
    timeUp: 'Time’s up!',
    /** Time ran out before I locked in: my last arrangement counts. */
    timedOut: 'Your order counts as is',
    computing: 'Tallying the scores…',
    spectator: 'Spectator',
    spectatorBody: 'You’ll play from the next round',
    audioFailed: 'Audio unavailable',
    audioFailedBody: 'Retry or play anyway',
    /** Icon button (phones): screen readers / tooltip. */
    retryAudio: 'Retry downloading the audio',
    /**
     * Keyboard legend under the dock (desktop). <kbd> = a key cap. {space} / {enter} /
     * {mod} (⌘ or Ctrl) are key names. <action> = the action label after a combination.
     */
    hints: {
      playAll: '<kbd>{space}</kbd> play all',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>lock in</action>',
      pointer: 'Click a tile to hear it · hold to play from there · drag to move it',
      /** Same, after locking in (tiles can't move any more). */
      pointerLocked: 'Click a tile to hear it · hold to play from there',
    },
  },

  /** Center card for a late joiner, over the board. */
  spectator: {
    title: 'You’re spectating',
    bodyHover: 'You’ll play from the next round. For now, click the tiles to hear the snippets.',
    bodyTouch: 'You’ll play from the next round. For now, tap the tiles to hear the snippets.',
  },

  /** In-game exit menu (sheet). */
  menu: {
    /** Round button that opens it (screen readers / tooltip). */
    endButton: 'End game',
    leaveButton: 'Leave game',
    hostTitle: 'End the game?',
    guestTitle: 'Leave the game?',
    hostBody: 'You’re the host: the game stops for everyone.',
    /** Host alone in the room. */
    hostAloneBody: 'The game ends here.',
    guestBody: 'The game goes on without you. While it’s still running, you can rejoin and pick up your score.',
    keepPlaying: 'Keep playing',
    stay: 'Stay',
    /** Guest's red confirm button in the sheet (the round button above only opens it). */
    leave: 'Leave game',
    toLobby: 'Back to lobby',
    toLobbyBody: 'Scores reset, same players: pick a new playlist and go again.',
    toLobbyAloneBody: 'Score reset: pick a new playlist and go again.',
    close: 'Close the room',
    /** Closing the room disconnects the one other player / all the others (2 or more). */
    closeBodyOne: 'The other player gets disconnected.',
    closeBodyMany: 'All the other players get disconnected.',
    closeAloneBody: 'Back to the home screen.',
    /** Next to the room code (guests). */
    rejoinCode: 'Rejoin code',
  },
} satisfies Catalog['round']
