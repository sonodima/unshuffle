// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Keyboard key names, as printed on the key caps. */
  keys: {
    space: 'Espaço',
    enter: 'Enter',
    /** The Control key (Apple keyboards show ⌘ instead). */
    ctrl: 'Ctrl',
  },
  /** Retry button (short: sits next to an error). */
  retry: 'Tentar de novo',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: 'Rodada <b>{number}</b><dim> / {total}</dim>',
    /** Big headline (the host's own step messages come from game.prep). */
    allReady: 'Tudo pronto, vamos lá!',
    waiting: 'Esperando todo mundo ficar pronto…',
    fallback: 'Preparando a rodada…',
    /** Checklist: three steps, each with an "in progress" and a "done" label. */
    steps: {
      songActive: 'Escolhendo a música…',
      songDone: 'Música escolhida',
      /** Under "Música escolhida": the title stays hidden until the reveal. */
      songDetail: 'Segredo até o fim',
      downloadActive: 'Baixando os trechos…',
      downloadDone: 'Trechos baixados',
      downloadError: 'Falha no download',
      /** Under "Falha no download". */
      downloadErrorDetail: 'Dá para jogar mesmo sem áudio',
      sliceActive: 'Fatiando a faixa…',
      sliceDone: 'Faixa fatiada',
      /** Under "Faixa fatiada": the song is cut on the beat. One line, ~35 chars. */
      sliceDetail: { one: '{count} trecho no ritmo da música', other: '{count} trechos no ritmo da música' },
    },
    /** Small uppercase label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: 'Prontos <b>{ready}</b><dim>/{total}</dim>',
    /** Screen-reader label of the avatar row. */
    readyPlayers: 'Jogadores prontos',
  },

  /** Rotating tips on the preparing screen (one at a time, ~2 lines on phones). */
  tips: {
    title: 'Você sabia?',
    howToHover: 'Clique num bloco para ouvir e arraste para mudar de lugar.',
    howToTouch: 'Toque num bloco para ouvir e arraste para mudar de lugar.',
    /** “Ouvir tudo” is the play-all button of the board. */
    playAll: '“Ouvir tudo” toca os blocos na ordem atual: se soar redondinho, você está quase lá.',
    hold: 'Segure um bloco para ouvir a sequência a partir dele.',
    pairs: 'Dois blocos vizinhos na ordem certa valem pontos mesmo fora do lugar.',
    firstConfirm: 'Quem confirma primeiro dispara a contagem final para todo mundo.',
    edges: 'Procure a entrada da música e o ponto em que ela vai sumindo: são os primeiros e os últimos blocos.',
    /** {points} = the maximum score of a round (5000, formatted). */
    perfect: 'Ordem perfeita = {points} pontos. Sem pressão.',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: 'Última rodada',
    /** Screen-reader text of the headline. */
    headlineLabel: 'Rodada {number} de {total}',
    /**
     * Huge one-line headline: <word> white text, <n> the round number (lime),
     * <total> "/total" (small, grey). Keep the three tags; spaces between tags don't show.
     */
    headline: '<word>Rodada</word> <n>{number}</n><total>/{total}</total>',
    /** Screen-reader label of the round facts list. */
    rulesLabel: 'Regras da rodada',
    /** Fact pills. <b> = the number (white). */
    snippets: { one: '<b>{count}</b> trecho', other: '<b>{count}</b> trechos' },
    /** Round duration; "s" = seconds. */
    seconds: '<b>{seconds}</b> s',
    spectator: 'Nesta rodada você só assiste: joga a partir da próxima.',
    howToHover: 'Clique num bloco para ouvir e arraste até o lugar dele.',
    howToTouch: 'Toque num bloco para ouvir e arraste até o lugar dele.',
    /** Shown inside the countdown ring before "3" (small, uppercase). */
    ready: 'Bora?',
    /** Screen-reader text of the countdown ring: before the count / while counting ({seconds} = 3, 2, 1). */
    readyLabel: 'Prepare-se',
    countdownLabel: 'Começa em {seconds}',
  },

  /** Full-screen slam when the round starts. Very short (1 word, huge type). */
  go: 'Já!',
  /** Shown while the board data for the round arrives. */
  syncing: 'Sincronizando a rodada…',

  /** Top bar while playing. Labels are tiny uppercase eyebrows: keep them short. */
  hud: {
    round: 'Rodada',
    snippets: 'Trechos',
    points: 'Pontos',
    /** Caption inside the timer ring (1 short word): normal / after the first confirm. */
    time: 'Tempo',
    finalTime: 'Final',
    /** Badge under the ring after the first confirm. */
    lastSeconds: 'Últimos segundos',
    /** Eyebrow over the avatars: {done} players out of {total} confirmed. */
    confirmed: 'Confirmaram {done}/{total}',
    /** Standing under the score. {rank} = the place, already an ordinal (ui.ordinal: "1º"). */
    rank: '{rank} lugar',
    /** Screen-reader label of the avatar row. */
    players: 'Jogadores da rodada',
  },

  /** Avatar rows. */
  players: {
    /** The viewer's own avatar (screen readers / tooltip). */
    me: '{name} (você)',
    /** Chip after the last shown avatar ("+3"), for screen readers. */
    more: { one: 'e mais {count}', other: 'e mais {count}' },
  },

  /** "Giulia confirmou!" — the final-countdown banner in the HUD. */
  banner: {
    /** Player without a name. */
    someone: 'Alguém',
    mine: 'Você confirmou primeiro!',
    /** <name> is the player's name: on phones only the name is shortened (one line). */
    confirmedBy: '<name>{name}</name> confirmou!',
    /** Line under the title; <n> is the live seconds count (animated). "s" = seconds. */
    othersLeft: 'Os outros ainda têm <n>{seconds}</n> s',
    youLeft: { one: 'Só mais <n>{count}</n> segundo', other: 'Você ainda tem <n>{count}</n> segundos' },
    /** For players who can't act any more (already confirmed, spectators). */
    finalTimer: 'Contagem final: <n>{seconds}</n> s',
  },

  /** Bottom dock: play-all transport + CONFIRMAR / status. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: 'Confirmar',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: 'Você não mexeu em nada',
    armTap: 'Toque de novo para confirmar',
    armClick: 'Clique de novo para confirmar',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: 'Pressione {mod} + {enter} de novo',
    confirmed: 'Confirmado',
    /** Confirmed while offline: it is sent on reconnect. */
    queued: 'Enviamos quando a conexão voltar',
    /** {names} = one or two player names ("Giulia", "Giulia e Marco"). */
    waitingFor: 'Esperando {names}',
    waitingForCount: { one: 'Esperando {count} jogador', other: 'Esperando {count} jogadores' },
    allConfirmed: 'Todo mundo confirmou!',
    /** Screen-reader label of the avatars of those still playing. */
    stillPlaying: 'Ainda jogando',
    timeUp: 'Tempo esgotado!',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: 'Vale a ordem que você deixou',
    computing: 'Calculando os resultados…',
    spectator: 'Assistindo',
    spectatorBody: 'Você joga a partir da próxima rodada',
    audioFailed: 'Áudio indisponível',
    audioFailedBody: 'Tente de novo ou jogue assim mesmo',
    /** Icon button (phones): screen readers / tooltip. */
    retryAudio: 'Tentar baixar o áudio de novo',
    /**
     * Keyboard legend under the dock (desktop). <kbd> = a key cap. {space} / {enter} /
     * {mod} (⌘ or Ctrl) are key names. <action> = the action label after a combination.
     */
    hints: {
      playAll: '<kbd>{space}</kbd> ouvir tudo',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>confirmar</action>',
      pointer: 'Clique num bloco para ouvir · segure para ouvir dali em diante · arraste para mover',
      /** Same, after confirming (blocks can't move any more). */
      pointerLocked: 'Clique num bloco para ouvir · segure para ouvir dali em diante',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: 'Você está assistindo',
    bodyHover: 'Você joga a partir da próxima rodada. Enquanto isso, clique nos blocos para ouvir os trechos.',
    bodyTouch: 'Você joga a partir da próxima rodada. Enquanto isso, toque nos blocos para ouvir os trechos.',
  },

  /** In-game exit menu (sheet). */
  menu: {
    /** Round button that opens it (screen readers / tooltip). */
    endButton: 'Encerrar partida',
    leaveButton: 'Sair da partida',
    hostTitle: 'Encerrar a partida?',
    guestTitle: 'Sair da partida?',
    hostBody: 'A partida acaba para todo mundo, não só para você.',
    /** Host alone in the room. */
    hostAloneBody: 'A partida termina aqui.',
    guestBody: 'A partida continua sem você. Enquanto ela estiver rolando, dá para voltar e recuperar sua pontuação.',
    keepPlaying: 'Continuar jogando',
    stay: 'Ficar',
    /** Guest's red confirm button in the sheet (the round button above only opens it). */
    leave: 'Sair da partida',
    toLobby: 'Voltar ao lobby',
    toLobbyBody: 'Pontos zerados, mesma galera: troquem de playlist e comecem de novo.',
    toLobbyAloneBody: 'Pontuação zerada: troque de playlist e comece de novo.',
    close: 'Fechar a sala',
    /** Closing the room disconnects the one other player / all the others (2 or more). */
    closeBodyOne: 'A outra pessoa será desconectada.',
    closeBodyMany: 'Todo mundo será desconectado.',
    closeAloneBody: 'Você volta para o início.',
    /** Next to the room code (guests). */
    rejoinCode: 'Código para voltar',
  },
} satisfies Catalog['round']
