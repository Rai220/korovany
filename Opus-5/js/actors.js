// Персонажи: 3-хмерные враги, союзники, торговцы.
// Их можно не только убить, но и отрубить руку или ногу. И труп тоже 3д.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { FACTIONS, isHostile, ITEMS } from './config.js';
import { clamp, rand, randInt, chance, choice, approachAngle } from './util.js';

const matCache = {};
function m(hex) {
  if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
  return matCache[hex];
}
function bx(w, h, d, hex) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(hex));
  mesh.castShadow = true;
  return mesh;
}

const SKINS = [0xd9b38c, 0xc79a71, 0xa87853, 0xe3c6a5];

/** Собирает 3-хмерное тело из частей, чтобы части можно было отрывать. */
export function buildBody(cfg) {
  const g = new THREE.Group();
  const cloth = cfg.cloth, accent = cfg.accent, skin = cfg.skin;
  const parts = {};

  const torso = bx(0.56, 0.74, 0.32, cloth);
  torso.position.y = 1.24;
  g.add(torso);
  parts.torso = torso;

  const belt = bx(0.6, 0.12, 0.36, accent);
  belt.position.y = 0.9;
  g.add(belt);

  const headG = new THREE.Group();
  headG.position.y = 1.62;
  const head = bx(0.3, 0.32, 0.3, skin);
  head.position.y = 0.16;
  headG.add(head);
  if (cfg.helmet) {
    const hel = bx(0.34, 0.2, 0.34, accent);
    hel.position.y = 0.3;
    headG.add(hel);
    const crest = bx(0.06, 0.16, 0.3, cfg.crest ?? accent);
    crest.position.y = 0.46;
    headG.add(crest);
  } else if (cfg.hood) {
    const hood = bx(0.36, 0.26, 0.36, cloth);
    hood.position.y = 0.3;
    headG.add(hood);
  } else if (cfg.ears) {
    for (const sx of [-1, 1]) {
      const ear = bx(0.06, 0.22, 0.06, skin);
      ear.position.set(sx * 0.17, 0.22, 0);
      ear.rotation.z = sx * 0.5;
      headG.add(ear);
    }
  }
  g.add(headG);
  parts.head = headG;

  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const armG = new THREE.Group();
    armG.position.set(s * 0.37, 1.5, 0);
    const arm = bx(0.16, 0.62, 0.16, cfg.sleeves ?? cloth);
    arm.position.y = -0.31;
    armG.add(arm);
    const hand = bx(0.15, 0.13, 0.15, skin);
    hand.position.y = -0.66;
    armG.add(hand);
    g.add(armG);
    parts['arm' + side] = armG;

    const legG = new THREE.Group();
    legG.position.set(s * 0.15, 0.9, 0);
    const leg = bx(0.19, 0.84, 0.21, cfg.pants ?? cloth);
    leg.position.y = -0.42;
    legG.add(leg);
    const boot = bx(0.21, 0.14, 0.3, 0x3a2c1e);
    boot.position.set(0, -0.85, 0.04);
    legG.add(boot);
    g.add(legG);
    parts['leg' + side] = legG;
  }

  return { group: g, parts };
}

export function weaponMesh(id) {
  const g = new THREE.Group();
  if (id === 'bow') {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.035, 5, 14, Math.PI * 1.25),
      m(0x6b4a2c));
    arc.rotation.z = -Math.PI * 0.625;
    arc.castShadow = true;
    g.add(arc);
    const s = bx(0.018, 1.02, 0.018, 0xe8e0c8);
    s.position.z = 0.02;
    g.add(s);
    g.rotation.y = Math.PI / 2;   // держим вертикально, а не обручем
  } else if (id === 'crossbow') {
    const stock = bx(0.09, 0.62, 0.09, 0x4a3320);
    g.add(stock);
    const arms = bx(0.78, 0.055, 0.055, 0x6b4a2c);
    arms.position.y = 0.26;
    g.add(arms);
    const str = bx(0.76, 0.02, 0.02, 0xe8e0c8);
    str.position.set(0, 0.26, -0.1);
    g.add(str);
    g.rotation.x = Math.PI / 2;
  } else if (id === 'axe') {
    const h = bx(0.07, 0.9, 0.07, 0x4a3320);
    g.add(h);
    const bl = bx(0.36, 0.3, 0.06, 0xb9bcc2);
    bl.position.set(0.16, 0.38, 0);
    g.add(bl);
  } else if (id === 'darkstaff') {
    g.add(bx(0.07, 1.3, 0.07, 0x2a2226));
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: 0x8d2b2b, emissive: 0x5a0d0d }));
    orb.position.y = 0.7;
    g.add(orb);
  } else if (id === 'dagger') {
    g.add(bx(0.06, 0.24, 0.06, 0x4a3320));
    const bl = bx(0.05, 0.36, 0.02, 0xd8dce2);
    bl.position.y = 0.3;
    g.add(bl);
  } else {
    g.add(bx(0.08, 0.22, 0.08, 0x4a3320));
    const bl = bx(0.08, 0.86, 0.03, 0xd8dce2);
    bl.position.y = 0.54;
    g.add(bl);
    const cross = bx(0.3, 0.06, 0.06, 0xd8b23c);
    cross.position.y = 0.14;
    g.add(cross);
  }
  g.position.y = -0.7;
  g.rotation.z = 0.2;
  return g;
}

const NAMES = {
  elf: ['Лаэлиэль', 'Тинувиэль', 'Феандор', 'Эльрандир', 'Сильвар', 'Нэрвен'],
  guard: ['Гвардеец Пров', 'Сотник Гаврила', 'Стражник Клим', 'Копейщик Фрол', 'Латник Сила'],
  villain: ['Слуга Мрака', 'Головорез', 'Горный тать', 'Приспешник', 'Чёрный лучник'],
  human: ['Мужик Степан', 'Баба Дарья', 'Возчик Митрофан', 'Купец Аким', 'Пастух Егор'],
};

let UID = 1;

export class Actor {
  constructor(game, opt) {
    this.game = game;
    this.id = UID++;
    this.faction = opt.faction;
    this.role = opt.role || 'grunt';
    this.name = opt.name || choice(NAMES[this.faction] || NAMES.human);
    this.maxHp = opt.hp ?? (this.role === 'grunt' ? 90 : 60);
    this.hp = this.maxHp;
    this.weapon = opt.weapon || 'sword';
    this.ranged = ITEMS[this.weapon]?.kind === 'ranged';
    this.speed = opt.speed ?? (this.faction === 'elf' ? 5.2 : 4.4);
    this.dead = false;
    this.deadT = 0;
    this.follower = !!opt.follower;
    this.peaceful = ['merchant', 'elder', 'commander', 'peasant', 'healer'].includes(this.role);
    this.home = new THREE.Vector3(opt.x, 0, opt.z);
    this.order = null;              // {type:'attack', x, z} — приказ отряду
    this.target = null;
    this.searchT = rand(0, 0.5);
    this.atkT = 0;
    this.hurtT = 0;
    this.swingT = 0;
    this.angry = new Set();          // фракции, которые нас лично обидели
    this.walkT = rand(0, 10);
    this.wanderT = 0;
    this.wanderDir = rand(0, Math.PI * 2);
    this.lost = { armL: false, armR: false, legL: false, legR: false };
    this.gold = opt.gold ?? randInt(8, 45);
    this.loot = opt.loot || (chance(0.35) ? [choice(['pelt', 'bandage', 'potion'])] : []);
    this.looted = false;

    const f = FACTIONS[this.faction];
    const cloth = opt.cloth ?? f.color;
    // Рукава темнее рубахи — иначе руку не отличить от туловища, и не видно, что её отрубили.
    const sleeves = new THREE.Color(cloth).multiplyScalar(0.62).getHex();
    const cfg = {
      cloth,
      sleeves,
      accent: f.accent,
      skin: choice(SKINS),
      helmet: this.faction === 'guard' && !this.peaceful,
      hood: this.faction === 'villain' || this.role === 'elder',
      ears: this.faction === 'elf',
      pants: 0x3d3527,
      crest: f.accent,
    };
    const built = buildBody(cfg);
    this.group = built.group;
    this.parts = built.parts;
    if (!this.peaceful || this.role === 'commander') {
      this.wep = weaponMesh(this.weapon);
      this.parts.armR.add(this.wep);
    }
    this.group.userData.actor = this;
    this.pos = new THREE.Vector3(opt.x, heightAt(opt.x, opt.z), opt.z);
    this.yaw = rand(0, Math.PI * 2);
    this.group.position.copy(this.pos);
    this.vel = new THREE.Vector3();
    game.scene.add(this.group);
  }

  get alive() { return !this.dead; }

  /** Радиус агрессии. */
  get aggro() { return this.role === 'archer' ? 62 : 46; }

  hostileTo(faction) {
    if (faction === this.faction) return false;
    if (this.angry.has(faction)) return true;
    if (this.peaceful) return false;
    return isHostile(this.faction, faction);
  }

  distTo(v) { return Math.hypot(this.pos.x - v.x, this.pos.z - v.z); }

  _pickTarget() {
    const g = this.game;
    let best = null, bestD = Infinity;
    const aggro = this.order ? 90 : this.aggro;

    if (g.playerAlive && this.hostileTo(g.player.faction)) {
      const d = this.distTo(g.player.pos);
      if (d < aggro) { best = g.player; bestD = d; }
    }
    for (const a of g.actors) {
      if (a === this || a.dead || !this.hostileTo(a.faction)) continue;
      const d = this.distTo(a.pos);
      if (d < aggro && d < bestD) { best = a; bestD = d; }
    }
    this.target = best;
  }

  update(dt) {
    if (this.dead) { this._updateCorpse(dt); return; }
    const g = this.game;

    this.searchT -= dt;
    if (this.searchT <= 0) { this.searchT = 0.35 + Math.random() * 0.3; this._pickTarget(); }
    if (this.target && (this.target.dead || (this.target === g.player && !g.playerAlive))) this.target = null;

    let moveX = 0, moveZ = 0, want = 0;
    const t = this.target;

    if (t) {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), dt * 6);
      const reach = this.ranged ? 26 : 2.6;
      if (d > reach) { moveX = dx / d; moveZ = dz / d; want = 1; }
      else if (this.ranged && d < 12) { moveX = -dx / d; moveZ = -dz / d; want = 0.6; }
      this.atkT -= dt;
      if (d <= reach + 0.4 && this.atkT <= 0) this._attack(t, d);
    } else if (this.order) {
      const dx = this.order.x - this.pos.x, dz = this.order.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const stopD = this.order.type === 'escort' ? 2.2 : 8;
      if (d > stopD) {
        moveX = dx / d; moveZ = dz / d;
        want = this.order.type === 'escort' ? Math.min(1, d / 6) : 1;
        this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), dt * 4);
      }
    } else if (this.follower && g.playerAlive) {
      const dx = g.player.pos.x - this.pos.x, dz = g.player.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      if (d > 6) { moveX = dx / d; moveZ = dz / d; want = d > 16 ? 1 : 0.7; this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), dt * 5); }
    } else if (!this.peaceful || this.role === 'peasant') {
      // Патруль вокруг дома.
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(2.5, 6);
        this.wanderDir = rand(0, Math.PI * 2);
        if (this.distTo(this.home) > 40) {
          this.wanderDir = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
        }
      }
      moveX = Math.sin(this.wanderDir);
      moveZ = Math.cos(this.wanderDir);
      want = 0.35;
      this.yaw = approachAngle(this.yaw, this.wanderDir, dt * 2);
    }

    // Скорость зависит от целых ног.
    let sp = this.speed * want;
    const legs = (this.lost.legL ? 0 : 1) + (this.lost.legR ? 0 : 1);
    if (legs === 1) sp *= 0.5;
    if (legs === 0) sp *= 0.16;

    if (want > 0) {
      this.pos.x += moveX * sp * dt;
      this.pos.z += moveZ * sp * dt;
      this.walkT += dt * (sp * 1.9 + 1);
    }

    // Не залезать друг в друга.
    for (const a of g.actors) {
      if (a === this || a.dead) continue;
      const dx = this.pos.x - a.pos.x, dz = this.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.1 * 1.1 && d2 > 1e-5) {
        const d = Math.sqrt(d2), push = (1.1 - d) * 0.5;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
    this.pos.x = clamp(this.pos.x, -980, 980);
    this.pos.z = clamp(this.pos.z, -980, 980);
    this.pos.y = heightAt(this.pos.x, this.pos.z);

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;

    // Ходьба и замах.
    const sw = want > 0 ? Math.sin(this.walkT * 3.2) * 0.55 * want : 0;
    if (!this.lost.legL) this.parts.legL.rotation.x = sw;
    if (!this.lost.legR) this.parts.legR.rotation.x = -sw;
    if (!this.lost.armL) this.parts.armL.rotation.x = -sw * 0.7;
    if (!this.lost.armR) {
      this.parts.armR.rotation.x = this.swingT > 0
        ? -2.1 * Math.sin(clamp(this.swingT / 0.22, 0, 1) * Math.PI)
        : sw * 0.7;
    }
    if (this.swingT > 0) this.swingT -= dt;

    if (this.hurtT > 0) {
      this.hurtT -= dt;
      this.group.position.y += Math.sin(this.hurtT * 40) * 0.03;
    }
  }

  swingT = 0;

  _attack(target, dist) {
    const w = ITEMS[this.weapon] || ITEMS.sword;
    this.atkT = (w.rate || 0.8) + rand(0.15, 0.6);
    this.swingT = 0.22;
    const armMul = (this.lost.armR ? 0.45 : 1);
    const dmg = w.dmg * armMul * rand(0.75, 1.1) * (this.role === 'grunt' ? 1 : 0.8);

    if (this.ranged) {
      const from = this.pos.clone().setY(this.pos.y + 1.45);
      const to = target.pos.clone().setY(target.pos.y + (target === this.game.player ? 1.2 : 1.3));
      const dir = to.sub(from).normalize();
      dir.x += rand(-0.03, 0.03);
      dir.y += rand(-0.02, 0.02);
      dir.z += rand(-0.03, 0.03);
      this.game.spawnProjectile(from, dir.normalize(), w.speed || 100, dmg, this, w.dis || 0.1);
      this.game.sfx('shot');
    } else {
      if (dist > (w.reach || 3) + 0.6) return;
      this.game.dealDamage(target, dmg, this, w.dis || 0.15);
      this.game.sfx('hit');
    }
  }

  /** Урон. part — куда попало: head/torso/armL/armR/legL/legR. */
  hurt(dmg, part, attacker, disChance = 0) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hurtT = 0.18;
    this.game.spawnBlood(this.pos.x, this.pos.y + 1.2, this.pos.z);
    if (attacker && attacker.faction !== this.faction) {
      // Ударили — теперь враг, даже если был мирным.
      this.angry.add(attacker.faction);
      this.peaceful = false;
      this.target = attacker;
    }

    if (this.hp > 0 && part && part !== 'head' && part !== 'torso' && !this.lost[part]) {
      const p = disChance * (dmg / 45);
      if (chance(p)) this.dismember(part);
    }
    if (this.hp <= 0) this.die(part === 'head');
  }

  dismember(part) {
    if (this.lost[part] || !this.parts[part]) return;
    this.lost[part] = true;
    const node = this.parts[part];
    const world = new THREE.Vector3();
    node.getWorldPosition(world);
    this.group.remove(node);
    this.game.spawnLimb(node, world, this.group.rotation.y);
    this.game.spawnBlood(world.x, world.y, world.z, 12);
    this.hp -= 12;
    this.game.log(`${this.name}: отрублена ${LIMB_RU[part]}!`, 'bad');
    if (this.hp <= 0) this.die();
  }

  die(headshot = false) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.hp = 0;
    this.target = null;
    this.game.onActorDied(this, headshot);
  }

  /** Труп тоже 3д: заваливается на землю и остаётся лежать. */
  _updateCorpse(dt) {
    if (this.deadT < 1) {
      this.deadT = Math.min(1, this.deadT + dt * 2.6);
      const t = this.deadT;
      this.group.rotation.x = -Math.PI / 2 * t;
      this.group.position.y = this.pos.y + Math.sin(t * Math.PI) * 0.25;
      if (t >= 1) this.group.position.y = this.pos.y + 0.16;
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

export const LIMB_RU = {
  armL: 'левая рука', armR: 'правая рука',
  legL: 'левая нога', legR: 'правая нога',
  eyeL: 'левый глаз', eyeR: 'правый глаз',
};

/** Куда попало, судя по высоте попадания относительно ног. */
export function partFromHeight(localY, sideX) {
  if (localY > 1.55) return chance(0.35) ? (sideX < 0 ? 'eyeL' : 'eyeR') : 'head';
  if (localY > 0.95) return chance(0.4) ? (sideX < 0 ? 'armL' : 'armR') : 'torso';
  return sideX < 0 ? 'legL' : 'legR';
}
