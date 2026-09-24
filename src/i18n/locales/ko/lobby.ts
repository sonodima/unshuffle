// Lobby: room code card, players, playlist picker, rules, start bar, leave dialog.
//
// Inline tags: <num>…</num> wraps a number shown in monospace digits (keep it
// around the number only). Counters (명, 곡, 개, 초) follow the number directly.
import type { Catalog } from '../../catalog'

export default {
  /** Host's start button (~16 characters). */
  start: '게임 시작',
  players: { other: '플레이어 <num>{count}</num>명' },
  tracks: { other: '<num>{count}</num>곡' },
  cancel: '취소',

  header: {
    badge: '로비',
  },

  leave: {
    closeRoom: '방 닫기',
    exit: '나가기',
    exitRoom: '방 나가기',
    hostTitle: '방을 닫을까요?',
    guestTitle: '방에서 나갈까요?',
    hostBody: '호스트가 나가면 방이 닫히고 다른 플레이어 모두의 연결이 끊겨요.',
    hostAloneBody: '방이 닫혀요.',
    /** Worded so that no particle follows {code}. */
    guestBody: '게임이 시작되기 전이라면 코드 {code}만 있으면 다시 들어올 수 있어요.',
    stay: '머무르기',
  },

  /** Phone tabs (~10 characters each). */
  tabs: {
    label: '로비 섹션',
    players: '플레이어',
    playlist: '플레이리스트',
    rules: '규칙',
    /** Screen-reader name of the playlist tab while the host still has to pick one. {tab} = the tab label. */
    tabToPick: '{tab}, 선택 필요',
    /** Screen-reader name of the players tab. {tab} = the tab label, {count} = players in the room. */
    tabPlayers: { other: '{tab}, {count}명' },
  },

  invite: {
    linkCopied: '방 링크를 복사했어요!',
    copyFailed: '복사하지 못했어요. QR 버튼을 눌러 링크를 확인하세요.',
    /** Casual, friend-to-friend; the join link follows. */
    shareText: 'UNSHUFFLE 한 판 붙자! {code} 방으로 들어와:',
  },

  code: {
    title: '방 코드',
    clickToCopy: '클릭해서 복사',
    tapToCopy: '탭해서 복사',
    copied: '코드를 복사했어요!',
    copyFailed: '복사하지 못했어요',
    copyLabel: '방 코드 {code}. 코드 복사',
    copyLink: '링크 복사',
    linkCopied: '복사 완료!',
    share: '공유',
    showQr: 'QR 코드 보기',
    enlargeQr: 'QR 코드 크게 보기',
    phoneTitle: '폰으로 입장',
    phoneBody: 'QR 코드를 스캔하거나 링크를 열면 계정 없이 바로 들어와요.',
  },

  qr: {
    title: '친구 초대',
    description: '폰 카메라로 QR 코드를 스캔하거나 링크를 공유하세요.',
    code: '코드',
    copy: '복사',
    copied: '복사됨',
    copyFailed: '복사하지 못했어요. 링크를 선택해서 직접 복사해 주세요.',
    shareLink: '링크 공유',
    imageLabel: '방 입장용 QR 코드',
  },

  roster: {
    title: '플레이어',
    online: { other: '<num>{count}</num>명 접속 중' },
    capacity: { other: '{max}명 중 {count}명' },
    listLabel: '플레이어 목록',
    you: '나',
    host: '호스트',
    reconnecting: '다시 연결 중…',
    editProfile: '프로필 수정',
    kickLabel: '{name} 내보내기',
    freeSeats: { other: '빈자리 <num>{count}</num>개' },
    invite: '초대',
    kick: {
      title: '{name} 님을 내보낼까요?',
      titleFallback: '플레이어를 내보낼까요?',
      body: '바로 방에서 나가게 되고, 다시 들어올 수 없어요.',
      confirm: '내보내기',
    },
  },

  profile: {
    title: '내 프로필',
    name: '닉네임',
    namePlaceholder: '뭐라고 불러 드릴까요?',
    nameRequired: '한 글자 이상 입력해 주세요.',
    save: '저장',
  },

  picker: {
    title: '플레이리스트 선택',
    source: 'Deezer 음원 · 30초 미리 듣기',
    searchLabel: '플레이리스트 검색',
    /** Must fit a 300px-wide field on phones. */
    searchPlaceholder: '검색하거나 Deezer 링크 붙여넣기',
    searching: '검색 중',
    clear: '검색어 지우기',
    featured: '추천 플레이리스트',
    fromLink: '붙여넣은 링크',
    resultsFor: '“{query}” 검색 결과',
    count: { other: '{count}개' },
    loading: '불러오는 중…',
    invalidLink: '잘못된 링크',
    pickedFromLink: '링크로 고른 플레이리스트',
    retry: '다시 시도',
    pick: '선택',
    tracksTooShort: { other: '<num>{count}</num>곡 · 너무 짧음' },
    tracksBy: { other: '<num>{count}</num>곡 · {creator}' },
    chips: '카테고리',
    chipsPrev: '이전 카테고리',
    chipsNext: '다음 카테고리',
    shortLink: {
      title: '플레이리스트 전체 링크를 붙여넣어 주세요',
      body: '단축 링크(link.deezer.com)는 여기서 열 수 없어요. 브라우저나 Deezer 앱에서 연 다음 전체 주소를 복사해 주세요: deezer.com/…/playlist/123456.',
    },
    foreignLink: {
      title: '플레이리스트 링크가 아니에요',
      body: 'Deezer 공개 플레이리스트 링크를 붙여넣어 주세요(예: deezer.com/playlist/123456). 이름, 아티스트, 장르로 검색해도 돼요.',
    },
    notFound: {
      title: '플레이리스트를 찾을 수 없어요',
      body: '링크를 확인해 주세요(비공개 플레이리스트는 열 수 없어요).',
    },
    offline: 'Deezer 응답 없음',
    empty: {
      title: '플레이리스트 없음',
      titleFor: '“{query}” 검색 결과가 없어요',
      body: '아티스트나 장르, 90년대 같은 시대로 검색하거나 Deezer 플레이리스트 링크를 붙여넣어 보세요.',
    },
  },

  hero: {
    label: '선택한 플레이리스트',
    eyebrow: '플레이리스트',
    none: '플레이리스트 없음',
    incoming: '플레이리스트 준비 중',
    by: '제작: {creator}',
    hostEmpty: '플레이리스트를 검색하거나, 카테고리를 누르거나, Deezer 링크를 붙여넣으세요.',
    guestEmpty: '호스트가 고르면 여기에 나타나요. 귀를 쫑긋 세우고 기다려요!',
    change: '변경',
  },

  rules: {
    title: '규칙',
    duration: '최대 <num>~{minutes}분</num>',
    hostDecides: '호스트가 정해요',
    /** 4 options share a row. */
    seconds: '{seconds}초',
    snippetsOption: '{snippets} · {difficulty}',
    rounds: { title: '라운드', hint: '라운드마다 한 곡' },
    snippets: { title: '조각', hint: '많을수록 어려워요' },
    roundTime: { title: '라운드 시간', hint: '순서를 맞추는 시간' },
    /** The final timer is called 카운트다운 everywhere. */
    finalTimer: { title: '카운트다운', hint: '첫 확정 후 시작' },
  },

  howTo: {
    title: '게임 방법',
    perfect: '완벽한 순서 = <num>{points}</num>점',
    listen: {
      title: '듣기',
      bodyClick: {
        other: '곡마다 {count}개 조각으로 잘려 뒤섞여 있어요. 블록을 클릭하면 들을 수 있어요.',
      },
      bodyTap: {
        other: '곡마다 {count}개 조각으로 잘려 뒤섞여 있어요. 블록을 탭하면 들을 수 있어요.',
      },
    },
    reorder: {
      title: '맞추기',
      body: '곡이 제대로 들릴 때까지 블록을 끌어 옮겨요. ▶ 버튼으로 전체를 이어서 들어 보세요.',
    },
    confirm: {
      title: '확정',
      body: {
        other: '가장 먼저 확정한 사람이 카운트다운을 시작해요. 나머지는 {count}초 안에 끝내야 해요!',
      },
    },
  },

  bar: {
    // Rules summary, joined with " · ": "5라운드 · 조각 8개 (보통) · 90초".
    rounds: { other: '<num>{count}</num>라운드' },
    snippets: { other: '조각 <num>{count}</num>개' },
    snippetsLevel: { other: '조각 <num>{count}</num>개 ({difficulty})' },
    roundTime: '<num>{seconds}초</num>',
    /** Animated dots follow: no final punctuation. */
    waitingStart: '호스트가 시작하길 기다리는 중',
    waitingPlaylist: '호스트가 플레이리스트를 고르는 중',
    pickPlaylist: '플레이리스트를 골라 시작하세요',
    solo: '혼자서도 할 수 있어요',
    noPlaylist: '플레이리스트 없음',
    playRounds: { other: '{count}라운드로 하기' },
    shortfall: {
      other: '플레이리스트가 너무 짧아요. <num>{count}</num>곡이 있는데 <num>{need}</num>곡이 필요해요.',
    },
    shortfallMin: {
      other: '플레이리스트가 너무 짧아요. <num>{count}</num>곡뿐인데 최소 <num>{min}</num>곡이 필요해요.',
    },
  },

  /**
   * Category chips: Korean hits, idols, K-hip hop / ballad / indie / rock, OST,
   * trot, decades of 가요, then a few international ones. Every query was checked
   * on api.deezer.com/search/playlist (top results are real playlists, mostly
   * ≥ 30 tracks; the K-pop ones return Deezer's own K-Pop editor playlists).
   */
  chips: [
    { label: '요즘 인기곡', query: 'k-pop hits', emoji: '🔥' },
    { label: '걸그룹', query: 'kpop girl groups', emoji: '💖' },
    { label: '보이그룹', query: 'kpop boy groups', emoji: '🕺' },
    { label: 'K-힙합', query: 'korean hip hop', emoji: '🎤' },
    { label: '발라드', query: 'korean ballad', emoji: '💔' },
    { label: 'K-R&B', query: 'korean r&b', emoji: '🌃' },
    { label: 'K-인디', query: 'korean indie', emoji: '🌙' },
    { label: 'K-록', query: 'korean rock', emoji: '🎸' },
    { label: '드라마 OST', query: 'k-drama ost', emoji: '🎬' },
    { label: '트로트', query: '트로트', emoji: '🎺' },
    { label: '90년대 가요', query: '90년대 가요', emoji: '📼' },
    { label: '2000년대 가요', query: '2000s kpop', emoji: '💿' },
    { label: '2010년대 K-POP', query: '2010s kpop', emoji: '📱' },
    { label: '팝송', query: 'pop hits', emoji: '🌍' },
    { label: 'J-POP', query: 'j-pop', emoji: '🍙' },
    { label: 'EDM', query: 'dance hits', emoji: '🎧' },
    { label: '디즈니', query: '디즈니', emoji: '🏰' },
  ],

  /**
   * Featured shelf. Deezer's "Top South Korea" chart (1362510315) is left out on
   * purpose: Deezer has almost no users in Korea, so that chart is noise (a German
   * New Year song at #1, random Western oldies). The K-Pop editor's playlists are
   * what Korean players expect; two worldwide ones close the shelf.
   * All public, ≥ 60 tracks, most of the first 25 tracks with a preview.
   */
  featured: [
    4096400722, // Top K-Pop — Deezer K-Pop Editor
    10730307122, // Perfect All-Kill (퍼펙트 올킬) — Deezer K-Pop Editor
    13650855301, // 20s K-Pop — Deezer K-Pop Editor
    3155776842, // Top Worldwide — Deezer Charts
    12244134951, // New K-Pop — Deezer K-Pop Editor
    873660353, // K-Pop Essentials — Deezer K-Pop Editor
    7482846624, // k-pop party ! — Deezer K-Pop Editor
    10909862902, // K-araoke! — Deezer K-Pop Editor
    11012482922, // K-Pop 4th Generation — Deezer K-Pop Editor
    11012274682, // K-Pop 3rd Generation — Deezer K-Pop Editor
    10738561582, // K-Pop 2nd Generation — Deezer K-Pop Editor
    248297032, // 00s Hits — Deezer Pop Editor
  ],
} satisfies Catalog['lobby']
