'use strict';

const opening = [
  [
    'Семь телег и вымя',
    'Дозорная Лиора',
    'Шесть телег и корова. Писарь сложил и получил семь телег. Отбей налёт. Потом спроси у Бурёнки, кто тут корован.',
  ],
  [
    'Копыто капитана',
    'Капитан Арда',
    'В караульной книге я вчера отелился. Ты же видел мой отпускной? К воротам. Шпионы ещё в городе.',
  ],
  [
    'Его Молочность',
    'Сотник Гарт',
    'Ваше Мрачнейшество, в казне полсыра. Вторую половину назначили казначеем. Куда поведём дружину?',
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
      'Пекари ждут муку. Бурёнка ждёт переводчика. Если на тракте засада, спроси у неё разрешение проехать.',
    end: 'На рассвете Эльда раздала горячие горбушки. Бурёнке достался пирог размером с колесо. В графе «кому вручено» пекарь оставил жирное пятно от носа. Ревизор принял.',
    perk: 'Торговцы дают бинты и лечат за полцены.',
  },
  law: {
    name: 'Именем свидетелей',
    place: 1,
    voice: 'Им понадобится не наша правда. Им понадобится его собственная подпись.',
    end: 'Арда положила рядом две печати. У настоящей сколот левый зубец, у подложной — правый. Бурёнка съела вещдок только после приговора. Так в Палате впервые появилось съедобное право.',
    perk: 'Имперская казна оплачивает усиление оружия наполовину.',
  },
  iron: {
    name: 'Право сильного',
    place: 3,
    voice: 'Возьми железный ключ у казначейства. В форте помнят тех, кто приносит хлеб.',
    end: 'В форте затопили сорок печей. Дружина получила хлеб, Бурёнка — трон, вы — должность регента при корове. На первой аудиенции Её Молочность потребовала почесать за ухом.',
    perk: 'Два ветерана форта сопровождают вас в свободной игре.',
  },
};
function freshStory() {
  return {
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
  return saves.sort((a, b) => (b.writtenAt || 0) - (a.writtenAt || 0))[0];
}
function checkpoint(state = game) {
  if (state.health <= 0 || state.delivery) return;
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
  chapter(title, 'Дело о двух рогах');
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
          ? 'Защитите корован от засады'
          : 'Проведите корован в лес · держитесь в 12 м',
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
  modal(
    kicker,
    title,
    '<img class="story-art" src="./assets/tale' +
      art +
      '.webp" alt=""><strong class="narrator">' +
      speaker +
      '</strong><button type="button" class="rehear" id="rehear" title="Послушать реплику ещё раз" aria-label="Послушать реплику ещё раз">' +
      icon('sound') +
      '</button><p class="story-text">' +
      text +
      '</p>' +
      buttons.map((b, i) => '<button class="action" id="reply' + i + '">' + b[0] + '</button>').join(''),
  );
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
        s.warrant ? 'Предъявить ордер' : s.aid ? 'Предъявить показания писаря' : 'Предъявить подпись Бурёнки',
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
      'Весной Бурёнку провели по смете как седьмую телегу. Осенью с неё взяли налог за четыре колеса. Денег ушло восемьдесят мешков. Найди обод у моста и печать у кострища. Посмотрим, где у коровы ось.',
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
      'Нашла приказ. «Сжечь пустые мешки, списать обоз на пожар». Он продал зерно задолго до сбора. Пока мы считали, Вельт вывел последнюю полную повозку на тракт. Зерно можно довезти в лес. Можно отдать дело суду. Можно оставить хлеб тому, у кого хватит мечей удержать амбар. Я положу ключ туда, куда ты скажешь.',
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
        ? 'На ободе семь глубоких зарубок. В кузовной описи значатся шесть телег. На последнюю никто не оформлял подорожную.'
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
            : 'Подделать такое копыто невозможно. Ведите.',
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
      detail =
        s.branch === 'law'
          ? s.arrested
            ? 'Вельт лично дал показания. '
            : 'Вместо регента перед судом легла его поддельная печать. '
          : '';
    const account =
      s.branch === 'law' && !s.arrested
        ? 'Капитан сверила зарубки с показаниями возницы. Сбор отменили. Бурёнка получила диплом эксперта по колёсным налогам. Имени Вельта в новой подорожной уже не было.'
        : v.end;
    enterStory('done', v.name, detail + account + ' ' + heroCoda(s));
    game.coins += 75;
    if (s.branch === 'iron') {
      for (let i = 0; i < 2; i++) spawnAt('lord', 'friend', game.x - 2 + i * 3, game.z + 2, 'veteran');
      game.order = 'follow';
    }
    checkpoint();
    scene(
      'Эпилог · ' + sides[game.side].name,
      v.name,
      s.branch === 'iron' ? 2 : 3,
      'Из хроники Пограничья',
      detail + account + ' ' + heroCoda(s) + ' ' + v.perk,
      [
        ['Продолжить путь', () => speak('Пограничье', 'Акт подписан. Траву под подписью оставьте как есть.')],
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
      'Регент перекрыл переправу. Предъявите ордер, показания писаря или заверенную копытом накладную, чтобы взять его живым. Иначе придётся принять бой.',
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
    speak(
      'Возница',
      'Впереди люди Вельта. Берись за меч или подойди к Бурёнке и нажми V. У неё есть юридическое «му».',
    );
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
  if (!s.started) {
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
function journal() {
  const s = game.story,
    obj = goal();
  modal(
    'Полевой дневник',
    'Дело о двух рогах',
    '<img class="story-art" alt="" src="./assets/tale' +
      (s.phase === 'done' ? 3 : s.phase === 'origin' ? 0 : 1) +
      '.webp"><p class="journal-current">' +
      obj.text +
      '</p>' +
      s.entries
        .map(([t, p]) => '<div class="chapter-entry"><b>' + t + '</b><p>' + p + '</p></div>')
        .join('') +
      (s.phase === 'trail' || s.phase === 'choice'
        ? '<p>Вещдоки ' +
          s.clues.length +
          ' / 2 · Свидетель ' +
          (s.aid ? 'найден' : 'пропал на дворцовом тракте') +
          '</p>'
        : ''),
  );
}
function priceAt(base, index) {
  const s = game.story;
  return s.phase === 'done' && ((s.branch === 'bread' && index < 2) || (s.branch === 'law' && index === 2))
    ? Math.ceil(base / 2)
    : base;
}
