// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Uppercase is applied by CSS where the design wants it.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button (dock / bottom sheet). Short: ~16 characters. */
  start: '开始游戏',
  /** Player count in the desktop start dock. */
  players: { other: '<num>{count}</num>位玩家' },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: { other: '<num>{count}</num>首歌' },
  /** Dismiss button of the lobby dialogs (remove a player, edit your profile). */
  cancel: '取消',

  header: {
    /** Small pill next to the logo. */
    badge: '大厅',
  },

  /** Leave / close the room: header button and confirmation dialog. */
  leave: {
    /** Host button (header on desktop, dialog confirm). Short. */
    closeRoom: '关闭房间',
    /** Guest button (header on desktop, dialog confirm). Short. */
    exit: '退出',
    /** Guest back button on phones (screen readers only). */
    exitRoom: '退出房间',
    hostTitle: '关闭房间？',
    guestTitle: '退出房间？',
    /** Host, other players in the room. */
    hostBody: '你是房主：你一走，房间就会关闭，其他玩家都会断开连接。',
    /** Host alone in the room. */
    hostAloneBody: '房间将被关闭。',
    /** {code}: the 5-letter room code. */
    guestBody: '游戏开始前，你还能用房间码 {code} 重新加入。',
    stay: '留下',
  },

  /** Phone tabs. Labels must stay short (~10 characters): three tabs share a 360px bar. */
  tabs: {
    /** Tab bar name (screen readers). */
    label: '大厅分区',
    players: '玩家',
    playlist: '歌单',
    rules: '规则',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}，待选择',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { other: '{tab}，{count}位玩家' },
  },

  /** Invite link (the "邀请" button and the free seats). */
  invite: {
    /** Toast. */
    linkCopied: '房间链接已复制！',
    /** Toast. */
    copyFailed: '复制失败：点二维码按钮查看链接。',
    /** Native share sheet text; the join link follows it. {code}: the room code. */
    shareText: '来 UNSHUFFLE 跟我比一比！加入房间 {code}：',
  },

  /** Room code card. */
  code: {
    title: '房间码',
    /** Hint next to the title (top right of the card, short). */
    clickToCopy: '点击复制',
    tapToCopy: '轻点复制',
    copied: '房间码已复制！',
    copyFailed: '复制失败',
    /** Screen readers. {code}: the room code spelled letter by letter ("K X Q P M"). */
    copyLabel: '房间码 {code}。复制房间码',
    /** Button (phones: shares the row with "分享" and the QR button). Short. */
    copyLink: '复制链接',
    /** "复制链接" right after a successful copy. */
    linkCopied: '已复制！',
    share: '分享',
    showQr: '显示二维码',
    enlargeQr: '放大二维码',
    /** Desktop card, next to the QR code. */
    phoneTitle: '用手机加入',
    phoneBody: '扫码或打开链接，秒进房间，无需注册。',
  },

  /** QR code dialog. */
  qr: {
    title: '邀请好友',
    description: '用手机相机扫描二维码，或者分享链接。',
    /** Label above the room code. */
    code: '房间码',
    /** Button next to the link. */
    copy: '复制',
    copied: '已复制',
    copyFailed: '复制失败：请选中链接手动复制。',
    shareLink: '分享链接',
    /** The QR image (screen readers). */
    imageLabel: '加入房间的二维码',
  },

  /** Player list. */
  roster: {
    title: '玩家',
    /** Shown when someone is reconnecting: how many players are connected. */
    online: { other: '<num>{count}</num>人在线' },
    /** Screen readers, for the "3/10" pill. {max}: room capacity. */
    capacity: { other: '{count}位玩家，上限{max}位' },
    listLabel: '玩家列表',
    /** Badge on your own row. Very short. */
    you: '我',
    /** Badge on the host's row. Very short. */
    host: '房主',
    reconnecting: '重新连接中…',
    editProfile: '编辑资料',
    /** Kick button (screen readers / tooltip). {name}: player name. */
    kickLabel: '移出{name}',
    freeSeats: { other: '<num>{count}</num>个空位' },
    /** Button next to the free seats. Short. */
    invite: '邀请',
    /** Kick confirmation dialog. */
    kick: {
      /** {name}: player name. */
      title: '要移出{name}吗？',
      titleFallback: '要移出这位玩家吗？',
      body: '对方会立刻离开房间，并且无法再加入。',
      confirm: '移出',
    },
  },

  /** Your profile dialog (name + avatar). */
  profile: {
    title: '你的资料',
    name: '昵称',
    namePlaceholder: '你叫什么？',
    nameRequired: '至少输入一个字符。',
    save: '保存',
  },

  /** Playlist picker (host). */
  picker: {
    title: '选择歌单',
    /** Next to the title on wide screens. */
    source: '歌曲来自 Deezer · 30秒试听',
    searchLabel: '搜索歌单',
    /** Must fit a 300px-wide field on phones (~32 characters). */
    searchPlaceholder: '搜索或粘贴 Deezer 链接',
    searching: '正在搜索',
    clear: '清空搜索',
    /** Shelf heading while the search box is empty. */
    featured: '精选推荐',
    /** Heading of a pasted playlist link. */
    fromLink: '来自你的链接',
    /** {query}: what the host typed. */
    resultsFor: '“{query}”的搜索结果',
    /** Result count (next to the heading, and for screen readers). */
    count: { other: '{count}个歌单' },
    /** Screen readers. */
    loading: '加载中…',
    /** Screen readers. */
    invalidLink: '链接无效',
    pickedFromLink: '已通过链接选好歌单',
    retry: '重试',
    /** Hover label on a cover. Very short. */
    pick: '选择',
    /** Card subtitle of a playlist shorter than the shortest game. */
    tracksTooShort: { other: '<num>{count}</num>首 · 太短了' },
    /** Card subtitle. {creator}: Deezer user / curator name. */
    tracksBy: { other: '<num>{count}</num>首 · {creator}' },
    /** Category chips row (screen readers). */
    chips: '分类',
    chipsPrev: '上一组分类',
    chipsNext: '更多分类',
    /** A share short link was pasted (link.deezer.com). */
    shortLink: {
      title: '请粘贴歌单的完整链接',
      body: '短链接（link.deezer.com）没法在这里打开。请先在浏览器或 Deezer App 里打开它，再复制完整地址：deezer.com/…/playlist/123456。',
    },
    /** A link that is not a Deezer playlist was pasted. */
    foreignLink: {
      title: '这不是歌单链接',
      body: '请粘贴 Deezer 公开歌单的链接，例如 deezer.com/playlist/123456——也可以按名称、艺人或曲风搜索。',
    },
    /** A pasted playlist link failed. */
    notFound: {
      title: '找不到歌单',
      /** The playlist doesn't exist or is private. */
      body: '请检查链接（私密歌单无法访问）。',
    },
    /** A search / the shelf failed (the error message follows). */
    offline: 'Deezer 没有响应',
    empty: {
      title: '没有歌单',
      /** {query}: what the host typed. */
      titleFor: '没有找到与“{query}”相关的歌单',
      body: '试试搜索艺人、曲风或年代，或者粘贴一个 Deezer 歌单链接。',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: '已选歌单',
    /** Small label above the title (uppercase by CSS). */
    eyebrow: '歌单',
    /** The same eyebrow while the host hasn't picked one yet (host's view). */
    none: '尚未选择歌单',
    incoming: '歌单马上就来',
    /** {creator}: Deezer user / curator name. */
    by: '创建者：{creator}',
    hostEmpty: '搜索歌单、点一个分类，或者粘贴 Deezer 链接。',
    guestEmpty: '房主选好后会显示在这里，竖起耳朵等着吧！',
    change: '更换',
  },

  /** Game rules panel: four pickers. */
  rules: {
    title: '规则',
    /** Host only: upper bound of the game length. {minutes}: a number. */
    duration: '最长约<num>{minutes}</num>分钟',
    /** Guests: the rules are read-only. Short pill. */
    hostDecides: '房主决定',
    /** Option label in seconds, e.g. "90秒". Keep it very short (4 options share a row). */
    seconds: '{seconds}秒',
    /** Screen readers, a snippets option: "8 · 普通". */
    snippetsOption: '{snippets} · {difficulty}',
    /** Row titles are also the pickers' names. Hints are one short line (they truncate). */
    rounds: { title: '回合数', hint: '每回合一首歌' },
    snippets: { title: '片段数', hint: '片段越多越难' },
    roundTime: { title: '回合时长', hint: '排序限时' },
    finalTimer: { title: '最后倒计时', hint: '有人确认后开始' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: '怎么玩',
    /** {points}: the maximum score of a round (5,000). */
    perfect: '完美顺序 = <num>{points}</num>分',
    listen: {
      title: '试听',
      /** Mouse / trackpad. {count}: snippets per song (6–16). */
      bodyClick: {
        other: '每首歌切成{count}个片段，顺序全被打乱。点击方块就能试听。',
      },
      /** Touch screens. {count}: snippets per song (6–16). */
      bodyTap: {
        other: '每首歌切成{count}个片段，顺序全被打乱。点一下方块就能试听。',
      },
    },
    reorder: {
      title: '排序',
      body: '拖动方块，直到整首歌听着顺耳。点 ▶ 按当前顺序从头听一遍。',
    },
    confirm: {
      title: '确认',
      /** {count}: seconds of the final timer (10–30). */
      body: {
        other: '第一个确认的人会启动最后倒计时：其他人只剩{count}秒。',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "5回合 · 8个片段（普通）· 90秒".
    rounds: { other: '<num>{count}</num>回合' },
    snippets: { other: '<num>{count}</num>个片段' },
    /** Desktop dock. {difficulty}: difficulty name ("普通"). */
    snippetsLevel: { other: '<num>{count}</num>个片段（{difficulty}）' },
    /** Seconds per round, e.g. "90秒". */
    roundTime: '<num>{seconds}</num>秒',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingStart: '等待房主开始游戏',
    /** Guests. Animated dots follow: no final punctuation. */
    waitingPlaylist: '房主正在挑选歌单',
    pickPlaylist: '选一个歌单就能开始',
    solo: '一个人也能玩',
    /** In place of the playlist title in the dock, before one is picked. */
    noPlaylist: '尚未选择歌单',
    /** One-tap fix when the playlist is too short for the chosen rounds. Short button. */
    playRounds: { other: '改玩{count}回合' },
    /** {count}: tracks the playlist has, {need}: tracks needed (one per round). */
    shortfall: {
      other: '歌单太短：只有<num>{count}</num>首，需要<num>{need}</num>首。',
    },
    /** Even the shortest game doesn't fit. {count}: tracks the playlist has, {min}: fewest rounds. */
    shortfallMin: {
      other: '歌单太短：只有<num>{count}</num>首，至少需要<num>{min}</num>首。',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Chinese pop first (mainland, Taiwan, Hong Kong), then a few
   * international ones. Every query was checked on the Deezer search: its first
   * results are real playlists of 30+ tracks.
   */
  chips: [
    { label: '华语热歌', query: 'chinese top hits', emoji: '🔥' },
    { label: '抖音神曲', query: 'douyin 抖音', emoji: '📱' },
    { label: '00年代', query: 'chinese 2000s', emoji: '💿' },
    { label: '90年代', query: 'chinese 90s', emoji: '📼' },
    { label: '经典老歌', query: '经典老歌', emoji: '📻' },
    { label: '中文说唱', query: '中文说唱', emoji: '🎤' },
    { label: '粤语金曲', query: 'cantopop', emoji: '🌃' },
    { label: '情歌', query: '情歌', emoji: '💘' },
    { label: '古风', query: '古风', emoji: '🏮' },
    { label: '中国摇滚', query: '中国摇滚', emoji: '🎸' },
    { label: '独立音乐', query: 'chinese indie rock', emoji: '🌙' },
    { label: '影视金曲', query: 'chinese drama ost', emoji: '📺' },
    { label: '全球热歌', query: 'global hits', emoji: '🌍' },
    { label: 'K-Pop', query: 'k-pop', emoji: '💜' },
    { label: '动漫金曲', query: 'anime', emoji: '🍥' },
    { label: '电音舞曲', query: 'dance hits', emoji: '🎧' },
    { label: '迪士尼', query: 'disney hits', emoji: '🏰' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order.
   * Deezer has no chart for mainland China, Taiwan or Hong Kong: the official
   * Singapore and Malaysia charts come first, then big public Chinese-hits
   * playlists (each checked: public, 100+ tracks, most with a preview), then
   * worldwide ones.
   */
  featured: [
    1313620765, // Top Singapore — Deezer Charts
    1362515675, // Top Malaysia — Deezer Charts
    15171349123, // CHINESE HITS 2026/2027
    15039127003, // Top Chinese song 2026（华语流行歌2026）
    13360456343, // Top Chinese Tiktok Douyin 抖音 Music 2024
    14661981601, // CantoPop 2025, 2024 & 2023 — 香港廣東歌
    12203188871, // 1980s-2000s 华语 & 粤语经典金曲
    14273309041, // 经典老歌500首怀旧
    15580367443, // C-RAP // 中文说唱库
    15539873463, // 古风 gufeng
    3155776842, // Top Worldwide — Deezer Charts
    4096400722, // Top K-Pop — Deezer K-Pop Editor
  ],
} satisfies Catalog['lobby']
