// world.js — мир: ландшафт, 4 зоны, дороги, LOD-лес (вдали картинкой, вблизи 3D), постройки.
import * as THREE from 'three';

export const SITES = {
  village: { x: 0,    z: 0    },
  palace:  { x: 380,  z: 0    },
  forest:  { x: -380, z: 0    },
  fort:    { x: 0,    z: -420 },
};
const SITE_LIST = [SITES.village, SITES.palace, SITES.forest, SITES.fort];

export const ZONE_NAMES = ['',
  '1 — Земли людей (нейтрал)',
  '2 — Дворец Императора',
  '3 — Лес эльфов',
  '4 — Горы Злого · старый форт',
];
export const ZONE_COLORS = ['', '#c9b458', '#d4af37', '#3f8f4a', '#8a5a72'];
export const ZONE_RADII  = [0, 150, 170, 230, 190];

// Дороги (ломаные в плане XZ): деревня→дворец, деревня→лес, деревня→форт.
export const ROADS = [
  [[0, 0], [140, 12], [260, -12], [336, 0]],
  [[0, 0], [-140, -16], [-332, 0]],
  [[0, 0], [26, -140], [-16, -270], [0, -384]],
];

const LOD_DIST = 78; // ближе — 3D-дерево, дальше — картинка

// ---------- геометрия ландшафта ----------
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-6;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

export function distToRoad(x, z) {
  let best = 1e9;
  for (const road of ROADS)
    for (let i = 0; i < road.length - 1; i++)
      best = Math.min(best, distSeg(x, z, road[i][0], road[i][1], road[i + 1][0], road[i + 1][1]));
  return best;
}

function flat(d, inner, outer) {
  if (d >= outer) return 1;
  if (d <= inner) return 0;
  const t = (d - inner) / (outer - inner);
  return t * t * (3 - 2 * t);
}

export function heightAt(x, z) {
  let h = 2.0 * Math.sin(x * 0.012) * Math.cos(z * 0.014)
        + 1.2 * Math.sin(x * 0.027 + 1.3) * Math.sin(z * 0.023 + 0.7);
  // горное кольцо вокруг форта Злого
  const df = Math.hypot(x, z + 420);
  const t = (df - 155) / 60;
  h += 26 * Math.exp(-t * t);
  // выравнивание под поселения и дороги
  let m = 1;
  m *= flat(Math.hypot(x - SITES.village.x, z - SITES.village.z), 60, 115);
  m *= flat(Math.hypot(x - SITES.palace.x,  z - SITES.palace.z),  85, 145);
  m *= flat(Math.hypot(x - SITES.forest.x,  z - SITES.forest.z),  55, 110);
  m *= flat(Math.hypot(x - SITES.fort.x,    z - SITES.fort.z),    48, 95);
  m *= flat(distToRoad(x, z), 9, 26);
  return h * m;
}

export function zoneAt(x, z) {
  let best = 1e18, idx = 1;
  for (let i = 0; i < 4; i++) {
    const d = (x - SITE_LIST[i].x) ** 2 + (z - SITE_LIST[i].z) ** 2;
    if (d < best) { best = d; idx = i + 1; }
  }
  return idx;
}

function mix(a, b, t) { return a + (b - a) * t; }

function colorAt(x, z) {
  let r = 0.32, g = 0.45, b = 0.22; // трава
  const n = Math.sin(x * 0.05) * Math.cos(z * 0.06) * 0.5 + Math.sin(x * 0.013 + 2) * 0.5;
  r += n * 0.03; g += n * 0.045; b += n * 0.02;
  const dr = distToRoad(x, z);
  if (dr < 7) { const t = 1 - dr / 7; r = mix(r, 0.54, t); g = mix(g, 0.43, t); b = mix(b, 0.29, t); }
  const df = Math.hypot(x, z + 420); // скалы у гор
  if (df < 250) { const t = Math.min(1, (250 - df) / 250) * 0.8; r = mix(r, 0.45, t); g = mix(g, 0.44, t); b = mix(b, 0.46, t); }
  const dfo = Math.hypot(x + 380, z); // тёмный лесной пол
  if (dfo < 240) { const t = (240 - dfo) / 240 * 0.5; r *= 1 - t * 0.3; g *= 1 - t * 0.35; b *= 1 - t * 0.2; }
  if (Math.abs(x - 380) < 46 && Math.abs(z) < 46) { r = 0.6; g = 0.59; b = 0.55; } // двор дворца
  return [r, g, b];
}

// ---------- мелкие фабрики ----------
const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
function box(group, w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  if (opts.yaw) m.rotation.y = opts.yaw;
  if (opts.pitch) m.rotation.x = opts.pitch;
  m.castShadow = opts.cast !== false;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

export function makeLabel(text, { color = '#ffe9b0', scale = [7, 1.5], font = 30 } = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.font = `bold ${font}px "Courier New", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.9)';
  ctx.strokeText(text, 256, 48);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale[0], scale[1], 1);
  return sp;
}

function makeTreeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a3418';
  ctx.fillRect(58, 88, 12, 40);
  const greens = ['#173d1d', '#1f4d24', '#27612c'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = greens[i];
    const top = 6 + i * 26, w = 22 + i * 18;
    ctx.beginPath();
    ctx.moveTo(64, top);
    ctx.lineTo(64 - w, top + 52);
    ctx.lineTo(64 + w, top + 52);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const [x, y, r] of [[34, 38, 18], [62, 30, 22], [92, 38, 16], [60, 44, 20]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 3.2, 6);
const coneGeo1 = new THREE.ConeGeometry(2.5, 3.2, 7);
const coneGeo2 = new THREE.ConeGeometry(1.85, 2.6, 7);
const coneGeo3 = new THREE.ConeGeometry(1.2, 2.0, 7);

function makeTree3D() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, mat(0x5a3d22));
  trunk.position.y = 1.6; trunk.castShadow = true;
  const c1 = new THREE.Mesh(coneGeo1, mat(0x1f4d24)); c1.position.y = 3.6;
  const c2 = new THREE.Mesh(coneGeo2, mat(0x27612c)); c2.position.y = 5.1;
  const c3 = new THREE.Mesh(coneGeo3, mat(0x2f7034)); c3.position.y = 6.5;
  c1.castShadow = c2.castShadow = c3.castShadow = true;
  g.add(trunk, c1, c2, c3);
  return g;
}

function makeHouse(w, h, d, wallColor, roofColor) {
  const g = new THREE.Group();
  box(g, w, h, d, wallColor, 0, h / 2, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.15, h * 0.8, 4), mat(roofColor));
  roof.position.y = h + h * 0.4;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  box(g, 1.1, 1.9, 0.15, 0x2a1c10, 0, 0.95, d / 2 + 0.03); // дверь
  return g;
}

// корован: телега с коровой (по ТЗ — «можно грабить корованы»)
export function makeCart() {
  const g = new THREE.Group();
  box(g, 3.2, 0.5, 1.9, 0x7a5a2e, 0, 1.05, 0);           // кузов
  box(g, 3.2, 0.5, 0.15, 0x6a4a24, 0, 1.5, 0.95);
  box(g, 3.2, 0.5, 0.15, 0x6a4a24, 0, 1.5, -0.95);
  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.18, 10);
  for (const [x, z] of [[-1.05, 1.02], [1.05, 1.02], [-1.05, -1.02], [1.05, -1.02]]) {
    const w = new THREE.Mesh(wGeo, mat(0x3a2a14));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.62, z);
    w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  // корова в кузове
  const cow = new THREE.Group();
  box(cow, 1.7, 0.95, 0.9, 0xd8d2c4, 0, 0, 0);
  box(cow, 0.55, 0.5, 0.5, 0xcfc8b8, 1.05, 0.25, 0);      // голова
  box(cow, 0.12, 0.28, 0.06, 0x8a8070, 1.05, 0.62, 0.2);  // рога
  box(cow, 0.12, 0.28, 0.06, 0x8a8070, 1.05, 0.62, -0.2);
  box(cow, 0.5, 0.35, 0.95, 0x4a4038, -0.3, 0.15, 0);     // пятно
  cow.position.set(-0.2, 1.85, 0);
  g.add(cow);
  g.userData.wheels = wheels;
  return g;
}

// ---------- постройка мира ----------
export function initWorld(G) {
  const scene = G.scene;
  scene.background = new THREE.Color(0x9fbfa8);
  scene.fog = new THREE.Fog(0x9fbfa8, 90, 460);

  const hemi = new THREE.HemisphereLight(0xcfe8c8, 0x3a4a2a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // --- земля ---
  const SEG = 150, SIZE = 1300;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const [r, g, b] = colorAt(x, z);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  // --- деревья с LOD ---
  const treeTex = makeTreeTexture();
  const treeSpriteMat = new THREE.SpriteMaterial({ map: treeTex, transparent: true });
  const trees = [];
  function plantTree(x, z) {
    const y = heightAt(x, z);
    const sp = new THREE.Sprite(treeSpriteMat);
    const s = 8 + Math.random() * 3;
    sp.scale.set(s, s, 1);
    sp.position.set(x, y + s * 0.48, z);
    scene.add(sp);
    trees.push({ x, z, y, sprite: sp, mesh: null, is3d: false });
  }
  // густой эльфийский лес
  let planted = 0, guard = 0;
  while (planted < 250 && guard++ < 9000) {
    const a = Math.random() * Math.PI * 2;
    const r = 46 + Math.random() * 185;
    const x = SITES.forest.x + Math.cos(a) * r;
    const z = SITES.forest.z + Math.sin(a) * r * 0.9;
    if (distToRoad(x, z) < 11) continue;
    plantTree(x, z); planted++;
  }
  // редкие деревья в остальных зонах
  planted = 0; guard = 0;
  while (planted < 90 && guard++ < 9000) {
    const x = (Math.random() - 0.5) * 1200;
    const z = (Math.random() - 0.5) * 1200;
    if (zoneAt(x, z) === 4) continue;
    if (Math.hypot(x - SITES.village.x, z - SITES.village.z) < 62) continue;
    if (Math.hypot(x - SITES.palace.x, z - SITES.palace.z) < 105) continue;
    if (Math.hypot(x - SITES.forest.x, z - SITES.forest.z) < 235) continue;
    if (distToRoad(x, z) < 9) continue;
    plantTree(x, z); planted++;
  }

  function updateTrees(camPos) {
    for (const t of trees) {
      const d = Math.hypot(camPos.x - t.x, camPos.z - t.z);
      const want = d < LOD_DIST;
      if (want === t.is3d) continue;
      t.is3d = want;
      if (want) {
        if (!t.mesh) { t.mesh = makeTree3D(); t.mesh.position.set(t.x, t.y, t.z); }
        scene.add(t.mesh);
        t.sprite.visible = false;
      } else {
        if (t.mesh) scene.remove(t.mesh);
        t.sprite.visible = true;
      }
    }
  }

  // --- зона 1: деревня людей ---
  const village = new THREE.Group();
  const housePos = [[24, 18], [-30, 16], [18, -24], [-20, -26], [36, -8], [-38, 2]];
  for (const [x, z] of housePos) {
    const h = makeHouse(5 + Math.random() * 2, 3.4, 4.5 + Math.random() * 1.5, 0x8a6a42, 0x5a3a20);
    h.position.set(x, heightAt(x, z), z);
    h.rotation.y = Math.random() * Math.PI * 2;
    village.add(h);
  }
  // лавка (рынок)
  const stall = new THREE.Group();
  for (const [x, z] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]])
    box(stall, 0.18, 2.6, 0.18, 0x6a4a24, x, 1.3, z);
  box(stall, 3.8, 0.25, 2.8, 0xa8352a, 0, 2.7, 0);        // полосатый тент (условно)
  box(stall, 3.4, 0.7, 1.6, 0x7a5a2e, 0, 0.75, 0);        // прилавок
  stall.position.set(10, heightAt(10, 16), 16);
  village.add(stall);
  const shopLabel = makeLabel('ЛАВКА', { color: '#ffd76a' });
  shopLabel.position.set(10, heightAt(10, 16) + 4.4, 16);
  village.add(shopLabel);
  // хата лекаря
  const healerHouse = makeHouse(4.5, 3.2, 4, 0x9a8a6a, 0x4a5a3a);
  healerHouse.position.set(-14, heightAt(-14, 28), 28);
  village.add(healerHouse);
  const healerLabel = makeLabel('ЛЕКАРЬ', { color: '#8fe896' });
  healerLabel.position.set(-14, heightAt(-14, 28) + 4.6, 28);
  village.add(healerLabel);
  // колодец
  const well = new THREE.Group();
  const wellRing = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1, 8, 1, true), mat(0x8a8a80));
  wellRing.position.y = 0.5; well.add(wellRing);
  box(well, 0.15, 2, 0.15, 0x6a4a24, -0.9, 1, 0);
  box(well, 0.15, 2, 0.15, 0x6a4a24, 0.9, 1, 0);
  box(well, 2.4, 0.15, 1.2, 0x5a3a20, 0, 2.05, 0);
  well.position.set(0, heightAt(0, -10), -10);
  village.add(well);
  scene.add(village);

  // --- зона 2: дворец Императора ---
  const palace = new THREE.Group();
  const PC = SITES.palace, HALF = 44, WALL_H = 7, WALL_T = 2.2, STONE = 0xa8a49a;
  box(palace, HALF * 2 + WALL_T, WALL_H, WALL_T, STONE, PC.x, WALL_H / 2, PC.z - HALF);
  box(palace, HALF * 2 + WALL_T, WALL_H, WALL_T, STONE, PC.x, WALL_H / 2, PC.z + HALF);
  box(palace, WALL_T, WALL_H, HALF * 2 + WALL_T, STONE, PC.x + HALF, WALL_H / 2, PC.z);
  box(palace, WALL_T, WALL_H, HALF - 6, STONE, PC.x - HALF, WALL_H / 2, PC.z - (HALF + 6) / 2 - 3);
  box(palace, WALL_T, WALL_H, HALF - 6, STONE, PC.x - HALF, WALL_H / 2, PC.z + (HALF + 6) / 2 + 3);
  box(palace, WALL_T, 2.5, 14, STONE, PC.x - HALF, WALL_H + 1.2, PC.z); // перемычка над воротами
  for (const [tx, tz] of [[PC.x - HALF, PC.z - HALF], [PC.x - HALF, PC.z + HALF], [PC.x + HALF, PC.z - HALF], [PC.x + HALF, PC.z + HALF]]) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 12, 8), mat(STONE));
    tw.position.set(tx, 6, tz); tw.castShadow = true; tw.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 8), mat(0x7a2020));
    roof.position.set(tx, 14, tz); roof.castShadow = true;
    palace.add(tw, roof);
  }
  box(palace, 26, 16, 18, 0xb8b4a8, PC.x + 24, 8, PC.z);   // keep
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(19, 7, 4), mat(0xd4af37));
  keepRoof.position.set(PC.x + 24, 19.5, PC.z);
  keepRoof.rotation.y = Math.PI / 4; keepRoof.castShadow = true;
  palace.add(keepRoof);
  // трон и ковёр
  box(palace, 30, 0.12, 4, 0x6b1414, PC.x - 20, 0.07, PC.z, { cast: false });
  box(palace, 1.6, 0.7, 1.4, 0xd4af37, PC.x + 10, 0.35, PC.z);
  box(palace, 1.6, 2.4, 0.35, 0xd4af37, PC.x + 10.7, 1.2, PC.z);
  const throneLabel = makeLabel('ТРОН ИМПЕРАТОРА', { color: '#ffd76a' });
  throneLabel.position.set(PC.x + 10, 4.6, PC.z);
  palace.add(throneLabel);
  // знамёна у ворот
  for (const s of [-1, 1]) {
    box(palace, 0.2, 7, 0.2, 0x4a3a20, PC.x - HALF - 2, 3.5, PC.z + 9 * s);
    box(palace, 1.8, 3, 0.12, 0x7a2020, PC.x - HALF - 2, 5.2, PC.z + 9 * s);
  }
  scene.add(palace);

  // --- зона 3: деревня эльфов ---
  const elfCamp = new THREE.Group();
  const EC = SITES.forest;
  for (let i = 0; i < 5; i++) {
    const a = 0.7 + i * 1.25;
    const r = 24 + (i % 2) * 10;
    const x = EC.x + Math.cos(a) * r, z = EC.z + Math.sin(a) * r;
    const big = i === 0;
    const h = makeHouse(big ? 7 : 4.6, big ? 4.2 : 3.2, big ? 6 : 4.2, 0x6a5232, 0x3d2f1a);
    h.position.set(x, heightAt(x, z), z);
    h.rotation.y = a + Math.PI / 2;
    elfCamp.add(h);
  }
  scene.add(elfCamp);

  // --- зона 4: старый форт Злого в горах ---
  const fort = new THREE.Group();
  const FC = SITES.fort, FH = 30, FSTONE = 0x6a6a70;
  const segs = [
    [FC.x - FH, FC.z - FH, FC.x + FH, FC.z - FH, 5.5], // север
    [FC.x + FH, FC.z - FH, FC.x + FH, FC.z + FH, 4.5], // восток
    [FC.x - FH, FC.z + FH, FC.x - FH, FC.z - FH, 3.8], // запад
    [FC.x - FH, FC.z + FH, FC.x - 6, FC.z + FH, 2.2],  // юг, лево
    [FC.x + 6, FC.z + FH, FC.x + FH, FC.z + FH, 1.6],  // юг, право (руины)
  ];
  for (const [x1, z1, x2, z2, h] of segs) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = box(fort, len, h, 2, FSTONE, (x1 + x2) / 2, h / 2, (z1 + z2) / 2,
      { yaw: Math.atan2(-(z2 - z1), x2 - x1) });
    m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
  }
  const ftw = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 13, 8), mat(FSTONE));
  ftw.position.set(FC.x + 22, 6.5, FC.z - 22); ftw.castShadow = true;
  fort.add(ftw);
  box(fort, 4, 1.5, 3, FSTONE, FC.x - 20, 0.75, FC.z - 18); // обломки
  box(fort, 3, 1, 2.5, FSTONE, FC.x + 14, 0.5, FC.z + 12);
  // военный стол
  box(fort, 3.2, 0.25, 2.2, 0x5a3a20, FC.x, 1.05, FC.z + 8);
  for (const [x, z] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]])
    box(fort, 0.18, 1.05, 0.18, 0x4a2f18, FC.x + x, 0.52, FC.z + 8 + z);
  const tableLabel = makeLabel('ВОЕННЫЙ СТОЛ', { color: '#ff8a75' });
  tableLabel.position.set(FC.x, 3.4, FC.z + 8);
  fort.add(tableLabel);
  for (const s of [-1, 1]) {
    box(fort, 0.2, 6.5, 0.2, 0x2a2a2a, FC.x + 8 * s, 3.25, FC.z + FH + 1);
    box(fort, 1.7, 2.6, 0.12, 0x1a1a1a, FC.x + 8 * s, 5, FC.z + FH + 1);
  }
  scene.add(fort);

  // горы (конусы) кольцом вокруг форта
  const mountains = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    // проход с юга (к дороге)
    if (Math.abs(a - Math.PI / 2) < 0.42) continue;
    const r = 150 + Math.sin(i * 3.7) * 30;
    const x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r;
    const h = 34 + Math.sin(i * 7.3) * 12;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(26 + Math.sin(i * 5.1) * 8, h, 6), mat(0x74747c));
    cone.position.set(x, heightAt(x, z) + h / 2 - 3, z);
    cone.castShadow = true;
    mountains.add(cone);
  }
  scene.add(mountains);

  // --- коллайдеры построек (круг юнита выталкивается из AABB) ---
  G.colliders = [];
  const addCol = (x, z, hx, hz) => G.colliders.push({ x, z, hx, hz });
  for (const [x, z] of housePos) addCol(x, z, 3.4, 3.4);
  addCol(10, 16, 2.2, 1.6);           // лавка
  addCol(-14, 28, 2.6, 2.4);          // хата лекаря
  addCol(0, -10, 1.2, 1.2);           // колодец
  addCol(PC.x, PC.z - HALF, HALF + 1.5, 1.5);   // стены дворца
  addCol(PC.x, PC.z + HALF, HALF + 1.5, 1.5);
  addCol(PC.x + HALF, PC.z, 1.5, HALF + 1.5);
  addCol(PC.x - HALF, PC.z - 25.5, 1.5, 19.5);
  addCol(PC.x - HALF, PC.z + 25.5, 1.5, 19.5);
  addCol(PC.x + 24, PC.z, 13.5, 9.5);           // keep
  addCol(PC.x + 10, PC.z, 1.2, 1.1);            // трон
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addCol(PC.x + sx * HALF, PC.z + sz * HALF, 4.5, 4.5);
  for (let i = 0; i < 5; i++) {                  // домики эльфов
    const a = 0.7 + i * 1.25, r = 24 + (i % 2) * 10;
    addCol(EC.x + Math.cos(a) * r, EC.z + Math.sin(a) * r, 3.4, 3.4);
  }
  addCol(FC.x, FC.z - FH, FH + 1.4, 1.4);        // стены форта
  addCol(FC.x + FH, FC.z, 1.4, FH + 1.4);
  addCol(FC.x - FH, FC.z, 1.4, FH + 1.4);
  addCol(FC.x - (FH + 6) / 2 - 1, FC.z + FH, (FH - 6) / 2 + 1.4, 1.4);
  addCol(FC.x + (FH + 6) / 2 + 1, FC.z + FH, (FH - 6) / 2 + 1.4, 1.4);
  addCol(FC.x + 22, FC.z - 22, 4, 4);            // башня форта
  addCol(FC.x, FC.z + 8, 1.9, 1.3);              // военный стол
  for (let i = 0; i < 26; i++) {                 // горы
    const a = (i / 26) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.42) continue;
    const r = 150 + Math.sin(i * 3.7) * 30;
    const x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r;
    const base = 26 + Math.sin(i * 5.1) * 8;
    addCol(x, z, base * 0.55, base * 0.55);
  }

  // камни и кусты
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 80; i++) {
    let x, z, tries = 0;
    do {
      x = (Math.random() - 0.5) * 1150; z = (Math.random() - 0.5) * 1150;
      tries++;
    } while (tries < 20 && (distToRoad(x, z) < 8 ||
      Math.hypot(x - SITES.village.x, z - SITES.village.z) < 55 ||
      Math.hypot(x - SITES.palace.x, z - SITES.palace.z) < 100 ||
      Math.hypot(x - SITES.fort.x, z - SITES.fort.z) < 45));
    const s = 0.4 + Math.random() * 1.6;
    const rock = new THREE.Mesh(rockGeo, mat(zoneAt(x, z) === 4 ? 0x6a6a72 : 0x7d7d70));
    rock.scale.setScalar(s);
    rock.position.set(x, heightAt(x, z) + s * 0.3, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    scene.add(rock);
  }
  const bushGeo = new THREE.SphereGeometry(1, 6, 5);
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 210;
    const x = SITES.forest.x + Math.cos(a) * r, z = SITES.forest.z + Math.sin(a) * r;
    if (distToRoad(x, z) < 8) continue;
    const s = 0.5 + Math.random() * 0.9;
    const bush = new THREE.Mesh(bushGeo, mat(0x2a5a26));
    bush.scale.set(s, s * 0.7, s);
    bush.position.set(x, heightAt(x, z) + s * 0.3, z);
    scene.add(bush);
  }

  // облака
  const cloudTex = makeCloudTexture();
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(cloudMat);
    const w = 60 + Math.random() * 60;
    sp.scale.set(w, w * 0.35, 1);
    sp.position.set((Math.random() - 0.5) * 1300, 95 + Math.random() * 50, (Math.random() - 0.5) * 1300);
    scene.add(sp);
    clouds.push(sp);
  }

  // маяк цели (золотой столб света)
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 44, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  beacon.visible = false;
  scene.add(beacon);

  let time = 0;
  const world = {
    trees,
    crates: [],
    updateTrees,
    beaconPos: null,
    setBeacon(x, z) {
      if (x === null || x === undefined) { world.beaconPos = null; beacon.visible = false; return; }
      world.beaconPos = { x, z };
      beacon.position.set(x, heightAt(x, z) + 22, z);
      beacon.visible = true;
    },
    makeCrate(x, z, tag) {
      const g = new THREE.Group();
      box(g, 1.3, 1.3, 1.3, 0x8a6a34, 0, 0.65, 0);
      box(g, 1.4, 0.15, 0.2, 0x5a4018, 0, 0.65, 0);
      g.position.set(x, heightAt(x, z), z);
      scene.add(g);
      const crate = { group: g, x, z, hp: 3, dead: false, tag };
      world.crates.push(crate);
      return crate;
    },
    update(dt, playerPos) {
      time += dt;
      updateTrees(playerPos);
      sun.position.set(playerPos.x + 70, 110, playerPos.z + 40);
      sun.target.position.set(playerPos.x, 0, playerPos.z);
      for (const c of clouds) {
        c.position.x += dt * 1.6;
        if (c.position.x > 700) c.position.x = -700;
      }
      if (beacon.visible) {
        const s = 1 + Math.sin(time * 3) * 0.15;
        beacon.scale.set(s, 1, s);
      }
    },
  };
  G.world = world;
  return world;
}
