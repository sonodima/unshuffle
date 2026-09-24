// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  /** Buttons shared by the shell's dialogs and the crash screen. */
  action: {
    home: 'Retour à l’accueil',
    retry: 'Réessayer',
    ok: 'OK',
    cancel: 'Annuler',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE (never translated); {code} a room code. */
  title: {
    lobby: '{brand} · Salon',
    lobbyRoom: '{brand} · Salon {code}',
    round: '{brand} · Manche',
    /** Round {round} of {rounds}. */
    roundOf: '{brand} · Manche {round}/{rounds}',
    roundReveal: '{brand} · Manche {round}/{rounds} · Résultats',
    roundPreparing: '{brand} · Manche {round}/{rounds} · Préparation',
    final: '{brand} · Classement final',
    /** A player lost the link to the host. */
    lost: '{brand} · Connexion perdue',
  },

  /**
   * Floating status pill at the top while the link is down. On phones it sits between
   * the corner buttons (~230px): titles ≤ 24 characters, details ≤ 40.
   */
  banner: {
    /** aria-label of the pill's close button. */
    dismiss: 'Masquer l’alerte',
    /** Seconds since the link dropped, next to the title. */
    elapsed: '{seconds} s',
    /** Host: the signaling server dropped; the game goes on. */
    hostReconnecting: 'Reconnexion au serveur…',
    hostReconnectingDetail: 'La partie continue',
    /** Player: first connection attempt still running. */
    connecting: 'Reconnexion…',
    /** Player: link to the host lost, retrying on its own. */
    lost: 'Connexion perdue',
    lostDetail: 'Nouvelle tentative…',
    /** After ~5 s: the player will be let back in automatically. */
    lostDetailLong: 'Nouvel essai… reconnexion automatique.',
    /** After ~30 s of retries. */
    hostSilent: 'L’hôte ne répond pas',
    hostSilentDetail: 'On attend son retour…',
    /** Small button in the pill after ~30 s: leave the room. */
    leave: 'Quitter',
    /** Host only: nobody new can join, the players already in keep playing. */
    signalingTitle: 'Entrées en pause',
    signalingDetail: 'Serveur perdu : les joueurs déjà là continuent.',
    /** Title of any other host-side warning (the detail is the error itself). */
    warning: 'Attention',
  },

  /** Room code line in the connection dialogs (small caps label). */
  dialogRoom: 'Salon <b>{code}</b>',

  /** Blocking dialog: a player lost the host for good. */
  lost: {
    title: 'Connexion perdue',
    /** The host left for good, the player was in the lobby. */
    hostClosedTitle: 'L’hôte a fermé le salon',
    /** The host left for good during or after the game. */
    hostLeftTitle: 'L’hôte a quitté la partie',
    hostGoneDescription: 'Le salon n’est plus disponible.',
    /** Hint when the game had already ended (otherwise exit.gone.hint is shown). */
    hostGoneHintFinal: 'La partie était terminée : crée un nouveau salon pour la revanche.',
    /** No "Réessayer" possible (e.g. on the host's own tab). */
    noRetryDescription: 'La connexion avec le salon a été interrompue.',
    noRetryHint: 'Vérifie ta connexion, puis réessaie depuis l’accueil.',
    descriptionLobby: 'L’hôte ne répond pas : le salon a peut-être été fermé.',
    description: 'L’hôte ne répond plus depuis un moment.',
    hintLobby: 'Réessaie dans un instant, ou retourne à l’accueil pour créer ton propre salon.',
    hintGame: 'Si l’hôte est toujours en partie, tu reprendras là où tu en étais, avec ton score.',
    hintFinal: 'Si l’hôte est toujours en ligne, tu pourras revenir jouer la revanche.',
  },

  /** Dialog after being dropped out of a room, by reason. */
  exit: {
    kicked: {
      title: 'Hors du salon',
      hint: 'Tu peux toujours créer ton propre salon, ou en rejoindre un autre avec un code.',
    },
    closed: {
      title: 'Salon fermé',
      hint: 'La partie est terminée pour tout le monde. Crée un nouveau salon ou rejoins-en un autre avec un code.',
    },
    /** The same profile joined from another tab or device. */
    duplicate: {
      title: 'Déjà en partie',
      hint: 'Ferme l’autre onglet pour jouer ici.',
    },
    /** The room no longer exists (host left, or a rejoin found nothing). */
    gone: {
      title: 'Salon indisponible',
      description: 'L’hôte a fermé le salon ou perdu la connexion.',
      hint: 'Crée un nouveau salon depuis l’accueil ou rejoins-en un autre avec un code.',
    },
    /** Rejoining failed (network). */
    failed: {
      title: 'Impossible de revenir',
      hint: 'Vérifie ta connexion, puis réessaie avec le code depuis l’accueil.',
    },
    /** Any other reason. */
    generic: {
      title: 'Tu n’es plus dans le salon',
      hint: 'Tu peux revenir avec le même code depuis l’accueil.',
    },
  },

  /** Overlay while a reloaded tab re-enters its room, and the notice if that fails. */
  resume: {
    title: 'Reconnexion',
    host: 'Réouverture de ton salon',
    hostRoom: 'Réouverture de ton salon <b>{code}</b>',
    client: 'Retour dans le salon',
    clientRoom: 'Retour dans le salon <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'Le salon <b>{code}</b> n’existe plus. {hint}',
    failedRoom:
      'Impossible de te ramener dans le salon <b>{code}</b>. Si la partie est encore en cours, reviens avec le code depuis l’accueil.',
    failed: 'Si la partie est encore en cours, reviens avec le code depuis l’accueil.',
  },

  /** Full-screen crash fallback. */
  crash: {
    eyebrow: 'Erreur inattendue',
    title: 'Quelque chose s’est mal passé',
    body: 'Le disque est rayé. Recharge la page : si tu étais dans un salon, on essaie de t’y ramener.',
    reload: 'Recharger',
    showDetails: 'Détails techniques',
    hideDetails: 'Masquer les détails',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    /** Stands in for {name} when the player's nickname is unknown. */
    someone: 'Quelqu’un',
    joined: '{name} a rejoint le salon',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { one: 'Vous êtes maintenant {count}', other: 'Vous êtes maintenant {count}' },
    left: '{name} a quitté le salon',
    submitted: '{name} a validé',
    /** Under "submitted" for the first one: the short final timer started. */
    lastSeconds: { one: 'Plus que {count} seconde pour tout le monde !', other: 'Plus que {count} secondes pour tout le monde !' },
    lastSecondsSoon: 'Dernières secondes pour tout le monde !',
    kicked: 'L’hôte a exclu {name}',
    kickedSomeone: 'L’hôte a exclu quelqu’un',
  },

  /** Toast while the browser keeps audio locked (touch screens say "touche", others "clique"). */
  audioCue: {
    tapToListen: 'Touche pour écouter la chanson',
    clickToListen: 'Clique pour écouter la chanson',
    tapToEnable: 'Touche pour activer le son',
    clickToEnable: 'Clique pour activer le son',
    tapBody: 'Ton navigateur bloque le son tant que tu n’as pas touché l’écran.',
    clickBody: 'Ton navigateur bloque le son tant que tu n’as pas interagi avec la page.',
  },

  /** Sound button and its popover. */
  sound: {
    /** Button label and tooltip. */
    button: 'Son',
    buttonMuted: 'Son coupé',
    buttonLocked: 'Son bloqué par le navigateur : touche pour l’activer',
    /** aria-label of the popover. */
    panel: 'Réglages du son',
    /** Popover heading (small caps). */
    heading: 'Son',
    /** Next to the "M" key badge (the shortcut key itself is always M). */
    muteShortcut: 'Muet',
    mute: 'Couper le son',
    unmute: 'Remettre le son',
    volume: 'Volume',
    sfx: 'Effets sonores',
    sfxDetail: 'Clics, chrono, réactions',
    /** Small pill next to the button while the browser keeps audio locked (one line). */
    unlock: 'Activer le son',
    unlockTitle: 'Le navigateur bloque le son tant que tu ne touches pas la page',
  },

  /** Emoji reaction bar and the floating reactions. */
  reactions: {
    /** aria-label of the bar. */
    group: 'Réactions',
    /** aria-label of each button; {name} is one of the names below. */
    button: 'Réaction : {name}',
    /** Name tag under your own floating reaction. */
    you: 'Toi',
    /** Tooltip and accessible name of each emoji. */
    names: {
      fire: 'C’est le feu',
      laugh: 'Fou rire',
      shock: 'Choc',
      clap: 'Bravo',
      dead: 'Mort de rire',
      party: 'Fête',
      mindBlown: 'Cerveau explosé',
      cool: 'Trop classe',
      rematch: 'Revanche',
    },
  },

  /** Native "leave page?" prompt while hosting a game (most browsers show their own text). */
  leaveWarning: 'Si tu pars, la partie s’arrête pour tout le monde',
} satisfies Catalog['shell']
