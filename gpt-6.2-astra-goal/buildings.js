'use strict';

// Thresholds follow the timber doors in Borderlands.house. Both gable ends open into the same home.
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
    door: { x: 61.7, z: -63.25 },
    object: 'Стол хранителя печатей',
    desk: { x: -2.6, z: -2.45 },
    voice: 'Из стены тянет холодом. В нишах лежат оттиски всех двенадцати зим.',
  },
  palace: { name: 'Дворец · Зал присяги', kind: 'hall', door: { x: 68, z: -63.25 }, accent: 0x893d32 },
  fort: { name: 'Горный форт · Каменный чертог', kind: 'hall', door: { x: 68, z: 36.75 }, accent: 0x3d6256 },
};

const households = [
  [
    'wheelwright',
    'Мастерская колёсника',
    'Подогнать обод к колесу',
    'Заметки колёсника',
    'Обод нагревают в горне и надевают на дерево, пока железо ещё широко. Бочку с водой закатывают вплотную к воротам заранее.',
    0x916546,
  ],
  [
    'weaver',
    'Дом ткачихи',
    'Скроить два бинта · 4 монеты',
    'Образцы полотна',
    'Тонкий лён откладывают для лазарета. На краю каждого рулона две зелёные нити: по ним прачка отличает перевязочное полотно от парусины.',
    0x704455,
  ],
  [
    'inn',
    'Постоялый двор у переправы',
    'Отдохнуть · 3 монеты',
    'Книга постояльцев',
    'Последний гость записался до рассвета. Вместо имени оставил отпечаток большого пальца в муке и заплатил сразу за две лошади.',
    0x52634c,
  ],
  [
    'factor',
    'Лавка вольного рынка',
    'Открыть прилавок',
    'Торговая мера',
    'На бронзовой гире ставят по зарубке после каждой поверки. Гири казны поверяют весной, перед первым обозом с солью.',
    0xa17a48,
  ],
  [
    'fletcher',
    'Дом лучницы',
    'Оперить шесть стрел · 3 монеты',
    'Оперение стрел',
    'У трёх перьев на одном древке должен быть один загиб. Здесь их собирают только с левого крыла, сушат над окном и связывают льняной ниткой.',
    0x5e714d,
  ],
  [
    'herbalist',
    'Травная изба',
    'Приготовить настой · 4 монеты',
    'Травник',
    'Тысячелистник сушат в тени, зверобой — у тёплой стены. Корни убирают в закрытый ларец, иначе к весне от них останется одна труха.',
    0x586741,
  ],
  [
    'posthouse',
    'Лесная почта',
    'Принять почтовый перегон',
    'Реестр отправлений',
    'Шесть запечатанных сосудов для дворцового лазарета. На мосту пропустить встречного, у шлагбаума дать звонок. Возвратную расписку получает возница.',
    0x765543,
  ],
  [
    'watch',
    'Дом лесного дозора',
    'Изучить дозорную карту',
    'Вешки на тропе',
    'Три косые насечки обращены к жилью. Одинокая прямая означает воду. В чащу за сломанной вешкой ходят вдвоём — оттуда не видно дозорного огня.',
    0x4b6972,
  ],
];
const homeLots = [
  [-12, -9],
  [9, -11],
  [15, 7],
  [-13, 11],
];
for (let i = 0; i < households.length; i++) {
  const [id, name, action, note, text, accent] = households[i];
  const j = i % 4,
    region = i < 4 ? 0 : 2,
    [cx, cz] = CENTERS[region];
  const [dx, dz] = homeLots[j],
    localX = j % 2 ? -0.99 : 0.96;
  const doors = [1, -1].map((n) => ({
    x: cx + dx + localX,
    z: cz + dz + n * 3.04,
    n,
    key: n > 0 ? 'front' : 'back',
  }));
  houses[id] = {
    name,
    kind: 'home',
    forest: region === 2,
    localX,
    doors,
    door: doors[0],
    action,
    note,
    text,
    accent,
  };
}
for (const room of Object.values(houses)) {
  if (!room.doors) room.doors = [{ ...room.door, n: 1, key: 'front' }];
}

function buildingEntrances(player) {
  const entries = [];
  for (const [id, room] of Object.entries(houses)) {
    for (const door of room.doors) {
      const dx = wrapped(player.x - door.x),
        ahead = wrapped(player.z - door.z) * door.n;
      if (Math.abs(dx) > (room.kind === 'hall' ? 1.9 : 1.15) || ahead < -0.62 || ahead > 2.25) continue;
      entries.push({ a: door, house: id, entrance: door.key, label: 'Войти · ' + room.name });
    }
  }
  return entries;
}

const hallStairs = { x: -4.6, z: -6.0 };
function buildingFloor(id, x, z) {
  return houses[id]?.kind === 'hall' && Math.abs(x - hallStairs.x) < 1 && z < -5.67
    ? -Math.min(1.36, Math.floor((-z - 5.67) / 0.33 + 1) * 0.17)
    : 0;
}
function roomFeatures(id) {
  const room = houses[id];
  if (room.kind === 'home')
    return [
      { x: room.localX, z: 2.02, r: 0.96, key: 'leave', door: 'front', label: 'Выйти через переднюю дверь' },
      { x: room.localX, z: -2.02, r: 0.96, key: 'leave', door: 'back', label: 'Выйти во двор' },
      { x: -1.86, z: -0.66, r: 1.38, key: 'work', label: room.action },
      { x: 1.93, z: 0.04, r: 1.13, key: 'note', label: room.note },
    ];
  if (room.kind === 'hall') {
    const features = [
      { x: 0, z: 8.14, r: 1.75, key: 'leave', door: 'front', label: 'Вернуться в крепостной двор' },
      {
        ...hallStairs,
        endZ: -8.29,
        r: 1.63,
        key: 'dungeon',
        label: id === 'palace' ? 'Спуститься в дворцовые казематы' : 'Спуститься в подземелья форта',
      },
      {
        x: 0,
        z: -5.84,
        r: 1.78,
        key: 'note',
        label: id === 'palace' ? 'Прочитать устав гарнизона' : 'Развернуть карту перевалов',
      },
      {
        x: 4.53,
        z: 3.77,
        r: 1.72,
        key: 'service',
        label: id === 'palace' ? 'Получить перевязку в лазарете' : 'Пополнить арсенал · 8 монет',
      },
    ];
    if (id === 'palace')
      features.push({ x: 5.74, z: -3.28, r: 1.67, key: 'gallery', label: 'Войти в Палату печатей' });
    return features;
  }
  const points = [
    { x: 0, z: 4.45, r: 1.95, key: 'leave', door: 'front', label: 'Выйти на улицу' },
    { ...room.desk, r: 2.8, key: 'desk', label: room.object },
    {
      x: 3.4,
      z: 1.6,
      r: 2.45,
      key: 'rest',
      label: id === 'mill' ? 'Отдохнуть у очага · 3 монеты' : 'Прочитать караульную ведомость',
    },
  ];
  if (id === 'archive')
    points.push({ x: 4.52, z: -1.85, r: 1.58, key: 'gallery', label: 'Войти в Зал присяги' });
  return points;
}

function roomFree(id, x, z, size = 0.37) {
  const house = houses[id];
  const inside = (cx, cz, w, d) => Math.abs(x - cx) < w / 2 + size && Math.abs(z - cz) < d / 2 + size;
  if (
    indoorCast[id] &&
    inside(house.kind === 'hall' ? 4.93 : -1.83, house.kind === 'hall' ? 1.33 : 0.81, 0.46, 0.42)
  )
    return false;
  if (house.kind === 'home')
    return (
      Math.abs(x) <= 2.42 - size &&
      Math.abs(z) <= 2.25 - size &&
      !inside(-1.9, -0.65, 0.77, 1.66) &&
      !inside(2.03, 0, 0.47, 1.48)
    );
  if (house.kind === 'hall') {
    if (
      Math.abs(x) > 6.19 - size ||
      Math.abs(z) > 8.48 - size ||
      inside(0, -7.05, 2.8, 1.2) ||
      inside(4.8, 3.9, 1.2, 2.3)
    )
      return false;
    for (const xx of [-3.26, 3.26])
      for (const zz of [-4, 0.85, 5.36]) if (inside(xx, zz, 0.63, 0.63)) return false;
    if (z < -5.74 && (inside(-5.69, -7.1, 0.15, 2.81) || inside(-3.51, -7.1, 0.15, 2.81))) return false;
    return true;
  }
  return (
    Math.abs(x) < 4.65 &&
    Math.abs(z) < 4.85 &&
    !(x < -1.46 && x > -4.05 && z < -2.1 && z > -3.91) &&
    !(x > 2.6 && z > 1.1 && z < 2.99)
  );
}

// Furniture shares geometry and materials within each room. The renderer submits one instanced draw per batch.
class RoomJoinery {
  constructor(world, scene, room) {
    this.room = room;
    this.glazing = new Map();
    this.world = world;
    this.scene = scene;
    this.parts = new Map();
    this.unit = new THREE.Object3D();
    this.geos = world.indoorShapes ||= {
      ring: new THREE.TorusGeometry(1, 0.082, 8, 36),
      gable: new THREE.ShapeGeometry(
        new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]),
      ),
      jar: new THREE.LatheGeometry(
        [
          [0, 0],
          [0.57, 0.015],
          [0.78, 0.08],
          [1, 0.38],
          [0.87, 0.65],
          [0.42, 0.82],
          [0.39, 0.93],
          [0.53, 0.96],
          [0.53, 1],
          [0.36, 1],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        16,
      ),
      barrel: new THREE.LatheGeometry(
        [
          [0.74, 0],
          [0.83, 0.05],
          [0.98, 0.33],
          [1, 0.52],
          [0.96, 0.73],
          [0.82, 0.97],
          [0.78, 1],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        18,
      ),
      disc: new THREE.CylinderGeometry(1, 1, 1, 24),
      cone: new THREE.ConeGeometry(1, 1, 14),
    };
    this.materials = world.indoorMaterials ||= new Map();
  }
  part(geo, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    const mat = typeof color === 'number' ? this.world.mat(color) : color;
    const key = geo.uuid + mat.uuid;
    if (!this.parts.has(key)) this.parts.set(key, { geo, mat, poses: [] });
    const t = this.unit;
    t.position.set(x, y, z);
    t.scale.set(w, h, d);
    t.rotation.set(rx, ry, rz);
    t.updateMatrix();
    this.parts.get(key).poses.push(t.matrix.clone());
  }
  box(x, y, z, w, h, d, c, rx = 0, ry = 0, rz = 0) {
    this.part(this.world.box, c, x, y, z, w, h, d, rx, ry, rz);
  }
  round(x, y, z, r, h, c) {
    this.part(this.geos.disc, c, x, y, z, r, h, r);
  }
  beam(a, b, w, d, color) {
    const t = this.unit,
      up = new THREE.Vector3(0, 1, 0),
      end = new THREE.Vector3(...b),
      start = new THREE.Vector3(...a);
    const delta = end.clone().sub(start);
    t.position.copy(start).addScaledVector(delta, 0.5);
    t.scale.set(w, delta.length(), d);
    t.quaternion.setFromUnitVectors(up, delta.normalize());
    t.updateMatrix();
    const mat = this.world.mat(color),
      geo = this.world.box,
      key = geo.uuid + mat.uuid;
    if (!this.parts.has(key)) this.parts.set(key, { geo, mat, poses: [] });
    this.parts.get(key).poses.push(t.matrix.clone());
  }
  plate(name, x, y, z, w, h, angle = 0) {
    if (!this.materials.has(name))
      this.materials.set(
        name,
        new THREE.MeshStandardMaterial({ map: texture(name), side: THREE.DoubleSide, roughness: 0.91 }),
      );
    this.part(
      (this.world.indoorPlate ||= new THREE.PlaneGeometry(1, 1)),
      this.materials.get(name),
      x,
      y,
      z,
      w,
      h,
      1,
      0,
      angle,
    );
  }
  lamp(x, y, z, h = 0.26) {
    this.round(x, y + 0.025, z, 0.105, 0.05, 0x8b7147);
    this.round(x, y + h * 0.5, z, 0.052, h, 0xe3c99a);
    this.part(this.world.head, 0xffca66, x, y + h + 0.048, z, 0.027, 0.066, 0.029, 0.12);
  }
  pot(x, y, z, r, h, c) {
    this.part(this.geos.jar, c, x, y, z, r, h, r);
  }
  cask(x, z, scale, y = 0) {
    const r = 0.37 * scale,
      h = 0.89 * scale;
    this.part(this.geos.barrel, 0x795f42, x, y, z, r, h, r);
    for (const t of [0.13, 0.33, 0.74, 0.89])
      this.round(x, y + h * t, z, r * (Math.sin(t * Math.PI) * 0.18 + 0.84), 0.045 * scale, 0x4d5046);
    this.round(x, y + h, z, r * 0.79, 0.035 * scale, 0x897454);
  }
  table(x, z, w, d, y = 0.8) {
    this.box(x, y, z, w, 0.11, d, 0x795f42);
    for (const i of [-1, 1])
      for (const j of [-1, 1])
        this.box(x + i * (w * 0.43), y * 0.5, z + j * (d * 0.42), 0.095, y, 0.11, 0x594431);
    this.box(x, y * 0.34, z, w * 0.89, 0.075, 0.08, 0x594431);
  }
  door(x, z, normal, width = 1.02, height = 2.12, wall = false, sill = 0) {
    const at = (u, y, v, w, h, d, c) =>
      wall
        ? this.box(x + normal * v, y + sill, z + u, d, h, w, c)
        : this.box(x + u, y + sill, z + normal * v, w, h, d, c);
    at(0, height / 2, 0, width + 0.22, height + 0.08, 0.105, 0x534432);
    for (let j = 0; j < 6; j++)
      at(((j - 2.5) * width) / 6, height * 0.49, 0.06, width / 6 - 0.008, height * 0.98, 0.045, 0x795f42);
    for (const y of [0.27, height * 0.73]) {
      at(-width * 0.13, y, 0.095, width * 0.72, 0.057, 0.034, 0x494d47);
      for (const u of [-0.42, 0.11]) at(width * u, y, 0.116, 0.035, 0.037, 0.019, 0x9b8c74);
    }
    at(width * 0.3, height * 0.49, 0.11, 0.078, 0.13, 0.045, 0x66553e);
    const gripX = wall ? x + normal * 0.15 : x + width * 0.3;
    const gripZ = wall ? z + width * 0.3 : z + normal * 0.15;
    this.part(
      this.geos.ring,
      0x8b7958,
      gripX,
      height * 0.49 - 0.033 + sill,
      gripZ,
      0.061,
      0.076,
      0.17,
      0,
      wall ? Math.PI / 2 : 0,
    );
    at(0, 0.045, 0.06, width + 0.28, 0.09, 0.29, 0x716e60);
  }
  glass(outward, height) {
    if (this.glazing.has(outward)) return this.glazing.get(outward);
    const room = this.room,
      hall = room.kind === 'hall',
      renderer = this.world.renderer;
    // Each wall has its own exterior camera. The projected view is refreshed as the light changes.
    const target = new THREE.WebGLRenderTarget(384, 288, {
      minFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    if (renderer) {
      const centerX = hall ? room.door.x : room.door.x - room.localX;
      const centerZ = hall ? room.door.z - 9.37 : (room.doors[0].z + room.doors[1].z) / 2;
      const wx = nearest(centerX + outward * (hall ? 7.68 : 2.71), game.x);
      const wz = nearest(centerZ + (hall ? 0.1 : 0.64), game.z);
      const lens = new THREE.PerspectiveCamera(106, 4 / 3, 0.1, 300);
      lens.position.set(wx, ground(wx, wz) + height + (hall ? 3.32 : 0.05), wz);
      lens.lookAt(wx + outward * 12, lens.position.y, wz);
      const draw = () => {
        const previous = renderer.getRenderTarget();
        const sky = this.world.skyMesh,
          previousEye = sky.position.clone();
        sky.position.copy(lens.position);
        try {
          renderer.setRenderTarget(target);
          renderer.render(this.world.scene, lens);
        } finally {
          sky.position.copy(previousEye);
          renderer.setRenderTarget(previous);
        }
      };
      (this.scene.userData.windowViews ||= []).push(draw);
    }
    const mat = new THREE.MeshBasicMaterial({ map: target.texture, color: 0xf3f5eb, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.outward = { value: outward };
      shader.vertexShader =
        'varying vec3 glassPosition;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nglassPosition=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;',
        );
      shader.fragmentShader =
        'varying vec3 glassPosition; uniform float outward;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `vec3 ray=normalize(glassPosition-cameraPosition); float depth=max(.12, ray.x*outward);
         vec2 view=vec2(outward*ray.z / 1.333333,ray.y)/(2.65409*depth)+.5;
         diffuseColor.rgb*=texture2D(map,clamp(view,.001,.999)).rgb;`,
        );
    };
    mat.customProgramCacheKey = () => 'settlement-window';
    this.glazing.set(outward, mat);
    return mat;
  }
  window(x, z, sign, y, w, h) {
    this.part(
      (this.world.indoorPlate ||= new THREE.PlaneGeometry(1, 1)),
      this.glass(-sign, y),
      x,
      y,
      z,
      w,
      h,
      1,
      0,
      sign > 0 ? Math.PI / 2 : -Math.PI / 2,
    );
    for (const f of [-1, 1]) this.box(x, y, z + f * (w / 2 + 0.035), 0.12, h + 0.18, 0.085, 0x594431);
    for (const f of [-1, 1]) this.box(x, y + f * (h / 2 + 0.035), z, 0.14, 0.09, w + 0.18, 0x594431);
    this.box(x + sign * 0.06, y - h / 2 - 0.07, z, 0.31, 0.085, w + 0.29, 0x897454);
    this.box(x + sign * 0.026, y, z, 0.065, h, 0.044, 0x534432);
    this.box(x + sign * 0.026, y, z, 0.065, 0.052, w, 0x534432);
  }
  paper(x, y, z, w, d, angle = 0) {
    this.box(x, y, z, w, 0.014, d, 0xd6c9a0, 0, angle);
    for (let j = 0; j < 5; j++) {
      const u = (j - 2) * d * 0.13;
      this.box(
        x + u * Math.sin(angle),
        y + 0.009,
        z + u * Math.cos(angle),
        w * (0.61 + 0.09 * Math.cos(j)),
        0.008,
        0.013,
        0x74634c,
        0,
        angle,
      );
    }
  }
  finish() {
    for (const { geo, mat, poses } of this.parts.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, poses.length);
      poses.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }
}

function furnishHouse(j, id, h) {
  const wood = 0x897454,
    dark = 0x594431,
    plaster = h.forest ? wood : 0xc4b494;
  j.box(0, -0.1, 0, 5.02, 0.2, 4.83, wood);
  for (let k = -8; k <= 8; k++) j.box(k * 0.29, 0.003, 0, 0.012, 0.006, 4.56, 0x4a4236);
  for (const n of [-1, 1]) {
    j.box(0, 1.58, n * 2.34, 5.04, 3.16, 0.18, plaster);
    j.box(n * 2.53, 1.58, 0, 0.22, 3.16, 4.83, plaster);
    j.part(j.geos.gable, plaster, 0, 3.13, n * 2.28, 5.04, 1.13, 1, 0, n > 0 ? Math.PI : 0);
    j.door(h.localX, n * 2.235, -n);
    j.window(n * 2.402, 0.64, -n, 1.89, 1.02, 1.09);
    for (const v of [-1.97, 0, 1.97]) j.box(n * 2.407, 1.58, v, 0.14, 3.16, 0.13, dark);
    j.box(n * 2.37, 0.42, 0, 0.13, 0.11, 4.57, dark);
    j.box(n * 2.37, 2.91, 0, 0.13, 0.17, 4.57, dark);
    j.box(n * 1.27, 3.66, 0, 2.86, 0.21, 4.82, dark, 0, 0, -n * 0.45);
    j.box(n * 1.3, 3.57, 0, 2.85, 0.1, 4.74, wood, 0, 0, -n * 0.45);
  }
  for (const z of [-1.96, 0.02, 1.96]) {
    j.box(0, 3.1, z, 4.82, 0.16, 0.16, dark);
    for (const n of [-1, 1]) j.beam([n * 2.18, 2.57, z], [n * 1.6, 3.1, z], 0.1, 0.11, dark);
  }
  // Reading shelf and the local workbench sit on opposite walls, leaving a clear walk between both doors.
  j.table(-1.91, -0.65, 0.78, 1.62, 0.85);
  j.table(2.08, 0.03, 0.53, 1.39, 0.85);
  j.paper(2.03, 0.916, -0.1, 0.38, 0.46, 0.02);
  j.lamp(2.11, 0.91, 0.54);
  j.box(2.16, 1.5, -0.53, 0.44, 0.07, 0.79, wood);
  j.pot(2.13, 1.54, -0.61, 0.12, 0.24, 0x9c684d);
  // A small woven runner and braid give each profession its own colours.
  j.box(0.03, 0.014, 0.05, 0.71, 0.019, 1.53, h.accent);
  for (const s of [-1, 1])
    for (let k = 0; k < 4; k++) j.box(0.03, 0.027, s * (0.51 + k * 0.057) + 0.05, 0.67, 0.009, 0.017, 0xc1aa82);
  if (id === 'wheelwright') {
    j.part(j.geos.ring, 0x795f42, -1.95, 1.48, -0.66, 0.51, 0.51, 0.81, 0, Math.PI / 2);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 6,
        dy = Math.cos(a) * 0.49,
        dz = Math.sin(a) * 0.49;
      j.beam([-1.95, 1.48 - dy, -0.66 - dz], [-1.95, 1.48 + dy, -0.66 + dz], 0.031, 0.043, wood);
    }
    j.part(j.geos.disc, 0x716e60, -1.95, 1.48, -0.66, 0.075, 0.23, 0.075, 0, 0, Math.PI / 2);
    for (let k = 0; k < 3; k++) j.box(-1.99 + k * 0.12, 0.93, 0.05, 0.062, 0.057, 0.37, 0x696d65);
    j.part(j.geos.ring, 0x4d5046, -2.28, 0.67, 1.23, 0.58, 0.58, 0.8, 0, Math.PI / 2);
  } else if (id === 'weaver') {
    for (const z of [-1.34, 0.02]) j.beam([-2.2, 0.88, z], [-1.6, 2.08, z], 0.08, 0.08, dark);
    for (const t of [0, 1]) j.box(-2.17 + t * 0.55, 0.97 + t * 1.09, -0.66, 0.1, 0.09, 1.45, dark);
    for (let k = 0; k < 28; k++) {
      const z = -1.29 + k * 0.046;
      j.beam([-2.15, 0.99, z], [-1.63, 2.04, z], 0.013, 0.015, 0xd5c9aa);
    }
    for (let k = 0; k < 10; k++)
      j.box(-1.99 + k * 0.018, 1.3 + k * 0.035, -0.66, 0.035, 0.022, 1.28, k % 4 ? h.accent : 0xc1a68a);
    for (let k = 0; k < 4; k++)
      j.part(
        j.geos.disc,
        k % 2 ? h.accent : 0xd5c9aa,
        2.1,
        1.62 + k * 0.049,
        -0.4,
        0.1,
        0.26,
        0.1,
        0,
        0,
        Math.PI / 2,
      );
  } else if (id === 'inn') {
    j.box(-1.92, 0.98, -0.63, 0.78, 0.18, 1.64, 0xd5c9aa);
    j.box(-1.92, 1.082, -0.42, 0.79, 0.09, 1.12, h.accent);
    j.box(-1.92, 1.096, -1.24, 0.59, 0.12, 0.31, 0xe2d5ac);
    for (const z of [-1.48, 0.22]) j.box(-1.92, 1.02, z, 0.84, 0.51, 0.073, dark);
    j.cask(-2.03, 1.68, 0.72);
    j.pot(2.24, 0.92, -0.47, 0.12, 0.25, 0x80683c);
  } else if (id === 'factor') {
    j.round(-1.92, 1.24, -0.94, 0.045, 0.63, 0x836c43);
    j.box(-1.92, 1.59, -0.94, 0.059, 0.048, 0.73, 0xa48b50);
    for (const s of [-1, 1]) {
      const z = -0.94 + s * 0.31;
      j.round(-1.92, 1.29, z, 0.16, 0.025, 0xae9256);
      for (const dx of [-0.12, 0.12]) j.beam([-1.92, 1.59, z], [-1.92 + dx, 1.31, z], 0.012, 0.012, 0xa48b50);
    }
    for (let k = 0; k < 4; k++) j.round(-1.99, 0.98, -0.28 + k * 0.103, 0.075 - k * 0.009, 0.11, 0x826d45);
    j.cask(-2.06, 1.57, 0.76);
    j.cask(1.98, -1.64, 0.6);
  } else if (id === 'fletcher') {
    for (let k = 0; k < 4; k++) {
      const y = 1.45 + k * 0.21;
      j.beam([-2.27, y, -1.46], [-2.19, y + 0.12, -0.67], 0.035, 0.04, wood);
      j.beam([-2.19, y + 0.12, -0.67], [-2.27, y, 0.13], 0.035, 0.04, wood);
      j.beam([-2.27, y, -1.46], [-2.27, y, 0.13], 0.01, 0.013, 0xcac6a6);
    }
    for (let k = 0; k < 6; k++) {
      const x = -2.13 + k * 0.085;
      j.box(x, 0.92, -0.69, 0.02, 0.02, 1.07, wood);
      j.box(x, 0.933, -0.22, 0.028, 0.058, 0.12, k % 2 ? h.accent : 0xb79671, -0.2);
    }
  } else if (id === 'herbalist') {
    for (let k = 0; k < 10; k++) {
      const x = -2.2 + (k % 3) * 0.2,
        z = -1.26 + Math.floor(k / 3) * 0.31;
      j.pot(x, 0.913, z, 0.095 + 0.024 * (k % 2), 0.22 + (k % 3) * 0.05, [0x796a4a, 0x62746a, 0x9b7859][k % 3]);
    }
    j.box(-2.26, 2.4, -0.67, 0.1, 0.08, 1.66, dark);
    for (let k = 0; k < 7; k++) {
      const z = -1.33 + k * 0.21;
      j.box(-2.25, 2.21, z, 0.02, 0.37, 0.019, wood);
      for (const s of [-1, 1])
        j.part(
          j.world.head,
          k % 2 ? 0x70814d : 0x7c7054,
          -2.23,
          1.99,
          z + s * 0.035,
          0.062,
          0.18,
          0.06,
          s * 0.27,
        );
    }
  } else if (id === 'posthouse') {
    for (let k = 0; k < 4; k++) j.box(-2.23, 1.23 + k * 0.27, -0.64, 0.33, 0.047, 1.38, wood);
    for (let k = 0; k < 5; k++) j.box(-2.24, 1.62, -1.33 + k * 0.344, 0.31, 0.82, 0.04, dark);
    for (let k = 0; k < 11; k++)
      j.box(
        -2.15,
        1.27 + (k % 3) * 0.27,
        -1.19 + Math.floor(k / 3) * 0.341,
        0.18,
        0.052,
        0.23,
        0xd5c9aa,
        0.045,
      );
    j.paper(-1.8, 0.919, -0.6, 0.34, 0.46, -0.24);
    j.box(-1.95, 0.4, 1.65, 0.72, 0.57, 0.52, 0x765637);
    for (const dx of [-0.22, 0.22]) j.box(-1.95 + dx, 0.69, 1.65, 0.072, 0.024, 0.54, 0x534432);
  } else if (id === 'watch') {
    j.box(-1.91, 0.925, -0.65, 0.66, 0.028, 1.34, 0xc9b98e);
    const marks = [
      [-2.1, -1.17],
      [-1.91, -1.01],
      [-1.99, -0.79],
      [-1.75, -0.58],
      [-1.91, -0.27],
    ];
    for (let k = 1; k < marks.length; k++) {
      const [x, z] = marks[k],
        [px, pz] = marks[k - 1];
      j.beam([px, 0.953, pz], [x, 0.953, z], 0.023, 0.023, h.accent);
      j.round(x, 0.994, z, 0.035, 0.1, 0xa75739);
    }
    j.plate('standard-pine', -2.382, 1.89, -0.91, 0.79, 1.04, Math.PI / 2);
    for (let k = 0; k < 3; k++)
      j.beam([-2.25, 0.06, 1.22 + k * 0.16], [-2.34, 2.43, 1.38 + k * 0.16], 0.035, 0.035, wood);
  }
}

function furnishHall(j, id, h) {
  const strong = id === 'fort',
    stone = strong ? 0x585956 : 0x969384,
    trim = strong ? 0x716e60 : 0xc4b494;
  const sign = strong ? 'standard-pine' : 'standard-sun';
  // The western stairwell is cut out of the actual floor slab; each tread has its own height.
  j.box(0, -0.18, 1.52, 12.66, 0.36, 14.38, stone);
  j.box(-6.0, -0.18, -7.16, 0.88, 0.36, 2.98, stone);
  j.box(1.43, -0.18, -7.16, 9.98, 0.36, 2.98, stone);
  for (let k = 0; k < 8; k++) {
    const z = -5.67 - (k + 0.5) * 0.33,
      y = -(k + 1) * 0.17;
    j.box(-4.6, y - 0.1, z, 1.96, 0.2, 0.344, stone);
    j.box(-4.6, y - 0.015, z + 0.14, 1.93, 0.032, 0.048, trim);
  }
  j.box(-4.6, -1.46, -8.49, 2, 0.2, 0.39, stone);
  for (const x of [-5.69, -3.51]) {
    j.box(x, 0.03, -7.11, 0.19, 2.96, 2.85, stone);
    j.box(x, 0.68, -7.1, 0.27, 0.14, 2.94, trim);
  }
  for (const n of [-1, 1]) {
    j.box(n * 6.35, 3.54, 0, 0.29, 7.08, 17.46, stone);
    j.box(0, 3.54, n * 8.64, 12.99, 7.08, 0.26, stone);
    j.box(n * 6.1, 0.38, 0, 0.33, 0.75, 17.15, trim);
    j.box(n * 6.09, 0.82, 0, 0.34, 0.12, 17.15, stone);
    j.box(n * 6.13, 4.6, 0, 0.28, 0.26, 17.15, trim);
    j.box(n * 6.11, 5.01, 0, 0.32, 0.2, 17.15, stone);
    for (const z of [-6.15, -1.72, 2.61, 6.48]) {
      j.window(n * 6.16, z, -n, 3.59, 0.85, 1.58);
      j.plate(sign, n * 6.12, 3.21, z + 1.24, 0.72, 1.72, (-n * Math.PI) / 2);
    }
    for (const z of [-4, 0.85, 5.36]) {
      const x = n * 3.26;
      j.box(x, 0.19, z, 0.83, 0.38, 0.83, trim);
      j.round(x, 0.52, z, 0.443, 0.27, stone);
      j.round(x, 2.05, z, 0.307, 3.36, stone);
      for (const y of [0.72, 3.47, 3.67]) j.round(x, y, z, 0.37, 0.13, trim);
      j.box(x, 3.83, z, 0.8, 0.25, 0.8, trim);
      j.beam([x, 3.87, z], [n * 5.03, 5.38, z], 0.27, 0.28, stone);
      j.beam([n * 5.03, 5.38, z], [n * 6.14, 5.52, z], 0.25, 0.25, trim);
    }
  }
  for (const z of [-4, 0.85, 5.36]) {
    // Individual tapered orientations expose the joints of the stone rib from below.
    const span = 3.25,
      spring = 3.82;
    for (let k = 0; k < 17; k++) {
      const a = ((k + 0.5) * Math.PI) / 17;
      j.box(
        Math.cos(a) * span,
        spring + Math.sin(a) * 2.25,
        z,
        0.65,
        0.33,
        0.41,
        k % 4 ? stone : trim,
        0,
        0,
        Math.atan2(2.25 * Math.cos(a), -span * Math.sin(a)),
      );
    }
    for (const n of [-1, 1]) j.beam([n * 6.13, 5.6, z], [0, 7.11, z], 0.23, 0.28, 0x594431);
  }
  for (const n of [-1, 1]) j.box(n * 3.19, 6.63, 0, 6.74, 0.26, 17.52, 0x534432, 0, 0, -n * 0.24);
  j.door(0, 8.47, -1, 2.38, 3.27);
  j.box(-4.6, -0.7, -8.68, 2.14, 1.45, 0.28, stone);
  j.door(-4.6, -8.49, 1, 1.47, 2.48, false, -1.36);
  j.box(-4.6, 1.2, -8.36, 1.77, 0.2, 0.26, trim);
  j.plate(sign, 0, 3.58, -8.47, 1.59, 2.71, 0);
  // The patterned runner, herald's lectern and a dais lead the eye through the nave.
  j.box(0, 0.018, 0.29, 2.16, 0.034, 13.82, h.accent);
  for (const s of [-1, 1]) {
    j.box(s * 0.98, 0.042, 0.29, 0.044, 0.011, 13.55, 0xc49d63);
    j.box(s * 0.88, 0.042, 0.29, 0.019, 0.011, 13.55, 0xdec6a1);
  }
  for (const z of [-6.51, -6.34, 6.96, 7.1]) j.box(0, 0.042, z, 1.94, 0.012, 0.035, 0xc49d63);
  j.box(0, 0.12, -7.56, 4.08, 0.24, 1.72, stone);
  j.box(0, 0.33, -7.84, 3.68, 0.23, 1.26, trim);
  j.box(0, 0.84, -7.77, 1.22, 0.13, 1.05, 0x594431);
  j.box(0, 1.47, -8.2, 1.23, 1.33, 0.17, 0x795f42);
  j.box(0, 1.52, -8.09, 0.77, 0.91, 0.05, h.accent);
  for (const n of [-1, 1]) {
    j.box(n * 0.54, 0.66, -7.51, 0.16, 0.46, 0.15, 0x594431);
    j.box(n * 0.62, 1.14, -7.78, 0.11, 0.17, 0.93, 0x795f42);
    j.round(n * 2.57, 0.78, -7.62, 0.094, 1.45, 0x514f48);
    j.round(n * 2.57, 0.17, -7.62, 0.36, 0.1, 0x514f48);
    j.lamp(n * 2.57, 1.53, -7.62, 0.43);
  }
  j.table(0, -6.47, 1.18, 0.65, 0.95);
  j.paper(0, 1.016, -6.44, 0.82, 0.43, -0.02);
  j.lamp(0.48, 1.014, -6.6, 0.25);
  if (!strong) {
    j.door(6.08, -3.28, -1, 1.34, 2.69, true);
    j.table(4.83, 3.91, 1.14, 2.17, 0.7);
    j.box(4.83, 0.79, 3.91, 1.1, 0.18, 2.08, 0xd5c9aa);
    j.box(4.83, 0.92, 4.68, 0.8, 0.13, 0.35, 0xe3d8b4);
    for (let k = 0; k < 3; k++)
      j.pot(5.71, 0.03, 3.4 + k * 0.42, 0.15, 0.46, [0x778b7d, 0x925e40, 0x958a6b][k]);
  } else {
    j.table(4.83, 3.91, 1.19, 2.19, 0.91);
    for (let k = 0; k < 6; k++) {
      const z = 3.08 + k * 0.3;
      j.beam([5.83, 0.1, z], [5.98, 2.66, z + 0.07], 0.047, 0.047, 0x795f42);
      j.part(j.geos.cone, 0x7b8281, 5.98, 2.84, z + 0.08, 0.095, 0.37, 0.065);
    }
    for (let k = 0; k < 9; k++) j.box(4.38 + k * 0.1, 1.0, 3.66, 0.021, 0.025, 1.0, 0x897454);
    j.cask(5.48, -6.92, 1.18);
    j.cask(4.63, -7.39, 0.91);
  }
  // A suspended iron hoop, chain and wax candles read in silhouette above the central aisle.
  for (const z of [-1.48, 4.0]) {
    j.part(j.geos.ring, 0x514f48, 0, 4.32, z, 0.77, 0.77, 0.65, Math.PI / 2);
    j.box(0, 6.19, z, 0.041, 1.5, 0.041, 0x514f48);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3,
        x = Math.cos(a) * 0.77,
        dz = Math.sin(a) * 0.77;
      if (k % 2 === 0) j.beam([0, 5.6, z], [x, 4.3, z + dz], 0.025, 0.025, 0x514f48);
      j.lamp(x, 4.34, z + dz, 0.23);
    }
  }
}

const indoorCast = {
  wheelwright: ['merchant', 'carter'],
  weaver: ['merchant', 'village'],
  factor: ['merchant', 'scribe'],
  fletcher: ['elf', ''],
  herbalist: ['herbalist', 'healer'],
  posthouse: ['merchant', 'carter'],
  palace: ['guard', ''],
  fort: ['lord', ''],
};
function buildFurnishedRoom(world, id) {
  const room = houses[id],
    hall = room.kind === 'hall',
    sc = new THREE.Scene();
  sc.background = new THREE.Color(hall ? 0x26282a : 0x454038);
  sc.add(new THREE.HemisphereLight(hall ? 0xcbd7ee : 0xffeacd, 0xa38e78, hall ? 1.16 : 1.36));
  const j = new RoomJoinery(world, sc, room);
  if (hall) furnishHall(j, id, room);
  else furnishHouse(j, id, room);
  j.finish();
  if (indoorCast[id]) {
    const actor = world.person(...indoorCast[id], id !== 'palace' && id !== 'fort', 'house/' + id);
    actor.position.set(hall ? 4.93 : -1.83, 0, hall ? 1.33 : 0.81);
    actor.rotation.y = hall ? -Math.PI / 2 : 0.87;
    sc.add(actor);
    sc.userData.occupant = actor;
    sc.userData.occupantState = hall ? 'watch' : 'idle';
    poseCharacter(actor, sc.userData.occupantState, 0);
  }
  const daylight = new THREE.SpotLight(
    hall ? 0xffebce : 0xffdfa6,
    hall ? 92 : 33,
    hall ? 21 : 11,
    0.82,
    0.71,
    1.55,
  );
  daylight.position.set(hall ? -5.94 : -2.28, hall ? 4.32 : 2.19, 0.62);
  daylight.target.position.set(hall ? 1.33 : 0.82, 0.57, hall ? -2.2 : -0.44);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(512, 512);
  daylight.shadow.bias = -0.0006;
  daylight.shadow.normalBias = 0.024;
  sc.add(daylight, daylight.target);
  sc.userData.day = daylight;
  const fire = new THREE.PointLight(0xffb364, hall ? 22 : 6.4, hall ? 15 : 6.6, 1.65);
  fire.position.set(hall ? 0 : 1.98, hall ? 4.53 : 1.27, hall ? -1.48 : 0.54);
  fire.userData.base = fire.intensity;
  sc.add(fire);
  sc.userData.fire = fire;
  if (hall) {
    const rear = new THREE.PointLight(id === 'palace' ? 0xffdc9e : 0x9eafc8, 20, 10, 1.6);
    rear.position.set(-4.59, 1.56, -6.71);
    sc.add(rear);
  }
  return sc;
}
