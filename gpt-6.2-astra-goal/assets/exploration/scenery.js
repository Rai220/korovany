'use strict';
/* FIELD_SPEECH_BEGIN */
const fieldSpeech = {
  'rada-1': [
    'Рада',
    'После паводка колокола замолчали. Найди водомерную рейку у излучины. Там отец записывал сигналы.',
    './assets/exploration/rada-1.mp3',
    8.235,
  ],
  'rada-2': [
    'Рада',
    'Вот теперь слышно с другого берега. Кому оставить ключ от колокольни, решать тебе.',
    './assets/exploration/rada-2.mp3',
    6.05,
  ],
  'rada-3': [
    'Рада',
    'В тумане гребец не видит флагов. Он считает удары, пока ведёт лодку вдоль берега.',
    './assets/exploration/rada-3.mp3',
    6.354,
  ],
  'list-1': [
    'Лист',
    'Я ищу имя человека, которого похоронили у сосен. У старой угольной печи нашли его жетон.',
    './assets/exploration/list-1.mp3',
    6.505,
  ],
  'list-2': [
    'Лист',
    'На лицевой стороне знак всей артели. Гравировку на обороте сверь с зарубками на поминальном камне.',
    './assets/exploration/list-2.mp3',
    6.373,
  ],
  'list-3': [
    'Лист',
    'Теперь имя можно вернуть семье. Или оставить здесь, чтобы путники его запомнили.',
    './assets/exploration/list-3.mp3',
    5.551,
  ],
  'esma-1': [
    'Эсма',
    'Труба уцелела, но линза треснула. Найди стекло на месте удара, над лесной дорогой.',
    './assets/exploration/esma-1.mp3',
    6.271,
  ],
  'esma-2': [
    'Эсма',
    'Короткий край осколка обращён к закату. Угол подъёма ищи на оправе.',
    './assets/exploration/esma-2.mp3',
    5.191,
  ],
  'esma-3': [
    'Эсма',
    'В седловине Саргат. Иди по северной тропе до сигнальной вехи. Ниже спускаться не надо.',
    './assets/exploration/esma-3.mp3',
    6.57,
  ],
};
/* FIELD_SPEECH_END */

const fieldPortraits = { Рада: ['merchant', 'healer'], Лист: ['herbalist', 'healer'], Эсма: ['elf', ''] };

function fieldLathe(profile, steps = 24) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    steps,
  );
}
function fieldMaterials(realm) {
  if (realm.fieldKit) return realm.fieldKit;
  const metal = (color, roughness, metalness) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const cloth = new THREE.MeshStandardMaterial({
    map: texture('linen'),
    color: 0xa69c78,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  return (realm.fieldKit = {
    bronze: metal(0x977440, 0.45, 0.56),
    brass: metal(0xccad63, 0.32, 0.59),
    iron: metal(0x4d524e, 0.61, 0.49),
    copper: metal(0x4c7568, 0.71, 0.29),
    obsidian: metal(0x1c3c48, 0.2, 0.59),
    cloth,
    bell: fieldLathe(
      [
        [0.15, 0.96],
        [0.25, 0.94],
        [0.28, 0.87],
        [0.32, 0.82],
        [0.33, 0.67],
        [0.36, 0.43],
        [0.44, 0.23],
        [0.58, 0.08],
        [0.61, 0.05],
        [0.61, 0],
        [0.525, 0.025],
        [0.43, 0.17],
        [0.31, 0.47],
        [0.25, 0.79],
        [0.12, 0.86],
      ],
      32,
    ),
    stone: new THREE.DodecahedronGeometry(1, 0),
    ring: new THREE.TorusGeometry(1, 0.036, 8, 52),
    thick: new THREE.TorusGeometry(1, 0.09, 8, 40),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    domed: fieldLathe(
      [
        [0.81, 0],
        [1, 0.09],
        [0.98, 0.37],
        [0.86, 0.7],
        [0.61, 0.91],
        [0.37, 1.01],
        [0.22, 1.04],
      ],
      24,
    ),
    timber: realm.mat(0x795f42),
    darkwood: realm.mat(0x534432),
    stoneMat: realm.mat(0x716e60),
    text: new Map(),
  });
}
function fieldLabel(realm, words, sub) {
  const kit = fieldMaterials(realm),
    k = words + '/' + sub;
  if (kit.text.has(k)) return kit.text.get(k);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 144;
  const q = c.getContext('2d');
  q.clearRect(0, 0, c.width, c.height);
  q.fillStyle = '#35291e';
  q.fillRect(0, 0, 512, 144);
  q.strokeStyle = '#b09b6a';
  q.lineWidth = 3;
  q.strokeRect(9, 9, 494, 126);
  q.fillStyle = '#e3d7aa';
  q.font = 'bold 39px Georgia';
  q.textAlign = 'center';
  q.fillText(words, 256, 65, 478);
  q.fillStyle = '#c5b278';
  q.font = '24px Georgia';
  q.fillText(sub, 256, 107, 478);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  kit.text.set(k, m);
  return m;
}
function fieldBillboard(realm, group, text, sub, x, y, z, w, h) {
  const mesh = new THREE.Mesh(
    realm.indoorPlate || new THREE.PlaneGeometry(1, 1),
    fieldLabel(realm, text, sub),
  );
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, 1);
  group.add(mesh);
  return mesh;
}
function fieldFlag(realm, group, color, x, y, z, w, h) {
  const geom = new THREE.PlaneGeometry(w, h, 6, 6),
    pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w + 0.5,
      v = pos.getY(i) / h + 0.5;
    pos.setXYZ(i, pos.getX(i), pos.getY(i) - u * 0.1, pos.getZ(i) + Math.sin(u * 8 + v * 3) * u * 0.11);
  }
  geom.computeVertexNormals();
  const flag = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({ map: texture('linen'), color, side: THREE.DoubleSide, roughness: 0.98 }),
  );
  flag.position.set(x, y, z);
  group.add(flag);
  return flag;
}
function fieldHood(j, x, y, z, w, d) {
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const uv = [];
  const ix = [];
  for (const s of [-1, 1]) {
    const k = pos.length / 3;
    pos.push(
      x,
      y + 0.6,
      z - d / 2,
      x + (s * w) / 2,
      y,
      z - d / 2,
      x + (s * w) / 2,
      y,
      z + d / 2,
      x,
      y + 0.6,
      z + d / 2,
    );
    uv.push(0, 1, 0, 0, 1, 0, 1, 1);
    ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, fieldMaterials(j.world).cloth);
  mesh.castShadow = mesh.receiveShadow = true;
  j.scene.add(mesh);
}
function fieldBoat(j, x, z) {
  const kit = fieldMaterials(j.world);
  const p = [],
    u = [],
    ix = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      bow = Math.sin(t * Math.PI),
      width = 0.031 + 0.48 * Math.pow(bow, 0.66),
      tip = 0.35 * (1 - bow),
      zz = z + (t - 0.5) * 3.6;
    for (const [a, y] of [
      [-1, 0.47],
      [-0.75, 0.11],
      [-0.12, 0],
      [0.12, 0],
      [0.75, 0.11],
      [1, 0.47],
      [0.89, 0.44],
      [0.64, 0.17],
      [0, 0.1],
      [-0.64, 0.17],
      [-0.89, 0.44],
      [-1, 0.47],
    ]) {
      p.push(x + a * width, 0.19 + y + tip, zz);
      u.push(i / 5, (a + 1) / 2 + y * 0.27);
    }
  }
  for (let i = 0; i < 20; i++)
    for (let a = 0; a < 11; a++) {
      const v = i * 12 + a;
      ix.push(v, v + 12, v + 1, v + 1, v + 12, v + 13);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  const boat = new THREE.Mesh(g, kit.timber);
  boat.castShadow = boat.receiveShadow = true;
  j.scene.add(boat);
  for (const n of [-1, 1]) j.box(x, 0.58, z + n * 0.67, 0.77, 0.07, 0.22, 0x897454);
  j.beam([x - 0.5, 0.63, z - 1.25], [x + 0.45, 0.68, z + 1.27], 0.043, 0.052, 0x594431);
}
function fieldFerry(j, root, kit) {
  const wood = 0x594431;
  for (const x of [-1.6, 1.6]) {
    j.box(x, 1.56, -0.2, 0.21, 3.14, 0.25, wood);
    j.box(x, 0.21, -0.2, 0.46, 0.42, 0.52, 0x716e60);
    j.beam([x, 2.08, -0.2], [x * 0.6, 2.95, -0.2], 0.13, 0.14, wood);
  }
  j.box(0, 3.03, -0.2, 3.7, 0.23, 0.29, 0x795f42);
  fieldHood(j, 0, 3.17, -0.23, 4.08, 1.74);
  for (let k = 0; k < 3; k++) {
    const x = -0.97 + k * 0.96,
      size = [0.8, 0.62, 0.47][k],
      y = 2.7 - size;
    j.part(kit.bell, k === 1 ? kit.copper : kit.bronze, x, y, -0.13, size, size, size);
    j.part(
      kit.ring,
      kit.brass,
      x,
      y + 0.048 * size,
      -0.13,
      size * 0.605,
      size * 0.605,
      size * 0.605,
      Math.PI / 2,
    );
    j.part(j.world.head, kit.iron, x, y - 0.015, -0.13, 0.072, 0.12, 0.072);
    j.box(x, 2.77, -0.13, 0.065, 0.4, 0.065, wood);
    j.beam([x, y - 0.08, -0.13], [x + 0.14, 0.73, 0.1], 0.017, 0.02, 0xa69878);
  }
  fieldBoat(j, 2.83, -0.69);
  for (const x of [-1.8, 1.85]) j.beam([x, 0.14, 0.36], [x * 1.65, 0.07, 1.57], 0.022, 0.022, 0x9c8964);
  const flag = fieldFlag(j.world, root, 0x9ba574, 1.99, 2.3, -0.23, 0.74, 0.39);
  flag.visible = false;
  root.userData.flag = flag;
  j.round(-1.58, 1.53, 0.015, 0.15, 0.18, 0x534432);
  const glow = new THREE.Mesh(j.world.head, new THREE.MeshBasicMaterial({ color: 0xffd38a }));
  glow.scale.set(0.105, 0.17, 0.115);
  glow.position.set(-1.58, 1.58, 0.13);
  root.add(glow);
  root.userData.glow = glow;
}
function fieldGauge(j) {
  j.box(0, 1.12, 0, 0.35, 2.44, 0.19, 0x594431, 0, 0, -0.04);
  j.box(0, 1.23, 0.118, 0.24, 2.09, 0.03, 0xd5c9aa);
  for (let i = 0; i < 18; i++)
    j.box(
      i % 3 === 0 ? 0 : -0.047,
      0.32 + i * 0.102,
      0.14,
      i % 3 === 0 ? 0.21 : 0.12,
      0.019,
      0.012,
      0x493f33,
    );
  for (let i = 0; i < 3; i++)
    j.box(0.19, 1.32 - i * 0.17, 0.13, 0.32, i === 0 ? 0.084 : 0.028, 0.05, 0x514f48);
  for (const x of [-0.62, 0.62]) {
    j.box(x, 0.38, -0.15, 0.12, 0.76, 0.13, 0x534936);
    j.beam([x, 0.34, -0.15], [0, 0.75, 0], 0.062, 0.059, 0x897454);
  }
  j.box(0, 0.27, -0.25, 1.64, 0.12, 0.36, 0x897454);
}
function fieldCamp(j, root, kit) {
  const g = new THREE.BufferGeometry();
  const x = -0.47,
    z = -0.61,
    w = 1.53,
    h = 2.2,
    d = 1.37;
  const pos = [
    x - w,
    0.11,
    z + d,
    x,
    h,
    z + d,
    x,
    h,
    z - d,
    x - w,
    0.11,
    z - d,
    x + w,
    0.11,
    z + d,
    x,
    h,
    z + d,
    x,
    h,
    z - d,
    x + w,
    0.11,
    z - d,
    x - w,
    0.11,
    z - d,
    x,
    h,
    z - d,
    x + w,
    0.11,
    z - d,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      [0, 0, 0.5, 1, 1, 1, 1, 0, 0, 0, 0.5, 1, 1, 1, 1, 0, 0, 0, 0.5, 1, 1, 0],
      2,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 8, 9, 10]);
  g.computeVertexNormals();
  const tent = new THREE.Mesh(g, kit.cloth);
  tent.castShadow = tent.receiveShadow = true;
  root.add(tent);
  for (const s of [-1, 1]) {
    j.beam([x, 0, z + s * d], [x, h + 0.18, z + s * d], 0.072, 0.072, 0x594431);
    j.beam([x, 2.23, z + s * d], [x + s * 0.4, 0, z + s * (d + 0.63)], 0.023, 0.023, 0x897454);
  }
  j.table(1.25, 0.27, 1.0, 0.7, 0.72);
  j.paper(1.25, 0.787, 0.25, 0.62, 0.42, 0.04);
  j.lamp(1.61, 0.78, 0.4, 0.21);
  const banner = fieldFlag(j.world, root, 0xb9ba85, 1.88, 1.7, -0.44, 0.61, 0.32);
  j.box(1.52, 0.98, -0.44, 0.08, 1.97, 0.08, 0x594431);
  root.userData.flag = banner;
  for (let i = 0; i < 7; i++)
    j.part(
      kit.stone,
      0x716e60,
      -0.68 + Math.cos(i * 0.9) * 0.31,
      0.1,
      1.38 + Math.sin(i * 0.9) * 0.29,
      0.12,
      0.14,
      0.12,
    );
  j.cask(-2.13, -0.33, 0.71);
}
function fieldKiln(j, kit) {
  j.part(kit.domed, 0x716e60, 0, -0.19, -0.24, 1.69, 2.11, 1.35);
  j.box(0, 0.49, 1.02, 0.87, 0.89, 0.13, 0x292b27);
  for (let i = 0; i < 9; i++) {
    const a = ((i + 0.5) * Math.PI) / 9;
    j.box(
      Math.cos(a) * 0.6,
      0.61 + Math.sin(a) * 0.63,
      1.08,
      0.25,
      0.29,
      0.34,
      0x969384,
      0,
      0,
      a - Math.PI / 2,
    );
  }
  for (const x of [-0.61, 0.61]) j.box(x, 0.32, 1.09, 0.26, 0.65, 0.33, 0x969384);
  for (let k = 0; k < 7; k++)
    j.part(kit.stone, 0x362f27, -0.3 + k * 0.1, 0.12, 1.3 + 0.09 * Math.sin(k), 0.13, 0.071, 0.12);
  for (let k = 0; k < 6; k++)
    j.part(
      kit.cylinder,
      0x534936,
      1.81 + (k % 2) * 0.21,
      0.15 + Math.floor(k / 2) * 0.2,
      -0.43,
      0.105,
      1.26,
      0.105,
      Math.PI / 2,
    );
  j.round(0, 1.94, -0.23, 0.31, 0.3, 0x585956);
}
function fieldMemorial(j, root, kit) {
  j.part(kit.stone, 0x716e60, 0, 0.23, 0.02, 1.1, 0.46, 0.66);
  j.box(0, 0.94, -0.12, 1.37, 1.53, 0.47, 0x969384);
  j.part(kit.stone, 0x969384, 0, 1.66, -0.13, 0.76, 0.26, 0.28);
  fieldBillboard(j.world, root, 'АРТЕЛЬ', 'память погибшим', 0, 1.24, 0.14, 1.02, 0.32);
  for (let r = 0; r < 3; r++)
    for (let k = 0; k <= r; k++) j.round(-0.27 + k * 0.16, 0.74 - r * 0.12, 0.15, 0.031, 0.016, 0x6f5f42);
  for (let k = 0; k < 6; k++) {
    const a = 0.45 + k * 0.95;
    j.part(kit.stone, 0x716e60, Math.sin(a) * 1.13, 0.13, -0.1 + Math.cos(a) * 0.61, 0.26, 0.23, 0.19);
  }
  const token = new THREE.Mesh(kit.cylinder, kit.brass);
  token.rotation.x = Math.PI / 2;
  token.scale.set(0.15, 0.036, 0.15);
  token.position.set(0.36, 0.72, 0.161);
  root.add(token);
  root.userData.token = token;
}
function fieldObservatory(j, root, kit) {
  j.round(0, 0.08, -0.23, 1.69, 0.29, 0x716e60);
  j.round(0, 0.27, -0.23, 1.5, 0.13, 0x969384);
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI) / 12;
    j.box(
      Math.sin(a) * 1.37,
      0.346,
      -0.23 + Math.cos(a) * 1.37,
      0.037,
      0.023,
      k % 3 === 0 ? 0.19 : 0.091,
      k % 3 === 0 ? kit.brass : kit.iron,
      0,
      a,
    );
  }
  j.round(0, 0.74, -0.23, 0.27, 0.9, 0x716e60);
  j.round(0, 1.19, -0.23, 0.48, 0.14, kit.bronze);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    j.beam([Math.sin(a) * 0.84, 0.33, -0.23 + Math.cos(a) * 0.84], [0, 1.16, -0.23], 0.13, 0.14, 0x594431);
  }
  const fork = new THREE.Group();
  fork.position.set(0, 1.33, -0.23);
  root.add(fork);
  const mount = new RoomJoinery(j.world, fork, {});
  mount.part(kit.ring, kit.brass, 0, 0.44, 0, 0.55, 0.55, 0.55, 0, Math.PI / 2);
  for (const s of [-1, 1]) mount.box(s * 0.39, 0.3, 0, 0.07, 0.64, 0.09, kit.bronze);
  mount.finish();
  const shaft = new THREE.Group();
  shaft.position.set(0, 0.48, 0);
  fork.add(shaft);
  const s = new RoomJoinery(j.world, shaft, {});
  s.part(kit.cylinder, kit.copper, 0, 0, 0, 0.16, 1.39, 0.16, Math.PI / 2);
  s.part(kit.cylinder, kit.bronze, 0, 0, -0.57, 0.21, 0.39, 0.21, Math.PI / 2);
  s.part(kit.cylinder, kit.brass, 0, 0, 0.61, 0.094, 0.49, 0.094, Math.PI / 2);
  for (const z of [-0.8, -0.4, 0.24, 0.78])
    s.part(kit.ring, kit.brass, 0, 0, z, z < -0.5 ? 0.23 : 0.17, z < -0.5 ? 0.23 : 0.17, 0.33);
  s.finish();
  const lens = new THREE.Mesh(kit.cylinder, kit.obsidian);
  lens.position.z = -0.785;
  lens.rotation.x = Math.PI / 2;
  lens.scale.set(0.192, 0.032, 0.192);
  shaft.add(lens);
  root.userData.lens = lens;
  const trim = new RoomJoinery(j.world, fork, {});
  for (const side of [-1, 1]) {
    trim.part(kit.ring, kit.brass, side * 0.395, 0.45, 0.02, 0.155, 0.155, 0.155, 0, Math.PI / 2);
    trim.part(kit.cylinder, kit.copper, side * 0.41, 0.45, 0.02, 0.047, 0.12, 0.047, 0, 0, Math.PI / 2);
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI) / 2.5;
      trim.beam(
        [side * 0.396, 0.45, 0.02],
        [side * 0.396, 0.45 + Math.cos(a) * 0.151, 0.02 + Math.sin(a) * 0.151],
        0.013,
        0.013,
        0x665644,
      );
    }
  }
  trim.finish();
  j.table(1.93, -0.66, 0.88, 0.67, 0.76);
  j.paper(1.88, 0.829, -0.66, 0.55, 0.41, -0.08);
  j.lamp(2.18, 0.824, -0.83, 0.23);
  for (let k = 0; k < 5; k++)
    j.part(kit.ring, kit.brass, 1.69 + k * 0.063, 0.851, -0.53, 0.055, 0.055, 0.055, Math.PI / 2);
  root.userData.fork = fork;
  root.userData.tube = shaft;
  fieldBillboard(j.world, root, 'СЕВЕР', 'меридиан седловины', 0, 0.52, 1.05, 0.86, 0.28);
}
function fieldShard(j, kit) {
  for (let k = 0; k < 15; k++) {
    const a = k * 2.4,
      r = 0.15 + (k % 5) * 0.21;
    j.part(
      kit.stone,
      k % 3 ? kit.obsidian : kit.stoneMat,
      Math.sin(a) * r,
      0.04 + (k % 4) * 0.065,
      Math.cos(a) * r,
      0.16 + (k % 3) * 0.12,
      0.13 + (k % 5) * 0.08,
      0.23,
      0,
      a,
      k * 0.52,
    );
  }
  j.part(kit.thick, kit.copper, 0.48, 0.28, 0.39, 0.23, 0.23, 0.23, 0.86, 0.37);
  j.part(kit.ring, kit.brass, 0.49, 0.3, 0.4, 0.2, 0.2, 0.27, 0.86, 0.37);
  for (let n = 0; n < 2; n++) j.box(0.38 + n * 0.07, 0.43, 0.38, 0.02, 0.08, 0.025, kit.brass);
}
function fieldMast(j, root, kit) {
  for (let k = 0; k < 8; k++) {
    const a = k * 0.785;
    j.part(kit.stone, 0x716e60, 0.44 * Math.cos(a), 0.19, 0.44 * Math.sin(a), 0.27, 0.28, 0.24);
  }
  j.round(0, 1.38, 0, 0.115, 2.74, 0x534936);
  for (const y of [0.73, 1.42, 2.11]) j.round(0, y, 0, 0.127, 0.078, kit.bronze);
  j.box(0, 2.44, 0, 1.25, 0.076, 0.072, 0x897454);
  j.beam([-0.39, 2.17, 0], [0, 2.45, 0], 0.05, 0.05, 0x594431);
  const spinner = new THREE.Group();
  spinner.position.set(0, 2.77, 0);
  root.add(spinner);
  const b = new RoomJoinery(j.world, spinner, {});
  b.box(0, 0, 0, 1.61, 0.052, 0.06, kit.bronze);
  b.part(j.world.spire, kit.brass, -0.79, 0, 0, 0.1, 0.29, 0.065, 0, 0, Math.PI / 2);
  b.finish();
  root.userData.vane = spinner;
  root.userData.flag = fieldFlag(j.world, spinner, 0xe4d4a7, 0.65, 0.08, 0, 0.37, 0.26);
}
function fieldStash(j, root, kit, id) {
  if (id === 'reeds') {
    for (const sign of [-1, 1]) {
      j.beam([sign * -0.52, 0.16, -0.48], [sign * 0.52, 0.47, 0.56], 0.042, 0.045, 0x594431);
      j.box(sign * 0.48, 0.47, 0.55, 0.16, 0.053, 0.42, 0x897454, 0, sign * 0.77);
    }
  } else if (id === 'cairn') {
    j.part(kit.cylinder, 0x534936, -0.34, 0.21, -0.22, 0.24, 1.34, 0.24, 0, 0, 1.19);
    for (let i = 0; i < 3; i++)
      j.part(kit.stone, 0x716e60, -0.55 + i * 0.25, 0.28, -0.26 + i * 0.14, 0.2, 0.19, 0.19);
  } else {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094;
      j.beam([Math.sin(a) * 0.46, 0.04, Math.cos(a) * 0.46], [0, 1.05, 0], 0.048, 0.052, 0x594431);
    }
    j.part(kit.cylinder, kit.bronze, -0.29, 0.15, 0.22, 0.085, 0.71, 0.085, 0, 0, Math.PI / 2);
  }
  j.box(0.13, 0.13, 0.24, 0.52, 0.25, 0.39, 0x594431);
  const lid = new THREE.Group();
  lid.position.set(0.13, 0.27, 0.04);
  root.add(lid);
  const wood = new RoomJoinery(j.world, lid, {});
  wood.box(0, 0.02, 0.19, 0.54, 0.063, 0.42, 0x897454);
  for (const x of [-0.16, 0.16]) wood.box(x, 0.059, 0.19, 0.034, 0.018, 0.42, kit.iron);
  wood.finish();
  root.userData.lid = lid;
}
const fieldModels = {
  ferry: fieldFerry,
  gauge: fieldGauge,
  camp: fieldCamp,
  kiln: (j, r, k) => fieldKiln(j, k),
  memorial: fieldMemorial,
  observatory: fieldObservatory,
  shard: (j, r, k) => fieldShard(j, k),
  mast: fieldMast,
};
function fieldBuild(realm, id, site) {
  const root = new THREE.Group(),
    kit = fieldMaterials(realm),
    j = new RoomJoinery(realm, root, {});
  root.name = 'field-' + id;
  if (site.cache) fieldStash(j, root, kit, id);
  else fieldModels[id](j, root, kit);
  j.finish();
  const residents = {
    ferry: [...fieldPortraits.Рада, -2.02, 0.45],
    camp: [...fieldPortraits.Лист, 1.8, 0.43],
    observatory: [...fieldPortraits.Эсма, -1.68, 1.43],
  };
  const resident = residents[id];
  if (resident) {
    const a = realm.person(resident[0], resident[1], true);
    a.position.set(resident[2], 0, resident[3]);
    a.rotation.y = resident[2] < 0 ? 0.77 : -0.82;
    root.add(a);
    root.userData.person = a;
  }
  const yaw = Math.atan2(site.approach[0], site.approach[1]);
  root.rotation.y = yaw;
  if (root.userData.person) {
    const a = root.userData.person.position;
    const x = site.x + Math.cos(yaw) * a.x + Math.sin(yaw) * a.z,
      z = site.z + Math.cos(yaw) * a.z - Math.sin(yaw) * a.x;
    a.y = walkingSurface(x, z) - walkingSurface(site.x, site.z);
  }
  if (site.cache || id === 'shard') {
    const normal = new THREE.Vector3(
      walkingSurface(site.x - 0.5, site.z) - walkingSurface(site.x + 0.5, site.z),
      1,
      walkingSurface(site.x, site.z - 0.5) - walkingSurface(site.x, site.z + 0.5),
    ).normalize();
    const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    root.quaternion.premultiply(align);
  }
  realm.scene.add(root);
  return root;
}
function drawExploration(realm, g, t) {
  if (!g || g.dungeon || g.inside || g.delivery) return;
  if (!realm.fieldLandmarks) {
    realm.fieldLandmarks = new Map();
    for (const [id, site] of Object.entries(fieldSites)) {
      const dimensions = {
        ferry: [3.2, 0.65],
        camp: [3.0, 2.24],
        kiln: [2.95, 2.35],
        memorial: [1.41, 0.7],
        observatory: [1.35, 1.39],
        mast: [0.47, 0.48],
        gauge: [0.4, 0.38],
      }[id];
      if (dimensions)
        realm.bound(
          site.x,
          site.z,
          site.approach[0] ? dimensions[1] : dimensions[0],
          site.approach[0] ? dimensions[0] : dimensions[1],
        );
      const extra = {
        ferry: [
          [-2.02, 0.45, 0.44, 0.45],
          [2.83, -0.69, 0.88, 3.49],
        ],
        camp: [
          [1.8, 0.43, 0.43, 0.43],
          [1.25, 0.27, 0.97, 0.64],
        ],
        observatory: [
          [-1.68, 1.43, 0.43, 0.44],
          [1.93, -0.66, 0.85, 0.64],
        ],
      }[id];
      if (extra) for (const [x, z, w, d] of extra) realm.bound(site.x + x, site.z + z, w, d);
    }
  }
  const state = fieldState(g);
  for (const [id, site] of Object.entries(fieldSites)) {
    const d = distance(g, site);
    let m = realm.fieldLandmarks.get(id);
    if (!m && d < (site.cache ? 28 : 58)) {
      m = fieldBuild(realm, id, site);
      realm.fieldLandmarks.set(id, m);
    }
    if (!m) continue;
    m.visible = d < (site.cache ? 32 : 66);
    if (!m.visible) continue;
    m.position.set(nearest(site.x, g.x), walkingSurface(site.x, site.z), nearest(site.z, g.z));
    const p = m.userData;
    if (p.person && d < 24) poseCharacter(p.person, realmVoice.active && d < 6 ? 'talk' : 'idle', t);
    if (id === 'ferry') {
      p.flag.visible = state.choices.river === 'trade';
      p.glow.visible = state.choices.river === 'shelter';
    }
    if (id === 'camp') p.flag.visible = state.choices.names === 'kin';
    if (id === 'memorial') p.token.visible = state.choices.names === 'memorial';
    if (id === 'observatory') {
      p.lens.visible = state.paid.includes('shard');
      p.fork.rotation.y = -Math.PI / 4 - (state.bearing * Math.PI) / 2;
      p.tube.rotation.x = [0, 0.20944, 0.5236][state.tilt];
    }
    if (id === 'mast') {
      p.vane.rotation.y =
        state.choices.glass === 'pilots'
          ? 0.33
          : state.choices.glass === 'wind'
            ? -0.87
            : 0.1 + Math.sin(t * 0.28) * 0.12;
      p.flag.visible = !!state.choices.glass;
      p.flag.material.color.setHex(state.choices.glass === 'wind' ? 0xbf8650 : 0xe4d4a7);
    }
    if (p.lid) p.lid.rotation.x = state.paid.includes(id) ? -1.22 : 0;
  }
}
