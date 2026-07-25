// Постройки: домики деревяные у эльфов, дворец императора,
// городок людей с лавками и старый форт в горах.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { BASES } from './config.js';
import { makeRng } from './util.js';

const MAT = {};
function mat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!MAT[key]) MAT[key] = new THREE.MeshLambertMaterial({ color: hex, ...opts });
  return MAT[key];
}

function box(w, h, d, hex, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, seg, hex) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(hex));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cone(r, h, seg, hex) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(hex));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const COL = {
  wood: 0x6b4a2c, darkwood: 0x4a3320, plank: 0x8a6a42,
  thatch: 0x9a7f3c, roofRed: 0x7a3128, roofGreen: 0x3d5c33,
  stone: 0x8a8578, stoneDark: 0x555049, gold: 0xd8b23c,
  banner: 0x2f4f86, dark: 0x2a2226, blood: 0x6b1f1f,
};

/** Домик деревяный на сваях — эльфийский. */
function elfHouse(rng) {
  const g = new THREE.Group();
  const w = 5 + rng() * 2, d = 4.5 + rng() * 2, lift = 2.2 + rng() * 1.8;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = cyl(0.22, 0.28, lift, 6, COL.darkwood);
    p.position.set(sx * (w / 2 - 0.5), lift / 2, sz * (d / 2 - 0.5));
    g.add(p);
  }
  const body = box(w, 3.2, d, COL.wood);
  body.position.y = lift + 1.6;
  g.add(body);
  const roof = cone(Math.max(w, d) * 0.82, 2.4, 4, COL.roofGreen);
  roof.position.y = lift + 3.2 + 1.2;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const door = box(1.0, 1.8, 0.15, COL.darkwood);
  door.position.set(0, lift + 0.9, d / 2 + 0.05);
  g.add(door);
  const ladder = box(0.9, lift, 0.12, COL.plank);
  ladder.position.set(0, lift / 2, d / 2 + 0.5);
  ladder.rotation.x = 0.18;
  g.add(ladder);
  return { group: g, hw: w / 2 + 0.3, hd: d / 2 + 0.3 };
}

function humanHouse(rng) {
  const g = new THREE.Group();
  const w = 6 + rng() * 3, d = 5 + rng() * 2.5, h = 3.6 + rng() * 1.2;
  const body = box(w, h, d, rng() > 0.5 ? COL.plank : COL.wood);
  body.position.y = h / 2;
  g.add(body);
  const roof = cone(Math.max(w, d) * 0.8, 2.6, 4, rng() > 0.5 ? COL.roofRed : COL.thatch);
  roof.position.y = h + 1.3;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const door = box(1.1, 2.0, 0.16, COL.darkwood);
  door.position.set(0, 1.0, d / 2 + 0.06);
  g.add(door);
  for (const sx of [-1, 1]) {
    const win = box(0.9, 0.9, 0.14, 0xe8d79a, { emissive: 0x4a3a12 });
    win.position.set(sx * w * 0.28, h * 0.6, d / 2 + 0.06);
    g.add(win);
  }
  return { group: g, hw: w / 2 + 0.2, hd: d / 2 + 0.2 };
}

/** Вывеска лавки — чтобы издалека видно было, где покупать. */
function shopStall(label, tint) {
  const g = new THREE.Group();
  const counter = box(4.2, 1.2, 2.4, COL.plank);
  counter.position.y = 0.6;
  g.add(counter);
  for (const sx of [-1, 1]) {
    const p = cyl(0.12, 0.12, 3.2, 6, COL.darkwood);
    p.position.set(sx * 1.9, 1.6, -1.0);
    g.add(p);
  }
  const awn = box(4.6, 0.2, 2.6, tint);
  awn.position.set(0, 3.2, -0.2);
  awn.rotation.x = -0.18;
  g.add(awn);
  const sign = box(2.4, 0.9, 0.14, COL.darkwood);
  sign.position.set(0, 3.9, -1.0);
  g.add(sign);
  const dot = box(0.5, 0.5, 0.1, COL.gold, { emissive: 0x4a3a12 });
  dot.position.set(0, 3.9, -0.88);
  g.add(dot);
  g.userData.label = label;
  return { group: g, hw: 2.3, hd: 1.4 };
}

function tower(r, h, hex) {
  const g = new THREE.Group();
  const body = cyl(r, r * 1.08, h, 10, hex);
  body.position.y = h / 2;
  g.add(body);
  const crown = cyl(r * 1.18, r * 1.18, 1.0, 10, hex);
  crown.position.y = h + 0.5;
  g.add(crown);
  const roof = cone(r * 1.3, r * 1.6, 8, COL.roofRed);
  roof.position.y = h + 1.0 + r * 0.8;
  g.add(roof);
  return g;
}

export function buildSettlements(scene) {
  const colliders = [];
  const interactables = [];
  const exclusions = [];
  const root = new THREE.Group();
  root.name = 'settlements';
  scene.add(root);
  const rng = makeRng(777);

  const addBox = (x, z, hw, hd) => colliders.push({ type: 'box', x, z, hw, hd });
  const addCyl = (x, z, r) => colliders.push({ type: 'circle', x, z, r });

  const place = (obj, x, z, ry = 0, yOff = 0) => {
    obj.position.set(x, heightAt(x, z) + yOff, z);
    obj.rotation.y = ry;
    root.add(obj);
    return obj;
  };

  // ============ 1. ЛЕС ЭЛЬФОВ: домики деревяные ============
  {
    const b = BASES.elf;
    exclusions.push({ x: b.x, z: b.z, r: 105 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rng() * 0.3;
      const rr = 42 + rng() * 34;
      const x = b.x + Math.cos(a) * rr, z = b.z + Math.sin(a) * rr;
      const h = elfHouse(rng);
      place(h.group, x, z, -a + Math.PI / 2);
      addBox(x, z, h.hw, h.hd);
    }
    // Священное дерево посреди поляны.
    const trunk = cyl(1.6, 2.6, 22, 10, 0x4a3320);
    trunk.position.y = 11;
    const crownG = new THREE.Group();
    crownG.add(trunk);
    for (const [dx, dy, dz, r] of [[0, 24, 0, 9], [6, 20, 3, 6], [-6, 21, -3, 6], [2, 29, -2, 5]]) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(0x2f5f2a));
      s.position.set(dx, dy, dz);
      s.castShadow = true;
      crownG.add(s);
    }
    place(crownG, b.x, b.z);
    addCyl(b.x, b.z, 2.6);

    // Костёр совета + лавка.
    const fire = new THREE.Group();
    const ring = cyl(1.5, 1.5, 0.3, 10, 0x5a5248);
    ring.position.y = 0.15;
    fire.add(ring);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 6), mat(0xff8c2a, { emissive: 0xff6a10 }));
    flame.position.y = 1.0;
    fire.add(flame);
    place(fire, b.x + 16, b.z + 12);

    const st = shopStall('Эльфийский оружейник', 0x3f7a3a);
    place(st.group, b.x - 20, b.z + 16, 0.4);
    addBox(b.x - 20, b.z + 16, st.hw, st.hd);
    interactables.push({ type: 'shop', shop: 'elfquart', x: b.x - 20, z: b.z + 16 + 2.2, r: 4.5, name: 'Эльфийский оружейник' });
  }

  // ============ 2. ЗЕМЛИ ИМПЕРАТОРА: дворец ============
  {
    const b = { x: 600, z: -600 };
    exclusions.push({ x: b.x, z: b.z, r: 175 });
    const W = 78;               // половина стороны стены
    const wallH = 9, wallT = 2.2;

    // Стены с воротами на западной стороне.
    const seg = (x, z, w, d) => {
      const m = box(w, wallH, d, COL.stone);
      place(m, x, z, 0, wallH / 2);
      addBox(x, z, w / 2, d / 2);
    };
    seg(b.x, b.z - W, W * 2, wallT);             // север
    seg(b.x, b.z + W, W * 2, wallT);             // юг
    seg(b.x + W, b.z, wallT, W * 2);             // восток
    seg(b.x - W, b.z - W / 2 - 4, wallT, W - 8); // запад верх
    seg(b.x - W, b.z + W / 2 + 4, wallT, W - 8); // запад низ

    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const t = tower(5.5, 15, COL.stone);
      place(t, b.x + sx * W, b.z + sz * W);
      addCyl(b.x + sx * W, b.z + sz * W, 6);
    }
    // Ворота.
    for (const sz of [-1, 1]) {
      const p = tower(3.2, 12, COL.stoneDark);
      place(p, b.x - W, b.z + sz * 8);
      addCyl(b.x - W, b.z + sz * 8, 3.6);
    }

    // Донжон.
    const keep = box(34, 26, 26, COL.stone);
    place(keep, b.x + 10, b.z, 0, 13);
    addBox(b.x + 10, b.z, 17.4, 13.4);
    const roof = cone(26, 12, 4, COL.gold);
    place(roof, b.x + 10, b.z, Math.PI / 4, 32);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const t = tower(4.2, 30, COL.stone);
      place(t, b.x + 10 + sx * 17, b.z + sz * 13);
      addCyl(b.x + 10 + sx * 17, b.z + sz * 13, 4.6);
    }
    // Знамёна.
    for (let i = 0; i < 4; i++) {
      const ban = box(0.2, 7, 3.2, COL.banner);
      place(ban, b.x - 12, b.z - 12 + i * 8, 0, 12);
    }
    // Крыльцо, где стоит командир.
    const porch = box(16, 1.2, 8, COL.stoneDark);
    place(porch, b.x - 16, b.z, 0, 0.6);

    // Казарма и арсенал.
    const bar = box(30, 6, 12, COL.plank);
    place(bar, b.x, b.z + 52, 0, 3);
    addBox(b.x, b.z + 52, 15, 6);
    const st = shopStall('Дворцовый арсенал', 0x2f4f86);
    place(st.group, b.x - 26, b.z + 44, 0);
    addBox(b.x - 26, b.z + 44, st.hw, st.hd);
    interactables.push({ type: 'shop', shop: 'palacequart', x: b.x - 26, z: b.z + 46.2, r: 4.5, name: 'Дворцовый арсенал' });
  }

  // ============ 3. ЗЕМЛИ ЛЮДЕЙ: городок, лавки, лекарь ============
  {
    const b = BASES.human;
    exclusions.push({ x: b.x, z: b.z, r: 150 });
    // Две улочки домов.
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const x = b.x - 60 + i * 20 + rng() * 4;
        const z = b.z + side * (16 + rng() * 5);
        const h = humanHouse(rng);
        place(h.group, x, z, side > 0 ? 0 : Math.PI);
        addBox(x, z, h.hw, h.hd);
      }
    }
    // Колодец на площади.
    const well = new THREE.Group();
    const ring = cyl(2, 2.2, 1.4, 10, COL.stone);
    ring.position.y = 0.7;
    well.add(ring);
    for (const sx of [-1, 1]) {
      const p = cyl(0.14, 0.14, 3.4, 6, COL.darkwood);
      p.position.set(sx * 1.8, 1.7, 0);
      well.add(p);
    }
    const bar2 = box(4, 0.24, 0.24, COL.darkwood);
    bar2.position.y = 3.4;
    well.add(bar2);
    place(well, b.x, b.z + 44);
    addCyl(b.x, b.z + 44, 2.4);

    const shops = [
      { id: 'armorer', name: 'Оружейник', tint: 0x7a3128, dx: -26, dz: 44 },
      { id: 'healer', name: 'Лекарь-протезист', tint: 0x3d5c33, dx: 26, dz: 44 },
      { id: 'trader', name: 'Торговец', tint: 0x7a6242, dx: 0, dz: 62 },
    ];
    for (const s of shops) {
      const st = shopStall(s.name, s.tint);
      place(st.group, b.x + s.dx, b.z + s.dz, 0);
      addBox(b.x + s.dx, b.z + s.dz, st.hw, st.hd);
      interactables.push({ type: 'shop', shop: s.id, x: b.x + s.dx, z: b.z + s.dz + 2.2, r: 4.5, name: s.name });
    }
    // Постоялый двор — тут сохраняются.
    const inn = box(16, 7, 12, COL.plank);
    place(inn, b.x - 4, b.z - 44, 0, 3.5);
    addBox(b.x - 4, b.z - 44, 8.2, 6.2);
    const innRoof = cone(13, 4, 4, COL.roofRed);
    place(innRoof, b.x - 4, b.z - 44, Math.PI / 4, 9);
    interactables.push({ type: 'bed', x: b.x - 4, z: b.z - 36, r: 5, name: 'Постоялый двор' });
  }

  // ============ 4. ГОРЫ ЗЛОГО: старый форт ============
  {
    const b = BASES.villain;
    exclusions.push({ x: b.x, z: b.z, r: 120 });
    const W = 46, wallH = 8;
    // Стены обвалившиеся — с проломами.
    const segs = [
      [b.x - 22, b.z - W, 46, 2.4], [b.x + 26, b.z - W, 34, 2.4],
      [b.x - 30, b.z + W, 30, 2.4], [b.x + 18, b.z + W, 50, 2.4],
      [b.x - W, b.z - 10, 2.4, 60], [b.x + W, b.z + 14, 2.4, 60],
    ];
    for (const [x, z, w, d] of segs) {
      const h = wallH * (0.6 + rng() * 0.5);
      const m = box(w, h, d, COL.stoneDark);
      place(m, x, z, 0, h / 2);
      addBox(x, z, w / 2, d / 2);
    }
    for (const [sx, sz] of [[-1, -1], [1, 1]]) {
      const t = tower(5, 11 + rng() * 4, COL.stoneDark);
      place(t, b.x + sx * W, b.z + sz * W);
      addCyl(b.x + sx * W, b.z + sz * W, 5.4);
    }
    // Донжон Злого…
    const keep = box(22, 20, 18, COL.dark);
    place(keep, b.x + 6, b.z - 8, 0, 10);
    addBox(b.x + 6, b.z - 8, 11.3, 9.3);
    const kroof = cone(17, 9, 4, COL.blood);
    place(kroof, b.x + 6, b.z - 8, Math.PI / 4, 24);
    for (let i = 0; i < 3; i++) {
      const ban = box(0.2, 6, 2.6, COL.blood);
      place(ban, b.x - 6, b.z - 20 + i * 10, 0, 9);
    }
    // Колья и костёр.
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2, rr = 52 + rng() * 22;
      const s = cyl(0.06, 0.2, 3, 5, COL.darkwood);
      const x = b.x + Math.cos(a) * rr, z = b.z + Math.sin(a) * rr;
      s.position.set(0, 1.5, 0);
      const gg = new THREE.Group();
      gg.add(s);
      gg.rotation.z = (rng() - 0.5) * 0.5;
      place(gg, x, z);
    }
    const fire = new THREE.Group();
    const fring = cyl(2.2, 2.2, 0.4, 10, COL.stoneDark);
    fring.position.y = 0.2;
    fire.add(fring);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 6), mat(0xff5a1a, { emissive: 0xff3a00 }));
    flame.position.y = 1.5;
    fire.add(flame);
    place(fire, b.x - 20, b.z + 14);
    addCyl(b.x - 20, b.z + 14, 2.4);

    const st = shopStall('Кузнец Злого…', 0x8d2b2b);
    place(st.group, b.x + 24, b.z + 20, -0.5);
    addBox(b.x + 24, b.z + 20, st.hw, st.hd);
    interactables.push({ type: 'shop', shop: 'darkquart', x: b.x + 24, z: b.z + 22.2, r: 4.5, name: 'Кузнец Злого…' });
  }

  return { colliders, interactables, exclusions, root };
}
