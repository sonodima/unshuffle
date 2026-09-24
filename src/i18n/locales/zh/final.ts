// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18,304"). Uppercase comes
// from CSS (no effect on Chinese).
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row. Very short (≈ 4 characters). */
  you: '我',
  /** A late joiner who never played a round (standings row, empty table cell). */
  didNotPlay: '未参与',
  /** Round shorthand on covers and table rows ("R3"). Keep it 1–2 letters plus the number. */
  roundShort: 'R{round}',
  /** Round count: top bar chip (after the playlist name) and next to the "逐回合战绩" title (uppercase). */
  roundCount: { other: '{count}回合' },

  topBar: {
    /** Eyebrow next to the logo (uppercase, small). */
    gameOver: '游戏结束',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. Short: big display type. */
    teaser: '冠军是',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short (≈ 16 characters). */
  headline: {
    /** Nobody in the standings (should not happen). */
    over: '游戏结束！',
    noPlayers: '排行榜上没有玩家。',
    /** Solo game, zero points. */
    soloZero: '零分！',
    soloZeroSub: '再来一局，下次一定拼得回来。',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: '大师级！',
    soloGood: '漂亮！',
    soloOk: '游戏结束！',
    /** Subtitle "5回合共得18,304分" (solo game, or a viewer who didn't play). {rounds} is the phrase headline.rounds. */
    pointsInRounds: { other: '{rounds}共得{points}分' },
    /** "5回合" inside headline.pointsInRounds. */
    rounds: { other: '{count}回合' },
    /** Several players, nobody scored. */
    allZero: '全员零分！',
    allZeroSub: '这次一分都没拿到，再来一局扳回来！',
    /** Shared first place. */
    tie: '并列第一！',
    /** I'm one of the tied winners. {names}: the other winners, already joined ("Giulia和Marco"). */
    tieWithMe: '你和{names}并列冠军',
    /** {names}: all the tied winners, already joined ("Tommy和Giulia"). Always two or more. */
    tieOthers: '{names}并列冠军',
    /** I won alone. */
    youWin: '你赢了！',
    /** Subtitle when I won and nobody else is in the standings. */
    youWinPoints: { other: '{points}分' },
    /** Subtitle when I won: my total, then my lead {gap} (formatted points) over the runner-up {name}. */
    youWinLead: { other: '{points}分 · 比{name}多{gap}分' },
    /** I won with the same points as {name}, thanks to the faster confirmations. */
    youWinFaster: '和{name}同分，但你更快',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name}赢了！',
    /** I have the winner's points but lost on time. */
    sameScore: '和{name}同分：先确认的人获胜',
    /** My place: {rank} (already an ordinal, ui.ordinal: "第2") out of {total} players, with my points. */
    myRank: { other: '你在{total}人中排{rank}名，共{points}分' },
  },

  /** Action bar pinned under the podium / at the bottom of the screen. */
  dock: {
    /** Accessible name of the button group. */
    label: '操作',
    leave: '退出',
    /** Host: main button, back to the lobby with the same players. Keep it short. */
    playAgain: '再来一局',
    /** Guest: nudge the host for a rematch. */
    rematch: '不服再战！',
    /** Guest: the rematch button right after tapping it (disabled for a few seconds). */
    rematchSent: '请求已发送',
    /** Guest: next to an animated equalizer while the host decides. */
    waiting: '等房主决定要不要再来一局…',
    /** Host: who asked for a rematch. {names}: one or two names, already joined ("Giulia和Marco"). */
    rematchNamed: { other: '{names}想再战一局！' },
    /** Host: three or more players asked for a rematch. */
    rematchMany: { other: '{count}位玩家想再战一局！' },
  },

  /** Host leaving while others are still connected. */
  leaveDialog: {
    title: '关闭房间？',
    /** {count}: connected players other than the host (1–9). */
    body: {
      other: '其他{count}位玩家会断开连接，大家也没法再来一局了。',
    },
    cancel: '取消',
    confirm: '关闭房间',
  },

  podium: {
    /** Accessible name of the podium list. */
    label: '领奖台',
    /** Screen readers, one podium step. {rank}: the place, already an ordinal (ui.ordinal: "第1"). */
    slot: { other: '{rank}名：{name}，{points}分' },
    /** Same, for my own step. */
    slotMe: { other: '{rank}名：{name}（我），{points}分' },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: '为{name}欢呼',
  },

  standings: {
    title: '排行榜',
    /** Next to the title (small, uppercase). */
    players: { other: '{count}位玩家' },
    /** Screen readers, before a row: "第2名" ({rank} is a plain number). */
    position: '第{rank}名',
    /** Badge on a disconnected player. Short. */
    offline: '离线',
    /** Tooltips / screen-reader labels of the small stats under each name. */
    perfectRounds: '完美回合',
    accuracy: '平均放对的片段数',
    avgTime: '平均确认用时',
    /** Late joiner: the first round they played. */
    lateFrom: '第{round}回合起',
    /** Unit under each total (tiny, uppercase). */
    points: { other: '分' },
  },

  /** Award cards. Titles are small display type in a half-width card on phones: keep them short. */
  awards: {
    title: '奖项',
    /** Next to the title (small, uppercase). */
    aside: '特别表彰',
    /** Three or more winners of an award: "Giulia和另外2人". {count}: how many besides {name}. */
    nameAndOthers: { other: '{name}和另外{count}人' },
    goldenEar: {
      title: '金耳朵',
      description: '完美回合最多',
      value: { other: '{count}个完美回合' },
    },
    lightning: {
      title: '闪电手',
      description: '得分回合里确认最快',
      /** {time}: average time, e.g. "38.3秒". */
      value: '平均{time}',
    },
    sniper: {
      title: '神枪手',
      description: '放对位置的片段最多',
      /** {accuracy}: snippets in place per round ("6.8/8") or a percentage ("85%"). */
      value: '平均{accuracy}',
    },
    lastSecond: {
      title: '拖延大王',
      description: '超时的回合最多',
      value: { other: '超时{count}次' },
    },
  },

  /** Rounds × players points table. */
  rounds: {
    title: '逐回合战绩',
    /** Accessible name of the table when it scrolls sideways. */
    scrollLabel: '每回合得分，左右滑动查看所有玩家',
    /** Table caption (screen readers only). */
    caption: '每位玩家在每个回合的得分',
    /** Header of the song column (small, uppercase). */
    song: '歌曲',
    /** Row title when the song is unknown. */
    fallbackTitle: '第{round}回合',
    /** Crown icon on the round's best score, and its legend. */
    best: '本回合最佳',
    /** Badge in a narrow cell (≈ 70px, tiny uppercase) and legend entry. Short. */
    perfect: '完美',
    /** Clock icon, and its legend. */
    timedOut: '超时',
    /** Footer row label (uppercase). */
    total: '总分',
  },

  /** Song tiles at the bottom. */
  songs: {
    title: '本局歌曲',
    /** Next to the title (small, uppercase; hidden on phones). */
    aside: '在这里或去 Deezer 重温',
    /** Cover button, screen readers. {title} / {artist}: the song; {round}: its round number. */
    play: '试听{artist}的《{title}》，第{round}回合',
    stop: '停止试听{artist}的《{title}》，第{round}回合',
    /** Link to the song on Deezer (screen readers). */
    open: '在 Deezer 上打开《{title}》（新标签页）',
    /** Tooltip of the same link. */
    openTooltip: '在 Deezer 上打开',
    /** Under a song whose preview couldn't be loaded. */
    unavailable: '暂无试听',
  },

  units: {
    /** Seconds with one decimal ("38.3秒"): {value} is already formatted. No space before 秒. */
    seconds: '{value}秒',
  },
} satisfies Catalog['final']
