// Мир: рельеф, 4 зоны, дорога, густой лес с LOD-деревьями [1],
// дворец Императора, старый форт Злодея, деревня людей, деревня эльфов.
import * as THREE from 'three';

export const HALF = 400;

// Дорога корованов: деревня людей -> ворота дворца
const ROAD = { ax: -240, az: 200, bx: 152, bz: 200 };

function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function flat(h, x, z, cx, cz, r, target) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= r) return h;
  const t = smoothstep(d / r);
  return target * (1 - t) + h * t;
}

export function terrainHeight(x, z) {
  let h = Math.sin(x * 0.012) * Math.cos(z * 0.011) * 2.5
        + Math.sin(x * 0.027 + 1.3) * Math.sin(z * 0.031 + 0.4) * 1.5
        + Math.sin((x + z) * 0.005) * 2;
  // горы Злодея на северо-востоке
  const md = Math.hypot(x - 230, z + 230);
  if (md < 280) {
    const t = 1 - md / 280;
    h += t * t * 55 * (0.75 + 0.25 * Math.sin(x * 0.05) * Math.sin(z * 0.043));
  }
  h = flat(h, x, z, 220, -220, 60, 26);   // плато старого форта
  h = flat(h, x, z, 200, 200, 85, 2);     // дворец
  h = flat(h, x, z, -200, 200, 75, 1.5);  // деревня людей
  h = flat(h, x, z, -200, -200, 55, 2);   // поляна эльфов
  const rd = distSeg(x, z, ROAD.ax, ROAD.az, ROAD.bx, ROAD.bz);
  if (rd < 16) { const t = smoothstep(rd / 16); h = 1.6 * (1 - t) + h * t; }
  return h;
}

export function zoneAt(x, z) {
  if (x < 0 && z < 0) return 'Зона 3: Лес эльфов';
  if (x >= 0 && z < 0) return 'Зона 4: Горы Злодея';
  if (x < 0) return 'Зона 1: Земли людей (нейтрал)';
  return 'Зона 2: Земли Императора';
}

// ---------- общие материалы/геометрия ----------
const matCache = {};
function mat(c, opts) {
  const key = c + JSON.stringify(opts || {});
  if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color: c }, opts));
  return matCache[key];
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
roofGeo.rotateY(Math.PI / 4);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 9);
const coneGeo = new THREE.ConeGeometry(1, 1, 9);
const rockGeo = new THREE.DodecahedronGeometry(1, 0);

// деревья — 3D-уровень
const oakTrunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 3, 7);
const oakBallGeo = new THREE.SphereGeometry(1, 8, 6);
const pineTrunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 2.4, 7);
const pineConeGeo = new THREE.ConeGeometry(1, 1, 8);
const matTrunk = mat(0x6b4a2b);
const matOakLeaf = mat(0x2d6a2d);
const matPineLeaf = mat(0x1f5c33);

function blob(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function tri(g, cx, top, w, h) {
  g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - w / 2, top + h); g.lineTo(cx + w / 2, top + h);
  g.closePath(); g.fill();
}

// деревья — уровень "картинкой" [1]
function treeSpriteMaterial(kind) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 128;
  const g = c.getContext('2d');
  if (kind === 'oak') {
    g.fillStyle = '#54381e'; g.fillRect(42, 66, 12, 62);
    g.fillStyle = '#27522a';
    blob(g, 48, 44, 30); blob(g, 28, 58, 19); blob(g, 68, 56, 20);
    g.fillStyle = '#33703a';
    blob(g, 48, 38, 21); blob(g, 35, 52, 13);
  } else {
    g.fillStyle = '#46300f'; g.fillRect(44, 88, 8, 40);
    g.fillStyle = '#1b4a28';
    tri(g, 48, 52, 58, 44); tri(g, 48, 28, 48, 46); tri(g, 48, 4, 36, 44);
    g.fillStyle = '#266036';
    tri(g, 48, 8, 26, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true });
}

export class World {
  constructor(game) {
    this.game = game;
    this.colliders = [];
    this.interactables = [];
    this.flames = [];
    this.t = 0;
    this.group = new THREE.Group();
    game.scene.add(this.group);

    game.scene.fog = new THREE.FogExp2(0x9db8d0, 0.0042);
    this.skyDay = new THREE.Color(0x87b5e0);
    this.skyNight = new THREE.Color(0x070b16);
    game.scene.background = new THREE.Color(0x87b5e0);

    this.sprOak = treeSpriteMaterial('oak');
    this.sprPine = treeSpriteMaterial('pine');

    this.buildLights();
    this.buildTerrain();
    this.buildTrees();
    this.buildRocks();
    this.buildElfVillage();
    this.buildHumanVillage();
    this.buildPalace();
    this.buildFort();
  }

  height(x, z) { return terrainHeight(x, z); }

  addCollider(cx, cz, w, d) {
    this.colliders.push({ x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2 });
  }

  // выталкивание из AABB-коллайдеров (стены, дома, башни)
  resolve(x, z, r) {
    for (const c of this.colliders) {
      if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) {
        const pl = x - (c.x1 - r), pr = (c.x2 + r) - x;
        const pt = z - (c.z1 - r), pb = (c.z2 + r) - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x1 - r;
        else if (m === pr) x = c.x2 + r;
        else if (m === pt) z = c.z1 - r;
        else z = c.z2 + r;
      }
    }
    return [x, z];
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x33402a, 0.7);
    this.sun = new THREE.DirectionalLight(0xfff2cc, 1.4);
    this.sun.position.set(100, 200, 50);
    this.group.add(this.hemi, this.sun, this.sun.target);
  }

  buildTerrain() {
    const geo = new THREE.PlaneGeometry(800, 800, 150, 150);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      let r, g, b;
      const rd = distSeg(x, z, ROAD.ax, ROAD.az, ROAD.bx, ROAD.bz);
      if (rd < 6.5) { r = 0.52; g = 0.45; b = 0.30; }
      else if (h > 42) { r = g = b = 0.78; }
      else if (h > 14) { r = 0.42; g = 0.40; b = 0.37; }
      else if (x < 0 && z < 0) { r = 0.10; g = 0.26; b = 0.10; }
      else if (x < 0) { r = 0.30; g = 0.42; b = 0.18; }
      else if (z >= 0) { r = 0.34; g = 0.42; b = 0.20; }
      else { r = 0.30; g = 0.34; b = 0.22; }
      const j = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1) * 0.05;
      colors[i * 3] = r + j; colors[i * 3 + 1] = g + j; colors[i * 3 + 2] = b + j;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.group.add(ground);
  }

  make3DTree(kind) {
    const g = new THREE.Group();
    if (kind === 'oak') {
      const t = new THREE.Mesh(oakTrunkGeo, matTrunk); t.position.y = 1.5;
      const b1 = new THREE.Mesh(oakBallGeo, matOakLeaf); b1.scale.set(1.9, 1.7, 1.9); b1.position.y = 3.8;
      const b2 = new THREE.Mesh(oakBallGeo, matOakLeaf); b2.scale.set(1.2, 1.1, 1.2); b2.position.set(0.8, 4.4, 0.4);
      g.add(t, b1, b2);
    } else {
      const t = new THREE.Mesh(pineTrunkGeo, matTrunk); t.position.y = 1.2;
      const c1 = new THREE.Mesh(pineConeGeo, matPineLeaf); c1.scale.set(1.8, 2.6, 1.8); c1.position.y = 3.0;
      const c2 = new THREE.Mesh(pineConeGeo, matPineLeaf); c2.scale.set(1.4, 2.2, 1.4); c2.position.y = 4.3;
      const c3 = new THREE.Mesh(pineConeGeo, matPineLeaf); c3.scale.set(0.95, 1.8, 0.95); c3.position.y = 5.5;
      g.add(t, c1, c2, c3);
    }
    return g;
  }

  // [1] — то самое: вдали дерево картинкой, при подходе преобразовывается в 3-хмерное
  makeTree(kind, s, x, z) {
    const lod = new THREE.LOD();
    const m3d = this.make3DTree(kind);
    m3d.scale.setScalar(s);
    lod.addLevel(m3d, 0);
    const spr = new THREE.Sprite(kind === 'oak' ? this.sprOak : this.sprPine);
    spr.center.set(0.5, 0);
    if (kind === 'oak') spr.scale.set(4.6 * s, 6.1 * s, 1);
    else spr.scale.set(4.9 * s, 6.6 * s, 1);
    lod.addLevel(spr, 80);
    lod.addLevel(new THREE.Object3D(), 340);
    lod.position.set(x, terrainHeight(x, z), z);
    return lod;
  }

  scatterTrees(n, x1, x2, z1, z2, opts) {
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 12) {
      tries++;
      const x = x1 + Math.random() * (x2 - x1);
      const z = z1 + Math.random() * (z2 - z1);
      if (distSeg(x, z, ROAD.ax, ROAD.az, ROAD.bx, ROAD.bz) < 11) continue;
      if (Math.hypot(x + 200, z + 200) < (opts.elfClear || 0)) continue;
      if (Math.hypot(x - 200, z - 200) < (opts.palaceClear || 0)) continue;
      if (Math.hypot(x + 200, z - 200) < (opts.villageClear || 0)) continue;
      if (Math.hypot(x - 220, z + 220) < (opts.fortClear || 0)) continue;
      if (opts.maxH !== undefined && terrainHeight(x, z) > opts.maxH) continue;
      const kind = Math.random() < (opts.pineChance ?? 0.4) ? 'pine' : 'oak';
      const s = (opts.minS ?? 0.85) + Math.random() * (opts.varS ?? 0.6);
      this.group.add(this.makeTree(kind, s, x, z));
      placed++;
    }
  }

  buildTrees() {
    // густой лес эльфов
    this.scatterTrees(540, -392, -22, -392, -22, { elfClear: 27, pineChance: 0.35, minS: 1.0, varS: 0.7 });
    // земли людей
    this.scatterTrees(70, -392, -20, 25, 392, { villageClear: 85, pineChance: 0.3 });
    // земли Императора
    this.scatterTrees(60, 25, 392, 25, 392, { palaceClear: 100, pineChance: 0.3 });
    // сосны в предгорьях
    this.scatterTrees(50, 25, 392, -392, -20, { fortClear: 70, maxH: 16, pineChance: 0.95 });
  }

  buildRocks() {
    const m = new THREE.MeshLambertMaterial({ color: 0x6a675f, flatShading: true });
    for (let i = 0; i < 48; i++) {
      const x = 40 + Math.random() * 340, z = -40 - Math.random() * 340;
      if (Math.hypot(x - 220, z + 220) < 45) continue;
      const r = new THREE.Mesh(rockGeo, m);
      const s = 1 + Math.random() * 3.5;
      r.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
      r.position.set(x, terrainHeight(x, z) + s * 0.2, z);
      r.rotation.set(Math.random(), Math.random() * 6, Math.random());
      this.group.add(r);
    }
  }

  makeHouse(x, z, w, h, d, wallC, roofC) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(boxGeo, mat(wallC));
    wall.scale.set(w, h, d); wall.position.y = h / 2;
    const roof = new THREE.Mesh(roofGeo, mat(roofC));
    roof.scale.set(w * 1.18, h * 0.75, d * 1.18); roof.position.y = h + h * 0.37;
    const door = new THREE.Mesh(boxGeo, mat(0x2a1c10));
    door.scale.set(0.9, 1.4, 0.12); door.position.set(0, 0.7, d / 2 + 0.04);
    g.add(wall, roof, door);
    g.position.set(x, terrainHeight(x, z), z);
    this.group.add(g);
    this.addCollider(x, z, w, d);
    return g;
  }

  makeSign(text, x, y, z) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#3a2a18'; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#d4af37'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56);
    g.fillStyle = '#ffd76a'; g.font = 'bold 36px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 0.75),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    sign.position.set(x, y, z);
    this.group.add(sign);
    return sign;
  }

  makeCampfire(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const st = new THREE.Mesh(rockGeo, mat(0x55524a));
      st.scale.setScalar(0.25);
      const a = i / 6 * Math.PI * 2;
      st.position.set(Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7);
      g.add(st);
    }
    const flame = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xff8830 }));
    flame.scale.set(0.35, 0.9, 0.35); flame.position.y = 0.5;
    const light = new THREE.PointLight(0xff8030, 1.6, 24);
    light.position.y = 1.2;
    g.add(flame, light);
    g.position.set(x, terrainHeight(x, z), z);
    this.group.add(g);
    this.flames.push({ flame, light });
  }

  buildElfVillage() {
    // домики деревянные в густом лесу
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.4;
      const r = 16 + (i % 3) * 2.5;
      const x = -200 + Math.cos(a) * r, z = -200 + Math.sin(a) * r;
      const s = 4 + (i % 3);
      this.makeHouse(x, z, s, 2.8 + (i % 2) * 0.6, s, 0x7a5a33, 0x3a5a2a);
    }
    this.makeHouse(-200, -190, 7, 4.2, 6, 0x6b4e2a, 0x2e4f24); // дом старейшины
    this.makeCampfire(-200, -201);
  }

  buildHumanVillage() {
    const shop = this.makeHouse(-186, 213, 6, 3.5, 5, 0xcfc09a, 0x8a4a2a);
    shop.rotation.y = Math.PI; // дверью к дороге
    this.makeSign('ЛАВКА', -186, terrainHeight(-186, 213) + 2.6, 213 - 2.7);
    this.interactables.push({ type: 'shop', label: 'Войти в лавку', x: -186, z: 209.6, r: 4 });

    const healer = this.makeHouse(-214, 213, 5.5, 3.2, 5, 0xd8cba6, 0x7a4426);
    healer.rotation.y = Math.PI;
    this.makeSign('ЛЕКАРЬ', -214, terrainHeight(-214, 213) + 2.5, 213 - 2.7);
    this.interactables.push({ type: 'healer', label: 'Лекарь: лечиться', x: -214, z: 209.6, r: 4 });

    const spots = [[-232, 188], [-212, 186], [-192, 187], [-170, 188], [-232, 215], [-168, 213], [-150, 200 - 14]];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      this.makeHouse(x, z, 4 + (i % 2), 2.8 + (i % 3) * 0.4, 4 + ((i + 1) % 2), 0xc8b894, 0x8a4a2a);
    }
    // колодец
    const well = new THREE.Mesh(cylGeo, mat(0x8a8578));
    well.scale.set(1, 1, 1); well.position.set(-200, terrainHeight(-200, 207) + 0.5, 207);
    this.group.add(well);
    this.addCollider(-200, 207, 2.2, 2.2);
  }

  buildPalace() {
    const y = terrainHeight(200, 200);
    const wallM = mat(0xb8b0a0);
    const addWall = (cx, cz, w, d) => {
      const m = new THREE.Mesh(boxGeo, wallM);
      m.scale.set(w, 7, d);
      m.position.set(cx, y + 3.5, cz);
      this.group.add(m);
      this.addCollider(cx, cz, w, d);
    };
    addWall(200, 155, 86, 2);                 // север
    addWall(200, 245, 86, 2);                 // юг
    addWall(245, 200, 2, 86);                 // восток
    addWall(155, 174.5, 2, 35);               // запад (до ворот)
    addWall(155, 225.5, 2, 35);               // запад (после ворот)
    // башни
    for (const [tx, tz] of [[155, 155], [245, 155], [155, 245], [245, 245]]) {
      const t = new THREE.Mesh(cylGeo, mat(0xa8a092));
      t.scale.set(4.2, 11, 4.2); t.position.set(tx, y + 5.5, tz);
      const r = new THREE.Mesh(coneGeo, mat(0x7a2a2a));
      r.scale.set(5, 4, 5); r.position.set(tx, y + 13, tz);
      this.group.add(t, r);
      this.addCollider(tx, tz, 8.5, 8.5);
    }
    // цитадель
    const keep = new THREE.Mesh(boxGeo, mat(0xc8c0b0));
    keep.scale.set(16, 10, 14); keep.position.set(220, y + 5, 200);
    const keepRoof = new THREE.Mesh(roofGeo, mat(0x7a2a2a));
    keepRoof.scale.set(18, 6, 16); keepRoof.position.set(220, y + 13, 200);
    this.group.add(keep, keepRoof);
    this.addCollider(220, 200, 16, 14);
    // знамёна у ворот
    for (const bz of [189, 211]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3), mat(0xa02020, { side: THREE.DoubleSide }));
      b.position.set(154, y + 5, bz);
      b.rotation.y = Math.PI / 2;
      this.group.add(b);
    }
    // трон Императора на помосте перед цитаделью
    const dais = new THREE.Mesh(cylGeo, mat(0xd8c8a0));
    dais.scale.set(2.6, 0.5, 2.6); dais.position.set(207, y + 0.25, 200);
    const seat = new THREE.Mesh(boxGeo, mat(0xc8a030));
    seat.scale.set(1, 0.9, 0.9); seat.position.set(207, y + 0.95, 200);
    const back = new THREE.Mesh(boxGeo, mat(0xc8a030));
    back.scale.set(1, 2, 0.2); back.position.set(207.45, y + 1.6, 200);
    this.group.add(dais, seat, back);
    this.interactables.push({ type: 'palaceThrone', label: 'Трон Императора', x: 207, z: 200, r: 3.2 });
  }

  buildFort() {
    const y = terrainHeight(220, -220);
    const stoneM = mat(0x6f6a60);
    const seg = (cx, cz, w, d, tiltZ = 0, tiltX = 0) => {
      const m = new THREE.Mesh(boxGeo, stoneM);
      m.scale.set(w, 5, d);
      m.position.set(cx, y + 2.2, cz);
      m.rotation.z = tiltZ; m.rotation.x = tiltX;
      this.group.add(m);
      this.addCollider(cx, cz, w, d);
    };
    // старый форт: стены поломанные, с проломами
    seg(210, -240, 18, 2);
    seg(233, -240, 10, 2, 0.16);
    seg(212, -200, 16, 2);
    seg(236, -200, 6, 2, -0.2);
    seg(200, -228, 2, 16);
    seg(200, -211, 2, 8, 0, 0.14);
    seg(240, -224, 2, 24);
    // полуразрушенная башня
    const tw = new THREE.Mesh(cylGeo, stoneM);
    tw.scale.set(3.6, 8, 3.6); tw.position.set(235, y + 3.6, -236);
    tw.rotation.x = 0.07;
    this.group.add(tw);
    this.addCollider(235, -236, 7.5, 7.5);
    // трон Злодея
    const seat = new THREE.Mesh(boxGeo, mat(0x1d1d24));
    seat.scale.set(1.1, 1, 1); seat.position.set(220, y + 1, -228);
    const back = new THREE.Mesh(boxGeo, mat(0x1d1d24));
    back.scale.set(1.1, 2.4, 0.25); back.position.set(220, y + 1.9, -228.5);
    for (const sx of [-0.5, 0.5]) {
      const spike = new THREE.Mesh(coneGeo, mat(0x111118));
      spike.scale.set(0.12, 0.9, 0.12); spike.position.set(220 + sx, y + 3.3, -228.5);
      this.group.add(spike);
    }
    this.group.add(seat, back);
    this.interactables.push({ type: 'fortThrone', label: 'Трон Злодея', x: 220, z: -228, r: 3 });
    // знамя для найма войск
    const pole = new THREE.Mesh(cylGeo, mat(0x3a2e1c));
    pole.scale.set(0.1, 5, 0.1); pole.position.set(214, y + 2.5, -214);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), mat(0x202028, { side: THREE.DoubleSide }));
    flag.position.set(215, y + 4.3, -214);
    this.group.add(pole, flag);
    this.interactables.push({ type: 'recruit', label: 'Нанять бойца (50 золота)', x: 214, z: -214, r: 4 });
    this.makeCampfire(224, -217);
  }

  updateDayNight(dt) {
    const g = this.game;
    this.t += dt;
    g.timeOfDay = (g.timeOfDay + dt / g.dayLength) % 1;
    const ang = g.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const day = Math.max(0, Math.sin(ang)) ** 0.7;
    this.sun.position.set(Math.cos(ang) * 300, Math.sin(ang) * 300, 120);
    this.sun.intensity = 0.08 + 1.35 * day;
    this.hemi.intensity = 0.16 + 0.55 * day;
    const sky = g.scene.background;
    sky.lerpColors(this.skyNight, this.skyDay, day);
    g.scene.fog.color.copy(sky);
    g.scene.fog.density = 0.0042 + (1 - day) * 0.002;
    for (const f of this.flames) {
      const fl = 1.3 + Math.sin(this.t * 13 + f.light.position.x) * 0.35;
      f.light.intensity = fl;
      f.flame.scale.y = 0.7 + Math.sin(this.t * 9) * 0.15;
    }
  }
}
