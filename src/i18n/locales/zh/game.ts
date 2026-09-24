// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: '正在打乱歌单…',
    slicing: '正在把神曲大卸八块…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: '等所有人准备好…',
  },
  host: {
    noPlaylist: '开始前先选一个歌单吧。',
    alreadyStarted: '游戏已经开始了。',
    closed: '房间已关闭。',
    playlistFailed: '无法从 Deezer 加载歌单。请检查网络后重试。',
    prepareFailed: '这个歌单的歌曲没能准备好，先回大厅吧。换个歌单试试。',
    notEnoughTracks: '这个歌单里能试听的歌曲不够（至少需要{count}首）。',
    /** Name given to a player whose nickname is empty. */
    defaultPlayer: '玩家',
    /** Name of a playlist whose title is missing. {id}: Deezer playlist number, printed as is. */
    untitledPlaylist: '歌单{id}',
  },
  store: {
    invalidCode: '房间码无效。',
    cancelled: '操作已取消。',
    hostLost: '与房主的连接已断开。',
    hostGone: '房主已离开游戏。',
    welcomeTimeout: '房主没有响应，请稍后再试。',
    joinFailed: '无法加入房间，请重试。',
    createFailed: '无法创建房间，请重试。',
    startFailed: '无法开始游戏。',
    rejected: '房主拒绝了连接。',
    signalingLost: '与联机服务器的连接已断开：新玩家暂时无法加入。',
    actionFailed: '操作失败。',
    audioUnavailable: '本回合音频不可用，不过照样能玩。',
    audioUnavailableTitled: '《{title}》的音频不可用。',
  },
  net: {
    network: '网络不可用。请检查网络连接后重试。',
    server: '联机服务器没有响应，请过几秒再试。',
    signaling: '连不上联机服务器。请稍后再试，或者换个网络（Wi‑Fi 或移动数据）。',
    createTimeout: '联机服务器没有响应，请过几秒再试。',
    joinTimeout: '无法连接到房主。请重试；如果还不行，换个网络试试（Wi‑Fi 或移动数据）。',
    hostNoAnswer: '房主没有响应。请检查房间码，或者稍后再试。',
    roomNotFound: '找不到房间，请检查房间码。',
    invalidCode: '房间码无效。房间码由5个字母组成，例如 KXQPM。',
    unsupported: '此浏览器不支持点对点连接（WebRTC）。请使用最新版的 Chrome、Safari 或 Firefox。',
    loadFailed: '网络模块加载失败，请刷新页面。',
    unknown: '出现意外的连接错误，请重试。',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: '找不到房间，请检查房间码。',
      network: '网络出了问题，请检查连接后重试。',
      server: '连不上联机服务器，请稍后再试。',
      timeout: '联机服务器没有回应，请重试。',
      unsupported: '你的浏览器不支持点对点连接（WebRTC）。',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: '房间已满。',
    version: '你的游戏版本和房主不一致，请刷新页面。',
    kicked: '房主已将你移出房间。',
    closed: '房主已关闭房间。',
    duplicate: '你已经在另一个标签页或设备上进入了这个房间。',
  },
  deezer: {
    timeout: 'Deezer 没有响应，请检查网络后重试。',
    network: '无法连接 Deezer。请检查网络（或广告拦截插件）后重试。',
    invalid: 'Deezer 返回了异常数据，请稍后再试。',
    quota: '短时间内向 Deezer 发送的请求太多了，请等几秒再试。',
    busy: 'Deezer 暂时繁忙，请稍后再试。',
    notFound: '在 Deezer 上找不到该内容。',
    forbidden: '无法访问该内容：它可能是私密的，或在你所在的地区不可用。',
    badRequest: '对 Deezer 的请求无效。',
    api: 'Deezer 出错了，请稍后再试。',
    playlistNotFound: '找不到歌单：请检查链接（私密歌单无法访问）。',
    noPreview: '这首歌暂无试听。',
    trackNotFound: '这首歌已从 Deezer 下架。',
    featured: '推荐歌单加载失败。',
    /**
     * Stand-ins for empty Deezer fields, written into the song / playlist data (in the
     * host's language, like a player's default name) and shown as a title / artist.
     */
    fallback: {
      playlist: '未命名歌单',
      track: '未命名歌曲',
      artist: '未知艺人',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16). Two characters each. */
  difficulty: {
    easy: '简单',
    normal: '普通',
    hard: '困难',
    insane: '地狱',
  },
} satisfies Catalog['game']
