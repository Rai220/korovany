'use strict';

const dairies = [
  { x: -126, z: -53, title: 'Западная переправа', stamp: 'ладья', color: 0xeeb652 },
  { x: 54, z: -124, title: 'Северная застава', stamp: 'башня', color: 0x4383aa },
  { x: -54, z: 123, title: 'Лесной дозор', stamp: 'ветвь', color: 0x339377 },
  { x: 124, z: 54, title: 'Горный редут', stamp: 'ворон', color: 0xa65d7c },
];

// The conifer canopy is partitioned into spatial cells from a scanned tree. At close range
// separate branch clusters move against one another. Distant trees use three full portraits.
function trailGeometry(name, lod) {
  const source = trailModels[name][lod];
  const decode = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0)).buffer;
  const positions = Float32Array.from(new Int16Array(decode(source.pos)), (v) => v / 16000);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(decode(source.idx)), 1));
  if (source.uv) {
    const uv = Float32Array.from(new Uint16Array(decode(source.uv)), (v) => v / 65535);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i],
        y = 0.52 + positions[i + 1] * 0.4,
        z = positions[i + 2];
      const length = Math.hypot(x, y, z);
      normals.set([x / length, y / length, z / length], i);
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    if (lod === 'body') geo.computeVertexNormals();
  } else geo.computeVertexNormals();
  return geo;
}
function trailFoliage(name, sway, threshold) {
  const mat = new THREE.MeshLambertMaterial({
    map: texture(name),
    side: THREE.DoubleSide,
    alphaTest: threshold,
    emissiveMap: texture(name),
    emissive: 0x8c9a81,
    emissiveIntensity: 0.36,
  });
  mat.onBeforeCompile = (s) => {
    s.uniforms.windClock = windClock;
    s.vertexShader =
      'uniform float windClock;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float gust=sin(windClock*.89+instanceMatrix[3].x*.13+instanceMatrix[3].z*.16);
      transformed.x += ${sway} * gust * transformed.y * transformed.y;
      #endif`,
      );
  };
  // Thin leaves transmit skylight, including when the paper-thin back face points toward the camera.
  const wind = mat.onBeforeCompile;
  const fill = name.startsWith('fir') ? '.59' : '1.32';
  mat.onBeforeCompile = (shader) => {
    wind(shader);
    if (name.startsWith('fir')) fadeNearbyCrown(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight=max(outgoingLight,diffuseColor.rgb*' + fill + ');\n#include <opaque_fragment>',
    );
  };
  mat.customProgramCacheKey = () => name + sway;
  return mat;
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
      for (let k = 0; k < 3; k++) {
        const cx = bx - 0.82 + k * 0.68;
        this.block(cx, 1.26, bz, 0.58, 0.36, 0.47, 0x897454);
        for (const h of [-0.18, 0.18]) this.block(cx + h, 1.28, bz, 0.037, 0.38, 0.48, 0x514f48);
      }
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
      const emblems = {
        ладья:
          'M -26,7 Q 0,20 27,4 L 18,16 L -14,17 Z M -1,4 L -1,-23 L 2,-23 L 2,4 Z M 5,-21 Q 22,-13 20,0 L 5,-1 Z',
        башня:
          'M -17,18 L -14,-8 L -18,-10 L -18,-20 L -11,-20 L -11,-16 L -4,-16 L -4,-21 L 4,-21 L 4,-16 L 11,-16 L 11,-20 L 18,-20 L 18,-10 L 13,-8 L 16,18 L 4,18 L 4,8 Q 0,0 -4,8 L -4,18 Z',
        ветвь:
          'M -18,19 Q -1,6 14,-22 L 18,-24 Q 6,5 -16,23 Z M -9,10 Q -27,6 -21,-8 Q -8,-7 -9,10 M 0,0 Q -14,-6 -10,-18 Q 0,-18 0,0 M 1,1 Q 13,-9 22,-5 Q 17,7 1,1 M 8,-11 Q 21,-23 27,-17 Q 22,-9 8,-11',
        ворон:
          'M -27,9 Q -17,5 -11,-3 L -19,-13 L -4,-12 Q 5,-14 11,-11 Q 17,-14 19,-10 L 27,-6 L 19,-5 Q 17,2 8,6 L 6,16 L 11,19 L 6,19 L 2,17 L 2,10 L -3,13 L -4,19 L -11,20 L -7,15 L -6,7 L -19,13 Z',
      };
      q.save();
      q.translate(43, 49);
      q.fill(new Path2D(emblems[site.stamp]));
      q.restore();
      q.font = 'bold 38px Georgia';
      q.textAlign = 'left';
      q.fillText(site.title.toUpperCase(), 83, 63, 408);
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
      // The bronze studs frame the coloured route marker.
      this.block(x, y + 1.5, z, 0.17, 3, 0.17, 0x514533);
      this.block(x, y + 2.7, z, 0.61, 0.75, 0.12, color);
      for (const dx of [-0.21, 0.21])
        for (const dy of [-0.27, 0.27])
          this.put(this.head, 0xb79d69, x + dx, y + 2.7 + dy, z + 0.07, 0.024, 0.024, 0.015);
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
    // Small groves fill the woodland beyond the settlement, leaving entrances and the archery deck clear.
    for (let i = 0; i < 126; i++) {
      const x = -101 + meadowHash(i, 71, 15) * 82,
        z = 19 + meadowHash(i, 73, 24) * 86;
      if (
        Math.hypot(x + 50, z - 50) < 22 ||
        Math.min(Math.abs(x + 50), Math.abs(z - 50)) < 4.3 ||
        !this.free(x, z, 0.63) ||
        Math.cos(x * 0.19 + z * 0.07) + Math.sin(z * 0.1) < -0.21
      )
        continue;
      this.trees.push({
        x,
        z,
        y: ground(x, z),
        a: meadowHash(i, 1, 68) * 6.28,
        h: 6 + meadowHash(i, 2, 22) * 12,
      });
      this.bound(x, z, 0.42, 0.42);
    }
    // Stands along the outer ridge break the crest into believable tree lines. Keep the trade lane open.
    for (let i = 0; i < 165; i++) {
      const x = 20 + meadowHash(i, 4, 73) * 78,
        z = 81 + meadowHash(i, 6, 93) * 53;
      const lane = Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50));
      if (lane < 4.3 || !this.free(x, z, 0.59) || Math.sin(x * 0.12 + z * 0.17) < -0.45) continue;
      this.trees.push({
        x,
        z,
        y: ground(x, z),
        a: meadowHash(i, 1, 43) * 6.28,
        h: 7.5 + meadowHash(i, 2, 3) * 9,
      });
      this.bound(x, z, 0.48, 0.48);
    }
    const stone = trailGeometry('fieldstone', 'body'),
      stump = trailGeometry('stump', 'body');
    const debris = [
      [-45, -5, 1.2],
      [-42, -3.8, 0.63],
      [-59, 4.7, 1.1],
      [-34, 1.1, 0.83],
      [-40, -7.7, 1.4],
      [28, 3.8, 1.2],
      [59, 1.4, 1.65],
      [76, 2.8, 0.98],
      [-57, 67, 0.83],
      [-38, 69, 0.68],
      [43, -35, 0.84],
      [71, 37, 1.09],
      [80, 67, 1.32],
      [26, 70, 0.91],
    ];
    for (const [x, z, k] of debris) {
      if (!this.free(x, z, 0.85 * k)) continue;
      this.put(stone, 0x84917c, x, walkingSurface(x, z) + 0.11 * k, z, k, k, k, x * 0.19);
      this.bound(x, z, 1.4 * k, 1.13 * k);
    }
    for (const [x, z, k] of [
      [-55, 68, 0.83],
      [-66, 72, 0.7],
      [-34, 66, 0.77],
      [-58, 43, 0.67],
      [-46, -29, 0.84],
      [-28, 8, 0.74],
    ]) {
      if (!this.free(x, z, 0.64 * k)) continue;
      this.put(stump, 0x786446, x, ground(x, z) + 0.15 * k, z, k, k, k, z * 0.21);
      this.bound(x, z, 0.92 * k, 0.84 * k);
    }
  }
  shadeGround() {
    // Bake one periodic occlusion map so small-scale contact remains legible even in the light graphics preset.
    const c = document.createElement('canvas');
    c.width = c.height = 768;
    const q = c.getContext('2d'),
      unit = c.width / PERIOD;
    q.fillStyle = '#ffffff';
    q.fillRect(0, 0, c.width, c.height);
    function shade(x, z, rx, rz, alpha) {
      q.save();
      q.translate((x + WORLD_LIMIT) * unit, (z + WORLD_LIMIT) * unit);
      q.scale(rx * unit, rz * unit);
      const grad = q.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(10,10,10,' + alpha + ')');
      grad.addColorStop(0.49, 'rgba(10,10,10,' + alpha * 0.7 + ')');
      grad.addColorStop(1, 'rgba(10,10,10,0)');
      q.fillStyle = grad;
      q.fillRect(-1, -1, 2, 2);
      q.restore();
    }
    for (const [x1, x2, z1, z2] of this.obstacles) {
      const w = x2 - x1,
        d = z2 - z1;
      shade(
        (x1 + x2) / 2,
        (z1 + z2) / 2,
        Math.max(0.65, w * 0.69 + 0.35),
        Math.max(0.65, d * 0.69 + 0.35),
        0.74,
      );
    }
    for (const v of this.trees) shade(v.x + 0.28, v.z + 0.26, v.h * 0.16 + 0.5, v.h * 0.14 + 0.4, 0.32);
    this.landShadow = new THREE.CanvasTexture(c);
    this.landShadow.flipY = false;
    this.landShadow.wrapS = this.landShadow.wrapT = THREE.RepeatWrapping;
  }
  treeMeshes() {
    this.shadeGround();
    const n = this.trees.length;
    const nearBirch = birchCrown(true),
      farBirch = birchCrown(false);
    const birchLeaves = foliageMaterial('birch-spray');
    birchLeaves.vertexColors = true;
    birchLeaves.color.setHex(0xdfe5d3);
    birchLeaves.alphaTest = 0.29;
    const branches = new THREE.MeshLambertMaterial({ vertexColors: true });
    const batch = (geo, mat) => new THREE.InstancedMesh(geo, mat, n);
    const wood = this.mat(0x534936);
    const fir = trailFoliage('fir_tree_01', '.0028', 0.21);
    const young = trailFoliage('fir_sapling', '.0045', 0.24);
    this.treeGroups = [
      batch(trailGeometry('fir_tree_01', 'wood'), wood),
      batch(trailGeometry('fir_tree_01', 'near'), fir),
      batch(trailGeometry('fir_tree_01', 'far'), fir),
      batch(nearBirch.crown, birchLeaves),
      batch(farBirch.crown, birchLeaves),
      batch(trailGeometry('fir_sapling', 'near'), young),
      batch(nearBirch.wood, branches),
      batch(farBirch.wood, branches),
      batch(new THREE.CylinderGeometry(0.22, 0.74, 1, 9), this.birchBark()),
      batch(trailGeometry('fir_sapling', 'far'), young),
      batch(trailGeometry('fir_sapling', 'wood'), wood),
    ];
    const groundcover = [
      [trailGeometry('grass_medium_01', 'far'), trailFoliage('grass_medium_01', '.04', 0.22)],
      [meadowClump(), foliageMaterial('daisies')],
      [trailGeometry('fern_02', 'near'), trailFoliage('fern_02', '.022', 0.31)],
    ];
    this.meadowGroups = groundcover.map(([tuft, mat]) => {
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
      cells = 190,
      step = PERIOD / cells;
    const cx = Math.floor(px / step),
      cz = Math.floor(pz / step),
      rad = prefs.quality === 'light' ? 14 : 22;
    if (this.meadowCell?.[0] === cx && this.meadowCell?.[1] === cz && this.meadowCell?.[2] === rad) return;
    this.meadowCell = [cx, cz, rad];
    for (let dz = -rad; dz <= rad; dz++)
      for (let dx = -rad; dx <= rad; dx++) {
        const gx = cx + dx,
          gz = cz + dz,
          ix = ((gx % cells) + cells) % cells,
          iz = ((gz % cells) + cells) % cells;
        for (let j = 0; j < 5; j++) {
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
          if ((scree && rx > 0.3) || rx > (woods ? 0.79 : 0.93)) continue;
          const kind = woods && patch > 0.3 && rx < 0.31 ? 2 : patch > 1.02 && rx > 0.54 ? 1 : 0;
          const fade = Math.min(1, (rad * step - d) / 4);
          const h =
            (kind === 2 ? 0.51 : kind === 1 ? 0.42 : 0.39) *
            (0.55 + 0.92 * meadowHash(ix, iz, j + 19)) *
            Math.min(1, Math.max(0.11, fade));
          if (counts[kind] >= groups[kind].instanceMatrix.count) continue;
          groups[kind].setMatrixAt(
            counts[kind]++,
            this.matrix(x, ground(x, z) - 0.06, z, h * (kind === 2 ? 1.08 : 1.3), h, h * 1.14, rx * 6.28),
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
      if (d > 176) continue;
      const broad = i % 5 === 1 || (zoneAt(v.x, v.z) === 2 && i % 5 === 2);
      if (broad) {
        const leaves = v.near ? 3 : 4,
          limbs = v.near ? 6 : 7;
        this.treeGroups[8].setMatrixAt(
          counts[8]++,
          this.matrix(x, v.y + h * 0.36, z, 0.023 * h, h * 0.72, 0.023 * h),
        );
        const w = h * (0.84 + 0.2 * Math.sin(i));
        const pose = this.matrix(x, v.y, z, w, h, w, v.a);
        this.treeGroups[leaves].setMatrixAt(counts[leaves]++, pose);
        this.treeGroups[limbs].setMatrixAt(counts[limbs]++, pose);
      } else {
        const young = i % 5 === 0 || i % 7 === 3;
        const near = d < (prefs.quality === 'light' ? 25 : 39);
        const crown = young ? (near ? 5 : 9) : near ? 1 : 2;
        const height = young
          ? h * (0.43 + 0.18 * meadowHash(i, 8, 11))
          : h * (0.86 + 0.15 * meadowHash(i, 3, 7));
        const width = height * (0.93 + 0.22 * meadowHash(i, 4, 8));
        const pose = this.matrix(x, v.y, z, width, height, width, v.a);
        this.treeGroups[crown].setMatrixAt(counts[crown]++, pose);
        if (near) {
          const trunk = young ? 10 : 0;
          this.treeGroups[trunk].setMatrixAt(counts[trunk]++, pose);
        }
      }
    }
    this.treeGroups.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
