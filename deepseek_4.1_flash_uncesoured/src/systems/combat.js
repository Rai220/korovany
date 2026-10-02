// Боевая система: удары, стрелы, попадания по частям тела, кровь и расчленёнка.
import * as THREE from 'three';
import { G, SETTINGS, emit } from '../core/state.js';
import { clamp, dist2D, rayCylinder, wrapAngle } from '../core/mathutil.js';
import { damageHumanoid, killHumanoid, severLimb, rollLimbPart } from '../entities/humanoid.js';
import { damagePlayer } from '../entities/player.js';
import { heightAt } from '../world/terrain.js';
import { lineOfSight, raycastWorld } from '../world/collision.js';

// ------------------------- частицы (кровь, искры, пыль) -------------------------
const MAX_PARTICLES = 900;
let pMesh = null;
const particles = [];
let decalGroup = null;
const decals = [];
let debrisGroup = null;

export function initCombat(scene) {
  const geo = new THREE.BoxGeometry(0.075, 0.075, 0.075);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  pMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pMesh.frustumCulled = false;
  pMesh.count = 0;
  pMesh.name = 'particles';
  const col = new THREE.Color(1, 1, 1);
  for (let i = 0; i < MAX_PARTICLES; i++) pMesh.setColorAt(i, col);
  scene.add(pMesh);
  for (let i = 0; i < MAX_PARTICLES; i++) particles.push({ alive: false, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 1, size: 1 });
  decalGroup = new THREE.Group(); decalGroup.name = 'decals'; scene.add(decalGroup);
  debrisGroup = new THREE.Group(); debrisGroup.name = 'debris'; scene.add(debrisGroup);
  const dgeo = new THREE.PlaneGeometry(1, 1);
  dgeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 140; i++) {
    const m = new THREE.Mesh(dgeo, new THREE.MeshBasicMaterial({ color: 0x6b1010, transparent: true, opacity: 0.85, depthWrite: false }));
    m.visible = false;
    m.renderOrder = 3;
    decalGroup.add(m);
    decals.push({ mesh: m, t: 0, alive: false });
  }
  G.gore = {
    bloodBurst, stump, limb: spawnLimb, spark,
  };
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

function spawnParticle(x, y, z, vx, vy, vz, color, life = 0.8, size = 1, g = 1.6) {
  if (!SETTINGS.blood && color === 'blood') { /* всё равно рисуем */ }
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = particles[i];
    if (p.alive) continue;
    p.alive = true; p.life = life; p.maxLife = life;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.g = g; p.size = size; p.color = color;
    return;
  }
}

export function bloodBurst(pos, dir, amount = 1) {
  const n = Math.round(clamp(amount * 12, 4, 34));
  for (let i = 0; i < n; i++) {
    spawnParticle(
      pos.x + (Math.random() - 0.5) * 0.3, pos.y + (Math.random() - 0.5) * 0.3, pos.z + (Math.random() - 0.5) * 0.3,
      dir.x * 2 + (Math.random() - 0.5) * 3, Math.random() * 3 + dir.y * 2, dir.z * 2 + (Math.random() - 0.5) * 3,
      0x8a1010, 0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.8,
    );
  }
  if (Math.random() < 0.6) addDecal(pos, 0.5 + Math.random() * amount * 0.6);
}
export function spark(pos, dir) {
  for (let i = 0; i < 8; i++) {
    spawnParticle(pos.x, pos.y, pos.z, dir.x * 2 + (Math.random() - 0.5) * 4, Math.random() * 3, dir.z * 2 + (Math.random() - 0.5) * 4, 0xffd070, 0.35, 0.5, 2.5);
  }
}
export function stump(pos, radius, e) {
  bloodBurst(pos, { x: 0, y: 0.4, z: 0 }, 2.2);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.5, 6, 5), new THREE.MeshLambertMaterial({ color: 0x7a1414 }));
  mesh.position.copy(pos);
  debrisGroup.add(mesh);
  void e;
}
function addDecal(pos, size) {
  const d = decals.find((x) => !x.alive);
  if (!d) return;
  d.alive = true; d.t = 0;
  const gy = heightAt(pos.x, pos.z);
  d.mesh.visible = true;
  d.mesh.position.set(pos.x, gy + 0.045 + Math.random() * 0.02, pos.z);
  d.mesh.rotation.y = Math.random() * 6.28;
  d.mesh.scale.set(size * 2, 1, size * 2);
  d.mesh.material.opacity = 0.75;
  d.mesh.material.color.setHex(0x5e0d0d + Math.floor(Math.random() * 0x001010));
}

// отлетающие конечности
const debris = [];
export function spawnLimb(mesh, dir, pos, color) {
  if (!mesh) return;
  if (mesh.parent !== debrisGroup) debrisGroup.attach(mesh);
  const d = {
    mesh, life: 0, settled: false,
    vx: dir.x * 3 + (Math.random() - 0.5) * 2, vy: 2.5 + Math.random() * 2.2, vz: dir.z * 3 + (Math.random() - 0.5) * 2,
    rx: (Math.random() - 0.5) * 6, ry: (Math.random() - 0.5) * 6, rz: (Math.random() - 0.5) * 6,
  };
  debris.push(d);
  bloodBurst(pos, dir, 1.6);
  G.audio.play('sever');
  G.stats.severed++;
  if (debris.length > 90) {
    const old = debris.shift();
    if (old && old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
  }
  void color;
}

export function updateGore(dt) {
  // частицы
  let count = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = particles[i];
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.vy -= 9.5 * p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const gy = heightAt(p.x, p.z);
    if (p.y < gy + 0.03) { p.y = gy + 0.03; p.vy *= -0.25; p.vx *= 0.5; p.vz *= 0.5; }
    const k = clamp(p.life / (p.maxLife || 1), 0, 1);
    _v.set(p.x, p.y, p.z);
    _q.identity();
    _s.setScalar(p.size * (0.5 + k * 0.9));
    _m.compose(_v, _q, _s);
    pMesh.setMatrixAt(count, _m);
    _c.setHex(p.color || 0x8a1010);
    _c.multiplyScalar(0.4 + k * 0.7);
    pMesh.setColorAt(count, _c);
    count++;
  }
  pMesh.count = count;
  if (count) {
    pMesh.instanceMatrix.needsUpdate = true;
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  }
  // конечности
  for (const d of debris) {
    if (d.settled) continue;
    d.life += dt;
    d.vy -= 19 * dt;
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.y += d.vy * dt;
    d.mesh.position.z += d.vz * dt;
    d.mesh.rotation.x += d.rx * dt;
    d.mesh.rotation.y += d.ry * dt;
    d.mesh.rotation.z += d.rz * dt;
    const gy = heightAt(d.mesh.position.x, d.mesh.position.z);
    if (d.mesh.position.y <= gy + 0.08) {
      d.mesh.position.y = gy + 0.08;
      d.settled = true;
      if (Math.random() < 0.7) addDecal(d.mesh.position, 0.7);
    }
  }
  // декали
  for (const d of decals) {
    if (!d.alive) continue;
    d.t += dt;
    if (d.t > 90) { d.alive = false; d.mesh.visible = false; }
    else if (d.t > 60) d.mesh.material.opacity = 0.75 * (1 - (d.t - 60) / 30);
  }
}

// ------------------------- удары -------------------------
export function meleeSwing(attacker, opts) {
  const range = opts.range || 2.4;
  const arc = opts.arc || 1.15;
  const dmg = opts.dmg || 12;
  const ax = attacker.pos.x, az = attacker.pos.z;
  const eyeY = attacker.pos.y + (attacker.eyeHeight || 1.5);
  const yaw = attacker.yaw;
  let hitAny = false;
  const pool = [];
  for (const e of G.entities) {
    if (e === attacker || e.dead) continue;
    if (!isHostile(attacker, e)) continue;
    const d = dist2D(ax, az, e.pos.x, e.pos.z);
    if (d > range + e.radius + 0.4) continue;
    const ang = Math.abs(wrapAngle(Math.atan2(e.pos.x - ax, e.pos.z - az) - yaw));
    if (ang > arc) continue;
    pool.push({ e, d });
  }
  // игрок как цель
  const pl = G.player;
  if (pl && pl !== attacker && !pl.dead && isHostile(attacker, pl)) {
    const d = dist2D(ax, az, pl.pos.x, pl.pos.z);
    if (d <= range + pl.radius + 0.4) {
      const ang = Math.abs(wrapAngle(Math.atan2(pl.pos.x - ax, pl.pos.z - az) - yaw));
      if (ang <= arc) pool.push({ e: pl, d, isPlayer: true });
    }
  }
  pool.sort((a, b) => a.d - b.d);
  for (const t of pool.slice(0, opts.multi || 2)) {
    const e = t.e;
    const ey = e.pos.y + e.height * 0.5;
    if (!lineOfSight(ax + Math.sin(yaw) * 0.2, eyeY, az + Math.cos(yaw) * 0.2, e.pos.x, ey, e.pos.z)) continue;
    // определяем часть тела по высоте попадания
    const aimY = eyeY + Math.tan(opts.aimPitch || 0) * t.d;
    const ratio = clamp((aimY - e.pos.y) / e.height, 0, 1.2);
    let part = rollLimbPart(ratio);
    if (opts.part && opts.part !== 'auto') part = opts.part;
    const dir = { x: Math.sin(yaw), y: 0.3, z: Math.cos(yaw) };
    const hitPos = { x: e.pos.x - dir.x * 0.2, y: aimY, z: e.pos.z - dir.z * 0.2 };
    if (t.isPlayer) {
      const res = playerHit(dmg, part, attacker, dir);
      bloodBurst(hitPos, dir, 0.8);
      hitAny = hitAny || res;
    } else {
      const res = damageHumanoid(e, dmg, part, { attacker, dir, bleed: opts.bleed ?? 0.25, sever: opts.sever });
      G.audio.play('hit_flesh', { pos: e.pos });
      if (e.armor > 0.25 && Math.random() < 0.5) G.audio.play('hit_metal', { pos: e.pos });
      bloodBurst(hitPos, dir, part === 'head' ? 1.6 : 1);
      if (res.severed) emit('combat:severed', { entity: e, part, attacker });
      if (res.killed) onKill(e, attacker);
      hitAny = true;
    }
  }
  if (!hitAny) G.audio.play('swing');
  return hitAny;
}

function playerHit(dmg, part, attacker, dir) {
  damagePlayer(dmg, part, { attacker, dir, bleed: 0.4 });
  G.audio.play('hurt');
  return true;
}

export function onKill(e, killer) {
  if (killer && killer.isPlayer) {
    G.stats.kills++;
    G.player.stats.kills++;
    emit('player:kill', { entity: e });
    addXPFor(e.xp || 5);
  }
  emit('npc:killed', { entity: e, killer });
}
function addXPFor(xp) {
  const p = G.player;
  p.xp += xp;
  emit('player:xp', {});
  // уровневая логика живёт в player.addXP; здесь мягко дублируем
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = Math.round(p.xpNext * 1.45 + 20);
    p.hpMax += 12; p.hp = p.hpMax; p.staminaMax += 5;
    G.audio.play('levelup');
    emit('banner', { text: `УРОВЕНЬ ${p.level}` });
  }
}

// ------------------------- стрелы -------------------------
const arrows = [];
let arrowPool = [];
export function initArrows(scene) {
  const geo = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 4);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.castShadow = false;
    scene.add(m);
    arrowPool.push(m);
  }
}

export function spawnArrow(owner, ox, oy, oz, yaw, pitch, dmg, opts = {}) {
  const mesh = arrowPool.pop();
  if (!mesh) return null;
  mesh.visible = true;
  const speed = opts.speed || 46;
  const dx = -Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * Math.cos(pitch);
  const a = {
    owner, mesh, x: ox, y: oy, z: oz, vx: dx * speed, vy: dy * speed, vz: dz * speed,
    dmg, life: 6, stuck: false, bleed: opts.bleed ?? 0.2, pierce: opts.pierce,
  };
  arrows.push(a);
  mesh.position.set(ox, oy, oz);
  mesh.rotation.set(pitch, yaw, 0, 'YXZ');
  return a;
}

export function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.life -= dt;
    if (a.stuck) {
      if (a.life < 3.6) { a.mesh.visible = false; arrowPool.push(a.mesh); arrows.splice(i, 1); }
      continue;
    }
    const steps = 3;
    const sdt = dt / steps;
    let removed = false;
    for (let s = 0; s < steps && !removed; s++) {
      a.vy -= 11 * sdt;
      const nx = a.x + a.vx * sdt, ny = a.y + a.vy * sdt, nz = a.z + a.vz * sdt;
      // цели
      const hit = arrowHit(a, a.x, a.y, a.z, nx, ny, nz);
      if (hit) {
        if (hit.isPlayer) {
          damagePlayer(a.dmg, hit.part, { attacker: a.owner, dir: { x: a.vx, y: a.vy, z: a.vz }, bleed: a.bleed });
          G.audio.play('arrow_hit');
          emit('player:hitByArrow', { attacker: a.owner });
        } else {
          const res = damageHumanoid(hit.entity, a.dmg, hit.part, { attacker: a.owner, bleed: a.bleed, pierce: a.pierce, dir: { x: a.vx, y: a.vy, z: a.vz } });
          G.audio.play('arrow_hit', { pos: hit.entity.pos });
          bloodBurst({ x: nx, y: ny, z: nz }, { x: a.vx, y: 0, z: a.vz }, 0.7);
          if (res.killed) onKill(hit.entity, a.owner);
        }
        a.stuck = true;
        a.mesh.position.set(nx, ny, nz);
        a.life = 4;
        removed = true;
        break;
      }
      // мир
      const dirLen = Math.hypot(a.vx, a.vy, a.vz) || 1;
      const wh = raycastWorld(a.x, a.y, a.z, a.vx / dirLen, a.vy / dirLen, a.vz / dirLen, dirLen * sdt + 0.1);
      if (wh || ny <= heightAt(nx, nz) + 0.05) {
        a.stuck = true;
        a.mesh.position.set(nx, ny, nz);
        a.life = 4;
        G.audio.play('arrow_hit', { pos: { x: nx, z: nz } });
        removed = true;
        break;
      }
      a.x = nx; a.y = ny; a.z = nz;
    }
    if (removed) continue;
    if (a.life <= 0) { a.mesh.visible = false; arrowPool.push(a.mesh); arrows.splice(i, 1); continue; }
    a.mesh.position.set(a.x, a.y, a.z);
    a.mesh.rotation.set(Math.atan2(a.vy, Math.hypot(a.vx, a.vz)), Math.atan2(-a.vx, -a.vz), 0, 'YXZ');
  }
}

function arrowHit(a, x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  const ux = dx / len, uy = dy / len, uz = dz / len;
  let best = null;
  const check = (e, isPlayer) => {
    if (e === a.owner || e.dead) return;
    if (a.owner && !isHostile(a.owner, e)) return;
    const t = rayCylinder(x0, y0, z0, ux, uy, uz, e.pos.x, e.pos.z, e.radius, e.pos.y, e.pos.y + e.height);
    if (t === null || t > len) return;
    if (best && t > best.t) return;
    const hy = y0 + uy * t;
    const ratio = clamp((hy - e.pos.y) / e.height, 0, 1.2);
    best = { t, entity: e, part: rollLimbPart(ratio), isPlayer };
  };
  for (const e of G.entities) check(e, false);
  const pl = G.player;
  if (pl && pl !== a.owner && !pl.dead && a.owner && isHostile(a.owner, pl)) check(pl, true);
  return best;
}

// ------------------------- вражда -------------------------
export function isHostile(a, b) {
  if (!a || !b) return false;
  if (a === b) return false;
  const fa = a.faction || (a.isPlayer ? playerFactionKey() : null);
  const fb = b.faction || (b.isPlayer ? playerFactionKey() : null);
  if (!fa || !fb) return false;
  if (a.isPlayer || b.isPlayer) return isHostileToPlayer(a.isPlayer ? b : a);
  return factionHostile(fa, fb);
}
export function playerFactionKey() {
  const f = G.player && G.player.heroFaction;
  return f === 'elf' ? 'elves' : f === 'guard' ? 'empire' : f === 'villain' ? 'villain' : 'people';
}
export function factionHostile(fa, fb) {
  const rel = {
    elves: { empire: true, villain: true, bandits: false, people: false },
    empire: { elves: true, villain: true, bandits: true, people: false },
    villain: { elves: true, empire: true, bandits: false, people: false },
    bandits: { people: true, empire: true, elves: false, villain: false },
    people: { bandits: true },
  };
  return !!(rel[fa] && rel[fa][fb]);
}
export function isHostileToPlayer(e) {
  const pf = playerFactionKey();
  const p = G.player;
  if (e.ai && e.ai.temporaryHostile) return true;
  if (factionHostile(e.faction, pf)) return true;
  if (p.rep[e.faction] !== undefined && p.rep[e.faction] < -25 && (e.faction === 'people' || e.faction === 'empire')) return true;
  return false;
}

export function explosion(pos, radius, dmg) {
  for (const e of G.entities) {
    if (e.dead) continue;
    const d = dist2D(pos.x, pos.z, e.pos.x, e.pos.z);
    if (d < radius) damageHumanoid(e, dmg * (1 - d / radius), 'torso', { bleed: 0.3 });
  }
  for (let i = 0; i < 30; i++) {
    spawnParticle(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9, i % 3 ? 0xffa040 : 0x777777, 1.1, 1.4, 1.2);
  }
  G.audio.play('thunder', { vol: 0.6 });
}
void killHumanoid; void severLimb;
