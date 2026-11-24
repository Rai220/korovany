'use strict';

const houses = {
  mill: {
    name: 'Мельница Эльды',
    door: { x: -73, z: -55.45 },
    object: 'Книга помола',
    desk: { x: -2.6, z: -2.45 },
    voice: 'Жернова ещё тёплые. На последних листах мука забилась в свежие чернила.',
  },
  archive: {
    name: 'Палата печатей',
    door: { x: 68, z: -63.25 },
    object: 'Стол хранителя печатей',
    desk: { x: -2.6, z: -2.45 },
    voice: 'Из стены тянет холодом. В нишах лежат оттиски всех двенадцати зим.',
  },
};
function roomAction() {
  const g = game,
    room = houses[g.inside],
    p = { x: g.roomX, z: g.roomZ };
  if (distance(p, { x: 0, z: 4.45 }) < 1.95) return { label: 'Выйти на улицу', key: 'leave' };
  if (distance(p, room.desk) < 2.8) return { label: room.object, key: 'desk' };
  if (distance(p, { x: 3.4, z: 1.6 }) < 2.45)
    return {
      label: g.inside === 'mill' ? 'Отдохнуть у очага · 3 монеты' : 'Прочитать караульную ведомость',
      key: 'rest',
    };
  return null;
}
function enterRoom(id) {
  const g = game;
  g.outsideYaw = g.yaw;
  g.inside = id;
  g.roomX = 0;
  g.roomZ = 2.35;
  g.yaw = g.pitch = g.air = g.vy = 0;
  g.arrow = null;
  keys.clear();
  notify(houses[id].name, 2);
  speak('Путевая запись', houses[id].voice);
  drawHud();
}
function leaveRoom() {
  const g = game;
  if (!g.inside) return;
  g.yaw = g.outsideYaw ?? 0;
  Object.assign(g, clearSpot(g.x, g.z, g));
  g.pitch = 0;
  g.inside = null;
  g.roomX = g.roomZ = 0;
  keys.clear();
  lodTime = 0;
  drawHud();
}
function insideInteract() {
  const g = game,
    id = g.inside,
    act = roomAction();
  if (!act) {
    notify('Подойдите к столу, нише или дверям');
    return;
  }
  if (act.key === 'leave') {
    leaveRoom();
    return;
  }
  if (act.key === 'rest') {
    if (id === 'archive') {
      speak(
        'Караульная ведомость',
        'Третью стражу с переправы снял регент. До рассвета ворота держали двое.',
      );
      return;
    }
    if (g.coins < 3) {
      notify('Для ночлега нужно 3 монеты');
      return;
    }
    if (g.health >= 100 && !g.bleed) {
      notify('Вы полны сил');
      return;
    }
    g.coins -= 3;
    g.health = 100;
    g.bleed = 0;
    g.stamina = 100;
    notify('Огонь согрел вас · Здоровье восстановлено');
    return;
  }
  if (id === 'mill') {
    scene(
      'Мельница Эльды',
      'Книга помола',
      0,
      'Старая помета',
      'В книге сорок мешков. В квитанции восемьдесят. Под сургучом остался отпечаток волчьей головы. У волка сколот левый клык.',
      [
        [
          'Переписать оттиск',
          () => {
            if (!g.story.imprint) {
              g.story.imprint = true;
              g.story.entries.push([
                'Оттиск из книги помола',
                'У настоящего волка сломан левый зуб. В имперском архиве можно получить ордер, сравнив оттиск с матрицами.',
              ]);
              checkpoint();
            }
            notify('Оттиск внесён в дневник');
          },
        ],
      ],
    );
    return;
  }
  if (g.story.warrant) {
    notify('Подписанный ордер уже в вашем дневнике');
    return;
  }
  if (!g.story.imprint) {
    scene(
      'Имперский архив',
      'Три матрицы',
      0,
      'Опись хранителя',
      'Под стеклом три похожих волка. Чтобы составить протокол, нужен заверенный оттиск из книги помола. Ищите книгу в мельнице Эльды, к западу от вольного рынка.',
      [['Закрыть опись', () => {}]],
    );
    return;
  }
  const wrong = () => notify('Этот волк не совпадает с зарисовкой в дневнике.');
  scene(
    'Имперский архив',
    'Сличение печатей',
    0,
    'Опись хранителя',
    'Приложите квитанцию Эльды к одной из трёх матриц. Хранитель подпишет ордер только при точном совпадении.',
    [
      ['Волк со сколотым правым зубом', wrong],
      [
        'Волк со сколотым левым зубом',
        () => {
          g.story.warrant = true;
          g.story.entries.push([
            'Ордер Палаты',
            'Матрица и оттиск совпали. Хранитель заверил право арестовать Вельта даже без живого свидетеля.',
          ]);
          checkpoint();
          notify('Получен судебный ордер');
        },
      ],
      ['Волк с целыми зубами', wrong],
    ],
  );
}
function roomTick(dt) {
  const g = game;
  if (keys.has('ArrowLeft')) g.yaw += dt * 1.85;
  if (keys.has('ArrowRight')) g.yaw -= dt * 1.85;
  const f =
      Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
    r = Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
    len = Math.hypot(f, r);
  if (len) {
    const v = (dt * (g.leg === 'lost' ? 1.25 : 3.65)) / len;
    const free = (x, z) =>
      Math.abs(x) < 4.65 &&
      Math.abs(z) < 4.85 &&
      !(x < -1.46 && x > -4.05 && z < -2.1 && z > -3.91) &&
      !(x > 2.6 && z > 1.1 && z < 2.99);
    const x = g.roomX + (r * Math.cos(g.yaw) - f * Math.sin(g.yaw)) * v,
      z = g.roomZ + (-r * Math.sin(g.yaw) - f * Math.cos(g.yaw)) * v;
    if (free(x, g.roomZ)) g.roomX = x;
    if (free(g.roomX, z)) g.roomZ = z;
    walking += dt * 7;
  }
  g.vy -= 18 * dt;
  g.air = Math.max(0, g.air + g.vy * dt);
  if (!g.air) g.vy = 0;
  if (g.bleed) {
    g.health -= g.bleed * dt;
    if (g.health <= 0) {
      death();
      return 0;
    }
  }
  swing = Math.max(0, swing - dt * 2);
  if (gameTime > subtitleUntil) $('subtitle').textContent = '';
  g.stamina = Math.min(100, g.stamina + dt * 14);
  return len ? Math.sin(walking) * 0.026 : 0;
}
class InteriorRealm extends Borderlands {
  buildRoom(id) {
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x201d17);
    const mill = id === 'mill';
    sc.add(new THREE.HemisphereLight(0xf4e6c7, 0x614a33, 0.82));
    const pointLight = (x, y, z, color, intensity) => {
      const l = new THREE.PointLight(color, intensity, 16, 1.7);
      l.position.set(x, y, z);
      sc.add(l);
      return l;
    };
    const fire = pointLight(3.72, 1.3, 1.7, 0xffac5c, 14),
      day = pointLight(-3, 3.1, -1.9, 0xffe2a0, 11);
    pointLight(0.7, 3.4, 2.5, 0xbac7eb, 9);
    const box = (x, y, z, w, h, d, c, rz = 0) => this.part(sc, this.box, c, x, y, z, w, h, d, rz);
    const mat = (n, c = 0xffffff) =>
      new THREE.MeshStandardMaterial({ map: texture(n), color: c, side: THREE.DoubleSide, roughness: 0.93 });
    const panel = (n, x, y, z, w, h, angle) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(n));
      m.position.set(x, y, z);
      m.rotation.y = angle;
      sc.add(m);
      return m;
    };
    box(0, -0.15, 0, 10.3, 0.3, 10.7, mill ? 0x897454 : 0x969384);
    box(0, 2.35, -5.29, 10.33, 4.7, 0.32, mill ? 0x897454 : 0x969384);
    box(0, 2.35, 5.29, 10.33, 4.7, 0.32, 0x897454);
    for (const side of [-1, 1]) {
      box(side * 5.08, 2.35, 0, 0.26, 4.7, 10.7, mill ? 0x897454 : 0x969384);
      for (let j = 0; j < 4; j++) box(side * 4.9, 2.35, -4.68 + j * 3.0, 0.22, 4.7, 0.23, 0x594431);
      box(side * 2.65, 5.06, 0, 5.71, 0.29, 10.8, 0x594431, -side * 0.36);
    }
    for (let i = 0; i < 5; i++) {
      box(0, 4.23, -4.7 + i * 2.27, 10, 0.26, 0.22, 0x594431);
      box(-3.84, 3.65, -4.7 + i * 2.27, 2.8, 0.19, 0.18, 0x897454, 0.53);
    }
    panel('gate', 0, 1.33, 5.102, 2.24, 2.66, Math.PI);
    panel('window', -4.93, 2.65, -1.7, 1.9, 2.25, Math.PI / 2);
    box(-2.7, 0.95, -2.95, 2.37, 0.14, 1.32, 0x897454);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) box(-2.7 + a * 0.95, 0.48, -2.95 + b * 0.48, 0.14, 0.94, 0.15, 0x594431);
    const openBook = panel('linen', -2.7, 1.04, -2.95, 0.96, 0.66, 0);
    openBook.rotation.x = -Math.PI / 2;
    for (let page = 0; page < 2; page++)
      for (let k = 0; k < 7; k++)
        box(-2.96 + page * 0.47, 1.046, -3.17 + k * 0.062, 0.31 - (k % 3) * 0.03, 0.012, 0.009, 0x553d26);
    this.part(sc, this.log, 0xbb5436, -2.08, 1.06, -2.81, 0.1, 0.046, 0.1);
    for (let i = 0; i < 4; i++) {
      const candle = box(
        -3.41 + (i % 2) * 0.22,
        1.18,
        -3.27 + Math.floor(i / 2) * 0.18,
        0.067,
        0.31 + i * 0.05,
        0.067,
        0xd5c9aa,
      );
      this.part(
        sc,
        this.head,
        0xffca66,
        candle.position.x,
        1.38 + i * 0.026,
        candle.position.z,
        0.026,
        0.069,
        0.026,
      );
    }
    if (mill) {
      const axle = new THREE.Group();
      axle.position.set(-2.5, 1.62, -4.59);
      sc.add(axle);
      const ring = this.part(axle, new THREE.TorusGeometry(1.31, 0.18, 6, 32), 0x897454, 0, 0, 0, 1, 1, 1);
      for (let j = 0; j < 16; j++) {
        const a = j * 0.3927;
        this.part(axle, this.box, 0x594431, Math.sin(a) * 1.48, Math.cos(a) * 1.48, 0, 0.18, 0.33, 0.32, -a);
        if (j < 4) this.part(ring, this.box, 0x897454, 0, 0, 0, 0.16, 2.64, 0.2, (j * Math.PI) / 4);
      }
      sc.userData.axle = axle;
      const sack = new THREE.LatheGeometry(
        [
          [0, 0],
          [0.33, 0.035],
          [0.41, 0.21],
          [0.38, 0.46],
          [0.24, 0.6],
          [0.08, 0.67],
          [0.13, 0.74],
        ].map((a) => new THREE.Vector2(...a)),
        16,
      );
      for (let i = 0; i < 9; i++) {
        const x = 1.54 + (i % 3) * 0.71,
          z = -3.65 + Math.floor((i % 6) / 3) * 0.66,
          y = Math.floor(i / 6) * 0.56;
        this.part(sc, sack, 0xd5c9aa, x, y, z, 1, 1, 1, 0.06 * Math.sin(i));
        this.part(sc, this.log, 0x594431, x, y + 0.67, z, 0.099, 0.044, 0.095);
      }
      for (let i = 0; i < 5; i++) box(-4 + i * 2.02, 2.32, -5.05, 0.18, 4.66, 0.18, 0x594431);
      for (let i = 0; i < 3; i++) box(2.3, 1.32 + i * 0.83, -4.88, 3.9, 0.15, 0.63, 0x594431);
      for (let i = 0; i < 7; i++) {
        const x = 0.64 + (i % 4) * 0.86,
          y = 1.56 + Math.floor(i / 4) * 0.83;
        this.part(sc, this.log, 0x716e60, x, y, -4.74, 0.19, 0.42, 0.19);
        this.part(sc, this.log, 0x897454, x, y + 0.24, -4.74, 0.12, 0.08, 0.12);
      }
      const pulley = this.part(
        sc,
        new THREE.TorusGeometry(0.26, 0.06, 7, 18),
        0x594431,
        1.5,
        3.77,
        -1.15,
        1,
        1,
        1,
      );
      box(1.24, 2.75, -1.15, 0.037, 2.05, 0.037, 0x897454);
      box(1.76, 2.93, -1.15, 0.038, 1.72, 0.039, 0x897454);
      this.part(sc, this.log, 0x716e60, 1.24, 1.59, -1.15, 0.18, 0.31, 0.18);
      this.part(pulley, this.log, 0x534432, 0, 0, 0, 0.08, 0.35, 0.08).rotation.x = Math.PI / 2;
      box(-3.76, 0.65, -4.23, 0.22, 1.3, 0.55, 0x594431);
      box(-1.25, 0.65, -4.23, 0.22, 1.3, 0.55, 0x594431);
      const pinion = this.part(
        sc,
        new THREE.TorusGeometry(0.57, 0.14, 6, 24),
        0x897454,
        -0.69,
        0.96,
        -4.48,
        1,
        1,
        1,
      );
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        this.part(pinion, this.box, 0x594431, 0.69 * Math.sin(a), 0.69 * Math.cos(a), 0, 0.13, 0.25, 0.2, -a);
      }
      sc.userData.pinion = pinion;
    } else {
      for (let j = 0; j < 4; j++) {
        box(1.4, 0.6 + j * 0.88, -4.45, 5.7, 0.15, 0.71, 0x897454);
        for (let i = 0; i < 19; i++)
          box(
            -1.14 + i * 0.285,
            0.99 + j * 0.88,
            -4.43,
            0.19,
            0.65,
            0.43,
            [0x644337, 0x6a6b51, 0x917f64][(i + j) % 3],
            0.03 * Math.sin(i),
          );
      }
      for (const side of [-1, 1]) box(1.4 + side * 2.82, 1.95, -4.46, 0.19, 3.88, 0.83, 0x594431);
      panel('standard-sun', -2.87, 3.04, -5.095, 1.38, 2.12, 0);
    }
    box(4.31, 1.19, 1.8, 1.24, 2.38, 2.49, 0x969384);
    box(3.64, 0.73, 1.8, 0.13, 1.08, 1.33, 0x443b2f);
    for (let j = 0; j < 6; j++) {
      const m = this.part(
        sc,
        this.spire,
        0xffca66,
        3.53,
        0.58,
        1.32 + j * 0.19,
        0.105,
        0.45 + (j % 3) * 0.15,
        0.14,
      );
      m.rotation.z = 0.11 * Math.cos(j);
    }
    box(3.45, 1.65, 1.8, 0.07, 0.08, 1.62, 0x524f47);
    for (let i = 0; i < 6; i++)
      this.part(sc, this.head, 0x716e60, 3.6, 0.18, 1.13 + i * 0.26, 0.22, 0.18, 0.18);
    const spot = new THREE.SpotLight(0xffdc9b, 35, 13, 0.6, 0.72, 1.5);
    spot.position.set(-4.55, 3.1, -1.5);
    spot.target.position.set(-0.4, 0.4, 1.7);
    spot.castShadow = true;
    spot.shadow.mapSize.set(512, 512);
    spot.shadow.bias = -0.0008;
    sc.add(spot, spot.target);
    for (const xx of [-3.6, 3.6]) box(xx, 3.91, -5.02, 2.95, 0.18, 0.19, 0x594431);
    sc.userData.fire = fire;
    sc.userData.day = day;
    return sc;
  }
  roomView(s, t, bob) {
    this.rooms ||= new Map();
    if (!this.rooms.has(s.inside)) this.rooms.set(s.inside, this.buildRoom(s.inside));
    const sc = this.rooms.get(s.inside);
    if (this.camera.parent !== sc) {
      sc.add(this.camera);
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.camera.fov !== 68) {
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
    }
    $('play').classList.remove('bow-focus');
    this.camera.position.set(
      s.roomX,
      (s.leg === 'lost' ? 0.78 : s.leg === 'chair' ? 1.32 : 1.71) + s.air + bob,
      s.roomZ,
    );
    this.camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    this.shield.visible = this.bow.visible = false;
    this.weapon.visible = false;
    sc.userData.fire.intensity = 13 + Math.sin(t * 4.5) * 1.2 + Math.sin(t * 13) * 0.43;
    if (sc.userData.axle) sc.userData.axle.rotation.z = -t * 0.36;
    if (sc.userData.pinion) sc.userData.pinion.rotation.z = t * 0.72;
    this.renderer.render(sc, this.camera);
  }
}
