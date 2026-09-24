// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// {rank} / {pos} are bare numbers (ui.ordinal = '{n}'): 위 / 번 are written here.
import type { Catalog } from '../../catalog'

export default {
  header: {
    eyebrow: '결과',
    /** Page title "라운드 3 / 5" (label order, like the HUD). */
    round: '라운드 {round}<dim> / {total}</dim>',
  },

  song: {
    region: '이번 곡',
    /** Small label above the song title. */
    eyebrow: '이번 곡은',
    coverAlt: '{name} 커버',
    playing: '재생 중',
    paused: '일시정지',
    stopped: '정지',
    unlock: {
      hover: '클릭해서 듣기',
      touch: '탭해서 듣기',
    },
    pause: '곡 일시정지',
    resume: '곡 이어 듣기',
    replay: '곡 다시 듣기',
    /** <wide> is hidden on narrow phones: "듣기" must work alone. */
    deezer: '<wide>Deezer에서 </wide>듣기',
    deezerAria: 'Deezer에서 {title} 듣기 (새 탭에서 열림)',
    snippets: { other: '조각 {count}개' },
    bpm: '{bpm} BPM',
  },

  board: {
    region: '내 순서',
    titleMine: '내 순서',
    titleCorrect: '정답 순서',
    toggle: {
      label: '표시할 순서',
      mine: '내 순서',
      /** Phones: "내 답" pairs with "정답". */
      mineShort: '내 답',
      correct: '정답 순서',
      correctShort: '정답',
    },
    tallyCorrect: { other: '제자리 {count}개' },
    tallyWrong: { other: '틀린 자리 {count}개' },
    /**
     * Tiny chips (~6 characters). `was` ("3번에 둠" = you had put it at #3) on the
     * right order; `goes` on the player's order.
     */
    was: '{pos}번에 둠',
    goes: '→ {pos}번',
    /** One line (~60 characters on phones). */
    hint: {
      intro: {
        hover: '조각을 클릭하면 그 부분부터 곡을 들을 수 있어요',
        touch: '조각을 탭하면 그 부분부터 곡을 들을 수 있어요',
      },
      mine: {
        hover: '내가 놓은 순서예요 · 클릭해서 듣기',
        touch: '내가 놓은 순서예요 · 탭해서 듣기',
      },
      perfect: {
        hover: '전부 제자리! · 클릭해서 다시 듣기',
        touch: '전부 제자리! · 탭해서 다시 듣기',
      },
      none: {
        hover: '맞힌 자리가 없어요 · 클릭해서 다시 듣기',
        touch: '맞힌 자리가 없어요 · 탭해서 다시 듣기',
      },
      partial: {
        hover: {
          other: '{n}개 중 {count}개를 맞혔어요 · 클릭해서 다시 듣기',
        },
        touch: {
          other: '{n}개 중 {count}개를 맞혔어요 · 탭해서 다시 듣기',
        },
      },
    },
  },

  spectator: {
    title: '관전 중',
    body: '이번 라운드는 구경만 해요. 다음 라운드부터 참여해요!',
  },
  missing: {
    title: '응답 없음',
    body: '이번에는 내 순서가 전달되지 않았어요.',
  },

  score: {
    region: '내 점수',
    eyebrow: '라운드 점수',
    timedOut: '시간 초과',
    /** "55.8초 만에 확정"; below 400 px only "55.8초" shows. The pill spaces the two tags itself. */
    confirmedIn: '<num>{time}</num> <wide>만에 확정</wide>',
    barAria: { other: '{max}점 중 {points}점' },
    correct: '제자리',
    pairs: { other: '이어진 쌍' },
    total: '게임 총점',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}위',
    stamp: '퍼펙트!',
  },

  verdict: {
    perfect: '완벽한 순서!',
    almost: '거의 완벽해요!',
    good: '음감 좋네요!',
    close: '거의 다 왔어요…',
    more: '한 번 더 들어 봐요',
    none: '제자리에 놓인 조각이 없어요',
  },

  rankUp: { other: '순위 {count}계단 상승' },
  rankDown: { other: '순위 {count}계단 하락' },

  seconds: '{seconds}초',

  announce: {
    result: {
      other: '{points}점: {n}개 중 {correct}개 제자리, {pairs}.',
    },
    pairs: { other: '이어진 쌍 {count}개' },
    perfect: '완벽한 순서! {result}',
    timedOut: '{result} 시간 초과.',
  },

  lead: {
    title: '순위',
    after: '{round}라운드 후',
    /** Tiny badge (2–4 letters). */
    you: '나',
    top: '라운드 최고 점수',
    spectator: '관전자',
    spectatorFrom: '관전자 · {round}라운드부터 참여',
    noAnswer: '응답 없음',
    stats: {
      average: '평균',
      perfect: '퍼펙트',
      fastest: '가장 빠름',
    },
    row: {
      played: {
        other: '{rank}위, {name}: 이번 라운드 {points}점, {n}개 중 {correct}개 제자리, 총 {total}점',
      },
      spectator: '{rank}위, {name}: 관전자, 총 {total}점',
      noAnswer: '{rank}위, {name}: 응답 없음, 총 {total}점',
      me: '{name} (나)',
    },
  },

  footer: {
    next: '다음 라운드',
    final: '최종 순위',
    nextIn: { other: '<num>{count}</num>초 후 다음 라운드' },
    finalIn: { other: '<num>{count}</num>초 후 최종 순위' },
    waiting: '호스트를 기다리는 중…',
    waitingIn: { other: '호스트를 기다리는 중…<num>({count}초)</num>' },
  },
} satisfies Catalog['reveal']
