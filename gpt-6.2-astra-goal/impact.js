'use strict';

// Bearings live in world space. Turning toward the source moves the marker from behind to ahead.
const blow = {
  map: '',
  xSpeed: 0,
  zSpeed: 0,
  age: Infinity,
  power: 0,
  bearing: 0,
  damage: 0,
  nextBeat: 0,
  marks: [],
  slot: 0,
  strikingAt: -Infinity,
};
const enemyFlinches = new WeakMap();
const touchImpactControls = matchMedia('(pointer: coarse)');
const calmImpactCamera = matchMedia('(prefers-reduced-motion: reduce)');
const hitDirections = [
  'спереди',
  'спереди справа',
  'справа',
  'сзади справа',
  'со спины',
  'сзади слева',
  'слева',
  'спереди слева',
];

function impactRegion(g) {
  return g.delivery ? 'coach' : g.march ? 'lake' : g.dungeon || g.inside || 'country';
}
function resetImpacts(g) {
  Object.assign(blow, {
    map: impactRegion(g),
    xSpeed: 0,
    zSpeed: 0,
    age: Infinity,
    power: 0,
    bearing: 0,
    damage: 0,
    nextBeat: 0.65,
    slot: 0,
    strikingAt: -Infinity,
  });
  blow.marks.length = 0;
  drawImpactHud(g);
}
function receiveImpact(g, source, amount) {
  const region = impactRegion(g);
  if (region !== blow.map) resetImpacts(g);
  const p = g.march || (g.dungeon ? dungeonPlayer() : g);
  let dx = source ? source.x - p.x : -Math.sin(g.yaw);
  let dz = source ? source.z - p.z : -Math.cos(g.yaw);
  if (region === 'country') {
    dx = wrapped(dx);
    dz = wrapped(dz);
  }
  const bearing = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, -dz) : -g.yaw;
  const force = (4.5 + Math.min(32, amount) * 0.23) * (source?.ranged ? 0.59 : 1);
  blow.xSpeed -= Math.sin(bearing) * force;
  blow.zSpeed += Math.cos(bearing) * force;
  const cap = 11.5 / Math.max(11.5, Math.hypot(blow.xSpeed, blow.zSpeed));
  blow.xSpeed *= cap;
  blow.zSpeed *= cap;
  blow.power = Math.min(1.12, 0.61 + amount * 0.021);
  blow.bearing = bearing;
  blow.damage = amount;
  blow.age = 0;
  blow.slot = (blow.slot + 1) % 3;
  blow.marks[blow.slot] = { bearing, age: 0 };
  const pan = Math.sin(bearing + g.yaw) * 0.8;
  resonantFoley(source?.ranged ? 132 : 100, 0.18, 0.17 * blow.power, 41, 0, pan);
  noiseFoley(source?.ranged ? 0.075 : 0.12, 740, 0.16 * blow.power, pan);
  drawImpactHud(g);
}

function stepImpacts(g, dt) {
  if (impactRegion(g) !== blow.map) resetImpacts(g);
  blow.age += dt;
  for (const marker of blow.marks) if (marker) marker.age += dt;
  if (Math.abs(blow.xSpeed) + Math.abs(blow.zSpeed) > 0.022) {
    // Integrate exponential drag exactly, then use each scene's normal swept collision movement.
    const drag = Math.exp(-6.1 * dt),
      span = (1 - drag) / 6.1;
    const dx = blow.xSpeed * span,
      dz = blow.zSpeed * span;
    if (g.march) marchMove(g.march, dx, dz);
    else if (g.dungeon) dungeonMove(g, dx, dz, bodyRadius(g), true);
    else if (!g.inside && !g.delivery) move(g, dx, dz);
    blow.xSpeed *= drag;
    blow.zSpeed *= drag;
  }
  if (g.health > 0 && g.health / maxHealth(g) <= 0.3 && !g.delivery) {
    blow.nextBeat -= dt;
    if (blow.nextBeat <= 0) {
      const distress = 1 - g.health / (0.3 * maxHealth(g));
      blow.nextBeat = 1.12 - 0.34 * distress;
      if (document.hidden) return;
      resonantFoley(74, 0.145, 0.074 + distress * 0.04, 43);
      resonantFoley(69, 0.11, 0.047, 37, 0.165);
    }
  } else blow.nextBeat = 0.18;
}

function drawImpactHud(g) {
  const alive = g.health > 0 && !g.delivery;
  const fraction = g.health / maxHealth(g);
  const low = alive && fraction <= 0.3,
    critical = low && fraction <= 0.15;
  const play = $('play'),
    vitals = $('health-warning');
  play.classList.toggle('health-low', low);
  play.classList.toggle('health-critical', critical);
  const remedy = touchImpactControls.matches ? 'Кнопка «Бинт»' : 'H — бинт';
  const warning = low
    ? (critical ? 'На исходе сил' : 'Мало здоровья') + ' · ' + (g.bandages ? remedy : 'Бинтов нет')
    : '';
  if (vitals.textContent !== warning) vitals.textContent = warning;

  const show = alive && blow.age < 1.05;
  const pulse = show ? Math.min(1, blow.power * 1.32 * Math.exp(-2.8 * Math.max(0, blow.age - 0.1))) : 0;
  const edge = $('hurt');
  edge.style.opacity = pulse.toFixed(3);
  const message = $('impact-call');
  message.hidden = !show;
  if (show) {
    const relative = angles(blow.bearing + g.yaw);
    const index = ((Math.round((relative * 4) / Math.PI) % 8) + 8) % 8;
    const words = 'Удар ' + hitDirections[index] + '  ·  −' + Math.round(blow.damage);
    if (message.textContent !== words) message.textContent = words;
    message.style.opacity = Math.min(1, Math.max(0, (1.05 - blow.age) * 4)).toFixed(2);
    edge.style.setProperty('--hit-x', (50 + Math.sin(relative) * 50).toFixed(1) + '%');
    edge.style.setProperty('--hit-y', (50 - Math.cos(relative) * 50).toFixed(1) + '%');
  }
  const arcs = $('hit-arc').children;
  for (let i = 0; i < arcs.length; i++) {
    const marker = blow.marks[i],
      visible = alive && marker && marker.age < 1.15;
    arcs[i].hidden = !visible;
    if (!visible) continue;
    arcs[i].style.transform = 'rotate(' + angles(marker.bearing + g.yaw).toFixed(4) + 'rad)';
    arcs[i].style.opacity = Math.min(1, (1.15 - marker.age) * 1.7).toFixed(2);
  }
}
function impactCamera(camera, g) {
  if (!prefs.motion || calmImpactCamera.matches || prologue || blow.map !== impactRegion(g)) return;
  const t = blow.age;
  if (t < 0.52) {
    const kick = Math.sin(t * 24 + 0.35) * Math.exp(-8 * t) * blow.power;
    const angle = blow.bearing + g.yaw;
    camera.rotation.z += Math.sin(angle + 0.19) * kick * 0.066;
    camera.rotation.x -= Math.cos(angle) * kick * 0.088;
    camera.position.y -= Math.abs(kick) * 0.095;
  }
  const contact = gameTime - blow.strikingAt;
  if (contact >= 0 && contact < 0.17)
    camera.rotation.x += Math.sin(contact * 36) * Math.exp(-contact * 19) * 0.023;
}
function bladeContact(target, heavy) {
  if (game.dungeon || game.march || !game.actors.includes(target)) return;
  const dx = wrapped(target.x - game.x),
    dz = wrapped(target.z - game.z);
  const length = Math.hypot(dx, dz) || 1;
  enemyFlinches.set(target, { at: gameTime, dx: dx / length, dz: dz / length, heavy });
  blow.strikingAt = gameTime;
  resonantFoley(heavy ? 112 : 148, 0.13, heavy ? 0.11 : 0.074, 60);
  if (target.hp > 0)
    move(target, (dx / length) * (heavy ? 0.37 : 0.13), (dz / length) * (heavy ? 0.37 : 0.13));
}
function drawEnemyFlinch(model, actor, t) {
  const hit = enemyFlinches.get(actor);
  if (!hit || actor.hp <= 0) return;
  const age = t - hit.at;
  if (age < 0 || age > 0.42) return;
  const tilt = Math.sin(Math.min(1, age / 0.42) * Math.PI) * Math.exp(-age * 3.4) * (hit.heavy ? 0.27 : 0.17);
  // The skeleton continues its attack or recovery inside the world-space recoil.
  model.rotateX((hit.dx * Math.sin(actor.angle) + hit.dz * Math.cos(actor.angle)) * tilt);
  model.rotateZ((-hit.dx * Math.cos(actor.angle) + hit.dz * Math.sin(actor.angle)) * tilt);
}
