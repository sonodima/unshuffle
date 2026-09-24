// Home screen: hero, profile card, "Créer un salon" / join box, the decorative
// round demo and the "Comment jouer" dialog. Labels marked "uppercase" are
// shown in capitals by CSS: write them in normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Top-left button that opens the "how to play" dialog. Small pill, keep short. */
  help: 'Comment jouer',
  hero: {
    /** Small line above the logo (uppercase, letter-spaced). Keep it short: ~24 characters. */
    eyebrow: 'Party game musical',
    /** Under the logo. <b>…</b> is the highlighted second sentence ("morceaux" = pieces, and songs). */
    tagline: 'Le tube est en morceaux. <b>Remets-le dans l’ordre.</b>',
  },
  /** Screen-reader name of the card with the profile and the create / join buttons. */
  cardLabel: 'Jouer',
  /** Screen-reader name of the desktop panel with the animated demo round. */
  demoLabel: 'Aperçu d’une manche',
  /** Banner at the top of the card while the device has no network. */
  offline: 'Tu es hors ligne : il faut une connexion pour jouer.',
  /** Screen-reader label of the × that dismisses an error banner. */
  dismissNotice: 'Fermer le message',
  /** Divider between the join box and "Créer un salon" when opened from an invite link (uppercase). */
  or: 'ou',
  /** Link next to "Ouverture du salon…" / "Connexion au salon…" that aborts it. */
  cancel: 'Annuler',
  create: {
    /** Main call to action (big button, uppercase). Keep it short: ~16 characters. */
    button: 'Créer un salon',
    /** Secondary button when the player arrived with an invite link (uppercase). */
    buttonInvited: 'Créer mon salon',
    /** Under the button while the room is being opened. */
    pending: 'Ouverture du salon…',
    /** Hint under "Créer un salon". <b>…</b> is the bold lead-in. One line on phones (~50 characters). */
    solo: '<b>En solo ?</b> Crée le salon et lance-toi.',
  },
  join: {
    /** Divider above the 5 code boxes (uppercase). */
    divider: 'Tu as un code ?',
    /** Label above the code boxes when opened from an invite link (uppercase). */
    invited: 'On t’invite !',
    /** Join button (uppercase). */
    button: 'Rejoindre',
    /** Join button once the invite code is complete. {code} = 5-letter room code, e.g. KXQPM (uppercase). */
    buttonCode: 'Rejoindre {code}',
    /** Under the button while connecting. */
    pending: 'Connexion au salon…',
    /** Error under the code boxes when "Rejoindre" is pressed too early. {count} = code length (5). */
    incomplete: {
      one: 'Saisis la lettre du code.',
      other: 'Saisis les {count} lettres du code.',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    /** {count} = maximum number of players (10). */
    players: {
      one: '{count} joueur',
      other: 'De 1 à {count} joueurs',
    },
    noAccount: 'Sans compte, on joue dans le navigateur',
    deezer: 'Extraits musicaux fournis par Deezer',
  },
  profile: {
    /** Screen-reader label of the avatar button (opens the avatar / colour picker). */
    changeAvatar: 'Changer d’avatar et de couleur',
    /** Label of the nickname field (uppercase). */
    nameLabel: 'Ton pseudo',
    namePlaceholder: 'Choisis un pseudo',
    /** Tooltip / label of the dice button that picks a random nickname. */
    randomName: 'Pseudo au hasard',
    /** Title of the avatar / colour picker dialog. */
    lookTitle: 'Ton look',
    lookDescription: 'Choisis ton emoji et ta couleur : c’est comme ça que les autres te verront.',
    /** Closes the picker. */
    done: 'Terminé',
    /** Small heading over the preview of your avatar and name (uppercase). */
    preview: 'Aperçu',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    /** Tiny badge (uppercase, ~10px). */
    badge: 'Démo',
    /** Caption of each phase of the demo: one line, cut with … beyond ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: 'Le tube part en morceaux…',
      listen: 'Écoute les extraits',
      sort: 'Glisse-les dans le bon ordre',
      solved: 'Parfait ! Valide en premier',
    },
    /** Phone caption when the demo is solved (one line). {points} = points won, already formatted (5 000). */
    solvedPoints: 'Parfait ! +{points}',
    /** Screen-reader name of the three step chips under the demo board. */
    stepsLabel: 'Comment jouer, en bref',
    /** Step chips under the desktop demo (one word each, ~12 characters). */
    steps: {
      listen: 'Écoute',
      sort: 'Glisse',
      confirm: 'Valide',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: 'Comment jouer',
    description: 'Un tube par manche, mis en morceaux. Pour gagner, remets-le dans l’ordre, mieux et plus vite que les autres.',
    /** Closes the dialog. */
    gotIt: 'Compris, on joue !',
    /** The fake "confirm" button drawn in the third illustration (tiny pill, uppercase): keep it very short. */
    confirmButton: 'Valider',
    steps: {
      listen: {
        title: 'Écoute les extraits',
        /** Shown on devices with a mouse. */
        bodyMouse: 'Un tube célèbre est découpé en rythme, puis mélangé. Clique sur un bloc pour l’écouter.',
        /** Shown on touch screens. */
        bodyTouch: 'Un tube célèbre est découpé en rythme, puis mélangé. Touche un bloc pour l’écouter.',
      },
      sort: {
        title: 'Glisse-les dans le bon ordre',
        /** <play></play> is replaced by a small ▶ icon (the "play your order" button). Keep it empty. */
        body: 'Déplace les blocs jusqu’à ce que la chanson sonne comme l’originale. Appuie sur <play></play> pour écouter ta version.',
      },
      confirm: {
        title: 'Valide avant les autres',
        body: 'La première validation déclenche le compte à rebours final pour tout le monde.',
      },
    },
    /**
     * Scoring rule under the steps. {points} = maximum points per round, already
     * formatted (5 000); <b>…</b> highlights it. Plural chosen by that number.
     */
    scoring: {
      one: 'Jusqu’à <b>{points}</b> point par manche : les extraits à la bonne place et les paires enchaînées rapportent. Tu peux aussi jouer en solo.',
      other: 'Jusqu’à <b>{points}</b> points par manche : les extraits à la bonne place et les paires enchaînées rapportent. Tu peux aussi jouer en solo.',
    },
  },
} satisfies Catalog['home']
