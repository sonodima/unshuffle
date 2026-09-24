// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS (no effect on Chinese).
import type { Catalog } from '../../catalog'

export default {
  header: {
    /** Small label above the round title. */
    eyebrow: '结果揭晓',
    /** Page title, e.g. "回合 3 / 5". The <dim> part is shown dimmed. */
    round: '回合 {round}<dim> / {total}</dim>',
  },

  song: {
    /** Screen-reader name of the song card. */
    region: '本回合歌曲',
    /** Small label above the song title. */
    eyebrow: '这首歌是',
    /** Alt text of the album cover; {name} is the album (or the song title). */
    coverAlt: '《{name}》的封面',
    /** Status of the original song (equalizer label, now-playing bar). */
    playing: '正在播放',
    paused: '已暂停',
    /** Now-playing bar when the song is not playing. */
    stopped: '已停止',
    /** Button while the browser still blocks the audio: one tap starts it. */
    unlock: {
      hover: '点击收听',
      touch: '轻点收听',
    },
    /** Round play/pause button (screen-reader labels). */
    pause: '暂停歌曲',
    resume: '继续播放歌曲',
    replay: '重新播放歌曲',
    /**
     * Small button that opens the song on Deezer. The <wide> part is hidden on
     * phones narrower than 420 px, so what is outside it must work alone (keep it short).
     */
    deezer: '<wide>去 Deezer </wide>收听',
    /** Screen-reader label of the Deezer button; {title} is the song. */
    deezerAria: '在 Deezer 上收听《{title}》（在新标签页中打开）',
    /** Fact chips under the song (small). */
    snippets: { other: '{count}个片段' },
    /** Tempo chip: “BPM” stays as is. */
    bpm: '{bpm} BPM',
  },

  board: {
    /** Screen-reader name of the board section. */
    region: '你的排列',
    /** Board title, depending on which arrangement is shown. */
    titleMine: '你的顺序',
    titleCorrect: '正确顺序',
    /**
     * Two-option toggle above the board, once sorted. Each option is ~120 px wide
     * on tablets/desktop and ~80 px on phones (the short forms).
     */
    toggle: {
      /** Screen-reader name of the toggle. */
      label: '显示的顺序',
      mine: '你的顺序',
      mineShort: '我的',
      correct: '正确顺序',
      correctShort: '正确',
    },
    /** Screen-reader labels of the two counters while the ✓ / ✗ pop in. */
    tallyCorrect: { other: '{count}个位置正确' },
    tallyWrong: { other: '{count}个位置错误' },
    /**
     * Tiny chips in the corner of a misplaced block (~6 characters).
     * `was`: on the right order, where the player had put that snippet ("原第3位").
     * `goes`: on the player's order, where the snippet belongs ("→第3位").
     * {pos} = the position, already an ordinal (ui.ordinal: "第5").
     */
    was: '原{pos}位',
    goes: '→{pos}位',
    /**
     * One line under the board title (truncated beyond ~60 characters on phones):
     * how it went · what a click (mouse) / tap (touch screens) on a block does.
     */
    hint: {
      /** Before the blocks sort themselves. */
      intro: {
        hover: '点击片段，从那里开始听这首歌',
        touch: '轻点片段，从那里开始听这首歌',
      },
      /** The player's own arrangement is shown. */
      mine: {
        hover: '这是你排的顺序 · 点击试听',
        touch: '这是你排的顺序 · 轻点试听',
      },
      perfect: {
        hover: '全部放对了！· 点击重听',
        touch: '全部放对了！· 轻点重听',
      },
      none: {
        hover: '一个位置都没放对 · 点击重听',
        touch: '一个位置都没放对 · 轻点重听',
      },
      /** {count} right positions out of {n} blocks. */
      partial: {
        hover: {
          other: '{n}个位置你放对了{count}个 · 点击重听',
        },
        touch: {
          other: '{n}个位置你放对了{count}个 · 轻点重听',
        },
      },
    },
  },

  /** In place of the board for a late joiner (plays from the next round). */
  spectator: {
    title: '你在观战',
    body: '这一回合你在场外观战：下回合就能上场。',
  },
  /** In place of the board when the host got no arrangement from me. */
  missing: {
    title: '没有作答',
    body: '这次没有收到你的排列。',
  },

  score: {
    /** Screen-reader name of the points panel. */
    region: '你的得分',
    /** Small label over the big number (one line, keep it short). */
    eyebrow: '本回合得分',
    /** Badge: the timer ran out before I confirmed (also a leaderboard icon label). */
    timedOut: '超时',
    /**
     * Small pill: how long I took to confirm. The <wide> part is hidden below 400 px;
     * <num> wraps {time}, e.g. “55.8秒”. Keep all the text inside the two tags (either
     * order): the pill spaces them itself.
     */
    confirmedIn: '<wide>确认用时</wide> <num>{time}</num>',
    /** Screen-reader label of the 0–5000 bar. */
    barAria: { other: '{points}分，满分{max}分' },
    /** Label under the “6/8” stat (small, one line). */
    correct: '位置正确',
    /** Label under the pair count (small, one line); the number is shown above it. */
    pairs: { other: '衔接正确' },
    /** My overall total after this round. */
    total: '总分',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}名',
    /** Stamp on a perfect round (big, slanted). */
    stamp: '完美！',
  },

  /** One line under my points, by how well the round went. */
  verdict: {
    perfect: '顺序完美！',
    almost: '差一点就完美了！',
    good: '好耳力！',
    close: '就差一点…',
    more: '还得多听几遍',
    none: '没有片段放对位置',
  },

  /** Screen-reader label of the rank-change arrow. */
  rankUp: { other: '排名上升{count}位' },
  rankDown: { other: '排名下降{count}位' },

  /** A duration in seconds; {seconds} is already formatted (“55.8”). */
  seconds: '{seconds}秒',

  /** Screen-reader summary once my points are shown. */
  announce: {
    /** {points} = round points, {correct} of {n} blocks right, {pairs} = announce.pairs. */
    result: {
      other: '{points}分：{n}个中有{correct}个位置正确，{pairs}。',
    },
    pairs: { other: '{count}处衔接正确' },
    /** Wraps the summary on a perfect round. */
    perfect: '顺序完美！{result}',
    /** Wraps the summary when the timer ran out. */
    timedOut: '{result}时间到。',
  },

  lead: {
    /** Leaderboard title (and screen-reader name of the panel). */
    title: '排行榜',
    /** Small label on the right of the title. */
    after: '第{round}回合后',
    /** Badge next to my own name (tiny: 2–4 letters). */
    you: '我',
    /** Icon label on the best score(s) of the round. */
    top: '本回合最高分',
    /** Under the name of a player without a result. */
    spectator: '观战',
    /** Late joiner, seen by the others; {round} = the round they start playing. */
    spectatorFrom: '观战 · 第{round}回合起上场',
    noAnswer: '未作答',
    /** Round stats under the leaderboard (tiny labels, one line each, three columns). */
    stats: {
      average: '平均分',
      perfect: '完美',
      fastest: '最快',
    },
    /**
     * Screen-reader label of a leaderboard row. {rank} = the place, already an ordinal (ui.ordinal: "第1"),
     * {name} = player (or lead.row.me for me), {total} = overall points.
     */
    row: {
      /** {points} this round, {correct} of {n} blocks in the right place. */
      played: {
        other: '{rank}名，{name}：本回合{points}分，{n}个中有{correct}个位置正确，总分{total}',
      },
      spectator: '{rank}名，{name}：观战中，总分{total}',
      noAnswer: '{rank}名，{name}：未作答，总分{total}',
      /** My own name in the row label. */
      me: '{name}（我）',
    },
  },

  footer: {
    /** Host's button: next round, or the final standings after the last round. */
    next: '下一回合',
    final: '最终排名',
    /** Auto-advance countdown beside the host's button; <num> wraps the seconds. */
    nextIn: { other: '<num>{count}</num>秒后进入下一回合' },
    finalIn: { other: '<num>{count}</num>秒后公布最终排名' },
    /** Guests, while the host decides. */
    waiting: '等待房主…',
    /** Guests, with the auto-advance countdown; <num> is the dimmed seconds. */
    waitingIn: { other: '等待房主…<num>（{count}秒）</num>' },
  },
} satisfies Catalog['reveal']
