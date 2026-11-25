'use strict';

// Horizontal footprint in the wagon's local frame. Ends of the two traces remain walkable.
function hitchDistance(x, z, w) {
  const dx = wrapped(x - w.x),
    dz = wrapped(z - w.z);
  if (Math.abs(dx) > 7 || Math.abs(dz) > 7) return 8;
  const c = Math.cos(w.angle),
    s = Math.sin(w.angle),
    u = dx * c - dz * s,
    v = dx * s + dz * c;
  const bx = Math.abs(u) - 1.18,
    bz = Math.abs(v + 0.315) - 1.955;
  let d = Math.hypot(Math.max(0, bx), Math.max(0, bz)) + Math.min(0, Math.max(bx, bz));
  const hitch = w.bend || 0,
    ch = Math.cos(hitch),
    sh = Math.sin(hitch);
  const teamX = u * ch - (v - 1.09) * sh,
    teamZ = u * sh + (v - 1.09) * ch;
  for (const side of [-0.73, 0.73]) {
    d = Math.min(d, Math.hypot(teamX - side, teamZ - clamp(teamZ, 1.36, 3.46)) - 0.4);
  }
  return d;
}
const bodyRadius = (a) =>
  a === game ? (a.leg === 'chair' ? 0.49 : 0.37) : a.kind === 'regent' ? 0.46 : 0.37;
function livingFree(x, z, r, who, ignoreWagon = false) {
  if (!world.free(x, z, r) || huntSolid(x, z, r, who)) return false;
  if (!ignoreWagon && game.wagon && hitchDistance(x, z, game.wagon) < r) return false;
  const overlaps = (b) => {
    if (b === who || (b === game ? game.inside || game.delivery : b.hp <= 0)) return false;
    if ((who === game || b === game) && game.air > 2.05) return false;
    const dx = wrapped(x - b.x),
      dz = wrapped(z - b.z),
      space = r + bodyRadius(b);
    return dx * dx + dz * dz < space * space;
  };
  return !overlaps(game) && !game.actors.some(overlaps);
}
function makeWay(x, z, dx, dz) {
  const len = Math.hypot(dx, dz);
  if (!len || game.order === 'hold') return;
  const ux = dx / len,
    uz = dz / len;
  for (const a of game.actors) {
    if (a.hp <= 0 || a.team !== 'friend') continue;
    const ax = wrapped(a.x - x),
      az = wrapped(a.z - z),
      ahead = ax * ux + az * uz;
    if (ahead < 0 || ahead > 1.32 || Math.abs(ax * uz - az * ux) > 0.82) continue;
    const preferred = ax * uz - az * ux < 0 ? -1 : 1,
      step = Math.min(0.17, len * 1.35);
    for (const side of [preferred, -preferred]) {
      const nx = a.x + step * (side * uz + 0.24 * ux),
        nz = a.z + step * (-side * ux + 0.24 * uz);
      if (livingFree(nx, nz, bodyRadius(a), a)) {
        a.x = wrapped(nx);
        a.z = wrapped(nz);
        a.lookYaw = Math.atan2(side * uz, -side * ux);
        a.walk = true;
        break;
      }
    }
  }
}
function move(ent, dx, dz, r = bodyRadius(ent)) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.18));
  dx /= n;
  dz /= n;
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const x = ent.x,
      z = ent.z;
    if (ent === game) makeWay(x, z, dx, dz);
    if (canClimbStep(x, z, x + dx, z + dz) && livingFree(x + dx, z + dz, r, ent)) {
      ent.x = wrapped(x + dx);
      ent.z = wrapped(z + dz);
    } else {
      if (dx && canClimbStep(x, z, x + dx, z) && livingFree(x + dx, z, r, ent)) ent.x = wrapped(x + dx);
      if (dz && canClimbStep(ent.x, z, ent.x, z + dz) && livingFree(ent.x, z + dz, r, ent))
        ent.z = wrapped(z + dz);
    }
    walked += Math.hypot(wrapped(ent.x - x), wrapped(ent.z - z));
  }
  return walked;
}
function repairSpacing() {
  const g = game;
  if (!g.inside && !livingFree(g.x, g.z, bodyRadius(g), g)) Object.assign(g, clearSpot(g.x, g.z, g));
  for (const a of g.actors)
    if (a.hp > 0 && !livingFree(a.x, a.z, bodyRadius(a), a)) Object.assign(a, clearSpot(a.x, a.z, a));
}
function rollWagon(w, dx, dz, heading, dt) {
  const turn = clamp(angles(heading - w.angle), -dt * 1.6, dt * 1.6);
  const travelled = Math.hypot(dx, dz);
  const forward = dx * Math.sin(w.angle) + dz * Math.cos(w.angle);
  const steer =
    travelled > 0.0001
      ? clamp(Math.atan((2.18 * turn) / (Math.sign(forward || 1) * travelled)), -0.58, 0.58)
      : 0;
  const bend = (w.bend || 0) + (steer - (w.bend || 0)) * (1 - Math.exp(-dt * 9));
  const pose = { x: w.x + dx, z: w.z + dz, angle: w.angle + turn, bend };
  if (!game.inside && !game.delivery) {
    const next = hitchDistance(game.x, game.z, pose),
      current = hitchDistance(game.x, game.z, w);
    if (next < bodyRadius(game) || (next < bodyRadius(game) + 0.55 && next < current - 0.00001)) return false;
  }
  // A pedestrian yields to the side before the wheels advance. Validate the whole move first.
  const displaced = [];
  for (const a of game.actors) {
    if (a.hp <= 0 || hitchDistance(a.x, a.z, pose) >= bodyRadius(a)) continue;
    const c = Math.cos(pose.angle),
      s = Math.sin(pose.angle),
      sign = (a.x - pose.x) * c - (a.z - pose.z) * s < 0 ? -1 : 1;
    let spot = null;
    for (const side of [sign, -sign]) {
      const shove = 0.18;
      const x = a.x + c * side * shove,
        z = a.z - s * side * shove;
      if (
        hitchDistance(x, z, pose) >= bodyRadius(a) &&
        livingFree(x, z, bodyRadius(a), a, true) &&
        !displaced.some((p) => Math.hypot(x - p.x, z - p.z) < bodyRadius(a) + bodyRadius(p.a))
      ) {
        spot = { a, x, z };
        break;
      }
    }
    if (!spot) return false;
    displaced.push(spot);
  }
  for (const { a, x, z } of displaced) {
    a.x = x;
    a.z = z;
    a.walk = true;
  }
  Object.assign(w, pose);
  return true;
}

function escortSlot(w, side) {
  // The 5.3-m timber bridge carries posts on both edges. Close ranks before the first post.
  const bridge = Math.abs(Math.abs(w.x) - 50) < 5 ? Math.abs(w.z - streamZ(w.x)) : 99;
  const flank = 2.04 + 0.56 * THREE.MathUtils.smoothstep(bridge, 5, 11);
  return point(w.x + Math.cos(w.angle) * flank * side, w.z - Math.sin(w.angle) * flank * side);
}
function assignEscortSide(a, w) {
  // Old saves have no assigned side. Keep the guard on the flank they already occupy.
  if (a.escortSide !== 1 && a.escortSide !== -1) {
    const occupied = game.actors.find(
      (other) => other !== a && other.tag === 'escort' && other.hp > 0 && other.escortSide,
    );
    a.escortSide = occupied
      ? -occupied.escortSide
      : distance(a, escortSlot(w, -1)) <= distance(a, escortSlot(w, 1))
        ? -1
        : 1;
  }
}
function followWagon(a, dt) {
  const w = game.wagon;
  assignEscortSide(a, w);
  const slot = escortSlot(w, a.escortSide);
  const vx = a.lastSlot ? wrapped(slot.x - a.lastSlot.x) / dt : 0,
    vz = a.lastSlot ? wrapped(slot.z - a.lastSlot.z) / dt : 0;
  a.lastSlot = slot;
  const dx = wrapped(slot.x - a.x),
    dz = wrapped(slot.z - a.z),
    error = Math.hypot(dx, dz);
  const x = a.x,
    z = a.z,
    yaw = a.angle;
  if (error > 3.5 || a.path?.length) {
    advance(a, slot, 3.2, dt);
  } else {
    const ux = vx + dx * 2.6,
      uz = vz + dz * 2.6,
      speed = Math.hypot(ux, uz);
    if (speed > 0.075) {
      const length = Math.min(3.65, speed) * dt;
      const moved = move(a, (ux / speed) * length, (uz / speed) * length);
      if (moved < length * 0.25 && error > 0.55) {
        // Only spend the untravelled distance on the detour within this simulation tick.
        advance(a, slot, 2.3, dt * (1 - moved / length));
      }
    }
  }
  const mx = wrapped(a.x - x),
    mz = wrapped(a.z - z),
    speed = Math.hypot(mx, mz) / dt;
  a.walk = speed > (a.wasWalking ? 0.09 : 0.18);
  a.wasWalking = a.walk;
  a.angle = speed > 0.09 ? Math.atan2(mx, mz) : yaw;
}

function updatePedestrianTurn(a, before, dt) {
  if (a.hp <= 0 || dt <= 0) return;
  const dist = Math.hypot(wrapped(a.x - before.x), wrapped(a.z - before.z));
  const desired = a.angle,
    delta = angles(desired - before.yaw);
  const turn = clamp(delta, -dt * (a.windup ? 3.85 : 3.18), dt * (a.windup ? 3.85 : 3.18));
  a.angle = angles(before.yaw + turn);
  a.turnRate = turn / dt;
  a.lookYaw = desired;
  const speed = dist / dt;
  a.gaitSpeed = (a.gaitSpeed ?? speed) + (speed - (a.gaitSpeed ?? speed)) * (1 - Math.exp(-dt * 11));
}

// Appearance and tactics read different channels of the same saved identity.
function mixFieldSeed(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
function actorSeed(a) {
  if (Number.isInteger(a.seed)) return a.seed >>> 0;
  // A pre-personality save can be migrated even when an actor has changed allegiance or position.
  const campaign = game?.aiSeed ?? mixFieldSeed(((game?.side ?? 0) + 1) * 16411 + 582039);
  let h = Math.imul((a.id || 0) + 1, 0x9e3779b1) ^ campaign;
  for (const c of a.kind || '') h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  a.seed = mixFieldSeed(h);
  return a.seed;
}
function actorTrait(a, channel) {
  return mixFieldSeed(actorSeed(a) ^ Math.imul(channel + 1, 0x9e3779b1)) / 4294967296;
}
function fieldRoll(m) {
  m.rng = (Math.imul(m.rng, 1664525) + 1013904223) >>> 0;
  return mixFieldSeed(m.rng) / 4294967296;
}
function fieldMind(a) {
  if (a.mind) return a.mind;
  let profile;
  if (a.tag === 'escort') {
    assignEscortSide(a, game.wagon);
    const leadOnLeft = ((game.aiSeed ?? game.side + 1) & 1) === 1;
    profile = (a.escortSide === -1) === leadOnLeft ? 'vanguard' : 'flanker';
  } else {
    const style = actorTrait(a, 17);
    profile =
      a.kind === 'commander' || a.kind === 'regent' || style < 0.38
        ? 'vanguard'
        : a.kind === 'spy' || a.kind === 'elf' || style > 0.7
          ? 'flanker'
          : 'duelist';
  }
  return (a.mind = {
    profile,
    hand: a.escortSide || (actorTrait(a, 9) < 0.5 ? -1 : 1),
    rng: mixFieldSeed(actorSeed(a) ^ 0x85ebca6b),
    mode: 'watch',
    target: null,
    think: 0,
    ready: 0,
    recover: 0,
    strafe: 0,
    initiative: actorTrait(a, 11),
    pace: 0.89 + actorTrait(a, 12) * 0.22,
    measure: 1.78 + actorTrait(a, 13) * 0.35,
  });
}
function fieldEnemy(a, id) {
  if (id === 0) return a.team === 'hostile' && game.health > 0 ? game : null;
  return game.actors.find(
    (b) => b.id === id && b.hp > 0 && b.team === (a.team === 'hostile' ? 'friend' : 'hostile'),
  );
}
function nearestFieldEnemy(a) {
  const sight = a.tag === 'first' ? 52 : a.tag === 'escort' && game.wagon.convoy?.alarm ? 32 : 26;
  let best = a.team === 'hostile' && distance(a, game) < sight ? game : null;
  let range = Math.min(14, best ? distance(a, best) : Infinity);
  for (const b of game.actors) {
    if (b.hp <= 0 || b.team !== (a.team === 'friend' ? 'hostile' : 'friend')) continue;
    const d = distance(a, b);
    if (d < range) {
      best = b;
      range = d;
    }
  }
  return best;
}
function faceField(a, t) {
  return Math.atan2(wrapped(t.x - a.x), wrapped(t.z - a.z));
}
function fieldStride(a, t, bearing, reach, speed, dt) {
  const goal = point(wrapped(t.x + Math.sin(bearing) * reach), wrapped(t.z + Math.cos(bearing) * reach));
  const dx = wrapped(goal.x - a.x),
    dz = wrapped(goal.z - a.z),
    d = Math.hypot(dx, dz);
  const face = faceField(a, t);
  if (d > 0.12) {
    const step = Math.min(d, speed * dt),
      travel = Math.atan2(dx, dz);
    const moved = move(a, (dx / d) * step, (dz / d) * step);
    a.walk = moved > 0.001;
    if (moved < 0.28 * step) advance(a, goal, speed, dt * (1 - moved / step));
    a.mind.strafe = Math.sin(travel - face);
  } else a.mind.strafe = 0;
  a.angle = face;
}
function fieldPartner(a, t) {
  let near = null,
    best = 7;
  for (const b of game.actors) {
    if (b === a || b.hp <= 0 || b.team !== a.team || b.mind?.target !== (t === game ? 0 : t.id)) continue;
    const d = distance(b, t);
    if (d < best) {
      best = d;
      near = b;
    }
  }
  return near;
}
function planFieldMove(a, t, d) {
  const m = a.mind,
    partner = fieldPartner(a, t),
    flanker = m.profile === 'flanker';
  const die = fieldRoll(m),
    arc = faceField(t, a),
    low = a.hp < (a.kind === 'regent' ? 54 : 23);
  m.think = 0.37 + fieldRoll(m) * 0.39;
  m.strafe = 0;
  m.bearing = arc;
  if (d > 6.3) {
    m.mode = 'approach';
    return;
  }
  if (d > m.measure + 0.7) {
    if (flanker && partner && d > 2.6) {
      m.mode = 'flank';
      m.bearing = faceField(t, partner) + m.hand * (1.08 + 0.46 * fieldRoll(m));
      m.radius = m.measure + 0.22;
    } else m.mode = 'approach';
    return;
  }
  // An ally already delivering a blow gives this fighter time to find a side or cover their recovery.
  const freshSwing = partner?.windup > 0 && partner.windDuration - partner.windup < 0.21;
  const occupied = partner?.windup > 0 && partner.windup < 0.48;
  if ((low && die < 0.24) || (d < 1.02 && die < 0.67)) {
    m.mode = 'withdraw';
    m.radius = 2.75 + fieldRoll(m) * 0.5;
    m.bearing = arc + m.hand * 0.29;
    return;
  }
  const facing = Math.abs(angles(faceField(a, t) - a.angle)) < 0.95;
  if (!m.ready && !a.cd && facing && visiblePath(a, t) && !freshSwing && (!occupied || die > 0.89)) {
    const cut = fieldRoll(m);
    m.attack = flanker
      ? cut < 0.64
        ? 'thrust'
        : cut < 0.9
          ? 'cut'
          : 'heavy'
      : m.profile === 'vanguard'
        ? cut < 0.43
          ? 'heavy'
          : cut < 0.87
            ? 'cut'
            : 'thrust'
        : cut < 0.42
          ? 'cut'
          : cut < 0.81
            ? 'thrust'
            : 'heavy';
    m.mode = 'attack';
    m.strafe = 0;
    m.aim = faceField(a, t);
    a.windDuration =
      (m.attack === 'heavy' ? 0.74 : m.attack === 'thrust' ? 0.39 : 0.52) * (0.9 + 0.22 * fieldRoll(m));
    a.windup = a.windDuration;
    return;
  }
  if (flanker || die < 0.29) {
    m.mode = 'flank';
    m.bearing = arc + m.hand * (0.29 + fieldRoll(m) * 0.47);
    m.radius = m.measure + 0.18;
  } else m.mode = 'guard';
}
function releaseFieldStrike(a, t) {
  const m = a.mind,
    heavy = m.attack === 'heavy',
    thrust = m.attack === 'thrust';
  a.strikeSerial = (a.strikeSerial || 0) + 1;
  const reach = thrust ? 3.04 : heavy ? 2.87 : 2.74,
    arc = thrust ? 0.76 : heavy ? 1.01 : 1.12;
  const rest = (heavy ? 0.94 : thrust ? 0.63 : 0.77) * (0.8 + 0.48 * fieldRoll(m));
  m.mode = 'recover';
  m.recover = rest;
  m.ready = rest + 0.19 + fieldRoll(m) * 0.73;
  a.cd = m.ready;
  m.bearing = t ? faceField(t, a) + m.hand * (0.12 + 0.31 * fieldRoll(m)) : m.aim;
  m.radius = m.measure + 0.23 + fieldRoll(m) * 0.55;
  m.think = 0;
  if (!t || distance(a, t) > reach || Math.abs(angles(faceField(a, t) - m.aim)) > arc || !visiblePath(a, t))
    return;
  if (t === game) {
    if (game.air < 1.35) hitPlayer((a.kind === 'regent' ? 14 : 6) + (heavy ? 4 : thrust ? 1 : 2), a);
  } else hurtActor(t, (a.team === 'friend' ? 15 : 10) + (heavy ? 5 : thrust ? 1 : 2), false);
}
function fieldCombat(a, dt) {
  const m = fieldMind(a);
  m.ready = Math.max(0, m.ready - dt);
  m.think = Math.max(0, m.think - dt);
  if (a.windup > 0) {
    if (m.target === null) {
      m.target = 0;
      m.aim = faceField(a, game);
      m.attack = 'cut';
    }
    const target = fieldEnemy(a, m.target);
    if (target && a.windup > (a.windDuration || 0.54) * 0.48) {
      m.aim = angles(m.aim + clamp(angles(faceField(a, target) - m.aim), -dt * 2.6, dt * 2.6));
    }
    a.angle = m.aim;
    a.windup = Math.max(0, a.windup - dt);
    if (!a.windup) releaseFieldStrike(a, target);
    return true;
  }
  const target = nearestFieldEnemy(a);
  if (!target) {
    m.target = null;
    m.mode = 'watch';
    m.recover = 0;
    m.strafe = 0;
    return false;
  }
  const id = target === game ? 0 : target.id;
  if (m.target !== id) {
    m.target = id;
    m.mode = 'approach';
    m.think = 0;
    m.recover = 0;
    m.ready = (m.profile === 'flanker' ? 0.68 : 0.13) + 0.34 * (1 - m.initiative) + fieldRoll(m) * 0.16;
  }
  const d = distance(a, target);
  if (m.recover > 0) {
    m.recover = Math.max(0, m.recover - dt);
    if (d < 3.6) fieldStride(a, target, m.bearing, m.radius, 1.35 * m.pace, dt);
    else a.angle = faceField(a, target);
    return true;
  }
  if (!m.think || m.mode === 'attack') planFieldMove(a, target, d);
  if (a.windup > 0) {
    a.angle = m.aim;
    return true;
  }
  if (m.mode === 'flank' || m.mode === 'withdraw') {
    fieldStride(a, target, m.bearing, m.radius, (m.mode === 'flank' ? 2.4 : 1.7) * m.pace, dt);
    return true;
  }
  if (m.mode === 'approach' && (d > m.measure || !visiblePath(a, target))) {
    const pursuit = a.team === 'friend' ? 4.3 : a.tag === 'escort' && game.wagon.convoy?.alarm ? 3.84 : 2.45;
    advance(a, target, pursuit * m.pace, dt);
    m.strafe = 0;
  } else a.angle = faceField(a, target);
  return true;
}
function fieldGuardStops(a, heavy) {
  const m = a.mind;
  if (
    heavy ||
    a.kind === 'regent' ||
    m?.mode !== 'guard' ||
    a.stagger > 0 ||
    a.windup > 0 ||
    Math.abs(angles(faceField(a, game) - a.angle)) > 1.02 ||
    distance(a, game) > 2.85
  )
    return false;
  const chance = m.profile === 'vanguard' ? 0.74 : 0.43;
  if (fieldRoll(m) > chance) return false;
  m.mode = 'recover';
  m.recover = 0.26;
  m.ready = Math.max(0.52, m.ready);
  m.bearing = faceField(game, a);
  m.radius = m.measure + 0.22;
  m.think = 0;
  fieldImpact(a.x, walkingSurface(a.x, a.z) + 1.27, a.z, 'steel');
  fieldStrike('ring', 0.58);
  scoreCue('parry');
  notify('Клинок отведён · тяжёлый удар пробьёт защиту', 0.9);
  return true;
}
