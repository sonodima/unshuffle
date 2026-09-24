// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the correct order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS: write them normally.
import type { Catalog } from '../../catalog'

export default {
  header: {
    /** Small label above the round title. */
    eyebrow: 'Results',
    /** Page title, e.g. "Round 3 / 5". The <dim> part is shown dimmed. */
    round: 'Round {round}<dim> / {total}</dim>',
  },

  song: {
    /** Screen-reader name of the song card. */
    region: 'The song',
    /** Small label above the song title. */
    eyebrow: 'The song was',
    /** Alt text of the album cover; {name} is the album (or the song title). */
    coverAlt: 'Cover art for {name}',
    /** Status of the original song (equalizer label, now-playing bar). */
    playing: 'Now playing',
    paused: 'Paused',
    /** Now-playing bar when the song is not playing. */
    stopped: 'Stopped',
    /** Button while the browser still blocks the audio: one tap starts it. */
    unlock: {
      hover: 'Click to listen',
      touch: 'Tap to listen',
    },
    /** Round play/pause button (screen-reader labels). */
    pause: 'Pause the song',
    resume: 'Resume the song',
    replay: 'Replay the song',
    /**
     * Small button that opens the song on Deezer. The <wide> part is hidden on
     * phones narrower than 420 px, so what is outside it must work alone (keep it short).
     */
    deezer: 'Listen<wide> on Deezer</wide>',
    /** Screen-reader label of the Deezer button; {title} is the song. */
    deezerAria: 'Listen to {title} on Deezer (opens in a new tab)',
    /** Fact chips under the song (small). */
    snippets: { one: '{count} snippet', other: '{count} snippets' },
    /** Tempo chip: “BPM” stays as is. */
    bpm: '{bpm} BPM',
  },

  board: {
    /** Screen-reader name of the board section. */
    region: 'Your sequence',
    /** Board title, depending on which arrangement is shown. */
    titleMine: 'Your order',
    titleCorrect: 'The correct order',
    /**
     * Two-option toggle above the board, once sorted. Each option is ~120 px wide
     * on tablets/desktop and ~80 px on phones (the short forms).
     */
    toggle: {
      /** Screen-reader name of the toggle. */
      label: 'Order shown',
      mine: 'Your order',
      mineShort: 'Yours',
      correct: 'Correct order',
      correctShort: 'Correct',
    },
    /** Screen-reader labels of the two counters while the ✓ / ✗ pop in. */
    tallyCorrect: { one: '{count} in the right spot', other: '{count} in the right spot' },
    tallyWrong: { one: '{count} wrong', other: '{count} wrong' },
    /**
     * Tiny chips in the corner of a misplaced tile (~6 characters; ~10 still fit, in a small monospace font).
     * `was`: on the correct order, where the player had put that snippet.
     * `goes`: on the player's order, where the snippet belongs.
     * {pos} = the position, already an ordinal (ui.ordinal: "5th").
     */
    was: 'was {pos}',
    goes: '→ {pos}',
    /**
     * One line under the board title (truncated beyond ~60 characters on phones):
     * how it went · what a click (mouse) / tap (touch screens) on a tile does.
     */
    hint: {
      /** Before the tiles sort themselves. */
      intro: {
        hover: 'Click a snippet to play the song from there',
        touch: 'Tap a snippet to play the song from there',
      },
      /** The player's own arrangement is shown. */
      mine: {
        hover: 'Here’s how you had them · click to listen',
        touch: 'Here’s how you had them · tap to listen',
      },
      perfect: {
        hover: 'All in the right spot! · click to replay',
        touch: 'All in the right spot! · tap to replay',
      },
      none: {
        hover: 'Nothing in the right spot · click to replay',
        touch: 'Nothing in the right spot · tap to replay',
      },
      /** {count} right positions out of {n} tiles. */
      partial: {
        hover: {
          one: 'You nailed {count} of {n} spots · click to replay',
          other: 'You nailed {count} of {n} spots · click to replay',
        },
        touch: {
          one: 'You nailed {count} of {n} spots · tap to replay',
          other: 'You nailed {count} of {n} spots · tap to replay',
        },
      },
    },
  },

  /** In place of the board for a late joiner (plays from the next round). */
  spectator: {
    title: 'You’re spectating',
    body: 'You’re watching this round from the sidelines: you’ll play from the next one.',
  },
  /** In place of the board when the host got no arrangement from me. */
  missing: {
    title: 'No answer',
    body: 'We didn’t get your order this time.',
  },

  score: {
    /** Screen-reader name of the points panel. */
    region: 'Your points',
    /** Small label over the big number (one line, keep it short). */
    eyebrow: 'Round points',
    /** Badge: the timer ran out before I locked in (also a leaderboard icon label). */
    timedOut: 'Timed out',
    /**
     * Small pill: how long I took to lock in. The <wide> part is hidden below 400 px;
     * <num> wraps {time}, e.g. “55.8s”. Keep all the text inside the two tags (either
     * order): the pill spaces them itself.
     */
    confirmedIn: '<wide>Locked in at</wide> <num>{time}</num>',
    /** Screen-reader label of the 0–5,000 bar. */
    barAria: { one: '{points} of {max} points', other: '{points} of {max} points' },
    /** Label under the “6/8” stat (small, one line). */
    correct: 'in the right spot',
    /** Label under the pair count (small, one line); the number is shown above it. */
    pairs: { one: 'linked pair', other: 'linked pairs' },
    /** My overall total after this round. */
    total: 'Game total',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}',
    /** Stamp on a perfect round (big, slanted). */
    stamp: 'Perfect!',
  },

  /** One line under my points, by how well the round went. */
  verdict: {
    perfect: 'Perfect sequence!',
    almost: 'Almost perfect!',
    good: 'Great ear!',
    close: 'So close…',
    more: 'Give it another listen',
    none: 'No snippets in the right spot',
  },

  /** Screen-reader label of the rank-change arrow. */
  rankUp: { one: 'Up {count} place', other: 'Up {count} places' },
  rankDown: { one: 'Down {count} place', other: 'Down {count} places' },

  /** A duration in seconds; {seconds} is already formatted (“55.8”). */
  seconds: '{seconds}s',

  /** Screen-reader summary once my points are shown. */
  announce: {
    /** {points} = round points, {correct} of {n} tiles right, {pairs} = announce.pairs. */
    result: {
      one: '{points} point: {correct} of {n} in the right spot, {pairs}.',
      other: '{points} points: {correct} of {n} in the right spot, {pairs}.',
    },
    pairs: { one: '{count} linked pair', other: '{count} linked pairs' },
    /** Wraps the summary on a perfect round. */
    perfect: 'Perfect sequence! {result}',
    /** Wraps the summary when the timer ran out. */
    timedOut: '{result} Time’s up.',
  },

  lead: {
    /** Leaderboard title (and screen-reader name of the panel). */
    title: 'Leaderboard',
    /** Small label on the right of the title. */
    after: 'after round {round}',
    /** Badge next to my own name (tiny: 2–4 letters). */
    you: 'you',
    /** Icon label on the best score(s) of the round. */
    top: 'Top score this round',
    /** Under the name of a player without a result. */
    spectator: 'Spectator',
    /** Late joiner, seen by the others; {round} = the round they start playing. */
    spectatorFrom: 'Spectator · plays from round {round}',
    noAnswer: 'No answer',
    /** Round stats under the leaderboard (tiny labels, one line each, three columns). */
    stats: {
      /** Average points of the round. */
      average: 'Average',
      /** How many players got the whole order right this round (the number is shown above). */
      perfect: 'Perfect',
      fastest: 'Fastest',
    },
    /**
     * Screen-reader label of a leaderboard row. {rank} = the place, already an ordinal (ui.ordinal: "1st"),
     * {name} = player (or lead.row.me for me), {total} = overall points.
     */
    row: {
      /** {points} this round, {correct} of {n} tiles in the right spot. */
      played: {
        one: '{rank}, {name}: {points} point this round, {correct} of {n} in the right spot, {total} total',
        other: '{rank}, {name}: {points} points this round, {correct} of {n} in the right spot, {total} total',
      },
      spectator: '{rank}, {name}: spectator, {total} total',
      noAnswer: '{rank}, {name}: no answer, {total} total',
      /** My own name in the row label. */
      me: '{name} (you)',
    },
  },

  footer: {
    /** Host's button: next round, or the final standings after the last round. */
    next: 'Next round',
    final: 'Final standings',
    /** Auto-advance countdown beside the host's button; <num> wraps the seconds. */
    nextIn: { one: 'Next round in <num>{count}</num>s', other: 'Next round in <num>{count}</num>s' },
    finalIn: { one: 'Final standings in <num>{count}</num>s', other: 'Final standings in <num>{count}</num>s' },
    /** Guests, while the host decides. */
    waiting: 'Waiting for the host…',
    /** Guests, with the auto-advance countdown; <num> is the dimmed seconds. */
    waitingIn: { one: 'Waiting for the host…<num>({count}s)</num>', other: 'Waiting for the host…<num>({count}s)</num>' },
  },
} satisfies Catalog['reveal']
