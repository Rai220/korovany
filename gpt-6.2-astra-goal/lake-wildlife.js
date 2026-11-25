'use strict';

const marchDens = [
  [-110, 72],
  [-119, 57],
  [109, -75],
];
function marchFauna(g = game) {
  if (!Array.isArray(g.marchFauna))
    g.marchFauna = marchDens.map(([x, z], id) => ({
      id: id + 1,
      marchFoe: true,
      kind: 'hound',
      name: 'Старая каменная гончая',
      homeX: x,
      homeZ: z,
      x,
      z,
      yaw: id + 1,
      hp: 48,
      maxHp: 48,
      wait: 1.1,
      stagger: 0,
      windup: 0,
      walk: false,
    }));
  return g.marchFauna;
}
function marchTarget(range = 6, cone = 0.64) {
  const p = game.march;
  if (!p) return null;
  let best = null,
    dist = range;
  for (const h of marchFauna()) {
    const dx = h.x - p.x,
      dz = h.z - p.z,
      d = Math.hypot(dx, dz);
    if (h.hp <= 0 || d >= dist || Math.abs(angles(Math.atan2(-dx, -dz) - game.yaw)) > cone) continue;
    best = h;
    dist = d;
  }
  return best;
}
function marchHurt(h, amount, byPlayer = true, type = 'melee') {
  if (!h || h.hp <= 0) return;
  const value = byPlayer ? trainedDamage(h, amount, type) : amount;
  h.hp = Math.max(0, h.hp - value);
  h.engaged = true;
  h.stagger = Math.max(h.stagger || 0, type === 'heavy' ? 0.9 : 0.21);
  h.windup = 0;
  if (!h.hp) {
    h.fellAt = gameTime;
    h.engaged = false;
    if (byPlayer) {
      game.kills++;
      awardXP(22, 'Гончая Озёрной марки');
    }
    scoreCue('impact');
  }
}
function marchAttack(heavy) {
  if (!game.march || swing > 0 || game.blockTime > 0 || game.health <= 0 || $('dialog').open) return;
  const g = game,
    p = g.march,
    bow = g.weapon === 'bow',
    cost = bow
      ? hasTalent('quiver')
        ? 5
        : 9
      : heavy
        ? hasTalent('breaker')
          ? 16
          : 22
        : hasTalent('blade')
          ? 7
          : 10;
  if (g.stamina < cost) return notify('Переведите дыхание', 0.8);
  if (bow) {
    if (g.arm === 'lost' || !g.arrows || p.shot)
      return notify(
        !g.arrows
          ? 'Стрелы закончились'
          : g.arm === 'lost'
            ? 'Для лука нужен протез руки'
            : 'Стрела в полёте',
        1,
      );
    const cp = Math.cos(g.pitch);
    g.arrows--;
    scoreCue('bow');
    p.shot = {
      x: p.x,
      y: marchFloor(p.x, p.z) + (g.leg === 'lost' ? 0.78 : g.leg === 'chair' ? 1.32 : 1.71) + g.air,
      z: p.z,
      dx: -55 * cp * Math.sin(g.yaw),
      dy: 55 * Math.sin(g.pitch) + 1.6,
      dz: -55 * cp * Math.cos(g.yaw),
      life: 1.65,
      aimed: keys.has('KeyR'),
    };
  } else {
    const target = marchTarget(heavy ? 3.18 : 3.02, 0.82);
    fieldStrike('swish', 0.75, heavy);
    if (target) marchHurt(target, (heavy ? 45 : 26) + (g.upgrade || 0) * 4, true, heavy ? 'heavy' : 'melee');
  }
  swing = 1;
  g.heavy = !!heavy;
  g.stamina -= cost;
}
function marchHuntTick(dt) {
  const g = game,
    p = g.march,
    foes = marchFauna(g);
  if (p.shot) {
    const a = p.shot;
    for (let j = 0; j < 5; j++) {
      const h = dt / 5;
      a.x += a.dx * h;
      a.z += a.dz * h;
      a.y += a.dy * h;
      a.dy -= 6.4 * h;
      a.life -= h;
      const floor = marchFloor(a.x, a.z);
      const hit = foes.find(
        (f) => f.hp > 0 && Math.hypot(a.x - f.x, a.z - f.z) < 0.6 && a.y > floor + 0.08 && a.y < floor + 1.54,
      );
      if (hit) {
        marchHurt(hit, 35 + (g.upgrade || 0) * 4 + (a.aimed && hasTalent('focus') ? 8 : 0), true, 'arrow');
        p.shot = null;
        break;
      }
      const solid = marchSolids.some(
        ([x, z, w, d]) => Math.abs(x - a.x) < w && Math.abs(z - a.z) < d && a.y < floor + 2.45,
      );
      if (
        a.life <= 0 ||
        a.y < Math.max(marchWater, marchGround(a.x, a.z)) ||
        solid ||
        (a.y < floor + 6 && marchVegetationAt(a.x, a.z, 0.02))
      ) {
        p.shot = null;
        break;
      }
    }
  }
  for (const h of foes) {
    if (h.hp <= 0) continue;
    const dx = p.x - h.x,
      dz = p.z - h.z,
      d = Math.hypot(dx, dz),
      home = Math.hypot(h.x - h.homeX, h.z - h.homeZ);
    h.wait = Math.max(0, h.wait - dt);
    h.stagger = Math.max(0, (h.stagger || 0) - dt);
    h.walk = false;
    if (d > 26 || home > 24) h.engaged = false;
    else if (d < 11) h.engaged = true;
    if (h.stagger > 0) continue;
    if (h.windup > 0) {
      h.windup -= dt;
      if (h.windup <= 0) {
        h.struckAt = gameTime;
        if (d < 2.3 && g.air < 1.17) hitPlayer(8, h);
      }
      continue;
    }
    if (h.engaged && d < 1.75) {
      h.yaw = Math.atan2(dx, dz);
      if (!h.wait) {
        h.windup = 0.56;
        h.wait = 1.88;
      }
      continue;
    }
    const tx = h.engaged ? p.x : h.homeX,
      tz = h.engaged ? p.z : h.homeZ;
    if (Math.hypot(tx - h.x, tz - h.z) < 0.56) continue;
    const yaw = Math.atan2(tx - h.x, tz - h.z);
    h.yaw += clamp(angles(yaw - h.yaw), -dt * 3.4, dt * 3.4);
    const step = (h.engaged ? 2.65 : 1.26) * dt;
    for (const offset of [0, 0.6, -0.6, 1.15, -1.15]) {
      const x = h.x + step * Math.sin(h.yaw + offset),
        z = h.z + step * Math.cos(h.yaw + offset);
      if (
        !marchStepFree(h.x, h.z, x, z, 0.31) ||
        foes.some((f) => f !== h && f.hp > 0 && Math.hypot(x - f.x, z - f.z) < 0.72)
      )
        continue;
      h.x = x;
      h.z = z;
      h.walk = true;
      break;
    }
  }
}
function renderMarchWildlife(v, s, t) {
  for (const h of marchFauna(s)) {
    let model = v.actors.get(h.id);
    if (!model) {
      model = creatureModel('hound');
      v.actors.set(h.id, model);
      v.scene.add(model);
    }
    model.visible = Math.hypot(s.march.x - h.x, s.march.z - h.z) < 95;
    if (model.visible) {
      poseCreature(model, h, t);
      model.position.set(h.x, marchFloor(h.x, h.z), h.z);
    }
  }
  if (!v.arrow) {
    v.arrow = world.arrow3d.clone(true);
    v.scene.add(v.arrow);
  }
  const a = s.march.shot;
  v.arrow.visible = !!a;
  if (a) {
    v.arrow.position.set(a.x, a.y, a.z);
    v.arrow.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(a.dx, a.dy, a.dz).normalize(),
    );
  }
}
