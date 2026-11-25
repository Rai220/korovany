'use strict';

// Four tangent straights joined by quarter circles. The saved distance locates the rear cart on this circuit.
const convoyRadius = 6.2;
const convoyStraight = 100 - 2 * convoyRadius;
const convoyLeg = convoyStraight + (Math.PI * convoyRadius) / 2;
function convoyRoad(s) {
  const length = 4 * convoyLeg;
  s = ((s % length) + length) % length;
  const k = Math.floor(s / convoyLeg),
    u = s - k * convoyLeg;
  const start = route[k],
    corner = route[(k + 1) % 4],
    next = route[(k + 2) % 4];
  const ax = (corner[0] - start[0]) / 100,
    az = (corner[1] - start[1]) / 100;
  const bx = (next[0] - corner[0]) / 100,
    bz = (next[1] - corner[1]) / 100;
  if (u <= convoyStraight)
    return {
      x: start[0] + ax * (convoyRadius + u),
      z: start[1] + az * (convoyRadius + u),
      angle: Math.atan2(ax, az),
      node: (k + 1) % 4,
    };
  const phi = (u - convoyStraight) / convoyRadius,
    c = Math.cos(phi),
    n = Math.sin(phi);
  return {
    x: corner[0] - ax * convoyRadius + bx * convoyRadius * (1 - c) + ax * n * convoyRadius,
    z: corner[1] - az * convoyRadius + bz * convoyRadius * (1 - c) + az * n * convoyRadius,
    angle: Math.atan2(ax * c + bx * n, az * c + bz * n),
    node: (k + 1) % 4,
  };
}
function nearestConvoyRoad(w) {
  let best = 0,
    error = Infinity;
  const probe = (s) => {
    const p = convoyRoad(s),
      d = (p.x - w.x) ** 2 + (p.z - w.z) ** 2;
    if (d < error) {
      error = d;
      best = s;
    }
  };
  for (let s = 0; s < 4 * convoyLeg; s += 2) probe(s);
  const mid = best;
  for (let s = mid - 2; s <= mid + 2; s += 0.04) probe(s);
  return best;
}
function convoyState(w = game.wagon) {
  if (!w.convoy)
    w.convoy = {
      archers: [-1, 1].map((side, i) => ({
        side,
        convoyPart: 'archer',
        kind: 'escort',
        hp: 46,
        wait: 1.45 + i * 0.96,
        draw: 0,
        aim: Math.PI,
      })),
      shots: [],
      axle: 82,
      alarm: false,
      speed: 1.35,
      elapsed: 0,
    };
  return w.convoy;
}
function bowRhythm(a) {
  if (!a.rhythm) {
    const n = mixFieldSeed(
      (game.aiSeed ?? game.side + 1) ^ Math.imul(8963 + (game.robbed || 0), 9176) ^ Math.imul(a.side, 12071),
    );
    const quick = a.side < 0 === (((game.aiSeed ?? game.side) & 1) === 1);
    a.rhythm = { rng: n, quick };
    a.rhythm.draw = (quick ? 0.77 : 0.96) + 0.15 * fieldRoll(a.rhythm);
    a.rhythm.turn = 2.48 + 0.74 * fieldRoll(a.rhythm);
  }
  return a.rhythm;
}
function convoyPlace(w, lx, lz) {
  const c = Math.cos(w.angle),
    s = Math.sin(w.angle);
  return { x: wrapped(w.x + lx * c + lz * s), z: wrapped(w.z - lx * s + lz * c) };
}
function convoyLocal(w, x, z) {
  const dx = wrapped(x - w.x),
    dz = wrapped(z - w.z),
    c = Math.cos(w.angle),
    s = Math.sin(w.angle);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
function archerSite(w, a) {
  const p = convoyPlace(w, a.side * 0.77, -1.94);
  Object.assign(a, p, { y: walkingSurface(p.x, p.z) + 2.03 });
  return a;
}
function alarmConvoy() {
  if (!game || game.delivery || game.inside || game.story.phase === 'escort' || game.wagon.cool > 0)
    return false;
  const w = game.wagon,
    c = convoyState(w);
  if (c.alarm) return true;
  c.alarm = true;
  c.elapsed = 0;
  c.axle = 82;
  w.listening = 0;
  for (const a of game.actors)
    if (a.tag === 'escort' && a.hp > 0) {
      assignEscortSide(a, w);
      fieldMind(a);
      a.cd = 0;
      a.team = 'hostile';
      a.path = null;
    }
  notify('Обоз уходит! Прикройтесь от стрел. Бейте по оси или догоните задний борт.', 5);
  scoreCue('impact');
  return true;
}
function convoyHit(target, amount, byPlayer = true) {
  if (!target?.convoyPart) return false;
  if (!game || game.inside || game.delivery || game.wagon.cool > 0 || game.story.phase === 'escort')
    return true;
  const w = game.wagon,
    c = convoyState(w);
  if (byPlayer) alarmConvoy();
  if (target.convoyPart === 'archer') {
    if (target.hp <= 0) return true;
    const prev = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    target.hurt = 0.38;
    target.draw = 0;
    target.wait = 0.68;
    if (prev > 0 && !target.hp) {
      target.fall = 0;
      if (byPlayer) {
        game.kills++;
        awardXP(19, 'Лучник обоза');
      }
      notify(
        c.archers.every((a) => a.hp <= 0)
          ? 'Оба стрелка обезврежены. Возница осаживает упряжь.'
          : 'Лучник больше не стреляет.',
        2,
      );
    }
  } else {
    const before = c.axle;
    c.axle = Math.max(0, c.axle - amount);
    if (before > 0 && !c.axle)
      notify(
        target.convoyPart === 'harness'
          ? 'Оборвалась постромка. Упряжка останавливается.'
          : 'Ось повреждена! Телега останавливается. Заберите груз у борта.',
        3,
      );
  }
  if (byPlayer) {
    $('hitmark').animate([{ opacity: 1 }, { opacity: 0 }], 230);
    scoreCue('impact');
  }
  fieldImpact(
    target.x,
    target.y ?? walkingSurface(w.x, w.z) + 1.12,
    target.z,
    target.convoyPart === 'archer' ? 'dust' : 'steel',
  );
  return true;
}
function convoyTarget(range, cone) {
  const g = game;
  if (!g || g.inside || g.delivery || g.wagon.cool > 0 || g.story.phase === 'escort') return null;
  const w = g.wagon,
    c = convoyState(w),
    torso = walkingSurface(g.x, g.z) + (g.leg === 'lost' ? 0.78 : 1.65) + g.air;
  const possibilities = c.archers.filter((a) => a.hp > 0).map((a) => archerSite(w, a));
  const loc = convoyLocal(w, g.x, g.z),
    p = convoyPlace(w, clamp(loc.x, -1.13, 1.13), clamp(loc.z, -1.6, 1.6));
  possibilities.push({
    ...p,
    y: walkingSurface(w.x, w.z) + 1.24,
    hp: c.axle || 1,
    convoyPart: 'wagon',
    kind: 'wagon',
  });
  let best = null,
    rank = Infinity;
  for (const a of possibilities) {
    const d = distance(g, a),
      az = Math.abs(angles(Math.atan2(-wrapped(a.x - g.x), -wrapped(a.z - g.z)) - g.yaw));
    const el = Math.abs(Math.atan2(a.y - torso, Math.max(0.12, d)) - g.pitch);
    const penalty = az + 0.48 * el + 0.011 * d + (a.convoyPart === 'wagon' ? 0.18 : 0);
    if (d < range && az < cone && el < 0.86 && penalty < rank && visiblePath(g, a)) {
      rank = penalty;
      best = a;
    }
  }
  return best;
}
function convoyArrowHit(p) {
  const g = game;
  if (!g || g.inside || g.delivery || g.wagon.cool > 0 || g.story.phase === 'escort') return null;
  const w = g.wagon;
  if (distance(w, p) > 6) return null;
  const c = convoyState(w),
    y = p.y - walkingSurface(w.x, w.z);
  for (const a of c.archers)
    if (a.hp > 0 && distance(archerSite(w, a), p) < 0.42 && y > 1.2 && y < 2.52) return a;
  const l = convoyLocal(w, p.x, p.z);
  if (
    Math.abs(l.x) < 1.12 &&
    ((Math.abs(l.z) < 1.68 && y > 0.35 && y < 1.84 + Math.sqrt(Math.max(0, 1 - (l.x / 1.13) ** 2)) * 1.1) ||
      (l.z > -2.27 && l.z < -1.54 && y > 0.88 && y < 1.3))
  )
    return { x: p.x, z: p.z, y: p.y, hp: c.axle || 1, convoyPart: 'wagon', kind: 'wagon' };
  if (y > 0.46 && y < 1.66 && l.z > 1.6 && hitchDistance(p.x, p.z, w) < 0.02)
    return { x: p.x, z: p.z, y: p.y, hp: c.axle || 1, convoyPart: 'harness', kind: 'wagon' };
  return null;
}
function raidWagon() {
  const w = game.wagon,
    c = convoyState(w);
  if (w.cool > 0) return notify('Караван пуст. Новый груз будет позже');
  if (!c.alarm) {
    alarmConvoy();
    return;
  }
  const local = convoyLocal(w, game.x, game.z),
    stopped = c.axle <= 0 || c.archers.every((a) => a.hp <= 0);
  if (
    !stopped &&
    !(c.elapsed > 2.6 && local.z < -0.98 && Math.abs(local.x) < 2.85 && distance(game, w) < 4.05)
  )
    return notify('Обойдите к заднему борту, либо остановите повозку ударом по оси.', 2.7);
  c.alarm = false;
  claimCargo();
  checkpoint();
}
function wagonRaidLabel() {
  const c = game.wagon.convoy;
  if (!c?.alarm) return 'Ограбить караван · V для переговоров';
  return c.axle <= 0 || c.archers.every((a) => a.hp <= 0)
    ? 'Забрать груз из остановленной повозки'
    : 'Срезать тюк с заднего борта';
}
function fireConvoyArrow(w, a, c) {
  const seat = archerSite(w, a),
    heading = w.angle + a.aim;
  const p = {
    x: wrapped(seat.x + 0.46 * Math.sin(heading) - 0.11 * Math.cos(heading)),
    z: wrapped(seat.z + 0.46 * Math.cos(heading) + 0.11 * Math.sin(heading)),
    y: seat.y - 0.19,
  };
  const g = game,
    eye = walkingSurface(g.x, g.z) + (g.leg === 'lost' ? 0.62 : g.leg === 'chair' ? 0.95 : 1.09) + g.air;
  const dx = wrapped(g.x - p.x),
    dz = wrapped(g.z - p.z),
    dist = Math.hypot(dx, dz),
    flight = clamp(dist / 20, 0.22, 1.65);
  if (!visiblePath(p, g) || dist > 29) return;
  // The covered wagon itself masks shots across the body from the rear bench.
  for (let i = 0.45; i < Math.min(4, dist); i += 0.32) {
    const l = convoyLocal(w, p.x + (dx * i) / dist, p.z + (dz * i) / dist);
    if (Math.abs(l.x) < 1.13 && Math.abs(l.z) < 1.65) return;
  }
  c.shots.push({
    x: p.x,
    y: p.y,
    z: p.z,
    dx: dx / flight,
    dy: (eye - p.y) / flight + 3.35 * flight,
    dz: dz / flight,
    life: 2.4,
    startX: p.x,
    startZ: p.z,
  });
  a.release = 0.19;
  scoreCue('bow');
}
function convoyArrows(c, dt) {
  for (let i = c.shots.length - 1; i >= 0; i--) {
    const a = c.shots[i],
      steps = Math.max(1, Math.ceil((dt * Math.hypot(a.dx, a.dz)) / 0.14)),
      h = dt / steps;
    for (let k = 0; k < steps; k++) {
      a.x = wrapped(a.x + a.dx * h);
      a.y += a.dy * h;
      a.z = wrapped(a.z + a.dz * h);
      a.dy -= 6.7 * h;
      a.life -= h;
      if (a.life <= 0 || a.y < walkingSurface(a.x, a.z) || !world.free(a.x, a.z, 0.02)) {
        if (a.life > 0) fieldImpact(a.x, a.y, a.z, 'dust');
        a.life = 0;
        break;
      }
      const feet = walkingSurface(game.x, game.z) + game.air,
        top = game.leg === 'lost' ? 1.05 : game.leg === 'chair' ? 1.49 : 1.89;
      if (distance(a, game) < bodyRadius(game) + 0.07 && a.y > feet + 0.12 && a.y < feet + top) {
        if (!game.evade) hitPlayer(9, { x: a.startX, z: a.startZ, ranged: true });
        a.life = 0;
        break;
      }
    }
    if (a.life <= 0) c.shots.splice(i, 1);
  }
}
function stepConvoy(w, dt) {
  const c = convoyState(w);
  if (
    !c.alarm &&
    w.cool <= 0 &&
    game.actors.some((a) => a.tag === 'escort' && a.team === 'hostile' && a.hp > 0)
  )
    alarmConvoy();
  if (c.alarm) c.elapsed += dt;
  const disabled = c.axle <= 0 || c.archers.every((a) => a.hp <= 0);
  const desired = c.alarm ? (disabled ? 0 : c.archers.some((a) => a.hp <= 0) ? 4.35 : 6.05) : 1.35;
  const diff = desired - c.speed;
  c.speed += clamp(diff, -3.8 * dt, 2.75 * dt);
  if (!Number.isFinite(w.roadS) || distance(w, convoyRoad(w.roadS)) > 4) w.roadS = nearestConvoyRoad(w);
  if (c.speed > 0.015) {
    const ds = c.speed * dt,
      target = convoyRoad(w.roadS + ds),
      dx = wrapped(target.x - w.x),
      dz = wrapped(target.z - w.z),
      d = Math.hypot(dx, dz);
    const k = d > ds * 1.12 ? (ds * 1.12) / d : 1;
    if (rollWagon(w, dx * k, dz * k, target.angle, dt)) {
      if (d < ds * 1.38 + 0.1) w.roadS = (w.roadS + ds) % (4 * convoyLeg);
      w.node = target.node;
    }
  }
  for (const a of c.archers) {
    archerSite(w, a);
    a.hurt = Math.max(0, (a.hurt || 0) - dt);
    a.release = Math.max(0, (a.release || 0) - dt);
    if (a.hp <= 0) {
      a.fall = Math.min(1, (a.fall || 0) + dt * 2.5);
      continue;
    }
    const rhythm = bowRhythm(a);
    const active = c.alarm && game.health > 0 && distance(a, game) < 29 && visiblePath(a, game);
    const desired = active
      ? Math.atan2(wrapped(game.x - a.x), wrapped(game.z - a.z)) - w.angle
      : Math.PI - a.side * 0.53;
    a.aim += clamp(angles(desired - a.aim), -rhythm.turn * dt, rhythm.turn * dt);
    if (!active) {
      a.draw = 0;
      continue;
    }
    a.wait = Math.max(0, a.wait - dt);
    if (a.wait > 0) continue;
    a.draw = Math.min(1, a.draw + dt / rhythm.draw);
    if (a.draw >= 1) {
      fireConvoyArrow(w, a, c);
      a.draw = 0;
      a.wait = (rhythm.quick ? 1.37 : 1.68) + 0.57 * fieldRoll(rhythm);
    }
  }
  convoyArrows(c, dt);
}

function makeConvoyArrow() {
  if (makeConvoyArrow.prototypeMesh) return makeConvoyArrow.prototypeMesh.clone(true);
  const arrow = new THREE.Group();
  carved(arrow, (s) => {
    s.taper(0xd3bd92, [0, 0, -0.52], [0, 0, 0.16], 0.016, 0.012);
    s.taper(0xb1bcc2, [0, 0, 0.12], [0, 0, 0.23], 0.043, 0.003);
    for (const sign of [-1, 1]) {
      s.taper(0xe3d8c4, [0, 0, -0.33], [sign * 0.046, 0, -0.5], 0.022, 0.013);
      s.taper(0xb34b35, [0, 0, -0.33], [0, sign * 0.044, -0.5], 0.02, 0.012);
    }
  });
  makeConvoyArrow.prototypeMesh = arrow;
  return arrow;
}
function makeConvoyCrew(realm) {
  const group = new THREE.Group();
  realm.wagon.add(group);
  carved(group, (s) => {
    s.box(0x795f42, 0, 1.06, -1.89, 2.28, 0.17, 0.76);
    s.box(0x534432, 0, 0.86, -1.89, 1.93, 0.19, 0.13);
    for (const n of [-1, 1]) {
      s.box(0x534432, n * 0.75, 1.2, -1.82, 0.83, 0.17, 0.54);
      s.taper(0x514f48, [n * 0.88, 0.69, -1.38], [n * 0.88, 0.98, -2.17], 0.045, 0.045);
      s.box(0x514f48, n * 0.8, 0.66, -2.15, 0.55, 0.055, 0.23);
    }
  });
  const archers = [-1, 1].map((side) => {
    const perch = new THREE.Group();
    group.add(perch);
    perch.position.set(side * 0.77, 0.82, -1.94);
    const model = realm.person(side < 0 ? 'guard' : 'escort', side < 0 ? 'vigil' : 'carter', true);
    perch.add(model);
    const bow = new THREE.Group();
    perch.add(bow);
    carved(bow, (s) => {
      for (const sign of [-1, 1]) {
        const v = [
          [0, 0, 0],
          [0.035, sign * 0.21, 0.013],
          [0.061, sign * 0.43, -0.031],
          [0.07, sign * 0.61, -0.12],
          [0.052, sign * 0.7, -0.19],
        ];
        for (let j = 1; j < v.length; j++)
          s.taper(0x94683c, v[j - 1], v[j], 0.03 - 0.002 * j, 0.027 - 0.002 * j);
      }
      s.box(0x4b4036, 0, 0, 0, 0.059, 0.15, 0.052);
    });
    const buf = new THREE.BufferGeometry();
    buf.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0.052, -0.7, -0.19, 0, 0, -0.22, 0.052, 0.7, -0.19], 3),
    );
    const string = new THREE.Line(buf, new THREE.LineBasicMaterial({ color: 0xe4d5b4 }));
    bow.add(string);
    const arrow = makeConvoyArrow();
    bow.add(arrow);
    arrow.position.z = 0.33;
    const quiver = new THREE.Group();
    perch.add(quiver);
    carved(quiver, (s) => {
      s.taper(0x60462e, [side * 0.29, 0.5, -0.03], [side * 0.4, 1.1, -0.13], 0.105, 0.132);
      for (let i = 0; i < 4; i++) {
        const x = side * (0.36 + 0.039 * i),
          z = -0.15 + 0.036 * (i % 2);
        s.taper(0xc29d65, [x, 0.94, z], [x + 0.023, 1.26 + (i % 2) * 0.06, z], 0.012, 0.009);
        s.taper(0xcbbaa0, [x, 1.15, z], [x + 0.03, 1.27 + (i % 2) * 0.06, z], 0.026, 0.008);
      }
    });
    return { perch, model, bow, string, arrow, side };
  });
  const driver = realm.person('merchant', 'carter', true);
  group.add(driver);
  driver.position.set(0, 0.79, 1.84);
  const arrows = [];
  for (let i = 0; i < 8; i++) {
    const a = makeConvoyArrow();
    realm.scene.add(a);
    a.visible = false;
    arrows.push(a);
  }
  return { group, archers, driver, arrows };
}
const convoyForward = new THREE.Vector3(0, 0, 1);
function aimMountedArm(model, side, goal, hint) {
  const sk = model.userData.skeleton,
    upper = sk.getBoneByName('upperarm_' + side),
    lower = sk.getBoneByName('lowerarm_' + side),
    hand = sk.getBoneByName('hand_' + side);
  if (!upper || !lower || !hand) return;
  poseTwoBoneChain(upper, lower, hand, goal, hint);
}
function positionMountedArcher(view, a, w, t) {
  const { model, perch, bow, string, arrow, side } = view;
  const seated = Math.PI - side * 0.51,
    twist = clamp(angles(a.aim - seated), -1.02, 1.02);
  if (view.basePose) for (const [bone, q] of view.basePose) bone.quaternion.copy(q);
  poseCharacter(model, 'sit', t);
  const changed = ['spine_03', 'upperarm_r', 'lowerarm_r', 'upperarm_l', 'lowerarm_l'];
  view.basePose = changed
    .map((name) => model.userData.skeleton.getBoneByName(name))
    .filter(Boolean)
    .map((bone) => [bone, bone.quaternion.clone()]);
  model.rotation.set(-(a.fall || 0) * 0.62, seated + twist * 0.28, side * (a.fall || 0) * 1.04);
  model.position.y = -(a.fall || 0) * 0.23;
  bow.visible = a.hp > 0;
  if (!bow.visible) return;
  const sk = model.userData.skeleton,
    spine = sk.getBoneByName('spine_03');
  if (spine) spine.rotateY(twist * 0.52);
  const left = sk.getBoneByName('hand_l'),
    head = sk.getBoneByName('Head');
  if (!left || !head) return;
  model.updateWorldMatrix(true, true);
  const torso = perch.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  const direction = new THREE.Vector3(Math.sin(a.aim), 0, Math.cos(a.aim)),
    right = new THREE.Vector3(direction.z, 0, -direction.x);
  const draw = a.draw || 0,
    raised = w.convoy.alarm ? 1 : 0;
  const grip = torso
    .clone()
    .addScaledVector(direction, 0.28 + 0.32 * raised)
    .addScaledVector(right, -0.13);
  grip.y -= raised ? 0.2 : 0.42;
  const nock = grip
    .clone()
    .addScaledVector(direction, -(0.22 + draw * 0.33))
    .addScaledVector(right, 0.07);
  nock.y += draw * 0.025;
  const localToWorld = (v) => perch.localToWorld(v.clone());
  aimMountedArm(
    model,
    'l',
    localToWorld(grip),
    localToWorld(
      torso
        .clone()
        .addScaledVector(right, -0.56)
        .addScaledVector(direction, 0.08)
        .add(new THREE.Vector3(0, -0.43, 0)),
    ),
  );
  aimMountedArm(
    model,
    'r',
    localToWorld(nock),
    localToWorld(
      torso
        .clone()
        .addScaledVector(right, 0.55)
        .addScaledVector(direction, -0.47)
        .add(new THREE.Vector3(0, -0.24, 0)),
    ),
  );
  bow.position.copy(perch.worldToLocal(left.getWorldPosition(new THREE.Vector3())));
  bow.rotation.set(0, a.aim, raised ? 0.085 : side * 0.34, 'YXZ');
  bow.updateWorldMatrix(true, false);
  const pull = bow.worldToLocal(localToWorld(nock));
  const pos = string.geometry.attributes.position;
  pos.setXYZ(1, pull.x, pull.y, pull.z);
  pos.needsUpdate = true;
  arrow.position.set(pull.x, pull.y, pull.z + 0.52);
  arrow.visible = raised && a.wait < 0.53 && !a.release;
}
function renderConvoy(realm, s, t) {
  if (!realm.roadCrew) {
    if (s.delivery || distance(s, s.wagon) > 56) return;
    realm.roadCrew = makeConvoyCrew(realm);
  }
  const view = realm.roadCrew,
    c = convoyState(s.wagon),
    range = distance(s, s.wagon),
    show = !s.delivery && range < 63;
  view.group.visible = show;
  if (show && (range < 31 || Math.floor(t * 7) !== view.poseFrame)) {
    view.poseFrame = Math.floor(t * 7);
    poseCharacter(view.driver, 'drive', t);
    for (let i = 0; i < 2; i++)
      positionMountedArcher(view.archers[i], archerSite(s.wagon, c.archers[i]), s.wagon, t);
  }
  for (const [i, mesh] of view.arrows.entries()) {
    const shot = c.shots[i];
    mesh.visible = !!shot && !s.delivery;
    if (!mesh.visible) continue;
    mesh.position.set(nearest(shot.x, s.x), shot.y, nearest(shot.z, s.z));
    mesh.quaternion.setFromUnitVectors(
      convoyForward,
      new THREE.Vector3(shot.dx, shot.dy, shot.dz).normalize(),
    );
  }
}
