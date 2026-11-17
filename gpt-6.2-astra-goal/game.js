'use strict';
const keys = new Set();
let expectedUnlock = false;
let frame = 0,
  world = null,
  game = null,
  last = 0,
  gameTime = 0,
  lodTime = 0,
  hudTime = 0,
  swing = 0,
  walking = 0,
  flash = 0,
  noticeTime = 0,
  lockBefore = false;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = (x, z) => ({ x, z });
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const angles = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const route = [
  [-50, -50],
  [50, -50],
  [50, 50],
  [-50, 50],
];
function actor(kind, team, x, z, tag = '') {
  const a = {
    id: game.nextId++,
    kind,
    team,
    x,
    z,
    hp: team === 'friend' ? 90 : team === 'hostile' ? 58 : 75,
    angle: 0,
    cd: 1.4,
    walk: false,
    tag,
  };
  game.actors.push(a);
  return a;
}
function clearSpot(x, z) {
  if (world.free(x, z, 0.5)) return point(x, z);
  for (let r = 1; r <= 12; r++)
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8,
        p = point(x + r * Math.sin(a), z + r * Math.cos(a));
      if (world.free(p.x, p.z, 0.5)) return p;
    }
  return point(x, z);
}
function spawnAt(kind, team, x, z, tag) {
  const p = clearSpot(x, z);
  return actor(kind, team, p.x, p.z, tag);
}
function newGame() {
  const s = sides[choice],
    [x, z] = CENTERS[s.place];
  game = {
    version: 2,
    inside: null,
    roomX: 0,
    roomZ: 0,
    side: choice,
    x,
    z: z + 5,
    air: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    health: 100,
    coins: 24,
    bandages: 3,
    arm: 'whole',
    leg: 'whole',
    eye: 'whole',
    bleed: 0,
    upgrade: 0,
    stage: 0,
    raid: -1,
    order: 'follow',
    kills: 0,
    robbed: 0,
    encounter: 70,
    nextId: 1,
    actors: [],
    wagon: { x: -50, z: 38, angle: Math.PI, node: 0, cool: 0 },
    hits: 0,
    story: freshStory(),
    stamina: 100,
    blockTime: 0,
    parryWindow: 0,
    evade: 0,
    weapon: 'sword',
    arrows: 20,
    arrow: null,
  };
  if (choice === 0) {
    game.x = x - 2.5;
    game.z = z + 15;
    game.yaw = -0.17;
  } else game.yaw = -0.64;
  settle();
  CENTERS.forEach(([a, b]) => {
    const m = actor('merchant', 'neutral', a - 6, b + 2.65, 'shop');
    m.angle = Math.PI;
  });
  actor('commander', choice === 1 ? 'neutral' : 'resident', 52, -51, 'commander');
  for (let j = 0; j < 2; j++) actor('escort', 'escort', -48 - j * 4, 37, 'escort');
  if (choice === 0) {
    spawnAt('guard', 'hostile', x - 3, z - 10, 'first');
    spawnAt('lord', 'hostile', x + 3, z - 15, 'first');
  }
  if (choice === 2) {
    for (let j = 0; j < 3; j++) spawnAt('lord', 'friend', x - 3 + j * 2, z + 2, 'squad');
    spawnAt('spy', 'hostile', x + 3, z + 18, 'intruder');
  }
}
function start(load) {
  let saved = null;
  if (load) {
    try {
      saved = readSlot();
      if (!valid(saved)) throw Error();
    } catch {
      toast('Сохранение повреждено или имеет другую версию');
      return;
    }
  }
  try {
    if (!world) world = new Realm();
  } catch (e) {
    console.error(e);
    modal(
      'Запуск игры',
      'Не удалось открыть 3D-мир',
      '<p>Браузеру требуется WebGL и включённое аппаратное ускорение. Попробуйте настольный Chrome, Edge или Firefox.</p>',
    );
    return;
  }
  world.clearPeople();
  if (saved) game = saved;
  else newGame();
  active = true;
  keys.clear();
  swing = 0;
  flash = 0;
  walking = 0;
  last = 0;
  lodTime = 0;
  hudTime = 0;
  noticeTime = 0;
  gameTime = 0;
  subtitleUntil = chapterUntil = 0;
  $('subtitle').textContent = '';
  $('chapter-toast').style.opacity = 0;
  scoreStart();
  $('menu').hidden = true;
  $('footer').hidden = true;
  document.querySelector('.bar').hidden = true;
  $('play').hidden = false;
  $('hurt').style.opacity = 0;
  applyGraphics();
  $('touch-order').hidden = game.side !== 2;
  notify(load ? 'Кампания загружена' : '', 2);
  drawHud();
  frame = requestAnimationFrame(loop);
  capture();
}
function valid(s) {
  return (
    s &&
    s.version === 2 &&
    s.story &&
    Array.isArray(s.story.entries) &&
    Array.isArray(s.story.clues) &&
    ['origin', 'miller', 'trail', 'choice', 'escort', 'intercept', 'requisition', 'return', 'done'].includes(
      s.story.phase,
    ) &&
    (!s.inside || (houses[s.inside] && Number.isFinite(s.roomX) && Number.isFinite(s.roomZ))) &&
    ['sword', 'bow'].includes(s.weapon) &&
    Number.isFinite(s.stamina) &&
    Number.isFinite(s.arrows) &&
    s.side === choice &&
    s.health > 0 &&
    s.health <= 100 &&
    [
      'x',
      'z',
      'stage',
      'nextId',
      'yaw',
      'pitch',
      'air',
      'vy',
      'coins',
      'bandages',
      'hits',
      'encounter',
      'upgrade',
      'bleed',
    ].every((k) => Number.isFinite(s[k])) &&
    Math.abs(s.x) <= WORLD_LIMIT &&
    Math.abs(s.z) <= WORLD_LIMIT &&
    Array.isArray(s.actors) &&
    s.actors.every(
      (a) => Number.isFinite(a.id) && Number.isFinite(a.hp) && Number.isFinite(a.x) && Number.isFinite(a.z),
    ) &&
    s.wagon &&
    Number.isInteger(s.wagon.node) &&
    route[s.wagon.node] &&
    Number.isFinite(s.wagon.x) &&
    Number.isFinite(s.wagon.z)
  );
}
function capture() {
  if (matchMedia('(pointer: coarse)').matches || !active || $('dialog').open || document.pointerLockElement)
    return;
  try {
    const result = world.renderer.domElement.requestPointerLock();
    if (result && result.catch) result.catch(() => {});
  } catch {}
}
function save() {
  if (!active || game.health <= 0) return;
  try {
    game.writtenAt = Date.now();
    localStorage.setItem(saveKey(), JSON.stringify(game));
    refreshResume();
    notify('Кампания сохранена');
    return true;
  } catch {
    notify('Хранилище браузера недоступно');
    return false;
  }
}
function menu() {
  scoreStop();
  cancelAnimationFrame(frame);
  active = false;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  closeModal();
  $('play').hidden = true;
  $('menu').hidden = false;
  $('footer').hidden = false;
  document.querySelector('.bar').hidden = false;
  page('campaign');
  refreshResume();
  window.scrollTo(0, 0);
}
function notify(s, sec = 3) {
  $('event').textContent = s;
  noticeTime = sec;
}
const actions = (arr) =>
  arr.map(([id, s]) => '<button class="action" id="' + id + '">' + s + '</button>').join('');
function pauseGame() {
  if (!active || game.health <= 0 || $('dialog').open) return;
  modal(
    'Кампания',
    'Привал',
    actions([
      ['back', 'Продолжить игру'],
      ['record', 'Сохранить кампанию'],
      ['travel', 'Открыть карту'],
      ['pages', 'Полевой дневник'],
      ['preferences', 'Настройки'],
      ['control', 'Управление'],
      ['toggle', 'Звук · ' + (soundOn ? 'включён' : 'выключен')],
      ['leave', 'В главное меню'],
    ]),
  );
  $('back').onclick = () => {
    closeModal();
    capture();
  };
  $('record').onclick = () => {
    const ok = save();
    $('record').textContent = ok ? 'Кампания сохранена ✓' : 'Хранилище недоступно';
  };
  $('travel').onclick = mapDialog;
  $('pages').onclick = journal;
  $('preferences').onclick = settings;
  $('control').onclick = help;
  $('toggle').onclick = () => {
    audioToggle();
    $('toggle').textContent = 'Звук · ' + (soundOn ? 'включён' : 'выключен');
  };
  $('leave').onclick = () => {
    modal(
      'Выход из кампании',
      'Вернуться в меню?',
      '<p>Можно сохранить текущее положение перед выходом.</p>' +
        actions([
          ['save-exit', 'Сохранить и выйти'],
          ['no-save', 'Выйти без сохранения'],
          ['cancel-exit', 'Продолжить игру'],
        ]),
    );
    $('save-exit').onclick = () => {
      if (save()) menu();
      else $('save-exit').textContent = 'Ошибка сохранения';
    };
    $('no-save').onclick = menu;
    $('cancel-exit').onclick = () => {
      closeModal();
      capture();
    };
  };
}
function death() {
  game.health = 0;
  modal(
    'Кампания окончена',
    'Герой пал',
    '<p>Побеждено врагов — ' +
      game.kills +
      '. Ограблено корованов — ' +
      game.robbed +
      '.</p>' +
      actions([
        ...(readSlot() ? [['recover', 'Вернуться к сохранению']] : []),
        ['restart', 'Начать заново'],
        ['return', 'К выбору стороны'],
      ]),
  );
  if ($('recover'))
    $('recover').onclick = () => {
      menu();
      start(true);
    };
  $('restart').onclick = () => {
    menu();
    start(false);
  };
  $('return').onclick = menu;
  modalExit = () => {
    if (active && game.health === 0) menu();
  };
}
function goal() {
  const current = storyGoal();
  if (current) return current;
  const g = game,
    tag = (n) => g.actors.find((a) => a.tag === n && a.hp > 0),
    merchant = g.actors.find((a) => a.tag === 'shop' && zoneAt(a.x, a.z) === zoneAt(g.x, g.z));
  if (g.side === 0)
    return (
      [
        { text: 'Отбейте набег на лесное поселение', target: tag('first') },
        { text: 'Ограбьте корован на торговом тракте', target: g.wagon },
        {
          text: 'Доставьте добычу лесному торговцу',
          target: g.actors.find((a) => a.tag === 'shop' && a.z > 0 && a.x < 0),
        },
      ][g.stage] || { text: 'Поселение спасено · Свободная игра', target: null }
    );
  if (g.side === 1)
    return (
      [
        { text: 'Получите приказ у командира', target: tag('commander') },
        { text: 'Защитите ворота от шпиона и партизана', target: tag('spy') },
        { text: 'Совершите набег на горный форт', target: tag('garrison') },
        { text: 'Доложите командиру о победе', target: tag('commander') },
      ][g.stage] || { text: 'Приказ исполнен · Свободная игра', target: null }
    );
  if (g.raid >= 0) {
    const [x, z] = CENTERS[g.raid];
    return { text: 'Ведите дружину в поход · ' + lands[g.raid].name, target: tag('raid') || point(x, z) };
  }
  return {
    text: g.stage ? 'Форт под вашей властью · Q — новый приказ' : 'Отдайте дружине приказ клавишей Q',
    target: g.stage ? null : merchant && g.actors.find((a) => a.team === 'friend' && a.hp > 0),
  };
}
function targetBearing(t) {
  const a = angles(Math.atan2(-(t.x - game.x), -(t.z - game.z)) - game.yaw);
  return Math.abs(a) < 0.23 ? '↑' : Math.abs(a) > 2.5 ? '↓' : a > 0 ? '←' : '→';
}
function drawHud() {
  const g = game,
    idx = zoneAt(g.x, g.z),
    obj = goal();
  $('compass-dir').textContent = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'][
    ((Math.round(-g.yaw / (Math.PI / 4)) % 8) + 8) % 8
  ];
  $('side-label').textContent = sides[g.side].name;
  $('area').textContent = g.inside ? houses[g.inside].name : lands[idx].name;
  $('quest').textContent = obj.text;
  $('direction').textContent =
    !g.inside && obj.target
      ? targetBearing(obj.target) + '  До цели ' + Math.round(distance(g, obj.target)) + ' м'
      : '';
  $('hp').textContent = Math.ceil(g.health) + ' / 100';
  $('hpbar').style.width = g.health + '%';
  $('stamina-bar').style.width = g.stamina + '%';
  $('supplies').textContent =
    (g.weapon === 'bow' ? 'Лук · Стрелы ' + g.arrows : 'Меч +' + g.upgrade) +
    '   ·   Бинты ' +
    g.bandages +
    '   ·   Монеты ' +
    g.coins;
  const effects = [];
  if (g.bleed > 0) effects.push('Кровотечение · H — бинт');
  if (g.leg === 'lost') effects.push('Ползком');
  if (g.leg === 'chair') effects.push('Коляска');
  if (g.arm === 'lost') effects.push('Ослабленный удар');
  if (g.eye === 'lost') effects.push('Ранен глаз');
  $('condition').textContent = effects.join(' · ');
  $('blind').hidden = g.eye !== 'lost';
  const item = interactable();
  $('interact').textContent = item ? 'E  ·  ' + item.label : '';
  const foe = g.inside ? null : aimedEnemy(10, 0.25);
  $('foe').hidden = !foe;
  if (foe) {
    const names = {
      guard: 'Стражник',
      spy: 'Шпион',
      elf: 'Лесной партизан',
      lord: 'Воин форта',
      escort: 'Охранник корована',
      commander: 'Капитан Арда',
      regent: 'Регент Вельт',
    };
    $('foe-name').textContent = (names[foe.kind] || 'Противник') + (foe.windup > 0 ? ' · Замах' : '');
    $('foe-hp').value = foe.hp;
    $('foe-hp').max = foe.maxHp || (['commander', 'escort'].includes(foe.kind) ? 75 : 58);
  }
  return obj.target;
}
function mapDialog() {
  const g = game;
  const goalPoint = goal().target;
  const pin = (className, p) =>
    p
      ? '<i class="' +
        className +
        '" style="left:' +
        ((p.x + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100 +
        '%;top:' +
        ((p.z + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100 +
        '%"></i>'
      : '';
  const cells = lands
    .map(
      (land, i) =>
        '<button data-travel="' +
        i +
        '" style="--land:url(./assets/land' +
        i +
        '.webp)">' +
        land.name +
        '</button>',
    )
    .join('');
  const body =
    '<p>Выберите регион для перехода.</p><div class="worldmap">' +
    cells +
    pin('wagon-dot', g.wagon) +
    (['trail', 'choice'].includes(g.story.phase) && !g.story.aid ? pin('witness-dot', places.rider) : '') +
    (g.story.herbs === 'seek' ? pin('herb-dot', herbBed) : '') +
    pin('goal-dot', goalPoint) +
    pin('player-dot', g) +
    '</div><p class="map-legend"><span>● Герой</span><span>◇ Цель</span><span>■ Корован</span>' +
    (['trail', 'choice'].includes(g.story.phase) && !g.story.aid ? '<span>✧ Свидетель</span>' : '') +
    (g.story.herbs === 'seek' ? '<span>✚ Травы</span>' : '') +
    '</p><p id="map-note">' +
    goal().text +
    '</p>';
  modal('Пограничье', 'Карта мира', body);
  document.querySelectorAll('[data-travel]').forEach(
    (el) =>
      (el.onclick = () => {
        if (g.actors.some((a) => a.team === 'hostile' && a.hp > 0 && distance(a, g) < 9)) {
          $('map-note').textContent = 'Сначала отойдите от противника на девять шагов.';
          return;
        }
        if (g.inside) leaveRoom();
        const dest = Number(el.dataset.travel),
          [x, z] = CENTERS[dest];
        g.x = x;
        g.z = z + 5;
        g.air = g.vy = 0;
        g.pitch = 0;
        g.yaw = dest === 1 || dest === 3 ? -0.72 : dest === 0 ? 0.51 : -0.13;
        g.arrow = null;
        if (g.order === 'follow')
          g.actors
            .filter((a) => a.team === 'friend' && a.hp > 0)
            .forEach((a, j) => Object.assign(a, clearSpot(x - 3 + j * 2, z + 7)));
        closeModal();
        notify(lands[dest].name);
        lodTime = 0;
        drawHud();
        capture();
      }),
  );
}
function raidOrder() {
  if (game.side !== 2) {
    notify('Приказы отдаёт только владыка');
    return;
  }
  const g = game;
  modal(
    'Старый форт',
    'Приказ дружине',
    '<p>В строю — ' +
      g.actors.filter((a) => a.team === 'friend' && a.hp > 0).length +
      '. Выберите цель похода или оставьте воинов на позиции.</p>' +
      actions([
        ['palace', 'Напасть на имперский дворец'],
        ['forest', 'Напасть на лесное поселение'],
        ['follow', 'Следовать за мной'],
        ['hold', 'Удерживать позицию'],
      ]),
  );
  const order = (dest) => {
    g.order = 'raid';
    if (g.raid !== dest) {
      g.actors.filter((a) => a.tag === 'raid').forEach((a) => (a.tag = ''));
      g.raid = dest;
      const [x, z] = CENTERS[dest];
      for (let j = 0; j < 3; j++)
        spawnAt(dest === 1 ? 'guard' : 'elf', 'hostile', x - 3 + j * 3, z + 2, 'raid');
    }
    if (!g.actors.some((a) => a.team === 'friend' && a.hp > 0)) {
      const [x, z] = CENTERS[3];
      for (let i = 0; i < 2; i++) spawnAt('lord', 'friend', x + i * 2, z + 5, 'squad');
    }
    closeModal();
    notify('Дружина выступила · ' + lands[dest].name);
    capture();
  };
  $('palace').onclick = () => order(1);
  $('forest').onclick = () => order(2);
  for (const cmd of ['hold', 'follow'])
    $(cmd).onclick = () => {
      g.order = cmd;
      closeModal();
      notify(cmd === 'hold' ? 'Дружина держит позицию' : 'Дружина следует за вами');
      capture();
    };
}
function interactable() {
  if (game.inside) {
    const a = roomAction();
    return a ? { label: a.label } : null;
  }
  const special = storyOptions()[0];
  if (special) return special;
  const g = game;
  const options = g.actors
    .filter(
      (a) =>
        a.hp > 0 &&
        (a.team === 'civilian' ||
          a.tag === 'shop' ||
          (a.tag === 'commander' && g.side === 1) ||
          a.team === 'friend'),
    )
    .map((a) => ({
      a,
      label:
        a.team === 'civilian'
          ? residents.find((n) => n.id === a.tag).name
          : a.tag === 'shop'
            ? 'Торговец и лекарь'
            : a.tag === 'commander'
              ? 'Говорить с командиром'
              : 'Приказ дружине',
    }));
  if (distance(g, ladder) < 2.4)
    options.push({
      a: ladder,
      label: g.air > 3 ? 'Спуститься с настила' : 'Подняться на лесной дозор',
      ladder: true,
    });
  for (const [id, h] of Object.entries(houses))
    options.push({ a: h.door, label: 'Войти · ' + h.name, house: id });
  options.push({ a: g.wagon, label: 'Ограбить корован' });
  return options
    .filter((v) => distance(g, v.a) < (v.a === g.wagon ? 4.8 : 3.6))
    .sort((a, b) => distance(g, a.a) - distance(g, b.a))[0];
}
function interact() {
  if (game.inside) {
    insideInteract();
    return;
  }
  const it = interactable();
  if (!it) {
    notify('Приблизьтесь к торговцу, союзнику или коровану');
    return;
  }
  const g = game;
  if (it.ladder) {
    if (g.leg === 'lost' || g.leg === 'chair') {
      notify('Для подъёма нужна здоровая нога или протез');
      return;
    }
    const up = g.air < 3;
    g.x = -59;
    g.z = up ? 57.28 : 58.56;
    g.air = up ? 4.62 : 0;
    g.vy = 0;
    notify(up ? 'Дозорная крона' : 'Лесная тропа');
    return;
  }
  if (it.house) {
    enterRoom(it.house);
    return;
  }
  if (it.story) {
    if (it.story === 'herb') gatherHerb();
    else storyInteraction(it.story);
    return;
  }
  if (it.a.team === 'civilian') {
    visitResident(it.a);
    return;
  }
  if (it.a === g.wagon) {
    if (g.story.phase === 'escort') {
      speak('Возница', 'Пока ты рядом, я держу дорогу.');
      return;
    }
    if (g.wagon.cool > 0) {
      notify('Корован пуст. Новый груз будет позже');
      return;
    }
    const defenders = g.actors.filter((a) => a.tag === 'escort' && a.hp > 0);
    if (defenders.length) {
      defenders.forEach((a) => (a.team = 'hostile'));
      notify('Охрана корована вступает в бой');
      return;
    }
    g.coins += 42;
    g.bandages++;
    g.robbed++;
    g.wagon.cool = 95;
    if (g.side === 0 && g.stage === 1) g.stage = 2;
    notify('Добыча · 42 монеты и бинт');
    tone(560, 0.3);
    return;
  }
  if (it.a.tag === 'shop') {
    if (g.side === 0 && g.stage === 2 && zoneAt(it.a.x, it.a.z) === 2) {
      g.stage = 3;
      g.coins += 35;
      notify('Поселение спасено · Награда 35 монет', 5);
    }
    shop();
    return;
  }
  if (it.a.tag === 'commander') {
    if (g.stage === 0) {
      g.stage = 1;
      spawnAt('spy', 'hostile', 48, -34, 'spy');
      spawnAt('elf', 'hostile', 55, -33, 'spy');
      modal(
        'Императорская гвардия',
        'Приказ командира',
        '<p>К южным воротам пробрались шпион и лесной партизан. Остановите их, затем ударьте по гарнизону старого форта в Чёрных горах.</p>',
      );
    } else if (g.stage === 3) {
      g.stage = 4;
      g.coins += 60;
      modal(
        'Императорская гвардия',
        'Приказ исполнен',
        '<p>Гарнизон разбит. Командир вручает вам 60 монет. Вы свободны продолжить путь по Пограничью.</p>',
      );
    } else notify(goal().text);
    return;
  }
  raidOrder();
}
const goods = [
  ['Бинт', 6, () => true, (g) => g.bandages++],
  [
    'Помощь лекаря',
    12,
    (g) => g.health < 100 || g.bleed,
    (g) => {
      g.health = 100;
      g.bleed = 0;
    },
  ],
  ['Усиление оружия', 32, (g) => g.upgrade < 3, (g) => g.upgrade++],
  ['Протез руки', 25, (g) => g.arm === 'lost', (g) => (g.arm = 'prosthetic')],
  ['Протез глаза', 22, (g) => g.eye === 'lost', (g) => (g.eye = 'prosthetic')],
  [
    'Коляска',
    10,
    (g) => g.leg === 'lost',
    (g) => {
      g.leg = 'chair';
      g.bleed = 0;
    },
  ],
  [
    'Протез ноги',
    28,
    (g) => ['lost', 'chair'].includes(g.leg),
    (g) => {
      g.leg = 'prosthetic';
      g.bleed = 0;
    },
  ],
];
goods.push(['Колчан · 12 стрел', 8, () => true, (g) => (g.arrows += 12)]);
function shop() {
  const stock = goods.map(([name, p, can, apply], i) => [name, priceAt(p, i), can, apply]);
  modal(
    'Торговая лавка',
    'Торговец и лекарь',
    '<p>В кошеле ' +
      game.coins +
      ' монет · Бинтов ' +
      game.bandages +
      ' · Оружие +' +
      game.upgrade +
      '</p>' +
      stock
        .map(
          ([name, price, can], i) =>
            '<button class="action shopline" data-buy="' +
            i +
            '" ' +
            (can(game) && game.coins >= price ? '' : 'disabled') +
            '><span>' +
            name +
            '</span><b>' +
            price +
            ' мон.</b></button>',
        )
        .join(''),
  );
  document.querySelectorAll('[data-buy]').forEach(
    (b) =>
      (b.onclick = () => {
        const [, price, can, apply] = stock[+b.dataset.buy];
        if (can(game) && game.coins >= price) {
          game.coins -= price;
          apply(game);
          tone(520, 0.13);
          drawHud();
          shop();
        }
      }),
  );
}
function bandage() {
  const g = game;
  if (!g.bandages || (g.health === 100 && !g.bleed)) {
    notify(g.bandages ? 'Перевязка не требуется' : 'Бинты закончились');
    return;
  }
  g.bandages--;
  g.bleed = 0;
  g.health = Math.min(100, g.health + 34);
  notify('Перевязка завершена');
  tone(320, 0.2);
  drawHud();
}
function wound() {
  const g = game;
  const available = ['arm', 'eye', 'leg'].filter((k) => g[k] === 'whole');
  if (!available.length) return;
  const k = available[Math.floor(Math.random() * available.length)];
  g[k] = 'lost';
  if (k !== 'eye') g.bleed = 1.65;
  notify(
    {
      arm: 'Потеря руки · H — остановить кровь',
      eye: 'Ранен глаз · Лекарь продаёт протез',
      leg: 'Потеря ноги · H — остановить кровь',
    }[k],
    4,
  );
}
function hitPlayer(d, attacker) {
  if (game.evade > 0) return;
  if (
    attacker &&
    game.blockTime > 0 &&
    Math.abs(angles(Math.atan2(game.x - attacker.x, game.z - attacker.z) - game.yaw)) < 1.28 &&
    game.stamina >= 7
  ) {
    const parry = game.parryWindow > 0;
    game.stamina -= parry ? 3 : 7;
    attacker.cd = parry ? 2.7 : 1.5;
    scoreCue('parry');
    notify(parry ? 'Парирование · противник открыт' : 'Удар принят на щит', 0.8);
    if (parry) {
      attacker.stagger = 1.15;
      hurtActor(attacker, 9, true);
    }
    return;
  }
  const g = game;
  g.health = Math.max(0, g.health - d);
  g.hits++;
  flash = 0.42;
  tone(94, 0.14, 'triangle', 0.09, 45);
  if (g.health <= 0) {
    death();
    return;
  }
  if (g.hits % 4 === 0) wound();
}
function hurtActor(a, amount, byPlayer) {
  if (a.hp <= 0) return;
  a.hp = Math.max(0, a.hp - amount);
  if (byPlayer) {
    $('hitmark').animate(
      [
        { opacity: 1, scale: 1.35 },
        { opacity: 0, scale: 0.8 },
      ],
      { duration: 280 },
    );
    scoreCue('impact');
  }
  if (a.hp === 0) {
    a.walk = false;
    if (byPlayer) {
      game.coins += 5;
      game.kills++;
      notify('Противник повержен · +5 монет', 1.7);
    }
  }
}
function visiblePath(a, b) {
  const d = distance(a, b),
    n = Math.ceil(d / 0.7);
  for (let j = 1; j < n; j++)
    if (!world.free(a.x + ((b.x - a.x) * j) / n, a.z + ((b.z - a.z) * j) / n, 0.07)) return false;
  return true;
}
function aimedEnemy(range, cone) {
  const g = game;
  let target = null,
    best = Infinity;
  for (const a of g.actors) {
    if (a.hp <= 0 || !['hostile', 'escort', 'resident'].includes(a.team)) continue;
    const d = distance(g, a),
      diff = Math.abs(angles(Math.atan2(-(a.x - g.x), -(a.z - g.z)) - g.yaw));
    if (
      d < range &&
      diff < cone &&
      d < best &&
      Math.abs(g.pitch) < 1.04 &&
      g.air < 2.3 &&
      visiblePath(g, a)
    ) {
      target = a;
      best = d;
    }
  }
  return target;
}
function attack(heavy = false) {
  if (game?.inside) return;
  if (!active || $('dialog').open || game.health <= 0 || swing > 0) return;
  const g = game;
  if (g.blockTime > 0) {
    notify('Опустите щит для удара', 0.8);
    return;
  }
  const cost = heavy ? 22 : 10;
  if (g.stamina < cost) {
    notify('Переведите дыхание', 0.7);
    return;
  }
  if (g.weapon === 'bow') {
    if (g.arm === 'lost') {
      notify('Для лука нужен протез руки');
      return;
    }
    if (!g.arrows) {
      notify('Стрелы закончились · 1 — меч');
      return;
    }
    if (g.arrow) return;
    g.arrows--;
    g.stamina -= 9;
    swing = 1;
    scoreCue('bow');
    const cp = Math.cos(g.pitch);
    g.arrow = {
      x: g.x,
      y: ground(g.x, g.z) + (g.leg === 'lost' ? 0.78 : g.leg === 'chair' ? 1.32 : 1.93) + g.air,
      z: g.z,
      dx: -Math.sin(g.yaw) * cp * 55,
      dy: Math.sin(g.pitch) * 55 + 1.6,
      dz: -Math.cos(g.yaw) * cp * 55,
      life: 1.65,
    };
    return;
  }
  g.stamina -= cost;
  g.heavy = heavy;
  swing = 1;
  tone(210, 0.13, 'triangle', 0.07, 55);
  const target = aimedEnemy(3.75, 0.82);
  if (target) {
    if (target.team === 'escort')
      g.actors.filter((a) => a.tag === 'escort' && a.hp > 0).forEach((a) => (a.team = 'hostile'));
    target.team = 'hostile';
    if (
      target.kind === 'regent' &&
      target.hp < 90 &&
      !target.windup &&
      !target.stagger &&
      !heavy &&
      (target.blocks = (target.blocks || 0) + 1) % 3 !== 0
    ) {
      scoreCue('parry');
      notify('Вельт держит щит · G — пробивающий удар', 1.3);
      return;
    }
    if (heavy) {
      target.stagger = 0.68;
      target.windup = 0;
    }
    hurtActor(
      target,
      (heavy ? 11 : 0) + (g.arm === 'lost' ? 13 : 29) + g.upgrade * 8 + (target.stagger > 0 ? 16 : 0),
      true,
    );
    tone(79, 0.15, 'square', 0.025, 49);
  }
}
function move(ent, dx, dz, r = 0.35) {
  const x = ent.x,
    z = ent.z;
  if (world.free(x + dx, z, r)) ent.x += dx;
  if (world.free(ent.x, z + dz, r)) ent.z += dz;
  return Math.hypot(x - ent.x, z - ent.z);
}
// Find a short detour on the local grid when a building blocks the direct route.
function detour(a, target) {
  const unit = 1.6,
    n = 39,
    mid = 19,
    start = mid * n + mid,
    parents = new Int16Array(n * n).fill(-1),
    queue = [start];
  parents[start] = start;
  let nearest = start,
    min = distance(a, target);
  for (let h = 0; h < queue.length; h++) {
    const at = queue[h],
      ix = at % n,
      iz = Math.floor(at / n);
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const u = ix + dx,
        v = iz + dz,
        next = v * n + u;
      if (u < 0 || v < 0 || u >= n || v >= n || parents[next] !== -1) continue;
      const x = a.x + (u - mid) * unit,
        z = a.z + (v - mid) * unit;
      if (!world.free(x, z, 0.4) || !world.free(x - dx, z - dz, 0.4)) continue;
      parents[next] = at;
      queue.push(next);
      const d = Math.hypot(target.x - x, target.z - z);
      if (d < min) {
        min = d;
        nearest = next;
      }
    }
  }
  const path = [];
  while (nearest !== start) {
    path.push(point(a.x + ((nearest % n) - mid) * unit, a.z + (Math.floor(nearest / n) - mid) * unit));
    nearest = parents[nearest];
  }
  return path.reverse();
}
function advance(a, t, speed, dt) {
  if (a.pathGoal && distance(a.pathGoal, t) > 7) a.path = null;
  if (a.path?.length && distance(a, a.path[0]) < 0.2) a.path.shift();
  const dest = a.path?.[0] || t,
    dx = dest.x - a.x,
    dz = dest.z - a.z,
    d = Math.hypot(dx, dz);
  if (d < 0.12) return;
  a.angle = Math.atan2(dx, dz);
  const step = Math.min(d, speed * dt);
  const walked = move(a, (dx / d) * step, (dz / d) * step, 0.32);
  a.walk = walked > 0.001;
  if (walked < step * 0.65) {
    a.stuck = (a.stuck || 0) + dt;
    if (a.stuck > 0.35) {
      a.path = detour(a, t);
      a.pathGoal = point(t.x, t.z);
      a.stuck = 0;
    }
  } else a.stuck = 0;
}
function wagonTick(dt) {
  const g = game,
    w = g.wagon;
  if (g.story.phase === 'escort') {
    escortTick(dt);
    return;
  }
  const fight = g.actors.some(
    (a) => a.tag === 'escort' && a.team === 'hostile' && a.hp > 0 && distance(g, w) < 16,
  );
  if (!fight) {
    const [x, z] = route[w.node],
      dx = x - w.x,
      dz = z - w.z,
      d = Math.hypot(dx, dz);
    if (d < 0.18) w.node = (w.node + 1) % 4;
    else {
      w.angle = Math.atan2(dx, dz);
      const n = Math.min(dt * 1.35, d) / d;
      w.x += dx * n;
      w.z += dz * n;
    }
  }
  if (w.cool > 0) {
    w.cool = Math.max(0, w.cool - dt);
    if (!w.cool) for (const j of [-1, 1]) spawnAt('escort', 'escort', w.x + j * 2.5, w.z, 'escort');
  }
}
function stepActors(dt) {
  const g = game;
  for (const a of g.actors) {
    a.walk = false;
    if (a.hp <= 0) continue;
    a.cd = Math.max(0, a.cd - dt);
    if (a.stagger > 0) {
      a.stagger -= dt;
      continue;
    }
    if (a.windup > 0) {
      a.windup -= dt;
      if (a.windup <= 0 && distance(a, g) < 3.15 && g.air < 1.35 && visiblePath(a, g)) {
        hitPlayer(a.kind === 'regent' ? 16 : 8, a);
        if (!g.health) return;
      }
      continue;
    }
    if (a.team === 'civilian') {
      wander(a, dt);
      continue;
    }
    if (a.team === 'escort') {
      const side = a.id % 2 ? 1 : -1,
        t = point(
          g.wagon.x + Math.cos(g.wagon.angle) * 2.6 * side,
          g.wagon.z - Math.sin(g.wagon.angle) * 2.6 * side,
        );
      if (distance(a, t) > 0.8) advance(a, t, 3, dt);
      continue;
    }
    if (!['friend', 'hostile'].includes(a.team)) continue;
    let target = a.team === 'hostile' && distance(a, g) < (a.tag === 'first' ? 52 : 26) ? g : null;
    for (const b of g.actors) {
      if (
        b.hp > 0 &&
        b.team === (a.team === 'friend' ? 'hostile' : 'friend') &&
        distance(a, b) < 14 &&
        (!target || distance(a, b) < distance(a, target))
      )
        target = b;
    }
    if (target) {
      const d = distance(a, target);
      if (d > 2.05 || !visiblePath(a, target)) advance(a, target, a.team === 'friend' ? 4.3 : 2.45, dt);
      else {
        a.angle = Math.atan2(target.x - a.x, target.z - a.z);
        if (!a.cd) {
          a.cd = 1.5 + Math.random() * 0.6;
          if (target === g) {
            a.windup = a.kind === 'regent' ? 0.72 : 0.54;
            if (!g.health) return;
          } else hurtActor(target, a.team === 'friend' ? 17 : 12, false);
        }
      }
    } else if (a.team === 'friend' && g.order !== 'hold') {
      let t = g;
      if (g.order === 'raid' && g.raid >= 0) {
        const [x, z] = CENTERS[g.raid];
        t = point(x + ((a.id % 3) - 1) * 2, z + 2);
      }
      if (distance(a, t) > (t === g ? 3.4 : 1.3)) advance(a, t, 5.4, dt);
    }
  }
}
function campaignTick(dt) {
  const g = game,
    alive = (tag) => g.actors.some((a) => a.tag === tag && a.hp > 0);
  if (g.side === 0 && g.stage === 0 && !alive('first')) {
    g.stage = 1;
    notify('Набег отражён · Найдите торговый корован', 5);
  }
  if (g.side === 1 && g.stage === 1 && !alive('spy')) {
    g.stage = 2;
    for (let j = 0; j < 2; j++) spawnAt('lord', 'hostile', 47 + j * 5, 52, 'garrison');
    notify('Ворота защищены · В поход на горный форт', 5);
  }
  if (g.side === 1 && g.stage === 2 && !alive('garrison')) {
    g.stage = 3;
    notify('Форт взят · Вернитесь к командиру', 4);
  }
  if (g.side === 2 && g.raid >= 0 && !alive('raid') && distance(g, point(...CENTERS[g.raid])) < 19) {
    g.raid = -1;
    g.stage++;
    g.coins += 45;
    g.order = 'follow';
    notify('Поход завершён · 45 монет в казну', 5);
  }
  g.encounter -= dt;
  if (g.encounter <= 0) {
    g.encounter = 85;
    const z = zoneAt(g.x, g.z);
    if (
      z !== 0 &&
      g.actors.filter((a) => a.hp > 0 && a.team === 'hostile' && distance(g, a) < 25).length < 3
    ) {
      const a = Math.random() * 6.28;
      const raiders = [
        ['guard', 'lord'],
        ['lord', 'spy', 'elf'],
        ['spy', 'elf'],
      ][g.side];
      spawnAt(
        raiders[Math.floor(Math.random() * raiders.length)],
        'hostile',
        clamp(g.x + Math.cos(a) * 19, -103, 103),
        clamp(g.z + Math.sin(a) * 19, -103, 103),
        'roamer',
      );
      notify('Дозорный заметил налётчика', 3);
    }
  }
}
function step(dt) {
  if (game.inside) return roomTick(dt);
  const g = game;
  const block = keys.has('KeyR') && g.weapon === 'sword' && g.stamina > 5;
  if (block && !g.blockTime) g.parryWindow = 0.3;
  g.blockTime = block ? g.blockTime + dt : 0;
  g.parryWindow = Math.max(0, g.parryWindow - dt);
  g.evade = Math.max(0, g.evade - dt);
  if (g.evade > 0) move(g, Math.sin(g.yaw) * dt * 11, Math.cos(g.yaw) * dt * 11);
  arrowTick(dt);
  if (keys.has('ArrowLeft')) g.yaw += dt * 1.85;
  if (keys.has('ArrowRight')) g.yaw -= dt * 1.85;
  const f =
      Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
    r = Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
    len = Math.hypot(r, f);
  if (g.stamina < 4) g.winded = true;
  if (g.stamina > 35) g.winded = false;
  const sprint =
    len > 0 &&
    (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
    !block &&
    !g.winded &&
    !['lost', 'chair'].includes(g.leg);
  g.stamina = clamp(g.stamina + dt * (sprint ? -6 : block ? 2.5 : 14), 0, 100);
  let bob = 0;
  if (len) {
    const speed = g.leg === 'lost' ? 1.25 : g.leg === 'chair' ? 3.4 : sprint ? 9 : block ? 2.8 : 5.4,
      delta = (speed * dt) / len;
    move(
      g,
      (Math.cos(g.yaw) * r - Math.sin(g.yaw) * f) * delta,
      (-Math.sin(g.yaw) * r - Math.cos(g.yaw) * f) * delta,
    );
    walking += dt * speed * 1.65;
    bob = Math.sin(walking) * 0.044;
  }
  soundscape(dt, len > 0, sprint);
  g.vy -= 18 * dt;
  g.air += g.vy * dt;
  const deck = watchHeight(g.x, g.z);
  if (deck > 0 && g.air > deck - 0.23 && g.air <= deck + 0.09 && g.vy <= 0) {
    g.air = deck;
    g.vy = 0;
  }
  if (g.air <= 0) g.air = g.vy = 0;
  swing = Math.max(0, swing - dt * (g.heavy ? 1.35 : 2));
  flash = Math.max(0, flash - dt);
  $('hurt').style.opacity = flash;
  if (g.bleed) {
    g.health -= g.bleed * dt;
    if (g.health <= 0) {
      death();
      return bob;
    }
  }
  wagonTick(dt);
  stepActors(dt);
  if (g.health > 0) {
    campaignTick(dt);
    storyTick();
  }
  return bob;
}
function loop(now) {
  if (!active) return;
  if ($('dialog').open && world.pausedFrame && !world.refreshFrame) {
    last = now;
    frame = requestAnimationFrame(loop);
    return;
  }
  world.pausedFrame = $('dialog').open;
  world.refreshFrame = false;
  const dt = last ? Math.min(0.18, (now - last) / 1000) : 0;
  last = now;
  let bob = 0;
  if (!$('dialog').open && game.health > 0) {
    gameTime += dt;
    for (let remaining = dt; remaining > 0 && game.health > 0; remaining -= 0.04)
      bob = step(Math.min(0.04, remaining));
    noticeTime -= dt;
    if (noticeTime <= 0) $('event').textContent = '';
  }
  if ((lodTime -= dt) <= 0) {
    world.lod(game.x, game.z);
    lodTime = 0.32;
  }
  if ((hudTime -= dt) <= 0) {
    drawHud();
    hudTime = 0.12;
  }
  world.display(game, gameTime, swing, prefs.motion ? bob : 0, goal().target);
  frame = requestAnimationFrame(loop);
}
$('start-label').textContent = 'Начать историю';
$('begin').disabled = false;
$('begin').onclick = () => start(false);
$('resume').onclick = () => start(true);
$('pause').onclick = pauseGame;
$('map-key').onclick = mapDialog;
document.addEventListener('keydown', (e) => {
  if (!active || $('dialog').open) return;
  const codes = [
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowRight',
    'ArrowLeft',
    'KeyE',
    'KeyF',
    'KeyH',
    'KeyQ',
    'KeyM',
    'KeyK',
    'Escape',
    'Space',
    'ShiftLeft',
    'ShiftRight',
  ];
  if (![...codes, 'KeyR', 'KeyC', 'KeyG', 'KeyJ', 'Digit1', 'Digit2'].includes(e.code)) return;
  e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (
    e.code === 'Space' &&
    (game.air === 0 ||
      (!game.inside && game.vy === 0 && Math.abs(game.air - watchHeight(game.x, game.z)) < 0.1)) &&
    !['lost', 'chair'].includes(game.leg)
  ) {
    game.vy = 7.4;
    game.air += 0.005;
    tone(110, 0.08, 'sine', 0.025, 140);
  }
  if (e.code === 'KeyJ') journal();
  if (e.code === 'Digit1' || e.code === 'Digit2') {
    game.weapon = e.code === 'Digit1' || (e.code === 'Digit2' && game.weapon === 'bow') ? 'sword' : 'bow';
    game.blockTime = 0;
    drawHud();
    notify(game.weapon === 'bow' ? 'Охотничий лук' : 'Дорожный меч', 1);
  }
  if (e.code === 'KeyC' && game.stamina >= 24 && game.leg !== 'lost' && game.leg !== 'chair') {
    game.evade = 0.29;
    game.stamina -= 24;
  }
  if (e.code === 'KeyG' && game.weapon === 'sword') attack(true);
  if (e.code === 'KeyF') attack();
  if (e.code === 'KeyH') bandage();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyK') save();
  if (e.code === 'KeyM') mapDialog();
  if (e.code === 'KeyQ') raidOrder();
  if (e.code === 'Escape') pauseGame();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
$('view').addEventListener('mousedown', (e) => {
  if (e.button === 0 && active && !$('dialog').open) {
    capture();
    attack();
  }
});
document.addEventListener('mousemove', (e) => {
  if (active && document.pointerLockElement && !$('dialog').open) {
    game.yaw -= e.movementX * 0.0024 * prefs.sensitivity;
    game.pitch = clamp(game.pitch - e.movementY * 0.0021 * prefs.sensitivity, -1.18, 1.18);
  }
});
document.addEventListener('pointerlockchange', () => {
  const locked = !!document.pointerLockElement;
  if (lockBefore && !locked && !expectedUnlock && active && !$('dialog').open) pauseGame();
  if (!locked) expectedUnlock = false;
  lockBefore = locked;
});
window.addEventListener('blur', () => {
  keys.clear();
  pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    pauseGame();
  }
});

// Touch controls share the same movement and action handlers as the keyboard.
const stick = $('stick'),
  stickKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
let stickId = null,
  lookId = null,
  lookX = 0,
  lookY = 0;
function releaseStick() {
  stickKeys.forEach((k) => keys.delete(k));
  stick.firstElementChild.style.transform = '';
  stickId = null;
}
function updateStick(e) {
  if (e.pointerId !== stickId) return;
  const b = stick.getBoundingClientRect(),
    x = (e.clientX - b.left - b.width / 2) / 32,
    y = (e.clientY - b.top - b.height / 2) / 32;
  const l = Math.max(1, Math.hypot(x, y));
  stick.firstElementChild.style.transform = 'translate(' + (x / l) * 24 + 'px,' + (y / l) * 24 + 'px)';
  stickKeys.forEach((k) => keys.delete(k));
  if (y < -0.21) keys.add('KeyW');
  if (y > 0.21) keys.add('KeyS');
  if (x < -0.21) keys.add('KeyA');
  if (x > 0.21) keys.add('KeyD');
}
stick.onpointerdown = (e) => {
  if (stickId !== null) return;
  stickId = e.pointerId;
  stick.setPointerCapture(stickId);
  updateStick(e);
};
stick.onpointermove = updateStick;
stick.onlostpointercapture = releaseStick;
$('view').onpointerdown = (e) => {
  if (e.pointerType !== 'touch' || lookId !== null) return;
  lookId = e.pointerId;
  lookX = e.clientX;
  lookY = e.clientY;
  $('view').setPointerCapture(lookId);
  e.preventDefault();
};
$('view').onpointermove = (e) => {
  if (e.pointerId !== lookId || !active || $('dialog').open) return;
  game.yaw -= (e.clientX - lookX) * 0.008 * prefs.sensitivity;
  game.pitch = clamp(game.pitch - (e.clientY - lookY) * 0.006 * prefs.sensitivity, -1.18, 1.18);
  lookX = e.clientX;
  lookY = e.clientY;
};
$('view').onlostpointercapture = () => (lookId = null);
document.querySelectorAll('[data-key]').forEach(
  (b) =>
    (b.onclick = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: b.dataset.key }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: b.dataset.key }));
    }),
);

$('journal-key').onclick = journal;
$('view').oncontextmenu = (e) => e.preventDefault();
$('view').addEventListener('mousedown', (e) => {
  if (e.button === 2 && active && !$('dialog').open) keys.add('KeyR');
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) keys.delete('KeyR');
});
$('touch-block').onpointerdown = (e) => {
  e.target.setPointerCapture(e.pointerId);
  keys.add('KeyR');
};
$('touch-block').onlostpointercapture = () => keys.delete('KeyR');
function arrowTick(dt) {
  const g = game,
    a = g.arrow;
  if (!a) return;
  // Substeps keep narrow targets and cover solid even on slower devices.
  for (let i = 0; i < 4; i++) {
    const h = dt / 4;
    a.x += a.dx * h;
    a.y += a.dy * h;
    a.z += a.dz * h;
    a.dy -= 6.4 * h;
    a.life -= h;
    if (a.life <= 0 || a.y <= ground(a.x, a.z) || !world.free(a.x, a.z, 0.015)) {
      g.arrow = null;
      return;
    }
    const foe = g.actors.find(
      (v) =>
        ['hostile', 'escort', 'resident'].includes(v.team) &&
        v.hp > 0 &&
        Math.hypot(v.x - a.x, v.z - a.z) < 0.54 &&
        Math.abs(a.y - ground(v.x, v.z) - 1.18) < 1.22,
    );
    if (foe) {
      if (foe.team === 'escort')
        g.actors.filter((v) => v.tag === 'escort' && v.hp > 0).forEach((v) => (v.team = 'hostile'));
      foe.team = 'hostile';
      hurtActor(foe, 33 + g.upgrade * 6 + (a.y > ground(foe.x, foe.z) + 1.74 ? 17 : 0), true);
      g.arrow = null;
      return;
    }
  }
}
