'use strict';

// Transient visual effects live only in the renderer. Saving or reopening a scene discards them.
const fieldBursts = [];
function fieldImpact(x, y, z, material = 'steel') {
  if (fieldBursts.length >= 16) fieldBursts.shift();
  fieldBursts.push({ x, y, z, material });
}
function effectPool(realm) {
  const dust = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0xb4a07e, transparent: true, opacity: 0.23, depthWrite: false }),
    60,
  );
  const spark = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 5, 3),
    new THREE.MeshBasicMaterial({ color: 0xffcf73, toneMapped: false }),
    56,
  );
  for (const cloud of [dust, spark]) {
    cloud.frustumCulled = false;
    cloud.count = 0;
    realm.scene.add(cloud);
  }
  return {
    dust,
    spark,
    puffs: [],
    streaks: [],
    last: null,
    time: 0,
    remainder: 0,
    dummy: new THREE.Object3D(),
  };
}
function updateFieldEffects(realm, s, t) {
  const f = (realm.fieldFx ||= effectPool(realm));
  const w = s.wagon,
    dt = Math.min(0.12, Math.max(0, t - f.time));
  if (t < f.time || f.session !== s) {
    f.puffs.length = f.streaks.length = fieldBursts.length = 0;
    f.last = null;
    f.remainder = 0;
    f.session = s;
  }
  f.time = t;
  function emit(list, cap, x, y, z, vx, vy, vz, life, size) {
    if (list.length >= cap) list.shift();
    list.push({ x, y, z, vx, vy, vz, life, age: 0, size, angle: Math.random() * 6.28 });
  }
  while (fieldBursts.length) {
    const hit = fieldBursts.pop(),
      metal = hit.material === 'steel',
      n = prefs.quality === 'light' ? 5 : metal ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        p = 0.4 + Math.random() * (metal ? 3 : 1.65);
      emit(
        metal ? f.streaks : f.puffs,
        metal ? 56 : 60,
        hit.x,
        hit.y,
        hit.z,
        Math.cos(a) * p,
        0.5 + Math.random() * (metal ? 3.2 : 1),
        Math.sin(a) * p,
        (metal ? 0.19 : 0.3) + Math.random() * 0.25,
        metal ? 0.014 : 0.055,
      );
    }
  }
  const travel = f.last ? Math.hypot(w.x - f.last.x, w.z - f.last.z) : 0;
  if (travel < 2 && distance(s, w) < 29 && creekDepth(w.x, w.z) < 0.4) f.remainder += travel;
  const interval = prefs.quality === 'light' ? 0.78 : 0.33;
  if (f.remainder >= interval) {
    f.remainder %= interval;
    const c = Math.cos(w.angle),
      a = Math.sin(w.angle);
    for (const side of [-1, 1]) {
      const x = w.x + side * 1.1 * c - a * 0.92,
        z = w.z - side * 1.1 * a - c * 0.92;
      emit(
        f.puffs,
        60,
        x,
        ground(x, z) + 0.09,
        z,
        side * c * 0.27 - a * 0.3,
        0.34 + Math.random() * 0.16,
        -side * a * 0.27 - c * 0.3,
        0.58 + Math.random() * 0.26,
        0.1 + Math.random() * 0.055,
      );
    }
  }
  f.last = { x: w.x, z: w.z };
  for (const [list, mesh, metal] of [
    [f.puffs, f.dust, false],
    [f.streaks, f.spark, true],
  ]) {
    let live = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (metal) p.vy -= 8.4 * dt;
      const u = p.age / p.life,
        scale = p.size * (metal ? 1 - u : (0.65 + 2.5 * u) * (1 - u));
      const m = f.dummy;
      m.position.set(nearest(p.x, s.x), p.y, nearest(p.z, s.z));
      m.rotation.set(metal ? Math.atan2(p.vz, p.vy) : u, p.angle, metal ? -Math.atan2(p.vx, p.vy) : u * 0.8);
      m.scale.set(scale, scale * (metal ? 4 : 0.74), scale);
      m.updateMatrix();
      mesh.setMatrixAt(live, m.matrix);
      list[live++] = p;
    }
    list.length = mesh.count = live;
    mesh.instanceMatrix.needsUpdate = true;
  }
}
