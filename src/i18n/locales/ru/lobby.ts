import type { Catalog } from '../../catalog'

// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
export default {
  /** Host's start button (dock / bottom sheet). Short: ~16 characters. */
  start: 'Начать игру',
  /** Player count in the desktop start dock. */
  players: {
    one: '<num>{count}</num> игрок',
    few: '<num>{count}</num> игрока',
    many: '<num>{count}</num> игроков',
    other: '<num>{count}</num> игрока',
  },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: {
    one: '<num>{count}</num> трек',
    few: '<num>{count}</num> трека',
    many: '<num>{count}</num> треков',
    other: '<num>{count}</num> трека',
  },
  /** Dismiss button of the lobby dialogs (remove a player, edit your profile). */
  cancel: 'Отмена',

  header: {
    /** Small pill next to the logo. */
    badge: 'Лобби',
  },

  /** Leave / close the room: header button and confirmation dialog. */
  leave: {
    /** Host button (header on desktop, dialog confirm). Short. */
    closeRoom: 'Закрыть комнату',
    /** Guest button (header on desktop, dialog confirm). Short. */
    exit: 'Выйти',
    /** Guest back button on phones (screen readers only). */
    exitRoom: 'Выйти из комнаты',
    hostTitle: 'Закрыть комнату?',
    guestTitle: 'Выйти из комнаты?',
    /** Host, other players in the room. */
    hostBody: 'Ты хост: если выйдешь, комната закроется, а все остальные игроки будут отключены.',
    /** Host alone in the room. */
    hostAloneBody: 'Комната будет закрыта.',
    /** {code}: the 5-letter room code. */
    guestBody: 'Вернуться можно по коду {code}, пока игра не началась.',
    stay: 'Остаться',
  },

  /** Phone tabs. Labels must stay short (~10 characters): three tabs share a 360px bar. */
  tabs: {
    /** Tab bar name (screen readers). */
    label: 'Разделы лобби',
    players: 'Игроки',
    playlist: 'Плейлист',
    rules: 'Правила',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, нужно выбрать',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: {
      one: '{tab}, {count} игрок',
      few: '{tab}, {count} игрока',
      many: '{tab}, {count} игроков',
      other: '{tab}, {count} игрока',
    },
  },

  /** Invite link (the "Позвать" button and the free seats). */
  invite: {
    /** Toast. */
    linkCopied: 'Ссылка на комнату скопирована!',
    /** Toast. */
    copyFailed: 'Не удалось скопировать: нажми кнопку QR, чтобы увидеть ссылку.',
    /** Native share sheet text; the join link follows it. {code}: the room code. */
    shareText: 'Слабо обыграть меня в UNSHUFFLE? Заходи в комнату {code}:',
  },

  /** Room code card. */
  code: {
    title: 'Код комнаты',
    /** Hint next to the title (top right of the card, short). */
    clickToCopy: 'Кликни, чтобы скопировать',
    tapToCopy: 'Нажми, чтобы скопировать',
    copied: 'Код скопирован!',
    copyFailed: 'Не удалось скопировать',
    /** Screen readers. {code}: the room code spelled letter by letter ("K X Q P M"). */
    copyLabel: 'Код комнаты {code}. Скопировать код',
    /** Button (phones: shares the row with "Поделиться" and the QR button). Short. */
    copyLink: 'Копировать',
    /** "Копировать" right after a successful copy. */
    linkCopied: 'Скопировано',
    share: 'Поделиться',
    showQr: 'Показать QR-код',
    enlargeQr: 'Увеличить QR-код',
    /** Desktop card, next to the QR code. */
    phoneTitle: 'Заходи с телефона',
    phoneBody: 'Наведи камеру на QR или открой ссылку — вход за секунду, без аккаунта.',
  },

  /** QR code dialog. */
  qr: {
    title: 'Позови друзей',
    description: 'Наведи камеру телефона на QR-код или поделись ссылкой.',
    /** Label above the room code. */
    code: 'Код',
    /** Button next to the link. */
    copy: 'Копировать',
    copied: 'Скопировано',
    copyFailed: 'Не удалось скопировать: выдели ссылку и скопируй вручную.',
    shareLink: 'Поделиться ссылкой',
    /** The QR image (screen readers). */
    imageLabel: 'QR-код для входа в комнату',
  },

  /** Player list. */
  roster: {
    title: 'Игроки',
    /** Shown when someone is reconnecting: how many players are connected. */
    online: {
      one: '<num>{count}</num> в сети',
      few: '<num>{count}</num> в сети',
      many: '<num>{count}</num> в сети',
      other: '<num>{count}</num> в сети',
    },
    /** Screen readers, for the "3/10" pill. {max}: room capacity. */
    capacity: {
      one: '{count} игрок из {max}',
      few: '{count} игрока из {max}',
      many: '{count} игроков из {max}',
      other: '{count} игрока из {max}',
    },
    listLabel: 'Список игроков',
    /** Badge on your own row. Very short. */
    you: 'Ты',
    /** Badge on the host's row. Very short. */
    host: 'Хост',
    reconnecting: 'Переподключение…',
    editProfile: 'Изменить профиль',
    /** Kick button (screen readers / tooltip). {name}: player name. */
    kickLabel: 'Исключить: {name}',
    freeSeats: {
      one: '<num>{count}</num> свободное место',
      few: '<num>{count}</num> свободных места',
      many: '<num>{count}</num> свободных мест',
      other: '<num>{count}</num> свободного места',
    },
    /** Button next to the free seats. Short. */
    invite: 'Позвать',
    /** Kick confirmation dialog. */
    kick: {
      /** {name}: player name (stays in the nominative after «игрока»). */
      title: 'Исключить игрока {name}?',
      titleFallback: 'Исключить игрока?',
      body: 'Игрок сразу покинет комнату и больше не сможет в неё вернуться.',
      confirm: 'Исключить',
    },
  },

  /** Your profile dialog (name + avatar). */
  profile: {
    title: 'Твой профиль',
    name: 'Имя',
    namePlaceholder: 'Как тебя зовут?',
    nameRequired: 'Напиши хотя бы один символ.',
    save: 'Сохранить',
  },

  /** Playlist picker (host). */
  picker: {
    title: 'Выбери плейлист',
    /** Next to the title on wide screens. */
    source: 'Треки из Deezer · отрывки по 30 секунд',
    searchLabel: 'Поиск плейлистов',
    /** Must fit a 300px-wide field on phones (~32 characters). */
    searchPlaceholder: 'Найди или вставь ссылку Deezer',
    searching: 'Идёт поиск',
    clear: 'Очистить поиск',
    /** Shelf heading while the search box is empty. */
    featured: 'Рекомендуем',
    /** Heading of a pasted playlist link. */
    fromLink: 'По твоей ссылке',
    /** {query}: what the host typed. */
    resultsFor: 'Результаты по запросу «{query}»',
    /** Result count (next to the heading, and for screen readers). */
    count: {
      one: '{count} плейлист',
      few: '{count} плейлиста',
      many: '{count} плейлистов',
      other: '{count} плейлиста',
    },
    /** Screen readers. */
    loading: 'Загрузка…',
    /** Screen readers. */
    invalidLink: 'Неверная ссылка',
    pickedFromLink: 'Плейлист выбран по ссылке',
    retry: 'Повторить',
    /** Hover label on a cover. Very short. */
    pick: 'Выбрать',
    /** Card subtitle of a playlist shorter than the shortest game. */
    tracksTooShort: {
      one: '<num>{count}</num> трек · маловато',
      few: '<num>{count}</num> трека · маловато',
      many: '<num>{count}</num> треков · маловато',
      other: '<num>{count}</num> трека · маловато',
    },
    /** Card subtitle. {creator}: Deezer user / curator name. */
    tracksBy: {
      one: '<num>{count}</num> трек · {creator}',
      few: '<num>{count}</num> трека · {creator}',
      many: '<num>{count}</num> треков · {creator}',
      other: '<num>{count}</num> трека · {creator}',
    },
    /** Category chips row (screen readers). */
    chips: 'Категории',
    chipsPrev: 'Предыдущие категории',
    chipsNext: 'Ещё категории',
    /** A share short link was pasted (link.deezer.com). */
    shortLink: {
      title: 'Вставь полную ссылку на плейлист',
      body: 'Короткие ссылки (link.deezer.com) отсюда не открываются. Открой её в браузере или в приложении Deezer и скопируй полный адрес: deezer.com/…/playlist/123456.',
    },
    /** A link that is not a Deezer playlist was pasted. */
    foreignLink: {
      title: 'Это не ссылка на плейлист',
      body: 'Вставь ссылку на публичный плейлист Deezer (например, deezer.com/ru/playlist/123456) или ищи по названию, исполнителю или жанру.',
    },
    /** A pasted playlist link failed. */
    notFound: {
      title: 'Плейлист не найден',
      /** The playlist doesn't exist or is private. */
      body: 'Проверь ссылку (приватные плейлисты недоступны).',
    },
    /** A search / the shelf failed (the error message follows). */
    offline: 'Deezer не отвечает',
    empty: {
      title: 'Ничего не нашлось',
      /** {query}: what the host typed. */
      titleFor: 'По запросу «{query}» ничего нет',
      body: 'Попробуй исполнителя, жанр или десятилетие — или вставь ссылку на плейлист Deezer.',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: 'Выбранный плейлист',
    /** Small label above the title (uppercase by CSS). */
    eyebrow: 'Плейлист',
    /** The same eyebrow while the host hasn't picked one yet (host's view). */
    none: 'Плейлист не выбран',
    incoming: 'Плейлист на подходе',
    /** {creator}: Deezer user / curator name. */
    by: 'от {creator}',
    hostEmpty: 'Найди плейлист, выбери категорию или вставь ссылку Deezer.',
    guestEmpty: 'Появится здесь, как только хост выберет. Готовь уши!',
    change: 'Сменить',
  },

  /** Game rules panel: four pickers. */
  rules: {
    title: 'Правила',
    /** Host only: upper bound of the game length. {minutes}: a number. */
    duration: 'Максимум <num>~{minutes} мин</num>',
    /** Guests: the rules are read-only. Short pill. */
    hostDecides: 'Решает хост',
    /** Option label in seconds, e.g. "90 с". Keep it very short (4 options share a row). */
    seconds: '{seconds} с',
    /** Screen readers, a snippets option: "8 · Нормально". */
    snippetsOption: '{snippets} · {difficulty}',
    /** Row titles are also the pickers' names. Hints are one short line (they truncate). */
    rounds: { title: 'Раунды', hint: 'Одна песня на раунд' },
    snippets: { title: 'Фрагменты', hint: 'Больше кусочков — сложнее' },
    roundTime: { title: 'Время раунда', hint: 'На расстановку' },
    finalTimer: { title: 'Финальный таймер', hint: 'После первого «Готово»' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: 'Как играть',
    /** {points}: the maximum score of a round (5 000). */
    perfect: 'Идеальный порядок = <num>{points}</num> очков',
    listen: {
      title: 'Слушай',
      /** Mouse / trackpad. {count}: snippets per song (6–16). */
      bodyClick: {
        one: 'Каждая песня нарезана на {count} фрагмент. Кликни по блоку, чтобы его послушать.',
        few: 'Каждая песня нарезана на {count} перемешанных фрагмента. Кликни по блоку, чтобы его послушать.',
        many: 'Каждая песня нарезана на {count} перемешанных фрагментов. Кликни по блоку, чтобы его послушать.',
        other: 'Каждая песня нарезана на {count} перемешанного фрагмента. Кликни по блоку, чтобы его послушать.',
      },
      /** Touch screens. {count}: snippets per song (6–16). */
      bodyTap: {
        one: 'Каждая песня нарезана на {count} фрагмент. Нажми на блок, чтобы его послушать.',
        few: 'Каждая песня нарезана на {count} перемешанных фрагмента. Нажми на блок, чтобы его послушать.',
        many: 'Каждая песня нарезана на {count} перемешанных фрагментов. Нажми на блок, чтобы его послушать.',
        other: 'Каждая песня нарезана на {count} перемешанного фрагмента. Нажми на блок, чтобы его послушать.',
      },
    },
    reorder: {
      title: 'Расставляй',
      body: 'Перетаскивай блоки, пока песня не зазвучит правильно. Кнопка ▶ проиграет всё подряд.',
    },
    confirm: {
      title: 'Жми «Готово»',
      /** {count}: seconds of the final timer (10–30). */
      body: {
        one: 'Кто первым нажмёт «Готово», запускает финальный таймер: у остальных останется {count} секунда.',
        few: 'Кто первым нажмёт «Готово», запускает финальный таймер: у остальных останется {count} секунды.',
        many: 'Кто первым нажмёт «Готово», запускает финальный таймер: у остальных останется {count} секунд.',
        other: 'Кто первым нажмёт «Готово», запускает финальный таймер: у остальных останется {count} секунды.',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5 раундов · 8 фрагментов (нормально) · 90 с".
    rounds: {
      one: '<num>{count}</num> раунд',
      few: '<num>{count}</num> раунда',
      many: '<num>{count}</num> раундов',
      other: '<num>{count}</num> раунда',
    },
    snippets: {
      one: '<num>{count}</num> фрагмент',
      few: '<num>{count}</num> фрагмента',
      many: '<num>{count}</num> фрагментов',
      other: '<num>{count}</num> фрагмента',
    },
    /** Desktop dock. {difficulty}: difficulty name, lowercased ("нормально"). */
    snippetsLevel: {
      one: '<num>{count}</num> фрагмент ({difficulty})',
      few: '<num>{count}</num> фрагмента ({difficulty})',
      many: '<num>{count}</num> фрагментов ({difficulty})',
      other: '<num>{count}</num> фрагмента ({difficulty})',
    },
    /** Seconds per round, e.g. "90 с". */
    roundTime: '<num>{seconds} с</num>',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingStart: 'Ждём, когда хост начнёт игру',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingPlaylist: 'Хост выбирает плейлист',
    pickPlaylist: 'Выбери плейлист, чтобы начать',
    solo: 'Можно играть и в одиночку',
    /** In place of the playlist title in the dock, before one is picked. */
    noPlaylist: 'Плейлист не выбран',
    /** One-tap fix when the playlist is too short for the chosen rounds. Short button. */
    playRounds: {
      one: 'Сыграть {count} раунд',
      few: 'Сыграть {count} раунда',
      many: 'Сыграть {count} раундов',
      other: 'Сыграть {count} раунда',
    },
    /** {count}: tracks the playlist has, {need}: tracks needed (one per round). */
    shortfall: {
      one: 'Плейлист слишком короткий: в нём <num>{count}</num> трек, а нужно <num>{need}</num>.',
      few: 'Плейлист слишком короткий: в нём <num>{count}</num> трека, а нужно <num>{need}</num>.',
      many: 'Плейлист слишком короткий: в нём <num>{count}</num> треков, а нужно <num>{need}</num>.',
      other: 'Плейлист слишком короткий: в нём <num>{count}</num> трека, а нужно <num>{need}</num>.',
    },
    /** Even the shortest game doesn't fit. {count}: tracks the playlist has, {min}: fewest rounds. */
    shortfallMin: {
      one: 'Плейлист слишком короткий: в нём всего <num>{count}</num> трек, а нужно хотя бы <num>{min}</num>.',
      few: 'Плейлист слишком короткий: в нём всего <num>{count}</num> трека, а нужно хотя бы <num>{min}</num>.',
      many: 'Плейлист слишком короткий: в нём всего <num>{count}</num> треков, а нужно хотя бы <num>{min}</num>.',
      other: 'Плейлист слишком короткий: в нём всего <num>{count}</num> трека, а нужно хотя бы <num>{min}</num>.',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Queries checked on the Deezer API: their first results are real
   * playlists with 30+ tracks and no crude titles.
   */
  chips: [
    { label: 'Новинки', query: 'русские новинки', emoji: '🔥' },
    { label: 'Русские хиты', query: 'русские хиты', emoji: '🎶' },
    { label: 'Русский рэп', query: 'русский рэп', emoji: '🎤' },
    { label: 'Русский поп', query: 'русская попса', emoji: '🪆' },
    { label: 'Русский рок', query: 'русский рок', emoji: '🎸' },
    { label: 'Нулевые', query: 'хиты 2000-х', emoji: '💿' },
    { label: '90-е', query: 'дискотека 90-х', emoji: '📼' },
    { label: '80-е', query: 'дискотека 80-х', emoji: '🕺' },
    { label: 'Ретро', query: 'советская эстрада', emoji: '📻' },
    { label: 'Мультики', query: 'песни из мультфильмов', emoji: '🧸' },
    { label: 'Зарубежные хиты', query: 'зарубежные хиты', emoji: '🌍' },
    { label: 'TikTok', query: 'tiktok hits', emoji: '📱' },
    { label: 'Танцы', query: 'клубные хиты', emoji: '🎧' },
    { label: 'Рок-классика', query: 'rock classics', emoji: '🤘' },
    { label: 'Вечеринка', query: 'party hits', emoji: '🎉' },
    { label: 'Реггетон', query: 'reggaeton', emoji: '💃' },
    { label: 'Disney', query: 'disney hits', emoji: '🏰' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order.
   * Deezer Charts has no live Russia chart any more (Top Russia is empty), so the
   * shelf opens with big, fresh Russian-language playlists, then the official
   * charts, genres and worldwide ones. All public, ≥ 40 tracks, mostly with previews
   * (checked on https://api.deezer.com/playlist/<id>).
   */
  featured: [
    15541072983, // Музыка 2026 Русская — Russische Musik 2026
    3155776842, // Top Worldwide — Deezer Charts
    1362526495, // Top Ukraine — Deezer Charts
    14529659743, // TOP Russia 2025
    14956300323, // Русский рэп
    4314481822, // Русская музыка / Русский рок
    15644520163, // Русская попса 2000-2015
    12928527663, // Дискотека 90-х
    1363560485, // Deezer Hits
    4403076402, // TikTok Hits World
    248297032, // 00s Hits
    878989033, // 90s Hits
  ],
} satisfies Catalog['lobby']
