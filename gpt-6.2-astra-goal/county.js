'use strict';

const dairies = [
  { x: -126, z: -53, title: 'Маслобойня', stamp: 'кусок масла', color: 0xeeb652 },
  { x: 54, z: -124, title: 'Палата удоев', stamp: 'мерная кружка', color: 0x4383aa },
  { x: -54, z: 123, title: 'Клеверный стан', stamp: 'лист клевера', color: 0x339377 },
  { x: 124, z: 54, title: 'Сырный редут', stamp: 'сырная голова', color: 0xa65d7c },
];

// Uneven overlapping whorls enclose an actual volume, even in the lowest tree LOD.
function pineCrown(rings, sides, broad) {
  const pos = [],
    col = [],
    idx = [];
  function ring(y, rad, level, tier, brightness) {
    const first = pos.length / 3;
    for (let j = 0; j < sides; j++) {
      const a = (j * Math.PI * 2) / sides + level * 0.91;
      const bump = 1 + 0.11 * Math.sin(j * 5.2 + level * 3.1);
      const uneven = tier === 1 ? 0.026 * Math.cos(j * 2.8 + level) : 0;
      pos.push(Math.sin(a) * rad * bump, y + uneven, Math.cos(a) * rad * bump);
      const color = new THREE.Color(broad ? 0x9eaf55 : 0x62895e);
      color.multiplyScalar(brightness * (0.91 + 0.12 * Math.sin(j * 1.9 + level)));
      col.push(color.r, color.g, color.b);
    }
    return first;
  }
  function link(low, high) {
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      idx.push(low + j, low + k, high + j, low + k, high + k, high + j);
    }
  }
  for (let i = 0; i < rings; i++) {
    const u = i / rings,
      base = 0.19 + 0.68 * u,
      width = (broad ? 0.32 : 0.235) * (1 - u * 0.81);
    const a = ring(base + 0.025, width * 0.18, i, 0, 0.49 + i * 0.045);
    const b = ring(base, width, i, 1, 0.67 + i * 0.065);
    const c = ring(base + (1 - base) * 0.49, width * 0.59, i, 2, 0.98 + i * 0.06);
    const d = ring(i === rings - 1 ? 1 : base + (1 - base) * 0.81, 0.004, i, 3, 1.17);
    link(a, b);
    link(b, c);
    link(c, d);
  }
  // Each bough is a closed, drooping tuft. The tips break the silhouette in every direction.
  if (sides > 6)
    for (let level = 0; level < 7; level++) {
      const t = level / 7,
        count = 13 - level,
        r = 0.25 - 0.16 * t;
      for (let j = 0; j < count; j++) {
        const angle = (j * Math.PI * 2) / count + level * 2.38,
          dx = Math.sin(angle),
          dz = Math.cos(angle),
          h = 0.235 + t * 0.7;
        const len = r * (0.86 + 0.18 * Math.cos(level * 7 + j * 4)),
          w = len * 0.31,
          first = pos.length / 3;
        for (const [rad, side, dy, shade] of [
          [0.16, 0, 0.08, 1.05],
          [0.62, w, 0.006, 0.93],
          [1.03, 0, -0.047, 0.83],
          [0.62, -w, 0.004, 0.91],
          [0.55, 0, 0.046, 1.1],
          [0.55, 0, -0.028, 0.65],
        ]) {
          pos.push(dx * rad * len + dz * side, h + dy, dz * rad * len - dx * side);
          const c = new THREE.Color(j % 4 ? 0x648f63 : 0x749663).multiplyScalar(shade * (0.89 + 0.18 * t));
          col.push(c.r, c.g, c.b);
        }
        for (const tri of [
          [0, 1, 4],
          [1, 2, 4],
          [2, 3, 4],
          [3, 0, 4],
          [1, 0, 5],
          [2, 1, 5],
          [3, 2, 5],
          [0, 3, 5],
        ])
          idx.push(...tri.map((k) => first + k));
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function foliagePaint() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  let seed = 7854;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = '#797e66';
  ctx.fillRect(0, 0, 256, 256);
  for (let l = 0; l < 2800; l++) {
    const x = random() * 256,
      y = random() * 256,
      r = 1 + random() * 6,
      a = random() * 6.28;
    const v = Math.round(89 + random() * 141);
    ctx.fillStyle = 'rgb(' + v + ',' + (v + 4) + ',' + Math.round(v * 0.86) + ')';
    for (const dx of x < 10 ? [0, 256] : x > 246 ? [0, -256] : [0])
      for (const dy of y < 10 ? [0, 256] : y > 246 ? [0, -256] : [0]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * 0.48, a, 0, 2 * Math.PI);
        ctx.fill();
      }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
function pineSprays(far = false) {
  const p = [],
    uv = [],
    ix = [];
  for (let l = 0; l < (far ? 7 : 11); l++) {
    const v = l / (far ? 7 : 11),
      n = Math.round((far ? 7 : 13) - (far ? 4 : 7) * v),
      r = 0.255 * (1 - 0.86 * v);
    for (let j = 0; j < n; j++) {
      const a = (j * 2 * Math.PI) / n + l * 1.32,
        dx = Math.sin(a),
        dz = Math.cos(a);
      const h = 0.25 + 0.75 * v + 0.019 * Math.sin(j * 9 + l * 6),
        length = r * (0.93 + 0.13 * Math.sin(j * 4 + l));
      const id = p.length / 3,
        w = length * 0.49;
      for (const [scale, side, dy] of [
        [0.1, 0, 0.068],
        [0.59, 1, 0.003],
        [1.12, 0, -0.049],
        [0.59, -1, 0.002],
        [0.59, 0, 0.031],
        [0.65, 0, -0.041],
      ]) {
        p.push(dx * length * scale + dz * w * side, h + dy, dz * length * scale - dx * w * side);
      }
      uv.push(0, 0.5, 0.54, 1, 1, 0.5, 0.54, 0, 0.54, 0.52, 0.58, 0.5);
      for (const [i, k, m] of [
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4],
      ])
        ix.push(id + i, id + k, id + m);
    }
  }
  return geometry(p, uv, ix);
}
// A silver birch has an irregular multi-leader crown. The same layout drives its wood and leaf fans.
function birchCrown(fine) {
  const branch = new Sculpt(),
    p = [],
    uv = [],
    ix = [],
    col = [];
  const count = fine ? 39 : 18;
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1),
      angle = i * 2.39996 + 0.27 * Math.sin(i * 0.95),
      dx = Math.sin(angle),
      dz = Math.cos(angle);
    const length =
      (0.205 + 0.12 * Math.sin(u * Math.PI)) * (1 - 0.66 * u) * (0.82 + 0.19 * Math.sin(i * 6.03));
    const base = [0.012 * Math.sin(u * 4), 0.247 + 0.63 * u, 0.009 * Math.cos(u * 5)];
    const elbow = [base[0] + length * dx * 0.51, base[1] + 0.092, base[2] + length * dz * 0.51];
    const end = [base[0] + length * dx, base[1] + 0.126 + 0.05 * Math.sin(i * 3), base[2] + length * dz];
    const thick = 0.011 * (1 - u * 0.64);
    branch.taper(0xa39a7c, base, elbow, thick, thick * 0.62);
    branch.taper(0x776f4e, elbow, end, thick * 0.62, 0.002);
    const light = new THREE.Color().setHSL(
      0.196 + 0.014 * Math.sin(i * 7),
      0.3,
      0.58 + 0.072 * Math.sin(i * 2),
    );
    for (let j = 0; j < (fine ? 5 : 3); j++) {
      const turn = angle + (j - 2) * 0.51,
        rx = Math.sin(turn),
        rz = Math.cos(turn),
        sx = rz,
        sz = -rx;
      const reach = (0.12 + 0.055 * Math.sin(i * 3 + j * 2)) * (1 - 0.25 * u);
      const start = j % 2 ? elbow : end;
      const id = p.length / 3;
      // Nine vertices form a hanging arch with a central spine. Lighting follows the actual surface.
      for (let k = 0; k < 3; k++) {
        const v = k / 2;
        for (let h = -1; h <= 1; h++) {
          const width = (0.36 + 0.25 * Math.sin(v * Math.PI)) * reach;
          p.push(
            start[0] + rx * v * reach + sx * h * width,
            start[1] +
              Math.sin(v * Math.PI) * reach * 0.2 -
              v * v * reach * 0.67 -
              Math.abs(h) * reach * 0.22,
            start[2] + rz * v * reach + sz * h * width,
          );
          uv.push(v, (h + 1) * 0.5);
          const shade = (0.8 + 0.18 * v + 0.05 * h) * (0.85 + 0.19 * u);
          col.push(light.r * shade, light.g * shade, light.b * shade);
        }
      }
      for (let k = 0; k < 2; k++)
        for (let h = 0; h < 2; h++) {
          const a = id + k * 3 + h;
          ix.push(a, a + 1, a + 4, a, a + 4, a + 3);
        }
    }
  }
  const wood = branch.finish(new THREE.Group()).geometry,
    g = geometry(p, uv, ix);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return { wood, crown: g };
}

function meadowClump() {
  const pos = [],
    uv = [],
    ix = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3,
      dx = Math.cos(a),
      dz = Math.sin(a),
      size = 0.41 + 0.09 * Math.sin(i * 4);
    const base = pos.length / 3;
    for (let j = 0; j < 3; j++) {
      const t = j / 2;
      for (const side of [-1, 0, 1]) {
        pos.push(
          side * dx * size + 0.13 * t * t + (1 - Math.abs(side)) * dz * 0.12 * t,
          t * (0.86 + 0.11 * Math.cos(i * 2)),
          side * dz * size - (1 - Math.abs(side)) * dx * 0.12 * t + 0.12 * Math.sin(a) * t * t,
        );
        uv.push((side + 1) * 0.5, t);
      }
    }
    for (let j = 0; j < 2; j++)
      for (let h = 0; h < 2; h++) {
        const k = base + j * 3 + h;
        ix.push(k, k + 1, k + 4, k, k + 4, k + 3);
      }
  }
  const g = geometry(pos, uv, ix);
  // Upward-biased leaf normals keep the unlit face from turning black against the ground.
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.48, 0.83, n.getZ(i) * 0.48);
  return g;
}
function meadowHash(x, z, salt) {
  let n = Math.imul(x, 198491317) ^ Math.imul(z, 6542989) ^ Math.imul(salt, 357239);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

class County extends InteriorRealm {
  tileGround(mesh) {
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const m = i || j ? mesh.clone() : mesh;
        m.position.set(i * PERIOD, 0, j * PERIOD);
        m.userData.groundTile = true;
        this.scene.add(m);
        this.tiles.push(m);
      }
  }
  collectScenery() {
    this.scenery = [];
    for (const obj of this.scene.children) {
      if (
        obj === this.skyMesh ||
        obj === this.camera ||
        obj.userData.groundTile ||
        obj.isLight ||
        obj === this.sun.target
      )
        continue;
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) continue;
      const center = box.getCenter(new THREE.Vector3());
      this.scenery.push({ obj, x: obj.position.x, z: obj.position.z, cx: center.x, cz: center.z });
    }
  }
  placeScenery(x, z) {
    if (!this.lastSector || Math.abs(x - this.lastSector.x) > 7 || Math.abs(z - this.lastSector.z) > 7) {
      this.lastSector = { x, z };
      for (const m of this.tiles) {
        const dx = Math.max(0, Math.abs(x - m.position.x) - WORLD_LIMIT),
          dz = Math.max(0, Math.abs(z - m.position.z) - WORLD_LIMIT);
        m.visible = dx * dx + dz * dz < 170 * 170;
      }
      for (const p of this.scenery) {
        p.obj.position.x = p.x + PERIOD * Math.round((x - p.cx) / PERIOD);
        p.obj.position.z = p.z + PERIOD * Math.round((z - p.cz) / PERIOD);
      }
    }
    if (
      !this.forestEye ||
      Math.abs(this.forestEye.x - x) > WORLD_LIMIT ||
      Math.abs(this.forestEye.z - z) > WORLD_LIMIT
    )
      this.lod(x, z);
  }
  pastures() {
    const stem = new THREE.CylinderGeometry(0.75, 1, 1, 5);
    // Sample the near-field plants in world space. Their position and species repeat exactly at each road seam.
    for (const site of dairies) {
      const { x, z, color } = site,
        y = ground(x, z);
      this.buildHeight = y;
      const away = Math.abs(x) > 100 ? 0 : Math.sign(x) * 2.4;
      const dz = away ? 0 : Math.sign(z) * 2.4;
      const bx = x + away,
        bz = z + dz;
      this.block(bx, 0.18, bz, 3.2, 0.36, 2.65, 0x969384);
      for (const dx of [-1.3, 1.3])
        for (const zz of [-1, 1]) this.put(stem, 0x765030, bx + dx, 1.6, bz + zz, 0.13, 3, 0.13);
      this.block(bx, 0.98, bz, 2.65, 0.22, 1.7, 0x897454);
      for (let k = -3; k <= 3; k++)
        for (const sign of [-1, 1])
          this.block(
            bx + k * 0.48,
            2.97,
            bz + sign * 0.69,
            0.49,
            0.12,
            1.6,
            k % 2 ? color : 0xffdc9b,
            0,
            0,
            sign * 0.31,
          );
      for (let k = 0; k < 4; k++)
        this.put(this.log, 0xe7ab43, bx - 0.8 + k * 0.43, 1.2 + (k % 2) * 0.11, bz, 0.25, 0.28, 0.25);
      this.bound(bx, bz, 2.55, 1.7);
      const sign = document.createElement('canvas');
      sign.width = 512;
      sign.height = 100;
      const q = sign.getContext('2d');
      q.fillStyle = '#274a42';
      q.fillRect(0, 0, 512, 100);
      q.strokeStyle = '#eac57e';
      q.lineWidth = 5;
      q.strokeRect(5, 5, 502, 90);
      q.fillStyle = '#ffe4a6';
      q.font = 'bold 41px Georgia';
      q.textAlign = 'center';
      q.fillText(site.title.toUpperCase(), 256, 65, 480);
      const tex = new THREE.CanvasTexture(sign);
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.MeshBasicMaterial({ map: tex });
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.56, 0.11), [
        this.mat(0x765030),
        this.mat(0x765030),
        this.mat(0x765030),
        this.mat(0x765030),
        face,
        face,
      ]);
      board.position.set(bx, y + 2.47, bz);
      board.rotation.y = away ? Math.PI / 2 : 0;
      this.scene.add(board);
      const milkSide = dz ? Math.sign(dz) : Math.sign(away);
      for (let j = 0; j < 7; j++) {
        const fx = bx + (dz ? j * 0.86 - 2.6 : milkSide * 2.6),
          fz = bz + (dz ? milkSide * 2.6 : j * 0.86 - 2.6);
        this.put(this.box, 0x897454, fx, 0.52, fz, 0.105, 1.06, 0.11);
        if (j < 6)
          this.block(
            fx + (dz ? 0.43 : 0),
            0.78,
            fz + (dz ? 0 : 0.43),
            dz ? 0.94 : 0.088,
            0.085,
            dz ? 0.088 : 0.94,
            0x927247,
          );
      }
      this.bound(
        bx + (dz ? 0 : milkSide * 2.6),
        bz + (dz ? milkSide * 2.6 : 0),
        dz ? 5.3 : 0.12,
        dz ? 0.12 : 5.3,
      );
      this.buildHeight = 0;
      // The brass wheel on a blue post is recognizable from both ends of the road.
      this.block(x, y + 1.5, z, 0.17, 3, 0.17, 0x514533);
      this.put(this.log, color, x, y + 2.8, z, 0.52, 0.23, 0.52, 0, 0, Math.PI / 2);
      this.put(this.head, 0xffc653, x, y + 2.82, z + 0.15, 0.31, 0.32, 0.08);
    }
    for (let i = 0; i < 350; i++) {
      const x = this.rnd() * PERIOD - WORLD_LIMIT,
        z = this.rnd() * PERIOD - WORLD_LIMIT;
      if (
        Math.max(Math.abs(x), Math.abs(z)) < 100 ||
        Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50)) < 4 ||
        dairies.some((d) => Math.hypot(x - d.x, z - d.z) < 6)
      )
        continue;
      this.trees.push({ x, z, y: ground(x, z), a: this.rnd() * 6.28, h: 5 + this.rnd() * 10 });
      this.bound(x, z, 0.63, 0.63);
    }
  }
  treeMeshes() {
    const wood = this.mat(0x534936),
      leaf = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const flecks = foliagePaint();
    leaf.onBeforeCompile = (shader) => {
      shader.uniforms.flecks = { value: flecks };
      shader.vertexShader =
        'varying vec3 crownPoint;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n crownPoint=position;',
        );
      shader.fragmentShader =
        'uniform sampler2D flecks;varying vec3 crownPoint;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec2 uv=vec2(crownPoint.x+.57*crownPoint.z,crownPoint.y-.38*crownPoint.z);
        float fleck=texture2D(flecks,uv*8.1).r;
        float broad=texture2D(flecks,uv*.94).r;
        diffuseColor.rgb*=(.56+.76*fleck)*(.76+.39*broad);`,
        );
    };
    const n = this.trees.length,
      nearBirch = birchCrown(true),
      farBirch = birchCrown(false);
    const birchLeaves = foliageMaterial('birch-spray');
    birchLeaves.vertexColors = true;
    birchLeaves.color.setHex(0xe9edda);
    birchLeaves.alphaTest = 0.29;
    const branches = new THREE.MeshLambertMaterial({ vertexColors: true });
    const batch = (geo, mat) => new THREE.InstancedMesh(geo, mat, n);
    this.treeGroups = [
      batch(new THREE.CylinderGeometry(0.32, 1, 1, 8), wood),
      batch(pineCrown(7, 6, false), leaf),
      batch(pineCrown(4, 6, false), leaf),
      batch(nearBirch.crown, birchLeaves),
      batch(farBirch.crown, birchLeaves),
      batch(pineSprays(), foliageMaterial('bough')),
      batch(nearBirch.wood, branches),
      batch(farBirch.wood, branches),
      batch(new THREE.CylinderGeometry(0.22, 0.74, 1, 9), this.birchBark()),
      batch(pineSprays(true), foliageMaterial('bough')),
    ];
    const tuft = meadowClump();
    this.meadowGroups = ['pasture', 'daisies', 'bracken'].map((name) => {
      const mat = foliageMaterial(name);
      mat.alphaTest = 0.3;
      mat.color.setHex(0xe0e1bf);
      mat.emissiveMap = texture(name);
      mat.emissive.setHex(0x6f8060);
      mat.emissiveIntensity = 0.7;
      const mesh = new THREE.InstancedMesh(tuft, mat, 5200);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      this.scene.add(mesh);
      return mesh;
    });
    this.treeGroups.forEach((m) => {
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    });
    this.lod(0, 0);
  }
  birchBark() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const q = c.getContext('2d');
    q.fillStyle = '#bdb5a0';
    q.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 12000; i++) {
      const x = meadowHash(i, 1, 2) * 256,
        y = meadowHash(i, 3, 2) * 512;
      q.fillStyle = ['#c6c2ac', '#d9cfb4', '#acaa99', '#9a9d8c'][i % 4];
      q.fillRect(x, y, meadowHash(i, 4, 1) * 9 + 1, 1);
    }
    for (let i = 0; i < 190; i++) {
      const x = meadowHash(i, 11, 3) * 256,
        y = meadowHash(i, 7, 1) * 512,
        w = 4 + meadowHash(i, 2, 5) * 34;
      q.fillStyle = '#655f54';
      q.beginPath();
      q.moveTo(x, y);
      q.quadraticCurveTo(x + w * 0.3, y + 2.7, x + w, y + 1);
      q.quadraticCurveTo(x + w * 0.75, y + 3, x, y + 2);
      q.fill();
    }
    for (let k = 0; k < 24; k++) {
      const x = meadowHash(k, 41, 3) * 256,
        y = meadowHash(k, 91, 7) * 470,
        w = 6 + meadowHash(k, 65, 1) * 17;
      q.fillStyle = '#746b5e';
      q.beginPath();
      q.moveTo(x - w, y);
      q.quadraticCurveTo(x, y - 7, x + w, y + 1);
      q.quadraticCurveTo(x + 2, y + 11, x - w, y);
      q.fill();
      q.fillStyle = '#3d3934';
      q.beginPath();
      q.ellipse(x, y, w * 0.42, 3.2, 0.04, 0, Math.PI * 2);
      q.fill();
    }
    const moss = q.createLinearGradient(0, 490, 0, 510);
    moss.addColorStop(0, 'rgba(95,89,65,0)');
    moss.addColorStop(1, 'rgba(78,73,50,.4)');
    q.fillStyle = moss;
    q.fillRect(0, 490, 256, 22);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1.7);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  }
  meadow(px, pz) {
    const groups = this.meadowGroups,
      counts = [0, 0, 0],
      cells = 160,
      step = PERIOD / cells;
    const cx = Math.floor(px / step),
      cz = Math.floor(pz / step),
      rad = prefs.quality === 'light' ? 12 : 18;
    if (this.meadowCell?.[0] === cx && this.meadowCell?.[1] === cz && this.meadowCell?.[2] === rad) return;
    this.meadowCell = [cx, cz, rad];
    for (let dz = -rad; dz <= rad; dz++)
      for (let dx = -rad; dx <= rad; dx++) {
        const gx = cx + dx,
          gz = cz + dz,
          ix = ((gx % cells) + cells) % cells,
          iz = ((gz % cells) + cells) % cells;
        for (let j = 0; j < 3; j++) {
          const x = (gx + meadowHash(ix, iz, j * 4 + 1)) * step,
            z = (gz + meadowHash(ix, iz, j * 4 + 2)) * step;
          const canonicalX = wrapped(x),
            canonicalZ = wrapped(z),
            d = Math.hypot(x - px, z - pz);
          if (
            d >= rad * step ||
            Math.min(Math.abs(Math.abs(canonicalX) - 50), Math.abs(Math.abs(canonicalZ) - 50)) < 2.58
          )
            continue;
          const water = Math.abs(canonicalZ - streamZ(canonicalX)),
            rx = meadowHash(ix, iz, 3 + j * 4);
          if (water < 2.35 || !this.free(x, z, 0.07)) continue;
          const patch =
            Math.cos(canonicalX * 0.26 + canonicalZ * 0.09) +
            0.75 * Math.sin(canonicalZ * 0.33 - canonicalX * 0.12);
          const woods = zoneAt(x, z) === 2,
            scree = zoneAt(x, z) === 3;
          if ((scree && rx > 0.3) || rx > (woods ? 0.71 : 0.87)) continue;
          const kind = woods && patch > 0.07 ? 2 : patch > 0.66 && rx > 0.28 ? 1 : 0;
          const fade = Math.min(1, (rad * step - d) / 4);
          const h =
            (kind === 2 ? 0.63 : kind === 1 ? 0.52 : 0.48) *
            (0.55 + 0.92 * meadowHash(ix, iz, j + 19)) *
            Math.min(1, Math.max(0.11, fade));
          if (counts[kind] >= groups[kind].instanceMatrix.count) continue;
          groups[kind].setMatrixAt(
            counts[kind]++,
            this.matrix(x, ground(x, z) - 0.06, z, h * (kind === 2 ? 1.7 : 1.21), h, h, rx * 6.28),
          );
        }
      }
    groups.forEach((g, i) => {
      g.count = counts[i];
      g.instanceMatrix.needsUpdate = true;
    });
  }
  lod(px, pz) {
    this.forestEye = { x: px, z: pz };
    const h = ground(px, pz);
    this.sun.position.set(px - 37, h + 33, pz - 29);
    this.sun.target.position.set(px, h, pz);
    this.renderer.shadowMap.needsUpdate = true;
    const counts = this.treeGroups.map(() => 0);
    this.meadow(px, pz);
    for (let i = 0; i < this.trees.length; i++) {
      const v = this.trees[i],
        x = nearest(v.x, px),
        z = nearest(v.z, pz),
        h = v.h,
        d = Math.hypot(x - px, z - pz);
      v.near = d < 44;
      if (d > 145) continue;
      const broad = i % 5 === 1 || (zoneAt(v.x, v.z) === 2 && i % 5 === 2);
      const id = 1 + (broad ? 2 : 0) + (v.near ? 0 : 1);
      const trunk = broad ? 8 : 0;
      this.treeGroups[trunk].setMatrixAt(
        counts[trunk]++,
        this.matrix(x, v.y + h * 0.36, z, 0.023 * h, h * 0.72, 0.023 * h),
      );
      const width = broad ? h * (0.84 + 0.2 * Math.sin(i)) : h * (0.41 + 0.11 * Math.sin(i * 4.2));
      this.treeGroups[id].setMatrixAt(counts[id]++, this.matrix(x, v.y, z, width, h, width, v.a));
      if (broad) {
        const branch = v.near ? 6 : 7;
        this.treeGroups[branch].setMatrixAt(counts[branch]++, this.matrix(x, v.y, z, width, h, width, v.a));
      } else {
        const wide = h * (0.86 + 0.2 * Math.sin(i * 3.3));
        const needles = d < (prefs.quality === 'light' ? 30 : 52) ? 5 : 9;
        this.treeGroups[needles].setMatrixAt(counts[needles]++, this.matrix(x, v.y, z, wide, h, wide, v.a));
      }
    }
    this.treeGroups.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
