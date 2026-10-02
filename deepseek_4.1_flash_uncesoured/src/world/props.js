// Окружение: трава, кусты, камни, факелы, костры, бочки и сундуки с добром.
import * as THREE from 'three';
import { G, SETTINGS, emit } from '../core/state.js';
import { Rand, fbm2 } from '../core/rng.js';
import { clamp, dist2D, lerp } from '../core/mathutil.js';
import { MAP, heightAt, slopeAt, isWater, roadDistance, zoneAt, WATER_Y, placeAt } from './terrain.js';

const flames = [];
const containers = [];
let grassMesh = null, bushesInst = null, rocksInst = null, reedsInst = null, propsGroup = null;
const CELL = 30;

function grassTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  const rnd = new Rand(77);
  const blade = (x, h, hue, sat, lig, w) => {
    ctx.strokeStyle = `hsl(${hue},${sat}%,${lig}%)`;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, 256);
    const bend = rnd.range(-26, 26);
    ctx.quadraticCurveTo(x + bend * 0.4, 256 - h * 0.6, x + bend, 256 - h);
    ctx.stroke();
  };
  // 0 — трава
  for (let i = 0; i < 46; i++) blade(20 + rnd.float() * 90, rnd.range(70, 165), 92 + rnd.float() * 28, 32 + rnd.float() * 20, 22 + rnd.float() * 22, 3 + rnd.float() * 3);
  // 1 — папоротник
  for (let i = 0; i < 16; i++) blade(150 + rnd.float() * 80, rnd.range(90, 190), 120 + rnd.float() * 25, 30, 18 + rnd.float() * 14, 5);
  // 2 — цветы
  for (let i = 0; i < 24; i++) blade(30 + rnd.float() * 90, rnd.range(60, 120), 96, 30, 26, 3);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `hsl(${rnd.pick([48, 320, 8, 270])},70%,${55 + rnd.float() * 20}%)`;
    ctx.beginPath(); ctx.arc(30 + rnd.float() * 90, rnd.range(80, 170), 4 + rnd.float() * 4, 0, 7); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function plantGrass() {
  const rnd = new Rand(G.seed ^ 0x1a2b);
  const list = [];
  const step = 4.6;
  const R = 260; // зона вокруг игрока, где трава вообще нужна
  const total = Math.floor((R * 2 / step) ** 2);
  for (let i = 0; i < total; i++) {
    list.push(i);
  }
  // Сетка «бесконечной» травы: пересобираем по игроку — просто сеем по всей карте с шагом 6 м
  const all = [];
  const step2 = 6.5;
  for (let z = -MAP.half + 20; z < MAP.half - 20; z += step2) {
    for (let x = -MAP.half + 20; x < MAP.half - 20; x += step2) {
      const jx = x + rnd.range(-2.6, 2.6), jz = z + rnd.range(-2.6, 2.6);
      const h = heightAt(jx, jz);
      if (h < WATER_Y + 0.4) continue;
      const sl = slopeAt(jx, jz);
      if (sl > 0.55) continue;
      const rd = roadDistance(jx, jz);
      if (rd < 5.5) continue;
      const zone = zoneAt(jx, jz);
      let dens = zone.key === 'elves' ? 0.75 : zone.key === 'villain' ? 0.35 : zone.key === 'empire' ? 0.5 : 0.62;
      if (h > 100) dens *= 0.4;
      if (rnd.float() > dens) continue;
      let type = rnd.float() < 0.12 ? 2 : (rnd.float() < 0.3 ? 1 : 0);
      if (zone.key === 'elves' && rnd.float() < 0.35) type = 1;
      all.push({ x: jx, z: jz, y: h, type, s: rnd.range(0.55, 1.35), rot: rnd.float() * 6.28 });
    }
  }
  void list;
  return all;
}

function buildGrass(scene) {
  const list = plantGrass();
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  const aType = new Float32Array(list.length);
  const aSize = new Float32Array(list.length * 2);
  const aPhase = new Float32Array(list.length);
  list.forEach((g, i) => {
    aType[i] = g.type; aSize[i * 2] = 1.5 * g.s; aSize[i * 2 + 1] = 1.15 * g.s; aPhase[i] = g.rot;
  });
  quad.setAttribute('aType', new THREE.InstancedBufferAttribute(aType, 1));
  quad.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
  quad.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: grassTexture() }, uTime: { value: 0 },
      uNear: { value: 3.0 }, uFar: { value: 78 }, uFogColor: { value: new THREE.Color(0x9fb4c4) },
      uFogDensity: { value: 0.0016 }, uLight: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aType; attribute vec2 aSize; attribute float aPhase;
      uniform float uTime; uniform float uNear; uniform float uFar; uniform float uLight;
      varying vec2 vUv; varying float vFade; varying float vDepth; varying float vLight;
      void main(){
        vec4 center = modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        vec4 mv = viewMatrix * center;
        float dist = length(mv.xyz);
        vFade = smoothstep(uNear, uNear * 1.6, dist) * (1.0 - smoothstep(uFar * 0.7, uFar, dist));
        float sway = sin(uTime * 1.7 + center.x * 0.35 + center.z * 0.2 + aPhase) * 0.11;
        mv.xy += position.xy * aSize + vec2(sway * position.y * aSize.y, 0.0);
        vUv = vec2((uv.x + aType) / 3.0, uv.y);
        vDepth = dist;
        vLight = uLight;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uFogColor; uniform float uFogDensity;
      varying vec2 vUv; varying float vFade; varying float vDepth; varying float vLight;
      void main(){
        if (vFade <= 0.01) discard;
        vec4 t = texture2D(uMap, vUv);
        if (t.a < 0.3) discard;
        vec3 col = t.rgb * vLight;
        float f = 1.0 - exp(-pow(vDepth * uFogDensity, 2.0));
        col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, t.a * vFade);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(quad, mat, list.length);
  const m = new THREE.Matrix4();
  list.forEach((g, i) => { m.makeTranslation(g.x, g.y - 0.05, g.z); mesh.setMatrixAt(i, m); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.name = 'grass';
  mesh.visible = SETTINGS.grass;
  scene.add(mesh);
  return mesh;
}

function scatter(count, seed, opts) {
  const rnd = new Rand(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rnd.float() * Math.PI * 2, r = Math.sqrt(rnd.float()) * MAP.half * 0.96;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < WATER_Y + 0.4 || slopeAt(x, z) > 0.6) { i--; continue; }
    if (roadDistance(x, z) < 5) continue;
    if (opts && opts.zone && zoneAt(x, z).key !== opts.zone) continue;
    out.push({ x, z, y: h, s: rnd.range(0.6, 1.8), rot: rnd.float() * 6.28 });
  }
  return out;
}

function buildScatter(scene) {
  const group = new THREE.Group(); group.name = 'scatter';
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x6a6a63, flatShading: true });
  const rocks = scatter(900, G.seed ^ 0x77, null);
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const col = new THREE.Color();
  rocks.forEach((r, i) => {
    v.set(r.x, r.y + r.s * 0.3, r.z);
    q.setFromEuler(new THREE.Euler(r.s * 0.3, r.rot, r.s * 0.2));
    s.set(r.s, r.s * 0.75, r.s * 1.1);
    rockMesh.setMatrixAt(i, m.compose(v, q, s));
    col.setHSL(0.1, 0.05, 0.3 + (i % 9) * 0.02);
    rockMesh.setColorAt(i, col);
  });
  rockMesh.castShadow = true; rockMesh.receiveShadow = true;
  group.add(rockMesh); rockMesh.name = 'rocks';

  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  const bushMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const bushes = scatter(2600, G.seed ^ 0x99, null).filter((b) => zoneAt(b.x, b.z).key !== 'villain' || Math.random() < 0.4);
  const bushMesh2 = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
  bushes.forEach((b, i) => {
    v.set(b.x, b.y + b.s * 0.35, b.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
    s.set(b.s * 0.9, b.s * 0.7, b.s * 0.9);
    bushMesh2.setMatrixAt(i, m.compose(v, q, s));
    col.setHSL(0.27, 0.35, 0.14 + (i % 6) * 0.02);
    bushMesh2.setColorAt(i, col);
  });
  bushMesh2.castShadow = true;
  group.add(bushMesh2); bushMesh2.name = 'bushes';

  // камыш у воды
  const reeds = [];
  const rnd = new Rand(G.seed ^ 0x1234);
  for (let i = 0; i < 2400; i++) {
    const x = rnd.range(-MAP.half, MAP.half), z = rnd.range(-MAP.half, MAP.half);
    const h = heightAt(x, z);
    if (h > WATER_Y + 1.6 || h < WATER_Y - 0.6) continue;
    reeds.push({ x, z, y: h, s: rnd.range(0.7, 1.6), rot: rnd.float() * 6.28 });
  }
  const reedGeo = new THREE.ConeGeometry(0.18, 1, 4);
  const reedMat = new THREE.MeshLambertMaterial({ color: 0x6f7b3a });
  const reedMesh2 = new THREE.InstancedMesh(reedGeo, reedMat, reeds.length);
  reeds.forEach((r, i) => {
    v.set(r.x, r.y + r.s * 0.5, r.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.rot);
    s.set(r.s, r.s * 1.6, r.s);
    reedMesh2.setMatrixAt(i, m.compose(v, q, s));
  });
  group.add(reedMesh2);
  bushesInst = bushMesh2; rocksInst = rockMesh; reedsInst = reedMesh2;
  scene.add(group);
  return group;
}

// ---------------- факелы и костры ----------------
export function addFire(x, y, z, opts = {}) {
  const scale = opts.scale || 1;
  const g = new THREE.Group();
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.32 * scale, 0.9 * scale, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.92 }),
  );
  flame.position.y = 0.45 * scale;
  g.add(flame);
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.16 * scale, 0.55 * scale, 5),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0 }),
  );
  core.position.y = 0.35 * scale;
  g.add(core);
  let light = null;
  if (opts.light !== false && flames.length < 14) {
    light = new THREE.PointLight(0xffa347, 5 * scale, 28 * scale, 2);
    light.position.y = 1.1 * scale;
    g.add(light);
  }
  g.position.set(x, y, z);
  flame.userData.baseY = flame.position.y;
  flames.push({ flame, core, light, seed: Math.random() * 100, scale });
  return g;
}

function buildFires(scene) {
  const group = new THREE.Group(); group.name = 'fires';
  const spots = [
    { id: 'crossroad', n: 2, r: 14 },
    { id: 'bridge_n', n: 1, r: 8 },
    { id: 'bridge_e', n: 1, r: 8 },
    { id: 'camp_bandits', n: 2, r: 16 },
    { id: 'elfcamp', n: 2, r: 16 },
    { id: 'pass', n: 2, r: 14 },
    { id: 'ruins', n: 1, r: 12 },
    { id: 'slavemarket', n: 2, r: 16 },
  ];
  for (const s of spots) {
    const p = G.places.find((pp) => pp.id === s.id);
    if (!p) continue;
    for (let i = 0; i < s.n; i++) {
      const a = (i / s.n) * 6.28 + 0.5;
      const x = p.x + Math.cos(a) * s.r, z = p.z + Math.sin(a) * s.r;
      group.add(addFire(x, heightAt(x, z), z, { scale: 1.1 }));
      // брёвна вокруг
      const logMat = new THREE.MeshLambertMaterial({ color: 0x3f2f1c });
      for (let k = 0; k < 3; k++) {
        const lg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.28), logMat);
        lg.position.set(x + Math.cos(k * 2.1) * 1.1, heightAt(x, z) + 0.2, z + Math.sin(k * 2.1) * 1.1);
        lg.rotation.y = k * 2.1; lg.rotation.z = 0.12;
        group.add(lg);
      }
    }
  }
  scene.add(group);
  return group;
}

export function updateFires(dt) {
  for (const f of flames) {
    const t = G.now * 9 + f.seed;
    const s = 1 + Math.sin(t) * 0.12 + Math.sin(t * 2.3) * 0.07;
    f.flame.scale.set(s, 1 + Math.sin(t * 1.7) * 0.2, s);
    f.flame.material.opacity = 0.8 + Math.sin(t * 3) * 0.12;
    f.core.scale.setScalar(0.9 + Math.sin(t * 2.1) * 0.15);
    if (f.light) f.light.intensity = (4.2 + Math.sin(t * 1.3) * 1.3 + Math.sin(t * 4.1) * 0.6) * f.scale;
  }
  void dt;
}

// ---------------- контейнеры (бочки, сундуки, ящики, корзины) ----------------
const CONTAINER_TYPES = {
  barrel: { geo: () => new THREE.CylinderGeometry(0.42, 0.38, 0.95, 10), color: 0x5b452c, loot: 'cheap', name: 'бочка' },
  crate: { geo: () => new THREE.BoxGeometry(0.85, 0.75, 0.85), color: 0x6b5230, loot: 'cheap', name: 'ящик' },
  chest: { geo: () => new THREE.BoxGeometry(0.95, 0.6, 0.6), color: 0x4a3520, loot: 'rich', name: 'сундук' },
  sack: { geo: () => new THREE.SphereGeometry(0.45, 8, 6), color: 0x8a7a58, loot: 'food', name: 'мешок' },
  basket: { geo: () => new THREE.CylinderGeometry(0.4, 0.3, 0.5, 8), color: 0x9a8654, loot: 'food', name: 'корзина' },
};

export function makeContainer(x, z, type = 'barrel', opts = {}) {
  const def = CONTAINER_TYPES[type] || CONTAINER_TYPES.barrel;
  const y = opts.y !== undefined ? opts.y : heightAt(x, z);
  const mesh = new THREE.Mesh(def.geo(), new THREE.MeshLambertMaterial({ color: def.color }));
  mesh.position.set(x, y + 0.42, z);
  mesh.rotation.y = Math.random() * 6.28;
  mesh.castShadow = true; mesh.receiveShadow = true;
  const c = {
    id: 'cont' + (containers.length + 1) + '_' + Math.round(x) + '_' + Math.round(z),
    type, name: def.name, mesh, x, y, z, opened: false, locked: !!opts.locked,
    loot: opts.loot || rollLoot(def.loot, opts.rich),
    owner: opts.owner || null,
  };
  mesh.userData.container = c;
  containers.push(c);
  G.containers.push(c);
  return c;
}
export function containerAt(x, z, maxD = 2.6) {
  let best = null, bd = maxD;
  for (const c of containers) {
    if (c.opened && c.loot.length === 0) continue;
    const d = dist2D(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function rollLoot(kind, rich) {
  const rnd = new Rand(Math.floor(Math.random() * 1e9));
  const loot = [];
  const goldRoll = kind === 'rich' ? rnd.int(20, 90) : kind === 'food' ? rnd.int(1, 8) : rnd.int(4, 26);
  if (goldRoll > 0) loot.push({ id: 'gold', qty: goldRoll });
  const table = {
    cheap: [['bandage', 0.35], ['bread', 0.3], ['apple', 0.25], ['arrows', 0.3], ['ale', 0.2], ['dagger', 0.08]],
    food: [['bread', 0.6], ['apple', 0.5], ['cheese', 0.4], ['ale', 0.3], ['meat', 0.3]],
    rich: [['bandage', 0.5], ['potion_heal', 0.5], ['potion_stamina', 0.35], ['arrows', 0.3], ['gem', 0.2], ['silver_ring', 0.25], ['lockpick', 0.2],
      ['hook_arm', 0.08], ['wood_leg', 0.08], ['glass_eye', 0.06], ['iron_leg', 0.04], ['mech_arm', 0.03]],
  }[kind] || [];
  for (const [id, p] of table) if (rnd.float() < p) loot.push({ id, qty: 1 });
  if (rich && rnd.float() < 0.35) loot.push({ id: 'iron_sword', qty: 1 });
  return loot;
}

// Сундук с добром в конкретном месте (для наград за приказы)
export function placeRewardCache(x, z, gold, items) {
  const c = makeContainer(x, z, 'chest', { rich: true, loot: [] });
  c.loot = [{ id: 'gold', qty: gold }, ...(items || []).map((i) => ({ id: i, qty: 1 }))];
  c.owner = 'reward';
  return c;
}

export function buildProps(scene) {
  propsGroup = new THREE.Group();
  propsGroup.name = 'props';
  buildScatter(propsGroup);
  buildFires(scene);
  grassMesh = buildGrass(propsGroup);
  scene.add(propsGroup);
  G.world.props = propsGroup;
  return propsGroup;
}

export function updateProps(dt) {
  if (grassMesh) {
    grassMesh.material.uniforms.uTime.value = G.now;
    grassMesh.visible = SETTINGS.grass && !G.paused;
  }
  updateFires(dt);
}

export function propFog(fogColor, fogDensity, light) {
  if (grassMesh) {
    grassMesh.material.uniforms.uFogColor.value.copy(fogColor);
    grassMesh.material.uniforms.uFogDensity.value = fogDensity;
    grassMesh.material.uniforms.uLight.value = light;
  }
}
void fbm2; void clamp; void lerp; void placeAt; void emit; void CELL;
