// Мир: ландшафт, четыре зоны, дороги, постройки, лес с LOD (вдали картинка — вблизи 3D).
import * as THREE from '../lib/three.min.js';
import { G, WORLD, HALF, SITES, ROADS, SOUTH_ROAD, clamp, lerp, sstep, rnd } from './data.js';

const N = 300, CELL = WORLD / N, NV = N + 1;
const heights = new Float32Array(NV * NV);
export const boxes = [];           // коллайдеры построек: {x0,x1,z0,z1,top}
let scene;

// ---------- шум ----------
let seed = 1337;
function srand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, o = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; }
  return s;
}

// ---------- дороги ----------
const roadSegs = [];
function mountainF(x, z) { return sstep(20, 200, x) * sstep(20, 200, -z); }
function forestF(x, z) { return sstep(15, 110, -x) * sstep(15, 110, -z); }
function empireF(x, z) { return sstep(15, 110, x) * sstep(15, 110, z); }
function rawHeight(x, z) {
  let h = 2 + fbm(x / 70, z / 70) * 9 - 3;
  const m = mountainF(x, z);
  if (m > 0) {
    const r = 1 - Math.abs(2 * fbm(x / 95 + 7, z / 95 + 3, 5) - 1);
    h += m * (16 + 78 * r * r + fbm(x / 22, z / 22, 3) * 9);
  }
  h += forestF(x, z) * fbm(x / 40 + 30, z / 40, 3) * 7;
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += sstep(560, 600, edge) * 26;
  return h;
}
function siteHeight(x, z) {
  let h = rawHeight(x, z);
  for (const k in SITES) {
    const s = SITES[k], d = Math.hypot(x - s.x, z - s.z);
    const w = 1 - sstep(s.r, s.r * 1.7, d);
    if (w > 0) h = lerp(h, s.h, w);
  }
  return h;
}
function initRoads() {
  const add = pl => {
    for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i], b = pl[i + 1];
      roadSegs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], ah: siteHeight(a[0], a[1]), bh: siteHeight(b[0], b[1]) });
    }
  };
  for (const k in ROADS) add(ROADS[k]);
  add(SOUTH_ROAD);
}
const _rd = { d: 0, h: 0 };
export function roadInfo(x, z) {
  let best = 1e9, bh = 0;
  for (const s of roadSegs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
    if (d < best) { best = d; bh = lerp(s.ah, s.bh, t); }
  }
  _rd.d = best; _rd.h = bh;
  return _rd;
}

export function heightAt(x, z) {
  const fx = clamp((x + HALF) / CELL, 0, N - 0.001), fz = clamp((z + HALF) / CELL, 0, N - 0.001);
  const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz;
  const i = iz * NV + ix;
  const a = heights[i], b = heights[i + 1], c = heights[i + NV], d = heights[i + NV + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------- ландшафт ----------
function buildTerrain() {
  const pos = new Float32Array(NV * NV * 3), col = new Float32Array(NV * NV * 3);
  const map = document.createElement('canvas'); map.width = map.height = NV;
  const mctx = map.getContext('2d'), img = mctx.createImageData(NV, NV);
  const c = new THREE.Color();
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    let h = siteHeight(x, z);
    const r = roadInfo(x, z), rd = r.d;
    const rw = 1 - sstep(5, 17, rd);
    if (rw > 0) h = lerp(h, r.h, rw);
    heights[j * NV + i] = h;
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * NV + i, h = heights[k];
    const m = mountainF(x, z), f = forestF(x, z), e = empireF(x, z);
    let R = 0.36, Gc = 0.55, B = 0.2;                         // луга людей
    R = lerp(R, 0.15, f); Gc = lerp(Gc, 0.36, f); B = lerp(B, 0.13, f);   // лесная подстилка
    R = lerp(R, 0.56, e); Gc = lerp(Gc, 0.6, e); B = lerp(B, 0.22, e);    // поля империи
    const rock = sstep(0.15, 0.6, m);
    R = lerp(R, 0.4, rock); Gc = lerp(Gc, 0.37, rock); B = lerp(B, 0.4, rock);
    const hl = heights[k - (i > 0 ? 1 : 0)], hr = heights[k + (i < N ? 1 : 0)];
    const hu = heights[k - (j > 0 ? NV : 0)], hd = heights[k + (j < N ? NV : 0)];
    const slope = Math.hypot(hr - hl, hd - hu) / (2 * CELL);
    const cliff = sstep(0.55, 1.1, slope);
    R = lerp(R, 0.36, cliff); Gc = lerp(Gc, 0.33, cliff); B = lerp(B, 0.32, cliff);
    const snow = sstep(66, 82, h + fbm(x / 15, z / 15, 2) * 8) * (1 - cliff * 0.6);
    R = lerp(R, 0.93, snow); Gc = lerp(Gc, 0.94, snow); B = lerp(B, 0.98, snow);
    const dF = Math.hypot(x - SITES.evil.x, z - SITES.evil.z);
    const fw = 1 - sstep(40, 70, dF); R = lerp(R, 0.24, fw); Gc = lerp(Gc, 0.21, fw); B = lerp(B, 0.25, fw);
    const dT = Math.hypot(x - SITES.human.x, z - SITES.human.z);
    const tw = 1 - sstep(22, 30, dT); R = lerp(R, 0.6, tw); Gc = lerp(Gc, 0.55, tw); B = lerp(B, 0.47, tw);
    const pw = (Math.abs(x - SITES.empire.x) < 54 && Math.abs(z - SITES.empire.z) < 54) ? 1 : 0;
    R = lerp(R, 0.62, pw); Gc = lerp(Gc, 0.6, pw); B = lerp(B, 0.56, pw);
    const rw = 1 - sstep(2.6, 5.5, roadInfo(x, z).d);
    R = lerp(R, 0.56, rw); Gc = lerp(Gc, 0.45, rw); B = lerp(B, 0.3, rw);
    const nv = 0.86 + fbm(x / 9, z / 9, 2) * 0.28;
    R *= nv; Gc *= nv; B *= nv;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    c.setRGB(R, Gc, B, THREE.SRGBColorSpace);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    const sh = clamp(1 + (hl - hr) * 0.09 + (hu - hd) * 0.09, 0.55, 1.4);
    img.data[k * 4] = clamp(R * sh * 255, 0, 255); img.data[k * 4 + 1] = clamp(Gc * sh * 255, 0, 255);
    img.data[k * 4 + 2] = clamp(B * sh * 255, 0, 255); img.data[k * 4 + 3] = 255;
  }
  mctx.putImageData(img, 0, 0);
  const idx = new Uint32Array(N * N * 6);
  let p = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * NV + i, b = a + 1, cc = a + NV, d = cc + 1;
    idx[p++] = a; idx[p++] = cc; idx[p++] = b; idx[p++] = b; idx[p++] = cc; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  G.mapCanvas = map;
}

// ---------- статическая геометрия пачкой ----------
function colored(geo, color, shadeBottom = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const n = g.attributes.position.count, arr = new Float32Array(n * 3), c = new THREE.Color(color);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < n; i++) {
    const t = shadeBottom ? lerp(1 - shadeBottom, 1, (g.attributes.position.getY(i) - y0) / (y1 - y0 || 1)) : 1;
    arr[i * 3] = c.r * t; arr[i * 3 + 1] = c.g * t; arr[i * 3 + 2] = c.b * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}
export function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), C = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    P.set(g.attributes.position.array, o); Nn.set(g.attributes.normal.array, o); C.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return out;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
class Batch {
  constructor() { this.list = []; }
  add(geo, color, x, y, z, ry = 0, rx = 0, rz = 0, shade = 0.25) {
    const g = colored(geo, color, shade);
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s);
    g.applyMatrix4(_m); this.list.push(g); return this;
  }
  box(w, h, d, x, y, z, color, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry); }
  cyl(r, h, x, y, z, color, seg = 10, rTop = r) { return this.add(new THREE.CylinderGeometry(rTop, r, h, seg), color, x, y + h / 2, z); }
  cone(r, h, x, y, z, color, seg = 10, ry = 0) { return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, ry); }
  build() {
    const mesh = new THREE.Mesh(mergeGeos(this.list), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.matrixAutoUpdate = false; scene.add(mesh); this.list = []; return mesh;
  }
}
function addBox(x, z, w, d, top = 99) { boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top }); }
const noTree = [];  // круги, где не растут деревья: {x,z,r}

function house(B, x, z, w, d, hgt, wall, roof, ry = 0, stilts = 0) {
  const y = heightAt(x, z) - 0.4 + stilts;
  if (stilts) for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(0.35, stilts + 0.6, 0.35, x + sx * (w / 2 - 0.3), y - stilts - 0.2, z + sz * (d / 2 - 0.3), 0x5a4028);
  B.box(w, hgt, d, x, y, z, wall);
  const rg = new THREE.ConeGeometry(0.74, 1, 4); rg.rotateY(Math.PI / 4); rg.scale(w * 1.06, hgt * 0.62, d * 1.06);
  B.add(rg, roof, x, y + hgt + hgt * 0.31, z, 0, 0, 0, 0.3);
  B.box(1.1, 2, 0.15, x, y, z + d / 2 + 0.02, 0x3a2a18);                 // дверь
  B.box(0.9, 0.8, 0.12, x - w * 0.28, y + hgt * 0.5, z + d / 2 + 0.02, 0x9fd0e8);
  B.box(0.9, 0.8, 0.12, x + w * 0.28, y + hgt * 0.5, z + d / 2 + 0.02, 0x9fd0e8);
  if (stilts) B.box(1.4, 0.2, 1.6, x, y - 0.2, z + d / 2 + 0.8, 0x6b4a2c);
  addBox(x, z, w + 0.4, d + 0.4, y + hgt);
  noTree.push({ x, z, r: Math.max(w, d) * 0.5 + 3.5 });
}

function buildTown(B) {
  const s = SITES.human, y = s.h;
  B.cyl(2.2, 1.1, s.x, y - 0.1, s.z, 0x8a8a86, 12); B.cyl(1.7, 0.2, s.x, y + 1, s.z, 0x2a5f9a, 12);
  B.box(0.25, 3, 0.25, s.x - 2, y, s.z, 0x5a4028); B.box(0.25, 3, 0.25, s.x + 2, y, s.z, 0x5a4028); B.box(4.6, 0.25, 0.6, s.x, y + 3, s.z, 0x7a3020);
  addBox(s.x, s.z, 4.6, 4.6, 2);
  const stallCols = [0xc0392b, 0x2e86c1, 0x27ae60, 0x8e44ad, 0xd68910];
  const kinds = ['smith', 'armorer', 'alch', 'prosth', 'trader'];
  G.poi.stalls = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.15 + i * (Math.PI * 2 / 5) * 0.86 + 1.2, cx = s.x + Math.cos(a) * 17, cz = s.z + Math.sin(a) * 17;
    const yy = heightAt(cx, cz);
    for (const sx of [-1.8, 1.8]) for (const sz of [-1.3, 1.3]) B.box(0.18, 3, 0.18, cx + sx, yy, cz + sz, 0x6b4a2c);
    B.box(4.4, 0.25, 3.4, cx, yy + 3, cz, stallCols[i]);
    B.box(4.4, 0.5, 0.2, cx, yy + 2.6, cz + 1.7, 0xf4ecd8); B.box(4.4, 0.5, 0.2, cx, yy + 2.6, cz - 1.7, 0xf4ecd8);
    B.box(3.6, 1, 1, cx, yy, cz, 0x8a6238);
    B.box(0.5, 0.4, 0.5, cx - 1, yy + 1, cz, stallCols[(i + 2) % 5]); B.box(0.6, 0.3, 0.5, cx + 0.8, yy + 1, cz, stallCols[(i + 3) % 5]);
    addBox(cx, cz, 3.8, 1.2, 2);
    const out = { x: cx + Math.cos(a) * 1.7, z: cz + Math.sin(a) * 1.7 };
    G.poi.stalls.push({ kind: kinds[i], x: out.x, z: out.z, face: Math.atan2(s.x - out.x, s.z - out.z) });
  }
  // трактир
  const tx = s.x + 6, tz = s.z - 34;
  house(B, tx, tz, 13, 9, 5, 0xd9c7a0, 0x7a3020);
  B.box(2.4, 1, 0.2, tx, heightAt(tx, tz) + 3.2, tz + 4.8, 0xd6a530);
  G.poi.tavern = { x: tx + 3, z: tz + 6.5, face: 0 };
  const walls = [0xe6dcc4, 0xd9c7a0, 0xcbb894, 0xe9e2d2], roofs = [0x9c3b28, 0x7a3020, 0x8a4a2a, 0x5f6b7a];
  let placed = 0, tries = 0;
  const spots = [];
  while (placed < 26 && tries++ < 900) {
    const a = srand() * Math.PI * 2, r = 30 + srand() * 58, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
    if (roadInfo(x, z).d < 10) continue;
    if (Math.hypot(x - tx, z - tz) < 15) continue;
    if (spots.some(q => Math.hypot(q.x - x, q.z - z) < 14)) continue;
    spots.push({ x, z }); placed++;
    house(B, x, z, 6 + srand() * 3, 5.5 + srand() * 3, 3.2 + srand() * 1.4, walls[placed % 4], roofs[placed % 4]);
  }
  noTree.push({ x: s.x, z: s.z, r: 34 });
}

function buildPalace(B) {
  const s = SITES.empire, y = s.h - 0.5, W = 55, H = 9, T = 3, gate = 7;
  const stone = 0xbfb8a8, dark = 0x9d9686, blue = 0x2c4f9e;
  const seg = (W - gate) ;       // длина половины стены
  for (const sg of [-1, 1]) {
    const off = sg * (gate + seg / 2);
    // запад/восток
    for (const sx of [-1, 1]) {
      B.box(T, H, seg, s.x + sx * W, y, s.z + off, stone); addBox(s.x + sx * W, s.z + off, T, seg);
      B.box(T, H, seg, s.x + off, y, s.z + sx * W, stone, Math.PI / 2); addBox(s.x + off, s.z + sx * W, seg, T);
    }
  }
  // зубцы
  for (let i = -W; i <= W; i += 4) {
    if (Math.abs(i) < gate + 1) continue;
    for (const sx of [-1, 1]) { B.box(T + 0.4, 1.2, 2, s.x + sx * W, y + H, s.z + i, dark); B.box(2, 1.2, T + 0.4, s.x + i, y + H, s.z + sx * W, dark); }
  }
  // башни по углам и у ворот
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = s.x + sx * W, z = s.z + sz * W;
    B.cyl(5.5, 15, x, y, z, stone, 12); B.cone(6.6, 7, x, y + 15, z, blue, 12); addBox(x, z, 9, 9);
  }
  for (const [gx, gz, horiz] of [[-W, 0, 0], [W, 0, 0], [0, -W, 1], [0, W, 1]]) for (const sg of [-1, 1]) {
    const x = s.x + gx + (horiz ? sg * (gate + 1.6) : 0), z = s.z + gz + (horiz ? 0 : sg * (gate + 1.6));
    B.box(4.4, 13, 4.4, x, y, z, dark); B.cone(3.6, 4, x, y + 13, z, blue, 4, Math.PI / 4); addBox(x, z, 4.6, 4.6);
    B.box(0.2, 5, 0.2, x, y + 13, z, 0x444444); B.box(0.1, 1.6, 2.4, x, y + 16.2, z + 1.3, 0x3b6fd6);
  }
  // донжон
  const kx = s.x + 18, kz = s.z;
  B.box(30, 16, 24, kx, y, kz, 0xcfc8b8); addBox(kx, kz, 30.6, 24.6);
  B.box(32, 1.4, 26, kx, y + 16, kz, dark);
  B.box(14, 12, 12, kx + 2, y + 17, kz, 0xcfc8b8);
  B.add(new THREE.ConeGeometry(10.5, 9, 4), blue, kx + 2, y + 33.5, kz, Math.PI / 4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.cyl(3.4, 23, kx + sx * 15, y, kz + sz * 12, stone, 10); B.cone(4.2, 7, kx + sx * 15, y + 23, kz + sz * 12, blue, 10); }
  B.box(5, 6.5, 0.5, kx - 15.1, y, kz, 0x4a321c);
  for (let i = -2; i <= 2; i++) if (i) B.box(0.3, 2.4, 1.6, kx - 15.1, y + 8, kz + i * 4.4, 0x26334f);
  // тронный помост
  const tx = s.x - 6, tz = s.z;
  B.box(9, 0.8, 9, tx, y + 0.3, tz, 0x8f2f2f); B.box(2, 3.6, 1.2, tx + 3, y + 1.1, tz, 0xd6a530); B.box(2.2, 0.6, 2, tx + 2.2, y + 1.1, tz, 0x8f2f2f);
  addBox(tx + 3, tz, 2, 1.4);
  G.poi.throne = { x: tx + 0.5, z: tz, face: -Math.PI / 2 };
  // казармы
  for (const sz of [-1, 1]) {
    const bx = s.x - 22, bz = s.z + sz * 36;
    B.box(26, 5, 9, bx, y, bz, 0xa89f8c); addBox(bx, bz, 26.4, 9.4);
    const rg = new THREE.CylinderGeometry(5.6, 5.6, 26, 3); rg.rotateZ(Math.PI / 2);
    B.add(rg, 0x34507e, bx, y + 5 + 2.6, bz, 0, 0, 0, 0.2);
    B.box(1.3, 2.3, 0.2, bx, y, bz - sz * 4.6, 0x3a2a18);
  }
  G.poi.commander = { x: s.x - 40, z: s.z - 12, face: Math.PI / 2 };
  G.poi.quarter = { x: s.x - 24, z: s.z - 29, face: 0 };
  G.poi.medic = { x: s.x - 24, z: s.z + 29, face: Math.PI };
  // тренировочные чучела
  for (let i = 0; i < 3; i++) { const dx = s.x - 38 + i * 4, dz = s.z + 16; B.box(0.2, 2, 0.2, dx, y, dz, 0x6b4a2c); B.box(1.2, 0.2, 0.2, dx, y + 1.5, dz, 0x6b4a2c); B.box(0.6, 0.8, 0.4, dx, y + 1.1, dz, 0xc9b27a); }
  noTree.push({ x: s.x, z: s.z, r: 84 });
  // хутора империи
  const spots = [];
  let tries = 0;
  while (spots.length < 12 && tries++ < 500) {
    const x = 40 + srand() * 520, z = 40 + srand() * 520;
    if (Math.hypot(x - s.x, z - s.z) < 100 || roadInfo(x, z).d < 12 || roadInfo(x, z).d > 70) continue;
    if (spots.some(q => Math.hypot(q.x - x, q.z - z) < 30)) continue;
    spots.push({ x, z });
    house(B, x, z, 7, 6, 3.4, 0xe6dcc4, 0x34507e);
    const fy = heightAt(x + 10, z);
    B.box(9, 0.25, 9, x + 11, fy - 0.05, z, 0xb99a3a);
  }
}

function buildElfVillage(B) {
  const s = SITES.elf, y = s.h;
  // великое древо
  B.cyl(3.4, 30, s.x, y - 1, s.z, 0x5a3e24, 10, 2.2);
  for (const [dx, dy, dz, r] of [[0, 34, 0, 13], [8, 28, 3, 9], [-7, 29, -5, 9], [2, 27, -9, 8], [-3, 28, 9, 8]]) B.add(new THREE.IcosahedronGeometry(r, 1), 0x2f7d32, s.x + dx, y + dy, s.z + dz, 0, 0, 0, 0.45);
  addBox(s.x, s.z, 6, 6);
  G.poi.elder = { x: s.x + 6, z: s.z + 6, face: Math.PI / 4 };
  const spots = [];
  let tries = 0;
  while (spots.length < 15 && tries++ < 700) {
    const a = srand() * Math.PI * 2, r = 20 + srand() * 42, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
    if (roadInfo(x, z).d < 9) continue;
    if (spots.some(q => Math.hypot(q.x - x, q.z - z) < 13)) continue;
    spots.push({ x, z });
    house(B, x, z, 5.5 + srand() * 2, 5 + srand() * 2, 3, spots.length % 2 ? 0x7a5632 : 0x8a6238, spots.length % 3 ? 0x3d7a34 : 0x55803a, 0, 1.4);
  }
  // сторожевые вышки
  for (const [dx, dz] of [[34, 30], [-36, -28]]) {
    const x = s.x + dx, z = s.z + dz, yy = heightAt(x, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(0.3, 9, 0.3, x + sx * 1.4, yy, z + sz * 1.4, 0x5a4028);
    B.box(3.6, 0.3, 3.6, x, yy + 9, z, 0x7a5632); B.cone(3, 2.4, x, yy + 11.4, z, 0x3d7a34, 6);
    B.box(0.3, 2.4, 0.3, x + 1.5, yy + 9, z + 1.5, 0x5a4028); B.box(0.3, 2.4, 0.3, x - 1.5, yy + 9, z - 1.5, 0x5a4028);
    addBox(x, z, 3.2, 3.2);
  }
  // лавка травницы
  const hx = s.x - 10, hz = s.z + 12, hy = heightAt(hx, hz);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.2, 1.2]) B.box(0.18, 2.8, 0.18, hx + sx, hy, hz + sz, 0x5a4028);
  B.cone(3.2, 1.6, hx, hy + 2.8, hz, 0x55803a, 6); B.box(3.2, 1, 0.9, hx, hy, hz, 0x7a5632);
  addBox(hx, hz, 3.4, 1.1, 2);
  G.poi.elfshop = { x: hx, z: hz + 1.6, face: 0 };
  noTree.push({ x: s.x, z: s.z, r: 16 });
}

function buildFort(B) {
  const s = SITES.evil, y = s.h - 0.6, W = 34, dark = 0x4a4550, darker = 0x38343e, purple = 0x7a2bb0;
  for (const side of [0, 1, 2, 3]) {
    for (let i = -4; i <= 4; i++) {
      const t = i * 7.6;
      let x, z, w, d;
      if (side === 0) { x = s.x - W; z = s.z + t; w = 3.4; d = 7.6; }
      else if (side === 1) { x = s.x + W; z = s.z + t; w = 3.4; d = 7.6; }
      else if (side === 2) { x = s.x + t; z = s.z - W; w = 7.6; d = 3.4; }
      else { x = s.x + t; z = s.z + W; w = 7.6; d = 3.4; }
      // пролом для дороги на юго-западе и случайные обвалы
      if (x < s.x - 12 && z > s.z + 12) continue;
      const hsh = hash(side * 31 + i, 77);
      if (hsh < 0.16) { B.box(w, 1.2, d, x, y, z, darker); continue; }
      const h = 4 + hsh * 6;
      B.box(w, h, d, x, y, z, hsh > 0.6 ? dark : darker); addBox(x, z, w, d);
      if (hsh > 0.5) B.cone(0.5, 2.2, x, y + h, z, 0x222222, 4);
    }
  }
  // главная башня
  const tx = s.x + 14, tz = s.z - 14;
  B.cyl(9, 24, tx, y, tz, dark, 10, 7.5); addBox(tx, tz, 15, 15);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (i % 3) B.box(2.2, 2 + (i % 2) * 1.6, 1.4, tx + Math.cos(a) * 7.2, y + 24, tz + Math.sin(a) * 7.2, darker, -a + Math.PI / 2); }
  B.box(3.4, 5, 0.5, tx - 6.2, y, tz + 6.2, 0x1c1820, Math.PI / 4);
  B.box(0.25, 9, 0.25, tx, y + 24, tz, 0x222222); B.box(0.12, 2.6, 4, tx, y + 30.2, tz + 2.1, purple);
  // трон Злого
  const zx = s.x + 4, zz = s.z - 4;
  B.box(7, 0.7, 7, zx, y + 0.3, zz, darker); B.box(2.2, 4.4, 1.2, zx + 2, y + 1, zz - 2, 0x1c1820, -Math.PI / 4);
  B.cone(0.4, 1.6, zx + 2.7, y + 5.4, zz - 1.3, purple, 4); B.cone(0.4, 1.6, zx + 1.3, y + 5.4, zz - 2.7, purple, 4);
  G.poi.evilThrone = { x: zx, z: zz, face: Math.PI * 1.25 };
  // шатры
  for (const [dx, dz] of [[-18, -16], [-20, 2], [12, 20], [24, 8]]) {
    const x = s.x + dx, z = s.z + dz, yy = heightAt(x, z);
    B.cone(4, 5, x, yy - 0.2, z, 0x5b2a6e, 6); B.box(0.2, 6.4, 0.2, x, yy, z, 0x222222); addBox(x, z, 4.5, 4.5);
  }
  // жаровни
  G.poi.braziers = [];
  for (const [dx, dz] of [[-6, 6], [10, 6], [-4, -12], [-24, 26]]) {
    const x = s.x + dx, z = s.z + dz, yy = heightAt(x, z);
    B.cyl(0.25, 1.4, x, yy, z, 0x222222, 6); B.cyl(0.4, 0.4, x, yy + 1.4, z, 0x333333, 8, 0.8);
    G.poi.braziers.push({ x, y: yy + 2.1, z });
  }
  // колья
  for (let i = 0; i < 14; i++) { const a = Math.PI * 0.55 + i * 0.09, r = 44 + (i % 3) * 3, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; B.add(new THREE.ConeGeometry(0.25, 3.4, 5), 0x3b2a1a, x, heightAt(x, z) + 1.3, z, 0, 0.5, 0); }
  G.poi.dealer = { x: s.x - 14, z: s.z + 10, face: Math.PI / 2 };
  G.poi.bones = { x: s.x + 6, z: s.z + 16, face: Math.PI };
  B.box(3, 1, 1, s.x - 15.6, heightAt(s.x - 15, s.z + 10), s.z + 10, 0x3b2a1a, Math.PI / 2); addBox(s.x - 15.6, s.z + 10, 1.2, 3.2, 2);
  noTree.push({ x: s.x, z: s.z, r: 58 });
}

function buildMisc(B) {
  const y = heightAt(3, 3);
  B.box(0.3, 4, 0.3, 4, y, 4, 0x5a4028);
  B.box(2.6, 0.5, 0.12, 4, y + 3.4, 4, 0xd9c7a0, Math.PI / 4); B.box(2.6, 0.5, 0.12, 4, y + 2.7, 4, 0xd9c7a0, -Math.PI / 4);
  addBox(4, 4, 0.6, 0.6);
  for (let i = 0; i < 160; i++) {       // валуны
    const x = (srand() - 0.5) * 1150, z = (srand() - 0.5) * 1150;
    if (roadInfo(x, z).d < 7) continue;
    let ok = true; for (const k in SITES) if (Math.hypot(x - SITES[k].x, z - SITES[k].z) < SITES[k].r) ok = false;
    if (!ok) continue;
    const mt = mountainF(x, z), r = 0.8 + srand() * (1.4 + mt * 3);
    B.add(new THREE.DodecahedronGeometry(r, 0), mt > 0.3 ? 0x6b6870 : 0x8a8a80, x, heightAt(x, z) + r * 0.3, z, srand() * 6, srand(), 0, 0.3);
    if (r > 1.6) addBox(x, z, r * 1.5, r * 1.5, heightAt(x, z) + r);
  }
}

// ---------- лес ----------
const T = { x: null, z: null, y: null, s: null, type: null, n: 0 };
const TG = 30, TGN = Math.ceil(WORLD / TG);
const treeGrid = [];
const NEAR = 78, FAR = 470, MAX3D = 1400, MAXBB = 7000;
const treeMesh = [], bbMesh = [];
const lodAt = new THREE.Vector3(1e9, 0, 0);
export const treeStats = { near: 0, far: 0 };

function genTrees() {
  const xs = [], zs = [], ss = [], ts = [];
  for (let i = 0; i < TGN * TGN; i++) treeGrid.push([]);
  const tryAdd = (x, z, type, minD) => {
    if (Math.abs(x) > 588 || Math.abs(z) > 588) return;
    if (roadInfo(x, z).d < 6.5) return;
    for (const c of noTree) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return;
    const gi = Math.floor((x + HALF) / TG), gj = Math.floor((z + HALF) / TG);
    for (let a = Math.max(0, gi - 1); a <= Math.min(TGN - 1, gi + 1); a++) for (let b = Math.max(0, gj - 1); b <= Math.min(TGN - 1, gj + 1); b++)
      for (const t of treeGrid[b * TGN + a]) if ((xs[t] - x) ** 2 + (zs[t] - z) ** 2 < minD * minD) return;
    treeGrid[gj * TGN + gi].push(xs.length);
    xs.push(x); zs.push(z); ss.push(0.75 + srand() * 0.9); ts.push(type);
  };
  for (let i = 0; i < 26000; i++) {
    const x = (srand() - 0.5) * WORLD, z = (srand() - 0.5) * WORLD;
    const f = forestF(x, z), m = mountainF(x, z), e = empireF(x, z);
    const clump = fbm(x / 60 + 11, z / 60 + 5, 2);
    let p = 0.05 + (clump > 0.52 ? 0.22 : 0);
    p = lerp(p, 1, f); p = lerp(p, 0.035 + (clump > 0.6 ? 0.1 : 0), e);
    if (m > 0.1) { const h = siteHeight(x, z); p = h > 60 ? 0 : lerp(p, 0.22, m); }
    if (srand() > p) continue;
    const type = m > 0.25 ? 0 : (f > 0.5 ? (srand() < 0.6 ? 0 : 1) : (srand() < 0.25 ? 0 : 1));
    tryAdd(x, z, type, f > 0.5 ? 3.6 : 5);
  }
  T.n = xs.length; T.x = new Float32Array(xs); T.z = new Float32Array(zs); T.s = new Float32Array(ss); T.type = new Uint8Array(ts);
  T.y = new Float32Array(T.n);
  for (let i = 0; i < T.n; i++) T.y[i] = heightAt(T.x[i], T.z[i]) - 0.25;
  G.treeCount = T.n;
}
function treeGeos() {
  const pine = [colored(new THREE.CylinderGeometry(0.2, 0.32, 2.6, 6).translate(0, 1.3, 0), 0x5a3e24)];
  [[2.1, 3.2, 3.2, 0x1f5a2a], [1.6, 2.8, 5.0, 0x256b30], [1.05, 2.4, 6.6, 0x2e7a38]].forEach(([r, h, y, c]) => pine.push(colored(new THREE.ConeGeometry(r, h, 7).translate(0, y, 0), c, 0.35)));
  const oak = [colored(new THREE.CylinderGeometry(0.26, 0.4, 3, 6).translate(0, 1.5, 0), 0x664628)];
  [[0, 4.4, 0, 2.3, 0x3f8a36], [1.3, 3.7, 0.6, 1.5, 0x357a30], [-1.2, 3.9, -0.5, 1.6, 0x4a9640]].forEach(([x, y, z, r, c]) => oak.push(colored(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), c, 0.4)));
  return [mergeGeos(pine), mergeGeos(oak)];
}
function treeTexture(type) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const c = cv.getContext('2d');
  if (type === 0) {      // сосна: высота 7.8, ширина 4.2
    c.fillStyle = '#5a3e24'; c.fillRect(58, 170, 12, 86);
    const tri = (cx, top, bot, w, col, col2) => {
      const g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, col); g.addColorStop(1, col2);
      c.fillStyle = g; c.beginPath(); c.moveTo(cx, top); c.lineTo(cx + w, bot); c.lineTo(cx - w, bot); c.closePath(); c.fill();
    };
    tri(64, 98, 205, 62, '#1f5a2a', '#143c1c'); tri(64, 46, 142, 47, '#256b30', '#18481f'); tri(64, 2, 82, 31, '#2e7a38', '#1d5226');
  } else {               // дуб: высота 6.7, ширина 7.4 (холст 128 → ширина)
    c.fillStyle = '#664628'; c.fillRect(57, 150, 14, 106);
    const blob = (x, y, r, col, col2) => { const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, col); g.addColorStop(1, col2); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    blob(42, 110, 30, '#4a9640', '#2c6a2a'); blob(88, 118, 28, '#357a30', '#235523'); blob(64, 86, 44, '#4a9a3e', '#2a6628');
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter;
  return tex;
}
function initTreeMeshes() {
  const geos = treeGeos();
  const dims = [[4.3, 7.9], [6.7, 6.7]];
  for (let t = 0; t < 2; t++) {
    const m = new THREE.InstancedMesh(geos[t], new THREE.MeshLambertMaterial({ vertexColors: true }), MAX3D);
    m.frustumCulled = false; m.count = 0; scene.add(m); treeMesh.push(m);
    const pg = new THREE.PlaneGeometry(dims[t][0], dims[t][1]).translate(0, dims[t][1] / 2, 0);
    const bm = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ map: treeTexture(t), alphaTest: 0.5 }), MAXBB);
    bm.frustumCulled = false; bm.count = 0; scene.add(bm); bbMesh.push(bm);
  }
}
// Главный трюк из ТЗ: дальние деревья — плоские картинки, ближние превращаются в 3D-модели.
export function updateTrees(cam, force) {
  if (!force && (cam.x - lodAt.x) ** 2 + (cam.z - lodAt.z) ** 2 < 9) return;
  lodAt.copy(cam);
  const cnt3 = [0, 0], cntB = [0, 0];
  const a3 = [treeMesh[0].instanceMatrix.array, treeMesh[1].instanceMatrix.array];
  const aB = [bbMesh[0].instanceMatrix.array, bbMesh[1].instanceMatrix.array];
  const gi0 = Math.max(0, Math.floor((cam.x - FAR + HALF) / TG)), gi1 = Math.min(TGN - 1, Math.floor((cam.x + FAR + HALF) / TG));
  const gj0 = Math.max(0, Math.floor((cam.z - FAR + HALF) / TG)), gj1 = Math.min(TGN - 1, Math.floor((cam.z + FAR + HALF) / TG));
  const near2 = NEAR * NEAR, far2 = FAR * FAR;
  for (let gj = gj0; gj <= gj1; gj++) for (let gi = gi0; gi <= gi1; gi++) {
    const cell = treeGrid[gj * TGN + gi];
    for (let k = 0; k < cell.length; k++) {
      const i = cell[k], x = T.x[i], z = T.z[i], dx = cam.x - x, dz = cam.z - z, d2 = dx * dx + dz * dz;
      if (d2 > far2) continue;
      const t = T.type[i], s = T.s[i];
      let arr, o, rot;
      if (d2 < near2 && cnt3[t] < MAX3D) { arr = a3[t]; o = cnt3[t]++ * 16; rot = i * 1.7; }
      else if (cntB[t] < MAXBB) { arr = aB[t]; o = cntB[t]++ * 16; rot = Math.atan2(dx, dz); }
      else continue;
      const c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
      arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
      arr[o + 12] = x; arr[o + 13] = T.y[i]; arr[o + 14] = z; arr[o + 15] = 1;
    }
  }
  for (let t = 0; t < 2; t++) {
    treeMesh[t].count = cnt3[t]; treeMesh[t].instanceMatrix.needsUpdate = true;
    bbMesh[t].count = cntB[t]; bbMesh[t].instanceMatrix.needsUpdate = true;
  }
  treeStats.near = cnt3[0] + cnt3[1]; treeStats.far = cntB[0] + cntB[1];
}

// ---------- столкновения ----------
export function collide(p, r) {        // выталкивает точку {x,z} из построек; true если было касание
  let hit = false;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r) {
      if (p.y !== undefined && p.y > b.top - 0.2) continue;
      const dl = p.x - (b.x0 - r), dr = (b.x1 + r) - p.x, du = p.z - (b.z0 - r), dd = (b.z1 + r) - p.z;
      const m = Math.min(dl, dr, du, dd);
      if (m === dl) p.x = b.x0 - r; else if (m === dr) p.x = b.x1 + r; else if (m === du) p.z = b.z0 - r; else p.z = b.z1 + r;
      hit = true;
    }
  }
  return hit;
}
export function collideTrees(p, r) {
  const gi = Math.floor((p.x + HALF) / TG), gj = Math.floor((p.z + HALF) / TG);
  for (let a = Math.max(0, gi - 1); a <= Math.min(TGN - 1, gi + 1); a++) for (let b = Math.max(0, gj - 1); b <= Math.min(TGN - 1, gj + 1); b++) {
    const cell = treeGrid[b * TGN + a];
    for (let k = 0; k < cell.length; k++) {
      const i = cell[k], dx = p.x - T.x[i], dz = p.z - T.z[i], rr = r + 0.3 * T.s[i], d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = T.x[i] + dx / d * rr; p.z = T.z[i] + dz / d * rr; }
    }
  }
}
export function pointBlocked(x, y, z) {
  for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.top) return true; }
  return false;
}
export function boxTopAt(x, z, r, feetY) {   // высота крыши-опоры под ногами (для прыжков на низкие объекты)
  let top = -1e9;
  for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (b.top < 50 && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && feetY > b.top - 0.25 && b.top > top) top = b.top; }
  return top;
}

// ---------- небо и время суток ----------
let sun, hemi, sunBall, moonBall, flames = [];
const cDay = new THREE.Color(0x86bdf0), cNight = new THREE.Color(0x0a1026), cDusk = new THREE.Color(0xe08a4a), cTmp = new THREE.Color();
export function updateSky(dt, camPos) {
  G.dayTime += dt / 720;                       // сутки = 12 минут
  if (G.dayTime >= 1) { G.dayTime -= 1; G.day++; }
  const ang = (G.dayTime - 0.25) * Math.PI * 2, sh = Math.sin(ang), ch = Math.cos(ang);
  const day = sstep(-0.12, 0.25, sh), dusk = (1 - Math.abs(sh) * 3.2);
  cTmp.copy(cNight).lerp(cDay, day); if (dusk > 0) cTmp.lerp(cDusk, dusk * 0.55 * sstep(-0.3, 0, sh));
  scene.background.copy(cTmp); scene.fog.color.copy(cTmp);
  sun.position.set(ch * 300, Math.max(40, sh * 300), 120);
  sun.intensity = 0.25 + day * 2.3;
  sun.color.setHex(0xfff2dd); if (dusk > 0) sun.color.lerp(cDusk, dusk * 0.5);
  hemi.intensity = 0.55 + day * 1.25;
  G.daylight = day;
  const bl = 0.3 + day * 0.7;
  for (const b of bbMesh) b.material.color.setScalar(bl);
  sunBall.position.set(camPos.x + ch * 700, camPos.y + sh * 700, camPos.z + 260);
  moonBall.position.set(camPos.x - ch * 700, camPos.y - sh * 700, camPos.z - 200);
  for (const f of flames) { const k = 0.8 + Math.sin(G.time * 9 + f.position.x) * 0.25; f.scale.set(k, k * 1.3, k); }
}

export function initWorld(sc) {
  scene = sc; G.poi = {};
  scene.background = new THREE.Color(0x86bdf0);
  scene.fog = new THREE.Fog(0x86bdf0, 110, 520);
  hemi = new THREE.HemisphereLight(0xcfe4ff, 0x4a4030, 1.6); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2dd, 2.4); scene.add(sun);
  sunBall = new THREE.Mesh(new THREE.SphereGeometry(22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false })); scene.add(sunBall);
  moonBall = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xc8d4ee, fog: false })); scene.add(moonBall);
  initRoads();
  buildTerrain();
  const B = new Batch();
  buildTown(B); B.build();
  buildPalace(B); B.build();
  buildElfVillage(B); B.build();
  buildFort(B); B.build();
  buildMisc(B); B.build();
  const fm = new THREE.MeshBasicMaterial({ color: 0xc060ff });
  for (const b of G.poi.braziers) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 6), fm); f.position.set(b.x, b.y, b.z); scene.add(f); flames.push(f); }
  genTrees();
  initTreeMeshes();
}
