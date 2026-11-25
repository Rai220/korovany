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
  const q = c.getContext('2d'),
    base = q.createLinearGradient(0, 0, 512, 0);
  base.addColorStop(0, '#a89778');
  base.addColorStop(0.19, '#c8b79a');
  base.addColorStop(0.48, '#d4c5a7');
  base.addColorStop(0.72, '#c8b99d');
  base.addColorStop(1, '#af9a79');
  q.fillStyle = base;
  q.fillRect(0, 0, 512, 512);
  let n = 2187;
  const r = () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 18000; i++) {
    q.fillStyle = i % 2 ? 'rgba(53,43,29,.08)' : 'rgba(248,236,200,.12)';
    q.fillRect(r() * 512, r() * 512, 1 + r() * 9, 0.7 + r());
  }
  for (let j = 0; j < 4; j++) {
    const y = j * 128 + 15;
    q.fillStyle = 'rgba(79,64,43,.26)';
    q.fillRect(0, y, 512, 1.8);
    q.fillStyle = 'rgba(255,243,215,.35)';
    q.fillRect(0, y + 2, 512, 1.2);
    for (let x = 1; x < 512; x += 6) {
      q.fillStyle = 'rgba(60,50,38,.25)';
      q.fillRect(x, y + 3, 2.5, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function saltStamp() {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 144;
  const q = c.getContext('2d');
  q.fillStyle = '#ae9870';
  q.fillRect(0, 0, 320, 144);
  q.strokeStyle = '#544936';
  q.lineWidth = 2;
  q.strokeRect(8, 8, 304, 128);
  q.lineWidth = 3;
  q.beginPath();
  q.moveTo(32, 91);
  q.lineTo(55, 47);
  q.lineTo(88, 90);
  q.closePath();
  q.moveTo(69, 66);
  q.lineTo(86, 37);
  q.lineTo(111, 89);
  q.stroke();
  q.font = 'bold 37px Georgia';
  q.fillStyle = '#514736';
  q.fillText('СОЛЬ', 133, 86);
  for (let i = 0; i < 9000; i++) {
    const x = meadowHash(i, 2, 7) * 320,
      y = meadowHash(i, 4, 3) * 144;
    q.fillStyle = i % 2 ? 'rgba(47,34,20,.10)' : 'rgba(250,230,195,.12)';
    q.fillRect(x, y, 0.8 + meadowHash(i, 1, 5) * 6, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, color: 0xc5b295, roughness: 0.97 });
}
// A closed pinna, with a convex hairy back and a darker, hollow front between the two lips.
function draughtEar(head, cow, side) {
  const ear = joint(
    head,
    cow ? 'ox-ear' : 'horse-ear',
    side * (cow ? 0.181 : 0.079),
    cow ? 0.145 : 0.279,
    cow ? -0.024 : 0.003,
  );
  const positions = [],
    colors = [],
    indices = [];
  const rows = 17,
    sides = 24;
  const hair = new THREE.Color(cow ? 0x995f44 : 0x84513d);
  const edge = new THREE.Color(cow ? 0xb78a69 : 0xad7956);
  const hollow = new THREE.Color(cow ? 0x936655 : 0x49342f);
  const tipColor = new THREE.Color(cow ? 0x75493c : 0x51352b);
  const shade = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const leaf = Math.sin(Math.PI * t) ** 0.8;
    const width = cow ? 0.034 * (1 - t) + 0.046 * leaf : 0.021 * (1 - t) + 0.03 * leaf * (1 - 0.46 * t);
    const thickness = (cow ? 0.018 : 0.025) * (1 - t) + (cow ? 0.019 : 0.027) * leaf;
    for (let j = 0; j < sides; j++) {
      const a = (j * Math.PI * 2) / sides,
        u = Math.cos(a),
        face = Math.sin(a);
      const x = cow ? 0.221 * t : 0.032 * t + 0.003 * leaf + width * u;
      const y = cow ? 0.036 * leaf - 0.036 * t + width * u : 0.201 * t - width * u * 0.17;
      const front = face > 0;
      // The lower half is tubular. The front opens into a cup and comes to a single narrow tip.
      const wall = front ? face * (1 - (cow ? 1.23 : 1.47) * leaf * face ** 2) : face;
      const z =
        (cow ? -0.06 : 0.033) * t +
        (cow ? 0 : 0.011) * leaf +
        thickness * (wall + (front ? 0.15 * (1 - face) : 0));
      positions.push(side * x, y, z);
      shade.copy(hair);
      if (front) shade.lerp(hollow, face * leaf).lerp(edge, 0.62 * (1 - face) * leaf);
      else shade.lerp(edge, 0.23 * leaf * Math.abs(u));
      shade.lerp(tipColor, THREE.MathUtils.smoothstep(t, 0.77, 1) * 0.87);
      colors.push(shade.r, shade.g, shade.b);
      if (!row) continue;
      const i = (row - 1) * sides + j,
        next = (row - 1) * sides + ((j + 1) % sides);
      if (row < rows) indices.push(i, i + sides, next + sides);
      indices.push(i, next + sides, next);
    }
  }
  // The transverse coordinate is vertical on an ox and horizontal on a horse.
  if (side < 0 !== cow) {
    for (let i = 0; i < indices.length; i += 3) [indices[i], indices[i + 2]] = [indices[i + 2], indices[i]];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const material = (draughtEar.material ||= new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
  }));
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  ear.add(mesh);
  ear.userData.side = side;
  ear.userData.restYaw = cow ? 0 : side * 0.38;
  return ear;
}
function draughtHorn(head, side) {
  const P = THREE.Vector3;
  const curve = new THREE.CatmullRomCurve3([
    new P(side * 0.167, 0.215, -0.005),
    new P(side * 0.235, 0.254, -0.015),
    new P(side * 0.329, 0.286, -0.041),
    new P(side * 0.404, 0.345, -0.081),
    new P(side * 0.433, 0.429, -0.127),
  ]);
  const pos = [],
    colors = [],
    ix = [],
    length = 29,
    segments = 14;
  const pale = new THREE.Color(0xc5a477),
    root = new THREE.Color(0x735940),
    tip = new THREE.Color(0x453a31),
    col = new THREE.Color();
  for (let i = 0; i <= length; i++) {
    const t = i / length,
      center = curve.getPointAt(t),
      axis = curve.getTangentAt(t).normalize();
    const lateral = new P().crossVectors(axis, new P(0, 0, 1)).normalize(),
      depth = new P().crossVectors(axis, lateral);
    const radius = 0.068 * (1 - t) ** 0.82 * (1 + 0.055 * Math.sin(t * 118) * Math.exp(-t * 3)) + 0.001;
    col
      .copy(root)
      .lerp(pale, THREE.MathUtils.smoothstep(t, 0, 0.32))
      .lerp(tip, THREE.MathUtils.smoothstep(t, 0.64, 1));
    col.multiplyScalar(1 - 0.1 * (0.5 + 0.5 * Math.sin(t * 118)) * Math.exp(-t * 2.9));
    for (let j = 0; j < segments; j++) {
      const angle = (j * 2 * Math.PI) / segments;
      const v = center
        .clone()
        .addScaledVector(lateral, radius * Math.cos(angle))
        .addScaledVector(depth, radius * 0.85 * Math.sin(angle));
      pos.push(v.x, v.y, v.z);
      colors.push(col.r, col.g, col.b);
      if (i) {
        const a = (i - 1) * segments + j,
          b = (i - 1) * segments + ((j + 1) % segments);
        ix.push(a, b, b + segments, a, b + segments, a + segments);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  const skin = (draughtHorn.material ||= new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    side: THREE.DoubleSide,
  }));
  const horn = new THREE.Mesh(g, skin);
  horn.name = 'ox-horn';
  horn.castShadow = true;
  head.add(horn);
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
    if (cow) s.oval(hide, 0, 1.44, 0.78, 0.175, 0.27, 0.196, -0.28);
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
        s.taper(k < 3 ? 0x584a36 : 0x624535, belt[k - 1], belt[k], 0.058, 0.055);
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
      s.oval(0x837a66, side * 0.373, 1.47, 0.78, 0.036, 0.04, 0.032);
    }
    if (cow) {
      s.taper(0x927751, [0, 1.3, 0.989], [0, 1.185, 1.01], 0.049, 0.078);
      s.oval(0x53412b, 0, 1.177, 1.01, 0.035, 0.022, 0.036);
    }
  });
  const neck = cow
    ? [
        [1.29, 0.301, 0.305, 0.48],
        [1.42, 0.318, 0.3, 0.58],
        [1.54, 0.276, 0.277, 0.67],
        [1.66, 0.226, 0.208, 0.765],
        [1.79, 0.201, 0.162, 0.823],
        [1.86, 0.151, 0.117, 0.857],
      ]
    : [
        [1.32, 0.329, 0.35, 0.45],
        [1.48, 0.313, 0.355, 0.5],
        [1.67, 0.269, 0.34, 0.577],
        [1.85, 0.223, 0.294, 0.661],
        [2.02, 0.165, 0.23, 0.769],
        [2.17, 0.132, 0.173, 0.832],
        [2.23, 0.084, 0.107, 0.851],
      ];
  tailored(
    body,
    'neck',
    interpolateSections(neck, 0.035),
    paintedSurface(cow ? 'hide-cow' : 'hide-horse', 0, 0.88),
    32,
  );
  if (!cow) {
    const crest = [
      [1.65, 0.041, 0.075, 0.3],
      [1.76, 0.053, 0.084, 0.343],
      [1.9, 0.052, 0.081, 0.399],
      [2.04, 0.05, 0.072, 0.52],
      [2.145, 0.041, 0.059, 0.664],
      [2.23, 0.03, 0.048, 0.773],
      [2.266, 0.01, 0.025, 0.835],
    ];
    tailored(
      body,
      'mane',
      interpolateSections(crest, 0.031),
      new THREE.MeshStandardMaterial({ color: 0x51362e, roughness: 0.93 }),
      16,
    );
  }
  const head = joint(body, 'head', 0, cow ? 1.71 : 2.02, 0.87);
  const muzzle = cow
    ? [
        [-0.293, 0.09, 0.076, 0.405],
        [-0.26, 0.168, 0.115, 0.432],
        [-0.2, 0.235, 0.137, 0.434],
        [-0.145, 0.239, 0.14, 0.428],
        [-0.08, 0.212, 0.169, 0.378],
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

  if (cow) for (const side of [-1, 1]) draughtHorn(head, side);
  carved(head, (s) => {
    if (!cow) {
      s.oval(mane, 0, 0.243, 0.047, 0.108, 0.069, 0.126, -0.33);
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
  const ears = [draughtEar(head, cow, -1), draughtEar(head, cow, 1)];
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
  rig.userData = { body, head, legs, tail, ears };
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
