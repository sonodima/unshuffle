import type { Catalog } from '../../catalog'

// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'Перемешиваю плейлист…',
    slicing: 'Режу хит на кусочки…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: 'Ждём, пока все будут готовы…',
  },
  host: {
    noPlaylist: 'Сначала выбери плейлист.',
    alreadyStarted: 'Игра уже началась.',
    closed: 'Комната закрыта.',
    playlistFailed: 'Не удаётся загрузить плейлист из Deezer. Проверь подключение и попробуй ещё раз.',
    prepareFailed: 'Не получилось подготовить песни из этого плейлиста — возвращаемся в лобби. Попробуй другой плейлист.',
    notEnoughTracks: 'В этом плейлисте мало треков с отрывками (нужно хотя бы {count}).',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: 'Игрок',
    /** Name of a playlist whose title is missing. {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: 'Плейлист {id}',
  },
  store: {
    invalidCode: 'Неверный код комнаты.',
    cancelled: 'Действие отменено.',
    hostLost: 'Связь с хостом потеряна.',
    hostGone: 'Хост покинул игру.',
    welcomeTimeout: 'Хост не отвечает. Попробуй чуть позже.',
    joinFailed: 'Не удалось войти в комнату. Попробуй ещё раз.',
    createFailed: 'Не удалось создать комнату. Попробуй ещё раз.',
    startFailed: 'Не удалось начать игру.',
    rejected: 'Хост отклонил подключение.',
    signalingLost: 'Связь с сервером потеряна: новые игроки не смогут войти.',
    actionFailed: 'Не получилось выполнить действие.',
    audioUnavailable: 'Звук этого раунда недоступен, но играть всё равно можно.',
    audioUnavailableTitled: 'Звук трека «{title}» недоступен.',
  },
  net: {
    network: 'Нет подключения к сети. Проверь интернет и попробуй ещё раз.',
    server: 'Сервер подключения не отвечает. Попробуй через пару секунд.',
    signaling: 'Сервер подключения недоступен. Попробуй чуть позже или смени сеть (Wi‑Fi или мобильный интернет).',
    createTimeout: 'Сервер подключения не отвечает. Попробуй через пару секунд.',
    joinTimeout: 'Не удаётся подключиться к хосту. Попробуй ещё раз, а если не выйдет — другую сеть (Wi‑Fi или мобильный интернет).',
    hostNoAnswer: 'Хост не отвечает. Проверь код или попробуй чуть позже.',
    roomNotFound: 'Комната не найдена. Проверь код.',
    invalidCode: 'Неверный код комнаты. В нём 5 букв, например KXQPM.',
    unsupported: 'Этот браузер не поддерживает peer-to-peer-соединения (WebRTC). Попробуй свежую версию Chrome, Safari или Firefox.',
    loadFailed: 'Не удалось загрузить сетевой модуль. Обнови страницу.',
    unknown: 'Непредвиденная ошибка подключения. Попробуй ещё раз.',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'Комната не найдена. Проверь код.',
      network: 'Проблема с сетью. Проверь подключение и попробуй ещё раз.',
      server: 'Сервер подключения недоступен. Попробуй чуть позже.',
      timeout: 'Сервер подключения не ответил. Попробуй ещё раз.',
      unsupported: 'Твой браузер не поддерживает peer-to-peer-соединения (WebRTC).',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'Комната заполнена.',
    version: 'Версия игры не совпадает с версией хоста. Обнови страницу.',
    kicked: 'Хост исключил тебя из комнаты.',
    closed: 'Хост закрыл комнату.',
    duplicate: 'Твой профиль уже в этой комнате — из другой вкладки или с другого устройства.',
  },
  deezer: {
    timeout: 'Deezer не отвечает. Проверь подключение и попробуй ещё раз.',
    network: 'Не удаётся связаться с Deezer. Проверь подключение (или блокировщик рекламы) и попробуй ещё раз.',
    invalid: 'Неожиданный ответ от Deezer. Попробуй чуть позже.',
    quota: 'Слишком много запросов к Deezer за короткое время. Подожди несколько секунд и попробуй снова.',
    busy: 'Deezer сейчас перегружен. Попробуй чуть позже.',
    notFound: 'В Deezer такого не нашлось.',
    forbidden: 'Нет доступа: возможно, контент приватный или недоступен в твоей стране.',
    badRequest: 'Некорректный запрос к Deezer.',
    api: 'Ошибка Deezer. Попробуй чуть позже.',
    playlistNotFound: 'Плейлист не найден: проверь ссылку (приватные плейлисты недоступны).',
    noPreview: 'У этого трека нет отрывка.',
    trackNotFound: 'Этого трека больше нет в Deezer.',
    featured: 'Не удалось загрузить рекомендуемые плейлисты.',
    /**
     * Stand-ins for empty Deezer fields, written into the song / playlist data (in the
     * host's language, like a player's default name) and shown as a title / artist.
     */
    fallback: {
      playlist: 'Плейлист без названия',
      track: 'Без названия',
      artist: 'Неизвестный исполнитель',
    },
  },
  /**
   * Difficulty by snippet count (6 / 8 / 12 / 16). Also shown lowercased: "8 фрагментов (средне)".
   * Tiny uppercase sublabels of the 4-way snippets picker (~55 px on a 360 px phone): ≤ 7 letters.
   */
  difficulty: {
    easy: 'Легко',
    normal: 'Средне',
    hard: 'Сложно',
    insane: 'Хардкор',
  },
} satisfies Catalog['game']
