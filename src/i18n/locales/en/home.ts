// Home screen: hero, profile card, "Create room" / join box, the decorative
// round demo and the "How to play" dialog. Labels marked "uppercase" are
// shown in capitals by CSS: write them in normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Top-left button that opens the "how to play" dialog. Small pill, keep short. */
  help: 'How to play',
  hero: {
    /** Small line above the logo (uppercase, letter-spaced). Keep it short: ~24 characters. */
    eyebrow: 'Music party game',
    /** Under the logo. <b>…</b> is the highlighted second sentence. */
    tagline: 'A hit, chopped and shuffled. <b>Put it back together.</b>',
  },
  /** Screen-reader name of the card with the profile and the create / join buttons. */
  cardLabel: 'Play',
  /** Screen-reader name of the desktop panel with the animated demo round. */
  demoLabel: 'Round preview',
  /** Banner at the top of the card while the device has no network. */
  offline: 'You’re offline: you need a connection to play.',
  /** Screen-reader label of the × that dismisses an error banner. */
  dismissNotice: 'Dismiss notice',
  /** Divider between the join box and "Create a room" when opened from an invite link (uppercase). */
  or: 'or',
  /** Link next to "Opening the room…" / "Joining the room…" that aborts it. */
  cancel: 'Cancel',
  create: {
    /** Main call to action (big button, uppercase). Keep it short: ~16 characters. */
    button: 'Create room',
    /** Secondary button when the player arrived with an invite link (uppercase). */
    buttonInvited: 'Create a room',
    /** Under the button while the room is being opened. */
    pending: 'Opening the room…',
    /** Hint under "Create room". <b>…</b> is the bold lead-in. One line on phones (~50 characters). */
    solo: '<b>Playing solo?</b> Create a room and start now.',
  },
  join: {
    /** Divider above the 5 code boxes (uppercase). */
    divider: 'Got a code?',
    /** Label above the code boxes when opened from an invite link (uppercase). */
    invited: 'You’re invited!',
    /** Join button (uppercase). */
    button: 'Join',
    /** Join button once the invite code is complete. {code} = 5-letter room code, e.g. KXQPM (uppercase). */
    buttonCode: 'Join {code}',
    /** Under the button while connecting. */
    pending: 'Joining the room…',
    /** Error under the code boxes when "Join" is pressed too early. {count} = code length (5). */
    incomplete: {
      one: 'Enter the code letter.',
      other: 'Enter all {count} letters of the code.',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    /** {count} = maximum number of players (10). */
    players: {
      one: '{count} player',
      other: '1 to {count} players',
    },
    noAccount: 'No sign-up, right in your browser',
    deezer: 'Music previews from Deezer',
  },
  profile: {
    /** Screen-reader label of the avatar button (opens the avatar / color picker). */
    changeAvatar: 'Change avatar and color',
    /** Label of the nickname field (uppercase). */
    nameLabel: 'Your name',
    namePlaceholder: 'Pick a name',
    /** Tooltip / label of the dice button that picks a random nickname. */
    randomName: 'Random name',
    /** Title of the avatar / color picker dialog. */
    lookTitle: 'Your look',
    lookDescription: 'Pick an emoji and a color. That’s how others will see you.',
    /** Closes the picker. */
    done: 'Done',
    /** Small heading over the preview of your avatar and name (uppercase). */
    preview: 'Preview',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    /** Tiny badge (uppercase, ~10px). */
    badge: 'Demo',
    /** Caption of each phase of the demo: one line, cut with … beyond ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: 'Chopping up the hit…',
      listen: 'Listen to the snippets',
      sort: 'Drag them into the right order',
      solved: 'Perfect! Lock it in first',
    },
    /** Phone caption when the demo is solved (one line). {points} = points won, already formatted (5,000). */
    solvedPoints: 'Perfect! +{points}',
    /** Screen-reader name of the three step chips under the demo board. */
    stepsLabel: 'How to play, at a glance',
    /** Step chips under the desktop demo (one word each, ~12 characters). */
    steps: {
      listen: 'Listen',
      sort: 'Reorder',
      confirm: 'Lock in',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: 'How to play',
    description: 'One hit per round, chopped into pieces. Whoever puts it back together best and fastest wins.',
    /** Closes the dialog. */
    gotIt: 'Got it, let’s play!',
    /** The fake "lock in" button drawn in the third illustration (tiny pill, uppercase): keep it very short. */
    confirmButton: 'Lock in',
    steps: {
      listen: {
        title: 'Listen to the snippets',
        /** Shown on devices with a mouse. */
        bodyMouse: 'A famous hit gets cut up on the beat and shuffled. Click a tile to hear it.',
        /** Shown on touch screens. */
        bodyTouch: 'A famous hit gets cut up on the beat and shuffled. Tap a tile to hear it.',
      },
      sort: {
        title: 'Drag them into order',
        /** <play></play> is replaced by a small ▶ icon (the "play your order" button). Keep it empty. */
        body: 'Move the tiles around until the song sounds like the original. Hit <play></play> to hear your order.',
      },
      confirm: {
        title: 'Lock in before everyone else',
        body: 'The first player to lock in starts the final countdown for everyone.',
      },
    },
    /**
     * Scoring rule under the steps. {points} = maximum points per round, already
     * formatted (5,000); <b>…</b> highlights it. Plural chosen by that number.
     */
    scoring: {
      one: 'Up to <b>{points}</b> point per round: snippets in the right spot and linked pairs both count. You can play solo, too.',
      other: 'Up to <b>{points}</b> points per round: snippets in the right spot and linked pairs both count. You can play solo, too.',
    },
  },
} satisfies Catalog['home']
