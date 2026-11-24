'use strict';

const dragonSite = Object.freeze({ x: 95, z: 120, name: 'Пепельная седловина' });
const dragonName = 'Саргат Пепельнокрылый';
const dragonHealth = 760;
// The marker is the saddle entrance. The beast rests four metres further along its flattest shelf.
const dragonPerch = { x: 98.9, z: 119.1 };
const dragonMoves = {
  perch: 'Охраняет седловину',
  roar: 'Прикрыл горло рогами',
  hunt: 'Подбирается к вам',
  biteWind: 'Отводит голову для укуса',
  bite: 'Укус · открыто горло',
  inhale: 'Раскаляется горло · уйдите вбок',
  flame: 'Бьёт огнём · уязвимо горло',
  chargeWind: 'Пригибает рога · шагните в сторону',
  charge: 'Идёт на таран',
  recover: 'Переводит дух · чешуя разошлась',
  takeoff: 'Взлёт · грудь прикрыта',
  orbit: 'Кружит · цельтесь в перепонки',
  brand: 'Покиньте огненный круг',
  cast: 'Сгусток в полёте · крылья раскрыты',
  impact: 'Земля горит · крылья раскрыты',
  descend: 'Садится · чешуя сомкнута',
  dead: 'Повержен',
};
// Deterministic field Foley. Air turbulence and a pulsed, resonant throat share the user's effects mixer.
const dragonSounds = new Map();
function dragonSound(kind, d) {
  if (
    typeof audioCtx === 'undefined' ||
    !audioCtx ||
    !soundOn ||
    !prefs.effects ||
    !active ||
    document.hidden
  )
    return;
  const ctx = audioCtx;
  if (!dragonSounds.has(kind)) {
    const rate = 22050,
      duration = kind === 'roar' ? 1.42 : kind === 'flame' ? 1.59 : kind === 'wing' ? 0.71 : 0.49;
    const buf = ctx.createBuffer(1, Math.ceil(rate * duration), rate),
      samples = buf.getChannelData(0);
    let state = 972103,
      rumble = 0,
      air = 0,
      phase = 0;
    for (let i = 0; i < samples.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const u = i / samples.length,
        t = i / rate,
        noise = state / 2147483648 - 1;
      rumble += 0.047 * (noise - rumble);
      air += 0.43 * (noise - air);
      const env =
        Math.min(1, u / (kind === 'roar' ? 0.11 : 0.06)) * (1 - u) ** (kind === 'flame' ? 0.49 : 0.83);
      let voice;
      if (kind === 'roar') {
        phase += (2 * Math.PI * (41 + 24 * Math.sin(Math.PI * u) + 3.3 * Math.sin(27 * t))) / rate;
        const glottis = Math.max(0, Math.sin(phase + 0.09 * Math.sin(phase * 2))) ** 3;
        voice =
          0.39 * Math.sin(phase) +
          0.16 * Math.sin(phase * 2) +
          glottis * (0.39 * Math.sin(phase * 6 + 0.6) + 0.23 * Math.sin(phase * 13)) +
          0.6 * rumble +
          0.24 * air;
      } else if (kind === 'flame')
        voice = (0.82 * air + 0.78 * rumble) * (0.79 + 0.15 * Math.sin(t * 35) + 0.055 * Math.sin(t * 58));
      else if (kind === 'wing') voice = 1.72 * rumble + 0.33 * air * Math.sin(Math.PI * u);
      else voice = rumble * 1.8 + 0.22 * Math.sin(58 * Math.PI * t * (1 - 0.38 * u));
      samples[i] = Math.tanh(voice * 1.32) * env;
    }
    dragonSounds.set(kind, buf);
  }
  const source = ctx.createBufferSource(),
    gain = ctx.createGain();
  source.buffer = dragonSounds.get(kind);
  gain.gain.value =
    prefs.effects *
    (kind === 'roar' ? 0.4 : kind === 'flame' ? 0.37 : 0.28) *
    clamp(1.2 - distance(d, game) / 39, 0.22, 1) *
    (realmVoice.active ? 0.59 : 1);
  source.connect(gain).connect(ctx.destination);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  source.start();
}
function wakeDragon(s = game) {
  if (!s.dragon) {
    s.dragon = {
      kind: 'dragon',
      team: 'hostile',
      name: dragonName,
      minLevel: 5,
      maxHp: dragonHealth,
      hp: dragonHealth,
      x: dragonPerch.x,
      z: dragonPerch.z,
      yaw: Math.atan2(-0.66, -0.75),
      lift: 0,
      anim: 0,
      mode: 'perch',
      left: 0,
      span: 0,
      phase: 1,
      turn: 0,
      flights: 0,
      passes: 0,
      engaged: false,
      looted: false,
      far: 0,
    };
  }
  return s.dragon;
}
function dragonMode(d, mode, span) {
  d.mode = mode;
  d.span = d.left = span;
  d.struck = false;
  d.pulse = 0;
  d.fromX = d.x;
  d.fromZ = d.z;
  d.fromLift = d.lift;
  if (mode === 'biteWind' || mode === 'inhale' || mode === 'chargeWind') {
    d.aim = Math.atan2(wrapped(game.x - d.x), wrapped(game.z - d.z));
    d.turnFrom = d.yaw;
  }
  d.ranged = ['flame', 'cast', 'impact', 'brand', 'orbit'].includes(mode);
  if (mode === 'roar' || mode === 'takeoff') {
    dragonSound(mode === 'roar' ? 'roar' : 'wing', d);
    fieldStrike('swish', 0.44, true);
  }
  if (mode === 'flame') dragonSound('flame', d);
  if (mode === 'impact' || mode === 'charge') dragonSound('impact', d);
  if (mode === 'inhale') {
    // Aim at the spot seen during the intake. A sidestep breaks the aim; a ridge can still shield the rider.
    d.breathRange = clamp(distance(d, game) - 2.92, 2.5, 12);
    d.breathHeight = walkingSurface(game.x, game.z) + (game.leg === 'lost' ? 0.55 : 1.1) + (game.air || 0);
    tone(91, 0.64, 'triangle', 0.055, 181);
  }
  if (mode === 'brand') {
    d.markX = game.x;
    d.markZ = game.z;
    tone(391, 0.26, 'sine', 0.055, 270);
  }
  if (mode === 'cast') {
    d.castX = d.x + Math.sin(d.yaw) * 3.1;
    d.castZ = d.z + Math.cos(d.yaw) * 3.1;
    d.castY = walkingSurface(d.x, d.z) + d.lift + 2.9;
    fieldStrike('swish', 0.6, true);
  }
}
function beginDragon(d) {
  if (d.engaged || d.hp <= 0) return;
  d.engaged = true;
  d.far = 0;
  d.turn = 0;
  d.passes = 0;
  dragonMode(d, 'roar', 0.87);
  notify('Саргат Пепельнокрылый · держитесь сбоку от пасти', 3.0);
}
function dragonNavigate(d, yaw, speed, dt) {
  const max = speed * dt;
  for (const bend of [0, 0.42, -0.42, 0.84, -0.84]) {
    const a = yaw + bend,
      x = d.x + Math.sin(a) * max,
      z = d.z + Math.cos(a) * max;
    if (Math.hypot(x - dragonSite.x, z - dragonSite.z) > 17.5 || !world.free(x, z, 0.94)) continue;
    if (Math.abs(walkingSurface(x, z) - walkingSurface(d.x, d.z)) > max * 0.91 + 0.09) continue;
    d.x = x;
    d.z = z;
    return;
  }
}
function dragonClearLine(x, z, y, tx, tz, ty) {
  const dx = wrapped(tx - x),
    dz = wrapped(tz - z),
    n = Math.ceil(Math.hypot(dx, dz) / 1.3);
  for (let i = 1; i < n; i++) {
    const t = i / n,
      xx = x + dx * t,
      zz = z + dz * t,
      yy = y + (ty - y) * t;
    const floor = walkingSurface(xx, zz);
    if (yy < floor + 0.035 || (yy < floor + 3.4 && !world.free(xx, zz, 0.03))) return false;
  }
  return true;
}
function dragonGroundedBody(d, x, z, r = 0.35) {
  if (d.hp <= 0 || d.lift > 1.5) return false;
  const dx = wrapped(x - d.x),
    dz = wrapped(z - d.z),
    cs = Math.cos(d.yaw),
    sn = Math.sin(d.yaw);
  return ((dx * cs - dz * sn) / (r + 0.91)) ** 2 + ((dx * sn + dz * cs) / (r + 1.64)) ** 2 < 1;
}
function separateDragon(d) {
  if (!dragonGroundedBody(d, game.x, game.z) || game.air > 2.6) return;
  const dx = wrapped(game.x - d.x),
    dz = wrapped(game.z - d.z),
    len = Math.hypot(dx, dz);
  const a = len > 0.02 ? Math.atan2(dx, dz) : d.yaw + Math.PI * 0.5;
  for (const offset of [0, 0.5, -0.5, 1.15, -1.15, Math.PI]) {
    const angle = a + offset,
      x = d.x + Math.sin(angle) * 2.06,
      z = d.z + Math.cos(angle) * 2.06;
    if (world.free(x, z, 0.35)) {
      game.x = wrapped(x);
      game.z = wrapped(z);
      break;
    }
  }
}
function dragonPhase(d) {
  return d.hp <= d.maxHp * 0.29 ? 3 : d.hp <= d.maxHp * 0.66 ? 2 : 1;
}
function dragonAttack(d) {
  const dist = distance(d, game),
    n = d.turn++;
  if (d.phase === 2 && (d.flights === 0 || n % 4 === 0)) {
    d.flights++;
    d.passes = 0;
    d.orbitAngle = Math.atan2(d.x - dragonSite.x, d.z - dragonSite.z);
    dragonMode(d, 'takeoff', 1.08);
    return;
  }
  if ((d.phase === 3 && n % 5 === 1) || (dist > 11 && n % 2 === 0)) {
    dragonMode(d, 'chargeWind', 1.18);
    return;
  }
  if (n % 3 === 1 || dist > 6.3) {
    dragonMode(d, 'inhale', 1.4);
    return;
  }
  dragonMode(d, 'biteWind', 0.9);
}
function dragonOrbFlight(d) {
  const u = THREE.MathUtils.clamp(1 - d.left / d.span, 0, 1);
  return {
    x: d.castX + (d.markX - d.castX) * u,
    z: d.castZ + (d.markZ - d.castZ) * u,
    y: d.castY + (walkingSurface(d.markX, d.markZ) + 0.13 - d.castY) * u + 2.55 * Math.sin(Math.PI * u),
  };
}
function dragonBreathAngle(d) {
  return d.aim - 0.21 + 0.42 * (1 - d.left / d.span);
}
// Trace the jet to its first solid surface. Both damage and light use this terrain-clipped path.
function dragonFirePath(d) {
  const a = dragonBreathAngle(d),
    sn = Math.sin(a),
    cs = Math.cos(a),
    floor = walkingSurface(d.x, d.z);
  const x = d.x + sn * 2.92,
    z = d.z + cs * 2.92;
  const localRise = (walkingSurface(d.x + sn, d.z + cs) - walkingSurface(d.x - sn, d.z - cs)) * 0.5;
  const y = floor + 2.55 + clamp(localRise, -0.38, 0.38) * 2.4;
  const range = d.breathRange || 7;
  const aimY = Number.isFinite(d.breathHeight)
    ? d.breathHeight
    : walkingSurface(x + sn * range, z + cs * range) + 1.1;
  const slope = clamp((aimY - y) / range, -0.45, 0.44);
  let len = 12;
  for (let u = 0.5; u <= 12; u += 0.5) {
    const groundY = walkingSurface(x + sn * u, z + cs * u),
      beamY = y + slope * u;
    if (beamY <= groundY + 0.12 || (beamY < groundY + 3.35 && !world.free(x + sn * u, z + cs * u, 0.03))) {
      len = u;
      break;
    }
  }
  return { x, z, y, sn, cs, slope, len, tx: x + sn * len, tz: z + cs * len, ty: y + slope * len };
}
function dragonBiteReach(d, max, arc) {
  const dx = wrapped(game.x - d.x),
    dz = wrapped(game.z - d.z),
    bearing = Math.atan2(dx, dz);
  return (
    Math.hypot(dx, dz) < max &&
    Math.abs(angles(bearing - d.yaw)) < arc &&
    game.air < 2.7 &&
    dragonClearLine(
      d.x,
      d.z,
      walkingSurface(d.x, d.z) + 2.45,
      game.x,
      game.z,
      walkingSurface(game.x, game.z) + 1.15,
    )
  );
}
function sampleDragonMove(d, dt) {
  const u = clamp(1 - d.left / d.span, 0, 1);
  const dist = distance(game, d);
  if (d.mode === 'roar') {
    const bearing = Math.atan2(wrapped(game.x - d.x), wrapped(game.z - d.z));
    d.yaw += clamp(angles(bearing - d.yaw), -dt * 1.43, dt * 1.43);
  } else if (d.mode === 'biteWind' || d.mode === 'chargeWind' || d.mode === 'inhale') {
    d.yaw = d.turnFrom + angles(d.aim - d.turnFrom) * terrainFade(0, 0.7, u);
  } else if (d.mode === 'hunt') {
    const heading = Math.atan2(wrapped(game.x - d.x), wrapped(game.z - d.z));
    d.yaw += clamp(angles(heading - d.yaw), -dt * 1.55, dt * 1.55);
    if (dist > 4.5) dragonNavigate(d, d.yaw, d.phase === 3 ? 3.35 : 2.62, dt);
    if (dist < 5 && d.left > 0.36) d.left = 0.36;
  } else if (d.mode === 'bite' && u > 0.29 && !d.struck) {
    d.struck = true;
    if (dragonBiteReach(d, 5.35, 0.65)) hitPlayer(d.phase === 3 ? 20 : 15, d);
  } else if (d.mode === 'flame' && d.pulse <= 0) {
    d.pulse = 0.46;
    const ray = dragonFirePath(d),
      dx = wrapped(game.x - ray.x),
      dz = wrapped(game.z - ray.z);
    const forward = dx * ray.sn + dz * ray.cs,
      side = Math.abs(dx * ray.cs - dz * ray.sn);
    const center = ray.y + ray.slope * forward,
      feet = walkingSurface(game.x, game.z) + (game.air || 0),
      radius = 0.33 + 0.109 * Math.max(0, forward);
    if (
      forward > -0.32 &&
      forward < ray.len + 0.12 &&
      side < 0.34 + 0.142 * Math.max(0, forward) &&
      center - radius < feet + (game.leg === 'lost' ? 0.91 : 1.78) &&
      center + radius > feet + 0.06
    )
      hitPlayer(d.phase === 3 ? 11 : 8, d);
  } else if (d.mode === 'charge') {
    dragonNavigate(d, d.aim, 13.1, dt);
    if (!d.struck && dragonBiteReach(d, 4.3, 0.55)) {
      d.struck = true;
      hitPlayer(22, d);
    }
  } else if (d.mode === 'takeoff') {
    d.lift = 7.6 * terrainFade(0, 1, u);
  } else if (d.mode === 'orbit') {
    d.orbitAngle += dt * 0.44;
    const a = d.orbitAngle;
    // Blend into the orbit from the takeoff position so the dragon never teleports across the saddle.
    const k = 1 - Math.exp(-dt * 0.96);
    d.x += (dragonSite.x + Math.sin(a) * 9.4 - d.x) * k;
    d.z += (dragonSite.z + Math.cos(a) * 8.4 - d.z) * k;
    d.lift = 7.6 + 0.68 * Math.sin(d.anim * 1.12);
    const heading = Math.atan2(wrapped(game.x - d.x), wrapped(game.z - d.z));
    d.yaw += clamp(angles(heading - d.yaw), -dt * 1.65, dt * 1.65);
  } else if (d.mode === 'descend') {
    const k = terrainFade(0, 1, u);
    d.x = d.fromX + (d.landX - d.fromX) * k;
    d.z = d.fromZ + (d.landZ - d.fromZ) * k;
    d.lift = d.fromLift * (1 - k);
  }
}
function landDragon(d) {
  let best = Infinity,
    land = { x: dragonSite.x, z: dragonSite.z };
  for (const r of [0, 3, 5.5, 8])
    for (let j = 0; j < (r ? 12 : 1); j++) {
      const a = (j * Math.PI) / 6,
        x = dragonSite.x + r * Math.sin(a),
        z = dragonSite.z + r * Math.cos(a);
      if (!world.free(x, z, 1.55)) continue;
      const slope = Math.hypot(
        walkingSurface(x + 0.8, z) - walkingSurface(x - 0.8, z),
        walkingSurface(x, z + 0.8) - walkingSurface(x, z - 0.8),
      );
      const value =
        2.3 * slope +
        0.18 * Math.hypot(x - d.x, z - d.z) +
        0.38 * Math.max(0, 3.7 - Math.hypot(game.x - x, game.z - z));
      if (value < best) {
        land = { x, z };
        best = value;
      }
    }
  d.landX = land.x;
  d.landZ = land.z;
  dragonMode(d, 'descend', 1.65);
}
function nextDragonMove(d) {
  switch (d.mode) {
    case 'roar':
      if (d.phase === 1) {
        d.turn++;
        dragonMode(d, distance(d, game) > 5.25 ? 'inhale' : 'biteWind', 1.04);
      } else if (d.phase === 2) {
        d.flights = 0;
        dragonAttack(d);
      } else dragonMode(d, 'chargeWind', 1.07);
      break;
    case 'hunt':
      dragonAttack(d);
      break;
    case 'biteWind':
      dragonMode(d, 'bite', 0.45);
      break;
    case 'inhale':
      dragonMode(d, 'flame', 1.65);
      break;
    case 'chargeWind':
      dragonMode(d, 'charge', 0.79);
      break;
    case 'bite':
    case 'flame':
    case 'charge':
      dragonMode(d, 'recover', d.phase === 3 ? 2.12 : 2.75);
      break;
    case 'recover':
      dragonMode(d, 'hunt', 1.8);
      break;
    case 'takeoff':
      dragonMode(d, 'orbit', 1.08);
      break;
    case 'orbit':
      dragonMode(d, 'brand', 1.32);
      break;
    case 'brand':
      dragonMode(d, 'cast', 0.93);
      break;
    case 'cast':
      dragonMode(d, 'impact', 0.58);
      fieldImpact(d.markX, walkingSurface(d.markX, d.markZ) + 0.12, d.markZ, 'dust');
      if (distance(game, { x: d.markX, z: d.markZ }) < 2.8 && game.air < 2.4) hitPlayer(20, d);
      break;
    case 'impact':
      if (++d.passes < 2 && d.phase === 2) dragonMode(d, 'orbit', 1.32);
      else landDragon(d);
      break;
    case 'descend':
      d.lift = 0;
      dragonMode(d, 'recover', 4.35);
      break;
  }
}
function dragonTick(dt) {
  const s = game;
  if (!s || s.inside || s.dungeon || s.delivery || s.health <= 0) return;
  const home = distance(s, dragonSite);
  if (!s.dragon && home > 78) return;
  const d = wakeDragon(s);
  if (d.hp <= 0) {
    d.fall = Math.min(1, (d.fall || 0) + dt * 0.91);
    d.lift = Math.max(0, d.lift - dt * 8.7);
    return;
  }
  if (home > 75 && !d.engaged) return;
  d.anim = (d.anim + dt) % 240;
  if (d.hitTint) d.hitTint = Math.max(0, d.hitTint - dt);
  if (d.warning) d.warning = Math.max(0, d.warning - dt);
  if (!d.engaged) {
    if (home < (heroLevel() < 5 ? 7 : 15)) beginDragon(d);
    return;
  }
  if (home > 29) d.far += dt;
  else d.far = 0;
  if (d.far > 5.5) {
    // The mountains remain a safe place to retreat. The next fight starts with a rested guardian.
    d.x = dragonPerch.x;
    d.z = dragonPerch.z;
    d.lift = 0;
    d.hp = d.maxHp;
    d.phase = 1;
    d.engaged = false;
    d.flights = 0;
    d.mode = 'perch';
    return;
  }
  const next = dragonPhase(d);
  // Finish a committed attack before adopting a new pattern. Every landed hit still removes HP.
  const groundedOpening = d.mode === 'recover' || (d.mode === 'hunt' && d.turn > 0);
  if (next > d.phase && d.phase === 1 && groundedOpening) {
    d.phase = 2;
    d.turn = 0;
    d.flights = 0;
    dragonAttack(d);
  } else if (
    next > d.phase &&
    d.phase === 2 &&
    (d.mode === 'impact' || d.mode === 'recover' || (d.mode === 'hunt' && d.passes > 0))
  ) {
    d.phase = 3;
    d.turn = 0;
    if (d.lift > 1.0) landDragon(d);
    else dragonMode(d, 'roar', 0.88);
  }
  d.left -= dt;
  d.pulse -= dt;
  sampleDragonMove(d, dt);
  if (d.left <= 0 && game.health > 0) nextDragonMove(d);
  if (d.engaged) separateDragon(d);
}
function dragonTarget(range, cone) {
  const d = game?.dragon;
  if (!d || game.inside || game.delivery || d.hp <= 0) return null;
  const dx = wrapped(d.x - game.x),
    dz = wrapped(d.z - game.z);
  if (Math.hypot(dx, dz) > range + 4.7) return null;
  const eye =
    walkingSurface(game.x, game.z) +
    (game.leg === 'lost' ? 0.78 : game.leg === 'chair' ? 1.32 : 1.71) +
    (game.air || 0);
  const base = walkingSurface(d.x, d.z) + d.lift;
  let targetZone = null,
    best = Infinity;
  for (const [zone, z, y, r] of [
    ['chest', 0, 1.9, 1.02],
    ['throat', 1.85, 2.49, 0.58],
    ['head', 2.87, 2.85, 0.65],
    ['tail', -1.33, 1.72, 0.66],
  ]) {
    const xx = dx + Math.sin(d.yaw) * z,
      zz = dz + Math.cos(d.yaw) * z,
      h = Math.hypot(xx, zz),
      dy = base + y - eye;
    if (
      Math.hypot(h, dy) > range + r ||
      Math.abs(angles(Math.atan2(-xx, -zz) - game.yaw)) > cone + Math.atan2(r, h) ||
      Math.abs(Math.atan2(dy, h) - game.pitch) > 0.76 + Math.atan2(r, h)
    )
      continue;
    const error =
      Math.hypot(angles(Math.atan2(-xx, -zz) - game.yaw), Math.atan2(dy, h) - game.pitch) + 0.035 * h;
    if (error < best && dragonClearLine(game.x, game.z, eye, game.x + xx, game.z + zz, base + y)) {
      best = error;
      targetZone = zone;
    }
  }
  d.meleeZone = targetZone;
  return targetZone ? d : null;
}
// The flight membrane is a fan from the wrist to its long spars. The simple collision surface follows
// the same wing beat as the rendered fan, including the lower inner edge and the raised leading edge.
// Endpoints of each spar, in folded coordinates plus its travel as the wing opens.
const dragonWingPlan = [
  [1.29, 5.92, -2.78, 3.03, 2.54, 0.52, 1.9],
  [1.52, 4.98, -3.25, 1.68, 2.24, 0.31, 1.65],
  [1.61, 3.73, -3.32, 0.1, 1.92, 0.18, 1.31],
  [1.47, 2.28, -2.96, -0.79, 1.61, 0.3, 0.89],
  [1.2, 1.12, -2.54, -0.43, 1.54, 0.39, 0.42],
  [0.55, 0, -1.57, 0, 1.93, 0, 0],
  [0.71, 0, 0.6, 0, 2.61, 0, 0],
];
const dragonArrowVolumes = [
  ['throat', 2.1, 2.49, 0.49, 0.47, 0.89],
  ['head', 3.09, 2.99, 0.55, 0.52, 0.82],
  ['chest', 0, 1.98, 0.99, 0.9, 1.75],
  ['tail', -2.66, 1.58, 0.4, 0.37, 1.47],
];
const dragonOpenJaw = new Set(['inhale', 'flame', 'bite', 'cast']);
const dragonOpenWing = new Set(['orbit', 'brand', 'cast', 'impact']);
function dragonFlightSpread(d, u) {
  if (d.mode === 'takeoff') return 0.15 + 0.84 * terrainFade(0.16, 0.8, u);
  if (d.mode === 'descend') return 0.19 + 0.8 * (1 - terrainFade(0.12, 0.92, u));
  return 0.99;
}
function dragonWingSurface(d, x, z) {
  x = Math.abs(x);
  if (x < 0.95 || x > 7.25 || z < -3.85 || z > 1.85 || d.lift < 2) return null;
  const spread = dragonFlightSpread(d, clamp(1 - d.left / d.span, 0, 1));
  const flap =
    clamp(d.lift / 3, 0, 1) *
    Math.sin(d.anim * 3.6) *
    (d.mode === 'descend' || d.mode === 'orbit' ? 0.76 : 0.94);
  const wx = 1.35 + 1.97 * spread,
    wz = 1.24 + 0.52 * spread,
    wy = 3.6 + 0.2 * spread + 1.46 * flap;
  for (let i = 0; i < dragonWingPlan.length - 1; i++) {
    const p = dragonWingPlan[i],
      q = dragonWingPlan[i + 1];
    const ax = p[0] + p[1] * spread - wx,
      az = p[2] + p[3] * spread - wz;
    const bx = q[0] + q[1] * spread - wx,
      bz = q[2] + q[3] * spread - wz,
      det = ax * bz - az * bx;
    if (Math.abs(det) < 0.0001) continue;
    const u = ((x - wx) * bz - (z - wz) * bx) / det,
      v = (ax * (z - wz) - az * (x - wx)) / det;
    if (u >= -0.02 && v >= -0.02 && u + v <= 1.02) {
      const t = u + v;
      return (
        (1 - t) * wy +
        u * (p[4] + p[5] * spread + p[6] * flap) +
        v * (q[4] + q[5] * spread + q[6] * flap) +
        0.32 * Math.sin(Math.PI * t) -
        0.1
      );
    }
  }
  return null;
}
function dragonArrowHit(a) {
  const d = game?.dragon;
  if (!d || game.inside || game.delivery || d.hp <= 0) return null;
  const dx = wrapped(a.x - d.x),
    dz = wrapped(a.z - d.z);
  if (Math.abs(dx) > 8 || Math.abs(dz) > 8) return null;
  const c = Math.cos(d.yaw),
    s = Math.sin(d.yaw),
    x = dx * c - dz * s,
    z = dx * s + dz * c,
    y = a.y - walkingSurface(d.x, d.z) - d.lift;
  for (const [zone, zz, yy, rx, ry, rz] of dragonArrowVolumes) {
    if ((x / rx) ** 2 + ((y - yy) / ry) ** 2 + ((z - zz) / rz) ** 2 <= 1) {
      const mouth = zone === 'head' && z > 2.4 && Math.abs(x) < 0.38 && y < 2.96 && dragonOpenJaw.has(d.mode);
      a.dragonZone = mouth ? 'throat' : zone;
      return d;
    }
  }
  const wing = dragonWingSurface(d, x, z);
  if (wing !== null && Math.abs(y - wing) < 0.32) {
    a.dragonZone = 'wing';
    return d;
  }
  return null;
}
function dragonShell(d, zone, type) {
  if (d.mode === 'recover') return type === 'heavy' ? 1.48 : 1.24;
  if (['perch', 'roar', 'takeoff', 'descend'].includes(d.mode)) return type === 'heavy' ? 0.24 : 0.12;
  if (zone === 'wing' && dragonOpenWing.has(d.mode)) return 1.23;
  if (zone === 'throat' && dragonOpenJaw.has(d.mode)) return 1.42;
  if (type === 'parry' && ['charge', 'bite'].includes(d.mode)) return 1.05;
  return d.lift > 1 ? 0.22 : type === 'heavy' ? 0.57 : 0.37;
}
function dragonHit(amount, byPlayer, type = 'melee') {
  const d = wakeDragon();
  if (!byPlayer || d.hp <= 0 || !(amount > 0) || game.inside || game.delivery) return false;
  if (heroLevel() < 5) {
    beginDragon(d);
    if (!d.warning) {
      notify('Чешуя не пробита · нужен V уровень', 2.3);
      d.warning = 2.2;
    }
    return false;
  }
  beginDragon(d);
  const shot = type === 'arrow' ? game.arrow : null;
  const zone = shot?.dragonZone || (type === 'arrow' ? 'chest' : d.meleeZone || 'chest');
  const multiplier = dragonShell(d, zone, type);
  d.hp = Math.max(0, d.hp - Math.max(1, Math.round(amount * multiplier)));
  d.hitTint = 0.22;
  if (multiplier < 0.6) {
    fieldStrike('ring', multiplier < 0.25 ? 0.54 : 0.31, true);
    if (shot) fieldImpact(shot.x, shot.y, shot.z);
  } else if (zone === 'wing' || zone === 'throat') {
    tone(148, 0.08, 'triangle', 0.045, 65);
  }
  if (d.hp <= 0) {
    d.mode = 'dead';
    d.engaged = false;
    d.fall = 0;
    game.kills++;
    awardXP(200, 'Саргат Пепельнокрылый');
    notify('Саргат повержен · у туши осталась янтарная чешуя', 4.5);
    scoreCue('impact');
    checkpoint();
  } else {
    if (type === 'parry' && ['charge', 'bite'].includes(d.mode)) dragonMode(d, 'recover', 2.9);
    scoreCue('impact');
  }
  return true;
}
function dragonLootPrompt() {
  const d = game?.dragon;
  return d && d.hp <= 0 && !d.looted && !game.inside && !game.delivery && distance(d, game) < 4.7
    ? 'Обыскать Саргата'
    : null;
}
function collectDragonLoot() {
  if (!dragonLootPrompt()) return false;
  const d = game.dragon;
  d.looted = true;
  game.coins += 145;
  if (game.story?.entries)
    game.story.entries.push([
      'Янтарная чешуя',
      'Трофей Саргата Пепельнокрылого, добытый на Пепельной седловине.',
    ]);
  notify('Янтарная чешуя · 145 монет', 4);
  checkpoint();
  return true;
}

// A staggered field of raised, keeled scutes. The identical relief lattice is used for colour and bump.
let dragonMaterials;
function makeDragonMaterials() {
  if (dragonMaterials) return dragonMaterials;
  const size = 384,
    rows = 12,
    cols = 12;
  const rough = new Uint8Array(size * size * 4),
    colour = new Uint8Array(size * size * 4),
    skin = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const u = i / size,
        v = j / size,
        cy = Math.floor(v * rows);
      let relief = 0,
        shade = 0,
        throat = 0;
      for (let row = cy - 1; row <= cy + 1; row++) {
        const dx = ((u * cols + (row % 2 === 0 ? 0 : 0.5) + 0.5) % 1) - 0.5;
        const dy = v * rows - row - 0.51;
        const width = 0.49 * (1 - 0.71 * Math.max(0, dy + 0.04));
        const rim =
          1 -
          Math.pow(Math.abs(dx) / Math.max(0.01, width), 2.6) -
          Math.pow(Math.abs((dy + 0.1) / 0.76), 2.1);
        if (rim < 0) continue;
        const cell = (Math.floor(u * cols + (row % 2 === 0 ? 0 : 0.5) + 0.5) + cols) % cols,
          r = (row + rows) % rows;
        const rand = Math.sin(cell * 561.7 + r * 722.9) * 535.1;
        const h = Math.min(1, rim * 5.2) * (0.45 + 0.31 * (1 - dy) + 0.21 * Math.exp(-26 * Math.abs(dx)));
        if (h > relief) {
          relief = h;
          shade = rand - Math.floor(rand);
          throat = dy;
        }
      }
      const noise = 0.5 + 0.5 * Math.sin((i * 323 + j * 183) * 71.2) * Math.cos(j * 28 + i * 68);
      const light = 0.47 * relief + 0.14 * shade + 0.1 * noise + 0.23 * Math.max(0, -throat) * relief;
      const k = (j * size + i) * 4;
      colour.set([56 + 121 * light, 58 + 111 * light, 57 + 101 * light, 255], k);
      rough.set(
        [35 + 175 * relief + 15 * noise, 35 + 175 * relief + 15 * noise, 35 + 175 * relief + 15 * noise, 255],
        k,
      );
      const a = Math.PI * 2,
        vein = Math.abs(
          Math.sin(a * (u * 3 + v * 4) + 0.64 * Math.sin(a * (u * 2 + v * 3)) + 0.45 * Math.sin(v * a * 3)),
        );
      const thin = Math.abs(Math.sin(a * (v * 13 - u * 8) + 2.28 * Math.sin(a * (u * 2 + v * 3))));
      const leather =
        0.76 +
        0.1 * Math.sin(a * (2 * u + v)) +
        0.06 * Math.cos(a * (2 * v - 3 * u)) +
        0.06 * noise -
        0.12 * Math.exp(-39 * vein) -
        0.07 * Math.exp(-44 * thin);
      skin.set([Math.round(184 * leather), Math.round(112 * leather), Math.round(76 * leather), 255], k);
    }
  function image(data, srgb) {
    const tex = new THREE.DataTexture(data, size, size);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.generateMipmaps = true;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  const scales = image(colour, true),
    relief = image(rough, false),
    membrane = image(skin, true);
  function m(color, properties = {}) {
    return new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.76, ...properties });
  }
  return (dragonMaterials = {
    scales: m(0xb0b7a6, { map: scales, bumpMap: relief, bumpScale: 0.035, metalness: 0.15 }),
    crest: m(0x9caaa1, { map: scales, bumpMap: relief, bumpScale: 0.027, metalness: 0.27 }),
    vent: m(0xaf8f65, { map: scales, bumpMap: relief, bumpScale: 0.016 }),
    ridge: m(0x6b5c4f, { bumpMap: relief, bumpScale: 0.023, metalness: 0.19 }),
    horn: m(0xc9b185, { bumpMap: relief, bumpScale: 0.006, roughness: 0.57 }),
    teeth: m(0xf3dab6, { roughness: 0.45 }),
    eye: m(0xe5a140, { emissive: 0xf47e11, emissiveIntensity: 0.26, roughness: 0.22 }),
    dark: m(0x140f0d, { roughness: 0.36 }),
    flesh: m(0x583034, { roughness: 0.38 }),
    tongue: m(0xa15a54, { roughness: 0.32 }),
    skin: m(0xdd966e, {
      map: membrane,
      vertexColors: true,
      roughness: 0.78,
      emissive: 0x371207,
      emissiveIntensity: 0.17,
    }),
    throat: m(0xeb7b31, { emissive: 0xf75e0a, emissiveIntensity: 0.38 }),
  });
}
function dragonHorn(g, m, base, mid, tip, r) {
  const rows = [
    [...base, r],
    [...mid, r * 0.56],
    [...tip, 0.009],
  ];
  cryptSweep(g, m.horn, rows, 10, 5, 0.91);
  const end = base.map((v, i) => v + (mid[i] - v) * 0.45),
    beyond = base.map((v, i) => v + (mid[i] - v) * 0.88);
  cryptSweep(
    g,
    m.ridge,
    [
      [...base, r * 1.2],
      [...end, r * 0.95],
      [...beyond, r * 0.59],
    ],
    11,
    3,
    0.93,
  );
}
function dragonScute(g, m, x, y, z, w, h, l, side = 0) {
  // A flattened leaf with a peaked keel, pointing back along the animal.
  cryptPlate(
    g,
    m,
    [
      [x - w, y, z + l * 0.35],
      [x - w * 0.66, y + h * 0.13, z + l * 0.77],
      [x + w * 0.64, y + h * 0.12, z + l * 0.7],
      [x + w, y, z + l * 0.16],
      [x + side * w * 0.62, y + h * 0.15, z - l * 0.82],
    ],
    [x + side * w * 0.28, y + h, z + 0.06 * l],
  );
}
function dragonSpine(g, m, x, y, z, size, s = 0) {
  cryptPlate(
    g,
    m.ridge,
    [
      [x - size * 0.16, y, z + size * 0.42],
      [x + size * 0.16, y, z + size * 0.33],
      [x + size * 0.12, y, z - size * 0.56],
      [x - size * 0.1, y, z - size * 0.4],
    ],
    [x + size * s * 0.3, y + size * 0.79, z - size * 0.57],
  );
  cryptSweep(
    g,
    m.horn,
    [
      [x + size * s * 0.16, y + size * 0.51, z - size * 0.24, size * 0.082],
      [x + size * s * 0.3, y + size * 0.74, z - size * 0.49, size * 0.055],
      [x + size * s * 0.42, y + size * 0.93, z - size * 0.72, 0.003],
    ],
    7,
    2,
  );
}
function dragonFace(neck, m) {
  const g = cryptJoint(neck, 'Череп', 0, 0.7, 1.5);
  cryptBody(
    g,
    m.scales,
    [
      [-0.6, 0.09, 0.15, 0.22],
      [-0.45, 0.13, 0.47, 0.39],
      [-0.18, 0.14, 0.57, 0.43],
      [0.05, 0.14, 0.51, 0.39],
      [0.31, 0.1, 0.45, 0.29],
      [0.53, 0.08, 0.39, 0.2],
      [0.72, 0.09, 0.37, 0.18],
      [0.92, 0.1, 0.39, 0.18],
      [1.04, 0.1, 0.32, 0.13],
      [1.09, 0.08, 0.21, 0.06],
    ],
    false,
    0.83,
  );
  cryptBody(
    g,
    m.flesh,
    [
      [-0.24, -0.12, 0.36, 0.068],
      [0.19, -0.09, 0.43, 0.067],
      [0.59, -0.066, 0.35, 0.044],
      [0.95, -0.04, 0.32, 0.045],
      [1.04, 0.015, 0.26, 0.055],
    ],
    false,
    0.78,
  );
  const jaw = cryptJoint(g, 'Нижняя челюсть', 0, -0.17, -0.19);
  cryptBody(
    jaw,
    m.vent,
    [
      [0, 0, 0.27, 0.092],
      [0.19, -0.02, 0.44, 0.14],
      [0.47, -0.04, 0.41, 0.14],
      [0.76, -0.035, 0.32, 0.102],
      [1.05, -0.017, 0.32, 0.095],
      [1.2, 0.012, 0.263, 0.082],
      [1.24, 0.03, 0.13, 0.047],
    ],
    false,
    0.83,
  );
  cryptBody(
    jaw,
    m.tongue,
    [
      [0.08, 0.04, 0.25, 0.06],
      [0.33, 0.054, 0.38, 0.078],
      [0.71, 0.051, 0.28, 0.055],
      [1.02, 0.065, 0.19, 0.045],
      [1.14, 0.077, 0.095, 0.02],
    ],
    false,
    0.9,
  );
  dragonSpine(g, m, 0, 0.49, -0.21, 0.42);
  dragonScute(g, m.crest, 0, 0.424, 0.1, 0.35, 0.12, 0.44);
  dragonScute(g, m.crest, 0, 0.31, 0.38, 0.21, 0.07, 0.34);
  dragonScute(g, m.crest, 0, 0.24, 0.73, 0.19, 0.06, 0.27);
  for (const s of [-1, 1]) {
    const socket = cryptBall(g, m.dark, s * 0.47, 0.226, 0.163, 0.1, 0.14, 0.194);
    socket.rotation.z = -s * 0.22;
    const eye = cryptBall(g, m.eye, s * 0.532, 0.236, 0.17, 0.058, 0.069, 0.107);
    eye.rotation.z = -s * 0.19;
    cryptBall(g, m.dark, s * 0.587, 0.242, 0.183, 0.016, 0.057, 0.017);
    cryptBall(g, m.teeth, s * 0.582, 0.264, 0.203, 0.009, 0.009, 0.014);
    cryptSweep(
      g,
      m.crest,
      [
        [s * 0.32, 0.35, 0.4, 0.09],
        [s * 0.459, 0.386, 0.271, 0.13],
        [s * 0.49, 0.43, -0.052, 0.14],
        [s * 0.58, 0.4, -0.25, 0.035],
      ],
      12,
      3,
      0.73,
    );
    cryptSweep(
      g,
      m.vent,
      [
        [s * 0.405, 0.095, 0.34, 0.048],
        [s * 0.498, 0.114, 0.13, 0.07],
        [s * 0.51, 0.137, -0.03, 0.055],
        [s * 0.48, 0.22, -0.22, 0.008],
      ],
      10,
      3,
    );
    cryptBall(g, m.dark, s * 0.3, 0.219, 0.91, 0.079, 0.035, 0.086);
    cryptSweep(
      g,
      m.vent,
      [
        [s * 0.19, 0.215, 1.01, 0.028],
        [s * 0.291, 0.249, 0.96, 0.041],
        [s * 0.355, 0.235, 0.865, 0.032],
        [s * 0.335, 0.2, 0.81, 0.008],
      ],
      8,
      2,
    );
    // Temple horns sweep backwards from behind the eyes. Smaller cheek spurs fan below the main pair.
    dragonHorn(g, m, [s * 0.35, 0.39, -0.25], [s * 0.61, 0.71, -0.72], [s * 0.65, 1.04, -1.38], 0.183);
    dragonHorn(g, m, [s * 0.48, 0.28, -0.3], [s * 0.83, 0.45, -0.66], [s * 1.08, 0.59, -0.95], 0.129);
    dragonHorn(g, m, [s * 0.5, 0.04, -0.24], [s * 0.77, 0.12, -0.52], [s * 0.92, 0.18, -0.83], 0.125);
    dragonHorn(g, m, [s * 0.45, -0.12, -0.18], [s * 0.63, -0.17, -0.45], [s * 0.74, -0.23, -0.68], 0.084);
    cryptSweep(
      g,
      m.crest,
      [
        [s * 0.37, -0.043, 0.91, 0.033],
        [s * 0.38, -0.028, 0.71, 0.049],
        [s * 0.42, -0.016, 0.44, 0.051],
        [s * 0.459, 0.018, 0.22, 0.059],
        [s * 0.48, 0.047, -0.11, 0.094],
        [s * 0.44, 0.13, -0.26, 0.027],
      ],
      10,
      3,
      0.56,
    );
    cryptSweep(
      jaw,
      m.crest,
      [
        [s * 0.24, 0.07, 1.14, 0.021],
        [s * 0.334, 0.052, 0.89, 0.044],
        [s * 0.364, 0.037, 0.6, 0.055],
        [s * 0.428, 0.031, 0.31, 0.064],
        [s * 0.36, 0.036, 0.13, 0.025],
      ],
      9,
      2,
      0.61,
    );
    for (let i = 0; i < 3; i++) {
      const z = 0.11 - i * 0.157,
        w = 0.45 + i * 0.035;
      cryptPlate(
        g,
        m.crest,
        [
          [s * w, 0.18, z + 0.05],
          [s * (w + 0.035), 0.3, z + 0.04],
          [s * (w + 0.055), 0.27, z - 0.16],
          [s * (w + 0.09), 0.1, z - 0.23],
          [s * (w + 0.038), 0.08, z - 0.06],
        ],
        [s * (w + 0.104), 0.19, z - 0.078],
      );
    }
    cryptPlate(
      g,
      m.crest,
      [
        [s * 0.47, 0.24, 0.04],
        [s * 0.52, 0.3, -0.32],
        [s * 0.73, 0.33, -0.59],
        [s * 0.63, 0.08, -0.43],
        [s * 0.52, -0.09, -0.15],
      ],
      [s * 0.68, 0.16, -0.27],
    );
    for (let i = 0; i < 10; i++) {
      const z = 0.02 + i * 0.101 + 0.016 * Math.sin(i * 23.9 + s),
        a = 0.405 - 0.104 * z + 0.014 * Math.cos(i),
        fang = i === 2 || i === 7 ? 0.19 : 0.037 + 0.048 * (0.5 + 0.5 * Math.cos(i * 2.3));
      cryptSweep(
        g,
        m.teeth,
        [
          [s * a, -0.052, z, 0.042 + (i === 2 ? 0.01 : 0)],
          [s * (a + 0.008), -0.052 - fang * 0.49, z + 0.017, 0.029],
          [s * (a - 0.021), -0.052 - fang, z - 0.017, 0.003],
        ],
        7,
        2,
      );
      const b = a - 0.041;
      cryptSweep(
        jaw,
        m.teeth,
        [
          [s * b, 0.046, z + 0.18, 0.034],
          [s * b, 0.091, z + 0.19, 0.025],
          [s * (b - 0.01), 0.104 + fang * 0.26, z + 0.166, 0.002],
        ],
        6,
        2,
      );
    }
  }
  return { g, jaw };
}
function dragonLeg(parent, m, s, back) {
  const hip = cryptJoint(
    parent,
    back ? 'Тазобедренный сустав' : 'Лопатка',
    s * (back ? 0.57 : 0.62),
    back ? 1.93 : 2.19,
    back ? -1.11 : 0.88,
  );
  const kneeZ = back ? 0.49 : -0.3,
    kneeY = back ? -0.76 : -0.81;
  cryptSweep(
    hip,
    m.scales,
    [
      [0, 0.23, 0, back ? 0.35 : 0.27],
      [s * 0.14, -0.03, back ? 0.06 : -0.06, back ? 0.45 : 0.34],
      [s * 0.24, kneeY * 0.58, kneeZ * 0.58, back ? 0.385 : 0.29],
      [s * 0.33, kneeY, kneeZ, back ? 0.246 : 0.195],
    ],
    16,
    4,
  );
  dragonScute(hip, m.crest, s * 0.21, 0.22, 0, 0.32, 0.13, 0.48, s);
  const knee = cryptJoint(hip, 'Колено', s * 0.33, kneeY, kneeZ);
  const ankleY = back ? -0.69 : -0.98,
    ankleZ = back ? -0.67 : 0.27;
  cryptSweep(
    knee,
    m.scales,
    [
      [0, 0.1, 0, back ? 0.244 : 0.192],
      [s * 0.047, -0.19, ankleZ * 0.33, back ? 0.26 : 0.215],
      [s * 0.1, ankleY * 0.69, ankleZ * 0.69, 0.153],
      [s * 0.08, ankleY, ankleZ, 0.122],
    ],
    13,
    3,
  );
  const ankle = cryptJoint(knee, 'Запястье', s * 0.08, ankleY, ankleZ);
  const footY = back ? -0.36 : -0.27,
    footZ = back ? 0.3 : 0.22;
  cryptSweep(
    ankle,
    m.vent,
    [
      [0, 0.06, 0, 0.134],
      [s * 0.01, footY * 0.45, footZ * 0.24, 0.108],
      [s * 0.004, footY, footZ, 0.14],
      [0, footY - 0.027, footZ + 0.17, 0.103],
    ],
    12,
    3,
    0.79,
  );
  for (const fi of [-1, 0, 1]) {
    const wide = fi * 0.133;
    cryptSweep(
      ankle,
      m.vent,
      [
        [wide * 0.29, footY + 0.014, footZ + 0.013, 0.088],
        [wide * 0.97, footY - 0.021, footZ + 0.2, 0.077],
        [wide * 1.58, footY - 0.056, footZ + 0.37 - Math.abs(fi) * 0.073, 0.049],
      ],
      9,
      3,
      0.72,
    );
    dragonHorn(
      ankle,
      m,
      [wide * 1.53, footY - 0.04, footZ + 0.32 - Math.abs(fi) * 0.069],
      [wide * 1.79, footY - 0.07, footZ + 0.425 - Math.abs(fi) * 0.066],
      [wide * 1.89, footY - 0.104, footZ + 0.5 - Math.abs(fi) * 0.06],
      0.055,
    );
  }
  for (let i = 0; i < 4; i++) {
    const f = i / 3,
      rx = s * (0.14 + 0.14 * f),
      yy = -0.15 - 0.4 * f,
      zz = kneeZ * (0.18 + 0.5 * f);
    dragonScute(hip, m.crest, rx, yy + 0.12, zz, 0.2 - i * 0.018, 0.091, 0.29, s);
    dragonScute(
      knee,
      m.crest,
      s * 0.08,
      -0.19 - i * 0.136,
      ankleZ * (0.24 + 0.14 * i),
      0.135 - i * 0.013,
      0.07,
      0.18,
      s,
    );
  }
  cryptSweep(
    hip,
    m.crest,
    [
      [s * 0.19, 0.11, -0.1, 0.068],
      [s * 0.32, -0.17, kneeZ * 0.21, 0.104],
      [s * 0.34, -0.38, kneeZ * 0.58, 0.079],
      [s * 0.33, kneeY, kneeZ, 0.018],
    ],
    9,
    3,
    0.62,
  );
  return {
    hip,
    knee,
    ankle,
    s,
    back,
    kneeZ,
    kneeY,
    ankleY,
    ankleZ,
    toeY: footY - 0.072,
    toeZ: footZ + 0.279,
    l1: Math.hypot(kneeY, kneeZ),
    l2: Math.hypot(ankleY, ankleZ),
    a1: Math.atan2(kneeZ, -kneeY),
    a2: Math.atan2(ankleZ, -ankleY),
    contact: new THREE.Vector3(),
  };
}
function buildSargat() {
  const m = makeDragonMaterials(),
    g = new THREE.Group(),
    body = cryptJoint(g, 'Грудная клетка');
  g.name = dragonName;
  cryptBody(
    body,
    m.scales,
    [
      [-2.14, 1.84, 0.09, 0.11],
      [-1.92, 1.86, 0.41, 0.41],
      [-1.56, 1.93, 0.69, 0.62],
      [-1.22, 1.96, 0.78, 0.66],
      [-0.83, 1.98, 0.72, 0.65],
      [-0.49, 1.98, 0.66, 0.64],
      [-0.16, 2, 0.74, 0.72],
      [0.24, 2.04, 0.88, 0.83],
      [0.6, 2.1, 0.94, 0.9],
      [0.95, 2.17, 0.88, 0.86],
      [1.25, 2.21, 0.7, 0.72],
      [1.5, 2.27, 0.46, 0.54],
      [1.66, 2.31, 0.2, 0.28],
    ],
    false,
    0.92,
    36,
  );
  for (let i = 0; i < 13; i++) {
    const z = -1.7 + i * 0.24,
      back = 2.61 + 0.42 * Math.exp(-((z - 0.72) ** 2) / 0.57),
      n = 0.43 + 0.14 * Math.sin(i * 0.81);
    dragonSpine(body, m, 0, back - 0.08, z, n);
    for (const side of [-1, 1]) {
      dragonScute(
        body,
        m.crest,
        side * (0.37 + 0.15 * Math.exp(-((z - 0.74) ** 2) / 0.5)),
        back - 0.17,
        z,
        0.21,
        0.115,
        0.33,
        side,
      );
      const zz = 0.72 + 0.17 * Math.cos(i * 0.32);
      const y = 1.73 + 0.2 * Math.cos(i * 0.38);
      cryptSweep(
        body,
        m.vent,
        [
          [side * zz * 0.9, y + 0.12, z, 0.065],
          [side * zz * 0.79, y - 0.1, z + 0.07, 0.092],
          [side * zz * 0.47, y - 0.26, z + 0.1, 0.11],
          [0, y - 0.3, z + 0.08, 0.105],
        ],
        8,
        2,
        0.57,
      );
    }
  }
  const sections = [
    [-1.88, 1.87, 0.45, 0.44],
    [-1.53, 1.93, 0.69, 0.62],
    [-1.22, 1.96, 0.78, 0.66],
    [-0.83, 1.98, 0.72, 0.65],
    [-0.49, 1.98, 0.66, 0.64],
    [-0.16, 2, 0.74, 0.72],
    [0.24, 2.04, 0.88, 0.83],
    [0.6, 2.1, 0.94, 0.9],
    [0.95, 2.17, 0.88, 0.86],
    [1.25, 2.21, 0.7, 0.72],
    [1.5, 2.27, 0.46, 0.54],
  ];
  for (const side of [-1, 1])
    for (let k = 0; k < 5; k++)
      for (let j = 0; j < 11; j++) {
        const z = -1.64 + j * 0.278 + (k % 2) * 0.107,
          theta = -0.3 + k * 0.31;
        const surface = (theta, dz, raise) => {
          const zz = clamp(z + dz, sections[0][0], sections.at(-1)[0] - 0.0001),
            i = sections.findIndex(
              (r, k) => k < sections.length - 1 && zz >= r[0] && zz < sections[k + 1][0],
            ),
            a = sections[i],
            b = sections[i + 1],
            t = (zz - a[0]) / (b[0] - a[0]);
          const mid = a[1] * (1 - t) + b[1] * t,
            rx = a[2] * (1 - t) + b[2] * t,
            ry = a[3] * (1 - t) + b[3] * t;
          return [
            side * Math.cos(theta) * (rx * 1.035 + raise),
            mid + Math.sin(theta) * (ry * 1.035 + raise),
            zz,
          ];
        };
        const breadth = 0.195 + (k === 2 ? 0.043 : 0);
        cryptPlate(
          body,
          (j + k) % 4 ? m.crest : m.vent,
          [
            surface(theta - breadth, -0.042, 0.015),
            surface(theta - breadth * 0.72, 0.167, 0.018),
            surface(theta + 0.06, 0.197, 0.015),
            surface(theta + breadth, 0.099, 0.015),
            surface(theta + breadth, -0.066, 0.025),
            surface(theta - 0.05, -0.24, 0.073),
          ],
          surface(theta - 0.016, -0.048, 0.145),
        );
      }
  const neck = cryptJoint(body, 'Шея', 0, 2.31, 0.99);
  cryptSweep(
    neck,
    m.scales,
    [
      [0, 0, 0, 0.65],
      [0, 0.13, 0.37, 0.6],
      [0.017, 0.39, 0.79, 0.46],
      [0.015, 0.59, 1.15, 0.335],
      [0, 0.69, 1.57, 0.32],
    ],
    21,
    4,
  );
  for (let i = 0; i < 6; i++) {
    const p = i / 5,
      y = 0.01 + 0.69 * p,
      z = 0.12 + 1.32 * p,
      r = 0.54 - 0.24 * p;
    dragonSpine(neck, m, 0, y + r * 0.85, z, 0.48 - 0.2 * p);
    for (const s of [-1, 1])
      for (let j = 0; j < 3; j++) {
        const a = 0.17 + j * 0.45,
          arm = (a, dz, gap) => [
            s * Math.cos(a) * (r + gap),
            y + Math.sin(a) * (r + gap) + dz * 0.38,
            z + dz,
          ];
        cryptPlate(
          neck,
          j === 0 ? m.vent : m.crest,
          [
            arm(a - 0.22, 0.11, 0.035),
            arm(a + 0.17, 0.14, 0.035),
            arm(a + 0.26, -0.07, 0.05),
            arm(a + 0.03, -0.2, 0.095),
            arm(a - 0.2, -0.1, 0.04),
          ],
          arm(a + 0.03, -0.055, 0.135),
        );
      }
    cryptSweep(
      neck,
      m.vent,
      [
        [-r * 0.7, y - r * 0.42, z, 0.055],
        [0, y - r * 0.79, z + 0.055, 0.105],
        [r * 0.7, y - r * 0.42, z, 0.055],
      ],
      10,
      3,
      0.7,
    );
  }
  const { g: head, jaw } = dragonFace(neck, m);
  const legs = [];
  for (const s of [-1, 1]) for (const back of [false, true]) legs.push(dragonLeg(body, m, s, back));
  const tail = [];
  let parent = body;
  const widths = [0.495, 0.41, 0.315, 0.243, 0.18, 0.128, 0.078];
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i],
      length = 0.67 - i * 0.025,
      start = cryptJoint(
        parent,
        'Хвост ' + (i + 1),
        0,
        i ? -0.02 : 1.86,
        i ? -(0.67 - (i - 1) * 0.025) : -1.64,
      );
    const next = widths[i + 1] || 0.015;
    cryptSweep(
      start,
      m.scales,
      [
        [0, 0, 0.12, w],
        [0, 0.009, -length * 0.35, w * 0.88],
        [0, -0.02, -length, next * 1.07],
      ],
      13,
      3,
      0.88,
    );
    dragonSpine(start, m, 0, w * 0.67, -length * 0.21, 0.41 - i * 0.045, i % 2 ? 0.35 : -0.35);
    if (i === 6) {
      for (const s of [-1, 1])
        dragonHorn(
          start,
          m,
          [s * 0.031, 0.04, -0.3],
          [s * 0.097, 0.076, -0.49],
          [s * 0.13, 0.09, -0.67],
          0.045,
        );
    }
    tail.push(start);
    parent = start;
  }
  cryptFuse(body);
  const wings = [buildDragonWing(body, m, -1), buildDragonWing(body, m, 1)];
  const throat = beastPart(
    jaw,
    new THREE.SphereGeometry(1, 14, 10),
    m.throat,
    0,
    0.079,
    0.18,
    0.25,
    0.077,
    0.13,
  );
  return { g, body, head, neck, jaw, tail, legs, wings, throat, m, spread: 0.12, flap: 0, last: -1 };
}

// Solve each sagittal leg chain against the actual walkable mesh beneath its toe pads.
function plantDragonFoot(rig, leg, wave, gait, weight) {
  const { hip, knee, ankle, kneeY, kneeZ, ankleY, ankleZ, toeY, toeZ, contact } = leg;
  const z = hip.position.z + kneeZ + ankleZ + toeZ + 0.38 * gait * wave;
  contact.set(hip.position.x + knee.position.x + ankle.position.x, 0, z);
  rig.g.localToWorld(contact);
  contact.y =
    walkingSurface(contact.x, contact.z) +
    0.015 +
    0.21 * gait * Math.max(0, Math.cos(Math.asin(clamp(wave, -1, 1)))) * Math.max(0, wave);
  rig.body.worldToLocal(contact);
  const y = contact.y - hip.position.y - toeY,
    dz = contact.z - hip.position.z - toeZ;
  // A few centimetres of reach adjustment keep the pad planted across sharp breaks between height samples.
  const max = leg.l1 + leg.l2 - 0.003,
    ext =
      Math.hypot(y, dz) > max
        ? clamp(Math.abs(y) / Math.sqrt(Math.max(0.01, max * max - dz * dz)), 1, 1.25)
        : 1;
  hip.scale.y = 1 + (ext - 1) * weight;
  const yy = y / ext,
    d = clamp(Math.hypot(yy, dz), Math.abs(leg.l1 - leg.l2) + 0.001, max);
  const center = Math.atan2(dz, -yy),
    bend = Math.acos(clamp((leg.l1 * leg.l1 + d * d - leg.l2 * leg.l2) / (2 * leg.l1 * d), -1, 1));
  const phi = center + (leg.back ? bend : -bend),
    kneePhi = Math.atan2(dz - Math.sin(phi) * leg.l1, -yy - Math.cos(phi) * leg.l1);
  const hipAngle = leg.a1 - phi,
    kneeAngle = leg.a2 - kneePhi - hipAngle;
  hip.rotation.x += (hipAngle - hip.rotation.x) * weight;
  knee.rotation.x += (kneeAngle - knee.rotation.x) * weight;
  ankle.rotation.x += (-hipAngle - kneeAngle - ankle.rotation.x) * weight;
}
const wingSteps = 9,
  wingCross = 6,
  wingRays = 7;
function wingArmSurface(m) {
  const p = [],
    uv = [],
    indices = [],
    n = 18,
    rings = 17;
  for (let j = 0; j < rings; j++)
    for (let i = 0; i <= n; i++) {
      p.push(0, 0, 0);
      uv.push(i / n, (j / (rings - 1)) * 2.8);
      const k = p.length / 3 - 1;
      if (i && j) indices.push(k - n - 2, k - n - 1, k, k - n - 2, k, k - 1);
    }
  const mesh = new THREE.Mesh(cryptGeo(p, uv, indices), m.scales);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
function shapeWingArm(w) {
  const pos = w.arm.geometry.attributes.position.array,
    refs = [w.shoulder, w.elbow, w.wrist],
    up = w.up;
  let k = 0;
  for (let j = 0; j < 17; j++) {
    const arm = j < 8 ? 0 : 1,
      t = arm ? (j - 8) / 8 : j / 8,
      a = refs[arm],
      b = refs[arm + 1],
      axis = w.axis.subVectors(b, a).normalize();
    w.ortho.crossVectors(axis, up);
    if (w.ortho.lengthSq() < 0.001) w.ortho.set(0, 0, 1);
    w.ortho.normalize();
    w.vertical.crossVectors(axis, w.ortho);
    w.center.copy(a).lerp(b, t);
    w.center.x += w.side * (arm ? 0.067 : 0.095) * Math.sin(Math.PI * t);
    w.center.z += 0.089 * Math.sin(Math.PI * t) * (arm ? -1 : 1);
    const radius = arm
      ? 0.129 * (1 - t) + 0.082 * t + 0.039 * Math.sin(t * 2 * Math.PI)
      : 0.264 * (1 - t) + 0.13 * t + 0.06 * Math.sin(Math.PI * t);
    for (let i = 0; i <= 18; i++) {
      const angle = (i / 18) * Math.PI * 2,
        rx = radius * (1 + 0.055 * Math.cos(angle * 3)) * Math.cos(angle),
        ry = radius * (arm ? 0.71 : 0.84) * Math.sin(angle);
      pos[k++] = w.center.x + w.ortho.x * rx + w.vertical.x * ry;
      pos[k++] = w.center.y + w.ortho.y * rx + w.vertical.y * ry;
      pos[k++] = w.center.z + w.ortho.z * rx + w.vertical.z * ry;
    }
  }
  w.arm.geometry.attributes.position.needsUpdate = true;
  w.arm.geometry.computeVertexNormals();
}
function buildDragonWing(body, m, side) {
  const g = cryptJoint(body, side < 0 ? 'Левое крыло' : 'Правое крыло');
  const positions = [],
    uv = [],
    colors = [],
    indices = [];
  for (let panel = 0; panel < wingRays - 1; panel++) {
    const base = positions.length / 3;
    for (let j = 0; j <= wingSteps; j++)
      for (let i = 0; i <= wingCross; i++) {
        const t = j / wingSteps,
          v = i / wingCross,
          translucence = Math.sin(Math.PI * v) ** 0.52 * Math.sin(Math.PI * t) ** 0.38;
        positions.push(0, 0, 0);
        uv.push((panel + v) * 0.55, t * 1.7);
        colors.push(0.43 + 0.54 * translucence, 0.29 + 0.45 * translucence, 0.26 + 0.38 * translucence);
        if (i && j) {
          const k = base + j * (wingCross + 1) + i;
          indices.push(k - wingCross - 2, k - wingCross - 1, k, k - wingCross - 2, k, k - 1);
        }
      }
  }
  const geo = cryptGeo(positions, uv, indices);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geo.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.5, 0), 10);
  const leather = new THREE.Mesh(geo, m.skin);
  leather.castShadow = true;
  leather.receiveShadow = true;
  g.add(leather);
  const spars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.84, 1, 1, 9), m.ridge, 32);
  const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 9, 7), m.crest, 20);
  const nails = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), m.horn, 9);
  for (const mesh of [spars, joints, nails]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    g.add(mesh);
  }
  const arm = wingArmSurface(m);
  g.add(arm);
  const vec = () => new THREE.Vector3(),
    points = Array.from({ length: wingRays }, () => ({ tip: vec(), mid: vec() }));
  return {
    side,
    g,
    geo,
    arm,
    center: vec(),
    axis: vec(),
    ortho: vec(),
    vertical: vec(),
    spars,
    joints,
    nails,
    points,
    wrist: vec(),
    elbow: vec(),
    shoulder: vec(),
    up: new THREE.Vector3(0, 1, 0),
    temp: new THREE.Object3D(),
    a: vec(),
    b: vec(),
    tip: vec(),
    scratch: vec(),
    count: 0,
    knuckles: 0,
    claws: 0,
  };
}
function wingBezier(out, a, b, c, t) {
  const k = 1 - t;
  return out
    .copy(a)
    .multiplyScalar(k * k)
    .addScaledVector(b, 2 * k * t)
    .addScaledVector(c, t * t);
}
function wingRod(w, mesh, i, a, b, r) {
  const t = w.temp;
  t.position.copy(a).lerp(b, 0.5);
  w.scratch.subVectors(b, a);
  const len = w.scratch.length();
  t.quaternion.setFromUnitVectors(w.up, w.scratch.multiplyScalar(1 / Math.max(0.00001, len)));
  t.scale.set(r, len, r);
  t.updateMatrix();
  mesh.setMatrixAt(i, t.matrix);
}
function wingJoint(w, a, r) {
  const t = w.temp;
  t.position.copy(a);
  t.quaternion.identity();
  t.scale.setScalar(r);
  t.updateMatrix();
  w.joints.setMatrixAt(w.knuckles++, t.matrix);
}
function shapeWing(w, spread, flap) {
  const s = w.side,
    h = w.shoulder,
    e = w.elbow,
    p = w.wrist,
    rays = w.points,
    g = w.geo,
    pos = g.attributes.position.array;
  h.set(s * 0.71, 2.61, 0.6);
  e.set(s * (1.05 + 0.99 * spread), 2.19 + 0.56 * spread + flap * 0.64, -0.32 - 0.19 * spread);
  p.set(s * (1.35 + 1.97 * spread), 3.6 + 0.2 * spread + flap * 1.46, 1.24 + 0.52 * spread);
  for (let i = 0; i < dragonWingPlan.length; i++) {
    const [x, dx, z, dz, y, dy, lift] = dragonWingPlan[i];
    rays[i].tip.set(s * (x + dx * spread), y + dy * spread + flap * lift, z + dz * spread);
  }
  w.count = w.claws = w.knuckles = 0;
  shapeWingArm(w);
  wingJoint(w, h, 0.186);
  wingJoint(w, e, 0.145);
  wingJoint(w, p, 0.113);
  w.a.copy(p).addScaledVector(w.up, 0.13);
  w.b.copy(p);
  w.b.x += s * 0.18;
  w.b.y += 0.27;
  w.b.z += 0.27;
  wingRod(w, w.nails, w.claws++, w.a, w.b, 0.074);
  for (let i = 0; i < wingRays; i++) {
    const q = rays[i];
    q.mid.copy(p).lerp(q.tip, 0.48);
    q.mid.y += (i < 5 ? 0.46 - 0.052 * i : 0.1) * (1 - 0.21 * spread);
    q.mid.x += s * (i < 5 ? 0.16 : 0.03);
    q.mid.z += i < 5 ? 0.27 : -0.1;
    if (i === 6) q.mid.copy(e).multiplyScalar(2).addScaledVector(p, -0.5).addScaledVector(h, -0.5);
    if (i > 4) continue;
    const thick = (0.069 - 0.006 * i) * (i ? 0.96 : 1.54);
    wingBezier(w.a, p, q.mid, q.tip, 0.49);
    wingRod(w, w.spars, w.count++, p, w.a, thick);
    wingJoint(w, w.a, thick * 0.93);
    wingRod(w, w.spars, w.count++, w.a, q.tip, thick * 0.65);
    w.b.copy(q.tip).sub(w.a).normalize().multiplyScalar(0.17).add(q.tip);
    w.b.y -= 0.048;
    wingRod(w, w.nails, w.claws++, q.tip, w.b, 0.03 + (i === 0 ? 0.018 : 0));
  }
  let k = 0;
  for (let panel = 0; panel < wingRays - 1; panel++) {
    const left = rays[panel],
      right = rays[panel + 1];
    for (let j = 0; j <= wingSteps; j++)
      for (let i = 0; i <= wingCross; i++) {
        const t = j / wingSteps,
          v = i / wingCross,
          bow = Math.sin(v * Math.PI),
          q = t * (1 - (panel < 5 ? 0.145 : 0.055) * bow * t * t);
        wingBezier(w.a, p, left.mid, left.tip, q);
        wingBezier(w.b, p, right.mid, right.tip, q);
        w.a.lerp(w.b, v);
        w.a.y += bow * (0.12 + 0.078 * spread) * Math.sin(q * Math.PI * 1.12) - 0.115 * bow * q * q;
        pos[k++] = w.a.x;
        pos[k++] = w.a.y;
        pos[k++] = w.a.z;
      }
  }
  for (const [mesh, count] of [
    [w.spars, w.count],
    [w.joints, w.knuckles],
    [w.nails, w.claws],
  ]) {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
}
function poseSargat(rig, d, t) {
  let u = d.span ? clamp(1 - d.left / d.span, 0, 1) : 0;
  const fall = d.hp <= 0 ? clamp(d.fall || 0, 0, 1) : 0,
    alive = 1 - fall,
    mode = d.mode,
    air = clamp(d.lift / 3, 0, 1),
    beat = Math.sin(d.anim * 3.6);
  const closed = mode === 'roar' || mode === 'takeoff' || mode === 'descend';
  const spread = fall
    ? 0.3
    : mode === 'takeoff' || mode === 'descend' || air
      ? dragonFlightSpread(d, u)
      : mode === 'roar'
        ? 0.11 + 0.11 * Math.sin(u * Math.PI)
        : mode === 'recover'
          ? 0.3
          : mode === 'inhale' || mode === 'flame'
            ? 0.45
            : mode === 'charge' || mode === 'chargeWind'
              ? 0.25
              : 0.115;
  const dt = rig.last < 0 ? 0.1 : Math.min(0.2, Math.max(0, t - rig.last));
  rig.last = t;
  const gain = 1 - Math.exp(-dt * 6.2);
  rig.spread = fall >= 1 ? spread : rig.spread + gain * (spread - rig.spread);
  const flap =
    air * (mode === 'descend' || mode === 'orbit' ? beat * 0.76 : beat * 0.94) +
    (mode === 'roar' ? 0.3 * Math.sin(u * Math.PI) : 0);
  for (const w of rig.wings) shapeWing(w, rig.spread, flap * alive - fall * 0.68);
  const gait = (mode === 'hunt' ? 0.7 : mode === 'charge' ? 1.05 : 0) * alive,
    footBeat = d.anim * (mode === 'charge' ? 9.1 : 4.4);
  const sway = Math.sin(d.anim * 1.73),
    inhale = mode === 'inhale' ? Math.sin(u * Math.PI * 0.5) : 0,
    fire = mode === 'flame' ? 1 : 0;
  const cast = mode === 'cast' ? 1 : 0;
  const bow = mode === 'chargeWind' ? Math.sin(u * Math.PI * 0.5) : mode === 'charge' ? 1 : 0;
  const snap = mode === 'bite' ? Math.sin(u * Math.PI) : 0,
    rear = mode === 'roar' ? Math.sin(Math.PI * u) : 0,
    rest = mode === 'recover' ? Math.sin(u * Math.PI) : 0;
  rig.body.position.y =
    -0.1 + 0.026 * sway * alive + 0.043 * Math.abs(Math.sin(footBeat)) * gait - 0.49 * fall;
  rig.body.rotation.set(
    (-0.032 * sway - 0.043 * gait * Math.cos(footBeat)) * 0.5 * alive - 0.05 * air,
    0.0,
    -0.98 * terrainFade(0, 1, fall),
  );
  rig.neck.rotation.x =
    (-0.12 * inhale + 0.21 * fire + 0.24 * bow + 0.25 * rear - 0.16 * rest - 0.08 * snap + 0.047 * sway) *
      alive +
    0.42 * fall;
  rig.neck.rotation.y = (0.12 * Math.sin(d.anim * 0.93) - 0.16 * snap) * alive - 0.16 * fall;
  rig.head.rotation.x =
    (0.065 * Math.sin(d.anim * 1.05) + 0.27 * snap - 0.15 * rear + 0.12 * bow + 0.1 * fire) * alive +
    0.11 * fall;
  rig.head.rotation.y =
    ((mode === 'flame' ? angles(dragonBreathAngle(d) - d.yaw) * 0.91 : 0) +
      0.09 * Math.sin(d.anim * 0.8 - 0.6)) *
    alive;
  rig.jaw.rotation.x =
    (0.07 +
      0.035 * sway -
      0.07 * rear +
      0.41 * inhale +
      0.48 * fire +
      0.4 * cast +
      0.48 * snap +
      0.34 * rest) *
      alive +
    0.16 * fall;
  rig.throat.scale.set(0.22, 0.06 + (inhale + fire) * 0.09, 0.16 + (inhale + fire) * 0.05);
  rig.m.throat.emissiveIntensity = 0.12 + 2.6 * inhale + 3.0 * fire + 2.2 * cast + 1.1 * rest;
  rig.m.vent.emissive.setHex(0x853012);
  rig.m.vent.emissiveIntensity = closed ? 0 : 0.08 + 0.26 * rest + 0.24 * inhale + 0.3 * fire;
  rig.m.skin.emissiveIntensity = air && !closed ? 0.38 : 0.13;
  for (let i = 0; i < rig.tail.length; i++) {
    const a = rig.tail[i];
    a.rotation.y = (0.13 * Math.sin(d.anim * 1.42 - i * 0.48) + 0.04 * i) * alive + 0.11 * fall;
    a.rotation.x = (-0.034 + 0.043 * Math.sin(d.anim * 1.6 - i * 0.4)) * alive - 0.018 * fall;
  }
  for (const leg of rig.legs) {
    const wave = Math.sin(footBeat + (leg.s > 0 ? Math.PI : 0) + (leg.back ? Math.PI : 0));
    leg.hip.scale.set(1, 1, 1);
    leg.hip.rotation.x = gait * 0.41 * wave + air * (leg.back ? -0.97 : 0.92) - fall * 0.33;
    leg.hip.rotation.z = leg.s * (-0.055 * air + fall * 0.36);
    leg.knee.rotation.x = -0.35 * gait * Math.max(0, -wave) + air * (leg.back ? 1.43 : -1.69) + 0.48 * fall;
    leg.ankle.rotation.x = 0.1 * gait * wave + air * (leg.back ? -0.68 : 0.76) + 0.13 * fall;
    if (air < 0.95 && fall < 0.045) plantDragonFoot(rig, leg, wave, gait, 1 - air);
  }
}

// Three crossed strips form a travelling flame. Noise runs along the jet, leaving the bright throat visible at the source.
function dragonFireMesh() {
  const p = [],
    uv = [],
    ix = [];
  for (let k = 0; k < 3; k++)
    for (let j = 0; j <= 18; j++)
      for (let side = 0; side < 2; side++) {
        const z = j / 18,
          a = (k * Math.PI) / 3,
          r = (0.083 + 0.97 * z ** 0.72) * (side ? 1 : -1);
        p.push(Math.cos(a) * r, Math.sin(a) * r + 0.12 * z, z);
        uv.push(z, side);
        if (j && side) {
          const n = p.length / 3 - 1;
          ix.push(n - 3, n - 2, n, n - 3, n, n - 1);
        }
      }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      'varying vec2 v; uniform float uTime; void main(){v=uv; vec3 p=position; float wave=sin(uv.x*21.-7.*uTime)*.058+sin(uv.x*43.-11.*uTime)*.030; p.y+=uv.x*(wave+.095*sin(uv.x*8.-2.*uTime)); p.x+=uv.x*.08*cos(uv.x*9.-2.6*uTime);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: `
      varying vec2 v; uniform float uTime; uniform float uPower;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      void main(){float z=v.x,y=(v.y-.5)*2.; vec2 st=vec2(z*12.-uTime*11.,y*4.);
      float a=n(st)*.57+n(st*2.17)*.29+n(st*4.14)*.14;
      float edge=1.-abs(y)+(a-.52)*(.38+1.46*z);
      float core=clamp(edge*1.40-z*.87+(a-.5)*1.21,0.,1.);
      vec3 col=mix(vec3(.67,.045,.009),vec3(1.,.51,.037),smoothstep(.06,.66,core));
      col=mix(col,vec3(1.,.96,.66),smoothstep(.65,.96,core));
      float alpha=smoothstep(.04,.54,edge)*smoothstep(.0,.055,z+0.035)*(1.-smoothstep(.69,1.,z+.14*(.56-a)))*uPower;
      if(alpha<.045)discard; gl_FragColor=vec4(col,alpha*.94);
      #include <colorspace_fragment>
      }`,
  });
  const jet = new THREE.Mesh(cryptGeo(p, uv, ix), mat);
  jet.frustumCulled = false;
  jet.renderOrder = 4;
  return jet;
}
function buildDragonScene(realm) {
  const rig = buildSargat(),
    fx = new THREE.Group();
  realm.scene.add(rig.g, fx);
  const jet = dragonFireMesh();
  fx.add(jet);
  const cinders = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: 0xffa545, toneMapped: false }),
    32,
  );
  cinders.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cinders.frustumCulled = false;
  fx.add(cinders);
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.37, 2),
    new THREE.MeshBasicMaterial({ color: 0xffd772 }),
  );
  fx.add(orb);
  const corona = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.68, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff7729,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
      depthWrite: false,
    }),
  );
  orb.add(corona);
  const p = [],
    uv = [],
    ix = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i <= 96; i++)
      for (let side = 0; side < 2; side++) {
        p.push(0, 0, 0);
        uv.push(i / 96, side);
        const k = p.length / 3 - 1;
        if (i && side) ix.push(k - 3, k - 2, k, k - 3, k, k - 1);
      }
  const geo = cryptGeo(p, uv, ix),
    sigil = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xffb942,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
  sigil.frustumCulled = false;
  fx.add(sigil);
  const loot = new THREE.Group();
  fx.add(loot);
  const amber = new THREE.MeshStandardMaterial({
    color: 0xf6a03f,
    emissive: 0xd97c12,
    emissiveIntensity: 0.42,
    roughness: 0.27,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  dragonScute(loot, amber, 0, 0.1, 0, 0.16, 0.15, 0.25);
  dragonScute(loot, amber, 0.09, 0.07, -0.12, 0.14, 0.13, 0.19);
  const shade = footShade();
  realm.scene.add(shade);
  shade.scale.set(2.47, 1, 5.48);
  return {
    rig,
    fx,
    jet,
    orb,
    corona,
    sigil,
    loot,
    shade,
    cinders,
    ember: new THREE.Object3D(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1),
    lastWing: -Infinity,
  };
}
function paintDragonMark(scene, d, t) {
  const progress = clamp(1 - d.left / d.span, 0, 1),
    impact = d.mode === 'impact',
    remaining = d.mode === 'brand' ? progress * 0.47 : d.mode === 'cast' ? 0.47 + progress * 0.53 : 1;
  const pos = scene.sigil.geometry.attributes.position.array;
  let k = 0;
  const groundKey = d.markX + ',' + d.markZ;
  if (scene.markKey !== groundKey) {
    scene.markKey = groundKey;
    scene.markGround = Array.from({ length: 97 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2;
      return Array.from({ length: 8 }, (_, n) =>
        walkingSurface(d.markX + Math.sin(a) * n * 0.53, d.markZ + Math.cos(a) * n * 0.53),
      );
    });
  }
  const fill = impact ? 2.7 + 0.56 * progress : 2.8 * remaining;
  for (let j = 0; j < 3; j++)
    for (let i = 0; i <= 96; i++)
      for (let side = 0; side < 2; side++) {
        const a = (i / 96) * Math.PI * 2,
          sector = Math.floor((i % 96) / 4),
          r0 = j === 0 ? 2.8 : j === 1 ? fill : 2.54;
        const r = r0 + (side ? 1 : -1) * (j === 0 ? 0.055 : j === 1 ? 0.07 : sector % 2 ? 0.0 : 0.045);
        const n = clamp(Math.floor(r / 0.53), 0, 6),
          p = clamp(r / 0.53 - n, 0, 1),
          g = scene.markGround[i];
        pos[k++] = d.markX + Math.sin(a) * r;
        pos[k++] = g[n] + (g[n + 1] - g[n]) * p + 0.13;
        pos[k++] = d.markZ + Math.cos(a) * r;
      }
  scene.sigil.geometry.attributes.position.needsUpdate = true;
  scene.sigil.material.color.set(impact ? 0xff7734 : d.mode === 'cast' ? 0xff944a : 0xffca66);
  scene.sigil.material.opacity = impact ? 1 - progress : 0.78 + 0.18 * Math.sin(t * 12);
}
function renderDragonEffects(scene, d, t, s) {
  const { rig, jet, orb, corona, sigil, loot, from, to, dir } = scene;
  jet.visible = d.mode === 'flame';
  orb.visible = d.mode === 'cast';
  sigil.visible = ['brand', 'cast', 'impact'].includes(d.mode);
  scene.cinders.visible = jet.visible || d.mode === 'impact';
  loot.visible = d.hp <= 0 && !d.looted && d.fall > 0.75;
  if (jet.visible) {
    rig.head.updateWorldMatrix(true, false);
    from.set(0, -0.18, 0.91).applyMatrix4(rig.head.matrixWorld);
    const ray = dragonFirePath(d);
    to.set(nearest(ray.tx, s.x), ray.ty, nearest(ray.tz, s.z));
    jet.position.copy(from);
    dir.subVectors(to, from);
    const n = dir.length();
    jet.quaternion.setFromUnitVectors(scene.forward, dir.multiplyScalar(1 / Math.max(0.001, n)));
    jet.scale.set(0.35 + 0.131 * ray.len, 0.32 + 0.117 * ray.len, n);
    for (let i = 0; i < scene.cinders.count; i++) {
      const u = (t * (0.56 + (i % 4) * 0.064) + i * 0.728) % 1,
        a = i * 2.39996 + t * 0.54,
        wide = 0.074 + u ** 1.14 * 1.54,
        side = Math.cos(a) * wide;
      scene.ember.position.copy(from).lerp(to, u);
      scene.ember.position.x += ray.cs * side;
      scene.ember.position.z -= ray.sn * side;
      scene.ember.position.y += Math.sin(a) * wide + 0.32 * u * u;
      const size = 0.018 + 0.043 * Math.sin(u * Math.PI);
      scene.ember.scale.set(size, size * 0.74, size);
      scene.ember.updateMatrix();
      scene.cinders.setMatrixAt(i, scene.ember.matrix);
    }
    scene.cinders.instanceMatrix.needsUpdate = true;
    jet.material.uniforms.uTime.value = t;
    jet.material.uniforms.uPower.value = Math.min(1, (d.span - d.left) * 6, d.left * 5 + 0.12);
  }
  if (d.mode === 'impact') {
    const u = 1 - d.left / d.span,
      cy = walkingSurface(d.markX, d.markZ);
    for (let i = 0; i < scene.cinders.count; i++) {
      const a = i * 2.39996,
        dist = (0.51 + (i % 7) * 0.33) * u,
        rad = 0.09 + 0.1 * (1 - u);
      scene.ember.position.set(
        d.markX + Math.sin(a) * dist,
        cy + 0.16 + (0.5 + (i % 5) * 0.29) * Math.sin(Math.PI * u),
        d.markZ + Math.cos(a) * dist,
      );
      scene.ember.scale.set(rad, rad * 1.7, rad);
      scene.ember.updateMatrix();
      scene.cinders.setMatrixAt(i, scene.ember.matrix);
    }
    scene.cinders.instanceMatrix.needsUpdate = true;
  }
  if (orb.visible) {
    const a = dragonOrbFlight(d);
    orb.position.set(nearest(a.x, s.x), a.y, nearest(a.z, s.z));
    orb.scale.setScalar(0.91 + 0.13 * Math.sin(t * 14));
    corona.rotation.set(2 * t, t, t * 0.7);
  }
  if (sigil.visible) paintDragonMark(scene, d, t);
  if (loot.visible) {
    const x = d.x + 0.87 * Math.cos(d.yaw),
      z = d.z - 0.87 * Math.sin(d.yaw);
    loot.position.set(nearest(x, s.x), walkingSurface(x, z) + 0.15, nearest(z, s.z));
    loot.rotation.y = d.yaw + 0.2;
  }
}
function drawDragon(realm, s, t) {
  const d = s.dragon,
    range = d ? distance(d, s) : Infinity,
    visible = !!d && !s.inside && !s.dungeon && range < 74;
  if (!realm.sargat && !visible) return;
  const scene = (realm.sargat ||= buildDragonScene(realm));
  scene.rig.g.visible = scene.fx.visible = scene.shade.visible = visible;
  if (!visible) return;
  const g = scene.rig.g,
    floor = walkingSurface(d.x, d.z),
    c = Math.cos(d.yaw),
    sn = Math.sin(d.yaw);
  g.position.set(nearest(d.x, s.x), floor + d.lift, nearest(d.z, s.z));
  const slope = clamp(
    (walkingSurface(d.x + sn * 0.9, d.z + c * 0.9) - walkingSurface(d.x - sn * 0.9, d.z - c * 0.9)) / 1.8,
    -0.46,
    0.46,
  );
  const cross = clamp(
    (walkingSurface(d.x + c * 0.7, d.z - sn * 0.7) - walkingSurface(d.x - c * 0.7, d.z + sn * 0.7)) / 1.4,
    -0.38,
    0.38,
  );
  const grounded = 1 - clamp(d.lift, 0, 1);
  g.rotation.set(-Math.atan(slope) * grounded, d.yaw, Math.atan(cross) * grounded, 'YXZ');
  if (
    t < scene.lastWing ||
    range < 30 ||
    t - scene.lastWing > (range < 45 ? 0.045 : 0.1) ||
    scene.rig.last < 0
  ) {
    poseSargat(scene.rig, d, t);
    scene.lastWing = t;
  }
  scene.shade.position.set(g.position.x, floor + 0.043, g.position.z);
  scene.shade.rotation.set(-Math.atan(slope), d.yaw, Math.atan(cross), 'YXZ');
  scene.shade.scale.set(2.27 + d.lift * 0.073, 1, 4.64 + d.lift * 0.072);
  scene.shade.visible = d.lift < 6 && range < 41;
  renderDragonEffects(scene, d, t, s);
}
