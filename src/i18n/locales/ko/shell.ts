// App shell: document titles, connection banner and dialogs, session resume,
// crash screen, toasts, sound controls, emoji reactions.
import type { Catalog } from '../../catalog'

export default {
  action: {
    home: '홈으로',
    retry: '다시 시도',
    ok: '확인',
    cancel: '취소',
  },

  /** {brand} is UNSHUFFLE; {code} a room code. */
  title: {
    lobby: '{brand} · 로비',
    lobbyRoom: '{brand} · 로비 {code}',
    round: '{brand} · 라운드',
    roundOf: '{brand} · 라운드 {round}/{rounds}',
    roundReveal: '{brand} · 라운드 {round}/{rounds} · 결과',
    roundPreparing: '{brand} · 라운드 {round}/{rounds} · 준비 중',
    final: '{brand} · 최종 순위',
    lost: '{brand} · 연결 끊김',
  },

  /** Status pill (phones: titles ≤ 24 characters, details ≤ 40). */
  banner: {
    dismiss: '알림 숨기기',
    elapsed: '{seconds}초',
    hostReconnecting: '서버 끊김, 다시 연결 중…',
    hostReconnectingDetail: '게임은 계속 진행돼요',
    connecting: '다시 연결 중…',
    lost: '연결 끊김',
    lostDetail: '다시 연결하는 중…',
    lostDetailLong: '재접속 중… 자동으로 돌아가요.',
    hostSilent: '호스트 응답 없음',
    hostSilentDetail: '돌아오길 기다리는 중…',
    leave: '나가기',
    signalingTitle: '새 입장 일시 중지',
    signalingDetail: '연결 서버가 끊겼어요. 이미 들어온 사람은 계속 플레이해요.',
    warning: '주의',
  },

  dialogRoom: '방 <b>{code}</b>',

  lost: {
    title: '연결 끊김',
    hostClosedTitle: '호스트가 방을 닫았어요',
    hostLeftTitle: '호스트가 게임을 나갔어요',
    hostGoneDescription: '이 방은 더 이상 이용할 수 없어요.',
    hostGoneHintFinal: '게임은 이미 끝났어요. 한 판 더 하려면 새 방을 만들어 주세요.',
    noRetryDescription: '방과의 연결이 끊겼어요.',
    noRetryHint: '연결을 확인한 다음 홈에서 다시 시도해 주세요.',
    descriptionLobby: '호스트가 응답하지 않아요. 방을 닫았을 수도 있어요.',
    description: '호스트가 한동안 응답이 없어요.',
    hintLobby: '잠시 후 다시 시도하거나, 홈으로 돌아가 직접 방을 만들어 보세요.',
    hintGame: '호스트가 아직 게임 중이라면, 다시 들어가서 내 점수 그대로 이어서 할 수 있어요.',
    hintFinal: '호스트가 아직 접속해 있다면, 다시 들어가서 한 판 더 할 수 있어요.',
  },

  exit: {
    kicked: {
      title: '방에서 내보내졌어요',
      hint: '언제든 직접 방을 만들거나 다른 코드로 들어갈 수 있어요.',
    },
    closed: {
      title: '방이 닫혔어요',
      hint: '모두의 게임이 끝났어요. 새 방을 만들거나 다른 코드로 들어가 보세요.',
    },
    duplicate: {
      title: '이미 게임 중',
      hint: '여기서 플레이하려면 다른 탭을 닫아 주세요.',
    },
    gone: {
      title: '사라진 방이에요',
      description: '호스트가 방을 닫았거나 연결이 끊겼어요.',
      hint: '홈에서 새 방을 만들거나 다른 코드로 들어가 보세요.',
    },
    failed: {
      title: '다시 들어갈 수 없어요',
      hint: '연결을 확인한 다음, 홈에서 코드로 다시 시도해 주세요.',
    },
    generic: {
      title: '방에서 나왔어요',
      hint: '홈에서 같은 코드로 다시 들어갈 수 있어요.',
    },
  },

  resume: {
    title: '다시 연결 중',
    host: '내 방을 다시 여는 중',
    hostRoom: '내 방 <b>{code}</b> 다시 여는 중',
    client: '방에 다시 들어가는 중',
    clientRoom: '<b>{code}</b> 방에 다시 들어가는 중',
    /** {hint} is the exit.gone hint. */
    goneRoom: '<b>{code}</b> 방이 사라졌어요. {hint}',
    failedRoom:
      '<b>{code}</b> 방으로 다시 데려가지 못했어요. 게임이 아직 진행 중이라면 홈에서 코드로 다시 들어가세요.',
    failed: '게임이 아직 진행 중이라면 홈에서 코드로 다시 들어가세요.',
  },

  crash: {
    eyebrow: '예상치 못한 오류',
    title: '문제가 생겼어요',
    /** 음반이 튀다: the record skipped. */
    body: '음반이 튀었어요. 페이지를 새로고침해 주세요. 방에 있었다면 다시 데려다 드릴게요.',
    reload: '새로고침',
    showDetails: '기술 정보',
    hideDetails: '기술 정보 숨기기',
  },

  /** {name} is a nickname; 님 follows it, so the fallback is a noun that takes 님. */
  toast: {
    someone: '플레이어',
    joined: '{name} 님이 들어왔어요',
    roomCount: { other: '이제 {count}명이에요' },
    left: '{name} 님이 나갔어요',
    submitted: '{name} 님이 확정했어요',
    lastSeconds: { other: '모두 마지막 {count}초!' },
    lastSecondsSoon: '모두 마지막 스퍼트!',
    kicked: '호스트가 {name} 님을 내보냈어요',
    kickedSomeone: '호스트가 플레이어를 내보냈어요',
  },

  audioCue: {
    tapToListen: '탭해서 곡 듣기',
    clickToListen: '클릭해서 곡 듣기',
    tapToEnable: '탭해서 소리 켜기',
    clickToEnable: '클릭해서 소리 켜기',
    tapBody: '화면을 탭하기 전까지 브라우저가 소리를 막아 두고 있어요.',
    clickBody: '페이지를 클릭하기 전까지 브라우저가 소리를 막아 두고 있어요.',
  },

  sound: {
    button: '소리',
    buttonMuted: '소리 꺼짐',
    buttonLocked: '브라우저가 소리를 막았어요. 탭해서 켜기',
    panel: '소리 설정',
    heading: '소리',
    muteShortcut: '음소거',
    mute: '소리 끄기',
    unmute: '소리 켜기',
    volume: '볼륨',
    sfx: '효과음',
    sfxDetail: '클릭, 타이머, 리액션',
    unlock: '소리 켜기',
    unlockTitle: '페이지를 누르기 전까지 브라우저가 소리를 막아요',
  },

  reactions: {
    group: '리액션',
    button: '리액션: {name}',
    you: '나',
    names: {
      fire: '불꽃',
      laugh: '웃음',
      shock: '충격',
      clap: '박수',
      dead: '빵 터짐',
      party: '파티',
      mindBlown: '멘붕',
      cool: '완전 멋짐',
      rematch: '한 판 더',
    },
  },

  leaveWarning: '지금 나가면 모두의 게임이 끝나요',
} satisfies Catalog['shell']
