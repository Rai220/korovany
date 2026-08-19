import * as THREE from "three";

export const WORLD = 180;
export const NEAR_TREE = 32;
export const MAX_MESH_TREES = 90;

export function heightAt(x, z) {
  const n =
    Math.sin(x * 0.035) * Math.cos(z * 0.029) * 0.55 +
    Math.sin(x * 0.11 + z * 0.07) * 0.22 +
    Math.sin(x * 0.021 - z * 0.018) * 0.35;
  if (x > 10 && z < -10) {
    const tx = THREE.MathUtils.clamp((x - 10) / 50, 0, 1);
    const tz = THREE.MathUtils.clamp((-10 - z) / 50, 0, 1);
    const t = tx * tz;
    return 0.35 + n + t * t * 18 + Math.sin(x * 0.09) * Math.cos(z * 0.08) * 2.2 * t;
  }
  if (x < -8 && z > 8) return 0.32 + n * 1.35;
  return 0.22 + n * 0.45;
}

export function zoneAt(x, z) {
  if (x < 0 && z >= 0) return "forest";
  if (x >= 0 && z >= 0) return "palace";
  if (x < 0 && z < 0) return "village";
  return "mountains";
}

export const ZONE_NAME = {
  forest: "Эльфийский лес",
  palace: "Дворец императора",
  village: "Деревня людей",
  mountains: "Горы Владыки Морвейна",
};

function mulberry(seed) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function boxMesh(geo, material, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

function makeTreeBillboardTex() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 160;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 160);
  g.fillStyle = "#4a2e18";
  g.fillRect(56, 88, 16, 68);
  const layers = [
    [64, 78, 52, "#1d4a22"],
    [64, 54, 42, "#2a6a30"],
    [64, 34, 30, "#3a7d38"],
  ];
  for (const [x, y, r, col] of layers) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y + r * 0.7);
    g.lineTo(x - r, y + r * 0.7);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePineMesh() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, 1.6, 5),
    mat(0x5a3a1c)
  );
  trunk.position.y = 0.8;
  g.add(trunk);
  const cols = [0x1a4a20, 0x246028, 0x2f7030];
  [1.7, 2.4, 3.05].forEach((y, i) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.15 - i * 0.28, 1.35, 6),
      mat(cols[i])
    );
    cone.position.y = y;
    g.add(cone);
  });
  return g;
}

function makeBroadMesh() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.9, 5),
    mat(0x6a4424)
  );
  trunk.position.y = 0.95;
  g.add(trunk);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.15, 6, 5), mat(0x2d6b32));
  canopy.position.y = 2.35;
  canopy.scale.set(1.15, 0.85, 1.05);
  g.add(canopy);
  const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 6, 5), mat(0x3a8038));
  canopy2.position.set(0.45, 2.1, -0.2);
  g.add(canopy2);
  return g;
}

function addCollider(list, x, z, hx, hz) {
  list.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
}

function hut(scene, colliders, x, z, rot = 0, stone = false) {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rot;
  const wall = mat(stone ? 0x6a6860 : 0x7a4e2a);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 3.6), wall);
  body.position.y = 1.2;
  g.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.3, 1.8, 4),
    mat(stone ? 0x4a4038 : 0x6b2a1c)
  );
  roof.position.y = 3.15;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.12), mat(0x2a1a10));
  door.position.set(0, 0.7, 1.82);
  g.add(door);
  scene.add(g);
  addCollider(colliders, x, z, 2.3, 2.0);
  return g;
}

function banner(scene, x, z, color, h = 5) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 5), mat(0x4a3a28));
  pole.position.set(x, heightAt(x, z) + h / 2, z);
  scene.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), mat(color, { side: THREE.DoubleSide }));
  cloth.position.set(x + 0.55, heightAt(x, z) + h - 1.1, z);
  scene.add(cloth);
}

export function createWorld(scene) {
  const colliders = [];
  const pois = [];
  const interact = [];

  scene.background = new THREE.Color(0x87a0b4);
  scene.fog = new THREE.FogExp2(0x9bb0a0, 0.0075);

  const hemi = new THREE.HemisphereLight(0xc8d8e8, 0x3a2a18, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.05);
  sun.position.set(60, 90, 30);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x405040, 0.25));

  const seg = 96;
  const geo = new THREE.PlaneGeometry(WORLD * 2 + 8, WORLD * 2 + 8, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const zone = zoneAt(x, z);
    if (zone === "forest") c.set(0x2f5a28);
    else if (zone === "palace") c.set(0x4a6a3a);
    else if (zone === "village") c.set(0x6a7a3e);
    else c.set(0x6a6560);
    const wob = (Math.sin(x * 1.7) + Math.cos(z * 1.3)) * 0.03;
    c.offsetHSL(0, 0, wob);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(ground);

  function road(ax, az, bx, bz, w = 4.2) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.08, len),
      mat(0x6b5340)
    );
    mesh.position.set((ax + bx) / 2, 0.18, (az + bz) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    scene.add(mesh);
  }
  road(-120, 8, 120, 8, 5);
  road(8, -140, 8, 140, 5);
  road(-90, -70, -20, -10);
  road(40, -90, 90, -40);

  // --- Forest huts ---
  const forestClear = { x: -88, z: 78 };
  hut(scene, colliders, -92, 74, 0.2);
  hut(scene, colliders, -80, 86, -0.4);
  hut(scene, colliders, -98, 90, 0.8);
  hut(scene, colliders, -74, 70, 1.2);
  hut(scene, colliders, -86, 96, -0.2);
  const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.25, 8), mat(0x3a220e));
  fire.position.set(-86, heightAt(-86, 80) + 0.15, 80);
  scene.add(fire);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 5), mat(0xff6622, { emissive: 0xff3300 }));
  flame.position.set(-86, heightAt(-86, 80) + 0.55, 80);
  scene.add(flame);
  pois.push({ id: "huts", x: -88, z: 78, label: "Хижины эльфов" });

  // --- Palace ---
  const px = 88;
  const pz = 88;
  const stone = mat(0xc8c2b0);
  const dark = mat(0x8a8478);
  const wallH = 4.2;
  function wallSeg(x, z, sx, sz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, wallH, sz), stone);
    m.position.set(x, heightAt(x, z) + wallH / 2, z);
    scene.add(m);
    addCollider(colliders, x, z, sx / 2 + 0.2, sz / 2 + 0.2);
  }
  wallSeg(px, pz + 18, 40, 2.2);
  wallSeg(px - 19, pz, 2.2, 36);
  wallSeg(px + 19, pz, 2.2, 36);
  wallSeg(px - 12, pz - 18, 14, 2.2);
  wallSeg(px + 12, pz - 18, 14, 2.2);
  const keep = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 12), stone);
  keep.position.set(px, heightAt(px, pz + 4) + 5, pz + 4);
  scene.add(keep);
  addCollider(colliders, px, pz + 4, 7.2, 6.2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.2, 13.2), mat(0x6a2018));
  roof.position.set(px, heightAt(px, pz + 4) + 10.6, pz + 4);
  scene.add(roof);
  for (const [tx, tz] of [
    [px - 18, pz + 17],
    [px + 18, pz + 17],
    [px - 18, pz - 17],
    [px + 18, pz - 17],
  ]) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 7.5, 8), dark);
    tw.position.set(tx, heightAt(tx, tz) + 3.75, tz);
    scene.add(tw);
    addCollider(colliders, tx, tz, 2.3, 2.3);
  }
  banner(scene, px - 6, pz - 16, 0x2a4a9a);
  banner(scene, px + 6, pz - 16, 0xc9a227);
  const court = new THREE.Mesh(new THREE.BoxGeometry(28, 0.12, 22), mat(0xb0a890));
  court.position.set(px, heightAt(px, pz - 4) + 0.12, pz - 6);
  scene.add(court);
  pois.push({ id: "palace", x: px, z: pz, label: "Дворец" });
  pois.push({ id: "commander", x: px, z: pz - 10, label: "Командир" });

  // --- Village ---
  hut(scene, colliders, -70, -60, 0.1);
  hut(scene, colliders, -58, -78, -0.5);
  hut(scene, colliders, -82, -82, 0.7);
  hut(scene, colliders, -48, -54, 1.1);
  hut(scene, colliders, -94, -66, -0.3);
  const stall = new THREE.Group();
  stall.position.set(-64, heightAt(-64, -48), -48);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 2.2), mat(0x8a5a2a));
  counter.position.y = 0.55;
  stall.add(counter);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 2.8), mat(0xa03020));
  awning.position.set(0, 2.15, 0);
  stall.add(awning);
  const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5), mat(0x4a3018));
  poleL.position.set(-2, 1.1, 1);
  const poleR = poleL.clone();
  poleR.position.x = 2;
  stall.add(poleL, poleR);
  scene.add(stall);
  addCollider(colliders, -64, -48, 2.3, 1.2);
  interact.push({ type: "shop", x: -64, z: -48, r: 3.4, title: "Лавка" });
  pois.push({ id: "shop", x: -64, z: -48, label: "Лавка" });

  const healerHut = hut(scene, colliders, -40, -70, 0.2);
  const herb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), mat(0x3aaa44, { emissive: 0x145018 }));
  herb.position.set(-40, heightAt(-40, -70) + 3.4, -70);
  scene.add(herb);
  interact.push({ type: "healer", x: -40, z: -70, r: 3.2, title: "Лекарь" });
  pois.push({ id: "healer", x: -40, z: -70, label: "Лекарь" });
  pois.push({ id: "village", x: -68, z: -68, label: "Деревня" });

  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1.0, 10), mat(0x6a6a68));
  well.position.set(-74, heightAt(-74, -70) + 0.5, -70);
  scene.add(well);
  addCollider(colliders, -74, -70, 1.2, 1.2);

  // --- Fort ---
  const fx = 108;
  const fz = -108;
  function fortWall(x, z, sx, sz, h = 5.5) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat(0x4a4640));
    m.position.set(x, heightAt(x, z) + h / 2, z);
    scene.add(m);
    addCollider(colliders, x, z, sx / 2 + 0.15, sz / 2 + 0.15);
  }
  fortWall(fx, fz + 14, 32, 2.4);
  fortWall(fx - 15, fz, 2.4, 28);
  fortWall(fx + 15, fz, 2.4, 28);
  fortWall(fx - 8, fz - 14, 12, 2.4);
  fortWall(fx + 10, fz - 14, 8, 2.4);
  const keep2 = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 10), mat(0x3a3632));
  keep2.position.set(fx, heightAt(fx, fz + 2) + 4.5, fz + 2);
  scene.add(keep2);
  addCollider(colliders, fx, fz + 2, 5.2, 5.2);
  const batt = new THREE.Mesh(new THREE.BoxGeometry(11, 1.4, 11), mat(0x2a1818));
  batt.position.set(fx, heightAt(fx, fz + 2) + 9.4, fz + 2);
  scene.add(batt);
  banner(scene, fx - 4, fz - 12, 0x7a1220, 6);
  banner(scene, fx + 4, fz - 12, 0x1a1010, 6);
  pois.push({ id: "fort", x: fx, z: fz, label: "Старый форт" });

  const rocks = mulberry(91);
  for (let i = 0; i < 40; i++) {
    const x = 40 + rocks() * 130;
    const z = -40 - rocks() * 130;
    const s = 0.8 + rocks() * 2.4;
    const r = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      mat(0x6a6660)
    );
    r.position.set(x, heightAt(x, z) + s * 0.35, z);
    r.rotation.set(rocks() * 2, rocks() * 6, rocks() * 2);
    scene.add(r);
  }

  // --- Trees ---
  const treeTex = makeTreeBillboardTex();
  const billMat = new THREE.MeshLambertMaterial({
    map: treeTex,
    transparent: true,
    alphaTest: 0.35,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const billGeo = new THREE.PlaneGeometry(3.2, 4.1);
  const dummy = new THREE.Object3D();
  const trees = [];
  const rnd = mulberry(220);
  const blocked = (x, z) => {
    if (Math.hypot(x - forestClear.x, z - forestClear.z) < 11) return true;
    if (Math.hypot(x - px, z - pz) < 28) return true;
    if (Math.hypot(x + 68, z + 68) < 22) return true;
    if (Math.hypot(x - fx, z - fz) < 22) return true;
    if (Math.abs(z - 8) < 5 || Math.abs(x - 8) < 5) return true;
    return false;
  };

  function placeTree(x, z, kind, scale) {
    if (Math.abs(x) > WORLD - 8 || Math.abs(z) > WORLD - 8) return;
    if (blocked(x, z)) return;
    trees.push({ x, z, y: heightAt(x, z), kind, scale, meshIdx: -1 });
  }

  for (let i = 0; i < 680; i++) {
    const x = -WORLD + 6 + rnd() * (WORLD - 8);
    const z = 8 + rnd() * (WORLD - 16);
    if (x > -6 && rnd() > 0.12) continue;
    placeTree(x, z, rnd() > 0.35 ? "pine" : "broad", 0.75 + rnd() * 0.7);
  }
  for (let i = 0; i < 70; i++) {
    const x = 20 + rnd() * 150;
    const z = -20 - rnd() * 150;
    placeTree(x, z, "pine", 0.7 + rnd() * 0.55);
  }
  for (let i = 0; i < 36; i++) {
    placeTree(-20 - rnd() * 150, -10 - rnd() * 40, "broad", 0.65 + rnd() * 0.4);
  }

  const billboards = new THREE.InstancedMesh(billGeo, billMat, trees.length);
  billboards.frustumCulled = false;
  scene.add(billboards);
  const billDummy = dummy;
  trees.forEach((t, i) => {
    billDummy.position.set(t.x, t.y + 2.05 * t.scale, t.z);
    billDummy.scale.set(t.scale, t.scale, t.scale);
    billDummy.rotation.set(0, 0, 0);
    billDummy.updateMatrix();
    billboards.setMatrixAt(i, billDummy.matrix);
  });
  billboards.instanceMatrix.needsUpdate = true;

  const meshPool = [];
  for (let i = 0; i < MAX_MESH_TREES; i++) {
    const m = i % 2 ? makePineMesh() : makeBroadMesh();
    m.visible = false;
    scene.add(m);
    meshPool.push(m);
  }

  const _cam = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function updateLOD(camera) {
    camera.getWorldPosition(_cam);
    const scored = trees.map((t, i) => ({
      i,
      t,
      d: (_cam.x - t.x) ** 2 + (_cam.z - t.z) ** 2,
    }));
    scored.sort((a, b) => a.d - b.d);
    trees.forEach((t) => (t.meshIdx = -1));
    let used = 0;
    const near2 = NEAR_TREE * NEAR_TREE;
    for (const s of scored) {
      if (used >= MAX_MESH_TREES) break;
      if (s.d > near2) break;
      s.t.meshIdx = used;
      const mesh = meshPool[used];
      mesh.visible = true;
      mesh.position.set(s.t.x, s.t.y, s.t.z);
      mesh.scale.setScalar(s.t.scale);
      used += 1;
    }
    for (let i = used; i < meshPool.length; i++) meshPool[i].visible = false;

    _look.copy(_cam);
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      if (t.meshIdx >= 0) {
        billDummy.position.set(t.x, -40, t.z);
        billDummy.scale.set(0.001, 0.001, 0.001);
      } else {
        billDummy.position.set(t.x, t.y + 2.05 * t.scale, t.z);
        billDummy.scale.set(t.scale, t.scale, t.scale);
        billDummy.lookAt(_cam.x, t.y + 2.05 * t.scale, _cam.z);
      }
      billDummy.updateMatrix();
      billboards.setMatrixAt(i, billDummy.matrix);
    }
    billboards.instanceMatrix.needsUpdate = true;
  }

  const landmarks = {
    forest: new THREE.Vector3(-88, 0, 78),
    palace: new THREE.Vector3(88, 0, 82),
    village: new THREE.Vector3(-64, 0, -56),
    fort: new THREE.Vector3(108, 0, -108),
    shop: new THREE.Vector3(-64, 0, -48),
    healer: new THREE.Vector3(-40, 0, -70),
    commander: new THREE.Vector3(88, 0, 74),
  };
  const spots = {
    ...landmarks,
    elf: { x: -86, z: 76, gold: 14, yaw: 2.2 },
    guard: { x: 88, z: 70, gold: 22, yaw: 3.3 },
    villain: { x: 108, z: -114, gold: 30, yaw: 0.4 },
  };
  return {
    colliders,
    pois,
    interact,
    trees,
    updateLOD,
    landmarks,
    spots,
  };
}

export function resolveMove(x, z, nx, nz, colliders, radius = 0.45) {
  let ox = nx;
  let oz = nz;
  const hit = (px, pz) => {
    for (const c of colliders) {
      if (px > c.minX - radius && px < c.maxX + radius && pz > c.minZ - radius && pz < c.maxZ + radius) {
        return true;
      }
    }
    return false;
  };
  if (hit(ox, z)) ox = x;
  if (hit(ox, oz)) oz = z;
  ox = THREE.MathUtils.clamp(ox, -WORLD + 2, WORLD - 2);
  oz = THREE.MathUtils.clamp(oz, -WORLD + 2, WORLD - 2);
  return { x: ox, z: oz };
}
