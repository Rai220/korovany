// units.js — 3D-людишки, ИИ, ближний бой, травмы (рука/глаз/нога), трупы, кровь, отрубленные конечности.
import * as THREE from 'three';
import { heightAt, makeLabel } from './world.js';

export const FACTIONS = {
  elf:     { cloth: 0x2f6b34, accent: 0x8fe896, skin: 0xe2d3ae, label: '#8fe896' },
  guard:   { cloth: 0x7a2020, accent: 0xd4af37, skin: 0xd9b08c, label: '#ffd76a' },
  villain: { cloth: 0x26262e, accent: 0xc23a2a, skin: 0xb0a898, label: '#ff8a75' },
  human:   { cloth: 0x6a5a3a, accent: 0xc9b458, skin: 0xd9b08c, label: '#e8d8a0' },
};

const HOSTILE = {
  elf:     new Set(['guard', 'villain']),
  guard:   new Set(['elf', 'villain']),
  villain: new Set(['elf', 'guard', 'human']),
  human:   new Set(['villain']),
};
export function isHostile(fa, fb) {
  return fa !== fb && !!(HOSTILE[fa] && HOSTILE[fa].has(fb));
}

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
function part(parent, geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Гуманоид: корень в ступнях, конечности с шарнирами (чтобы махать и отрубать).
export function makeHumanoid(faction, { boss = false } = {}) {
  const F = FACTIONS[faction];
  const g = new THREE.Group();
  const parts = { group: g };

  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.24);
  legGeo.translate(0, -0.39, 0);
  parts.legL = part(g, legGeo, F.cloth, -0.14, 0.78, 0);
  parts.legR = part(g, legGeo.clone(), F.cloth, 0.14, 0.78, 0);

  const torsoGeo = new THREE.BoxGeometry(0.52, 0.64, 0.3);
  parts.torso = part(g, torsoGeo, F.cloth, 0, 1.1, 0);
  const beltGeo = new THREE.BoxGeometry(0.54, 0.1, 0.32);
  part(g, beltGeo, F.accent, 0, 0.82, 0);

  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  armGeo.translate(0, -0.31, 0);
  parts.armL = part(g, armGeo, F.cloth, -0.34, 1.36, 0);
  parts.armR = part(g, armGeo.clone(), F.cloth, 0.34, 1.36, 0);

  const headGeo = new THREE.BoxGeometry(0.3, 0.32, 0.3);
  parts.head = part(g, headGeo, F.skin, 0, 1.62, 0);

  if (faction === 'elf') {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 6), mat(F.cloth));
    hood.position.y = 0.3; parts.head.add(hood);
    // острые уши
    const earGeo = new THREE.ConeGeometry(0.05, 0.22, 4);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, mat(F.skin));
      ear.rotation.z = s * Math.PI / 2;
      ear.position.set(s * 0.2, 0.05, 0);
      parts.head.add(ear);
    }
  } else if (faction === 'guard') {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.18, 8), mat(0x9a9a9a));
    helm.position.y = 0.2; parts.head.add(helm);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.3), mat(F.accent));
    crest.position.y = 0.34; parts.head.add(crest);
  } else if (faction === 'villain') {
    const hornGeo = new THREE.ConeGeometry(0.06, 0.3, 4);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeo, mat(0x111111));
      horn.position.set(s * 0.12, 0.28, 0);
      horn.rotation.z = -s * 0.5;
      parts.head.add(horn);
    }
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), mat(0x4a3a20));
    hair.position.y = 0.18; parts.head.add(hair);
  }

  // меч в правой руке
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.72, 0.13), mat(0xc8c8d0));
  blade.position.y = -0.42;
  const guardM = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.2), mat(F.accent));
  sword.add(blade, guardM);
  sword.position.set(0, -0.6, 0.06);
  sword.rotation.x = Math.PI / 2 + 0.2;
  parts.armR.add(sword);
  parts.weapon = sword;

  if (boss) g.scale.setScalar(1.28);
  return parts;
}

// a: { moving, phase, swing(0..1|null), crawl, dead, deadT }
export function animateHumanoid(parts, a) {
  const g = parts.group;
  if (a.dead) {
    const t = Math.min(1, a.deadT * 2.2);
    g.rotation.z = (parts._fallDir || 1) * t * (Math.PI / 2 - 0.12);
    g.rotation.x = 0;
    return;
  }
  g.rotation.z = 0;
  if (a.crawl) {
    g.rotation.x = -1.25;
    const p = a.phase;
    parts.armL.rotation.x = Math.sin(p) * 0.9 - 0.6;
    parts.armR.rotation.x = a.swing !== null && a.swing !== undefined ? -2.0 + a.swing * 2.6 : Math.sin(p + Math.PI) * 0.9 - 0.6;
    if (parts.legL.visible) parts.legL.rotation.x = 0.3;
    if (parts.legR.visible) parts.legR.rotation.x = -0.2;
    return;
  }
  g.rotation.x = 0;
  const s = a.moving ? 1 : 0;
  const p = a.phase;
  if (parts.legL.visible) parts.legL.rotation.x = Math.sin(p) * 0.62 * s;
  if (parts.legR.visible) parts.legR.rotation.x = Math.sin(p + Math.PI) * 0.62 * s;
  parts.armL.rotation.x = Math.sin(p + Math.PI) * 0.5 * s;
  if (a.swing !== null && a.swing !== undefined) {
    parts.armR.rotation.x = -2.3 + a.swing * 3.1; // замах -> удар
  } else {
    parts.armR.rotation.x = Math.sin(p) * 0.5 * s;
  }
}

// ---------- кровь и конечности ----------
let bloodTex = null;
function getBloodTex() {
  if (bloodTex) return bloodTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a01208';
  ctx.beginPath(); ctx.arc(16, 16, 13, 0, 7); ctx.fill();
  bloodTex = new THREE.CanvasTexture(c);
  return bloodTex;
}
export function spawnBlood(G, x, y, z, n = 7) {
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getBloodTex(), transparent: true, opacity: 0.9 }));
    sp.scale.setScalar(0.18 + Math.random() * 0.22);
    sp.position.set(x, y, z);
    G.scene.add(sp);
    G.particles.push({
      obj: sp, ttl: 0.55 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 3.5, vz: (Math.random() - 0.5) * 5,
    });
  }
}
export function spawnLimb(G, unit, kind) {
  const F = FACTIONS[unit.faction];
  const len = kind === 'leg' ? 0.7 : 0.55;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, len, 0.2), mat(F.cloth));
  m.castShadow = true;
  m.position.set(unit.pos.x, unit.pos.y + 1, unit.pos.z);
  G.scene.add(m);
  G.debris.push({
    obj: m, ttl: 60, falling: true,
    vx: (Math.random() - 0.5) * 3, vy: 2.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
    spin: (Math.random() - 0.5) * 8,
  });
  spawnBlood(G, unit.pos.x, unit.pos.y + 1.1, unit.pos.z, 12);
}

export function updateFx(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.ttl -= dt;
    p.vy -= 9.8 * dt;
    p.obj.position.x += p.vx * dt;
    p.obj.position.y += p.vy * dt;
    p.obj.position.z += p.vz * dt;
    if (p.ttl <= 0 || p.obj.position.y < heightAt(p.obj.position.x, p.obj.position.z)) {
      G.scene.remove(p.obj);
      G.particles.splice(i, 1);
    }
  }
  for (let i = G.debris.length - 1; i >= 0; i--) {
    const d = G.debris[i];
    d.ttl -= dt;
    if (d.falling) {
      d.vy -= 9.8 * dt;
      d.obj.position.x += d.vx * dt;
      d.obj.position.y += d.vy * dt;
      d.obj.position.z += d.vz * dt;
      d.obj.rotation.z += d.spin * dt;
      if (d.obj.position.y <= heightAt(d.obj.position.x, d.obj.position.z) + 0.15) {
        d.obj.position.y = heightAt(d.obj.position.x, d.obj.position.z) + 0.15;
        d.falling = false;
        d.obj.rotation.set(Math.PI / 2, 0, Math.random() * 6);
      }
    }
    if (d.ttl <= 0) {
      G.scene.remove(d.obj);
      G.debris.splice(i, 1);
    }
  }
}

// ---------- столкновения с постройками ----------
export function resolveColliders(G, pos, r = 0.45) {
  for (const c of G.colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (Math.abs(dx) > c.hx + r || Math.abs(dz) > c.hz + r) continue;
    const px = c.hx + r - Math.abs(dx), pz = c.hz + r - Math.abs(dz);
    if (px < pz) pos.x += (dx >= 0 ? px : -px);
    else pos.z += (dz >= 0 ? pz : -pz);
  }
}

// ---------- травмы ----------
export function applyInjury(G, unit, kind) {
  if (unit.injuries[kind]) return false;
  unit.injuries[kind] = true;
  unit.bleeding = true;
  unit.bleedT = 0;
  if (kind === 'arm') {
    unit.parts.armR.visible = false; // меч падает вместе с рукой
    unit.dmg = Math.max(4, Math.round(unit.dmg * 0.45));
    spawnLimb(G, unit, 'arm');
  } else if (kind === 'leg') {
    unit.parts.legR.visible = false;
    unit.crawl = true;
    spawnLimb(G, unit, 'leg');
  } else if (kind === 'eye') {
    unit.aggro *= 0.55;
    spawnBlood(G, unit.pos.x, unit.pos.y + 1.6, unit.pos.z, 10);
  }
  return true;
}

export function damageUnit(G, attacker, unit, dmg) {
  if (unit.state === 'dead') return;
  unit.lastAttacker = attacker;
  let real = dmg;
  unit.hp -= real;
  spawnBlood(G, unit.pos.x, unit.pos.y + 1.1, unit.pos.z, 6);
  if (unit.hp > 0 && !unit.boss && Math.random() < 0.15) {
    const options = ['arm', 'eye', 'leg'].filter(k => !unit.injuries[k]);
    if (options.length) {
      const kind = options[(Math.random() * options.length) | 0];
      applyInjury(G, unit, kind);
      if (attacker === G.player) {
        const names = { arm: 'Вы отрубили врагу руку!', eye: 'Вы выбили врагу глаз!', leg: 'Вы отрубили врагу ногу!' };
        G.ui.toast(names[kind], 'bad');
      }
    }
  }
  if (unit.hp <= 0) unit.die(G, attacker);
}

// ---------- юнит ----------
let nextId = 1;
export class Unit {
  constructor(G, o) {
    this.id = nextId++;
    this.G = G;
    this.faction = o.faction;
    this.role = o.role || 'post';
    this.name = o.name || '';
    this.boss = !!o.boss;
    this.parts = makeHumanoid(o.faction, { boss: this.boss });
    this.mesh = this.parts.group;
    this.pos = this.mesh.position;
    this.pos.set(o.x, heightAt(o.x, o.z), o.z);
    this.home = { x: o.x, z: o.z };
    this.yaw = o.yaw || Math.random() * Math.PI * 2;
    this.maxHp = o.hp || 60;
    this.hp = this.maxHp;
    this.dmg = o.dmg || 12;
    this.speed = o.speed || 4.2;
    this.aggro = o.aggro || 22;
    this.attackRange = 2.2;
    this.gold = o.gold !== undefined ? o.gold : 5 + ((Math.random() * 10) | 0);
    this.waypoints = o.waypoints || null;
    this.wpIndex = 0;
    this.leader = o.leader || null;
    this.objective = o.objective || null;
    this.cart = null;
    this.state = 'idle';
    this.target = null;
    this.cool = 0;
    this.swingT = -1;
    this.phase = Math.random() * 6;
    this.moving = 0;
    this.crawl = false;
    this.injuries = { arm: false, eye: false, leg: false };
    this.bleeding = false;
    this.bleedT = 0;
    this.deadT = 0;
    this.wanderT = 0;
    this.wanderPos = null;
    this.removeMe = false;
    if (o.label) {
      const lb = makeLabel(o.label, { color: FACTIONS[o.faction].label, scale: [5.5, 1.15], font: 34 });
      lb.position.y = this.boss ? 3.1 : 2.5;
      this.mesh.add(lb);
    }
    G.scene.add(this.mesh);
  }

  die(G, attacker) {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deadT = 0;
    this.bleeding = false;
    this.parts._fallDir = Math.random() < 0.5 ? 1 : -1;
    if (Math.random() < 0.35) spawnLimb(G, this, Math.random() < 0.5 ? 'arm' : 'leg'); // расчленёнка на трупе
    spawnBlood(G, this.pos.x, this.pos.y + 0.8, this.pos.z, 14);
    if (attacker === G.player) {
      const g = this.gold;
      if (g > 0) G.addGold(g, `добыча с ${this.name || 'врага'}`);
      G.onPlayerKill && G.onPlayerKill(this);
    }
    G.onUnitDied && G.onUnitDied(this, attacker);
  }

  nearestHostile(G, maxDist) {
    let best = null, bestD = maxDist;
    const consider = (fx, fz, faction, ref, distBias = 0) => {
      const d = Math.hypot(this.pos.x - fx, this.pos.z - fz) + distBias;
      if (d < bestD && isHostile(this.faction, faction)) { bestD = d; best = ref; }
    };
    for (const u of G.units) {
      if (u === this || u.state === 'dead') continue;
      consider(u.pos.x, u.pos.z, u.faction, u);
    }
    const p = G.player;
    if (p.alive) consider(p.pos.x, p.pos.z, p.faction, p);
    return best;
  }

  moveToward(G, tx, tz, dt, speedMul = 1) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) { this.moving = 0; return d; }
    let sp = this.speed * speedMul;
    if (this.crawl) sp *= 0.25;
    const want = Math.atan2(dx, dz);
    let dy = want - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);
    const step = Math.min(sp * dt, d);
    this.pos.x += Math.sin(this.yaw) * step;
    this.pos.z += Math.cos(this.yaw) * step;
    // расхождение с другими юнитами
    for (const u of G.units) {
      if (u === this || u.state === 'dead') continue;
      const sx = this.pos.x - u.pos.x, sz = this.pos.z - u.pos.z;
      const sd = Math.hypot(sx, sz);
      if (sd > 0.01 && sd < 1.0) {
        this.pos.x += (sx / sd) * (1.0 - sd) * 0.5;
        this.pos.z += (sz / sd) * (1.0 - sd) * 0.5;
      }
    }
    resolveColliders(G, this.pos);
    this.pos.y = heightAt(this.pos.x, this.pos.z) + (this.crawl ? 0.55 : 0);
    this.moving = 1;
    this.phase += dt * sp * 2.2;
    return d;
  }

  startSwing() {
    this.swingT = 0;
    this.cool = this.injuries.eye ? 1.7 : 1.15;
  }

  update(G, dt) {
    if (this.state === 'dead') {
      this.deadT += dt;
      animateHumanoid(this.parts, { dead: true, deadT: this.deadT, phase: this.phase });
      if (this.deadT > 70) { // труп исчезает
        G.scene.remove(this.mesh);
        this.removeMe = true;
      }
      return;
    }

    if (this.bleeding) {
      this.bleedT += dt;
      this.hp -= 1.4 * dt;
      if (Math.random() < dt * 2) spawnBlood(G, this.pos.x, this.pos.y + 0.9, this.pos.z, 1);
      if (this.bleedT > 14) this.bleeding = false; // затянуло
      if (this.hp <= 0) { this.die(G, this.lastAttacker); return; }
    }

    this.cool -= dt;
    const p = G.player;
    const distToPlayer = p.alive ? Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z) : 1e9;

    // --- завершение замаха ---
    if (this.swingT >= 0) {
      this.swingT += dt / 0.55; // 0.55 c на взмах
      if (this.swingT >= 0.55 && !this._hitDone) {
        this._hitDone = true;
        const t = this.target;
        if (t) {
          const tp = t.pos;
          const d = Math.hypot(this.pos.x - tp.x, this.pos.z - tp.z);
          if (d < this.attackRange * 1.4) {
            if (t === p) G.damagePlayer(this.dmg, this);
            else damageUnit(G, this, t, this.dmg);
          }
        }
      }
      if (this.swingT >= 1) { this.swingT = -1; this._hitDone = false; }
      animateHumanoid(this.parts, { moving: 0, phase: this.phase, swing: Math.min(1, this.swingT), crawl: this.crawl });
      this.mesh.rotation.y = this.yaw;
      return;
    }

    // --- выбор поведения ---
    let targetPos = null, speedMul = 1;
    const aggro = this.aggro;

    if (this.role === 'vendor' || this.role === 'quest') {
      if (distToPlayer < 7) {
        const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        this.yaw += (want - this.yaw) * Math.min(1, dt * 5);
      }
      this.moving = 0;
    } else if (this.role === 'villager') {
      const foe = this.nearestHostile(G, 13);
      if (foe) {
        const away = Math.atan2(this.pos.x - foe.pos.x, this.pos.z - foe.pos.z);
        targetPos = { x: this.pos.x + Math.sin(away) * 10, z: this.pos.z + Math.cos(away) * 10 };
        speedMul = 1.35;
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 4 + Math.random() * 5;
          this.wanderPos = { x: this.home.x + (Math.random() - 0.5) * 24, z: this.home.z + (Math.random() - 0.5) * 24 };
        }
        if (this.wanderPos && Math.hypot(this.pos.x - this.wanderPos.x, this.pos.z - this.wanderPos.z) > 1.5)
          targetPos = this.wanderPos, speedMul = 0.4;
      }
    } else {
      // боевые роли
      if (!this.target || this.target.hp <= 0 || (this.target.state && this.target.state === 'dead'))
        this.target = this.nearestHostile(G, aggro);
      if (this.target) {
        const tp = this.target.pos;
        const d = Math.hypot(this.pos.x - tp.x, this.pos.z - tp.z);
        if (d > this.attackRange) {
          this.moveToward(G, tp.x, tp.z, dt, 1.1);
        } else {
          const want = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
          this.yaw += (want - this.yaw) * Math.min(1, dt * 10);
          this.moving = 0;
          if (this.cool <= 0) this.startSwing();
        }
      } else if (this.role === 'patrol' && this.waypoints) {
        const wp = this.waypoints[this.wpIndex];
        if (this.moveToward(G, wp[0], wp[1], dt, 0.55) < 2)
          this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      } else if (this.role === 'follow' && this.leader) {
        const lp = this.leader.pos;
        const d = Math.hypot(this.pos.x - lp.x, this.pos.z - lp.z);
        if (d > 3.2) this.moveToward(G, lp.x, lp.z, dt, d > 14 ? 1.5 : 1);
        else this.moving = 0;
      } else if (this.role === 'raid' && this.objective) {
        if (this.moveToward(G, this.objective.x, this.objective.z, dt, 1.15) < 6)
          this.role = 'post', this.home = { x: this.objective.x, z: this.objective.z };
      } else if (this.role === 'caravan' && this.cart) {
        const d = Math.hypot(this.pos.x - this.cart.x, this.pos.z - this.cart.z);
        if (d > 3.5) this.moveToward(G, this.cart.x, this.cart.z, dt, 1.2);
        else this.moving = 0;
      } else {
        // post: возврат на место
        const d = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
        if (d > 2.5) this.moveToward(G, this.home.x, this.home.z, dt, 0.7);
        else this.moving = 0;
      }
    }

    if (targetPos) this.moveToward(G, targetPos.x, targetPos.z, dt, speedMul);
    this.mesh.rotation.y = this.yaw;
    animateHumanoid(this.parts, {
      moving: this.moving, phase: this.phase,
      swing: this.swingT >= 0 ? Math.min(1, this.swingT) : null,
      crawl: this.crawl,
    });
  }
}
