// 한국어 (Korean) catalog. Mirrors the Italian source (../it) exactly.
//
// Style: 해요체 for sentences, short noun phrases for buttons ("방 만들기", "확정").
// Only the `other` plural form exists. No particle (은/는, 이/가, 을/를, 와/과, 로/으로)
// ever follows a {param}: reword instead ("{name} 님이…", "코드 {code}만 있으면…").
// Player names take " 님" (with a space); name fallbacks are '플레이어' so that
// "플레이어 님이…" still reads well.
//
// Glossary (keep consistent):
//   round            라운드: label "라운드 3", "라운드 1/3"; in sentences "3라운드부터";
//                    as a count "총 5라운드" / "3개 라운드" (a bare "3라운드" = round 3)
//   snippet          조각 (산산조각 in the tagline plays on it); block (UI) 블록
//   host / player    호스트 / 플레이어; spectator 관전자, "관전 중"
//   lobby / room     로비 / 방; room code 방 코드; kick 내보내기
//   confirm          확정 (button "확정", "{name} 님이 확정했어요")
//   final timer      카운트다운 (rules row, banner, tips); timer-ring caption 막판;
//                    badge "종료 임박"; toast "마지막 {count}초"
//   playlist / song  플레이리스트 / 곡; preview 미리 듣기; featured "추천 플레이리스트"
//   reveal           결과; leaderboard 순위; final standings 최종 순위
//   right place      제자리; wrong place 틀린 자리; pairs in sequence 이어진 쌍
//   perfect          퍼펙트 (stamp, badges, awards); "완벽한 순서" in sentences
//   points           {points}점; rank {rank}위; position {pos}번째 (chips: {pos}번)
//   rematch          "한 판 더" (request: "… 님이 한 판 더 하재요!"); host's play again "다시 하기"
//   nickname         닉네임; tap / click 탭 / 클릭; me 나
//   difficulty       쉬움 / 보통 / 어려움 / 지옥
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
