// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'Embaralhando a playlist…',
    slicing: 'Picando o hit…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'Esperando todo mundo ficar pronto…',
  },
  host: {
    noPlaylist: 'Escolha uma playlist antes de começar.',
    alreadyStarted: 'A partida já começou.',
    closed: 'A sala foi fechada.',
    playlistFailed: 'Não consegui carregar a playlist do Deezer. Verifique a conexão e tente de novo.',
    prepareFailed: 'Não consegui preparar as músicas desta playlist, então voltamos para o lobby. Tente outra playlist.',
    notEnoughTracks: 'Esta playlist não tem músicas suficientes com prévia (precisa de pelo menos {count}).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Jogador',
    /** Name of a playlist whose title is missing. {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: 'Playlist {id}',
  },
  store: {
    invalidCode: 'Código de sala inválido.',
    cancelled: 'Operação cancelada.',
    hostLost: 'A conexão com o host caiu.',
    hostGone: 'O host saiu da partida.',
    welcomeTimeout: 'O host não responde. Tente de novo daqui a pouco.',
    joinFailed: 'Não foi possível entrar na sala. Tente de novo.',
    createFailed: 'Não foi possível criar a sala. Tente de novo.',
    startFailed: 'Não foi possível começar a partida.',
    rejected: 'O host recusou a conexão.',
    signalingLost: 'A conexão com o servidor caiu: novos jogadores não conseguem entrar.',
    actionFailed: 'Não deu certo.',
    audioUnavailable: 'Áudio desta rodada indisponível: dá para jogar mesmo assim.',
    audioUnavailableTitled: 'Áudio de “{title}” indisponível.',
  },
  net: {
    network: 'Sem conexão de rede. Verifique a conexão e tente de novo.',
    server: 'O servidor de conexão não responde. Tente de novo em alguns segundos.',
    signaling: 'Servidor de conexão inacessível. Tente de novo daqui a pouco ou mude de rede (Wi‑Fi ou dados móveis).',
    createTimeout: 'O servidor de conexão não responde. Tente de novo em alguns segundos.',
    joinTimeout: 'Não foi possível conectar ao host. Tente de novo; se não funcionar, use outra rede (Wi‑Fi ou dados móveis).',
    hostNoAnswer: 'O host não responde. Confira o código ou tente de novo daqui a pouco.',
    roomNotFound: 'Sala não encontrada. Confira o código.',
    invalidCode: 'Código de sala inválido. São 5 letras, por exemplo KXQPM.',
    unsupported: 'Este navegador não suporta conexões peer-to-peer (WebRTC). Use o Chrome, o Safari ou o Firefox atualizados.',
    loadFailed: 'Não foi possível carregar o módulo de rede. Recarregue a página.',
    unknown: 'Erro de conexão inesperado. Tente de novo.',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'Sala não encontrada. Confira o código.',
      network: 'Problema de rede. Verifique a conexão e tente de novo.',
      server: 'Servidor de conexão inacessível. Tente de novo daqui a pouco.',
      timeout: 'Sem resposta do servidor de conexão. Tente de novo.',
      unsupported: 'Seu navegador não suporta conexões peer-to-peer (WebRTC).',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'A sala está cheia.',
    version: 'Sua versão do jogo é diferente da do host. Recarregue a página.',
    kicked: 'O host removeu você da sala.',
    closed: 'O host fechou a sala.',
    duplicate: 'Seu perfil já está nesta sala, em outra aba ou outro dispositivo.',
  },
  deezer: {
    timeout: 'O Deezer não responde. Verifique a conexão e tente de novo.',
    network: 'Não foi possível falar com o Deezer. Verifique a conexão (ou algum bloqueador de anúncios) e tente de novo.',
    invalid: 'Resposta inesperada do Deezer. Tente de novo daqui a pouco.',
    quota: 'Pedidos demais ao Deezer em pouco tempo. Espere alguns segundos e tente de novo.',
    busy: 'O Deezer está sobrecarregado no momento. Tente de novo daqui a pouco.',
    notFound: 'Conteúdo não encontrado no Deezer.',
    forbidden: 'Conteúdo inacessível: pode ser privado ou indisponível no seu país.',
    badRequest: 'Pedido inválido para o Deezer.',
    api: 'Erro do Deezer. Tente de novo daqui a pouco.',
    playlistNotFound: 'Playlist não encontrada: confira o link (playlists privadas não podem ser acessadas).',
    noPreview: 'Prévia indisponível para esta música.',
    trackNotFound: 'Esta música não está mais disponível no Deezer.',
    featured: 'Não foi possível carregar as playlists em destaque.',
    /**
     * Stand-ins for empty Deezer fields, written into the song / playlist data (in the
     * host's language, like a player's default name) and shown as a title / artist.
     */
    fallback: {
      playlist: 'Playlist sem título',
      track: 'Sem título',
      artist: 'Artista desconhecido',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16). */
  difficulty: {
    easy: 'Fácil',
    normal: 'Normal',
    hard: 'Difícil',
    insane: 'Insano',
  },
} satisfies Catalog['game']
