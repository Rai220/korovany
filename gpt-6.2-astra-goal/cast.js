'use strict';
class Realm extends County {
  person(kind, tag, unarmed = false) {
    const actor = appearance(kind, tag, unarmed);
    this.scene.add(actor);
    return actor;
  }
  makeShield() {
    if (!this.shieldGeo) {
      const pos = [
          -0.29, 0.36, 0, 0, 0.43, 0.085, 0.29, 0.36, 0, 0.25, -0.11, 0, 0, -0.43, 0.04, -0.25, -0.11, 0, 0,
          0.02, 0.15,
        ],
        uv = [0, 0.9, 0.5, 1, 1, 0.9, 0.92, 0.35, 0.5, 0, 0.08, 0.35, 0.5, 0.55],
        ix = [];
      for (let i = 0; i < 6; i++) ix.push(i, (i + 1) % 6, 6);
      this.shieldGeo = geometry(pos, uv, ix);
    }
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      this.shieldGeo,
      (this.shieldMaterial ||= new THREE.MeshStandardMaterial({
        map: texture('wood'),
        color: 0x80624b,
        side: THREE.DoubleSide,
        roughness: 0.75,
      })),
    );
    g.add(m);
    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.shieldGeo, 40),
      new THREE.LineBasicMaterial({ color: 0xcead6d }),
    );
    g.add(rim);
    this.part(g, this.head, 0xb29157, 0, 0.035, 0.155, 0.11, 0.11, 0.038);
    this.part(g, this.box, 0x8f7653, 0, 0.03, 0.086, 0.054, 0.64, 0.036);
    return g;
  }
  makeWeapon() {
    const pos = [],
      uvs = [],
      ix = [];
    for (const [y, w, z] of [
      [0, 0.06, 0.017],
      [0.11, 0.077, 0.019],
      [0.77, 0.047, 0.012],
      [0.96, 0.001, 0.001],
    ]) {
      for (const [x, d] of [
        [-w, 0],
        [-w * 0.29, z],
        [0, z * 0.72],
        [w * 0.29, z],
        [w, 0],
        [0, -z],
      ]) {
        pos.push(x, y, d);
        uvs.push(x / (2 * w) + 0.5, y / 0.96);
      }
    }
    for (let j = 1; j < 4; j++)
      for (let k = 0; k < 6; k++) {
        const prev = (j - 1) * 6 + k,
          n = (j - 1) * 6 + ((k + 1) % 6);
        ix.push(prev, n, n + 6, prev, n + 6, prev + 6);
      }
    this.blade = geometry(pos, uvs, ix);
    this.matCache.set(
      0xafb6b0,
      new THREE.MeshStandardMaterial({
        color: 0xfffdf2,
        map: polishedBlade(),
        roughness: 0.33,
        metalness: 0.52,
        side: THREE.DoubleSide,
      }),
    );
    this.weapon = new THREE.Group();
    const sword = new THREE.Mesh(this.blade, this.mat(0xafb6b0));
    sword.position.y = 0.13;
    this.weapon.add(sword);
    carved(this.weapon, (s) => {
      s.drum(0x66432e, 0, -0.015, 0, 0.026, 0.24, 0.028);
      for (let i = 0; i < 9; i++) s.drum(0x967346, 0, -0.123 + i * 0.027, 0, 0.027, 0.004, 0.029);
      for (const sign of [-1, 1]) {
        const rail = [
          [0, 0.122, 0],
          [sign * 0.054, 0.119, 0.002],
          [sign * 0.107, 0.127, 0.004],
          [sign * 0.153, 0.145, 0.007],
          [sign * 0.177, 0.165, 0.01],
        ];
        for (let i = 1; i < rail.length; i++)
          s.taper(0xb89455, rail[i - 1], rail[i], 0.022 - i * 0.002, 0.018 - i * 0.002);
        s.oval(0xd4ab6d, sign * 0.174, 0.161, 0.011, 0.014, 0.024, 0.016, 0, 0, -sign * 0.49);
        s.taper(0xd4ab6d, [sign * 0.014, 0.136, 0.018], [sign * 0.08, 0.131, 0.021], 0.003, 0.003);
      }
      s.oval(0xb89455, 0, 0.129, 0.003, 0.043, 0.047, 0.031);
      s.oval(0x754339, 0, 0.132, 0.032, 0.019, 0.024, 0.009);
      s.oval(0xb89455, 0, -0.16, 0, 0.045, 0.045, 0.035);
      s.oval(0x754339, 0, -0.16, 0.029, 0.017, 0.02, 0.008);
    });
    this.weapon.add(swordHand());
    this.camera.add(this.weapon);
    this.shield = this.makeShield();
    this.camera.add(this.shield);
    this.bow = new THREE.Group();
    carved(this.bow, (s) => {
      for (const sign of [-1, 1]) {
        const path = [
          [0, 0, 0],
          [-0.02, sign * 0.21, 0],
          [-0.07, sign * 0.42, 0.035],
          [-0.105, sign * 0.6, 0.16],
          [-0.08, sign * 0.7, 0.26],
        ];
        for (let i = 1; i < path.length; i++)
          s.taper(0xad7542, path[i - 1], path[i], 0.033 - i * 0.003, 0.031 - i * 0.0038);
        s.taper(0xebd3a1, path[4], [0, 0, 0.3], 0.005, 0.005);
      }
    });
    const bowGrip = swordHand();
    bowGrip.scale.set(-0.86, 0.86, 0.86);
    this.bow.add(bowGrip);
    this.camera.add(this.bow);
    this.arrow3d = new THREE.Group();
    this.part(this.arrow3d, this.log, 0x897454, 0, 0, 0, 0.012, 0.88, 0.012).rotation.x = Math.PI / 2;
    this.part(this.arrow3d, this.spire, 0x7c817c, 0, 0, 0.48, 0.026, 0.1, 0.026).rotation.x = Math.PI / 2;
    this.arrow3d.visible = false;
    this.scene.add(this.arrow3d);
  }
  makeWagon() {
    const g = new THREE.Group();
    this.wagon = g;
    this.scene.add(g);
    this.wheelParts = [];
    const add = (geo, c, x, y, z, w, h, d) => this.part(g, geo, c, x, y, z, w, h, d);
    add(this.box, 0x785537, 0, 1.09, 0, 2.08, 0.26, 3.3);
    for (const s of [-1, 1]) {
      for (let j = 0; j < 4; j++) add(this.box, 0x897454, s, 1.24 + j * 0.17, 0, 0.11, 0.158, 3.3);
      for (let j = 0; j < 4; j++) add(this.box, 0x594431, s * 1.08, 1.51, -1.55 + j * 1.03, 0.08, 0.91, 0.1);
      add(this.box, 0x594431, s * 0.54, 0.93, 2.68, 0.11, 0.13, 3.15);
      for (const k of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(s * 1.14, 0.7, k * 1.09);
        g.add(wheel);
        const hoop = this.part(
          wheel,
          new THREE.TorusGeometry(0.635, 0.075, 6, 24),
          0x594431,
          0,
          0,
          0,
          1,
          1,
          1,
        );
        hoop.rotation.y = Math.PI / 2;
        const rim = this.part(
          wheel,
          new THREE.TorusGeometry(0.683, 0.025, 6, 24),
          0x646458,
          0,
          0,
          0,
          1,
          1,
          1,
        );
        rim.rotation.y = Math.PI / 2;
        for (let j = 0; j < 6; j++) {
          const spoke = this.part(wheel, this.box, 0x897454, 0, 0, 0, 0.075, 0.055, 1.23);
          spoke.rotation.x = (j * Math.PI) / 6;
        }
        this.part(wheel, this.head, 0x594431, 0, 0, 0, 0.17, 0.16, 0.16);
        this.wheelParts.push(wheel);
      }
    }
    // Longitudinal arched canopy, open at both ends.
    const pp = [],
      uu = [],
      ii = [];
    for (let j = 0; j < 7; j++)
      for (let k = 0; k <= 20; k++) {
        const a = (k * Math.PI) / 20;
        pp.push(Math.cos(a) * 1.13, 1.8 + Math.sin(a) * (1.12 - (j % 2) * 0.065), -1.68 + j * 0.56);
        uu.push(k / 20, j / 6);
        if (j && k) {
          const v = j * 21 + k;
          ii.push(v - 22, v - 1, v, v - 22, v, v - 21);
        }
      }
    const fabric = new THREE.Mesh(
      geometry(pp, uu, ii),
      new THREE.MeshStandardMaterial({
        map: drayCanvas(),
        color: 0xf9efe1,
        side: THREE.DoubleSide,
        roughness: 0.96,
      }),
    );
    fabric.castShadow = true;
    g.add(fabric);
    for (let j = 0; j < 4; j++) add(this.box, 0x897454, 0, 1.28 + j * 0.14, -1.59, 2, 0.125, 0.1);
    for (let i = 0; i < 3; i++) add(this.head, 0xb29968, (i - 1) * 0.5, 1.49, 1.0, 0.39, 0.32, 0.56);
    const shade = document.createElement('canvas');
    shade.width = shade.height = 64;
    const ctx = shade.getContext('2d'),
      soft = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    soft.addColorStop(0, 'rgba(30,25,16,.40)');
    soft.addColorStop(0.55, 'rgba(33,28,18,.24)');
    soft.addColorStop(1, 'rgba(40,32,18,0)');
    ctx.fillStyle = soft;
    ctx.fillRect(0, 0, 64, 64);
    const contact = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shade),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (const [x, z, w, d] of [
      [0, 0, 3.1, 4.8],
      [-0.73, 3.45, 1.45, 2.7],
      [0.73, 3.45, 1.45, 2.7],
    ]) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), contact);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, 0.035, z);
      g.add(patch);
    }
    this.team = [makeBeast(true), makeBeast(false)];
    for (const [i, animal] of this.team.entries()) {
      animal.position.set(i ? 0.73 : -0.73, 0, 3.34);
      g.add(animal);
    }
    carved(g, (s) => {
      for (const side of [-1, 1]) {
        // Iron straps fasten each sideboard. Waxed rope holds down the wagon cover.
        for (const z of [-1.42, 0, 1.42]) {
          s.box(0x56564d, side * 1.094, 1.53, z, 0.032, 0.79, 0.107);
          for (const y of [1.22, 1.76]) s.oval(0x969184, side * 1.116, y, z, 0.012, 0.021, 0.021);
        }
        for (const z of [-1.34, -0.43, 0.43, 1.34]) {
          s.taper(0x8e7b58, [side * 1.122, 1.88, z - 0.12], [side * 1.095, 1.49, z], 0.011, 0.011);
          s.taper(0x8e7b58, [side * 1.095, 1.49, z], [side * 1.122, 1.88, z + 0.12], 0.011, 0.011);
        }
        s.taper(leather, [side * 0.72, 1.25, 1.43], [side * 0.73, 1.27, 2.48], 0.037, 0.038);
      }
      for (const side of [-1, 1]) {
        s.drum(0xbac0b2, side * 0.53, 1.82, 0.97, 0.193, 0.46, 0.193);
        s.taper(0xbbc7ba, [side * 0.53, 2.03, 0.97], [side * 0.53, 2.14, 0.97], 0.193, 0.11);
        s.drum(0x936540, side * 0.53, 2.17, 0.97, 0.124, 0.068, 0.124);
        s.oval(0xa89b7c, side * 0.65, 1.7, -1.1, 0.32, 0.3, 0.39);
      }
      s.box(0x66553f, 0, 2.86, 0, 0.075, 0.05, 3.27);
    });
    const stamp = saltStamp(),
      plaque = new THREE.PlaneGeometry(0.87, 0.37);
    for (const side of [-1, 1]) {
      const mark = new THREE.Mesh(plaque, stamp);
      mark.rotation.y = side * Math.PI * 0.5;
      mark.position.set(side * 1.128, 1.55, -0.64);
      g.add(mark);
    }
    this.travelPhase = 0;
  }
  animateTeam(w, t) {
    const previous = this.teamLast;
    const delta = previous ? Math.hypot(wrapped(w.x - previous.x), wrapped(w.z - previous.z)) : 0;
    const dt = previous ? Math.max(0, Math.min(0.2, t - previous.t)) : 0;
    const travel = delta < 2 && dt > 0 ? delta : 0;
    this.teamLast = { x: w.x, z: w.z, t };
    this.travelPhase += travel;
    const pace = dt > 0 ? Math.min(1, travel / dt) : 0;
    this.teamEnergy = THREE.MathUtils.damp(this.teamEnergy || 0, pace, 10, dt);
    for (const wheel of this.wheelParts) wheel.rotation.x = this.travelPhase / 0.68;
    const sine = Math.sin(w.angle),
      cosine = Math.cos(w.angle);
    const height = (x, z) => ground(w.x + cosine * x + sine * z, w.z - sine * x + cosine * z);
    this.wagon.rotation.x = -Math.atan2(height(0, 1) - height(0, -1), 2);
    this.wagon.rotation.z = Math.atan2(height(1, 0) - height(-1, 0), 2);
    this.team.forEach((animal, i) => {
      const { body, legs, head, tail } = animal.userData;
      const x = animal.position.x,
        z = animal.position.z;
      animal.position.y =
        height(x, z) - ground(w.x, w.z) + z * this.wagon.rotation.x - x * this.wagon.rotation.z;
      const e = this.teamEnergy,
        phase = this.travelPhase / (i ? 1.17 : 1.04) + i * 0.31;
      body.position.y = Math.sin(phase * Math.PI * 4) * 0.025 * e + Math.sin(t * 1.6 + i) * 0.009;
      const answering = !i && (w.listening || 0) > 0;
      head.rotation.x =
        0.028 * Math.sin(t * 2 + i) + Math.cos(phase * Math.PI * 2) * 0.046 * e + (answering ? -0.15 : 0);
      head.rotation.y = answering ? 0.28 * Math.sin(t * 2.1) : 0.065 * Math.sin(t * 0.91 + i);
      tail.rotation.z = 0.26 * Math.sin(t * 2.2 + i) + 0.1 * Math.sin(t * 5 + i);
      for (const { hip, knee, foot, front, side } of legs) {
        const p = (phase + (side < 0 ? 0.5 : 0) + (front ? 0.74 : 0)) % 1;
        const stride = (i ? 0.55 : 0.48) * e;
        // Stance sweeps back at ground speed; a lifted hoof returns on the shorter swing.
        const forward = p < 0.6 ? stride * (0.5 - p / 0.6) : stride * (-0.5 + (p - 0.6) / 0.4);
        const lift = p < 0.6 ? 0 : Math.sin(((p - 0.6) / 0.4) * Math.PI) * 0.22 * e;
        const down = 0.968 - lift,
          d = Math.min(0.979, Math.hypot(down, forward));
        const bend =
          (front ? 1 : -1) * Math.acos(THREE.MathUtils.clamp((d * d - 0.5 ** 2 - 0.48 ** 2) / 0.48, -1, 1));
        hip.rotation.x =
          -Math.atan2(forward, down) - Math.atan2(0.48 * Math.sin(bend), 0.5 + 0.48 * Math.cos(bend));
        knee.rotation.x = bend;
        foot.rotation.x = -hip.rotation.x - bend;
      }
    });
  }
  animateDetails(s, t, attackAnim, bob) {
    this.animateWeather(s, t);
    this.updateAtmosphere(s, t);
    this.animateTeam(s.wagon, t);
    harnessFoley(s, this.travelPhase);
    this.weapon.visible = s.weapon !== 'bow' && s.health > 0;
    const arc = Math.sin(attackAnim * Math.PI),
      sign = s.arm === 'lost' ? -1 : 1;
    const halfWidth = 0.78 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
    const grip = Math.min(0.48, halfWidth * 0.67);
    const blocking = s.blockTime > 0;
    this.weapon.scale.setScalar(0.81);
    this.weapon.position.set(
      sign * (grip - arc * 0.34 - (blocking ? 0.13 : 0)),
      -0.39 + arc * 0.13 + bob * 0.3,
      -0.75 - arc * 0.13,
    );
    this.weapon.rotation.set(
      -0.29 - arc * 0.76,
      0.16 * sign,
      sign * (0.28 + arc * (s.heavy ? 1.14 : 0.85) + (blocking ? 0.38 : 0)),
    );
    this.shield.visible = blocking;
    this.shield.position.set(-0.2, -0.16, -0.59);
    this.shield.rotation.set(0.15, 0.23, 0.08);
    this.bow.visible = s.weapon === 'bow';
    this.bow.scale.setScalar(0.91);
    this.bow.position.set(-grip * 0.93, -0.18 + bob * 0.28, -0.86);
    this.bow.rotation.set(0.06 - arc * 0.12, 0.41, -0.19);
    this.arrow3d.visible = !!s.arrow;
    if (s.arrow) {
      const a = s.arrow;
      this.arrow3d.position.set(nearest(a.x, s.x), a.y, nearest(a.z, s.z));
      this.arrow3d.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(a.dx, a.dy, a.dz).normalize(),
      );
    }
    if (this.storyObjects)
      for (const obj of this.storyObjects) {
        obj.mesh.visible = obj.show(s);
        obj.mesh.position.x = nearest(obj.x, s.x);
        obj.mesh.position.z = nearest(obj.z, s.z);
        if (obj.glow) obj.glow.intensity = 0.55 + 0.17 * Math.sin(t * 2.1);
      }
  }
}
