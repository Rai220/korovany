'use strict';

const fieldSites = {
  ferry: {
    title: 'Старая звонница',
    x: -87,
    z: -24,
    approach: [0, 1.95],
    case: 'river',
    label: 'Говорить с перевозчицей Радой',
  },
  gauge: {
    title: 'Паводковая рейка',
    x: -95,
    z: -7,
    approach: [-1.64, 0],
    case: 'river',
    label: 'Осмотреть водомерную рейку',
  },
  camp: {
    title: 'Стан угольщиков',
    x: -77,
    z: 75,
    approach: [0, 2.1],
    case: 'names',
    label: 'Говорить с хранительницей Лист',
  },
  kiln: {
    title: 'Печь у сосен',
    x: -80,
    z: 29,
    approach: [-1.96, 0],
    case: 'names',
    label: 'Разгрести остывшие угли',
  },
  memorial: {
    title: 'Камень артели',
    x: -105,
    z: 91,
    approach: [0, 1.72],
    case: 'names',
    label: 'Снять оттиск с артельного камня',
  },
  observatory: {
    title: 'Медная обсерватория',
    x: 63,
    z: 68,
    approach: [0, 1.98],
    case: 'glass',
    label: 'Говорить с картографом Эсмой',
  },
  shard: {
    title: 'Стеклянная осыпь',
    x: 26,
    z: 61,
    approach: [0, 1.62],
    case: 'glass',
    label: 'Осмотреть место удара',
  },
  mast: {
    title: 'Северная сигнальная веха',
    x: 94,
    z: 99,
    approach: [0, -1.6],
    case: 'glass',
    label: 'Осмотреть драконью седловину',
  },
  reeds: {
    title: 'Тайник лодочника',
    x: -112,
    z: -6,
    approach: [-1.43, 0],
    case: 'river',
    cache: true,
    label: 'Приподнять скрещённые вёсла',
  },
  cairn: {
    title: 'Закладка под корнем',
    x: -114,
    z: 77,
    approach: [0, 1.44],
    case: 'names',
    cache: true,
    label: 'Обыскать корни поваленного дерева',
  },
  survey: {
    title: 'Тубус землемера',
    x: 67,
    z: 80,
    approach: [0, 1.43],
    case: 'glass',
    cache: true,
    label: 'Открыть футляр у треноги',
  },
};
const fieldCases = {
  river: {
    title: 'Три удара над водой',
    start: 'ferry',
    rumor: 'К западу от мельницы, на дороге к излучине, стоит звонница без языка. Перевозчица ночует рядом.',
    accent: 'river',
  },
  names: {
    title: 'Имя под пеплом',
    start: 'camp',
    rumor:
      'К юго-западу от эльфийских домов угольщики ставят новый поминальный камень. На нём оставили пустую строку.',
    accent: 'names',
  },
  glass: {
    title: 'Чёрное стекло',
    start: 'observatory',
    rumor:
      'Из горного форта отправились на юг с медной трубой. Картограф ищет того, кто сумеет вернуть в неё свет.',
    accent: 'glass',
  },
};
const fieldEvidence = {
  gauge:
    'На рейке одна широкая насечка и две узкие. Клепало широкой пластины даёт низкий тон, узкой — высокий.',
  token:
    'Лицевая сторона жетона несёт общий ворон артели. На обороте, под сажей, остались развилка и одна точка.',
  register: 'Знаки в списке артели: Лада — две точки; Юрко — развилка с точкой; Терен — косая черта.',
  shard:
    'На обгоревшей оправе две риски по шесть градусов. Борозда удара тянется с северо-запада на юго-восток. Копоть лежит на юго-восточном краю.',
};
const fieldCacheNotes = {
  reeds: [
    'От водомерной рейки идите примерно семнадцать шагов на запад вдоль берега. Ищите два скрещённых весла.',
    'Под крышкой сухой кошель. Внутри 16 монет и два свёртка полотна.',
  ],
  cairn: [
    'У артельного камня идите к северо-западу, к корню в шестнадцати шагах. В его развилке лежат три камня.',
    'Три старых наконечника прикрывают промасленный колчан и кошель. Двенадцать стрел и девять монет сохранились.',
  ],
  survey: [
    'За обсерваторией пройдите двенадцать шагов на юг, немного забирая на восток. Тубус лежит под сломанной треногой.',
    'В латунном тубусе под калькой оказались 14 монет на обратную дорогу и три бинта.',
  ],
};
realmVoice.register(Object.values(fieldSpeech));
Object.assign(dialogueCast, fieldPortraits);

function fieldState(g = game) {
  if (!g.exploration)
    g.exploration = { visited: [], paid: [], choices: {}, tracked: null, bearing: 0, tilt: 0 };
  return g.exploration;
}
function fieldPoint(id) {
  const p = fieldSites[id];
  return { x: p.x + p.approach[0], z: p.z + p.approach[1] };
}
function fieldHas(key) {
  return fieldState().paid.includes(key);
}
function fieldPay(key, xp, reason, apply) {
  const s = fieldState();
  if (s.paid.includes(key)) return false;
  s.paid.push(key);
  if (apply) apply(s);
  awardXP(xp, reason);
  checkpoint();
  return true;
}
function fieldFinish(name, choice, xp, reward, result) {
  fieldPay(name + '-complete', xp, fieldCases[name].title, (s) => {
    s.choices[name] = choice;
    if (s.tracked === name) s.tracked = null;
    reward();
  });
  return fieldPage(name, 'Запись завершена', result, [['Вернуться на тракт', fieldClose]]);
}
function fieldRoute(name) {
  const s = fieldState();
  if (s.choices[name]) return null;
  const begin = fieldCases[name];
  if (!fieldHas(name + '-begun')) return [begin.start, begin.rumor];
  if (name === 'river') {
    if (!fieldHas('gauge')) return ['gauge', 'Прочтите зарубки на рейке у западной излучины.'];
    if (!fieldHas('tuned')) return ['ferry', 'Вернитесь к колоколам и восстановите речной сигнал.'];
    return ['ferry', 'Решите, кому Рада передаст ключ от звонницы.'];
  }
  if (name === 'names') {
    if (!fieldHas('token')) return ['kiln', 'Отыщите жетон у заброшенной печи на север от стана.'];
    if (!fieldHas('register')) return ['memorial', 'Снимите оттиск с артельного камня в юго-западном лесу.'];
    if (!fieldHas('named')) return ['camp', 'Сличите личный знак с артельным списком и назовите погибшего.'];
    return ['camp', 'Выберите, где оставить именной жетон.'];
  }
  if (!fieldHas('shard')) return ['shard', 'Найдите тёмное стекло на северо-западе от обсерватории.'];
  if (!fieldHas('aligned'))
    return ['observatory', 'Установите линзу, выставьте направление и угол подъёма трубы.'];
  if (heroLevel() < 5)
    return [null, 'Для наблюдения за Саргатом нужен V уровень. Полевые работы и тайники дают опыт.'];
  return [
    'mast',
    'На северной вехе разверните указатель ветра и осмотрите Саргата с безопасного расстояния.',
  ];
}
function fieldQuestGoal() {
  if (!game || game.inside || game.dungeon || game.delivery) return null;
  const id = fieldState().tracked;
  if (!id) return null;
  if (fieldSites[id]?.cache)
    return fieldHas(id)
      ? null
      : { text: fieldSites[id].title + ' · ' + fieldCacheNotes[id][0], target: fieldPoint(id) };
  const route = fieldCases[id] && fieldRoute(id);
  return route
    ? { text: fieldCases[id].title + ' · ' + route[1], target: route[0] ? fieldPoint(route[0]) : null }
    : null;
}
function fieldQuestMap() {
  if (!game) return '';
  return fieldState()
    .visited.map((id) => {
      const s = fieldSites[id],
        p = fieldPoint(id),
        done = s.cache ? fieldHas(id) : !!fieldState().choices[s.case];
      return `<i class="field-map-mark ${s.cache ? 'cache ' : ''}${done ? 'resolved' : ''}" aria-label="${s.title}" title="${s.title}" style="left:${((p.x + WORLD_LIMIT) / PERIOD) * 100}%;top:${((p.z + WORLD_LIMIT) / PERIOD) * 100}%"></i>`;
    })
    .join('');
}
function fieldTrack(id) {
  const s = fieldState();
  s.tracked = s.tracked === id ? null : id;
  if (s.tracked) {
    game.markHall = game.markMarch = null;
    if (game.oath) game.oath.tracked = false;
    game.trackHunt = null;
  }
  checkpoint();
  drawHud();
}
function fieldQuestJournal() {
  const s = fieldState();
  const mark = (id) =>
    `<button class="action field-track" data-field-track="${id}" aria-pressed="${s.tracked === id}">${s.tracked === id ? 'Снять с компаса' : 'Отметить на компасе'}</button>`;
  const notes = (keys) =>
    keys
      .filter(fieldHas)
      .map((k) => `<li>${fieldEvidence[k]}</li>`)
      .join('');
  const cards = Object.entries(fieldCases)
    .map(([id, c]) => {
      const r = fieldRoute(id),
        entries = notes(id === 'river' ? ['gauge'] : id === 'names' ? ['token', 'register'] : ['shard']);
      const status = s.choices[id] ? 'Завершено' : fieldHas(id + '-begun') ? 'В работе' : 'Слух';
      return `<section class="field-record"><header><b>${c.title}</b><small>${status}</small></header><p>${r ? r[1] : fieldOutcome(id)}</p>${entries ? '<ul>' + entries + '</ul>' : ''}${r ? mark(id) : ''}</section>`;
    })
    .join('');
  const caches = Object.entries(fieldCacheNotes)
    .filter(([id]) => fieldCacheKnown(id))
    .map(
      ([id, [hint]]) =>
        `<li><b>${fieldSites[id].title}</b> · ${fieldHas(id) ? 'припасы получены' : hint}${fieldHas(id) ? '' : mark(id)}</li>`,
    )
    .join('');
  return `<section class="field-journal"><h3>Полевые исследования</h3>${cards}${caches ? '<h4>Закладки на полях</h4><ul class="field-cache-list">' + caches + '</ul>' : ''}<p>Найдено мест — ${s.visited.length} из ${Object.keys(fieldSites).length}.</p></section>`;
}
function bindFieldJournal() {
  for (const button of document.querySelectorAll('[data-field-track]'))
    button.onclick = () => {
      fieldTrack(button.dataset.fieldTrack);
      journal();
    };
}
function fieldCacheKnown(id) {
  const clue = { reeds: 'gauge', cairn: 'register', survey: 'aligned' }[id];
  return fieldHas(id) || fieldHas(clue) || fieldState().visited.includes(id);
}
function fieldOutcome(id) {
  const choice = fieldState().choices[id];
  if (id === 'river')
    return choice === 'shelter'
      ? 'Ключ от звонницы у семей с переправы. Рада держит сигнальный фонарь зажжённым и бесплатно перевязывает путников.'
      : 'За звонницей смотрит купеческая артель. В ящике перевозчицы продаются полные колчаны по четыре монеты.';
  if (id === 'names')
    return choice === 'kin'
      ? 'Жетон Юрко отдан его сестре. У стана вывешена лента с именем, в печи снова сушат чистое полотно.'
      : 'Жетон Юрко закреплён на поминальном камне. У камня для путников оставили бинты.';
  return choice === 'pilots'
    ? 'Веха развёрнута к дороге: с перевала виден белый знак безопасного обхода.'
    : 'Веха обращена к гнезду: янтарная лопасть отмечает подъём тёплого воздуха над седловиной.';
}
function fieldClose() {
  closeModal();
  drawHud();
  capture();
}
function fieldPage(id, title, body, buttons, clip, detail = '') {
  const row = fieldSpeech[clip];
  modal(
    fieldCases[id].title,
    title,
    `<article class="field-sheet ${id}"><div class="field-print${row ? ' field-person' : ''}" ${row ? 'id="portrait-stage"' : ''} aria-hidden="true"></div><div class="field-copy">${row ? `<div class="speaker-line"><strong>${row[0]}</strong><button id="field-rehear" class="rehear" title="Повторить голос" aria-label="Повторить голос">${icon('sound')}</button></div><p class="field-quote">${row[1]}</p>` : ''}<p>${body}</p>${detail}<div class="field-options">${buttons.map(([label], i) => `<button class="action" data-field-choice="${i}">${label}</button>`).join('')}</div></div></article>`,
  );
  if (row) {
    openStage(row[0]);
    realmVoice.play(row[0], row[1]);
    $('field-rehear').onclick = () => {
      if (!soundOn) audioToggle();
      realmVoice.play(row[0], row[1]);
    };
  }
  for (const b of document.querySelectorAll('[data-field-choice]'))
    b.onclick = () => buttons[Number(b.dataset.fieldChoice)][1]();
}
function fieldBegin(id) {
  fieldPay(id + '-begun', 10, fieldCases[id].title, (s) => {
    s.tracked = id;
    game.markHall = game.markMarch = null;
    if (game.oath) game.oath.tracked = false;
    game.trackHunt = null;
  });
  fieldClose();
}
function fieldEvidencePage(id, site, clue, xp, body, cache) {
  fieldPay(clue, xp, fieldSites[site].title);
  const note = cache ? `<aside><b>Помета на полях</b><p>${fieldCacheNotes[cache][0]}</p></aside>` : '';
  fieldPage(id, fieldSites[site].title, body, [['Запомнить и отойти', fieldClose]], null, note);
}
function fieldCache(id) {
  const site = fieldSites[id];
  if (fieldHas(id))
    return fieldPage(site.case, site.title, 'Закладка пуста. Полученные припасы отмечены в журнале.', [
      ['Отойти', fieldClose],
    ]);
  return fieldPage(site.case, site.title, fieldCacheNotes[id][1], [
    [
      'Забрать припасы',
      () => {
        fieldPay(id, 40, site.title, (s) => {
          game.coins += { reeds: 16, cairn: 9, survey: 14 }[id];
          game.bandages += { reeds: 2, cairn: 0, survey: 3 }[id];
          if (id === 'cairn') game.arrows += 12;
          if (s.tracked === id) s.tracked = null;
        });
        fieldClose();
        notify('Припасы в сумке · ' + site.title);
      },
    ],
    ['Оставить на месте', fieldClose],
  ]);
}
function fieldDials(name, items, value) {
  return `<div class="field-dial"><span>${name}</span><b>${items[value]}</b></div>`;
}
const fieldBearings = ['северо-восток', 'юго-восток', 'юго-запад', 'северо-запад'],
  fieldPitches = ['0°', '12°', '30°'];
function fieldScope(message = '') {
  const s = fieldState();
  const sights = fieldDials('Азимут', fieldBearings, s.bearing) + fieldDials('Подъём', fieldPitches, s.tilt);
  const turn = (key, n) => () => {
    s[key] = (s[key] + 1) % n;
    checkpoint();
    fieldScope();
  };
  fieldPage(
    'glass',
    'Наводка медной трубы',
    message ||
      'Вставленная линза даёт резкое изображение. Выставьте азимут по борозде, подъём — по двум рискам оправы.',
    [
      ['Повернуть алидаду', turn('bearing', 4)],
      ['Поднять окуляр', turn('tilt', 3)],
      [
        'Взглянуть в трубу',
        () => {
          if (s.bearing !== 1 || s.tilt !== 1)
            return fieldScope(
              s.bearing !== 1
                ? 'В окуляре склон без обгоревшего камня. Проверьте, куда выбросило копоть.'
                : 'Седловина прямо по курсу, но горизонт ушёл из перекрестия. Одна риска на оправе равна шести градусам.',
            );
          fieldPay('aligned', 82, 'Путь Саргата');
          fieldPage(
            'glass',
            'Тень в седловине',
            'Над седловиной мелькнуло широкое крыло. На северной тропе сохранилась веха старых проводников. В футляре трубы есть записка о запасах на обратный путь.',
            [['Убрать окуляр', fieldClose]],
            'esma-3',
            `<aside>${fieldCacheNotes.survey[0]}</aside>`,
          );
        },
      ],
      ['Свериться с журналом', journal],
    ],
    null,
    sights,
  );
}
function fieldBells(message = '', phrase = []) {
  const tones = ['низкий', 'средний', 'высокий'];
  const note = (n) => () => {
    tone([164.8, 293.7, 493.9][n], 0.43, 'sine', 0.12);
    const next = [...phrase, n];
    if (next.length < 3) return fieldBells('', next);
    if (next.join(',') !== '0,2,2')
      return fieldBells(
        'Сигнал распался. На рейке широкая насечка одна, узкие стоят рядом. Попробуйте ещё раз.',
      );
    fieldPay('tuned', 85, 'Сигнал западной переправы');
    fieldRiver();
  };
  fieldPage(
    'river',
    'Три бронзовых колокола',
    message ||
      'У большого колокола низкий голос. Слева направо звуки поднимаются. Отбейте три удара в порядке старых насечек.',
    [
      ['Большой колокол', note(0)],
      ['Средний колокол', note(1)],
      ['Малый колокол', note(2)],
      ['Начать заново', () => fieldBells()],
      ['Отойти', fieldClose],
    ],
    null,
    `<div class="field-notes">${[0, 1, 2].map((_, i) => `<span>${tones[phrase[i]] || '·'}</span>`).join('')}</div>`,
  );
}
function fieldRiver() {
  const s = fieldState();
  if (s.choices.river) {
    const shelter = s.choices.river === 'shelter';
    return fieldPage('river', 'Звон над переправой', fieldOutcome('river'), [
      [
        shelter ? 'Попросить перевязку' : 'Купить двенадцать стрел · 4 монеты',
        () => {
          if (shelter) {
            game.health = Math.min(maxHealth(), game.health + 35);
            game.bleed = 0;
          } else if (game.coins >= 4) {
            game.coins -= 4;
            game.arrows += 12;
          } else return notify('Не хватает монет');
          checkpoint();
          fieldClose();
          notify(shelter ? 'Рада закончила перевязку' : 'Стрелы уложены в колчан');
        },
      ],
      ['Отойти', fieldClose],
    ]);
  }
  if (!fieldHas('river-begun'))
    return fieldPage(
      'river',
      'Рада у переправы',
      'В раме висят три колокола разной величины. Привязанные к ним концы уходят под навес.',
      [
        ['Восстановить сигнал', () => fieldBegin('river')],
        ['Отойти', fieldClose],
      ],
      'rada-1',
    );
  if (!fieldHas('gauge'))
    return fieldPage(
      'river',
      'Рада у переправы',
      'Старая рейка осталась у самого русла, к северо-западу от звонницы.',
      [['Искать рейку', fieldClose]],
      'rada-3',
    );
  if (!fieldHas('tuned')) return fieldBells();
  fieldPage(
    'river',
    'Кому звонить в тумане',
    'Семьи с берега дадут кров и бесплатную перевязку. Купеческая артель заплатит за сигнал и откроет склад стрел.',
    [
      [
        'Передать ключ семьям',
        () =>
          fieldFinish(
            'river',
            'shelter',
            65,
            () => (game.bandages += 3),
            'У лодочного сарая зажёгся фонарь. Рада отдала вам три бинта. Теперь у звонницы можно получить перевязку.',
          ),
      ],
      [
        'Передать ключ артели',
        () =>
          fieldFinish(
            'river',
            'trade',
            65,
            () => (game.coins += 24),
            'Артель заплатила 24 монеты. У звонницы теперь можно купить двенадцать стрел за четыре монеты.',
          ),
      ],
    ],
    'rada-2',
  );
}
function fieldNames(message = '') {
  const s = fieldState();
  if (s.choices.names)
    return fieldPage('names', 'Стан угольщиков', fieldOutcome('names'), [['Отойти', fieldClose]]);
  if (!fieldHas('names-begun'))
    return fieldPage(
      'names',
      'Хранительница Лист',
      'У палатки сохнет доска с семью именами. Лист оставила на ней место для восьмого.',
      [
        ['Найти последнее имя', () => fieldBegin('names')],
        ['Отойти', fieldClose],
      ],
      'list-1',
    );
  if (!fieldHas('token') || !fieldHas('register'))
    return fieldPage(
      'names',
      'Подпись на обороте',
      fieldRoute('names')[1],
      [['Отойти', fieldClose]],
      'list-2',
    );
  if (!fieldHas('named'))
    return fieldPage(
      'names',
      'Чей жетон?',
      message ||
        'Лист ждёт, положив рядом протирку камня и почерневший жетон. Назовите имя, которое совпадает с личным знаком.',
      ['Лада', 'Юрко', 'Терен']
        .map((n, i) => [
          n,
          () => {
            if (i !== 1)
              return fieldNames(
                'Лист соединяет рисунки: отметины расходятся. У владельца развилка и одна точка.',
              );
            fieldPay('named', 62, 'Восьмое имя');
            fieldNames();
          },
        ])
        .concat([['Свериться с журналом', journal]]),
    );
  fieldPage(
    'names',
    'Имя найдено',
    'У Юрко осталась сестра. Она пожелала вернуть жетон. Артель готова укрепить его у камня и снабжать лекарствами тех, кто придёт прочитать имя.',
    [
      [
        'Отдать жетон сестре',
        () =>
          fieldFinish(
            'names',
            'kin',
            53,
            () => (game.coins += 22),
            'Лист повязала у палатки ленту с именем Юрко. Семья передала вам 22 монеты.',
          ),
      ],
      [
        'Врезать жетон в камень',
        () =>
          fieldFinish(
            'names',
            'memorial',
            53,
            () => (game.bandages += 3),
            'Под именем Юрко остался личный знак. Вам передали три бинта; ещё один свёрток ждёт у самого камня.',
          ),
      ],
    ],
    'list-3',
  );
}
function fieldGlass() {
  if (fieldState().choices.glass)
    return fieldPage('glass', 'Медная обсерватория', fieldOutcome('glass'), [['Отойти', fieldClose]]);
  if (!fieldHas('glass-begun'))
    return fieldPage(
      'glass',
      'Картограф Эсма',
      'Труба покоится на бронзовой дуге. В переднем кольце остался один зазубренный край линзы.',
      [
        ['Найти новую линзу', () => fieldBegin('glass')],
        ['Отойти', fieldClose],
      ],
      'esma-1',
    );
  if (!fieldHas('shard'))
    return fieldPage(
      'glass',
      'След на стекле',
      'Чёрная осыпь лежит к северо-западу. На сколе должны остаться выброс копоти и метки старой оправы.',
      [['Отойти', fieldClose]],
      'esma-2',
    );
  if (!fieldHas('aligned')) return fieldScope();
  return fieldPage(
    'glass',
    'Северный подход',
    fieldRoute('glass')[1],
    [['Проверить веху', fieldClose]],
    'esma-3',
  );
}
function fieldQuestUse(option) {
  const id = option.site,
    site = fieldSites[id];
  if (!site || !game || game.dungeon || game.inside || distance(game, fieldPoint(id)) > 3.55) return;
  fieldVisit(id);
  if (site.cache) return fieldCache(id);
  if (id === 'ferry') return fieldRiver();
  if (id === 'camp') return fieldNames();
  if (id === 'observatory') return fieldGlass();
  if (id === 'gauge') return fieldEvidencePage('river', id, 'gauge', 35, fieldEvidence.gauge, 'reeds');
  if (id === 'kiln') {
    if (fieldState().choices.names === 'kin' && !fieldHas('kin-gift'))
      return fieldPage(
        'names',
        'Печная сушилка',
        'Семья Юрко оставила под навесом два бинта из высушенного здесь льна.',
        [
          [
            'Взять бинты',
            () => {
              fieldPay('kin-gift', 0, 'Дар семьи', () => (game.bandages += 2));
              fieldClose();
            },
          ],
          ['Оставить', fieldClose],
        ],
      );
    return fieldEvidencePage('names', id, 'token', 37, fieldEvidence.token);
  }
  if (id === 'memorial') {
    if (fieldState().choices.names === 'memorial' && !fieldHas('memorial-gift'))
      return fieldPage(
        'names',
        'Имя на камне',
        'Под личным знаком Юрко лежит свёрток с двумя свежими бинтами.',
        [
          [
            'Взять свёрток',
            () => {
              fieldPay('memorial-gift', 0, 'Дар артели', () => (game.bandages += 2));
              fieldClose();
            },
          ],
          ['Оставить', fieldClose],
        ],
      );
    return fieldEvidencePage('names', id, 'register', 38, fieldEvidence.register, 'cairn');
  }
  if (id === 'shard') return fieldEvidencePage('glass', id, 'shard', 38, fieldEvidence.shard);
  if (fieldState().choices.glass)
    return fieldPage('glass', site.title, fieldOutcome('glass'), [['Отойти', fieldClose]]);
  if (!fieldHas('aligned') || heroLevel() < 5)
    return fieldPage(
      'glass',
      site.title,
      !fieldHas('aligned')
        ? 'Над вехой видны две оси. Чтобы вывести указатель к дракону, восстановите медную трубу обсерватории.'
        : 'Отсюда до логова двадцать один шаг. Для работы в зоне наблюдения нужен V уровень. К вехе можно вернуться позже.',
      [['Отойти', fieldClose]],
    );
  fieldPage(
    'glass',
    'Наблюдение за Саргатом',
    'У вехи лежит оплавленная чешуйка. Цвет стекла совпал. Проводники ждут отметку обхода, Эсме нужна линия восходящего воздуха. У флюгера одна лопасть.',
    [
      [
        'Поставить белую лопасть к тропе',
        () =>
          fieldFinish(
            'glass',
            'pilots',
            65,
            () => {
              game.coins += 28;
              game.bandages += 2;
            },
            'Проводники получили безопасную линию обхода. Их награда — 28 монет и два бинта.',
          ),
      ],
      [
        'Отметить поток над гнездом',
        () =>
          fieldFinish(
            'glass',
            'wind',
            65,
            () => {
              game.coins += 16;
              game.arrows += 18;
            },
            'Эсма нанесла поток на карту. Для следующего выхода она оставила вам 16 монет и восемнадцать стрел.',
          ),
      ],
    ],
  );
}
function fieldVisit(id) {
  const s = fieldState();
  if (s.visited.includes(id)) return false;
  s.visited.push(id);
  checkpoint();
  return true;
}
function fieldQuestOption() {
  if (!game || game.dungeon || game.inside || game.delivery || game.health <= 0) return null;
  let result = null,
    best = 2.78;
  for (const [id, site] of Object.entries(fieldSites)) {
    const p = fieldPoint(id),
      d = distance(game, p);
    if (d < best) {
      best = d;
      result = { a: p, questSite: true, site: id, label: site.label };
    }
  }
  return result;
}
let fieldSweep = 0;
function fieldQuestTick(dt) {
  if (!game || game.dungeon || game.inside || game.delivery || game.health <= 0) return;
  fieldSweep -= dt;
  if (fieldSweep > 0) return;
  fieldSweep = 0.55;
  for (const [id, site] of Object.entries(fieldSites))
    if (distance(game, site) < (site.cache ? 2.8 : 7.5) && fieldVisit(id))
      notify('Открыто · ' + site.title, 2.1);
}
