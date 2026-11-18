'use strict';

// Bake rigid shapes into one coloured mesh per moving bone. Templates share buffers across actors.
const solidInk = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.71, metalness: 0.035 });
const shapes = {
  orb: new THREE.SphereGeometry(1, 16, 12),
  pelt: new THREE.SphereGeometry(1, 64, 36),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 16),
  drum: new THREE.CylinderGeometry(1, 1, 1, 16),
};
function joint(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
class Sculpt {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
  }
  add(geo, tint, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), rot, new THREE.Vector3(w, h, d));
    const norm = new THREE.Matrix3().getNormalMatrix(mat),
      v = new THREE.Vector3();
    const p = geo.attributes.position,
      n = geo.attributes.normal,
      off = this.positions.length / 3,
      c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.setHex(typeof tint === 'function' ? tint(v) : tint);
      this.colors.push(c.r, c.g, c.b);
      v.applyMatrix4(mat);
      this.positions.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyNormalMatrix(norm);
      this.normals.push(v.x, v.y, v.z);
    }
    const indices = geo.index?.array;
    for (let i = 0, l = indices ? indices.length : p.count; i < l; i++)
      this.indices.push(off + (indices ? indices[i] : i));
  }
  oval(...params) {
    this.add(shapes.orb, ...params);
  }
  box(...params) {
    this.add(shapes.box, ...params);
  }
  drum(...params) {
    this.add(shapes.drum, ...params);
  }
  taper(color, from, to, r1, r2) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      axis = b.clone().sub(a);
    const mid = a.add(b).multiplyScalar(0.5),
      rot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize()),
      );
    const g = new THREE.CylinderGeometry(r2, r1, axis.length(), 12);
    this.add(g, color, mid.x, mid.y, mid.z, 1, 1, 1, rot.x, rot.y, rot.z);
    g.dispose();
  }
  finish(parent) {
    const g = new THREE.BufferGeometry();
    for (const [name, data] of [
      ['position', this.positions],
      ['normal', this.normals],
      ['color', this.colors],
    ])
      g.setAttribute(name, new THREE.Float32BufferAttribute(data, 3));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, solidInk);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
}
function carved(parent, fn) {
  const s = new Sculpt();
  fn(s);
  return s.finish(parent);
}
const copper = 0xf1ad49,
  leather = 0x633922,
  ink = 0x231d24;
function animalCoat(cow) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d'),
    pixels = ctx.createImageData(1024, 512),
    buf = pixels.data;
  let seed = 378421;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < 512; y++) {
    const v = ((y + 0.5) * Math.PI) / 512,
      sy = Math.cos(v),
      cv = Math.sin(v);
    for (let x = 0; x < 1024; x++) {
      const a = ((x + 0.5) * Math.PI) / 512,
        sx = -Math.cos(a) * cv,
        sz = Math.sin(a) * cv;
      const n =
        Math.sin(sx * 5 + sy * 4.1 + sz * 2) +
        Math.cos(sz * 7 - sy * 3 + sx * 1.4) +
        0.38 * Math.sin(sy * 7 + sz * 8);
      const spot = cow ? THREE.MathUtils.smoothstep(n, 0.165, 0.205) : 1;
      const stripe = 0.03 * Math.sin(sy * 17 + sz * 9 + 0.7 * Math.sin(sx * 20)) + 0.015 * (rand() - 0.5);
      const shade = 1 + stripe - (0.105 * (1 - sy)) / 2 + 0.035 * Math.sin(sx * 4 + sz * 9);
      const i = (y * 1024 + x) * 4,
        base = cow ? [248, 227, 193] : [171, 92, 51],
        patch = cow ? [154, 71, 39] : [171, 92, 51];
      for (let c = 0; c < 3; c++) buf[i + c] = (base[c] + spot * (patch[c] - base[c])) * shade;
      buf[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  for (let i = 0; i < 28000; i++) {
    const x = rand() * 1024,
      y = rand() * 512;
    ctx.strokeStyle = i % 2 ? 'rgba(255,238,191,.13)' : 'rgba(71,38,23,.09)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2 + rand() * 4, y + 2 * Math.sin(x * 0.014));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
}
function drayCanvas() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eed397';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) {
    const x = 128 * i;
    ctx.fillStyle = '#447f79';
    ctx.fillRect(x, 0, 48, 512);
    ctx.fillStyle = '#854628';
    ctx.fillRect(x + 5, 0, 3, 512);
    ctx.fillRect(x + 41, 0, 3, 512);
    ctx.fillStyle = '#e6b653';
    ctx.fillRect(x + 10, 0, 2, 512);
    ctx.fillRect(x + 36, 0, 2, 512);
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = '#d6b771';
      ctx.beginPath();
      ctx.moveTo(x + 24, y + 4);
      ctx.lineTo(x + 32, y + 18);
      ctx.lineTo(x + 24, y + 32);
      ctx.lineTo(x + 16, y + 18);
      ctx.fill();
    }
  }
  for (let i = 0; i < 512; i += 3) {
    ctx.fillStyle = 'rgba(63,42,27,.12)';
    ctx.fillRect(i, 0, 1, 512);
    ctx.fillStyle = 'rgba(255,255,241,.15)';
    ctx.fillRect(0, i, 512, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function makeBeast(cow) {
  const rig = new THREE.Group(),
    body = joint(rig, 'body'),
    ivory = 0xf8e6bd,
    russet = 0x984121;
  const hide = cow ? ivory : 0xa4532d,
    mane = cow ? 0x69321e : 0x4c2924;
  const barrel = new THREE.Mesh(shapes.pelt, animalCoat(cow));
  barrel.castShadow = barrel.receiveShadow = true;
  barrel.scale.set(0.43, cow ? 0.51 : 0.47, cow ? 0.99 : 1.03);
  barrel.position.y = 1.31;
  body.add(barrel);
  carved(body, (s) => {
    s.oval(hide, 0, 1.34, 0.59, 0.36, 0.52, 0.41, -0.15);
    s.oval(cow ? 0xf2bda7 : hide, 0, 1.04, -0.42, 0.25, 0.22, 0.33);
    if (cow)
      for (const x of [-0.12, 0.12])
        for (const z of [-0.52, -0.33]) s.oval(0xda9583, x, 0.87, z, 0.034, 0.09, 0.038);
    s.oval(hide, 0, cow ? 1.54 : 1.68, 0.73, 0.29, cow ? 0.4 : 0.58, 0.38, 0.43);
    if (!cow)
      for (let i = 0; i < 6; i++) s.oval(mane, 0, 1.71 + i * 0.079, 0.46 + i * 0.055, 0.15, 0.16, 0.19);
    // Broad woven breast collar and drawn traces along each flank.
    s.oval(0x207f74, 0, 1.46, 0.69, 0.376, 0.155, 0.41, 0.25);
    for (const side of [-1, 1]) {
      s.taper(leather, [side * 0.355, 1.46, 0.78], [side * 0.45, 1.26, -1.18], 0.033, 0.029);
      s.oval(copper, side * 0.373, 1.47, 0.78, 0.047, 0.067, 0.07);
    }
    for (const side of [-1, 1]) {
      const x = side * 0.364;
      for (let k = 0; k < 9; k++)
        s.oval(
          0xdb9a3b,
          x,
          1.45 + 0.086 * Math.cos(k * 0.698),
          0.73 + 0.086 * Math.sin(k * 0.698),
          0.027,
          0.055,
          0.053,
        );
      s.oval(0x278579, x + side * 0.017, 1.45, 0.73, 0.028, 0.071, 0.069);
      for (const k of [-1, 1])
        s.box(k === 1 ? 0xd6a03d : 0x1d827b, x, 1.29, 0.73 + k * 0.043, 0.026, 0.21, 0.071, k * 0.19);
    }
    s.taper(copper, [0, 1.29, 0.99], [0, 1.1, 1.02], 0.074, 0.124);
    s.oval(0x674730, 0, 1.086, 1.025, 0.052, 0.041, 0.054);
  });
  const head = joint(body, 'head', 0, cow ? 1.71 : 2.02, 0.87);
  carved(head, (s) => {
    s.oval(hide, 0, 0.002, 0.125, cow ? 0.294 : 0.219, cow ? 0.32 : 0.31, 0.315, -0.22);
    s.oval(cow ? 0xa8512d : hide, 0, -0.087, 0.321, cow ? 0.23 : 0.168, 0.22, 0.31, 0.35);
    s.oval(cow ? 0xe9a78e : 0x694639, 0, -0.176, 0.516, cow ? 0.262 : 0.182, 0.142, 0.166);
    for (const side of [-1, 1]) {
      s.oval(ink, side * (cow ? 0.13 : 0.094), -0.15, 0.651, 0.047, 0.031, 0.017);
      s.oval(
        hide,
        side * 0.294,
        0.125,
        -0.002,
        cow ? 0.2 : 0.076,
        cow ? 0.087 : 0.21,
        0.084,
        0,
        0,
        side * (cow ? 0.21 : -0.24),
      );
      s.oval(
        cow ? 0xc58570 : 0xd49a6a,
        side * 0.302,
        0.137,
        0.058,
        cow ? 0.138 : 0.043,
        cow ? 0.047 : 0.14,
        0.026,
        0,
        0,
        side * (cow ? 0.21 : -0.24),
      );
      const ex = side * (cow ? 0.235 : 0.17);
      s.oval(0x553226, ex, 0.085, 0.269, 0.077, 0.102, 0.067);
      s.oval(0xfff1ce, ex + side * 0.013, 0.096, 0.292, 0.064, 0.077, 0.053);
      s.oval(ink, ex + side * 0.023, 0.093, 0.321, 0.044, 0.058, 0.032);
      s.oval(0xffffff, ex + side * 0.039, 0.118, 0.339, 0.014, 0.017, 0.01);
      if (cow) {
        s.taper(0xddb873, [side * 0.192, 0.21, -0.01], [side * 0.342, 0.336, -0.06], 0.089, 0.056);
        s.taper(ivory, [side * 0.342, 0.336, -0.06], [side * 0.393, 0.482, -0.078], 0.058, 0.009);
      }
    }
    if (cow) {
      s.box(0xeab742, 0.441, 0.039, 0.082, 0.091, 0.14, 0.034, 0, 0, -0.17);
      s.oval(0xffe0a1, 0, 0.245, 0.151, 0.126, 0.083, 0.105);
    } else {
      s.oval(mane, 0, 0.235, 0.09, 0.123, 0.114, 0.16, -0.33);
      s.oval(0x327c85, 0, 0.262, -0.052, 0.25, 0.082, 0.234, -0.12);
      s.taper(0xeeb84d, [0.12, 0.27, -0.07], [0.19, 0.5, -0.18], 0.064, 0.002);
      s.oval(leather, 0, -0.11, 0.434, 0.188, 0.048, 0.151, 0.36);
    }
  });
  const tail = joint(body, 'tail', 0, 1.55, -0.84);
  carved(tail, (s) => {
    s.taper(cow ? ivory : mane, [0, 0, 0], [0.06, -0.4, -0.18], cow ? 0.036 : 0.12, cow ? 0.03 : 0.084);
    s.taper(cow ? ivory : mane, [0.06, -0.4, -0.18], [0.095, -0.75, -0.12], cow ? 0.032 : 0.091, 0.032);
    s.oval(mane, 0.095, -0.75, -0.12, cow ? 0.063 : 0.081, 0.145, 0.083, -0.15);
  });
  const legs = [];
  for (const side of [-1, 1])
    for (const front of [false, true]) {
      const hip = joint(rig, 'hip', side * 0.27, 1.08, front ? 0.63 : -0.62);
      const knee = joint(hip, 'knee', 0, -0.5, 0);
      const foot = joint(knee, 'hoof', 0, -0.48, 0);
      carved(hip, (s) => {
        s.oval(
          front ? hide : cow ? russet : hide,
          0,
          -0.15,
          0,
          front ? 0.112 : 0.155,
          0.33,
          front ? 0.135 : 0.205,
        );
        s.taper(hide, [0, -0.16, 0], [0, -0.5, 0], front ? 0.11 : 0.127, 0.068);
      });
      carved(knee, (s) => {
        s.oval(hide, 0, -0.007, 0, 0.084, 0.09, 0.098);
        s.taper(hide, [0, -0.04, 0], [0, -0.27, 0], 0.071, 0.06);
        s.taper(cow ? ivory : 0x432d28, [0, -0.27, 0], [0, -0.48, 0], 0.063, 0.052);
      });
      carved(foot, (s) => {
        if (cow)
          for (const sign of [-1, 1]) s.oval(0x493b32, sign * 0.042, -0.022, 0.032, 0.045, 0.072, 0.105);
        else s.oval(0x443732, 0, -0.024, 0.039, 0.088, 0.072, 0.117);
      });
      legs.push({ hip, knee, foot, side, front });
    }
  rig.userData = { body, head, legs, tail };
  return rig;
}

function makeVillager(kind) {
  const elf = ['elf', 'spy', 'herbalist'].includes(kind),
    iron = ['lord', 'regent', 'firekeeper'].includes(kind);
  const soldier = ['guard', 'escort', 'commander', 'sentry'].includes(kind),
    trade = !elf && !iron && !soldier;
  const cloth = elf ? 0x347556 : iron ? 0x733c66 : soldier ? 0x376888 : 0xbc6a3d,
    trim = elf ? 0xc6ae63 : iron ? 0xd78a55 : soldier ? 0xe8bd63 : 0xf4d69d,
    plate = iron ? 0x49475c : 0x7994a2,
    bootColor = 0x4b342c,
    skin = elf ? 0xe0b88c : iron ? 0xbd8d74 : 0xd7a382,
    hair = elf ? 0xb77845 : iron ? 0x493640 : 0x70432e;
  const g = new THREE.Group(),
    torso = joint(g, 'torso');
  carved(torso, (s) => {
    s.oval(cloth, 0, 1.18, 0, 0.275, 0.369, 0.182);
    s.taper(cloth, [0, 0.81, 0], [0, 1.13, 0], 0.269, 0.214);
    s.oval(leather, 0, 1.03, 0.002, 0.267, 0.066, 0.212);
    s.box(copper, 0, 1.033, 0.209, 0.094, 0.081, 0.03);
    s.oval(cloth, 0, 1.32, -0.094, 0.309, 0.43, 0.14, -0.1);
    s.oval(soldier || iron ? plate : cloth, 0, 1.36, 0, 0.298, 0.235, 0.186);
    s.taper(trim, [-0.19, 1.12, 0.137], [0.177, 1.48, 0.13], 0.022, 0.03);
    if (trade) {
      s.box(0xf1dcb4, 0, 1.14, 0.181, 0.29, 0.48, 0.035);
      s.box(cloth, 0.05, 1.06, 0.204, 0.13, 0.091, 0.023);
    }
    s.oval(skin, 0, 1.55, 0, 0.09, 0.11, 0.088);
    s.oval(skin, 0, 1.72, 0.018, 0.169, 0.207, 0.145);
    s.oval(hair, 0, 1.79, -0.059, 0.176, 0.158, 0.132);
    s.oval(skin, 0, 1.713, 0.151, 0.041, 0.059, 0.069);
    s.oval(hair, 0, 1.635, 0.139, trade ? 0.094 : 0.067, 0.015, 0.027);
    for (const side of [-1, 1]) {
      s.oval(skin, side * 0.161, 1.715, 0, 0.047, 0.061, 0.04);
      if (elf) s.taper(skin, [side * 0.15, 1.7, -0.012], [side * 0.27, 1.82, -0.059], 0.047, 0.004);
      s.oval(0xf0e1c7, side * 0.064, 1.759, 0.143, 0.044, 0.028, 0.018);
      s.oval(ink, side * 0.065, 1.759, 0.158, 0.019, 0.022, 0.011);
      s.oval(hair, side * 0.069, 1.797, 0.141, 0.057, 0.013, 0.023, 0, 0, side * 0.13);
    }
    if (soldier || iron) {
      s.oval(plate, 0, 1.855, -0.013, 0.19, 0.15, 0.166);
      s.oval(trim, 0, 1.824, 0.0, 0.207, 0.029, 0.183);
      if (kind === 'commander' || kind === 'regent')
        s.taper(0xbf4548, [0, 1.93, -0.012], [0, 2.15, -0.14], 0.079, 0.003);
      if (iron)
        for (const side of [-1, 1])
          s.taper(trim, [side * 0.12, 1.92, 0], [side * 0.197, 2.043, -0.033], 0.059, 0.003);
    } else {
      s.oval(cloth, 0, 1.872, 0, 0.208, 0.103, 0.18, 0, 0, -0.12);
      s.oval(trim, 0, 1.827, 0.03, 0.214, 0.027, 0.201, 0, 0, -0.1);
      if (elf) s.taper(0xe1ac52, [0.12, 1.88, -0.04], [0.27, 2.068, -0.114], 0.049, 0.004);
    }
  });
  for (const [i, side] of [-1, 1].entries()) {
    const l = joint(g, 'leg' + i, side * 0.133, 0.88, 0),
      k = joint(l, 'knee' + i, 0, -0.4, 0);
    carved(l, (s) => {
      s.oval(cloth, 0, -0.19, 0, 0.107, 0.251, 0.117);
      s.oval(soldier ? plate : bootColor, 0, -0.37, 0.032, 0.092, 0.105, 0.096);
    });
    carved(k, (s) => {
      s.oval(bootColor, 0, -0.145, 0, 0.085, 0.218, 0.086);
      s.oval(leather, 0, -0.035, 0, 0.103, 0.065, 0.105);
      s.oval(bootColor, 0, -0.37, 0.056, 0.11, 0.101, 0.18);
    });
    const arm = joint(g, 'arm' + i, side * 0.298, 1.438, 0);
    carved(arm, (s) => {
      s.oval(soldier || iron ? plate : cloth, side * 0.018, -0.012, 0, 0.144, 0.128, 0.148);
      s.taper(cloth, [0, -0.035, 0], [side * 0.027, -0.274, 0.006], 0.102, 0.073);
      s.taper(leather, [side * 0.027, -0.274, 0.006], [side * 0.025, -0.425, 0.072], 0.081, 0.061);
      s.oval(skin, side * 0.026, -0.452, 0.083, 0.069, 0.082, 0.066);
      if (i === 1 && !trade) {
        s.taper(0xb6c5cc, [0.02, -0.445, 0.16], [0.02, -0.295, 0.77], 0.044, 0.001);
        s.box(trim, 0.02, -0.45, 0.172, 0.23, 0.04, 0.046);
      }
      if (i === 0 && (soldier || iron)) {
        s.oval(cloth, -0.04, -0.255, 0.16, 0.195, 0.296, 0.058);
        s.oval(trim, -0.04, -0.25, 0.209, 0.059, 0.065, 0.024);
      }
    });
  }
  g.scale.setScalar(kind === 'regent' ? 1.23 : kind === 'merchant' ? 0.97 : 1.05);
  return g;
}
