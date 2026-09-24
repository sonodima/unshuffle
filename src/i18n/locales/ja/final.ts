// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18,304").
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row. Very short. */
  you: 'あなた',
  didNotPlay: '不参加',
  /** Round shorthand on covers and table rows ("R3"). */
  roundShort: 'R{round}',
  roundCount: { other: '{count}ラウンド' },

  topBar: {
    gameOver: 'ゲーム終了',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. */
    teaser: '栄えある優勝は',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short. */
  headline: {
    over: 'ゲーム終了！',
    noPlayers: 'ランキングにプレイヤーがいません。',
    soloZero: 'まさかの0点！',
    soloZeroSub: 'もう一回！次こそ元どおりに並べよう。',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: 'マスター級！',
    soloGood: 'ナイス！',
    soloOk: 'ゲーム終了！',
    /** "5ラウンドで18,304点". {rounds} is the phrase headline.rounds. */
    pointsInRounds: { other: '{rounds}で{points}点' },
    rounds: { other: '{count}ラウンド' },
    allZero: '全員0点！',
    allZeroSub: '今回は誰も得点ならず。もう一戦してリベンジだ！',
    tie: '同点優勝！',
    /** {names}: the other winners, already joined. */
    tieWithMe: '{names}と同点優勝！',
    /** {names}: all the tied winners, already joined. */
    tieOthers: '{names}が同点優勝',
    youWin: 'あなたの優勝！',
    youWinPoints: { other: '{points}点' },
    /** My total, then my lead {gap} over the runner-up {name}. */
    youWinLead: { other: '{points}点 · {name}に{gap}点差' },
    youWinFaster: '{name}と同点、でもスピードで勝利！',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name}の優勝！',
    /** I have the winner's points but lost on time. */
    sameScore: '{name}と同点。確定が早かった方の勝ち',
    /** My place: {rank} (a number) out of {total} players, with my points. */
    myRank: { other: '{total}人中{rank}位（{points}点）' },
  },

  dock: {
    label: 'アクション',
    leave: '退出',
    /** Host: back to the lobby with the same players. Short. */
    playAgain: 'もう一回',
    /** Guest: nudge the host for a rematch (もう一戦, not リベンジ: the winner may ask too). */
    rematch: 'もう一戦！',
    rematchSent: 'リクエスト送信済み',
    waiting: 'もう一回やるかはホスト次第…',
    /** {names}: one or two names, already joined. */
    rematchNamed: { other: '{names}がもう一戦したいって！' },
    rematchMany: { other: '{count}人がもう一戦したいって！' },
  },

  leaveDialog: {
    title: 'ルームを閉じますか？',
    /** {count}: connected players other than the host (1–9). */
    body: {
      other: 'ほかのプレイヤー{count}人の接続が切れ、再戦できなくなります。',
    },
    cancel: 'キャンセル',
    confirm: 'ルームを閉じる',
  },

  podium: {
    label: '表彰台',
    slot: { other: '{rank}位：{name}、{points}点' },
    slotMe: { other: '{rank}位：{name}（あなた）、{points}点' },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: '{name}をお祝いする',
  },

  standings: {
    title: 'ランキング',
    players: { other: 'プレイヤー{count}人' },
    position: '{rank}位',
    offline: 'オフライン',
    perfectRounds: 'パーフェクトのラウンド数',
    accuracy: '正しい位置のピース（平均）',
    avgTime: '平均確定タイム',
    lateFrom: 'ラウンド{round}から',
    /** Unit under each total (tiny). */
    points: { other: '点' },
  },

  /**
   * Award cards: short titles (half-width card on phones). Descriptions wrap at
   * ~8 full-width characters on phones, ~10 on desktop: keep them to one line or
   * a clean two-line break.
   */
  awards: {
    title: 'アワード',
    aside: '特別賞',
    nameAndOthers: { other: '{name}ほか{count}人' },
    goldenEar: {
      title: '絶対音感',
      description: 'パーフェクト最多',
      value: { other: 'パーフェクト{count}回' },
    },
    lightning: {
      title: '電光石火',
      description: '得点したラウンドでの確定が最速',
      /** {time}: average time, e.g. "38.3秒". */
      value: '平均{time}',
    },
    sniper: {
      title: '百発百中',
      description: '正しい位置の数が最多',
      /** {accuracy}: snippets in place per round ("6.8/8") or a percentage ("85%"). */
      value: '平均{accuracy}',
    },
    /** Most rounds that ran out of time: a friendly booby prize. */
    lastSecond: {
      title: 'マイペース',
      description: 'タイムアップ最多',
      value: { other: 'タイムアップ{count}回' },
    },
  },

  rounds: {
    title: 'ラウンド別スコア',
    scrollLabel: 'ラウンド別スコア。横にスクロールすると全プレイヤーを表示',
    caption: '各ラウンドでの全プレイヤーのスコア',
    song: '曲',
    fallbackTitle: 'ラウンド{round}',
    best: 'ラウンド最高スコア',
    /** Badge in a narrow cell (≈ 70px). */
    perfect: 'パーフェクト',
    timedOut: 'タイムアップ',
    total: '合計',
  },

  songs: {
    title: 'このゲームの曲',
    aside: 'ここかDeezerでもう一度聴こう',
    play: '{title}（{artist}）のプレビューを再生、ラウンド{round}',
    stop: '{title}（{artist}）のプレビューを停止、ラウンド{round}',
    open: '{title}をDeezerで開く（新しいタブ）',
    openTooltip: 'Deezerで開く',
    unavailable: 'プレビューなし',
  },

  units: {
    /** Seconds with one decimal ("38.3秒"): {value} is already formatted. */
    seconds: '{value}秒',
  },
} satisfies Catalog['final']
