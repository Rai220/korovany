// ИИ: стража, партизаны, легион, торговцы, шпионы, налёты и отряды.
import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { clamp, dist2D, wrapAngle, angleTowards, lerp } from '../core/mathutil.js';
import { Rand } from '../core/rng.js';
import { createHumanoid, updateHumanoid, turnTo, bark, setWeapon, healHumanoid, setHumanoidShadow } from '../entities/humanoid.js';
import { heightAt, roadPointAt, roadLength, zoneAt, placeNear, WATER_Y } from '../world/terrain.js';
import { lineOfSight, resolveCollisions } from '../world/collision.js';
import { meleeSwing, spawnArrow, isHostile, isHostileToPlayer } from './combat.js';
import { SPAWNS } from '../world/settlements.js';

const troops = [];
const SQUADS = [];
let raidTimer = 45;

export function spawnNPC(opts = {}) {
  const e = createHumanoid(opts);
  e.ai.home.x = opts.x; e.ai.home.z = opts.z;
  e.ai.homeR = opts.homeR || 14;
  e.ai.role = opts.aiRole || null;
  e.ai.disguise = !!opts.disguise;
  e.ai.squad = opts.squad || null;
  e.ai.command = opts.command || 'follow';
  e.ai.patrol = opts.patrol || null;
  e.ai.guardSpot = opts.guardSpot || null;
  if (opts.name) e.name = opts.name;
  if (opts.hpMul) { e.hp *= opts.hpMul; e.hpMax *= opts.hpMul; }
  if (opts.dmgMul) e.dmg *= opts.dmgMul;
  if (opts.elite) { e.elite = true; e.hp *= 1.4; e.hpMax *= 1.4; e.dmg *= 1.3; }
  e.pos.set(opts.x, opts.y !== undefined ? opts.y : heightAt(opts.x, opts.z), opts.z);
  G.scene.add(e.group);
  G.entities.push(e);
  if (e.ai.squad) e.ai.squad.push(e);
  return e;
}

export function spawnInitialPopulation() {
  const rnd = new Rand(G.seed ^ 0x77aa);
  for (const s of SPAWNS) {
    for (let i = 0; i < (s.n || 1); i++) {
      const a = rnd.float() * Math.PI * 2, r = Math.sqrt(rnd.float()) * (s.r || 10);
      const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      spawnNPC({
        role: s.role, faction: s.faction, x, z, homeR: (s.r || 10) * 0.8,
        aiRole: s.role, patrol: s.role === 'guard' || s.role === 'legion' || s.role === 'elf_archer' ? makePatrol(x, z, s.r) : null,
      });
    }
  }
  // торговцы в лавках
  for (const shop of G.worldShops) {
    spawnNPC({ role: shop.npcRole, faction: shop.faction, x: shop.x + 1.5, z: shop.z + 1.5, homeR: 3, aiRole: 'shopkeeper', name: shop.name.split(' ').slice(-1)[0] });
  }
  // капитан стражи и старейшина уже в спавнах; добавим офицеров легиона
  return G.entities.length;
}

function makePatrol(x, z, r) {
  const pts = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r * 0.8, pz = z + Math.sin(a) * r * 0.8;
    pts.push({ x: px, z: pz });
  }
  return pts;
}

// ------------------------- отряды -------------------------
export function createSquad(faction, leader, opts = {}) {
  const squad = [];
  squad.leader = leader;
  squad.faction = faction;
  squad.command = 'follow';
  squad.target = null;
  squad.targetPoint = null;
  SQUADS.push(squad);
  if (leader) leader.ai.squad = squad;
  return squad;
}
export function fillSquad(squad, composition, x, z) {
  const rnd = new Rand(Math.floor(Math.random() * 1e9));
  for (const c of composition) {
    for (let i = 0; i < c.n; i++) {
      const a = rnd.float() * 6.28, r = 2 + rnd.float() * 5;
      const e = spawnNPC({
        role: c.role, faction: squad.faction, x: x + Math.cos(a) * r, z: z + Math.sin(a) * r,
        homeR: 40, squad, aiRole: 'squad', hpMul: c.hpMul || 1, dmgMul: c.dmgMul || 1, elite: c.elite,
      });
      e.ai.command = 'follow';
      squad.push(e);
    }
  }
  return squad;
}
export function commandSquad(squad, cmd, target = null) {
  squad.command = cmd;
  squad.target = target;
  for (const e of squad) {
    if (!e || e.dead) continue;
    e.ai.command = cmd;
    if (cmd === 'attack' && target) { e.ai.target = target; e.ai.alert = 20; }
    if (cmd === 'hold') { e.ai.holdPoint = { x: e.pos.x, z: e.pos.z }; e.ai.target = null; }
    if (cmd === 'follow') e.ai.target = null;
  }
}
export function squadAlive(squad) { return squad.filter((e) => e && !e.dead).length; }

// ------------------------- налёты -------------------------
export function spawnRaid(faction, placeId, count = 6, opts = {}) {
  const place = placeNear(placeId) || { x: 0, z: 0 };
  const from = opts.from || spawnEdgeFor(faction, place);
  const rnd = new Rand(Math.floor(Math.random() * 1e9));
  const roster = faction === 'elves' ? ['partisan', 'elf_archer', 'partisan']
    : faction === 'empire' ? ['guard', 'archer', 'guard']
      : faction === 'villain' ? ['legion', 'dark_archer', 'brute']
        : ['bandit', 'bandit', 'bandit'];
  const group = [];
  for (let i = 0; i < count; i++) {
    const role = roster[i % roster.length];
    const a = rnd.float() * 6.28, r = rnd.float() * 8;
    const e = spawnNPC({ role, faction, x: from.x + Math.cos(a) * r, z: from.z + Math.sin(a) * r, homeR: 200, aiRole: 'raider' });
    e.ai.raid = { target: { x: place.x, z: place.z }, placeId, timer: 260 };
    e.ai.state = 'raid';
    group.push(e);
  }
  emit('raid', { faction, place: placeId, count, group });
  return group;
}
function spawnEdgeFor(faction, place) {
  if (faction === 'elves') return { x: place.x - 120, z: place.z - 120 };
  if (faction === 'empire') return { x: place.x + 120, z: place.z + 60 };
  if (faction === 'villain') return { x: place.x + 130, z: place.z - 110 };
  return { x: place.x - 140, z: place.z + 40 };
}

// ------------------------- обновление -------------------------
export function updateEntities(dt) {
  const p = G.player;
  const px = p ? p.pos.x : 0, pz = p ? p.pos.z : 0;
  for (let i = G.entities.length - 1; i >= 0; i--) {
    const e = G.entities[i];
    const d = dist2D(px, pz, e.pos.x, e.pos.z);
    if (d > 320) {
      // далёкие: обновляем редко и не рисуем
      e.farTimer = (e.farTimer || 0) - dt;
      e.group.visible = false;
      if (e.farTimer > 0) continue;
      e.farTimer = 1.1;
      updateHumanoid(e, dt * 1.1);
      aiThink(e, dt * 1.1, px, pz, d);
      continue;
    }
    e.group.visible = true;
    setHumanoidShadow(e, d < 130);
    updateHumanoid(e, dt);
    if (e.dead) continue;
    // близкие: полный ИИ
    const rate = d > 120 ? 0.5 : 0;
    e.ai.think -= dt;
    if (e.ai.think <= 0 || rate === 0) {
      e.ai.think = rate || 0.12 + Math.random() * 0.1;
      aiThink(e, dt, px, pz, d);
    } else {
      aiMove(e, dt);
    }
    if (e.ai.alert > 0) e.ai.alert -= dt;
  }
}

function aiThink(e, dt, px, pz, playerDist) {
  const ai = e.ai;
  if (e.dead) return;
  const crowd = e.faction === 'people' || e.faction === 'neutral';
  // 1) выбрать цель
  const target = pickTarget(e, px, pz, playerDist);
  if (target) {
    if (!ai.target || ai.target.dead) bark(e, 'aggro');
    ai.target = target;
    ai.alert = Math.max(ai.alert, 6);
  } else if (ai.alert <= 0 && !ai.forcedTarget) {
    ai.target = null;
  }
  // 2) состояния
  if (ai.command === 'attack' && ai.squad && ai.squad.targetPoint) {
    ai.state = 'raid';
    ai.raid = { target: ai.squad.targetPoint, timer: 120 };
  }
  if (ai.target && !ai.target.dead) {
    const d = dist2D(e.pos.x, e.pos.z, ai.target.pos.x, ai.target.pos.z);
    const ranged = e.weapon === 'bow';
    if (e.hp < e.hpMax * 0.22 && !e.elite && e.faction !== 'villain' && d > 3) {
      ai.state = 'flee';
    } else if (ranged) {
      ai.state = d < 5 ? 'retreat_shoot' : 'aim';
    } else {
      ai.state = 'attack';
    }
  } else if (ai.state === 'flee' || ai.state === 'attack' || ai.state === 'aim' || ai.state === 'retreat_shoot') {
    ai.state = crowd ? 'wander' : 'idle';
  }
  if (ai.command === 'hold' && ai.holdPoint) ai.state = ai.target ? ai.state : 'idle';
  if (ai.raid && ai.state !== 'attack' && ai.state !== 'aim' && ai.state !== 'flee') ai.state = 'raid';
  if (ai.state === 'idle' || ai.state === 'wander') {
    if (ai.role === 'shopkeeper') { ai.state = 'work'; }
    else if (crowd && Math.random() < 0.4) ai.state = 'wander';
  }
  aiMove(e, dt);
  // 3) действия
  if (ai.target && !ai.target.dead) doCombat(e, ai.target, dt);
}

function pickTarget(e, px, pz, playerDist) {
  const ai = e.ai;
  const viewDist = e.weapon === 'bow' ? 55 : 38;
  if (ai.target && !ai.target.dead) {
    const d = dist2D(e.pos.x, e.pos.z, ai.target.pos.x, ai.target.pos.z);
    if (d < viewDist * 1.5 && ai.alert > -4) return ai.target;
  }
  // игрок
  const p = G.player;
  if (p && !p.dead && playerDist < viewDist && isHostileToPlayer(e)) {
    const sneaking = p.sneaking && p.crouching;
    const effDist = sneaking ? playerDist * 1.7 : playerDist;
    const eyeY = e.pos.y + e.eyeHeight;
    if (effDist < viewDist * (e.faction === 'bandits' ? 0.8 : 1) && lineOfSight(e.pos.x, eyeY, e.pos.z, p.pos.x, p.pos.y + 1.4, p.pos.z)) {
      return p;
    }
  }
  // другие сущности
  let best = null, bd = viewDist;
  for (const o of G.entities) {
    if (o === e || o.dead) continue;
    if (o.ai && o.ai.squad === ai.squad && ai.squad) continue;
    if (!isHostile(e, o)) continue;
    const d = dist2D(e.pos.x, e.pos.z, o.pos.x, o.pos.z);
    if (d < bd) {
      const eyeY = e.pos.y + e.eyeHeight;
      if (d < 8 || lineOfSight(e.pos.x, eyeY, e.pos.z, o.pos.x, o.pos.y + o.height * 0.6, o.pos.z)) { bd = d; best = o; }
    }
  }
  return best;
}

function doCombat(e, target, dt) {
  const ai = e.ai;
  e.attackCd = Math.max(0, (e.attackCd || 0) - dt);
  const d = dist2D(e.pos.x, e.pos.z, target.pos.x, target.pos.z);
  turnTo(e, target.pos.x, target.pos.z, dt, 7);
  const dy = (target.pos.y + target.height * 0.6) - (e.pos.y + e.eyeHeight);
  e.lookPitch = clamp(Math.atan2(dy, Math.max(0.5, d)), -0.9, 0.9);
  if (e.weapon === 'bow') {
    if (d > 26) { /* сближается */ }
    if (d < 4.5 && ai.state === 'retreat_shoot') { /* отходит, обрабатывается в aiMove */ }
    if (e.attackCd <= 0 && d < 46 && lineOfSight(e.pos.x, e.pos.y + e.eyeHeight, e.pos.z, target.pos.x, target.pos.y + target.height * 0.6, target.pos.z)) {
      shootAt(e, target, d);
      e.attackCd = Math.max(0.85, 1.9 - (e.xp || 10) * 0.01) * (0.7 + Math.random() * 0.6);
    }
  } else {
    const reach = e.weapon === 'spear' ? 3.1 : e.weapon === 'greataxe' || e.weapon === 'greatsword' ? 2.9 : 2.2;
    if (d < reach + 0.5 && e.attackCd <= 0) {
      e.anim.attack = 1;
      e.attackTime = e.weapon === 'greatsword' || e.weapon === 'greataxe' ? 0.9 : 0.55;
      e.attackCd = (e.weapon === 'greatsword' || e.weapon === 'greataxe' ? 1.2 : 0.85) * (0.8 + Math.random() * 0.5);
      setTimeout(() => {
        if (e.dead) return;
        if (target.dead) return;
        const dd = dist2D(e.pos.x, e.pos.z, target.pos.x, target.pos.z);
        if (dd > reach + 1.2) return;
        meleeSwing(e, { range: reach, arc: 1.0, dmg: e.dmg, aimPitch: e.lookPitch || 0, multi: 1, bleed: 0.28 });
      }, 160);
    }
  }
}
function shootAt(e, target, d) {
  const spread = clamp(0.12 - (e.xp || 10) * 0.002, 0.02, 0.14) * (1 + d * 0.008);
  const yaw = Math.atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z) + (Math.random() - 0.5) * spread;
  const dx = target.pos.x - e.pos.x, dz = target.pos.z - e.pos.z;
  const dist = Math.hypot(dx, dz);
  const dy = (target.pos.y + target.height * 0.55) - (e.pos.y + e.eyeHeight);
  const speed = 42;
  const t = dist / speed;
  const drop = 0.5 * 11 * t * t;
  const pitch = Math.atan2(dy + drop, dist) + (Math.random() - 0.5) * spread * 0.5;
  spawnArrow(e, e.pos.x, e.pos.y + e.eyeHeight - 0.1, e.pos.z, yaw, pitch, e.dmg * 0.9, { speed });
  G.audio.play('bow', { pos: e.pos, vol: 0.8 });
  e.anim.attack = 1;
  e.attackTime = 0.3;
}

function aiMove(e, dt) {
  const ai = e.ai;
  const p = G.player;
  let tx = null, tz = null, speedMul = 1;
  const target = ai.target;
  if (ai.state === 'attack' && target) {
    const d = dist2D(e.pos.x, e.pos.z, target.pos.x, target.pos.z);
    const reach = e.weapon === 'spear' ? 2.6 : 1.9;
    if (d > reach) { tx = target.pos.x; tz = target.pos.z; }
    else { // кружим
      const a = Math.atan2(e.pos.x - target.pos.x, e.pos.z - target.pos.z) + 0.5 * Math.sin(G.now + e.id.length);
      tx = target.pos.x + Math.sin(a) * reach; tz = target.pos.z + Math.cos(a) * reach;
      speedMul = 0.6;
    }
  } else if (ai.state === 'aim' && target) {
    const d = dist2D(e.pos.x, e.pos.z, target.pos.x, target.pos.z);
    if (d > 26) { tx = target.pos.x; tz = target.pos.z; }
    else if (d < 8) { tx = e.pos.x - (target.pos.x - e.pos.x); tz = e.pos.z - (target.pos.z - e.pos.z); speedMul = 0.8; }
    else { speedMul = 0.05; }
  } else if (ai.state === 'retreat_shoot' && target) {
    tx = e.pos.x - (target.pos.x - e.pos.x) * 0.5;
    tz = e.pos.z - (target.pos.z - e.pos.z) * 0.5;
    speedMul = 0.9;
  } else if (ai.state === 'flee') {
    tx = e.pos.x + (e.pos.x - (target ? target.pos.x : e.pos.x)) * 1.4;
    tz = e.pos.z + (e.pos.z - (target ? target.pos.z : e.pos.z)) * 1.4;
    speedMul = 1.25;
    if (G.now - e.lastBark > 8) bark(e, 'flee');
  } else if (ai.state === 'raid' && ai.raid) {
    tx = ai.raid.target.x; tz = ai.raid.target.z;
    const d = dist2D(e.pos.x, e.pos.z, tx, tz);
    if (d < 14 && !ai.target) {
      // ищем, кого бить рядом
      speedMul = 0.4;
    }
    if (ai.raid.timer !== undefined) {
      ai.raid.timer -= dt;
      if (ai.raid.timer <= 0) { ai.state = 'idle'; ai.raid = null; }
    }
  } else if (ai.command === 'follow' && ai.squad && ai.squad.leader && !ai.squad.leader.dead) {
    const L = ai.squad.leader;
    const a = ai.formation || 0;
    const fx = L.pos.x + Math.cos(a + G.now * 0.1) * 3.4, fz = L.pos.z + Math.sin(a + G.now * 0.1) * 3.4;
    const d = dist2D(e.pos.x, e.pos.z, fx, fz);
    if (d > 4.5) { tx = fx; tz = fz; speedMul = d > 14 ? 1.5 : 1; }
  } else if (ai.command === 'hold' && ai.holdPoint) {
    const d = dist2D(e.pos.x, e.pos.z, ai.holdPoint.x, ai.holdPoint.z);
    if (d > 3) { tx = ai.holdPoint.x; tz = ai.holdPoint.z; }
  } else if (ai.patrol && ai.patrol.length) {
    ai.patrolT = (ai.patrolT || 0) + dt;
    if (ai.patrolT > 6) {
      ai.patrolT = 0;
      ai.patrolIdx = ((ai.patrolIdx || 0) + 1) % ai.patrol.length;
    }
    const wp = ai.patrol[ai.patrolIdx || 0];
    const d = dist2D(e.pos.x, e.pos.z, wp.x, wp.z);
    if (d < 3) { ai.patrolT = 6.1; speedMul = 0.2; }
    else { tx = wp.x; tz = wp.z; speedMul = 0.42; }
  } else if (ai.state === 'wander' || ai.state === 'work') {
    if (!ai.wander || dist2D(e.pos.x, e.pos.z, ai.wander.x, ai.wander.z) < 1.5) {
      const r = ai.homeR * Math.random(), a = Math.random() * 6.28;
      ai.wander = { x: ai.home.x + Math.cos(a) * r, z: ai.home.z + Math.sin(a) * r };
    }
    tx = ai.wander.x; tz = ai.wander.z; speedMul = 0.3;
  }
  if (tx !== null) {
    const d = dist2D(e.pos.x, e.pos.z, tx, tz);
    if (d > 0.4) {
      const want = Math.atan2(tx - e.pos.x, tz - e.pos.z);
      e.yaw = angleTowards(e.yaw, want, 5 * dt);
      e.group.rotation.y = e.yaw;
      let speed = e.speed * speedMul;
      if (e.crawling) speed *= 0.35;
      if (e.missing.legL || e.missing.legR) speed *= 0.7;
      if (e.bleeding > 1) speed *= 0.9;
      const step = Math.min(speed * dt, d);
      e.pos.x += Math.sin(e.yaw) * step;
      e.pos.z += Math.cos(e.yaw) * step;
      e.speedNow = speed;
      e.moving = true;
    } else { e.speedNow = 0; e.moving = false; }
  } else { e.speedNow = 0; e.moving = false; }
  // избегание воды и препятствий
  if (heightAt(e.pos.x, e.pos.z) < WATER_Y + 0.1) {
    const n = { x: e.pos.x + 1, y: 0, z: e.pos.z };
    const grad = { x: heightAt(n.x, n.z) - heightAt(e.pos.x - 1, e.pos.z), z: heightAt(e.pos.x, n.z) - heightAt(e.pos.x, e.pos.z - 1) };
    e.pos.x += grad.x * 0.6; e.pos.z += grad.z * 0.6;
  }
  resolveCollisions(e.pos, e.radius, e.pos.y, e.height);
  if (ai.state === 'idle' && Math.random() < 0.0016 && e.faction !== 'villain') bark(e, 'idle', true);
  void p;
}

// ------------------------- раненые и трупы -------------------------
export function updateWounded(dt) {
  for (const e of G.entities) {
    if (e.dead) continue;
    if (e.hp <= 0.5 && !e.dead && (e.crawling || e.downed)) {
      // ползущий враг может «сдаться»
      if (!e.surrender && Math.random() < 0.0016) {
        e.surrender = true;
        emit('npc:surrender', { entity: e });
      }
    }
  }
  void dt;
}

export function updateSquads(dt) {
  for (const s of SQUADS) {
    if (!s.leader || s.leader.dead || s.leader.isPlayer) continue;
    // командир-НПС ведёт отряд за собой
    for (const e of s) {
      if (!e || e.dead) continue;
      const d = dist2D(e.pos.x, e.pos.z, s.leader.pos.x, s.leader.pos.z);
      if (d > 26) { e.pos.x = lerp(e.pos.x, s.leader.pos.x, 0.02); e.pos.z = lerp(e.pos.z, s.leader.pos.z, 0.02); }
    }
  }
  void dt;
}

let caravanTimer = 120;
export function updateRaids(dt) {
  caravanTimer -= dt;
  if (caravanTimer <= 0) {
    caravanTimer = 200 + Math.random() * 200;
    import('./caravan.js').then((m) => {
      if (G.caravans.filter((c) => c.alive).length < 3) {
        m.spawnCaravan(['trade', 'spice', 'forest', 'mountain'][Math.floor(Math.random() * 4)]);
        emit('notify', { text: 'На тракт вышел новый корован.' });
      }
    });
  }
  raidTimer -= dt;
  if (raidTimer > 0) return;
  raidTimer = 90 + Math.random() * 120;
  const rnd = Math.random();
  const p = G.player;
  const pz = placeNear(p && p.pos ? nearestPlaceId(p.pos.x, p.pos.z) : 'village');
  const targets = ['village', 'elfvillage', 'palace', 'fort'];
  const targetId = targets[Math.floor(Math.random() * targets.length)];
  const zone = placeNear(targetId);
  if (!zone || !pz) return;
  const d = dist2D(p.pos.x, p.pos.z, zone.x, zone.z);
  if (d > 700) return;
  if (rnd < 0.34) spawnRaid('elves', 'palace', 5);
  else if (rnd < 0.6) spawnRaid('empire', 'elfvillage', 5);
  else if (rnd < 0.8) spawnRaid('villain', Math.random() < 0.5 ? 'elfvillage' : 'village', 5);
  else spawnRaid('bandits', Math.random() < 0.5 ? 'village' : 'crossroad', 4);
  emit('notify', { text: `Набег: ${zone ? zone.name : ''}!`, kind: 'bad' });
}
function nearestPlaceId(x, z) {
  let best = 'village', bd = Infinity;
  for (const p of G.places) {
    const d = dist2D(x, z, p.x, p.z);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

// ------------------------- шпионы -------------------------
export function spawnSpy(placeId, faction = 'villain') {
  const place = placeNear(placeId);
  if (!place) return null;
  const a = Math.random() * 6.28;
  const e = spawnNPC({
    role: 'spy', faction, x: place.x + Math.cos(a) * 40, z: place.z + Math.sin(a) * 40,
    homeR: 45, aiRole: 'spy', disguise: true,
  });
  e.ai.spy = { placeId, phase: 'gather', timer: 40 + Math.random() * 40 };
  e.clothOverride = true;
  return e;
}

export function updateSpies(dt) {
  for (const e of G.entities) {
    if (e.dead || !e.ai.spy) continue;
    const s = e.ai.spy;
    s.timer -= dt;
    const p = G.player;
    if (p && dist2D(p.pos.x, p.pos.z, e.pos.x, e.pos.z) < 4 && s.timer < 20 && !s.talked) {
      s.talked = true;
      emit('spy:near', { entity: e });
    }
    if (s.timer <= 0) {
      if (s.phase === 'gather') { s.phase = 'leave'; s.timer = 120; e.ai.raid = { target: { x: e.ai.home.x, z: e.ai.home.z }, timer: 130 }; e.ai.state = 'raid'; }
      else { e.ai.spy = null; s.talked = false; }
    }
  }
}

// ------------------------- медицина -------------------------
export function healNearbyAllies(x, z, radius, amount) {
  let n = 0;
  for (const e of G.entities) {
    if (e.dead) continue;
    if (dist2D(x, z, e.pos.x, e.pos.z) < radius && (e.hp < e.hpMax || e.bleeding > 0)) {
      healHumanoid(e, amount);
      e.bleeding = Math.max(0, e.bleeding - 1.5);
      n++;
    }
  }
  return n;
}

export function despawnFar(limit = 260) {
  if (G.entities.length <= limit) return;
  // убираем самых далёких неживых/обычных
  const p = G.player;
  const sorted = G.entities.slice().sort((a, b) => dist2D(p.pos.x, p.pos.z, b.pos.x, b.pos.z) - dist2D(p.pos.x, p.pos.z, a.pos.x, a.pos.z));
  for (const e of sorted) {
    if (G.entities.length <= limit) break;
    if (e.ai.squad && e.ai.squad.leader === G.player) continue;
    if (e.boss || e.elite) continue;
    if (e.ai.role === 'shopkeeper' || e.role === 'captain' || e.role === 'elder') continue;
    e.group.parent && e.group.parent.remove(e.group);
    G.entities.splice(G.entities.indexOf(e), 1);
  }
}

export function setTroopHostility(entity, hostile) {
  entity.ai.temporaryHostile = hostile;
  if (hostile) entity.ai.alert = 30;
}

export function updateTroops(dt) {
  void troops; void dt;
}
void THREE; void setWeapon; void zoneAt; void roadPointAt; void roadLength; void Rand;
