// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button (dock / bottom sheet). Short. */
  start: 'ゲーム開始',
  /** Player count in the desktop start dock. */
  players: { other: '<num>{count}</num>人参加中' },
  /** Track count of a playlist (picker cards, chosen playlist badge). */
  tracks: { other: '<num>{count}</num>曲' },
  cancel: 'キャンセル',

  header: {
    badge: 'ロビー',
  },

  leave: {
    closeRoom: 'ルームを閉じる',
    exit: '退出',
    exitRoom: 'ルームから退出',
    hostTitle: 'ルームを閉じますか？',
    guestTitle: 'ルームから退出しますか？',
    hostBody: 'あなたはホストです。退出するとルームが閉じられ、ほかのプレイヤー全員の接続が切れます。',
    hostAloneBody: 'ルームが閉じられます。',
    /** {code}: the 5-letter room code. */
    guestBody: 'ゲームが始まるまでは、コード{code}でまた参加できます。',
    stay: '残る',
  },

  /** Phone tabs: three tabs share a 360px bar. */
  tabs: {
    label: 'ロビーのセクション',
    players: 'プレイヤー',
    playlist: 'プレイリスト',
    rules: 'ルール',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}、未選択',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { other: '{tab}、{count}人' },
  },

  invite: {
    linkCopied: 'ルームのリンクをコピーしました！',
    copyFailed: 'コピーできませんでした。QRボタンからリンクを表示してください。',
    /** Native share sheet text; the join link follows it. */
    shareText: 'UNSHUFFLEで勝負しよう！ルーム{code}に参加してね：',
  },

  code: {
    title: 'ルームコード',
    clickToCopy: 'クリックでコピー',
    tapToCopy: 'タップでコピー',
    copied: 'コードをコピーしました！',
    copyFailed: 'コピーできませんでした',
    /** {code}: the room code spelled letter by letter. */
    copyLabel: 'ルームコード{code}。コードをコピー',
    copyLink: 'リンクをコピー',
    linkCopied: 'コピー完了！',
    share: '共有',
    showQr: 'QRコードを表示',
    enlargeQr: 'QRコードを拡大',
    phoneTitle: 'スマホで参加',
    phoneBody: 'QRを読み取るか、リンクを開くだけ。アカウント不要ですぐ参加できます。',
  },

  qr: {
    title: '友だちを招待',
    /** One line on phones (~17 full-width characters). */
    description: 'スマホでQRを読むか、リンクを送ろう。',
    code: 'コード',
    copy: 'コピー',
    copied: 'コピー済み',
    copyFailed: 'コピーできませんでした。リンクを選択して手動でコピーしてください。',
    shareLink: 'リンクを共有',
    imageLabel: 'ルームに参加するためのQRコード',
  },

  roster: {
    title: 'プレイヤー',
    online: { other: '<num>{count}</num>人オンライン' },
    capacity: { other: '{max}人中{count}人' },
    listLabel: 'プレイヤー一覧',
    /** Badge on your own row. Very short. */
    you: 'あなた',
    /** Badge on the host's row. Very short. */
    host: 'ホスト',
    reconnecting: '再接続中…',
    editProfile: 'プロフィールを編集',
    kickLabel: '{name}をキック',
    freeSeats: { other: '空き<num>{count}</num>席' },
    invite: '招待',
    kick: {
      title: '{name}をキックしますか？',
      titleFallback: 'プレイヤーをキックしますか？',
      body: 'すぐにルームから外され、再参加できなくなります。',
      confirm: 'キック',
    },
  },

  profile: {
    title: 'プロフィール',
    name: '名前',
    namePlaceholder: 'あなたの名前は？',
    nameRequired: '1文字以上入力してください。',
    save: '保存',
  },

  picker: {
    title: 'プレイリストを選ぶ',
    source: 'Deezerの楽曲 · 30秒プレビュー',
    searchLabel: 'プレイリストを検索',
    /** Must fit a 300px-wide field on phones (~16 full-width characters). */
    searchPlaceholder: 'キーワードやDeezerリンクを入力',
    searching: '検索中',
    clear: '検索をクリア',
    featured: 'おすすめ',
    fromLink: 'リンクから',
    resultsFor: '「{query}」の検索結果',
    count: { other: '{count}件' },
    loading: '読み込み中…',
    invalidLink: '無効なリンク',
    pickedFromLink: 'リンクから選んだプレイリスト',
    retry: '再試行',
    /** Hover label on a cover. Very short. */
    pick: '選ぶ',
    tracksTooShort: { other: '<num>{count}</num>曲 · 曲数不足' },
    tracksBy: { other: '<num>{count}</num>曲 · {creator}' },
    chips: 'カテゴリ',
    chipsPrev: '前のカテゴリ',
    chipsNext: '次のカテゴリ',
    shortLink: {
      title: 'プレイリストの完全なリンクを貼り付けてください',
      body: '短縮リンク（link.deezer.com）はここでは開けません。ブラウザかDeezerアプリで開いて、完全なアドレス（deezer.com/…/playlist/123456）をコピーしてください。',
    },
    foreignLink: {
      title: 'このリンクはプレイリストではありません',
      body: 'Deezerの公開プレイリストのリンク（例：deezer.com/playlist/123456）を貼り付けるか、曲名・アーティスト・ジャンルで検索してください。',
    },
    notFound: {
      title: 'プレイリストが見つかりません',
      body: 'リンクを確認してください（非公開のプレイリストにはアクセスできません）。',
    },
    offline: 'Deezerから応答がありません',
    empty: {
      title: '該当するプレイリストなし',
      titleFor: '「{query}」のプレイリストは見つかりませんでした',
      body: 'アーティスト名、ジャンル、年代で探すか、Deezerのプレイリストのリンクを貼り付けてみてください。',
    },
  },

  /** The chosen playlist, as a record sleeve (guests). */
  hero: {
    label: '選ばれたプレイリスト',
    eyebrow: 'プレイリスト',
    none: 'プレイリスト未選択',
    /** Guests' eyebrow while the host hasn't picked one yet. */
    incoming: 'プレイリスト選択中',
    by: '作成：{creator}',
    hostEmpty: 'プレイリストを検索するか、カテゴリをタップするか、Deezerのリンクを貼り付けよう。',
    guestEmpty: 'ホストが選ぶとここに表示されます。耳の準備はいい？',
    change: '変更',
  },

  rules: {
    title: 'ルール',
    /** Host only: upper bound of the game length. */
    duration: '最長約<num>{minutes}分</num>',
    hostDecides: 'ホストが決定',
    /** Option label in seconds, e.g. "90秒" (4 options share a row). */
    seconds: '{seconds}秒',
    snippetsOption: '{snippets} · {difficulty}',
    cutsOption: '{name} · {detail}',
    rounds: { title: 'ラウンド数', hint: '1ラウンドにつき1曲' },
    snippets: { title: 'ピース数', hint: '多いほどむずかしい' },
    cuts: { title: 'カット', hint: 'ナタのほうがかんたん' },
    cutsDetail: { beat: 'ビートどおり', free: 'どこでも' },
    roundTime: { title: '制限時間', hint: '1ラウンドあたり' },
    finalTimer: { title: 'ラストタイマー', hint: '誰かが確定したら' },
  },

  /** "How to play" card (guests, while they wait). */
  howTo: {
    title: '遊び方',
    perfect: '完璧な並び＝<num>{points}</num>点',
    listen: {
      title: '聴く',
      bodyClick: {
        other: '曲は{count}ピースにカットされ、シャッフルされています。ブロックをクリックして聴いてみよう。',
      },
      bodyTap: {
        other: '曲は{count}ピースにカットされ、シャッフルされています。ブロックをタップして聴いてみよう。',
      },
    },
    reorder: {
      title: '並べる',
      body: '曲が正しく流れるまでブロックをドラッグ。▶で全体を通して聴けます。',
    },
    confirm: {
      title: '確定',
      /** {count}: seconds of the final timer (10–30). */
      body: {
        other: '最初の1人が確定するとラストタイマーがスタート。ほかのプレイヤーは残り{count}秒！',
      },
    },
  },

  /** Bottom start bar (host CTA / guests waiting). */
  bar: {
    // Rules summary items, shown in a row separated by " · ": "3ラウンド · 6ピース（かんたん） · 90秒".
    rounds: { other: '<num>{count}</num>ラウンド' },
    snippets: { other: '<num>{count}</num>ピース' },
    snippetsLevel: { other: '<num>{count}</num>ピース（{difficulty}）' },
    roundTime: '<num>{seconds}秒</num>',
    /**
     * Guests, one line next to the record (~178px on a 360px phone: ≤ 13 full-width
     * characters with the dots). Animated dots follow: no final punctuation.
     */
    waitingStart: 'ホストの開始を待っています',
    /** Same slot. Noun style, like hero.incoming (プレイリスト選択中). */
    waitingPlaylist: 'ホストがプレイリスト選択中',
    pickPlaylist: 'プレイリストを選んでスタート',
    solo: 'ひとりでも遊べます',
    noPlaylist: 'プレイリスト未選択',
    /** One-tap fix when the playlist is too short. Short button. */
    playRounds: { other: '{count}ラウンドで遊ぶ' },
    shortfall: {
      other: 'プレイリストの曲が足りません（<num>{count}</num>曲／必要<num>{need}</num>曲）。',
    },
    shortfallMin: {
      other: 'プレイリストの曲が足りません（<num>{count}</num>曲のみ／最低<num>{min}</num>曲必要）。',
    },
  },

  /**
   * Category chips above the picker: a label, the Deezer playlist search it runs
   * and an emoji. Every query checked on the Deezer API (top results: public
   * playlists with 30+ tracks).
   */
  chips: [
    { label: 'いまのヒット', query: 'top japan', emoji: '🔥' },
    { label: 'J-POP', query: 'jpop hits', emoji: '🇯🇵' },
    { label: 'アニソン', query: 'anime openings', emoji: '📺' },
    { label: 'J-ROCK', query: 'j-rock', emoji: '🎸' },
    { label: '日本語ラップ', query: 'japanese rap', emoji: '🎤' },
    { label: 'ボカロ', query: 'vocaloid', emoji: '🎹' },
    { label: 'シティポップ', query: 'city pop', emoji: '🌃' },
    { label: '2010年代', query: '10s japan hits', emoji: '📱' },
    { label: '2000年代', query: '2000s japan hits', emoji: '💿' },
    { label: '90年代', query: '90s japan hits', emoji: '📼' },
    { label: '80年代', query: '80s japan hits', emoji: '🕺' },
    { label: '70年代', query: '70s japan hits', emoji: '🪩' },
    { label: 'カラオケ定番', query: 'karaoke japan', emoji: '🎙️' },
    { label: 'K-POP', query: 'k-pop hits', emoji: '💜' },
    { label: '洋楽ヒット', query: 'global hits', emoji: '🌍' },
    { label: '洋楽ロック', query: 'rock classics', emoji: '🤘' },
    { label: 'ディズニー', query: 'ディズニー 日本語', emoji: '🏰' },
  ],

  /**
   * Featured shelf (search box empty): Deezer playlist ids, in shelf order.
   * Japan's tops first, then worldwide ones. Public, editorial, ≥ 40 tracks.
   */
  featured: [
    1362508955, // Top Japan — Deezer Charts
    3155776842, // Top Worldwide — Deezer Charts
    6049895724, // Top J-Pop — Deezer Japan Editor
    5206929684, // Anime Hits アニメ・ヒッツ — Deezer Japan Editor
    3884441062, // J-Pop Essentials — Deezer Japan Editor
    4864900964, // Karaoke Party — Deezer Japan Editor
    6055749804, // Top J-Rock — Deezer Japan Editor
    3884381442, // 10s Japan Hits — Deezer Japan Editor
    6125733744, // 90s Japan Hits — Deezer Japan Editor
    5206933664, // 80s Japan Hits — Deezer Japan Editor
    3884384422, // City Pop — Deezer Soundtracks Editor
    4096400722, // Top K-Pop — Deezer K-Pop Editor
  ],
} satisfies Catalog['lobby']
