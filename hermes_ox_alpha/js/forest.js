// ДЖВА ГОДА — густой лес с LOD: вдали деревья «картинкой», вблизи — 3D.
import * as THREE from 'three';
import { terrainHeight, roadDist, zoneAt, WORLD, dynamicColliders } from './world.js';

// Детерминированный PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 3D-дерево (низкополигональное, инстансинг) ----------
const TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
const LEAF_MATS = [
  new THREE.MeshLambertMaterial({ color: 0x2e6b30 }),
  new THREE.MeshLambertMaterial({ color: 0x3f7d3a }),
  new THREE.MeshLambertMaterial({ color: 0x527a2c }),
  new THREE.MeshLambertMaterial({ color: 0x6d7a2e }),
];

const trunkGeo = new THREE.CylinderGeometry(0.28, 0.5, 5, 6);
const coneGeo = new THREE.ConeGeometry(2.6, 6, 7);
const blobGeo = new THREE.IcosahedronGeometry(2.6, 0);

// ---------- билборд-«картинки» ----------
function makeTreeTexture(kind, tint) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 64, 128);
  // ствол
  ctx.fillStyle = '#5a3f26';
  ctx.fillRect(28, 84, 8, 40);
  ctx.fillStyle = '#4a331e';
  ctx.fillRect(28, 84, 3, 40);
  const leaf = kind === 'pine' ? '#2e6b30' : (kind === 'birch' ? '#7da03a' : '#3f7d3a');
  const dark = kind === 'pine' ? '#1f4a22' : (kind === 'birch' ? '#5a7a2a' : '#2c5a2a');
  ctx.fillStyle = leaf;
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const w = 26 - i * 7, y = 18 + i * 24;
      ctx.beginPath();
      ctx.moveTo(32, y - 20); ctx.lineTo(32 + w, y + 14); ctx.lineTo(32 - w, y + 14);
      ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(32, 48, 27, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20, 62, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(45, 64, 13, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = dark;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(44, 40, 14, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (tint) {
    // тонировка только по уже нарисованным пикселям, фон остаётся прозрачным
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 64, 128);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function buildForest(scene) {
  const rand = mulberry32(20260822);
  const TREES = 9000;
  const LOD_DIST = 70;   // ближе — 3D, дальше — картинка

  // --- собираем позиции ---
  const pts = [];
  let guard = 0;
  while (pts.length < TREES && guard < TREES * 30) {
    guard++;
    const x = (rand() * 2 - 1) * (WORLD.HALF - 40);
    const z = (rand() * 2 - 1) * (WORLD.HALF - 40);
    const h = terrainHeight(x, z);
    if (h < 0.2) continue;                       // вода/река
    if (h > 58) continue;                        // скалы
    if (roadDist(x, z) < 7) continue;            // дороги свободны
    const zid = zoneAt(x, z);
    // плотность по зонам: эльфийский лес — густо (почти всё), люди — рощи, император — парки, горы — редкий хвойный
    const p =
      zid === 2 ? 0.97 :
      zid === 0 ? 0.30 :
      zid === 1 ? 0.22 : 0.14;
    if (rand() > p) continue;
    // прогалыны у баз
    const clearings = [[-600, 600, 85], [-640, -640, 78], [0, -620, 105], [640, 640, 85]];
    let blocked = false;
    for (const [cx, cz, r] of clearings) {
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) { blocked = true; break; }
    }
    if (blocked) continue;
    pts.push({ x, z, h, zid, r1: rand(), r2: rand(), r3: rand() });
  }

  // --- билборды (InstancedBufferGeometry + шейдер) ---
  const billTex = [
    makeTreeTexture('pine'), makeTreeTexture('leafy'),
    makeTreeTexture('birch'), makeTreeTexture('pine', '#7a8a9a'),
  ];
  const billMat = new THREE.ShaderMaterial({
    uniforms: {
      map0: { value: billTex[0] }, map1: { value: billTex[1] },
      map2: { value: billTex[2] }, map3: { value: billTex[3] },
      fogColor: { value: new THREE.Color(0x9db8d2) },
      fogNear: { value: 120 }, fogFar: { value: 900 },
    },
    vertexShader: `
      attribute vec2 corner;
      attribute vec3 ipos;
      attribute float kind; attribute float scale; attribute float rot; attribute float hide;
      varying float vKind; varying float vFog; varying vec2 vUv;
      uniform float fogNear; uniform float fogFar;
      void main() {
        vKind = kind; vUv = uv;
        vec3 wp = ipos;
        float c = cos(rot), s = sin(rot);
        if (hide < 0.5) {
          vec3 quad = vec3(corner.x * scale, corner.y * scale * 2.0, 0.0);
          quad = vec3(quad.x * c - quad.z * s, quad.y, quad.x * s + quad.z * c);
          wp += quad;
        }
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        float d = -mv.z;
        vFog = smoothstep(fogNear, fogFar, d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map0; uniform sampler2D map1;
      uniform sampler2D map2; uniform sampler2D map3;
      uniform vec3 fogColor;
      varying float vKind; varying float vFog; varying vec2 vUv;
      void main() {
        vec4 t = vKind < 0.5 ? texture2D(map0, vUv)
               : vKind < 1.5 ? texture2D(map1, vUv)
               : vKind < 2.5 ? texture2D(map2, vUv)
               : texture2D(map3, vUv);
        if (t.a < 0.5) discard;
        vec3 col = mix(t.rgb, fogColor, vFog);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const quadGeo = new THREE.InstancedBufferGeometry();
  quadGeo.index = new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1);
  quadGeo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([
    -1, 0, -1, 2, 1, 2, 1, 0,
  ]), 2));
  quadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0, 1, 1, 1, 1, 0,
  ]), 2));

  const N3D = 900; // максимум одновременно видимых 3D-деревьев
  // --- 3D-пул: инстансированные стволы и кроны ---
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, TRUNK_MAT, N3D);
  const coneMesh = new THREE.InstancedMesh(coneGeo, LEAF_MATS[0], N3D);
  const blobMesh = new THREE.InstancedMesh(blobGeo, LEAF_MATS[1], N3D);
  // цветовые вариации крон через instanceColor
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vScale = new THREE.Vector3();
  const vPos = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < N3D; i++) {
    trunkMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
    coneMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
    blobMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
    coneMesh.setColorAt(i, col.setHex(0xffffff));
    blobMesh.setColorAt(i, col.setHex(0xffffff));
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  coneMesh.instanceMatrix.needsUpdate = true;
  blobMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.frustumCulled = false;
  coneMesh.frustumCulled = false;
  blobMesh.frustumCulled = false;
  scene.add(trunkMesh, coneMesh, blobMesh);

  // --- билборд-меш: рисуем все деревья, шейдер сам прячет ближние к 3D-пулу ---
  // (ближние скрываются через атрибут hide, обновляемый каждый кадр)
  const hideAttr = new THREE.InstancedBufferAttribute(new Float32Array(pts.length), 1);

  const billMesh = new THREE.Mesh(quadGeo, billMat);
  billMesh.frustumCulled = false;
  scene.add(billMesh);

  // коллизии деревьев — только для ближнего кольца, динамически
  const treeColliders = []; // {x,z,r}
  let colCenter = { x: 1e9, z: 1e9 };

  function rebuildBillboards() {
    const n = pts.length;
    const pos = new Float32Array(n * 3);
    const kind = new Float32Array(n);
    const scale = new Float32Array(n);
    const rot = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.h; pos[i * 3 + 2] = p.z;
      kind[i] = p.r1 < 0.35 ? 0 : p.r1 < 0.6 ? 1 : p.r1 < 0.8 ? 2 : 3;
      scale[i] = 3.2 + p.r2 * 2.6;
      rot[i] = p.r3 * Math.PI * 2;
    }
    quadGeo.setAttribute('ipos', new THREE.InstancedBufferAttribute(pos, 3));
    quadGeo.setAttribute('kind', new THREE.InstancedBufferAttribute(kind, 1));
    quadGeo.setAttribute('scale', new THREE.InstancedBufferAttribute(scale, 1));
    quadGeo.setAttribute('rot', new THREE.InstancedBufferAttribute(rot, 1));
    quadGeo.setAttribute('hide', hideAttr);
    quadGeo.instanceCount = n;
  }
  rebuildBillboards();

  // (hide уже объявлен в шейдере)

  // --- обновление LOD ---
  const stats = { bill: 0, solid: 0 };
  function update(px, pz) {
    // 1) выбрать ближайшие N3D деревьев
    // простая сетка-кандидаты: сканируем все, но с дешёвой метрикой
    const cand = [];
    const R = 130; // радиус поиска 3D
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const dx = p.x - px, dz = p.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) cand.push([d2, i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const use = cand.length > N3D ? cand.length : N3D;
    let solid = 0;
    const hidden = hideAttr.array;
    for (let k = 0; k < N3D; k++) {
      const idx = k < cand.length ? cand[k][1] : -1;
      if (idx >= 0) {
        const p = pts[idx];
        const s = 0.8 + p.r2 * 0.5;
        vPos.set(p.x, p.h, p.z);
        vScale.set(s, s, s);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r3 * 6.28);
        m4.compose(vPos, q, vScale);
        trunkMesh.setMatrixAt(k, m4);
        // крона
        const pine = p.r1 < 0.35 || p.r1 >= 0.8;
        const cy = pine ? 7.2 * s : 6.4 * s;
        vPos.set(p.x, p.h + cy * s * 0.5 + 2.5 * s, p.z);
        m4.compose(vPos, q, vScale);
        if (pine) {
          coneMesh.setMatrixAt(k, m4);
          blobMesh.setMatrixAt(k, m4.makeScale(0, 0, 0));
        } else {
          blobMesh.setMatrixAt(k, m4);
          coneMesh.setMatrixAt(k, m4.makeScale(0, 0, 0));
        }
        col.setHSL(0.28 + p.r2 * 0.06, 0.5, 0.32 + p.r3 * 0.12);
        coneMesh.setColorAt(k, col);
        blobMesh.setColorAt(k, col);
        hidden[idx] = 1;
        solid++;
      } else {
        trunkMesh.setMatrixAt(k, m4.makeScale(0, 0, 0));
        coneMesh.setMatrixAt(k, m4.makeScale(0, 0, 0));
        blobMesh.setMatrixAt(k, m4.makeScale(0, 0, 0));
      }
    }
    // всё, что не в 3D-пуле — показать картинкой
    for (let i = 0; i < hidden.length; i++) {
      if (hidden[i] !== 1) hidden[i] = 0;
    }
    // но дальние от R — всегда билборды (они и так не в пуле)
    trunkMesh.instanceMatrix.needsUpdate = true;
    coneMesh.instanceMatrix.needsUpdate = true;
    blobMesh.instanceMatrix.needsUpdate = true;
    if (coneMesh.instanceColor) coneMesh.instanceColor.needsUpdate = true;
    if (blobMesh.instanceColor) blobMesh.instanceColor.needsUpdate = true;
    hideAttr.needsUpdate = true;
    stats.solid = solid;
    stats.bill = pts.length - solid;

    // 2) коллизии стволов вокруг игрока
    if (Math.abs(px - colCenter.x) > 12 || Math.abs(pz - colCenter.z) > 12) {
      colCenter = { x: px, z: pz };
      treeColliders.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dx = p.x - px, dz = p.z - pz;
        if (dx * dx + dz * dz < 40 * 40) treeColliders.push({ x: p.x, z: p.z, r: 0.55 });
      }
    }
  }

  return { update, treeColliders, stats };
}
