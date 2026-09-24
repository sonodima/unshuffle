// Home screen: hero, profile card, "创建房间" / join box, the decorative
// round demo and the "怎么玩" dialog. Labels marked "uppercase" are
// shown in capitals by CSS (no effect on Chinese characters).
import type { Catalog } from '../../catalog'

export default {
  /** Top-left button that opens the "how to play" dialog. Small pill, keep short. */
  help: '玩法',
  hero: {
    /** Small line above the logo (uppercase, letter-spaced). Keep it short: ~24 characters. */
    eyebrow: '音乐派对游戏',
    /** Under the logo. <b>…</b> is the highlighted second sentence. */
    tagline: '神曲碎了一地。<b>快把它拼回来！</b>',
  },
  /** Screen-reader name of the card with the profile and the create / join buttons. */
  cardLabel: '开始玩',
  /** Screen-reader name of the desktop panel with the animated demo round. */
  demoLabel: '回合演示',
  /** Banner at the top of the card while the device has no network. */
  offline: '你已离线：需要联网才能玩。',
  /** Screen-reader label of the × that dismisses an error banner. */
  dismissNotice: '关闭提示',
  /** Divider between the join box and "创建新房间" when opened from an invite link (uppercase). */
  or: '或者',
  /** Link next to "正在创建房间…" / "正在加入房间…" that aborts it. */
  cancel: '取消',
  create: {
    /** Main call to action (big button, uppercase). Keep it short: ~16 characters. */
    button: '创建房间',
    /** Secondary button when the player arrived with an invite link (uppercase). */
    buttonInvited: '创建新房间',
    /** Under the button while the room is being opened. */
    pending: '正在创建房间…',
    /** Hint under "创建房间". <b>…</b> is the bold lead-in. One line on phones (~50 characters). */
    solo: '<b>一个人也能玩：</b>创建房间，直接开局。',
  },
  join: {
    /** Divider above the 5 code boxes (uppercase). */
    divider: '有房间码？',
    /** Label above the code boxes when opened from an invite link (uppercase). */
    invited: '你收到了邀请！',
    /** Join button (uppercase). */
    button: '加入',
    /** Join button once the invite code is complete. {code} = 5-letter room code, e.g. KXQPM (uppercase). */
    buttonCode: '加入 {code}',
    /** Under the button while connecting. */
    pending: '正在加入房间…',
    /** Error under the code boxes when "加入" is pressed too early. {count} = code length (5). */
    incomplete: {
      other: '请输入完整的{count}位房间码。',
    },
  },
  /** Tiny facts in the footer (~11px, one line each). */
  footer: {
    /** {count} = maximum number of players (10). */
    players: {
      other: '1–{count}人同乐',
    },
    noAccount: '无需注册，打开浏览器就能玩',
    deezer: '音乐试听由 Deezer 提供',
  },
  profile: {
    /** Screen-reader label of the avatar button (opens the avatar / colour picker). */
    changeAvatar: '更换头像和颜色',
    /** Label of the nickname field (uppercase). */
    nameLabel: '你的昵称',
    namePlaceholder: '起个昵称',
    /** Tooltip / label of the dice button that picks a random nickname. */
    randomName: '随机昵称',
    /** Title of the avatar / colour picker dialog. */
    lookTitle: '你的造型',
    lookDescription: '挑个表情和颜色：其他玩家看到的就是这样的你。',
    /** Closes the picker. */
    done: '完成',
    /** Small heading over the preview of your avatar and name (uppercase). */
    preview: '预览',
  },
  /** The decorative demo round (silent, loops by itself). */
  demo: {
    /** Tiny badge (uppercase, ~10px). */
    badge: '演示',
    /** Caption of each phase of the demo: one line, cut with … beyond ~34 characters on desktop, ~45 on phones. */
    caption: {
      shuffle: '神曲被切成了碎片…',
      listen: '逐个试听片段',
      sort: '拖回正确的顺序',
      solved: '完美！抢先确认',
    },
    /** Phone caption when the demo is solved (one line). {points} = points won, already formatted (5,000). */
    solvedPoints: '完美！+{points}',
    /** Screen-reader name of the three step chips under the demo board. */
    stepsLabel: '玩法速览',
    /** Step chips under the desktop demo (one word each, ~12 characters). */
    steps: {
      listen: '试听',
      sort: '排序',
      confirm: '确认',
    },
  },
  /** "How to play" dialog: three illustrated steps and the scoring rule. */
  howTo: {
    title: '怎么玩',
    description: '每回合一首神曲，切碎打乱。谁拼得又准又快，谁就赢。',
    /** Closes the dialog. */
    gotIt: '懂了，开玩！',
    /** The fake "confirm" button drawn in the third illustration (tiny pill, uppercase): keep it very short. */
    confirmButton: '确认',
    steps: {
      listen: {
        title: '试听片段',
        /** Shown on devices with a mouse. */
        bodyMouse: '热门歌曲按节拍切成片段，顺序全被打乱。点击方块就能试听。',
        /** Shown on touch screens. */
        bodyTouch: '热门歌曲按节拍切成片段，顺序全被打乱。点一下方块就能试听。',
      },
      sort: {
        title: '拖回正确的顺序',
        /** <play></play> is replaced by a small ▶ icon (the "play your order" button). Keep it empty. */
        body: '拖动方块，直到听起来和原曲一样。点<play></play>听听你排的顺序。',
      },
      confirm: {
        title: '抢先确认',
        body: '第一个确认的人，会为所有人启动最后倒计时。',
      },
    },
    /**
     * Scoring rule under the steps. {points} = maximum points per round, already
     * formatted (5,000); <b>…</b> highlights it.
     */
    scoring: {
      other: '每回合最高<b>{points}</b>分：片段放对位置、前后衔接正确都能得分。一个人也能玩。',
    },
  },
} satisfies Catalog['home']
