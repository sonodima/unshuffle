// 日本語 (ja-JP): mirrors the Italian source catalog exactly.
//
// Glossary — keep these consistent:
//   round → ラウンド · snippet (spezzone) → ピース · block (blocco, the tile) → ブロック
//   host → ホスト · lobby → ロビー · room → ルーム · room code → ルームコード
//   join → 参加 · leave → 退出 · kick → キック · invite → 招待 · spectator → 観戦中
//   confirm → 確定 (first to confirm → 一番乗り) · final timer → ラストタイマー
//     (ring caption ラスト, badge 残りわずか, banner "ラスト{n}秒")
//   time up → タイムアップ · listen → 聴く · play all → 通して聴く · playing → 再生中
//   playlist → プレイリスト · song / track → 曲 · preview → プレビュー
//   reveal → 結果発表 · leaderboard → ランキング · final standings → 最終結果
//   points → 点 ("5,000点"; label スコア) · perfect → パーフェクト / 完璧な並び
//   pair in sequence → つながったペア (count: 組) · right place → 正しい位置
//   rematch → もう一戦 (guest request; host button もう一回; リベンジ only when everyone scored 0)
//   difficulty → かんたん / ふつう / むずかしい / おに · round start slam → ドン！
//   ranks → "{rank}位", positions → "{pos}番目" (ui.ordinal is the bare number)
// Style: です・ます for explanations and errors, friendly casual (〜しよう) for
// playful lines; full-width punctuation (、。！？「」（）：), no spaces between
// words; digits and counters without a space (90秒, 3人); " · " separates items.
import type { Catalog } from '../../catalog'
import board from './board'
import final from './final'
import game from './game'
import home from './home'
import lobby from './lobby'
import names from './names'
import reveal from './reveal'
import round from './round'
import shell from './shell'
import ui from './ui'

export default { board, final, game, home, lobby, names, reveal, round, shell, ui } satisfies Catalog
