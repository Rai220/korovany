// ============================================================================
// КОРОВАНЫ — Fable 5.1
// 3Д-экшон по ТЗ Кирилла: эльфы / охрана дворца / Злой (имя он не придумал),
// 4 зоны, LOD-лес (вдали деревья картинкой), грабёж корованов, расчленёнка,
// протезы, лавки как в Daggerfall, сохранения.
// ============================================================================
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  start: $('start'), worldStatus: $('worldStatus'), factionCards: $('factionCards'),
  btnContinue: $('btnContinue'), hud: $('hud'), minimap: $('minimap'), msgs: $('msgs'),
  zoneLabel: $('zoneLabel'), orderText: $('orderText'), orderProg: $('orderProg'),
  orderTitle: $('orderTitle'), hpFill: $('hpFill'), hpText: $('hpText'),
  injuryList: $('injuryList'), bleedWarn: $('bleedWarn'), statusBR: $('statusBR'),
  hintText: $('hintText'), flash: $('flash'), vignette: $('vignette'),
  eyeOverlay: $('eyeOverlay'), pause: $('pause'), shop: $('shop'),
  shopTitle: $('shopTitle'), shopGold: $('shopGold'), shopItems: $('shopItems'),
  death: $('death'), deathReason: $('deathReason'), lockHint: $('lockHint'),
  savedToast: $('savedToast'),
};

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wr = mulberry32(220513); // мировой генератор — детерминированный мир
const rnd = Math.random;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Звук (крошечный синтезатор)
// ---------------------------------------------------------------------------
let actx = null, masterGain = null;
function audioInit() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain(); masterGain.gain.value = 0.16; masterGain.connect(actx.destination);
  } catch (e) { /* без звука */ }
}
function tone(freq, dur, type = 'square', vol = 1, slide = 0) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
  g.gain.setValueAtTime(vol, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g); g.connect(masterGain); o.start(); o.stop(actx.currentTime + dur);
}
function noiseBurst(dur, vol = 1, low = false) {
  if (!actx) return;
  const n = actx.sampleRate * dur, buf = actx.createBuffer(1, n, actx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = low ? (last + 0.12 * w) / 1.12 : w;
    d[i] = last * (1 - i / n);
  }
  const s = actx.createBufferSource(); s.buffer = buf;
  const g = actx.createGain(); g.gain.value = vol;
  s.connect(g); g.connect(masterGain); s.start();
}
const sfx = {
  swing: () => noiseBurst(0.12, 0.5),
  hit: () => { tone(110, 0.09, 'square', 0.8); noiseBurst(0.06, 0.4, true); },
  hurt: () => tone(220, 0.25, 'sawtooth', 0.7, -120),
  coin: () => { tone(880, 0.08, 'square', 0.5); setTimeout(() => tone(1320, 0.1, 'square', 0.5), 60); },
  sever: () => { noiseBurst(0.25, 0.9, true); tone(90, 0.2, 'sawtooth', 0.8, -40); },
  bow: () => { tone(600, 0.07, 'sine', 0.4, -300); noiseBurst(0.05, 0.25); },
  drink: () => tone(500, 0.15, 'sine', 0.5, 200),
  quest: () => { tone(523, 0.12, 'square', 0.5); setTimeout(() => tone(784, 0.18, 'square', 0.5), 110); },
};

// ---------------------------------------------------------------------------
// Мир: константы
// ---------------------------------------------------------------------------
const HALF = 800;
const ELF_VILLAGE = { x: -430, z: -430 };
const PALACE = { x: 430, z: -430 };
const HUMAN_VILLAGE = { x: -430, z: 430 };
const FORT = { x: 430, z: 430 };
const ZONES = {
  elves: { name: 'Густой лес эльфов', c: ELF_VILLAGE },
  palace: { name: 'Владения Императора', c: PALACE },
  humans: { name: 'Земли людей (нейтрал)', c: HUMAN_VILLAGE },
  villain: { name: 'Горы Злого', c: FORT },
};
function zoneOf(x, z) {
  if (x < 0 && z < 0) return 'elves';
  if (x >= 0 && z < 0) return 'palace';
  if (x < 0 && z >= 0) return 'humans';
  return 'villain';
}
const ROADS = [
  [[-400, 412], [-200, 205], [0, 0]],                    // деревня людей -> перекрёсток
  [[0, 0], [180, -180], [300, -380], [348, -430]],       // перекрёсток -> ворота дворца
  [[0, 0], [150, 150], [280, 330], [378, 430]],          // перекрёсток -> форт в горах
  [[0, 0], [-180, -140], [-320, -300], [-408, -408]],    // перекрёсток -> лес эльфов
];
const CARAVAN_PATH = [[-400, 412], [-200, 205], [0, 0], [180, -180], [300, -380], [340, -424]];

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}
function roadDist(x, z) {
  let d = 1e9;
  for (const poly of ROADS)
    for (let i = 0; i < poly.length - 1; i++)
      d = Math.min(d, segDist(x, z, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]));
  return d;
}

// ---------------------------------------------------------------------------
// Рельеф
// ---------------------------------------------------------------------------
function flattenNear(h, x, z, cx, cz, r0, r1, target) {
  const t = 1 - smoothstep(r0, r1, Math.hypot(x - cx, z - cz));
  return t <= 0 ? h : lerp(h, target, t);
}
function terrainH(x, z) {
  const low = 2.2 * Math.sin(x * 0.011) * Math.cos(z * 0.013)
    + 1.6 * Math.sin(x * 0.027 + 1.7) * Math.sin(z * 0.019 + 0.6);
  const rf = 1 - smoothstep(5, 16, roadDist(x, z));
  let h = low + (0.8 * Math.sin(x * 0.061) * Math.cos(z * 0.053)) * (1 - rf);
  // горы Злого на юго-востоке
  const m = smoothstep(40, 330, x) * smoothstep(40, 330, z);
  if (m > 0) {
    let mh = 26 + 13 * Math.sin(x * 0.021 + 3) * Math.cos(z * 0.018) + 6 * Math.sin(x * 0.05) * Math.sin(z * 0.047);
    h += m * mh * (1 - rf * 0.55);
  }
  // плато старого форта
  const p = 1 - smoothstep(55, 105, Math.hypot(x - FORT.x, z - FORT.z));
  if (p > 0) h = lerp(h, 34, p);
  // ровные площадки поселений
  h = flattenNear(h, x, z, ELF_VILLAGE.x, ELF_VILLAGE.z, 50, 95, 2.6);
  h = flattenNear(h, x, z, PALACE.x, PALACE.z, 80, 130, 1.8);
  h = flattenNear(h, x, z, HUMAN_VILLAGE.x, HUMAN_VILLAGE.z, 55, 100, 1.6);
  return h;
}

// ---------------------------------------------------------------------------
// Сцена
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe0ee, 130, 720);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1500);
camera.rotation.order = 'YXZ';
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  ui.worldStatus.textContent = 'WebGL недоступен: ' + e.message;
  throw e;
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// свет
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5f7046, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c0, 1.75);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0004;
scene.add(sun); scene.add(sun.target);

// небо-градиент
function makeSky() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#3f74c9'); g.addColorStop(0.55, '#8db6e4'); g.addColorStop(0.8, '#cfe0ee'); g.addColorStop(1, '#e8e4d0');
  c.fillStyle = g; c.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1250, 20, 14),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.renderOrder = -10;
  scene.add(sky);
  return sky;
}
const sky = makeSky();

// облака
(function makeClouds() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 9; i++) {
    const x = 16 + Math.random() * 96, y = 22 + Math.random() * 22, r = 10 + Math.random() * 14;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(160 + wr() * 120, 80 + wr() * 50), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((wr() - 0.5) * 2200, 200 + wr() * 60, (wr() - 0.5) * 2200);
    m.renderOrder = -5;
    scene.add(m);
  }
})();

// ---------------------------------------------------------------------------
// Слияние геометрий с вершинными цветами
// ---------------------------------------------------------------------------
function mergeGeoms(items) {
  const pos = [], norm = [], col = [], idx = [];
  let off = 0;
  const c = new THREE.Color();
  for (const it of items) {
    const g = it.geo.clone();
    if (it.matrix) g.applyMatrix4(it.matrix);
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    c.set(it.color);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      norm.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    const gi = g.getIndex();
    if (gi) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
const mat4 = new THREE.Matrix4();
function trs(x, y, z, ry = 0, s = 1) {
  return new THREE.Matrix4().compose(
    V3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    V3(s, s, s)
  );
}

// ---------------------------------------------------------------------------
// Земля
// ---------------------------------------------------------------------------
(function buildTerrain() {
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const cGrass = new THREE.Color(0x74a153), cGrass2 = new THREE.Color(0x86ad57),
    cForest = new THREE.Color(0x49763c), cRock = new THREE.Color(0x8b8378),
    cRoad = new THREE.Color(0xb99f6b), cDirt = new THREE.Color(0xa08b5e),
    cSnow = new THREE.Color(0xdfe4ea);
  const tmp = new THREE.Color();
  const crnd = mulberry32(777);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = terrainH(x, z);
    p.setY(i, h);
    tmp.lerpColors(cGrass, cGrass2, crnd());
    const zn = zoneOf(x, z);
    if (zn === 'elves') tmp.lerp(cForest, 0.62);
    if (zn === 'humans') tmp.lerp(new THREE.Color(0x9aa858), 0.25);
    const rockT = smoothstep(9, 24, h);
    if (rockT > 0) tmp.lerp(cRock, rockT);
    if (h > 44) tmp.lerp(cSnow, smoothstep(44, 52, h));
    const rf = 1 - smoothstep(4.5, 9, roadDist(x, z));
    if (rf > 0) tmp.lerp(cRoad, rf * 0.9);
    for (const hub of [ELF_VILLAGE, PALACE, HUMAN_VILLAGE, FORT]) {
      const t = 1 - smoothstep(14, 30, Math.hypot(x - hub.x, z - hub.z));
      if (t > 0) tmp.lerp(cDirt, t * 0.7);
    }
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
})();

// ---------------------------------------------------------------------------
// Деревья: вдали — картинкой, вблизи — 3-хмерные (LOD, как просил Кирилл)
// ---------------------------------------------------------------------------
function treeBillboardTexture(pine) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 128, 160);
  if (pine) {
    c.fillStyle = '#4a3325'; c.fillRect(58, 118, 12, 42);
    const gr = ['#26502c', '#2e5e33', '#1f4526'];
    for (let i = 0; i < 3; i++) {
      const w = 96 - i * 26, y = 120 - i * 40;
      c.fillStyle = gr[i % 3];
      c.beginPath(); c.moveTo(64 - w / 2, y); c.lineTo(64 + w / 2, y); c.lineTo(64, y - 52); c.closePath(); c.fill();
    }
  } else {
    c.fillStyle = '#54402c'; c.fillRect(56, 108, 16, 52);
    const blobs = [[64, 66, 44], [40, 88, 30], [90, 86, 30], [64, 40, 30]];
    for (const [x, y, r] of blobs) {
      const g = c.createRadialGradient(x - 8, y - 10, r * 0.2, x, y, r);
      g.addColorStop(0, '#66934a'); g.addColorStop(1, '#38622f');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function billboardGeo(w, h) {
  const g1 = new THREE.PlaneGeometry(w, h); g1.translate(0, h / 2, 0);
  const g2 = g1.clone(); g2.rotateY(Math.PI / 2);
  const pos = [], uv = [], idx = [];
  for (const g of [g1, g2]) {
    const off = pos.length / 3;
    const p = g.getAttribute('position'), u = g.getAttribute('uv'), ix = g.getIndex();
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}
function leaf3DGeo() {
  const items = [
    { geo: new THREE.CylinderGeometry(0.24, 0.34, 3.2, 6), color: 0x5a4430, matrix: trs(0, 1.6, 0) },
    { geo: new THREE.IcosahedronGeometry(2.3, 0), color: 0x4c7a3a, matrix: new THREE.Matrix4().makeScale(1, 1.2, 1).setPosition(0, 4.7, 0) },
    { geo: new THREE.IcosahedronGeometry(1.5, 0), color: 0x5b8a42, matrix: trs(0.9, 5.9, 0.5) },
    { geo: new THREE.IcosahedronGeometry(1.2, 0), color: 0x426e33, matrix: trs(-1, 5.5, -0.4) },
  ];
  return mergeGeoms(items);
}
function pine3DGeo() {
  const items = [
    { geo: new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6), color: 0x4a3325, matrix: trs(0, 1.3, 0) },
    { geo: new THREE.ConeGeometry(2.3, 3.4, 7), color: 0x26502c, matrix: trs(0, 3.6, 0) },
    { geo: new THREE.ConeGeometry(1.7, 2.9, 7), color: 0x2e5e33, matrix: trs(0, 5.5, 0) },
    { geo: new THREE.ConeGeometry(1.1, 2.4, 7), color: 0x1f4526, matrix: trs(0, 7.1, 0) },
  ];
  return mergeGeoms(items);
}

const trees = []; // {x,z,y,s,pine,nearMat,farMat}
const treeGrid = new Map();
const GRID = 16;
function gridKey(x, z) { return ((x / GRID) | 0) + '_' + ((z / GRID) | 0); }
function treeBlockedAt(x, z) {
  if (roadDist(x, z) < 10) return true;
  if (Math.hypot(x - ELF_VILLAGE.x, z - ELF_VILLAGE.z) < 58) return true;
  if (Math.hypot(x - PALACE.x, z - PALACE.z) < 105) return true;
  if (Math.hypot(x - HUMAN_VILLAGE.x, z - HUMAN_VILLAGE.z) < 62) return true;
  if (Math.hypot(x - FORT.x, z - FORT.z) < 78) return true;
  return false;
}
function addTree(x, z, pine, s) {
  const y = terrainH(x, z) - 0.15;
  const ry = wr() * Math.PI * 2;
  const t = {
    x, z, y, s, pine,
    nearMat: trs(x, y, z, ry, s),
    farMat: trs(x, y, z, ry, s),
  };
  trees.push(t);
  const k = gridKey(x, z);
  if (!treeGrid.has(k)) treeGrid.set(k, []);
  treeGrid.get(k).push(t);
}
(function plantTrees() {
  // густой лес эльфов (северо-запад)
  for (let i = 0; i < 5600; i++) {
    const x = -790 + wr() * 745, z = -790 + wr() * 745;
    if (treeBlockedAt(x, z)) continue;
    addTree(x, z, wr() < 0.2, 0.8 + wr() * 0.7);
  }
  // редкие деревья по остальной карте
  for (let i = 0; i < 750; i++) {
    const x = (wr() * 2 - 1) * 780, z = (wr() * 2 - 1) * 780;
    if (x < 0 && z < 0) continue;
    if (treeBlockedAt(x, z)) continue;
    const h = terrainH(x, z);
    if (h > 30) continue;
    addTree(x, z, h > 8 || wr() < 0.25, 0.75 + wr() * 0.6);
  }
  // сосны в горах
  for (let i = 0; i < 380; i++) {
    const x = 60 + wr() * 700, z = 60 + wr() * 700;
    if (treeBlockedAt(x, z)) continue;
    const h = terrainH(x, z);
    if (h < 5 || h > 34) continue;
    addTree(x, z, true, 0.7 + wr() * 0.55);
  }
})();

const NEAR_R2 = 72 * 72, FAR_MAX2 = 760 * 760;
const leafFarMat = new THREE.MeshBasicMaterial({ map: treeBillboardTexture(false), alphaTest: 0.45, side: THREE.DoubleSide, fog: true });
const pineFarMat = new THREE.MeshBasicMaterial({ map: treeBillboardTexture(true), alphaTest: 0.45, side: THREE.DoubleSide, fog: true });
const near3DMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const leafCount = trees.filter(t => !t.pine).length;
const pineCount = trees.length - leafCount;
const imLeafFar = new THREE.InstancedMesh(billboardGeo(7.5, 9.5), leafFarMat, leafCount);
const imPineFar = new THREE.InstancedMesh(billboardGeo(6.5, 11), pineFarMat, pineCount);
const imLeafNear = new THREE.InstancedMesh(leaf3DGeo(), near3DMat, 950);
const imPineNear = new THREE.InstancedMesh(pine3DGeo(), near3DMat, 500);
for (const im of [imLeafFar, imPineFar, imLeafNear, imPineNear]) {
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  scene.add(im);
}
imLeafNear.castShadow = true; imPineNear.castShadow = true;
function updateTreeLOD(px, pz) {
  let lf = 0, pf = 0, ln = 0, pn = 0;
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const dx = t.x - px, dz = t.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 > FAR_MAX2) continue;
    if (d2 < NEAR_R2) {
      if (t.pine) { if (pn < 500) imPineNear.setMatrixAt(pn++, t.nearMat); }
      else { if (ln < 950) imLeafNear.setMatrixAt(ln++, t.nearMat); }
    } else {
      if (t.pine) imPineFar.setMatrixAt(pf++, t.farMat);
      else imLeafFar.setMatrixAt(lf++, t.farMat);
    }
  }
  imLeafFar.count = lf; imPineFar.count = pf; imLeafNear.count = ln; imPineNear.count = pn;
  imLeafFar.instanceMatrix.needsUpdate = true;
  imPineFar.instanceMatrix.needsUpdate = true;
  imLeafNear.instanceMatrix.needsUpdate = true;
  imPineNear.instanceMatrix.needsUpdate = true;
}

// камни в горах
(function rocks() {
  const im = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1.5, 0),
    new THREE.MeshLambertMaterial({ color: 0x7d766c }), 260);
  let n = 0;
  for (let i = 0; i < 900 && n < 260; i++) {
    const x = 40 + wr() * 740, z = 40 + wr() * 740;
    const h = terrainH(x, z);
    if (h < 6 || roadDist(x, z) < 8 || Math.hypot(x - FORT.x, z - FORT.z) < 60) continue;
    im.setMatrixAt(n++, new THREE.Matrix4().compose(
      V3(x, h - 0.4, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(wr() * 3, wr() * 3, wr() * 3)),
      V3(0.6 + wr() * 1.6, 0.5 + wr() * 1.2, 0.6 + wr() * 1.6)));
  }
  im.count = n;
  im.castShadow = true;
  scene.add(im);
})();

// ---------------------------------------------------------------------------
// Постройки + коллайдеры
// ---------------------------------------------------------------------------
const colliders = []; // {minx,minz,maxx,maxz}
function addCollider(cx, cz, w, d, rot = 0) {
  // поворот учитываем грубо — расширяем AABB
  if (Math.abs(Math.sin(rot)) > 0.3) { const t = w; w = Math.max(w, d); d = Math.max(t, d); }
  colliders.push({ minx: cx - w / 2, maxx: cx + w / 2, minz: cz - d / 2, maxz: cz + d / 2 });
}
const lamb = (c) => new THREE.MeshLambertMaterial({ color: c });
function makeHouse(x, z, rot, w, d, hgt, wallC, roofC) {
  const g = new THREE.Group();
  const y0 = terrainH(x, z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), lamb(wallC));
  wall.position.y = hgt / 2; wall.castShadow = true; wall.receiveShadow = true;
  g.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, hgt * 0.75, 4), lamb(roofC));
  roof.position.y = hgt + hgt * 0.37; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, hgt * 0.6), lamb(0x2e2318));
  door.position.set(0, hgt * 0.3, d / 2 + 0.02);
  g.add(door);
  g.position.set(x, y0, z); g.rotation.y = rot;
  scene.add(g);
  addCollider(x, z, w + 0.6, d + 0.6, rot);
  return g;
}
function makeStall(x, z, rot, roofC) {
  const g = new THREE.Group();
  const y0 = terrainH(x, z);
  for (const [sx, sz] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), lamb(0x5a4430));
    p.position.set(sx, 1.3, sz); p.castShadow = true; g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 2.8), lamb(roofC));
  roof.position.y = 2.65; roof.rotation.z = 0.06; roof.castShadow = true; g.add(roof);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.8), lamb(0x6a5238));
  counter.position.set(0, 0.45, 1); counter.castShadow = true; g.add(counter);
  g.position.set(x, y0, z); g.rotation.y = rot;
  scene.add(g);
  return g;
}
function makeBanner(x, z, color) {
  const g = new THREE.Group();
  const y0 = terrainH(x, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 5), lamb(0x54402c));
  pole.position.y = 2.7; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  flag.position.set(0.8, 4.8, 0); g.add(flag);
  g.position.set(x, y0, z);
  scene.add(g);
}
function makeWallBox(cx, cz, w, d, h, c, ry = 0, broken = false) {
  const hh = broken ? h * 0.35 : h;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), lamb(c));
  const y0 = terrainH(cx, cz);
  m.position.set(cx, y0 + hh / 2, cz);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  addCollider(cx, cz, w, d, ry);
  if (broken) {
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + wr() * 0.7, 0), lamb(c));
      r.position.set(cx + (wr() - 0.5) * w, y0 + 0.4, cz + (wr() - 0.5) * (d + 4));
      r.castShadow = true;
      scene.add(r);
    }
  }
  return m;
}
function makeTower(x, z, r, h, c, broken = false) {
  const hh = broken ? h * 0.5 : h;
  const y0 = terrainH(x, z);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, hh, 8), lamb(c));
  m.position.set(x, y0 + hh / 2, z); m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  if (!broken) {
    const top = new THREE.Mesh(new THREE.ConeGeometry(r * 1.25, r * 1.4, 8), lamb(0x7a3020));
    top.position.set(x, y0 + hh + r * 0.7, z); top.castShadow = true;
    scene.add(top);
  }
  addCollider(x, z, r * 2, r * 2);
}

// Деревня людей (нейтрал)
(function humanVillage() {
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.35;
    const r = 30 + wr() * 12;
    const x = HUMAN_VILLAGE.x + Math.cos(a) * r, z = HUMAN_VILLAGE.z + Math.sin(a) * r;
    makeHouse(x, z, -a + Math.PI / 2, 5 + wr() * 2, 4.5 + wr() * 2, 3 + wr(), 0x9a8054, 0x7a4a30);
  }
  makeStall(HUMAN_VILLAGE.x - 5, HUMAN_VILLAGE.z + 2, 0.4, 0xb04030);
  makeStall(HUMAN_VILLAGE.x + 6, HUMAN_VILLAGE.z - 4, -0.6, 0x3a6a9a);
  makeBanner(HUMAN_VILLAGE.x, HUMAN_VILLAGE.z + 10, 0xc8b070);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1, 8), lamb(0x8b8378));
  well.position.set(HUMAN_VILLAGE.x, terrainH(HUMAN_VILLAGE.x, HUMAN_VILLAGE.z) + 0.5, HUMAN_VILLAGE.z);
  well.castShadow = true; scene.add(well);
  addCollider(HUMAN_VILLAGE.x, HUMAN_VILLAGE.z, 2.6, 2.6);
})();

// Деревяные домики эльфов в густом лесу
(function elfVillage() {
  const N = 7;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 26 + wr() * 12;
    const x = ELF_VILLAGE.x + Math.cos(a) * r, z = ELF_VILLAGE.z + Math.sin(a) * r;
    makeHouse(x, z, -a + Math.PI / 2, 4 + wr() * 1.5, 4 + wr(), 2.6 + wr() * 0.8, 0x6a5238, 0x3e6a34);
  }
  makeStall(ELF_VILLAGE.x + 6, ELF_VILLAGE.z + 5, -0.9, 0x3e6a34);
  makeBanner(ELF_VILLAGE.x, ELF_VILLAGE.z - 8, 0x3e8a3e);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff8a30 }));
  fire.position.set(ELF_VILLAGE.x, terrainH(ELF_VILLAGE.x, ELF_VILLAGE.z) + 0.45, ELF_VILLAGE.z);
  scene.add(fire);
})();

// Дворец Императора
(function palace() {
  const cx = PALACE.x, cz = PALACE.z, h = 8, W = 140, TH = 3;
  const stone = 0xb0a894;
  // стены (запад с воротами)
  makeWallBox(cx - W / 2, cz - (W / 4 + 11), TH, W / 2 - 22, h, stone); // запад-север
  makeWallBox(cx - W / 2, cz + (W / 4 + 11), TH, W / 2 - 22, h, stone); // запад-юг
  makeWallBox(cx + W / 2, cz, TH, W, h, stone);                          // восток
  makeWallBox(cx, cz - W / 2, W, TH, h, stone);                          // север
  makeWallBox(cx, cz + W / 2, W, TH, h, stone);                          // юг
  // арка ворот
  const arch = new THREE.Mesh(new THREE.BoxGeometry(TH, 3, 26), lamb(stone));
  arch.position.set(cx - W / 2, terrainH(cx - W / 2, cz) + h + 0.5, cz);
  arch.castShadow = true; scene.add(arch);
  makeTower(cx - W / 2, cz - W / 2, 5, 14, stone);
  makeTower(cx + W / 2, cz - W / 2, 5, 14, stone);
  makeTower(cx - W / 2, cz + W / 2, 5, 14, stone);
  makeTower(cx + W / 2, cz + W / 2, 5, 14, stone);
  // дворец-донжон
  const keep = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 22), lamb(0xc4bca8));
  keep.position.set(cx + 22, terrainH(cx + 22, cz) + 9, cz);
  keep.castShadow = true; keep.receiveShadow = true;
  scene.add(keep);
  addCollider(cx + 22, cz, 30.6, 22.6);
  const kroof = new THREE.Mesh(new THREE.ConeGeometry(23, 9, 4), lamb(0x7a3020));
  kroof.position.set(cx + 22, terrainH(cx + 22, cz) + 22.5, cz); kroof.rotation.y = Math.PI / 4;
  kroof.castShadow = true; scene.add(kroof);
  // казарма
  makeHouse(cx - 20, cz + 34, 0, 12, 6, 4, 0xb0a894, 0x7a3020);
  makeStall(cx - 12, cz - 30, 1.2, 0x8a2828);
  makeStall(cx - 26, cz - 14, 0.6, 0x3a6a9a);
  makeBanner(cx - W / 2 + 4, cz - 16, 0xc02020);
  makeBanner(cx - W / 2 + 4, cz + 16, 0xc02020);
})();

// Старый форт Злого в горах
(function fort() {
  const cx = FORT.x, cz = FORT.z, W = 90, h = 6;
  const stone = 0x6f6a60;
  makeWallBox(cx, cz - W / 2, W, 2.6, h, stone);                 // север
  makeWallBox(cx + W / 2, cz, 2.6, W, h, stone, 0, true);        // восток — разрушена
  makeWallBox(cx, cz + W / 2, W * 0.55, 2.6, h, stone, 0, true); // юг — разрушена
  makeWallBox(cx - W / 2, cz - W / 4 - 4, 2.6, W / 2 - 15, h, stone); // запад-север (ворота)
  makeWallBox(cx - W / 2, cz + W / 4 + 4, 2.6, W / 2 - 15, h, stone); // запад-юг
  makeTower(cx - W / 2, cz - W / 2, 4.5, 12, stone);
  makeTower(cx + W / 2, cz + W / 2, 4.5, 12, stone, true);
  const keep = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 14), lamb(0x5f5a52));
  keep.position.set(cx + 14, terrainH(cx + 14, cz) + 6, cz - 6);
  keep.castShadow = true; keep.receiveShadow = true;
  scene.add(keep);
  addCollider(cx + 14, cz - 6, 18.6, 14.6);
  makeStall(cx - 10, cz + 14, 0.9, 0x33333b);
  makeBanner(cx - W / 2 + 4, cz, 0x202024);
})();

// ---------------------------------------------------------------------------
// Гуманоиды
// ---------------------------------------------------------------------------
function makeSwordMesh(scale = 1) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.72, 0.13), lamb(0xc8ccd4));
  blade.position.y = -0.5;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), lamb(0x8a6a20));
  guard.position.y = -0.12;
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), lamb(0x4a3320));
  hilt.position.y = -0.02;
  g.add(blade, guard, hilt);
  g.scale.setScalar(scale);
  return g;
}
function makeBowMesh() {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 5, 12, Math.PI), lamb(0x6a4a28));
  arc.rotation.z = Math.PI / 2;
  g.add(arc);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.84, 3), lamb(0xd8d0b8));
  g.add(string);
  return g;
}
const FPRESET = {
  elf: { skin: 0xe8c8a2, tunic: 0x3f6f35, pants: 0x2e4f28, hat: 'elf', hatC: 0x2e5f2a },
  guard: { skin: 0xd8a888, tunic: 0x8a2828, pants: 0x4a4a52, hat: 'helm', hatC: 0x9aa0aa },
  villain: { skin: 0xc8a090, tunic: 0x33333b, pants: 0x22222a, hat: 'hood', hatC: 0x1a1a20 },
  peasant: { skin: 0xd8b090, tunic: 0x8a7048, pants: 0x5a4a32, hat: 'straw', hatC: 0xc8b070 },
  cguard: { skin: 0xd8a888, tunic: 0x35507a, pants: 0x3a3a42, hat: 'helm', hatC: 0x9aa0aa },
};
function makeHumanoid(preset, opts = {}) {
  const g = new THREE.Group();
  const parts = {};
  const s = opts.scale || 1;
  const tunicM = lamb(opts.tunic || preset.tunic), pantsM = lamb(preset.pants),
    skinM = lamb(preset.skin);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), tunicM);
  torso.position.y = 1.24; torso.castShadow = true;
  g.add(torso); parts.torso = torso;
  // голова с шеей-пивотом
  const headG = new THREE.Group(); headG.position.y = 1.58;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.28), skinM);
  head.position.y = 0.16; head.castShadow = true;
  headG.add(head);
  if (preset.hat === 'helm') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.18, 8), lamb(preset.hatC));
    h.position.y = 0.34; headG.add(h);
  } else if (preset.hat === 'hood') {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 7), lamb(preset.hatC));
    h.position.y = 0.36; headG.add(h);
  } else if (preset.hat === 'elf') {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 6), lamb(preset.hatC));
    h.position.y = 0.4; h.rotation.z = 0.18; headG.add(h);
  } else if (preset.hat === 'straw') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.07, 8), lamb(preset.hatC));
    h.position.y = 0.3; headG.add(h);
  }
  g.add(headG); parts.head = headG;
  const mkArm = (side) => {
    const p = new THREE.Group(); p.position.set(0.34 * side, 1.5, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), tunicM);
    m.position.y = -0.31; m.castShadow = true;
    p.add(m); g.add(p);
    return p;
  };
  parts.armR = mkArm(1); parts.armL = mkArm(-1);
  const mkLeg = (side) => {
    const p = new THREE.Group(); p.position.set(0.14 * side, 0.92, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.86, 0.18), pantsM);
    m.position.y = -0.43; m.castShadow = true;
    p.add(m); g.add(p);
    return p;
  };
  parts.legR = mkLeg(1); parts.legL = mkLeg(-1);
  if (opts.weapon === 'sword' || opts.weapon === 'dagger') {
    const w = makeSwordMesh(opts.weapon === 'dagger' ? 0.6 : 1);
    w.position.set(0, -0.6, -0.06); w.rotation.x = Math.PI;
    parts.armR.add(w); parts.weapon = w;
  } else if (opts.weapon === 'bow') {
    const w = makeBowMesh();
    w.position.set(0, -0.55, -0.1);
    parts.armL.add(w); parts.weapon = w;
  }
  if (opts.cape) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshLambertMaterial({ color: opts.cape, side: THREE.DoubleSide }));
    cape.position.set(0, 1.2, 0.2); cape.rotation.x = 0.15;
    g.add(cape);
  }
  g.scale.setScalar(s);
  return { group: g, parts };
}

// ---------------------------------------------------------------------------
// Актёры
// ---------------------------------------------------------------------------
const actors = [];
const corpses = [];
const looseLimbs = [];
const arrows = [];
const particles = [];
const respawnQueue = [];

const KIND_DEF = {
  warrior: { hp: 46, speed: 4.4, dmg: 11, aggro: 34, label: 'воин' },
  archer: { hp: 34, speed: 4.2, dmg: 8, aggro: 48, label: 'лучник', ranged: true },
  spy: { hp: 30, speed: 5.4, dmg: 8, aggro: 40, label: 'шпион' },
  peasant: { hp: 24, speed: 3.6, dmg: 0, aggro: 0, label: 'крестьянин' },
  boss: { hp: 170, speed: 4.0, dmg: 20, aggro: 40, label: 'Злой' },
  commander: { hp: 80, speed: 4.4, dmg: 14, aggro: 30, label: 'командир' },
  elder: { hp: 60, speed: 3.4, dmg: 10, aggro: 26, label: 'старейшина' },
  shop: { hp: 40, speed: 3.4, dmg: 0, aggro: 0, label: 'торговец' },
  healer: { hp: 40, speed: 3.4, dmg: 0, aggro: 0, label: 'лекарь' },
};
function factionLabel(f) {
  return { elf: 'эльфы', guard: 'солдаты дворца', villain: 'разбойники Злого', peasant: 'люди', cguard: 'охрана корована' }[f] || f;
}
function hostileF(a, b) {
  if (a === b) return false;
  const war = ['elf', 'guard', 'villain'];
  if (war.includes(a) && war.includes(b)) return true;
  if (a === 'cguard' && b === 'villain') return true;
  if (b === 'cguard' && a === 'villain') return true;
  return false;
}

function spawnActor(faction, kind, x, z, opts = {}) {
  const def = KIND_DEF[kind];
  const presetKey = (faction === 'elf' || faction === 'guard' || faction === 'villain') ? faction
    : faction === 'cguard' ? 'cguard' : 'peasant';
  const preset = FPRESET[presetKey];
  let weapon = 'sword';
  if (kind === 'archer') weapon = 'bow';
  if (kind === 'spy') weapon = 'dagger';
  if (kind === 'peasant' || kind === 'shop' || kind === 'healer' || kind === 'elder') weapon = 'none';
  const scale = kind === 'boss' ? 1.3 : kind === 'commander' ? 1.1 : 1;
  const hum = makeHumanoid(preset, {
    weapon, scale,
    cape: kind === 'boss' ? 0x5a1015 : (kind === 'commander' ? 0xc8a020 : 0),
    tunic: kind === 'shop' ? 0x6a5a8a : (kind === 'healer' ? 0xd8d8d0 : (kind === 'elder' ? 0x8aa870 : undefined)),
  });
  const a = {
    group: hum.group, parts: hum.parts, faction, kind, def,
    hp: def.hp * (opts.hpMul || 1), maxHp: def.hp * (opts.hpMul || 1),
    speed: def.speed, dead: false, deadT: 0, fallDir: 0,
    anchor: V3(x, 0, z), wanderT: 0, wanderTarget: null,
    target: null, attackCd: 0, thinkT: rnd() * 0.4, aggroOnPlayer: 0,
    lootGold: opts.loot != null ? opts.loot : (4 + (rnd() * 15) | 0), looted: false,
    squad: !!opts.squad, order: 'follow', assaultPos: null,
    patrol: opts.patrol || null, patrolI: 0,
    caravan: opts.caravan || null, formOff: opts.formOff || null,
    slot: opts.slot || null, lostArms: 0,
    walkPhase: rnd() * 6, swingT: 0,
  };
  a.group.position.set(x, terrainH(x, z), z);
  a.group.rotation.y = rnd() * Math.PI * 2;
  scene.add(a.group);
  actors.push(a);
  return a;
}

// кровища
const bloodGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
const bloodMat = new THREE.MeshBasicMaterial({ color: 0xa01010 });
function bloodSpray(pos, n = 8) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 240) break;
    const m = new THREE.Mesh(bloodGeo, bloodMat);
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      m, t: 0.65 + rnd() * 0.3,
      v: V3((rnd() - 0.5) * 5, 2 + rnd() * 3.5, (rnd() - 0.5) * 5),
    });
  }
}

function severLimb(a, name) {
  const pivot = a.parts[name];
  if (!pivot || !pivot.parent) return;
  pivot.updateWorldMatrix(true, false);
  const wp = V3(), wq = new THREE.Quaternion(), ws = V3();
  pivot.matrixWorld.decompose(wp, wq, ws);
  pivot.parent.remove(pivot);
  pivot.position.copy(wp); pivot.quaternion.copy(wq); pivot.scale.copy(ws);
  scene.add(pivot);
  looseLimbs.push({
    obj: pivot, t: 0,
    v: V3((rnd() - 0.5) * 6, 4.5 + rnd() * 2.5, (rnd() - 0.5) * 6),
    av: V3((rnd() - 0.5) * 9, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9),
    rest: false,
  });
  if (looseLimbs.length > 60) {
    const old = looseLimbs.shift();
    scene.remove(old.obj);
  }
  // культя
  const stump = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), bloodMat);
  const at = { armR: [0.34, 1.45, 0], armL: [-0.34, 1.45, 0], legR: [0.14, 0.86, 0], legL: [-0.14, 0.86, 0], head: [0, 1.56, 0] }[name];
  stump.position.set(at[0], at[1], at[2]);
  a.group.add(stump);
  delete a.parts[name];
  bloodSpray(wp, 14);
  sfx.sever();
}

function maybeDismember(a, heavy) {
  const candidates = ['armR', 'armL', 'legR', 'legL', 'head'].filter(n => a.parts[n]);
  if (!candidates.length) return;
  if (rnd() < (heavy ? 0.75 : 0.45)) {
    severLimb(a, candidates[(rnd() * candidates.length) | 0]);
  }
}

function killActor(a, byPlayer) {
  if (a.dead) return;
  a.dead = true; a.deadT = 0;
  a.fallDir = rnd() < 0.5 ? 1 : -1;
  corpses.push(a);
  if (corpses.length > 45) {
    const old = corpses.shift();
    const i = actors.indexOf(old);
    if (i >= 0) actors.splice(i, 1);
    scene.remove(old.group);
  }
  if (a.slot) respawnQueue.push({ t: nowT + 45 + rnd() * 20, slot: a.slot });
  if (byPlayer) onPlayerKill(a);
  if (a.kind === 'boss') addMsg('Злой повержен! Имя он так и не придумал.');
}

function applyDamage(a, dmg, source, fromDir) {
  if (a.dead) return;
  a.hp -= dmg;
  bloodSpray(V3().copy(a.group.position).add(V3(0, 1.3, 0)), 6);
  sfx.hit();
  if (source === 'P') a.aggroOnPlayer = nowT + 25;
  else if (source && source.faction) a.aggroActor = source;
  if (fromDir) {
    a.group.position.x += fromDir.x * 0.4;
    a.group.position.z += fromDir.z * 0.4;
  }
  if (a.hp <= 0) {
    maybeDismember(a, dmg >= 20);
    killActor(a, source === 'P');
  } else if (dmg >= 18 && rnd() < 0.2) {
    // отрубить руку живому — он продолжит драться одной
    const armN = a.def.ranged
      ? (a.parts.armR ? 'armR' : null)
      : (a.parts.armL ? 'armL' : (a.parts.armR ? 'armR' : null));
    if (armN) { severLimb(a, armN); a.lostArms++; addMsgRare('Ты отрубил ему руку — а он дерётся!'); }
  }
}

// ---------------------------------------------------------------------------
// ИИ
// ---------------------------------------------------------------------------
function targetPos(t) { return t === 'P' ? player.pos : t.group.position; }
function targetAlive(t) { return t === 'P' ? (state === 'playing' && !player.dead) : (!t.dead && actors.includes(t)); }

function findEnemy(a) {
  let best = null, bestD = 1e9;
  const ap = a.group.position;
  const aggro = a.def.aggro + (a.order === 'assault' ? 30 : 0);
  // игрок
  if (state === 'playing' && !player.dead && !a.squad) {
    const hostile = hostileF(a.faction, player.faction) || a.aggroOnPlayer > nowT;
    if (hostile) {
      const d = ap.distanceTo(player.pos);
      if (d < aggro && d < bestD) { best = 'P'; bestD = d; }
    }
  }
  for (const b of actors) {
    if (b === a || b.dead) continue;
    let hostile = hostileF(a.faction, b.faction);
    if (a.aggroActor === b) hostile = true;
    if (a.squad && hostileF(player.faction, b.faction)) hostile = true;
    if (b.squad && hostileF(a.faction, player.faction)) hostile = true;
    if (!hostile) continue;
    const d = ap.distanceTo(b.group.position);
    if (d < aggro && d < bestD) { best = b; bestD = d; }
  }
  return best;
}

function actorMoveTowards(a, tx, tz, dt, run = 1) {
  const dx = tx - a.group.position.x, dz = tz - a.group.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const sp = a.speed * run;
  a.group.position.x += (dx / d) * sp * dt;
  a.group.position.z += (dz / d) * sp * dt;
  a.group.rotation.y = Math.atan2(dx, dz);
  a.moving = true;
}

function shootArrow(from, dir, speed, dmg, source) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), lamb(0x8a6a40));
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  g.position.copy(from);
  scene.add(g);
  arrows.push({ g, v: dir.clone().multiplyScalar(speed), t: 0, dmg, source, stuck: 0 });
  sfx.bow();
}

function updateActor(a, dt) {
  if (a.dead) {
    // падение трупа — труп тоже 3д
    if (a.deadT < 0.5) {
      a.deadT += dt;
      const t = Math.min(1, a.deadT / 0.4);
      a.group.rotation.z = a.fallDir * (Math.PI / 2) * t;
      a.group.position.y = terrainH(a.group.position.x, a.group.position.z) + 0.25 * t;
    }
    return;
  }
  a.thinkT -= dt;
  a.attackCd -= dt;
  a.moving = false;
  const ap = a.group.position;

  if (a.thinkT <= 0) {
    a.thinkT = 0.35 + rnd() * 0.2;
    if (a.kind !== 'peasant' && a.kind !== 'shop' && a.kind !== 'healer') {
      const t = a.target;
      if (!t || !targetAlive(t) || ap.distanceTo(targetPos(t)) > a.def.aggro + 45) a.target = findEnemy(a);
    } else {
      // мирные: бегут от врагов и от нападающего игрока
      a.target = null;
      let threat = null;
      if (a.aggroOnPlayer > nowT) threat = player.pos;
      if (!threat) for (const b of actors) {
        if (b.dead || !b.def.dmg) continue;
        if ((b.target || b.aggroActor) && ap.distanceTo(b.group.position) < 14) { threat = b.group.position; break; }
      }
      a.threat = threat;
    }
  }

  const t = a.target;
  if (t && targetAlive(t)) {
    const tp = targetPos(t);
    const d = ap.distanceTo(tp);
    a.group.rotation.y = Math.atan2(tp.x - ap.x, tp.z - ap.z);
    if (a.def.ranged && d > 7 && d < a.def.aggro + 12) {
      // лучник — стреляет
      if (a.attackCd <= 0) {
        a.attackCd = 2.1 + rnd() * 0.7;
        a.swingT = 0.3;
        const from = V3(ap.x, ap.y + 1.45, ap.z);
        const to = V3(tp.x, tp.y + 1.2, tp.z);
        const dir = to.sub(from).normalize();
        dir.x += (rnd() - 0.5) * 0.06; dir.y += (rnd() - 0.5) * 0.04; dir.z += (rnd() - 0.5) * 0.06;
        shootArrow(from, dir.normalize(), 30, a.def.dmg + 4, a);
      }
      if (d < 9) actorMoveTowards(a, ap.x * 2 - tp.x, ap.z * 2 - tp.z, dt, 0.8);
    } else if (d > 2.1) {
      actorMoveTowards(a, tp.x, tp.z, dt, 1.15);
    } else if (a.attackCd <= 0) {
      a.attackCd = 1.15 + rnd() * 0.35;
      a.swingT = 0.35;
      const dmgMul = a.lostArms > 0 ? 0.55 : 1;
      if (t === 'P') hurtPlayer((a.def.dmg + rnd() * 4) * dmgMul, a);
      else applyDamage(t, (a.def.dmg + 3 + rnd() * 4) * dmgMul, a, null);
    }
  } else if (a.squad) {
    // отряд игрока
    if (a.order === 'assault' && a.assaultPos) {
      if (ap.distanceTo(a.assaultPos) > 8) actorMoveTowards(a, a.assaultPos.x, a.assaultPos.z, dt, 1.2);
    } else if (a.order === 'follow') {
      const d = ap.distanceTo(player.pos);
      if (d > 4.5) actorMoveTowards(a, player.pos.x + (rnd() - 0.5) * 2, player.pos.z + (rnd() - 0.5) * 2, dt, d > 14 ? 1.5 : 1);
    }
  } else if (a.assaultPos) {
    // волны набега
    if (ap.distanceTo(a.assaultPos) > 10) actorMoveTowards(a, a.assaultPos.x, a.assaultPos.z, dt, 1.1);
  } else if (a.caravan) {
    updateCaravanGuard(a, dt);
  } else if (a.patrol) {
    const wp = a.patrol[a.patrolI];
    if (Math.hypot(wp[0] - ap.x, wp[1] - ap.z) < 3) a.patrolI = (a.patrolI + 1) % a.patrol.length;
    else actorMoveTowards(a, wp[0], wp[1], dt, 0.7);
  } else if (a.threat) {
    // крестьянин бежит
    const dir = V3(ap.x - a.threat.x, 0, ap.z - a.threat.z).normalize();
    actorMoveTowards(a, ap.x + dir.x * 10, ap.z + dir.z * 10, dt, 1.4);
    if (ap.distanceTo(a.threat) > 26) a.threat = null;
  } else {
    // блуждание у якоря
    a.wanderT -= dt;
    if (a.wanderT <= 0) {
      a.wanderT = 3 + rnd() * 6;
      const r = a.kind === 'commander' || a.kind === 'elder' || a.kind === 'shop' || a.kind === 'healer' ? 3 : 16;
      a.wanderTarget = [a.anchor.x + (rnd() - 0.5) * r * 2, a.anchor.z + (rnd() - 0.5) * r * 2];
    }
    if (a.wanderTarget) {
      const d = Math.hypot(a.wanderTarget[0] - ap.x, a.wanderTarget[1] - ap.z);
      if (d > 1) actorMoveTowards(a, a.wanderTarget[0], a.wanderTarget[1], dt, 0.5);
    }
  }

  // столкновения и земля
  collideWorld(ap, 0.4, false);
  ap.x = clamp(ap.x, -HALF + 8, HALF - 8);
  ap.z = clamp(ap.z, -HALF + 8, HALF - 8);
  ap.y = terrainH(ap.x, ap.z);

  // анимация
  if (a.moving) {
    a.walkPhase += dt * 9;
    const sw = Math.sin(a.walkPhase) * 0.55;
    if (a.parts.legR) a.parts.legR.rotation.x = sw;
    if (a.parts.legL) a.parts.legL.rotation.x = -sw;
    if (a.parts.armR && a.swingT <= 0) a.parts.armR.rotation.x = -sw * 0.7;
    if (a.parts.armL) a.parts.armL.rotation.x = sw * 0.7;
  } else {
    if (a.parts.legR) a.parts.legR.rotation.x *= 0.8;
    if (a.parts.legL) a.parts.legL.rotation.x *= 0.8;
    if (a.parts.armL) a.parts.armL.rotation.x *= 0.8;
    if (a.parts.armR && a.swingT <= 0) a.parts.armR.rotation.x *= 0.8;
  }
  if (a.swingT > 0) {
    a.swingT -= dt;
    if (a.parts.armR) a.parts.armR.rotation.x = -2.4 * (a.swingT / 0.35);
  }
  // расталкивание
  for (const b of actors) {
    if (b === a || b.dead) continue;
    const dx = ap.x - b.group.position.x, dz = ap.z - b.group.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 0.7 && d2 > 0.0001) {
      const d = Math.sqrt(d2), push = (0.85 - d) * 0.5;
      ap.x += (dx / d) * push; ap.z += (dz / d) * push;
    }
  }
}

// ---------------------------------------------------------------------------
// Корованы (можно грабить)
// ---------------------------------------------------------------------------
const caravans = [];
const caravanLens = [];
(function precalcPath() {
  let acc = 0;
  caravanLens.push(0);
  for (let i = 0; i < CARAVAN_PATH.length - 1; i++) {
    acc += Math.hypot(CARAVAN_PATH[i + 1][0] - CARAVAN_PATH[i][0], CARAVAN_PATH[i + 1][1] - CARAVAN_PATH[i][1]);
    caravanLens.push(acc);
  }
})();
const CARAVAN_TOTAL = caravanLens[caravanLens.length - 1];
function caravanPosAt(s) {
  s = clamp(s, 0, CARAVAN_TOTAL);
  let i = 0;
  while (i < caravanLens.length - 2 && caravanLens[i + 1] < s) i++;
  const t = (s - caravanLens[i]) / (caravanLens[i + 1] - caravanLens[i]);
  const x = lerp(CARAVAN_PATH[i][0], CARAVAN_PATH[i + 1][0], t);
  const z = lerp(CARAVAN_PATH[i][1], CARAVAN_PATH[i + 1][1], t);
  return { x, z, dx: CARAVAN_PATH[i + 1][0] - CARAVAN_PATH[i][0], dz: CARAVAN_PATH[i + 1][1] - CARAVAN_PATH[i][1] };
}
function makeWagonUnit() {
  const g = new THREE.Group();
  // лошадь
  const horse = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 1.7), lamb(0x6a4a2e));
  body.position.y = 1.05; body.castShadow = true; horse.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.5), lamb(0x5c3f26));
  head.position.set(0, 1.5, 1.05); horse.add(head);
  const legs = [];
  for (const [lx, lz] of [[-0.22, 0.6], [0.22, 0.6], [-0.22, -0.6], [0.22, -0.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.75, 0.13), lamb(0x5c3f26));
    leg.position.set(lx, 0.37, lz);
    horse.add(leg); legs.push(leg);
  }
  horse.position.z = 2.4;
  g.add(horse);
  // повозка
  const wag = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 2.8), lamb(0x7a5a38));
  base.position.y = 0.95; base.castShadow = true; wag.add(base);
  const tarp = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.9, 2.3), lamb(0xd8cba8));
  tarp.position.y = 1.6; tarp.castShadow = true; wag.add(tarp);
  const wheels = [];
  for (const [wx, wz] of [[-0.8, 0.9], [0.8, 0.9], [-0.8, -0.9], [0.8, -0.9]]) {
    const wgeo = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 9);
    wgeo.rotateZ(Math.PI / 2);
    const wheel = new THREE.Mesh(wgeo, lamb(0x4a3320));
    wheel.position.set(wx, 0.45, wz);
    wag.add(wheel); wheels.push(wheel);
  }
  wag.position.z = -0.4;
  g.add(wag);
  scene.add(g);
  return { g, legs, wheels, tarp, cargo: 130 + (rnd() * 110) | 0, robbed: false };
}
function makeCaravan(startS) {
  const c = { s: startS, speed: 3.1, units: [makeWagonUnit(), makeWagonUnit()], guards: [], resetT: 0 };
  for (let i = 0; i < 3; i++) {
    const p = caravanPosAt(startS);
    const a = spawnActor('cguard', 'warrior', p.x + (rnd() - 0.5) * 4, p.z + (rnd() - 0.5) * 4,
      { caravan: c, formOff: [[2.2, 2], [-2.2, 2], [0, -7]][i], loot: 14 + (rnd() * 16) | 0 });
    c.guards.push(a);
  }
  caravans.push(c);
  return c;
}
function caravanThreatened(c) {
  return c.guards.some(g => !g.dead && (g.target || g.aggroOnPlayer > nowT));
}
function updateCaravanGuard(a, dt) {
  const c = a.caravan;
  const lead = caravanPosAt(c.s);
  const fx = lead.x + a.formOff[0], fz = lead.z + a.formOff[1];
  const d = Math.hypot(fx - a.group.position.x, fz - a.group.position.z);
  if (d > 2) actorMoveTowards(a, fx, fz, dt, d > 12 ? 1.4 : 0.9);
}
function updateCaravans(dt) {
  for (const c of caravans) {
    if (c.resetT > 0) {
      c.resetT -= dt;
      if (c.resetT <= 0) resetCaravan(c);
      continue;
    }
    const threatened = caravanThreatened(c);
    if (!threatened) c.s += c.speed * dt;
    if (c.s >= CARAVAN_TOTAL) {
      // доехал до дворца — новый корован выедет из деревни
      c.resetT = 25;
      for (const u of c.units) u.g.visible = false;
      continue;
    }
    c.units.forEach((u, i) => {
      const p = caravanPosAt(Math.max(0, c.s - i * 9));
      const y = terrainH(p.x, p.z);
      u.g.position.set(p.x, y, p.z);
      u.g.rotation.y = Math.atan2(p.dx, p.dz);
      if (!threatened) {
        const ph = c.s * 2.2;
        u.legs.forEach((l, j) => l.rotation.x = Math.sin(ph + j * Math.PI) * 0.6);
        u.wheels.forEach(w => w.rotation.x += dt * c.speed / 0.45);
      }
    });
  }
}
function resetCaravan(c) {
  c.s = 0;
  for (const u of c.units) {
    u.g.visible = true;
    u.cargo = 130 + (rnd() * 110) | 0;
    u.robbed = false;
    u.tarp.material = lamb(0xd8cba8);
  }
  // старая охрана уходит (живая или мёртвая), выезжает новая
  for (const g of c.guards) {
    const i = actors.indexOf(g); if (i >= 0) actors.splice(i, 1);
    const ci = corpses.indexOf(g); if (ci >= 0) corpses.splice(ci, 1);
    scene.remove(g.group);
  }
  c.guards = [];
  for (let i = 0; i < 3; i++) {
    const a = spawnActor('cguard', 'warrior', CARAVAN_PATH[0][0] + (rnd() - 0.5) * 4, CARAVAN_PATH[0][1] + (rnd() - 0.5) * 4,
      { caravan: c, formOff: [[2.2, 2], [-2.2, 2], [0, -7]][i], loot: 14 + (rnd() * 16) | 0 });
    c.guards.push(a);
  }
}

// ---------------------------------------------------------------------------
// Игрок
// ---------------------------------------------------------------------------
const player = {
  faction: 'elf', pos: V3(0, 0, 0), vel: V3(), yaw: 0, pitch: 0,
  hp: 100, maxHp: 100, gold: 60, arrows: 0, bandages: 1, potions: 1,
  weapon: 'sword', swordLvl: 1, hasBow: false,
  arm: 'ok', eye: 'ok', leg: 'ok', bleeding: false,
  dead: false, attackCd: 0, onGround: true, bobT: 0,
};
let state = 'menu'; // menu | playing
let questIdx = 0, quest = null;
let nowT = 0;

function playerBase() {
  return player.faction === 'elf' ? ELF_VILLAGE : player.faction === 'guard' ? PALACE : FORT;
}
function playerHeight() {
  if (player.leg === 'lost') return 0.6;
  if (player.leg === 'wheel') return 1.15;
  return 1.65;
}
function playerSpeed(sprint) {
  let s = sprint ? 9.6 : 6.4;
  if (player.leg === 'lost') s = 1.8;
  else if (player.leg === 'wheel') s = 4.6;
  else if (player.leg === 'prost') s *= 0.92;
  return s;
}
function canJump() { return player.leg === 'ok' || player.leg === 'prost'; }
function canBow() { return player.hasBow && player.arm !== 'lost'; }

function hurtPlayer(dmg, source) {
  if (player.dead || state !== 'playing') return;
  player.hp -= dmg;
  sfx.hurt();
  ui.flash.style.opacity = 0.45;
  setTimeout(() => ui.flash.style.opacity = 0, 120);
  // расчленёнка игрока: не только убить могут
  if (player.hp > 0 && dmg >= 11 && player.hp < 55 && rnd() < 0.14) {
    const opts = [];
    if (player.arm === 'ok') opts.push('arm');
    if (player.eye === 'ok') opts.push('eye');
    if (player.leg === 'ok' || player.leg === 'prost') opts.push('leg');
    if (opts.length) applyInjury(opts[(rnd() * opts.length) | 0]);
  }
  if (player.hp <= 0) playerDie(source && source.def ? 'Тебя убил ' + source.def.label + ' (' + factionLabel(source.faction) + ').' : 'Тебя убили.');
}
function applyInjury(kind) {
  sfx.sever();
  if (kind === 'arm') {
    player.arm = 'lost'; player.bleeding = true;
    if (player.weapon === 'bow') player.weapon = 'sword';
    addMsg('!!! Тебе ОТРУБИЛИ РУКУ! Перевяжись [X], иначе истечёшь кровью. Лекарь продаст протез.');
  } else if (kind === 'eye') {
    player.eye = 'lost';
    ui.eyeOverlay.style.display = 'block';
    addMsg('!!! Тебе ВЫКОЛОЛИ ГЛАЗ! Пол-экрана не видно. Лекарь продаст стеклянный глаз.');
  } else {
    player.leg = 'lost'; player.bleeding = true;
    addMsg('!!! Тебе ОТРУБИЛИ НОГУ! Ты ползаешь. Лекарь: коляска или протез. И перевяжись [X]!');
  }
  updateWeaponVM();
  refreshHUD();
}
function playerDie(reason) {
  if (player.dead) return;
  player.dead = true;
  player.hp = 0;
  // труп игрока — тоже 3д
  const hum = makeHumanoid(FPRESET[player.faction], { weapon: 'sword' });
  hum.group.position.set(player.pos.x, terrainH(player.pos.x, player.pos.z) + 0.25, player.pos.z);
  hum.group.rotation.z = Math.PI / 2;
  hum.group.rotation.y = player.yaw;
  scene.add(hum.group);
  setTimeout(() => scene.remove(hum.group), 120000);
  document.exitPointerLock();
  ui.hintText.classList.add('hidden');
  ui.deathReason.textContent = reason + (hasSave() ? ' Но сохранение помнит тебя живым.' : ' Сохранений нет — как завещал Кирилл, надо было сохранятся.');
  $('btnDeathLoad').style.display = hasSave() ? 'block' : 'none';
  ui.death.classList.remove('hidden');
}

// оружие от первого лица
const vm = new THREE.Group();
camera.add(vm);
scene.add(camera);
const vmSword = makeSwordMesh(1.1);
vmSword.position.set(0.34, -0.42, -0.62);
vmSword.rotation.set(Math.PI - 0.55, -0.3, 0.18);
const vmBow = makeBowMesh();
vmBow.position.set(0.33, -0.28, -0.5);
vmBow.rotation.set(0.1, -1.15, -0.12);
vmBow.scale.setScalar(0.3);
vm.add(vmSword); vm.add(vmBow);
let vmSwing = 0;
vm.visible = false;
function updateWeaponVM() {
  vm.visible = state === 'playing';
  vmSword.visible = player.weapon === 'sword';
  vmBow.visible = player.weapon === 'bow' && canBow();
}

function playerAttack() {
  if (player.attackCd > 0 || player.dead) return;
  if (player.weapon === 'bow') {
    if (!canBow()) { addMsg('Лук не натянуть без руки.'); player.weapon = 'sword'; updateWeaponVM(); return; }
    if (player.arrows <= 0) { addMsg('Стрелы кончились. Купи в лавке.'); return; }
    player.attackCd = 0.8;
    player.arrows--;
    vmSwing = 0.25;
    const dir = V3(); camera.getWorldDirection(dir);
    shootArrow(V3().copy(camera.position).add(dir.clone().multiplyScalar(0.5)), dir, 44, 27, 'P');
    refreshHUD();
    return;
  }
  player.attackCd = 0.55;
  vmSwing = 0.32;
  sfx.swing();
  const dmgBase = (16 + 9 * (player.swordLvl - 1)) * (player.arm === 'lost' ? 0.55 : 1);
  const fwd = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  let hits = 0;
  for (const a of actors) {
    if (a.dead || hits >= 2) continue;
    const to = V3().subVectors(a.group.position, player.pos);
    to.y = 0;
    const d = to.length();
    if (d > 2.9) continue;
    to.normalize();
    if (to.dot(fwd) < 0.55) continue;
    applyDamage(a, dmgBase + rnd() * 5, 'P', to);
    hits++;
  }
}

// ---------------------------------------------------------------------------
// Столкновения
// ---------------------------------------------------------------------------
function collideWorld(p, r, withTrees) {
  for (const c of colliders) {
    const cx = clamp(p.x, c.minx, c.maxx), cz = clamp(p.z, c.minz, c.maxz);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // внутри бокса — вытолкнуть к ближайшей грани
        const dl = p.x - c.minx, drt = c.maxx - p.x, dn = p.z - c.minz, ds = c.maxz - p.z;
        const m = Math.min(dl, drt, dn, ds);
        if (m === dl) p.x = c.minx - r; else if (m === drt) p.x = c.maxx + r;
        else if (m === dn) p.z = c.minz - r; else p.z = c.maxz + r;
      }
    }
  }
  if (withTrees) {
    const cx = (p.x / GRID) | 0, cz = (p.z / GRID) | 0;
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
      const cell = treeGrid.get(gx + '_' + gz);
      if (!cell) continue;
      for (const t of cell) {
        const dx = p.x - t.x, dz = p.z - t.z;
        const rr = 0.35 * t.s + r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = t.x + (dx / d) * rr;
          p.z = t.z + (dz / d) * rr;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Управление
// ---------------------------------------------------------------------------
const keys = {};
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  keys[e.code] = true;
  if (state !== 'playing') return;
  if (shopOpen) {
    if (e.code === 'KeyE' || e.code === 'Escape') closeShop();
    return;
  }
  if (player.dead) return;
  switch (e.code) {
    case 'Digit1': player.weapon = 'sword'; updateWeaponVM(); refreshHUD(); break;
    case 'Digit2':
      if (canBow()) { player.weapon = 'bow'; updateWeaponVM(); refreshHUD(); }
      else addMsg(player.hasBow ? 'Без руки из лука не постреляешь. Купи протез у лекаря.' : 'Лука нет. Купи в лавке.');
      break;
    case 'KeyE': doInteract(); break;
    case 'KeyQ':
      if (player.potions > 0 && player.hp < player.maxHp) {
        player.potions--; player.hp = Math.min(player.maxHp, player.hp + 50);
        sfx.drink(); addMsg('Выпил зелье: +50 здоровья.'); refreshHUD();
      }
      break;
    case 'KeyX':
      if (player.bleeding) {
        if (player.bandages > 0) { player.bandages--; player.bleeding = false; addMsg('Рана перевязана. Жить будешь.'); refreshHUD(); }
        else addMsg('Нет бинтов! Купи у лекаря или в лавке.');
      }
      break;
    case 'KeyF': squadOrder('follow'); break;
    case 'KeyG': squadOrder('hold'); break;
    case 'KeyT': squadOrder('assault'); break;
    case 'KeyK': saveGame(); break;
  }
});
addEventListener('keyup', (e) => keys[e.code] = false);
addEventListener('mousedown', (e) => {
  if (state !== 'playing' || !pointerLocked || player.dead) return;
  if (e.button === 0) playerAttack();
});
addEventListener('mousemove', (e) => {
  if (!pointerLocked || state !== 'playing') return;
  player.yaw -= e.movementX * 0.0023;
  player.pitch = clamp(player.pitch - e.movementY * 0.0023, -1.45, 1.45);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

let pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (!pointerLocked && state === 'playing' && !player.dead && !shopOpen && !suppressPause) {
    ui.pause.classList.remove('hidden');
  }
  if (pointerLocked) {
    ui.pause.classList.add('hidden');
    ui.lockHint.classList.add('hidden');
  }
});
let suppressPause = false;
function requestLock() {
  const p = renderer.domElement.requestPointerLock();
  if (p && p.catch) p.catch(() => { ui.lockHint.classList.remove('hidden'); });
}
ui.lockHint.addEventListener('click', () => { audioInit(); requestLock(); });

// ---------------------------------------------------------------------------
// Отряд
// ---------------------------------------------------------------------------
function mySquad() { return actors.filter(a => a.squad && !a.dead); }
function squadOrder(ord) {
  const sq = mySquad();
  if (!sq.length) { addMsg('У тебя нет отряда. Найми бойцов в лавке своей базы.'); return; }
  if (ord === 'assault') {
    let target;
    if (quest && quest.def.type === 'kill') target = ZONES[quest.def.zone].c;
    else target = player.faction === 'guard' ? FORT : PALACE;
    for (const a of sq) { a.order = 'assault'; a.assaultPos = V3(target.x, 0, target.z); }
    addMsg('»» Приказ отряду: В АТАКУ! Войско пойдёт в атаку с тобой самим.');
  } else if (ord === 'hold') {
    for (const a of sq) { a.order = 'hold'; a.assaultPos = null; a.anchor.copy(a.group.position); }
    addMsg('Приказ отряду: стоять здесь.');
  } else {
    for (const a of sq) { a.order = 'follow'; a.assaultPos = null; }
    addMsg('Приказ отряду: за мной.');
  }
}

// ---------------------------------------------------------------------------
// Взаимодействие
// ---------------------------------------------------------------------------
let currentInteract = null;
function scanInteract() {
  currentInteract = null;
  if (player.dead) return;
  let best = null, bestD = 2.9;
  for (const a of actors) {
    const d = player.pos.distanceTo(a.group.position);
    if (d > bestD) continue;
    if (a.dead) {
      if (!a.looted && a.lootGold > 0) { best = { type: 'corpse', a }; bestD = d; }
    } else if (a.kind === 'shop') { best = { type: 'shop', a }; bestD = d; }
    else if (a.kind === 'healer') { best = { type: 'healer', a }; bestD = d; }
    else if (a.kind === 'commander' && player.faction === 'guard') { best = { type: 'commander', a }; bestD = d; }
    else if (a.kind === 'elder' && player.faction === 'elf') { best = { type: 'commander', a }; bestD = d; }
  }
  for (const c of caravans) {
    if (c.resetT > 0) continue;
    for (const u of c.units) {
      if (u.robbed || !u.g.visible) continue;
      const d = player.pos.distanceTo(u.g.position);
      if (d < bestD + 1.2) { best = { type: 'wagon', c, u }; bestD = d; }
    }
  }
  currentInteract = best;
  if (best) {
    const label = {
      corpse: '[E] Обыскать труп',
      shop: '[E] Лавка — можно покупать как в Daggerfall',
      healer: '[E] Лекарь — лечение и протезы',
      commander: player.faction === 'guard' ? '[E] Поговорить с командиром' : '[E] Поговорить со старейшиной',
      wagon: '[E] ГРАБИТЬ КОРОВАН',
    }[best.type];
    ui.hintText.textContent = label;
    ui.hintText.classList.remove('hidden');
  } else {
    ui.hintText.classList.add('hidden');
  }
}
function doInteract() {
  const it = currentInteract;
  if (!it) return;
  if (it.type === 'corpse') {
    player.gold += it.a.lootGold;
    addMsg('Обыскал труп: +' + it.a.lootGold + ' золота.');
    it.a.looted = true; it.a.lootGold = 0;
    sfx.coin(); refreshHUD();
  } else if (it.type === 'wagon') {
    const c = it.c;
    const guardsAlive = c.guards.filter(g => !g.dead);
    if (guardsAlive.length) {
      for (const g of guardsAlive) { g.aggroOnPlayer = nowT + 40; g.target = 'P'; }
      addMsg('Охрана корована защищает груз! Перебей её.');
    } else {
      it.u.robbed = true;
      it.u.tarp.material = lamb(0x8a8578);
      player.gold += it.u.cargo;
      addMsg('КОРОВАН ОГРАБЛЕН! +' + it.u.cargo + ' золота. Кирилл гордится тобой.');
      sfx.coin();
      onRobbed();
      refreshHUD();
    }
  } else if (it.type === 'shop') openShop('shop', it.a);
  else if (it.type === 'healer') openShop('healer', it.a);
  else if (it.type === 'commander') talkCommander();
}

// ---------------------------------------------------------------------------
// Лавки (можно покупать и т.п. возможности как в Daggerfall)
// ---------------------------------------------------------------------------
let shopOpen = false;
function shopItems(kind, npc) {
  const items = [];
  if (kind === 'healer') {
    items.push({ n: 'Лечение ран', p: 30, ok: player.hp < player.maxHp, f: () => { player.hp = player.maxHp; } });
    items.push({ n: 'Бинт', p: 15, ok: true, f: () => player.bandages++ });
    items.push({ n: 'Зелье здоровья', p: 25, ok: true, f: () => player.potions++ });
    if (player.arm === 'lost') items.push({ n: 'Протез руки', p: 120, ok: true, f: () => { player.arm = 'prost'; addMsg('Протез руки поставлен. Лук снова слушается.'); } });
    if (player.eye === 'lost') items.push({ n: 'Стеклянный глаз', p: 100, ok: true, f: () => { player.eye = 'prost'; ui.eyeOverlay.style.display = 'none'; addMsg('Стеклянный глаз на месте. Видно весь экран!'); } });
    if (player.leg === 'lost') items.push({ n: 'Коляска (кататься)', p: 60, ok: true, f: () => { player.leg = 'wheel'; addMsg('Теперь катаешься на коляске.'); } });
    if (player.leg === 'lost' || player.leg === 'wheel') items.push({ n: 'Протез ноги (самое хорошее)', p: 150, ok: true, f: () => { player.leg = 'prost'; addMsg('Протез ноги поставлен — снова бегаешь и прыгаешь!'); } });
  } else {
    items.push({ n: 'Зелье здоровья', p: 25, ok: true, f: () => player.potions++ });
    items.push({ n: 'Бинт', p: 15, ok: true, f: () => player.bandages++ });
    items.push({ n: 'Стрелы ×20', p: 30, ok: true, f: () => player.arrows += 20 });
    if (!player.hasBow) items.push({ n: 'Лук', p: 90, ok: true, f: () => { player.hasBow = true; addMsg('Лук куплен. Клавиша 2.'); } });
    if (player.swordLvl < 3) items.push({
      n: player.swordLvl === 1 ? 'Меч получше (II)' : 'Меч императорский (III)',
      p: player.swordLvl === 1 ? 140 : 260, ok: true, f: () => { player.swordLvl++; addMsg('Меч стал острее!'); }
    });
    const base = playerBase();
    if (npc && Math.hypot(npc.anchor.x - base.x, npc.anchor.z - base.z) < 120) {
      items.push({
        n: 'Нанять бойца в отряд', p: 60, ok: mySquad().length < 6, f: () => {
          const a = spawnActor(player.faction, 'warrior', player.pos.x + (rnd() - 0.5) * 4, player.pos.z + 2, { squad: true, hpMul: 1.2 });
          a.order = 'follow';
          addMsg('Боец нанят. Отряд: ' + mySquad().length + '/6. Приказы: F/G/T.');
          onRecruit();
        }
      });
    }
  }
  return items;
}
let shopNpc = null, shopKind = 'shop';
function openShop(kind, npc) {
  shopOpen = true; shopKind = kind; shopNpc = npc;
  suppressPause = true;
  document.exitPointerLock();
  setTimeout(() => suppressPause = false, 300);
  ui.shopTitle.textContent = kind === 'healer' ? 'ЛЕКАРЬ' : 'ЛАВКА';
  renderShop();
  ui.shop.classList.remove('hidden');
}
function renderShop() {
  ui.shopGold.textContent = 'Твоё золото: ' + player.gold;
  ui.shopItems.innerHTML = '';
  for (const it of shopItems(shopKind, shopNpc)) {
    const b = document.createElement('button');
    b.className = 'pbtn';
    b.innerHTML = it.n + '<span class="price">' + it.p + ' з.</span>';
    b.disabled = !it.ok || player.gold < it.p;
    b.onclick = () => {
      if (player.gold < it.p) return;
      player.gold -= it.p;
      it.f();
      sfx.coin();
      updateWeaponVM();
      refreshHUD();
      renderShop();
    };
    ui.shopItems.appendChild(b);
  }
}
function closeShop() {
  shopOpen = false;
  ui.shop.classList.add('hidden');
  ui.lockHint.classList.remove('hidden');
}
$('shopClose').addEventListener('click', closeShop);

// ---------------------------------------------------------------------------
// Квесты и приказы
// ---------------------------------------------------------------------------
const QUESTS = {
  guard: [
    { type: 'patrol', text: 'Патрулируй стены: обойди два поста (маркер на карте).', pts: [[482, -482], [378, -378]], reward: 50 },
    { type: 'wave', text: 'ТРЕВОГА! Шпионы и партизаны эльфов вместе со слугами Злого набигают на дворец. Защити его!', reward: 130, attackers: [['elf', 'archer'], ['elf', 'warrior'], ['elf', 'spy'], ['villain', 'warrior'], ['villain', 'warrior'], ['villain', 'warrior']] },
    { type: 'kill', text: 'Набег на лес: командир велел нагибать эльфов-партизан. Убей 4 в их зоне.', f: 'elf', zone: 'elves', n: 4, reward: 130 },
    { type: 'kill', text: 'Вылазка в горы: перебей 4 разбойников Злого у старого форта.', f: 'villain', zone: 'villain', n: 4, reward: 150 },
  ],
  elf: [
    { type: 'rob', text: 'Старейшина: «Ограбь корован на тракте — лесу нужно золото».', reward: 90 },
    { type: 'wave', text: 'Солдаты дворца и злодеи набигают на деревяные домики! Нагибай их!', reward: 130, attackers: [['guard', 'warrior'], ['guard', 'warrior'], ['guard', 'warrior'], ['villain', 'warrior'], ['villain', 'warrior']] },
    { type: 'kill', text: 'Партизанская вылазка: убей 4 стражников у дворца.', f: 'guard', zone: 'palace', n: 4, reward: 140 },
    { type: 'kill', text: 'Диверсия: убей 4 разбойников Злого в горах.', f: 'villain', zone: 'villain', n: 4, reward: 150 },
  ],
  villain: [
    { type: 'recruit', text: 'Ты сам себе командир. Найми 2 бойцов в лавке форта — будет своё войско.', n: 2, reward: 60 },
    { type: 'kill', text: 'ШТУРМ ДВОРЦА! Прикажи войску [T] напасть на дворец и пойди в атаку сам. Убей 6 стражников.', f: 'guard', zone: 'palace', n: 6, reward: 280 },
    { type: 'rob', text: 'Перехвати корован на тракте — Императору ничего не достанется.', reward: 120 },
    { type: 'wave', text: 'Шпионы и партизаны эльфов напали на форт! Отбей атаку!', reward: 140, attackers: [['elf', 'archer'], ['elf', 'archer'], ['elf', 'warrior'], ['elf', 'warrior'], ['elf', 'spy']] },
  ],
};
function assignQuest(idx) {
  const defs = QUESTS[player.faction];
  questIdx = idx % defs.length;
  const def = defs[questIdx];
  quest = { def, progress: 0, done: false, waveActors: [], patrolI: 0 };
  if (def.type === 'wave') spawnWave(def.attackers, playerBase());
  addMsg('► ' + (player.faction === 'villain' ? 'ПЛАН: ' : 'ПРИКАЗ: ') + def.text);
  sfx.quest();
  refreshOrder();
}
function spawnWave(list, base) {
  for (const [f, k] of list) {
    const enemyBase = f === 'elf' ? ELF_VILLAGE : f === 'guard' ? PALACE : FORT;
    const dir = V3(enemyBase.x - base.x, 0, enemyBase.z - base.z).normalize();
    const x = base.x + dir.x * (120 + rnd() * 30) + (rnd() - 0.5) * 40;
    const z = base.z + dir.z * (120 + rnd() * 30) + (rnd() - 0.5) * 40;
    const a = spawnActor(f, k, clamp(x, -780, 780), clamp(z, -780, 780));
    a.assaultPos = V3(base.x, 0, base.z);
    a.def = Object.assign({}, a.def, { aggro: 55 });
    quest.waveActors.push(a);
  }
}
function questComplete() {
  quest.done = true;
  if (player.faction === 'villain') {
    player.gold += quest.def.reward;
    addMsg('>> План выполнен! +' + quest.def.reward + ' золота. Ты сам себе командир.');
    sfx.coin();
    saveGame(true);
    setTimeout(() => { if (state === 'playing' && quest && quest.done) assignQuest(questIdx + 1 === QUESTS.villain.length ? 1 : questIdx + 1); }, 5000);
  } else {
    addMsg('>> Выполнено! Вернись к ' + (player.faction === 'guard' ? 'командиру' : 'старейшине') + ' за наградой.');
    sfx.quest();
  }
  refreshOrder(); refreshHUD();
}
function talkCommander() {
  if (!quest) { assignQuest(questIdx); return; }
  if (quest.done) {
    player.gold += quest.def.reward;
    addMsg('Награда за службу: +' + quest.def.reward + ' золота.');
    sfx.coin();
    saveGame(true);
    const len = QUESTS[player.faction].length;
    assignQuest(questIdx + 1 >= len ? 1 : questIdx + 1);
    refreshHUD();
  } else {
    addMsg(player.faction === 'guard' ? 'Командир: «Выполняй приказ, солдат!»' : 'Старейшина: «Лес ждёт, дитя».');
  }
}
function onPlayerKill(a) {
  if (!quest || quest.done) return;
  const d = quest.def;
  if (d.type === 'kill' && a.faction === d.f && zoneOf(a.group.position.x, a.group.position.z) === d.zone) {
    quest.progress++;
    if (quest.progress >= d.n) questComplete();
    else { addMsg('Цель: ' + quest.progress + '/' + d.n); refreshOrder(); }
  }
}
function onRobbed() {
  if (quest && !quest.done && quest.def.type === 'rob') questComplete();
}
function onRecruit() {
  if (quest && !quest.done && quest.def.type === 'recruit' && mySquad().length >= quest.def.n) questComplete();
}
function questTargetPos() {
  if (!quest) return null;
  const d = quest.def;
  if (quest.done) {
    if (player.faction === 'villain') return null;
    const cmd = actors.find(a => !a.dead && (a.kind === 'commander' || a.kind === 'elder') && a.faction === player.faction);
    return cmd ? cmd.group.position : null;
  }
  if (d.type === 'patrol') { const p = d.pts[quest.patrolI]; return p ? V3(p[0], 0, p[1]) : null; }
  if (d.type === 'wave') { const b = playerBase(); return V3(b.x, 0, b.z); }
  if (d.type === 'kill') { const c = ZONES[d.zone].c; return V3(c.x, 0, c.z); }
  if (d.type === 'rob') {
    for (const c of caravans) if (c.resetT <= 0) for (const u of c.units) if (!u.robbed && u.g.visible) return u.g.position;
    return null;
  }
  if (d.type === 'recruit') { const b = playerBase(); return V3(b.x, 0, b.z); }
  return null;
}
function updateQuest(dt) {
  if (!quest || quest.done) return;
  const d = quest.def;
  if (d.type === 'patrol') {
    const p = d.pts[quest.patrolI];
    if (p && Math.hypot(p[0] - player.pos.x, p[1] - player.pos.z) < 8) {
      quest.patrolI++;
      if (quest.patrolI >= d.pts.length) questComplete();
      else { addMsg('Пост пройден. Следующий — на карте.'); refreshOrder(); }
    }
  } else if (d.type === 'wave') {
    if (quest.waveActors.length && quest.waveActors.every(a => a.dead)) questComplete();
  }
}

// внезапные набеги (шпионы или партизаны эльфов иногда нападают)
let raidT = 0;
let raidActors = [];
function updateRaids(dt) {
  if (state !== 'playing' || player.dead) return;
  raidT -= dt;
  if (raidT > 0) return;
  raidT = 120 + rnd() * 70;
  if (quest && !quest.done && quest.def.type === 'wave') return;
  if (raidActors.some(a => !a.dead)) return;
  const enemies = { elf: ['guard', 'villain'], guard: ['elf', 'villain'], villain: ['elf', 'elf'] }[player.faction];
  const f = enemies[(rnd() * enemies.length) | 0];
  const base = playerBase();
  raidActors = [];
  const n = 2 + (rnd() * 2) | 0;
  for (let i = 0; i < n; i++) {
    const enemyBase = f === 'elf' ? ELF_VILLAGE : f === 'guard' ? PALACE : FORT;
    const dir = V3(enemyBase.x - base.x, 0, enemyBase.z - base.z).normalize();
    const a = spawnActor(f, rnd() < 0.3 ? 'spy' : 'warrior',
      clamp(base.x + dir.x * 110 + (rnd() - 0.5) * 30, -780, 780),
      clamp(base.z + dir.z * 110 + (rnd() - 0.5) * 30, -780, 780));
    a.assaultPos = V3(base.x, 0, base.z);
    raidActors.push(a);
  }
  addMsg('!!! ' + factionLabel(f).toUpperCase() + ' НАБИГАЮТ на твою базу!');
}

// ---------------------------------------------------------------------------
// Население баз
// ---------------------------------------------------------------------------
const baseSlots = [];
function defineBase(faction, center, slots) {
  for (const s of slots) {
    const slot = { faction, center, kind: s.kind, patrol: s.patrol, alive: null };
    baseSlots.push(slot);
    spawnSlot(slot, true);
  }
}
function spawnSlot(slot, initial) {
  const r = 24;
  const x = clamp(slot.center.x + (wr() - 0.5) * r * 2, -780, 780);
  const z = clamp(slot.center.z + (wr() - 0.5) * r * 2, -780, 780);
  const a = spawnActor(slot.faction, slot.kind, x, z, { slot, patrol: slot.patrol });
  slot.alive = a;
  return a;
}
function initPopulation() {
  defineBase('guard', PALACE, [
    { kind: 'commander' }, { kind: 'shop' }, { kind: 'healer' },
    { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' },
    { kind: 'warrior', patrol: [[365, -495], [495, -495], [495, -365], [365, -365]] },
    { kind: 'warrior', patrol: [[352, -430], [300, -380]] },
    { kind: 'archer' }, { kind: 'archer' },
  ]);
  defineBase('elf', ELF_VILLAGE, [
    { kind: 'elder' }, { kind: 'shop' }, { kind: 'healer' },
    { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' },
    { kind: 'archer' }, { kind: 'archer' }, { kind: 'archer' }, { kind: 'archer' },
  ]);
  defineBase('villain', FORT, [
    { kind: 'shop' }, { kind: 'healer' },
    { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'warrior' },
    { kind: 'warrior' }, { kind: 'warrior' }, { kind: 'spy' }, { kind: 'spy' },
  ]);
  defineBase('peasant', HUMAN_VILLAGE, [
    { kind: 'shop' }, { kind: 'healer' },
    { kind: 'peasant' }, { kind: 'peasant' }, { kind: 'peasant' }, { kind: 'peasant' }, { kind: 'peasant' }, { kind: 'peasant' },
  ]);
  makeCaravan(CARAVAN_TOTAL * 0.15);
  makeCaravan(CARAVAN_TOTAL * 0.6);
}
function bossSpawnIfNeeded() {
  // Злой сидит в форте, если игрок не он сам
  if (player.faction !== 'villain' && !actors.some(a => a.kind === 'boss' && !a.dead)) {
    spawnActor('villain', 'boss', FORT.x + 10, FORT.z, { loot: 120 });
  }
}
function updateRespawns() {
  for (let i = respawnQueue.length - 1; i >= 0; i--) {
    const r = respawnQueue[i];
    if (nowT >= r.t) {
      respawnQueue.splice(i, 1);
      spawnSlot(r.slot, false);
    }
  }
}

// ---------------------------------------------------------------------------
// Сохранения (сохранятся можно)
// ---------------------------------------------------------------------------
const SAVE_KEY = 'korovany_fable51_save';
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function saveGame(silent) {
  if (state !== 'playing' || player.dead) return;
  const data = {
    v: 1, faction: player.faction,
    x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw,
    hp: player.hp, gold: player.gold, arrows: player.arrows,
    bandages: player.bandages, potions: player.potions,
    weapon: player.weapon, swordLvl: player.swordLvl, hasBow: player.hasBow,
    arm: player.arm, eye: player.eye, leg: player.leg, bleeding: player.bleeding,
    questIdx, squad: mySquad().length,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    ui.savedToast.style.opacity = 1;
    setTimeout(() => ui.savedToast.style.opacity = 0, 1200);
    if (!silent) addMsg('Игра сохранена.');
  } catch (e) { addMsg('Не удалось сохранить: ' + e.message); }
}
function loadSaveData() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const msgList = [];
function addMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.textContent = text;
  ui.msgs.appendChild(div);
  msgList.push(div);
  if (msgList.length > 6) { const d = msgList.shift(); d.remove(); }
  setTimeout(() => { div.style.transition = 'opacity 1s'; div.style.opacity = 0; }, 5200);
  setTimeout(() => { div.remove(); const i = msgList.indexOf(div); if (i >= 0) msgList.splice(i, 1); }, 6300);
}
let lastRareMsg = 0;
function addMsgRare(t) { if (nowT - lastRareMsg > 8) { lastRareMsg = nowT; addMsg(t); } }

function refreshHUD() {
  ui.hpFill.style.width = clamp(player.hp / player.maxHp * 100, 0, 100) + '%';
  ui.hpText.textContent = 'Здоровье: ' + Math.max(0, Math.ceil(player.hp)) + ' / ' + player.maxHp;
  const inj = [];
  if (player.arm === 'lost') inj.push('[РУКА] Отрублена — лук недоступен, урон ниже');
  if (player.arm === 'prost') inj.push('[РУКА] Протез');
  if (player.eye === 'lost') inj.push('[ГЛАЗ] Выколот — пол-экрана не видно');
  if (player.eye === 'prost') inj.push('[ГЛАЗ] Стеклянный');
  if (player.leg === 'lost') inj.push('[НОГА] Отрублена — ползком');
  if (player.leg === 'wheel') inj.push('[НОГА] Коляска');
  if (player.leg === 'prost') inj.push('[НОГА] Протез');
  ui.injuryList.innerHTML = inj.join('<br>');
  ui.bleedWarn.classList.toggle('hidden', !player.bleeding);
  const wName = player.weapon === 'bow' ? 'Лук' : ['', 'Меч I', 'Меч II', 'Меч III'][player.swordLvl];
  ui.statusBR.innerHTML =
    '<span class="gold">🪙 ' + player.gold + '</span><br>' +
    wName + (player.hasBow ? ' · стрелы: ' + player.arrows : '') + '<br>' +
    '<span class="dim">[Q] зелья: ' + player.potions + ' · [X] бинты: ' + player.bandages + '</span><br>' +
    '<span class="dim">Отряд: ' + mySquad().length + '/6 [F/G/T]</span>';
}
function refreshOrder() {
  ui.orderTitle.textContent = player.faction === 'villain' ? 'ТВОЙ ПЛАН (ты сам себе командир)' : 'ПРИКАЗ ' + (player.faction === 'guard' ? 'КОМАНДИРА' : 'СТАРЕЙШИНЫ');
  if (!quest) {
    ui.orderText.textContent = player.faction === 'guard' ? 'Найди командира во дворце и слушайся его.' :
      player.faction === 'elf' ? 'Поговори со старейшиной в лесной деревне.' : 'Придумай план...';
    ui.orderProg.textContent = '';
    return;
  }
  ui.orderText.textContent = quest.def.text;
  const d = quest.def;
  let prog = '';
  if (quest.done) prog = player.faction === 'villain' ? '>> Выполнено!' : '>> Выполнено — вернись за наградой';
  else if (d.type === 'kill') prog = 'Убито: ' + quest.progress + ' / ' + d.n;
  else if (d.type === 'patrol') prog = 'Посты: ' + quest.patrolI + ' / ' + d.pts.length;
  else if (d.type === 'wave') prog = 'Врагов осталось: ' + quest.waveActors.filter(a => !a.dead).length;
  else if (d.type === 'recruit') prog = 'Отряд: ' + mySquad().length + ' / ' + d.n;
  ui.orderProg.textContent = prog;
}

// миникарта
const mmStatic = document.createElement('canvas');
mmStatic.width = 170; mmStatic.height = 170;
(function drawMMStatic() {
  const c = mmStatic.getContext('2d');
  const m = (x, z) => [(x + HALF) / (HALF * 2) * 170, (z + HALF) / (HALF * 2) * 170];
  c.fillStyle = '#2e4d2b'; c.fillRect(0, 0, 85, 85);        // лес
  c.fillStyle = '#57683c'; c.fillRect(85, 0, 85, 85);        // дворец
  c.fillStyle = '#5d6a40'; c.fillRect(0, 85, 85, 85);        // люди
  c.fillStyle = '#57524a'; c.fillRect(85, 85, 85, 85);       // горы
  c.strokeStyle = '#b99f6b'; c.lineWidth = 2;
  for (const poly of ROADS) {
    c.beginPath();
    poly.forEach((p, i) => { const [x, y] = m(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
  }
  const hub = (p, col) => { const [x, y] = m(p.x, p.z); c.fillStyle = col; c.fillRect(x - 4, y - 4, 8, 8); };
  hub(ELF_VILLAGE, '#3e8a3e'); hub(PALACE, '#c02020'); hub(HUMAN_VILLAGE, '#c8b070'); hub(FORT, '#1a1a20');
  c.fillStyle = '#e8d8a0'; c.font = '8px monospace';
  c.fillText('ЛЕС', 8, 12); c.fillText('ДВОРЕЦ', 122, 12); c.fillText('ЛЮДИ', 8, 164); c.fillText('ФОРТ', 132, 164);
})();
function drawMinimap() {
  const c = ui.minimap.getContext('2d');
  c.drawImage(mmStatic, 0, 0);
  const m = (x, z) => [(x + HALF) / (HALF * 2) * 170, (z + HALF) / (HALF * 2) * 170];
  for (const a of actors) {
    if (a.dead) continue;
    const [x, y] = m(a.group.position.x, a.group.position.z);
    c.fillStyle = a.squad ? '#40c0ff' :
      a.faction === 'elf' ? '#50c050' : a.faction === 'guard' ? '#e04040' :
        a.faction === 'villain' ? '#b070e0' : '#d8c890';
    c.fillRect(x - 1, y - 1, 2, 2);
  }
  for (const cv of caravans) {
    if (cv.resetT > 0) continue;
    for (const u of cv.units) {
      if (!u.g.visible) continue;
      const [x, y] = m(u.g.position.x, u.g.position.z);
      c.fillStyle = u.robbed ? '#777' : '#ffd76a';
      c.fillRect(x - 2, y - 2, 4, 4);
    }
  }
  const qt = questTargetPos();
  if (qt) {
    const [x, y] = m(qt.x, qt.z);
    c.strokeStyle = '#ffd76a'; c.lineWidth = 2;
    const r = 5 + Math.sin(nowT * 5) * 2;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  }
  if (state === 'playing') {
    const [x, y] = m(player.pos.x, player.pos.z);
    c.save(); c.translate(x, y); c.rotate(-player.yaw);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -5); c.lineTo(3.4, 4); c.lineTo(-3.4, 4); c.closePath(); c.fill();
    c.restore();
  }
}
function updateZoneLabel() {
  let name = ZONES[zoneOf(player.pos.x, player.pos.z)].name;
  if (Math.hypot(player.pos.x - PALACE.x, player.pos.z - PALACE.z) < 75) name = 'Дворец Императора';
  else if (Math.hypot(player.pos.x - FORT.x, player.pos.z - FORT.z) < 50) name = 'Старый форт Злого';
  else if (Math.hypot(player.pos.x - ELF_VILLAGE.x, player.pos.z - ELF_VILLAGE.z) < 45) name = 'Деревяные домики эльфов';
  else if (Math.hypot(player.pos.x - HUMAN_VILLAGE.x, player.pos.z - HUMAN_VILLAGE.z) < 45) name = 'Деревня людей';
  ui.zoneLabel.textContent = '— ' + name + ' —';
}

// ---------------------------------------------------------------------------
// Старт / загрузка
// ---------------------------------------------------------------------------
function startGame(faction, save) {
  player.faction = faction;
  player.dead = false;
  player.hp = 100; player.maxHp = 100;
  player.gold = 60; player.arrows = 0; player.bandages = 1; player.potions = 1;
  player.weapon = 'sword'; player.swordLvl = 1;
  player.hasBow = faction === 'elf';
  if (faction === 'elf') { player.arrows = 25; player.weapon = 'bow'; }
  player.arm = 'ok'; player.eye = 'ok'; player.leg = 'ok'; player.bleeding = false;
  questIdx = 0; quest = null;
  const spawn = faction === 'elf' ? { x: -430, z: -400 } : faction === 'guard' ? { x: 440, z: -448 } : { x: 430, z: 414 };
  player.pos.set(spawn.x, terrainH(spawn.x, spawn.z) + playerHeight(), spawn.z);
  player.yaw = faction === 'guard' ? Math.PI / 2 : 0;
  player.vel.set(0, 0, 0);

  if (save) {
    player.gold = save.gold; player.hp = save.hp; player.arrows = save.arrows;
    player.bandages = save.bandages; player.potions = save.potions;
    player.weapon = save.weapon; player.swordLvl = save.swordLvl; player.hasBow = save.hasBow;
    player.arm = save.arm; player.eye = save.eye; player.leg = save.leg; player.bleeding = save.bleeding;
    questIdx = save.questIdx || 0;
    player.pos.set(save.x, save.y, save.z);
    player.yaw = save.yaw;
    for (let i = 0; i < (save.squad || 0); i++) {
      const a = spawnActor(faction, 'warrior', save.x + (rnd() - 0.5) * 5, save.z + 2 + rnd() * 3, { squad: true, hpMul: 1.2 });
      a.order = 'follow';
    }
  }
  ui.eyeOverlay.style.display = player.eye === 'lost' ? 'block' : 'none';
  bossSpawnIfNeeded();
  raidT = 140 + rnd() * 60;
  state = 'playing';
  ui.start.classList.add('hidden');
  ui.death.classList.add('hidden');
  ui.hud.classList.add('on');
  updateWeaponVM();
  camera.position.copy(player.pos);
  camera.rotation.set(0, player.yaw, 0);
  player.pitch = 0;
  refreshHUD(); refreshOrder(); drawMinimap(); updateZoneLabel();
  updateTreeLOD(player.pos.x, player.pos.z);
  addMsg(faction === 'elf' ? 'Ты — лесной эльф. Лес густой: вдали деревья картинкой, подойдёшь — станут 3-хмерными.' :
    faction === 'guard' ? 'Ты — охрана дворца. Найди командира и слушайся его.' :
      'Ты — Злой (имя ты так и не придумал). Твой старый форт в горах. Ты сам себе командир.');
  if (faction === 'villain') setTimeout(() => { if (!quest && state === 'playing') assignQuest(0); }, 2500);
  ui.lockHint.classList.remove('hidden');
}

for (const card of document.querySelectorAll('.fcard')) {
  card.addEventListener('click', () => { audioInit(); startGame(card.dataset.faction); });
}
ui.btnContinue.addEventListener('click', () => {
  const s = loadSaveData();
  if (s) { audioInit(); startGame(s.faction, s); }
});
$('btnResume').addEventListener('click', () => { ui.pause.classList.add('hidden'); requestLock(); });
$('btnSave').addEventListener('click', () => { ui.pause.classList.add('hidden'); saveGame(); requestLock(); });
$('btnMenu').addEventListener('click', () => location.reload());
$('btnDeathMenu').addEventListener('click', () => location.reload());
$('btnDeathLoad').addEventListener('click', () => {
  const s = loadSaveData();
  if (!s) return;
  // подчистить отряд и волну, загрузиться
  for (const a of actors.filter(a => a.squad)) { const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); scene.remove(a.group); }
  startGame(s.faction, s);
});

// ---------------------------------------------------------------------------
// Главный цикл
// ---------------------------------------------------------------------------
let lodT = 0, mmT = 0, hudT = 0, scanT = 0;
const clock = new THREE.Clock();
let menuAngle = 0;

function updatePlayer(dt) {
  if (player.dead) return;
  player.attackCd -= dt;
  if (vmSwing > 0) {
    vmSwing -= dt;
    const t = vmSwing / 0.32;
    vmSword.rotation.x = (Math.PI - 0.55) - Math.sin(t * Math.PI) * 1.7;
    vmBow.position.z = -0.6 + Math.sin(t * Math.PI) * 0.15;
  }
  // движение
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = playerSpeed(sprint);
  const fwd = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const move = V3();
  if (keys.KeyW) move.add(fwd);
  if (keys.KeyS) move.sub(fwd);
  if (keys.KeyD) move.add(right);
  if (keys.KeyA) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();
  player.pos.x += move.x * sp * dt;
  player.pos.z += move.z * sp * dt;
  collideWorld(player.pos, 0.45, true);
  player.pos.x = clamp(player.pos.x, -HALF + 4, HALF - 4);
  player.pos.z = clamp(player.pos.z, -HALF + 4, HALF - 4);
  // гравитация и прыжки (можно прыгать и т.п.)
  const groundY = terrainH(player.pos.x, player.pos.z) + playerHeight();
  player.vel.y -= 24 * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= groundY) {
    player.pos.y = groundY;
    player.vel.y = 0;
    player.onGround = true;
  } else player.onGround = false;
  if (keys.Space && player.onGround && canJump()) {
    player.vel.y = 8.6;
    player.onGround = false;
  }
  // покачивание камеры
  if (move.lengthSq() > 0 && player.onGround) player.bobT += dt * (sprint ? 11 : 8);
  const bob = Math.sin(player.bobT) * 0.05 * (player.leg === 'wheel' ? 0.3 : 1);
  camera.position.set(player.pos.x, player.pos.y + bob, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  // кровотечение: если не вылечат — умрёт
  if (player.bleeding) {
    player.hp -= 1.9 * dt;
    if (player.hp <= 0) playerDie('Ты истёк кровью. Кирилл предупреждал: если не вылечат — умрёшь.');
  }
  ui.vignette.style.opacity = player.bleeding ? 0.9 : (player.hp < 30 ? 0.55 : 0);
}

function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.t += dt;
    if (a.t > 12) { scene.remove(a.g); arrows.splice(i, 1); continue; }
    if (a.stuck) continue;
    a.v.y -= 7 * dt;
    a.g.lookAt(V3().copy(a.g.position).add(a.v));
    const p = a.g.position;
    // полёт с подшагами, чтобы не проскакивать сквозь врагов
    const steps = Math.max(1, Math.ceil(a.v.length() * dt / 0.5));
    let hit = false;
    for (let s = 0; s < steps && !hit; s++) {
      p.addScaledVector(a.v, dt / steps);
      if (window.__traceArrow && a.source === 'P') {
        const dp = window.__traceArrow.group.position;
        const dd = (p.x - dp.x) ** 2 + (p.y - (dp.y + 1.2)) ** 2 + (p.z - dp.z) ** 2;
        if (window.__minD == null || dd < window.__minD) window.__minD = dd;
      }
      for (const b of actors) {
        if (b.dead || b === a.source) continue;
        if (a.source !== 'P' && a.source && b.faction === a.source.faction) continue;
        const dp = b.group.position;
        const dx = p.x - dp.x, dy = p.y - (dp.y + 1.2), dz = p.z - dp.z;
        if (dx * dx + dy * dy + dz * dz < 0.85) {
          applyDamage(b, a.dmg + rnd() * 4, a.source, null);
          hit = true;
          break;
        }
      }
      if (!hit && a.source !== 'P' && state === 'playing' && !player.dead) {
        const dx = p.x - player.pos.x, dy = p.y - player.pos.y + 0.3, dz = p.z - player.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.6) {
          hurtPlayer(a.dmg, a.source);
          hit = true;
        }
      }
      if (!hit && p.y < terrainH(p.x, p.z) + 0.1) { a.stuck = 1; break; }
    }
    if (hit) { scene.remove(a.g); arrows.splice(i, 1); continue; }
  }
}
function updateLimbs(dt) {
  for (const l of looseLimbs) {
    if (l.rest) continue;
    l.t += dt;
    l.v.y -= 18 * dt;
    l.obj.position.addScaledVector(l.v, dt);
    l.obj.rotation.x += l.av.x * dt;
    l.obj.rotation.y += l.av.y * dt;
    l.obj.rotation.z += l.av.z * dt;
    const gy = terrainH(l.obj.position.x, l.obj.position.z) + 0.15;
    if (l.obj.position.y < gy) { l.obj.position.y = gy; l.rest = true; }
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t -= dt;
    if (p.t <= 0) { scene.remove(p.m); particles.splice(i, 1); continue; }
    p.v.y -= 14 * dt;
    p.m.position.addScaledVector(p.v, dt);
  }
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  nowT += dt;
  const simActive = state === 'playing' && !shopOpen && ui.pause.classList.contains('hidden') && (pointerLocked || player.dead);

  if (state === 'menu') {
    menuAngle += dt * 0.035;
    const r = 330;
    camera.position.set(Math.cos(menuAngle) * r - 80, 130 + Math.sin(menuAngle * 0.7) * 20, Math.sin(menuAngle) * r);
    camera.lookAt(0, 0, 0);
    lodT -= dt;
    if (lodT <= 0) { lodT = 0.4; updateTreeLOD(camera.position.x, camera.position.z); }
  } else if (simActive) {
    updatePlayer(dt);
    for (const a of actors) updateActor(a, dt);
    updateArrows(dt);
    updateLimbs(dt);
    updateParticles(dt);
    updateCaravans(dt);
    updateQuest(dt);
    updateRaids(dt);
    updateRespawns();
    lodT -= dt;
    if (lodT <= 0) { lodT = 0.16; updateTreeLOD(player.pos.x, player.pos.z); }
    scanT -= dt;
    if (scanT <= 0) { scanT = 0.15; scanInteract(); }
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.25; refreshHUD(); refreshOrder(); updateZoneLabel(); }
    mmT -= dt;
    if (mmT <= 0) { mmT = 0.25; drawMinimap(); }
  }

  // солнце и небо следуют за камерой
  sun.position.set(camera.position.x + 120, camera.position.y + 170, camera.position.z + 70);
  sun.target.position.copy(state === 'playing' ? player.pos : camera.position);
  sky.position.set(camera.position.x, 0, camera.position.z);

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Поехали
// ---------------------------------------------------------------------------
// отладочный хук (не мешает игре; читы — в духе ТЗ)
window.__kor = {
  player, actors, caravans,
  forceLock: () => { pointerLocked = true; ui.lockHint.classList.add('hidden'); ui.pause.classList.add('hidden'); },
  look: (yaw, pitch = 0) => { player.yaw = yaw; player.pitch = pitch; },
  tp: (x, z) => { player.pos.set(x, terrainH(x, z) + playerHeight(), z); },
  attack: () => playerAttack(),
  interact: () => { scanInteract(); doInteract(); },
  gold: (n) => { player.gold += n; refreshHUD(); },
  quest: () => quest, stateOf: () => state, nearInfo: () => currentInteract,
  key: (code, down) => { keys[code] = down; },
  injure: (k) => applyInjury(k),
  arrows, camera,
  dbg: () => JSON.stringify({
    pressed: Object.keys(keys).filter(k => keys[k]), locked: pointerLocked, state,
    shop: shopOpen, pauseHidden: ui.pause.classList.contains('hidden'), dead: player.dead,
  }),
};

initPopulation();
updateTreeLOD(0, 0);
ui.worldStatus.textContent = 'Мир готов: ' + trees.length + ' деревьев, 4 зоны, ' + actors.length + ' жителей, корованы выехали. Выбери сторону:';
if (hasSave()) ui.btnContinue.classList.remove('hidden');
tick();
// тестовый режим для скрытой вкладки (RAF заморожен браузером): ?simfallback
if (location.search.includes('simfallback')) {
  const ch = new MessageChannel();
  let lastT = 0;
  ch.port1.onmessage = () => {
    const n = performance.now();
    if (document.visibilityState === 'hidden' && n - lastT > 30) { lastT = n; tick(); }
    ch.port2.postMessage(0);
  };
  ch.port2.postMessage(0);
}
