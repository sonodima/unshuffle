import type { Catalog } from '../../catalog'

// Home screen: hero, profile card, "Создать комнату" / join box, the decorative
// round demo and the "Как играть" dialog. Labels marked "uppercase" are
// shown in capitals by CSS: write them in normal case.
export default {
  /** Top-left button that opens the "how to play" dialog. Small pill, keep short. */
  help: 'Как играть',
  hero: {
    /** Small line above the logo (uppercase, letter-spaced). Keep it short: ~24 characters. */
    eyebrow: 'Музыкальная пати-игра',
    /** Under the logo. <b>…</b> is the highlighted second sentence. */
    tagline: 'Хит порезали на кусочки. <b>Собери его обратно.</b>',
  },
  /** Screen-reader name of the card with the profile and the create / join buttons. */
  cardLabel: 'Играть',
  /** Screen-reader name of the desktop panel with the animated demo round. */
  demoLabel: 'Пример раунда',
  /** Banner at the top of the card while the device has no network. */
  offline: 'Ты офлайн: для игры нужен интернет.',
  /** Screen-reader label of the × that dismisses an error banner. */
  dismissNotice: 'Закрыть уведомление',
  /** Divider between the join box and "Создать свою комнату" when opened from an invite link (uppercase). */
  or: 'или',
  /** Link next to "Открываю комнату…" / "Подключаюсь к комнате…" that aborts it. */
  cancel: 'Отмена',
  create: {
    /** Main call to action (big button, uppercase). Keep it short: ~16 characters. */
    button: 'Создать комнату',
    /** Secondary button when the player arrived with an invite link (uppercase). */
    buttonInvited: 'Создать свою комнату',
    /** Under the button while the room is being opened. */
    pending: 'Открываю комнату…',
    /** Hint under "Создать комнату". <b>…</b> is the bold lead-in. One line on phones (~50 characters). */
    solo: '<b>Играй соло:</b> создай комнату и сразу начинай.',
  },
  join: {
    /** Divider above the 5 code boxes (uppercase). */
    divider: 'Есть код?',
    /** Label above the code boxes when opened from an invite link (uppercase). */
    invited: 'Тебя позвали!',
    /** Join button (uppercase). */
    button: 'Войти',
    /** Join button once the invite code is complete. {code} = 5-letter room code, e.g. KXQPM (uppercase). */
    buttonCode: 'Войти в {code}',
    /** Under the button while connecting. */
    pending: 'Подключаюсь к комнате…',
    /** Error under the code boxes when "Войти" is pressed too early. {count} = code length (5). */
    incomplete: {
      one: 'Введи код целиком: в нём {count} буква.',
      few: 'Введи код целиком: в нём {count} буквы.',
      many: 'Введи код целиком: в нём {count} букв.',
      other: 'Введи код целиком: в нём {count} буквы.',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    /** {count} = maximum number of players (10). */
    players: {
      one: 'От 1 до {count} игрока',
      few: 'От 1 до {count} игроков',
      many: 'От 1 до {count} игроков',
      other: 'От 1 до {count} игрока',
    },
    noAccount: 'Без аккаунта, прямо в браузере',
    deezer: 'Отрывки песен — из Deezer',
  },
  profile: {
    /** Screen-reader label of the avatar button (opens the avatar / colour picker). */
    changeAvatar: 'Сменить аватар и цвет',
    /** Label of the nickname field (uppercase). */
    nameLabel: 'Твоё имя',
    namePlaceholder: 'Придумай имя',
    /** Tooltip / label of the dice button that picks a random nickname. */
    randomName: 'Случайное имя',
    /** Title of the avatar / colour picker dialog. */
    lookTitle: 'Твой стиль',
    lookDescription: 'Выбери эмодзи и цвет — так тебя увидят другие игроки.',
    /** Closes the picker. */
    done: 'Готово',
    /** Small heading over the preview of your avatar and name (uppercase). */
    preview: 'Предпросмотр',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    /** Tiny badge (uppercase, ~10px). */
    badge: 'Демо',
    /** Caption of each phase of the demo: one line, cut with … beyond ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: 'Хит режут на кусочки…',
      listen: 'Послушай фрагменты',
      sort: 'Расставь их по порядку',
      solved: 'Идеально! Теперь жми «Готово»',
    },
    /** Phone caption when the demo is solved (one line). {points} = points won, already formatted (5 000). */
    solvedPoints: 'Идеально! +{points}',
    /** Screen-reader name of the three step chips under the demo board. */
    stepsLabel: 'Как играть, в двух словах',
    /** Step chips under the desktop demo (one word each, ~12 characters). */
    steps: {
      listen: 'Слушай',
      sort: 'Расставляй',
      confirm: 'Подтверди',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: 'Как играть',
    description: 'Каждый раунд — один хит, порезанный на кусочки. Побеждает тот, кто соберёт его точнее и быстрее всех.',
    /** Closes the dialog. */
    gotIt: 'Понятно, погнали!',
    /** The fake "confirm" button drawn in the third illustration (tiny pill, uppercase): keep it very short. */
    confirmButton: 'Готово',
    steps: {
      listen: {
        title: 'Послушай фрагменты',
        /** Shown on devices with a mouse. */
        bodyMouse: 'Известный хит режут точно в такт и перемешивают. Кликни по блоку, чтобы его послушать.',
        /** Shown on touch screens. */
        bodyTouch: 'Известный хит режут точно в такт и перемешивают. Нажми на блок, чтобы его послушать.',
      },
      sort: {
        title: 'Расставь их по порядку',
        /** <play></play> is replaced by a small ▶ icon (the "play your order" button). Keep it empty. */
        body: 'Двигай блоки, пока песня не зазвучит как в оригинале. Кнопка <play></play> проиграет твой порядок.',
      },
      confirm: {
        title: 'Подтверди раньше всех',
        body: 'Кто первым нажмёт «Готово», запускает финальный отсчёт для всех.',
      },
    },
    /**
     * Scoring rule under the steps. {points} = maximum points per round, already
     * formatted (5 000); <b>…</b> highlights it. Plural chosen by that number («до» + genitive).
     */
    scoring: {
      one: 'До <b>{points}</b> очка за раунд: считаются фрагменты на своих местах и верные пары соседей. Играть можно и в одиночку.',
      few: 'До <b>{points}</b> очков за раунд: считаются фрагменты на своих местах и верные пары соседей. Играть можно и в одиночку.',
      many: 'До <b>{points}</b> очков за раунд: считаются фрагменты на своих местах и верные пары соседей. Играть можно и в одиночку.',
      other: 'До <b>{points}</b> очка за раунд: считаются фрагменты на своих местах и верные пары соседей. Играть можно и в одиночку.',
    },
  },
} satisfies Catalog['home']
