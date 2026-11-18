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
function pineSprays() {
  const p = [],
    uv = [],
    ix = [];
  for (let l = 0; l < 12; l++) {
    const v = l / 12,
      n = Math.round(15 - 9 * v),
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
        [1, 0, 5],
        [2, 1, 5],
        [3, 2, 5],
        [0, 3, 5],
      ])
        ix.push(id + i, id + k, id + m);
    }
  }
  return geometry(p, uv, ix);
}
function orchardCrown(detailed) {
  const paper = new Sculpt(),
    colors = [0x74944e, 0x95ab54, 0xb4b85f, 0x8f9e51];
  const geo = new THREE.IcosahedronGeometry(1, detailed ? 1 : 0);
  for (let i = 0; i < (detailed ? 24 : 10); i++) {
    const t = i / (detailed ? 24 : 10),
      a = i * 2.399,
      r = 0.19 * Math.sqrt(1 - t);
    const size = 0.19 * (1 - 0.48 * t);
    paper.add(
      geo,
      colors[i % 4],
      Math.sin(a) * r,
      0.36 + t * 0.56,
      Math.cos(a) * r * 0.9,
      size,
      size * 1.37,
      size * 0.96,
      t,
      a,
    );
  }
  const holder = new THREE.Group(),
    mesh = paper.finish(holder);
  geo.dispose();
  return mesh.geometry;
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
    const blade = new THREE.ConeGeometry(1, 1, 4);
    const flower = new THREE.IcosahedronGeometry(1, 0);
    // Groups follow the curving boundary of each meadow; gaps leave the full width of each road free.
    for (let i = 0; i < 410; i++) {
      const cx = this.rnd() * PERIOD - WORLD_LIMIT,
        cz = this.rnd() * PERIOD - WORLD_LIMIT;
      const hue = [0xf0ae3d, 0xbf81ca, 0xf1dab1, 0xe27156, 0x8ab8da][i % 5];
      for (let j = 0; j < 12; j++) {
        const x = wrapped(cx + (this.rnd() - 0.5) * 9),
          z = wrapped(cz + (this.rnd() - 0.5) * 7);
        if (
          Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50)) < 3.7 ||
          Math.abs(z - streamZ(x)) < 3 ||
          !this.free(x, z, 0.05)
        )
          continue;
        const y = ground(x, z),
          h = 0.2 + this.rnd() * 0.34;
        this.put(blade, 0x6b953f, x, y + h * 0.49, z, 0.08, h, 0.08, i + j, 0.19);
        this.put(blade, 0x81a852, x + 0.085, y + h * 0.36, z, 0.054, h * 0.72, 0.075, i + j, -0.25);
        if (j % 3 === 0) this.put(flower, hue, x - 0.045, y + h, z, 0.085, 0.067, 0.083, j);
      }
    }
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
    const n = this.trees.length;
    this.treeGroups = [new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 1, 1, 7), wood, n)];
    for (const broad of [false, true])
      for (const near of [true, false]) {
        this.treeGroups.push(
          new THREE.InstancedMesh(
            broad ? orchardCrown(near) : pineCrown(near ? 8 : 4, near ? 11 : 6, false),
            leaf,
            n,
          ),
        );
      }
    this.treeGroups.push(new THREE.InstancedMesh(pineSprays(), foliageMaterial('bough'), n));
    this.treeGroups.forEach((m) => {
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    });
    this.lod(0, 0);
  }
  lod(px, pz) {
    this.forestEye = { x: px, z: pz };
    const h = ground(px, pz);
    this.sun.position.set(px - 37, h + 33, pz - 29);
    this.sun.target.position.set(px, h, pz);
    this.renderer.shadowMap.needsUpdate = true;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.trees.length; i++) {
      const v = this.trees[i],
        x = nearest(v.x, px),
        z = nearest(v.z, pz),
        h = v.h,
        d = Math.hypot(x - px, z - pz);
      v.near = d < 44;
      if (d > 145) continue;
      const broad = i % 5 === 1;
      const id = 1 + (broad ? 2 : 0) + (v.near ? 0 : 1);
      this.treeGroups[0].setMatrixAt(
        counts[0]++,
        this.matrix(x, v.y + h * 0.35, z, 0.025 * h, h * 0.7, 0.025 * h),
      );
      const width = broad ? h : h * 0.51;
      this.treeGroups[id].setMatrixAt(counts[id]++, this.matrix(x, v.y, z, width, h, width, v.a));
      if (!broad && d < 79) this.treeGroups[5].setMatrixAt(counts[5]++, this.matrix(x, v.y, z, h, h, h, v.a));
    }
    this.treeGroups.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
