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
  const rise = (v) => {
    const k = Math.max(0, Math.min(1, (v - 3) / 24));
    return k * k * (3 - 2 * k);
  };
  const plateau =
    14 * rise(x) * rise(z) * Math.min(1, Math.max(0, (145 - Math.max(Math.abs(x), Math.abs(z))) / 32));
  return plateau + t * (1.2 * Math.sin(x * 0.07) + 1.1 * Math.sin(z * 0.12) + 0.8 * Math.cos((x + z) * 0.06));
};
class RealmGeometry {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.6, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('view').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb2b5a5);
    this.scene.fog = new THREE.FogExp2(0xb4bdad, 0.0062);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.06, 430);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe8edff, 0x777c58, 1.5));
    const sun = new THREE.DirectionalLight(0xffda9e, 2.05);
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
    this.stone = new THREE.IcosahedronGeometry(1, 2);
    this.head = new THREE.SphereGeometry(1, 16, 12);
    this.log = new THREE.CylinderGeometry(1, 1, 1, 18);
    this.spire = new THREE.ConeGeometry(1, 1, 7);
    this.buckets = new Map();
    this.seed = 13777;
    this.obstacles = [];
    this.trees = [];
    this.actors = new Map();
    this.tmp = new THREE.Object3D();
    this.prepareMaterials();
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
    this.buckets
      .get(k)
      .items.push(this.matrix(x, y + (this.buildHeight || 0), z, w, h, d, ry, rz, rx).clone());
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
    this.refreshFrame = true;
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
      this.buildHeight = ground(x, z);
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
    this.buildHeight = 0;
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
        this.trees.push({ x, z, y: ground(x, z), h: 9 + this.rnd() * 13, a: this.rnd() * 6.2, near: null });
        this.bound(x, z, 0.58, 0.58);
      } else if (this.rnd() < 0.18) {
        const s = 0.55 + this.rnd() * 1.9;
        this.put(this.stone, 0x66685c, x, ground(x, z) + s * 0.22, z, s, s * 0.8, s * 1.2, this.rnd() * 6);
        this.bound(x, z, s * 1.25, s * 1.3);
      }
    }
    this.dressSettlements();
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
    this.atmosphere();
    this.makeRelics();
    this.makeWeather();
  }
  market(x, z) {
    for (const a of [-1, 1])
      for (const b of [-1, 1]) this.block(x + a * 1.75, 1.52, z + b, 0.13, 3.04, 0.13, 0x5a4434);
    for (let i = 0; i < 7; i++)
      this.block(x + (i - 3) * 0.56, 3.06, z, 0.58, 0.13, 2.7, i % 2 ? 0xd0bda0 : 0x934d39, 0, 0, -0.14);
    this.block(x, 0.85, z, 3.7, 1.25, 1.5, 0x826445);
    this.bound(x, z, 3.7, 1.5);
    for (let box = 0; box < 3; box++) {
      const cx = x - 1.17 + 1.11 * box;
      this.block(cx, 1.5, z, 0.99, 0.08, 0.76, 0x897454);
      for (const sign of [-1, 1]) {
        this.block(cx + sign * 0.49, 1.61, z, 0.06, 0.22, 0.8, 0x897454);
        this.block(cx, 1.6, z + sign * 0.37, 1, 0.19, 0.06, 0x897454);
      }
      for (let j = 0; j < 9; j++)
        this.put(
          this.head,
          [0x9e5437, 0x929654, 0xc4904c][box],
          cx + ((j % 3) - 1) * 0.25,
          1.66 + (j === 4 ? 0.12 : 0),
          z + (Math.floor(j / 3) - 1) * 0.21,
          0.135,
          0.122,
          0.13,
        );
    }
    this.block(x + 1.81, 2.34, z + 0.96, 0.62, 0.07, 0.09, 0x594431);
    this.block(x + 1.99, 2.09, z + 0.96, 0.042, 0.48, 0.04, 0x514f48);
    this.put(this.log, 0xad8e58, x + 1.99, 1.85, z + 0.96, 0.2, 0.05, 0.2);
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
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: 0xe9c18b }),
    );
    arrow.scale.y = 1.45;
    this.marker.add(arrow);
    this.scene.add(this.marker);
  }
  display(s, t, attackAnim, bob, target) {
    if (s.inside) {
      this.roomView(s, t, bob);
      return;
    }
    if (this.camera.parent !== this.scene) this.scene.add(this.camera);
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
        if (a.hp <= 0) m.userData.fellAt = t - 1;
        this.actors.set(a.id, m);
      }
      if (a.hp <= 0 && m.userData.fellAt == null) m.userData.fellAt = t;
      const fall = a.hp <= 0 ? Math.min(1, (t - m.userData.fellAt) * 3) : 0;
      m.position.set(
        a.x,
        ground(a.x, a.z) + fall * 0.24 + (a.walk && a.hp > 0 ? 0.034 * Math.abs(Math.sin(t * 8 + a.id)) : 0),
        a.z,
      );
      m.rotation.set(-Math.PI * 0.5 * fall, a.angle || 0, a.stagger > 0 ? 0.13 : 0, 'YXZ');
      m.userData.legs.forEach(
        (l, j) => (l.rotation.x = a.hp > 0 && a.walk ? Math.sin(t * 8 + j * Math.PI + a.id) * 0.45 : 0),
      );
      m.userData.arms[1].rotation.x =
        a.hp > 0 && a.windup > 0 ? -1.7 : a.hp > 0 && a.cd > 1.3 ? -0.95 : -0.09;
      m.userData.arms[0].rotation.x = a.walk ? Math.sin(t * 8 + a.id) * 0.22 : -0.12;
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
    this.animateDetails(s, t, attackAnim, bob);
    this.renderer.render(this.scene, c);
  }
  clearPeople() {
    for (const m of this.actors.values()) this.scene.remove(m);
    this.actors.clear();
  }
}
