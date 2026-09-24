// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
import type { Catalog } from '../../catalog'

export default {
  header: {
    eyebrow: '結果発表',
    /** Page title, e.g. "ラウンド 3 / 5". The <dim> part is shown dimmed. */
    round: 'ラウンド {round}<dim> / {total}</dim>',
  },

  song: {
    region: '今回の曲',
    /** Small label above the song title. */
    eyebrow: '正解の曲は',
    coverAlt: '{name}のジャケット',
    playing: '再生中',
    paused: '一時停止中',
    stopped: '停止中',
    unlock: {
      hover: 'クリックして聴く',
      touch: 'タップして聴く',
    },
    pause: '曲を一時停止',
    resume: '曲を再開',
    replay: '曲をもう一度聴く',
    /** The <wide> part is hidden on phones narrower than 420 px: "聴く" alone must work. */
    deezer: '<wide>Deezerで</wide>聴く',
    deezerAria: '{title}をDeezerで聴く（新しいタブで開きます）',
    snippets: { other: '{count}ピース' },
    bpm: '{bpm} BPM',
  },

  board: {
    region: 'あなたの並び',
    titleMine: 'あなたの並び順',
    titleCorrect: '正しい並び順',
    /** Two-option toggle: ~120 px wide, ~80 px on phones (the short forms). */
    toggle: {
      label: '表示する並び順',
      mine: 'あなたの並び',
      mineShort: 'あなた',
      correct: '正解の並び',
      correctShort: '正解',
    },
    tallyCorrect: { other: '{count}個が正しい位置' },
    tallyWrong: { other: '{count}個がはずれ' },
    /**
     * Tiny chips on a misplaced block. `was`: where the player had put it;
     * `goes`: where it belongs. {pos} = the position number.
     */
    was: '前は{pos}番目',
    goes: '→{pos}番目',
    /** One line under the board title (~30 full-width characters on phones). */
    hint: {
      intro: {
        hover: 'ピースをクリックすると、そこから曲を再生',
        touch: 'ピースをタップすると、そこから曲を再生',
      },
      mine: {
        hover: 'あなたが並べた順 · クリックで聴く',
        touch: 'あなたが並べた順 · タップで聴く',
      },
      perfect: {
        hover: '全部正しい位置！ · クリックでもう一度聴く',
        touch: '全部正しい位置！ · タップでもう一度聴く',
      },
      none: {
        hover: '正しい位置はゼロ · クリックでもう一度聴く',
        touch: '正しい位置はゼロ · タップでもう一度聴く',
      },
      partial: {
        hover: {
          other: '{n}個中{count}個が正しい位置 · クリックでもう一度聴く',
        },
        touch: {
          other: '{n}個中{count}個が正しい位置 · タップでもう一度聴く',
        },
      },
    },
  },

  spectator: {
    title: '観戦中',
    body: 'このラウンドは観戦のみ。次のラウンドから参加できます。',
  },
  missing: {
    title: '回答なし',
    body: '今回はあなたの並び順を受け取れませんでした。',
  },

  score: {
    region: 'あなたのスコア',
    eyebrow: 'ラウンドスコア',
    timedOut: 'タイムアップ',
    /** The <wide> part is hidden below 400 px; <num> wraps {time}, e.g. "55.8秒". */
    confirmedIn: '<wide>確定タイム</wide> <num>{time}</num>',
    barAria: { other: '{max}点中{points}点' },
    correct: '正しい位置',
    pairs: { other: 'つながったペア' },
    total: '合計スコア',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}位',
    stamp: 'パーフェクト！',
  },

  /** One line under my points, by how well the round went. */
  verdict: {
    perfect: '完璧な並び！',
    almost: 'ほぼ完璧！',
    good: 'いい耳してる！',
    close: 'あと少し…！',
    more: 'もう一度よく聴いてみよう',
    none: '正しい位置のピースはゼロ',
  },

  rankUp: { other: '順位が{count}つ上がりました' },
  rankDown: { other: '順位が{count}つ下がりました' },

  seconds: '{seconds}秒',

  announce: {
    result: {
      other: '{points}点：{n}個中{correct}個が正しい位置、{pairs}。',
    },
    pairs: { other: 'つながったペア{count}組' },
    perfect: '完璧な並び！{result}',
    timedOut: '{result}タイムアップ。',
  },

  lead: {
    title: 'ランキング',
    after: 'ラウンド{round}終了時点',
    /** Badge next to my own name (tiny). */
    you: 'あなた',
    top: 'このラウンドの最高スコア',
    spectator: '観戦中',
    spectatorFrom: '観戦中 · ラウンド{round}から参加',
    noAnswer: '回答なし',
    stats: {
      average: '平均',
      perfect: 'パーフェクト',
      fastest: '最速',
    },
    row: {
      played: {
        other: '{rank}位、{name}：このラウンド{points}点、{n}個中{correct}個が正しい位置、合計{total}点',
      },
      spectator: '{rank}位、{name}：観戦中、合計{total}点',
      noAnswer: '{rank}位、{name}：回答なし、合計{total}点',
      me: '{name}（あなた）',
    },
  },

  footer: {
    next: '次のラウンドへ',
    final: '最終結果へ',
    nextIn: { other: '次のラウンドまで<num>{count}</num>秒' },
    finalIn: { other: '最終結果まで<num>{count}</num>秒' },
    waiting: 'ホストを待っています…',
    waitingIn: { other: 'ホストを待っています…<num>（{count}秒）</num>' },
  },
} satisfies Catalog['reveal']
