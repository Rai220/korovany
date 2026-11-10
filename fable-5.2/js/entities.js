// Существа: 3D-человечки из частей (части можно отрубить), ИИ, стрелы, трупы, корованы.
import * as THREE from '../lib/three.min.js';
import { G, FACTIONS, ITEMS, rnd, rndInt, pick, clamp, lerp, angDiff } from './data.js';
import { heightAt, collide, pointBlocked } from './world.js';

let scene;
const matCache = new Map();
export function mat(color, emissive) {
  const key = color + '/' + (emissive || 0);
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, emissive: emissive || 0 }); matCache.set(key, m); }
  return m;
}
const GEO = {};
function geo(name, make) { return GEO[name] || (GEO[name] = make()); }
function box(w, h, d, color, x = 0, y = 0, z = 0, emissive) {
  const m = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(color, emissive));
  m.position.set(x, y, z); return m;
}
function cone(r, h, seg, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo(`c${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat(color));
  m.position.set(x, y, z); return m;
}
function cyl(r, h, seg, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo(`y${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg)), mat(color));
  m.position.set(x, y, z); return m;
}

export function makeWeapon(type) {
  const g = new THREE.Group();
  if (type === 'bow' || type === 'longbow') {
    const arc = new THREE.Mesh(geo('bowarc', () => new THREE.TorusGeometry(0.5, 0.03, 4, 10, Math.PI)), mat(type === 'longbow' ? 0xc9b27a : 0x7a5632));
    arc.rotation.set(0, Math.PI / 2, -Math.PI / 2); g.add(arc);
    g.add(box(0.012, 1.0, 0.012, 0xeeeeee, 0, 0, 0));
  } else if (type === 'staff') {
    const s = box(0.06, 1.7, 0.06, 0x2b2030, 0, 0, 0.35); s.rotation.x = Math.PI / 2; g.add(s);
    g.add(box(0.2, 0.2, 0.2, 0xc060ff, 0, 0, 1.25, 0x8030c0));
  } else if (type === 'axe') {
    const s = box(0.06, 1.1, 0.06, 0x6b4a2c, 0, 0, 0.4); s.rotation.x = Math.PI / 2; g.add(s);
    g.add(box(0.04, 0.5, 0.36, 0xb8bcc4, 0, 0.16, 0.82));
  } else {
    const len = type === 'dagger' ? 0.5 : type === 'longsword' ? 1.15 : 0.95;
    const col = type === 'blackblade' ? 0x2a2233 : 0xd0d4dc;
    const b = box(0.035, len, 0.09, col, 0, 0, 0.12 + len / 2, type === 'blackblade' ? 0x30104a : 0); b.rotation.x = Math.PI / 2; g.add(b);
    g.add(box(0.26, 0.05, 0.06, 0x8a6a2a, 0, 0, 0.12)); g.add(box(0.05, 0.05, 0.2, 0x4a321c, 0, 0, 0.02));
  }
  return g;
}

// look: {skin, body, legs, arms, hat, hatColor, ears, cape, robe, scale, eyes, weapon}
export function makeHumanoid(look) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const skin = look.skin || 0xe8c9a0;
  const torso = box(0.62, 0.78, 0.34, look.body, 0, 1.19, 0); body.add(torso);
  if (look.belt) body.add(box(0.64, 0.1, 0.36, look.belt, 0, 0.9, 0));
  if (look.robe) body.add(box(0.66, 0.62, 0.4, look.body, 0, 0.6, 0));
  if (look.cape) body.add(box(0.6, 1.1, 0.06, look.cape, 0, 1.0, -0.21));
  const head = new THREE.Group(); head.position.set(0, 1.77, 0); body.add(head);
  head.add(box(0.38, 0.38, 0.38, skin));
  const eyeL = box(0.07, 0.06, 0.03, look.eyes || 0x1a1a1a, -0.09, 0.04, 0.19, look.eyesGlow), eyeR = box(0.07, 0.06, 0.03, look.eyes || 0x1a1a1a, 0.09, 0.04, 0.19, look.eyesGlow);
  head.add(eyeL, eyeR);
  const hc = look.hatColor || 0x888888;
  switch (look.hat) {
    case 'helmet': head.add(box(0.44, 0.2, 0.44, hc, 0, 0.17, 0), box(0.06, 0.2, 0.05, hc, 0, 0.02, 0.21)); break;
    case 'plume': head.add(box(0.44, 0.2, 0.44, hc, 0, 0.17, 0), box(0.08, 0.3, 0.36, 0xc0392b, 0, 0.4, -0.02)); break;
    case 'kettle': head.add(box(0.56, 0.06, 0.56, hc, 0, 0.16, 0), box(0.36, 0.14, 0.36, hc, 0, 0.25, 0)); break;
    case 'hood': head.add(box(0.44, 0.24, 0.44, hc, 0, 0.14, -0.02), box(0.44, 0.3, 0.1, hc, 0, -0.1, -0.2)); break;
    case 'hair': head.add(box(0.42, 0.12, 0.42, hc, 0, 0.22, 0), box(0.42, 0.34, 0.08, hc, 0, 0.0, -0.2)); break;
    case 'crown': head.add(box(0.42, 0.1, 0.42, 0xe6b422, 0, 0.23, 0), box(0.08, 0.12, 0.08, 0xe6b422, 0, 0.33, 0.17), box(0.08, 0.12, 0.08, 0xe6b422, -0.17, 0.33, 0), box(0.08, 0.12, 0.08, 0xe6b422, 0.17, 0.33, 0)); break;
    case 'horns': { head.add(box(0.44, 0.16, 0.44, hc, 0, 0.19, 0)); const a = cone(0.07, 0.34, 5, 0xd8d0b8, -0.24, 0.3, 0), b = cone(0.07, 0.34, 5, 0xd8d0b8, 0.24, 0.3, 0); a.rotation.z = 0.5; b.rotation.z = -0.5; head.add(a, b); break; }
    case 'hat': head.add(box(0.5, 0.05, 0.5, hc, 0, 0.2, 0), box(0.3, 0.16, 0.3, hc, 0, 0.3, 0)); break;
  }
  if (look.ears) { const a = cone(0.05, 0.26, 4, skin, -0.23, 0.08, 0), b = cone(0.05, 0.26, 4, skin, 0.23, 0.08, 0); a.rotation.z = 0.9; b.rotation.z = -0.9; head.add(a, b); }
  if (look.beard) head.add(box(0.3, 0.2, 0.08, look.beard, 0, -0.2, 0.17));
  const limb = (x, y, w, h, color, hand) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    p.add(box(w, h, w, color, 0, -h / 2, 0));
    if (hand) p.add(box(w * 0.9, 0.14, w * 0.9, hand, 0, -h - 0.02, 0));
    body.add(p); return p;
  };
  const armL = limb(-0.41, 1.52, 0.17, 0.66, look.arms || look.body, skin), armR = limb(0.41, 1.52, 0.17, 0.66, look.arms || look.body, skin);
  const legL = limb(-0.17, 0.8, 0.23, 0.74, look.legs, look.boots || 0x3a2a18), legR = limb(0.17, 0.8, 0.23, 0.74, look.legs, look.boots || 0x3a2a18);
  let weapon = null;
  if (look.weapon) {
    weapon = makeWeapon(look.weapon);
    const isBow = look.weapon === 'bow' || look.weapon === 'longbow';
    weapon.position.set(0, -0.72, isBow ? 0.05 : 0);
    (isBow ? armL : armR).add(weapon);
  }
  if (look.scale) root.scale.setScalar(look.scale);
  return { root, body, head, torso, armL, armR, legL, legR, eyeL, eyeR, weapon };
}

const SK = [0xe8c9a0, 0xd9b48a, 0xf0d9b5, 0xc99a6a];
export function lookFor(faction, kind) {
  const ranged = kind === 'archer';
  if (faction === 'elf') {
    if (kind === 'leader') return { skin: 0xf3dfc0, body: 0xe8e4d0, legs: 0xcfc8a8, robe: true, hat: 'hair', hatColor: 0xf0f0e0, ears: true, cape: 0x2f7d32, weapon: 'staff', scale: 1.1, eyes: 0x207040 };
    if (kind === 'merchant') return { skin: 0xf3dfc0, body: 0x7a9a4a, legs: 0x5a4028, robe: true, hat: 'hair', hatColor: 0xb5651d, ears: true };
    if (kind === 'civilian') return { skin: 0xf3dfc0, body: pick([0x8ab060, 0xa0a060, 0x6a9a6a]), legs: 0x5a4028, hat: 'hair', hatColor: pick([0xe8d080, 0xb5651d, 0xd0d0c0]), ears: true };
    return { skin: 0xf3dfc0, body: ranged ? 0x2f6d32 : 0x3a8040, legs: 0x4a3a24, hat: ranged ? 'hood' : 'hair', hatColor: ranged ? 0x25552a : 0xe8d080, ears: true, belt: 0x4a321c, weapon: ranged ? 'longbow' : 'sword' };
  }
  if (faction === 'empire') {
    if (kind === 'leader') return { skin: SK[0], body: 0x8f1f2f, legs: 0x5a1020, robe: true, hat: 'crown', cape: 0x6a2a8a, beard: 0xd8d8d8, weapon: 'longsword', scale: 1.12 };
    if (kind === 'commander') return { skin: SK[1], body: 0x2c4f9e, arms: 0x9aa0aa, legs: 0x6a6e78, hat: 'plume', hatColor: 0xb0b4bc, cape: 0xc0392b, beard: 0x4a321c, weapon: 'longsword', scale: 1.06 };
    if (kind === 'merchant') return { skin: SK[1], body: 0x6a7a9a, legs: 0x4a4a55, hat: 'hat', hatColor: 0x2c4f9e };
    return { skin: pick(SK), body: 0x2c4f9e, arms: 0x9aa0aa, legs: 0x6a6e78, hat: 'helmet', hatColor: 0xa8acb4, belt: 0xd6a530, weapon: ranged ? 'bow' : 'sword' };
  }
  if (faction === 'evil') {
    if (kind === 'leader') return { skin: 0x9a9aa8, body: 0x15121a, legs: 0x15121a, robe: true, hat: 'horns', hatColor: 0x15121a, cape: 0x4a1a6a, eyes: 0xd060ff, eyesGlow: 0xa040ff, weapon: 'blackblade', scale: 1.28 };
    if (kind === 'merchant') return { skin: 0x7a9060, body: 0x4a3a30, legs: 0x2b2730, hat: 'hood', hatColor: 0x3a2a40 };
    return { skin: 0x6f8a55, body: 0x2b2730, arms: 0x6f8a55, legs: 0x3a3440, hat: ranged ? 'hood' : 'horns', hatColor: 0x3a3440, belt: 0x7a2bb0, eyes: 0xff4040, weapon: ranged ? 'bow' : pick(['axe', 'sword']), scale: 1.06 };
  }
  // люди
  if (kind === 'merchant') return { skin: pick(SK), body: pick([0x8a5a3a, 0x6a6a8a, 0x8a3a3a]), legs: 0x4a3a2a, hat: 'hat', hatColor: 0x3a2a18, belt: 0xd9c7a0, beard: pick([0, 0x4a321c, 0x888888]) || undefined };
  if (kind === 'civilian') return { skin: pick(SK), body: pick([0xb07040, 0x7080a0, 0xa0a070, 0x905050, 0x6a8a5a]), legs: pick([0x4a3a2a, 0x5a5a5a]), hat: pick(['hair', 'hat', 'hair']), hatColor: pick([0x3a2a18, 0x6b4a2c, 0xd0b060]) };
  return { skin: pick(SK), body: 0x8a6238, arms: 0xa08a60, legs: 0x5a4a3a, hat: 'kettle', hatColor: 0x9a9a9a, weapon: ranged ? 'bow' : 'sword' };
}

const NAMES = {
  elf: ['Лаэриль', 'Тиндомэ', 'Аэгнор', 'Илвэ', 'Нимлот', 'Келеборн', 'Финдуил', 'Маэглин', 'Эльвинг', 'Орофер'],
  empire: ['Борис', 'Ратибор', 'Гордей', 'Феофан', 'Добрыня', 'Мстислав', 'Ярополк', 'Всеволод', 'Тихон', 'Савва'],
  evil: ['Гхаш', 'Уруг', 'Морг', 'Шнага', 'Дурз', 'Крыг', 'Больг', 'Гнур', 'Зуг', 'Хрым'],
  human: ['Иван', 'Пахом', 'Марфа', 'Кузьма', 'Фёкла', 'Прохор', 'Аграфена', 'Ермолай', 'Глаша', 'Сидор'],
};
const KIND_TITLE = { warrior: 'воин', archer: 'лучник', civilian: 'житель', merchant: 'торговец', leader: 'предводитель', commander: 'командир' };
const STATS = {
  warrior: { hp: 60, dmg: 10, speed: 4.6 }, archer: { hp: 44, dmg: 9, speed: 4.4 },
  civilian: { hp: 28, dmg: 0, speed: 3.6 }, merchant: { hp: 70, dmg: 0, speed: 3 },
  commander: { hp: 170, dmg: 17, speed: 4.8 }, leader: { hp: 280, dmg: 21, speed: 4.4 },
};

export function hostile(a, b) { return a !== b && a !== 'human' && b !== 'human'; }

let nextId = 1;
export class NPC {
  constructor(o) {
    this.id = nextId++;
    this.faction = o.faction; this.kind = o.kind;
    const st = STATS[o.kind], fm = o.faction === 'evil' ? 1.15 : o.faction === 'empire' ? 1.08 : 1;
    this.maxHp = this.hp = Math.round(st.hp * (o.kind === 'leader' || o.kind === 'commander' ? 1 : fm) * (o.hpMul || 1));
    this.dmg = st.dmg * (o.faction === 'evil' ? 1.1 : 1);
    this.speed = st.speed * (o.faction === 'elf' ? 1.12 : 1) * rnd(0.93, 1.07);
    this.ranged = o.kind === 'archer';
    this.combatant = st.dmg > 0;
    this.name = o.name || `${pick(NAMES[o.faction])}, ${KIND_TITLE[o.kind]}`;
    this.role = o.role || null;
    this.h = makeHumanoid(o.look || lookFor(o.faction, o.kind));
    this.pos = this.h.root.position;
    this.pos.set(o.x, heightAt(o.x, o.z), o.z);
    this.yaw = o.face ?? rnd(Math.PI * 2);
    this.home = { x: o.hx ?? o.x, z: o.hz ?? o.z, r: o.hr ?? 12 };
    this.state = o.state || (this.combatant ? 'wander' : 'idle');
    this.face = o.face;
    this.alive = true; this.target = null; this.cd = rnd(1); this.atkT = 0; this.hitPending = false;
    this.thinkT = rnd(0.5); this.walkPh = rnd(6); this.wanderT = rnd(4); this.wp = null;
    this.body = { armL: 1, armR: 1, legL: 1, legR: 1, eyeL: 1, eyeR: 1 };
    this.bleed = 0; this.recoil = 0; this.stuckT = 0; this.detourT = 0; this.detourS = 1;
    this.leader = null; this.off = { x: rnd(-3, 3), z: rnd(-3, 3) };
    this.path = null; this.pi = 0; this.onArrive = null;
    this.provoked = false; this.group = o.group || null; this.garrison = !!o.garrison; this.tag = o.tag || null;
    this.fleeT = 0; this.lodAcc = 0; this.moving = 0; this.despawn = false;
    scene.add(this.h.root);
    G.npcs.push(this);
  }
  get crawling() { return !this.body.legL || !this.body.legR; }
  get aimH() { return this.crawling ? 0.4 : 1.25; }

  hostileTo(e) {
    if (e.isPlayer) {
      const P = G.player;
      if (this.faction === P.faction) return false;
      if (this.faction === 'human') return this.provoked || P.repHuman <= -20;
      return true;
    }
    return hostile(this.faction, e.faction);
  }

  think() {
    const P = G.player;
    let t = this.target;
    if (t && (!t.alive || t.despawn)) t = this.target = null;
    if (!this.combatant) {
      // мирные: убегают от драки
      if (this.kind === 'civilian') {
        let danger = null, best = 14 * 14;
        const chk = e => { const d = (e.pos.x - this.pos.x) ** 2 + (e.pos.z - this.pos.z) ** 2; if (d < best && this.hostileTo(e)) { best = d; danger = e; } };
        if (P.alive) chk(P);
        for (const n of G.npcs) if (n.alive && n.combatant && n !== this) chk(n);
        if (danger) { this.fleeT = 4; this.fleeFrom = danger; }
      }
      return;
    }
    const per = (this.body.eyeL && this.body.eyeR ? 40 : this.body.eyeL || this.body.eyeR ? 26 : 7) * (G.daylight < 0.3 ? 0.75 : 1);
    let best = per * per, found = null;
    if (t) { const d = (t.pos.x - this.pos.x) ** 2 + (t.pos.z - this.pos.z) ** 2; if (d > 75 * 75) t = this.target = null; else best = Math.min(best, d * 0.6); }
    if (P.alive && this.hostileTo(P)) { const d = (P.pos.x - this.pos.x) ** 2 + (P.pos.z - this.pos.z) ** 2; if (d < best) { best = d; found = P; } }
    for (let i = 0; i < G.npcs.length; i++) {
      const n = G.npcs[i];
      if (!n.alive || n === this || !hostile(this.faction, n.faction)) continue;
      const d = (n.pos.x - this.pos.x) ** 2 + (n.pos.z - this.pos.z) ** 2;
      if (d < best) { best = d; found = n; }
    }
    if (found) this.target = found;
    // поводок для гарнизона
    if (this.target && (this.state === 'wander' || this.state === 'idle') && !this.leader) {
      const dh = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
      if (dh > this.home.r + 85) this.target = null;
    }
  }

  moveToward(tx, tz, speed, dt) {
    let dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) return true;
    dx /= d; dz /= d;
    if (this.detourT > 0) {
      this.detourT -= dt;
      const a = this.detourS * 1.35, c = Math.cos(a), s = Math.sin(a), nx = dx * c - dz * s, nz = dx * s + dz * c;
      dx = nx; dz = nz;
    }
    if (this.crawling) speed = Math.min(speed, 0.9);
    const step = Math.min(d, speed * dt);
    this.pos.x += dx * step; this.pos.z += dz * step;
    if (collide(this.pos, 0.45)) {
      this.stuckT += dt;
      if (this.stuckT > 0.45 && this.detourT <= 0) { this.detourT = 1.3 + rnd(0.8); this.detourS = Math.random() < 0.5 ? -1 : 1; this.stuckT = 0; }
    } else this.stuckT = Math.max(0, this.stuckT - dt * 0.5);
    this.pos.x = clamp(this.pos.x, -592, 592); this.pos.z = clamp(this.pos.z, -592, 592);
    this.turn(Math.atan2(dx, dz), dt);
    this.moving = speed;
    return false;
  }
  turn(a, dt) { this.yaw += clamp(angDiff(a, this.yaw), -8 * dt, 8 * dt); }

  update(dt) {
    if (this.bleed > 0) { this.hp -= this.bleed * dt; if (Math.random() < dt * 3) spawnBlood(this.pos.x, this.pos.y + 0.8, this.pos.z, 1); if (this.hp <= 0) { this.die(this.lastAttacker); return; } }
    this.cd -= dt; this.moving = 0;
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = 0.35 + rnd(0.3); this.think(); }
    const t = this.target;
    if (this.fleeT > 0 && this.fleeFrom) {
      this.fleeT -= dt;
      const dx = this.pos.x - this.fleeFrom.pos.x, dz = this.pos.z - this.fleeFrom.pos.z, d = Math.hypot(dx, dz) || 1;
      this.moveToward(this.pos.x + dx / d * 10, this.pos.z + dz / d * 10, this.speed * 1.5, dt);
    } else if (t && t.alive) this.fight(t, dt);
    else this.behave(dt);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.animate(dt);
  }

  fight(t, dt) {
    const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const canShoot = this.ranged && this.body.armL && this.body.armR;
    if (canShoot) {
      if (d > 25) this.moveToward(t.pos.x, t.pos.z, this.speed, dt);
      else if (d < 6) this.moveToward(this.pos.x - dx, this.pos.z - dz, this.speed * 0.8, dt);
      else this.turn(Math.atan2(dx, dz), dt);
      if (d < 32 && this.cd <= 0 && Math.abs(angDiff(Math.atan2(dx, dz), this.yaw)) < 0.5) {
        this.cd = 2.1 + rnd(0.9); this.atkT = 0.4;
        const sp = 38, tt = d / sp, g = 9.8 * 0.55;
        const err = (this.body.eyeL && this.body.eyeR ? 0.035 : 0.12) * (d / 14 + 0.4);
        const dy = (t.pos.y + (t.aimH || 1.2)) - (this.pos.y + 1.5);
        const v = new THREE.Vector3(dx / tt + rnd(-err, err) * sp, dy / tt + 0.5 * g * tt + rnd(-err, err) * sp * 0.5, dz / tt + rnd(-err, err) * sp);
        shoot(this, new THREE.Vector3(this.pos.x, this.pos.y + 1.5, this.pos.z), v, this.dmg, false);
        G.sfx('bow', this.pos);
      }
    } else {
      const reach = 1.9;
      if (d > reach) this.moveToward(t.pos.x, t.pos.z, this.speed, dt);
      else {
        this.turn(Math.atan2(dx, dz), dt);
        if (this.cd <= 0 && this.atkT <= 0) { this.atkT = 0.5; this.hitPending = true; this.cd = 1.25 + rnd(0.6); }
      }
      if (this.hitPending && this.atkT <= 0.22) {
        this.hitPending = false;
        if (d < reach + 0.9) {
          let dm = this.dmg * rnd(0.8, 1.2);
          if (!this.body.armR) dm *= 0.5; if (!this.body.armL && !this.body.armR) dm *= 0.4; if (this.ranged) dm *= 0.6;
          hurt(t, dm, this, 'melee');
        } else G.sfx('swing', this.pos);
      }
    }
  }

  behave(dt) {
    const st = this.state;
    if (st === 'path' && this.path) {
      const p = this.path[this.pi];
      if (!p) { this.path = null; this.state = 'wander'; if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(this); } return; }
      const tx = p.x + this.off.x, tz = p.z + this.off.z;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 3) this.pi++;
      else this.moveToward(tx, tz, this.speed * (this.pathSpeed || 0.9), dt);
    } else if (st === 'follow' && this.leader) {
      const L = this.leader;
      if (L.alive === false || L.despawn) { this.leader = null; this.state = 'wander'; this.home = { x: this.pos.x, z: this.pos.z, r: 10 }; return; }
      const tx = L.pos.x + this.off.x, tz = L.pos.z + this.off.z, d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
      if (d > 1.6) this.moveToward(tx, tz, d > 9 ? this.speed * 1.7 : d > 4 ? this.speed : this.speed * 0.5, dt);
      if (d > 120 && L.isPlayer) { this.pos.x = tx; this.pos.z = tz; }
    } else if (st === 'wander') {
      const dh = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
      if (this.wp) {
        if (this.moveToward(this.wp.x, this.wp.z, dh > this.home.r + 8 ? this.speed : this.speed * 0.4, dt) || Math.hypot(this.wp.x - this.pos.x, this.wp.z - this.pos.z) < 1) { this.wp = null; this.wanderT = rnd(2, 7); }
        else { this.wpT -= dt; if (this.wpT <= 0) this.wp = null; }
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0 || dh > this.home.r + 8) { const a = rnd(Math.PI * 2), r = Math.sqrt(Math.random()) * this.home.r; this.wp = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; this.wpT = 25 + dh / 3; }
      }
    } else if (st === 'idle') {
      const dh = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
      if (dh > 1) this.moveToward(this.home.x, this.home.z, this.speed * 0.7, dt);
      else {
        const P = G.player;
        if (this.role && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 7) this.turn(Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), dt);
        else if (this.face !== undefined) this.turn(this.face, dt);
      }
    }
  }

  animate(dt) {
    const h = this.h;
    h.root.rotation.y = this.yaw;
    if (this.moving) this.walkPh += dt * this.moving * 2.1;
    const sw = this.moving ? Math.sin(this.walkPh) * 0.75 : 0;
    h.legL.rotation.x = sw; h.legR.rotation.x = -sw;
    h.armL.rotation.x = (this.ranged && this.target && this.body.armR) ? -1.45 : -sw * 0.7;
    if (this.atkT > 0) { this.atkT -= dt; const k = 1 - clamp(this.atkT / 0.5, 0, 1); h.armR.rotation.x = this.ranged ? -1.2 : lerp(-2.8, -0.3, k * k); }
    else h.armR.rotation.x = this.target ? -0.7 + sw * 0.3 : sw * 0.7;
    this.recoil = Math.max(0, this.recoil - dt * 4);
    h.body.rotation.z = this.recoil * 0.35;
    if (this.crawling) { h.body.rotation.x = lerp(h.body.rotation.x, 1.4, dt * 6); h.body.position.y = 0.3; h.armL.rotation.x = -2.6 + sw; h.armR.rotation.x = -2.6 - sw; }
  }

  takeDamage(amount, attacker, kind) {
    if (!this.alive) return;
    const P = G.player;
    if (attacker && attacker.isPlayer) {
      if (this.faction === P.faction) return;
      if (this.faction === 'human' && !this.provoked) G.provoke(this);
    }
    this.hp -= amount; this.recoil = 1; this.lastAttacker = attacker;
    spawnBlood(this.pos.x, this.pos.y + 1.2, this.pos.z, 4);
    G.sfx('hit', this.pos);
    if (attacker && attacker.alive && this.combatant && (!this.target || Math.random() < 0.5) && (attacker.isPlayer ? this.hostileTo(attacker) : hostile(this.faction, attacker.faction))) this.target = attacker;
    if (!this.combatant && attacker) { this.fleeT = 6; this.fleeFrom = attacker; if (this.kind === 'merchant') this.fleeT = 0; }
    if (this.hp <= 0) { this.die(attacker); return; }
    // увечья
    const ch = (attacker && attacker.isPlayer ? 0.2 : 0.07) * (amount >= 8 ? 1 : 0.3) * (this.kind === 'leader' ? 0.4 : 1);
    if (Math.random() < ch) this.maim(kind === 'arrow' && Math.random() < 0.5 ? 'eye' : pick(['arm', 'arm', 'leg', 'leg', 'eye']), attacker);
  }

  maim(what, attacker) {
    const b = this.body, h = this.h, side = Math.random() < 0.5 ? 'L' : 'R';
    let key = what + side; if (!b[key]) key = what + (side === 'L' ? 'R' : 'L'); if (!b[key]) return;
    b[key] = 0;
    const byP = attacker && attacker.isPlayer;
    if (what === 'eye') {
      h[key].material = mat(0xaa0000);
      if (byP || this.near(40)) G.ui.float(this.pos, 'Выбит глаз!', '#ff8080');
    } else {
      const limb = h[key];
      spawnGib(limb, this);
      this.bleed += 1.6;
      if (key === 'armR' && h.weapon && !this.ranged) h.weapon = null;
      if (byP || this.near(40)) G.ui.float(this.pos, what === 'arm' ? 'Отрублена рука!' : 'Отрублена нога!', '#ff5050');
      spawnBlood(this.pos.x, this.pos.y + 1, this.pos.z, 10);
    }
    if (byP) G.sfx('maim', this.pos);
  }
  near(r) { const P = G.player; return (P.pos.x - this.pos.x) ** 2 + (P.pos.z - this.pos.z) ** 2 < r * r; }

  die(attacker) {
    if (!this.alive) return;
    this.alive = false; this.hp = 0; this.deathT = 0; this.corpseT = 0; this.target = null;
    const rich = this.kind === 'leader' ? 300 : this.kind === 'commander' ? 120 : this.kind === 'merchant' ? 60 : this.kind === 'civilian' ? 6 : 14;
    this.loot = { gold: rndInt(rich * 0.5, rich * 1.5), items: {} };
    if (this.combatant) {
      if (Math.random() < 0.3) this.loot.items.bandage = 1;
      if (Math.random() < 0.15) this.loot.items.potion = 1;
      if (this.ranged) this.loot.items.arrow = rndInt(4, 12);
      if (this.faction === 'elf' && Math.random() < 0.5) this.loot.items.ear = rndInt(1, 2);
      if (Math.random() < 0.06) this.loot.items[pick(['hook', 'pegleg', 'crystaleye'])] = 1;
    }
    if (this.kind === 'leader') this.loot.items[this.faction === 'evil' ? 'blackblade' : this.faction === 'elf' ? 'longbow' : 'plate'] = 1;
    G.corpses.push(this);
    G.sfx('die', this.pos);
    if (G.onKill) G.onKill(this, attacker);
  }
  // анимация падения; труп остаётся трёхмерным и лежит, пока не истлеет
  updateCorpse(dt) {
    this.corpseT += dt;
    if (this.deathT < 1) {
      this.deathT = Math.min(1, this.deathT + dt * 2.2);
      const h = this.h, k = this.deathT * this.deathT;
      if (!this.crawling) { h.body.rotation.x = -1.5 * k; h.body.position.y = 0.22 * k; }
      h.armL.rotation.x = -0.4; h.armR.rotation.x = 0.3; h.armL.rotation.z = -0.8 * k; h.armR.rotation.z = 0.8 * k;
      h.legL.rotation.x = 0.15; h.legR.rotation.x = -0.1;
      this.pos.y = heightAt(this.pos.x, this.pos.z);
    }
    return this.corpseT > 170;
  }
  remove() { scene.remove(this.h.root); this.despawn = true; this.alive = false; }
}

// Единая точка нанесения урона (игроку или NPC).
export function hurt(victim, amount, attacker, kind) {
  if (!victim.alive) return;
  if (victim.isPlayer) G.player.takeDamage(amount, attacker, kind);
  else victim.takeDamage(amount, attacker, kind);
}

// ---------- отрубленные конечности и кровь ----------
const gibs = [], blood = [], bloodPool = [];
const _wp = new THREE.Vector3(), _wq = new THREE.Quaternion();
function spawnGib(limb, owner) {
  limb.getWorldPosition(_wp); limb.getWorldQuaternion(_wq);
  limb.parent.remove(limb);
  limb.position.copy(_wp); limb.quaternion.copy(_wq);
  const s = owner.h.root.scale.x; limb.scale.setScalar(s);
  scene.add(limb);
  gibs.push({ o: limb, vx: rnd(-2.5, 2.5), vy: rnd(3, 5.5), vz: rnd(-2.5, 2.5), rest: false, t: 0 });
  if (gibs.length > 70) scene.remove(gibs.shift().o);
}
export function spawnBlood(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    let m = bloodPool.pop();
    if (!m) { if (blood.length > 140) return; m = box(0.09, 0.09, 0.09, 0xa00808); }
    m.position.set(x, y, z); scene.add(m);
    blood.push({ o: m, vx: rnd(-2, 2), vy: rnd(1, 4), vz: rnd(-2, 2), t: rnd(0.5, 0.9) });
  }
}
function updateFx(dt) {
  for (const g of gibs) {
    if (g.rest) continue;
    g.vy -= 14 * dt; g.o.position.x += g.vx * dt; g.o.position.y += g.vy * dt; g.o.position.z += g.vz * dt;
    g.o.rotation.x += dt * 7; g.o.rotation.z += dt * 5;
    const gy = heightAt(g.o.position.x, g.o.position.z) + 0.12;
    if (g.o.position.y < gy && g.vy < 0) { g.o.position.y = gy; g.rest = true; g.o.rotation.set(Math.PI / 2, 0, rnd(6)); }
  }
  for (let i = blood.length - 1; i >= 0; i--) {
    const b = blood[i]; b.t -= dt; b.vy -= 12 * dt;
    b.o.position.x += b.vx * dt; b.o.position.y += b.vy * dt; b.o.position.z += b.vz * dt;
    if (b.t <= 0) { scene.remove(b.o); bloodPool.push(b.o); blood.splice(i, 1); }
  }
}

// ---------- снаряды ----------
const arrowGeo = new THREE.BoxGeometry(0.035, 0.035, 0.9);
const boltGeo = new THREE.IcosahedronGeometry(0.22, 0);
const _dir = new THREE.Vector3();
export function shoot(owner, from, vel, dmg, magic) {
  const m = new THREE.Mesh(magic ? boltGeo : arrowGeo, magic ? mat(0xc060ff, 0xa040ff) : mat(0xd8c8a0));
  m.position.copy(from); scene.add(m);
  G.projectiles.push({ o: m, v: vel, owner, dmg, magic, life: 5, stuck: 0, faction: owner.faction });
}
function updateProjectiles(dt) {
  const P = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    if (p.stuck > 0) { p.stuck -= dt; if (p.stuck <= 0) { scene.remove(p.o); G.projectiles.splice(i, 1); } continue; }
    p.life -= dt;
    let done = p.life <= 0;
    for (let s = 0; s < 2 && !done; s++) {
      const h = dt / 2;
      if (!p.magic) p.v.y -= 9.8 * 0.55 * h;
      const o = p.o.position; o.addScaledVector(p.v, h);
      if (o.y < heightAt(o.x, o.z) || pointBlocked(o.x, o.y, o.z)) { if (p.magic) done = true; else { p.stuck = 8; } break; }
      const test = e => {
        if (!e.alive || e === p.owner) return false;
        const dx = e.pos.x - o.x, dz = e.pos.z - o.z;
        if (dx * dx + dz * dz > 0.36) return false;
        const top = e.isPlayer ? e.eyeH + 0.2 : (e.crawling ? 0.7 : 1.95 * e.h.root.scale.y);
        return o.y > e.pos.y - 0.1 && o.y < e.pos.y + top;
      };
      if (!p.owner.isPlayer && P.alive && p.owner.hostileTo && p.owner.hostileTo(P) && test(P)) { hurt(P, p.dmg, p.owner, p.magic ? 'magic' : 'arrow'); done = true; break; }
      for (let k = 0; k < G.npcs.length; k++) {
        const n = G.npcs[k];
        if (p.owner.isPlayer ? n.faction === P.faction : !hostile(p.faction, n.faction)) continue;
        if (test(n)) { hurt(n, p.dmg, p.owner, p.magic ? 'magic' : 'arrow'); done = true; break; }
      }
    }
    if (done) { scene.remove(p.o); G.projectiles.splice(i, 1); continue; }
    if (!p.stuck) { _dir.copy(p.o.position).add(p.v); p.o.lookAt(_dir); if (p.magic) p.o.rotation.z += dt * 9; }
  }
}

// ---------- корованы ----------
function makeCow() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.8, 1.7, 0xf2efe6, 0, 1.15, 0), box(0.5, 0.5, 0.42, 0x2a2622, 0.16, 1.3, 0.3), box(0.4, 0.42, 0.5, 0x2a2622, -0.21, 1.2, -0.45));
  g.add(box(0.44, 0.46, 0.56, 0xf2efe6, 0, 1.38, 1.05), box(0.3, 0.2, 0.16, 0xe8a8a0, 0, 1.25, 1.36));
  const h1 = cone(0.05, 0.28, 4, 0xd8d0b8, -0.2, 1.7, 1.0), h2 = cone(0.05, 0.28, 4, 0xd8d0b8, 0.2, 1.7, 1.0); h1.rotation.z = 0.5; h2.rotation.z = -0.5; g.add(h1, h2);
  g.legs = [];
  for (const [x, z] of [[-0.27, 0.62], [0.27, 0.62], [-0.27, -0.62], [0.27, -0.62]]) { const p = new THREE.Group(); p.position.set(x, 0.78, z); p.add(box(0.18, 0.78, 0.18, 0xe6e2d8, 0, -0.39, 0)); g.add(p); g.legs.push(p); }
  g.add(box(0.06, 0.5, 0.06, 0xf2efe6, 0, 1.0, -0.9));
  return g;
}
export class Caravan {
  constructor(faction, path, guards = 3) {
    this.faction = faction; this.path = path; this.pi = 1; this.alive = true; this.looted = false; this.isCaravan = true;
    const g = this.model = new THREE.Group();
    g.add(box(2.2, 0.9, 3.8, 0x8a6238, 0, 1.05, 0), box(2.3, 0.14, 3.9, 0x5a4028, 0, 0.6, 0));
    const can = new THREE.Mesh(geo('canopy', () => new THREE.CylinderGeometry(1.15, 1.15, 3.6, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)), new THREE.MeshLambertMaterial({ color: FACTIONS[faction].color, side: THREE.DoubleSide }));
    can.position.set(0, 1.5, 0);
    this.canopy = can; g.add(can);
    this.wheels = [];
    for (const [x, z] of [[-1.2, 1.2], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2]]) { const w = cyl(0.62, 0.14, 10, 0x4a321c, x, 0.62, z); w.rotation.z = Math.PI / 2; g.add(w); this.wheels.push(w); }
    g.add(box(0.1, 0.1, 2.6, 0x5a4028, 0, 0.9, 3.0));
    this.goods = [box(0.7, 0.6, 0.7, 0xb08a4a, -0.5, 1.8, 0.8), box(0.6, 0.5, 0.9, 0x8f5a3a, 0.5, 1.75, -0.3), box(0.5, 0.5, 0.5, 0xc0a030, -0.3, 1.75, -1.1)];
    this.goods.forEach(m => g.add(m));
    this.cows = [makeCow(), makeCow()];
    this.cows[0].position.set(-0.6, 0, 3.2); this.cows[1].position.set(0.6, 0, 3.2); g.add(this.cows[0], this.cows[1]);
    this.pos = g.position; this.pos.set(path[0].x, heightAt(path[0].x, path[0].z), path[0].z);
    this.yaw = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
    scene.add(g);
    this.guards = [];
    const gf = faction;
    for (let i = 0; i < guards; i++) {
      const a = i / guards * Math.PI * 2;
      const n = new NPC({ faction: gf, kind: i === 0 ? 'archer' : 'warrior', x: this.pos.x + Math.cos(a) * 4, z: this.pos.z + Math.sin(a) * 4, state: 'follow', group: this });
      n.leader = this; n.off = { x: Math.cos(a) * 4.5, z: Math.sin(a) * 4.5 }; n.name = n.name.replace(/,.*/, ', охранник корована');
      this.guards.push(n);
    }
    this.loot = { gold: rndInt(90, 220), items: {} };
    const goods = faction === 'evil' ? ['ore', 'ore', 'gem', 'potion'] : faction === 'empire' ? ['gem', 'silk', 'spice', 'potion'] : faction === 'elf' ? ['silk', 'spice', 'potion', 'arrow'] : ['silk', 'spice', 'ore', 'bread'];
    for (let i = 0; i < 4; i++) { const it = pick(goods); this.loot.items[it] = (this.loot.items[it] || 0) + (it === 'arrow' ? 15 : rndInt(1, 2)); }
    if (faction === 'empire') this.loot.gold += 120;
    G.caravans.push(this);
  }
  guardsAlive() { let c = 0; for (const n of this.guards) if (n.alive && Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z) < 45) c++; return c; }
  update(dt) {
    let fighting = false;
    for (const n of this.guards) if (n.alive && n.target) fighting = true;
    const P = G.player;
    const pd = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (pd < 5 && !this.looted && this.faction !== P.faction) fighting = true;   // игрок перегородил дорогу
    const p = this.path[this.pi];
    if (!p) { this.removeAll(); return; }
    if (!fighting) {
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.5) this.pi++;
      else {
        const sp = 2.5 * dt;
        this.yaw += clamp(angDiff(Math.atan2(dx, dz), this.yaw), -1.2 * dt, 1.2 * dt);
        this.pos.x += Math.sin(this.yaw) * sp; this.pos.z += Math.cos(this.yaw) * sp;
        this.ph = (this.ph || 0) + dt * 5;
        for (const w of this.wheels) w.rotation.x += sp / 0.62;
        for (const c of this.cows) c.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.5 : 0)) * 0.5; });
      }
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    const f = heightAt(this.pos.x + Math.sin(this.yaw) * 2.5, this.pos.z + Math.cos(this.yaw) * 2.5), b = heightAt(this.pos.x - Math.sin(this.yaw) * 2.5, this.pos.z - Math.cos(this.yaw) * 2.5);
    this.model.rotation.set(-Math.atan2(f - b, 5), this.yaw, 0, 'YXZ');
    this.model.visible = pd < 380;
  }
  rob() {
    this.looted = true; this.canopy.visible = false; this.goods.forEach(m => m.visible = false);
    return this.loot;
  }
  removeAll() {
    this.alive = false; this.despawn = true; scene.remove(this.model);
    for (const n of this.guards) if (n.alive) n.remove();
  }
}

// ---------- общий апдейт ----------
let frame = 0;
export function updateEntities(dt) {
  frame++;
  const P = G.player, npcs = G.npcs;
  for (let i = npcs.length - 1; i >= 0; i--) {
    const n = npcs[i];
    if (!n.alive) { npcs.splice(i, 1); continue; }
    const d2 = (n.pos.x - P.pos.x) ** 2 + (n.pos.z - P.pos.z) ** 2;
    n.h.root.visible = d2 < 360 * 360;
    n.lodAcc += dt;
    if (d2 > 260 * 260 && (frame + n.id) % 4) continue;
    const ndt = Math.min(n.lodAcc, 0.25); n.lodAcc = 0;
    n.update(ndt);
  }
  // расталкивание
  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i]; if (!a.alive) continue;
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      if (dx > 0.9 || dx < -0.9 || dz > 0.9 || dz < -0.9 || !b.alive) continue;
      const d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 0.001) { const k = (0.85 - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
    }
    const dx = a.pos.x - P.pos.x, dz = a.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.9 && d > 0.001 && P.alive) { const k = (0.9 - d) / d; a.pos.x += dx * k; a.pos.z += dz * k; }
  }
  for (let i = G.corpses.length - 1; i >= 0; i--) {
    const c = G.corpses[i];
    if (c.updateCorpse(dt) || (G.corpses.length > 45 && i === 0)) { scene.remove(c.h.root); c.despawn = true; G.corpses.splice(i, 1); }
  }
  for (let i = G.caravans.length - 1; i >= 0; i--) { const c = G.caravans[i]; if (c.alive) c.update(dt); if (!c.alive) G.caravans.splice(i, 1); }
  updateProjectiles(dt);
  updateFx(dt);
}

export function clearEntities() {
  for (const n of G.npcs) scene.remove(n.h.root);
  for (const c of G.corpses) scene.remove(c.h.root);
  for (const c of G.caravans) scene.remove(c.model);
  for (const p of G.projectiles) scene.remove(p.o);
  for (const g of gibs) scene.remove(g.o);
  for (const b of blood) scene.remove(b.o);
  G.npcs.length = G.corpses.length = G.caravans.length = G.projectiles.length = gibs.length = blood.length = 0;
}
export function initEntities(sc) { scene = sc; }
