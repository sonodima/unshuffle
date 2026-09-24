import type { Catalog } from '../../catalog'

// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
export default {
  /** Keyboard key names, as printed on the key caps (Russian keyboards print Enter / Ctrl in Latin). */
  keys: {
    space: 'Пробел',
    enter: 'Enter',
    /** The Control key (Apple keyboards show ⌘ instead). */
    ctrl: 'Ctrl',
  },
  /** Retry button (short: sits next to an error). */
  retry: 'Повторить',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: 'Раунд <b>{number}</b><dim> / {total}</dim>',
    /** Big headline (the host's own step messages come from game.prep). */
    allReady: 'Все готовы, погнали!',
    waiting: 'Ждём, пока все будут готовы…',
    fallback: 'Готовлю раунд…',
    /** Checklist: three steps, each with an "in progress" and a "done" label. */
    steps: {
      songActive: 'Выбираю песню…',
      songDone: 'Песня выбрана',
      /** Under "Песня выбрана": the title stays hidden until the reveal. */
      songDetail: 'Держим в секрете до конца',
      downloadActive: 'Загружаю фрагменты…',
      downloadDone: 'Фрагменты загружены',
      downloadError: 'Загрузка не удалась',
      /** Under "Загрузка не удалась". */
      downloadErrorDetail: 'Играть можно и без звука',
      sliceActive: 'Нарезаю трек…',
      sliceDone: 'Трек нарезан',
      /** Under "Трек нарезан": the song is cut on the beat. One line, ~35 chars. */
      sliceDetail: {
        one: '{count} фрагмент точно в такт',
        few: '{count} фрагмента точно в такт',
        many: '{count} фрагментов точно в такт',
        other: '{count} фрагмента точно в такт',
      },
    },
    /** Small uppercase label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: 'Готовы <b>{ready}</b><dim>/{total}</dim>',
    /** Screen-reader label of the avatar row. */
    readyPlayers: 'Готовые игроки',
  },

  /** Rotating tips on the preparing screen (one at a time, ~2 lines on phones). */
  tips: {
    title: 'Знаешь ли ты?',
    howToHover: 'Кликни по блоку, чтобы послушать, и перетащи, чтобы переставить.',
    howToTouch: 'Нажми на блок, чтобы послушать, и перетащи, чтобы переставить.',
    /** «Слушать всё» is the play-all button of the board. */
    playAll: '«Слушать всё» играет блоки в текущем порядке: если звучит гладко, ты почти у цели.',
    hold: 'Зажми блок — и последовательность заиграет прямо с него.',
    pairs: 'Два соседних блока в верном порядке приносят очки, даже если стоят не на своих местах.',
    firstConfirm: 'Первое «Готово» запускает финальный таймер для всех.',
    edges: 'Ищи начало песни и место, где она затихает: это первые и последние блоки.',
    /** {points} = the maximum score of a round (5 000, formatted). */
    perfect: 'Идеальный порядок = {points} очков. Без напряга.',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: 'Последний раунд',
    /** Screen-reader text of the headline. */
    headlineLabel: 'Раунд {number} из {total}',
    /**
     * Huge one-line headline: <word> white text, <n> the round number (lime),
     * <total> "/total" (small, grey). Keep the three tags; spaces between tags don't show.
     */
    headline: '<word>Раунд</word> <n>{number}</n><total>/{total}</total>',
    /** Screen-reader label of the round facts list. */
    rulesLabel: 'Правила раунда',
    /** Fact pills. <b> = the number (white). */
    snippets: {
      one: '<b>{count}</b> фрагмент',
      few: '<b>{count}</b> фрагмента',
      many: '<b>{count}</b> фрагментов',
      other: '<b>{count}</b> фрагмента',
    },
    /** Round duration; "с" = seconds. */
    seconds: '<b>{seconds}</b> с',
    spectator: 'Этот раунд ты смотришь, а сыграешь со следующего.',
    howToHover: 'Кликни по блоку, чтобы послушать, а потом перетащи его на место.',
    howToTouch: 'Нажми на блок, чтобы послушать, а потом перетащи его на место.',
    /** Shown inside the countdown ring before "3" (small, uppercase). */
    ready: 'На старт!',
    /** Screen-reader text of the countdown ring: before the count / while counting ({seconds} = 3, 2, 1). */
    readyLabel: 'На старт',
    countdownLabel: 'Старт через {seconds}',
  },

  /**
   * Full-screen slam when the round starts. Very short: 1 word, huge type (26vw), only
   * ~4 characters fit a phone («Погнали!» showed as «ГНА»). «Го!» is the gamers' "go".
   */
  go: 'Го!',
  /** Shown while the board data for the round arrives. */
  syncing: 'Синхронизирую раунд…',

  /** Top bar while playing. Labels are tiny uppercase eyebrows: keep them short. */
  hud: {
    round: 'Раунд',
    snippets: 'Фрагменты',
    points: 'Очки',
    /** Caption inside the timer ring (1 short word): normal / after the first confirm. */
    time: 'Время',
    finalTime: 'Финал',
    /** Badge under the ring after the first confirm. */
    lastSeconds: 'Последние секунды',
    /** Eyebrow over the avatars: {done} players out of {total} confirmed. */
    confirmed: 'Готово {done}/{total}',
    /** Standing under the score. {rank} = the place (bare number, ending added here). */
    rank: '{rank}-е место',
    /** Screen-reader label of the avatar row. */
    players: 'Игроки раунда',
  },

  /** Avatar rows. */
  players: {
    /** The viewer's own avatar (screen readers / tooltip). */
    me: '{name} (ты)',
    /** Chip after the last shown avatar ("+3"), for screen readers. */
    more: {
      one: 'и ещё {count}',
      few: 'и ещё {count}',
      many: 'и ещё {count}',
      other: 'и ещё {count}',
    },
  },

  /** "Юля жмёт «Готово»!" — the final-countdown banner in the HUD. */
  banner: {
    /** Player without a name. */
    someone: 'Кто-то',
    mine: 'Первое «Готово» — твоё!',
    /** <name> is the player's name: on phones only the name is shortened (one line). */
    confirmedBy: '<name>{name}</name> жмёт «Готово»!',
    /** Line under the title; <n> is the live seconds count (animated). "с" = seconds. */
    othersLeft: 'У остальных ещё <n>{seconds}</n> с',
    youLeft: {
      one: 'У тебя ещё <n>{count}</n> секунда',
      few: 'У тебя ещё <n>{count}</n> секунды',
      many: 'У тебя ещё <n>{count}</n> секунд',
      other: 'У тебя ещё <n>{count}</n> секунды',
    },
    /** For players who can't act any more (already confirmed, spectators). */
    finalTimer: 'Финальный таймер: <n>{seconds}</n> с',
  },

  /** Bottom dock: play-all transport + ГОТОВО / status. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: 'Готово',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: 'Порядок не изменён',
    armTap: 'Нажми ещё раз, чтобы подтвердить',
    armClick: 'Кликни ещё раз, чтобы подтвердить',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: 'Нажми {mod} + {enter} ещё раз',
    confirmed: 'Ответ принят',
    /** Confirmed while offline: it is sent on reconnect. */
    queued: 'Отправится при подключении',
    /** {names} = one or two player names ("Юля", "Юля и Марк"). */
    waitingFor: 'Ждём: {names}',
    waitingForCount: {
      one: 'Ждём ещё {count} игрока',
      few: 'Ждём ещё {count} игроков',
      many: 'Ждём ещё {count} игроков',
      other: 'Ждём ещё {count} игрока',
    },
    allConfirmed: 'Все ответили!',
    /** Screen-reader label of the avatars of those still playing. */
    stillPlaying: 'Ещё играют',
    timeUp: 'Время вышло!',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: 'Засчитан твой последний порядок',
    computing: 'Считаю результаты…',
    spectator: 'Зритель',
    spectatorBody: 'Сыграешь со следующего раунда',
    audioFailed: 'Звук недоступен',
    audioFailedBody: 'Попробуй ещё раз или играй так',
    /** Icon button (phones): screen readers / tooltip. */
    retryAudio: 'Загрузить звук ещё раз',
    /**
     * Keyboard legend under the dock (desktop). <kbd> = a key cap. {space} / {enter} /
     * {mod} (⌘ or Ctrl) are key names. <action> = the action label after a combination.
     */
    hints: {
      playAll: '<kbd>{space}</kbd> слушать всё',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>готово</action>',
      pointer: 'Кликни по блоку — послушать · зажми — слушать с него · перетащи — переставить',
      /** Same, after confirming (blocks can't move any more). */
      pointerLocked: 'Кликни по блоку — послушать · зажми — слушать с него',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: 'Ты в зрителях',
    bodyHover: 'Сыграешь со следующего раунда. А пока кликай по блокам и слушай фрагменты.',
    bodyTouch: 'Сыграешь со следующего раунда. А пока нажимай на блоки и слушай фрагменты.',
  },

  /** In-game exit menu (sheet). */
  menu: {
    /** Round button that opens it (screen readers / tooltip). */
    endButton: 'Завершить игру',
    leaveButton: 'Выйти из игры',
    hostTitle: 'Завершить игру?',
    guestTitle: 'Выйти из игры?',
    hostBody: 'Ты хост: игра остановится для всех.',
    /** Host alone in the room. */
    hostAloneBody: 'Игра на этом закончится.',
    guestBody: 'Игра продолжится без тебя. Пока она идёт, можно вернуться — очки сохранятся.',
    keepPlaying: 'Продолжить игру',
    stay: 'Остаться',
    /** Guest's red confirm button in the sheet (the round button above only opens it). */
    leave: 'Выйти из игры',
    toLobby: 'Вернуться в лобби',
    toLobbyBody: 'Очки обнулятся, игроки останутся: смените плейлист и начните заново.',
    toLobbyAloneBody: 'Очки обнулятся: смени плейлист и начни заново.',
    close: 'Закрыть комнату',
    /** Closing the room disconnects the one other player / all the others (2 or more). */
    closeBodyOne: 'Другой игрок будет отключён.',
    closeBodyMany: 'Все остальные игроки будут отключены.',
    closeAloneBody: 'Ты вернёшься на главный экран.',
    /** Next to the room code (guests). */
    rejoinCode: 'Код для возвращения',
  },
} satisfies Catalog['round']
