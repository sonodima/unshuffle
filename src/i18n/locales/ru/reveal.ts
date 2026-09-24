import type { Catalog } from '../../catalog'

// Round reveal (src/screens/round/reveal): the revealed song, my arrangement vs
// the right order, my round points, the round leaderboard and the bottom CTA.
// Eyebrows, titles, chips and badges are uppercased by CSS: write them normally.
// Places: ui.ordinal is the bare number in Russian, so messages add the ending
// themselves ("{rank}-е место", "был {pos}-м").
export default {
  header: {
    /** Small label above the round title. */
    eyebrow: 'Результаты',
    /** Page title, e.g. "Раунд 3 / 5". The <dim> part is shown dimmed. */
    round: 'Раунд {round}<dim> / {total}</dim>',
  },

  song: {
    /** Screen-reader name of the song card. */
    region: 'Песня',
    /** Small label above the song title. */
    eyebrow: 'Это была песня',
    /** Alt text of the album cover; {name} is the album (or the song title). */
    coverAlt: 'Обложка: {name}',
    /** Status of the original song (equalizer label, now-playing bar). */
    playing: 'Играет',
    paused: 'На паузе',
    /** Now-playing bar when the song is not playing. */
    stopped: 'Стоп',
    /** Button while the browser still blocks the audio: one tap starts it. */
    unlock: {
      hover: 'Кликни, чтобы послушать',
      touch: 'Нажми, чтобы послушать',
    },
    /** Round play/pause button (screen-reader labels). */
    pause: 'Поставить песню на паузу',
    resume: 'Продолжить песню',
    replay: 'Послушать песню ещё раз',
    /**
     * Small button that opens the song on Deezer. The <wide> part is hidden on
     * phones narrower than 420 px, so what is outside it must work alone (keep it short).
     */
    deezer: 'Слушать<wide> в Deezer</wide>',
    /** Screen-reader label of the Deezer button; {title} is the song. */
    deezerAria: 'Слушать «{title}» в Deezer (откроется в новой вкладке)',
    /** Fact chips under the song (small). */
    snippets: {
      one: '{count} фрагмент',
      few: '{count} фрагмента',
      many: '{count} фрагментов',
      other: '{count} фрагмента',
    },
    /** Tempo chip: “BPM” stays as is. */
    bpm: '{bpm} BPM',
  },

  board: {
    /** Screen-reader name of the board section. */
    region: 'Твоя последовательность',
    /**
     * Board title, depending on which arrangement is shown. One line next to the toggle
     * (~200 px on phones, uppercase display type): «Правильный порядок» was cut.
     */
    titleMine: 'Твой порядок',
    titleCorrect: 'Верный порядок',
    /**
     * Two-option toggle above the board, once sorted. Each option is ~120 px wide
     * on tablets/desktop and ~80 px on phones (the short forms), padding included:
     * in Unbounded even «Твой порядок» (116 px) spills, so the long forms are the
     * short ones too. The title beside the toggle already says «… порядок».
     */
    toggle: {
      /** Screen-reader name of the toggle. */
      label: 'Какой порядок показан',
      mine: 'Твой',
      mineShort: 'Твой',
      correct: 'Верный',
      correctShort: 'Верный',
    },
    /** Screen-reader labels of the two counters while the ✓ / ✗ pop in. */
    tallyCorrect: {
      one: '{count} на своём месте',
      few: '{count} на своих местах',
      many: '{count} на своих местах',
      other: '{count} на своих местах',
    },
    tallyWrong: {
      one: '{count} не на месте',
      few: '{count} не на месте',
      many: '{count} не на месте',
      other: '{count} не на месте',
    },
    /**
     * Tiny chips in the corner of a misplaced block (~6 characters).
     * `was`: on the right order, where the player had put that snippet ("был 5-м").
     * `goes`: on the player's order, where the snippet belongs.
     * {pos} = the position, a bare number in Russian (ui.ordinal).
     */
    was: 'был {pos}-м',
    goes: '→ {pos}',
    /**
     * One line under the board title (truncated beyond ~60 characters on phones):
     * how it went · what a click (mouse) / tap (touch screens) on a block does.
     */
    hint: {
      /** Before the blocks sort themselves. */
      intro: {
        hover: 'Кликни по фрагменту, чтобы слушать песню с этого места',
        touch: 'Нажми на фрагмент, чтобы слушать песню с этого места',
      },
      /** The player's own arrangement is shown. */
      mine: {
        hover: 'Так стояли твои фрагменты · кликни, чтобы послушать',
        touch: 'Так стояли твои фрагменты · нажми, чтобы послушать',
      },
      perfect: {
        hover: 'Всё на своих местах! · кликни, чтобы переслушать',
        touch: 'Всё на своих местах! · нажми, чтобы переслушать',
      },
      none: {
        hover: 'Ни одной позиции не угадано · кликни, чтобы переслушать',
        touch: 'Ни одной позиции не угадано · нажми, чтобы переслушать',
      },
      /** {count} right positions out of {n} blocks. */
      partial: {
        hover: {
          one: 'Угадана {count} позиция из {n} · кликни, чтобы переслушать',
          few: 'Угаданы {count} позиции из {n} · кликни, чтобы переслушать',
          many: 'Угадано {count} позиций из {n} · кликни, чтобы переслушать',
          other: 'Угадано {count} позиции из {n} · кликни, чтобы переслушать',
        },
        touch: {
          one: 'Угадана {count} позиция из {n} · нажми, чтобы переслушать',
          few: 'Угаданы {count} позиции из {n} · нажми, чтобы переслушать',
          many: 'Угадано {count} позиций из {n} · нажми, чтобы переслушать',
          other: 'Угадано {count} позиции из {n} · нажми, чтобы переслушать',
        },
      },
    },
  },

  /** In place of the board for a late joiner (plays from the next round). */
  spectator: {
    title: 'Ты в зрителях',
    body: 'Этот раунд ты смотришь со стороны, а сыграешь со следующего.',
  },
  /** In place of the board when the host got no arrangement from me. */
  missing: {
    title: 'Нет ответа',
    body: 'В этот раз твоя последовательность до нас не дошла.',
  },

  score: {
    /** Screen-reader name of the points panel. */
    region: 'Твои очки',
    /** Small label over the big number (one line, keep it short). */
    eyebrow: 'Очки за раунд',
    /** Badge: the timer ran out before I confirmed (also a leaderboard icon label). */
    timedOut: 'Время вышло',
    /**
     * Small pill: how long I took to confirm. The <wide> part is hidden below 400 px;
     * <num> wraps {time}, e.g. “55,8 с”. Keep all the text inside the two tags (either
     * order): the pill spaces them itself.
     */
    confirmedIn: '<wide>Готово за</wide> <num>{time}</num>',
    /** Screen-reader label of the 0–5000 bar. */
    barAria: {
      one: '{points} очко из {max}',
      few: '{points} очка из {max}',
      many: '{points} очков из {max}',
      other: '{points} очка из {max}',
    },
    /** Label under the “6/8” stat (small, one line). */
    correct: 'на своих местах',
    /** Label under the pair count (small, one line); the number is shown above it. */
    pairs: {
      one: 'верная пара',
      few: 'верные пары',
      many: 'верных пар',
      other: 'верной пары',
    },
    /** My overall total after this round. */
    total: 'Итого за игру',
    /**
     * Small pill after the game total: my place after this round. {rank} = the place,
     * already an ordinal (ui.ordinal); add the counter word if yours has none. Very short.
     */
    rank: '{rank}-е место',
    /** Stamp on a perfect round (big, slanted). */
    stamp: 'Идеально!',
  },

  /** One line under my points, by how well the round went. */
  verdict: {
    perfect: 'Идеальный порядок!',
    almost: 'Почти идеально!',
    good: 'Отличный слух!',
    close: 'Уже близко…',
    more: 'Стоит переслушать',
    none: 'Ни одного фрагмента на своём месте',
  },

  /** Screen-reader label of the rank-change arrow. */
  rankUp: {
    one: 'Вверх на {count} позицию',
    few: 'Вверх на {count} позиции',
    many: 'Вверх на {count} позиций',
    other: 'Вверх на {count} позиции',
  },
  rankDown: {
    one: 'Вниз на {count} позицию',
    few: 'Вниз на {count} позиции',
    many: 'Вниз на {count} позиций',
    other: 'Вниз на {count} позиции',
  },

  /** A duration in seconds; {seconds} is already formatted (“55,8”). */
  seconds: '{seconds} с',

  /** Screen-reader summary once my points are shown. */
  announce: {
    /** {points} = round points, {correct} of {n} blocks right, {pairs} = announce.pairs. */
    result: {
      one: '{points} очко: {correct} из {n} на своих местах, {pairs}.',
      few: '{points} очка: {correct} из {n} на своих местах, {pairs}.',
      many: '{points} очков: {correct} из {n} на своих местах, {pairs}.',
      other: '{points} очка: {correct} из {n} на своих местах, {pairs}.',
    },
    pairs: {
      one: '{count} верная пара',
      few: '{count} верные пары',
      many: '{count} верных пар',
      other: '{count} верной пары',
    },
    /** Wraps the summary on a perfect round. */
    perfect: 'Идеальный порядок! {result}',
    /** Wraps the summary when the timer ran out. */
    timedOut: '{result} Время вышло.',
  },

  lead: {
    /** Leaderboard title (and screen-reader name of the panel). */
    title: 'Рейтинг',
    /** Small label on the right of the title. */
    after: 'после раунда {round}',
    /** Badge next to my own name (tiny: 2–4 letters). */
    you: 'ты',
    /** Icon label on the best score(s) of the round. */
    top: 'Рекорд раунда',
    /** Under the name of a player without a result. */
    spectator: 'Зритель',
    /** Late joiner, seen by the others; {round} = the round they start playing. */
    spectatorFrom: 'Зритель · играет с раунда {round}',
    noAnswer: 'Нет ответа',
    /** Round stats under the leaderboard (tiny labels, one line each, three columns). */
    stats: {
      average: 'Среднее',
      perfect: 'Без ошибок',
      fastest: 'Быстрее всех',
    },
    /**
     * Screen-reader label of a leaderboard row. {rank} = the place (bare number, ending added here),
     * {name} = player (or lead.row.me for me), {total} = overall points.
     */
    row: {
      /** {points} this round, {correct} of {n} blocks in the right place. */
      played: {
        one: '{rank}-е место, {name}: {points} очко за раунд, {correct} из {n} на своих местах, всего {total}',
        few: '{rank}-е место, {name}: {points} очка за раунд, {correct} из {n} на своих местах, всего {total}',
        many: '{rank}-е место, {name}: {points} очков за раунд, {correct} из {n} на своих местах, всего {total}',
        other: '{rank}-е место, {name}: {points} очка за раунд, {correct} из {n} на своих местах, всего {total}',
      },
      spectator: '{rank}-е место, {name}: зритель, всего {total}',
      noAnswer: '{rank}-е место, {name}: нет ответа, всего {total}',
      /** My own name in the row label. */
      me: '{name} (ты)',
    },
  },

  footer: {
    /** Host's button: next round, or the final standings after the last round. */
    next: 'Следующий раунд',
    final: 'К итогам',
    /** Auto-advance countdown beside the host's button; <num> wraps the seconds. */
    nextIn: {
      one: 'Следующий раунд через <num>{count}</num> с',
      few: 'Следующий раунд через <num>{count}</num> с',
      many: 'Следующий раунд через <num>{count}</num> с',
      other: 'Следующий раунд через <num>{count}</num> с',
    },
    finalIn: {
      one: 'Итоги через <num>{count}</num> с',
      few: 'Итоги через <num>{count}</num> с',
      many: 'Итоги через <num>{count}</num> с',
      other: 'Итоги через <num>{count}</num> с',
    },
    /** Guests, while the host decides. */
    waiting: 'Ждём хоста…',
    /** Guests, with the auto-advance countdown; <num> is the dimmed seconds. */
    waitingIn: {
      one: 'Ждём хоста…<num>({count} с)</num>',
      few: 'Ждём хоста…<num>({count} с)</num>',
      many: 'Ждём хоста…<num>({count} с)</num>',
      other: 'Ждём хоста…<num>({count} с)</num>',
    },
  },
} satisfies Catalog['reveal']
