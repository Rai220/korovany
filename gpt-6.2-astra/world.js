'use strict';
const CENTERS = [
  [-50, -50],
  [50, -50],
  [-50, 50],
  [50, 50],
];
const WORLD_LIMIT = 108;
const zoneAt = (x, z) => (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0);
const ground = (x, z) => {
  const d = Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50));
  const t = Math.min(1, Math.max(0, (d - 10) / 18));
  return t * (1.2 * Math.sin(x * 0.07) + 1.1 * Math.sin(z * 0.12) + 0.8 * Math.cos((x + z) * 0.06));
};
class Realm {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.6, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('view').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb2b5a5);
    this.scene.fog = new THREE.FogExp2(0xb2b5a5, 0.008);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.06, 430);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xfff0d4, 0x777e67, 2.0));
    const sun = new THREE.DirectionalLight(0xffe1b7, 2.4);
    sun.position.set(-70, 95, -45);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.055;
    sun.shadow.bias = -0.00035;
    this.matCache = new Map();
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.stone = new THREE.IcosahedronGeometry(1, 0);
    this.head = new THREE.SphereGeometry(1, 7, 5);
    this.log = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.spire = new THREE.ConeGeometry(1, 1, 7);
    this.buckets = new Map();
    this.seed = 13777;
    this.obstacles = [];
    this.trees = [];
    this.actors = new Map();
    this.tmp = new THREE.Object3D();
    this.build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  rnd() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  mat(c) {
    if (!this.matCache.has(c))
      this.matCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.94, flatShading: true }));
    return this.matCache.get(c);
  }
  matrix(x, y, z, w, h, d, ry = 0, rz = 0, rx = 0) {
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(rx, ry, rz);
    this.tmp.scale.set(w, h, d);
    this.tmp.updateMatrix();
    return this.tmp.matrix;
  }
  put(geo, c, x, y, z, w, h, d, ry = 0, rz = 0, rx = 0) {
    const k = geo.uuid + '/' + c;
    if (!this.buckets.has(k)) this.buckets.set(k, { geo, mat: this.mat(c), items: [] });
    this.buckets.get(k).items.push(this.matrix(x, y, z, w, h, d, ry, rz, rx).clone());
  }
  block(x, y, z, w, h, d, c, ry = 0, rz = 0, rx = 0) {
    this.put(this.box, c, x, y, z, w, h, d, ry, rz, rx);
  }
  part(group, geo, c, x, y, z, w, h, d, rz = 0) {
    const o = new THREE.Mesh(geo, this.mat(c));
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.rotation.z = rz;
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
    return o;
  }
  bound(x, z, w, d) {
    this.obstacles.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
  }
  free(x, z, r = 0.34) {
    return (
      Math.abs(x) < WORLD_LIMIT &&
      Math.abs(z) < WORLD_LIMIT &&
      !this.obstacles.some((b) => x > b[0] - r && x < b[1] + r && z > b[2] - r && z < b[3] + r)
    );
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  build() {
    this.terrain();
    this.sky();
    for (let i = 0; i < 4; i++) {
      const [x, z] = CENTERS[i];
      this.market(x - 6, z + 4);
      if (i === 0 || i === 2) {
        [
          [-12, -9],
          [9, -11],
          [15, 7],
          [-13, 11],
        ].forEach(([a, b], j) => this.house(x + a, z + b, j, i === 2));
      } else this.castle(x + 18, z, i === 3);
    }
    for (let i = 0; i < 1100; i++) {
      const x = this.rnd() * 224 - 112,
        z = this.rnd() * 224 - 112;
      const q = zoneAt(x, z);
      if (
        Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50)) < 3.5 ||
        CENTERS.some(([a, b]) => Math.hypot(x - a, z - b) < (q === 2 ? 18 : 23))
      )
        continue;
      if (q === 2 || this.rnd() < 0.15) {
        this.trees.push({ x, z, y: ground(x, z), h: 5 + this.rnd() * 7, a: this.rnd() * 6.2, near: null });
        this.bound(x, z, 0.58, 0.58);
      } else if (this.rnd() < 0.18) {
        const s = 0.55 + this.rnd() * 1.9;
        this.put(this.stone, 0x66685c, x, ground(x, z) + s * 0.22, z, s, s * 0.8, s * 1.2, this.rnd() * 6);
        this.bound(x, z, s * 1.25, s * 1.3);
      }
    }
    for (let i = 0; i < 2400; i++) {
      const x = this.rnd() * 212 - 106,
        z = this.rnd() * 212 - 106;
      if (Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50)) < 3 || !this.free(x, z)) continue;
      this.put(
        this.spire,
        i % 3 === 0 ? 0x69704b : 0x555f40,
        x,
        ground(x, z) + 0.18,
        z,
        0.18,
        0.37 + this.rnd() * 0.47,
        0.13,
        this.rnd() * 3,
        0.22,
      );
    }
    for (let i = 0; i < 76; i++) {
      const a = i * 0.083,
        r = 148 + this.rnd() * 54,
        h = (a < 1.65 ? 45 : 20) + this.rnd() * 34;
      this.put(
        this.spire,
        i % 3 === 0 ? 0x777e77 : 0x656d66,
        Math.cos(a) * r,
        h * 0.36,
        Math.sin(a) * r,
        17 + this.rnd() * 27,
        h,
        24,
        this.rnd() * 4,
      );
    }
    for (const b of this.buckets.values()) {
      const m = new THREE.InstancedMesh(b.geo, b.mat, b.items.length);
      b.items.forEach((v, i) => m.setMatrixAt(i, v));
      m.computeBoundingSphere();
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
    this.buckets.clear();
    this.treeMeshes();
    this.makeWagon();
    this.makeWeapon();
    this.makeChair();
    this.makeMarker();
  }
  sky() {
    const geo = new THREE.SphereGeometry(360, 36, 20),
      mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader:
          'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec3 p;
  float hash(vec2 a){return fract(sin(dot(a,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  void main(){vec3 d=normalize(p);float h=max(.0,d.y);vec3 base=mix(vec3(.72,.74,.67),vec3(.36,.47,.50),pow(h,.65));vec2 uv=d.xz/(h+.08)*2.;float n=noise(uv)*.55+noise(uv*2.2)*.31+noise(uv*5.)*.14;base=mix(base,vec3(.87,.84,.74),smoothstep(.47,.76,n)*min(h*7.,1.)*.7);float s=dot(d,normalize(vec3(-.6,.43,-.5)));base+=vec3(.22,.17,.09)*pow(max(0.,s),26.);gl_FragColor=vec4(base,1.);}`,
      });
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.skyMesh);
  }
  terrain() {
    const g = new THREE.PlaneGeometry(270, 270, 135, 135);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    let colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      p.setY(i, ground(x, z));
      const road = Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50)) < 2.8;
      const c = new THREE.Color(road ? 0x998768 : [0x758058, 0x89866a, 0x576742, 0x76766b][zoneAt(x, z)]);
      c.multiplyScalar(0.87 + this.rnd() * 0.22 + 0.07 * Math.sin(x * 0.5 + z * 0.24));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const texCanvas = document.createElement('canvas');
    texCanvas.width = texCanvas.height = 256;
    const ctx = texCanvas.getContext('2d');
    ctx.fillStyle = '#c2c1b1';
    ctx.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 16500; j++) {
      const x = this.rnd() * 256,
        y = this.rnd() * 256;
      ctx.fillStyle = j % 3 ? 'rgba(62,65,49,.18)' : 'rgba(244,239,209,.4)';
      ctx.fillRect(x, y, 0.65 + this.rnd() * 2.3, 0.75 + this.rnd() * 1.3);
    }
    for (let j = 0; j < 60; j++) {
      const x = this.rnd() * 256,
        y = this.rnd() * 256;
      ctx.fillStyle = 'rgba(90,85,64,.36)';
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + this.rnd() * 2.9, 1.2, this.rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const grain = new THREE.CanvasTexture(texCanvas);
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.repeat.set(58, 58);
    grain.anisotropy = 4;
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ map: grain, vertexColors: true, flatShading: true, roughness: 1 }),
    );
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }
  house(x, z, j, forest) {
    const wood = forest ? 0x594431 : 0x534432;
    this.block(x, 1.65, z, 5, 3.3, 4.5, forest ? 0x897454 : 0xc4b494);
    this.bound(x, z, 5, 4.5);
    for (const a of [-1, 1]) {
      this.block(x + a * 1.44, 4, z, 3.45, 0.27, 5.3, forest ? 0x4d5948 : 0x654e3b, 0, -a * 0.57);
      for (const b of [-1, 1]) this.block(x + a * 2.46, 1.62, z + b * 2.22, 0.2, 3.3, 0.2, wood);
    }
    this.put(this.spire, 0x967856, x, 3.25, z, 2.8, 2.35, 2.65, Math.PI / 4);
    this.block(x - 0.55, 1.02, z + 2.27, 1.18, 2.04, 0.13, wood);
    this.block(x + 1.2, 1.8, z + 2.28, 0.89, 0.83, 0.16, 0x40483e);
    for (let i = 0; i < 4; i++) this.block(x, i * 0.8 + 0.3, z + 2.27, 5.05, 0.09, 0.08, wood);
    for (let j = 0; j < 6; j++) {
      const z1 = z - 2.08 + j * 0.81;
      for (const a of [-1, 1])
        this.block(x + a * 1.45, 4.16, z1, 3.55, 0.12, 0.075, forest ? 0x4a4b3d : 0x4a4236, 0, -a * 0.57);
    }
    for (const a of [-1, 1]) {
      this.block(x + a * 2.51, 1.68, z, 0.16, 0.17, 4.55, wood);
      this.block(x + a * 2.51, 1.8, z + 1.2, 0.1, 2.7, 0.13, wood, 0, 0, 0.54);
      this.block(x + a * 2.51, 1.18, z - 0.8, 0.09, 1.65, 1.05, 0x5b5946);
    }
    this.block(x + 1.65, 4.28, z - 1.2, 0.63, 2, 0.72, 0x716e60);
    if (!forest) this.block(x - 1.2, 2, z + 2.33, 0.14, 3.2, 0.18, wood, 0, 0.44);
  }
  market(x, z) {
    for (const a of [-1, 1])
      for (const b of [-1, 1]) this.block(x + a * 1.75, 1.52, z + b, 0.13, 3.04, 0.13, 0x5a4434);
    for (let i = 0; i < 7; i++)
      this.block(x + (i - 3) * 0.56, 3.06, z, 0.58, 0.13, 2.7, i % 2 ? 0xd0bda0 : 0x934d39, 0, 0, -0.14);
    this.block(x, 0.85, z, 3.7, 1.25, 1.5, 0x826445);
    this.bound(x, z, 3.7, 1.5);
    for (let j = 0; j < 5; j++)
      this.put(this.head, j % 2 ? 0xad8651 : 0x6b7148, x - 1.15 + j * 0.56, 1.61, z, 0.27, 0.19, 0.23);
  }
  castle(x, z, dark) {
    const color = dark ? 0x585956 : 0x969384,
      roof = dark ? 0x43494a : 0x545e61;
    const tower = (a, b, r, h) => {
      this.put(this.log, color, a, h / 2, b, r, h, r);
      this.bound(a, b, r * 1.5, r * 1.5);
      this.put(this.log, color, a, h - 0.3, b, r * 1.14, 0.9, r * 1.14);
      if (dark) this.put(this.spire, roof, a, h + 1.7, b, r * 1.27, 4, r * 1.27);
      else
        for (let j = 0; j < 8; j++)
          this.block(
            a + Math.sin(j * 0.785) * r,
            h + 0.36,
            b + Math.cos(j * 0.785) * r,
            0.64,
            0.78,
            0.64,
            color,
          );
      this.block(a, h * 0.7, b + r * 0.94, 0.42, 1.35, 0.13, 0x3a3d37);
    };
    for (const a of [-12, 12]) {
      tower(x + a, z - 15, 2.55, 8);
      tower(x + a, z - 5, 1.85, 6);
      this.block(x + a, 2.4, z - 10, 0.95, 4.8, 10, color);
      this.bound(x + a, z - 10, 0.95, 10);
    }
    this.block(x, 2.9, z - 15, 24, 5.8, 1, color);
    this.bound(x, z - 15, 24, 1);
    for (let j = -11; j < 12; j += 2) this.block(x + j, 6.15, z - 15, 0.95, 0.85, 1, color);
    this.block(x, 4.3, z - 19, 9, 8.6, 7, color);
    this.bound(x, z - 19, 9, 7);
    this.put(this.spire, roof, x, 10.1, z - 19, 6.1, 4.5, 5, 0.7);
    for (const a of [-1, 1]) {
      this.block(x + a * 7.8, 2.3, z - 5, 7.6, 4.6, 0.96, color);
      this.bound(x + a * 7.8, z - 5, 7.6, 0.96);
      this.block(x + a * 4, 3, z - 5, 1.8, 6, 1.8, color);
      this.block(x + a * 4, 4.3, z - 3.97, 0.85, 2.1, 0.1, dark ? 0x4c2a29 : 0x873f31);
    }
    this.block(x, 5.4, z - 5, 8, 1.1, 1.3, color);
    this.block(x - 3.8, 7.3, z - 5, 0.1, 3, 0.1, 0x665644);
    this.block(x - 3.12, 8.2, z - 5, 1.3, 0.75, 0.07, dark ? 0x453941 : 0x974b38);
  }
  treeMeshes() {
    const n = this.trees.length;
    this.trunks = new THREE.InstancedMesh(this.log, this.mat(0x534936), n);
    this.foliage = [];
    for (let j = 0; j < 4; j++) {
      const verts = [],
        cols = [];
      const sw = [0x314638, 0x3d5240, 0x425944, 0x4d604a][j];
      const col = new THREE.Color(sw);
      for (let k = 0; k < 13; k++) {
        const a = (k * Math.PI * 2) / 13,
          b = ((k + 1) * Math.PI * 2) / 13;
        const rad = k % 2 ? 0.83 : 1.06,
          nrad = (k + 1) % 2 ? 0.83 : 1.06;
        verts.push(
          0,
          1,
          0,
          Math.cos(b) * nrad,
          0.04 * Math.sin(b * 3),
          Math.sin(b) * nrad,
          Math.cos(a) * rad,
          0.04 * Math.sin(a * 3),
          Math.sin(a) * rad,
        );
        for (let v = 0; v < 3; v++) {
          const d = v === 0 ? 1.18 : 0.84;
          cols.push(col.r * d, col.g * d, col.b * d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      const m = new THREE.InstancedMesh(
        g,
        new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }),
        n,
      );
      m.castShadow = true;
      m.receiveShadow = true;
      this.foliage.push(m);
      this.scene.add(m);
    }
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#514b3d';
    ctx.fillRect(45, 95, 7, 97);
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = ['#364a3c', '#3c5040', '#405644', '#485b47', '#52624c'][j];
      const y = 170 - j * 24,
        w = 44 - j * 6;
      ctx.beginPath();
      ctx.moveTo(48, y - 70 + j * 5);
      for (let k = 0; k <= 12; k++) ctx.lineTo(48 + w - (k * w) / 6, y - (k % 2) * 9 - Math.abs(k - 6));
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.far = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide }),
      n,
    );
    this.trunks.castShadow = true;
    this.scene.add(this.trunks, this.far);
    for (const m of [this.trunks, ...this.foliage, this.far]) m.frustumCulled = false;
  }
  lod(px, pz) {
    this.sun.position.set(px - 28, 47, pz - 23);
    this.sun.target.position.set(px, 0, pz);
    this.renderer.shadowMap.needsUpdate = true;
    const off = new THREE.Matrix4().makeScale(0, 0, 0);
    this.trees.forEach((t, i) => {
      const near = Math.hypot(px - t.x, pz - t.z) < 39;
      if (t.near !== near) {
        this.trunks.setMatrixAt(
          i,
          near ? this.matrix(t.x, t.y + t.h * 0.27, t.z, 0.19, t.h * 0.54, 0.19) : off,
        );
        this.foliage.forEach((m, j) => {
          const r = t.h * (0.246 - j * 0.04);
          m.setMatrixAt(
            i,
            near
              ? this.matrix(
                  t.x,
                  t.y + t.h * (0.17 + j * 0.16),
                  t.z,
                  r,
                  t.h * (0.45 - j * 0.034),
                  r,
                  t.a + j * 0.6,
                )
              : off,
          );
        });
        t.near = near;
      }
      this.far.setMatrixAt(
        i,
        near
          ? off
          : this.matrix(t.x, t.y + t.h * 0.5, t.z, t.h * 0.53, t.h, 1, Math.atan2(px - t.x, pz - t.z)),
      );
    });
    for (const m of [this.trunks, ...this.foliage, this.far]) m.instanceMatrix.needsUpdate = true;
  }
  makeWagon() {
    const g = new THREE.Group();
    this.wagon = g;
    this.scene.add(g);
    const box = (...args) => this.part(g, this.box, ...args);
    box(0x785537, 0, 1.05, 0, 2.1, 0.5, 3.2);
    box(0x87704d, 0, 1.5, 0, 2, 0.65, 3.1);
    this.part(
      g,
      new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      0xd5c9aa,
      0,
      1.8,
      0,
      1.19,
      1.03,
      1.95,
    );
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const wheel = this.part(g, this.log, 0x4a4035, a * 1.08, 0.66, b * 1.08, 0.65, 0.2, 0.65);
        wheel.rotation.z = Math.PI / 2;
        box(0x967957, a * 1.2, 0.66, b * 1.08, 0.05, 0.12, 0.96);
      }
    for (const a of [-1, 1]) box(0x795f42, a * 0.6, 0.92, 2.16, 0.11, 0.14, 2.3);
    this.part(g, this.head, 0x68513d, 0, 1.24, 3.65, 0.53, 0.64, 1.04);
    box(0x574332, 0, 1.91, 4.25, 0.43, 1, 0.46, -0.12);
    box(0x756049, 0, 2.35, 4.59, 0.45, 0.44, 0.82);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) box(0x4d4033, a * 0.28, 0.59, 3.65 + b * 0.6, 0.14, 1.12, 0.17);
  }
  person(kind) {
    const g = new THREE.Group(),
      c =
        {
          elf: 0x536747,
          guard: 0x8e5043,
          lord: 0x514857,
          spy: 0x575547,
          merchant: 0x927650,
          commander: 0x9e7943,
          escort: 0x6c6657,
        }[kind] || 0x676050;
    const part = (geo, color, x, y, z, w, h, d, rz) => this.part(g, geo, color, x, y, z, w, h, d, rz);
    const legs = [-1, 1].map((a) => {
      const pivot = new THREE.Group();
      pivot.position.set(a * 0.18, 0.95, 0);
      g.add(pivot);
      this.part(pivot, this.box, 0x554d3c, 0, -0.38, 0, 0.25, 0.76, 0.27);
      this.part(pivot, this.box, 0x453c31, 0, -0.76, 0.05, 0.28, 0.32, 0.37);
      return pivot;
    });
    part(this.log, c, 0, 1.42, 0, 0.46, 0.98, 0.31);
    part(this.log, 0x543e2e, 0, 1.09, 0, 0.46, 0.13, 0.32);
    part(this.box, 0xb49b65, 0, 1.1, 0.31, 0.15, 0.12, 0.04);
    part(this.head, 0xbf9e77, 0, 2.16, 0.016, 0.29, 0.37, 0.27);
    part(this.box, 0x594d41, 0, 2.18, 0.252, 0.37, 0.048, 0.05);
    part(this.head, 0xb69670, 0, 2.11, 0.273, 0.052, 0.07, 0.066);
    part(this.box, 0x8c7054, 0, 2.015, 0.239, 0.12, 0.026, 0.024);
    part(this.head, kind === 'elf' ? 0x45583d : 0x6d7067, 0, 2.35, -0.026, 0.34, 0.23, 0.31);
    if (kind === 'elf' || kind === 'lord') part(this.spire, c, 0, 2.57, -0.04, 0.3, 0.5, 0.27, -0.18);
    const arms = [-1, 1].map((a) => {
      const pivot = new THREE.Group();
      pivot.position.set(a * 0.44, 1.76, 0);
      g.add(pivot);
      this.part(pivot, this.head, c, 0, 0, 0, 0.24, 0.21, 0.24);
      this.part(pivot, this.box, 0x706451, 0, -0.32, 0.05, 0.19, 0.58, 0.21);
      this.part(pivot, this.head, 0xa98a66, 0, -0.62, 0.08, 0.13, 0.13, 0.12);
      return pivot;
    });
    if (kind !== 'merchant') {
      this.part(arms[1], this.box, 0xc2c5b6, 0, -0.56, 0.52, 0.09, 0.09, 0.98);
      this.part(arms[1], this.box, 0xad956e, 0, -0.56, 0.18, 0.35, 0.1, 0.09);
      this.part(arms[0], this.head, c, 0, -0.31, 0.14, 0.32, 0.47, 0.13);
    }
    g.userData = { legs, arms };
    this.scene.add(g);
    return g;
  }
  makeWeapon() {
    this.weapon = new THREE.Group();
    this.camera.add(this.weapon);
    const blade = new THREE.CylinderGeometry(0.015, 0.074, 0.85, 4);
    this.part(this.weapon, blade, 0xc1c5b9, 0, 0.5, 0, 1, 1, 1);
    this.part(this.weapon, this.box, 0xa58c60, 0, 0.055, 0, 0.32, 0.047, 0.07);
    this.part(this.weapon, this.log, 0x5f4734, 0, -0.085, 0, 0.045, 0.23, 0.045);
    this.part(this.weapon, this.head, 0x796450, 0, -0.12, 0.02, 0.1, 0.105, 0.11);
    for (const a of [-1, 1]) {
      this.part(this.weapon, this.box, 0xb49a64, a * 0.17, 0.067, 0, 0.085, 0.052, 0.072, a * 0.42);
      this.part(this.weapon, this.head, 0x77684a, a * 0.2, 0.084, 0, 0.032, 0.035, 0.043);
    }
    const fuller = this.part(this.weapon, this.box, 0x849095, 0, 0.45, 0.044, 0.018, 0.67, 0.006);
    fuller.rotation.x = -0.04;
    for (let j = 0; j < 4; j++)
      this.part(this.weapon, this.box, 0x665140, -0.025, -0.077 - j * 0.032, 0.098, 0.13, 0.024, 0.043, 0.15);
    this.weapon.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }
  makeChair() {
    const chair = new THREE.Group();
    this.scene.add(chair);
    this.chair = chair;
    const rim = new THREE.TorusGeometry(0.43, 0.045, 6, 16);
    this.wheels = [-1, 1].map((side) => {
      const wheel = new THREE.Group();
      wheel.position.set(0.46 * side, 0.47, 0);
      const ring = this.part(wheel, rim, 0x514b3c, 0, 0, 0, 1, 1, 1);
      ring.rotation.y = Math.PI / 2;
      for (let j = 0; j < 5; j++) {
        const spoke = this.part(wheel, this.box, 0x967d54, 0, 0, 0, 0.045, 0.8, 0.045);
        spoke.rotation.x = (j * Math.PI) / 5;
      }
      chair.add(wheel);
      this.part(chair, this.box, 0x745637, 0.42 * side, 0.77, -0.1, 0.09, 0.09, 0.72);
      this.part(chair, this.box, 0x67523c, 0.26 * side, 0.24, -0.48, 0.32, 0.07, 0.29);
      return wheel;
    });
    this.part(chair, this.box, 0x594a37, 0, 0.52, 0, 0.78, 0.13, 0.63);
    this.part(chair, this.box, 0x594a37, 0, 0.77, 0.29, 0.78, 0.52, 0.12);
  }
  makeMarker() {
    this.marker = new THREE.Group();
    const arrow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshBasicMaterial({ color: 0xe9c18b }),
    );
    arrow.scale.y = 1.55;
    this.marker.add(arrow);
    this.scene.add(this.marker);
  }
  display(s, t, attackAnim, bob, target) {
    const c = this.camera;
    c.position.set(
      s.x,
      ground(s.x, s.z) + (s.leg === 'lost' ? 0.78 : s.leg === 'chair' ? 1.32 : 1.93) + s.air + bob,
      s.z,
    );
    c.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    this.skyMesh.position.copy(c.position);
    const swing = Math.sin(attackAnim * Math.PI);
    this.weapon.position.set(0.38 - swing * 0.29, -0.42 + swing * 0.08, -0.65 - swing * 0.32);
    this.weapon.rotation.set(-0.54 - swing * 0.95, 0.05, -0.32 + swing * 0.95);
    if (s.arm === 'lost') {
      this.weapon.position.x *= -1;
      this.weapon.rotation.z *= -1;
    }
    this.weapon.visible = s.health > 0;
    this.chair.visible = s.leg === 'chair';
    if (this.chair.visible) {
      this.chair.position.set(s.x, ground(s.x, s.z), s.z);
      this.chair.rotation.y = s.yaw;
      this.wheels.forEach((w) => (w.rotation.x = (s.x + s.z) / 0.43));
    }
    s.actors.forEach((a) => {
      let m = this.actors.get(a.id);
      if (!m) {
        m = this.person(a.kind);
        this.actors.set(a.id, m);
      }
      m.position.set(a.x, ground(a.x, a.z) + (a.hp <= 0 ? 0.29 : 0), a.z);
      m.rotation.set(a.hp <= 0 ? -Math.PI * 0.5 : 0, a.angle || 0, 0, 'YXZ');
      m.userData.legs.forEach(
        (l, j) => (l.rotation.x = a.hp > 0 && a.walk ? Math.sin(t * 8 + j * Math.PI + a.id) * 0.45 : 0),
      );
      m.userData.arms[1].rotation.x = a.hp > 0 && a.cd > 0.88 ? -1.2 : -0.1;
    });
    for (const [id, m] of this.actors)
      if (!s.actors.some((a) => a.id === id)) {
        this.scene.remove(m);
        this.actors.delete(id);
      }
    const w = s.wagon;
    this.wagon.position.set(w.x, ground(w.x, w.z), w.z);
    this.wagon.rotation.y = w.angle;
    this.marker.visible = !!target;
    if (target) {
      this.marker.position.set(target.x, ground(target.x, target.z) + 3.8 + 0.18 * Math.sin(t * 2), target.z);
      this.marker.rotation.y = t;
    }
    this.renderer.render(this.scene, c);
  }
  clearPeople() {
    for (const m of this.actors.values()) this.scene.remove(m);
    this.actors.clear();
  }
}
