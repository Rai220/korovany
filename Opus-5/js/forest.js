// Густой лес с подменой уровней детализации:
// вдали деревья — картинкой (билборды), когда подходишь — превращаются в 3-хмерные.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, slopeAt, roadFactor, zoneAt } from './terrain.js';
import { MAP_HALF, VIEW_DIST } from './config.js';
import { makeRng } from './util.js';

const NEAR_DIST = 66;      // ближе — настоящее 3D-дерево
const CELL = 32;
const NEAR_CAP = 300;      // на каждый вид
const FAR_CAP = 2800;      // на каждый вид
const SCATTER_CAP = 420;

const KINDS = ['pine', 'oak', 'birch'];

/** Плотность леса по зонам. Эльфы — раз лесные, то лес густой. */
const DENSITY = { elf: 0.95, human: 0.20, palace: 0.13, villain: 0.07, wild: 0.26 };

function paint(src, hex, jitter = 0.06) {
  // Сливать можно только однородные геометрии, поэтому у всех снимаем индекс.
  const geo = src.index ? src.toNonIndexed() : src;
  if (geo !== src) src.dispose();
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = 1 + (Math.random() - 0.5) * jitter * 2;
    arr[i * 3] = c.r * k;
    arr[i * 3 + 1] = c.g * k;
    arr[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function treeGeometry(kind) {
  const parts = [];
  if (kind === 'pine') {
    const t = new THREE.CylinderGeometry(0.22, 0.42, 4.2, 6);
    t.translate(0, 2.1, 0);
    parts.push(paint(t, 0x53402c));
    const rs = [2.6, 2.1, 1.5], hs = [4.4, 3.8, 3.2], ys = [4.2, 6.4, 8.4];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.ConeGeometry(rs[i], hs[i], 8);
      c.translate(0, ys[i] + hs[i] * 0.5 - 1.2, 0);
      parts.push(paint(c, i === 2 ? 0x33622f : 0x27502a));
    }
  } else if (kind === 'oak') {
    const t = new THREE.CylinderGeometry(0.4, 0.62, 5.0, 7);
    t.translate(0, 2.5, 0);
    parts.push(paint(t, 0x4b3a26));
    const blobs = [[0, 6.6, 0, 3.0], [1.7, 5.9, 0.6, 1.9], [-1.5, 6.1, -1.0, 2.0], [0.3, 8.1, -0.4, 1.8]];
    for (const [bx, by, bz, r] of blobs) {
      const s = new THREE.IcosahedronGeometry(r, 1);
      s.translate(bx, by, bz);
      parts.push(paint(s, 0x3c6b2c));
    }
  } else {
    const t = new THREE.CylinderGeometry(0.16, 0.24, 7.0, 6);
    t.translate(0, 3.5, 0);
    parts.push(paint(t, 0xd8d3c4, 0.03));
    const blobs = [[0, 7.6, 0, 2.1], [1.2, 6.6, 0.4, 1.4], [-1.1, 7.0, -0.5, 1.3]];
    for (const [bx, by, bz, r] of blobs) {
      const s = new THREE.IcosahedronGeometry(r, 1);
      s.translate(bx, by, bz);
      parts.push(paint(s, 0x6f9c3f));
    }
  }
  const geo = mergeGeometries(parts, false);
  geo.computeBoundingBox();
  return geo;
}

/** Рисуем «дерево картинкой» на канвасе — это и есть дальний уровень детализации. */
function treeTexture(kind) {
  const W = 128, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);

  const blob = (x, y, r, col) => {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = r * (0.78 + Math.random() * 0.34);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.88;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
  };

  if (kind === 'pine') {
    g.fillStyle = '#53402c';
    g.fillRect(58, 150, 13, 106);
    const tiers = [[64, 210, 46, 62], [64, 152, 40, 58], [64, 100, 32, 52], [64, 54, 22, 44]];
    tiers.forEach(([x, y, w, h], i) => {
      g.fillStyle = i > 2 ? '#33622f' : '#27502a';
      g.beginPath();
      g.moveTo(x, y - h);
      g.lineTo(x + w, y + 8);
      g.lineTo(x - w, y + 8);
      g.closePath();
      g.fill();
    });
    g.fillStyle = 'rgba(120,180,110,.35)';
    g.beginPath(); g.moveTo(64, 10); g.lineTo(80, 62); g.lineTo(64, 58); g.closePath(); g.fill();
  } else if (kind === 'oak') {
    g.fillStyle = '#4b3a26';
    g.fillRect(56, 150, 17, 106);
    g.fillRect(40, 168, 30, 9);
    blob(64, 96, 52, '#356226');
    blob(40, 118, 34, '#3c6b2c');
    blob(90, 112, 32, '#3c6b2c');
    blob(66, 66, 34, '#4a7d33');
  } else {
    g.fillStyle = '#d8d3c4';
    g.fillRect(59, 120, 10, 136);
    g.fillStyle = '#4a4438';
    for (let i = 0; i < 9; i++) g.fillRect(59, 140 + i * 13, 6 + Math.random() * 4, 3);
    blob(64, 84, 46, '#5f8c36');
    blob(42, 104, 28, '#6f9c3f');
    blob(88, 100, 26, '#6f9c3f');
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function bushGeometry() {
  const parts = [];
  for (const [x, y, z, r] of [[0, 0.55, 0, 0.85], [0.6, 0.4, 0.3, 0.6], [-0.5, 0.45, -0.3, 0.55]]) {
    const s = new THREE.IcosahedronGeometry(r, 0);
    s.translate(x, y, z);
    parts.push(paint(s, 0x40632b, 0.12));
  }
  return mergeGeometries(parts, false);
}

function rockGeometry() {
  const g = new THREE.DodecahedronGeometry(1, 0);
  g.scale(1, 0.7, 1.15);
  g.translate(0, 0.4, 0);
  return paint(g, 0x6a6055, 0.14);
}

export class Forest {
  /** @param exclusions массив {x,z,r} — где деревьев быть не должно (поселения). */
  constructor(scene, exclusions = []) {
    this.scene = scene;
    this.exclusions = exclusions;
    this.items = [];                 // {x,z,y,s,rot,kind}
    this.grid = new Map();
    this.lastPos = new THREE.Vector3(1e9, 0, 1e9);
    this.frame = 0;
    this.nearCount = 0;
    this.farCount = 0;

    this._generate();
    this._build();
    this._makeOffsets();
  }

  _generate() {
    const rng = makeRng(20260725);
    const step = 9;
    for (let x = -MAP_HALF + step; x < MAP_HALF; x += step) {
      for (let z = -MAP_HALF + step; z < MAP_HALF; z += step) {
        const zn = zoneAt(x, z);
        const dens = DENSITY[zn.id] ?? 0.2;
        if (rng() > dens) continue;
        const px = x + (rng() - 0.5) * step * 1.6;
        const pz = z + (rng() - 0.5) * step * 1.6;
        if (Math.abs(px) > MAP_HALF - 12 || Math.abs(pz) > MAP_HALF - 12) continue;
        if (roadFactor(px, pz) > 0.12) continue;

        let blocked = false;
        for (const e of this.exclusions) {
          if (Math.hypot(px - e.x, pz - e.z) < e.r) { blocked = true; break; }
        }
        if (blocked) continue;

        const y = heightAt(px, pz);
        if (y > 128) continue;
        if (slopeAt(px, pz) > 0.62) continue;

        // Кусты и камни — редкая мелочь под ногами.
        const roll = rng();
        let kind;
        if (roll < 0.09) kind = 'bush';
        else if (roll < 0.115) kind = 'rock';
        else if (zn.id === 'elf') kind = roll < 0.62 ? 'pine' : (roll < 0.85 ? 'oak' : 'birch');
        else if (zn.id === 'villain') kind = 'pine';
        else kind = roll < 0.42 ? 'oak' : (roll < 0.72 ? 'birch' : 'pine');

        const isTree = KINDS.includes(kind);
        const s = isTree ? 0.7 + rng() * 0.85 : 0.6 + rng() * 0.9;
        const item = { x: px, z: pz, y, s, rot: rng() * Math.PI * 2, kind };
        const idx = this.items.push(item) - 1;

        const key = this._key(Math.floor(px / CELL), Math.floor(pz / CELL));
        let cell = this.grid.get(key);
        if (!cell) this.grid.set(key, (cell = []));
        cell.push(idx);
      }
    }
  }

  _key(cx, cz) { return cx * 100003 + cz; }

  _build() {
    this.near = {};
    this.far = {};
    const dummyMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });

    for (const kind of KINDS) {
      const geo = treeGeometry(kind);
      const h = geo.boundingBox.max.y;
      const nm = new THREE.InstancedMesh(geo, dummyMat(), NEAR_CAP);
      nm.frustumCulled = false;
      nm.castShadow = true;
      nm.receiveShadow = true;
      nm.count = 0;
      this.scene.add(nm);

      const plane = new THREE.PlaneGeometry(1, 1);
      plane.translate(0, 0.5, 0);
      const mat = new THREE.MeshBasicMaterial({
        map: treeTexture(kind), transparent: false, alphaTest: 0.45,
        side: THREE.DoubleSide, color: 0xb9b9b9, fog: true, depthWrite: true,
      });
      const fm = new THREE.InstancedMesh(plane, mat, FAR_CAP);
      fm.frustumCulled = false;
      fm.count = 0;
      this.scene.add(fm);

      this.near[kind] = { mesh: nm, height: h, n: 0 };
      this.far[kind] = { mesh: fm, n: 0 };
    }

    for (const [kind, geo] of [['bush', bushGeometry()], ['rock', rockGeometry()]]) {
      const m = new THREE.InstancedMesh(geo, dummyMat(), SCATTER_CAP);
      m.frustumCulled = false;
      m.receiveShadow = true;
      m.castShadow = kind === 'rock';
      m.count = 0;
      this.scene.add(m);
      this.near[kind] = { mesh: m, height: 1, n: 0 };
    }
  }

  _makeOffsets() {
    const R = Math.ceil(VIEW_DIST / CELL);
    const offs = [];
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) offs.push([dx, dz, dx * dx + dz * dz]);
    }
    offs.sort((a, b) => a[2] - b[2]);
    this.offsets = offs;
  }

  /** Твёрдые стволы: с чем игрок может столкнуться рядом с собой. */
  collidersNear(x, z, radius, out) {
    out.length = 0;
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cell = this.grid.get(this._key(cx + dx, cz + dz));
        if (!cell) continue;
        for (const i of cell) {
          const it = this.items[i];
          if (!KINDS.includes(it.kind)) continue;
          if (Math.hypot(it.x - x, it.z - z) < radius) {
            out.push({ x: it.x, z: it.z, r: (it.kind === 'oak' ? 0.62 : 0.34) * it.s + 0.3 });
          }
        }
      }
    }
    return out;
  }

  update(camPos, force = false) {
    this.frame++;
    if (!force && camPos.distanceToSquared(this.lastPos) < 1.6) return;
    this.lastPos.copy(camPos);

    for (const k in this.near) this.near[k].n = 0;
    for (const k in this.far) this.far[k].n = 0;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const cx = Math.floor(camPos.x / CELL), cz = Math.floor(camPos.z / CELL);
    const far2 = VIEW_DIST * VIEW_DIST;

    for (const [dx, dz] of this.offsets) {
      const cell = this.grid.get(this._key(cx + dx, cz + dz));
      if (!cell) continue;
      for (const idx of cell) {
        const it = this.items[idx];
        const ddx = it.x - camPos.x, ddz = it.z - camPos.z;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 > far2) continue;
        const isTree = KINDS.includes(it.kind);

        if (d2 < NEAR_DIST * NEAR_DIST) {
          const slot = this.near[it.kind];
          const cap = isTree ? NEAR_CAP : SCATTER_CAP;
          if (!slot || slot.n >= cap) continue;
          eu.set(0, it.rot, 0);
          q.setFromEuler(eu);
          pos.set(it.x, it.y, it.z);
          scl.set(it.s, it.s, it.s);
          m.compose(pos, q, scl);
          slot.mesh.setMatrixAt(slot.n++, m);
        } else if (isTree) {
          const slot = this.far[it.kind];
          if (slot.n >= FAR_CAP) continue;
          // Картинка всегда повёрнута к игроку.
          eu.set(0, Math.atan2(-ddx, -ddz), 0);
          q.setFromEuler(eu);
          const h = this.near[it.kind].height * it.s;
          pos.set(it.x, it.y, it.z);
          scl.set(h * 0.78, h, 1);
          m.compose(pos, q, scl);
          slot.mesh.setMatrixAt(slot.n++, m);
        }
      }
    }

    let nc = 0, fc = 0;
    for (const k in this.near) {
      const s = this.near[k];
      s.mesh.count = s.n;
      s.mesh.instanceMatrix.needsUpdate = true;
      nc += s.n;
    }
    for (const k in this.far) {
      const s = this.far[k];
      s.mesh.count = s.n;
      s.mesh.instanceMatrix.needsUpdate = true;
      fc += s.n;
    }
    this.nearCount = nc;
    this.farCount = fc;
  }
}
