// Мир: рельеф 2×2 км, четыре зоны, река с мостами, дороги, вода.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { fbm2, ridged2 } from '../core/rng.js';
import { clamp, lerp, smoothstep, dist2D, closestOnPolyline, polylineLength, pointAlongPolyline } from '../core/mathutil.js';

export const MAP = { half: 1024, size: 2048, step: 4, chunk: 128 };
export const WATER_Y = -1.2;

export const ZONES = [
  { id: 1, key: 'people', name: 'Земли людей (нейтрал)', short: 'Люди', color: '#8fa86a' },
  { id: 2, key: 'empire', name: 'Земли Императора', short: 'Империя', color: '#c8a44a' },
  { id: 3, key: 'elves', name: 'Луннолесье', short: 'Эльфы', color: '#5f9a55' },
  { id: 4, key: 'villain', name: 'Владения Владыки Дрегара', short: 'Дрегар', color: '#8a6a8a' },
];
export const zoneById = (id) => ZONES.find((z) => z.id === id) || ZONES[0];

// ---------------- география ----------------
export const RIVER = {
  pts: [[-1200, 640], [-880, 520], [-560, 380], [-260, 250], [40, 130], [340, 10], [640, -160], [960, -360], [1240, -560]],
  width: 15,
  depth: 5.5,
};
export const ROADS = {
  trade: [[-900, 700], [-640, 640], [-380, 610], [-120, 620], [0, 645], [140, 640], [360, 630], [560, 650], [700, 600]],
  forest: [[0, 645], [-70, 480], [-95, 355], [-160, 170], [-330, -120], [-470, -360], [-560, -520], [-620, -600]],
  pass: [[0, 645], [130, 470], [230, 260], [300, 122], [330, -60], [400, -260], [500, -430], [590, -560], [660, -620]],
  mill: [[-640, 640], [-760, 560], [-830, 470]],
  patrol: [[560, 650], [380, 760], [180, 800], [-140, 790], [-400, 780], [-560, 720], [-640, 660]],
};
// Мосты (ставятся в точках пересечения дорог с рекой)
export const BRIDGES = [
  { x: -95, z: 352, road: 'forest', angle: 0.06 },
  { x: 300, z: 122, road: 'pass', angle: -0.42 },
];

export const PLACES = [
  { id: 'village', name: 'Деревня Тихий Брод', x: -640, z: 640, zone: 1, kind: 'village', r: 120 },
  { id: 'tavern', name: 'Кабак «Пьяный вепрь»', x: -560, z: 560, zone: 1, kind: 'tavern', r: 30 },
  { id: 'mill', name: 'Мельница', x: -830, z: 470, zone: 1, kind: 'mill', r: 40 },
  { id: 'camp_bandits', name: 'Лагерь разбойников', x: -300, z: 880, zone: 1, kind: 'camp', r: 50 },
  { id: 'ruins', name: 'Старые развалины', x: 250, z: 850, zone: 2, kind: 'ruins', r: 60 },
  { id: 'palace', name: 'Златоверхий дворец', x: 620, z: 640, zone: 2, kind: 'palace', r: 190 },
  { id: 'barracks', name: 'Казармы стражи', x: 470, z: 520, zone: 2, kind: 'barracks', r: 60 },
  { id: 'crossroad', name: 'Перекрёсток', x: 0, z: 645, zone: 1, kind: 'cross', r: 45 },
  { id: 'bridge_n', name: 'Каменный мост', x: -95, z: 352, zone: 1, kind: 'bridge', r: 24 },
  { id: 'bridge_e', name: 'Восточный мост', x: 300, z: 122, zone: 2, kind: 'bridge', r: 24 },
  { id: 'grove', name: 'Священная роща', x: -740, z: -300, zone: 3, kind: 'grove', r: 70 },
  { id: 'elfcamp', name: 'Лагерь партизан', x: -280, z: -420, zone: 3, kind: 'camp', r: 55 },
  { id: 'elfvillage', name: 'Луннолесье', x: -620, z: -600, zone: 3, kind: 'elfvillage', r: 140 },
  { id: 'pass', name: 'Горный перевал', x: 520, z: -430, zone: 4, kind: 'pass', r: 55 },
  { id: 'fort', name: 'Чёрный Шпиль', x: 660, z: -620, zone: 4, kind: 'fort', r: 170 },
  { id: 'slavemarket', name: 'Невольничий рынок', x: 780, z: -420, zone: 4, kind: 'market', r: 55 },
];

// Выравнивание площадок под поселения (чтобы дома не висели в воздухе)
const PLATEAUS = [
  { x: -640, z: 640, r: 130, f: 70 },   // деревня
  { x: 620, z: 640, r: 200, f: 100 },   // дворец
  { x: -620, z: -600, r: 150, f: 90 },  // эльфийская деревня
  { x: 660, z: -620, r: 180, f: 130 },  // форт
  { x: 0, z: 645, r: 60, f: 50 },       // перекрёсток
  { x: -300, z: 880, r: 55, f: 40 },
  { x: 250, z: 850, r: 65, f: 45 },
  { x: -280, z: -420, r: 60, f: 45 },
  { x: 780, z: -420, r: 55, f: 45 },
  { x: -830, z: 470, r: 45, f: 35 },
  { x: -740, z: -300, r: 70, f: 55 },
];

// ---------------- высоты ----------------
function mountainMask(x, z) {
  const t = (x * 0.72 - z * 0.72) / 1250;
  return smoothstep(-0.05, 0.85, t);
}
function riverInfo(x, z) {
  const c = closestOnPolyline(x, z, RIVER.pts);
  return { d: c.d, y: c.z === undefined ? 0 : 0 };
}
function baseHeight(x, z) {
  const s = G.seed;
  let h = fbm2(x / 460, z / 460, s, 4) * 26 - 3;
  h += (fbm2(x / 95, z / 95, s + 17, 3) - 0.5) * 6;
  const m = mountainMask(x, z);
  if (m > 0.001) h += Math.pow(m, 1.5) * (ridged2(x / 300, z / 300, s + 41, 5) * 190 + 25) + m * 18;
  // река
  const c = closestOnPolyline(x, z, RIVER.pts);
  const w = RIVER.width * (1 + 0.35 * Math.sin(c.d * 0.01));
  if (c.d < w * 3.2) {
    const t = 1 - smoothstep(w * 0.55, w * 3.2, c.d);
    h = lerp(h, WATER_Y - RIVER.depth + Math.sin(c.t * 40) * 0.15, t);
  }
  return h;
}
function applyFlatten(x, z, h) {
  // площадки поселений
  for (const p of PLATEAUS) {
    const d = dist2D(x, z, p.x, p.z);
    if (d < p.r + p.f) {
      const t = 1 - smoothstep(p.r, p.r + p.f, d);
      h = lerp(h, p.h, t);
    }
  }
  // дороги
  let rd = Infinity, rh = h;
  for (const key of Object.keys(ROADS)) {
    const c = closestOnPolyline(x, z, ROADS[key]);
    const d = c.d;
    if (d < rd) { rd = d; rh = heightOnRoad(key, c.i, c.t, x, z); }
  }
  if (rd < 14) {
    const t = 1 - smoothstep(4.5, 14, rd);
    h = lerp(h, rh, t * 0.92);
  }
  return h;
}
function heightOnRoad(key, i, t, x, z) {
  const pts = ROADS[key];
  const a = pts[Math.min(i, pts.length - 1)], b = pts[Math.min(i + 1, pts.length - 1)];
  const px = lerp(a[0], b[0], t), pz = lerp(a[1], b[1], t);
  const overRiver = closestOnPolyline(px, pz, RIVER.pts).d < RIVER.width * 2.6;
  const base = baseHeight(px, pz);
  if (overRiver) return Math.max(base + 1.4, WATER_Y + 3.2);
  void x; void z;
  return base;
}

export function terrainHeight(x, z) {
  return applyFlatten(x, z, baseHeight(x, z));
}

// ---------------- кэш высот ----------------
let cache = null, cacheN = 0;
function buildCache() {
  cacheN = Math.floor(MAP.size / MAP.step) + 1;
  cache = new Float32Array(cacheN * cacheN);
  for (const p of PLATEAUS) p.h = baseHeight(p.x, p.z);
  for (let j = 0; j < cacheN; j++) {
    const z = -MAP.half + j * MAP.step;
    for (let i = 0; i < cacheN; i++) {
      const x = -MAP.half + i * MAP.step;
      cache[j * cacheN + i] = applyFlatten(x, z, baseHeight(x, z));
    }
  }
}
export function heightAt(x, z) {
  if (!cache) return terrainHeight(x, z);
  const fx = clamp((x + MAP.half) / MAP.step, 0, cacheN - 1.001);
  const fz = clamp((z + MAP.half) / MAP.step, 0, cacheN - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const h00 = cache[j * cacheN + i], h10 = cache[j * cacheN + i + 1];
  const h01 = cache[(j + 1) * cacheN + i], h11 = cache[(j + 1) * cacheN + i + 1];
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
}
export function normalAt(x, z) {
  const e = 2;
  const hL = heightAt(x - e, z), hR = heightAt(x + e, z), hD = heightAt(x, z - e), hU = heightAt(x, z + e);
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
}
export function slopeAt(x, z) {
  const n = normalAt(x, z);
  return 1 - n.y;
}
export function isWater(x, z) { return heightAt(x, z) < WATER_Y; }
export function zoneAt(x, z) {
  if (x < 0 && z > 0) return ZONES[0];
  if (x >= 0 && z > 0) return ZONES[1];
  if (x < 0 && z <= 0) return ZONES[2];
  return ZONES[3];
}
export function placeNear(id) { return PLACES.find((p) => p.id === id); }
export function placeAt(x, z) {
  let best = null, bd = Infinity;
  for (const p of PLACES) {
    const d = dist2D(x, z, p.x, p.z);
    if (d < p.r + 40 && d < bd) { bd = d; best = p; }
  }
  return best;
}
export function roadDistance(x, z) {
  let d = Infinity;
  for (const key of Object.keys(ROADS)) {
    const c = closestOnPolyline(x, z, ROADS[key]);
    if (c.d < d) d = c.d;
  }
  return d;
}
export const roadLength = (key) => polylineLength(ROADS[key]);
export const roadPointAt = (key, s) => pointAlongPolyline(ROADS[key], s);
export function groundMaterial(x, z) {
  if (isWater(x, z)) return 'water';
  for (const b of BRIDGES) if (dist2D(x, z, b.x, b.z) < 14) return 'wood';
  const pal = placeNear('palace');
  if (dist2D(x, z, pal.x, pal.z) < pal.r * 0.75) return 'stone';
  if (roadDistance(x, z) < 6) return 'dirt';
  if (slopeAt(x, z) > 0.4) return 'stone';
  return 'grass';
}
export function canStand(x, z) { return slopeAt(x, z) < 0.62 && !isWater(x, z); }

// ---------------- меши ----------------
function terrainColor(h, slope, x, z, out) {
  const zone = zoneAt(x, z);
  let r, g, b;
  if (h < WATER_Y + 1.2) { r = 0.52; g = 0.44; b = 0.3; }
  else if (h > 132) { r = 0.86; g = 0.88; b = 0.9; }
  else if (h > 96) { const t = smoothstep(96, 132, h); r = lerp(0.44, 0.86, t); g = lerp(0.43, 0.88, t); b = lerp(0.4, 0.9, t); }
  else if (slope > 0.35) { const t = smoothstep(0.35, 0.75, slope); r = lerp(0.4, 0.45, t); g = lerp(0.44, 0.43, t); b = lerp(0.28, 0.4, t); }
  else if (zone.key === 'elves') { r = 0.2; g = 0.36; b = 0.17; }
  else if (zone.key === 'empire') { r = 0.36; g = 0.48; b = 0.22; }
  else if (zone.key === 'villain') { r = 0.3; g = 0.32; b = 0.26; }
  else { r = 0.36; g = 0.45; b = 0.2; }
  if (h < 60) { const t = 1 - smoothstep(0, 60, h); r = lerp(r, 0.33, t * 0.25); g = lerp(g, 0.44, t * 0.2); }
  const n = (fbm2(x / 26, z / 26, 7, 2) - 0.5) * 0.13;
  const rd = roadDistance(x, z);
  if (rd < 6.5 && h >= WATER_Y + 0.6) {
    const t = 1 - smoothstep(3.5, 6.5, rd);
    r = lerp(r, 0.42, t); g = lerp(g, 0.35, t); b = lerp(b, 0.24, t);
  }
  out.setRGB(clamp(r + n, 0, 1), clamp(g + n, 0, 1), clamp(b + n, 0, 1));
  return out;
}

function buildGround() {
  const group = new THREE.Group();
  group.name = 'terrain';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const nChunks = Math.floor(MAP.size / MAP.chunk);
  const seg = MAP.chunk / MAP.step;
  const col = new THREE.Color();
  for (let cj = 0; cj < nChunks; cj++) {
    for (let ci = 0; ci < nChunks; ci++) {
      const ox = -MAP.half + ci * MAP.chunk, oz = -MAP.half + cj * MAP.chunk;
      const geo = new THREE.PlaneGeometry(MAP.chunk, MAP.chunk, seg, seg);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const lx = pos.getX(k), lz = pos.getZ(k);
        const wx = ox + lx + MAP.chunk / 2, wz = oz + lz + MAP.chunk / 2;
        const h = heightAt(wx, wz);
        pos.setY(k, h);
        terrainColor(h, slopeAt(wx, wz), wx, wz, col);
        colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(ox + MAP.chunk / 2, 0, oz + MAP.chunk / 2);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.receiveShadow = true;
      m.userData.chunk = [ci, cj];
      group.add(m);
    }
  }
  return group;
}

function buildWater() {
  const geo = new THREE.PlaneGeometry(MAP.size, MAP.size, 64, 64);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x2d4f5e, transparent: true, opacity: 0.82, shininess: 90, specular: 0x88bbdd, flatShading: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_Y;
  mesh.receiveShadow = false;
  mesh.name = 'water';
  mesh.userData.basePos = geo.attributes.position.array.slice();
  return mesh;
}

function buildBridges() {
  const group = new THREE.Group();
  group.name = 'bridges';
  const stone = new THREE.MeshLambertMaterial({ color: 0x77736a });
  const wood = new THREE.MeshLambertMaterial({ color: 0x5b452c });
  for (const b of BRIDGES) {
    const g = new THREE.Group();
    const deckH = WATER_Y + 3.2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 0.8, 30), wood);
    deck.position.set(0, deckH, 0);
    g.add(deck);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 30), wood);
      rail.position.set(side * 6.2, deckH + 0.9, 0);
      g.add(rail);
    }
    // опоры-арки
    for (const oz of [-11, 0, 11]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 3.4), stone);
      pier.position.set(0, deckH - 4.4, oz);
      g.add(pier);
    }
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.angle;
    group.add(g);
  }
  return group;
}

export function buildTerrain(scene) {
  buildCache();
  G.waterY = WATER_Y;
  const terrain = buildGround();
  scene.add(terrain);
  const water = buildWater();
  scene.add(water);
  const bridges = buildBridges();
  scene.add(bridges);
  G.world = G.world || {};
  G.world.terrain = terrain;
  G.world.water = water;
  G.world.bridges = bridges;
  G.zones = ZONES;
  G.places = PLACES;
  G.roadPoints = ROADS;
  return { terrain, water, bridges };
}

export function updateWater(dt) {
  const w = G.world && G.world.water;
  if (!w) return;
  const t = G.now;
  const pos = w.geometry.attributes.position;
  if (!w.userData.basePos) return;
  const base = w.userData.basePos;
  for (let i = 0; i < pos.count; i += 3) {
    const x = base[i * 3], z = base[i * 3 + 2];
    pos.setY(i, Math.sin(x * 0.05 + t * 1.1) * 0.25 + Math.cos(z * 0.06 - t * 0.9) * 0.22);
  }
  pos.needsUpdate = true;
  void dt;
}
