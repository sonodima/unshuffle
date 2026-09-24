// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18,304"); plural forms are
// chosen by the score itself. Uppercase comes from CSS: write normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row. Very short (≈ 4 characters). */
  you: 'You',
  /** A late joiner who never played a round (standings row, empty table cell). */
  didNotPlay: 'Didn’t play',
  /** Round shorthand on covers and table rows ("R3"). Keep it 1–2 letters plus the number. */
  roundShort: 'R{round}',
  /** Round count: top bar chip (after the playlist name) and next to the "Round by round" title (uppercase). */
  roundCount: { one: '{count} round', other: '{count} rounds' },

  topBar: {
    /** Eyebrow next to the logo (uppercase, small). */
    gameOver: 'Game over',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. Short: big display type. */
    teaser: 'And the winner is',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short (≈ 16 characters). */
  headline: {
    /** Nobody in the standings (should not happen). */
    over: 'Game over!',
    noPlayers: 'No players in the standings.',
    /** Solo game, zero points. */
    soloZero: 'Zero points!',
    soloZeroSub: 'Try again: you’ll nail the next one.',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: 'Virtuoso!',
    soloGood: 'Nice one!',
    soloOk: 'Game over!',
    /** Subtitle "18,304 points in 5 rounds" (solo game, or a viewer who didn't play). {rounds} is the phrase headline.rounds. */
    pointsInRounds: { one: '{points} point in {rounds}', other: '{points} points in {rounds}' },
    /** "5 rounds" inside headline.pointsInRounds (in the grammatical case that sentence needs, unlike roundCount). */
    rounds: { one: '{count} round', other: '{count} rounds' },
    /** Several players, nobody scored. */
    allZero: 'All zeros!',
    allZeroSub: 'Nobody scored. Run it back and redeem yourselves!',
    /** Shared first place. */
    tie: 'It’s a tie!',
    /** I'm one of the tied winners. {names}: the other winners, already joined ("Giulia and Marco"). */
    tieWithMe: 'You share the win with {names}',
    /** {names}: all the tied winners, already joined ("Tommy and Giulia"). Always two or more. */
    tieOthers: '{names} tie for the win',
    /** I won alone. */
    youWin: 'You win!',
    /** Subtitle when I won and nobody else is in the standings. */
    youWinPoints: { one: '{points} point', other: '{points} points' },
    /** Subtitle when I won: my total, then my lead {gap} (formatted points) over the runner-up {name}. */
    youWinLead: { one: '{points} point · +{gap} over {name}', other: '{points} points · +{gap} over {name}' },
    /** I won with the same points as {name}, thanks to the faster lock-ins. */
    youWinFaster: 'Tied with {name} on points, but faster',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name} wins!',
    /** I have the winner's points but lost on time. */
    sameScore: 'Same score as {name}, but they locked in faster',
    /** My place: {rank} (already an ordinal, ui.ordinal: "2nd") out of {total} players, with my points. */
    myRank: { one: 'You finished {rank} of {total} with {points} point', other: 'You finished {rank} of {total} with {points} points' },
  },

  /** Action bar pinned under the podium / at the bottom of the screen. */
  dock: {
    /** Accessible name of the button group. */
    label: 'Actions',
    leave: 'Leave',
    /** Host: main button, back to the lobby with the same players. Keep it short. */
    playAgain: 'Play again',
    /** Guest: nudge the host for a rematch. */
    rematch: 'Rematch!',
    /** Guest: the rematch button right after tapping it (disabled for a few seconds). */
    rematchSent: 'Request sent',
    /** Guest: next to an animated equalizer while the host decides. */
    waiting: 'Waiting for the host to play again…',
    /** Host: who asked for a rematch. {names}: one or two names, already joined ("Giulia and Marco"); plural by how many. */
    rematchNamed: { one: '{names} wants a rematch!', other: '{names} want a rematch!' },
    /** Host: three or more players asked for a rematch. */
    rematchMany: { one: '{count} player wants a rematch!', other: '{count} players want a rematch!' },
  },

  /** Host leaving while others are still connected. */
  leaveDialog: {
    title: 'Close the room?',
    /** {count}: connected players other than the host (1–9). The "one" form is for exactly one. */
    body: {
      one: 'The other player will be disconnected, and there’ll be no rematch.',
      other: 'The other {count} players will be disconnected, and there’ll be no rematch.',
    },
    cancel: 'Cancel',
    confirm: 'Close room',
  },

  podium: {
    /** Accessible name of the podium list. */
    label: 'Podium',
    /** Screen readers, one podium step. {rank}: the place, already an ordinal (ui.ordinal: "1st"). */
    slot: { one: '{rank} place: {name}, {points} point', other: '{rank} place: {name}, {points} points' },
    /** Same, for my own step. */
    slotMe: { one: '{rank} place: {name} (you), {points} point', other: '{rank} place: {name} (you), {points} points' },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: 'Cheer for {name}',
  },

  standings: {
    title: 'Standings',
    /** Next to the title (small, uppercase). */
    players: { one: '{count} player', other: '{count} players' },
    /** Screen readers, before a row: "Rank 2". {rank} is a plain number here, not an ordinal (ui.ordinal). */
    position: 'Rank {rank}',
    /** Badge on a disconnected player. Short. */
    offline: 'Offline',
    /** Tooltips / screen-reader labels of the small stats under each name. */
    perfectRounds: 'Perfect rounds',
    accuracy: 'Snippets in the right spot, on average',
    avgTime: 'Average lock-in time',
    /** Late joiner: the first round they played. */
    lateFrom: 'from round {round}',
    /** Unit under each total (tiny, uppercase); plural by the score. */
    points: { one: 'point', other: 'points' },
  },

  /** Award cards. Titles are small display type in a half-width card on phones: keep them short. */
  awards: {
    title: 'Awards',
    /** Next to the title (small, uppercase). */
    aside: 'Shout-outs',
    /** Three or more winners of an award: "Giulia and 2 more". {count}: how many besides {name}. */
    nameAndOthers: { one: '{name} and one more', other: '{name} and {count} more' },
    goldenEar: {
      title: 'Golden Ear',
      description: 'Most perfect rounds',
      value: { one: '{count} perfect round', other: '{count} perfect rounds' },
    },
    lightning: {
      title: 'Quick Draw',
      description: 'Fastest lock-ins in scoring rounds',
      /** {time}: average time, e.g. "38.3s". */
      value: '{time} on average',
    },
    sniper: {
      title: 'Sniper',
      description: 'Most snippets in the right spot',
      /** {accuracy}: snippets in place per round ("6.8/8") or a percentage ("85%"). */
      value: '{accuracy} on average',
    },
    lastSecond: {
      title: 'Out of Time',
      description: 'Most rounds that timed out',
      value: { one: '{count} timeout', other: '{count} timeouts' },
    },
  },

  /** Rounds × players points table. */
  rounds: {
    title: 'Round by round',
    /** Accessible name of the table when it scrolls sideways. */
    scrollLabel: 'Points per round, scroll to see all players',
    /** Table caption (screen readers only). */
    caption: 'Each player’s points in each round',
    /** Header of the song column (small, uppercase). */
    song: 'Song',
    /** Row title when the song is unknown. */
    fallbackTitle: 'Round {round}',
    /** Crown icon on the round's best score, and its legend. */
    best: 'Best of the round',
    /** Badge in a narrow cell (≈ 70px, tiny uppercase) and legend entry. Short. */
    perfect: 'Perfect',
    /** Clock icon, and its legend. */
    timedOut: 'Timed out',
    /** Footer row label (uppercase). */
    total: 'Total',
  },

  /** Song tiles at the bottom. */
  songs: {
    title: 'The setlist',
    /** Next to the title (small, uppercase; hidden on phones). */
    aside: 'Replay them here or on Deezer',
    /** Cover button, screen readers. {title} / {artist}: the song; {round}: its round number. */
    play: 'Play the preview of {title} by {artist}, round {round}',
    stop: 'Stop the preview of {title} by {artist}, round {round}',
    /** Link to the song on Deezer (screen readers). */
    open: 'Open {title} on Deezer (new tab)',
    /** Tooltip of the same link. */
    openTooltip: 'Open on Deezer',
    /** Under a song whose preview couldn't be loaded. */
    unavailable: 'Preview unavailable',
  },

  units: {
    /**
     * Seconds with one decimal ("38.3s"): {value} is already formatted. English attaches
     * the unit; a language that spaces it must use a no-break space before the unit.
     */
    seconds: '{value}s',
  },
} satisfies Catalog['final']
