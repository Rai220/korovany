'use strict';

// Each scanline ring projects the matching front and rear artwork onto a closed limb.
function figurePart(spec, name, stature) {
  const [depth, rings] = spec.parts[name],
    scale = stature * spec.aspect,
    positions = [],
    uvs = [],
    indices = [];
  const first = rings[0],
    pivot = new THREE.Vector3(((first[1] + first[2]) / 2 - 0.5) * scale, (1 - first[0]) * stature, 0);
  for (let face = 0; face < 2; face++) {
    const steps = 16,
      offset = positions.length / 3;
    rings.forEach(([v, l, r], j) => {
      const mid = (l + r) * 0.5,
        w = (r - l) * 0.5;
      for (let k = 0; k <= steps; k++) {
        const a = (k / steps + face) * Math.PI,
          u = mid + Math.cos(a) * w;
        const faceDepth = name === 'torso' && v < 0.15 ? 1.11 : depth;
        positions.push(
          (u - 0.5) * scale - pivot.x,
          (1 - v) * stature - pivot.y,
          Math.sin(a) * Math.min(w * faceDepth, 0.156 / spec.aspect) * scale +
            (v > 0.88 && name.startsWith('leg') ? 0.043 : 0),
        );
        uvs.push(face ? (2 - u) * 0.5 : u * 0.5, 1 - v);
        if (j && k) {
          const q = offset + j * (steps + 1) + k;
          indices.push(q - steps - 2, q - 1, q, q - steps - 2, q, q - steps - 1);
        }
      }
    });
  }
  return { geo: geometry(positions, uvs, indices), pivot };
}
function horseGeometry() {
  const { aspect, grid } = figureProfiles.horse,
    h = grid.length,
    w = grid[0].length,
    pos = [],
    uvs = [],
    tri = [];
  for (let side = 0; side < 2; side++)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const u = i / (w - 1),
          v = j / (h - 1),
          thick = grid[j][i] / 255;
        const depth = (0.15 + 0.26 * Math.sin(u * Math.PI)) * Math.sqrt(thick) * (v > 0.65 ? 0.65 : 1);
        pos.push(
          (side ? depth : -depth) + (v > 0.67 ? Math.sin(u * 33) * 0.11 : 0),
          (1 - v) * 2.5,
          (u - 0.5) * 2.5 * aspect,
        );
        uvs.push(u, 1 - v);
        if (i && j && (grid[j][i] || grid[j - 1][i] || grid[j][i - 1] || grid[j - 1][i - 1])) {
          const q = side * w * h + j * w + i;
          tri.push(q - w - 1, q - w, q, q - w - 1, q, q - 1);
        }
      }
  return geometry(pos, uvs, tri);
}
function viewModel(name) {
  const { grid, aspect } = figureProfiles[name],
    rows = grid.length,
    cols = grid[0].length,
    p = [],
    uv = [],
    indices = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1),
        v = j / (rows - 1);
      p.push((u - 1) * aspect, 1 - v, 0.035 * Math.sqrt(grid[j][i] / 255));
      uv.push(u, 1 - v);
      if (i && j && (grid[j][i] || grid[j - 1][i] || grid[j][i - 1] || grid[j - 1][i - 1])) {
        const a = j * cols + i;
        indices.push(a - cols - 1, a - 1, a, a - cols - 1, a, a - cols);
      }
    }
  const m = new THREE.Mesh(
    geometry(p, uv, indices),
    new THREE.MeshStandardMaterial({
      map: texture(name, figureImages),
      alphaTest: 0.19,
      roughness: 0.74,
      metalness: 0.035,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  m.frustumCulled = false;
  m.renderOrder = 15;
  return m;
}
class Realm extends InteriorRealm {
  person(kind) {
    const look = { escort: 'guard', spy: 'elf', merchant: 'miller' }[kind] || kind;
    const height = kind === 'regent' ? 2.48 : kind === 'merchant' ? 1.86 : 2.11;
    this.rigs ||= new Map();
    const key = kind;
    if (!this.rigs.has(key)) {
      const spec = figureProfiles[look];
      const parts = {};
      Object.keys(spec.parts).forEach((n) => (parts[n] = figurePart(spec, n, height)));
      const armor = new THREE.MeshStandardMaterial({
        map: texture(look, figureImages),
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        roughness: 0.79,
        metalness: ['lord', 'guard'].includes(look) ? 0.16 : 0.025,
        color: kind === 'spy' ? 0xb0b4bd : kind === 'regent' ? 0xf2dcac : 0xffffff,
      });
      this.rigs.set(key, { parts, armor });
    }
    const { parts, armor } = this.rigs.get(key),
      g = new THREE.Group(),
      bones = {};
    for (const [name, { geo, pivot }] of Object.entries(parts)) {
      const joint = new THREE.Group();
      joint.position.copy(pivot);
      const m = new THREE.Mesh(geo, armor);
      m.castShadow = true;
      m.receiveShadow = true;
      joint.add(m);
      g.add(joint);
      bones[name] = joint;
    }
    if (kind !== 'merchant') {
      const v = parts.arm1,
        rows = figureProfiles[look].parts.arm1[1],
        tip = rows[rows.length - 1],
        x = ((tip[1] + tip[2]) / 2 - 0.5) * figureProfiles[look].aspect * height - v.pivot.x,
        y = (1 - tip[0]) * height - v.pivot.y;
      const grip = new THREE.Group();
      grip.position.set(x, y + 0.07, 0.05);
      grip.rotation.x = 1.1;
      bones.arm1.add(grip);
      this.part(grip, this.blade, 0xafb6b0, 0, 0.021, 0, 0.72, 0.76, 0.67);
      this.part(grip, this.box, 0x9f8559, 0, 0, 0, 0.27, 0.04, 0.075);
      if (['guard', 'commander', 'regent', 'lord'].includes(kind)) {
        const shield = this.makeShield();
        shield.scale.setScalar(0.84);
        shield.position.set(-0.08, -0.43, 0.1);
        bones.arm0.add(shield);
      }
    }
    g.userData = { legs: [bones.leg0, bones.leg1], arms: [bones.arm0, bones.arm1] };
    this.scene.add(g);
    return g;
  }
  makeShield() {
    if (!this.shieldGeo) {
      const pos = [
          -0.29, 0.36, 0, 0, 0.43, 0.085, 0.29, 0.36, 0, 0.25, -0.11, 0, 0, -0.43, 0.04, -0.25, -0.11, 0, 0,
          0.02, 0.15,
        ],
        uv = [0, 0.9, 0.5, 1, 1, 0.9, 0.92, 0.35, 0.5, 0, 0.08, 0.35, 0.5, 0.55],
        ix = [];
      for (let i = 0; i < 6; i++) ix.push(i, (i + 1) % 6, 6);
      this.shieldGeo = geometry(pos, uv, ix);
    }
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      this.shieldGeo,
      (this.shieldMaterial ||= new THREE.MeshStandardMaterial({
        map: texture('wood'),
        color: 0x80624b,
        side: THREE.DoubleSide,
        roughness: 0.75,
      })),
    );
    g.add(m);
    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.shieldGeo, 40),
      new THREE.LineBasicMaterial({ color: 0xcead6d }),
    );
    g.add(rim);
    this.part(g, this.head, 0xb29157, 0, 0.035, 0.155, 0.11, 0.11, 0.038);
    this.part(g, this.box, 0x8f7653, 0, 0.03, 0.086, 0.054, 0.64, 0.036);
    return g;
  }
  makeWeapon() {
    const pos = [],
      uvs = [],
      ix = [];
    for (const [y, w, z] of [
      [0, 0.06, 0.017],
      [0.11, 0.077, 0.019],
      [0.77, 0.047, 0.012],
      [0.96, 0.001, 0.001],
    ]) {
      for (const [x, d] of [
        [-w, 0],
        [-w * 0.29, z],
        [0, z * 0.72],
        [w * 0.29, z],
        [w, 0],
        [0, -z],
      ]) {
        pos.push(x, y, d);
        uvs.push(x * 5 + 0.5, y);
      }
    }
    for (let j = 1; j < 4; j++)
      for (let k = 0; k < 6; k++) {
        const prev = (j - 1) * 6 + k,
          n = (j - 1) * 6 + ((k + 1) % 6);
        ix.push(prev, n, n + 6, prev, n + 6, prev + 6);
      }
    this.blade = geometry(pos, uvs, ix);
    this.matCache.set(
      0xafb6b0,
      new THREE.MeshStandardMaterial({
        color: 0xdbe1dc,
        map: texture('steel'),
        roughness: 0.28,
        metalness: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    this.weapon = viewModel('blade');
    this.camera.add(this.weapon);
    this.shield = this.makeShield();
    this.camera.add(this.shield);
    this.bow = viewModel('bow');
    this.camera.add(this.bow);
    this.arrow3d = new THREE.Group();
    this.part(this.arrow3d, this.log, 0x897454, 0, 0, 0, 0.012, 0.88, 0.012).rotation.x = Math.PI / 2;
    this.part(this.arrow3d, this.spire, 0x7c817c, 0, 0, 0.48, 0.026, 0.1, 0.026).rotation.x = Math.PI / 2;
    this.arrow3d.visible = false;
    this.scene.add(this.arrow3d);
  }
  makeWagon() {
    const g = new THREE.Group();
    this.wagon = g;
    this.scene.add(g);
    this.wheelParts = [];
    const add = (geo, c, x, y, z, w, h, d) => this.part(g, geo, c, x, y, z, w, h, d);
    add(this.box, 0x785537, 0, 1.09, 0, 2.08, 0.26, 3.3);
    for (const s of [-1, 1]) {
      for (let j = 0; j < 4; j++) add(this.box, 0x897454, s, 1.24 + j * 0.17, 0, 0.11, 0.158, 3.3);
      for (let j = 0; j < 4; j++) add(this.box, 0x594431, s * 1.08, 1.51, -1.55 + j * 1.03, 0.08, 0.91, 0.1);
      add(this.box, 0x594431, s * 0.54, 0.93, 2.68, 0.11, 0.13, 3.15);
      for (const k of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(s * 1.14, 0.7, k * 1.09);
        g.add(wheel);
        const hoop = this.part(
          wheel,
          new THREE.TorusGeometry(0.635, 0.075, 6, 24),
          0x594431,
          0,
          0,
          0,
          1,
          1,
          1,
        );
        hoop.rotation.y = Math.PI / 2;
        const rim = this.part(
          wheel,
          new THREE.TorusGeometry(0.683, 0.025, 6, 24),
          0x646458,
          0,
          0,
          0,
          1,
          1,
          1,
        );
        rim.rotation.y = Math.PI / 2;
        for (let j = 0; j < 6; j++) {
          const spoke = this.part(wheel, this.box, 0x897454, 0, 0, 0, 0.075, 0.055, 1.23);
          spoke.rotation.x = (j * Math.PI) / 6;
        }
        this.part(wheel, this.head, 0x594431, 0, 0, 0, 0.17, 0.16, 0.16);
        this.wheelParts.push(wheel);
      }
    }
    // Longitudinal arched canopy, open at both ends.
    const pp = [],
      uu = [],
      ii = [];
    for (let j = 0; j < 7; j++)
      for (let k = 0; k <= 20; k++) {
        const a = (k * Math.PI) / 20;
        pp.push(Math.cos(a) * 1.13, 1.8 + Math.sin(a) * (1.12 - (j % 2) * 0.065), -1.68 + j * 0.56);
        uu.push(k / 20, j / 6);
        if (j && k) {
          const v = j * 21 + k;
          ii.push(v - 22, v - 1, v, v - 22, v, v - 21);
        }
      }
    const fabric = new THREE.Mesh(
      geometry(pp, uu, ii),
      new THREE.MeshStandardMaterial({
        map: texture('linen'),
        color: 0xcfc2a2,
        side: THREE.DoubleSide,
        roughness: 0.96,
      }),
    );
    fabric.castShadow = true;
    g.add(fabric);
    for (let j = 0; j < 4; j++) add(this.box, 0x897454, 0, 1.28 + j * 0.14, -1.59, 2, 0.125, 0.1);
    for (let i = 0; i < 3; i++) add(this.head, 0xb29968, (i - 1) * 0.5, 1.49, 1.0, 0.39, 0.32, 0.56);
    const horse = new THREE.Mesh(
      horseGeometry(),
      new THREE.MeshStandardMaterial({
        map: texture('horse', figureImages),
        alphaTest: 0.26,
        side: THREE.DoubleSide,
        roughness: 0.86,
      }),
    );
    horse.position.set(0, 0, 3.85);
    horse.castShadow = true;
    horse.receiveShadow = true;
    g.add(horse);
    this.horse = horse;
  }
  animateDetails(s, t, attackAnim, bob) {
    this.animateWeather(s, t);
    this.updateAtmosphere(s, t);
    this.wheelParts.forEach((w) => (w.rotation.x = -(s.wagon.x + s.wagon.z) * 1.5));
    this.horse.rotation.z = Math.sin(t * 5) * 0.011;
    this.horse.position.y = Math.abs(Math.sin(t * 4)) * 0.04;
    this.weapon.visible = s.weapon !== 'bow' && s.health > 0;
    const depth = 0.83,
      halfH = depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)),
      halfW = halfH * this.camera.aspect;
    const size = halfH * 1.53 * Math.min(1, this.camera.aspect / 0.91),
      arc = Math.sin(attackAnim * Math.PI);
    const armSide = s.arm === 'lost' ? -1 : 1;
    this.weapon.scale.set(size * armSide, size, size);
    this.weapon.position.set(
      armSide * (halfW * 1.014 - arc * 0.22),
      -halfH * 1.035 + arc * 0.08 + bob * 0.16,
      -depth + 0.04 * arc,
    );
    this.weapon.rotation.set(-arc * 0.4, -armSide * arc * 0.28, armSide * arc * (s.heavy ? 0.8 : 0.55));
    const blocking = s.blockTime > 0;
    if (blocking) {
      this.weapon.rotation.z = 0.64 * armSide;
      this.weapon.position.y += 0.1;
      this.weapon.position.x -= 0.085 * armSide;
    }

    this.shield.visible = blocking;
    this.shield.position.set(-0.21, -0.15, -0.58);
    this.shield.rotation.set(0.16, 0.22, 0.08);
    this.bow.visible = s.weapon === 'bow';
    const bowH = halfH * 1.88 * Math.min(1, this.camera.aspect / 1.05);
    this.bow.scale.setScalar(bowH);
    this.bow.position.set(
      -halfW + figureProfiles.bow.aspect * bowH - 0.009,
      -halfH * 1.01 + bob * 0.2,
      -depth,
    );
    this.bow.rotation.set(-0.09 * arc, 0.04, 0.035 * arc);
    this.arrow3d.visible = !!s.arrow;
    if (s.arrow) {
      const a = s.arrow;
      this.arrow3d.position.set(a.x, a.y, a.z);
      this.arrow3d.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(a.dx, a.dy, a.dz).normalize(),
      );
    }
    if (this.storyObjects)
      for (const obj of this.storyObjects) {
        obj.mesh.visible = obj.show(s);
        if (obj.glow) obj.glow.intensity = 0.55 + 0.17 * Math.sin(t * 2.1);
      }
  }
}
