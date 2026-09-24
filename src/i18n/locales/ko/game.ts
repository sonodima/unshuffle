// Messages produced away from the UI (host, store, network, Deezer) and shown in
// the viewer's language, plus shared game vocabulary.
import type { Catalog } from '../../catalog'

export default {
  /**
   * Host preparation steps: the big headline of the preparing screen. It sits right
   * above the checklist (round.preparing.steps), so don't repeat the step labels.
   */
  prep: {
    picking: '플레이리스트 섞는 중…',
    slicing: '히트곡을 조각내는 중…',
    /** Same text as round.preparing.waiting: either one is the headline, never both. */
    syncing: '모두 준비될 때까지 기다리는 중…',
  },
  host: {
    noPlaylist: '시작하기 전에 플레이리스트를 골라 주세요.',
    alreadyStarted: '게임이 이미 시작됐어요.',
    closed: '방이 닫혔어요.',
    playlistFailed: 'Deezer에서 플레이리스트를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
    prepareFailed: '이 플레이리스트의 곡을 준비하지 못해서 로비로 돌아갈게요. 다른 플레이리스트로 해 보세요.',
    notEnoughTracks: '이 플레이리스트에는 미리 듣기가 되는 곡이 부족해요(최소 {count}곡 필요).',
    defaultPlayer: '플레이어',
    untitledPlaylist: '플레이리스트 {id}',
  },
  store: {
    invalidCode: '방 코드가 올바르지 않아요.',
    cancelled: '취소했어요.',
    hostLost: '호스트와 연결이 끊겼어요.',
    hostGone: '호스트가 게임을 나갔어요.',
    welcomeTimeout: '호스트가 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
    joinFailed: '방에 들어갈 수 없어요. 다시 시도해 주세요.',
    createFailed: '방을 만들 수 없어요. 다시 시도해 주세요.',
    startFailed: '게임을 시작할 수 없어요.',
    rejected: '호스트가 연결을 거절했어요.',
    signalingLost: '서버 연결이 끊겼어요. 새 플레이어가 들어올 수 없어요.',
    actionFailed: '요청을 처리하지 못했어요.',
    audioUnavailable: '이번 라운드 오디오를 불러오지 못했어요. 그래도 플레이할 수 있어요.',
    audioUnavailableTitled: '“{title}” 오디오를 재생할 수 없어요.',
  },
  net: {
    network: '네트워크에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.',
    server: '연결 서버가 응답하지 않아요. 몇 초 후 다시 시도해 주세요.',
    signaling: '연결 서버에 접속할 수 없어요. 잠시 후 다시 시도하거나 네트워크를 바꿔 보세요(Wi‑Fi 또는 모바일 데이터).',
    createTimeout: '연결 서버가 응답하지 않아요. 몇 초 후 다시 시도해 주세요.',
    joinTimeout: '호스트에 연결할 수 없어요. 다시 시도해 보고, 안 되면 다른 네트워크(Wi‑Fi 또는 모바일 데이터)로 바꿔 보세요.',
    hostNoAnswer: '호스트가 응답하지 않아요. 코드를 확인하거나 잠시 후 다시 시도해 주세요.',
    roomNotFound: '방을 찾을 수 없어요. 코드를 확인해 주세요.',
    invalidCode: '방 코드가 올바르지 않아요. 영문 5글자예요(예: KXQPM).',
    unsupported: '이 브라우저는 P2P 연결(WebRTC)을 지원하지 않아요. 최신 버전의 Chrome, Safari, Firefox로 접속해 주세요.',
    loadFailed: '네트워크 모듈을 불러오지 못했어요. 페이지를 새로고침해 주세요.',
    unknown: '예상치 못한 연결 오류가 생겼어요. 다시 시도해 주세요.',
    short: {
      roomNotFound: '방을 찾을 수 없어요. 코드를 확인해 주세요.',
      network: '네트워크에 문제가 있어요. 연결을 확인하고 다시 시도해 주세요.',
      server: '연결 서버에 접속할 수 없어요. 잠시 후 다시 시도해 주세요.',
      timeout: '연결 서버가 응답하지 않아요. 다시 시도해 주세요.',
      unsupported: '이 브라우저는 P2P 연결(WebRTC)을 지원하지 않아요.',
    },
  },
  reject: {
    full: '방이 꽉 찼어요.',
    version: '호스트와 게임 버전이 달라요. 페이지를 새로고침해 주세요.',
    kicked: '호스트가 방에서 내보냈어요.',
    closed: '호스트가 방을 닫았어요.',
    duplicate: '다른 탭이나 기기에서 이미 이 방에 들어와 있어요.',
  },
  deezer: {
    timeout: 'Deezer가 응답하지 않아요. 연결을 확인하고 다시 시도해 주세요.',
    network: 'Deezer에 연결할 수 없어요. 인터넷 연결(또는 광고 차단기)을 확인하고 다시 시도해 주세요.',
    invalid: 'Deezer에서 예상치 못한 응답이 왔어요. 잠시 후 다시 시도해 주세요.',
    quota: 'Deezer에 요청이 너무 많이 몰렸어요. 몇 초 기다렸다가 다시 시도해 주세요.',
    busy: 'Deezer가 잠시 붐비고 있어요. 조금 뒤에 다시 시도해 주세요.',
    notFound: 'Deezer에서 콘텐츠를 찾을 수 없어요.',
    forbidden: '콘텐츠에 접근할 수 없어요. 비공개이거나 현재 국가에서 이용할 수 없는 콘텐츠일 수 있어요.',
    badRequest: 'Deezer 요청이 올바르지 않아요.',
    api: 'Deezer 오류가 생겼어요. 잠시 후 다시 시도해 주세요.',
    playlistNotFound: '플레이리스트를 찾을 수 없어요. 링크를 확인해 주세요(비공개 플레이리스트는 열 수 없어요).',
    noPreview: '이 곡은 미리 듣기를 할 수 없어요.',
    trackNotFound: '이 곡은 더 이상 Deezer에서 들을 수 없어요.',
    featured: '추천 플레이리스트를 불러오지 못했어요.',
    fallback: {
      playlist: '제목 없는 플레이리스트',
      track: '제목 없음',
      artist: '알 수 없는 아티스트',
    },
  },
  /** Difficulty by snippet count (6 / 8 / 12 / 16). */
  difficulty: {
    easy: '쉬움',
    normal: '보통',
    hard: '어려움',
    insane: '지옥',
  },
  cut: {
    beat: '메스',
    free: '도끼',
  },
} satisfies Catalog['game']
