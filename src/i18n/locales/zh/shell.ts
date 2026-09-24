// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  /** Buttons shared by the shell's dialogs and the crash screen. */
  action: {
    home: '返回首页',
    retry: '重试',
    ok: '好的',
    cancel: '取消',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE (never translated); {code} a room code. */
  title: {
    lobby: '{brand} · 大厅',
    lobbyRoom: '{brand} · 大厅 {code}',
    round: '{brand} · 回合',
    /** Round {round} of {rounds}. */
    roundOf: '{brand} · 回合 {round}/{rounds}',
    roundReveal: '{brand} · 回合 {round}/{rounds} · 结果',
    roundPreparing: '{brand} · 回合 {round}/{rounds} · 准备中',
    final: '{brand} · 最终排名',
    /** A player lost the link to the host. */
    lost: '{brand} · 连接已断开',
  },

  /**
   * Floating status pill at the top while the link is down. On phones it sits between
   * the corner buttons (~230px): titles ≤ 12 Chinese characters, details ≤ 20.
   */
  banner: {
    /** aria-label of the pill's close button. */
    dismiss: '隐藏提示',
    /** Seconds since the link dropped, next to the title. */
    elapsed: '{seconds}秒',
    /** Host: the signaling server dropped; the game goes on. */
    hostReconnecting: '服务器掉线，重连中…',
    hostReconnectingDetail: '游戏照常进行',
    /** Player: first connection attempt still running. */
    connecting: '重新连接中…',
    /** Player: link to the host lost, retrying on its own. */
    lost: '连接已断开',
    lostDetail: '正在尝试重新连接…',
    /** After ~5 s: the player will be let back in automatically. */
    lostDetailLong: '重连中…连上后自动回到房间。',
    /** After ~30 s of retries. */
    hostSilent: '房主没有响应',
    hostSilentDetail: '等房主回来…',
    /** Small button in the pill after ~30 s: leave the room. */
    leave: '退出',
    /** Host only: nobody new can join, the players already in keep playing. */
    signalingTitle: '暂停新玩家加入',
    signalingDetail: '联机服务器断开：房间里的玩家可以继续玩。',
    /** Title of any other host-side warning (the detail is the error itself). */
    warning: '注意',
  },

  /** Room code line in the connection dialogs (small caps label). */
  dialogRoom: '房间 <b>{code}</b>',

  /** Blocking dialog: a player lost the host for good. */
  lost: {
    title: '连接已断开',
    /** The host left for good, the player was in the lobby. */
    hostClosedTitle: '房主关闭了房间',
    /** The host left for good during or after the game. */
    hostLeftTitle: '房主离开了游戏',
    hostGoneDescription: '这个房间已经不存在了。',
    /** Hint when the game had already ended (otherwise exit.gone.hint is shown). */
    hostGoneHintFinal: '游戏已经结束：创建一个新房间，再战一局吧。',
    /** No "重试" possible (e.g. on the host's own tab). */
    noRetryDescription: '与房间的连接中断了。',
    noRetryHint: '请检查网络，然后从首页重试。',
    descriptionLobby: '房主没有响应：可能已经关闭了房间。',
    description: '房主已经有一阵子没响应了。',
    hintLobby: '稍等片刻再试，或者返回首页，自己创建一个房间。',
    hintGame: '如果房主还在游戏中，重新加入后就能接着玩，分数也还在。',
    hintFinal: '如果房主还在线，重新加入后就能再战一局。',
  },

  /** Dialog after being dropped out of a room, by reason. */
  exit: {
    kicked: {
      title: '你已被移出房间',
      hint: '你随时可以自己创建房间，或者用其他房间码加入。',
    },
    closed: {
      title: '房间已关闭',
      hint: '游戏已对所有人结束。创建一个新房间，或者用其他房间码加入。',
    },
    /** The same profile joined from another tab or device. */
    duplicate: {
      title: '已在游戏中',
      hint: '关掉另一个标签页，就能在这里玩。',
    },
    /** The room no longer exists (host left, or a rejoin found nothing). */
    gone: {
      title: '房间已不存在',
      description: '房主关闭了房间，或者断开了连接。',
      hint: '从首页创建新房间，或者用其他房间码加入。',
    },
    /** Rejoining failed (network). */
    failed: {
      title: '无法重新加入',
      hint: '请检查网络，然后在首页用房间码重试。',
    },
    /** Any other reason. */
    generic: {
      title: '你已离开房间',
      hint: '可以在首页用同一个房间码重新加入。',
    },
  },

  /** Overlay while a reloaded tab re-enters its room, and the notice if that fails. */
  resume: {
    title: '重新连接',
    host: '正在恢复你的房间',
    hostRoom: '正在恢复你的房间 <b>{code}</b>',
    client: '正在重新加入房间',
    clientRoom: '正在重新加入房间 <b>{code}</b>',
    /** {hint} is the exit.gone hint. */
    goneRoom: '房间 <b>{code}</b> 已经不存在了。{hint}',
    failedRoom:
      '没能带你回到房间 <b>{code}</b>。如果游戏还在进行，请在首页用房间码重新加入。',
    failed: '如果游戏还在进行，请在首页用房间码重新加入。',
  },

  /** Full-screen crash fallback. */
  crash: {
    eyebrow: '意外错误',
    title: '出了点问题',
    body: '这首歌卡带了。刷新一下页面：如果你刚才在房间里，我会试着把你带回去。',
    reload: '刷新',
    showDetails: '技术详情',
    hideDetails: '隐藏详情',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    /** Stands in for {name} when the player's nickname is unknown. */
    someone: '一位玩家',
    joined: '{name}加入了房间',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { other: '房间里现在有{count}人' },
    left: '{name}离开了房间',
    submitted: '{name}已确认',
    /** Under "submitted" for the first one: the short final timer started. */
    lastSeconds: { other: '所有人只剩最后{count}秒！' },
    lastSecondsSoon: '所有人进入最后读秒！',
    kicked: '房主移出了{name}',
    kickedSomeone: '房主移出了一位玩家',
  },

  /** Toast while the browser keeps audio locked (touch screens say "tap", others "click"). */
  audioCue: {
    tapToListen: '轻点收听这首歌',
    clickToListen: '点击收听这首歌',
    tapToEnable: '轻点开启声音',
    clickToEnable: '点击开启声音',
    tapBody: '在你点一下屏幕之前，浏览器会暂停音频。',
    clickBody: '在你和页面互动之前，浏览器会暂停音频。',
  },

  /** Sound button and its popover. */
  sound: {
    /** Button label and tooltip. */
    button: '声音',
    buttonMuted: '声音已关闭',
    buttonLocked: '浏览器屏蔽了声音：轻点开启',
    /** aria-label of the popover. */
    panel: '声音设置',
    /** Popover heading (small caps). */
    heading: '声音',
    /** Next to the "M" key badge (the shortcut key itself is always M). */
    muteShortcut: '静音',
    mute: '关闭声音',
    unmute: '打开声音',
    volume: '音量',
    sfx: '音效',
    sfxDetail: '点击、计时、表情反应',
    /** Small pill next to the button while the browser keeps audio locked (one line). */
    unlock: '开启声音',
    unlockTitle: '在你点一下页面之前，浏览器会屏蔽声音',
  },

  /** Emoji reaction bar and the floating reactions. */
  reactions: {
    /** aria-label of the bar. */
    group: '表情反应',
    /** aria-label of each button; {name} is one of the names below. */
    button: '反应：{name}',
    /** Name tag under your own floating reaction. */
    you: '我',
    /** Tooltip and accessible name of each emoji. */
    names: {
      fire: '燃爆了',
      laugh: '哈哈哈',
      shock: '震惊',
      clap: '鼓掌',
      dead: '笑不活了',
      party: '嗨起来',
      mindBlown: '大脑宕机',
      cool: '太酷了',
      rematch: '再来一局',
    },
  },

  /** Native "leave page?" prompt while hosting a game (most browsers show their own text). */
  leaveWarning: '你一离开，所有人的游戏都会结束',
} satisfies Catalog['shell']
