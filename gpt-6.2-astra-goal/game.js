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
const distance = (a, b) => Math.hypot(wrapped(a.x - b.x), wrapped(a.z - b.z));
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
function clearSpot(x, z, who = null) {
  const validAt = (x, z) => livingFree(x, z, who ? bodyRadius(who) : 0.4, who);
  if (validAt(x, z)) return point(x, z);
  for (let r = 1; r <= 12; r++)
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8,
        p = point(x + r * Math.sin(a), z + r * Math.cos(a));
      if (validAt(p.x, p.z)) return p;
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
    training: newTraining(),
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
    wagon:
      choice === 0
        ? { x: -42, z: 50, angle: -Math.PI / 2, node: 3, cool: 0 }
        : choice === 1
          ? { x: 40, z: -50, angle: Math.PI / 2, node: 1, cool: 0 }
          : { x: 46, z: 50, angle: -Math.PI / 2, node: 3, cool: 0 },
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
    game.yaw = -0.48;
  } else game.yaw = -0.64;
  settle();
  CENTERS.forEach(([a, b]) => {
    const m = actor('merchant', 'neutral', a - 6, b + 2.65, 'shop');
    m.angle = Math.PI;
  });
  actor('commander', choice === 1 ? 'neutral' : 'resident', 52, -51, 'commander');
  for (const side of [-1, 1]) {
    const w = game.wagon;
    const guard = spawnAt(
      'escort',
      'escort',
      w.x + side * 2.65 * Math.cos(w.angle),
      w.z - side * 2.65 * Math.sin(w.angle),
      'escort',
    );
    guard.escortSide = side;
    guard.angle = w.angle;
  }
  if (choice === 0) {
    spawnAt('guard', 'hostile', x - 3, z - 10, 'first');
    spawnAt('lord', 'hostile', x + 3, z - 15, 'first');
  }
  if (choice === 2) {
    for (let j = 0; j < 3; j++) spawnAt('lord', 'friend', x - 3 + j * 2, z + 2, 'squad');
    spawnAt('spy', 'hostile', x + 3, z + 18, 'intruder');
  }
}
function start(load, post = false, explore = false) {
  realmVoice.unlock();
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
  if (saved) {
    game = saved;
    restoreTraining(game);
    delete game.xpAt;
    delete game.rankUpAt;
    delete game.wardWarningAt;
    game.riposteLeft = 0;
    for (const m of [...game.actors, ...Object.values(game.hunts || {})]) {
      m.pinUntil = 0;
      m.struckAt = null;
      if (m.hunt) m.fellAt = null;
    }
    for (const record of Object.values(game.undercrofts || {})) {
      for (const m of record.foes) {
        m.fellAt = null;
        m.struckAt = null;
        m.hitAt = null;
        m.pinUntil = 0;
        m.planTime = 0;
        m.path = null;
      }
    }
  } else newGame();
  if (explore && !load) {
    const shore = fieldPoint('ferry');
    Object.assign(game, clearSpot(shore.x + 3, shore.z + 5.8, game));
    game.yaw = Math.atan2(game.x - shore.x, game.z - shore.z);
    game.frontierStart = true;
    fieldState().tracked = 'river';
    game.journalTab = 'expeditions';
  }
  if (post) initializeDelivery();
  else repairSpacing();
  world.teamLast = null;
  world.teamEnergy = 0;
  world.travelPhase = 0;
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
  if (post) postDispatch();
  else if (explore) journal('expeditions');
  else capture();
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
    validTraining(s.training) &&
    validAdventureSave(s) &&
    validDungeonSave(s) &&
    (!s.inside || (houses[s.inside] && Number.isFinite(s.roomX) && Number.isFinite(s.roomZ))) &&
    ['sword', 'bow'].includes(s.weapon) &&
    Number.isFinite(s.stamina) &&
    Number.isFinite(s.arrows) &&
    s.side === choice &&
    s.health > 0 &&
    s.health <= maxHealth(s) &&
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
  if (!active || game.health <= 0 || game.delivery) return;
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
  if (game.delivery) {
    deliveryPause();
    return;
  }
  modal(
    'Кампания',
    'Привал',
    actions([
      ['back', 'Продолжить игру'],
      ['abilities', 'Уровень и умения'],
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
  $('abilities').onclick = trainingDialog;
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
      '. Ограблено караванов — ' +
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
  if (game.dungeon) return dungeonGoal();
  if (game.delivery) return { text: 'Почтовый перегон', target: postRoad[game.delivery.gate] || null };
  const current = storyGoal();
  if (current) return current;
  const g = game,
    tag = (n) => g.actors.find((a) => a.tag === n && a.hp > 0),
    merchant = g.actors.find((a) => a.tag === 'shop' && zoneAt(a.x, a.z) === zoneAt(g.x, g.z));
  if (g.side === 0)
    return (
      [
        { text: 'Отбейте набег на лесное поселение', target: tag('first') },
        { text: 'Ограбьте караван на торговом тракте', target: g.wagon },
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
  const a = angles(Math.atan2(-wrapped(t.x - game.x), -wrapped(t.z - game.z)) - game.yaw);
  return Math.abs(a) < 0.23 ? '↑' : Math.abs(a) > 2.5 ? '↓' : a > 0 ? '←' : '→';
}
function navigationGoal() {
  if (game.markHall && !game.inside && houses[game.markHall]) {
    return { text: 'Найдите вход · ' + houses[game.markHall].name, target: houses[game.markHall].door };
  }
  if (!game.inside && !game.delivery) {
    const trail = fieldQuestGoal() || huntGoal();
    if (trail) return trail;
  }
  return goal();
}
function drawHud() {
  if (game.delivery) return deliveryHud();
  const g = game,
    idx = zoneAt(g.x, g.z),
    obj = navigationGoal();
  $('compass-dir').textContent = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'][
    ((Math.round(-g.yaw / (Math.PI / 4)) % 8) + 8) % 8
  ];
  if (g.dungeon) trailCompass({ yaw: g.yaw, ...dungeonPlayer() }, obj.target);
  else trailCompass(g, obj.target);
  $('side-label').textContent = sides[g.side].name;
  $('area').textContent = g.dungeon
    ? underways[g.dungeon].name
    : g.inside
      ? houses[g.inside].name
      : lands[idx].name;
  $('quest').textContent = obj.text;
  $('direction').textContent = g.dungeon
    ? 'M · План разведанных ходов'
    : !g.inside && obj.target
      ? targetBearing(obj.target) + '  До цели ' + Math.round(distance(g, obj.target)) + ' м'
      : '';
  trainingHUD();
  $('hp').textContent = Math.ceil(g.health) + ' / ' + maxHealth();
  $('hpbar').style.width = (100 * g.health) / maxHealth() + '%';
  $('stamina-bar').style.width = g.stamina + '%';
  $('supplies').textContent =
    (g.weapon === 'bow' ? 'Лук · Стрелы ' + g.arrows : 'Меч +' + g.upgrade) +
    '   ·   Бинты ' +
    g.bandages +
    '   ·   Монеты ' +
    g.coins;
  const effects = [];
  if (g.webbed > 0) effects.push('Опутан паутиной');
  if (g.bleed > 0) effects.push('Кровотечение · H — бинт');
  if (g.leg === 'lost') effects.push('Ползком');
  if (g.leg === 'chair') effects.push('Коляска');
  if (g.arm === 'lost') effects.push('Ослабленный удар');
  if (g.eye === 'lost') effects.push('Ранен глаз');
  $('condition').textContent = effects.join(' · ');
  $('blind').hidden = g.eye !== 'lost';
  const item = interactable();
  $('interact').textContent = item ? 'E  ·  ' + item.label : '';
  const boss =
    !g.inside && g.dragon?.engaged && g.dragon.hp > 0 && distance(g, g.dragon) < 30 ? g.dragon : null;
  const foe = boss || (g.dungeon ? dungeonTarget(13, 0.42) : g.inside ? null : aimedEnemy(10, 0.25));
  $('foe').hidden = !foe;
  $('foe').classList.toggle('warded', !!foe && requiredRank(foe) > heroLevel());
  $('foe').classList.toggle('boss', !!boss);
  $('foe').classList.toggle(
    'readied',
    !!foe && (foe.windup > 0 || (boss && ['inhale', 'chargeWind', 'brand', 'biteWind'].includes(boss.mode))),
  );
  if (foe) {
    const names = {
      guard: 'Стражник',
      spy: 'Шпион',
      elf: 'Лесной партизан',
      lord: 'Воин форта',
      escort: 'Охранник каравана',
      commander: 'Капитан Арда',
      regent: 'Регент Вельт',
    };
    const focusName = foe.convoyPart === 'archer' ? 'Лучник обоза' : foe.convoyPart ? 'Ось повозки' : null;
    $('foe-name').textContent =
      (focusName || foe.name || bestiary[foe.kind]?.name || names[foe.kind] || 'Противник') +
      (requiredRank(foe) > 1 ? ' · ур. ' + requiredRank(foe) : '') +
      (requiredRank(foe) > heroLevel()
        ? ' · Защита'
        : foe.moveKind === 'slam'
          ? ' · Удар в пол'
          : foe.phase === 'recover' || foe.recover > 0
            ? ' · Открыт'
            : foe.windup > 0
              ? ' · Замах'
              : '');
    if (foe.hunt && foe.phase === 'wind')
      $('foe-name').textContent +=
        ' · ' + ({ rush: 'Бросок', web: 'Плетёт ловушку', bite: 'Укус' }[foe.attack] || '');
    if (boss)
      $('foe-name').textContent +=
        ' · ' + ['I', 'II', 'III'][boss.phase - 1] + ' · ' + dragonMoves[boss.mode];
    $('foe-hp').max =
      (foe.convoyPart === 'archer' ? 46 : foe.convoyPart ? 82 : 0) ||
      foe.maxHp ||
      (['commander', 'escort'].includes(foe.kind) ? 75 : 58);
    $('foe-hp').value = foe.hp;
  }
  return obj.target;
}
function mapDialog() {
  if (game.dungeon) {
    dungeonMap();
    return;
  }
  const g = game;
  const goalPoint = navigationGoal().target;
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
    '<p>Тракты замыкаются в кольцо. По охристым меткам найдёте четыре дорожные заставы. Выберите регион для быстрого перехода.</p><div class="worldmap">' +
    cells +
    dairies
      .map((d, i) => pin((g.story.dairyStamps || []).includes(i) ? 'dairy-dot stamped' : 'dairy-dot', d))
      .join('') +
    fieldQuestMap() +
    pin('hall-marker', houses.palace.door) +
    pin('hall-marker', houses.fort.door) +
    pin('wagon-dot', g.wagon) +
    (['trail', 'choice'].includes(g.story.phase) && !g.story.aid ? pin('witness-dot', places.rider) : '') +
    (g.story.herbs === 'seek' ? pin('herb-dot', herbBed) : '') +
    pin('goal-dot', goalPoint) +
    pin('player-dot', g) +
    '</div><p class="map-legend"><span>● Герой</span><span>◇ Цель</span><span>■ Караван</span>' +
    (['trail', 'choice'].includes(g.story.phase) && !g.story.aid ? '<span>✧ Свидетель</span>' : '') +
    (g.story.herbs === 'seek' ? '<span>✚ Травы</span>' : '') +
    '<span>♜ Крепость</span></p><div class="hall-routes"><button data-hall="palace">Затопленный склеп · ур. 2</button><button data-hall="fort">Шахты Чёрной жилы · ур. 3</button><button id="atlas-expeditions">Слухи и экспедиции</button></div><p id="map-note">' +
    goal().text +
    '</p>';
  modal('Пограничье', 'Карта мира', body);
  $('atlas-expeditions').onclick = () => journal('expeditions');
  for (const el of document.querySelectorAll('[data-hall]')) {
    const id = el.dataset.hall;
    el.setAttribute('aria-pressed', String(id === g.markHall));
    el.title = id === g.markHall ? 'Снять метку с компаса' : 'Показать вход на компасе';
    el.onclick = () => {
      g.markHall = g.markHall === id ? null : id;
      g.trackHunt = null;
      if (g.exploration) g.exploration.tracked = null;
      closeModal();
      drawHud();
      notify(g.markHall ? 'Вход отмечен на компасе' : 'Показана цель кампании');
      capture();
    };
  }
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
        Object.assign(g, clearSpot(x, z + 5, g));
        g.air = g.vy = 0;
        g.pitch = 0;
        g.yaw = dest === 1 || dest === 3 ? -0.72 : dest === 0 ? 0.51 : -0.13;
        g.arrow = null;
        if (g.order === 'follow')
          g.actors
            .filter((a) => a.team === 'friend' && a.hp > 0)
            .forEach((a, j) => Object.assign(a, clearSpot(x - 3 + j * 2, z + 7, a)));
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
  if (game.dungeon) return dungeonAction();
  if (game.inside) {
    const a = roomAction();
    return a ? { label: a.label } : null;
  }
  const dragonLoot = dragonLootPrompt();
  if (dragonLoot) return { dragonLoot: true, label: dragonLoot };
  const quarry = huntLootOption();
  if (quarry) return quarry;
  const discovery = fieldQuestOption();
  if (discovery) return discovery;
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
  options.push(...buildingEntrances(g));
  dairies.forEach((site, i) =>
    options.push({ a: site, label: 'Поставить печать · ' + site.title, dairy: i }),
  );
  if (!g.wagon.convoy?.alarm) options.push({ a: bovineOffice(), cow: true, label: 'Окликнуть возницу' });
  options.push({ a: g.wagon, label: wagonRaidLabel() });
  const target = goal().target;
  // Orders have their own Q binding. A follower beside a stall should leave E to the merchant.
  const objective = target?.team === 'friend' ? null : target;
  return options
    .filter((v) => distance(g, v.a) < (v.a === g.wagon ? 4.8 : 3.6))
    .sort(
      (a, b) =>
        Number(b.a === objective) - Number(a.a === objective) ||
        Number(a.a.team === 'friend') - Number(b.a.team === 'friend') ||
        distance(g, a.a) - distance(g, b.a),
    )[0];
}
function interact() {
  if (game.dungeon) {
    dungeonInteract();
    return;
  }
  if (game.inside) {
    insideInteract();
    return;
  }
  const it = interactable();
  if (!it) {
    notify('Приблизьтесь к торговцу, союзнику или каравану');
    return;
  }
  const g = game;
  if (it.questSite) {
    fieldQuestUse(it);
    return;
  }
  if (it.dragonLoot) {
    collectDragonLoot();
    return;
  }
  if (it.huntLoot) {
    takeHunt(it.huntLoot);
    return;
  }
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
  if (it.cow) {
    speakCow();
    return;
  }
  if (it.dairy !== undefined) {
    stampDairy(it.dairy);
    return;
  }
  if (it.house) {
    if (g.markHall === it.house) g.markHall = null;
    enterRoom(it.house, it.entrance);
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
      notify('Караван пуст. Новый груз будет позже');
      return;
    }
    raidWagon();
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
      scene(
        'Императорская гвардия',
        'Приказ командира',
        'law',
        'Капитан Арда',
        'У южных ворот видели разведчика и лесного стрелка. Защити ворота. Когда поступит донесение, ударь по гарнизону старого форта в Чёрных горах.',
        [['Принять приказ', () => {}]],
      );
    } else if (g.stage === 3) {
      g.stage = 4;
      g.coins += 60;
      scene(
        'Императорская гвардия',
        'Приказ исполнен',
        'law',
        'Капитан Арда',
        'Дозор подтвердил. Форт взят. Жалованье у меня, шестьдесят монет. Можешь идти.',
        [['Вернуться к воротам', () => {}]],
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
    (g) => g.health < maxHealth(g) || g.bleed,
    (g) => {
      g.health = maxHealth(g);
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
        .join('') +
      '<button class="action" id="hire-post">Взять почтовый рейс</button>',
  );
  $('hire-post').onclick = rideFromShop;
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
  if (!g.bandages || (g.health >= maxHealth(g) && !g.bleed)) {
    notify(g.bandages ? 'Перевязка не требуется' : 'Бинты закончились');
    return;
  }
  g.bandages--;
  g.bleed = 0;
  g.health = Math.min(maxHealth(g), g.health + (hasTalent('medic') ? 54 : 34));
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
  const player = game.dungeon ? dungeonPlayer() : game;
  if (
    attacker &&
    game.blockTime > 0 &&
    Math.abs(angles(Math.atan2(wrapped(player.x - attacker.x), wrapped(player.z - attacker.z)) - game.yaw)) <
      1.28 &&
    game.stamina >= 7
  ) {
    const parry = game.parryWindow > 0;
    world.receiveGuardHit(parry);
    game.stamina -= parry ? 3 : 7;
    if (parry && hasTalent('riposte')) game.riposteLeft = 3;
    attacker.cd = parry ? 2.7 : 1.5;
    if (!game.dungeon)
      fieldImpact(
        game.x - Math.sin(game.yaw) * 0.85,
        walkingSurface(game.x, game.z) + 1.45,
        game.z - Math.cos(game.yaw) * 0.85,
      );
    fieldStrike('ring', 0.75);
    scoreCue('parry');
    notify(parry ? 'Парирование · противник открыт' : 'Удар принят на щит', 0.8);
    if (parry && !attacker.ranged) {
      attacker.stagger = 1.15;
      hurtActor(attacker, 9, true, 'parry');
    }
    return;
  }
  const g = game;
  g.health = Math.max(0, g.health - (hasTalent('bulwark') ? Math.max(1, Math.round(d * 0.76)) : d));
  g.hits++;
  flash = 0.42;
  if (attacker) {
    const a = angles(Math.atan2(-wrapped(attacker.x - player.x), -wrapped(attacker.z - player.z)) - g.yaw);
    $('hit-arc').style.transform = 'rotate(' + -a + 'rad)';
    $('hit-arc').animate([{ opacity: 0.97 }, { opacity: 0 }], { duration: 590 });
  }
  tone(94, 0.14, 'triangle', 0.09, 45);
  if (g.health <= 0) {
    death();
    return;
  }
  if (g.hits % (hasTalent('bulwark') ? 6 : 4) === 0) wound();
}
function hurtActor(a, amount, byPlayer, type = 'melee') {
  if (a.hp <= 0) return;
  if (a.tag === 'escort' && byPlayer) alarmConvoy();
  if (warded(a)) {
    if (a.kind === 'dragon' && byPlayer) dragonHit(amount, true, type);
    if (a.hunt) a.engaged = true;
    return;
  }
  if (byPlayer) amount = trainedDamage(a, amount, type);
  if (a.convoyPart) {
    convoyHit(a, amount, byPlayer, type);
    return;
  }
  if (a.kind === 'dragon') {
    dragonHit(amount, byPlayer, type);
    return;
  }
  if (a.hunt) {
    if (byPlayer) huntHit(a, amount);
    return;
  }
  if (game.dungeon) amount = dungeonArmor(a, amount, type);
  a.hp = Math.max(0, a.hp - amount);
  if (game.dungeon) {
    a.alert = 12;
    a.hitAt = gameTime;
    if (a.hp <= 0) {
      a.fellAt = gameTime;
      monsterCall(a.kind, true);
    }
  }
  if (byPlayer) {
    $('hitmark').animate(
      [
        { opacity: 1, scale: 1.35 },
        { opacity: 0, scale: 0.8 },
      ],
      { duration: 280 },
    );
    if (!game.dungeon)
      fieldImpact(
        a.x,
        walkingSurface(a.x, a.z) + 1.14,
        a.z,
        ['guard', 'regent', 'lord', 'escort'].includes(a.kind) ? 'steel' : 'dust',
      );
    scoreCue('impact');
  }
  if (a.hp === 0) {
    a.walk = false;
    if (byPlayer) {
      game.coins += 5;
      game.kills++;
      if (a.team === 'hostile' || a.tag === 'escort')
        awardXP(
          { hound: 27, weaver: 24, sentinel: 78, regent: 70 }[a.kind] || 19,
          bestiary[a.kind]?.name || 'Победа в бою',
        );
      notify('Противник повержен · +5 монет', 1.7);
    }
  }
}
function visiblePath(a, b) {
  const d = distance(a, b),
    n = Math.ceil(d / 0.7);
  for (let j = 1; j < n; j++)
    if (!world.free(a.x + (wrapped(b.x - a.x) * j) / n, a.z + (wrapped(b.z - a.z) * j) / n, 0.07))
      return false;
  return true;
}
function aimedEnemy(range, cone) {
  const g = game;
  let target = null,
    best = Infinity;
  for (const a of g.actors) {
    if (a.hp <= 0 || !['hostile', 'escort', 'resident'].includes(a.team)) continue;
    const d = distance(g, a),
      diff = Math.abs(angles(Math.atan2(-wrapped(a.x - g.x), -wrapped(a.z - g.z)) - g.yaw));
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
  for (const candidate of [convoyTarget(range, cone), huntTarget(range, cone), dragonTarget(range, cone)]) {
    if (candidate && (!target || distance(g, candidate) < distance(g, target))) target = candidate;
  }
  return target;
}
function attack(heavy = false) {
  if ((game?.inside && !game.dungeon) || game?.delivery) return;
  if (!active || $('dialog').open || game.health <= 0 || swing > 0) return;
  const g = game;
  if (g.blockTime > 0) {
    notify('Опустите щит для удара', 0.8);
    return;
  }
  const cost =
    g.weapon === 'bow'
      ? hasTalent('quiver')
        ? 5
        : 9
      : heavy
        ? hasTalent('breaker')
          ? 16
          : 22
        : hasTalent('blade')
          ? 7
          : 10;
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
    g.stamina -= cost;
    swing = 1;
    scoreCue('bow');
    const cp = Math.cos(g.pitch);
    const p = g.dungeon ? dungeonPlayer() : g;
    g.arrow = {
      x: p.x,
      y:
        (g.dungeon ? 0 : walkingSurface(g.x, g.z)) +
        (g.leg === 'lost' ? 0.78 : g.leg === 'chair' ? 1.32 : 1.71) +
        g.air,
      z: p.z,
      aimed: keys.has('KeyR'),
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
  fieldStrike('swish', 0.76, heavy);
  const target = (g.dungeon ? dungeonTarget : aimedEnemy)(heavy ? 3.18 : 3.02, 0.82);
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
      fieldImpact(
        game.x - Math.sin(game.yaw) * 0.85,
        walkingSurface(game.x, game.z) + 1.45,
        game.z - Math.cos(game.yaw) * 0.85,
      );
      fieldStrike('ring', 0.75);
      scoreCue('parry');
      notify('Вельт держит щит · G — пробивающий удар', 1.3);
      return;
    }
    if (
      heavy &&
      requiredRank(target) <= heroLevel() &&
      target.kind !== 'dragon' &&
      (target.kind !== 'sentinel' || hasTalent('breaker') || target.recover > 0)
    ) {
      target.stagger = 0.68;
      target.windup = 0;
    }
    hurtActor(
      target,
      (heavy ? 11 : 0) + (g.arm === 'lost' ? 13 : 29) + g.upgrade * 8 + (target.stagger > 0 ? 16 : 0),
      true,
      heavy ? 'heavy' : 'melee',
    );
    fieldStrike(
      'ring',
      ['guard', 'commander', 'lord', 'escort', 'regent'].includes(target.kind) ? 0.4 : 0.14,
      heavy,
    );
  }
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
        z = a.z + (v - mid) * unit,
        mx = x - dx * unit * 0.5,
        mz = z - dz * unit * 0.5;
      if (
        !canClimbStep(x - dx * unit, z - dz * unit, mx, mz) ||
        !canClimbStep(mx, mz, x, z) ||
        !livingFree(x, z, bodyRadius(a), a) ||
        !livingFree(mx, mz, bodyRadius(a), a)
      )
        continue;
      parents[next] = at;
      queue.push(next);
      const d = Math.hypot(wrapped(target.x - x), wrapped(target.z - z));
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
    dx = wrapped(dest.x - a.x),
    dz = wrapped(dest.z - a.z),
    d = Math.hypot(dx, dz);
  if (d < 0.12) return;
  const desired = Math.atan2(dx, dz),
    turning = Math.abs(angles(desired - a.angle));
  a.angle = desired;
  const step = Math.min(d, speed * dt * (0.16 + 0.84 * Math.max(0, Math.cos(turning))));
  let walked = move(a, (dx / d) * step, (dz / d) * step);
  if (walked < step * 0.36) {
    // Keep the same passing side until the lane opens so two oncoming walkers can separate.
    for (const angle of [0.82, -0.82, 1.45, -1.45]) {
      const yaw = a.angle + angle;
      const x = a.x + Math.sin(yaw) * step,
        z = a.z + Math.cos(yaw) * step;
      if (canClimbStep(a.x, a.z, x, z) && livingFree(x, z, bodyRadius(a), a)) {
        walked += move(a, Math.sin(yaw) * step, Math.cos(yaw) * step);
        a.angle = yaw;
        break;
      }
    }
  }
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
  if (w.listening > 0) {
    w.listening = Math.max(0, w.listening - dt);
    return;
  }
  if (g.story.phase === 'escort') {
    if (w.convoy?.alarm) delete w.convoy;
    escortTick(dt);
    return;
  }
  stepConvoy(w, dt);
  if (w.cool > 0) {
    w.cool = Math.max(0, w.cool - dt);
    if (!w.cool) {
      delete w.convoy;
      const alive = g.actors.filter((a) => a.tag === 'escort' && a.hp > 0).length;
      for (let i = alive; i < 2; i++) {
        const side = g.actors.some((a) => a.tag === 'escort' && a.hp > 0 && a.escortSide === -1) ? 1 : -1;
        const position = escortSlot(w, side);
        const guard = spawnAt('escort', 'escort', position.x, position.z, 'escort');
        guard.escortSide = side;
        guard.angle = w.angle;
      }
    }
  }
}
function stepActors(dt) {
  for (const actor of game.actors) {
    const before = { x: actor.x, z: actor.z, yaw: actor.angle };
    stepActor(actor, dt);
    updatePedestrianTurn(actor, before, dt);
    if (!game.health) return;
  }
}
function stepActor(a, dt) {
  const g = game;
  a.walk = false;
  if (a.hp <= 0) return;
  a.cd = Math.max(0, a.cd - dt);
  if (a.stagger > 0) {
    a.stagger -= dt;
    return;
  }
  if (a.windup > 0) {
    a.angle = Math.atan2(wrapped(g.x - a.x), wrapped(g.z - a.z));
    a.windup -= dt;
    if (a.windup <= 0 && distance(a, g) < 3.15 && g.air < 1.35 && visiblePath(a, g)) {
      hitPlayer(a.kind === 'regent' ? 16 : 8, a);
      if (!g.health) return;
    }
    return;
  }
  if (a.team === 'civilian') {
    wander(a, dt);
    return;
  }
  if (a.team === 'escort') {
    followWagon(a, dt);
    return;
  }
  if (!['friend', 'hostile'].includes(a.team)) {
    if (distance(a, g) < 4.2) a.angle = Math.atan2(wrapped(g.x - a.x), wrapped(g.z - a.z));
    return;
  }
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
    if (d > 2.05 || !visiblePath(a, target)) {
      const pace = a.team === 'friend' ? 4.3 : a.tag === 'escort' && g.wagon.convoy?.alarm ? 3.84 : 2.45;
      advance(a, target, pace, dt);
    } else {
      a.angle = Math.atan2(wrapped(target.x - a.x), wrapped(target.z - a.z));
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
function campaignTick(dt) {
  const g = game,
    alive = (tag) => g.actors.some((a) => a.tag === tag && a.hp > 0);
  if (g.side === 0 && g.stage === 0 && !alive('first')) {
    g.stage = g.robbed ? 2 : 1;
    notify(
      g.robbed
        ? 'Набег отражён · Доставьте груз торговцу в лесу'
        : 'Набег отражён · Окликните возницу (V) или ограбьте повозку',
      5,
    );
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
function tickGuard(dt) {
  const g = game;
  const block = keys.has('KeyR') && g.weapon === 'sword' && g.stamina > 5;
  if (block && !g.blockTime) g.parryWindow = 0.3;
  g.blockTime = block ? g.blockTime + dt : 0;
  g.parryWindow = Math.max(0, g.parryWindow - dt);
  g.evade = Math.max(0, g.evade - dt);
  return block;
}
function step(dt) {
  if (game.delivery) return deliveryTick(dt);
  game.riposteLeft = Math.max(0, (game.riposteLeft || 0) - dt);
  if (game.dungeon) return dungeonTick(dt);
  if (game.inside) return roomTick(dt);
  if (!realmVoice.active && gameTime > Math.max(7, subtitleUntil + 2)) {
    if (game.weapon === 'bow' && !game.story.aimTip) {
      game.story.aimTip = true;
      speak('Дозорная Лиора', 'Целься чуть выше. Стрела в полёте опускается.');
    } else if (
      game.actors.some((a) => a.hp > 0 && a.team === 'hostile' && distance(a, game) < 6) &&
      !game.story.shieldTip
    ) {
      game.story.shieldTip = true;
      speak('Капитан Арда', 'Подними щит, когда увидишь замах.');
    }
  }
  const g = game;
  const block = tickGuard(dt);
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
    const speed =
        (g.webbed > 0 ? 0.47 : 1) *
        (g.leg === 'lost' ? 1.25 : g.leg === 'chair' ? 3.4 : sprint ? 9 : block ? 2.8 : 5.4),
      delta = (speed * dt) / (len * (1 + 0.41 * creekDepth(g.x, g.z)));
    move(
      g,
      (Math.cos(g.yaw) * r - Math.sin(g.yaw) * f) * delta,
      (-Math.sin(g.yaw) * r - Math.cos(g.yaw) * f) * delta,
    );
    walking += dt * speed * 1.65;
    bob = Math.sin(walking) * 0.044;
  }
  soundscape(dt, len > 0, sprint);
  const beforeFall = g.air;
  g.vy -= 18 * dt;
  g.air += g.vy * dt;
  if (beforeFall > 2.05 && g.air <= 2.05 && !livingFree(g.x, g.z, bodyRadius(g), g))
    Object.assign(g, clearSpot(g.x, g.z, g));
  const deck = watchHeight(g.x, g.z);
  if (deck > 0 && g.air > deck - 0.23 && g.air <= deck + 0.09 && g.vy <= 0) {
    g.air = deck;
    g.vy = 0;
  }
  if (g.air <= 0) g.air = g.vy = 0;
  swing = Math.max(0, swing - dt * (g.weapon === 'bow' && hasTalent('quiver') ? 3 : g.heavy ? 1.35 : 2));
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
    fieldQuestTick(dt);
    huntTick(dt);
    if (g.health <= 0) return bob;
    dragonTick(dt);
    if (g.health <= 0) return bob;
    campaignTick(dt);
    storyTick();
    const ledger = [
      g.stage,
      g.story.phase,
      g.story.clues.length,
      g.story.branch,
      g.story.herbs,
      g.story.aid,
      g.story.dairyStamps?.length,
    ].join('/');
    if (g.storyLedger !== ledger) {
      g.storyLedger = ledger;
      trainingMilestones();
    }
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
    for (let remaining = dt; remaining > 0 && game.health > 0 && !$('dialog').open; remaining -= 0.04)
      bob = step(Math.min(0.04, remaining));
    noticeTime -= dt;
    if (noticeTime <= 0) $('event').textContent = '';
  }
  if (!game.inside && (lodTime -= dt) <= 0) {
    world.lod(game.x, game.z);
    lodTime = 0.32;
  }
  if ((hudTime -= dt) <= 0) {
    drawHud();
    hudTime = 0.12;
  }
  world.display(game, gameTime, swing, prefs.motion ? bob : 0, navigationGoal().target);
  frame = requestAnimationFrame(loop);
}
function selectEntry(load, post = false, explore = false) {
  if (editionBoot.failed) {
    location.reload();
    return;
  }
  if (world) {
    start(load, post, explore);
    return;
  }
  const loading = $('entry-loading');
  if (!loading.hidden) return;
  realmVoice.unlock();
  if (soundOn) scoreStart('menu');
  loading.hidden = false;
  setTimeout(() => {
    try {
      start(load, post, explore);
    } finally {
      loading.hidden = true;
    }
  }, 32);
}
editionBoot.ready();
$('begin').onclick = () => selectEntry(false);
$('post-race').onclick = () => selectEntry(false, true);
$('explore-entry').onclick = () => selectEntry(false, false, true);
$('post-bell').onclick = postBell;
$('post-view').onclick = cyclePostView;
$('rank-key').onclick = trainingDialog;
$('hero-view').onclick = changeHeroView;
$('resume').onclick = () => selectEntry(true);
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
    'KeyT',
    'KeyV',
    'KeyM',
    'KeyK',
    'KeyP',
    'Escape',
    'Space',
    'ShiftLeft',
    'ShiftRight',
  ];
  if (![...codes, 'KeyR', 'KeyC', 'KeyG', 'KeyJ', 'Digit1', 'Digit2'].includes(e.code)) return;
  e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (game.delivery) {
    if (e.code === 'Escape') pauseGame();
    if (e.code === 'Space') postBell();
    if (e.code === 'KeyV') cyclePostView();
    return;
  }
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
  if (e.code === 'KeyT') changeHeroView();
  if (e.code === 'KeyJ') journal();
  if (e.code === 'KeyP') trainingDialog();
  if (e.code === 'Digit1' || e.code === 'Digit2') {
    game.weapon = e.code === 'Digit1' || (e.code === 'Digit2' && game.weapon === 'bow') ? 'sword' : 'bow';
    game.blockTime = 0;
    drawHud();
    notify(game.weapon === 'bow' ? 'Охотничий лук' : 'Дорожный меч', 1);
  }
  const evadeCost = hasTalent('stride') ? 15 : 24;
  if (e.code === 'KeyC' && game.stamina >= evadeCost && game.leg !== 'lost' && game.leg !== 'chair') {
    game.evade = hasTalent('stride') ? 0.39 : 0.29;
    game.stamina -= evadeCost;
  }
  if (e.code === 'KeyG' && game.weapon === 'sword') attack(true);
  if (e.code === 'KeyF') attack();
  if (e.code === 'KeyH') bandage();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyK') save();
  if (e.code === 'KeyM') mapDialog();
  if (e.code === 'KeyV') speakCow();
  if (e.code === 'KeyQ') raidOrder();
  if (e.code === 'Escape') pauseGame();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
$('view').addEventListener('mousedown', (e) => {
  if (e.button === 0 && active && !$('dialog').open) {
    capture();
    if (!game.delivery) attack();
  }
});
document.addEventListener('mousemove', (e) => {
  if (active && !game.delivery && document.pointerLockElement && !$('dialog').open) {
    const focus = game.weapon === 'bow' && keys.has('KeyR') ? 0.56 : 1;
    game.yaw -= e.movementX * 0.0024 * prefs.sensitivity * focus;
    game.pitch = clamp(game.pitch - e.movementY * 0.0021 * prefs.sensitivity * focus, -1.18, 1.18);
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
  if (e.pointerId !== lookId || !active || game.delivery || $('dialog').open) return;
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
    a.x = wrapped(a.x + a.dx * h);
    a.y += a.dy * h;
    a.z = wrapped(a.z + a.dz * h);
    a.dy -= 6.4 * h;
    a.life -= h;
    if (a.life <= 0 || a.y <= walkingSurface(a.x, a.z) || !world.free(a.x, a.z, 0.015)) {
      if (a.life > 0) fieldImpact(a.x, a.y, a.z, 'dust');
      g.arrow = null;
      return;
    }
    const foe =
      dragonArrowHit(a) ||
      huntArrowHit(a) ||
      convoyArrowHit(a) ||
      g.actors.find(
        (v) =>
          ['hostile', 'escort', 'resident'].includes(v.team) &&
          v.hp > 0 &&
          distance(v, a) < 0.54 &&
          Math.abs(a.y - ground(v.x, v.z) - 1.18) < 1.22,
      );
    if (foe) {
      if (foe.team === 'escort')
        g.actors.filter((v) => v.tag === 'escort' && v.hp > 0).forEach((v) => (v.team = 'hostile'));
      foe.team = 'hostile';
      hurtActor(foe, 33 + g.upgrade * 6 + (a.y > ground(foe.x, foe.z) + 1.74 ? 17 : 0), true, 'arrow');
      g.arrow = null;
      return;
    }
  }
}
