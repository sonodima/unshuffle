// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Keyboard key names, as printed on the key caps. */
  keys: {
    space: 'Space',
    enter: 'Enter',
    ctrl: 'Ctrl',
  },
  retry: '再試行',

  /** Between rounds: the host picks and cuts the song, every peer downloads it. */
  preparing: {
    /** Header. <b> = current round (white), <dim> = " / total" (grey). */
    header: 'ラウンド <b>{number}</b><dim> / {total}</dim>',
    allReady: '全員そろった、スタート！',
    waiting: '全員の準備を待っています…',
    fallback: 'ラウンドを準備中…',
    steps: {
      songActive: '曲を選んでいます…',
      songDone: '曲が決まりました',
      /** Under "曲が決まりました": the title stays hidden until the reveal. */
      songDetail: '曲名は最後までヒミツ',
      downloadActive: 'ピースをダウンロード中…',
      downloadDone: 'ダウンロード完了',
      downloadError: 'ダウンロード失敗',
      downloadErrorDetail: '音声なしでもプレイできます',
      /** 刻む = to chop, and to keep the beat. */
      sliceActive: '曲を刻んでいます…',
      sliceDone: 'カット完了',
      /** One line, ~17 full-width characters. */
      sliceDetail: { other: 'ビートに合わせて{count}ピースに' },
    },
    /** Small label before the avatars. <b> = ready players, <dim> = "/total". */
    ready: '準備OK <b>{ready}</b><dim>/{total}</dim>',
    readyPlayers: '準備OKのプレイヤー',
  },

  /** Rotating tips on the preparing screen (~2 lines on phones). */
  tips: {
    title: '知ってた？',
    howToHover: 'ブロックはクリックで試聴、ドラッグで移動できます。',
    howToTouch: 'ブロックはタップで試聴、ドラッグで移動できます。',
    /** 「通して聴く」 is the play-all button of the board. */
    playAll: '「通して聴く」で今の並び順のまま再生。スムーズにつながったら、正解は目の前！',
    hold: 'ブロックを長押しすると、そこから続けて再生できます。',
    pairs: '正しい順で隣り合った2つのブロックは、位置がずれていても得点になります。',
    firstConfirm: '最初に確定した人が、全員のラストタイマーをスタートさせます。',
    edges: '曲のイントロと、フェードアウトする部分を探そう。それが最初と最後のブロックです。',
    /** {points} = the maximum score of a round (formatted). */
    perfect: '完璧に並べれば{points}点。プレッシャー？ないない。',
  },

  /** The round card before the board, with the 3-2-1 countdown. */
  intro: {
    lastRound: '最終ラウンド',
    headlineLabel: '全{total}ラウンド中、第{number}ラウンド',
    /** Huge one-line headline: keep the three tags. */
    headline: '<word>ラウンド</word> <n>{number}</n><total>/{total}</total>',
    rulesLabel: 'このラウンドのルール',
    snippets: { other: '<b>{count}</b>ピース' },
    seconds: '<b>{seconds}</b>秒',
    spectator: 'このラウンドは観戦です。次のラウンドから参加できます。',
    /** Same words as the dock hints (試聴 / ドラッグで). One line on phones: ≤ 19 characters. */
    howToHover: 'クリックで試聴、ドラッグで正しい位置へ。',
    howToTouch: 'タップで試聴、ドラッグで正しい位置へ。',
    /** Shown inside the countdown ring before "3" (small). */
    ready: '準備はいい？',
    readyLabel: 'スタート準備',
    countdownLabel: 'あと{seconds}秒でスタート',
  },

  /**
   * Full-screen slam when the round starts, after the 3-2-1 (huge type: only 3
   * full-width characters fit a phone). "3、2、1、ドン！" — the race-start call.
   */
  go: 'ドン！',
  syncing: 'ラウンドを同期中…',

  /** Top bar while playing: tiny eyebrows, keep them short. */
  hud: {
    round: 'ラウンド',
    snippets: 'ピース',
    points: 'スコア',
    /** Caption inside the timer ring: normal / after the first confirm. */
    time: 'タイム',
    finalTime: 'ラスト',
    /** Badge under the ring after the first confirm. */
    lastSeconds: '残りわずか',
    confirmed: '確定 {done}/{total}',
    /** {rank} = the place, already an ordinal ("1"). */
    rank: '{rank}位',
    players: 'このラウンドのプレイヤー',
  },

  players: {
    me: '{name}（あなた）',
    more: { other: 'ほか{count}人' },
  },

  /** "Giuliaが確定！" — the final-countdown banner in the HUD. */
  banner: {
    someone: '誰か',
    mine: '一番乗りで確定！',
    /** <name> is the player's name: on phones only the name is shortened. */
    confirmedBy: '<name>{name}</name>が確定！',
    /** <n> is the live seconds count (animated). */
    othersLeft: 'ほかの人は残り<n>{seconds}</n>秒',
    youLeft: { other: 'あと<n>{count}</n>秒' },
    /** For players who can't act any more (already confirmed, spectators). */
    finalTimer: 'ラスト<n>{seconds}</n>秒',
  },

  /** Bottom dock: play-all transport + 確定 / status. Status lines are one line. */
  dock: {
    confirm: '確定',
    /** The board is still the starting shuffle: the button asks for a second press. */
    unchanged: 'まだ何も動かしていません',
    armTap: 'もう一度タップで確定',
    armClick: 'もう一度クリックで確定',
    armKey: 'もう一度{mod}+{enter}で確定',
    confirmed: '確定済み',
    queued: 'オンラインに戻りしだい送信',
    /** {names} = one or two player names. */
    waitingFor: '{names}を待っています',
    waitingForCount: { other: '{count}人を待っています' },
    allConfirmed: '全員が確定！',
    stillPlaying: 'まだプレイ中',
    timeUp: 'タイムアップ！',
    /** Time ran out before I confirmed: my last arrangement counts. */
    timedOut: '最後の並び順で採点されます',
    computing: '結果を集計中…',
    spectator: '観戦中',
    spectatorBody: '次のラウンドから参加',
    audioFailed: '音声を再生できません',
    audioFailedBody: '再試行するか、そのままプレイ',
    retryAudio: '音声を再ダウンロード',
    /** Keyboard legend under the dock (desktop). */
    hints: {
      playAll: '<kbd>{space}</kbd> 通して聴く',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>確定</action>',
      pointer: 'クリックで試聴 · 長押しでそこから再生 · ドラッグで移動',
      pointerLocked: 'クリックで試聴 · 長押しでそこから再生',
    },
  },

  /** Centre card for a late joiner, over the board. */
  spectator: {
    title: '観戦中',
    bodyHover: '次のラウンドから参加できます。それまでブロックをクリックして、ピースを聴いてみよう。',
    bodyTouch: '次のラウンドから参加できます。それまでブロックをタップして、ピースを聴いてみよう。',
  },

  /** In-game exit menu (sheet). */
  menu: {
    endButton: 'ゲームを終了',
    leaveButton: 'ゲームから退出',
    hostTitle: 'ゲームを終了しますか？',
    guestTitle: 'ゲームから退出しますか？',
    hostBody: 'あなたはホストです。全員のゲームが終了します。',
    hostAloneBody: 'ゲームはここで終了します。',
    guestBody: 'ゲームはあなた抜きで続きます。進行中なら、再参加してスコアを取り戻せます。',
    keepPlaying: 'プレイを続ける',
    stay: '残る',
    leave: 'ゲームから退出',
    toLobby: 'ロビーに戻る',
    toLobbyBody: 'スコアはリセット、メンバーはそのまま。プレイリストを変えて再スタート！',
    toLobbyAloneBody: 'スコアはリセット。プレイリストを変えて再スタート！',
    close: 'ルームを閉じる',
    closeBodyOne: 'もう1人のプレイヤーの接続が切れます。',
    closeBodyMany: 'ほかのプレイヤー全員の接続が切れます。',
    closeAloneBody: 'ホームに戻ります。',
    rejoinCode: '再参加用コード',
  },
} satisfies Catalog['round']
