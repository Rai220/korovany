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
    const timber = 0x534432,
      plaster = j % 2 ? 0xc4b494 : 0xb9a98d;
    const roofing = forest || j % 3 === 1 ? 0x9b8760 : 0x4d5948;
    this.block(x, wallH / 2, z, 5, wallH, zSpan, forest ? 0x897454 : plaster);
    this.block(x, 0.23, z, 5.09, 0.46, zSpan + 0.1, 0x716e60);
    this.bound(x, z, 5, zSpan);
    for (const side of [-1, 1]) {
      const front = z + side * 2.43,
        skin = z + side * 2.49;
      this.block(x, 3.18, front, 5.12, 0.21, 0.17, timber);
      this.block(x, 2.43, front, 5.1, 0.13, 0.15, timber);
      for (const u of [-2.38, 0, 2.38]) this.block(x + u, 1.75, front, 0.14, 2.88, 0.13, timber);
      for (const u of [-1.76, 1.71])
        this.block(x + u, 2.8, front, 0.12, 0.91, 0.13, timber, 0, u > 0 ? -0.63 : 0.63);
      this.block(x + side * 2.49, 1.82, z, 0.16, 2.91, 0.18, timber);
      this.block(x + side * 2.49, 2.43, z, 0.14, 0.13, 4.85, timber);
      this.block(x + side * 2.49, 3.18, z, 0.19, 0.2, 4.99, timber);
      for (const u of [-1.55, 1.55]) {
        const xx = x + side * 2.53,
          zz = z + u;
        this.block(xx, 1.76, zz, 0.12, 1.18, 0.91, timber);
        this.block(xx + side * 0.059, 1.79, zz, 0.05, 0.94, 0.67, 0x364842);
        this.block(xx + side * 0.084, 1.76, zz, 0.055, 0.07, 0.7, 0x87704d);
        this.block(xx + side * 0.084, 1.77, zz, 0.055, 0.96, 0.055, 0x87704d);
        this.block(xx + side * 0.07, 1.13, zz, 0.25, 0.1, 1.02, 0x795f42);
      }
      const door = x + (j % 2 ? -0.99 : 0.96),
        win = x - (j % 2 ? -1.24 : 1.24);
      this.block(door, 1.13, skin, 1.08, 2.26, 0.15, timber);
      this.block(door, 1.07, skin + side * 0.09, 0.85, 2.04, 0.075, forest ? 0x795f42 : 0x6f5239);
      for (const h of [0.54, 1.71])
        this.block(door - 0.19, h, skin + side * 0.134, 0.42, 0.055, 0.034, 0x464a43);
      this.block(door + 0.29, 1.04, skin + side * 0.157, 0.07, 0.13, 0.055, 0xa18c5e);
      this.block(door, 0.075, skin + side * 0.24, 1.18, 0.15, 0.44, 0x716e60);
      this.block(win, 1.67, skin, 1.03, 1.2, 0.14, timber);
      this.block(win, 1.7, skin + side * 0.073, 0.81, 0.94, 0.067, 0x364842);
      for (const delta of [-0.2, 0.2])
        this.block(win + delta, 1.7, skin + side * 0.117, 0.044, 1.0, 0.047, 0x87704d);
      this.block(win, 1.65, skin + side * 0.117, 0.87, 0.05, 0.048, 0x87704d);
      this.block(win, 1.05, skin + side * 0.11, 1.17, 0.12, 0.23, 0x795f42);
      if (j % 2 === 0)
        for (const u of [-0.69, 0.69]) {
          this.block(win + u, 1.7, skin, 0.29, 1.05, 0.08, 0x6f7565);
          for (const h of [1.37, 2.0])
            this.block(win + u, h, skin + side * 0.051, 0.26, 0.045, 0.03, 0x534432);
        }
      this.block(x + side * 1.38, 4.1, z, 3.54, 0.3, 5.65, roofing, 0, -side * 0.603);
      this.block(x + side * 2.81, 3.13, z, 0.13, 0.19, 5.77, timber);
      for (const e of [-1, 1])
        this.block(x + side * 1.39, 4.08, z + e * 2.82, 3.56, 0.15, 0.13, timber, 0, -side * 0.603);
    }
    const gable = geometry([-2.5, 0, 0, 2.5, 0, 0, 0, 1.76, 0], [0, 0, 1, 0, 0.5, 1], [0, 1, 2]);
    const material = this.mat(forest ? 0x897454 : plaster);
    for (const end of [-1, 1]) {
      const face = new THREE.Mesh(gable, material);
      face.position.set(x, 3.27 + (this.buildHeight || 0), z + end * 2.4);
      const gableZ = z + end * 2.43;
      this.block(x, 3.98, gableZ, 0.13, 1.57, 0.16, timber);
      for (const dx of [-1, 1])
        this.block(x + dx * 0.75, 3.75, gableZ, 0.105, 1.47, 0.15, timber, 0, dx * 0.76);
      face.rotation.y = end < 0 ? Math.PI : 0;
      face.castShadow = true;
      this.scene.add(face);
    }
    for (let j = 0; j < 5; j++) this.block(x, 4.91, z - 2.23 + j * 1.09, 0.22, 0.13, 1.12, 0x594431);
    this.block(x + 1.45, 4.28, z - 1.2, 0.67, 2.43, 0.71, 0x716e60);
    this.block(x + 1.45, 5.53, z - 1.2, 0.81, 0.22, 0.84, 0x969384);
    if (forest) {
      if(j===1)this.forestHall(x,z);
      // Hand-hewn ridge ends and an oak shingle vent give the foresters' roofs a lighter profile.
      for (const side of [-1, 1]) {
        for (const pitch of [-1, 1])
          this.block(x + pitch * 0.23, 5.17, z + side * 2.91, 0.1, 0.98, 0.15, timber, 0, pitch * -0.48);
        this.block(x, 5.02, z + side * 2.83, 0.18, 0.15, 0.63, timber);
      }
      if (j === 0 || j === 3) {
        const tx = x - 0.27,
          tz = z + 0.9;
        for (const a of [-1, 1])
          for (const b of [-1, 1]) this.block(tx + a * 0.46, 5.33, tz + b * 0.52, 0.1, 1.17, 0.13, timber);
        for (const a of [-1, 1])
          this.block(tx + a * 0.34, 6.03, tz, 0.93, 0.16, 1.67, 0x4d5948, 0, -a * 0.56);
        this.block(tx, 5.15, tz, 1.12, 0.13, 1.24, timber);
      }
    } else if (j === 1) {
      // The toll house keeps a bell over its ridge. The frame is open against the sky.
      const tz = z + 0.45;
      for (const dx of [-0.74, 0.74])
        for (const dz of [-0.65, 0.65]) this.block(x + dx, 5.7, tz + dz, 0.17, 2.24, 0.17, timber);
      this.block(x, 6.58, tz, 1.72, 0.16, 1.53, timber);
      this.block(x, 6.36, tz, 0.11, 0.44, 0.09, 0x514f48);
      this.bellCup ||= new THREE.CylinderGeometry(0.48, 1, 1, 10);
      this.put(this.bellCup, 0x87704d, x, 5.98, tz, 0.35, 0.49, 0.35);
      this.put(this.head, 0x514f48, x, 5.65, tz, 0.075, 0.095, 0.075);
      for (const a of [-1, 1]) this.block(x + a * 0.53, 6.95, tz, 1.48, 0.19, 2.02, 0x4d5948, 0, -a * 0.61);
      this.block(x, 7.48, tz, 0.085, 1.1, 0.085, 0x514f48);
      this.block(x + 0.23, 7.94, tz, 0.58, 0.16, 0.055, 0x87704d);
    } else if (j === 2) {
      // An external bread oven and a vented flue mark the bakery on the mill road.
      this.block(x + 2.69, 0.67, z - 0.08, 1.05, 1.34, 1.55, 0x716e60);
      this.block(x + 2.76, 1.42, z - 0.08, 0.91, 0.17, 1.44, 0x969384);
      this.block(x + 2.65, 2.54, z - 0.22, 0.54, 2.42, 0.58, 0x716e60);
      this.block(x + 2.65, 3.8, z - 0.22, 0.71, 0.19, 0.7, 0x969384);
      this.bound(x + 2.76, z - 0.08, 1, 1.52);
    }
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
    // Voussoirs, corbels and arrow loops give the gatehouse a readable scale from the road.
    for (let i = 0; i < 15; i++) {
      const a = (Math.PI * (i + 0.5)) / 15,
        r = 3.12;
      this.block(
        x + r * Math.cos(a),
        2.25 + r * Math.sin(a),
        z - 4.17,
        0.67,
        0.52,
        0.52,
        stone,
        0,
        a - Math.PI / 2,
      );
    }
    for (const side of [-1, 1]) {
      for (const [dz, r, height] of [
        [-5, 1.85, 6],
        [-15, 2.55, 8],
      ]) {
        const towerX = x + side * 12,
          towerZ = z + dz;
        this.put(this.log, stone, towerX, 1.0, towerZ, r * 1.046, 0.23, r * 1.046);
        this.put(this.log, stone, towerX, height - 1.17, towerZ, r * 1.07, 0.26, r * 1.07);
        for (let j = 0; j < 10; j++) {
          const a = (j * Math.PI) / 5,
            dx = Math.sin(a),
            dz = Math.cos(a);
          this.block(
            towerX + dx * r * 0.99,
            height - 0.72,
            towerZ + dz * r * 0.99,
            0.33,
            0.5,
            0.36,
            stone,
            a,
          );
          if (j % 2 === 0) {
            this.block(towerX + dx * r, 3.31, towerZ + dz * r, 0.18, 1.02, 0.1, 0x454944, a);
            this.block(towerX + dx * r, 3.03, towerZ + dz * r, 0.42, 0.12, 0.1, 0x454944, a);
          }
        }
      }
      for (let j = 0; j < 3; j++) {
        const cz = z - 7.2 - 2.9 * j;
        this.block(x + side * 12.32, 1.83, cz, 0.69, 3.66, 0.72, stone);
        this.block(x + side * 12.4, 0.44, cz, 0.84, 0.88, 0.9, stone);
        this.block(x + side * 12.37, 3.69, cz, 0.77, 0.18, 0.84, stone);
      }
    }
    // A second curtain and a roofed hall rise in tiers behind the outer gate.
    this.block(x, 5.2, z - 22.6, 14.2, 10.4, 5.2, stone);
    this.block(x, 10.5, z - 22.6, 14.7, 0.66, 5.7, stone);
    for (const side of [-1, 1]) {
      this.block(x, 11.9, z - 22.6 + side * 1.52, 15.2, 0.34, 4.73, 0x43494a, 0, 0, side * 0.7);
      const tx = x + side * 6.8,
        tz = z - 23.8,
        th = dark ? (side < 0 ? 13.4 : 10.1) : 14.6;
      this.put(this.log, stone, tx, th / 2, tz, 1.7, th, 1.7);
      this.put(this.log, stone, tx, th - 0.18, tz, 2.02, 0.85, 2.02);
      if (dark) {
        // Broken wall-heads and a projecting timber hoarding identify the older upland keep.
        for (let j = 0; j < 9; j++) {
          if ((j + (side > 0 ? 2 : 0)) % 4 === 1) continue;
          const a = (j * Math.PI * 2) / 9;
          this.block(tx + 1.67 * Math.sin(a), th + 0.34, tz + 1.67 * Math.cos(a), 0.57, 0.68, 0.47, stone, a);
        }
      } else {
        this.put(this.spire, 0x43494a, tx, th + 2.45, tz, 2.32, 5.3, 2.32);
        this.block(tx, th + 5.65, tz, 0.065, 1.9, 0.065, 0x665644);
        this.banner(tx + 0.64, th + 6.05, tz, 1.28, 0.72, false);
      }
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
    if (dark) this.fortKeep(x, z, stone);
    else {
      this.palaceLantern(x, z, stone);
      this.panel('gate', x - 6.3, 1.4, z - 14.43, 1.55, 2.8);
      for (const side of [-1, 1]) this.block(x - 6.3 + side * 0.89, 1.38, z - 14.4, 0.18, 2.76, 0.2, stone);
      this.block(x - 6.3, 2.87, z - 14.4, 1.98, 0.22, 0.28, stone);
      this.lantern(x - 5.1, z - 14.35, 2.01);
    }
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
  palaceLantern(x, z, stone) {
    const cz = z - 23;
    // A raised crossing and four open arches crown the imperial hall.
    this.block(x, 13.5, cz, 4.3, 2.9, 4.0, stone);
    this.block(x, 14.88, cz, 4.71, 0.37, 4.35, stone);
    for (const dx of [-1.74, 1.74])
      for (const dz of [-1.56, 1.56]) {
        this.block(x + dx, 16.47, cz + dz, 0.56, 3.2, 0.53, stone);
        this.block(x + dx, 17.91, cz + dz, 0.8, 0.37, 0.76, stone);
      }
    this.block(x, 18.21, cz, 4.63, 0.62, 4.28, stone);
    // The roof actually tapers to the lantern and carries a small gilded finial.
    this.courtRoof ||= new THREE.ConeGeometry(1, 1, 8);
    this.put(this.courtRoof, 0x545e61, x, 21.31, cz, 3.17, 6.0, 2.97, 0.3927);
    this.put(this.head, 0xb79d69, x, 24.43, cz, 0.19, 0.28, 0.19);
    this.block(x, 25.08, cz, 0.07, 1.32, 0.07, 0x514f48);
    this.banner(x + 0.76, 25.51, cz, 1.49, 0.64, false);
    for (const side of [-1, 1]) {
      const dx = x + side * 4.64;
      for (let i = 0; i < 4; i++) {
        const broad = 2.4 - 0.51 * i;
        this.block(dx, 11.24 + i * 0.58, cz + 2.61, broad, 0.64, 0.48, stone);
      }
      this.block(dx, 13.54, cz + 2.6, 0.18, 0.84, 0.21, 0x514f48);
    }
  }
  fortKeep(x, z, stone) {
    const tx = x + 1.3,
      tz = z - 23.2;
    this.block(tx, 13.75, tz, 5.35, 4.83, 4.54, stone);
    this.block(tx, 16.21, tz, 5.74, 0.48, 4.94, stone);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 4; j++) {
        const dz = tz - 1.78 + j * 1.19;
        if (!(side > 0 && j === 2)) this.block(tx + side * 2.63, 16.83, dz, 0.53, 0.87, 0.62, stone);
      }
      for (let j = 0; j < 5; j++) {
        if (side < 0 && j < 2) continue;
        this.block(tx - 2.14 + j * 1.07, 16.79, tz + side * 2.19, 0.58, 0.79, 0.5, stone);
      }
      this.block(tx + side * 1.41, 14.12, tz + 2.29, 0.28, 1.13, 0.08, 0x454944);
    }
    this.block(tx + 1.66, 17.84, tz - 1.47, 0.15, 3.6, 0.15, 0x534432);
    this.banner(tx + 2.45, 19.18, tz - 1.47, 1.53, 0.85, true);
    const ox = x - 5.0,
      oz = z - 19.17;
    this.block(ox, 10.45, oz, 3.03, 0.25, 1.72, 0x594431);
    for (const side of [-1, 1]) {
      this.block(ox + side * 1.19, 10, oz + 0.05, 0.18, 1.65, 0.24, 0x594431, 0, 0, -0.57);
      this.block(ox + side * 1.23, 11.0, oz + 0.74, 0.13, 0.99, 0.13, 0x594431);
    }
    this.block(ox, 11.43, oz + 0.74, 2.83, 0.13, 0.14, 0x897454);
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
      [53, -46, 'ДВОРЕЦ  →', 0.12],
      [54, 54, 'СТАРЫЙ ФОРТ  →', 0.04],
    ]) {
      const y = ground(x, z);
      this.block(x, y + 1.18, z, 0.18, 2.36, 0.16, 0x594431);
      this.block(x, y + 2.0, z + 0.04, 2.24, 0.39, 0.12, 0x897454, angle);
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#dbc58d';
      ctx.font = 'bold 38px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(name, 256, 60, 474);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2.14, 0.36),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      m.position.set(x, y + 2.01, z + 0.17);
      m.rotation.y = angle;
      this.scene.add(m);
    }
  }
  carvedBeam(a, b, width, depth = width, tint = 0x594431) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      dir = to.sub(from),
      len = dir.length();
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    );
    this.block(
      a[0] + dir.x * 0.5,
      a[1] + dir.y * 0.5,
      a[2] + dir.z * 0.5,
      width,
      len,
      depth,
      tint,
      euler.y,
      euler.z,
      euler.x,
    );
  }
  // Projecting eaves, a high curved ridge and carved terminals distinguish the forest carpenters' work.
  shingledRoof(x, z, width, length, eave, rise, timber = 0x534432) {
    const p = [],
      uv = [],
      ix = [],
      rows = 8;
    const point = (side, j, k) => {
      const t = j / rows,
        u = k / 3,
        end = Math.abs(t * 2 - 1),
        curve = 0.24 * end ** 3;
      return [
        x + side * width * u,
        eave + rise * (1 - u) ** 1.19 + curve * (0.46 + 0.54 * u) + 0.105 * Math.sin(Math.PI * u),
        z + (2 * t - 1) * length,
      ];
    };
    for (const side of [-1, 1]) {
      const start = p.length / 3;
      for (let j = 0; j <= rows; j++)
        for (let k = 0; k < 4; k++) {
          const q = point(side, j, k);
          p.push(...q);
          uv.push((j / rows) * length, (k / 3) * width);
          if (j && k) {
            const n = start + j * 4 + k;
            ix.push(n - 5, n - 4, n, n - 5, n, n - 1);
          }
        }
      for (let j = 0; j < rows; j++)
        this.carvedBeam(point(side, j, 3), point(side, j + 1, 3), 0.14, 0.14, timber);
      for (const j of [0, rows])
        for (let k = 0; k < 3; k++) this.carvedBeam(point(side, j, k), point(side, j, k + 1), 0.13, 0.16, timber);
    }
    const roofMat = this.mat(0x4d5948).clone();
    roofMat.side = THREE.DoubleSide;
    roofMat.onBeforeCompile = this.mat(0x4d5948).onBeforeCompile;
    roofMat.customProgramCacheKey = this.mat(0x4d5948).customProgramCacheKey;
    const mesh = new THREE.Mesh(geometry(p, uv, ix), roofMat);
    mesh.position.y = this.buildHeight || 0;
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    for (const sign of [-1, 1]) {
      const end = z + sign * length,
        h = eave + rise + 0.24;
      this.carvedBeam([x, h - 0.05, end - sign * 0.31], [x, h + 0.23, end + sign * 0.35], 0.16, 0.19, timber);
      this.carvedBeam([x, h + 0.22, end + sign * 0.33], [x, h + 0.53, end + sign * 0.37], 0.13, 0.16, timber);
      this.carvedBeam([x, h + 0.48, end + sign * 0.36], [x, h + 0.52, end + sign * 0.72], 0.105, 0.13, timber);
    }
  }
  forestHall(x, z) {
    // A raised smoke louvre above the common hall, flanked by split oak jaws on both gables.
    const w = 1.12,
      l = 1.6,
      y = 4.7;
    this.block(x, y + 0.4, z, w * 2, 0.82, l * 2, 0x897454);
    for (const s of [-1, 1])
      for (const k of [-0.91, -0.31, 0.31, 0.91]) {
        this.block(x + s * (w + 0.02), y + 0.52, z + k * l, 0.048, 0.42, 0.54, 0x364842);
        this.block(x + s * (w + 0.045), y + 0.5, z + k * l, 0.09, 0.061, 0.54, 0x87704d);
      }
    this.shingledRoof(x, z, 1.61, 2.11, y + 0.89, 1.35);
    const top = y + 2.35;
    this.block(x, top + 0.43, z, 1.08, 0.98, 1.7, 0x897454);
    for (const s of [-1, 1]) {
      this.block(x + s * 0.56, top + 0.5, z, 0.06, 0.57, 1.23, 0x364842);
      for (const dz of [-0.5, 0, 0.5]) this.block(x + s * 0.6, top + 0.51, z + dz, 0.08, 0.71, 0.09, 0x87704d);
    }
    this.shingledRoof(x, z, 0.93, 1.28, top + 0.94, 1.02);
  }
  rangerPavilion(x, z) {
    const floor = 4.61,
      eave = 7.33;
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        const px = x + side * 1.57,
          pz = z + end * 1.37;
        this.carvedBeam([px, floor, pz], [x + side * 1.48, eave, pz], 0.19, 0.22);
        this.carvedBeam([px, floor + 1.62, pz], [px - side * 0.84, eave - 0.02, pz], 0.115, 0.16);
        this.carvedBeam([px, floor + 1.7, pz], [px, eave - 0.06, pz - end * 0.83], 0.12, 0.17);
        this.block(px, eave + 0.01, pz, 0.31, 0.21, 0.35, 0x897454);
      }
    for (const s of [-1, 1]) {
      this.block(x, eave - 0.07, z + s * 1.36, 3.49, 0.21, 0.23, 0x594431);
      this.block(x + s * 1.56, eave - 0.07, z, 0.19, 0.23, 3.03, 0x594431);
      this.carvedBeam(
        [x + s * 1.34, eave, z + 1.42],
        [x + s * 0.18, eave + 0.94, z + 1.42],
        0.145,
        0.2,
        0x897454,
      );
      this.carvedBeam([x + s * 1.55, 3.67, z + 1.33], [x + s * 0.48, 4.42, z + 1.33], 0.21, 0.2);
    }
    this.shingledRoof(x, z, 2.26, 2.26, eave, 1.48);
    for (const dz of [-0.8, 0, 0.8]) {
      this.block(x + 1.57, 5.19, z + dz, 0.17, 1.04, 0.13, 0x594431);
      this.carvedBeam([x + 1.57, 4.69, z + dz - 0.34], [x + 1.57, 5.48, z + dz + 0.3], 0.067, 0.074, 0x897454);
    }
    this.block(x + 1.57, 5.53, z, 0.16, 0.12, 2.72, 0x897454);
  }
  lookout() {
    const z = 56;
    for (const x of [-59, -41]) {
      this.trees.push({ x, z: z - 2.5, y: 0, h: 25, a: x * 0.07, near: null });
      this.bound(x, z - 2.5, 0.81, 0.81);
      this.put(this.log, 0x534936, x, 3.14, z - 2.5, 0.48, 6.28, 0.48);
      for (let j = -4; j <= 4; j++) this.block(x + j * 0.46, 4.52, z, 0.45, 0.19, 3.7, 0x897454);
      for (const side of [-1, 1]) {
        this.block(x + side * 1.59, 2.2, z + 1.43, 0.24, 4.4, 0.24, 0x594431);
        this.block(x + side * 1.34, 3.83, z - 0.5, 0.26, 2.76, 0.22, 0x594431, 0, side * 0.65);
      }
      this.banner(x, 3.56, z + 1.89, 1.24, 1.62, true);
      this.lantern(x + 0.85, z + 1.93, 4.02);
      if(x===-41)this.rangerPavilion(x,z);
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
    const rider = this.person('merchant', 'scribe', true);
    g.add(rider);
    poseCharacter(rider, 'sit', 1);
    rider.rotation.y = 0.4;
    // The witness sits on an overturned cargo chest beside the road.
    this.part(rider, this.box, 0x897454, 0, 0.214, -0.32, 0.66, 0.428, 0.48);
    for (const x of [-0.245, 0.245])
      this.part(rider, this.box, 0x594431, x, 0.218, -0.32, 0.048, 0.436, 0.496);
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
    cameraFoliageClearance.value =
      s.delivery && !s.delivery.seated ? 7.3 : prefs.camera === 'third' ? 3.35 : 0.55;
    const alpha =
      (1 - rimBlend(s.x, s.z)) *
      Math.min(1, Math.max(0, (s.x - 6) / 24)) *
      Math.min(1, Math.max(0, (s.z - 6) / 24));
    this.storm = alpha;
    const overlook = alpha * terrainFade(4, 17, ground(s.x, s.z));
    this.horizonHaze.value = 0.64 + alpha * 0.28 + overlook * 0.07;
    this.scene.fog.density = 0.0069 + alpha * 0.0034 - overlook * 0.0028;
    const colors = (this.weatherColors ||= [
      0xcac9bc, 0xb9c2b6, 0xa8adba, 0xffe3b8, 0xd8dbe8, 0xd5e2f1, 0xbfcadb,
    ].map((c) => new THREE.Color(c)));
    const forest =
      THREE.MathUtils.smoothstep(-s.x, 0, 38) *
      THREE.MathUtils.smoothstep(s.z, 0, 37) *
      (1 - rimBlend(s.x, s.z));
    this.scene.fog.color.copy(colors[0]).lerp(colors[1], forest).lerp(colors[2], alpha);
    this.sun.intensity = 2.05 - alpha * 1.16 - forest * 0.12;
    this.sun.color.copy(colors[3]).lerp(colors[4], alpha);
    this.skylight.color.copy(colors[5]).lerp(colors[6], alpha);
    this.skylight.intensity = 1.37 + alpha * 0.16;
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
