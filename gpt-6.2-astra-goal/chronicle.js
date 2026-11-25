'use strict';

const opening = [
  [
    'Огонь на опушке',
    'Дозорная Лиора',
    'Держи тропу у домов. За оврагом ещё люди. Когда отобьём налёт, я покажу тебе, где искать обоз.',
  ],
  [
    'Северные ворота',
    'Капитан Арда',
    'С северной башни подали знак. У ворот чужие. Встань между ними и городом.',
  ],
  [
    'Дозор на перевале',
    'Сотник Гарт',
    'Дозор вернулся без припасов. До первого снега неделя. Люди ждут твоего приказа.',
  ],
];
const places = {
  bridge: { x: -46.3, z: 0.2, name: 'Осмотреть сломанное колесо' },
  seal: { x: 16, z: -46.9, name: 'Поднять обугленную печать' },
  rider: { x: -28, z: -46.4, name: 'Помочь раненому писарю' },
  mill: { x: -56, z: -47.35 },
  tribunal: { x: 52, z: -51 },
  fort: { x: 48, z: 54 },
  cache: { x: 54, z: -43 },
};
const verdicts = {
  bread: {
    name: 'Хлеб без печати',
    place: 2,
    voice:
      'В лесу три дня не топили пекарню. Проведи туда обоз. Если встретишь дозор, возница знает их сигнал.',
    end: 'К рассвету у мельницы собралась очередь. Эльда разломила первую буханку и отдала обе половины детям. Остальные дождались своей порции. В ту зиму деревню не оставили.',
    perk: 'Торговцы дают бинты и лечат за полцены.',
  },
  law: {
    name: 'Именем свидетелей',
    place: 1,
    voice: 'В суде спросят, кто видел накладную. Найди свидетеля или сверь печать в архиве.',
    end: 'Арда положила перед судьями обе печати. У настоящей сколот левый клык. На приказе стоял целый. В тот вечер с ворот сняли объявление о сборе.',
    perk: 'Имперская казна оплачивает усиление оружия наполовину.',
  },
  iron: {
    name: 'Право сильного',
    place: 3,
    voice: 'Ключ у казначея. Возьми его и открой амбар в форте. Там тоже ждут хлеба.',
    end: 'Ворота форта открылись затемно. У печей стояли и солдаты, и семьи с перевала. Хлеба хватило на всех. Наутро за новой порцией пришлось снова идти к часовому.',
    perk: 'Два ветерана форта останутся в вашей дружине.',
  },
};
function freshStory() {
  return {
    saltEdition: true,
    phase: 'origin',
    clues: [],
    branch: null,
    aid: false,
    entries: [],
    wave: 0,
    arrested: false,
    started: false,
  };
}
function readSlot() {
  const saves = [saveKey(), saveKey() + '.checkpoint']
    .map((k) => {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch {
        return null;
      }
    })
    .filter((s) => valid(s));
  const latest = saves.sort((a, b) => (b.writtenAt || 0) - (a.writtenAt || 0))[0];
  if (latest && !latest.story.saltEdition) restoreJournal(latest);
  return latest;
}
// Journal text was stored verbatim in the first edition. Keep choices, payment, and seals intact.
function restoreJournal(saved) {
  const story = saved.story;
  const previousOpenings = ['Семь телег и вымя', 'Копыто капитана', 'Его Молочность'];
  const previousPosts = ['Маслобойня', 'Палата удоев', 'Клеверный стан', 'Сырный редут'];
  story.entries = story.entries.map(([title, line]) => {
    const faction = previousOpenings.indexOf(title);
    if (faction >= 0) return [opening[faction][0], opening[faction][2]];
    const post = previousPosts.indexOf(title);
    if (post >= 0)
      return [dairies[post].title, 'В подорожной появилась печать «' + dairies[post].stamp + '».'];
    if (title === 'Подпись копытом')
      return ['Подпись возницы', 'Старший обоза заверил накладную. Её можно предъявить в суде.'];
    if (title === 'Молочная почта') return ['Дворцовая почта', line.replace('крынок', 'сосудов')];
    if (title === 'Встреча у переправы')
      return [
        title,
        'Вельт перекрыл переправу. Для ареста понадобится ордер, свидетель или накладная возницы.',
      ];
    if (story.branch && title === verdicts[story.branch].name)
      return [title, endingAccount(story, saved.side)];
    return [title, line];
  });
  story.saltEdition = true;
}
function endingAccount(story, side) {
  let account = verdicts[story.branch].end;
  if (story.branch === 'law') {
    account = story.arrested
      ? 'Вельт лично дал показания. ' + account
      : 'Вместо регента перед судом легла его поддельная печать. Капитан сверила зарубки с показаниями возницы. Этого хватило, чтобы вернуть зерно и отменить сбор. Кто ещё стоял за поддельной печатью, так и осталось неизвестным.';
  }
  return account + ' ' + heroCoda(story, side);
}
function checkpoint(state = game) {
  if (state.health <= 0 || state.delivery) return;
  if (state === game && game.training) trainingMilestones();
  try {
    state.writtenAt = Date.now();
    localStorage.setItem(saveKey() + '.checkpoint', JSON.stringify(state));
    refreshResume();
  } catch {}
}
let subtitleUntil = 0,
  chapterUntil = 0;
function speak(who, line) {
  const label = document.createElement('b');
  label.textContent = who;
  const words = document.createElement('span');
  words.textContent = line;
  $('subtitle').replaceChildren(label, words);
  const duration = realmVoice.play(who, line);
  subtitleUntil = gameTime + Math.max(4.3, line.length * 0.065, duration + 0.45);
}
function chapter(name, kicker) {
  $('chapter-toast').innerHTML = '<small>' + kicker + '</small>' + name;
  $('chapter-toast').style.opacity = 1;
  chapterUntil = gameTime + 3.5;
  scoreCue('chapter');
}
function enterStory(phase, title, text) {
  game.story.phase = phase;
  game.story.entries.push([title, text]);
  checkpoint();
  chapter(title, 'Соляной тракт');
}
function storyGoal() {
  const s = game.story;
  if (!s || s.phase === 'origin') return null;
  switch (s.phase) {
    case 'miller':
      return { text: 'Найдите мельничиху Эльду в Вольных землях', target: places.mill };
    case 'trail': {
      const k = s.clues.includes('bridge') ? 'seal' : 'bridge';
      return {
        text:
          k === 'bridge' ? 'Осмотрите колесо у Соляного моста' : 'Ищите вторую печать на дворцовом тракте',
        target: places[k],
      };
    }
    case 'choice':
      return { text: 'Вернитесь к Эльде и решите судьбу зерна', target: places.mill };
    case 'escort':
      return {
        text: game.actors.some((a) => a.tag === 'ambush' && a.hp > 0)
          ? 'Защитите караван от засады'
          : 'Проведите караван в лес · держитесь в 12 м',
        target: game.wagon,
      };
    case 'intercept':
      return {
        text:
          s.aid || s.warrant || s.hoof
            ? 'Вельт у моста · E для ареста или бой'
            : 'Остановите регента Вельта у Соляного моста',
        target: game.actors.find((a) => a.tag === 'regent' && a.hp > 0),
      };
    case 'requisition':
      return {
        text: 'Возьмите ключ у стражи имперского амбара',
        target: game.actors.find((a) => a.tag === 'vault' && a.hp > 0) || places.cache,
      };
    case 'return':
      return {
        text: {
          bread: 'Передайте накладную у лесной лавки',
          law: 'Предъявите улики капитану Арде',
          iron: 'Откройте амбар в Чёрных горах',
        }[s.branch],
        target: { bread: { x: -56, z: 52.65 }, law: places.tribunal, iron: places.fort }[s.branch],
      };
    case 'done':
      return game.side === 2 && game.raid >= 0
        ? null
        : { text: verdicts[s.branch].name + ' · Вольный путь', target: null };
  }
}
function scene(kicker, title, art, speaker, text, buttons) {
  let key = typeof art === 'number' ? 'tale' + art : 'chapter-' + art;
  const hasActor = !!dialogueCast[speaker];
  if (hasActor)
    key =
      'land' +
      (speaker.includes('Арда') ? 1 : speaker.includes('Мара') ? 2 : speaker.includes('Гарт') ? 3 : 0);

  modal(
    kicker,
    title,
    '<section class="story-scene' +
      (hasActor ? ' interview' : '') +
      '"><div class="scene-plate"' +
      (hasActor ? ' id="portrait-stage"' : '') +
      '><img src="./assets/' +
      key +
      '.webp?v=salt2" alt=""></div><div class="scene-words"><div class="speaker-line"><strong class="narrator">' +
      speaker +
      '</strong><button type="button" class="rehear" id="rehear" title="Послушать реплику ещё раз" aria-label="Послушать реплику ещё раз">' +
      icon('sound') +
      '</button></div><p class="story-text">' +
      text +
      '</p><div class="scene-answers">' +
      buttons.map((b, i) => '<button class="action" id="reply' + i + '">' + b[0] + '</button>').join('') +
      '</div></div></section>',
  );
  openStage(speaker);
  realmVoice.play(speaker, text);
  $('rehear').hidden = !realmVoice.duration(speaker, text);
  $('rehear').onclick = () => {
    if (!soundOn) audioToggle();
    realmVoice.play(speaker, text);
  };
  buttons.forEach(
    (b, i) =>
      ($('reply' + i).onclick = () => {
        closeModal();
        b[1]();
        if (!$('dialog').open) capture();
      }),
  );
}
function storyOptions() {
  const s = game.story,
    opts = [];
  const add = (key, p, label) => opts.push({ a: p, label, story: key });
  if (s.herbs === 'seek') add('herb', herbBed, 'Собрать тысячелистник');
  if (['miller', 'choice'].includes(s.phase)) add('miller', places.mill, 'Поговорить с Эльдой');
  if (s.phase === 'trail')
    for (const k of ['bridge', 'seal']) if (!s.clues.includes(k)) add(k, places[k], places[k].name);
  if (['trail', 'choice'].includes(s.phase) && !s.aid) add('rider', places.rider, places.rider.name);
  if (s.phase === 'intercept' && (s.aid || s.warrant || s.hoof)) {
    const boss = game.actors.find((a) => a.tag === 'regent' && a.hp > 0);
    if (boss)
      add(
        'arrest',
        boss,
        s.warrant
          ? 'Предъявить ордер'
          : s.aid
            ? 'Предъявить показания писаря'
            : 'Предъявить накладную возницы',
      );
  }
  if (s.phase === 'requisition' && !game.actors.some((a) => a.tag === 'vault' && a.hp > 0))
    add('key', places.cache, 'Забрать ключ от амбара');
  if (s.phase === 'return') add('ending', storyGoal().target, 'Завершить дело о десятине');
  return opts
    .filter((o) => distance(o.a, game) < 4.5)
    .sort((a, b) => distance(a.a, game) - distance(b.a, game));
}
function storyInteraction(k) {
  const s = game.story;
  if (k === 'miller' && s.phase === 'miller') {
    scene(
      'Глава II · Жернова',
      'Мера зерна',
      1,
      'Эльда, мельничиха',
      'Из леса вышли семь телег. Здесь разгрузили шесть. Вельт говорит, что седьмая сгорела. Сам посмотри у моста. Там осталось колесо. А на дворцовом тракте ищи печать.',
      [
        [
          'Осмотреть места перегрузки',
          () =>
            enterStory(
              'trail',
              'Две половины печати',
              'У Соляного моста осталось сломанное колесо. Обоз остановился ещё и на дворцовом тракте. По пути можно разыскать писаря.',
            ),
        ],
      ],
    );
    return;
  }
  if (k === 'miller' && s.phase === 'choice') {
    scene(
      'Глава III · Решение',
      'Чья это зима?',
      0,
      'Эльда',
      'Это приказ Вельта. Велено сжечь мешки и списать зерно на пожар. Последняя телега ещё на тракте. Мы можем отвезти хлеб в лес, передать бумаги в суд или забрать ключ от амбара в горах. Решай, пока не рассвело.',
      [
        ['Отвести зерно голодающим', () => chooseEnding('bread')],
        ['Привлечь регента к суду', () => chooseEnding('law')],
        ['Забрать десятину для форта', () => chooseEnding('iron')],
      ],
    );
    return;
  }
  if (k === 'bridge' || k === 'seal') {
    const first = k === 'bridge',
      title = first ? 'Семь зарубок' : 'Оловянный волк',
      desc = first
        ? 'На ободе семь зарубок. В описи возницы значатся шесть телег. Седьмая прошла переправу без записи.'
        : 'В кострище лежит половина печати регента. Край в муке, левый зубец цел. У подлинной печати капитана этот зубец давно отколот.';
    scene('Вещдок · Соляной тракт', title, 0, 'Полевая запись', desc, [
      [
        'Занести в дневник',
        () => {
          s.clues.push(k);
          s.entries.push([title, desc]);
          if (s.clues.length === 2)
            enterStory(
              'choice',
              'Седьмая повозка',
              'Две улики связывают регента с пропавшим зерном. Эльда ждёт у мельницы.',
            );
          else checkpoint();
        },
      ],
    ]);
    return;
  }
  if (k === 'rider') {
    scene(
      'Свидетель',
      'Последняя подпись',
      0,
      'Писарь Нив',
      'Я вписал шестёрку поверх семёрки. Он держал моего сына на заставе. Дай перевязать ногу, и я повторю это перед судьёй.',
      [
        [
          game.bandages ? 'Отдать бинт и записать показания' : 'Раздобыть бинт для Нива',
          () => {
            if (!game.bandages) {
              notify('Бинты продаются у полосатого навеса');
              return;
            }
            game.bandages--;
            s.aid = true;
            s.entries.push([
              'Показания Нива',
              'Писарь опознал подпись Вельта. С этими показаниями регента можно арестовать живым.',
            ]);
            checkpoint();
            speak('Нив', 'Теперь подпись моя. Без помарок.');
          },
        ],
        ['Вернуться позже', () => {}],
      ],
    );
    return;
  }
  if (k === 'arrest') {
    const a = game.actors.find((a) => a.tag === 'regent' && a.hp > 0);
    if (a) {
      a.team = 'neutral';
      a.windup = 0;
      a.tag = 'prisoner';
      s.arrested = true;
      enterStory(
        'return',
        'Живая подпись',
        'Вельт сложил оружие перед свидетелем. Представьте дело во дворце.',
      );
      speak(
        'Регент Вельт',
        s.warrant
          ? 'Печать подлинная. Уберите клинок, я пойду сам.'
          : s.aid
            ? 'Вы нашли писаря. Тогда мне нечего прибавить.'
            : 'Знаю эти метки. Накладная подлинная. Я пойду с вами.',
      );
    }
    return;
  }
  if (k === 'key') {
    enterStory('return', 'Железный ключ', 'Казначейский ключ у вас. Откройте им военный амбар у форта.');
    return;
  }
  if (k === 'ending') {
    const v = verdicts[s.branch],
      account = endingAccount(s, game.side);
    enterStory('done', v.name, account);
    game.coins += 75;
    if (s.branch === 'iron') {
      for (let i = 0; i < 2; i++) spawnAt('lord', 'friend', game.x - 2 + i * 3, game.z + 2, 'veteran');
      game.order = 'follow';
    }
    checkpoint();
    scene(
      'Эпилог · ' + sides[game.side].name,
      v.name,
      s.branch,
      'Из хроники Пограничья',
      account + ' ' + v.perk,
      [
        ['Продолжить путь', () => speak('Пограничье', 'На тракте снова слышны колёса. Дорога открыта.')],
        ['Открыть хронику', journal],
      ],
    );
    return;
  }
}
function chooseEnding(branch) {
  const g = game,
    s = g.story;
  s.branch = branch;
  s.wave = 0;
  if (branch === 'bread') {
    Object.assign(g.wagon, { x: -50, z: -44, node: 3, angle: 0, cool: 99 });
    g.actors
      .filter((a) => a.tag === 'escort' && a.hp > 0)
      .forEach((a, i) => Object.assign(a, { team: 'escort', x: -50 + (i % 2 ? 2 : -2), z: -43 }));
    repairSpacing();
    enterStory(
      'escort',
      'Дорога хлеба',
      'Держитесь рядом с повозкой. Возница останавливается при засаде и ждёт, если вы отстали.',
    );
  }
  if (branch === 'law') {
    const a = spawnAt('regent', 'hostile', -48, 2, 'regent');
    a.hp = 125;
    a.maxHp = 125;
    enterStory(
      'intercept',
      'Встреча у переправы',
      'Регент перекрыл переправу. Предъявите ордер, показания писаря или накладную возницы, чтобы взять его живым. Иначе придётся принять бой.',
    );
  }
  if (branch === 'iron') {
    for (let i = 0; i < 3; i++)
      spawnAt('guard', 'hostile', places.cache.x + i * 1.8, places.cache.z + 2, 'vault');
    enterStory(
      'requisition',
      'Замок на амбаре',
      'Три стражника держат ключ у имперского амбара. После боя заберите его и возвращайтесь в форт.',
    );
  }
  speak('Эльда', verdicts[branch].voice);
}
function escortTick(dt) {
  const g = game,
    s = g.story,
    w = g.wagon;
  if (distance(g, w) > 12 || g.actors.some((a) => a.tag === 'ambush' && a.hp > 0)) return;
  if (!rollWagon(w, 0, Math.min(48 - w.z, dt * 2.65), 0, dt)) return;
  if ((s.wave === 0 && w.z > -24) || (s.wave === 1 && w.z > 13)) {
    s.wave++;
    for (let i = 0; i < s.wave; i++)
      spawnAt(i ? 'lord' : 'guard', 'hostile', w.x + 6 + i * 2, w.z + 8, 'ambush');
    speak('Возница', 'Люди на дороге. Прикрой меня. Если помнишь условный сигнал, обойдёмся без боя.');
  }
  if (w.z >= 48) {
    w.node = 0;
    w.cool = 80;
    enterStory(
      'return',
      'Последний мешок',
      'Повозка дошла до лесного поселения. Передайте накладную у лавки.',
    );
  }
}
function storyTick() {
  const g = game,
    s = g.story;
  const [homeX, homeZ] = CENTERS[sides[g.side].place];
  if (!s.started && (!g.frontierStart || distance(g, { x: homeX, z: homeZ }) < 34)) {
    s.started = true;
    const [name, who, line] = opening[g.side];
    chapter(name, 'Глава I · ' + lands[sides[g.side].place].name);
    speak(who, line);
    s.entries.push([name, line]);
  }
  if (s.phase === 'origin' && g.stage >= [3, 4, 1][g.side]) {
    enterStory(
      'miller',
      'Пепел на сургуче',
      'В трофеях обнаружилась накладная на двойную десятину. Найдите мельничиху в Вольных землях.',
    );
    speak('Запись на полях', 'Отдать Эльде. Если со мной что случится — пересчитай зарубки.');
  }
  if (s.phase === 'intercept' && !g.actors.some((a) => a.tag === 'regent' && a.hp > 0)) {
    enterStory('return', 'Сломанная печать', 'Регент пал. Предъявите его печать и опись капитану Арде.');
  }
  if (gameTime > subtitleUntil && !realmVoice.active) $('subtitle').textContent = '';
  if (gameTime > chapterUntil) $('chapter-toast').style.opacity = 0;
}
function journal(tab = game.journalTab || 'expeditions') {
  if (!['expeditions', 'story', 'hunts', 'oath'].includes(tab)) tab = game.journalTab || 'expeditions';
  game.journalTab = tab;
  const s = game.story,
    obj = goal();
  const tabs =
    '<nav class="journal-tabs" aria-label="Разделы дневника">' +
    [
      ['oath', 'Озёрная марка'],
      ['expeditions', 'Экспедиции'],
      ['story', 'История'],
      ['hunts', 'Охота'],
    ]
      .map(
        ([id, label]) =>
          '<button data-journal-tab="' + id + '" aria-pressed="' + (tab === id) + '">' + label + '</button>',
      )
      .join('') +
    '</nav>';
  const story =
    '<img class="story-art" alt="" src="./assets/tale' +
    (s.phase === 'done' ? 3 : s.phase === 'origin' ? 0 : 1) +
    '.webp"><p class="journal-current">' +
    obj.text +
    '</p>' +
    s.entries.map(([t, p]) => '<div class="chapter-entry"><b>' + t + '</b><p>' + p + '</p></div>').join('') +
    (s.phase === 'trail' || s.phase === 'choice'
      ? '<p>Вещдоки ' +
        s.clues.length +
        ' / 2 · Свидетель ' +
        (s.aid ? 'найден' : 'пропал на дворцовом тракте') +
        '</p>'
      : '');
  modal(
    'Полевой дневник',
    tab === 'oath'
      ? 'Колокол подо льдом'
      : tab === 'story'
        ? 'Соляной тракт'
        : tab === 'hunts'
          ? 'Охотничьи вести'
          : 'Записи путешественника',
    tabs +
      (tab === 'oath'
        ? oathJournal()
        : tab === 'story'
          ? story
          : tab === 'hunts'
            ? huntJournal()
            : fieldQuestJournal()),
  );
  for (const b of document.querySelectorAll('[data-journal-tab]'))
    b.onclick = () => journal(b.dataset.journalTab);
  if (tab === 'oath') bindOathJournal();
  if (tab === 'hunts') bindHuntJournal();
  if (tab === 'expeditions') bindFieldJournal();
}
function priceAt(base, index) {
  const s = game.story;
  return s.phase === 'done' && ((s.branch === 'bread' && index < 2) || (s.branch === 'law' && index === 2))
    ? Math.ceil(base / 2)
    : base;
}
