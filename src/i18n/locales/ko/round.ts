// In-round screens: preparing (between rounds), intro (round card + 3-2-1), play
// (HUD, board, confirm dock), the exit menu. The reveal has its own namespace.
import type { Catalog } from '../../catalog'

export default {
  /** Key names as printed on Korean keyboards. */
  keys: {
    space: 'Space',
    enter: 'Enter',
    ctrl: 'Ctrl',
  },
  retry: '다시 시도',

  preparing: {
    header: '라운드 <b>{number}</b><dim> / {total}</dim>',
    allReady: '모두 준비 완료, 출발!',
    waiting: '모두 준비될 때까지 기다리는 중…',
    fallback: '라운드 준비 중…',
    steps: {
      songActive: '곡 고르는 중…',
      songDone: '곡 선택 완료',
      songDetail: '공개 전까지 극비',
      downloadActive: '조각 다운로드 중…',
      downloadDone: '조각 다운로드 완료',
      downloadError: '다운로드 실패',
      downloadErrorDetail: '소리 없이도 플레이할 수 있어요',
      /** 송송 썰다: chopping like spring onions (the Italian "affettare" joke). */
      sliceActive: '곡을 송송 써는 중…',
      sliceDone: '송송 썰기 완료',
      /** One line, ~35 characters. */
      sliceDetail: { other: '박자에 맞춘 조각 {count}개' },
      sliceDetailFree: { other: '도끼로 막 자른 조각 {count}개' },
    },
    ready: '준비 <b>{ready}</b><dim>/{total}</dim>',
    readyPlayers: '준비된 플레이어',
  },

  tips: {
    /** 꿀팁 = "honey tip", the everyday Korean word for a handy tip. */
    title: '꿀팁',
    howToHover: '블록을 클릭하면 듣고, 끌면 옮길 수 있어요.',
    howToTouch: '블록을 탭하면 듣고, 끌면 옮길 수 있어요.',
    playAll: '“전체 듣기”를 누르면 지금 순서대로 블록이 재생돼요. 매끄럽게 들리면 거의 다 온 거예요.',
    hold: '블록을 길게 누르면 그 블록부터 이어서 들을 수 있어요.',
    pairs: '나란히 놓인 두 블록의 순서가 맞으면, 제자리가 아니어도 점수를 받아요.',
    firstConfirm: '가장 먼저 확정한 사람이 모두의 카운트다운을 시작해요.',
    edges: '곡이 시작되는 부분과 잦아드는 부분을 찾아보세요. 그게 첫 블록과 마지막 블록이에요.',
    cleaver: '도끼로 자르면 단어와 음 중간에서 잘려요. 그걸 이어 주는 블록을 찾아보세요.',
    perfect: '완벽한 순서 = {points}점. 부담은 갖지 마시고요.',
  },

  intro: {
    lastRound: '마지막 라운드',
    headlineLabel: '{total}라운드 중 {number}번째 라운드',
    /** "라운드 1/3": label order, like the HUD. */
    headline: '<word>라운드</word> <n>{number}</n><total>/{total}</total>',
    rulesLabel: '라운드 규칙',
    snippets: { other: '조각 <b>{count}</b>개' },
    seconds: '<b>{seconds}</b>초',
    spectator: '이번 라운드는 구경해요. 다음 라운드부터 참여!',
    howToHover: '블록을 클릭해서 듣고, 제자리로 끌어다 놓으세요.',
    howToTouch: '블록을 탭해서 듣고, 제자리로 끌어다 놓으세요.',
    ready: '준비됐나요?',
    readyLabel: '준비',
    countdownLabel: '{seconds}초 후 시작',
  },

  go: '시작!',
  syncing: '라운드 동기화 중…',

  hud: {
    round: '라운드',
    snippets: '조각',
    points: '점수',
    /** Inside the timer ring: normal / after the first confirm (막판 = the final stretch). */
    time: '시간',
    finalTime: '막판',
    lastSeconds: '종료 임박',
    confirmed: '확정 {done}/{total}',
    rank: '{rank}위',
    players: '이번 라운드 플레이어',
  },

  players: {
    me: '{name} (나)',
    more: { other: '외 {count}명' },
  },

  banner: {
    /** Stands in for {name}; confirmedBy adds 님 after it. */
    someone: '플레이어',
    mine: '가장 먼저 확정했어요!',
    confirmedBy: '<name>{name}</name> 님이 확정했어요!',
    othersLeft: '다른 플레이어는 <n>{seconds}</n>초 남았어요',
    youLeft: { other: '<n>{count}</n>초 남았어요' },
    finalTimer: '카운트다운 <n>{seconds}</n>초',
  },

  dock: {
    confirm: '확정',
    unchanged: '아무것도 옮기지 않았어요',
    armTap: '한 번 더 탭하면 확정돼요',
    armClick: '한 번 더 클릭하면 확정돼요',
    armKey: '{mod} + {enter} 키를 한 번 더 누르세요',
    confirmed: '확정 완료',
    queued: '다시 연결되면 바로 보낼게요',
    waitingFor: '{names} 님을 기다리는 중',
    waitingForCount: { other: '{count}명을 기다리는 중' },
    allConfirmed: '모두 확정했어요!',
    stillPlaying: '아직 플레이 중',
    timeUp: '시간 종료!',
    timedOut: '마지막에 둔 순서로 채점해요',
    computing: '결과 계산 중…',
    spectator: '관전자',
    spectatorBody: '다음 라운드부터 참여해요',
    audioFailed: '오디오 로딩 실패',
    audioFailedBody: '다시 시도하거나 그냥 플레이하세요',
    retryAudio: '오디오 다시 받기',
    hints: {
      playAll: '<kbd>{space}</kbd> 전체 듣기',
      confirm: '<kbd>{mod}</kbd> + <kbd>{enter}</kbd> <action>확정</action>',
      pointer: '블록 클릭: 듣기 · 길게 누르기: 그 블록부터 듣기 · 끌기: 옮기기',
      pointerLocked: '블록 클릭: 듣기 · 길게 누르기: 그 블록부터 듣기',
    },
  },

  spectator: {
    title: '관전 중',
    bodyHover: '다음 라운드부터 참여해요. 그동안 블록을 클릭해서 조각을 들어 보세요.',
    bodyTouch: '다음 라운드부터 참여해요. 그동안 블록을 탭해서 조각을 들어 보세요.',
  },

  menu: {
    endButton: '게임 끝내기',
    leaveButton: '게임 나가기',
    hostTitle: '게임을 끝낼까요?',
    guestTitle: '게임에서 나갈까요?',
    hostBody: '호스트가 끝내면 모두의 게임이 멈춰요.',
    hostAloneBody: '게임이 여기서 끝나요.',
    guestBody: '게임은 나 없이 계속돼요. 진행 중이라면 다시 들어와서 내 점수 그대로 이어 갈 수 있어요.',
    keepPlaying: '계속하기',
    stay: '머무르기',
    leave: '게임 나가기',
    toLobby: '로비로 돌아가기',
    toLobbyBody: '점수는 초기화되고 멤버는 그대로예요. 플레이리스트를 바꿔 다시 시작해요.',
    toLobbyAloneBody: '점수가 초기화돼요. 플레이리스트를 바꿔 다시 시작해요.',
    close: '방 닫기',
    closeBodyOne: '다른 플레이어의 연결이 끊겨요.',
    closeBodyMany: '다른 플레이어 모두의 연결이 끊겨요.',
    closeAloneBody: '홈으로 돌아가요.',
    rejoinCode: '재입장 코드',
  },
} satisfies Catalog['round']
