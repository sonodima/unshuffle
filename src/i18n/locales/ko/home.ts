// Home screen: hero, profile card, "방 만들기" / join box, the decorative round
// demo and the "게임 방법" dialog.
import type { Catalog } from '../../catalog'

export default {
  help: '게임 방법',
  hero: {
    /** Small line above the logo (~24 characters). */
    eyebrow: '음악 파티 게임',
    /** 산산조각 echoes 조각 (our word for a snippet). */
    tagline: '히트곡이 산산조각 났어요. <b>다시 맞춰 보세요.</b>',
  },
  cardLabel: '플레이',
  demoLabel: '라운드 미리 보기',
  offline: '오프라인이에요. 플레이하려면 인터넷 연결이 필요해요.',
  dismissNotice: '알림 닫기',
  or: '또는',
  cancel: '취소',
  create: {
    /** Big button (~16 characters). */
    button: '방 만들기',
    buttonInvited: '내 방 만들기',
    pending: '방 여는 중…',
    /** One line on phones. */
    solo: '<b>혼자 하기:</b> 방을 만들고 바로 시작하세요.',
  },
  join: {
    divider: '코드가 있나요?',
    invited: '초대받았어요!',
    button: '입장',
    buttonCode: '{code} 입장',
    pending: '방에 접속하는 중…',
    incomplete: {
      other: '코드 {count}글자를 모두 입력해 주세요.',
    },
  },
  footer: {
    players: {
      other: '1~{count}명 플레이',
    },
    noAccount: '계정 없이 브라우저에서 바로',
    deezer: 'Deezer 음원 미리 듣기',
  },
  profile: {
    changeAvatar: '아바타와 색상 바꾸기',
    nameLabel: '닉네임',
    namePlaceholder: '닉네임을 정해 주세요',
    randomName: '랜덤 닉네임',
    lookTitle: '내 스타일',
    lookDescription: '이모지와 색상을 골라요. 다른 플레이어에게는 이렇게 보여요.',
    done: '완료',
    preview: '미리 보기',
  },
  demo: {
    badge: '데모',
    /** One line: ~34 characters on desktop. */
    caption: {
      shuffle: '히트곡이 산산조각 나는 중…',
      listen: '조각을 들어 보세요',
      sort: '올바른 순서로 끌어다 놓으세요',
      solved: '퍼펙트! 가장 먼저 확정하세요',
    },
    solvedPoints: '퍼펙트! +{points}',
    stepsLabel: '게임 방법 요약',
    steps: {
      listen: '듣기',
      sort: '맞추기',
      confirm: '확정',
    },
  },
  howTo: {
    title: '게임 방법',
    description: '라운드마다 히트곡 하나가 산산조각 나요. 가장 정확하고 빠르게 순서를 맞춘 사람이 이겨요.',
    gotIt: '알겠어요, 시작해요!',
    /** Tiny fake button in the illustration. */
    confirmButton: '확정',
    steps: {
      listen: {
        title: '조각 듣기',
        bodyMouse: '유명한 히트곡을 박자에 맞춰 자르고 뒤섞어요. 블록을 클릭하면 들을 수 있어요.',
        bodyTouch: '유명한 히트곡을 박자에 맞춰 자르고 뒤섞어요. 블록을 탭하면 들을 수 있어요.',
      },
      sort: {
        title: '올바른 순서로 끌어다 놓기',
        /** <play></play> = the ▶ icon. */
        body: '원곡처럼 들릴 때까지 블록을 옮겨요. <play></play> 버튼으로 내 순서를 들어 볼 수 있어요.',
      },
      confirm: {
        title: '누구보다 먼저 확정',
        body: '누군가 가장 먼저 확정하면 모두에게 막판 카운트다운이 시작돼요.',
      },
    },
    scoring: {
      other: '라운드마다 최대 <b>{points}</b>점: 제자리에 놓은 조각과 순서대로 이어진 쌍이 점수가 돼요. 혼자서도 플레이할 수 있어요.',
    },
  },
} satisfies Catalog['home']
