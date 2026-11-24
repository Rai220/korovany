'use strict';

// Bake rigid shapes into one coloured mesh per moving bone. Templates share buffers across actors.
const solidInk = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.71, metalness: 0.035 });
const clothInk = solidInk.clone();
clothInk.side = THREE.DoubleSide;
const craftClasses = new Map();
function finishClass(tint) {
  if (craftClasses.has(tint)) return craftClasses.get(tint);
  const r = tint >> 16,
    g = (tint >> 8) & 255,
    b = tint & 255;
  const alloy = [0x688292, 0x464454, 0x7994a2, 0x49475c, 0xb7cccd, 0xb9cacf, 0x859396, 0xbac0b2, 0xbbc7ba];
  const brass = [
    0xf1ad49, 0xd4ab6d, 0xb89455, 0xe3be73, 0xb99753, 0xb99762, 0xd2b279, 0xc6ae63, 0xd78a55, 0xe8bd63,
    0xdb9a3b, 0xd6a03d, 0xab7b38, 0xd8ae60, 0x967346,
  ];
  const skin = [
    0xcabb9f, 0xd9c7a5, 0x945b40, 0xb48974, 0xe3b791, 0xd0a485, 0xe0b88c, 0xbd8d74, 0xd7a382, 0xf8e6bd,
    0x984121, 0xa4532d, 0xf2bda7, 0xda9583, 0xc58570,
  ];
  let kind;
  if ([0x945b40, 0x984121].includes(tint)) kind = 5;
  else if ([0xcabb9f, 0xd9c7a5].includes(tint)) kind = 6;
  else if ([0x688292, 0x464454, 0x7994a2, 0x49475c, 0x859396].includes(tint)) kind = 7;
  else if ([0x465a40, 0x523b45, 0x414e58, 0x72614b, 0x486549, 0x385775, 0x663b50, 0x8f5940].includes(tint))
    kind = 8;
  else
    kind = alloy.includes(tint)
      ? 1
      : brass.includes(tint)
        ? 2
        : skin.includes(tint)
          ? 4
          : g > r || b > r * 0.72 || (r > 155 && b > 100)
            ? 3
            : 0;
  craftClasses.set(tint, kind);
  return kind;
}
function wearShader(shader) {
  shader.uniforms.craftAtlas = { value: texture('craft-finish') };
  shader.uniforms.fieldAtlas = { value: texture('field-materials') };
  shader.vertexShader =
    'attribute vec3 finishData; varying vec3 vFinish;\n' +
    shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFinish=finishData;');
  shader.fragmentShader =
    'uniform sampler2D craftAtlas; uniform sampler2D fieldAtlas; varying vec3 vFinish;\n' +
    shader.fragmentShader
      .replace(
        '#include <color_fragment>',
        `
    #include <color_fragment>
    float finishKind=floor(vFinish.z+.5);
    vec2 atlasCell=finishKind==0.?vec2(0.,.5):finishKind==1.?vec2(.5):finishKind==2.?vec2(0.):vec2(.5,0.);
    float grain=pow(max(.001,dot(texture2D(craftAtlas,atlasCell+(.005+.49*fract(vFinish.xy))).rgb,vec3(.32,.55,.13))),.4545);
    diffuseColor.rgb*=mix(.58+grain*.88, .91+grain*.15,step(3.5,finishKind));
    vec2 coords=clamp(vFinish.xy,.015,.985);
    if(finishKind==5.)diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(fieldAtlas,vec2(.5)+coords*.49).rgb,.72);
    if(finishKind==6.){
      vec3 wool=texture2D(fieldAtlas,vec2(.342,.81)+coords*vec2(.10,.075)).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,wool,.75);
    }
    if(finishKind==7.){
      vec3 iron=texture2D(fieldAtlas,vec2(.5,0.)+coords*.49).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,iron,.88);
    }
    if(finishKind==8.){
      float quilt=dot(texture2D(fieldAtlas,coords*vec2(.491)+vec2(0.,.001)).rgb,vec3(.3,.58,.12));
      diffuseColor.rgb*=.38+quilt*3.7;
    }
  `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
    #include <roughnessmap_fragment>
    float metalPart=step(.5,finishKind)*(1.-step(2.5,finishKind))+(finishKind==7.?.87:0.);
    roughnessFactor=mix(.82,.32,metalPart)+(.5-grain)*.13;
  `,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\n metalnessFactor=mix(.025,.59,metalPart);',
      );
}
solidInk.onBeforeCompile = clothInk.onBeforeCompile = wearShader;

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
    this.finishes = [];
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
      const hex = typeof tint === 'function' ? tint(v) : tint;
      c.setHex(hex);
      const uv = geo.attributes.uv;
      this.finishes.push(uv ? uv.getX(i) : v.x, uv ? uv.getY(i) : v.y, finishClass(hex));
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
      ['finishData', this.finishes],
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
    ivory = 0xd9c7a5,
    russet = 0x984121;
  const hide = cow ? 0xcabb9f : 0x945b40,
    mane = cow ? 0x69321e : 0x4c2924;
  const form = shapes.pelt.clone(),
    points = form.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i),
      y = points.getY(i),
      z = points.getZ(i);
    const shoulder = Math.exp(-(((z - 0.54) / 0.38) ** 2)),
      rump = Math.exp(-(((z + 0.55) / 0.39) ** 2));
    const lift = 0.24 * shoulder + 0.15 * rump;
    points.setXYZ(
      i,
      x * (0.95 + 0.09 * shoulder + 0.13 * rump),
      y * (1 - 0.09 * Math.exp(-((z / 0.37) ** 2))) + lift * Math.max(0, y) + 0.11 * z,
      z,
    );
  }
  form.computeVertexNormals();
  const barrel = new THREE.Mesh(form, paintedSurface(cow ? 'hide-cow' : 'hide-horse', 0, 0.89));
  barrel.castShadow = barrel.receiveShadow = true;
  barrel.scale.set(0.43, cow ? 0.51 : 0.47, cow ? 0.99 : 1.03);
  barrel.position.y = 1.31;
  body.add(barrel);
  carved(body, (s) => {
    s.oval(hide, 0, 1.39, 0.57, 0.342, 0.442, 0.413, -0.15);
    s.oval(cow ? 0xf2bda7 : hide, 0, 1.04, -0.42, 0.25, 0.22, 0.33);
    if (cow)
      for (const x of [-0.12, 0.12])
        for (const z of [-0.52, -0.33]) s.oval(0xda9583, x, 0.87, z, 0.034, 0.09, 0.038);
    s.taper(hide, [0, 1.36, 0.49], [0, cow ? 1.73 : 2.017, 0.86], cow ? 0.304 : 0.313, cow ? 0.214 : 0.181);
    if (!cow)
      for (let i = 0; i < 6; i++) s.oval(mane, 0, 1.71 + i * 0.079, 0.46 + i * 0.055, 0.15, 0.16, 0.19);
    // Broad woven breast collar and drawn traces along each flank.
    // Two sewn leather pads distribute the yoke's load across the neck.
    for (const side of [-1, 1]) {
      const belt = [
        [side * 0.19, 1.7, 0.76],
        [side * 0.278, 1.59, 0.808],
        [side * 0.322, 1.46, 0.838],
        [side * 0.22, 1.346, 0.856],
        [0, 1.31, 0.872],
      ];
      for (let k = 1; k < belt.length; k++)
        s.taper(k < 3 ? 0x3e6258 : 0x624535, belt[k - 1], belt[k], 0.058, 0.055);
      for (let j = 0; j < 5; j++) {
        const t = j / 4;
        s.oval(
          0xb89455,
          side * (0.282 + 0.018 * Math.sin(t * Math.PI)),
          1.6 - 0.19 * t,
          0.85 + 0.033 * t,
          0.012,
          0.011,
          0.009,
        );
      }
    }
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
  const muzzle = cow
    ? [
        [-0.293, 0.07, 0.078, 0.44],
        [-0.26, 0.153, 0.117, 0.48],
        [-0.2, 0.232, 0.137, 0.48],
        [-0.145, 0.241, 0.14, 0.475],
        [-0.08, 0.19, 0.168, 0.407],
        [0.01, 0.194, 0.203, 0.28],
        [0.09, 0.237, 0.227, 0.163],
        [0.157, 0.246, 0.216, 0.099],
        [0.22, 0.221, 0.18, 0.059],
        [0.285, 0.17, 0.136, 0.039],
        [0.316, 0.074, 0.094, 0.005],
      ]
    : [
        [-0.319, 0.058, 0.09, 0.48],
        [-0.28, 0.117, 0.14, 0.47],
        [-0.222, 0.167, 0.16, 0.478],
        [-0.153, 0.172, 0.174, 0.465],
        [-0.09, 0.153, 0.193, 0.37],
        [0, 0.166, 0.216, 0.275],
        [0.094, 0.192, 0.23, 0.153],
        [0.167, 0.195, 0.213, 0.067],
        [0.245, 0.162, 0.179, 0.041],
        [0.295, 0.12, 0.14, 0.003],
        [0.326, 0.049, 0.07, -0.014],
      ];
  tailored(
    head,
    'muzzle',
    interpolateSections(muzzle, 0.024),
    paintedSurface(cow ? 'animal-cow' : 'animal-horse', 0, 0.86),
    48,
  );

  carved(head, (s) => {
    for (const side of [-1, 1]) {
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
      for (const sign of [-1, 1]) {
        const bridle = [
          [sign * 0.141, 0.235, 0.045],
          [sign * 0.192, 0.095, 0.155],
          [sign * 0.17, -0.09, 0.407],
          [sign * 0.157, -0.143, 0.53],
          [sign * 0.085, -0.15, 0.597],
          [0, -0.148, 0.621],
        ];
        for (let i = 1; i < bridle.length; i++) s.taper(leather, bridle[i - 1], bridle[i], 0.014, 0.014);
        s.oval(0xd4ab6d, sign * 0.174, -0.102, 0.447, 0.02, 0.023, 0.018);
      }
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

// Elliptic cross sections preserve a continuous silhouette through the jaw, shoulders and waist.
// UV longitude starts at the nape. The front of the face points along local +Z.
function tailored(parent, name, rows, material, detail, relief) {
  const positions = [],
    uvs = [],
    indices = [];
  const lo = rows[0][0],
    span = rows[rows.length - 1][0] - lo;
  for (let j = 0; j < rows.length; j++) {
    const [y, rx, rz, center = 0] = rows[j],
      v = (y - lo) / span;
    for (let i = 0; i <= detail; i++) {
      const u = i / detail,
        a = (u - 0.5) * 2 * Math.PI,
        cs = Math.cos(a),
        sn = Math.sin(a);
      const x = sn * rx,
        z = center + rz * cs + (relief ? relief(sn, v, cs) : 0);
      positions.push(x, y, z);
      uvs.push(u, v);
      if (j && i) {
        const k = j * (detail + 1) + i;
        indices.push(k - detail - 2, k - detail - 1, k, k - detail - 2, k, k - 1);
      }
    }
  }
  const geo = geometry(positions, uvs, indices);
  // The duplicate UV seam at the back should share a normal.
  const normals = geo.attributes.normal;
  for (let j = 0; j < rows.length; j++) {
    const first = j * (detail + 1),
      last = first + detail;
    const n = new THREE.Vector3()
      .fromBufferAttribute(normals, first)
      .add(new THREE.Vector3().fromBufferAttribute(normals, last))
      .normalize();
    normals.setXYZ(first, n.x, n.y, n.z);
    normals.setXYZ(last, n.x, n.y, n.z);
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}
const tailoredMaterials = new Map();
function paintedSurface(name, metalness = 0, roughness = 0.78) {
  if (!tailoredMaterials.has(name))
    tailoredMaterials.set(
      name,
      new THREE.MeshStandardMaterial({
        map: texture(name),
        color: 0xfff8eb,
        roughness,
        metalness,
      }),
    );
  return tailoredMaterials.get(name);
}
function interpolateSections(rows, step) {
  const out = [];
  for (let j = 1; j < rows.length; j++) {
    const a = rows[j - 1],
      b = rows[j],
      n = Math.ceil((b[0] - a[0]) / step);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out.push(a.map((x, k) => x + (b[k] - x) * t));
    }
  }
  out.push(rows[rows.length - 1]);
  return out;
}
function features(x, y, front) {
  if (front <= 0) return 0;
  const bump = (cx, cy, w, h) => Math.exp(-(((x - cx) / w) ** 2 + ((y - cy) / h) ** 2));
  return (
    (0.026 * bump(0, 0.45, 0.145, 0.19) +
      0.042 * bump(0, 0.355, 0.19, 0.077) +
      0.009 * bump(0, 0.208, 0.39, 0.044) +
      0.012 * bump(0, 0.1, 0.35, 0.065) +
      0.022 * bump(Math.abs(x), 0.4, 0.23, 0.14) -
      0.016 * bump(Math.abs(x), 0.54, 0.21, 0.057) +
      0.014 * bump(Math.abs(x), 0.62, 0.26, 0.052)) *
    front
  );
}
function wardrobe(torso, type, kind, tag) {
  const plated = type === 'guard' || type === 'lord',
    female = type === 'elf' || type === 'guard';
  const collar = plated ? 0.146 : 0.114,
    waist = female ? 0.183 : 0.216;
  const front = paintedSurface('coat-' + type, plated ? 0.24 : 0.045, plated ? 0.52 : 0.86);
  tailored(
    torso,
    'doublet',
    [
      [0.77, 0.221, 0.144, 0.0],
      [0.79, 0.247, 0.153, 0.002],
      [0.885, 0.238, 0.158, 0],
      [0.99, waist, 0.143, 0],
      [1.045, waist + 0.013, 0.153, 0.004],
      [1.17, 0.242, 0.168, 0.006],
      [1.31, 0.272, 0.185, 0.014],
      [1.39, 0.269, 0.163, 0.007],
      [1.45, 0.245, 0.127, -0.008],
      [1.49, 0.198, 0.101, -0.01],
      [1.515, collar, 0.102, -0.012],
    ],
    front,
    32,
  );
  const tint =
    type === 'lord' ? 0x663b50 : type === 'guard' ? 0x385775 : type === 'elf' ? 0x486549 : 0x8f5940;
  const cape = new Sculpt();
  // A closed half-circle of hand-folded cloth, flared away from the legs.
  const p = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= 12; j++) {
    const t = j / 12,
      y = 1.445 - 0.63 * t;
    for (let i = 0; i <= 22; i++) {
      const u = i / 22,
        a = (u - 0.5) * 2.02,
        pleat = Math.cos(u * 11 * Math.PI) * 0.02 * t;
      p.push(
        Math.sin(a) * (0.33 + t * 0.085),
        y + (0.1 * t - 0.032) * Math.cos(a) + t * 0.032 * Math.sin(u * 9.42),
        -0.097 - Math.cos(a) * (0.085 + t * 0.2 + pleat),
      );
      uv.push(u, 1 - t);
      if (i && j) {
        const k = j * 23 + i;
        idx.push(k - 24, k - 23, k, k - 24, k, k - 1);
      }
    }
  }
  const mantle = geometry(p, uv, idx);
  cape.add(mantle, tint, 0, 0, 0, 1, 1, 1);
  for (const side of [-1, 1]) cape.oval(0xd4ab6d, side * 0.168, 1.442, 0.109, 0.026, 0.026, 0.014);
  const cloth = cape.finish(torso);
  cloth.material = clothInk;
  mantle.dispose();
  const rows = [
    [1.53, 0.036, 0.063, 0.044],
    [1.545, 0.072, 0.085, 0.04],
    [1.577, 0.106, 0.107, 0.029],
    [1.624, 0.128, 0.124, 0.017],
    [1.68, 0.141, 0.134, 0.012],
    [1.737, 0.149, 0.136, 0.013],
    [1.797, 0.151, 0.132, 0.009],
    [1.85, 0.14, 0.126, -0.002],
    [1.89, 0.107, 0.094, -0.008],
    [1.918, 0.029, 0.035, -0.005],
  ];
  const faceKind =
    tag === 'healer'
      ? 'mara'
      : tag === 'carter'
        ? 'miller'
        : kind === 'spy'
          ? 'spy'
          : kind === 'guard' || kind === 'escort'
            ? 'sentry'
            : kind === 'merchant'
              ? 'elda'
              : type;
  tailored(
    torso,
    'face',
    interpolateSections(rows, 0.012),
    paintedSurface('face-' + faceKind, 0, 0.9),
    64,
    features,
  );
  const crown = type === 'lord' ? 0x464454 : type === 'guard' ? 0x859396 : 0x465b48;
  carved(torso, (s) => {
    const skin = type === 'lord' ? 0xb48974 : type === 'elf' ? 0xe3b791 : 0xd0a485;
    s.taper(0x554332, [0, 1.483, -0.006], [0, 1.564, -0.003], 0.109, 0.075);
    s.taper(0x936c53, [0, 1.546, -0.006], [0, 1.612, -0.002], 0.077, 0.09);
    for (const side of [-1, 1]) {
      s.oval(skin, side * 0.143, 1.707, -0.008, 0.029, 0.052, 0.036, 0, 0, side * -0.15);
      if (type === 'elf')
        s.taper(skin, [side * 0.143, 1.705, -0.026], [side * 0.224, 1.793, -0.063], 0.027, 0.002);
    }
    if (plated) {
      s.oval(crown, 0, 1.852, -0.026, 0.167, 0.14, 0.153);
      s.oval(0xb89455, 0, 1.833, 0.004, 0.173, 0.022, 0.155);
      for (const side of [-1, 1]) {
        s.oval(crown, side * 0.147, 1.76, -0.016, 0.032, 0.111, 0.093, 0, 0, side * 0.12);
        s.oval(0xe3be73, side * 0.164, 1.802, 0.048, 0.013, 0.016, 0.014);
      }
      // Four metal bands follow the helm bowl and meet along its raised comb.
      for (const a of [-2.32, -0.7, 0.7, 2.32]) {
        let last;
        for (let i = 0; i <= 8; i++) {
          const phi = 0.025 + (i * 1.489) / 8;
          const point = [
            0.1685 * Math.sin(a) * Math.cos(phi),
            1.852 + 0.141 * Math.sin(phi),
            -0.026 + 0.154 * Math.cos(a) * Math.cos(phi),
          ];
          if (last)
            s.taper(
              i === 1 ? 0xd4ab6d : 0x798685,
              last,
              point,
              i < 6 ? 0.0056 : 0.004,
              i < 6 ? 0.0056 : 0.004,
            );
          if (i === 1 || i === 4) s.oval(0xb89455, ...point, 0.0065, 0.0065, 0.0065);
          last = point;
        }
      }
      for (let i = 0; i < 9; i++) {
        const a = (i - 4) * 0.34;
        s.oval(0xd4ab6d, Math.sin(a) * 0.169, 1.834, 0.005 + 0.154 * Math.cos(a), 0.0055, 0.006, 0.005);
      }
      s.taper(0xb99753, [0, 1.974, -0.044], [0, 1.993, 0.083], 0.016, 0.006);
      if (kind === 'commander' || kind === 'regent') {
        for (let q = 0; q < 6; q++) {
          const t = q / 5;
          s.oval(
            type === 'lord' ? 0x8f506a : 0xac4440,
            0,
            2.01 + t * 0.051,
            -0.025 - t * 0.11,
            0.031,
            0.071,
            0.075,
            -t * 0.62,
          );
        }
      }
      if (type === 'lord')
        for (const side of [-1, 1]) {
          s.taper(0xb99762, [side * 0.123, 1.905, 0], [side * 0.207, 1.997, -0.042], 0.041, 0.025);
          s.taper(0xd2b279, [side * 0.207, 1.997, -0.042], [side * 0.22, 2.073, -0.1], 0.025, 0.002);
        }
    } else if (type === 'elf') {
      s.oval(0x405b43, 0, 1.875, -0.032, 0.169, 0.1, 0.147, 0, 0, -0.09);
      s.taper(0x486748, [0, 1.903, -0.017], [0.092, 1.923, -0.205], 0.112, 0.01);
      for (const side of [-1, 1])
        for (let j = 0; j < 3; j++)
          s.oval(
            0x895333,
            side * (0.125 + j * 0.005),
            1.751 - j * 0.044,
            -0.065,
            0.034,
            0.056,
            0.046,
            0,
            0,
            side * 0.1,
          );
      s.taper(0xd3a854, [0.115, 1.911, -0.056], [0.206, 2.036, -0.106], 0.035, 0.002);
    } else {
      s.oval(0xd6bb8a, 0, 1.865, -0.024, 0.171, 0.083, 0.151, 0, 0, -0.09);
      s.oval(0x9c754f, 0, 1.82, 0, 0.157, 0.026, 0.142, 0, 0, -0.036);
    }
  });
}

function polishedBlade() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  const ctx = c.getContext('2d'),
    r = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [p, color] of [
    [0, '#f8efe0'],
    [0.065, '#e0e6e1'],
    [0.12, '#898e89'],
    [0.36, '#cbd8d9'],
    [0.4, '#d7ded9'],
    [0.416, '#697777'],
    [0.49, '#879790'],
    [0.55, '#aab4ad'],
    [0.59, '#e9efe9'],
    [0.61, '#9aa5a6'],
    [0.87, '#73868b'],
    [0.95, '#afbfc3'],
    [1, '#f1e9d4'],
  ])
    r.addColorStop(p, color);
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 256, 1024);
  let seed = 19291;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 2200; i++) {
    const x = random() * 256,
      y = random() * 1024;
    ctx.strokeStyle = i % 3 ? 'rgba(245,244,220,.14)' : 'rgba(34,49,54,.12)';
    ctx.lineWidth = 0.28 + random() * 0.65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.7 * random(), y + 9 + random() * 77);
    ctx.stroke();
  }
  // Engraved barley on the forte, tapering to a tiny rosette at the top.
  ctx.strokeStyle = '#8d743e';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(128, 999);
  ctx.quadraticCurveTo(126, 903, 129, 831);
  ctx.stroke();
  for (let i = 0; i < 8; i++)
    for (const sign of [-1, 1]) {
      const y = 976 - 15 * i,
        span = 16 - i;
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.quadraticCurveTo(128 + sign * span, y - 4, 128 + sign * span, y - 15);
      ctx.quadraticCurveTo(128 + sign * 3, y - 10, 128, y);
      ctx.stroke();
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function footShade() {
  if (!footShade.surface) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const q = c.getContext('2d'),
      g = q.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0, 'rgba(48,34,20,.46)');
    g.addColorStop(0.42, 'rgba(48,34,20,.30)');
    g.addColorStop(1, 'rgba(48,34,20,0)');
    q.fillStyle = g;
    q.fillRect(0, 0, 64, 64);
    footShade.surface = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    footShade.plane = new THREE.PlaneGeometry(1, 1);
    footShade.plane.rotateX(-Math.PI * 0.5);
  }
  return new THREE.Mesh(footShade.plane, footShade.surface);
}

function fieldSword(arm) {
  if (!fieldSword.data) {
    const vertices = [],
      uv = [],
      ix = [];
    // A diamond cross-section down the blade, two edges and a narrow point.
    const rows = [
      [0.17, 0.027, 0.007],
      [0.225, 0.038, 0.008],
      [0.55, 0.026, 0.0055],
      [0.7, 0.022, 0.004],
      [0.805, 0.0007, 0.0005],
    ];
    for (const [z, r, h] of rows)
      for (const [x, y, u] of [
        [-r, 0, 0],
        [-r * 0.21, h, 0.395],
        [r * 0.21, h, 0.605],
        [r, 0, 1],
        [0, -h, 0.52],
      ]) {
        vertices.push(x + 0.023, -0.451 + (z - 0.17) * 0.178 + y, z);
        uv.push(u, (z - 0.17) / 0.635);
      }
    for (let j = 1; j < rows.length; j++)
      for (let k = 0; k < 5; k++) {
        const a = (j - 1) * 5 + k,
          b = (j - 1) * 5 + ((k + 1) % 5);
        ix.push(a, b, a + 5, b, b + 5, a + 5);
      }
    fieldSword.data = {
      geo: geometry(vertices, uv, ix),
      ink: new THREE.MeshStandardMaterial({
        map: polishedBlade(),
        color: 0xfbf5df,
        metalness: 0.52,
        roughness: 0.35,
        side: THREE.DoubleSide,
      }),
    };
  }
  const m = new THREE.Mesh(fieldSword.data.geo, fieldSword.data.ink);
  m.castShadow = true;
  arm.add(m);
}

function coatOfArms(arm, regent) {
  const outline = [
    [-0.218, 0.248],
    [-0.161, 0.298],
    [-0.076, 0.279],
    [0, 0.307],
    [0.076, 0.279],
    [0.161, 0.298],
    [0.218, 0.248],
    [0.206, 0.023],
    [0.153, -0.12],
    [0.094, -0.206],
    [0, -0.291],
    [-0.094, -0.206],
    [-0.153, -0.12],
    [-0.206, 0.023],
  ];
  // Shallow convex front, leather backing, rolled perimeter and peened rivets.
  const section = (scale, x, y) => [
    x * scale - 0.043,
    y * scale - 0.246,
    0.184 + 0.065 * (1 - (x / 0.222) ** 2) * scale,
  ];
  const pp = [],
    uu = [],
    ii = [];
  for (let ring = 0; ring < 3; ring++)
    for (const [x, y] of outline) {
      const scale = [1, 0.7, 0.3][ring];
      pp.push(...section(scale, x * 1, y));
      uu.push(0.5 + (x * scale) / 0.49, 0.54 + (y * scale) / 0.72);
    }
  pp.push(-0.043, -0.246, 0.267);
  uu.push(0.5, 0.54);
  const n = outline.length;
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    for (let i = 0; i < 2; i++) {
      const a = i * n;
      ii.push(a + j, a + n + j, a + n + k, a + j, a + n + k, a + k);
    }
    ii.push(n * 2 + j, n * 3, n * 2 + k);
  }
  const art = paintedSurface(regent ? 'standard-pine' : 'standard-sun', 0.12, 0.67);
  art.side = THREE.DoubleSide;
  const face = new THREE.Mesh(geometry(pp, uu, ii), art);
  face.castShadow = true;
  face.receiveShadow = true;
  arm.add(face);
  carved(arm, (s) => {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n,
        from = section(1, ...outline[j]),
        to = section(1, ...outline[k]);
      s.taper(0xd4ab6d, from, to, 0.009, 0.009);
      if (j % 2 === 0) {
        const p = section(0.91, ...outline[j]);
        s.oval(0xd4ab6d, p[0], p[1], p[2] + 0.008, 0.009, 0.009, 0.006);
      }
    }
  });
}

function makeVillager(kind, tag = '') {
  const elf = ['elf', 'spy', 'herbalist'].includes(kind),
    iron = ['lord', 'regent', 'firekeeper'].includes(kind);
  const soldier = ['guard', 'escort', 'commander', 'sentry'].includes(kind),
    trade = !elf && !iron && !soldier;
  const cloth = elf ? 0x465a40 : iron ? 0x523b45 : soldier ? 0x414e58 : 0x72614b,
    trim = elf ? 0xc6ae63 : iron ? 0xd78a55 : soldier ? 0xe8bd63 : 0xf4d69d,
    plate = iron ? 0x49475c : 0x859396,
    bootColor = 0x4b342c,
    skin = elf ? 0xe0b88c : iron ? 0xbd8d74 : 0xd7a382,
    hair = elf ? 0xb77845 : iron ? 0x493640 : 0x70432e;
  const g = new THREE.Group(),
    torso = joint(g, 'torso');
  wardrobe(torso, elf ? 'elf' : iron ? 'lord' : soldier ? 'guard' : 'miller', kind, tag);
  for (const [i, side] of [-1, 1].entries()) {
    const l = joint(g, 'leg' + i, side * 0.133, 0.88, 0),
      k = joint(l, 'knee' + i, 0, -0.4, 0);
    carved(l, (s) => {
      s.taper(cloth, [0, -0.115, 0], [0.004, -0.392, 0.008], 0.106, 0.078);
      s.oval(cloth, 0, -0.117, -0.01, 0.109, 0.182, 0.123);
      for (let n = 0; n < 3; n++) s.oval(trim, side * 0.095, -0.19 - n * 0.043, 0.027, 0.014, 0.01, 0.01);
      s.oval(soldier ? plate : bootColor, 0, -0.37, 0.032, 0.092, 0.105, 0.096);
    });
    carved(k, (s) => {
      s.taper(bootColor, [0, -0.055, 0], [0, -0.313, 0.018], 0.087, 0.065);
      for (let n = 0; n < 3; n++)
        s.taper(
          0x986842,
          [-0.054, -0.078 - n * 0.052, 0.057],
          [0.061, -0.093 - n * 0.052, 0.061],
          0.006,
          0.006,
        );
      s.oval(leather, 0, -0.035, 0, 0.103, 0.065, 0.105);
      s.oval(bootColor, 0, -0.37, 0.056, 0.11, 0.101, 0.18);
    });
    const arm = joint(g, 'arm' + i, side * 0.298, 1.438, 0);
    carved(arm, (s) => {
      s.oval(cloth, side * 0.012, -0.035, 0, 0.112, 0.142, 0.124);
      if (soldier || iron)
        for (let q = 0; q < 3; q++) {
          s.oval(
            q === 2 ? trim : plate,
            side * (0.025 + q * 0.01),
            0.018 - q * 0.041,
            0,
            0.137 - q * 0.003,
            0.077,
            0.142 - q * 0.006,
            0,
            0,
            -side * q * 0.08,
          );
        }
      else {
        s.taper(trim, [side * 0.001, -0.104, 0], [side * 0.002, -0.126, 0], 0.108, 0.103);
      }
      s.taper(cloth, [0, -0.035, 0], [side * 0.027, -0.274, 0.006], 0.102, 0.073);
      s.taper(leather, [side * 0.027, -0.274, 0.006], [side * 0.025, -0.425, 0.072], 0.081, 0.061);
      s.oval(leather, side * 0.026, -0.438, 0.078, 0.055, 0.072, 0.045);
      for (let f = 0; f < 4; f++) {
        s.oval(
          0x785a43,
          side * (-0.008 + f * 0.022),
          -0.475 + Math.abs(f - 1.5) * 0.008,
          0.09,
          0.016,
          0.039,
          0.023,
          -0.26,
        );
      }
      s.oval(leather, -side * 0.027, -0.448, 0.097, 0.023, 0.047, 0.025, 0, 0, -side * 0.38);
      if (i === 1 && !trade) {
        s.taper(0x765237, [0.02, -0.465, 0.04], [0.02, -0.444, 0.177], 0.017, 0.017);
        s.oval(0x967346, 0.02, -0.467, 0.032, 0.025, 0.024, 0.022);
        for (const direction of [-1, 1]) {
          s.taper(0xb89455, [0.022, -0.451, 0.17], [0.022 + direction * 0.074, -0.453, 0.164], 0.014, 0.009);
          s.taper(
            0xb89455,
            [0.022 + direction * 0.074, -0.453, 0.164],
            [0.022 + direction * 0.101, -0.452, 0.183],
            0.009,
            0.005,
          );
        }
      }
    });
    if (i === 0 && (soldier || iron)) coatOfArms(arm, iron);
    if (i === 1 && !trade) fieldSword(arm);
  }
  g.scale.setScalar(kind === 'regent' ? 1.23 : kind === 'merchant' ? 0.97 : 1.05);
  return g;
}
