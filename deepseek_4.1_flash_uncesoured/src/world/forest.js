// Густой LOD-лес: вдали деревья — картинки, вблизи превращаются в объёмные 3D-деревья.
import * as THREE from 'three';
import { G, SETTINGS } from '../core/state.js';
import { Rand, fbm2 } from '../core/rng.js';
import { clamp, dist2D, lerp, smoothstep } from '../core/mathutil.js';
import { MAP, heightAt, slopeAt, isWater, roadDistance, zoneAt, WATER_Y } from './terrain.js';

const R3D = 72;            // радиус превращения картинки в 3D
const R_BILLBOARD = 620;   // предел видимости картинок
const MAX3D = 1500;        // максимум одновременных объёмных деревьев
const CELL = 24;

const treeGrid = new Map();
let trees = [];
let billboards = null, mat3d = [], meshes3d = [];
let group = null;
const slots = { broad: [], conifer: [] };
let spawnTime = new Float32Array(20000);
let lastUpdate = -99, lastPX = 1e9, lastPZ = 1e9;

function cellKey(cx, cz) { return cx * 10007 + cz; }

function treeDensity(x, z) {
  const zone = zoneAt(x, z);
  const n = fbm2(x / 260, z / 260, G.seed + 5, 3);
  if (zone.key === 'elves') return clamp(0.55 + n * 0.85, 0.2, 1.25);
  if (zone.key === 'people') return clamp(0.1 + n * 0.4, 0.03, 0.5);
  if (zone.key === 'empire') return clamp(0.08 + n * 0.35, 0.02, 0.4);
  return clamp(0.05 + n * 0.35, 0.01, 0.42); // владения Дрегара — редкая тайга
}

function makeSpriteAtlas() {
  const W = 256, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W * 3; cv.height = H;
  const ctx = cv.getContext('2d');
  const rnd = new Rand(1234);
  const drawTrunk = (x, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, H - h, w, h);
  };
  // 0 — широколиственное
  drawTrunk(W * 0.5, 14, 70, '#3d2f1e');
  for (let i = 0; i < 90; i++) {
    const a = rnd.float() * Math.PI * 2, r = Math.pow(rnd.float(), 0.6) * 92;
    const x = W * 0.5 + Math.cos(a) * r, y = H * 0.42 + Math.sin(a) * r * 0.72;
    const s = 20 + rnd.float() * 26;
    ctx.fillStyle = `hsl(${95 + rnd.float() * 30},${38 + rnd.float() * 22}%,${20 + rnd.float() * 22}%)`;
    ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
  }
  // 1 — ель
  const bx = W * 1.5;
  drawTrunk(bx, 12, 46, '#33261a');
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const y = H * 0.94 - t * H * 0.86;
    const w = lerp(86, 20, t) * (0.9 + rnd.float() * 0.2);
    const hgt = 48;
    ctx.fillStyle = `hsl(${135 + rnd.float() * 20},${32 + rnd.float() * 14}%,${13 + t * 14}%)`;
    ctx.beginPath();
    ctx.moveTo(bx, y - hgt); ctx.lineTo(bx - w / 2, y); ctx.lineTo(bx + w / 2, y); ctx.closePath(); ctx.fill();
  }
  // 2 — берёза/осина
  const bxx = W * 2.5;
  drawTrunk(bxx, 9, 78, '#d8d4c4');
  ctx.fillStyle = '#3d3225';
  for (let i = 0; i < 9; i++) ctx.fillRect(bxx - 5, H - 78 + i * 8, 10, 2.5);
  for (let i = 0; i < 70; i++) {
    const a = rnd.float() * Math.PI * 2, r = Math.pow(rnd.float(), 0.7) * 74;
    const x = bxx + Math.cos(a) * r, y = H * 0.34 + Math.sin(a) * r * 0.8;
    ctx.fillStyle = `hsl(${72 + rnd.float() * 24},${40 + rnd.float() * 20}%,${34 + rnd.float() * 24}%)`;
    ctx.beginPath(); ctx.arc(x, y, 15 + rnd.float() * 20, 0, 7); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function plantTrees() {
  const rnd = new Rand(G.seed ^ 0x5f3a);
  const step = 8;
  const placing = [];
  for (let z = -MAP.half + 40; z < MAP.half - 40; z += step) {
    for (let x = -MAP.half + 40; x < MAP.half - 40; x += step) {
      const jx = x + rnd.range(-step * 0.45, step * 0.45);
      const jz = z + rnd.range(-step * 0.45, step * 0.45);
      const d = treeDensity(jx, jz);
      if (rnd.float() > d) continue;
      const h = heightAt(jx, jz);
      if (h < WATER_Y + 0.6) continue;
      if (h > 128) continue;
      if (slopeAt(jx, jz) > 0.52) continue;
      if (roadDistance(jx, jz) < 7) continue;
      // не сажаем внутри дворца и на площадях деревень
      let skip = false;
      for (const p of G.places) {
        if (p.kind === 'elfvillage' || p.kind === 'camp' || p.kind === 'grove') continue;
        const dr = dist2D(jx, jz, p.x, p.z);
        if (dr < (p.kind === 'palace' ? p.r * 0.8 : p.r * 0.62)) { skip = true; break; }
      }
      if (skip) continue;
      const zone = zoneAt(jx, jz);
      let type = 0;
      if (zone.key === 'elves') type = rnd.float() < 0.55 ? 1 : (rnd.float() < 0.6 ? 0 : 2);
      else if (zone.key === 'villain') type = rnd.float() < 0.75 ? 1 : 0;
      else type = rnd.float() < 0.3 ? 2 : (rnd.float() < 0.6 ? 0 : 1);
      const scale = rnd.range(0.75, 1.5) * (zone.key === 'elves' ? 1.12 : 1);
      placing.push({ x: jx, z: jz, y: h, type, scale, rot: rnd.float() * Math.PI * 2, id: placing.length });
    }
  }
  // немного деревьев в эльфийской деревне — там дома на ветвях
  for (let i = 0; i < 130; i++) {
    const a = rnd.float() * Math.PI * 2, r = Math.pow(rnd.float(), 0.7) * 150;
    const x = -620 + Math.cos(a) * r, z = -600 + Math.sin(a) * r;
    if (roadDistance(x, z) < 6) continue;
    const h = heightAt(x, z);
    if (h < WATER_Y + 0.6) continue;
    placing.push({ x, z, y: h, type: rnd.float() < 0.5 ? 1 : 0, scale: rnd.range(1.1, 1.9), rot: rnd.float() * 6.28, id: placing.length });
  }
  return placing;
}

function buildGrid() {
  treeGrid.clear();
  trees.forEach((t, i) => {
    const cx = Math.floor(t.x / CELL), cz = Math.floor(t.z / CELL);
    const k = cellKey(cx, cz);
    if (!treeGrid.has(k)) treeGrid.set(k, []);
    treeGrid.get(k).push(i);
  });
}

function buildBillboards() {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  const aType = new Float32Array(trees.length);
  const aSize = new Float32Array(trees.length * 2);
  const aPhase = new Float32Array(trees.length);
  trees.forEach((t, i) => {
    aType[i] = t.type;
    aSize[i * 2] = (7.6 + t.type * 1.7) * t.scale;
    aSize[i * 2 + 1] = (15 + (t.type === 1 ? 10 : 5) + t.type * 1.5) * t.scale;
    aPhase[i] = t.rot;
  });
  quad.setAttribute('aType', new THREE.InstancedBufferAttribute(aType, 1));
  quad.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
  quad.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));

  const texture = makeSpriteAtlas();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uFadeNear: { value: R3D },
      uFar: { value: R_BILLBOARD },
      uFogColor: { value: new THREE.Color(0x9fb4c4) },
      uFogDensity: { value: 0.0016 },
      uLight: { value: 1 },
      uTint: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: /* glsl */`
      attribute float aType; attribute vec2 aSize; attribute float aPhase;
      uniform float uTime; uniform float uFadeNear; uniform float uFar; uniform float uLight;
      varying vec2 vUv; varying float vFade; varying float vDepth; varying float vLight;
      void main(){
        vec4 center = modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        vec4 mv = viewMatrix * center;
        float dist = length(mv.xyz);
        float fadeIn = smoothstep(uFadeNear * 0.82, uFadeNear * 1.08, dist);
        float fadeOut = 1.0 - smoothstep(uFar * 0.72, uFar, dist);
        vFade = fadeIn * fadeOut;
        float sway = sin(uTime * 1.1 + center.x * 0.08 + aPhase) * 0.035;
        vec2 local = position.xy * aSize + vec2(sway * position.y * aSize.y, 0.0);
        mv.xy += local;
        vUv = vec2((uv.x + aType) / 3.0, uv.y);
        vDepth = dist;
        vLight = uLight * (0.82 + 0.18 * sin(aPhase * 3.1));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uTint;
      varying vec2 vUv; varying float vFade; varying float vDepth; varying float vLight;
      void main(){
        if (vFade <= 0.001) discard;
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.35) discard;
        vec3 col = tex.rgb * uTint * vLight;
        float f = 1.0 - exp(-pow(vDepth * uFogDensity, 2.0));
        col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, tex.a * vFade);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(quad, material, trees.length);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const m = new THREE.Matrix4();
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    m.makeTranslation(t.x, t.y - 0.25, t.z);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.name = 'forest_billboards';
  mesh.renderOrder = 1;
  return mesh;
}

function makeGeoms() {
  const parts = {};
  const trunkGeo = new THREE.CylinderGeometry(0.36, 0.6, 1, 6, 1);
  trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7, 1);
  coneGeo.translate(0, 0.5, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  parts.trunkGeo = trunkGeo; parts.coneGeo = coneGeo; parts.blobGeo = blobGeo;
  return parts;
}

function build3D(parts) {
  mat3d = [
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  ];
  const specs = [
    { geo: parts.trunkGeo, mat: mat3d[0] },
    { geo: parts.coneGeo, mat: mat3d[1] },
    { geo: parts.blobGeo, mat: mat3d[2] },
  ];
  const c = new THREE.Color(1, 1, 1);
  meshes3d = specs.map((s) => {
    const im = new THREE.InstancedMesh(s.geo, s.mat, MAX3D);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0;
    im.castShadow = true;
    im.receiveShadow = false;
    im.frustumCulled = false;
    im.name = 'forest3d';
    for (let i = 0; i < MAX3D; i++) im.setColorAt(i, c);
    im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    group.add(im);
    return im;
  });
}

function fill3D() {
  const p = G.player;
  if (!p || !meshes3d.length) return;
  const px = p.pos.x, pz = p.pos.z;
  const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
  const rad = Math.ceil(R3D / CELL) + 1;
  const near = [];
  for (let j = -rad; j <= rad; j++) {
    for (let i = -rad; i <= rad; i++) {
      const list = treeGrid.get(cellKey(cx + i, cz + j));
      if (!list) continue;
      for (const idx of list) {
        const t = trees[idx];
        const d = dist2D(px, pz, t.x, t.z);
        if (d < R3D) near.push([d, idx]);
      }
    }
  }
  near.sort((a, b) => a[0] - b[0]);
  const n = Math.min(near.length, 900);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  let nTrunk = 0, nCone = 0, nBlob = 0;
  for (let i = 0; i < n; i++) {
    const t = trees[near[i][1]];
    const growth = clamp((G.now - spawnTime[t.id]) / 0.45, 0, 1);
    const s = t.scale * lerp(0.3, 1, growth * growth * (3 - 2 * growth));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    if (t.type === 1) {
      const ti = nTrunk++;
      v.set(t.x, t.y - 0.3, t.z);
      scl.set(s * 0.5, s * 4.5, s * 0.5);
      meshes3d[0].setMatrixAt(ti, m.compose(v, q, scl));
      col.setHSL(0.09, 0.3, 0.12 + (t.id % 7) * 0.012);
      meshes3d[0].setColorAt(ti, col);
      for (let k = 0; k < 3 && nCone < MAX3D; k++) {
        const ci = nCone++;
        v.set(t.x, t.y + s * (2.3 + k * 3.05) - 0.3, t.z);
        scl.set(s * (3.7 - k * 0.85), s * (5.4 - k * 0.8), s * (3.7 - k * 0.85));
        meshes3d[1].setMatrixAt(ci, m.compose(v, q, scl));
        col.setHSL(0.31, 0.3 + (t.id % 5) * 0.02, 0.1 + k * 0.05);
        meshes3d[1].setColorAt(ci, col);
      }
    } else {
      const ti = nTrunk++;
      v.set(t.x, t.y - 0.3, t.z);
      scl.set(s * 0.55, s * (t.type === 2 ? 6.6 : 5.0), s * 0.55);
      meshes3d[0].setMatrixAt(ti, m.compose(v, q, scl));
      col.setHSL(0.08, 0.25, t.type === 2 ? 0.6 : 0.14);
      meshes3d[0].setColorAt(ti, col);
      const blobs = t.type === 2 ? 2 : 3;
      for (let k = 0; k < blobs && nBlob < MAX3D; k++) {
        const bi = nBlob++;
        v.set(t.x + Math.sin(t.rot + k * 2.1) * s * 0.55, t.y + s * (4.3 + k * 1.55) - 0.3,
          t.z + Math.cos(t.rot + k * 2.1) * s * 0.55);
        const w = s * (3.5 - k * 0.6);
        scl.set(w, w * 0.8, w);
        meshes3d[2].setMatrixAt(bi, m.compose(v, q, scl));
        col.setHSL(t.type === 2 ? 0.22 : 0.26, 0.38, 0.15 + k * 0.055);
        meshes3d[2].setColorAt(bi, col);
      }
    }
  }
  meshes3d[0].count = Math.min(MAX3D, nTrunk);
  meshes3d[1].count = Math.min(MAX3D, nCone);
  meshes3d[2].count = Math.min(MAX3D, nBlob);
  for (const im of meshes3d) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  G._nearTrees = near;
  G._trees3d = nTrunk + nCone + nBlob;
}

export function buildForest(scene) {
  trees = plantTrees();
  spawnTime = new Float32Array(trees.length + 8);
  buildGrid();
  group = new THREE.Group();
  group.name = 'forest';
  billboards = buildBillboards();
  group.add(billboards);
  build3D(makeGeoms());
  scene.add(group);
  G.world.forest = group;
  G.treeCount = trees.length;
  for (let i = 0; i < trees.length; i++) spawnTime[i] = -10;
  billboards.visible = true;
  fill3D();
  return group;
}

export function updateForest(dt) {
  if (!group) return;
  const p = G.player;
  if (!p) return;
  billboards.material.uniforms.uTime.value = G.now;
  const moved = Math.abs(p.pos.x - lastPX) + Math.abs(p.pos.z - lastPZ);
  if (G.now - lastUpdate > 0.25 || moved > 6) {
    lastUpdate = G.now; lastPX = p.pos.x; lastPZ = p.pos.z;
    // помечаем деревья, которые только что вошли в зону 3D — для анимации роста
    const cx = Math.floor(p.pos.x / CELL), cz = Math.floor(p.pos.z / CELL);
    const rad = Math.ceil(R3D / CELL) + 1;
    for (let j = -rad; j <= rad; j++) {
      for (let i = -rad; i <= rad; i++) {
        const list = treeGrid.get(cellKey(cx + i, cz + j));
        if (!list) continue;
        for (const idx of list) {
          const t = trees[idx];
          if (dist2D(p.pos.x, p.pos.z, t.x, t.z) < R3D - 4 && spawnTime[t.id] < G.now - 30) spawnTime[t.id] = G.now;
        }
      }
    }
    fill3D();
  }
  void dt;
}

// Столкновение со стволами рядом с игроком.
export function resolveTreeCollision(pos, radius) {
  const near = G._nearTrees;
  if (!near) return;
  for (let i = 0; i < Math.min(near.length, 220); i++) {
    const t = trees[near[i][1]];
    if (!t) continue;
    const r = (t.type === 2 ? 0.5 : 0.75) * t.scale + radius;
    const dx = pos.x - t.x, dz = pos.z - t.z;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 0.0001) {
      const k = (r - d) / d;
      pos.x += dx * k; pos.z += dz * k;
    }
  }
}

export function treeNear(x, z, maxD = 4) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const list = treeGrid.get(cellKey(cx + i, cz + j));
    if (!list) continue;
    for (const idx of list) {
      const t = trees[idx];
      if (dist2D(x, z, t.x, t.z) < maxD) return t;
    }
  }
  return null;
}

export function forestStats() {
  return { total: trees.length, visible3d: (G._nearTrees || []).length };
}

export function updateForestColors(fogColor, fogDensity, light) {
  if (!billboards) return;
  const u = billboards.material.uniforms;
  u.uFogColor.value.copy(fogColor);
  u.uFogDensity.value = fogDensity;
  u.uLight.value = light;
  if (!SETTINGS.grass) u.uFar.value = 380; else u.uFar.value = R_BILLBOARD;
}
void smoothstep;
