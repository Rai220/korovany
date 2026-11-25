'use strict';

// The ferry and the mountain gateway have their own approaches; the witness stand sits in the verge.
const oathRoadside = { x: -92.6, z: -30.4, title: 'Памятная доска переправы' };
const watchBeacon = { x: 0.105, y: 2.87, z: 0.05 };

function roadsideBlocked(ending, x, z, radius) {
  const dx = wrapped(x - oathRoadside.x),
    dz = wrapped(z - oathRoadside.z);
  if (Math.abs(dx) > 2 + radius || Math.abs(dz) > 1.6 + radius) return false;
  if (ending === 'hearing') return Math.abs(dx) < 0.88 + radius && Math.abs(dz) < 0.19 + radius;
  if (ending === 'vigil') return Math.abs(dx + 0.61) < 0.15 + radius && Math.abs(dz) < 0.15 + radius;
  // Shafts point east along the verge. The box and two narrow handles leave the north side open.
  return (
    (Math.abs(dx + 0.34) < 0.84 + radius && Math.abs(dz) < 0.58 + radius) ||
    (dx > 0.5 - radius && dx < 1.78 + radius && Math.abs(Math.abs(dz) - 0.43) < 0.045 + radius)
  );
}

function roadsidePaper(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = kind === 'vigil' ? 234 : 512;
  const c = canvas.getContext('2d'),
    h = canvas.height,
    chalk = kind === 'vigil';
  const base = c.createLinearGradient(0, 0, 510, h);
  const palette = chalk ? ['#312f29', '#474638', '#282a23'] : ['#aa8357', '#ead5a5', '#c2a77b'];
  base.addColorStop(0, palette[0]);
  base.addColorStop(0.41, palette[1]);
  base.addColorStop(1, palette[2]);
  c.fillStyle = base;
  c.fillRect(0, 0, 512, h);
  let seed = 1941;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 12500; i++) {
    c.fillStyle = random() < 0.5 ? 'rgba(33,24,14,.075)' : 'rgba(255,242,196,.09)';
    c.fillRect(random() * 512, random() * h, 1 + random() * 5, 1 + random());
  }
  c.textAlign = 'center';
  c.strokeStyle = chalk ? '#9e9980' : '#856042';
  c.lineWidth = 2;
  c.strokeRect(16, 15, 480, h - 30);
  c.strokeRect(21, 20, 470, h - 40);
  const line = (txt, y, font, max = 433) => {
    c.font = font + ' Georgia,serif';
    c.fillText(txt, 256, y, max);
  };
  c.fillStyle = chalk ? '#e5d8b1' : '#513825';
  if (chalk) {
    line('ПЕРВАЯ ВАХТА', 65, 'bold 38px');
    line('Вера Ланская', 120, 'italic 38px');
    line('Савва Широков', 167, 'italic 38px');
    line('И М Е Н Н О Й   Д О З О Р', 200, '15px');
  } else if (kind === 'hearing') {
    line('З Е М С К И Й   С У Д', 58, '18px');
    line('Реестр переправы', 118, 'bold 48px');
    line('Выписка для оглашения', 160, 'italic 29px');
    c.beginPath();
    c.moveTo(62, 182);
    c.lineTo(450, 182);
    c.stroke();
    c.textAlign = 'left';
    c.font = '25px Georgia,serif';
    ['Подлинники приняты.', 'Книга дворов открыта.', 'Свидетели явились лично.'].forEach((s, i) =>
      c.fillText(s, 50, 221 + 42 * i),
    );
    c.fillStyle = '#654028';
    c.font = 'italic 39px Georgia,serif';
    c.save();
    c.translate(60, 369);
    c.rotate(-0.049);
    c.fillText('В. Ланская', 0, 0);
    c.restore();
    c.fillText('С. Широков', 105, 431);
    c.strokeStyle = '#77553d';
    c.beginPath();
    c.moveTo(66, 385);
    c.bezierCurveTo(98, 361, 245, 396, 272, 354);
    c.stroke();
  } else {
    line('Мы дошли.', 180, 'italic bold 66px');
    line('Оставляю для дороги.', 268, 'italic 37px');
    line('Савва', 380, 'italic 62px');
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96 });
}

function roadsideKit(realm) {
  const oak = realm.mat(0x897454),
    dark = realm.mat(0x534432),
    cloth = realm.mat(0xd5c9aa),
    bleached = new THREE.MeshStandardMaterial({
      color: 0xdcd2b7,
      normalMap: trailImages['linen-normal'] ? texture('linen-normal') : null,
      roughness: 0.98,
    });
  const rough = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.67 : 0.94 });
  const iron = rough(0x454744, 0.55),
    brass = rough(0xb29160, 0.48),
    leather = rough(0x6c4a34),
    red = rough(0x994633);
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    post: new THREE.CylinderGeometry(1, 1, 1, 9),
    spire: new THREE.ConeGeometry(1, 1, 4),
    ring: new THREE.TorusGeometry(1, 0.088, 7, 32),
    tyre: new THREE.TorusGeometry(1, 0.033, 6, 32),
    loop: new THREE.TorusGeometry(1, 0.11, 6, 18),
  };
  return { oak, dark, cloth, bleached, iron, brass, leather, red, geometries };
}

function buildRoadside(realm, ending) {
  const kit = (realm.roadsideKit ||= roadsideKit(realm));
  const { oak, dark, cloth, bleached, iron, brass, leather, red, geometries } = kit;
  const group = new THREE.Group();
  group.name = 'Переправа · ' + ending;
  const batches = new Map(),
    tmp = new THREE.Object3D(),
    axis = new THREE.Vector3(0, 1, 0);
  function part(parent, geo, mat, pos, size, rot = [0, 0, 0], q = null) {
    tmp.position.fromArray(pos);
    tmp.rotation.set(...rot);
    if (q) tmp.quaternion.copy(q);
    tmp.scale.fromArray(size);
    tmp.updateMatrix();
    const key = parent.uuid + geo + mat.uuid;
    if (!batches.has(key)) batches.set(key, { parent, geo: geometries[geo], mat, frames: [] });
    batches.get(key).frames.push(tmp.matrix.clone());
  }
  const box = (p, m, x, y, z, w, h, d, rz = 0) => part(p, 'box', m, [x, y, z], [w, h, d], [0, 0, rz]);
  function spar(p, m, a, b, w, d = w, round = false) {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
      len = dir.length();
    part(
      p,
      round ? 'post' : 'box',
      m,
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      [w, len, d],
      [0, 0, 0],
      new THREE.Quaternion().setFromUnitVectors(axis, dir.normalize()),
    );
  }
  function plaque(g, kind, x, y, z, w, h, tilt = 0) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roadsidePaper(kind));
    plane.position.set(x, y, z);
    plane.rotation.z = tilt;
    plane.receiveShadow = true;
    g.add(plane);
  }
  const gift = new THREE.Group();
  group.add(gift);
  group.userData.gift = gift;
  if (ending === 'hearing') {
    for (const sign of [-1, 1]) {
      box(group, dark, sign * 0.71, 0.91, 0, 0.14, 2.1, 0.155, sign * 0.018);
      spar(group, oak, [sign * 0.7, 0.92, -0.03], [sign * 0.53, 0.53, -0.27], 0.09);
    }
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 0.275;
      box(
        group,
        i % 3 === 0 ? dark : oak,
        x,
        1.44 + 0.009 * Math.sin(i),
        0,
        0.266,
        0.94 + 0.033 * Math.cos(i),
        0.115,
      );
    }
    box(group, dark, 0, 1.99, -0.008, 1.93, 0.115, 0.36, 0.006);
    box(group, oak, 0, 1.89, 0.124, 1.78, 0.1, 0.075);
    for (const s of [-1, 1]) {
      part(group, 'post', iron, [s * 0.694, 1.818, 0.062], [0.024, 0.017, 0.024], [Math.PI / 2, 0, 0]);
      part(group, 'post', iron, [s * 0.694, 1.05, 0.062], [0.021, 0.017, 0.021], [Math.PI / 2, 0, 0]);
    }
    // A second folded leaf peeks out beneath the bound register.
    box(group, cloth, 0.037, 1.443, 0.071, 0.89, 0.836, 0.014, -0.058);
    plaque(group, ending, -0.017, 1.455, 0.093, 0.91, 0.854, 0.011);
    for (const s of [-1, 1])
      part(group, 'post', brass, [s * 0.402, 1.846, 0.105], [0.014, 0.009, 0.014], [Math.PI / 2, 0, 0]);
    spar(group, red, [0.245, 1.24, 0.111], [0.331, 1.025, 0.114], 0.018, 0.01);
    spar(group, red, [0.288, 1.234, 0.112], [0.29, 1.037, 0.114], 0.015, 0.01);
    part(group, 'post', red, [0.264, 1.19, 0.121], [0.075, 0.022, 0.067], [Math.PI / 2, 0, 0]);
    part(group, 'loop', leather, [0.264, 1.192, 0.136], [0.047, 0.042, 0.06]);
  } else if (ending === 'refuge') {
    const axleX = -0.37;
    for (const side of [-1, 1]) {
      const z = side * 0.55,
        cy = 0.411;
      part(group, 'ring', dark, [axleX, cy, z], [0.373, 0.373, 0.62]);
      part(group, 'tyre', iron, [axleX, cy, z], [0.401, 0.401, 0.93]);
      part(group, 'post', dark, [axleX, cy, z], [0.1, 0.21, 0.1], [Math.PI / 2, 0, 0]);
      part(group, 'post', iron, [axleX, cy, z + side * 0.111], [0.067, 0.021, 0.067], [Math.PI / 2, 0, 0]);
      for (let j = 0; j < 10; j++) {
        const a = j * 0.2 * Math.PI;
        spar(
          group,
          oak,
          [axleX + 0.052 * Math.cos(a), cy + 0.052 * Math.sin(a), z],
          [axleX + 0.368 * Math.cos(a + 0.024), cy + 0.368 * Math.sin(a + 0.024), z],
          0.031,
          0.047,
        );
      }
      spar(group, dark, [-1.16, 0.58, side * 0.416], [1.72, 0.35, side * 0.433], 0.074, 0.078);
      spar(group, leather, [1.49, 0.368, side * 0.433], [1.75, 0.346, side * 0.433], 0.055, 0.055, true);
      for (const x of [-1.02, -0.39, 0.23]) {
        const y = 0.65 - (x + 0.4) * 0.078;
        spar(group, dark, [x, y - 0.085, side * 0.37], [x + 0.037, y + 0.31, side * 0.438], 0.061, 0.068);
      }
      for (let i = 0; i < 2; i++)
        spar(
          group,
          oak,
          [-1.1, 0.78 + i * 0.147, side * (0.402 + i * 0.032)],
          [0.37, 0.666 + i * 0.147, side * (0.402 + i * 0.032)],
          0.095,
          0.043,
        );
    }
    spar(group, iron, [axleX, 0.411, -0.57], [axleX, 0.411, 0.57], 0.046, 0.046, true);
    for (let j = 0; j < 6; j++) box(group, oak, -0.382, 0.612, (j - 2.5) * 0.136, 1.49, 0.061, 0.129, -0.076);
    for (let j = 0; j < 2; j++) box(group, dark, -1.09, 0.78 + j * 0.15, 0, 0.058, 0.104, 0.83);
    for (const side of [-1, 1]) spar(group, oak, [0.84, 0.43, side * 0.4], [0.67, 0, side * 0.35], 0.063);
    for (let j = 0; j < 3; j++) {
      // Three folded linen rolls on a removable shoulder case; leave the worn straps on the cart.
      const x = -0.52 + j * 0.23,
        y = 0.756 - (x + 0.38) * 0.076;
      part(gift, 'post', bleached, [x, y, -0.09], [0.114, 0.325, 0.114], [Math.PI / 2, 0, 0]);
      part(gift, 'loop', leather, [x, y, -0.074], [0.111, 0.111, 0.097]);
    }
    for (let j = 0; j < 2; j++) {
      const x = -0.72 + j * 0.41;
      spar(group, leather, [x, 0.89, 0.43], [x + 0.041, 0.61, 0.49], 0.041, 0.015);
      part(group, 'loop', brass, [x + 0.04, 0.59, 0.5], [0.034, 0.042, 0.035]);
    }
    const note = new THREE.Group();
    note.position.set(0.59, 0.489, 0.445);
    note.rotation.z = -0.14;
    group.add(note);
    spar(note, leather, [0, 0.038, 0], [0.014, -0.097, 0.002], 0.013, 0.013, true);
    plaque(note, ending, 0.02, -0.149, 0.012, 0.253, 0.214, 0.07);
  } else {
    const x = -0.61;
    box(group, dark, x, 1.92, 0, 0.165, 4.13, 0.18, -0.008);
    for (const yy of [0.37, 1.82, 3.18, 3.73]) box(group, iron, x, yy, 0, 0.18, 0.049, 0.19);
    spar(group, iron, [x, 3.56, 0], [0.104, 3.56, 0.044], 0.052, 0.052);
    spar(group, iron, [x, 3.16, 0], [0.028, 3.54, 0.043], 0.033, 0.035);
    part(group, 'spire', brass, [x, 4.12, 0], [0.123, 0.29, 0.123], [0, Math.PI / 4, 0]);
    function lantern(parent, lx, ly, lz, k, lit) {
      const R = (a) => a * k;
      const pane = new THREE.MeshStandardMaterial({
        color: lit ? 0xffd58c : 0xd6b88c,
        roughness: 0.45,
        emissive: lit ? 0xff8c3c : 0x614728,
        emissiveIntensity: lit ? 1.7 : 0.35,
      });
      if (lit) group.userData.flame = pane;
      box(parent, pane, lx, ly, lz, R(0.247), R(0.34), R(0.247));
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(parent, iron, lx + R(0.129 * sx), ly, lz + R(0.129 * sz), R(0.021), R(0.387), R(0.021));
      for (const sign of [-1, 1])
        box(parent, iron, lx, ly + R(sign * 0.197), lz, R(0.343), R(0.044), R(0.343));
      part(
        parent,
        'spire',
        iron,
        [lx, ly + R(0.287), lz],
        [R(0.266), R(0.15), R(0.266)],
        [0, Math.PI / 4, 0],
      );
      part(parent, 'loop', brass, [lx, ly + R(0.437), lz], [R(0.063), R(0.095), R(0.065)]);
    }
    const { x: lx, y: ly, z: lz } = watchBeacon;
    for (let j = 0; j < 4; j++)
      part(
        group,
        'loop',
        iron,
        [lx, 3.367 + j * 0.048, lz],
        [0.021, 0.035, 0.029],
        [0, j % 2 ? Math.PI * 0.5 : 0, 0],
      );
    lantern(group, lx, ly, lz, 1, true);
    box(group, dark, x, 1.48, 0.098, 0.69, 0.373, 0.052);
    plaque(group, ending, x, 1.48, 0.127, 0.635, 0.306);
    spar(group, iron, [x, 1.22, 0], [x + 0.313, 1.22, 0.12], 0.035, 0.035);
    lantern(gift, x + 0.263, 0.95, 0.115, 0.56, false);
    // A hand-sewn swallowtail shifts in the wind along its free edge.
    const pos = [],
      uv = [],
      idx = [];
    for (let j = 0; j <= 12; j++) {
      const u = j / 12;
      for (let row = 0; row < 2; row++) {
        const taper = u > 0.68 ? (u - 0.68) * 0.55 : 0;
        pos.push(
          x + 0.025 + u * (row ? 0.98 : 1.07),
          3.98 - 0.084 * u - (row ? 0.304 - taper : taper * 0.6),
          0.019,
        );
        uv.push(u, row);
      }
      if (j) idx.push(2 * j - 2, 2 * j, 2 * j - 1, 2 * j, 2 * j + 1, 2 * j - 1);
    }
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0x924b37,
      map: texture('linen'),
      side: THREE.DoubleSide,
      roughness: 0.95,
    });
    const flag = new THREE.Mesh(geometry(pos, uv, idx), flagMat);
    flag.castShadow = true;
    group.add(flag);
    group.userData.flag = flag;
  }
  for (const { parent, geo, mat, frames } of batches.values()) {
    const batch = new THREE.InstancedMesh(geo, mat, frames.length);
    frames.forEach((frame, i) => batch.setMatrixAt(i, frame));
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.computeBoundingSphere();
    parent.add(batch);
  }
  return group;
}

function drawOathRoadside(realm, s, t) {
  const ending = oathEnding(s),
    dx = wrapped(s.x - oathRoadside.x),
    dz = wrapped(s.z - oathRoadside.z);
  realm.roadsideEnding = ending;
  if (realm.roadsideView) realm.roadsideView.visible = false;
  if (!ending || dx * dx + dz * dz > 54 * 54) return;
  const views = (realm.roadsideViews ||= new Map());
  if (!views.has(ending)) {
    const view = buildRoadside(realm, ending);
    views.set(ending, view);
    realm.scene.add(view);
  }
  const g = views.get(ending),
    data = g.userData;
  realm.roadsideView = g;
  g.position.set(
    nearest(oathRoadside.x, s.x),
    walkingSurface(oathRoadside.x, oathRoadside.z),
    nearest(oathRoadside.z, s.z),
  );
  g.visible = true;
  data.gift.visible = s.oathRoadGift !== ending;
  if (data.flag) {
    const attr = data.flag.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const u = Math.floor(i / 2) / 12;
      attr.setZ(
        i,
        0.019 +
          u * (0.088 * Math.sin(t * 3.52 - u * 7.6) + 0.04 * Math.sin(t * 5.6 - u * 13 + (i % 2) * 0.35)),
      );
    }
    attr.needsUpdate = true;
    data.flame.emissiveIntensity = 1.18 + 0.14 * Math.sin(t * 7.4) + 0.075 * Math.sin(t * 17.7);
  }
}
