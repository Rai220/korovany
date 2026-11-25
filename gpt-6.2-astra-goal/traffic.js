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
function followWagon(a, dt) {
  const w = game.wagon;
  // Old saves have no assigned side. Keep the guard on the flank they already occupy.
  if (a.escortSide !== 1 && a.escortSide !== -1) {
    const occupied = game.actors.find(
      (other) => other !== a && other.team === 'escort' && other.hp > 0 && other.escortSide,
    );
    a.escortSide = occupied
      ? -occupied.escortSide
      : distance(a, escortSlot(w, -1)) <= distance(a, escortSlot(w, 1))
        ? -1
        : 1;
  }
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
