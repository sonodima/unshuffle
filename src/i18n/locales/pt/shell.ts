// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  /** Buttons shared by the shell's dialogs and the crash screen. */
  action: {
    home: 'Voltar ao início',
    retry: 'Tentar de novo',
    ok: 'OK',
    cancel: 'Cancelar',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE (never translated); {code} a room code. */
  title: {
    lobby: '{brand} · Lobby',
    lobbyRoom: '{brand} · Sala {code}',
    round: '{brand} · Rodada',
    /** Round {round} of {rounds}. */
    roundOf: '{brand} · Rodada {round}/{rounds}',
    roundReveal: '{brand} · Rodada {round}/{rounds} · Resultados',
    roundPreparing: '{brand} · Rodada {round}/{rounds} · Preparando',
    final: '{brand} · Ranking final',
    /** A player lost the link to the host. */
    lost: '{brand} · Conexão perdida',
  },

  /**
   * Floating status pill at the top while the link is down. On phones it sits between
   * the corner buttons (~230px): titles ≤ 24 characters, details ≤ 40.
   */
  banner: {
    /** aria-label of the pill's close button. */
    dismiss: 'Ocultar aviso',
    /** Seconds since the link dropped, next to the title. */
    elapsed: '{seconds}s',
    /** Host: the signaling server dropped; the game goes on. */
    hostReconnecting: 'Servidor caiu, tentando…',
    hostReconnectingDetail: 'A partida continua',
    /** Player: first connection attempt still running. */
    connecting: 'Reconectando…',
    /** Player: link to the host lost, retrying on its own. */
    lost: 'Conexão perdida',
    lostDetail: 'Tentando reconectar…',
    /** After ~5 s: the player will be let back in automatically. */
    lostDetailLong: 'Tentando… você volta automaticamente.',
    /** After ~30 s of retries. */
    hostSilent: 'O host não responde',
    hostSilentDetail: 'Esperando a volta do host…',
    /** Small button in the pill after ~30 s: leave the room. */
    leave: 'Sair',
    /** Host only: nobody new can join, the players already in keep playing. */
    signalingTitle: 'Novas entradas pausadas',
    signalingDetail: 'Sem servidor de conexão: quem já está na sala continua jogando.',
    /** Title of any other host-side warning (the detail is the error itself). */
    warning: 'Atenção',
  },

  /** Room code line in the connection dialogs (small caps label). */
  dialogRoom: 'Sala <b>{code}</b>',

  /** Blocking dialog: a player lost the host for good. */
  lost: {
    title: 'Conexão perdida',
    /** The host left for good, the player was in the lobby. */
    hostClosedTitle: 'O host fechou a sala',
    /** The host left for good during or after the game. */
    hostLeftTitle: 'O host saiu da partida',
    hostGoneDescription: 'A sala não está mais disponível.',
    /** Hint when the game had already ended (otherwise exit.gone.hint is shown). */
    hostGoneHintFinal: 'A partida já tinha acabado: crie uma nova sala para a revanche.',
    /** No "Tentar de novo" possible (e.g. on the host's own tab). */
    noRetryDescription: 'A conexão com a sala caiu.',
    noRetryHint: 'Verifique a conexão e tente de novo pelo início.',
    descriptionLobby: 'O host não responde: talvez tenha fechado a sala.',
    description: 'O host não responde há um tempo.',
    hintLobby: 'Tente de novo daqui a pouco ou volte ao início e crie a sua.',
    hintGame: 'Se o host ainda estiver na partida, ao voltar você continua de onde parou, com a sua pontuação.',
    hintFinal: 'Se o host ainda estiver conectado, ao voltar você pode jogar a revanche.',
  },

  /** Dialog after being dropped out of a room, by reason. */
  exit: {
    kicked: {
      title: 'Fora da sala',
      hint: 'Você sempre pode criar a sua ou entrar com outro código.',
    },
    closed: {
      title: 'Sala fechada',
      hint: 'A partida acabou para todo mundo. Crie uma nova sala ou entre com outro código.',
    },
    /** The same profile joined from another tab or device. */
    duplicate: {
      title: 'Você já está jogando',
      hint: 'Feche a outra aba para jogar por aqui.',
    },
    /** The room no longer exists (host left, or a rejoin found nothing). */
    gone: {
      title: 'Sala indisponível',
      description: 'O host fechou a sala ou perdeu a conexão.',
      hint: 'Crie uma nova sala pelo início ou entre com outro código.',
    },
    /** Rejoining failed (network). */
    failed: {
      title: 'Não foi possível voltar',
      hint: 'Verifique a conexão e tente de novo com o código, pelo início.',
    },
    /** Any other reason. */
    generic: {
      title: 'Você está fora da sala',
      hint: 'Dá para voltar com o mesmo código pelo início.',
    },
  },

  /** Overlay while a reloaded tab re-enters its room, and the notice if that fails. */
  resume: {
    title: 'Reconectando',
    host: 'Reabrindo a sua sala',
    hostRoom: 'Reabrindo a sua sala <b>{code}</b>',
    client: 'Voltando para a sala',
    clientRoom: 'Voltando para a sala <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'A sala <b>{code}</b> não existe mais. {hint}',
    failedRoom:
      'Não consegui levar você de volta para a sala <b>{code}</b>. Se a partida ainda estiver rolando, entre de novo com o código pelo início.',
    failed: 'Se a partida ainda estiver rolando, entre de novo com o código pelo início.',
  },

  /** Full-screen crash fallback. */
  crash: {
    eyebrow: 'Erro inesperado',
    title: 'Algo deu errado',
    body: 'O disco arranhou. Recarregue a página: se você estava numa sala, eu tento levar você de volta.',
    reload: 'Recarregar',
    showDetails: 'Detalhes técnicos',
    hideDetails: 'Ocultar detalhes',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    /** Stands in for {name} when the player's nickname is unknown. */
    someone: 'Alguém',
    joined: '{name} entrou na sala',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { one: 'Agora são {count} na sala', other: 'Agora são {count} na sala' },
    left: '{name} saiu da sala',
    submitted: '{name} confirmou',
    /** Under "submitted" for the first one: the short final timer started. */
    lastSeconds: { one: 'Último segundo para todo mundo!', other: 'Últimos {count} segundos para todo mundo!' },
    lastSecondsSoon: 'Últimos segundos para todo mundo!',
    kicked: 'O host removeu {name}',
    kickedSomeone: 'O host removeu alguém',
  },

  /** Toast while the browser keeps audio locked (touch screens say "toque", others "clique"). */
  audioCue: {
    tapToListen: 'Toque para ouvir a música',
    clickToListen: 'Clique para ouvir a música',
    tapToEnable: 'Toque para ativar o áudio',
    clickToEnable: 'Clique para ativar o áudio',
    tapBody: 'O navegador deixa o áudio em pausa até você tocar na tela.',
    clickBody: 'O navegador deixa o áudio em pausa até você interagir com a página.',
  },

  /** Sound button and its popover. */
  sound: {
    /** Button label and tooltip. */
    button: 'Áudio',
    buttonMuted: 'Áudio desativado',
    buttonLocked: 'Áudio bloqueado pelo navegador: toque para ativar',
    /** aria-label of the popover. */
    panel: 'Configurações de áudio',
    /** Popover heading (small caps). */
    heading: 'Áudio',
    /** Next to the "M" key badge (the shortcut key itself is always M). */
    muteShortcut: 'Mudo',
    mute: 'Desativar áudio',
    unmute: 'Reativar áudio',
    volume: 'Volume',
    sfx: 'Efeitos sonoros',
    sfxDetail: 'Cliques, cronômetro, reações',
    /** Small pill next to the button while the browser keeps audio locked (one line). */
    unlock: 'Ativar áudio',
    unlockTitle: 'O navegador bloqueia o áudio até você tocar na página',
  },

  /** Emoji reaction bar and the floating reactions. */
  reactions: {
    /** aria-label of the bar. */
    group: 'Reações',
    /** aria-label of each button; {name} is one of the names below. */
    button: 'Reação: {name}',
    /** Name tag under your own floating reaction. */
    you: 'Você',
    /** Tooltip and accessible name of each emoji. */
    names: {
      fire: 'Fogo',
      laugh: 'Risada',
      shock: 'Choque',
      clap: 'Aplausos',
      dead: 'Morrendo de rir',
      party: 'Festa',
      mindBlown: 'Cabeça explodindo',
      cool: 'Top demais',
      rematch: 'Revanche',
    },
  },

  /** Native "leave page?" prompt while hosting a game (most browsers show their own text). */
  leaveWarning: 'Se você sair, a partida acaba para todo mundo',
} satisfies Catalog['shell']
