'use strict';

// Every mesh beneath one moving joint is batched by material. Instances share surfaces and geometry.
const cryptTemplates = new Map();
let cryptSurfaces;
function cryptGrain() {
  const n = 256,
    pixels = new Uint8Array(n * n * 4);
  let seed = 193641;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  const grids = [4, 9, 21, 51].map((size) => ({
    size,
    values: Float32Array.from({ length: size * size }, rand),
  }));
  function noise(grid, u, v) {
    const { size, values } = grid,
      ix = Math.floor((u *= size)),
      iy = Math.floor((v *= size)),
      x = u - ix,
      y = v - iy;
    const sample = (a, b) => values[((iy + b) % size) * size + ((ix + a) % size)];
    return (
      (sample(0, 0) * (1 - x) + sample(1, 0) * x) * (1 - y) + (sample(0, 1) * (1 - x) + sample(1, 1) * x) * y
    );
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4,
        u = x / n,
        v = y / n,
        coarse = noise(grids[0], u, v),
        middle = noise(grids[1], u, v);
      const pore = noise(grids[2], u, v),
        fine = noise(grids[3], u, v),
        fiber = Math.abs(Math.sin(2 * Math.PI * (19 * u + 3 * v + middle * 1.3)));
      const shade =
        94 + 38 * coarse + 37 * middle + 35 * pore + 39 * fine + 24 * rand() - 48 * Math.pow(1 - fiber, 8);
      pixels[i] = shade * 1.04;
      pixels[i + 1] = shade;
      pixels[i + 2] = shade * 0.93;
      pixels[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(pixels, n, n, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function cryptSkin() {
  if (cryptSurfaces) return cryptSurfaces;
  const grain = cryptGrain();
  function material(color, roughness, metalness = 0, bump = 0.013) {
    return new THREE.MeshStandardMaterial({
      color,
      map: grain,
      bumpMap: grain,
      bumpScale: bump,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    });
  }
  function ember(color, intensity) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.26,
    });
  }
  cryptSurfaces = {
    hide: material(0x625952, 0.9),
    ash: material(0x413d45, 0.87),
    sinew: material(0x926d58, 0.86),
    bone: material(0xd9c39b, 0.72),
    bark: material(0x675c50, 0.85, 0.08, 0.023),
    chitin: material(0x39323e, 0.5, 0.14),
    carapace: material(0x83664f, 0.71, 0.12, 0.02),
    soot: material(0x393334, 0.91),
    horn: material(0x6a5141, 0.63, 0.1),
    iron: material(0x69747a, 0.63, 0.38, 0.018),
    edge: material(0xa7997d, 0.55, 0.31),
    cloak: material(0x49504b, 0.97),
    spun: material(0xbbae8c, 0.88),
    rust: material(0x996b4e, 0.81, 0.19),
    mouth: material(0x3f2729, 0.73),
    ember: ember(0xf38939, 0.9),
    glint: ember(0xffda8e, 1.55),
    ghost: ember(0x83c9be, 0.6),
    ice: ember(0xc2faf0, 1.3),
    cornea: new THREE.MeshPhysicalMaterial({
      color: 0x292d2d,
      roughness: 0.19,
      metalness: 0.12,
      clearcoat: 0.62,
      clearcoatRoughness: 0.17,
    }),
    pearl: new THREE.SphereGeometry(1, 12, 9),
  };
  cryptSurfaces.bark.map = texture('bark');
  cryptSurfaces.bark.color.set(0xbb9e83);
  cryptSurfaces.cloak.map = texture('linen');
  cryptSurfaces.cloak.color.set(0x696b5e);
  cryptSurfaces.iron.bumpMap = texture('scree');
  cryptSurfaces.iron.bumpScale = 0.016;
  return cryptSurfaces;
}
function cryptJoint(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function beastPart(group, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  group.add(m);
  return m;
}
// Vault fittings also use these two rigid construction primitives.
function beastSpan(parent, a, b, r1, r2, mat, sides = 8) {
  const from = new THREE.Vector3(...a),
    to = new THREE.Vector3(...b),
    length = from.distanceTo(to);
  const mesh = beastPart(parent, new THREE.CylinderGeometry(r2, r1, length, sides), mat);
  mesh.position.copy(from).lerp(to, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  return mesh;
}
function cryptBall(g, mat, x, y, z, a, b, c) {
  return beastPart(g, cryptSkin().pearl, mat, x, y, z, a, b, c);
}
function cryptGeo(p, uv, ix) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
// A swept surface follows its changing tangent, thickening at joints and muscle bellies.
function cryptSweep(g, mat, rows, sides = 12, steps = 3, flatten = 1) {
  const path = new THREE.CatmullRomCurve3(rows.map((r) => new THREE.Vector3(r[0], r[1], r[2])));
  const p = [],
    uv = [],
    ix = [],
    segments = (rows.length - 1) * steps,
    init = path.getTangent(0);
  const ref = Math.abs(init.z) > 0.76 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  let past = new THREE.Vector3().crossVectors(init, ref).normalize();
  for (let j = 0; j <= segments; j++) {
    const t = j / segments,
      point = path.getPoint(t),
      axis = path.getTangent(t).normalize(),
      near = Math.min(rows.length - 2, Math.floor(t * (rows.length - 1)));
    const local = t * (rows.length - 1) - near,
      rad = rows[near][3] * (1 - local) + rows[near + 1][3] * local;
    const x = past.clone().addScaledVector(axis, -past.dot(axis)).normalize(),
      y = new THREE.Vector3().crossVectors(axis, x);
    past = x;
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * 2 * Math.PI,
        r = rad * (1 + 0.036 * Math.sin(a * 3 + t * 2.7));
      const v = point
        .clone()
        .addScaledVector(x, Math.cos(a) * r)
        .addScaledVector(y, Math.sin(a) * r * flatten);
      p.push(v.x, v.y, v.z);
      uv.push((i / sides) * 2, t * 2.7);
      if (j && i) {
        const k = j * (sides + 1) + i;
        ix.push(k - sides - 2, k - sides - 1, k, k - sides - 2, k, k - 1);
      }
    }
  }
  for (const row of [0, segments]) {
    const pt = path.getPoint(row / segments),
      c = p.length / 3;
    p.push(pt.x, pt.y, pt.z);
    uv.push(0.5, 0.5);
    for (let i = 0; i < sides; i++) {
      const a = row * (sides + 1) + i;
      if (row) ix.push(a, a + 1, c);
      else ix.push(a + 1, a, c);
    }
  }
  return beastPart(g, cryptGeo(p, uv, ix), mat);
}
// Closed profiles describe a thorax, belly or pelt; a varying waist and spine keep their structure readable.
function cryptBody(g, mat, rows, vertical = false, sharpness = 1, segments = 30) {
  const p = [],
    uv = [],
    ix = [];
  for (let j = 0; j < rows.length; j++) {
    const [ax, mid, rx, ry] = rows[j];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * 2 * Math.PI,
        c = Math.cos(a),
        s = Math.sin(a);
      const ridge = 1 + 0.045 * Math.cos(4 * a + j * 0.37) + 0.023 * Math.sin(7 * a - j * 0.68);
      const x = Math.sign(c) * Math.pow(Math.abs(c), sharpness) * rx * ridge;
      const radial = mid + Math.sign(s) * Math.pow(Math.abs(s), sharpness) * ry * ridge;
      p.push(x, vertical ? ax : radial, vertical ? radial : ax);
      uv.push((i / segments) * 3, (j / (rows.length - 1)) * 2.3);
      if (i && j) {
        const k = j * (segments + 1) + i;
        ix.push(k - segments - 2, k - segments - 1, k, k - segments - 2, k, k - 1);
      }
    }
  }
  return beastPart(g, cryptGeo(p, uv, ix), mat);
}
function cryptPlate(g, mat, ring, ridge, cracked = false) {
  const p = [],
    uv = [],
    ix = [],
    n = ring.length;
  for (let side = 0; side < 2; side++) {
    for (const [x, y, z] of ring) {
      p.push(x, y, z - side * 0.022);
      uv.push(x * 4, y * 4);
    }
    p.push(ridge[0], ridge[1], ridge[2] - side * 0.06);
    uv.push(ridge[0] * 4, ridge[1] * 4);
    const k = side * (n + 1);
    for (let i = 0; i < n; i++) ix.push(k + i, k + ((i + 1) % n), k + n);
  }
  for (let i = 0; i < n; i++) {
    const b = (i + 1) % n;
    ix.push(i, b, b + n + 1, i, b + n + 1, i + n + 1);
  }
  beastPart(g, cryptGeo(p, uv, ix), mat);
  if (cracked) {
    const a = ring[1],
      b = ring[Math.floor(n * 0.6)],
      v = [ridge[0], ridge[1], ridge[2] + 0.003, 0.012];
    cryptSweep(g, cryptSkin().rust, [[...a, 0.003], v, [...b, 0.002]], 6, 2);
  }
}
function cryptRags(g, mat, yTop, yBottom, width, z, seed, back = false) {
  const p = [],
    uv = [],
    ix = [],
    nx = 22,
    ny = 6;
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const t = j / ny,
        v = i / nx,
        u = v * 2 - 1,
        n = Math.sin(i * 92.31 + seed) * 313.76;
      const end = 0.08 * Math.sin(i * 0.58 + seed) + 0.14 * (n - Math.floor(n)) + (i % 5 === 0 ? 0.13 : 0);
      const x = u * width * (0.85 + 0.25 * t) + 0.035 * Math.sin(i * 0.3 + t * 1.3) * t;
      const y = yTop + (yBottom + end - yTop) * t;
      const zz =
        z +
        (back ? -1 : 1) *
          (0.047 * Math.sin(v * 9 * Math.PI + seed) * (0.3 + 0.7 * t) - 0.15 * Math.abs(u) ** 2) +
        (back ? -0.07 : 0.045) * t * t;
      p.push(x, y, zz);
      uv.push(v * 2, t * 2.8);
      if (i && j) {
        const k = j * (nx + 1) + i;
        ix.push(k - nx - 2, k - nx - 1, k, k - nx - 2, k, k - 1);
      }
    }
  beastPart(g, cryptGeo(p, uv, ix), mat);
}
function cryptFuse(g) {
  const kits = new Map();
  for (const obj of [...g.children]) {
    if (obj.isGroup) {
      cryptFuse(obj);
      continue;
    }
    if (!obj.isMesh) continue;
    if (!kits.has(obj.material)) kits.set(obj.material, { p: [], n: [], uv: [], ix: [] });
    const out = kits.get(obj.material),
      base = out.p.length / 3,
      geom = obj.geometry;
    obj.updateMatrix();
    const normal = new THREE.Matrix3().getNormalMatrix(obj.matrix),
      v = new THREE.Vector3();
    for (let i = 0; i < geom.attributes.position.count; i++) {
      v.fromBufferAttribute(geom.attributes.position, i).applyMatrix4(obj.matrix);
      out.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(geom.attributes.normal, i).applyMatrix3(normal).normalize();
      out.n.push(v.x, v.y, v.z);
      const u = geom.attributes.uv;
      out.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    for (let i = 0; i < (geom.index ? geom.index.count : geom.attributes.position.count); i++)
      out.ix.push(base + (geom.index ? geom.index.getX(i) : i));
    g.remove(obj);
  }
  for (const [mat, a] of kits) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
    geo.setIndex(a.ix);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
}
function skullModel(kind, parent, jaw) {
  const pack = cryptSkulls[kind];
  const mats = pack.tex.map((data) => {
    const tex = new THREE.TextureLoader().load(data);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshStandardMaterial({
      map: tex,
      color: kind === 'deer' ? 0xe4d9bf : 0xdad0b7,
      roughness: 0.87,
    });
  });
  for (const d of pack.mesh) {
    const g = new THREE.BufferGeometry();
    const positions = Float32Array.from(castValues(d.p, Int16Array), (v) => v * 0.0001);
    if (kind === 'deer') {
      // The centre of the scan falls between the antlers. Shorten just their crown to fit the vaults.
      for (let i = 1; i < positions.length; i += 3)
        positions[i] -= 0.263 * THREE.MathUtils.smoothstep(positions[i], -0.016, 0.539);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(
        Float32Array.from(castValues(d.n, Int8Array), (v) => v / 127),
        3,
      ),
    );
    g.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        Float32Array.from(castValues(d.uv, Uint16Array), (v) => v / 65535),
        2,
      ),
    );
    g.setIndex(new THREE.BufferAttribute(castValues(d.ix, Uint16Array), 1));
    const target = kind === 'wolf' && d.m === 0 ? jaw : parent;
    const m = beastPart(target, g, mats[d.m]);
    if (target === jaw) m.position.copy(jaw.position).multiplyScalar(-1);
  }
}
function eyeLight(group, side, x, y, z, r, cold = false) {
  const k = cryptSkin();
  cryptBall(group, cold ? k.ghost : k.ember, side * x, y, z, r, 0.63 * r, 0.74 * r);
  cryptBall(group, cold ? k.ice : k.glint, side * x, y + 0.1 * r, z + 0.57 * r, 0.37 * r, 0.42 * r, 0.28 * r);
}
function guardHairs() {
  if (guardHairs.material) return guardHairs.material;
  const n = 128,
    texels = new Uint8Array(n * n * 4);
  let state = 742;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  for (let i = 0; i < 210; i++) {
    const root = (random() - 0.5) * 1.08,
      len = 0.42 + 0.57 * Math.sqrt(random()),
      sweep = (random() - 0.5) * 0.3;
    const light = 104 + 104 * Math.pow(random(), 1.8),
      width = 0.4 + 0.85 * random();
    for (let j = 0; j < n * len; j++) {
      const t = j / n,
        v = t / len,
        x = n * (0.5 + root * (1 - 0.4 * v) + sweep * v * v + 0.018 * Math.sin(v * 4 + i) * v);
      for (let q = Math.floor(x - width); q <= Math.ceil(x + width); q++) {
        if (q < 0 || q >= n) continue;
        const a =
          Math.max(0, 1 - Math.abs(q - x) / (width * (1 - 0.55 * v) + 0.48)) *
          (1 - Math.max(0, v - 0.83) * 4.8);
        const k = (j * n + q) * 4;
        if (a * 255 < texels[k + 3]) continue;
        texels[k] = light * (1 + 0.2 * v);
        texels[k + 1] = light * (0.95 + 0.1 * v);
        texels[k + 2] = light * (0.86 + 0.14 * v);
        texels[k + 3] = a * 255;
      }
    }
  }
  const tex = new THREE.DataTexture(texels, n, n, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  guardHairs.material = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xbca38a,
    emissive: 0x786457,
    emissiveMap: tex,
    emissiveIntensity: 0.4,
    alphaTest: 0.41,
    side: THREE.DoubleSide,
    roughness: 0.93,
  });
  return guardHairs.material;
}
function furLock(g, root, tip, across) {
  const p = [],
    uv = [],
    ix = [];
  for (let j = 0; j < 4; j++) {
    const t = j / 3,
      width = 0.73 - 0.3 * t;
    for (const sign of [-1, 1]) {
      for (let a = 0; a < 3; a++)
        p.push(
          root[a] +
            (tip[a] - root[a]) * t +
            sign * across[a] * width +
            (a === 1 ? 0.02 * Math.sin(Math.PI * t) : 0),
        );
      uv.push(sign < 0 ? 0 : 1, t);
    }
    if (j) {
      const a = j * 2;
      ix.push(a - 2, a - 1, a + 1, a - 2, a + 1, a);
    }
  }
  beastPart(g, cryptGeo(p, uv, ix), guardHairs());
}
function houndFoot(body, side, front, index) {
  const k = cryptSkin(),
    s = side,
    g = cryptJoint(body, 'leg' + index, s * 0.207, front ? 0.716 : 0.666, front ? 0.28 : -0.46);
  const knee = front ? [s * 0.042, -0.307, -0.064] : [s * 0.049, -0.234, 0.129];
  const a = cryptJoint(g, 'ankle' + index, ...knee);
  cryptSweep(
    g,
    k.hide,
    [
      [0, 0.06, 0.01, 0.106],
      [s * 0.012, -0.015, 0.007, front ? 0.12 : 0.154],
      [s * 0.036, -0.12, front ? -0.058 : 0.108, front ? 0.096 : 0.137],
      [...knee, 0.068],
    ],
    14,
    3,
    0.78,
  );
  const heel = front ? [s * 0.022, -0.278, 0.038] : [s * 0.039, -0.188, -0.204];
  cryptSweep(
    a,
    k.sinew,
    [
      [0, 0, 0, 0.07],
      [s * 0.015, -0.076, front ? 0.006 : -0.072, 0.077],
      [s * 0.018, -0.134, front ? 0.015 : -0.148, 0.052],
      [...heel, 0.045],
    ],
    12,
    3,
    0.81,
  );
  const toe = front ? [s * 0.036, -0.365, 0.115] : [s * 0.05, -0.381, -0.1];
  cryptSweep(
    a,
    k.soot,
    [
      [...heel, 0.051],
      [s * 0.028, (heel[1] + toe[1]) * 0.5, (heel[2] + toe[2]) * 0.5, 0.045],
      [...toe, 0.063],
    ],
    11,
    3,
    0.83,
  );
  for (const f of [-1, 0, 1]) {
    const x = toe[0] + f * 0.034,
      y = toe[1],
      z = toe[2] + (f ? 0 : 0.021);
    cryptSweep(
      a,
      k.horn,
      [
        [x, y, z, 0.039],
        [x, y - 0.013, z + 0.041, 0.034],
        [x, y - 0.025, z + 0.079, 0.017],
        [x, y - 0.031, z + 0.097, 0.003],
      ],
      8,
      2,
      0.72,
    );
  }
  return { side, front, z: g.position.z };
}
function sculptHound(body) {
  const k = cryptSkin();
  cryptBody(body, k.hide, [
    [-0.74, 0.68, 0.066, 0.09],
    [-0.63, 0.7, 0.203, 0.207],
    [-0.5, 0.7, 0.251, 0.239],
    [-0.36, 0.7, 0.22, 0.204],
    [-0.18, 0.68, 0.166, 0.157],
    [0, 0.719, 0.208, 0.226],
    [0.15, 0.754, 0.252, 0.285],
    [0.29, 0.8, 0.288, 0.306],
    [0.43, 0.84, 0.221, 0.238],
    [0.53, 0.854, 0.148, 0.175],
    [0.61, 0.855, 0.09, 0.106],
  ]);
  const head = cryptJoint(body, 'head', 0, 0.881, 0.624),
    jaw = cryptJoint(head, 'jaw', 0, -0.002, -0.135);
  skullModel('wolf', head, jaw);
  const eyes = cryptJoint(head, 'eyes');
  for (const s of [-1, 1]) {
    eyeLight(eyes, s, 0.09, 0.07, -0.025, 0.016);
    // Ribs follow the barrel and disappear beneath the pelt at the belly.
    for (let i = 0; i < 5; i++) {
      const z = 0.226 - i * 0.074,
        r = 0.252 - i * 0.015;
      cryptSweep(
        body,
        k.sinew,
        [
          [s * r * 0.64, 0.907 - i * 0.019, z - 0.035, 0.024],
          [s * r, 0.802 - i * 0.015, z, 0.033],
          [s * r * 0.91, 0.677 - i * 0.015, z - 0.006, 0.018],
          [s * r * 0.58, 0.574 + i * 0.006, z - 0.036, 0.005],
        ],
        8,
        3,
        0.64,
      );
    }
  }
  // Coarse guard hairs cross the dark undercoat in shingled, backwards-facing locks.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < 3; i++) {
        const z = 0.492 - j * 0.051,
          y = 1.014 - i * 0.088 - j * 0.011,
          x = side * (0.092 + i * 0.068);
        const x1 = x + side * 0.067,
          zz = z - (i % 2 ? 0.045 : 0);
        furLock(
          body,
          [x, y + 0.026, zz + 0.043],
          [x1 + side * 0.047, y - 0.129 - (j % 3) * 0.021, zz - 0.121],
          [0.052 * side, i * 0.007, 0.015],
        );
      }
    for (let j = 0; j < 7; j++) {
      const z = 0.19 - j * 0.122,
        y = 0.979 - Math.sin(j * 0.61) * 0.045 + (j > 4 ? 0.015 : 0);
      furLock(
        body,
        [side * 0.057, y, z],
        [side * 0.127, y - 0.097, z - 0.154],
        [side * 0.058, -0.012, 0.015],
      );
      furLock(
        body,
        [side * 0.135, y - 0.056, z + 0.027],
        [side * 0.238, y - 0.187, z - 0.121],
        [side * 0.037, -0.014, 0.038],
      );
    }
    const e = side;
    cryptPlate(
      head,
      k.ash,
      [
        [e * 0.058, 0.051, -0.207],
        [e * 0.125, 0.068, -0.238],
        [e * 0.159, 0.205, -0.241],
        [e * 0.153, 0.256, -0.2],
        [e * 0.101, 0.193, -0.158],
        [e * 0.062, 0.085, -0.134],
      ],
      [e * 0.126, 0.132, -0.198],
    );
    cryptPlate(
      head,
      k.horn,
      [
        [e * 0.09, 0.091, -0.146],
        [e * 0.144, 0.201, -0.201],
        [e * 0.124, 0.17, -0.153],
        [e * 0.093, 0.115, -0.128],
      ],
      [e * 0.113, 0.136, -0.157],
    );
  }
  const tail = cryptJoint(body, 'tail', 0, 0.76, -0.628);
  cryptSweep(
    tail,
    k.ash,
    [
      [0, 0, 0, 0.09],
      [0.018, 0.047, -0.143, 0.08],
      [0.037, 0.006, -0.31, 0.065],
      [0.018, -0.102, -0.468, 0.047],
      [-0.014, -0.117, -0.634, 0.004],
    ],
    14,
    3,
    0.77,
  );
  const legs = [];
  for (const s of [-1, 1]) for (const f of [true, false]) legs.push(houndFoot(body, s, f, legs.length));
  return legs;
}
function weaverFoot(body, s, index, rank) {
  const k = cryptSkin(),
    rootZ = [0.292, 0.155, 0.015, -0.118][rank];
  const leg = cryptJoint(
    body,
    'leg' + index,
    s * (0.193 + Math.sin((rank / 3) * Math.PI) * 0.051),
    0.548,
    rootZ,
  );
  const knees = [
    [0.453, 0.227, 0.386],
    [0.591, 0.287, 0.192],
    [0.663, 0.251, -0.148],
    [0.577, 0.208, -0.438],
  ];
  const toes = [
    [0.616, -0.538, 0.752],
    [0.821, -0.536, 0.421],
    [0.846, -0.539, -0.356],
    [0.704, -0.532, -0.706],
  ];
  const [kx, ky, kz] = knees[rank],
    [tx, ty, tz] = toes[rank];
  const knee = [s * kx, ky, kz],
    ankle = cryptJoint(leg, 'ankle' + index, ...knee);
  const heel = [s * (tx - kx) * 0.61, (ty - ky) * 0.54, (tz - kz) * 0.6],
    toe = [s * (tx - kx), ty - ky, tz - kz];
  cryptSweep(
    leg,
    k.chitin,
    [
      [0, 0, 0, 0.073],
      [s * 0.126, 0.052, kz * 0.12, 0.089],
      [s * kx * 0.59, ky * 0.69, kz * 0.62, 0.056],
      [s * kx * 0.86, ky * 0.96, kz * 0.9, 0.049],
      [...knee, 0.069],
    ],
    13,
    3,
    0.78,
  );
  cryptSweep(
    leg,
    k.carapace,
    [
      [s * kx * 0.25, ky * 0.37 + 0.027, kz * 0.32, 0.024],
      [s * kx * 0.49, ky * 0.64 + 0.031, kz * 0.52, 0.028],
      [s * kx * 0.81, ky * 0.97 + 0.025, kz * 0.83, 0.008],
    ],
    8,
    3,
  );
  cryptSweep(
    ankle,
    k.horn,
    [
      [0, 0.025, 0, 0.071],
      [s * 0.02, -0.043, (tz - kz) * 0.059, 0.064],
      [heel[0] * 0.58, heel[1] * 0.5, heel[2] * 0.5, 0.046],
      [...heel, 0.035],
    ],
    12,
    3,
    0.87,
  );
  cryptSweep(
    ankle,
    k.soot,
    [
      [...heel, 0.039],
      [(heel[0] + toe[0]) * 0.5, (heel[1] + toe[1]) * 0.5, (heel[2] + toe[2]) * 0.5, 0.026],
      [...toe, 0.008],
      [toe[0] + s * 0.012, toe[1] - 0.009, toe[2] + 0.016, 0.002],
    ],
    9,
    3,
    0.74,
  );
  for (let i = 1; i <= 4; i++) {
    const t = i / 5,
      x = heel[0] * t,
      y = heel[1] * t,
      z = heel[2] * t;
    cryptSweep(
      ankle,
      k.horn,
      [
        [x, y, z, 0.009],
        [x + s * (0.041 - t * 0.014), y + 0.017, z - 0.02, 0.004],
        [x + s * 0.058, y + 0.042, z - 0.045, 0.001],
      ],
      5,
      2,
    );
  }
  return { side: s, z: rootZ, spider: true, rank };
}
function sculptWeaver(body) {
  const k = cryptSkin();
  cryptBody(
    body,
    k.chitin,
    [
      [-0.789, 0.713, 0.027, 0.037],
      [-0.75, 0.701, 0.153, 0.121],
      [-0.64, 0.673, 0.286, 0.245],
      [-0.476, 0.669, 0.382, 0.303],
      [-0.305, 0.652, 0.396, 0.283],
      [-0.157, 0.621, 0.338, 0.233],
      [-0.078, 0.587, 0.221, 0.16],
      [0.013, 0.57, 0.143, 0.08],
    ],
    false,
    0.92,
    38,
  );
  cryptBody(
    body,
    k.carapace,
    [
      [-0.124, 0.568, 0.128, 0.12],
      [-0.035, 0.591, 0.244, 0.163],
      [0.094, 0.602, 0.286, 0.175],
      [0.237, 0.594, 0.268, 0.177],
      [0.348, 0.565, 0.219, 0.144],
      [0.409, 0.545, 0.119, 0.086],
    ],
    false,
    0.83,
    30,
  );
  // The broken chevrons follow the sloping shell rather than floating above it.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -0.612 + i * 0.095,
        w = [0.219, 0.29, 0.324, 0.326, 0.287][i],
        y = [0.914, 0.952, 0.96, 0.937, 0.898][i];
      cryptPlate(
        body,
        i % 2 ? k.rust : k.edge,
        [
          [s * 0.019, y, z + 0.045],
          [s * 0.076, y + 0.004, z + 0.046],
          [s * w * 0.71, y - 0.046, z - 0.035],
          [s * w, y - 0.109, z - 0.083],
          [s * w * 0.66, y - 0.056, z - 0.044],
        ],
        [s * w * 0.48, y - 0.01, z + 0.009],
      );
    }
    for (let i = 0; i < 5; i++) {
      const z = -0.58 + i * 0.084;
      cryptSweep(
        body,
        k.bark,
        [
          [s * 0.292, 0.773, z, 0.017],
          [s * 0.355, 0.731, z + 0.006, 0.014],
          [s * 0.376, 0.689, z + 0.021, 0.004],
        ],
        7,
        2,
      );
    }
    for (let i = 0; i < 3; i++) {
      const z = 0.26 - i * 0.126;
      cryptPlate(
        body,
        k.chitin,
        [
          [s * 0.034, 0.767, z],
          [s * 0.113, 0.758, z + 0.038],
          [s * 0.239, 0.689, z - 0.011],
          [s * 0.263, 0.603, z - 0.089],
          [s * 0.228, 0.639, z - 0.104],
          [s * 0.094, 0.713, z - 0.054],
        ],
        [s * 0.169, 0.731, z - 0.024],
      );
    }
  }
  for (const side of [-1, 1])
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 2; i++) {
        const t = j / 6,
          z = -0.657 + t * 0.48,
          r = 0.288 + 0.084 * Math.sin(t * Math.PI),
          y = 0.726 + i * 0.091,
          x = side * r * (i ? 0.82 : 1);
        furLock(
          body,
          [x, y, z],
          [x + side * (0.021 + 0.018 * i), y - 0.073, z - 0.081],
          [0.004, 0.024, 0.034],
        );
      }
  const head = cryptJoint(body, 'head', 0, 0.578, 0.376),
    jaw = cryptJoint(head, 'jaw', 0, -0.026, 0.015);
  cryptBody(
    head,
    k.chitin,
    [
      [-0.055, 0.017, 0.179, 0.105],
      [0.027, 0.028, 0.222, 0.139],
      [0.122, 0.012, 0.214, 0.131],
      [0.201, -0.013, 0.15, 0.101],
      [0.243, -0.023, 0.091, 0.059],
    ],
    false,
    0.82,
  );
  const eyes = cryptJoint(head, 'eyes');
  for (const s of [-1, 1]) {
    for (let j = 0; j < 5; j++) {
      const z = -0.604 + j * 0.095,
        x = s * (0.285 + 0.073 * Math.sin((j / 4) * Math.PI));
      cryptPlate(
        body,
        k.carapace,
        [
          [x * 0.84, 0.821, z + 0.049],
          [x * 0.99, 0.765, z + 0.073],
          [x * 1.067, 0.689, z + 0.034],
          [x * 1.05, 0.665, z - 0.065],
          [x * 0.96, 0.736, z - 0.04],
        ],
        [x * 1.026, 0.747, z],
      );
    }
    for (const [x, y, z, r] of [
      [0.061, 0.05, 0.22, 0.043],
      [0.137, 0.051, 0.18, 0.026],
      [0.178, 0.034, 0.136, 0.023],
      [0.173, 0.078, 0.07, 0.019],
    ]) {
      cryptBall(head, k.chitin, s * x, y, z - 0.008, r * 1.18, r * 1.1, r * 0.86);

      cryptBall(eyes, k.cornea, s * x, y + 0.004, z + r * 0.52, r * 0.81, r * 0.78, r * 0.4);
      cryptBall(eyes, k.ice, s * x - r * 0.16, y + r * 0.26, z + r * 0.84, r * 0.13, r * 0.1, r * 0.07);
    }
    cryptSweep(
      jaw,
      k.carapace,
      [
        [s * 0.108, 0.022, 0.151, 0.06],
        [s * 0.117, -0.043, 0.207, 0.072],
        [s * 0.102, -0.1, 0.227, 0.05],
      ],
      11,
      3,
    );
    cryptSweep(
      jaw,
      k.bone,
      [
        [s * 0.107, -0.088, 0.222, 0.038],
        [s * 0.124, -0.139, 0.25, 0.031],
        [s * 0.109, -0.196, 0.274, 0.019],
        [s * 0.06, -0.225, 0.269, 0.002],
      ],
      12,
      3,
      0.77,
    );
    cryptSweep(
      head,
      k.chitin,
      [
        [s * 0.172, -0.029, 0.052, 0.045],
        [s * 0.254, -0.05, 0.114, 0.056],
        [s * 0.29, -0.048, 0.198, 0.035],
        [s * 0.279, -0.126, 0.24, 0.016],
        [s * 0.251, -0.161, 0.251, 0.003],
      ],
      11,
      3,
    );
  }
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) legs.push(weaverFoot(body, s, legs.length, i));
  return legs;
}
function wardenFoot(body, s, i) {
  const k = cryptSkin(),
    g = cryptJoint(body, 'leg' + i, s * 0.194, 0.887, -0.042),
    ankle = cryptJoint(g, 'ankle' + i, s * 0.059, -0.374, 0.072);
  cryptSweep(
    g,
    k.ash,
    [
      [0, 0.05, -0.033, 0.147],
      [s * 0.028, -0.05, 0.016, 0.143],
      [s * 0.056, -0.197, 0.047, 0.115],
      [s * 0.059, -0.374, 0.072, 0.083],
    ],
    15,
    3,
    0.8,
  );
  cryptSweep(
    g,
    k.bone,
    [
      [s * 0.07, -0.06, 0.025, 0.052],
      [s * 0.094, -0.17, 0.082, 0.049],
      [s * 0.078, -0.29, 0.112, 0.033],
      [s * 0.057, -0.347, 0.105, 0.048],
    ],
    11,
    3,
    0.67,
  );
  cryptPlate(
    ankle,
    k.iron,
    [
      [s * -0.075, 0.04, 0.012],
      [s * 0.012, 0.105, 0.061],
      [s * 0.106, 0.025, 0.071],
      [s * 0.071, -0.088, 0.084],
      [s * 0.019, -0.175, 0.07],
      [s * -0.058, -0.106, 0.04],
    ],
    [s * 0.018, 0.006, 0.137],
    true,
  );
  cryptSweep(
    ankle,
    k.sinew,
    [
      [0, 0.03, 0, 0.089],
      [s * 0.018, -0.1, -0.064, 0.106],
      [s * 0.01, -0.23, -0.139, 0.077],
      [s * 0.022, -0.294, -0.143, 0.065],
    ],
    13,
    3,
    0.81,
  );
  cryptSweep(
    ankle,
    k.bark,
    [
      [s * 0.022, -0.283, -0.143, 0.071],
      [s * 0.033, -0.362, -0.101, 0.063],
      [s * 0.034, -0.427, -0.034, 0.07],
      [s * 0.025, -0.447, 0.026, 0.073],
    ],
    12,
    3,
    0.77,
  );
  for (const t of [-1, 1])
    cryptSweep(
      ankle,
      k.horn,
      [
        [s * 0.023 + t * 0.034, -0.425, -0.04, 0.061],
        [s * 0.024 + t * 0.04, -0.454, 0.015, 0.065],
        [s * 0.02 + t * 0.044, -0.471, 0.088, 0.052],
        [s * 0.02 + t * 0.045, -0.473, 0.143, 0.011],
      ],
      13,
      3,
      0.63,
    );
  return { side: s, front: false, z: 0 };
}
function wardenArm(body, s, index) {
  const k = cryptSkin(),
    arm = cryptJoint(body, 'arm' + index, s * 0.334, 1.593, -0.019),
    elbow = cryptJoint(arm, 'fore' + index, s * 0.154, -0.334, 0.007);
  const x = (v) => s * v;
  cryptSweep(
    arm,
    k.hide,
    [
      [0, 0.067, -0.01, 0.145],
      [x(0.068), -0.024, 0.001, 0.141],
      [x(0.109), -0.193, 0.001, 0.105],
      [x(0.154), -0.334, 0.007, 0.079],
    ],
    14,
    3,
    0.88,
  );
  cryptSweep(
    arm,
    k.bone,
    [
      [x(0.061), -0.095, 0.018, 0.055],
      [x(0.096), -0.174, 0.08, 0.05],
      [x(0.142), -0.242, 0.056, 0.033],
      [x(0.163), -0.295, 0.038, 0.054],
    ],
    11,
    3,
    0.74,
  );
  for (let i = 0; i < (s > 0 ? 4 : 3); i++) {
    const y = 0.095 - i * 0.048,
      x0 = 0.03 + i * 0.029;
    cryptPlate(
      arm,
      s > 0 ? k.iron : k.bark,
      [
        [x(x0 - 0.089), y + 0.045, 0.04],
        [x(x0 + 0.052), y + 0.076, 0.075],
        [x(x0 + 0.139), y + 0.025, 0.05],
        [x(x0 + 0.174), y - 0.04, -0.034],
        [x(x0 + 0.168), y - 0.091, -0.062],
        [x(x0 + 0.106), y - 0.054, -0.072],
        [x(x0 + 0.071), y - 0.087, 0.047],
        [x(x0 - 0.049), y - 0.039, 0.108],
      ],
      [x(x0 + 0.068), y + 0.03, 0.139],
      i === 0,
    );
  }
  if (s > 0) {
    cryptSweep(
      arm,
      k.bark,
      [
        [x(0.012), 0.064, -0.031, 0.074],
        [x(0.07), 0.153, -0.079, 0.067],
        [x(0.106), 0.248, -0.121, 0.04],
        [x(0.147), 0.316, -0.156, 0.003],
      ],
      11,
      3,
    );
    cryptSweep(
      arm,
      k.bone,
      [
        [x(0.067), 0.16, -0.078, 0.039],
        [x(0.143), 0.183, -0.072, 0.025],
        [x(0.213), 0.199, -0.069, 0.002],
      ],
      9,
      3,
    );
  }
  cryptSweep(
    elbow,
    k.sinew,
    [
      [0, 0.02, 0, 0.088],
      [x(0.046), -0.075, 0.051, 0.12],
      [x(0.084), -0.163, 0.111, 0.098],
      [x(0.086), -0.262, 0.159, 0.066],
    ],
    13,
    3,
    0.82,
  );
  cryptPlate(
    elbow,
    k.iron,
    [
      [x(-0.057), 0.017, 0.043],
      [x(0.067), 0.041, 0.015],
      [x(0.142), -0.049, 0.104],
      [x(0.167), -0.156, 0.1],
      [x(0.105), -0.223, 0.151],
      [x(0.061), -0.241, 0.199],
      [x(0.013), -0.134, 0.137],
    ],
    [x(0.087), -0.097, 0.193],
    true,
  );
  cryptSweep(
    elbow,
    k.bark,
    [
      [x(0.08), -0.236, 0.142, 0.07],
      [x(0.089), -0.286, 0.175, 0.084],
      [x(0.101), -0.325, 0.19, 0.066],
    ],
    12,
    3,
    0.66,
  );
  for (let i = 0; i < 4; i++) {
    const ox = 0.036 * i + 0.025,
      z = 0.181 + 0.009 * Math.sin(i),
      reach = [0.159, 0.188, 0.173, 0.137][i];
    cryptSweep(
      elbow,
      k.horn,
      [
        [x(ox), -0.296, z, 0.027],
        [x(ox + 0.014), -0.343, z + 0.033, 0.026],
        [x(ox + 0.017), -0.331 - reach * 0.56, z + 0.071, 0.019],
        [x(ox + 0.011), -0.316 - reach * 0.84, z + 0.096, 0.011],
        [x(ox - 0.01), -0.304 - reach, z + 0.098, 0.002],
      ],
      9,
      3,
    );
  }
  cryptSweep(
    elbow,
    k.bone,
    [
      [x(0.035), -0.276, 0.18, 0.03],
      [x(-0.01), -0.32, 0.23, 0.022],
      [x(-0.022), -0.366, 0.25, 0.004],
    ],
    9,
    3,
  );
}
function sculptWarden(body) {
  const k = cryptSkin();
  cryptBody(
    body,
    k.ash,
    [
      [0.77, -0.064, 0.133, 0.125],
      [0.84, -0.059, 0.221, 0.159],
      [0.965, -0.011, 0.206, 0.175],
      [1.08, -0.012, 0.173, 0.151],
      [1.197, -0.021, 0.239, 0.189],
      [1.32, -0.035, 0.304, 0.208],
      [1.45, -0.045, 0.377, 0.237],
      [1.56, -0.076, 0.382, 0.236],
      [1.643, -0.09, 0.304, 0.204],
      [1.713, -0.048, 0.157, 0.13],
      [1.8, 0.008, 0.117, 0.105],
    ],
    true,
    0.86,
    35,
  );
  cryptRags(body, k.cloak, 1.61, 0.435, 0.375, -0.204, 2, true);
  cryptRags(body, k.cloak, 1.02, 0.47, 0.165, 0.15, 5);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const y = 1.56 - i * 0.071,
        w = [0.324, 0.341, 0.334, 0.294, 0.262, 0.21][i];
      const tip = s > 0 && i === 3 ? 0.139 : 0.038 + i * 0.007;
      cryptSweep(
        body,
        k.bone,
        [
          [s * 0.092, y + 0.06, -0.162, 0.035],
          [s * w * 0.83, y + 0.049, -0.125, 0.042],
          [s * w, y - 0.007, 0.029, 0.041],
          [s * w * 0.82, y - 0.061, 0.154, 0.031],
          [s * tip, y - 0.067, 0.192 - i * 0.009, 0.009],
        ],
        12,
        3,
        0.7,
      );
    }
    cryptSweep(
      body,
      k.sinew,
      [
        [s * 0.122, 1.753, -0.032, 0.05],
        [s * 0.166, 1.675, 0.047, 0.048],
        [s * 0.292, 1.593, 0.066, 0.052],
        [s * 0.326, 1.55, 0.011, 0.044],
      ],
      12,
      3,
      0.74,
    );
    cryptSweep(
      body,
      k.iron,
      [
        [s * 0.154, 1.019, -0.076, 0.037],
        [s * 0.212, 0.972, 0, 0.033],
        [s * 0.172, 0.959, 0.118, 0.039],
        [s * 0.052, 0.94, 0.162, 0.036],
      ],
      9,
      3,
      0.63,
    );
    for (let i = 0; i < 3; i++) {
      const y = 1.0 - i * 0.095;
      cryptPlate(
        body,
        i % 2 ? k.iron : k.bark,
        [
          [s * 0.089, y + 0.037, 0.139],
          [s * 0.232, y + 0.085, 0.079],
          [s * 0.277, y - 0.023, 0.004],
          [s * 0.235, y - 0.118, 0.047],
          [s * 0.217, y - 0.081, 0.082],
          [s * 0.148, y - 0.147, 0.132],
          [s * 0.083, y - 0.075, 0.167],
        ],
        [s * 0.197, y - 0.029, 0.18],
        i === 0,
      );
    }
  }
  cryptSweep(
    body,
    k.bark,
    [
      [0, 1.684, 0.02, 0.114],
      [0, 1.734, 0.051, 0.116],
      [0, 1.784, 0.082, 0.106],
      [0, 1.837, 0.117, 0.08],
      [0, 1.923, 0.145, 0.06],
    ],
    13,
    4,
  );
  for (let i = 0; i < 4; i++)
    cryptSweep(
      body,
      k.ghost,
      [
        [0.018, 1.55 - i * 0.083, 0.153, 0.009],
        [-0.004, 1.519 - i * 0.08, 0.169, 0.01],
        [-0.023, 1.5 - i * 0.08, 0.171, 0.002],
      ],
      7,
      2,
    );
  cryptPlate(
    body,
    k.bone,
    [
      [-0.058, 1.625, 0.165],
      [0.05, 1.609, 0.171],
      [0.071, 1.505, 0.197],
      [0.025, 1.439, 0.196],
      [0.032, 1.325, 0.192],
      [-0.018, 1.263, 0.18],
      [-0.041, 1.367, 0.195],
      [-0.07, 1.497, 0.202],
    ],
    [0, 1.483, 0.238],
  );
  cryptSweep(
    body,
    k.horn,
    [
      [-0.282, 1.59, 0.071, 0.019],
      [-0.185, 1.478, 0.186, 0.022],
      [-0.052, 1.353, 0.235, 0.022],
      [0.113, 1.234, 0.202, 0.023],
      [0.211, 1.106, 0.103, 0.02],
    ],
    9,
    3,
    0.66,
  );
  const head = cryptJoint(body, 'head', 0, 2.126, 0.357);
  skullModel('deer', head);
  const eyes = cryptJoint(head, 'eyes');
  for (const s of [-1, 1]) eyeLight(eyes, s, 0.08, -0.18, -0.101, 0.013, true);
  const legs = [];
  for (const s of [-1, 1]) {
    legs.push(wardenFoot(body, s, legs.length));
    wardenArm(body, s, legs.length - 1);
  }
  return legs;
}
function creatureModel(kind) {
  let template = cryptTemplates.get(kind);
  if (!template) {
    const root = new THREE.Group(),
      body = cryptJoint(root, 'body');
    const legSpecs =
      kind === 'hound' ? sculptHound(body) : kind === 'weaver' ? sculptWeaver(body) : sculptWarden(body);
    cryptFuse(body);
    template = { root, legSpecs };
    cryptTemplates.set(kind, template);
  }
  const root = template.root.clone(true),
    obj = (n) => root.getObjectByName(n);
  root.userData.parts = {
    body: obj('body'),
    head: obj('head'),
    tail: obj('tail'),
    jaw: obj('jaw'),
    eyes: obj('eyes'),
    limbs: template.legSpecs.map((spec, i) => ({ ...spec, leg: obj('leg' + i), ankle: obj('ankle' + i) })),
    hands:
      kind === 'sentinel'
        ? [-1, 1].map((side, i) => ({ side, arm: obj('arm' + i), fore: obj('fore' + i) }))
        : [],
  };
  return root;
}
// Only a falling creature needs a floor sweep. Once it has landed, keep its entire pose still.
function settleCryptBody(root, body) {
  root.updateWorldMatrix(true, true);
  let lowest = Infinity;
  body.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.matrixWorld.elements,
      p = o.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3)
      lowest = Math.min(lowest, m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13]);
  });
  body.position.y += 0.004 - lowest;
}
function poseCreature(root, m, t) {
  const { body, head, tail, jaw, limbs, hands, eyes } = root.userData.parts,
    spec = bestiary[m.kind];
  const u = root.userData,
    dt = clamp(t - (u.last ?? t), 0, 0.1);
  if (m.hp <= 0 && u.resting) return;
  u.resting = false;
  u.last = t;
  const death = m.hp <= 0 ? clamp(m.fellAt == null ? 1 : (t - m.fellAt) / 0.58, 0, 1) : 0,
    life = 1 - death;
  const tall = m.kind === 'sentinel',
    spider = m.kind === 'weaver';
  const energy = life * (u.energy = THREE.MathUtils.damp(u.energy || 0, m.hp > 0 && m.walk ? 1 : 0, 12, dt));
  const phase = (u.phase =
    (u.phase ?? m.id * 1.9) + dt * spec.speed * (spider ? 8 : tall ? 3.8 : 5) * energy);
  const attack = m.hp > 0 && m.windup > 0 ? 1 - m.windup / spec.wind : 0,
    age = m.struckAt == null ? 1 : t - m.struckAt;
  const strike = m.hp > 0 && age >= 0 && age < 0.31 ? Math.sin((Math.PI * age) / 0.31) : 0;
  const breath = life * Math.sin(t * (spider ? 1.25 : 1.85) + m.id);
  root.position.set(m.x, 0, m.z);
  root.rotation.y = m.yaw;
  body.position.set(
    0,
    (Math.sin(phase * 2) * 0.019 * energy + breath * 0.007) * (1 - death) -
      attack * 0.065 -
      death * (tall ? 0.33 : 0.11),
    strike * (spider ? 0.185 : 0.23),
  );
  body.rotation.set(
    -attack * 0.12 + strike * 0.17 + death * (tall ? -1.6 : spider ? -0.08 : 0.02),
    0,
    death * (tall ? 0.11 : spider ? 0.116 : 1.36) +
      (m.hp > 0 && m.stagger > 0 ? 0.073 * Math.sin(t * 24) : 0),
  );
  head.rotation.set(
    (tall ? 0.045 : 0) - attack * 0.36 + strike * 0.38 + breath * 0.028,
    Math.sin(t * 0.92 + m.id * 0.71) * 0.036 * (1 - energy) * life,
    0,
  );
  if (jaw)
    jaw.rotation.x = (spider ? -0.05 : 0.055) + 0.035 * breath + attack * 0.32 + strike * 0.19 + death * 0.21;
  if (tail) {
    tail.rotation.y = life * 0.15 * Math.sin(t * 1.8) + energy * 0.24 * Math.sin(phase);
    tail.rotation.x = -attack * 0.18;
  }
  for (const l of limbs) {
    const w = Math.sin(
      phase + (l.side < 0 ? Math.PI : 0) + (spider ? l.rank * Math.PI * 0.81 : l.front ? 0 : Math.PI),
    );
    l.leg.rotation.x =
      w * energy * (spider ? 0.12 : tall ? 0.39 : 0.53) +
      death * (tall ? 0.2 : spider ? -0.02 : l.front ? -0.27 : 0.34);
    l.leg.rotation.z = spider
      ? l.side * (Math.max(0, w) * energy * 0.23 - death * 0.23)
      : l.side * death * (tall ? 0.12 : -0.43);
    l.ankle.rotation.x =
      -Math.max(0, w) * energy * (spider ? 0.13 : 0.36) + death * (tall ? -0.69 : spider ? -0.12 : -0.24);
    if (spider) l.ankle.rotation.z = l.side * (Math.max(0, w) * energy * 0.097 - death * 1.52);
  }
  for (const { arm, fore, side } of hands) {
    arm.rotation.set(
      Math.sin(phase) * side * 0.23 * energy - attack * 1.25 + strike * 0.82 - 0.12 * death,
      side * (strike * 0.21 + 0.04 * death),
      side * (attack * 0.43 + death * 0.52),
    );
    fore.rotation.x = -0.1 - attack * 0.45 + strike * 0.22 - death * 0.3;
  }
  if (eyes) eyes.visible = death < 0.8;
  if (death > 0) settleCryptBody(root, body);
  u.resting = death === 1;
}
