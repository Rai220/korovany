// Мир: один большой террейн с 4 зонами из ТЗ:
//   1 — Земли людей (нейтрал, тут рынок/лавка),
//   2 — Дворец Императора,
//   3 — Лес эльфов (густой LOD-лес + домики на сваях),
//   4 — Форт Злодея в горах.
// Плюс дороги (по ним ходят корованы) и статические коллайдеры.
import * as THREE from 'three';
import { grassTexture, dirtTexture, stoneTexture, woodTexture, rockTexture } from './textures.js';

export const ZONES = {
  human:   { id: 'human',   name: 'Земли людей',      x: 0,    z: 0,    r: 95,  color: 0xc8b878 },
  palace:  { id: 'palace',  name: 'Дворец Императора', x: 0,    z: -330, r: 95,  color: 0xd4af37 },
  elf:     { id: 'elf',     name: 'Лес эльфов',        x: -330, z: 150,  r: 140, color: 0x4caf50 },
  villain: { id: 'villain', name: 'Форт Злодея',       x: 330,  z: 150,  r: 115, color: 0xb83020 },
};

export const WORLD_SIZE = 1000;
const HALF = WORLD_SIZE / 2;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];          // {kind:'circle',x,z,r} | {kind:'box',x,z,hw,hd}
    this.forest = null;           // ставится из main
    this.elfHouses = [];          // позиции домиков (цели набегов)
    this.landmarks = {};          // ключевые точки
    this.routes = [];             // маршруты корованов
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  build() {
    this._ground();
    this._roads();
    this._humanVillage();
    this._palace();
    this._elfVillage();
    this._villainFort();
    this._mountains();
    this._scatterRocks();
    this._routes();
    return this;
  }

  // ---------- helpers ----------
  _add(mesh) { this.group.add(mesh); return mesh; }

  _box(w, h, d, mat, x, y, z, collide = true, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    this._add(m);
    if (collide) {
      if (ry === 0) this.colliders.push({ kind: 'box', x, z, hw: w / 2, hd: d / 2 });
      else this.colliders.push({ kind: 'circle', x, z, r: Math.max(w, d) / 2 });
    }
    return m;
  }

  _cyl(rt, rb, h, mat, x, y, z, collide = true, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z); this._add(m);
    if (collide) this.colliders.push({ kind: 'circle', x, z, r: rb });
    return m;
  }

  // ---------- ground ----------
  _ground() {
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const tex = grassTexture(); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    this._add(m);
    this.ground = m;
  }

  _roads() {
    const tex = dirtTexture(); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mkRoad = (x1, z1, x2, z2, w = 10) => {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const g = new THREE.PlaneGeometry(w, len);
      const m = new THREE.Mesh(g, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(dx, dz);
      m.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2);
      this._add(m);
    };
    mkRoad(0, 0, 0, -300);     // люди → дворец
    mkRoad(0, 0, -300, 140);   // люди → лес эльфов
    mkRoad(0, 0, 300, 140);    // люди → форт злодея
  }

  // ---------- зона 1: люди (рынок/лавка) ----------
  _humanVillage() {
    const wood = woodTexture(); wood.colorSpace = THREE.SRGBColorSpace;
    const stone = stoneTexture(); stone.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshLambertMaterial({ map: wood });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a3b20 });
    const z0 = ZONES.human;
    // несколько домиков
    const spots = [[-40, 20], [38, 28], [-30, -34], [44, -22], [10, 48]];
    for (const [dx, dz] of spots) {
      const x = z0.x + dx, z = z0.z + dz;
      this._box(10, 6, 10, wallMat, x, 3, z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 4, 4), roofMat);
      roof.position.set(x, 8, z); roof.rotation.y = Math.PI / 4;
      this._add(roof);
    }
    // лавка торговца (помечена золотым) — точка магазина
    const shopMat = new THREE.MeshLambertMaterial({ map: stone, color: 0xd8c890 });
    const sx = z0.x + 6, sz = z0.z - 6;
    this._box(14, 7, 12, shopMat, sx, 3.5, sz);
    const sroof = new THREE.Mesh(new THREE.ConeGeometry(11, 5, 4),
      new THREE.MeshLambertMaterial({ color: 0xd4af37 }));
    sroof.position.set(sx, 9, sz); sroof.rotation.y = Math.PI / 4;
    this._add(sroof);
    // вывеска-флаг
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5),
      new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide }));
    flag.position.set(sx, 12.5, sz); this._add(flag);
    this.landmarks.shop = { x: sx, z: sz + 9 };  // встаём перед входом

    // рыночные прилавки
    const stallMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = z0.x + Math.cos(a) * 26, z = z0.z + Math.sin(a) * 26;
      this._box(4, 2.4, 3, stallMat, x, 1.2, z);
    }
    this.landmarks.human = { x: z0.x, z: z0.z + 30 };
  }

  // ---------- зона 2: дворец ----------
  _palace() {
    const stone = stoneTexture(); stone.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshLambertMaterial({ map: stone });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
    const p = ZONES.palace;

    // главное здание дворца
    this._box(46, 22, 40, wallMat, p.x, 11, p.z);
    // ступенчатая золотая крыша
    const r1 = this._box(40, 6, 34, goldMat, p.x, 25, p.z, false);
    const r2 = this._box(26, 6, 22, goldMat, p.x, 30, p.z, false);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 6), goldMat);
    spire.position.set(p.x, 39, p.z); this._add(spire);

    // крепостная стена (квадрат) с проёмом-воротами на юг (к людям)
    const R = 72, wh = 10, th = 4;
    // север / запад / восток — целые
    this._box(2 * R, wh, th, wallMat, p.x, wh / 2, p.z - R);             // север
    this._box(th, wh, 2 * R, wallMat, p.x - R, wh / 2, p.z);            // запад
    this._box(th, wh, 2 * R, wallMat, p.x + R, wh / 2, p.z);            // восток
    // юг — две секции с воротами по центру
    this._box(R - 8, wh, th, wallMat, p.x - (R + 8) / 2, wh / 2, p.z + R);
    this._box(R - 8, wh, th, wallMat, p.x + (R + 8) / 2, wh / 2, p.z + R);
    // башни по углам
    for (const [sx, sz] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
      this._cyl(6, 6, 16, wallMat, p.x + sx, 8, p.z + sz);
      const top = new THREE.Mesh(new THREE.ConeGeometry(7, 6, 8), goldMat);
      top.position.set(p.x + sx, 19, p.z + sz); this._add(top);
    }
    this.landmarks.palaceGate = { x: p.x, z: p.z + R };       // ворота
    this.landmarks.palaceYard = { x: p.x, z: p.z + 34 };      // двор (спавн охраны/командир)
    this.landmarks.palace = { x: p.x, z: p.z };
  }

  // ---------- зона 3: лес эльфов с домиками на сваях ----------
  _elfVillage() {
    const wood = woodTexture(); wood.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshLambertMaterial({ map: wood });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x3a2812 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x2f5a1e });
    const e = ZONES.elf;
    const spots = [[0, 0], [-46, 24], [40, 30], [-30, -40], [44, -34], [8, 54]];
    for (const [dx, dz] of spots) {
      const x = e.x + dx, z = e.z + dz;
      const platH = 5;
      // сваи
      for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, platH, 6), legMat);
        leg.position.set(x + lx, platH / 2, z + lz); this._add(leg);
      }
      // платформа + домик
      this._box(12, 1, 12, wallMat, x, platH, z, false);
      this._box(9, 5, 9, wallMat, x, platH + 3, z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 4), roofMat);
      roof.position.set(x, platH + 7.5, z); roof.rotation.y = Math.PI / 4;
      this._add(roof);
      // лестница
      const lad = new THREE.Mesh(new THREE.BoxGeometry(2, platH, 0.4), legMat);
      lad.position.set(x, platH / 2, z + 6.5); lad.rotation.x = 0.4; this._add(lad);
      this.elfHouses.push({ x, z });
    }
    this.landmarks.elf = { x: e.x, z: e.z };
    this.landmarks.elfEdge = { x: e.x + 90, z: e.z - 30 }; // край леса (откуда набигают)
  }

  // ---------- зона 4: форт злодея ----------
  _villainFort() {
    const rock = rockTexture(); rock.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshLambertMaterial({ map: rock });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x2a2420 });
    const f = ZONES.villain;

    // главный кип (тёмная башня)
    this._box(26, 26, 26, wallMat, f.x, 13, f.z);
    const keepTop = new THREE.Mesh(new THREE.ConeGeometry(11, 12, 4), darkMat);
    keepTop.position.set(f.x, 32, f.z); keepTop.rotation.y = Math.PI / 4; this._add(keepTop);
    // зубчатый флаг злодея
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(5, 3),
      new THREE.MeshBasicMaterial({ color: 0xb83020, side: THREE.DoubleSide }));
    flag.position.set(f.x, 40, f.z); this._add(flag);

    // полуразрушенная стена — сегменты с проломами
    const R = 50, wh = 9, th = 4;
    const segs = [
      [-R, -R, 2 * R, th, true], [R, -R + 14, th, 2 * R - 28, false],
      [-R + 30, R, 2 * R - 60, th, true], [-R, -R + 12, th, 2 * R - 50, false],
    ];
    for (const [ox, oz, w, d] of segs) {
      const horiz = w > d;
      this._box(horiz ? w : th, wh, horiz ? th : d, wallMat,
        f.x + ox + (horiz ? w / 2 : 0), wh / 2, f.z + oz + (horiz ? 0 : d / 2));
    }
    // груды камней (обломки)
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, dd = 20 + Math.random() * 30;
      this._cyl(0, 3 + Math.random() * 2, 4, wallMat,
        f.x + Math.cos(a) * dd, 2, f.z + Math.sin(a) * dd, false, 5);
    }
    this.landmarks.fort = { x: f.x, z: f.z };
    this.landmarks.fortYard = { x: f.x, z: f.z + 30 };
  }

  // ---------- горы (фон + восточная граница) ----------
  _mountains() {
    const rock = rockTexture(); rock.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({ map: rock, color: 0x6a6258 });
    const snow = new THREE.MeshLambertMaterial({ color: 0xeef2f6 });
    for (let i = 0; i < 16; i++) {
      const a = (-Math.PI / 2.4) + (i / 16) * (Math.PI * 0.9);
      const dd = 430 + Math.random() * 60;
      const x = ZONES.villain.x * 0.4 + Math.cos(a) * dd;
      const z = ZONES.villain.z * 0.4 + Math.sin(a) * dd;
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      const h = 90 + Math.random() * 70, r = 60 + Math.random() * 40;
      this._cyl(0, r, h, mat, x, h / 2, z, true, 6);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.25, 6), snow);
      cap.position.set(x, h * 0.82, z); this._add(cap);
    }
  }

  _scatterRocks() {
    const rock = rockTexture(); rock.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({ map: rock });
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      const z = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      const s = 1 + Math.random() * 2.5;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s), mat);
      m.position.set(x, s * 0.5, z); m.rotation.set(Math.random(), Math.random(), Math.random());
      this._add(m);
    }
  }

  // ---------- маршруты корованов ----------
  _routes() {
    this.routes = [
      [{ x: 0, z: 0 }, { x: 0, z: -120 }, { x: 0, z: -250 }],            // люди ↔ дворец
      [{ x: 0, z: 0 }, { x: -130, z: 70 }, { x: -240, z: 120 }],         // люди ↔ лес
      [{ x: 0, z: 0 }, { x: 140, z: 70 }, { x: 250, z: 120 }],           // люди ↔ форт
    ];
  }

  getSpawn(faction) {
    if (faction === 'elf') return { x: ZONES.elf.x + 20, z: ZONES.elf.z + 18, yaw: -2.2 };
    if (faction === 'guard') return { x: this.landmarks.palaceYard.x, z: this.landmarks.palaceYard.z, yaw: 0 };
    if (faction === 'villain') return { x: this.landmarks.fortYard.x, z: this.landmarks.fortYard.z, yaw: Math.PI };
    return { x: 0, z: 30, yaw: 0 };
  }

  zoneAt(x, z) {
    let best = null, bd = Infinity;
    for (const k in ZONES) {
      const Z = ZONES[k];
      const d = Math.hypot(x - Z.x, z - Z.z);
      if (d < Z.r && d < bd) { bd = d; best = Z; }
    }
    return best;
  }

  // Разрешение коллизий: вернуть скорректированные {x,z} для точки радиуса rad
  collide(x, z, rad) {
    const all = this.colliders;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of all) {
        if (c.kind === 'circle') {
          const dx = x - c.x, dz = z - c.z;
          let dist = Math.hypot(dx, dz);
          const min = rad + c.r;
          if (dist < min) {
            if (dist < 0.0001) { x = c.x + min; continue; }
            const push = (min - dist);
            x += (dx / dist) * push; z += (dz / dist) * push;
          }
        } else { // box (axis-aligned)
          const nx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
          const nz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
          const dx = x - nx, dz = z - nz;
          const dist = Math.hypot(dx, dz);
          if (nx === x && nz === z) {
            // внутри коробки — вытолкнуть к ближайшей грани
            const left = x - (c.x - c.hw), right = (c.x + c.hw) - x;
            const top = z - (c.z - c.hd), bot = (c.z + c.hd) - z;
            const m = Math.min(left, right, top, bot);
            if (m === left) x = c.x - c.hw - rad;
            else if (m === right) x = c.x + c.hw + rad;
            else if (m === top) z = c.z - c.hd - rad;
            else z = c.z + c.hd + rad;
          } else if (dist < rad && dist > 0.0001) {
            const push = rad - dist;
            x += (dx / dist) * push; z += (dz / dist) * push;
          }
        }
      }
      // деревья (ближние стволы)
      if (this.forest) {
        for (const c of this.forest.colliders) {
          const dx = x - c.x, dz = z - c.z;
          const dist = Math.hypot(dx, dz);
          const min = rad + c.r;
          if (dist < min && dist > 0.0001) {
            const push = min - dist;
            x += (dx / dist) * push; z += (dz / dist) * push;
          }
        }
      }
    }
    // граница мира
    const lim = HALF - 4;
    x = Math.max(-lim, Math.min(lim, x));
    z = Math.max(-lim, Math.min(lim, z));
    return { x, z };
  }
}
