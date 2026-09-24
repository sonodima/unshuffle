// Lobby ("salon"): room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button (dock / bottom sheet). Short: ~16 characters. */
  start: 'Lancer la partie',
  /** Player count in the desktop start dock. */
  players: { one: '<num>{count}</num> joueur', other: '<num>{count}</num> joueurs' },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: { one: '<num>{count}</num> titre', other: '<num>{count}</num> titres' },
  /** Dismiss button of the lobby dialogs (remove a player, edit your profile). */
  cancel: 'Annuler',

  header: {
    /** Small pill next to the logo. */
    badge: 'Salon',
  },

  /** Leave / close the room: header button and confirmation dialog. */
  leave: {
    /** Host button (header on desktop, dialog confirm). Short. */
    closeRoom: 'Fermer le salon',
    /** Guest button (header on desktop, dialog confirm). Short. */
    exit: 'Quitter',
    /** Guest back button on phones (screen readers only). */
    exitRoom: 'Quitter le salon',
    hostTitle: 'Fermer le salon ?',
    guestTitle: 'Quitter le salon ?',
    /** Host, other players in the room. */
    hostBody: 'Tu es l’hôte : si tu pars, le salon sera fermé et tous les autres joueurs seront déconnectés.',
    /** Host alone in the room. */
    hostAloneBody: 'Le salon sera fermé.',
    /** {code}: the 5-letter room code. */
    guestBody: 'Tu pourras revenir avec le code {code} tant que la partie n’a pas commencé.',
    stay: 'Rester',
  },

  /** Phone tabs. Labels must stay short (~10 characters): three tabs share a 360px bar. */
  tabs: {
    /** Tab bar name (screen readers). */
    label: 'Sections du salon',
    players: 'Joueurs',
    playlist: 'Playlist',
    rules: 'Règles',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, à choisir',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { one: '{tab}, {count} joueur', other: '{tab}, {count} joueurs' },
  },

  /** Invite link (the "Inviter" button and the free seats). */
  invite: {
    /** Toast. */
    linkCopied: 'Lien du salon copié !',
    /** Toast. */
    copyFailed: 'Échec de la copie : utilise le bouton QR pour voir le lien.',
    /** Native share sheet text; the join link follows it. {code}: the room code. */
    shareText: 'Défie-moi sur UNSHUFFLE ! Rejoins le salon {code} :',
  },

  /** Room code card. */
  code: {
    title: 'Code du salon',
    /** Hint next to the title (top right of the card, short). */
    clickToCopy: 'Clique pour copier',
    tapToCopy: 'Touche pour copier',
    copied: 'Code copié !',
    copyFailed: 'Échec de la copie',
    /** Screen readers. {code}: the room code spelled letter by letter ("K X Q P M"). */
    copyLabel: 'Code du salon {code}. Copier le code',
    /** Button (phones: shares the row with "Partager" and the QR button, ~117px at 360px): the verb alone, like "Partager". */
    copyLink: 'Copier',
    /** "Copier" right after a successful copy. */
    linkCopied: 'Copié !',
    share: 'Partager',
    showQr: 'Afficher le QR code',
    enlargeQr: 'Agrandir le QR code',
    /** Desktop card, next to the QR code. */
    phoneTitle: 'Rejoindre sur mobile',
    phoneBody: 'Scanne le QR ou ouvre le lien : on entre en un clin d’œil, sans compte.',
  },

  /** QR code dialog. */
  qr: {
    title: 'Invite tes potes',
    description: 'Scanne le QR avec l’appareil photo de ton téléphone, ou partage le lien.',
    /** Label above the room code. */
    code: 'Code',
    /** Button next to the link. */
    copy: 'Copier',
    copied: 'Copié',
    copyFailed: 'Échec de la copie : sélectionne le lien et copie-le à la main.',
    shareLink: 'Partager le lien',
    /** The QR image (screen readers). */
    imageLabel: 'QR code pour rejoindre le salon',
  },

  /** Player list. */
  roster: {
    title: 'Joueurs',
    /** Shown when someone is reconnecting: how many players are connected. */
    online: { one: '<num>{count}</num> en ligne', other: '<num>{count}</num> en ligne' },
    /** Screen readers, for the "3/10" pill. {max}: room capacity. */
    capacity: { one: '{count} joueur sur {max}', other: '{count} joueurs sur {max}' },
    listLabel: 'Liste des joueurs',
    /** Badge on your own row. Very short. */
    you: 'Toi',
    /** Badge on the host's row. Very short. */
    host: 'Hôte',
    reconnecting: 'Reconnexion…',
    editProfile: 'Modifier le profil',
    /** Kick button (screen readers / tooltip). {name}: player name. */
    kickLabel: 'Exclure {name}',
    freeSeats: { one: '<num>{count}</num> place libre', other: '<num>{count}</num> places libres' },
    /** Button next to the free seats. Short. */
    invite: 'Inviter',
    /** Kick confirmation dialog. */
    kick: {
      /** {name}: player name. */
      title: 'Exclure {name} ?',
      titleFallback: 'Exclure ce joueur ?',
      body: 'Cette personne quitte le salon tout de suite et ne pourra plus revenir.',
      confirm: 'Exclure',
    },
  },

  /** Your profile dialog (name + avatar). */
  profile: {
    title: 'Ton profil',
    name: 'Pseudo',
    namePlaceholder: 'Comment tu t’appelles ?',
    nameRequired: 'Écris au moins un caractère.',
    save: 'Enregistrer',
  },

  /** Playlist picker (host). */
  picker: {
    title: 'Choisis la playlist',
    /** Next to the title on wide screens. */
    source: 'Titres Deezer · extraits de 30 secondes',
    searchLabel: 'Chercher une playlist',
    /** Must fit a 300px-wide field on phones (~32 characters). */
    searchPlaceholder: 'Cherche ou colle un lien Deezer',
    searching: 'Recherche en cours',
    clear: 'Effacer la recherche',
    /** Shelf heading while the search box is empty. */
    featured: 'À la une',
    /** Heading of a pasted playlist link. */
    fromLink: 'Depuis ton lien',
    /** {query}: what the host typed. */
    resultsFor: 'Résultats pour « {query} »',
    /** Result count (next to the heading, and for screen readers). */
    count: { one: '{count} playlist', other: '{count} playlists' },
    /** Screen readers. */
    loading: 'Chargement…',
    /** Screen readers. */
    invalidLink: 'Lien invalide',
    pickedFromLink: 'Playlist choisie via le lien',
    retry: 'Réessayer',
    /** Hover label on a cover. Very short. */
    pick: 'Choisir',
    /** Card subtitle of a playlist shorter than the shortest game. */
    tracksTooShort: { one: '<num>{count}</num> titre · trop courte', other: '<num>{count}</num> titres · trop courte' },
    /** Card subtitle. {creator}: Deezer user / curator name. */
    tracksBy: { one: '<num>{count}</num> titre · {creator}', other: '<num>{count}</num> titres · {creator}' },
    /** Category chips row (screen readers). */
    chips: 'Catégories',
    chipsPrev: 'Catégories précédentes',
    chipsNext: 'Plus de catégories',
    /** A share short link was pasted (link.deezer.com). */
    shortLink: {
      title: 'Colle le lien complet de la playlist',
      body: 'Les liens courts (link.deezer.com) ne s’ouvrent pas ici. Ouvre-le dans ton navigateur ou dans l’appli Deezer et copie l’adresse complète : deezer.com/…/playlist/123456.',
    },
    /** A link that is not a Deezer playlist was pasted. */
    foreignLink: {
      title: 'Ce lien n’est pas une playlist',
      body: 'Colle le lien d’une playlist Deezer publique, comme deezer.com/fr/playlist/123456 — ou cherche par nom, artiste ou genre.',
    },
    /** A pasted playlist link failed. */
    notFound: {
      title: 'Playlist introuvable',
      /** The playlist doesn't exist or is private. */
      body: 'Vérifie le lien (les playlists privées ne sont pas accessibles).',
    },
    /** A search / the shelf failed (the error message follows). */
    offline: 'Deezer ne répond pas',
    empty: {
      title: 'Aucune playlist',
      /** {query}: what the host typed. */
      titleFor: 'Aucune playlist pour « {query} »',
      body: 'Essaie un artiste, un genre ou une décennie, ou colle le lien d’une playlist Deezer.',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: 'Playlist choisie',
    /** Small label above the title (uppercase by CSS). */
    eyebrow: 'Playlist',
    /** The same eyebrow while the host hasn't picked one yet (host's view). */
    none: 'Aucune playlist',
    incoming: 'Playlist en approche',
    /** {creator}: Deezer user / curator name. */
    by: 'par {creator}',
    hostEmpty: 'Cherche une playlist, choisis une catégorie ou colle un lien Deezer.',
    guestEmpty: 'Elle apparaîtra ici dès que l’hôte l’aura choisie : prépare tes oreilles.',
    change: 'Changer',
  },

  /** Game rules panel: four pickers. */
  rules: {
    title: 'Règles',
    /** Host only: upper bound of the game length. {minutes}: a number. */
    duration: 'Durée max <num>~{minutes} min</num>',
    /** Guests: the rules are read-only. Short pill. */
    hostDecides: 'L’hôte décide',
    /** Option label in seconds, e.g. "90 s" (no-break space). Keep it very short (4 options share a row). */
    seconds: '{seconds} s',
    /** Screen readers, a snippets option: "8 · Normal". */
    snippetsOption: '{snippets} · {difficulty}',
    /** Row titles are also the pickers' names. Hints are one short line (they truncate). */
    rounds: { title: 'Manches', hint: 'Une chanson par manche' },
    snippets: { title: 'Extraits', hint: 'Plus d’extraits, plus dur' },
    roundTime: { title: 'Temps par manche', hint: 'Pour tout replacer' },
    finalTimer: { title: 'Chrono final', hint: 'Après la 1re validation' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: 'Comment jouer',
    /** {points}: the maximum score of a round (5 000). */
    perfect: 'Ordre parfait = <num>{points}</num> points',
    listen: {
      title: 'Écoute',
      /** Mouse / trackpad. {count}: snippets per song (6–16). */
      bodyClick: {
        one: 'Chaque chanson est découpée en {count} extrait. Clique sur un bloc pour l’écouter.',
        other: 'Chaque chanson est découpée en {count} extraits mélangés. Clique sur un bloc pour l’écouter.',
      },
      /** Touch screens. {count}: snippets per song (6–16). */
      bodyTap: {
        one: 'Chaque chanson est découpée en {count} extrait. Touche un bloc pour l’écouter.',
        other: 'Chaque chanson est découpée en {count} extraits mélangés. Touche un bloc pour l’écouter.',
      },
    },
    reorder: {
      title: 'Remets dans l’ordre',
      body: 'Glisse les blocs jusqu’à ce que la chanson sonne juste. Avec ▶, écoute-la en entier dans ton ordre.',
    },
    confirm: {
      title: 'Valide',
      /** {count}: seconds of the final timer (10–30). */
      body: {
        one: 'La première validation lance le chrono final : les autres n’ont plus que {count} seconde.',
        other: 'La première validation lance le chrono final : les autres n’ont plus que {count} secondes.',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5 manches · 8 extraits (normal) · 90 s".
    rounds: { one: '<num>{count}</num> manche', other: '<num>{count}</num> manches' },
    snippets: { one: '<num>{count}</num> extrait', other: '<num>{count}</num> extraits' },
    /** Desktop dock. {difficulty}: difficulty name, lowercased ("normal"). */
    snippetsLevel: { one: '<num>{count}</num> extrait ({difficulty})', other: '<num>{count}</num> extraits ({difficulty})' },
    /** Seconds per round, e.g. "90 s". */
    roundTime: '<num>{seconds} s</num>',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingStart: 'L’hôte va lancer la partie',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingPlaylist: 'L’hôte choisit la playlist',
    pickPlaylist: 'Choisis une playlist pour commencer',
    solo: 'Tu peux aussi jouer en solo',
    /** In place of the playlist title in the dock, before one is picked. */
    noPlaylist: 'Aucune playlist',
    /** One-tap fix when the playlist is too short for the chosen rounds. Short button. */
    playRounds: { one: 'Jouer {count} manche', other: 'Jouer {count} manches' },
    /** {count}: tracks the playlist has, {need}: tracks needed (one per round). */
    shortfall: {
      one: 'Playlist trop courte : elle a <num>{count}</num> titre, il en faut <num>{need}</num>.',
      other: 'Playlist trop courte : elle a <num>{count}</num> titres, il en faut <num>{need}</num>.',
    },
    /** Even the shortest game doesn't fit. {count}: tracks the playlist has, {min}: fewest rounds. */
    shortfallMin: {
      one: 'Playlist trop courte : seulement <num>{count}</num> titre, il en faut au moins <num>{min}</num>.',
      other: 'Playlist trop courte : seulement <num>{count}</num> titres, il en faut au moins <num>{min}</num>.',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Every query was checked on api.deezer.com/search/playlist: its
   * first results are editorial / big public playlists with 40+ tracks.
   */
  chips: [
    { label: 'Tubes du moment', query: 'tubes du moment', emoji: '🔥' },
    { label: 'Années 2000', query: 'hits 2000', emoji: '💿' },
    { label: 'Années 90', query: 'années 90', emoji: '📼' },
    { label: 'Années 80', query: 'années 80', emoji: '🕺' },
    { label: 'Années 70', query: 'années 70', emoji: '🪩' },
    { label: 'Rap français', query: 'rap français', emoji: '🎤' },
    { label: 'Pop française', query: 'pop française', emoji: '🇫🇷' },
    { label: 'Chanson française', query: 'chanson française', emoji: '🌹' },
    { label: 'Blind test', query: 'blind test', emoji: '🙈' },
    { label: 'Tubes de l’été', query: 'tubes de l’été', emoji: '🏖️' },
    { label: 'Rock culte', query: 'rock classics', emoji: '🎸' },
    { label: 'French Touch', query: 'french touch', emoji: '🎧' },
    { label: 'Afro', query: 'afro hits', emoji: '🌍' },
    { label: 'Reggaeton', query: 'reggaeton', emoji: '💃' },
    { label: 'Soirée', query: 'hits soirée', emoji: '🎉' },
    { label: 'Disney', query: 'chansons disney', emoji: '🏰' },
    { label: 'BO de films', query: 'musique de film', emoji: '🎬' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order. The
   * charts of the main French-speaking countries first, then big French hits
   * playlists and a couple of worldwide ones. All public, 50+ tracks, with previews.
   */
  featured: [
    1109890291, // Top France — Deezer Charts
    1266968331, // Top Belgium — Deezer Charts
    1313617925, // Top Switzerland — Deezer Charts
    1652248171, // Top Canada — Deezer Charts
    1362497945, // Top Ivory Coast — Deezer Charts
    3155776842, // Top Worldwide — Deezer Charts
    53362031, // Les titres du moment — Deezer Pop & Hits
    1189520191, // Bleu Blanc Hits — Deezer Variété Française
    1420459465, // Essentiels variété française — Deezer Variété Française
    1071669561, // Actu Rap — Deezer Rap & R&B France
    7089916404, // Blind Test, Tubes 70 80 90 2000 2010 2020 — Filtr France
    1363560485, // Deezer Hits
  ],
} satisfies Catalog['lobby']
