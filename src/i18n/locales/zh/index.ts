// 简体中文 (zh-CN): mirrors the Italian source catalog exactly.
//
// Glossary — keep these consistent:
//   round → 回合 (display "回合 1/3", prose "第1回合"; count "5回合")
//   snippet (spezzone) → 片段 (count 个) · block (blocco, the tile) → 方块
//   host → 房主 · lobby → 大厅 (back to it: 返回大厅) · room → 房间 · room code → 房间码
//   join → 加入 · leave → 退出 · kick → 移出 · invite → 邀请 · spectator → 观战 / 观战中
//   confirm → 确认 (first to confirm → 第一个确认 / 抢先确认)
//   final timer → 最后倒计时 (ring caption 冲刺, badge 最后读秒)
//   time up → 时间到 (badge / legend: 超时) · listen → 试听 / 收听 · play all → 播放全部
//   playlist → 歌单 · song / track → 歌曲 (count 首) · preview → 试听 · hit → 神曲 / 热歌
//   reveal → 揭晓 · leaderboard → 排行榜 · final standings → 最终排名
//   points → 分 ("5,000分"; HUD label 得分) · perfect → 完美 · right place → 位置正确
//   pair in sequence → 衔接正确 (count 处) · rematch → 再来一局 (guest button 不服再战！)
//   difficulty → 简单 / 普通 / 困难 / 地狱 · go! → 开冲！
//   ranks → "{rank}名" (第1名), positions → "{pos}位" (第3位); ui.ordinal is "第{n}"
//   own row / own name → 我, "{name}（我）"; players count → 位玩家 / 人
//   click → 点击 (mouse), tap → 轻点 / 点一下 (touch)
//   song titles in prose → 《{title}》; the other person → 对方 (gender-neutral)
// Style: casual 你, short and lively; full-width punctuation (，。！？：；（）“”《》——…);
// no spaces between Chinese and digits (90秒, 3位玩家); one space around Latin words
// (Deezer, WebRTC, UNSHUFFLE) and room codes; " · " separates items. Never "开房" (use 创建房间).
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
