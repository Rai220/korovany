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
    bz = Math.abs(v) - 1.63;
  let d = Math.hypot(Math.max(0, bx), Math.max(0, bz)) + Math.min(0, Math.max(bx, bz));
  for (const side of [-0.73, 0.73]) {
    d = Math.min(d, Math.hypot(u - side, v - clamp(v, 2.45, 4.55)) - 0.4);
  }
  return d;
}
const bodyRadius = (a) =>
  a === game ? (a.leg === 'chair' ? 0.49 : 0.37) : a.kind === 'regent' ? 0.46 : 0.37;
function livingFree(x, z, r, who, ignoreWagon = false) {
  if (!world.free(x, z, r)) return false;
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
        a.angle = Math.atan2(side * uz, -side * ux);
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
    if (livingFree(x + dx, z + dz, r, ent)) {
      ent.x = wrapped(x + dx);
      ent.z = wrapped(z + dz);
    } else {
      if (dx && livingFree(x + dx, z, r, ent)) ent.x = wrapped(x + dx);
      if (dz && livingFree(ent.x, z + dz, r, ent)) ent.z = wrapped(z + dz);
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
  const pose = { x: w.x + dx, z: w.z + dz, angle: w.angle + turn };
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
