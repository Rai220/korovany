'use strict';

function vaultStoneArch() {
  const pos = [],
    uv = [],
    idx = [];
  const inner = 1.52,
    outer = 1.76,
    spring = 2.26;
  for (let j = 0; j < 14; j++) {
    const a = (j / 14) * Math.PI + 0.003,
      b = ((j + 1) / 14) * Math.PI - 0.003,
      base = pos.length / 3;
    for (const z of [-0.22, 0.22])
      for (const r of [inner, outer])
        for (const theta of [a, b]) {
          pos.push(Math.cos(theta) * r, spring + Math.sin(theta) * r, z);
          uv.push(Math.cos(theta) * r, Math.sin(theta) * r);
        }
    for (const [i, k, l, h] of [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ])
      idx.push(base + i, base + k, base + l, base + i, base + l, base + h);
  }
  return geometry(pos, uv, idx);
}
function vaultHalo() {
  if (vaultHalo.texture) return vaultHalo.texture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const q = c.getContext('2d'),
    g = q.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,212,148,.65)');
  g.addColorStop(0.17, 'rgba(255,181,94,.22)');
  g.addColorStop(1, 'rgba(255,139,52,0)');
  q.fillStyle = g;
  q.fillRect(0, 0, 64, 64);
  return (vaultHalo.texture = new THREE.CanvasTexture(c));
}
// The shells use absolute coordinates so adjoining tiles share the same vault and geological strata.
// Detail protruding from a wall starts above head height or within the collision skin.
function buildVaultShell(d, mine, scene, put, box, shaft, materials) {
  const { masonry, pavement, trim, lumber, iron, brass, damp, salt } = materials;
  const hs = chamberStep / 2;
  const surface = new Map();
  function buffer(mat) {
    if (!surface.has(mat)) surface.set(mat, { positions: [], uv: [], indices: [] });
    return surface.get(mat);
  }
  function quad(mat, a, b, c, e) {
    const v = buffer(mat),
      i = v.positions.length / 3;
    v.positions.push(...a, ...b, ...c, ...e);
    v.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    v.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const tints = mine ? [0xa9a8a1, 0xbeb49e, 0x949995] : [0x7b7b70, 0xaaa28c, 0x888878];
  const stone = tints.map((t) => projectedMaterial(mine ? 'scree' : 'stone', t, mine ? 0.51 : 0.59));
  for (const m of [...stone, masonry, trim, damp, salt]) m.side = THREE.DoubleSide;
  const roofStone = stone[0],
    soot = stone[2];
  const seep = new THREE.MeshStandardMaterial({
    color: mine ? 0x3c352b : 0x394341,
    roughness: 0.35,
    metalness: 0.09,
    side: THREE.DoubleSide,
  });
  const mineral = projectedMaterial('scree', 0xc7b99e, 0.87);
  mineral.side = THREE.DoubleSide;
  const water = new THREE.MeshStandardMaterial({
    color: 0x253135,
    roughness: 0.17,
    metalness: 0.2,
    transparent: true,
    opacity: 0.57,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  // Including the diagonal in the noise gives neighbouring exposures a shared geological strike.
  const hash = (x, z, n = 0) => meadowHash(Math.round(x * 37), Math.round(z * 39), n);
  const bed = (x, z) =>
    0.43 * Math.sin(x * 0.31 + z * 0.29) +
    0.16 * Math.cos(x * 0.76 - z * 0.65) +
    0.08 * Math.sin(z * 1.47 + x * 0.61);
  function ceiling(cell, x, z) {
    const { room, cx, cz, axis } = cell;
    if (room) {
      const [x1, z1, x2, z2] = room;
      const middle = (x1 + x2) * chamberStep * 0.5;
      const u = Math.min(1, Math.abs((x - middle) / ((x2 - x1 + 1) * hs)));
      const edges = Math.max(
        0,
        Math.min(
          x - (x1 * chamberStep - hs),
          x2 * chamberStep + hs - x,
          z - (z1 * chamberStep - hs),
          z2 * chamberStep + hs - z,
        ),
      );
      if (mine)
        return (
          3.25 +
          Math.min(1, edges / 4.4) * 1.67 +
          bed(x, z) +
          0.42 * Math.abs(Math.sin(x * 0.42 - z * 0.18)) +
          0.8 * Math.max(0, Math.cos(x * 0.3 + z * 0.11))
        );
      const vault = Math.sqrt(Math.max(0, 1 - u * u));
      return 3.08 + 2.68 * vault + 0.09 * Math.cos((z - z1 * chamberStep) * 0.77);
    }
    const cross = axis === 'x' ? z - cz * chamberStep : x - cx * chamberStep;
    const profile = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(cross) / hs) ** 2));
    return mine ? 2.88 + 0.81 * profile + 0.4 * bed(x, z) : 2.35 + 1.54 * profile;
  }
  const cells = new Map();
  for (const key of d.tiles) {
    const [cx, cz] = key.split(',').map(Number),
      room = d.rooms.find(([x1, z1, x2, z2]) => cx >= x1 && cx <= x2 && cz >= z1 && cz <= z2);
    const axis = d.tiles.has(tileKey(cx - 1, cz)) && d.tiles.has(tileKey(cx + 1, cz)) ? 'x' : 'z';
    cells.set(key, { cx, cz, room, axis });
  }
  function rib(centerX, centerZ, halfWidth, spring, rise, depth, orientation, material) {
    const cs = Math.cos(orientation),
      sn = Math.sin(orientation);
    const to = (r, y, z) => [centerX + cs * r + sn * z, y, centerZ - sn * r + cs * z];
    const n = Math.max(11, Math.round(halfWidth * 3.9));
    for (let j = 0; j < n; j++) {
      const a = ((j + 0.035) * Math.PI) / n,
        b = ((j + 0.965) * Math.PI) / n;
      const section = (angle, extra, z) =>
        to(Math.cos(angle) * (halfWidth + extra), spring + Math.sin(angle) * (rise + extra), z);
      const lo = -depth * 0.5,
        hi = depth * 0.5,
        thick = halfWidth > 3 ? 0.26 : 0.19;
      const a0 = section(a, 0, lo),
        a1 = section(a, 0, hi),
        b0 = section(b, 0, lo),
        b1 = section(b, 0, hi);
      const c0 = section(a, thick, lo),
        c1 = section(a, thick, hi),
        d0 = section(b, thick, lo),
        d1 = section(b, thick, hi);
      quad(material, a0, b0, b1, a1);
      quad(material, b0, d0, d1, b1);
      quad(material, c1, d1, d0, c0);
      quad(material, a1, c1, c0, a0);
      quad(material, a1, b1, d1, c1);
      quad(material, c0, d0, b0, a0);
    }
  }
  function beam(a, b, width, height, mat) {
    // Fixed beams are merged with each other, including their end grain.
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const side = new THREE.Vector3()
      .crossVectors(dir, Math.abs(dir.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0))
      .normalize()
      .multiplyScalar(width * 0.5);
    const up = new THREE.Vector3()
      .crossVectors(side, dir)
      .normalize()
      .multiplyScalar(height * 0.5);
    const at = (p, s, k) => [
      p[0] + side.x * s + up.x * k,
      p[1] + side.y * s + up.y * k,
      p[2] + side.z * s + up.z * k,
    ];
    const ends = (p) => [at(p, -1, -1), at(p, 1, -1), at(p, 1, 1), at(p, -1, 1)];
    const a1 = ends(a),
      b1 = ends(b);
    quad(mat, ...a1);
    quad(mat, b1[3], b1[2], b1[1], b1[0]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(mat, a1[j], a1[i], b1[i], b1[j]);
    }
  }
  // Seepage collects in irregular channels at the bases of the walls.
  function runnel(at, len, seed) {
    const n = Math.ceil(len / 0.39);
    let left = null,
      right = null;
    for (let i = 0; i <= n; i++) {
      const u = i / n,
        t = (u - 0.5) * len,
        envelope = Math.sin(u * Math.PI) ** 0.69;
      const spread = (0.16 + 0.22 * hash(t, seed, 3) + 0.09 * Math.sin(11 * u)) * envelope;
      const offset = 0.18 + 0.08 * Math.sin(t * 2.15 + seed);
      const a = at(t, 0.017, offset - spread * 0.53),
        b = at(t, 0.017, offset + spread);
      if (left) quad(water, left, a, b, right);
      left = a;
      right = b;
    }
  }
  function niche(at, seed) {
    const y = 0.69 + hash(seed, 3) * 0.3,
      top = y + 1.32,
      half = 0.78,
      spring = top - 0.44;
    const p = (w, h, t) => at(w, h, t);
    // The recess is carved behind the collision plane, large enough to reveal a back, a sill and two returns.
    quad(soot, p(-half, y, -0.53), p(half, y, -0.53), p(half, spring, -0.53), p(-half, spring, -0.53));
    for (const side of [-1, 1]) {
      quad(
        masonry,
        p(side * half, y, -0.53),
        p(side * half, y, -0.006),
        p(side * half, spring, -0.006),
        p(side * half, spring, -0.53),
      );
      quad(
        trim,
        p(side * half, y, -0.01),
        p(side * (half + 0.13), y, 0.085),
        p(side * (half + 0.13), spring, 0.085),
        p(side * half, spring, -0.01),
      );
    }
    quad(trim, p(-half, y, -0.53), p(half, y, -0.53), p(half, y, 0.15), p(-half, y, 0.15));
    const n = 13;
    for (let j = 0; j < n; j++) {
      const a = (j * Math.PI) / n,
        b = ((j + 1) * Math.PI) / n;
      const arch = (angle, depth, thick = 0) =>
        p(Math.cos(angle) * (half + thick), spring + Math.sin(angle) * (0.44 + thick), depth);
      quad(soot, p(0, spring, -0.53), arch(a, -0.53), arch(b, -0.53), p(0, spring, -0.53));
      quad(masonry, arch(b, -0.53), arch(a, -0.53), arch(a, 0.015), arch(b, 0.015));
      // Each visible voussoir tapers toward the springing line.
      quad(
        stone[j % 3 === 1 ? 1 : 0],
        arch(a + 0.008, 0.082),
        arch(b - 0.008, 0.082),
        arch(b - 0.008, 0.082, 0.123),
        arch(a + 0.008, 0.082, 0.123),
      );
      quad(
        masonry,
        arch(a + 0.008, 0.082, 0.123),
        arch(b - 0.008, 0.082, 0.123),
        arch(b - 0.008, -0.014, 0.123),
        arch(a + 0.008, -0.014, 0.123),
      );
    }
    const cover = (w, h, depth, wide, high, deep, mat) => {
      const center = at(w, h, depth);
      put(box, mat, ...center, wide, high, deep, 0, at.turn);
    };
    cover(0, y + 0.11, -0.25, 1.28, 0.19, 0.41, stone[1]);
    cover(0.1, y + 0.28, -0.28, 0.8, 0.12, 0.26, soot);
    cover(-0.43, y + 0.31, -0.28, 0.19, 0.15, 0.26, stone[1]);
    cover(0, top + 0.115, 0.035, 0.29, 0.18, 0.16, stone[1]);
    cover(0, y - 0.29, 0.026, 0.54, 0.22, 0.047, brass);
    for (let i = 0; i < 3; i++) cover(0, y - 0.25 - 0.045 * i, 0.056, 0.32 - 0.035 * i, 0.012, 0.012, iron);
    return { y, top, half, spring };
  }
  function perimeter(cell, dx, dz) {
    const { cx, cz } = cell,
      x = cx * chamberStep,
      z = cz * chamberStep,
      wx = x + hs * dx,
      wz = z + hs * dz;
    const at = (u, y, inward) => [wx + dz * u - dx * inward, y, wz - dx * u - dz * inward];
    at.turn = Math.atan2(dx, dz);
    const seed = hash(wx, wz, 18),
      yRoof = (u) => {
        const p = at(u, 0, 0);
        return ceiling(cell, p[0], p[2]);
      };
    if (mine) {
      const cols = 5,
        rows = 7;
      const node = (i, j) => {
        const u = -hs + (chamberStep * i) / cols,
          h = j / rows,
          co = at(u, 0, 0);
        const warp = Math.sin((Math.PI * u) / chamberStep + Math.PI / 2) * Math.sin(Math.PI * h);
        const py =
          h * yRoof(u) +
          warp *
            (0.13 * Math.sin(co[0] * 0.83 + co[2] * 0.57 + 2 * j) + (0.1 * hash(co[0], co[2], j) - 0.05));
        const recess =
          0.12 + 0.35 * hash(co[0], co[2], j) + 0.23 * Math.max(0, Math.sin(4.7 * h + co[0] * 0.6));
        return at(u, py, i === 0 || i === cols || j === 0 || j === rows ? 0 : -recess);
      };
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const material =
            stone[
              (j * 3 + Math.floor(seed * 19) + Math.floor(i / 3)) % 7 === 1
                ? 1
                : (j + Math.floor(seed * 29)) % 4 === 0
                  ? 2
                  : 0
            ];
          quad(material, node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1));
        }
      // Narrow ribs of quartz and iron sulphide follow a continuous, dipping seam in the rock.
      if (seed > 0.32) {
        const band = 0.75 + 1.55 * seed;
        let last = null,
          last2 = null;
        for (let i = 0; i <= 9; i++) {
          const u = -hs + (i * chamberStep) / 9,
            co = at(u, 0, 0);
          const h = band + 0.22 * u + 0.15 * Math.sin(co[0] * 1.8 + co[2] * 0.69) + 0.056 * Math.cos(i * 2.2);
          const narrow = 0.018 + 0.058 * hash(wx + i, wz, 8);
          const a = at(u, h, -0.102),
            b = at(u, h + narrow, -0.096);
          if (last) quad(i % 4 === 2 ? stone[1] : mineral, last, a, b, last2);
          last = a;
          last2 = b;
        }
      }
    } else {
      const include = (cx * 3 + cz + dx + dz + 40) % 3 !== 0;
      const n = include ? niche(at, seed * 111) : null;
      const bands = n
        ? [
            [-hs, -n.half, 0, null],
            [n.half, hs, 0, null],
            [-n.half, n.half, 0, n.y],
            [-n.half, n.half, n.top, null],
          ]
        : [[-hs, hs, 0, null]];
      for (const [l, r, low, hi] of bands) {
        const steps = Math.max(1, Math.ceil((r - l) / 0.37));
        for (let i = 0; i < steps; i++) {
          const a = l + ((r - l) * i) / steps,
            b = l + ((r - l) * (i + 1)) / steps;
          const sill = (u) =>
            n && low === n.top ? n.spring + 0.44 * Math.sqrt(Math.max(0, 1 - (u / n.half) ** 2)) : low;
          quad(
            masonry,
            at(a, sill(a), 0),
            at(b, sill(b), 0),
            at(b, hi ?? yRoof(b) + 0.12, 0),
            at(a, hi ?? yRoof(a) + 0.12, 0),
          );
        }
      }
      // Water marks and hairline mineral trails sit on the masonry without becoming markers.
      let a = null,
        b = null;
      for (let k = 0; k <= 9; k++) {
        const u = -hs + (k * chamberStep) / 9,
          co = at(u, 0, 0);
        const h = 0.1 + 0.09 * (1 + Math.sin(co[0] * 0.81 + co[2] * 0.57)) + 0.05 * hash(u, seed, 2);
        const top = at(u, h, 0.012),
          bottom = at(u, 0.012, 0.012);
        if (a) quad(seep, a, top, bottom, b);
        a = top;
        b = bottom;
      }
      if (seed > 0.37) runnel(at, chamberStep * 0.98, seed * 11);
      if (seed > 0.45) {
        for (let i = 0; i < 3; i++) {
          const u = -1.36 + 0.1 * i + 0.1 * hash(seed, i),
            top = 2.48 + 0.45 * hash(i, seed, 11);
          quad(
            seep,
            at(u, top, 0.015),
            at(u + 0.018, top, 0.015),
            at(u + 0.041, top - 0.37 - 0.55 * seed, 0.015),
            at(u + 0.023, top - 0.5, 0.015),
          );
        }
      }
    }
  }
  for (const [key, cell] of cells) {
    const { cx, cz } = cell;
    const n = mine ? 5 : 6;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const roofPoint = (u, v) => {
          const x = (cx - 0.5 + u / n) * chamberStep,
            z = (cz - 0.5 + v / n) * chamberStep;
          return [x, ceiling(cell, x, z), z];
        };
        const x = roofPoint(i, j),
          y = roofPoint(i + 1, j),
          k = roofPoint(i + 1, j + 1),
          h = roofPoint(i, j + 1);
        quad(roofStone, x, y, k, h);
      }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = cells.get(tileKey(cx + dx, cz + dz));
      if (!next) {
        perimeter(cell, dx, dz);
        continue;
      }
      if ((dx > 0 || dz > 0) && (cell.room !== next.room || (!cell.room && cell.axis !== next.axis))) {
        // A high chamber opening onto a low gallery has a solid spandrel above the passage.
        const node = (u, where) => {
          const x = (cx + 0.5 * dx) * chamberStep + dz * u,
            z = (cz + 0.5 * dz) * chamberStep + dx * u;
          return [x, ceiling(where, x, z), z];
        };
        for (let j = 0; j < n; j++) {
          const a = -hs + (j * chamberStep) / n,
            b = a + chamberStep / n;
          quad(masonry, node(a, cell), node(b, cell), node(b, next), node(a, next));
        }
      }
    }
  }
  for (const room of d.rooms) {
    const [x1, z1, x2, z2] = room;
    const mid = (x1 + x2) * hs,
      wide = (x2 - x1 + 1) * hs;
    if (!mine)
      for (let k = z1; k <= z2; k += 2) {
        const z = k * chamberStep;
        rib(mid, z, wide - 0.16, 3.03, 2.53, 0.43, 0, stone[1]);
        for (const sign of [-1, 1]) {
          const x = mid + sign * (wide - 0.052);
          put(box, stone[1], x, 1.49, z, 0.19, 2.97, 0.49);
          put(box, trim, x, 2.92, z, 0.29, 0.22, 0.64);
          put(box, masonry, x, 0.23, z, 0.28, 0.45, 0.63);
        }
      }
    if (mine) {
      const midZ = (z1 + z2) * hs;
      const level = 3.29 + hash(mid, midZ, 5) * 0.43;
      for (const along of [-0.31, 0.25]) {
        const z = midZ + along * (z2 - z1) * chamberStep;
        const a = [mid - wide + 0.08, level, z],
          b = [mid + wide - 0.08, level + 0.17, z + 0.23];
        beam(a, b, 0.24, 0.31, lumber);
        for (const s of [-1, 1]) {
          const x = mid + s * (wide - 0.05);
          beam([x, 0.13, z + 0.08], [x - s * 0.14, level, z], 0.21, 0.24, lumber);
          beam([x, level - 0.98, z + 0.03], [x - s * 1.25, level + 0.028, z + 0.03], 0.18, 0.21, lumber);
        }
        // A king-post truss splits the chamber span; the cables recede into the rough crown above.
        beam([mid, level, z], [mid, level + 1.13, z], 0.13, 0.17, iron);
        beam(a, [mid, level + 1.13, z], 0.16, 0.18, lumber);
        beam([mid, level + 1.13, z], b, 0.16, 0.18, lumber);
        for (let i = -2; i <= 2; i++) {
          const x = mid + (wide * i) / 3;
          put(box, iron, x, level + 0.03, z + 0.015, 0.12, 0.34, 0.28);
        }
      }
    }
  }
  // Variable-depth hanging lags in the working drive are confined to the tunnel roof.
  if (mine)
    for (const cell of cells.values()) {
      if (cell.room) continue;
      const x = cell.cx * chamberStep,
        z = cell.cz * chamberStep,
        ang = cell.axis === 'x' ? Math.PI / 2 : 0;
      for (const s of [-1, 1])
        put(
          box,
          lumber,
          x + Math.cos(ang) * s * 1.51,
          2.83,
          z - Math.sin(ang) * s * 1.51,
          0.12,
          0.16,
          chamberStep + 0.04,
          0,
          ang,
        );
      for (let i = 0; i < 5; i++) {
        const q = i * 0.63 - 1.26,
          y = 2.98 + 0.095 * hash(x, z, i);
        put(
          box,
          lumber,
          x + Math.sin(ang) * q,
          y,
          z + Math.cos(ang) * q,
          2.99,
          0.13,
          0.28,
          0,
          ang,
          0.025 * (i - 2),
        );
      }
    }
  // Mining equipment and funerary stonework share their walls' recesses, clear of the travel lane.
  if (mine) {
    const x = hs - 0.035,
      z = 12 * chamberStep;
    for (let i = 0; i < 3; i++) {
      const zz = z - 0.85 + i * 0.85;
      beam([x - 0.02, 0.13, zz], [x + 0.08, 2.28, zz], 0.16, 0.16, lumber);
    }
    beam([x + 0.08, 2.18, z - 0.95], [x + 0.08, 2.18, z + 0.95], 0.18, 0.18, lumber);
    for (const level of [0.47, 0.71, 0.96])
      beam([x + 0.12, level, z - 0.91], [x + 0.12, level, z + 0.91], 0.12, 0.13, lumber);
    put(shaft, iron, x + 0.1, 1.65, z, 0.39, 0.13, 0.39, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++)
      beam(
        [x + 0.19, 1.65 + 0.33 * Math.cos(i * 0.78), z + 0.33 * Math.sin(i * 0.78)],
        [x + 0.19, 1.65 - 0.33 * Math.cos(i * 0.78), z - 0.33 * Math.sin(i * 0.78)],
        0.047,
        0.047,
        brass,
      );
    // A gated ore chute hangs on the heading wall beside the rails.
    const truckX = 4.52 * chamberStep,
      truckZ = 9.5 * chamberStep;
    const lip = truckZ + 0.16;
    for (const side of [-1, 1]) {
      beam(
        [truckX + side * 1.03, 0.08, lip],
        [truckX + side * 0.95, 2.39, truckZ + 0.03],
        0.18,
        0.19,
        lumber,
      );
      beam([truckX + side * 0.34, 0.87, lip], [truckX + side * 0.81, 1.89, truckZ + 0.15], 0.17, 0.17, iron);
    }
    for (let j = 0; j < 5; j++)
      put(box, lumber, truckX, 1.12 + j * 0.17, truckZ + 0.075, 0.78 + j * 0.21, 0.147, 0.12);
    for (const side of [-1, 1]) {
      put(box, iron, truckX + side * 0.76, 1.87, lip, 0.1, 0.31, 0.07);
      put(shaft, iron, truckX + side * 0.73, 1.77, truckZ + 0.23, 0.072, 0.18, 0.072, Math.PI / 2);
    }
    put(box, iron, truckX, 2.11, truckZ + 0.077, 2.14, 0.13, 0.14);
    put(box, iron, truckX, 0.91, truckZ + 0.17, 0.96, 0.09, 0.28);
    beam([truckX - 0.31, 1.01, truckZ + 0.18], [truckX - 0.31, 2.68, truckZ + 0.12], 0.05, 0.04, brass);
  } else {
    const z = d.start[1] * chamberStep,
      x = d.rooms[0][0] * chamberStep - hs;
    // A dedication plaque, carved archivolts and a cross locate the stair back to the palace.
    const plate = (w, h, t, mat, yy, zz) => put(box, mat, x + 0.102, yy, z + zz, t, h, w);
    plate(0.88, 0.95, 0.11, soot, 1.68, 0.86);
    plate(0.19, 0.56, 0.15, trim, 1.76, 0.86);
    plate(0.52, 0.12, 0.155, trim, 1.84, 0.86);
  }
  for (const [material, source] of surface) {
    if (!source.indices.length) continue;
    const mesh = new THREE.Mesh(geometry(source.positions, source.uv, source.indices), material);
    mesh.name = mine ? 'Горная выработка' : 'Каменная кладка';
    scene.add(mesh);
  }
}

function buildVault(realm, id) {
  const d = underways[id],
    mine = id === 'fort',
    scene = new THREE.Scene();
  scene.background = new THREE.Color(mine ? 0x1e2025 : 0x283137);
  scene.fog = new THREE.FogExp2(scene.background, mine ? 0.036 : 0.032);
  const box = new THREE.BoxGeometry(1, 1, 1),
    shaft = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sh = (key, col, scale) => projectedMaterial(key, col, scale);
  const plain = (col, r = 0.74, m = 0.09) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: m });
  const masonry = sh(mine ? 'scree' : 'stone', mine ? 0xa6a6a1 : 0xc8c6b4, mine ? 0.9 : 0.58);
  const pavement = sh(mine ? 'grit' : 'cobbles', mine ? 0xaf9e83 : 0xb3b1a2, 0.57);
  const trim = sh(mine ? 'wood' : 'stone', mine ? 0xab8870 : 0xd5caba, 0.85);
  const lumber = sh('wood', 0xaa845e, 0.73),
    iron = plain(0x42494b, 0.54, 0.7),
    brass = plain(0xb28851, 0.43, 0.58);
  const damp = plain(0x4c7671, 0.23, 0.26),
    salt = plain(mine ? 0x888183 : 0x9caaa0, 0.52, 0.06);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc07b });
  const batch = new Map(),
    o = new THREE.Object3D(),
    torches = [];
  function put(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    if (!batch.has(geo)) batch.set(geo, new Map());
    const b = batch.get(geo);
    if (!b.has(mat)) b.set(mat, []);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.rotation.set(rx, ry, rz);
    o.updateMatrix();
    b.get(mat).push(o.matrix.clone());
  }
  const hs = chamberStep / 2,
    arch = vaultStoneArch();
  function span(x, z, angle, heavy = false) {
    const cs = Math.cos(angle),
      sn = Math.sin(angle);
    for (const i of [-1, 1]) {
      put(box, trim, x + cs * i * 1.63, 1.13, z - sn * i * 1.63, 0.28, 2.26, 0.4, 0, angle);
      put(box, iron, x + cs * i * 1.63, 1.93, z - sn * i * 1.63, 0.306, 0.09, 0.43, 0, angle);
      if (!mine) {
        put(box, masonry, x + cs * i * 1.62, 0.19, z - sn * i * 1.62, 0.4, 0.38, 0.51, 0, angle);
        put(box, trim, x + cs * i * 1.62, 2.26, z - sn * i * 1.62, 0.43, 0.24, 0.53, 0, angle);
      }
    }
    if (mine) {
      put(box, lumber, x, 3.24, z, 3.83, 0.32, 0.42, 0, angle);
      for (const i of [-1, 1]) {
        put(box, lumber, x + cs * i * 1.59, 2.61, z - sn * i * 1.59, 0.28, 1.18, 0.39, 0, angle, -i * 0.19);
        put(box, lumber, x + cs * i * 1.36, 2.87, z - sn * i * 1.36, 0.19, 0.91, 0.25, 0, angle, -i * 0.76);
      }
    } else put(arch, trim, x, 0, z, 1, heavy ? 1.1 : 1, 1, 0, angle);
  }
  const gates = dungeonPoint(d.gate),
    handle = dungeonPoint(d.handle),
    prize = dungeonPoint(d.relicAt),
    start = dungeonPoint(d.start);
  for (const cell of d.tiles) {
    const [cx, cz] = cell.split(',').map(Number),
      x = cx * chamberStep,
      z = cz * chamberStep;
    put(box, pavement, x, -0.14, z, chamberStep + 0.008, 0.28, chamberStep + 0.008);
    if (mine && ((cz === 7 && cx >= 3 && cx <= 11) || (cx === 3 && cz >= 8))) {
      const a = cz === 7 ? Math.PI / 2 : 0;
      for (const side of [-1, 1])
        put(
          box,
          iron,
          x + Math.cos(a) * side * 0.53,
          0.058,
          z - Math.sin(a) * side * 0.53,
          0.055,
          0.075,
          chamberStep + 0.02,
          0,
          a,
        );
      for (const j of [-1, 0, 1])
        put(
          box,
          lumber,
          x + Math.sin(a) * j * 1.1,
          0.031,
          z + Math.cos(a) * j * 1.1,
          1.43,
          0.075,
          0.19,
          0,
          a,
        );
    }
  }
  buildVaultShell(d, mine, scene, put, box, shaft, {
    masonry,
    pavement,
    trim,
    lumber,
    iron,
    brass,
    damp,
    salt,
  });
  // The direction of each arch follows the corridor. Every bay leaves a navigable centre aisle.
  const bays = mine
    ? [
        [3, 10, 0],
        [3, 8, 0],
        [3, 5, 0],
        [5, 7, 1],
        [8, 7, 1],
        [10, 7, 1],
        [6, 3, 1],
        [9, 3, 1],
        [11, 12, 1],
      ]
    : [
        [3, 9, 0],
        [3, 7, 0],
        [3, 5, 0],
        [7, 3, 1],
        [10, 3, 1],
        [9, 7, 0],
        [6, 10, 1],
        [11, 3, 1],
      ];
  for (const [x, z, a] of bays) span(x * chamberStep, z * chamberStep, (a * Math.PI) / 2);
  const sites = mine
    ? [
        [2, 10, 0, -1],
        [4, 10, 0, -1],
        [3, 7, -1, 0],
        [11, 9, 1, 0],
        [5, 3, 0, -1],
        [13, 3, 0, 1],
      ]
    : [
        [3, 11, -1, 0],
        [4, 9, 0, -1],
        [3, 7, 1, 0],
        [2, 3, -1, 0],
        [10, 9, 0, 1],
        [8, 3, 0, -1],
        [13, 4, 0, -1],
      ];
  const lampGeo = new THREE.OctahedronGeometry(1, 1);
  for (const [cx, cz, dx, dz] of sites) {
    // Seek the actual perimeter before mounting a sconce in a broad room.
    let bx = cx,
      bz = cz;
    while (d.tiles.has(tileKey(bx + dx, bz + dz))) {
      bx += dx;
      bz += dz;
    }
    const x = bx * chamberStep + dx * (hs - 0.4),
      z = bz * chamberStep + dz * (hs - 0.4);
    put(box, iron, x + dx * 0.17, 1.6, z + dz * 0.17, 0.14, 0.64, 0.16);
    put(shaft, brass, x, 1.65, z, 0.17, 0.13, 0.17);
    put(shaft, iron, x, 2.04, z, 0.2, 0.12, 0.2);
    for (let j = 0; j < 4; j++)
      put(
        box,
        iron,
        x + Math.cos(j * 1.57) * 0.135,
        1.85,
        z + Math.sin(j * 1.57) * 0.135,
        0.025,
        0.35,
        0.025,
      );
    put(lampGeo, glow, x, 1.83, z, 0.097, 0.2, 0.097);
    if (!mine) {
      for (let side of [-1, 1]) {
        const bx = x + dz * 0.23 * side,
          bz = z - dx * 0.23 * side;
        put(box, brass, (x + bx) / 2, 1.64, (z + bz) / 2, dx ? 0.045 : 0.27, 0.045, dx ? 0.27 : 0.045);
        put(shaft, brass, bx, 1.69, bz, 0.087, 0.055, 0.087);
        put(shaft, salt, bx, 1.82, bz, 0.046, 0.21, 0.046);
        put(lampGeo, glow, bx, 1.96, bz, 0.036, 0.105, 0.036);
      }
    }
    const haze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: vaultHalo(),
        color: 0xffbc75,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    haze.position.set(x, 1.85, z);
    haze.scale.set(0.69, 0.79, 1);
    scene.add(haze);
    torches.push({
      x: x - dx * 0.33,
      z: z - dz * 0.33,
      y: 1.88,
      color: mine
        ? torches.length % 3 === 1
          ? 0xd1dcec
          : 0xffb56c
        : torches.length % 4 === 2
          ? 0xa7c5cb
          : 0xffc48c,
    });
  }
  // Ascending steps, the handwheel and the expedition chest are visible from either approach.
  for (let i = 0; i < 6; i++)
    put(box, trim, start.x, 0.055 + i * 0.095, start.z + 0.5 + i * 0.23, 1.95, 0.11 + i * 0.19, 0.28);
  if (mine) {
    // The operating handwheel is keyed to a cable drum between angled bearing frames.
    for (const side of [-1, 1]) {
      put(box, lumber, handle.x + side * 0.29, 0.51, handle.z - 0.21, 0.13, 1.07, 0.24, 0, 0, side * 0.14);
      put(box, lumber, handle.x + side * 0.33, 0.31, handle.z - 0.09, 0.14, 0.72, 0.16, 0.58, 0, side * 0.15);
      put(box, iron, handle.x + side * 0.22, 1.01, handle.z - 0.21, 0.16, 0.19, 0.19);
    }
    put(box, lumber, handle.x, 0.11, handle.z - 0.21, 0.97, 0.18, 0.69);
    put(shaft, iron, handle.x, 1.02, handle.z - 0.22, 0.31, 0.49, 0.31, Math.PI / 2);
    for (let j = 0; j < 9; j++)
      put(shaft, brass, handle.x, 1.02, handle.z - 0.43 + j * 0.048, 0.308, 0.022, 0.308, Math.PI / 2);
    for (const side of [-1, 1])
      put(shaft, iron, handle.x, 1.02, handle.z - 0.22 + side * 0.258, 0.37, 0.055, 0.37, Math.PI / 2);
  } else {
    put(box, masonry, handle.x, 0.19, handle.z, 0.65, 0.38, 0.55);
    put(box, trim, handle.x, 0.53, handle.z, 0.43, 0.61, 0.38);
    put(shaft, brass, handle.x, 0.98, handle.z - 0.14, 0.22, 0.32, 0.22, Math.PI / 2);
  }
  const wheel = new THREE.Group();
  wheel.position.set(handle.x, 1.06, handle.z);
  beastPart(wheel, new THREE.TorusGeometry(0.47, 0.065, 8, 32), brass, 0, 0, 0);
  for (let j = 0; j < 6; j++)
    beastSpan(
      wheel,
      [0, 0, 0],
      [0.44 * Math.cos((j * Math.PI) / 3), 0.44 * Math.sin((j * Math.PI) / 3), 0],
      0.035,
      0.035,
      iron,
    );
  scene.add(wheel);
  put(box, lumber, prize.x, 0.33, prize.z, 1.3, 0.6, 0.77);
  const lid = new THREE.Group();
  lid.position.set(prize.x, 0.64, prize.z - 0.38);
  beastPart(lid, box, lumber, 0, 0.11, 0.38, 1.36, 0.21, 0.83);
  for (const side of [-1, 1]) {
    put(box, iron, prize.x + side * 0.43, 0.33, prize.z, 0.1, 0.61, 0.79);
    beastPart(lid, box, brass, side * 0.43, 0.12, 0.38, 0.093, 0.23, 0.85);
  }
  // Iron corner guards, a hasp and the camber of the lid remain visible after it is opened.
  for (const side of [-1, 1]) {
    put(box, iron, prize.x + side * 0.59, 0.34, prize.z + 0.39, 0.088, 0.55, 0.045);
    put(box, brass, prize.x + side * 0.55, 0.49, prize.z + 0.42, 0.18, 0.047, 0.034);
    beastPart(lid, box, iron, side * 0.65, 0.1, 0.39, 0.064, 0.13, 0.78);
  }
  beastPart(lid, box, brass, 0, 0.014, 0.801, 0.135, 0.3, 0.05);
  put(box, iron, prize.x, 0.65, prize.z + 0.431, 0.16, 0.16, 0.07);
  scene.add(lid);
  const gate = new THREE.Group();
  gate.position.set(gates.x, 0, gates.z);
  for (let j = -3; j <= 3; j++) beastPart(gate, box, iron, 0, 1.54, j * 0.46, 0.13, 3.07, 0.11);
  for (const height of [0.58, 1.78, 2.83]) beastPart(gate, box, brass, 0, height, 0, 0.16, 0.13, 3.42);
  scene.add(gate);
  span(gates.x, gates.z, Math.PI / 2);
  for (const [geo, sets] of batch)
    for (const [mat, matrices] of sets) {
      const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  scene.add(
    new THREE.HemisphereLight(mine ? 0xbec8d8 : 0xbad0da, mine ? 0x877462 : 0x77716c, mine ? 0.68 : 0.74),
  );
  const shaftLight = new THREE.DirectionalLight(mine ? 0xb6c9e6 : 0xadc3d9, 0.88);
  shaftLight.position.set(-6, 10, 7);
  scene.add(shaftLight);
  const lantern = new THREE.PointLight(0xffddba, 13, 16, 1.6);
  scene.add(lantern);
  const pools = Array.from({ length: 3 }, () => {
    const l = new THREE.PointLight(0xffb573, 20, 12, 1.6);
    scene.add(l);
    return l;
  });
  return { scene, torches, pools, lantern, gate, lid, wheel, actors: new Map(), state: null, open: 0 };
}
function vaultStrikeParticles(v, state, t) {
  if (!v.chips) {
    v.chips = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.043),
      new THREE.MeshStandardMaterial({ color: 0xd6a373, roughness: 0.7 }),
      48,
    );
    v.chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    v.chips.frustumCulled = false;
    v.scene.add(v.chips);
    v.chipPose = new THREE.Object3D();
  }
  let count = 0;
  for (const m of state.foes) {
    const age = m.hitAt == null ? 1 : t - m.hitAt;
    if (age < 0 || age > 0.33) continue;
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4 + m.id,
        pose = v.chipPose;
      pose.position.set(
        m.x + Math.sin(angle) * age * 2,
        bestiary[m.kind].top * 0.67 + age * (1.6 + i * 0.23) - age * age * 8,
        m.z + Math.cos(angle) * age * 2,
      );
      pose.scale.setScalar((1 - age / 0.33) * (0.64 + (i % 3) * 0.21));
      pose.rotation.set(age * 4, angle, age * 6);
      pose.updateMatrix();
      v.chips.setMatrixAt(count++, pose.matrix);
    }
  }
  v.chips.count = count;
  v.chips.instanceMatrix.needsUpdate = true;
}
function renderDungeon(realm, s, t, attackAnim, bob) {
  const id = s.dungeon,
    state = dungeonState();
  realm.vaults ||= new Map();
  if (!realm.vaults.has(id)) realm.vaults.set(id, buildVault(realm, id));
  const v = realm.vaults.get(id),
    c = realm.camera;
  if (v.state !== state) {
    v.state = state;
    v.open = +state.unlocked;
  }
  if (c.parent !== v.scene) {
    v.scene.add(c);
    v.last = t;
    v.open = +state.unlocked;
  }
  const dt = clamp(t - (v.last ?? t), 0, 0.1);
  v.last = t;
  c.position.set(s.roomX, (s.leg === 'lost' ? 0.78 : s.leg === 'chair' ? 1.32 : 1.71) + s.air + bob, s.roomZ);
  c.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  const focus = s.weapon === 'bow' && keys.has('KeyR');
  $('play').classList.toggle('bow-focus', focus);
  c.fov += ((focus ? 48 : 68) - c.fov) * (1 - Math.exp(-dt * 13));
  c.updateProjectionMatrix();
  realm.updateHands(s, t, attackAnim, bob);
  const arrow = realm.arrow3d;
  if (s.arrow) {
    v.scene.add(arrow);
    arrow.position.set(s.arrow.x, s.arrow.y, s.arrow.z);
    arrow.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(s.arrow.dx, s.arrow.dy, s.arrow.dz).normalize(),
    );
  }
  arrow.visible = !!s.arrow;
  v.lantern.position.set(
    c.position.x + 1.12 * Math.sin(s.yaw - 0.38),
    c.position.y + 0.76,
    c.position.z + 1.12 * Math.cos(s.yaw - 0.38),
  );
  const sorted = v.torches
    .slice()
    .sort(
      (a, b) => (a.x - s.roomX) ** 2 + (a.z - s.roomZ) ** 2 - (b.x - s.roomX) ** 2 - (b.z - s.roomZ) ** 2,
    );
  v.pools.forEach((l, i) => {
    const a = sorted[i];
    l.color.setHex(a.color ?? 0xffb573);
    l.position.set(a.x, a.y, a.z);
    l.intensity = 23 + Math.sin(8 * t + i) * 1.2;
  });
  v.open = gateLift(state);
  v.gate.position.y = v.open * 3.95;
  v.wheel.rotation.z = -v.open * 3.03;
  v.lid.rotation.x = state.claimed ? -1.18 : 0;
  for (const m of state.foes) {
    let model = v.actors.get(m.id);
    if (!model) {
      model = creatureModel(m.kind);
      v.actors.set(m.id, model);
      v.scene.add(model);
      const shade = footShade();
      const radius = bestiary[m.kind].radius;
      shade.scale.set(3.4 * radius, 1, 3.7 * radius);
      shade.position.y = 0.021;
      model.add(shade);
    }
    poseCreature(model, m, t);
  }
  vaultStrikeParticles(v, state, t);
  impactCamera(c, s);
  realm.renderer.render(v.scene, c);
}
