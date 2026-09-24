// Home screen: hero, profile card, "ルームを作成" / join box, the decorative
// round demo and the "遊び方" dialog.
import type { Catalog } from '../../catalog'

export default {
  /** Top-left pill that opens the "how to play" dialog. */
  help: '遊び方',
  hero: {
    /** Small line above the logo (letter-spaced). */
    eyebrow: '音楽パーティーゲーム',
    /** Under the logo. <b>…</b> is the highlighted second sentence. */
    tagline: 'あのヒット曲がバラバラに。<b>元どおりに並べ直せ！</b>',
  },
  cardLabel: 'プレイ',
  demoLabel: 'ラウンドのデモ',
  offline: 'オフラインです。プレイにはネット接続が必要です。',
  dismissNotice: 'お知らせを閉じる',
  /** Divider between the join box and "自分でルームを作成" (invite link). */
  or: 'または',
  cancel: 'キャンセル',
  create: {
    /** Main call to action (big button). */
    button: 'ルームを作成',
    /** Secondary button when the player arrived with an invite link. */
    buttonInvited: '自分でルームを作成',
    pending: 'ルームを作成中…',
    /** Hint under the button: one line on phones (~22 full-width characters). */
    solo: '<b>ひとりでもOK：</b>ルームを作ってすぐスタート',
  },
  join: {
    divider: 'コードがある？',
    invited: '招待が届いています！',
    button: '参加',
    /** {code} = 5-letter room code, e.g. KXQPM. */
    buttonCode: '{code}に参加',
    pending: 'ルームに接続中…',
    incomplete: {
      other: 'コードを{count}文字すべて入力してください。',
    },
  },
  /** Tiny facts in the footer (one line each). */
  footer: {
    players: {
      other: '最大{count}人でプレイ',
    },
    noAccount: 'アカウント不要・ブラウザで遊べる',
    deezer: '楽曲プレビューはDeezerから',
  },
  profile: {
    changeAvatar: 'アバターとカラーを変更',
    nameLabel: 'ニックネーム',
    namePlaceholder: '名前を入力',
    randomName: 'ランダムな名前',
    lookTitle: 'アバターを選ぶ',
    lookDescription: '絵文字とカラーを選ぼう。ほかのプレイヤーにはこう見えます。',
    done: '完了',
    preview: 'プレビュー',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    badge: 'デモ',
    /** One line, ~17 full-width characters on desktop. */
    caption: {
      shuffle: 'ヒット曲をバラバラに…',
      listen: 'ピースを聴こう',
      sort: '正しい順に並べよう',
      solved: 'パーフェクト！一番乗りで確定',
    },
    /** {points} = points won, already formatted. */
    solvedPoints: 'パーフェクト！+{points}',
    stepsLabel: 'かんたんな遊び方',
    /** Step chips under the desktop demo (one word each). */
    steps: {
      listen: '聴く',
      sort: '並べる',
      confirm: '確定',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: '遊び方',
    description: '1ラウンドにつき1曲。バラバラになったヒット曲を、より正確に、より速く並べ直した人の勝ち！',
    gotIt: 'わかった、遊ぼう！',
    /** The fake "confirm" button in the third illustration (tiny pill). */
    confirmButton: '確定',
    steps: {
      listen: {
        title: 'ピースを聴こう',
        bodyMouse: '有名なヒット曲がビートに合わせてカットされ、シャッフルされます。ブロックをクリックすると聴けます。',
        bodyTouch: '有名なヒット曲がビートに合わせてカットされ、シャッフルされます。ブロックをタップすると聴けます。',
      },
      sort: {
        title: '正しい順に並べよう',
        /** <play></play> is replaced by a small ▶ icon. Keep it empty. */
        body: '原曲どおりに聴こえるまでブロックを動かそう。<play></play>で今の並びを通して聴けます。',
      },
      confirm: {
        title: '誰よりも早く確定',
        body: '最初に確定した人が出ると、全員のラストタイマーがスタートします。',
      },
    },
    /** {points} = maximum points per round, already formatted; <b>…</b> highlights it. */
    scoring: {
      other: '1ラウンド最大<b>{points}</b>点。正しい位置のピースと、正しくつながったペアで得点が決まります。ひとりでも遊べます。',
    },
  },
} satisfies Catalog['home']
