// Поселения четырёх земель: деревня людей, Златоверхий дворец, Луннолесье, Чёрный Шпиль.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from '../core/state.js';
import { Rand } from '../core/rng.js';
import { addCollider } from './collision.js';
import { addFire, makeContainer, placeRewardCache } from './props.js';
import { heightAt } from './terrain.js';

export const SPAWNS = [];
export const SHOPS = [];
export const BEDS = [];
export const LANDMARKS = {};
export const PLATFORM_LIST = [];

// ------------------------- «художник»: копим геометрию и склеиваем -------------------------
let bag = [];
let collideBag = [];
const tmpColor = new THREE.Color();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

function paint(geo, color) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  tmpColor.set(color);
  for (let i = 0; i < n; i++) { arr[i * 3] = tmpColor.r; arr[i * 3 + 1] = tmpColor.g; arr[i * 3 + 2] = tmpColor.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return geo;
}
function place(geo, x, y, z, ry = 0, rz = 0, rx = 0) {
  _e.set(rx, ry, rz);
  _m.makeRotationFromEuler(_e);
  _m.setPosition(x, y, z);
  geo.applyMatrix4(_m);
  bag.push(geo);
}
function collide(x, z, w, d, y0, y1, ry = 0, opts = {}) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
  collideBag.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y0, y1, tag: opts.tag || 'wall' });
}
function box(w, h, d, color, x, baseY, z, ry = 0, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  paint(g, color);
  place(g, x, baseY + h / 2, z, ry);
  if (opts.collide !== false) collide(x, z, w, d, baseY, baseY + h, ry, opts);
  return g;
}
function cyl(rt, rb, h, seg, color, x, baseY, z, opts = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  paint(g, color);
  place(g, x, baseY + h / 2, z, opts.ry || 0);
  if (opts.collide) collide(x, z, rt * 2, rt * 2, baseY, baseY + h, 0, opts);
  return g;
}
function cone(r, h, seg, color, x, baseY, z, ry = 0) {
  const g = new THREE.ConeGeometry(r, h, seg);
  paint(g, color);
  place(g, x, baseY + h / 2, z, ry);
  return g;
}
function sphere(r, color, x, y, z, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));
  paint(g, color);
  place(g, x, y, z);
  return g;
}
function platform(x, z, w, d, y) {
  PLATFORM_LIST.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y });
}
function flush(group, name) {
  if (bag.length) {
    const merged = mergeGeometries(bag, false);
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = name;
    group.add(mesh);
  }
  bag = [];
  for (const c of collideBag) addCollider(c);
  collideBag = [];
}

// ------------------------- типовые элементы -------------------------
function house(o) {
  const w = o.w || 7, d = o.d || 6, h = o.h || 3.4, ry = o.ry || 0;
  const color = o.color || 0x6b4f30, roofColor = o.roofColor || 0x4a3520;
  const y = o.y !== undefined ? o.y : heightAt(o.x, o.z);
  box(w, h, d, color, o.x, y, o.z, ry, { tag: 'house' });
  if ((o.roof || 'gable') === 'gable') {
    const halfD = d / 2;
    const slopeLen = Math.hypot(halfD, 1.7);
    for (const sgn of [-1, 1]) {
      const g = new THREE.BoxGeometry(w + 0.9, 0.26, slopeLen * 1.15);
      paint(g, roofColor);
      const ang = Math.atan2(1.7, halfD) * -sgn;
      const shift = (halfD / 2) * sgn;
      place(g, o.x - Math.sin(ry) * shift, y + h + 0.86, o.z + Math.cos(ry) * shift, ry, ang);
    }
    const tri = new THREE.ConeGeometry(w * 0.72, 1.7, 4);
    paint(tri, color);
    place(tri, o.x, y + h + 0.85, o.z, ry + Math.PI / 4);
    bag[bag.length - 1].scale(1, 1, (d / w) * 0.62);
  } else {
    cone(Math.max(w, d) * 0.76, 2.2, 4, roofColor, o.x, y + h, o.z, ry + Math.PI / 4);
  }
  const dg = new THREE.BoxGeometry(1.05, 2.1, 0.22);
  paint(dg, 0x33241a);
  place(dg, o.x, y + 1.05, o.z + d / 2 + 0.06, ry);
  const win = o.windows === undefined ? 2 : o.windows;
  for (let i = 0; i < win; i++) {
    const off = (i - (win - 1) / 2) * 2.2;
    const wg = new THREE.BoxGeometry(0.75, 0.8, 0.16);
    paint(wg, 0xcaa85a);
    place(wg, o.x + Math.cos(ry) * off, y + 1.9, o.z + d / 2 + 0.09, ry);
  }
  if (o.chimney !== false) {
    const cg = new THREE.BoxGeometry(0.7, 2.6, 0.7);
    paint(cg, 0x807870);
    place(cg, o.x + w / 2 - 0.8, y + h + 1.6, o.z - d / 4, ry);
    const sg = new THREE.BoxGeometry(0.85, 0.3, 0.85);
    paint(sg, 0x6a625a);
    place(sg, o.x + w / 2 - 0.8, y + h + 2.9, o.z - d / 4, ry);
  }
  return { x: o.x, y, z: o.z, w, d, h };
}

function fenceLine(x0, z0, x1, z1, color = 0x51402a) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2.4));
  const ry = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = heightAt(x, z);
    const p = new THREE.BoxGeometry(0.18, 1.4, 0.18);
    paint(p, color); place(p, x, y + 0.7, z);
    if (i < n) {
      const rail = new THREE.BoxGeometry(0.14, 0.14, len / n);
      paint(rail, color); place(rail, x, y + 1.0, z, ry);
    }
  }
}
function stall(x, z, ry, awning) {
  const y = heightAt(x, z);
  box(3.2, 0.2, 1.6, 0x6b5230, x, y + 0.95, z, ry, { collide: false });
  for (const [ox, oz] of [[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]]) {
    const px = x + Math.cos(ry) * ox - Math.sin(ry) * oz;
    const pz = z + Math.sin(ry) * ox + Math.cos(ry) * oz;
    cyl(0.09, 0.09, 1.05, 5, 0x51402a, px, y, pz);
  }
  const aw = new THREE.BoxGeometry(3.6, 0.12, 2.1);
  paint(aw, awning);
  place(aw, x, y + 2.4, z, ry, 0.13);
  box(3.4, 1.9, 0.3, 0x5c4529, x, y, z - 0.8, ry, { collide: true });
}
function well(x, z) {
  const y = heightAt(x, z);
  cyl(1.1, 1.25, 1.2, 10, 0x77706a, x, y, z, { collide: true });
  for (const s of [-1, 1]) cyl(0.12, 0.12, 2.4, 5, 0x51402a, x + s * 0.9, y, z);
  box(2.4, 0.2, 0.4, 0x51402a, x, y + 2.4, z);
}
function banner(x, y, z, color, h = 4.2, ry = 0) {
  cyl(0.09, 0.11, h, 6, 0x4a3a26, x, y, z);
  const cloth = new THREE.BoxGeometry(1.2, 2.0, 0.06);
  paint(cloth, color);
  place(cloth, x + Math.cos(ry) * 0.66, y + h - 1.4, z - Math.sin(ry) * 0.66, ry);
}
function campTent(x, z, ry, color) {
  const y = heightAt(x, z);
  const g = new THREE.ConeGeometry(2.2, 2.4, 5);
  paint(g, color);
  place(g, x, y + 1.2, z, ry);
  box(0.16, 0.9, 0.16, 0x4a3a26, x, y, z + 2.0, ry);
}
function shopRole(kind) {
  return {
    smith: 'blacksmith', trader: 'trader', healer: 'healer', prosthetic: 'artificer', tavern: 'innkeeper',
    bank: 'banker', trainer: 'veteran', fletcher: 'fletcher', herbalist: 'herbalist', slaver: 'slaver',
    quartermaster: 'quartermaster',
  }[kind] || 'trader';
}

// ------------------------- деревня людей -------------------------
function buildVillage() {
  const houses = [
    [-700, 700, 0.3], [-660, 560, 1.2], [-560, 700, 0.7], [-520, 600, 2.2],
    [-720, 620, 1.7], [-600, 780, 0.2], [-500, 730, 0.9],
  ];
  houses.forEach((h, i) => house({
    x: h[0], z: h[1], ry: h[2], w: 6 + (i % 3), d: 5.5 + (i % 2), h: 3.2,
    color: [0x6b4f30, 0x5d4529, 0x74563a][i % 3], roof: i % 2 ? 'gable' : 'hip', windows: 1 + (i % 3),
  }));
  house({ x: -560, z: 560, w: 11, d: 8, h: 4.2, ry: 0.2, color: 0x6f5233, roof: 'gable', windows: 3 });
  box(3.4, 0.8, 0.3, 0x3a2a18, -560, heightAt(-560, 560) + 4.6, -555, 0.2);
  stall(-600, 640, 0.1, 0x8a3a3a);
  stall(-585, 660, 0.4, 0x3a6a8a);
  stall(-615, 655, -0.2, 0x6a8a3a);
  well(-640, 645);
  fenceLine(-740, 660, -740, 560);
  fenceLine(-740, 560, -660, 560);
  fenceLine(-520, 760, -470, 700);
  for (const [x, z] of [[-480, 660], [-690, 780], [-760, 700]]) {
    const y = heightAt(x, z);
    cone(1.6, 2.2, 8, 0xb39a58, x, y, z);
    cyl(0.5, 0.5, 0.6, 6, 0xa08a4a, x, y + 2.2, z);
  }
  const cx = -600, cz = 700, cy = heightAt(cx, cz);
  box(3.6, 0.5, 1.8, 0x6b5230, cx, cy + 1.0, cz, 0.4);
  for (const [ox, oz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) {
    const wx = cx + Math.cos(0.4) * ox - Math.sin(0.4) * oz;
    const wz = cz + Math.sin(0.4) * ox + Math.cos(0.4) * oz;
    const wheel = new THREE.CylinderGeometry(0.7, 0.7, 0.16, 10);
    paint(wheel, 0x4a3520);
    place(wheel, wx, cy + 0.7, wz, 0.4, 0, Math.PI / 2);
  }
  const mx = -830, mz = 470, my = heightAt(mx, mz);
  cyl(2.6, 3.0, 7, 10, 0x8a7a5c, mx, my, mz, { collide: true });
  cone(3.4, 3.0, 10, 0x5a4326, mx, my + 7, mz);
  LANDMARKS.millBlades = { x: mx, y: my + 8.4, z: mz };
  LANDMARKS.villageSquare = { x: -640, z: 645 };

  for (const s of [
    { id: 'blacksmith_v', name: 'Кузница «Наковальня»', kind: 'smith', x: -690, z: 590 },
    { id: 'trader_v', name: 'Лавка Горазда', kind: 'trader', x: -600, z: 640 },
    { id: 'healer_v', name: 'Дом лекаря Весты', kind: 'healer', x: -520, z: 690 },
    { id: 'prosth_v', name: 'Костоправ Живаго', kind: 'prosthetic', x: -700, z: 740 },
    { id: 'tavern_v', name: 'Кабак «Пьяный вепрь»', kind: 'tavern', x: -556, z: 566 },
    { id: 'bank_v', name: 'Меняла Тихон', kind: 'bank', x: -660, z: 620 },
    { id: 'trainer_v', name: 'Ветеран Радим', kind: 'trainer', x: -740, z: 660 },
  ]) SHOPS.push({ ...s, zone: 1, faction: 'people', npcRole: shopRole(s.kind) });
  BEDS.push({ x: -560, z: 566, name: 'Комната в кабаке', price: 8 });
  SPAWNS.push(
    { faction: 'people', role: 'villager', x: -640, z: 660, r: 70, n: 6 },
    { faction: 'people', role: 'merchant', x: -600, z: 640, r: 30, n: 2 },
    { faction: 'people', role: 'militia', x: -640, z: 700, r: 50, n: 3 },
    { faction: 'people', role: 'child', x: -650, z: 620, r: 60, n: 3 },
  );
  makeContainer(-700, 592, 'barrel'); makeContainer(-694, 596, 'crate');
  makeContainer(-601, 636, 'chest');
  makeContainer(-560, 566, 'sack'); makeContainer(-556, 570, 'basket');
  makeContainer(-521, 687, 'barrel');
}

// ------------------------- дворец Императора -------------------------
function buildPalace() {
  const cx = 620, cz = 640;
  const stone = 0x9a938a, stoneDark = 0x7d766d, gold = 0xd4af37, bannerColor = 0x7a1f2a;
  const wallH = 8, wallT = 3.2, halfW = 105, halfD = 92;
  const sides = [
    { x: cx, z: cz - halfD, w: halfW * 2, d: wallT },
    { x: cx, z: cz + halfD, w: halfW * 2, d: wallT },
    { x: cx - halfW, z: cz, w: wallT, d: halfD * 2 },
    { x: cx + halfW, z: cz, w: wallT, d: halfD * 2 },
  ];
  for (const s of sides) {
    const y = heightAt(s.x, s.z);
    box(s.w, wallH, s.d, stone, s.x, y, s.z, 0);
    const horizontal = s.w > s.d;
    const n = Math.floor((horizontal ? s.w : s.d) / 4.2);
    for (let i = 0; i <= n; i++) {
      const t = i / n - 0.5;
      const px = horizontal ? s.x + t * s.w : s.x;
      const pz = horizontal ? s.z : s.z + t * s.d;
      box(horizontal ? 1.6 : wallT + 0.5, 1.3, horizontal ? s.d + 0.5 : 1.6, stoneDark, px, y + wallH, pz, 0, { collide: false });
    }
  }
  const gy = heightAt(cx, cz + halfD);
  box(24, 11, wallT + 1.4, stoneDark, cx, gy, cz + halfD, 0, { collide: false });
  box(7, 8.4, wallT + 1.6, 0x4a3520, cx, gy, cz + halfD + 0.4, 0, { tag: 'gate' });
  LANDMARKS.gate = { x: cx, z: cz + halfD, y: gy };
  for (const s of [-1, 1]) {
    const tx = cx + s * 16;
    cyl(4.4, 5, 20, 8, stone, tx, gy, cz + halfD, { collide: true });
    cone(5.4, 5.5, 8, 0x5c2028, tx, gy + 20, cz + halfD);
    banner(tx + s * 0.6, gy + 12, cz + halfD + 4, bannerColor, 5, s * 0.2);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = cx + sx * halfW, tz = cz + sz * halfD, ty = heightAt(tx, tz);
    cyl(5.2, 6, 24, 8, stone, tx, ty, tz, { collide: true });
    cone(6.4, 6, 8, 0x5c2028, tx, ty + 24, tz);
    banner(tx, ty + 15, tz + 5.6, bannerColor, 5.5);
  }
  const ky = heightAt(cx, cz - 10);
  box(64, 3, 48, stoneDark, cx, ky, cz - 10, 0, { collide: false });
  box(56, 17, 38, 0xb9b1a4, cx, ky + 3, cz - 10, 0);
  for (let i = -3; i <= 3; i++) cyl(0.9, 1.0, 12, 8, 0xcfc7b8, cx + i * 8, ky + 3, cz + 9);
  box(60, 1.6, 42, stoneDark, cx, ky + 20, cz - 10, 0, { collide: false });
  const dome = new THREE.SphereGeometry(13, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  paint(dome, gold); place(dome, cx, ky + 21, cz - 10);
  cone(3.2, 6, 8, gold, cx, ky + 33, cz - 10);
  sphere(1.1, 0xffe9a8, cx, ky + 39.5, cz - 10, 8);
  for (const s of [-1, 1]) {
    const d2 = new THREE.SphereGeometry(5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    paint(d2, gold); place(d2, cx + s * 30, ky + 21, cz - 10);
  }
  const doorY = ky + 3;
  box(12, 8, 1.2, 0x4a3520, cx, doorY, cz + 9, 0, { tag: 'keepdoor' });
  for (let i = 0; i < 6; i++) {
    box(16, 0.55, 1.5, stoneDark, cx, ky + i * 0.55, cz + 10.2 + i * 1.5, 0, { collide: false });
    platform(cx, cz + 10.2 + i * 1.5, 16, 1.5, ky + (i + 1) * 0.55);
  }
  box(48, 0.4, 32, 0xa9a196, cx, doorY - 0.4, cz - 10, 0, { collide: false });
  platform(cx, cz - 10, 52, 34, doorY);
  LANDMARKS.keepFloor = { x: cx, z: cz - 10, y: doorY, w: 52, d: 34 };
  LANDMARKS.throne = { x: cx, z: cz - 24, y: doorY };
  box(3.4, 1.1, 3.2, gold, cx, doorY, cz - 24, 0, { collide: false });
  box(3.4, 3.6, 0.6, gold, cx, doorY + 1.1, cz - 25.6, 0, { collide: false });
  for (const s of [-1, 1]) cyl(0.6, 0.7, 6, 8, 0xcfc7b8, cx + s * 12, doorY, cz - 22);

  house({ x: cx - 60, z: cz + 40, w: 16, d: 9, h: 4, ry: 0.1, color: 0x8a8378, roof: 'gable', windows: 4 });
  house({ x: cx + 56, z: cz + 44, w: 14, d: 8, h: 3.8, ry: -0.1, color: 0x8a8378, roof: 'gable', windows: 3 });
  house({ x: cx - 58, z: cz - 56, w: 12, d: 8, h: 3.6, ry: 0.2, color: 0x8d8579, roof: 'hip', windows: 2 });
  house({ x: cx + 58, z: cz - 52, w: 12, d: 8, h: 3.6, ry: -0.2, color: 0x8d8579, roof: 'hip', windows: 2 });
  well(cx - 20, cz + 30);
  for (const [dx, dz] of [[-10, 20], [0, 24], [10, 20]]) {
    const px = cx + dx, pz = cz + dz, py = heightAt(px, pz);
    cyl(0.16, 0.16, 2.2, 6, 0x4a3520, px, py, pz);
    box(1.5, 0.5, 0.5, 0x8a7a4a, px, py + 1.2, pz, 0, { collide: false });
  }
  stall(cx + 20, cz + 55, 0.3, 0x8a3a3a);
  stall(cx + 34, cz + 60, 0.5, 0x3a6a8a);
  const hy = heightAt(cx - 45, cz + 65);
  cyl(0.2, 0.2, 5, 6, 0x4a3520, cx - 45, hy, cz + 65);
  box(4, 0.25, 0.25, 0x4a3520, cx - 43, hy + 4.6, cz + 65, 0, { collide: false });
  cyl(0.05, 0.05, 1.6, 4, 0xb9a97a, cx - 41.6, hy + 2.2, cz + 65);
  banner(cx - 60, heightAt(cx - 60, cz + halfD), cz + halfD + 2.4, bannerColor, 6);
  banner(cx + 60, heightAt(cx + 60, cz + halfD), cz + halfD + 2.4, bannerColor, 6);
  banner(cx, heightAt(cx, cz - halfD), cz - halfD - 2.4, bannerColor, 6);

  for (const s of [
    { id: 'smith_p', name: 'Оружейная мастерская', kind: 'smith', x: cx - 60, z: cz + 44 },
    { id: 'trader_p', name: 'Дворцовый снабженец', kind: 'trader', x: cx + 20, z: cz + 55 },
    { id: 'healer_p', name: 'Лекарь Асклеп', kind: 'healer', x: cx - 58, z: cz - 52 },
    { id: 'prosth_p', name: 'Костоправ-механик Грим', kind: 'prosthetic', x: cx + 58, z: cz - 48 },
    { id: 'bank_p', name: 'Имперская казна', kind: 'bank', x: cx + 34, z: cz + 60 },
    { id: 'trainer_p', name: 'Оружейный наставник', kind: 'trainer', x: cx - 10, z: cz + 22 },
    { id: 'quartermaster', name: 'Каптенармус', kind: 'quartermaster', x: cx - 30, z: cz + 62 },
  ]) SHOPS.push({ ...s, zone: 2, faction: 'empire', npcRole: shopRole(s.kind) });
  BEDS.push({ x: cx - 60, z: cz + 36, name: 'Койка в казарме', price: 5 });
  SPAWNS.push(
    { faction: 'empire', role: 'guard', x: cx, z: cz + halfD - 14, r: 26, n: 4 },
    { faction: 'empire', role: 'guard', x: cx, z: cz - 40, r: 60, n: 6 },
    { faction: 'empire', role: 'archer', x: cx, z: cz, r: 90, n: 4 },
    { faction: 'empire', role: 'captain', x: cx - 44, z: cz + 58, r: 10, n: 1 },
    { faction: 'empire', role: 'servant', x: cx, z: cz - 10, r: 50, n: 4 },
    { faction: 'neutral', role: 'merchant', x: cx + 20, z: cz + 55, r: 20, n: 2 },
  );
  makeContainer(cx - 62, cz + 46, 'crate'); makeContainer(cx - 57, cz + 46, 'barrel');
  makeContainer(cx + 22, cz + 58, 'chest'); makeContainer(cx + 60, cz - 46, 'chest', { rich: true });
  makeContainer(cx - 20, cz - 30, 'barrel');
  placeRewardCache(cx - 46, cz + 67, 60, ['potion_heal']);
  LANDMARKS.palaceCenter = { x: cx, z: cz };
}

// ------------------------- Луннолесье -------------------------
function buildElfVillage() {
  const cx = -620, cz = -600;
  const wood = 0x6a4f2f, woodDark = 0x4a3722, leaf = 0x2f5230;
  const rnd = new Rand(G.seed ^ 0xe1f);
  const gy = heightAt(cx, cz);
  cyl(3.2, 4.6, 26, 12, 0x54402a, cx, gy, cz, { collide: true });
  for (let i = 0; i < 5; i++) {
    sphere(6 - i * 0.6, leaf, cx + rnd.range(-2.5, 2.5), gy + 20 + i * 2.2, cz + rnd.range(-2.5, 2.5), 9);
  }
  LANDMARKS.grandTree = { x: cx, y: gy, z: cz };
  box(16, 0.5, 16, woodDark, cx, gy + 3.4, cz, 0, { collide: false });
  platform(cx, cz, 16, 16, gy + 3.9);
  for (const [ox, oz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) cyl(0.3, 0.3, 3.4, 6, wood, cx + ox, gy, cz + oz);
  for (let i = 0; i < 7; i++) {
    const px = cx + 7, pz = cz + 8 + i * 0.9;
    box(1.6, 0.5, 1.0, woodDark, px, gy + i * 0.55, pz, 0, { collide: false });
    platform(px, pz, 1.6, 1.0, gy + (i + 1) * 0.55);
  }
  const huts = [
    [-680, -640, 6.5], [-570, -560, 7.2], [-660, -520, 5.8], [-560, -660, 6.9],
    [-700, -560, 4.6], [-540, -600, 5.2],
  ];
  huts.forEach((h, i) => {
    const x = h[0], z = h[1], platY = heightAt(x, z) + h[2];
    for (const [ox, oz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) {
      cyl(0.28, 0.34, h[2], 6, woodDark, x + ox, heightAt(x + ox, z + oz), z + oz);
    }
    box(9.4, 0.45, 9.4, wood, x, platY - 0.45, z, 0, { collide: false });
    platform(x, z, 9.4, 9.4, platY);
    box(6.2, 3.0, 5.0, i % 2 ? 0x7a5c38 : 0x6a4f2f, x, platY, z, 0.2);
    cone(4.8, 2.0, 4, leaf, x, platY + 3.0, z, 0.99);
    box(1.0, 1.9, 0.2, 0x33241a, x + 1.4, platY, z + 2.5, 0.2);
    for (const [ox, oz] of [[-4.6, 0], [4.6, 0], [0, -4.6], [0, 4.6]]) {
      box(oz === 0 ? 0.2 : 9.4, 0.9, oz === 0 ? 9.4 : 0.2, woodDark, x + ox, platY, z + oz, 0, { collide: false });
    }
    const steps = Math.floor(h[2] / 0.55);
    for (let k = 0; k < steps; k++) {
      const sx = x + 4.2, sz = z + 4.4;
      box(1.3, 0.14, 0.4, woodDark, sx, heightAt(sx, sz) + k * 0.55, sz, 0, { collide: false });
      platform(sx, sz, 1.3, 0.4, heightAt(sx, sz) + (k + 1) * 0.55);
    }
  });
  const links = [[0, 1], [1, 3], [0, 2], [2, 4], [3, 5]];
  for (const [a, b] of links) {
    const A = huts[a], B = huts[b];
    const ax = A[0], az = A[1], bx = B[0], bz = B[1];
    const len = Math.hypot(bx - ax, bz - az);
    const y = Math.min(heightAt(ax, az) + A[2], heightAt(bx, bz) + B[2]);
    const ry = Math.atan2(bx - ax, bz - az);
    const n = Math.ceil(len / 2);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const seg = len / n;
      box(1.4, 0.16, seg * 0.96, woodDark, px, y - 0.08, pz, ry, { collide: false });
      platform(px, pz, 1.4, seg, y);
    }
    for (const s of [-1, 1]) {
      const ox = Math.cos(ry) * 0.75 * s, oz = -Math.sin(ry) * 0.75 * s;
      box(0.08, 0.08, len, 0xb9a97a, (ax + bx) / 2 + ox, y + 1.1, (az + bz) / 2 + oz, ry, { collide: false });
    }
  }
  house({ x: cx + 55, z: cz - 30, w: 10, d: 7, h: 3.4, ry: 0.4, color: 0x6a4f2f, roof: 'hip', windows: 2 });
  house({ x: cx + 30, z: cz + 55, w: 8, d: 6, h: 3, ry: -0.3, color: 0x74573a, roof: 'gable', windows: 2 });
  house({ x: cx - 40, z: cz + 40, w: 7, d: 6, h: 3, ry: 0.9, color: 0x6f5433, roof: 'hip', windows: 1 });
  for (let i = 0; i < 3; i++) {
    const tx = cx + 70 + i * 6, tz = cz + 20, ty = heightAt(tx, tz);
    cyl(0.2, 0.2, 2.4, 6, 0x4a3722, tx, ty, tz);
    const ring = new THREE.TorusGeometry(0.9, 0.09, 5, 12);
    paint(ring, 0xd8c48a);
    place(ring, tx, ty + 1.8, tz);
  }
  addFire(cx + 6, heightAt(cx + 6, cz + 6), cz + 6, { scale: 1.2 });
  LANDMARKS.elfSquare = { x: cx, z: cz };

  for (const s of [
    { id: 'fletcher_e', name: 'Лучный мастер Фаэлон', kind: 'fletcher', x: cx + 30, z: cz + 55 },
    { id: 'herbalist_e', name: 'Травница Ниэль', kind: 'herbalist', x: cx - 40, z: cz + 40 },
    { id: 'healer_e', name: 'Целительница Ллиэн', kind: 'healer', x: cx - 44, z: cz + 34 },
    { id: 'trader_e', name: 'Меновой двор Луннолесья', kind: 'trader', x: cx + 55, z: cz - 30 },
    { id: 'prosth_e', name: 'Древень-костоправ', kind: 'prosthetic', x: cx + 20, z: cz - 44 },
  ]) SHOPS.push({ ...s, zone: 3, faction: 'elves', npcRole: shopRole(s.kind) });
  BEDS.push({ x: cx + 56, z: cz - 26, name: 'Постель из мха', price: 4 });
  SPAWNS.push(
    { faction: 'elves', role: 'elf', x: cx, z: cz, r: 80, n: 7 },
    { faction: 'elves', role: 'elf_archer', x: cx + 40, z: cz + 20, r: 60, n: 4 },
    { faction: 'elves', role: 'elder', x: cx + 55, z: cz - 30, r: 8, n: 1 },
    { faction: 'elves', role: 'elf_child', x: cx - 20, z: cz + 20, r: 50, n: 2 },
    { faction: 'elves', role: 'partisan', x: cx - 30, z: cz - 70, r: 40, n: 3 },
  );
  makeContainer(cx + 32, cz + 58, 'basket'); makeContainer(cx + 28, cz + 52, 'sack');
  makeContainer(cx - 38, cz + 42, 'basket'); makeContainer(cx + 57, cz - 28, 'chest', { rich: true });
  makeContainer(cx + 6, cz - 60, 'barrel');
}

// ------------------------- Чёрный Шпиль (злодей) -------------------------
function buildFort() {
  const cx = 660, cz = -620;
  const rock = 0x5f5a55, rockDark = 0x474340, blood = 0x6a1f26;
  const baseY = heightAt(cx, cz);
  box(240, 10, 210, rockDark, cx, baseY - 10, cz, 0, { collide: false });
  const segs = [
    { x: cx - 70, z: cz - 70, w: 90, d: 5, gap: 0.25 },
    { x: cx + 60, z: cz - 70, w: 70, d: 5, gap: 0.4 },
    { x: cx - 85, z: cz, w: 5, d: 120, gap: 0.3 },
    { x: cx + 85, z: cz + 10, w: 5, d: 100, gap: 0.2 },
    { x: cx - 20, z: cz + 75, w: 100, d: 5, gap: 0.55 },
    { x: cx + 55, z: cz + 75, w: 50, d: 5, gap: 0.1 },
  ];
  for (const s of segs) {
    const y = heightAt(s.x, s.z);
    const horizontal = s.w > s.d;
    const len = horizontal ? s.w : s.d;
    const parts = 4;
    for (let i = 0; i < parts; i++) {
      if (i / parts < s.gap) continue;
      const t = (i + 0.5) / parts - 0.5;
      const px = horizontal ? s.x + t * s.w : s.x;
      const pz = horizontal ? s.z : s.z + t * s.d;
      const hh = 7.5 + (i % 2) * 2.5;
      box(horizontal ? len / parts : 5, hh, horizontal ? 5 : len / parts, rock, px, y, pz, 0);
      box(horizontal ? len / parts + 0.7 : 5.7, 1.0, horizontal ? 5.7 : len / parts + 0.7, rockDark, px, y + hh, pz, 0, { collide: false });
    }
  }
  // цитадель
  const ky = heightAt(cx, cz - 20);
  box(40, 20, 30, 0x54504b, cx, ky, cz - 20, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = cx + sx * 20, tz = cz - 20 + sz * 15, ty = heightAt(tx, tz);
    cyl(4, 4.6, 26, 8, 0x4c4844, tx, ty, tz, { collide: true });
    cone(5, 5, 8, blood, tx, ty + 26, tz);
    banner(tx, ty + 16, tz + 4.6, blood, 5.5);
  }
  box(10, 8, 1.4, 0x2a2724, cx, ky, cz - 5, 0, { tag: 'keepdoor' });
  for (let i = 0; i < 5; i++) {
    box(13, 0.5, 1.6, 0x3c3936, cx, ky + i * 0.5, cz - 3.4 + i * 1.3, 0, { collide: false });
    platform(cx, cz - 3.4 + i * 1.3, 13, 1.6, ky + (i + 1) * 0.5);
  }
  box(34, 0.4, 24, 0x413e3a, cx, ky - 0.4, cz - 20, 0, { collide: false });
  platform(cx, cz - 20, 36, 26, ky);
  LANDMARKS.fortThrone = { x: cx, z: cz - 28, y: ky };
  box(3.2, 1.2, 3, 0x8a8a86, cx, ky, cz - 28, 0, { collide: false });
  box(3.2, 3.4, 0.6, 0x6a6a66, cx, ky + 1.2, cz - 29.4, 0, { collide: false });
  LANDMARKS.fortKeep = { x: cx, z: cz - 20, y: ky };
  // кузня с горном
  const fx = cx + 40, fz = cz + 20, fy = heightAt(fx, fz);
  box(12, 5, 9, 0x4a4540, fx, fy, fz, 0.2, { tag: 'forge' });
  cone(6, 2.6, 4, 0x33302c, fx, fy + 5, fz, 0.99);
  addFire(fx + 3, fy + 1.0, fz + 2, { scale: 1.4 });
  // клетки с пленными и помост работорговца
  for (let i = 0; i < 3; i++) {
    const bx2 = cx - 30 - i * 7, bz2 = cz + 40, by2 = heightAt(bx2, bz2);
    box(4, 2.4, 4, 0x3a352f, bx2, by2, bz2, 0.1, { tag: 'cage' });
    for (let k = 0; k < 5; k++) {
      cyl(0.08, 0.08, 2.5, 4, 0x6a645c, bx2 - 1.8 + k * 0.9, by2, bz2 + 2.0);
    }
  }
  const px2 = cx - 55, pz2 = cz + 55, py2 = heightAt(px2, pz2);
  box(14, 1.2, 10, 0x4a4540, px2, py2, pz2, 0.1, { tag: 'platform' });
  for (const [ox, oz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) cyl(0.25, 0.25, 1.2, 5, 0x3a352f, px2 + ox, py2, pz2 + oz);
  // баллиста
  const bx3 = cx + 55, bz3 = cz - 50, by3 = heightAt(bx3, bz3);
  box(5, 0.6, 3, 0x4a3a26, bx3, by3 + 1.2, bz3, 0.3);
  for (const s of [-1, 1]) cyl(0.14, 0.14, 3.4, 5, 0x3a2a18, bx3 + s * 1.6, by3 + 1.8, bz3, { ry: 0.3 });
  for (const [x, z] of [[cx - 20, cz + 60], [cx + 25, cz + 62], [cx - 70, cz - 10]]) {
    const y = heightAt(x, z);
    banner(x, y, z, blood, 6.5);
    banner(x + 6, y, z + 2, 0x2a2a3a, 5);
  }
  LANDMARKS.fortCenter = { x: cx, z: cz };

  for (const s of [
    { id: 'smith_f', name: 'Кузня Гарма', kind: 'smith', x: cx + 40, z: cz + 24 },
    { id: 'trader_f', name: 'Маркитант Скрипа', kind: 'trader', x: cx - 10, z: cz + 50 },
    { id: 'healer_f', name: 'Лекарь-живодёр Кромм', kind: 'healer', x: cx - 40, z: cz + 30 },
    { id: 'prosth_f', name: 'Костоправ-кузнец Морд', kind: 'prosthetic', x: cx + 30, z: cz - 40 },
    { id: 'trainer_f', name: 'Оружейник-наставник Вур', kind: 'trainer', x: cx - 25, z: cz - 45 },
    { id: 'slaver', name: 'Работорговец Гзул', kind: 'slaver', x: cx - 55, z: cz + 60 },
  ]) SHOPS.push({ ...s, zone: 4, faction: 'villain', npcRole: shopRole(s.kind) });
  BEDS.push({ x: cx + 44, z: cz + 26, name: 'Лежак в кузне', price: 6 });
  SPAWNS.push(
    { faction: 'villain', role: 'legion', x: cx, z: cz + 30, r: 70, n: 8 },
    { faction: 'villain', role: 'brute', x: cx + 20, z: cz + 50, r: 40, n: 3 },
    { faction: 'villain', role: 'dark_archer', x: cx, z: cz - 40, r: 50, n: 4 },
    { faction: 'villain', role: 'spy', x: cx - 30, z: cz + 10, r: 60, n: 2 },
    { faction: 'villain', role: 'taskmaster', x: cx - 40, z: cz + 45, r: 20, n: 2 },
    { faction: 'villain', role: 'dregar', x: cx, z: cz - 24, r: 6, n: 1 },
  );
  makeContainer(cx + 44, cz + 22, 'crate'); makeContainer(cx + 38, cz + 18, 'barrel');
  makeContainer(cx - 12, cz + 52, 'chest', { rich: true });
  makeContainer(cx + 32, cz - 44, 'chest');
  makeContainer(cx - 58, cz + 62, 'sack');
  placeRewardCache(cx, cz + 66, 120, ['potion_heal', 'dark_crystal']);
  LANDMARKS.fort = { x: cx, z: cz };
}

// ------------------------- мелочи по карте -------------------------
function buildCamps() {
  const rnd = new Rand(G.seed ^ 0x5a5a);
  const bandit = { x: -300, z: 880 };
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    campTent(bandit.x + Math.cos(a) * 14, bandit.z + Math.sin(a) * 14, a, 0x5c4a32);
  }
  fenceLine(bandit.x - 22, bandit.z - 22, bandit.x + 22, bandit.z - 22, 0x4a3a26);
  addFire(bandit.x, heightAt(bandit.x, bandit.z), bandit.z, { scale: 1.3 });
  makeContainer(bandit.x + 4, bandit.z + 4, 'crate');
  makeContainer(bandit.x - 4, bandit.z + 3, 'barrel');
  SPAWNS.push({ faction: 'bandits', role: 'bandit', x: bandit.x, z: bandit.z, r: 30, n: 5 });

  const elfCamp = { x: -280, z: -420 };
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    campTent(elfCamp.x + Math.cos(a) * 12, elfCamp.z + Math.sin(a) * 12, a, 0x3f5a38);
  }
  // сторожевой помост
  const wx = elfCamp.x + 16, wz = elfCamp.z - 10, wy = heightAt(wx, wz);
  for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) cyl(0.18, 0.18, 5, 5, 0x4a3722, wx + ox, wy, wz + oz);
  box(4, 0.3, 4, 0x5a4326, wx, wy + 5, wz, 0.3, { collide: false });
  platform(wx, wz, 4, 4, wy + 5.3);
  for (let i = 0; i < 10; i++) {
    box(1.0, 0.14, 1.0, 0x5a4326, wx + 2.6, wy + i * 0.52, wz + i * 0.4, 0.3, { collide: false });
    platform(wx + 2.6, wz + i * 0.4, 1.0, 1.0, wy + (i + 1) * 0.52);
  }
  addFire(elfCamp.x - 3, heightAt(elfCamp.x - 3, elfCamp.z), elfCamp.z, { scale: 1.0 });
  SPAWNS.push({ faction: 'elves', role: 'partisan', x: elfCamp.x, z: elfCamp.z, r: 26, n: 4 });

  // развалины
  const ru = { x: 250, z: 850 };
  for (let i = 0; i < 9; i++) {
    const a = rnd.float() * 6.28, r = 8 + rnd.float() * 26;
    const x = ru.x + Math.cos(a) * r, z = ru.z + Math.sin(a) * r;
    const y = heightAt(x, z);
    const h = 2 + rnd.float() * 5;
    cyl(0.8, 0.95, h, 8, 0x8d8878, x, y, z, { collide: true });
  }
  fenceLine(ru.x - 24, ru.z - 24, ru.x - 24, ru.z + 24, 0x7d786a);
  fenceLine(ru.x - 24, ru.z - 24, ru.x + 24, ru.z - 24, 0x7d786a);
  makeContainer(ru.x, ru.z, 'chest', { rich: true });
  SPAWNS.push({ faction: 'bandits', role: 'bandit', x: ru.x, z: ru.z, r: 24, n: 3 });

  // священная роща эльфов: каменный круг
  const grove = { x: -740, z: -300 };
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28;
    const x = grove.x + Math.cos(a) * 13, z = grove.z + Math.sin(a) * 13;
    const y = heightAt(x, z);
    box(1.6, 3.2 + (i % 3) * 0.6, 1.6, 0x7c7a70, x, y, z, a, { collide: true });
  }
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0x8b8a7e }));
  altar.position.set(grove.x, heightAt(grove.x, grove.z) + 0.55, grove.z);
  altar.castShadow = true;
  G.world.scene.add(altar);
  G.world.altar = altar;
  LANDMARKS.grove = { x: grove.x, z: grove.z };
  SPAWNS.push({ faction: 'elves', role: 'elf_archer', x: grove.x, z: grove.z, r: 16, n: 2 });

  // перекрёсток: столб с указателями и застава
  const cr = { x: 0, z: 645 };
  const cy = heightAt(cr.x, cr.z);
  cyl(0.22, 0.26, 5.4, 6, 0x51402a, cr.x + 8, cy, cr.z - 6);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BoxGeometry(3.4, 0.5, 0.14);
    paint(g, 0x8a7a56);
    place(g, cr.x + 9.8, cy + 4.4 - i * 0.8, cr.z - 6, -0.3 + i * 0.5);
  }
  SPAWNS.push({ faction: 'people', role: 'militia', x: cr.x, z: cr.z, r: 20, n: 2 });
  makeContainer(cr.x - 6, cr.z + 4, 'barrel');

  // невольничий рынок у форта
  const sm = { x: 780, z: -420 };
  for (let i = 0; i < 3; i++) {
    const x = sm.x + i * 8 - 8, z = sm.z, y = heightAt(x, z);
    box(5, 2.6, 5, 0x413c36, x, y, z, 0.1, { tag: 'cage' });
  }
  SPAWNS.push({ faction: 'villain', role: 'taskmaster', x: sm.x, z: sm.z, r: 18, n: 2 });
  SPAWNS.push({ faction: 'neutral', role: 'slave', x: sm.x, z: sm.z + 6, r: 14, n: 4 });
}

// ------------------------- сборка -------------------------
export function buildSettlements(scene) {
  G.world.scene = scene;
  G.platforms = PLATFORM_LIST;
  const makers = [
    ['village', buildVillage],
    ['palace', buildPalace],
    ['elfvillage', buildElfVillage],
    ['fort', buildFort],
    ['camps', buildCamps],
  ];
  for (const [name, fn] of makers) {
    const group = new THREE.Group();
    group.name = 'settlement_' + name;
    scene.add(group);
    fn();
    flush(group, name);
  }
  // мельничные крылья — отдельно, чтобы крутились
  const mb = LANDMARKS.millBlades;
  if (mb) {
    const blades = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a5230 });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8, 0.25), mat);
      b.position.set(0, 4, 0);
      const holder = new THREE.Group();
      holder.rotation.z = (i / 4) * Math.PI * 2;
      holder.add(b);
      blades.add(holder);
    }
    blades.position.set(mb.x + 3.2, mb.y, mb.z);
    blades.name = 'millBlades';
    scene.add(blades);
    LANDMARKS.millMesh = blades;
  }
}

export function updateSettlements(dt) {
  if (LANDMARKS.millMesh && !G.paused) LANDMARKS.millMesh.rotation.z += dt * 0.35;
  void dt;
}
