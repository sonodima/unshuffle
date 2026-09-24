import type { Catalog } from '../../catalog'

// Final results screen: headline, podium, action dock, standings, awards, the
// round-by-round table and the songs of the game.
//
// Points: {points} is the score already formatted ("18 304"); plural forms are
// chosen by the score itself. Uppercase comes from CSS: write normal case.
// Places: ui.ordinal is the bare number in Russian, so messages add the ending
// themselves ("{rank}-е место").
export default {
  /** Badge / table header for my own row. Very short (≈ 4 characters). */
  you: 'Ты',
  /** A late joiner who never played a round (standings row, empty table cell). */
  didNotPlay: 'Без участия',
  /** Round shorthand on covers and table rows ("R3"). Keep it 1–2 letters plus the number. */
  roundShort: 'Р{round}',
  /** Round count: top bar chip (after the playlist name) and next to the "Round per round" title (uppercase). */
  roundCount: {
    one: '{count} раунд',
    few: '{count} раунда',
    many: '{count} раундов',
    other: '{count} раунда',
  },

  topBar: {
    /** Eyebrow next to the logo (uppercase, small). */
    gameOver: 'Игра окончена',
  },

  hero: {
    /** Suspense line before the winner is revealed; three animated dots follow it. Short: big display type. */
    teaser: 'И побеждает',
  },

  /** Big title and subtitle at the top. Titles are huge display type: keep them short (≈ 16 characters). */
  headline: {
    /** Nobody in the standings (should not happen). */
    over: 'Игра окончена!',
    noPlayers: 'В рейтинге пока никого.',
    /** Solo game, zero points. */
    soloZero: 'Ноль очков!',
    soloZeroSub: 'Не беда: в следующий раз точно соберёшь.',
    /** Solo game titles, by average points per round: 90%+ of the maximum, 60%+, below. */
    soloGreat: 'Мастерски!',
    soloGood: 'Хорошо сыграно!',
    soloOk: 'Игра окончена!',
    /** Subtitle "18.304 punti in 5 round" (solo game, or a viewer who didn't play). {rounds} is the phrase headline.rounds. */
    pointsInRounds: {
      one: '{points} очко за {rounds}',
      few: '{points} очка за {rounds}',
      many: '{points} очков за {rounds}',
      other: '{points} очка за {rounds}',
    },
    /** "5 раундов" inside headline.pointsInRounds (after «за»: accusative, same as the nominative here). */
    rounds: {
      one: '{count} раунд',
      few: '{count} раунда',
      many: '{count} раундов',
      other: '{count} раунда',
    },
    /** Several players, nobody scored. */
    allZero: 'У всех по нулям!',
    allZeroSub: 'Ни одного очка — самое время отыграться.',
    /** Shared first place. */
    tie: 'Ничья!',
    /** I'm one of the tied winners. {names}: the other winners, already joined ("Юля и Марк"). */
    tieWithMe: 'Ты и {names} делите первое место',
    /** {names}: all the tied winners, already joined ("Тимур и Юля"). Always two or more. */
    tieOthers: '{names} делят первое место',
    /** I won alone. */
    youWin: 'Победа за тобой!',
    /** Subtitle when I won and nobody else is in the standings. */
    youWinPoints: {
      one: '{points} очко',
      few: '{points} очка',
      many: '{points} очков',
      other: '{points} очка',
    },
    /** Subtitle when I won: my total, then the runner-up {name} and my lead {gap} (formatted points). */
    youWinLead: {
      one: '{points} очко · {name} отстаёт на {gap}',
      few: '{points} очка · {name} отстаёт на {gap}',
      many: '{points} очков · {name} отстаёт на {gap}',
      other: '{points} очка · {name} отстаёт на {gap}',
    },
    /** I won with the same points as {name}, thanks to the faster confirmations. */
    youWinFaster: 'Очков поровну, но ты быстрее, чем {name}',
    /** Someone else won. {name} is shown in the winner's color. */
    theyWin: '{name} побеждает!',
    /** I have the winner's points but lost on time. */
    sameScore: 'Очков поровну, но {name} быстрее: решило время',
    /** My place: {rank} (the bare number, ending added here) out of {total} players, with my points. */
    myRank: {
      one: 'У тебя {rank}-е место из {total} и {points} очко',
      few: 'У тебя {rank}-е место из {total} и {points} очка',
      many: 'У тебя {rank}-е место из {total} и {points} очков',
      other: 'У тебя {rank}-е место из {total} и {points} очка',
    },
  },

  /** Action bar pinned under the podium / at the bottom of the screen. */
  dock: {
    /** Accessible name of the button group. */
    label: 'Действия',
    leave: 'Выйти',
    /** Host: main button, back to the lobby with the same players. Keep it short. */
    playAgain: 'Ещё раз',
    /** Guest: nudge the host for a rematch. */
    rematch: 'Реванш!',
    /** Guest: the rematch button right after tapping it (disabled for a few seconds). */
    rematchSent: 'Запрос отправлен',
    /** Guest: next to an animated equalizer while the host decides. */
    waiting: 'Ждём, когда хост начнёт новую игру…',
    /** Host: who asked for a rematch. {names}: one or two names, already joined ("Юля и Марк"); plural by how many. */
    rematchNamed: {
      one: '{names} требует реванша!',
      few: '{names} требуют реванша!',
      many: '{names} требуют реванша!',
      other: '{names} требуют реванша!',
    },
    /** Host: three or more players asked for a rematch. */
    rematchMany: {
      one: '{count} игрок требует реванша!',
      few: '{count} игрока требуют реванша!',
      many: '{count} игроков требуют реванша!',
      other: '{count} игрока требуют реванша!',
    },
  },

  /** Host leaving while others are still connected. */
  leaveDialog: {
    title: 'Закрыть комнату?',
    /** {count}: connected players other than the host (1–9). The "one" form is for exactly one. */
    body: {
      one: 'Другой игрок будет отключён, и сыграть ещё раз уже не получится.',
      few: 'Остальные {count} игрока будут отключены, и сыграть ещё раз уже не получится.',
      many: 'Остальные {count} игроков будут отключены, и сыграть ещё раз уже не получится.',
      other: 'Остальные {count} игрока будут отключены, и сыграть ещё раз уже не получится.',
    },
    cancel: 'Отмена',
    confirm: 'Закрыть комнату',
  },

  podium: {
    /** Accessible name of the podium list. */
    label: 'Пьедестал',
    /** Screen readers, one podium step. {rank}: the place (bare number, ending added here). */
    slot: {
      one: '{rank}-е место: {name}, {points} очко',
      few: '{rank}-е место: {name}, {points} очка',
      many: '{rank}-е место: {name}, {points} очков',
      other: '{rank}-е место: {name}, {points} очка',
    },
    /** Same, for my own step. */
    slotMe: {
      one: '{rank}-е место: {name} (ты), {points} очко',
      few: '{rank}-е место: {name} (ты), {points} очка',
      many: '{rank}-е место: {name} (ты), {points} очков',
      other: '{rank}-е место: {name} (ты), {points} очка',
    },
    /** Button on the winner's avatar: tap for more confetti. */
    cheer: '{name}: ещё конфетти!',
  },

  standings: {
    title: 'Рейтинг',
    /** Next to the title (small, uppercase). */
    players: {
      one: '{count} игрок',
      few: '{count} игрока',
      many: '{count} игроков',
      other: '{count} игрока',
    },
    /** Screen readers, before a row: "2-е место". */
    position: '{rank}-е место',
    /** Badge on a disconnected player. Short. */
    offline: 'Офлайн',
    /** Tooltips / screen-reader labels of the small stats under each name. */
    perfectRounds: 'Идеальные раунды',
    accuracy: 'Фрагменты на своих местах, в среднем',
    avgTime: 'Среднее время до «Готово»',
    /** Late joiner: the first round they played. */
    lateFrom: 'с раунда {round}',
    /** Unit under each total (tiny, uppercase); plural by the score. */
    points: {
      one: 'очко',
      few: 'очка',
      many: 'очков',
      other: 'очка',
    },
  },

  /** Award cards. Titles are small display type in a half-width card on phones: keep them short. */
  awards: {
    title: 'Награды',
    /** Next to the title (small, uppercase). */
    aside: 'Особые номинации',
    /** Three or more winners of an award: "Юля и ещё 2". {count}: how many besides {name}. */
    nameAndOthers: {
      one: '{name} и ещё {count}',
      few: '{name} и ещё {count}',
      many: '{name} и ещё {count}',
      other: '{name} и ещё {count}',
    },
    goldenEar: {
      title: 'Абсолютный слух',
      description: 'Больше всех идеальных раундов',
      value: {
        one: '{count} идеальный раунд',
        few: '{count} идеальных раунда',
        many: '{count} идеальных раундов',
        other: '{count} идеального раунда',
      },
    },
    lightning: {
      title: 'Молния',
      description: 'Самое быстрое «Готово» в раундах с очками',
      /** {time}: average time, e.g. "38,3 с". */
      value: 'в среднем {time}',
    },
    sniper: {
      title: 'Снайпер',
      description: 'Больше всех фрагментов на своих местах',
      /** {accuracy}: snippets in place per round ("6,8/8") or a percentage ("85 %"). */
      value: '{accuracy} в среднем',
    },
    lastSecond: {
      title: 'Цейтнот',
      description: 'Чаще всех не успевает до конца таймера',
      value: {
        one: 'Время вышло {count} раз',
        few: 'Время вышло {count} раза',
        many: 'Время вышло {count} раз',
        other: 'Время вышло {count} раза',
      },
    },
  },

  /** Rounds × players points table. */
  rounds: {
    title: 'Раунд за раундом',
    /** Accessible name of the table when it scrolls sideways. */
    scrollLabel: 'Очки по раундам, прокрути, чтобы увидеть всех игроков',
    /** Table caption (screen readers only). */
    caption: 'Очки каждого игрока в каждом раунде',
    /** Header of the song column (small, uppercase). */
    song: 'Трек',
    /** Row title when the song is unknown. */
    fallbackTitle: 'Раунд {round}',
    /** Crown icon on the round's best score, and its legend. */
    best: 'Рекорд раунда',
    /** Badge in a narrow cell (≈ 70px, tiny uppercase) and legend entry. Short. */
    perfect: 'Идеально',
    /** Clock icon, and its legend. */
    timedOut: 'Время вышло',
    /** Footer row label (uppercase). */
    total: 'Итого',
  },

  /** Song tiles at the bottom. */
  songs: {
    title: 'Треки этой игры',
    /** Next to the title (small, uppercase; hidden on phones). */
    aside: 'Переслушай здесь или в Deezer',
    /** Cover button, screen readers. {title} / {artist}: the song; {round}: its round number. */
    play: 'Слушать отрывок: {artist} — «{title}», раунд {round}',
    stop: 'Остановить отрывок: {artist} — «{title}», раунд {round}',
    /** Link to the song on Deezer (screen readers). */
    open: 'Открыть «{title}» в Deezer (новая вкладка)',
    /** Tooltip of the same link. */
    openTooltip: 'Открыть в Deezer',
    /** Under a song whose preview couldn't be loaded. */
    unavailable: 'Отрывок недоступен',
  },

  units: {
    /** Seconds with one decimal ("38,3 с"): {value} is already formatted. Keep the no-break space before the unit. */
    seconds: '{value} с',
  },
} satisfies Catalog['final']
