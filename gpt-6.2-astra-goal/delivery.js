'use strict';

// The post road follows the same bridge, market junction and palace gate as the campaign.
const postRoad = [
  { x: -50, z: 39, name: 'Лесная почта' },
  { x: -50, z: 15, name: 'Клеверная застава', bar: true },
  { x: -50, z: 0, name: 'Соляной мост', bridge: true },
  { x: -50, z: -49, name: 'Поворот у мельницы', turn: true },
  { x: -5, z: -50, name: 'Имперская застава', bar: true },
  { x: 45, z: -50, name: 'Дворцовый лазарет' },
];
const postLines = {
  intro: 'На телеге шесть сосудов с лекарством. Во дворце ждут до рассвета. Бери вожжи.',
  bellNow: 'Звонок!',
  slowNow: 'Мост! Тише, береги груз!',
  gate: 'Впереди застава. Подай звонок, пока шлагбаум ещё перед тобой.',
  bridge: 'На мосту выбило доску. Сбавь ход. Там легко разбить груз.',
  turn: 'От рынка направо. Держись тракта, он выведет к дворцовому двору.',
  clear: 'Застава открыта. Держи середину дороги!',
  perfect: 'Всё цело. Я сдам груз лекарю. Хорошо провёл упряжку.',
  dented: 'Доехали. Отнеси лекарю уцелевшие сосуды. Он уже вышел встречать.',
  failed: 'Груз разбит. Придётся возвращаться за новой партией.',
};
const recordKey = 'korovany.goal.post-road.1';
let postReturn = null;
function bestDelivery() {
  try {
    const best = JSON.parse(localStorage.getItem(recordKey));
    return best &&
      Number.isFinite(best.time) &&
      best.time > 0 &&
      Number.isInteger(best.jars) &&
      best.jars > 0 &&
      best.jars <= 6
      ? best
      : null;
  } catch {
    return null;
  }
}
const postClock = (s) =>
  Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + (Math.floor(s * 10) % 10);
function initializeDelivery() {
  const g = game,
    w = g.wagon,
    start = postRoad[0];
  g.delivery = {
    gate: 1,
    time: 0,
    jars: 6,
    speed: 0,
    opened: false,
    phase: 'brief',
    shock: 0,
    bell: 0,
    lastWarning: -1,
  };
  Object.assign(w, { x: start.x, z: start.z, angle: Math.PI, cool: 0, listening: 0 });
  g.x = w.x;
  g.z = w.z;
  g.air = g.vy = g.pitch = 0;
  g.yaw = 0;
  g.story.started = true;
  g.actors = g.actors.filter((a) => a.tag === 'shop' || a.tag === 'commander' || a.team === 'civilian');
  g.health = 100;
  g.arm = g.eye = g.leg = 'whole';
  g.bleed = 0;
  g.inside = null;
  gameTime = 0;
  world.teamLast = null;
  world.travelPhase = 0;
  world.teamEnergy = 0;
  world.refreshFrame = true;
  $('play').classList.add('delivering');
  $('post-view').setAttribute('aria-pressed', 'false');
  if (!world.postProps) world.postProps = makePostProps(world);
  world.postProps.root.visible = true;
  world.postProps.cargo.visible = true;
  world.postProps.arms.forEach((arm) => {
    arm.rotation.z = 0;
  });
}
function postDispatch() {
  const best = bestDelivery();
  modal(
    'Дворцовая почта',
    'Почтовый перегон',
    '<div class="dispatch-art"></div><p class="dispatch-quote">' +
      postLines.intro +
      '</p>' +
      '<div class="dispatch-rules"><p><b>W / S</b> Разгон и тормоз</p><p><b>A / D</b> Поворот вожжей</p><p><b>Пробел</b> Звонок на заставе</p><p><b>V</b> Вид с козел или сзади</p></div>' +
      '<p>Ведите упряжку через пять ворот. На мосту держите скорость до 18 км/ч. На телефоне газ и руль совмещены на джойстике.</p>' +
      (best
        ? '<p class="delivery-best">Ваш рекорд · ' +
          best.jars +
          '/6 сосудов · ' +
          postClock(best.time) +
          '</p>'
        : '') +
      actions([
        ['post-start', 'Взять вожжи'],
        ['post-exit', postReturn ? 'Вернуться к герою' : 'В главное меню'],
      ]),
    () => {
      if (game?.delivery?.phase === 'brief') leaveDelivery();
    },
  );
  realmVoice.play('Возница', postLines.intro);
  $('post-start').onclick = () => {
    game.delivery.phase = 'running';
    closeModal();
    capture();
    drawHud();
  };
  $('post-exit').onclick = () => {
    modalExit = null;
    leaveDelivery();
  };
}
function rideFromShop() {
  if (!active || game.delivery) return;
  postReturn = { game, time: gameTime, frameYaw: game.yaw };
  // Keep the campaign and its live entities intact while the player runs the event.
  closeModal();
  world.clearPeople();
  newGame();
  initializeDelivery();
  drawHud();
  postDispatch();
}
function leaveDelivery(earned = 0) {
  modalExit = null;
  if (world.postProps) {
    world.postProps.root.visible = false;
    world.postProps.cargo.visible = false;
  }
  $('play').classList.remove('delivering');
  if (postReturn) {
    const previous = postReturn;
    postReturn = null;
    closeModal();
    world.clearPeople();
    game = previous.game;
    gameTime = previous.time;

    world.teamLast = null;
    world.teamEnergy = 0;
    world.refreshFrame = true;
    lodTime = hudTime = 0;
    game.yaw = previous.frameYaw;
    keys.clear();
    $('subtitle').textContent = '';
    subtitleUntil = chapterUntil = 0;
    $('chapter-toast').style.opacity = 0;
    drawHud();
    capture();
    if (earned) notify('Дворцовый лазарет выплатил ' + earned + ' монет');
  } else menu();
}
function postResult() {
  const d = game.delivery;
  d.phase = 'result';
  d.speed = 0;
  const best = bestDelivery(),
    won = d.jars > 0;
  const record = won && (!best || d.jars > best.jars || (d.jars === best.jars && d.time < best.time));
  if (record)
    try {
      localStorage.setItem(recordKey, JSON.stringify({ jars: d.jars, time: d.time }));
    } catch {}
  const title = !won ? 'Груз разбит' : d.jars === 6 ? 'Весь груз доставлен' : 'Лекарство доставлено';
  const line = !won ? postLines.failed : d.jars === 6 ? postLines.perfect : postLines.dented;
  const pay = d.jars * 5 + (d.jars === 6 ? 10 : 0);
  if (postReturn && pay) {
    const campaign = postReturn.game;
    campaign.coins += pay;
    campaign.story.entries.push([
      'Дворцовая почта',
      'Вам выдано ' + pay + ' монет за ' + d.jars + ' из шести сосудов.',
    ]);
    checkpoint(campaign);
  }
  if (won) scoreCue('chapter');
  modal(
    'Дворцовая почта · ведомость',
    title,
    '<div class="dispatch-art"></div><p class="dispatch-quote">' +
      line +
      '</p><div class="delivery-tally"><span><small>Груз</small>' +
      d.jars +
      ' / 6</span><span><small>Время</small>' +
      postClock(d.time) +
      '</span></div>' +
      (record ? '<p class="delivery-best">Новый личный рекорд</p>' : '') +
      actions([
        ['post-again', 'Ещё один рейс'],
        [
          'post-exit',
          postReturn ? 'Вернуться в кампанию' + (pay ? ' · ' + pay + ' монет' : '') : 'В главное меню',
        ],
      ]),
    () => leaveDelivery(pay),
  );
  realmVoice.play('Возница', line);
  $('post-again').onclick = () => {
    modalExit = null;
    closeModal();
    initializeDelivery();
    postDispatch();
  };
  $('post-exit').onclick = () => {
    modalExit = null;
    leaveDelivery(pay);
  };
}
function deliveryPause() {
  modal(
    'Дворцовая почта',
    'Привал на тракте',
    actions([
      ['post-resume', 'Продолжить рейс'],
      ['post-recover', 'Вернуться к последним воротам'],
      ['preferences', 'Настройки'],
      ['post-exit', postReturn ? 'Вернуться в кампанию' : 'В главное меню'],
    ]),
  );
  $('post-resume').onclick = () => {
    closeModal();
    capture();
  };
  $('post-recover').onclick = () => {
    const d = game.delivery,
      w = game.wagon,
      a = postRoad[d.gate - 1],
      b = postRoad[d.gate];
    Object.assign(w, { x: a.x, z: a.z, angle: Math.atan2(b.x - a.x, b.z - a.z) });
    d.speed = 0;
    d.time += 4;
    d.shock = 0;
    d.cameraTime = null;
    d.lastWarning = -1;
    d.bridgeWarned = false;
    game.x = w.x;
    game.z = w.z;
    world.teamLast = null;
    closeModal();
    capture();
    notify('Упряжка на тракте · +4 с');
  };
  $('post-exit').onclick = () => leaveDelivery();
  $('preferences').onclick = settings;
}
function postBell() {
  const d = game.delivery,
    w = game.wagon,
    target = postRoad[d.gate];
  if (d.phase !== 'running' || d.bell > 0) return;
  d.bell = 0.65;
  cowSound(1);
  if (!target.bar || d.opened) return;
  if (distance(w, target) > 20) {
    notify('Ближе к шлагбауму · звонок слышен с 20 м', 2);
    return;
  }
  d.opened = true;
  notify('Шлагбаум открыт', 2);
  if (postRoad[d.gate + 1]?.bridge) {
    d.bridgeWarned = true;
    speak('Возница', postLines.slowNow);
  } else if (!realmVoice.active) speak('Возница', postLines.clear);
}
function postDamage(text) {
  const d = game.delivery;
  if (d.shock > 0) return;
  d.jars--;
  d.shock = 1.8;
  d.speed *= 0.4;
  scoreCue('impact');
  notify(text + ' · осталось ' + d.jars + '/6', 2);
  if (!d.jars) postResult();
}
function teamFits(x, z, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  for (const [u, v, r] of [
    [-0.75, -1.05, 0.48],
    [0.75, -1.05, 0.48],
    [-0.75, 1.05, 0.48],
    [0.75, 1.05, 0.48],
    [-0.73, 2.9, 0.46],
    [0.73, 2.9, 0.46],
    [-0.73, 4.35, 0.43],
    [0.73, 4.35, 0.43],
  ]) {
    if (!world.free(x + u * c + v * s, z - u * s + v * c, r)) return false;
  }
  return true;
}
function deliveryTick(dt) {
  const d = game.delivery,
    w = game.wagon;
  if (d.phase !== 'running') return 0;
  const a = postRoad[d.gate - 1],
    b = postRoad[d.gate],
    leg = Math.hypot(b.x - a.x, b.z - a.z);
  const dx = (b.x - a.x) / leg,
    dz = (b.z - a.z) / leg;
  const lane = Math.abs((w.x - a.x) * dz - (w.z - a.z) * dx);
  const gas = keys.has('KeyW') || keys.has('ArrowUp'),
    brake = keys.has('KeyS') || keys.has('ArrowDown');
  const steer =
    Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight'));
  d.time += dt;
  d.bell = Math.max(0, d.bell - dt);
  d.shock = Math.max(0, d.shock - dt);
  const max = lane > 4.5 ? 4 : 9.3;
  const targetSpeed = brake ? (d.speed > 0.3 ? 0 : -1.9) : gas ? max : 0;
  d.speed += clamp(targetSpeed - d.speed, -dt * (brake ? 11 : 4.8), dt * 4.4);
  const yaw =
    w.angle + steer * dt * Math.min(1.45, 0.3 + Math.abs(d.speed) * 0.22) * (d.speed < -0.01 ? -1 : 1);
  const x = w.x + Math.sin(yaw) * d.speed * dt,
    z = w.z + Math.cos(yaw) * d.speed * dt;
  const oldDistance = distance(w, b);
  if (teamFits(x, z, yaw) && rollWagon(w, x - w.x, z - w.z, yaw, dt)) {
    game.x = w.x;
    game.z = w.z;
  } else if (Math.abs(d.speed) > 3.5) postDamage('Удар на обочине');
  else {
    d.speed = 0;
    if (teamFits(w.x, w.z, yaw)) rollWagon(w, 0, 0, yaw, dt);
  }
  if (d.phase !== 'running') return 0;
  game.yaw = w.angle + Math.PI;
  const until = (b.x - w.x) * dx + (b.z - w.z) * dz;
  const off = Math.abs((w.x - b.x) * dz - (w.z - b.z) * dx);
  if (oldDistance < 27 && d.lastWarning !== d.gate) {
    d.lastWarning = d.gate;
    if (b.bar && !d.opened) speak('Возница', d.gate === 1 ? postLines.bellNow : postLines.gate);
    else if (b.bridge && !d.bridgeWarned) speak('Возница', postLines.bridge);
    else if (b.turn) speak('Возница', postLines.turn);
  }
  if (b.bar && !d.opened && until < 5.2 && until > 0 && off < 3.85 && d.speed > 0) {
    if (d.speed > 4) postDamage('Сосуд разбился о шлагбаум');
    if (d.phase !== 'running') return 0;
    d.speed = 0;
    w.x -= dx * 0.12;
    w.z -= dz * 0.12;
    game.x = w.x;
    game.z = w.z;
  }
  if (until <= 0.65 && until >= -6 && off < 3.7 && (!b.bar || d.opened)) {
    if (b.bridge && d.speed > 5.0) postDamage('На мосту разбился сосуд');
    if (d.phase !== 'running') return 0;
    if (++d.gate === postRoad.length) {
      postResult();
      return 0;
    }
    d.opened = false;
    d.lastWarning = -1;
    cowSound(1);
    notify(b.name + ' · пройдено', 1.6);
  }
  if (gameTime > subtitleUntil && !realmVoice.active) $('subtitle').textContent = '';
  return 0;
}
function deliveryHud() {
  const d = game.delivery,
    b = postRoad[Math.min(d.gate, postRoad.length - 1)];
  $('post-stage').textContent = 'Дворцовая почта  ·  ' + Math.min(5, d.gate) + ' / 5';
  $('post-target').textContent = b.name;
  const bearing = targetBearing(b),
    metres = Math.round(distance(game.wagon, b));
  $('post-bearing').textContent = bearing + ' ' + metres + ' м';
  $('post-rule').textContent = b.bar
    ? d.opened
      ? 'Проезд открыт'
      : 'Звонок у шлагбаума · Пробел'
    : b.bridge
      ? 'По мосту · до 18 км/ч'
      : b.turn
        ? 'За рынком направо'
        : 'Довезите лекарство до лазарета';
  $('post-speed').textContent = Math.round(Math.abs(d.speed) * 3.6);
  $('post-jars').textContent = d.jars + ' / 6';
  $('post-time').textContent = postClock(d.time);
}
function makePostProps(realm) {
  const root = new THREE.Group(),
    arms = [];
  realm.scene.add(root);
  const wood = new THREE.MeshStandardMaterial({ color: 0x78472c }),
    brass = new THREE.MeshStandardMaterial({ color: 0xd8a744, metalness: 0.35, roughness: 0.43 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x287974, side: THREE.DoubleSide }),
    cream = new THREE.MeshStandardMaterial({ color: 0xf4dfa5 }),
    red = new THREE.MeshStandardMaterial({ color: 0xb24b3a });
  const cube = new THREE.BoxGeometry(1, 1, 1),
    f = new THREE.Shape();
  f.moveTo(-0.23, 0);
  f.lineTo(0.23, 0);
  f.lineTo(0, -0.52);
  f.closePath();
  const pennant = new THREE.ShapeGeometry(f);
  function mesh(parent, g, m, x, y, z, sx = 1, sy = 1, sz = 1) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  postRoad.slice(1).forEach((p, i) => {
    const site = new THREE.Group();
    site.position.set(p.x, ground(p.x, p.z), p.z);
    if (i > 2) site.rotation.y = Math.PI / 2;
    root.add(site);
    for (const side of [-1, 1]) {
      mesh(site, cube, wood, side * 3.65, 2.1, 0, 0.18, 4.2, 0.19);
      mesh(site, cube, brass, side * 3.65, 3.78, 0, 0.23, 0.21, 0.25);
    }
    mesh(site, cube, wood, 0, 4.05, 0, 7.48, 0.13, 0.14);
    for (let j = -6; j <= 6; j++) mesh(site, pennant, j % 2 ? teal : cream, j * 0.53, 3.98, 0);
    if (p.bar) {
      const arm = new THREE.Group();
      arm.position.set(-3.5, 1.34, 0);
      site.add(arm);
      mesh(arm, cube, cream, 3.4, 0, 0, 6.8, 0.15, 0.17);
      for (let j = 0; j < 7; j++) mesh(arm, cube, red, 0.33 + j * 0.95, 0, 0, 0.31, 0.16, 0.18);
      arms[i + 1] = arm;
    }
  });
  const { cargo, jugs, driver } = makePostalCargo(realm);
  return { root, arms, cargo, jugs, driver };
}
function cyclePostView() {
  const d = game?.delivery;
  if (!d || d.phase !== 'running') return;
  d.seated = !d.seated;
  $('post-view').setAttribute('aria-pressed', String(d.seated));
  world.refreshFrame = true;
}
function setDeliveryCamera(realm, s, t) {
  const w = s.wagon,
    d = s.delivery,
    c = realm.camera,
    angle = w.angle;
  const back = c.aspect < 0.85 ? 8.6 : 6.8,
    shoulder = c.aspect < 0.85 ? 1.1 : 3.1;
  const sx = Math.sin(angle),
    cz = Math.cos(angle),
    dx = -back * sx + shoulder * cz,
    dz = -back * cz - shoulder * sx;
  const roadHeight = ground(w.x, w.z);
  const shake = prefs.motion && d.shock > 1.2 ? 0.09 * Math.sin(t * 33) : 0;
  if (d.seated) {
    const bounce = prefs.motion
      ? Math.min(1, Math.abs(d.speed) / 5) * Math.sin(realm.travelPhase * 2) * 0.026
      : 0;
    c.position.set(w.x + sx * 2.17, roadHeight + 2.48 + bounce + shake, w.z + cz * 2.17);
    c.lookAt(w.x + sx * 15, roadHeight + 1.58, w.z + cz * 15);
  } else {
    let fraction = 1;
    for (let u = 0.16; u <= 1; u += 0.12) {
      if (!realm.free(w.x + dx * u, w.z + dz * u, 0.24)) {
        fraction = Math.max(0.16, u - 0.12);
        break;
      }
    }
    const x = w.x + dx * fraction,
      z = w.z + dz * fraction;
    c.position.set(
      x,
      Math.max(ground(x, z) + 2.3, ground(w.x, w.z) + (c.aspect < 0.85 ? 5.8 : 4.65)) + shake,
      z,
    );
    c.lookAt(w.x + sx * 4.8, ground(w.x, w.z) + 1.35, w.z + cz * 4.8);
  }
  realm.skyMesh.position.copy(c.position);
  for (const o of [realm.weapon, realm.bow, realm.shield, realm.chair, realm.marker]) o.visible = false;
  const dt = d.cameraTime == null ? 0 : clamp(t - d.cameraTime, 0, 0.12);
  d.cameraTime = t;
  const { arms, jugs, driver } = realm.postProps;
  driver.visible = !d.seated;
  poseCharacter(driver, 'drive', t);
  // A passed crossbeam can briefly fall between the chase camera and its target.
  realm.postProps.root.children.forEach((site, i) => {
    const p = postRoad[i + 1];
    site.visible = d.seated || d.gate <= i + 1 || distance(w, p) > back + 2;
  });
  arms.forEach((arm, i) => {
    const open = i < d.gate || (i === d.gate && d.opened);
    arm.rotation.z += (Number(open) * 1.45 - arm.rotation.z) * (1 - Math.exp(-7 * dt));
  });
  jugs.forEach((jar, i) => {
    jar.visible = i < d.jars;
    const bounce = Math.min(1, Math.abs(d.speed) / 6);
    jar.rotation.z = Math.sin(realm.travelPhase * 3 + i * 0.3) * 0.022 * bounce;
  });
  driver.rotation.z = Math.sin(realm.travelPhase * 1.5) * 0.025 * Math.min(1, Math.abs(d.speed) / 6);
}

function makePostalCargo(realm) {
  const cargo = new THREE.Group();
  realm.wagon.add(cargo);
  carved(cargo, (s) => {
    // The express rack sits behind the tailboard, in clear view of the driver camera.
    for (const x of [-0.7, 0.7]) {
      s.box(0x59402d, x, 1.24, -1.66, 0.105, 0.13, 1.36);
      s.taper(0x66503b, [x, 0.89, -1.36], [x, 1.22, -2.12], 0.045, 0.045);
    }
    for (let i = 0; i < 4; i++)
      s.box(i % 2 ? 0xa97442 : 0xa18054, 0, 1.34, -1.48 - i * 0.225, 2.13, 0.085, 0.213);
    for (const x of [-1.04, 1.04]) s.box(0x614a37, x, 1.48, -1.84, 0.08, 0.29, 1.02);
    s.box(0x2d6970, 0, 1.46, -2.34, 2.14, 0.28, 0.07);
    for (const x of [-0.94, 0.94]) s.oval(0xd4a65b, x, 1.46, -2.38, 0.045, 0.045, 0.014);
    s.box(0x865d39, 0, 1.57, 1.84, 1.86, 0.145, 0.55);
  });
  const profile = [
    [0.19, 0],
    [0.225, 0.03],
    [0.25, 0.12],
    [0.266, 0.28],
    [0.23, 0.4],
    [0.149, 0.49],
    [0.137, 0.56],
    [0.161, 0.575],
    [0.159, 0.61],
    [0.13, 0.62],
  ];
  const jarGeo = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  );
  const jugs = [],
    enamel = new THREE.MeshStandardMaterial({ color: 0xe7c991, roughness: 0.42 });
  const details = new THREE.Group();
  carved(details, (s) => {
    s.drum(0x77502e, 0, 0.628, 0, 0.128, 0.035, 0.128);
    s.drum(0x396f77, 0, 0.595, 0, 0.16, 0.032, 0.16);
    s.drum(0x386e74, 0, 0.303, 0, 0.266, 0.029, 0.266);
    s.drum(0xbc7651, 0, 0.25, 0, 0.266, 0.014, 0.266);
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      s.oval(0x447e79, Math.sin(a) * 0.263, 0.2, Math.cos(a) * 0.263, 0.015, 0.029, 0.015);
    }
  });
  for (let i = 0; i < 6; i++) {
    const jar = new THREE.Group(),
      body = new THREE.Mesh(jarGeo, enamel);
    body.castShadow = body.receiveShadow = true;
    jar.add(body, details.clone(true));
    jar.position.set(((i % 3) - 1) * 0.62, 1.395, -1.53 - Math.floor(i / 3) * 0.52);
    cargo.add(jar);
    jugs.push(jar);
  }
  const driver = realm.person('merchant', 'carter');
  cargo.add(driver);
  driver.position.set(0, 0.79, 1.85);
  poseCharacter(driver, 'drive', 0);
  carved(cargo, (s) => {
    for (const side of [-1, 1]) {
      s.taper(0x573c2a, [side * 0.32, 1.95, 2.23], [side * 0.58, 1.48, 3.2], 0.015, 0.015);
      s.taper(0x573c2a, [side * 0.58, 1.48, 3.2], [side * 0.77, 1.78, 4.29], 0.015, 0.015);
    }
  });
  return { cargo, jugs, driver };
}
