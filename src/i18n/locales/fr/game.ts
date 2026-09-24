// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'On mélange la playlist…',
    slicing: 'On met le tube en morceaux…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'On attend tout le monde…',
  },
  host: {
    noPlaylist: 'Choisis une playlist avant de commencer.',
    alreadyStarted: 'La partie a déjà commencé.',
    closed: 'Le salon a été fermé.',
    playlistFailed: 'Impossible de charger la playlist depuis Deezer. Vérifie ta connexion et réessaie.',
    prepareFailed: 'Impossible de préparer les chansons de cette playlist, retour au salon. Essaie avec une autre playlist.',
    notEnoughTracks: 'Cette playlist n’a pas assez de titres avec extrait (il en faut au moins {count}).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Anonyme',
    /** Name of a playlist whose title is missing. {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: 'Playlist {id}',
  },
  store: {
    invalidCode: 'Code de salon invalide.',
    cancelled: 'Opération annulée.',
    hostLost: 'Connexion avec l’hôte perdue.',
    hostGone: 'L’hôte a quitté la partie.',
    welcomeTimeout: 'L’hôte ne répond pas. Réessaie dans un instant.',
    joinFailed: 'Impossible de rejoindre le salon. Réessaie.',
    createFailed: 'Impossible de créer le salon. Réessaie.',
    startFailed: 'Impossible de lancer la partie.',
    rejected: 'L’hôte a refusé la connexion.',
    signalingLost: 'Connexion au serveur perdue : les nouveaux joueurs ne peuvent plus entrer.',
    actionFailed: 'L’action a échoué.',
    audioUnavailable: 'Audio indisponible pour cette manche : tu peux quand même jouer.',
    audioUnavailableTitled: 'Audio de « {title} » indisponible.',
  },
  net: {
    network: 'Réseau indisponible. Vérifie ta connexion et réessaie.',
    server: 'Le serveur de connexion ne répond pas. Réessaie dans quelques secondes.',
    signaling: 'Serveur de connexion injoignable. Réessaie dans un instant ou change de réseau (Wi‑Fi ou données mobiles).',
    createTimeout: 'Le serveur de connexion ne répond pas. Réessaie dans quelques secondes.',
    joinTimeout: 'Impossible de se connecter à l’hôte. Réessaie ; si ça ne passe toujours pas, change de réseau (Wi‑Fi ou données mobiles).',
    hostNoAnswer: 'L’hôte ne répond pas. Vérifie le code ou réessaie dans un instant.',
    roomNotFound: 'Salon introuvable. Vérifie le code.',
    invalidCode: 'Code de salon invalide. Il fait 5 lettres, par exemple KXQPM.',
    unsupported: 'Ce navigateur ne prend pas en charge les connexions pair-à-pair (WebRTC). Essaie avec une version récente de Chrome, Safari ou Firefox.',
    loadFailed: 'Impossible de charger le module réseau. Recharge la page.',
    unknown: 'Erreur de connexion inattendue. Réessaie.',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'Salon introuvable. Vérifie le code.',
      network: 'Problème de réseau. Vérifie ta connexion et réessaie.',
      server: 'Serveur de connexion injoignable. Réessaie dans un instant.',
      timeout: 'Pas de réponse du serveur de connexion. Réessaie.',
      unsupported: 'Ton navigateur ne prend pas en charge les connexions pair-à-pair (WebRTC).',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'Le salon est complet.',
    version: 'Ta version du jeu est différente de celle de l’hôte. Recharge la page.',
    kicked: 'L’hôte t’a fait sortir du salon.',
    closed: 'L’hôte a fermé le salon.',
    duplicate: 'Ton profil est déjà dans ce salon depuis un autre onglet ou un autre appareil.',
  },
  deezer: {
    timeout: 'Deezer ne répond pas. Vérifie ta connexion et réessaie.',
    network: 'Impossible de joindre Deezer. Vérifie ta connexion (ou ton bloqueur de pub) et réessaie.',
    invalid: 'Réponse inattendue de Deezer. Réessaie dans un instant.',
    quota: 'Trop de requêtes envoyées à Deezer en peu de temps. Attends quelques secondes et réessaie.',
    busy: 'Deezer est momentanément surchargé. Réessaie dans un instant.',
    notFound: 'Contenu introuvable sur Deezer.',
    forbidden: 'Contenu inaccessible : il est peut-être privé ou indisponible dans ton pays.',
    badRequest: 'Requête invalide pour Deezer.',
    api: 'Erreur Deezer. Réessaie dans un instant.',
    playlistNotFound: 'Playlist introuvable : vérifie le lien (les playlists privées ne sont pas accessibles).',
    noPreview: 'Aucun extrait disponible pour ce titre.',
    trackNotFound: 'Ce titre n’est plus disponible sur Deezer.',
    featured: 'Impossible de charger les playlists à la une.',
    /**
     * Stand-ins for empty Deezer fields, written into the song / playlist data (in the
     * host's language, like a player's default name) and shown as a title / artist.
     */
    fallback: {
      playlist: 'Playlist sans titre',
      track: 'Sans titre',
      artist: 'Artiste inconnu',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16). Masculine ("mode"): also shown lowercased in "(normal)". */
  difficulty: {
    easy: 'Facile',
    normal: 'Normal',
    hard: 'Difficile',
    insane: 'Infernal',
  },
} satisfies Catalog['game']
