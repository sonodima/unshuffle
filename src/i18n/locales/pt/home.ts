// Home screen: hero, profile card, "Criar sala" / join box, the decorative
// round demo and the "Como jogar" dialog. Labels marked "uppercase" are
// shown in capitals by CSS: write them in normal case.
import type { Catalog } from '../../catalog'

export default {
  /** Top-left button that opens the "how to play" dialog. Small pill, keep short. */
  help: 'Como jogar',
  hero: {
    /** Small line above the logo (uppercase, letter-spaced). Keep it short: ~24 characters. */
    eyebrow: 'Party game musical',
    /** Under the logo. <b>…</b> is the highlighted second sentence. */
    tagline: 'O hit virou picadinho. <b>Coloque tudo de volta no lugar.</b>',
  },
  /** Screen-reader name of the card with the profile and the create / join buttons. */
  cardLabel: 'Jogar',
  /** Screen-reader name of the desktop panel with the animated demo round. */
  demoLabel: 'Prévia de uma rodada',
  /** Banner at the top of the card while the device has no network. */
  offline: 'Você está offline: é preciso ter conexão para jogar.',
  /** Screen-reader label of the × that dismisses an error banner. */
  dismissNotice: 'Fechar aviso',
  /** Divider between the join box and "Criar uma sala" when opened from an invite link (uppercase). */
  or: 'ou',
  /** Link next to "Abrindo a sala…" / "Entrando na sala…" that aborts it. */
  cancel: 'Cancelar',
  create: {
    /** Main call to action (big button, uppercase). Keep it short: ~16 characters. */
    button: 'Criar sala',
    /** Secondary button when the player arrived with an invite link (uppercase). */
    buttonInvited: 'Criar uma sala',
    /** Under the button while the room is being opened. */
    pending: 'Abrindo a sala…',
    /** Hint under "Criar sala". <b>…</b> is the bold lead-in. One line on phones (~50 characters). */
    solo: '<b>Modo solo:</b> crie a sala e comece na hora.',
  },
  join: {
    /** Divider above the 5 code boxes (uppercase). */
    divider: 'Tem um código?',
    /** Label above the code boxes when opened from an invite link (uppercase). */
    invited: 'Você tem um convite!',
    /** Join button (uppercase). */
    button: 'Entrar',
    /** Join button once the invite code is complete. {code} = 5-letter room code, e.g. KXQPM (uppercase). */
    buttonCode: 'Entrar em {code}',
    /** Under the button while connecting. */
    pending: 'Entrando na sala…',
    /** Error under the code boxes when "Entrar" is pressed too early. {count} = code length (5). */
    incomplete: {
      one: 'Digite a letra do código.',
      other: 'Digite todas as {count} letras do código.',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    /** {count} = maximum number of players (10). */
    players: {
      one: '{count} jogador',
      other: 'De 1 a {count} jogadores',
    },
    noAccount: 'Sem cadastro, é só jogar no navegador',
    deezer: 'Prévias musicais do Deezer',
  },
  profile: {
    /** Screen-reader label of the avatar button (opens the avatar / colour picker). */
    changeAvatar: 'Mudar avatar e cor',
    /** Label of the nickname field (uppercase). */
    nameLabel: 'Seu nome',
    namePlaceholder: 'Escolha um nome',
    /** Tooltip / label of the dice button that picks a random nickname. */
    randomName: 'Nome aleatório',
    /** Title of the avatar / colour picker dialog. */
    lookTitle: 'Seu visual',
    lookDescription: 'Escolha emoji e cor: é assim que a galera vai te ver.',
    /** Closes the picker. */
    done: 'Pronto',
    /** Small heading over the preview of your avatar and name (uppercase). */
    preview: 'Prévia',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    /** Tiny badge (uppercase, ~10px). */
    badge: 'Demo',
    /** Caption of each phase of the demo: one line, cut with … beyond ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: 'O hit vira picadinho…',
      listen: 'Ouça os trechos',
      sort: 'Arraste para a ordem certa',
      solved: 'Perfeito! Confirme primeiro',
    },
    /** Phone caption when the demo is solved (one line). {points} = points won, already formatted (5.000). */
    solvedPoints: 'Perfeito! +{points}',
    /** Screen-reader name of the three step chips under the demo board. */
    stepsLabel: 'Como jogar, em resumo',
    /** Step chips under the desktop demo (one word each, ~12 characters). */
    steps: {
      listen: 'Ouça',
      sort: 'Ordene',
      confirm: 'Confirme',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: 'Como jogar',
    description: 'Um hit por rodada, feito em pedaços. Vence quem colocar tudo em ordem melhor e mais rápido.',
    /** Closes the dialog. */
    gotIt: 'Entendi, bora jogar!',
    /** The fake "confirm" button drawn in the third illustration (tiny pill, uppercase): keep it very short. */
    confirmButton: 'Confirmar',
    steps: {
      listen: {
        title: 'Ouça os trechos',
        /** Shown on devices with a mouse. */
        bodyMouse: 'Um hit famoso é cortado no ritmo da música e embaralhado. Clique num bloco para ouvir.',
        /** Shown on touch screens. */
        bodyTouch: 'Um hit famoso é cortado no ritmo da música e embaralhado. Toque num bloco para ouvir.',
      },
      sort: {
        title: 'Arraste para a ordem certa',
        /** <play></play> is replaced by a small ▶ icon (the "play your order" button). Keep it empty. */
        body: 'Mova os blocos até a música soar igual à original. Com <play></play> você ouve a sua ordem.',
      },
      confirm: {
        title: 'Confirme antes dos outros',
        body: 'Quem confirmar primeiro dispara a contagem regressiva final para todo mundo.',
      },
    },
    /**
     * Scoring rule under the steps. {points} = maximum points per round, already
     * formatted (5.000); <b>…</b> highlights it. Plural chosen by that number.
     */
    scoring: {
      one: 'Até <b>{points}</b> ponto por rodada: valem os trechos no lugar certo e os pares em sequência. Dá para jogar solo também.',
      other: 'Até <b>{points}</b> pontos por rodada: valem os trechos no lugar certo e os pares em sequência. Dá para jogar solo também.',
    },
  },
} satisfies Catalog['home']
