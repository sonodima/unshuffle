// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: 'プレイリストをシャッフル中…',
    slicing: 'ヒット曲をバラバラに分解中…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: '全員の準備を待っています…',
  },
  host: {
    noPlaylist: '始める前にプレイリストを選んでください。',
    alreadyStarted: 'ゲームはすでに始まっています。',
    closed: 'ルームが閉じられました。',
    playlistFailed: 'Deezerからプレイリストを読み込めません。接続を確認して、もう一度お試しください。',
    prepareFailed: 'このプレイリストの曲を準備できなかったため、ロビーに戻ります。別のプレイリストでお試しください。',
    notEnoughTracks: 'このプレイリストにはプレビュー付きの曲が足りません（最低{count}曲必要です）。',
    defaultPlayer: 'プレイヤー',
    untitledPlaylist: 'プレイリスト{id}',
  },
  store: {
    invalidCode: 'ルームコードが正しくありません。',
    cancelled: 'キャンセルしました。',
    hostLost: 'ホストとの接続が切れました。',
    hostGone: 'ホストがゲームから抜けました。',
    welcomeTimeout: 'ホストから応答がありません。少し待ってからもう一度お試しください。',
    joinFailed: 'ルームに参加できませんでした。もう一度お試しください。',
    createFailed: 'ルームを作成できませんでした。もう一度お試しください。',
    startFailed: 'ゲームを開始できませんでした。',
    rejected: 'ホストに接続を拒否されました。',
    signalingLost: 'サーバーとの接続が切れました。新しいプレイヤーは参加できません。',
    actionFailed: '操作に失敗しました。',
    audioUnavailable: 'このラウンドの音声を再生できません。プレイはそのまま続けられます。',
    audioUnavailableTitled: '「{title}」の音声を再生できません。',
  },
  net: {
    network: 'ネットワークに接続できません。接続を確認して、もう一度お試しください。',
    server: '接続サーバーから応答がありません。数秒後にもう一度お試しください。',
    signaling: '接続サーバーにつながりません。少し待ってから再試行するか、ネットワーク（Wi‑Fiまたはモバイルデータ）を切り替えてください。',
    createTimeout: '接続サーバーから応答がありません。数秒後にもう一度お試しください。',
    joinTimeout: 'ホストに接続できません。もう一度お試しください。うまくいかない場合は、別のネットワーク（Wi‑Fiまたはモバイルデータ）でお試しください。',
    hostNoAnswer: 'ホストから応答がありません。コードを確認するか、少し待ってからもう一度お試しください。',
    roomNotFound: 'ルームが見つかりません。コードを確認してください。',
    invalidCode: 'ルームコードが正しくありません。コードはアルファベット5文字です（例：KXQPM）。',
    unsupported: 'このブラウザはピアツーピア接続（WebRTC）に対応していません。最新版のChrome、Safari、Firefoxでお試しください。',
    loadFailed: 'ネットワークモジュールを読み込めませんでした。ページを再読み込みしてください。',
    unknown: '予期しない接続エラーが発生しました。もう一度お試しください。',
    /** Short versions, by NetError code (join / create failures). */
    short: {
      roomNotFound: 'ルームが見つかりません。コードを確認してください。',
      network: 'ネットワークに問題があります。接続を確認して、もう一度お試しください。',
      server: '接続サーバーにつながりません。少し待ってからお試しください。',
      timeout: '接続サーバーから応答がありません。もう一度お試しください。',
      unsupported: 'お使いのブラウザはピアツーピア接続（WebRTC）に対応していません。',
    },
  },
  /** Why the host turned a connection away. */
  reject: {
    full: 'ルームが満員です。',
    version: 'ホストとゲームのバージョンが異なります。ページを再読み込みしてください。',
    kicked: 'ホストにルームからキックされました。',
    closed: 'ホストがルームを閉じました。',
    duplicate: 'あなたのプロフィールは、別のタブまたは別の端末ですでにこのルームに参加しています。',
  },
  deezer: {
    timeout: 'Deezerから応答がありません。接続を確認して、もう一度お試しください。',
    network: 'Deezerに接続できません。接続（または広告ブロッカー）を確認して、もう一度お試しください。',
    invalid: 'Deezerから予期しない応答がありました。少し待ってからもう一度お試しください。',
    quota: 'Deezerへのリクエストが多すぎます。数秒待ってからもう一度お試しください。',
    busy: 'Deezerが一時的に混み合っています。少し待ってからもう一度お試しください。',
    notFound: 'Deezerでコンテンツが見つかりません。',
    forbidden: 'このコンテンツにはアクセスできません。非公開か、お住まいの国では利用できない可能性があります。',
    badRequest: 'Deezerへのリクエストが無効です。',
    api: 'Deezerでエラーが発生しました。少し待ってからもう一度お試しください。',
    playlistNotFound: 'プレイリストが見つかりません。リンクを確認してください（非公開のプレイリストにはアクセスできません）。',
    noPreview: 'この曲にはプレビューがありません。',
    trackNotFound: 'この曲はDeezerで利用できなくなりました。',
    featured: 'おすすめのプレイリストを読み込めませんでした。',
    /** Stand-ins for empty Deezer fields, shown as a title / artist. */
    fallback: {
      playlist: '無題のプレイリスト',
      track: '無題',
      artist: '不明なアーティスト',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16): the rhythm-game ladder, up to おに. */
  difficulty: {
    easy: 'かんたん',
    normal: 'ふつう',
    hard: 'むずかしい',
    insane: 'おに',
  },
} satisfies Catalog['game']
