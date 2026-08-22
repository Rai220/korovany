// ДЖВА ГОДА — мир: рельеф, 4 зоны, река с мостом, дороги, постройки.
import * as THREE from 'three';

export const WORLD = { SIZE: 2000, HALF: 1000 };

export const ZONES = [
  { id: 0, name: 'Земли людей (нейтрал)', short: 'ЛЮДИ',   color: '#c9b46a', rect: { x0: 0.0, x1: 0.5, z0: 0.5, z1: 1.0 } },
  { id: 1, name: 'Владения Императора',   short: 'ДВОРЕЦ', color: '#7ea6e0', rect: { x0: 0.5, x1: 1.0, z0: 0.0, z1: 0.5 } },
  { id: 2, name: 'Эльфийский лес',        short: 'ЛЕС',    color: '#5fae5f', rect: { x0: 0.0, x1: 0.5, z0: 0.0, z1: 0.5 } },
  { id: 3, name: 'Горы Злого',            short: 'ФОРТ',   color: '#b0787a', rect: { x0: 0.5, x1: 1.0, z0: 0.5, z1: 1.0 } },
];

export const POI = {
  village:     { x: -600, z: 600 },
  grove:       { x: -640, z: -640 },
  palaceGate:  { x: 0, z: -556 },
  palaceKeep:  { x: 0, z: -660 },
  fortGate:    { x: 640, z: 566 },
  fortKeep:    { x: 640, z: 660 },
  bridge:      { x: -60, z: 0 },
  crossroads:  { x: 0, z: 0 },
};

// Ключевые точки (мировые координаты)
export const VILLAGE = { x: -600, z: 600 };
export const GROVE   = { x: -640, z: -640 };
export const PALACE  = { x: 0, z: -620 };
export const FORT    = { x: 640, z: 640 };

export function zoneAt(x, z) {
  const nx = (x + WORLD.HALF) / WORLD.SIZE;
  const nz = (z + WORLD.HALF) / WORLD.SIZE;
  for (const zn of ZONES) {
    const r = zn.rect;
    if (nx >= r.x0 && nx <= r.x1 && nz >= r.z0 && nz <= r.z1) return zn.id;
  }
  return 0;
}

// ---------- шум ----------
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function sstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function flatten(h, x, z, cx, cz, r, target) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= r) return h;
  // внутренняя половина радиуса — полное плато, дальше плавный спуск
  return h + (target - h) * sstep(Math.min(1, (1 - d / r) * 2));
}

// ---------- дороги ----------
export const ROADS = [
  { ax: -600, az: 560, bx: -600, bz: 10 },    // деревня → перекрёсток
  { ax: -940, az: 0,   bx: 40,   bz: 0 },     // тракт запад–восток (через мост)
  { ax: 0,    az: -20, bx: 0,    bz: -545 },  // перекрёсток → дворец
  { ax: 0,    az: 20,  bx: 600,  bz: 20 },    // перекрёсток → восток (к форту)
  { ax: 640,  az: 20,  bx: 640,  bz: 585 },   // спуск к форту (ворота N)
  { ax: -620, az: 0,   bx: -640, bz: -560 },  // ответвление к поляне эльфов
];
export function roadDist(x, z) {
  let best = 1e9;
  for (const r of ROADS) {
    const dx = r.bx - r.ax, dz = r.bz - r.az;
    const len2 = dx * dx + dz * dz;
    let t = ((x - r.ax) * dx + (z - r.az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = r.ax + dx * t, pz = r.az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}
export function roadFactor(x, z) { return sstep(1 - roadDist(x, z) / 5); }

// ---------- река ----------
export function riverX(z) { return -60 + 30 * Math.sin(z * 0.005); }

// ---------- рельеф ----------
export function terrainHeight(x, z) {
  let h = 5 * (vnoise(x * 0.004, z * 0.004) - 0.5) * 2
        + 2 * (vnoise(x * 0.015 + 7, z * 0.015 + 3) - 0.5) * 2;

  // горы на юго-востоке (земли Злого)
  const nx = (x + WORLD.HALF) / WORLD.SIZE, nz = (z + WORLD.HALF) / WORLD.SIZE;
  const mtn = Math.max(0, (nx - 0.52) / 0.48) * Math.max(0, (nz - 0.52) / 0.48);
  const ridge = 1 - Math.abs(2 * vnoise(x * 0.008 + 40, z * 0.008 + 40) - 1);
  h += Math.pow(mtn, 1.5) * (50 + 55 * ridge);

  // река (русло)
  const d = Math.abs(x - riverX(z));
  if (d < 22) {
    const t = sstep((22 - d) / 14);
    h = h + (-2.4 - h) * t;
  }

  // ровные площадки под базы
  h = flatten(h, x, z, VILLAGE.x, VILLAGE.z, 80, 3);
  h = flatten(h, x, z, GROVE.x, GROVE.z, 70, 5);
  h = flatten(h, x, z, 0, -620, 110, 8);      // дворец
  h = flatten(h, x, z, FORT.x, FORT.z, 80, 42); // форт в горах
  h = flatten(h, x, z, 0, 0, 30, 1.5);        // перекрёсток

  // деревянный мост через реку — всегда проходим
  if (x > -82 && x < -38 && z > -5 && z < 5) h = Math.max(h, 0.45);

  // край мира обрывается
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 930) { const t = (e - 930) / 70; h -= t * t * 45; }

  return h;
}

// ---------- коллизии ----------
export const colliders = [];        // {x,z,r} окружности и {x0,x1,z0,z1} прямоугольники
export const dynamicColliders = []; // сюда лес пишет стволы рядом с игроком
export function collide(px, pz, radius) {
  for (const c of colliders) {
    if (c.r !== undefined) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 0.001) { px = c.x + dx / d * min; pz = c.z + dz / d * min; }
    } else {
      const cx = Math.max(c.x0, Math.min(px, c.x1));
      const cz = Math.max(c.z0, Math.min(pz, c.z1));
      const dx = px - cx, dz = pz - cz;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d > 0.001) { px = cx + dx / d * radius; pz = cz + dz / d * radius; }
        else { px += radius; }
      }
    }
  }
  for (const c of dynamicColliders) {
    const dx = px - c.x, dz = pz - c.z;
    const d = Math.hypot(dx, dz), min = c.r + radius;
    if (d < min && d > 0.001) { px = c.x + dx / d * min; pz = c.z + dz / d * min; }
  }
  return [px, pz];
}

// ---------- материалы-помощники ----------
const MAT = {
  wood:  new THREE.MeshLambertMaterial({ color: 0x7a5a38 }),
  wood2: new THREE.MeshLambertMaterial({ color: 0x5e442a }),
  roof:  new THREE.MeshLambertMaterial({ color: 0x8a4a2a }),
  roofE: new THREE.MeshLambertMaterial({ color: 0x3f6d3a }),
  stone: new THREE.MeshLambertMaterial({ color: 0x9a9284 }),
  stoneD:new THREE.MeshLambertMaterial({ color: 0x6a645c }),
  marble:new THREE.MeshLambertMaterial({ color: 0xcac2b0 }),
  roofB: new THREE.MeshLambertMaterial({ color: 0x4a5a8a }),
  dark:  new THREE.MeshLambertMaterial({ color: 0x2e2a22 }),
  red:   new THREE.MeshLambertMaterial({ color: 0xa03028 }),
  leaf:  new THREE.MeshLambertMaterial({ color: 0x3f7d3a }),
};
function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cone(r, h, mat, x, y, z, seg = 8) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
export function groundY(x, z) { return terrainHeight(x, z); }

function placeAtTerrain(obj, x, z, dy = 0) {
  obj.position.set(x, terrainHeight(x, z) + dy, z);
  scene.add(obj);
  return obj;
}

// ---------- постройки ----------
let scene = null;
export const shops = [];    // {x,z,kind,name}  kind: weapon|general|healer
export const landmarks = []; // точки для карты

function makeHouse(x, z, w = 7, d = 6, h = 3.2, ry = 0, elf = false) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  g.add(box(w, h, d, elf ? MAT.wood2 : MAT.wood, 0, h / 2, 0));
  const roof = cone(Math.max(w, d) * 0.78, h * 0.75, elf ? MAT.roofE : MAT.roof, 0, h + h * 0.36, 0, 4);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.add(box(1.2, 2, 0.15, MAT.dark, 0, 1, d / 2 + 0.05));
  g.position.set(x, y, z); g.rotation.y = ry;
  scene.add(g);
  colliders.push({ x0: x - w / 2 - 0.3, x1: x + w / 2 + 0.3, z0: z - d / 2 - 0.3, z1: z + d / 2 + 0.3 });
  return g;
}

function makeStall(x, z, ry, awningColor, kind, name) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  g.add(box(3.4, 1.0, 1.4, MAT.wood2, 0, 0.5, 0));
  g.add(box(3.6, 0.12, 1.6, MAT.wood, 0, 1.05, 0));
  const awn = box(3.8, 0.1, 2.2, new THREE.MeshLambertMaterial({ color: awningColor }), 0, 2.3, 0.3);
  awn.rotation.x = 0.25;
  g.add(awn);
  g.add(cyl(0.06, 0.06, 2.4, MAT.wood2, -1.7, 1.2, 1.0, 5));
  g.add(cyl(0.06, 0.06, 2.4, MAT.wood2, 1.7, 1.2, 1.0, 5));
  g.position.set(x, y, z); g.rotation.y = ry;
  scene.add(g);
  colliders.push({ x, z, r: 1.6 });
  shops.push({ x, z, kind, name });
  landmarks.push({ x, z, label: name, icon: '◆', color: '#ffd76a' });
  return g;
}

function makeTower(x, z, r = 4, h = 16, mat = MAT.stone, roofMat = MAT.roofB) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  g.add(cyl(r, r + 0.6, h, mat, 0, h / 2, 0, 10));
  g.add(cone(r + 1, 5, roofMat, 0, h + 2.5, 0, 10));
  g.position.set(x, y, z);
  scene.add(g);
  colliders.push({ x, z, r: r + 0.4 });
  return g;
}

function makeWallRect(cx, cz, half, h, gateSide, mat, towerMat, roofMat) {
  // 4 стены с воротами на стороне gateSide ('N','S','E','W')
  const y = terrainHeight(cx, cz);
  const g = new THREE.Group();
  const T = 2; // толщина
  const seg = (w, d, ox, oz) => g.add(box(w, h, d, mat, ox, h / 2, oz));
  const gap = 7;
  // N (−z) и S (+z)
  for (const side of ['N', 'S']) {
    const zz = side === 'N' ? -half : half;
    if (side === gateSide) {
      const wseg = (half * 2 - gap) / 2;
      seg(wseg, T, -(gap / 2 + wseg / 2), zz);
      seg(wseg, T, (gap / 2 + wseg / 2), zz);
      g.add(box(gap + 1, 2.2, T + 0.6, mat, 0, h + 0.4, zz)); // перемычка
    } else seg(half * 2, T, 0, zz);
  }
  for (const side of ['W', 'E']) {
    const xx = side === 'W' ? -half : half;
    if (side === gateSide) {
      const dseg = (half * 2 - gap) / 2;
      seg(T, dseg, xx, -(gap / 2 + dseg / 2));
      seg(T, dseg, xx, (gap / 2 + dseg / 2));
      g.add(box(T + 0.6, 2.2, gap + 1, mat, xx, h + 0.4, 0));
    } else seg(T, half * 2, xx, 0);
  }
  // угловые башни
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(cyl(3.4, 3.8, h + 5, towerMat, sx * half, (h + 5) / 2, sz * half, 9));
    g.add(cone(4.4, 5, roofMat, sx * half, h + 5 + 2.5, sz * half, 9));
    colliders.push({ x: cx + sx * half, z: cz + sz * half, r: 4.2 });
  }
  g.position.set(cx, y, cz);
  scene.add(g);
  // коллизии стен (прямоугольники), ворота оставляем открытыми
  const push = (x0, x1, z0, z1) => colliders.push({ x0: cx + x0, x1: cx + x1, z0: cz + z0, z1: cz + z1 });
  const wseg = (half * 2 - gap) / 2;
  if (gateSide === 'S') { push(-half, -gap / 2, half - T / 2 - 0.4, half + T / 2 + 0.4); push(gap / 2, half, half - T / 2 - 0.4, half + T / 2 + 0.4); }
  else push(-half, half, half - T / 2 - 0.4, half + T / 2 + 0.4);
  if (gateSide === 'N') { push(-half, -gap / 2, -half - T / 2 - 0.4, -half + T / 2 + 0.4); push(gap / 2, half, -half - T / 2 - 0.4, -half + T / 2 + 0.4); }
  else push(-half, half, -half - T / 2 - 0.4, -half + T / 2 + 0.4);
  if (gateSide === 'W') { push(-half - T / 2 - 0.4, -half + T / 2 + 0.4, -half, -gap / 2); push(-half - T / 2 - 0.4, -half + T / 2 + 0.4, gap / 2, half); }
  else push(-half - T / 2 - 0.4, -half + T / 2 + 0.4, -half, half);
  if (gateSide === 'E') { push(half - T / 2 - 0.4, half + T / 2 + 0.4, -half, -gap / 2); push(half - T / 2 - 0.4, half + T / 2 + 0.4, gap / 2, half); }
  else push(half - T / 2 - 0.4, half + T / 2 + 0.4, -half, half);
  return g;
}

function makeBanner(x, z, color, h = 7) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  g.add(cyl(0.09, 0.12, h, MAT.wood2, 0, h / 2, 0, 5));
  const flag = box(1.7, 1.1, 0.06, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), 0.9, h - 0.9, 0);
  g.add(flag);
  g.position.set(x, y, z);
  scene.add(g);
}

export function buildWorld(sceneRef) {
  scene = sceneRef;

  // --- небо, свет, туман ---
  scene.background = new THREE.Color(0x9db8d2);
  scene.fog = new THREE.Fog(0x9db8d2, 120, 900);
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x5a6a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(-200, 300, 150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  worldObjects.sun = sun;

  // --- земля ---
  const SEG = 180;
  const geo = new THREE.PlaneGeometry(WORLD.SIZE, WORLD.SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const zid = zoneAt(x, z);
    if (h > 62) c.set(0xd8dade);
    else if (h > 34) c.set(0x6e675e);
    else if (zid === 2) c.set(0x2e5a2c);
    else if (zid === 1) c.set(0x6f8a4a);
    else if (zid === 3) c.set(0x7a6a55);
    else c.set(0x8a8a4e);
    const v = 0.9 + 0.2 * vnoise(x * 0.05, z * 0.05);
    c.multiplyScalar(v);
    const rf = roadFactor(x, z);
    if (rf > 0 && h > -1) { c.lerp(new THREE.Color(0x6a543a), rf * 0.85); }
    if (h < -0.9) c.set(0x5a523c); // речное дно
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  // --- вода ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.SIZE, WORLD.SIZE),
    new THREE.MeshLambertMaterial({ color: 0x2e5a7a, transparent: true, opacity: 0.75 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.7;
  scene.add(water);

  // --- мост ---
  {
    const g = new THREE.Group();
    const y = 0.45;
    g.add(box(38, 0.8, 9, MAT.wood2, 0, y, 0));
    for (const sz of [-1, 1]) {
      g.add(box(38, 0.9, 0.3, MAT.wood, 0, y + 0.8, sz * 4.4));
      for (let i = -3; i <= 3; i++) g.add(cyl(0.18, 0.22, 2.4, MAT.wood2, i * 5.4, y - 0.8, sz * 4.4, 5));
    }
    for (let i = -3; i <= 3; i++) for (const sz of [-1, 1])
      g.add(cyl(0.25, 0.3, 3.4, MAT.wood2, i * 5.6, y - 2.0, sz * 3.6, 5));
    g.position.set(POI.bridge.x, 0, POI.bridge.z);
    scene.add(g);
    landmarks.push({ x: POI.bridge.x, z: POI.bridge.z, label: 'Мост', icon: '≡', color: '#c9b46a' });
  }

  // --- деревня людей ---
  {
    const hs = [[-634, 574, 0.4], [-566, 578, -0.5], [-640, 630, 1.2], [-560, 634, -1.0], [-628, 560, 0.2], [-572, 556, -0.3]];
    for (const [hx, hz, hr] of hs) makeHouse(hx, hz, 7, 6, 3.2, hr);
    // колодец
    const wellY = terrainHeight(-600, 600);
    scene.add(cyl(1.6, 1.8, 1.4, MAT.stoneD, -600, wellY + 0.7, 600, 10));
    scene.add(cone(2.2, 1.2, MAT.roof, -600, wellY + 3.0, 600, 6));
    colliders.push({ x: -600, z: 600, r: 2.0 });
    // костёр
    const fireY = terrainHeight(-586, 616);
    scene.add(cyl(1.1, 1.3, 0.4, MAT.stoneD, -586, fireY + 0.2, 616, 7));
    const flame = cone(0.55, 1.3, new THREE.MeshBasicMaterial({ color: 0xff8a30 }), -586, fireY + 1.0, 616, 6);
    scene.add(flame);
    worldObjects.campfire = flame;
    const fl = new THREE.PointLight(0xff9a40, 1.2, 26);
    fl.position.set(-586, fireY + 2, 616);
    scene.add(fl);
    landmarks.push({ x: -600, z: 600, label: 'Деревня', icon: '⌂', color: '#c9b46a' });
  }
  makeStall(-632, 592, 0.8, 0x8a4a2a, 'weapon', 'Оружейник (деревня)');
  makeStall(-568, 592, -0.8, 0x3f6d3a, 'general', 'Лавка (деревня)');
  makeStall(-600, 646, Math.PI, 0xc9b46a, 'healer', 'Лекарь (деревня)');
  makeBanner(-588, 566, 0xc9b46a, 6);

  // --- поляна эльфов: домики на деревьях ---
  {
    const spots = [[-668, -668, 0.6], [-612, -664, -0.7], [-664, -608, 2.2], [-610, -612, 1.0], [-640, -676, 0.2]];
    for (const [tx, tz, ry] of spots) {
      const y = terrainHeight(tx, tz);
      const g = new THREE.Group();
      g.add(cyl(1.1, 1.7, 9, MAT.wood2, 0, 4.5, 0, 7));
      g.add(box(6.4, 0.5, 6.4, MAT.wood, 0, 8.2, 0));
      g.add(box(4.4, 3.0, 4.4, MAT.wood2, 0, 10, 0));
      const roof = cone(4.2, 2.6, MAT.roofE, 0, 13.8, 0, 4); roof.rotation.y = Math.PI / 4;
      g.add(roof);
      g.add(box(1.0, 1.8, 0.15, MAT.dark, 0, 9.4, 2.25));
      g.position.set(tx, y, tz); g.rotation.y = ry;
      scene.add(g);
      colliders.push({ x: tx, z: tz, r: 1.9 });
      // фонарь
      scene.add(cyl(0.07, 0.07, 3.4, MAT.wood2, tx + 4, y + 1.7, tz + 3, 5));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xbfe8a0 }));
      lamp.position.set(tx + 4, y + 3.5, tz + 3);
      scene.add(lamp);
    }
    landmarks.push({ x: GROVE.x, z: GROVE.z, label: 'Поляна эльфов', icon: '⌂', color: '#5fae5f' });
  }
  makeStall(-614, -638, -0.6, 0x3f6d3a, 'general', 'Лавка эльфов');
  makeStall(-666, -638, 0.6, 0x5fae5f, 'healer', 'Лекарь эльфов');
  makeBanner(-640, -600, 0x3f8a3f, 7);

  // --- дворец императора ---
  {
    makeWallRect(0, -620, 62, 10, 'S', MAT.marble, MAT.stone, MAT.roofB);
    const ky = terrainHeight(0, -660);
    scene.add(box(30, 16, 26, MAT.marble, 0, ky + 8, -660));
    scene.add(cone(24, 9, MAT.roofB, 0, ky + 20.5, -660, 4));
    scene.add(cyl(0.6, 0.6, 10, MAT.marble, -8, ky + 5, -646, 6));
    scene.add(cyl(0.6, 0.6, 10, MAT.marble, 8, ky + 5, -646, 6));
    colliders.push({ x0: -15, x1: 15, z0: -673, z1: -647 });
    makeBanner(-10, -590, 0x4a6ac0, 9); makeBanner(10, -590, 0x4a6ac0, 9);
    makeBanner(-10, -650, 0x4a6ac0, 9); makeBanner(10, -650, 0x4a6ac0, 9);
    landmarks.push({ x: 0, z: -640, label: 'Дворец Императора', icon: '♛', color: '#7ea6e0' });
  }
  makeStall(20, -598, -1.2, 0x4a6ac0, 'general', 'Лавка (дворец)');
  makeStall(-20, -598, 1.2, 0xd8d8e8, 'healer', 'Лекарь (дворец)');

  // --- форт Злого ---
  {
    makeWallRect(FORT.x, FORT.z, 48, 9, 'N', MAT.stoneD, MAT.stoneD, MAT.dark);
    const ky = terrainHeight(FORT.x, FORT.z + 30);
    scene.add(box(22, 13, 18, MAT.stoneD, FORT.x, ky + 6.5, FORT.z + 30));
    scene.add(cone(18, 7, MAT.dark, FORT.x, ky + 16.5, FORT.z + 30, 4));
    colliders.push({ x0: FORT.x - 11, x1: FORT.x + 11, z0: FORT.z + 21, z1: FORT.z + 39 });
    // пики вокруг
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const sx = FORT.x + Math.cos(a) * 62, sz = FORT.z + Math.sin(a) * 62;
      scene.add(cone(0.35, 3.4, MAT.wood2, sx, terrainHeight(sx, sz) + 1.7, sz, 5));
    }
    makeBanner(FORT.x - 8, FORT.z + 8, 0x701818, 9);
    makeBanner(FORT.x + 8, FORT.z + 8, 0x701818, 9);
    landmarks.push({ x: FORT.x, z: FORT.z, label: 'Старый форт Злого', icon: '☠', color: '#b0787a' });
  }
  makeStall(FORT.x + 26, FORT.z - 20, -2.2, 0x701818, 'weapon', 'Лавка форта');
  makeStall(FORT.x - 26, FORT.z - 20, 2.2, 0x3a3a3a, 'healer', 'Зловещий лекарь');

  // --- сторожевые вышки ---
  makeTower(-940, 0, 3.4, 14); landmarks.push({ x: -940, z: 0, label: 'Вышка', icon: '▲', color: '#c9b46a' });
  makeTower(340, 350, 3.4, 14);
  makeTower(-300, -940, 3.4, 14);

  // --- обелиск на перекрёстке ---
  {
    const y = terrainHeight(0, 0);
    scene.add(box(2.2, 7, 2.2, MAT.stone, 0, y + 3.5, 0));
    scene.add(cone(1.7, 1.6, MAT.stone, 0, y + 7.8, 0, 4));
    colliders.push({ x: 0, z: 0, r: 1.8 });
    landmarks.push({ x: 0, z: 0, label: 'Перекрёсток', icon: '✦', color: '#e8d8a0' });
  }

  // --- облака ---
  {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 16; i++) {
      const cl = new THREE.Mesh(new THREE.SphereGeometry(18 + Math.random() * 22, 7, 5), cloudMat);
      cl.position.set((Math.random() - 0.5) * 1800, 150 + Math.random() * 60, (Math.random() - 0.5) * 1800);
      cl.scale.y = 0.35;
      scene.add(cl);
    }
  }
}

export const worldObjects = {};

// Лёгкая анимация мира (костёр, солнце)
export function updateWorld(dt, playerPos) {
  if (worldObjects.campfire) {
    const s = 1 + Math.sin(performance.now() * 0.012) * 0.18;
    worldObjects.campfire.scale.set(s, 1 + Math.sin(performance.now() * 0.02) * 0.25, s);
  }
  if (worldObjects.sun && playerPos) {
    worldObjects.sun.position.set(playerPos.x - 160, 260, playerPos.z + 120);
    worldObjects.sun.target.position.copy(playerPos);
  }
}
