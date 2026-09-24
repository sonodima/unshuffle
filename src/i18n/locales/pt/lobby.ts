// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button (dock / bottom sheet). Short: ~16 characters. */
  start: 'Começar partida',
  /** Player count in the desktop start dock. */
  players: { one: '<num>{count}</num> jogador', other: '<num>{count}</num> jogadores' },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: { one: '<num>{count}</num> música', other: '<num>{count}</num> músicas' },
  /** Dismiss button of the lobby dialogs (remove a player, edit your profile). */
  cancel: 'Cancelar',

  header: {
    /** Small pill next to the logo. */
    badge: 'Lobby',
  },

  /** Leave / close the room: header button and confirmation dialog. */
  leave: {
    /** Host button (header on desktop, dialog confirm). Short. */
    closeRoom: 'Fechar sala',
    /** Guest button (header on desktop, dialog confirm). Short. */
    exit: 'Sair',
    /** Guest back button on phones (screen readers only). */
    exitRoom: 'Sair da sala',
    hostTitle: 'Fechar a sala?',
    guestTitle: 'Sair da sala?',
    /** Host, other players in the room. */
    hostBody: 'A sala é sua: se você sair, ela fecha e todo mundo é desconectado.',
    /** Host alone in the room. */
    hostAloneBody: 'A sala será fechada.',
    /** {code}: the 5-letter room code. */
    guestBody: 'Você pode voltar com o código {code} enquanto a partida não começar.',
    stay: 'Ficar',
  },

  /** Phone tabs. Labels must stay short (~10 characters): three tabs share a 360px bar. */
  tabs: {
    /** Tab bar name (screen readers). */
    label: 'Seções do lobby',
    players: 'Jogadores',
    playlist: 'Playlist',
    rules: 'Regras',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, falta escolher',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { one: '{tab}, {count} jogador', other: '{tab}, {count} jogadores' },
  },

  /** Invite link (the "Convidar" button and the free seats). */
  invite: {
    /** Toast. */
    linkCopied: 'Link da sala copiado!',
    /** Toast. */
    copyFailed: 'Não deu para copiar: use o botão do QR para ver o link.',
    /** Native share sheet text; the join link follows it. {code}: the room code. */
    shareText: 'Te desafio no UNSHUFFLE! Entre na sala {code}:',
  },

  /** Room code card. */
  code: {
    title: 'Código da sala',
    /** Hint next to the title (top right of the card, short). */
    clickToCopy: 'Clique para copiar',
    tapToCopy: 'Toque para copiar',
    copied: 'Código copiado!',
    copyFailed: 'Não deu para copiar',
    /** Screen readers. {code}: the room code spelled letter by letter ("K X Q P M"). */
    copyLabel: 'Código da sala {code}. Copiar código',
    /** Button (phones: shares the row with "Compartilhar" and the QR button). Short. */
    copyLink: 'Copiar link',
    /** "Copiar link" right after a successful copy. */
    linkCopied: 'Copiado!',
    share: 'Compartilhar',
    showQr: 'Mostrar QR code',
    enlargeQr: 'Ampliar QR code',
    /** Desktop card, next to the QR code. */
    phoneTitle: 'Entre pelo celular',
    phoneBody: 'Escaneie o QR ou abra o link: dá para entrar na hora, sem cadastro.',
  },

  /** QR code dialog. */
  qr: {
    title: 'Chame a galera',
    description: 'Escaneie o QR com a câmera do celular ou compartilhe o link.',
    /** Label above the room code. */
    code: 'Código',
    /** Button next to the link. */
    copy: 'Copiar',
    copied: 'Copiado',
    copyFailed: 'Não deu para copiar: selecione o link e copie manualmente.',
    shareLink: 'Compartilhar link',
    /** The QR image (screen readers). */
    imageLabel: 'QR code para entrar na sala',
  },

  /** Player list. */
  roster: {
    title: 'Jogadores',
    /** Shown when someone is reconnecting: how many players are connected. */
    online: { one: '<num>{count}</num> online', other: '<num>{count}</num> online' },
    /** Screen readers, for the "3/10" pill. {max}: room capacity. */
    capacity: { one: '{count} jogador de {max}', other: '{count} jogadores de {max}' },
    listLabel: 'Lista de jogadores',
    /** Badge on your own row. Very short. */
    you: 'Você',
    /** Badge on the host's row. Very short. */
    host: 'Host',
    reconnecting: 'Reconectando…',
    editProfile: 'Editar perfil',
    /** Kick button (screen readers / tooltip). {name}: player name. */
    kickLabel: 'Remover {name}',
    freeSeats: { one: '<num>{count}</num> vaga livre', other: '<num>{count}</num> vagas livres' },
    /** Button next to the free seats. Short. */
    invite: 'Convidar',
    /** Kick confirmation dialog. */
    kick: {
      /** {name}: player name. */
      title: 'Remover {name}?',
      titleFallback: 'Remover este jogador?',
      body: 'A pessoa sai da sala na hora e não pode mais voltar.',
      confirm: 'Remover',
    },
  },

  /** Your profile dialog (name + avatar). */
  profile: {
    title: 'Seu perfil',
    name: 'Nome',
    namePlaceholder: 'Como você se chama?',
    nameRequired: 'Escreva pelo menos um caractere.',
    save: 'Salvar',
  },

  /** Playlist picker (host). */
  picker: {
    title: 'Escolha a playlist',
    /** Next to the title on wide screens. */
    source: 'Músicas do Deezer · prévias de 30 segundos',
    searchLabel: 'Buscar playlist',
    /** Must fit a 300px-wide field on phones (~32 characters). */
    searchPlaceholder: 'Busque ou cole um link do Deezer',
    searching: 'Buscando',
    clear: 'Limpar busca',
    /** Shelf heading while the search box is empty. */
    featured: 'Em destaque',
    /** Heading of a pasted playlist link. */
    fromLink: 'Do seu link',
    /** {query}: what the host typed. */
    resultsFor: 'Resultados para “{query}”',
    /** Result count (next to the heading, and for screen readers). */
    count: { one: '{count} playlist', other: '{count} playlists' },
    /** Screen readers. */
    loading: 'Carregando…',
    /** Screen readers. */
    invalidLink: 'Link inválido',
    pickedFromLink: 'Playlist escolhida pelo link',
    retry: 'Tentar de novo',
    /** Hover label on a cover. Very short. */
    pick: 'Escolher',
    /** Card subtitle of a playlist shorter than the shortest game. */
    tracksTooShort: { one: '<num>{count}</num> música · curta demais', other: '<num>{count}</num> músicas · curta demais' },
    /** Card subtitle. {creator}: Deezer user / curator name. */
    tracksBy: { one: '<num>{count}</num> música · {creator}', other: '<num>{count}</num> músicas · {creator}' },
    /** Category chips row (screen readers). */
    chips: 'Categorias',
    chipsPrev: 'Categorias anteriores',
    chipsNext: 'Mais categorias',
    /** A share short link was pasted (link.deezer.com). */
    shortLink: {
      title: 'Cole o link completo da playlist',
      body: 'Links curtos (link.deezer.com) não abrem por aqui. Abra no navegador ou no app do Deezer e copie o endereço completo: deezer.com/…/playlist/123456.',
    },
    /** A link that is not a Deezer playlist was pasted. */
    foreignLink: {
      title: 'Este link não é de uma playlist',
      body: 'Cole o link de uma playlist pública do Deezer, tipo deezer.com/br/playlist/123456 — ou busque por nome, artista ou gênero.',
    },
    /** A pasted playlist link failed. */
    notFound: {
      title: 'Playlist não encontrada',
      /** The playlist doesn't exist or is private. */
      body: 'Confira o link (playlists privadas não podem ser acessadas).',
    },
    /** A search / the shelf failed (the error message follows). */
    offline: 'O Deezer não responde',
    empty: {
      title: 'Nenhuma playlist',
      /** {query}: what the host typed. */
      titleFor: 'Nenhuma playlist para “{query}”',
      body: 'Tente um artista, um gênero ou uma década, ou cole o link de uma playlist do Deezer.',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: 'Playlist escolhida',
    /** Small label above the title (uppercase by CSS). */
    eyebrow: 'Playlist',
    /** The same eyebrow while the host hasn't picked one yet (host's view). */
    none: 'Nenhuma playlist',
    incoming: 'Playlist a caminho',
    /** {creator}: Deezer user / curator name. */
    by: 'por {creator}',
    hostEmpty: 'Busque uma playlist, toque numa categoria ou cole um link do Deezer.',
    guestEmpty: 'Ela aparece aqui assim que o host escolher: prepare os ouvidos.',
    change: 'Trocar',
  },

  /** Game rules panel: four pickers. */
  rules: {
    title: 'Regras',
    /** Host only: upper bound of the game length. {minutes}: a number. */
    duration: 'Duração máx. <num>~{minutes} min</num>',
    /** Guests: the rules are read-only. Short pill. */
    hostDecides: 'O host decide',
    /** Option label in seconds, e.g. "90s". Keep it very short (4 options share a row). */
    seconds: '{seconds}s',
    /** Screen readers, a snippets option: "8 · Normal". */
    snippetsOption: '{snippets} · {difficulty}',
    /** Row titles are also the pickers' names. Hints are one short line (they truncate). */
    rounds: { title: 'Rodadas', hint: 'Uma música por rodada' },
    snippets: { title: 'Trechos', hint: 'Mais trechos, mais difícil' },
    roundTime: { title: 'Tempo por rodada', hint: 'Para reordenar' },
    finalTimer: { title: 'Contagem final', hint: 'Quando alguém confirma' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: 'Como jogar',
    /** {points}: the maximum score of a round (5.000). */
    perfect: 'Ordem perfeita = <num>{points}</num> pontos',
    listen: {
      title: 'Ouça',
      /** Mouse / trackpad. {count}: snippets per song (6–16). */
      bodyClick: {
        one: 'Cada música é cortada em {count} trecho. Clique num bloco para ouvir.',
        other: 'Cada música é cortada em {count} trechos embaralhados. Clique num bloco para ouvir.',
      },
      /** Touch screens. {count}: snippets per song (6–16). */
      bodyTap: {
        one: 'Cada música é cortada em {count} trecho. Toque num bloco para ouvir.',
        other: 'Cada música é cortada em {count} trechos embaralhados. Toque num bloco para ouvir.',
      },
    },
    reorder: {
      title: 'Ordene',
      body: 'Arraste os blocos até a música voltar a soar certinha. Com ▶ você ouve tudo em sequência.',
    },
    confirm: {
      title: 'Confirme',
      /** {count}: seconds of the final timer (10–30). */
      body: {
        one: 'Quem confirmar primeiro dispara a contagem final: sobra só {count} segundo para os outros.',
        other: 'Quem confirmar primeiro dispara a contagem final: sobram só {count} segundos para os outros.',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5 rodadas · 8 trechos (normal) · 90s".
    rounds: { one: '<num>{count}</num> rodada', other: '<num>{count}</num> rodadas' },
    snippets: { one: '<num>{count}</num> trecho', other: '<num>{count}</num> trechos' },
    /** Desktop dock. {difficulty}: difficulty name, lowercased ("normal"). */
    snippetsLevel: { one: '<num>{count}</num> trecho ({difficulty})', other: '<num>{count}</num> trechos ({difficulty})' },
    /** Seconds per round, e.g. "90s". */
    roundTime: '<num>{seconds}s</num>',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingStart: 'Esperando o host começar a partida',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingPlaylist: 'O host está escolhendo a playlist',
    pickPlaylist: 'Escolha uma playlist para começar',
    solo: 'Dá para jogar solo também',
    /** In place of the playlist title in the dock, before one is picked. */
    noPlaylist: 'Nenhuma playlist',
    /** One-tap fix when the playlist is too short for the chosen rounds. Short button. */
    playRounds: { one: 'Jogar {count} rodada', other: 'Jogar {count} rodadas' },
    /** {count}: tracks the playlist has, {need}: tracks needed (one per round). */
    shortfall: {
      one: 'Playlist curta demais: tem <num>{count}</num> música e precisa de <num>{need}</num>.',
      other: 'Playlist curta demais: tem <num>{count}</num> músicas e precisa de <num>{need}</num>.',
    },
    /** Even the shortest game doesn't fit. {count}: tracks the playlist has, {min}: fewest rounds. */
    shortfallMin: {
      one: 'Playlist curta demais: tem só <num>{count}</num> música e precisa de pelo menos <num>{min}</num>.',
      other: 'Playlist curta demais: tem só <num>{count}</num> músicas e precisa de pelo menos <num>{min}</num>.',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Chosen for Brazilian (and other Portuguese-speaking) players;
   * every query was checked to return sizeable public playlists first.
   */
  chips: [
    { label: 'Mais tocadas', query: 'mais tocadas brasil', emoji: '🔥' },
    { label: 'Anos 2000', query: 'anos 2000', emoji: '💿' },
    { label: 'Anos 90', query: 'anos 90', emoji: '📼' },
    { label: 'Anos 80', query: 'anos 80', emoji: '🕺' },
    { label: 'Sertanejo', query: 'sertanejo', emoji: '🤠' },
    { label: 'Funk', query: 'funk brasileiro', emoji: '🔊' },
    { label: 'Pagode', query: 'pagode', emoji: '🪘' },
    { label: 'MPB', query: 'mpb', emoji: '🎶' },
    { label: 'Rap nacional', query: 'rap nacional', emoji: '🎤' },
    { label: 'Rock nacional', query: 'rock brasileiro', emoji: '🎸' },
    { label: 'Forró', query: 'forró', emoji: '🪗' },
    { label: 'Axé', query: 'axé', emoji: '🎊' },
    { label: 'Pop gringo', query: 'pop internacional', emoji: '🌎' },
    { label: 'Eletrônica', query: 'música eletrônica', emoji: '🎧' },
    { label: 'Churrasco', query: 'churrasco', emoji: '🍖' },
    { label: 'Novelas', query: 'temas de novela', emoji: '📺' },
    { label: 'Disney', query: 'disney brasil', emoji: '🏰' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order.
   * The Brazilian and Portuguese charts first, then Deezer Brasil editorial
   * playlists and a couple of worldwide ones (all public, ≥ 50 tracks).
   */
  featured: [
    1111141961, // Top Brazil — Deezer Charts
    1362519755, // Top Portugal — Deezer Charts
    1592591647, // Hitou — Deezer Brasil
    3155776842, // Top Worldwide — Deezer Charts
    1403652247, // Hits Virais — Deezer Brasil
    5207214368, // Top 50 Sertanejo — Deezer Brasil
    9743264302, // Funk Trends — Deezer Brasil
    1335664985, // Essenciais do Pagode — Deezer Brasil
    1310668575, // Essenciais da Música Brasileira — Deezer Brasil
    3859951986, // Anos 2000 no Brasil — Deezer Brasil
    309650853, // Anos 80 no Brasil — Deezer Brasil
    948759923, // Top Hits Internacionais — Deezer Brasil
  ],
} satisfies Catalog['lobby']
