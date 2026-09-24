// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// {points} is already formatted ("18,304"). Korean has only the `other` plural form.
// {rank} is a bare number (ui.ordinal = '{n}'): the counter 위 is written here.
import type { Catalog } from '../../catalog'

export default {
  /** Badge / table header for my own row (≈ 4 characters). */
  you: '나',
  didNotPlay: '미참여',
  roundShort: 'R{round}',
  /** "총 3라운드": a bare "3라운드" would read as "round 3". */
  roundCount: { other: '총 {count}라운드' },

  topBar: {
    gameOver: '게임 종료',
  },

  hero: {
    /** Animated dots follow. */
    teaser: '우승자는 바로',
  },

  headline: {
    over: '게임 종료!',
    noPlayers: '순위에 오른 플레이어가 없어요.',
    soloZero: '빵점!',
    soloZeroSub: '다시 도전해요. 다음엔 꼭 맞출 수 있어요!',
    soloGreat: '절대음감!',
    soloGood: '잘했어요!',
    soloOk: '게임 종료!',
    /** {rounds} = headline.rounds ("3개 라운드"). */
    pointsInRounds: { other: '{rounds}에서 {points}점' },
    rounds: { other: '{count}개 라운드' },
    allZero: '모두 빵점!',
    allZeroSub: '이번엔 아무도 점수를 못 냈어요. 한 판 더 해서 설욕해요!',
    tie: '공동 우승!',
    tieWithMe: '{names} 님과 함께 우승했어요',
    tieOthers: '{names} 님이 나란히 우승했어요',
    youWin: '우승했어요!',
    youWinPoints: { other: '{points}점' },
    youWinLead: { other: '{points}점 · {name} 님보다 +{gap}점' },
    youWinFaster: '{name} 님과 동점이지만 더 빨랐어요',
    theyWin: '{name} 님 우승!',
    sameScore: '{name} 님과 동점! 먼저 확정한 쪽이 이겨요',
    myRank: { other: '{points}점으로 {total}명 중 {rank}위예요' },
  },

  dock: {
    label: '게임 메뉴',
    leave: '나가기',
    playAgain: '다시 하기',
    rematch: '한 판 더!',
    rematchSent: '요청 보냄',
    waiting: '호스트가 다시 시작하길 기다리는 중…',
    rematchNamed: { other: '{names} 님이 한 판 더 원해요!' },
    rematchMany: { other: '{count}명이 한 판 더 원해요!' },
  },

  leaveDialog: {
    title: '방을 닫을까요?',
    body: {
      other: '다른 플레이어 {count}명의 연결이 끊기고, 이 게임은 다시 할 수 없어요.',
    },
    cancel: '취소',
    confirm: '방 닫기',
  },

  podium: {
    label: '시상대',
    slot: { other: '{rank}위: {name}, {points}점' },
    slotMe: { other: '{rank}위: {name} (나), {points}점' },
    cheer: '{name} 님 축하하기',
  },

  standings: {
    title: '순위',
    players: { other: '플레이어 {count}명' },
    position: '{rank}위',
    offline: '오프라인',
    perfectRounds: '퍼펙트 라운드',
    accuracy: '평균 제자리 조각 수',
    avgTime: '평균 확정 시간',
    lateFrom: '{round}라운드부터',
    /** Unit under each total. */
    points: { other: '점' },
  },

  awards: {
    title: '어워드',
    aside: '특별상',
    nameAndOthers: { other: '{name} 님 외 {count}명' },
    goldenEar: {
      title: '황금 귀',
      description: '퍼펙트 라운드 최다',
      value: { other: '퍼펙트 {count}회' },
    },
    lightning: {
      title: '번개손',
      description: '점수 낸 라운드에서 가장 빨리 확정',
      value: '평균 {time}',
    },
    sniper: {
      title: '명사수',
      description: '제자리 조각 최다',
      value: '평균 {accuracy}',
    },
    /** Tongue-in-cheek award for running out of time: 벼락치기 = last-minute cramming. */
    lastSecond: {
      title: '벼락치기',
      description: '시간 초과 라운드 최다',
      value: { other: '시간 초과 {count}회' },
    },
  },

  rounds: {
    title: '라운드별 기록',
    scrollLabel: '라운드별 점수, 옆으로 밀어서 모든 플레이어 보기',
    caption: '플레이어별 라운드 점수',
    song: '곡',
    fallbackTitle: '{round}라운드',
    best: '라운드 최고 점수',
    /** Narrow cell (≈ 70px). */
    perfect: '퍼펙트',
    timedOut: '시간 초과',
    total: '합계',
  },

  songs: {
    title: '이번 게임의 곡',
    aside: '여기서 또는 Deezer에서 다시 들어 보세요',
    play: '{round}라운드: {artist}의 {title} 미리 듣기',
    stop: '{round}라운드: {artist}의 {title} 미리 듣기 멈추기',
    open: 'Deezer에서 {title} 열기 (새 탭)',
    openTooltip: 'Deezer에서 열기',
    unavailable: '미리 듣기 없음',
  },

  units: {
    /** Korean writes the unit right after the number ("38.3초"). */
    seconds: '{value}초',
  },
} satisfies Catalog['final']
