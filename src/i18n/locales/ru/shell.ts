import type { Catalog } from '../../catalog'

// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
export default {
  /** Buttons shared by the shell's dialogs and the crash screen. */
  action: {
    home: 'На главную',
    retry: 'Повторить',
    ok: 'ОК',
    cancel: 'Отмена',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE (never translated); {code} a room code. */
  title: {
    lobby: '{brand} · Лобби',
    lobbyRoom: '{brand} · Лобби {code}',
    round: '{brand} · Раунд',
    /** Round {round} of {rounds}. */
    roundOf: '{brand} · Раунд {round}/{rounds}',
    roundReveal: '{brand} · Раунд {round}/{rounds} · Результаты',
    roundPreparing: '{brand} · Раунд {round}/{rounds} · Подготовка',
    final: '{brand} · Итоги',
    /** A player lost the link to the host. */
    lost: '{brand} · Связь потеряна',
  },

  /**
   * Floating status pill at the top while the link is down. On phones it sits between
   * the corner buttons (~230px): titles ≤ 24 characters, details ≤ 40.
   */
  banner: {
    /** aria-label of the pill's close button. */
    dismiss: 'Скрыть уведомление',
    /** Seconds since the link dropped, next to the title. */
    elapsed: '{seconds} с',
    /** Host: the signaling server dropped; the game goes on. */
    hostReconnecting: 'Сервер отвалился, жду…',
    hostReconnectingDetail: 'Игра продолжается',
    /** Player: first connection attempt still running. */
    connecting: 'Переподключение…',
    /** Player: link to the host lost, retrying on its own. */
    lost: 'Связь потеряна',
    lostDetail: 'Пробую подключиться снова…',
    /** After ~5 s: the player will be let back in automatically. */
    lostDetailLong: 'Пробую… верну тебя автоматически.',
    /** After ~30 s of retries. */
    hostSilent: 'Хост не отвечает',
    hostSilentDetail: 'Ждём, когда вернётся…',
    /** Small button in the pill after ~30 s: leave the room. */
    leave: 'Выйти',
    /** Host only: nobody new can join, the players already in keep playing. */
    signalingTitle: 'Вход новичков на паузе',
    signalingDetail: 'Сервер потерян: кто уже внутри, играет дальше.',
    /** Title of any other host-side warning (the detail is the error itself). */
    warning: 'Внимание',
  },

  /** Room code line in the connection dialogs (small caps label). */
  dialogRoom: 'Комната <b>{code}</b>',

  /** Blocking dialog: a player lost the host for good. */
  lost: {
    title: 'Связь потеряна',
    /** The host left for good, the player was in the lobby. */
    hostClosedTitle: 'Хост закрыл комнату',
    /** The host left for good during or after the game. */
    hostLeftTitle: 'Хост покинул игру',
    hostGoneDescription: 'Комната больше недоступна.',
    /** Hint when the game had already ended (otherwise exit.gone.hint is shown). */
    hostGoneHintFinal: 'Игра уже закончилась: создай новую комнату для реванша.',
    /** No "Повторить" possible (e.g. on the host's own tab). */
    noRetryDescription: 'Связь с комнатой прервалась.',
    noRetryHint: 'Проверь подключение и попробуй снова с главного экрана.',
    descriptionLobby: 'Хост не отвечает — возможно, комнату уже закрыли.',
    description: 'Хост уже какое-то время не отвечает.',
    hintLobby: 'Попробуй через минутку или вернись на главную и создай свою комнату.',
    hintGame: 'Если хост ещё в игре, вернись — продолжишь с того же места и со своими очками.',
    hintFinal: 'Если хост ещё на связи, вернись — и сыграете реванш.',
  },

  /** Dialog after being dropped out of a room, by reason. */
  exit: {
    kicked: {
      title: 'Ты больше не в комнате',
      hint: 'Всегда можно создать свою комнату или войти по другому коду.',
    },
    closed: {
      title: 'Комната закрыта',
      hint: 'Игра закончилась для всех. Создай новую комнату или войди по другому коду.',
    },
    /** The same profile joined from another tab or device. */
    duplicate: {
      title: 'Ты уже в игре',
      hint: 'Закрой другую вкладку, чтобы играть здесь.',
    },
    /** The room no longer exists (host left, or a rejoin found nothing). */
    gone: {
      title: 'Комната больше недоступна',
      description: 'Хост закрыл комнату или потерял связь.',
      hint: 'Создай новую комнату на главном экране или войди по другому коду.',
    },
    /** Rejoining failed (network). */
    failed: {
      title: 'Не удалось вернуться',
      hint: 'Проверь подключение и попробуй снова войти по коду с главного экрана.',
    },
    /** Any other reason. */
    generic: {
      title: 'Ты вне комнаты',
      hint: 'Вернуться можно по тому же коду с главного экрана.',
    },
  },

  /** Overlay while a reloaded tab re-enters its room, and the notice if that fails. */
  resume: {
    title: 'Переподключение',
    host: 'Снова открываю твою комнату',
    hostRoom: 'Снова открываю твою комнату <b>{code}</b>',
    client: 'Возвращаюсь в комнату',
    clientRoom: 'Возвращаюсь в комнату <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'Комнаты <b>{code}</b> больше нет. {hint}',
    failedRoom:
      'Не получилось вернуть тебя в комнату <b>{code}</b>. Если игра ещё идёт, войди по коду с главного экрана.',
    failed: 'Если игра ещё идёт, войди по коду с главного экрана.',
  },

  /** Full-screen crash fallback. */
  crash: {
    eyebrow: 'Непредвиденная ошибка',
    title: 'Что-то пошло не так',
    body: 'Пластинку заело. Обнови страницу: если игра шла в комнате, я попробую вернуть тебя туда.',
    reload: 'Обновить',
    showDetails: 'Технические детали',
    hideDetails: 'Скрыть детали',
  },

  /** Toasts for room events. {name} is a player's nickname (always in the nominative). */
  toast: {
    /** Stands in for {name} when the player's nickname is unknown. */
    someone: 'Кто-то',
    joined: '{name} заходит в комнату',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: {
      one: 'Теперь вас {count}',
      few: 'Теперь вас {count}',
      many: 'Теперь вас {count}',
      other: 'Теперь вас {count}',
    },
    left: '{name} покидает комнату',
    submitted: '{name} жмёт «Готово»',
    /** Under "submitted" for the first one: the short final timer started. */
    lastSeconds: {
      one: 'У всех осталась {count} секунда!',
      few: 'У всех остались {count} секунды!',
      many: 'У всех осталось {count} секунд!',
      other: 'У всех осталось {count} секунды!',
    },
    lastSecondsSoon: 'Последние секунды для всех!',
    kicked: 'Хост исключил игрока {name}',
    kickedSomeone: 'Хост исключил игрока',
  },

  /** Toast while the browser keeps audio locked (touch screens say "tap", others "click"). */
  audioCue: {
    tapToListen: 'Нажми, чтобы послушать песню',
    clickToListen: 'Кликни, чтобы послушать песню',
    tapToEnable: 'Нажми, чтобы включить звук',
    clickToEnable: 'Кликни, чтобы включить звук',
    tapBody: 'Браузер держит звук на паузе, пока ты не коснёшься экрана.',
    clickBody: 'Браузер держит звук на паузе, пока ты не нажмёшь что-нибудь на странице.',
  },

  /** Sound button and its popover. */
  sound: {
    /** Button label and tooltip. */
    button: 'Звук',
    buttonMuted: 'Звук выключен',
    buttonLocked: 'Браузер заблокировал звук: нажми, чтобы включить',
    /** aria-label of the popover. */
    panel: 'Настройки звука',
    /** Popover heading (small caps). */
    heading: 'Звук',
    /** Next to the "M" key badge (the shortcut key itself is always M). */
    muteShortcut: 'Без звука',
    mute: 'Выключить звук',
    unmute: 'Включить звук',
    volume: 'Громкость',
    sfx: 'Звуковые эффекты',
    sfxDetail: 'Клики, таймер, реакции',
    /** Small pill next to the button while the browser keeps audio locked (one line). */
    unlock: 'Включить звук',
    unlockTitle: 'Браузер блокирует звук, пока ты не нажмёшь на страницу',
  },

  /** Emoji reaction bar and the floating reactions. */
  reactions: {
    /** aria-label of the bar. */
    group: 'Реакции',
    /** aria-label of each button; {name} is one of the names below. */
    button: 'Реакция: {name}',
    /** Name tag under your own floating reaction. */
    you: 'Ты',
    /** Tooltip and accessible name of each emoji. */
    names: {
      fire: 'Огонь',
      laugh: 'Смех',
      shock: 'Шок',
      clap: 'Аплодисменты',
      dead: 'Умираю со смеху',
      party: 'Вечеринка',
      mindBlown: 'Взрыв мозга',
      cool: 'Круто',
      rematch: 'Реванш',
    },
  },

  /** Native "leave page?" prompt while hosting a game (most browsers show their own text). */
  leaveWarning: 'Если выйдешь, игра закончится для всех',
} satisfies Catalog['shell']
