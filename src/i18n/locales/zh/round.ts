// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Keyboard key names, as printed on the key caps. */
  keys: {
    space: '空格',
    enter: 'Enter',
    /** The Control key (Apple keyboards show ⌘ instead). */
    ctrl: 'Ctrl',
  },
  /** Retry button (short: sits next to an error). */
  retry: '重试',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: '回合 <b>{number}</b><dim> / {total}</dim>',
    /** Big headline (the host's own step messages come from game.prep). */
    allReady: '全员就位，开始！',
    waiting: '等所有人准备好…',
    fallback: '正在准备回合…',
    /** Checklist: three steps, each with an "in progress" and a "done" label. */
    steps: {
      songActive: '正在选歌…',
      songDone: '歌曲已选好',
      /** Under "歌曲已选好": the title stays hidden until the reveal. */
      songDetail: '揭晓前绝对保密',
      downloadActive: '正在下载片段…',
      downloadDone: '片段已下载',
      downloadError: '下载失败',
      /** Under "下载失败". */
      downloadErrorDetail: '没有声音也能玩',
      sliceActive: '正在给歌曲切片…',
      sliceDone: '切片完成',
      /** Under "切片完成": the song is cut on the beat. One line, ~35 chars. */
      sliceDetail: { other: '按节拍切成了{count}个片段' },
    },
    /** Small uppercase label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: '已就位<b>{ready}</b><dim>/{total}</dim>',
    /** Screen-reader label of the avatar row. */
    readyPlayers: '已就位的玩家',
  },

  /** Rotating tips on the preparing screen (one at a time, ~2 lines on phones). */
  tips: {
    title: '你知道吗？',
    howToHover: '点击方块试听，拖动方块换位置。',
    howToTouch: '轻点方块试听，拖动方块换位置。',
    /** “播放全部” is the play-all button of the board. */
    playAll: '“播放全部”会按当前顺序播放所有方块：听着顺耳，就八九不离十了。',
    hold: '按住一个方块，就能从那里开始连续播放。',
    pairs: '相邻两个方块的先后顺序对了，就算不在正确位置也能得分。',
    firstConfirm: '第一个确认的人，会为所有人启动最后倒计时。',
    edges: '找找歌曲的开头和淡出的结尾：它们就是第一个和最后一个方块。',
    /** {points} = the maximum score of a round (5,000, formatted). */
    perfect: '完美顺序 = {points}分。没压力哈。',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: '最后一回合',
    /** Screen-reader text of the headline. */
    headlineLabel: '第{number}回合，共{total}回合',
    /**
     * Huge one-line headline: <word> white text, <n> the round number (lime),
     * <total> "/total" (small, grey). Keep the three tags; spaces between tags don't show.
     */
    headline: '<word>回合</word> <n>{number}</n><total>/{total}</total>',
    /** Screen-reader label of the round facts list. */
    rulesLabel: '本回合规则',
    /** Fact pills. <b> = the number (white). */
    snippets: { other: '<b>{count}</b>个片段' },
    /** Round duration in seconds. */
    seconds: '<b>{seconds}</b>秒',
    spectator: '这一回合你先观战：下回合就能上场。',
    howToHover: '点击方块试听，再把它拖到正确的位置。',
    howToTouch: '轻点方块试听，再把它拖到正确的位置。',
    /** Shown inside the countdown ring before "3" (small, uppercase). */
    ready: '准备好了？',
    /** Screen-reader text of the countdown ring: before the count / while counting ({seconds} = 3, 2, 1). */
    readyLabel: '准备',
    countdownLabel: '{seconds}秒后开始',
  },

  /** Full-screen slam when the round starts. Very short (1 word, huge type). */
  go: '开冲！',
  /** Shown while the board data for the round arrives. */
  syncing: '正在同步回合…',

  /** Top bar while playing. Labels are tiny uppercase eyebrows: keep them short. */
  hud: {
    round: '回合',
    snippets: '片段',
    points: '得分',
    /** Caption inside the timer ring (1 short word): normal / after the first confirm. */
    time: '时间',
    finalTime: '冲刺',
    /** Badge under the ring after the first confirm. */
    lastSeconds: '最后读秒',
    /** Eyebrow over the avatars: {done} players out of {total} confirmed. */
    confirmed: '已确认{done}/{total}',
    /** Standing under the score. {rank} = the place, already an ordinal (ui.ordinal: "第1"). */
    rank: '{rank}名',
    /** Screen-reader label of the avatar row. */
    players: '本回合玩家',
  },

  /** Avatar rows. */
  players: {
    /** The viewer's own avatar (screen readers / tooltip). */
    me: '{name}（我）',
    /** Chip after the last shown avatar ("+3"), for screen readers. */
    more: { other: '还有{count}人' },
  },

  /** "Giulia已确认！" — the final-countdown banner in the HUD. */
  banner: {
    /** Player without a name. */
    someone: '有人',
    mine: '你第一个确认！',
    /** <name> is the player's name: on phones only the name is shortened (one line). */
    confirmedBy: '<name>{name}</name>已确认！',
    /** Line under the title; <n> is the live seconds count (animated). */
    othersLeft: '其他人还剩<n>{seconds}</n>秒',
    youLeft: { other: '你还剩<n>{count}</n>秒' },
    /** For players who can't act any more (already confirmed, spectators). */
    finalTimer: '最后倒计时：<n>{seconds}</n>秒',
  },

  /** Bottom dock: play-all transport + 确认 / status. Status lines are one line (truncated). */
  dock: {
    /** Main button (uppercase). */
    confirm: '确认',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: '你还没动过任何方块',
    armTap: '再点一次即可确认',
    armClick: '再点击一次即可确认',
    /** {mod} = ⌘ or Ctrl, {enter} = the Enter key name. */
    armKey: '再按一次{mod} + {enter}',
    confirmed: '已确认',
    /** Confirmed while offline: it is sent on reconnect. */
    queued: '恢复联网后自动提交',
    /** {names} = one or two player names ("Giulia", "Giulia和Marco"). */
    waitingFor: '等待{names}',
    waitingForCount: { other: '等待{count}位玩家' },
    allConfirmed: '所有人都确认了！',
    /** Screen-reader label of the avatars of those still playing. */
    stillPlaying: '仍在作答',
    timeUp: '时间到！',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: '以你最后的顺序为准',
    computing: '正在计算结果…',
    spectator: '观战中',
    spectatorBody: '下回合就能上场',
    audioFailed: '音频不可用',
    audioFailedBody: '重试一下，或者直接玩',
    /** Icon button (phones): screen readers / tooltip. */
    retryAudio: '重新下载音频',
    /**
     * Keyboard legend under the dock (desktop). <kbd> = a key cap. {space} / {enter} /
     * {mod} (⌘ or Ctrl) are key names. <action> = the action label after a combination.
     */
    hints: {
      playAll: '<kbd>{space}</kbd> 播放全部',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>确认</action>',
      pointer: '点击方块试听 · 按住从这里连播 · 拖动换位置',
      /** Same, after confirming (blocks can't move any more). */
      pointerLocked: '点击方块试听 · 按住从这里连播',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: '你正在观战',
    bodyHover: '下回合就能上场。现在可以先点击方块，听听这些片段。',
    bodyTouch: '下回合就能上场。现在可以先轻点方块，听听这些片段。',
  },

  /** In-game exit menu (sheet). */
  menu: {
    /** Round button that opens it (screen readers / tooltip). */
    endButton: '结束游戏',
    leaveButton: '退出游戏',
    hostTitle: '结束游戏？',
    guestTitle: '退出游戏？',
    hostBody: '你是房主：游戏会对所有人结束。',
    /** Host alone in the room. */
    hostAloneBody: '游戏将在这里结束。',
    guestBody: '你走后游戏会继续。只要游戏还没结束，你随时可以回来，分数也会保留。',
    keepPlaying: '继续游戏',
    stay: '留下',
    /** Guest's red confirm button in the sheet (the round button above only opens it). */
    leave: '退出游戏',
    toLobby: '返回大厅',
    toLobbyBody: '分数清零，玩家不变：换个歌单再来。',
    toLobbyAloneBody: '分数清零：换个歌单再来。',
    close: '关闭房间',
    /** Closing the room disconnects the one other player / all the others (2 or more). */
    closeBodyOne: '另一位玩家会断开连接。',
    closeBodyMany: '其他所有玩家都会断开连接。',
    closeAloneBody: '你将返回首页。',
    /** Next to the room code (guests). */
    rejoinCode: '重新加入用的房间码',
  },
} satisfies Catalog['round']
