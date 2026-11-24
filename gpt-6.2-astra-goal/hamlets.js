'use strict';

class Borderlands extends FrontierLandscape {
  panel(name, x, y, z, w, h, angle = 0) {
    this.wallArt ||= new Map();
    if (!this.wallArt.has(name))
      this.wallArt.set(name, new THREE.MeshStandardMaterial({ map: texture(name), roughness: 0.95 }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.wallArt.get(name));
    mesh.position.set(x, y + (this.buildHeight || 0), z);
    mesh.rotation.y = angle;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }
  house(x, z, j, forest) {
    const wallH = 3.32,
      zSpan = 4.8;
    this.block(x, wallH / 2, z, 5, wallH, zSpan, forest ? 0x897454 : 0xc4b494);
    this.bound(x, z, 5, zSpan);
    for (const side of [-1, 1]) {
      this.panel(
        forest ? 'cabin-side' : 'inn-side',
        x + side * 2.506,
        1.68,
        z,
        4.8,
        3.26,
        (side * Math.PI) / 2,
      );
      this.panel(forest ? 'cabin' : 'inn', x, 1.68, z + side * 2.406, 5, 3.26, side > 0 ? 0 : Math.PI);
      this.block(x + side * 1.38, 4.1, z, 3.54, 0.19, 5.64, 0x4d5948, 0, -side * 0.603);
      this.block(x + side * 2.81, 3.13, z, 0.13, 0.19, 5.77, 0x534432);
      for (const front of [-1, 1])
        this.block(x + side * 1.39, 4.08, z + front * 2.82, 3.56, 0.15, 0.13, 0x594431, 0, -side * 0.603);
    }
    const gable = geometry([-2.5, 0, 0, 2.5, 0, 0, 0, 1.76, 0], [0, 0, 1, 0, 0.5, 1], [0, 1, 2]);
    const material = this.mat(0x897454);
    for (const end of [-1, 1]) {
      const face = new THREE.Mesh(gable, material);
      face.position.set(x, 3.27, z + end * 2.4);
      face.rotation.y = end < 0 ? Math.PI : 0;
      face.castShadow = true;
      this.scene.add(face);
    }
    for (let j = 0; j < 5; j++) this.block(x, 4.91, z - 2.23 + j * 1.09, 0.22, 0.13, 1.12, 0x594431);
    this.block(x + 1.45, 4.28, z - 1.2, 0.67, 2.43, 0.71, 0x716e60);
    this.block(x + 1.45, 5.53, z - 1.2, 0.81, 0.22, 0.84, 0x969384);
    if (j % 2 === 0) this.fence(x - 3.22, z - 0.5, 3.7, Math.PI / 2);
    this.smokeVents ||= [];
    this.smokeVents.push([x + 1.45, 5.7, z - 1.2]);
  }
  fence(x, z, length, yaw) {
    const n = Math.ceil(length / 2),
      dx = Math.cos(yaw),
      dz = -Math.sin(yaw);
    this.bound(
      x + (dx * length) / 2,
      z + (dz * length) / 2,
      Math.abs(dx) * length + 0.14,
      Math.abs(dz) * length + 0.14,
    );
    for (let j = 0; j <= n; j++)
      this.block(
        x + (dx * j * length) / n,
        0.6,
        z + (dz * j * length) / n,
        0.135,
        1.2,
        0.14,
        0x594431,
        yaw,
        Math.sin(j) * 0.03,
      );
    for (const h of [0.43, 0.91])
      this.block(x + (dx * length) / 2, h, z + (dz * length) / 2, length, 0.1, 0.1, 0x897454, yaw);
  }
  castle(x, z, dark) {
    super.castle(x, z, dark);
    const stone = dark ? 0x585956 : 0x969384;
    // A second curtain and a roofed hall rise in tiers behind the outer gate.
    this.block(x, 5.2, z - 22.6, 14.2, 10.4, 5.2, stone);
    this.block(x, 10.5, z - 22.6, 14.7, 0.66, 5.7, stone);
    for (const side of [-1, 1]) {
      this.block(x, 11.9, z - 22.6 + side * 1.52, 15.2, 0.34, 4.73, 0x43494a, 0, 0, side * 0.7);
      const tx = x + side * 6.8,
        tz = z - 23.8,
        th = dark ? 13 : 16;
      this.put(this.log, stone, tx, th / 2, tz, 1.7, th, 1.7);
      this.put(this.log, stone, tx, th - 0.18, tz, 2.02, 0.85, 2.02);
      this.put(this.spire, 0x43494a, tx, th + 2.45, tz, 2.32, 5.3, 2.32);
      this.block(tx, th + 5.65, tz, 0.065, 1.9, 0.065, 0x665644);
      this.banner(tx + 0.64, th + 6.05, tz, 1.28, 0.72, dark);
      for (let j = 0; j < 3; j++) this.panel('window', tx, 3.6 + j * 3.2, tz + 1.68, 0.83, 1.8);
      for (let i = 0; i < 5; i++) {
        const off = side * (4.8 + i * 1.4);
        this.block(x + off, 4.83, z - 5, 0.69, 0.68, 1.13, stone);
      }
      this.banner(x + side * 4, 4.01, z - 3.95, 1.26, 2.7, dark);
      this.block(x + side * 3.98, 5.43, z - 3.89, 1.48, 0.11, 0.1, 0x594431);
    }
    for (let j = 0; j < 6; j++) this.panel('window', x - 5.75 + j * 2.28, 7.73, z - 19.93, 1.13, 2.2);
    this.panel('gate', x, 2.61, z - 14.46, 4.0, 5.21);
    for (let i = 0; i < 8; i++) this.block(x - 3.45 + i * 0.98, 5.65, z - 5.06, 0.12, 1.16, 0.14, 0x594431);
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2;
        this.panel(
          'window',
          x + side * 12 + Math.sin(a) * 2.54,
          5.7,
          z - 15 + Math.cos(a) * 2.54,
          1.05,
          1.6,
          a,
        );
      }
    const y = this.buildHeight || 0;
    this.smokeVents ||= [];
    this.smokeVents.push([x + 2, 13 + y, z - 21]);
  }
  banner(x, y, z, w, h, dark) {
    const mat = new THREE.MeshStandardMaterial({
      map: texture(dark ? 'standard-pine' : 'standard-sun'),
      color: dark ? 0x928383 : 0xf0ceae,
      roughness: 0.96,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(w, h, 8, 12),
      mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + (this.buildHeight || 0), z);
    mesh.receiveShadow = true;
    this.flags ||= [];
    this.flags.push({ mesh, h });
    this.scene.add(mesh);
  }
  landmarks() {
    this.panel('gate', -73, 1.3, -55.89, 1.68, 2.62);
    this.lookout();
    this.fence(-68, -31, 13, 0);
    this.fence(-68, -31, 9, -Math.PI / 2);
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 18; j++) {
        const x = -67 + i * 0.8,
          z = -30 + j * 0.53,
          y = ground(x, z),
          h = 0.84 + this.rnd() * 0.28;
        this.put(this.spire, 0xc68a38, x, y + h * 0.5, z, 0.086, h, 0.086, 0, 0, 0.09);
        this.put(this.head, 0xefba55, x + 0.035, y + h * 0.87, z, 0.083, 0.19, 0.073, 0, 0, -0.12);
      }
    // Leaning roadside signposts use Russian place names painted onto weathered boards.
    for (const [x, z, name, angle] of [
      [-46, 55, 'СОЛЯНОЙ МОСТ', 0.1],
      [-45, -54, 'МЕЛЬНИЦА', -0.3],
      [53, -46, 'ДВОРЕЦ', 0.22],
      [54, 54, 'СТАРЫЙ ФОРТ', -0.2],
    ]) {
      const y = ground(x, z);
      this.block(x, y + 1.18, z, 0.18, 2.36, 0.16, 0x594431);
      this.block(x, y + 2.0, z + 0.04, 1.98, 0.39, 0.12, 0x897454, angle);
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#dbc58d';
      ctx.font = 'bold 38px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(name, 256, 58);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.86, 0.35),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      m.position.set(x, y + 2.01, z + 0.17);
      m.rotation.y = angle;
      this.scene.add(m);
    }
  }
  lookout() {
    const z = 56;
    for (const x of [-59, -41]) {
      this.trees.push({ x, z: z - 2.5, y: 0, h: 25, a: x * 0.07, near: null });
      this.bound(x, z - 2.5, 0.81, 0.81);
      this.put(this.log, 0x534936, x, 5.54, z - 2.5, 0.48, 11.08, 0.48);
      for (let j = -4; j <= 4; j++) this.block(x + j * 0.46, 4.52, z, 0.45, 0.19, 3.7, 0x897454);
      for (const side of [-1, 1]) {
        this.block(x + side * 1.59, 2.2, z + 1.43, 0.24, 4.4, 0.24, 0x594431);
        this.block(x + side * 1.34, 3.83, z - 0.5, 0.26, 2.76, 0.22, 0x594431, 0, side * 0.65);
      }
      this.banner(x, 3.56, z + 1.89, 1.24, 1.62, true);
      this.lantern(x + 0.85, z + 1.93, 4.02);
    }
    const points = [[], []];
    for (let j = 0; j <= 35; j++) {
      const x = -57 + j * 0.4,
        y = watchHeight(x, 56);
      this.block(x, y - 0.08, z, 0.391, 0.16, 1.44, 0x897454);
      if (j % 5 === 0) {
        for (const sign of [-1, 1]) {
          this.block(x, y + 0.54, z + sign * 0.75, 0.1, 1.08, 0.1, 0x594431);
          points[sign > 0 ? 1 : 0].push(new THREE.Vector3(x, y + 1.08, z + sign * 0.75));
        }
      }
    }
    for (const path of points) {
      const rope = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 42, 0.036, 6, false);
      this.scene.add(new THREE.Mesh(rope, this.mat(0x897454)));
    }
    for (const dx of [-0.36, 0.36]) this.block(-59 + dx, 2.34, 57.94, 0.115, 4.67, 0.12, 0x594431);
    for (let j = 1; j < 13; j++) this.block(-59, j * 0.35, 57.95, 0.77, 0.085, 0.09, 0x897454);
  }
  makeRelics() {
    this.storyObjects = [];
    const add = (p, show) => {
      const g = new THREE.Group();
      g.position.set(p.x, ground(p.x, p.z), p.z);
      this.scene.add(g);
      this.storyObjects.push({ mesh: g, show, x: p.x, z: p.z });
      return g;
    };
    const herbs = add(herbBed, (s) => s.story.herbs !== 'gathered' && s.story.herbs !== 'done');
    this.part(herbs, this.stone, 0x716e60, 0.75, 0.45, 0.32, 0.47, 0.79, 0.46);
    for (let j = 0; j < 5; j++) {
      const x = Math.sin(j * 4) * 0.45,
        z = Math.cos(j * 4) * 0.44;
      this.part(herbs, this.log, 0x326746, x, 0.24, z, 0.025, 0.48, 0.025);
      for (let k = 0; k < 5; k++)
        this.part(
          herbs,
          this.head,
          0xc387ee,
          x + 0.09 * Math.sin(k * 1.256),
          0.5,
          z + 0.09 * Math.cos(k * 1.256),
          0.096,
          0.065,
          0.1,
        );
      this.part(herbs, this.head, 0xfbd452, x, 0.55, z, 0.07, 0.055, 0.07);
    }
    let g = add(places.bridge, (s) => s.story.phase !== 'done');
    const hub = this.part(g, new THREE.TorusGeometry(0.72, 0.095, 6, 24), 0x594431, 0, 0.48, 0, 1, 1, 1);
    hub.rotation.set(-0.65, 0.24, -0.26);
    for (let j = 0; j < 5; j++) {
      const beam = this.part(hub, this.box, 0x897454, 0, 0, 0, 0.11, 1.35, 0.1, j * 0.62);
      beam.castShadow = true;
    }
    this.part(g, this.box, 0x897454, 0.51, 0.12, 0.39, 0.83, 0.19, 0.93, -0.08);
    g = add(places.seal, (s) => !s.story.clues.includes('seal'));
    for (let j = 0; j < 8; j++) {
      const a = j * 0.785;
      this.part(g, this.stone, 0x716e60, Math.cos(a) * 0.54, 0.12, Math.sin(a) * 0.54, 0.24, 0.15, 0.17);
    }
    this.part(g, this.box, 0x594431, 0, 0.12, 0, 0.64, 0.1, 0.38, 0.12);
    this.part(g, this.log, 0xb9764d, 0.03, 0.23, 0.1, 0.13, 0.05, 0.13);
    g = add(places.rider, (s) => !s.story.aid && ['trail', 'choice'].includes(s.story.phase));
    const rider = this.person('spy');
    g.add(rider);
    rider.rotation.set(-1, 0.4, -0.31);
    rider.position.y = 0.2;
    g = add(places.cache, (s) => s.story.branch === 'iron');
    for (const dx of [-0.48, 0.48]) this.part(g, this.box, 0x897454, dx, 0.45, 0, 0.88, 0.9, 1.1);
    this.part(g, this.box, 0xa28a5d, 0.28, 0.96, 0, 0.3, 0.09, 0.12);
    g = add(places.fort, () => true);
    this.part(g, this.box, 0x897454, 0, 0.52, 0, 1.76, 1.04, 1.35);
    this.part(g, this.box, 0x594431, 0, 1.08, 0, 1.84, 0.16, 1.42);
    for (const dx of [-0.58, 0.58]) this.part(g, this.box, 0x615f52, dx, 0.59, 0.69, 0.09, 1.1, 0.03);
    this.sacks = add(
      { x: -54, z: 53 },
      (s) => s.story.branch === 'bread' && ['return', 'done'].includes(s.story.phase),
    );
    for (let j = 0; j < 6; j++)
      this.part(
        this.sacks,
        this.head,
        0xd5c9aa,
        (j % 3) * 0.56,
        0.27 + Math.floor(j / 3) * 0.33,
        Math.floor(j / 3) * 0.34,
        0.42,
        0.34,
        0.58,
      );
  }
  makeWeather() {
    const mask = document.createElement('canvas');
    mask.width = mask.height = 96;
    const ctx = mask.getContext('2d'),
      g = ctx.createRadialGradient(48, 48, 2, 48, 48, 46);
    g.addColorStop(0, 'rgba(255,255,255,.78)');
    g.addColorStop(0.47, 'rgba(255,255,255,.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    const tex = new THREE.CanvasTexture(mask);
    const smokeMat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xb9b6a2,
      opacity: 0.14,
      transparent: true,
      depthWrite: false,
    });
    this.smoke = [];
    for (const vent of this.smokeVents)
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Sprite(smokeMat);
        this.scene.add(m);
        this.smoke.push({ m, vent, offset: i / 4 + this.rnd() * 0.07 });
      }
    // Motes and angled light shafts share the soft mask; additive blending retains distant silhouettes.
    const rayMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.046,
      color: 0xffdd96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let j = 0; j < 18; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + this.rnd() * 2.7, 18 + this.rnd() * 7), rayMat);
      m.position.set(-70 + this.rnd() * 42, 7, 30 + this.rnd() * 40);
      m.rotation.z = -0.53;
      m.rotation.y = 0.23;
      this.scene.add(m);
    }
    const points = [];
    for (let j = 0; j < 230; j++) {
      const x = this.rnd() * 23 - 11.5,
        y = this.rnd() * 14 - 3,
        z = this.rnd() * 23 - 11.5;
      points.push(x, y, z, x + 0.025, y - 0.33, z);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.rain = new THREE.LineSegments(
      rainGeo,
      new THREE.LineBasicMaterial({ color: 0xc1d3d5, transparent: true, opacity: 0.29, depthWrite: false }),
    );
    this.scene.add(this.rain);
    this.storm = 0;
    this.weatherTick = 0;
  }
  updateAtmosphere(s, t) {
    const alpha =
      (1 - rimBlend(s.x, s.z)) *
      Math.min(1, Math.max(0, (s.x - 6) / 24)) *
      Math.min(1, Math.max(0, (s.z - 6) / 24));
    this.storm = alpha;
    this.scene.fog.density = 0.012 + alpha * 0.004;
    const colors = (this.weatherColors ||= [
      0xc7d3c5, 0xb5c9bd, 0xabb0c4, 0xffda9d, 0xd8d7ec, 0xd9e8ff, 0xb9c5dc,
    ].map((c) => new THREE.Color(c)));
    const forest =
      THREE.MathUtils.smoothstep(-s.x, 0, 38) *
      THREE.MathUtils.smoothstep(s.z, 0, 37) *
      (1 - rimBlend(s.x, s.z));
    this.scene.fog.color.copy(colors[0]).lerp(colors[1], forest).lerp(colors[2], alpha);
    this.sun.intensity = 2.25 - alpha * 1.37 - forest * 0.14;
    this.sun.color.copy(colors[3]).lerp(colors[4], alpha);
    this.skylight.color.copy(colors[5]).lerp(colors[6], alpha);
    this.skylight.intensity = 1.28 + alpha * 0.22;
    this.skyMesh.material.color.setRGB(1 - alpha * 0.39, 0.97 - alpha * 0.29, 0.89 - alpha * 0.13);
    this.rain.visible = alpha > 0.16;
    this.rain.position.set(s.x, ground(s.x, s.z) + 4 - ((t * 7) % 4), s.z);
    this.rain.material.opacity = alpha * 0.32;
    this.smoke.forEach(({ m, vent, offset }) => {
      const p = (t * 0.15 + offset) % 1;
      m.position.set(nearest(vent[0] + p * p * 1.8, s.x), vent[1] + p * 3, nearest(vent[2] + p * 0.35, s.z));
      m.scale.setScalar(0.4 + p * 1.9);
    });
    if (t - this.weatherTick > 0.09 || t < this.weatherTick) {
      this.weatherTick = t;
      for (const { mesh, h } of this.flags) {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          pos.setZ(i, Math.sin(t * 2 + y * 4 + pos.getX(i) * 1.6) * (0.5 - y / h) * 0.13);
        }
        pos.needsUpdate = true;
      }
    }
  }
}
