// Design-system defaults (src/components/ui, src/components/brand): mostly
// screen-reader labels. Screens pass their own texts for everything else.
import type { Catalog } from '../../catalog'

export default {
  loading: '불러오는 중…',
  wait: '잠시만요…',
  listSeparator: ', ',
  /**
   * A bare number: Korean adds the counter in each message ("{rank}위", "{pos}번째",
   * "{pos}번"), since a place and a position take different counters.
   */
  ordinal: { other: '{n}' },
  modal: {
    close: '닫기',
  },
  toast: {
    region: '알림',
    dismiss: '알림 닫기',
  },
  avatar: {
    fallback: '아바타',
    host: '호스트',
    submitted: '확정함',
    disconnected: '연결 끊김',
    rank: '{rank}위',
    more: { other: '외 {count}명' },
  },
  avatarPicker: {
    avatar: '아바타',
    color: '색상',
    /** Short: ~12 characters. */
    random: '랜덤',
    avatarGroup: '아바타 선택',
    colorGroup: '색상 선택',
    avatarOption: '아바타 {emoji}',
    colorOption: '색상 {number}',
  },
  codeInput: {
    label: '방 코드',
    letter: '{label}: {count}글자 중 {index}번째',
  },
  input: {
    counter: '{count}/{max}',
  },
  timer: {
    secondsLeft: { other: '{count}초 남음' },
  },
  progressDots: {
    label: '{total}라운드 중 {current}번째 라운드',
  },
  language: {
    title: '언어',
    button: '언어: {language}',
    failed: '언어를 불러오지 못했어요. 다시 시도해 주세요.',
  },
} satisfies Catalog['ui']
