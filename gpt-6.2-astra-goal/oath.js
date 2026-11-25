'use strict';

const oathTitle = 'Колокол подо льдом';
const oathLabels = {
  station: 'Заговорить с Верой',
  quarry: 'Раскрыть караульную книгу',
  ferry: 'Спуститься к обугленному причалу',
  chapel: 'Заговорить с Саввой',
  aqueduct: 'Осмотреть затворы водовода',
  belfry: 'Заглянуть под пол звонницы',
};
const oathNotes = {
  token: ['Бирка из воды', 'Вера узнала свою учётную метку. Оборот ещё скрывает спёкшаяся смола.', 0],
  rope: ['Узел с переправы', 'Спасательный трос сплетён из трёх льняных прядей и одной пеньковой.', 0],
  roll: [
    'Корешок № 36',
    'XVII ноября. Двенадцать дворов вычеркнуты из довольствия за самовольный уход. Вместо имён оставлены номера. Внизу одна подпись — В. Ланская.',
    22,
  ],
  receipt: [
    'Квитанция с пристани',
    'XVIII ноября, вечерняя выдача. Жетон № 36 принял спасательный канат. Восьмёрку на бирке добивали из двух колец. Дата выбита до пожара: смола запечатала углубления.',
    22,
  ],
  dates: [
    'Пропавшие сутки',
    'Двор № 36 получил трос после своего мнимого бегства. Из гарнизонного списка людей вычеркнули задним числом.',
    36,
  ],
  beat: [
    'След ночного звона',
    'Вы пустили воду в деревянный жёлоб. Из-под Верхней звонницы отозвался один удар. Вода двигает тягу, но последний палец кто-то вставляет рукой.',
    18,
  ],
  drive: [
    'Дубовый палец',
    'В осушенном колодце под Верхней звонницей уцелел бронзовый колокол. Свежий дубовый палец на валу запускает ударник. На его торце отпечаталась ладонь, пропитанная дёгтем.',
    34,
  ],
  vera: [
    'Свидетельство Веры',
    'Вера подменила дату после пожара. В одном из вычеркнутых дворов жила её сестра. Среди бумаг есть подлинный приказ об огне с гарнизонной печатью.',
    30,
  ],
  savva: [
    'Свидетельство Саввы',
    'Савва разрезал трос и спас семь человек на верхнем пароме. Его брат Тимофей, перевозчик из двора № 36, остался на нижнем. Нынешний звон вызывает лодку для уцелевших семей.',
    30,
  ],
  signature: [
    'Подпись под показанием',
    'Вера поставила своё полное имя под показанием и готова открыть подлинник разъездному суду.',
    12,
  ],
  boat: [
    'Место в лодке',
    'Савва оставил три места для сестры Веры и её дочерей. Открытый слив выведет лодку на озеро.',
    12,
  ],
  names: [
    'Оттиск с обода',
    'Под слоем наносов на ободе проступили одиннадцать полных имён и одно стёртое. Теперь двенадцатое имя можно восстановить по показаниям.',
    18,
  ],
  word: [
    'Согласие звонаря',
    'Савва разрешил вырезать имя Тимофея и приложил свой перстень. Он согласился нести первую вахту у нового поминального колокола.',
    12,
  ],
  grove: [
    'Лесной знак для беглецов',
    'Вы поручились перед Саввой за лесную тропу. Ваша дозорная смена пропустит двух перевозчиков к их семьям. Савва согласился дать показание без доказательств из звонницы.',
    12,
  ],
  watch: [
    'Вскрытый пакет караула',
    'Ваше право сменного караула позволило Вере показать приказ до сверки дат. Под гарнизонной печатью прямо названы оба парома.',
    12,
  ],
  wage: [
    'Оплаченная смена у затвора',
    'Вы отдали восемь серебряных за дежурство мельника. До решения у колокола он открывает и закрывает нижний слив по сигналу Саввы из часовни.',
    12,
  ],
};
const oathEndings = {
  hearing: {
    name: 'Открытое слушание',
    line: 'Передать оригиналы и имена суду',
    place: 'station',
    vera: 'station',
    savva: 'station',
    clip: 'vera-hearing',
    other: 'savva-hearing',
    need: 'Получите заверенное показание Веры на сигнальной станции.',
    test: (s) => s.notes.includes('signature'),
    warn: 'Опись даёт семьям право вернуть дома. В суде назовут и живых. Сестре Веры предстоит явиться под настоящей фамилией.',
    result:
      'На станции пристав принимает заявления. Вера сдала подлинный приказ, Савва пришёл давать показания. Реестр открыт, и всякий может прочитать фамилии уцелевших.',
    xp: 75,
  },
  refuge: {
    name: 'Трое на озере',
    line: 'Разорвать опись и спустить лодку',
    place: 'ferry',
    vera: 'ferry',
    savva: 'ferry',
    clip: 'savva-refuge',
    other: 'vera-refuge',
    need: 'Договоритесь с Саввой о трёх местах и оставьте слив открытым.',
    test: (s) => s.notes.includes('boat') && s.drainOpen,
    warn: 'Три человека уйдут до рассвета. Без подлинной описи суд не вернёт им дома. В книге останется обвинение в дезертирстве.',
    result:
      'От причала отходит лодка с тремя переселенцами. Вера провожает сестру. Савва убрал сигнальный палец, и под станционной дверью больше не лежит список для розыска.',
    xp: 75,
  },
  vigil: {
    name: 'Именная вахта',
    line: 'Повесить поминальный колокол',
    place: 'belfry',
    vera: 'belfry',
    savva: 'belfry',
    clip: 'savva-vigil',
    other: 'vera-vigil',
    need: 'Снимите оттиск с обода в сухом колодце и попросите Савву вписать имя брата.',
    test: (s) => s.notes.includes('word'),
    warn: 'Имена погибших останутся на берегу. На дворцовую выплату община не подаст. До весны она отдаст доход с мельницы за право держать собственную переправу.',
    result:
      'Над водой висит колокол с двенадцатью именами. Вера вписала первую смену, Савва принял верёвку. За зимнюю переправу община поручилась мельницей.',
    xp: 75,
  },
};
const oathPeople = { Вера: ['witness', 'vera'], Савва: ['witness', 'savva'] };
Object.assign(dialogueCast, oathPeople);

function newOath() {
  return {
    intro: null,
    tracked: false,
    visited: [],
    notes: [],
    waterToWheel: true,
    drainOpen: false,
    ringSerial: 0,
    ending: null,
    track: null,
  };
}
function validOath(s) {
  if (s === undefined) return true;
  return (
    !!s &&
    typeof s === 'object' &&
    [null, 'token', 'rope'].includes(s.intro) &&
    (s.tracked === undefined || typeof s.tracked === 'boolean') &&
    (s.ending === null || Object.hasOwn(oathEndings, s.ending)) &&
    (s.track === null || Object.hasOwn(oathLabels, s.track)) &&
    typeof s.waterToWheel === 'boolean' &&
    typeof s.drainOpen === 'boolean' &&
    Number.isSafeInteger(s.ringSerial) &&
    s.ringSerial >= 0 &&
    Array.isArray(s.visited) &&
    new Set(s.visited).size === s.visited.length &&
    s.visited.every((id) => Object.hasOwn(oathLabels, id)) &&
    Array.isArray(s.notes) &&
    new Set(s.notes).size === s.notes.length &&
    s.notes.every((id) => Object.hasOwn(oathNotes, id))
  );
}
function oathState(g = game) {
  return (g.oath ??= newOath());
}
function oathEnding(g = game) {
  return g?.oath?.ending || null;
}
function oathVisualState(g = game) {
  const s = g?.oath || newOath(),
    end = oathEndings[s.ending];
  return {
    waterToWheel: s.waterToWheel,
    drainOpen: s.drainOpen,
    dry: !s.waterToWheel && s.drainOpen,
    ringSerial: s.ringSerial,
    ending: s.ending,
    vera: end?.vera || 'station',
    savva: end?.savva || 'chapel',
  };
}
function oathHas(id) {
  return oathState().notes.includes(id);
}
function oathNote(id) {
  const s = oathState();
  if (s.notes.includes(id) || s.ending) return false;
  s.notes.push(id);
  const [name, , xp] = oathNotes[id];
  if (xp) awardXP(xp, name);
  checkpoint();
  return true;
}
function oathPrologueChoice(choice) {
  if (!game || !['token', 'rope'].includes(choice)) return false;
  const s = oathState();
  if (s.intro) return s.intro === choice;
  if (s.ending) return false;
  s.tracked = true;
  s.intro = choice;
  oathNote(choice);
  checkpoint();
  return true;
}
function startOath() {
  if (!game) return false;
  const s = oathState();
  if (!s.ending) {
    s.tracked = true;
    if (!s.track) s.track = 'station';
  }
  checkpoint();
  return true;
}
function oathVisit(id) {
  const s = oathState();
  if (!s.visited.includes(id)) {
    s.visited.push(id);
    checkpoint();
  }
}
function oathRoute() {
  const s = oathState(),
    has = (k) => s.notes.includes(k);
  if (s.ending) {
    const e = oathEndings[s.ending];
    return [e.place, 'Посмотрите, что изменилось. ' + e.name + '.'];
  }
  if (!has('receipt')) return ['ferry', 'Снимите смолу с номерной бирки на сгоревшем причале.'];
  if (!has('roll')) return ['quarry', 'Найдите в каменоломне корешок приказа с тем же номером.'];
  if (!has('dates')) return ['quarry', 'Сложите обе даты в полевом журнале.'];
  if (!has('vera')) return ['station', 'Покажите Вере хронологию из журнала.'];
  if (!has('beat')) return ['aqueduct', 'Проверьте, какой жёлоб заставляет звонницу отвечать.'];
  if (!has('drive'))
    return [
      oathVisualState().dry ? 'belfry' : 'aqueduct',
      oathVisualState().dry
        ? 'Осмотрите дубовый вал под звонницей.'
        : 'Отведите подачу от колеса и откройте слив.',
    ];
  if (!has('savva')) return ['chapel', 'Узнайте у Саввы, кому он подаёт сигнал.'];
  if (!Object.values(oathEndings).some((e) => e.test(s)))
    return ['station', 'Подготовьте слушание у Веры, лодку у Саввы или оттиск у звонницы.'];
  return ['belfry', 'Вернитесь к колоколу и решите судьбу описи.'];
}
function oathGoal() {
  if (!game?.march) return null;
  const s = oathState(),
    [next, text] = oathRoute(),
    id = s.track || next;
  return {
    text: s.track && s.track !== next ? marchSites[id].title + ' · ' + oathLabels[id] : text,
    target: marchSites[id],
    site: id,
  };
}
function oathMap() {
  if (!game?.march) return '';
  const s = oathState(),
    active = oathGoal()?.site;
  return [...new Set([...s.visited, active].filter(Boolean))]
    .map((id) => {
      const { x, z, title } = marchSites[id];
      const focused = id === active;
      return (
        '<g data-oath-place="' +
        id +
        '" fill="none" stroke="' +
        (focused ? '#ffdc82' : '#acc9bb') +
        '" stroke-width="' +
        (focused ? 1.5 : 0.8) +
        '"><title>' +
        title +
        '</title>' +
        '<circle cx="' +
        (184 + x) +
        '" cy="' +
        (224 + z) +
        '" r="' +
        (focused ? 9.2 : 6.5) +
        '"/>' +
        (focused ? '<circle cx="' + (184 + x) + '" cy="' + (224 + z) + '" r="7"/>' : '') +
        '</g>'
      );
    })
    .join('');
}
function oathJournal() {
  if (!game) return '';
  const s = oathState(),
    [next, hint] = oathRoute(),
    e = oathEndings[s.ending];
  const evidence = s.notes
    .map(
      (id) =>
        '<details class="oath-note"><summary>' +
        oathNotes[id][0] +
        '</summary><p>' +
        oathNotes[id][1] +
        '</p></details>',
    )
    .join('');
  const sites = Object.keys(oathLabels)
    .map(
      (id) =>
        '<button type="button" data-oath-track="' +
        id +
        '" aria-pressed="' +
        ((s.track || next) === id) +
        '">' +
        marchSites[id].title +
        '</button>',
    )
    .join('');
  return (
    '<article class="oath-journal"><h3>' +
    oathTitle +
    '</h3><p>' +
    (e ? e.result : hint) +
    '</p>' +
    (e ? '<strong>' + e.name + '</strong>' : '') +
    (game.oathRoadGift && e ? '<p>' + roadLegacies[game.oathRoadGift].result + '</p>' : '') +
    (evidence ? '<h4>Свидетельства и находки</h4>' + evidence : '') +
    (!e && oathHas('roll') && oathHas('receipt') && !oathHas('dates')
      ? '<button class="action" id="oath-compare-journal">Разложить документы по датам</button>'
      : '') +
    '<h4>Поставить отметку</h4><div class="oath-tracks">' +
    sites +
    '</div></article>'
  );
}
function bindOathJournal() {
  for (const b of document.querySelectorAll('[data-oath-track]'))
    b.onclick = () => {
      const s = oathState();
      s.track = s.track === b.dataset.oathTrack ? null : b.dataset.oathTrack;
      s.tracked = !!s.track && !s.ending;
      checkpoint();
      if (typeof journal === 'function') journal('oath');
    };
  const cmp = $('oath-compare-journal');
  if (cmp) cmp.onclick = () => oathCompare([], true);
}
function oathClose() {
  closeModal();
  drawHud();
  capture();
}
const oathBack = ['Отойти', oathClose];
function oathPage(title, body, actions = [], clip = null, insert = '') {
  const row = oathSpeech[clip];
  const speaker = row
    ? '<div class="oath-speaker"><strong>' +
      row[0] +
      '</strong><button type="button" class="rehear" id="oath-rehear" aria-label="Повторить реплику">' +
      icon('sound') +
      '</button></div><p class="oath-spoken">' +
      row[1] +
      '</p>'
    : '';
  modal(
    oathTitle,
    title,
    '<article class="oath-page' +
      (row ? ' oath-talk' : '') +
      '">' +
      (row ? '<div id="portrait-stage" aria-hidden="true"></div>' : '') +
      '<div class="oath-reading">' +
      speaker +
      (body ? '<p>' + body + '</p>' : '') +
      insert +
      '<div class="oath-actions">' +
      actions
        .map(
          ([label, , id], i) =>
            '<button class="action" data-oath-choice="' + (id || i) + '">' + label + '</button>',
        )
        .join('') +
      '</div></div></article>',
  );
  document.querySelectorAll('[data-oath-choice]').forEach((b, i) => (b.onclick = actions[i][1]));
  if (row) {
    openStage(row[0]);
    oathSpeak(clip);
    $('oath-rehear').onclick = () => {
      if (!soundOn) audioToggle();
      oathSpeak(clip);
    };
  }
}
function oathPaper(kind, date, title, body) {
  return (
    '<div class="oath-exhibit ' +
    kind +
    '"><div class="oath-stamp">' +
    date +
    '</div><b>' +
    title +
    '</b><p>' +
    body +
    '</p></div>'
  );
}
function oathFerry() {
  const found = oathHas('receipt');
  const body = found
    ? 'Под медной полосой остался отпечаток той самой верёвки. Бирку вы уже перерисовали.'
    : 'Доски сгорели со стороны берега. Между забитым крюком и сваей зажата полоска меди. На ней наплыв смолы.';
  oathPage('Обугленная свая', body, [
    [
      found ? 'Развернуть оттиск' : 'Снять смолу и перевернуть бирку',
      () => {
        oathNote('receipt');
        oathPage(
          'Последняя выдача',
          'Смола затекла в буквы при пожаре. На обратной стороне — ряд колец, которыми лодочник набивал восьмёрки.',
          [
            [
              oathHas('roll') ? 'Сопоставить с приказом' : 'Убрать оттиск',
              oathHas('roll') ? () => oathCompare([]) : oathClose,
              'compare',
            ],
            oathBack,
          ],
          null,
          oathPaper(
            'copper',
            'XVIII • XI',
            'Двор № 36',
            'Т. Широков получил спасательный канат. Вечерняя выдача.',
          ),
        );
      },
      'receipt',
    ],
    oathBack,
  ]);
}
function oathQuarry() {
  oathPage(
    'Привратницкая у каменоломни',
    'Сюда свезли сухие книги гарнизона. В журнале рядом с описью оставлены обрезки шнура и два корешка разной ширины.',
    [
      [
        'Прочесть накладную № 63',
        () =>
          oathPage(
            'Подвода камня',
            'XVII ноября. Двор № 63 привёз плитняк для починки шлюза. К перевозчикам эта строка не относится.',
            [['Вернуться к книге', oathQuarry, 'book'], oathBack],
          ),
        'wrongleaf',
      ],
      [
        'Поднять корешок № 36',
        () => {
          oathNote('roll');
          oathPage(
            'Караульный дубликат',
            'Основной лист отрезан. Корешок вшит между листами за шестнадцатое и девятнадцатое ноября. На нём остались дата, номер и подпись.',
            [
              [
                oathHas('receipt') ? 'Сопоставить с биркой' : 'Переписать корешок',
                oathHas('receipt') ? () => oathCompare([]) : oathClose,
                'compare',
              ],
              oathBack,
            ],
            null,
            oathPaper(
              'register',
              'XVII • XI',
              'С довольствия сняты',
              'Двенадцать дворов перевозчиков. № 36 и следующие. Основание: самовольный уход. Переписала В. Ланская.',
            ),
          );
        },
        'roll',
      ],
      oathBack,
    ],
  );
}
function oathCompare(order, journalReturn = false) {
  const leave = journalReturn ? () => journal('oath') : oathClose;
  if (!oathHas('roll') || !oathHas('receipt')) return;
  if (oathHas('dates'))
    return oathPage('Пропавшие сутки', oathNotes.dates[1], [['Убрать документы', leave, 'leave']]);
  if (order.length === 2) {
    if (order[0] !== 'roll')
      return oathPage(
        'Порядок не сходится',
        'Восемнадцатое ноября следует за семнадцатым. Посмотрите, когда двор вычеркнули и когда тому же двору выдали канат.',
        [
          ['Разложить заново', () => oathCompare([], journalReturn), 'retry'],
          ['Отложить', leave],
        ],
      );
    return oathPage(
      'Один номер, два дня',
      'Утром семнадцатого двор № 36 якобы ушёл навсегда. Вечером восемнадцатого семья получила канат для гарнизона. Какое показание можно предъявить?',
      [
        [
          'Канат выдали другому двору',
          () =>
            oathPage(
              'Не совпадает с оттиском',
              'На обоих корешках один номер. Накладная на камень действительно чужая, но она имеет номер 63.',
              [['Вернуться к выводу', () => oathCompare(order, journalReturn), 'retry']],
            ),
          'wrong',
        ],
        [
          'Людей объявили беглецами задним числом',
          () => {
            oathNote('dates');
            oathPage(
              'Пропавшие сутки',
              'Оттиски легли рядом: XVII и XVIII. Вера может объяснить свою подпись.',
              [['Закрыть папку', leave, 'leave']],
            );
          },
          'prove',
        ],
      ],
    );
  }
  const choices = [
    ['roll', 'Гарнизонный приказ · XVII'],
    ['receipt', 'Выдача каната · XVIII'],
  ]
    .filter(([id]) => !order.includes(id))
    .map(([id, label]) => [label, () => oathCompare([...order, id], journalReturn), id]);
  oathPage(
    order.length ? 'Второе событие' : 'Как началась эта история?',
    'Разложите подлинники от раннего события к позднему. Потом выберите, что они действительно доказывают.',
    [...choices, ['Отложить', leave, 'leave']],
    null,
    oathPaper(
      'compare',
      '№ 36',
      order.length ? (order[0] === 'roll' ? 'I. Приказ гарнизона' : 'I. Выдача каната') : 'I. Пустое место',
      'II. Пустое место',
    ),
  );
}
function oathVera() {
  const s = oathState(),
    known = oathHas('vera');
  const clip = known
    ? 'vera-price'
    : oathHas('roll')
      ? 'vera-firstproof'
      : s.intro === 'token'
        ? 'vera-token'
        : s.intro === 'rope'
          ? 'vera-rope'
          : oathHas('receipt')
            ? 'vera-first'
            : 'vera-plain';
  const actions = [];
  if (game.side === 1 && oathHas('roll') && !oathHas('watch'))
    actions.push([
      'Предъявить знак караула и вскрыть подлинный приказ',
      () => {
        oathNote('watch');
        oathPage(
          'Право сменного караула',
          'Вера сверила ваш знак с петлёй на сургуче. В пакете лежит приказ поджечь оба парома. Теперь её можно расспросить о подписи, даже пока пристань не осмотрена.',
          [['Развернуть приказ на столе', oathVera, 'back'], oathBack],
          'vera-watch',
        );
      },
      'watch',
    ]);
  if (!known && (oathHas('dates') || oathHas('watch')))
    actions.push([
      oathHas('dates') ? 'Предъявить оба документа' : 'Предъявить вскрытый приказ',
      () => {
        oathNote('vera');
        oathPage(
          'Дата под подписью',
          'Вера вынимает из крышки чернильницы сложенный приказ. После слова «огонь» стоит печать гарнизона. На обороте она записала настоящую дату.',
          [['Спросить о сестре', oathVera, 'sister'], oathBack],
          'vera-admit',
        );
      },
      'admit',
    ]);
  if (known)
    actions.push([
      'Спросить, кто приказал открыть огонь',
      () =>
        oathPage(
          'Приказ с печатью',
          'На листе указана цель — оба парома. Ниже рукой начальника караула добавлено: «Не ждать, пока сойдут люди». Рядом круглый оттиск гарнизона.',
          [['Вернуться к показаниям', oathVera, 'back'], oathBack],
          'vera-command',
        ),
      'command',
    ]);
  if (known && !oathHas('signature'))
    actions.push([
      'Попросить заверить показание',
      () => {
        oathNote('signature');
        oathPage(
          'Свидетель по делу',
          'Она подписала оба оттиска. На слушание Вера согласна идти под полным именем.',
          [['Забрать свидетельство', oathClose, 'leave']],
          'vera-sworn',
        );
      },
      'sign',
    ]);
  actions.push(
    [
      'Спросить, где хранят книги',
      () =>
        oathPage(
          'Одна копия для караула',
          'Привратницкая находится у каменоломни на восточном берегу. Номер двора нужен и на бирке, и в книге. Совпадения одних дат недостаточно.',
          [['Вернуться к столу', oathVera, 'back'], oathBack],
        ),
      'hint',
    ],
    oathBack,
  );
  oathPage(
    'Вера Ланская',
    known
      ? 'Заверенная копия позволит возобновить дело. Вместе с погибшими в оглашённый список попадут живые.'
      : 'Бывшая переписчица держит перо тремя пальцами. Ноготь на среднем испачкан фиолетовыми чернилами.',
    actions,
    clip,
  );
}
function oathSavva() {
  const s = oathState(),
    heard = oathHas('savva'),
    drive = oathHas('drive');
  const clip = heard
    ? 'savva-offer'
    : drive
      ? 'savva-motor'
      : s.intro === 'rope'
        ? 'savva-rope'
        : 'savva-first';
  const actions = [];
  if (game.side === 0 && !oathHas('grove'))
    actions.push([
      'Поручиться за двух перевозчиков перед лесным дозором',
      () => {
        oathNote('grove');
        oathPage(
          'Лесная тропа',
          'Вы выломили развилку рябины и передали её мальчику у часовни. Двое скрывавшихся перевозчиков пройдут в лесу мимо вашей дозорной смены. Савва снимает рукавицу.',
          [['Вернуться к свидетельству', oathSavva, 'back'], oathBack],
          'savva-grove',
        );
      },
      'grove',
    ]);
  if (game.side === 2 && !oathHas('wage'))
    actions.push([
      'Нанять сменщика для затвора · 8 серебряных',
      () => {
        if (game.coins < 8)
          return oathPage(
            'Плата за ночную смену',
            'Мельник просит восемь серебряных. Вы можете вернуться с деньгами или перевести затворы самостоятельно.',
            [['Вернуться к Савве', oathSavva, 'back'], oathBack],
          );
        game.coins -= 8;
        oathNote('wage');
        oathPage(
          'Ночная смена мельника',
          'Савва отсчитал плату в суконный мешочек и послал за мельником. Через окошко часовни виден условный фонарь у Западного затвора.',
          [['Договориться о сигналах', oathSavva, 'back'], oathBack],
          'savva-wage',
        );
      },
      'wage',
    ]);
  if (oathHas('wage'))
    actions.push([
      s.drainOpen ? 'Приказать сменщику закрыть нижний слив' : 'Приказать сменщику открыть нижний слив',
      () => {
        s.drainOpen = !s.drainOpen;
        checkpoint();
        oathPage(
          'Ответ с водовода',
          s.drainOpen
            ? 'Мельник поднял фонарь. Нижний слив на Западном затворе открыт.'
            : 'Мельник опустил фонарь. Нижний слив на Западном затворе закрыт.',
          [['Опустить сигнальный фонарь', oathSavva, 'back'], oathBack],
        );
      },
      'relay',
    ]);
  if (!heard && (drive || oathHas('grove') || (oathHas('receipt') && s.intro === 'rope')))
    actions.push([
      'Спросить, кого ждали на нижнем пароме',
      () => {
        oathNote('savva');
        oathPage(
          'Два парома',
          'Савва переворачивает ладонь. Старая борозда от пеньки пересекает линию жизни. Он называет брата первым и только потом перечисляет тех семерых.',
          [['Узнать о живых', oathSavva, 'next'], oathBack],
          'savva-tale',
        );
      },
      'testify',
    ]);
  if (heard)
    actions.push([
      'Спросить, почему звонят ночью',
      () =>
        oathPage(
          'Ночная вода',
          'Свежие зарубки на дубовом пальце — один удар на одну переправу. С водою из мельничного жёлоба этот сигнал не услышишь со станции.',
          [['Вернуться к Савве', oathSavva, 'back'], oathBack],
          'savva-night',
        ),
      'night',
    ]);
  if (heard && !oathHas('boat'))
    actions.push([
      'Оставить три места за семьёй Веры',
      () => {
        oathNote('boat');
        oathPage(
          'Три места до рассвета',
          'Савва убирает заднюю банку: два места на доске, третье на мешке под носом. Для отхода нужен открытый слив.',
          [['Вернуться к Савве', oathSavva, 'back'], oathBack],
          'savva-offer',
        );
      },
      'boat',
    ]);
  if (heard && oathHas('names') && !oathHas('word'))
    actions.push([
      'Показать пустую строку на ободе',
      () => {
        oathNote('word');
        oathPage(
          'Двенадцатое имя',
          'Савва вывел на воске «Тимофей Широков». Рядом вдавил старый перстень перевозчиков. Без его показания община не взяла бы на себя зимнюю смену.',
          [['Завернуть восковой оттиск', oathClose, 'leave']],
          'savva-sworn',
        );
      },
      'word',
    ]);
  actions.push(
    [
      'Спросить о течении',
      () =>
        oathPage(
          'Две деревянные трубы',
          'На Западном затворе управление подачей расположено выше слива. Для осмотра вала надо убрать напор и выпустить воду из колодца.',
          [['Вернуться к Савве', oathSavva, 'back'], oathBack],
        ),
      'hint',
    ],
    oathBack,
  );
  oathPage(
    'Савва Широков',
    heard
      ? 'На вёслах, сложенных у стены часовни, три свежие полоски дёгтя.'
      : 'У двери сушится просмолённая рукавица. На полу стоит игрушечный паром, вырезанный из коры.',
    actions,
    clip,
  );
}
function oathRing() {
  const s = oathState();
  s.ringSerial++;
  tone(155, 1.45, 'sine', 0.11);
  tone(416, 0.8, 'sine', 0.04);
  tone(593, 0.38, 'triangle', 0.02);
}
function oathSluice(message = '') {
  const s = oathState(),
    dry = oathVisualState().dry;
  const status = dry
    ? 'В смотровой щели сухо. Вал стоит.'
    : s.waterToWheel
      ? s.drainOpen
        ? 'Струя крутит вал, слив работает под напором.'
        : 'Под тёмной водой медленно движется тяга.'
      : 'Вода в колодце стоит по верхнюю риску. Вал неподвижен.';
  const buttons = [
    [
      s.waterToWheel ? 'Перевести подачу в обход' : 'Пустить воду к колесу',
      () => {
        s.waterToWheel = !s.waterToWheel;
        checkpoint();
        oathSluice(
          s.waterToWheel
            ? 'Из деревянной трубы потянуло холодом.'
            : 'Спица прошла ещё четверть оборота и остановилась.',
        );
      },
      'inlet',
    ],
    [
      s.drainOpen ? 'Закрыть нижний слив' : 'Открыть нижний слив',
      () => {
        s.drainOpen = !s.drainOpen;
        checkpoint();
        oathSluice(
          s.drainOpen ? 'В нижней канаве зашумела вода.' : 'Под настилом захлопнулась деревянная заслонка.',
        );
      },
      'drain',
    ],
    [
      'Нажать пробную педаль',
      () => {
        if (s.waterToWheel) {
          oathRing();
          oathNote('beat');
          checkpoint();
          oathSluice('Один низкий удар пришёл сверху по долине. Дубовый вал зацепил тягу.');
        } else oathSluice('Педаль опустилась бесшумно. Без подачи воды колёса не вращаются.');
      },
      'pulse',
    ],
    oathBack,
  ];
  oathPage(
    'Западный затвор',
    message ||
      'Под медной табличкой вырублена схема двух труб. Подача питает водяное колесо. Через нижнюю трубу можно опорожнить колодец под звонницей.',
    buttons,
    null,
    '<div class="oath-flow"><span>Подача <b>' +
      (s.waterToWheel ? 'К колесу' : 'В обход') +
      '</b></span><span>Слив <b>' +
      (s.drainOpen ? 'Открыт' : 'Закрыт') +
      '</b></span><p>' +
      status +
      '</p></div>',
  );
}
function oathReady() {
  return ['dates', 'drive', 'savva', 'vera'].every(oathHas);
}
function oathBelfry() {
  const dry = oathVisualState().dry;
  const buttons = [];
  if (!oathHas('drive') && dry)
    buttons.push([
      'Спуститься к высохшему валу',
      () => {
        oathNote('drive');
        oathPage(
          'Палец в валу',
          'От водяного колеса сюда тянется длинный трос. На валу под колоколом блестит протёртая канавка. Чтобы тяга зацепила язык, кто-то каждый вечер вставляет свежий деревянный палец. На нём отпечаток дёгтя.',
          [['Осмотреть обод', oathBelfry, 'back'], oathBack],
        );
      },
      'drive',
    ]);
  if (oathHas('drive') && dry && !oathHas('names'))
    buttons.push([
      'Снять воском надпись с обода',
      () => {
        oathNote('names');
        oathPage(
          'Воск на металле',
          'Одиннадцать имён вырезаны по горячему металлу. Двенадцатое стесали напильником. Вмятины от первой и последней букв ещё различимы.',
          [['Унести оттиск', oathClose, 'leave']],
        );
      },
      'names',
    ]);
  if (oathReady()) buttons.push(['Разложить опись у колокола', oathChoose, 'choose']);
  buttons.push(['Свериться с записями', () => journal('oath'), 'journal'], oathBack);
  oathPage(
    'Колодец под звонницей',
    dry
      ? 'Лязг шагов отражается от стен. Над сухим валом на раскосах висит колокол с бурой ватерлинией.'
      : 'Под открытым люком вода. В глубине белеет изогнутый бронзовый край. По западному водоводу сюда приходит напор, сбоку уходит слив.',
    buttons,
  );
}
function oathChoose() {
  if (!oathReady() || oathState().ending) return oathBelfry();
  const s = oathState();
  const actions = Object.entries(oathEndings).map(([id, e]) => [
    e.name,
    () => {
      if (!e.test(s)) return oathPage(e.name, e.need, [['К другим решениям', oathChoose, 'back'], oathBack]);
      oathPage(e.name, e.warn, [
        [e.line, () => oathFinish(id), 'confirm'],
        ['Свернуть опись и подумать', oathChoose, 'back'],
      ]);
    },
    id,
  ]);
  oathPage(
    'У кого останется опись?',
    'У вас единственный подлинный лист со всеми двенадцатью дворами. Отдать его можно только один раз. Сначала можно выслушать условия любого решения.',
    [...actions, oathBack],
  );
}
function oathFinish(id) {
  const s = oathState(),
    e = oathEndings[id];
  if (!e || s.ending || !oathReady() || !e.test(s)) return;
  s.ending = id;
  s.tracked = false;
  s.track = null;
  s.waterToWheel = id === 'vigil';
  s.drainOpen = id === 'refuge';
  if (id === 'vigil') oathRing();
  awardXP(e.xp, e.name);
  game.story.entries.push([e.name, e.result]);
  checkpoint();
  oathPage(
    e.name,
    e.result,
    [
      [
        e.other.startsWith('vera') ? 'Дослушать Веру' : 'Дослушать Савву',
        () => oathPage(e.name, e.result, [['Убрать опись', oathClose, 'leave']], e.other),
        'other',
      ],
      ['Вернуться в долину', oathClose, 'leave'],
    ],
    e.clip,
  );
}
function oathAfter(id) {
  const s = oathState(),
    e = oathEndings[s.ending];
  const actions =
    id === e.place
      ? [
          [
            e.clip.startsWith('vera') ? 'Выслушать Веру' : 'Выслушать Савву',
            () => oathPage(e.name, e.result, [oathBack], e.clip),
            'first',
          ],
          [
            e.other.startsWith('vera') ? 'Выслушать Веру' : 'Выслушать Савву',
            () => oathPage(e.name, e.result, [oathBack], e.other),
            'second',
          ],
          oathBack,
        ]
      : [oathBack];
  const traces = {
    hearing: {
      station: e.result,
      ferry: 'У швартовочного крюка погас фонарь. Судебная лодка стоит у пристани.',
      chapel: 'Савва ушёл на станцию. В щель двери засунута повестка.',
      belfry: 'Механизм опечатан до окончания слушания.',
    },
    refuge: {
      station: 'Два отрезанных шнурка лежат на столе Веры. Корешок реестра пуст.',
      ferry: e.result,
      chapel: 'Сняты три тёплые куртки. Воск в лампаде догорел.',
      belfry: 'Дубовый палец вынут. Вода свободно уходит через нижний слив.',
    },
    vigil: {
      station: 'На столе лежит договор о зимнем залоге.',
      chapel: 'На двери мелом написана первая смена: Вера Ланская, Савва Широков.',
      ferry: 'У причала прибита расписка общины за зимнее содержание перевозчиков.',
      belfry: e.result,
    },
  };
  oathPage(
    marchSites[id].title,
    traces[s.ending][id] || 'В описи главы записано последнее решение. ' + e.result,
    actions,
  );
}
const oathScenes = {
  station: oathVera,
  quarry: oathQuarry,
  ferry: oathFerry,
  chapel: oathSavva,
  aqueduct: oathSluice,
  belfry: oathBelfry,
};
function marchQuestAction(id) {
  if (!Object.hasOwn(oathScenes, id)) return null;
  return oathEnding() ? 'Осмотреть · ' + marchSites[id].title : oathLabels[id];
}
function marchQuestUse(id) {
  if (!game?.march || !Object.hasOwn(oathScenes, id)) return false;
  const s = oathState();
  if (s.track === id) {
    s.track = null;
    checkpoint();
  }
  oathVisit(id);
  if (oathEnding()) oathAfter(id);
  else oathScenes[id]();
  return true;
}
function oathOption() {
  if (!game?.march) return null;
  const a = marchAction();
  return a && oathScenes[a.id] ? { ...a, oathSite: a.id, a: marchSites[a.id] } : null;
}
function oathUse(option) {
  return marchQuestUse(option?.oathSite || option?.id);
}
function oathTick() {
  if (!game?.march) return;
  const p = game.march;
  for (const id of Object.keys(oathScenes)) {
    const s = marchSites[id];
    if (Math.hypot(p.x - s.x, p.z - s.z) < 5.2) oathVisit(id);
  }
}

const roadLegacies = {
  hearing: {
    title: 'Выписка из судебной книги',
    action: 'Расписаться за дорожные деньги',
    text: 'К листу приколота копия определения суда. Под описью Вера вписала и ваш путь к каменоломне. За доставленные подлинники земская касса отложила восемнадцать монет.',
    result: 'В дорожной книге осталась ваша расписка. Получено 18 монет.',
  },
  refuge: {
    title: 'Последняя тележка',
    action: 'Принять свёрток с полотном',
    text: 'На пустой тележке остались три перевязочных пакета. К ручке привязана записка Саввы. «Мы дошли. Для дороги у тебя осталось меньше, чем было. Возьми».',
    result: 'Вы забрали три чистых бинта. Кожаные перевязи остались на тележке.',
  },
  vigil: {
    title: 'Огонь для сменщика',
    action: 'Взять дорожный фонарь',
    text: 'У вахтенного огня висит малый фонарь. На медной ручке вырезано имя Тимофея. Звонарь оставил его тому, кто разыскал двенадцатое имя.',
    result:
      'Вы получили дорожный фонарь. Клавиша L зажигает и гасит его. На сенсорном экране фонарь доступен в меню привала.',
  },
};
function roadsideRecord() {
  const ending = oathEnding(game),
    note = roadLegacies[ending];
  if (!note) return;
  const claimed = game.oathRoadGift === ending;
  modal(
    'Западная переправа',
    note.title,
    '<p>' +
      note.text +
      '</p>' +
      (claimed ? '<p>' + note.result + '</p>' : '') +
      actions(
        claimed
          ? [['road-back', 'Отойти']]
          : [
              ['road-claim', note.action],
              ['road-back', 'Отойти'],
            ],
      ),
  );
  $('road-back').onclick = () => {
    closeModal();
    capture();
  };
  if (!claimed)
    $('road-claim').onclick = () => {
      if (game.oathRoadGift) return;
      game.oathRoadGift = ending;
      if (ending === 'hearing') game.coins += 18;
      if (ending === 'refuge') game.bandages += 3;
      if (ending === 'vigil') game.lanternLit = true;
      checkpoint();
      roadsideRecord();
      drawHud();
    };
}
function toggleRoadLamp() {
  if (game?.oathRoadGift !== 'vigil') return;
  game.lanternLit = !game.lanternLit;
  notify(game.lanternLit ? 'Дорожный фонарь зажжён' : 'Фонарь погашен', 1.5);
  if ($('road-lamp'))
    $('road-lamp').textContent = game.lanternLit ? 'Погасить дорожный фонарь' : 'Зажечь дорожный фонарь';
  world.refreshFrame = true;
}
function drawRoadLamp(realm, s) {
  if (!realm.roadLamp && s.oathRoadGift === 'vigil') {
    const lamp = new THREE.PointLight(0xffbc78, 5.8, 10, 2);
    lamp.position.set(-0.19, -0.35, -0.12);
    realm.camera.add(lamp);
    realm.roadLamp = lamp;
  }
  if (realm.roadLamp) realm.roadLamp.visible = !!(s.oathRoadGift === 'vigil' && s.lanternLit && !s.delivery);
}
