// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  action: {
    home: 'ホームに戻る',
    retry: '再試行',
    ok: 'OK',
    cancel: 'キャンセル',
  },

  /** Browser tab title per screen. {brand} is UNSHUFFLE; {code} a room code. */
  title: {
    lobby: '{brand} · ロビー',
    lobbyRoom: '{brand} · ロビー {code}',
    round: '{brand} · ラウンド',
    roundOf: '{brand} · ラウンド {round}/{rounds}',
    roundReveal: '{brand} · ラウンド {round}/{rounds} · 結果',
    roundPreparing: '{brand} · ラウンド {round}/{rounds} · 準備中',
    final: '{brand} · 最終結果',
    lost: '{brand} · 接続切れ',
  },

  /** Floating status pill (~230px on phones): titles ≤ 12 full-width characters, details ≤ 20. */
  banner: {
    dismiss: 'お知らせを隠す',
    elapsed: '{seconds}秒',
    hostReconnecting: 'サーバーに再接続中…',
    hostReconnectingDetail: 'ゲームは続行中',
    connecting: '再接続中…',
    lost: '接続が切れました',
    lostDetail: '再接続しています…',
    lostDetailLong: '再接続中…自動で復帰します',
    hostSilent: 'ホストの応答なし',
    hostSilentDetail: 'ホストの復帰を待っています…',
    leave: '退出',
    signalingTitle: '新規参加を一時停止中',
    signalingDetail: 'サーバー切断中。今いる人は続行できます',
    warning: '注意',
  },

  dialogRoom: 'ルーム <b>{code}</b>',

  lost: {
    title: '接続が切れました',
    hostClosedTitle: 'ホストがルームを閉じました',
    hostLeftTitle: 'ホストが退出しました',
    hostGoneDescription: 'このルームはもう利用できません。',
    hostGoneHintFinal: 'ゲームは終了していました。新しいルームを作ってもう一戦しよう。',
    noRetryDescription: 'ルームとの接続が途切れました。',
    noRetryHint: '接続を確認して、ホームからもう一度お試しください。',
    descriptionLobby: 'ホストから応答がありません。ルームが閉じられたのかもしれません。',
    description: 'ホストからしばらく応答がありません。',
    hintLobby: '少し待ってからもう一度試すか、ホームに戻って自分のルームを作りましょう。',
    hintGame: 'ホストがまだゲーム中なら、再参加するとスコアはそのままで続きから遊べます。',
    hintFinal: 'ホストがまだ接続中なら、再参加してもう一戦できます。',
  },

  exit: {
    kicked: {
      title: 'ルームから外されました',
      hint: '自分でルームを作るか、別のコードで参加できます。',
    },
    closed: {
      title: 'ルームが閉じられました',
      hint: '全員のゲームが終了しました。新しいルームを作るか、別のコードで参加してください。',
    },
    duplicate: {
      title: 'すでにプレイ中',
      hint: 'ここで遊ぶには、もう一方のタブを閉じてください。',
    },
    gone: {
      title: 'このルームはもうありません',
      description: 'ホストがルームを閉じたか、接続が切れました。',
      hint: 'ホームから新しいルームを作るか、別のコードで参加してください。',
    },
    failed: {
      title: '再参加できませんでした',
      hint: '接続を確認して、ホームからコードでもう一度参加してください。',
    },
    generic: {
      title: 'ルームから退出しました',
      hint: 'ホームから同じコードで再参加できます。',
    },
  },

  resume: {
    title: '再接続中',
    host: 'あなたのルームを再開しています',
    hostRoom: 'ルーム<b>{code}</b>を再開しています',
    client: 'ルームに戻っています',
    clientRoom: 'ルーム<b>{code}</b>に戻っています',
    /** {hint} is the exit.gone hint. */
    goneRoom: 'ルーム<b>{code}</b>はもうありません。{hint}',
    failedRoom:
      'ルーム<b>{code}</b>に戻れませんでした。ゲームがまだ続いていれば、ホームからコードで再参加してください。',
    failed: 'ゲームがまだ続いていれば、ホームからコードで再参加してください。',
  },

  crash: {
    eyebrow: '予期しないエラー',
    title: '問題が発生しました',
    /** 針飛び = the needle skipped on the record. */
    body: 'レコードが針飛びしてしまいました。ページを再読み込みしてください。ルームにいた場合は、元のルームに戻れるよう試みます。',
    reload: '再読み込み',
    showDetails: '技術的な詳細',
    hideDetails: '詳細を隠す',
  },

  /** Toasts for room events. {name} is a player's nickname. */
  toast: {
    someone: 'プレイヤー',
    joined: '{name}が参加しました',
    /** Under "joined": players in the room now (always 2 or more). */
    roomCount: { other: '現在{count}人' },
    left: '{name}が退出しました',
    submitted: '{name}が確定しました',
    lastSeconds: { other: '全員、残り{count}秒！' },
    lastSecondsSoon: '全員、残りわずか！',
    kicked: 'ホストが{name}をキックしました',
    kickedSomeone: 'ホストがプレイヤーをキックしました',
  },

  audioCue: {
    tapToListen: 'タップして曲を聴く',
    clickToListen: 'クリックして曲を聴く',
    tapToEnable: 'タップしてサウンドをオン',
    clickToEnable: 'クリックしてサウンドをオン',
    tapBody: '画面をタップするまで、ブラウザが音声を止めています。',
    clickBody: 'ページを操作するまで、ブラウザが音声を止めています。',
  },

  sound: {
    button: 'サウンド',
    buttonMuted: 'サウンドオフ',
    buttonLocked: 'ブラウザが音声をブロック中：タップしてオン',
    panel: 'サウンド設定',
    heading: 'サウンド',
    /** Next to the "M" key badge. */
    muteShortcut: 'ミュート',
    mute: 'サウンドをオフ',
    unmute: 'サウンドをオン',
    volume: '音量',
    sfx: '効果音',
    sfxDetail: 'クリック、タイマー、リアクション',
    unlock: 'サウンドをオン',
    unlockTitle: 'ページをタップするまで、ブラウザが音声をブロックしています',
  },

  reactions: {
    group: 'リアクション',
    button: 'リアクション：{name}',
    you: 'あなた',
    names: {
      fire: 'アツい',
      laugh: '爆笑',
      shock: 'びっくり',
      clap: '拍手',
      dead: '腹筋崩壊',
      party: 'お祝い',
      mindBlown: '脳みそ爆発',
      cool: 'イケてる',
      rematch: 'もう一戦',
    },
  },

  leaveWarning: '退出すると全員のゲームが終了します',
} satisfies Catalog['shell']
