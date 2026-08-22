// ДЖВА ГОДА — актёры: гуманоиды, ИИ фракций, стрелы, трупы, корованы.
import * as THREE from 'three';
import { terrainHeight } from './world.js';

function lam(c) { return new THREE.MeshLambertMaterial({ color: c }); }
const SKIN = { elf: lam(0xd8c8a8), human: lam(0xd0aa88), villain: lam(0x9a9a92) };
const CLOTH = {
  elf:     [lam(0x3f6d3a), lam(0x2e5a4a)],
  human:   [lam(0x7a7a8a), lam(0x5a6a8a)],
  villain: [lam(0x4a3038), lam(0x38262c)],
};
const METAL = lam(0xa8b0ba);
const DARKMETAL = lam(0x5a6068);
const WOODMAT = lam(0x6a4a2e);

// ---------- гуманоид ----------
export function makeHumanoid(faction) {
  const g = new THREE.Group();
  const skin = SKIN[faction], cloth = CLOTH[faction];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.35, 0.6), cloth[0]);
  torso.position.y = 2.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
  head.position.y = 3.15;
  if (faction === 'elf') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), skin);
      ear.position.set(s * 0.36, 3.24, -0.05);
      ear.rotation.z = -s * Math.PI / 2;
      g.add(ear);
    }
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 6), cloth[1]);
    hood.position.y = 3.5;
    g.add(hood);
  } else if (faction === 'human') {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.34, 8), METAL);
    helm.position.y = 3.42;
    g.add(helm);
  } else {
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), DARKMETAL);
      horn.position.set(s * 0.28, 3.55, 0);
      horn.rotation.z = s * 0.5;
      g.add(horn);
    }
  }
  const armL = new THREE.Group(); armL.position.set(-0.75, 2.7, 0);
  const armR = new THREE.Group(); armR.position.set(0.75, 2.7, 0);
  for (const arm of [armL, armR]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.25, 0.32), cloth[1]);
    a.position.y = -0.6;
    arm.add(a);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), skin);
    hand.position.y = -1.28;
    arm.add(hand);
  }
  const legL = new THREE.Group(); legL.position.set(-0.3, 1.5, 0);
  const legR = new THREE.Group(); legR.position.set(0.3, 1.5, 0);
  for (const leg of [legL, legR]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.5, 0.36), cloth[1]);
    l.position.y = -0.75;
    leg.add(l);
  }
  g.add(torso, head, armL, armR, legL, legR);
  return { group: g, torso, head, armL, armR, legL, legR };
}

export function attachWeapon(parts, kind) {
  const w = new THREE.Group();
  if (kind === 'sword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.22), METAL);
    blade.position.y = -1.05;
    w.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.5), DARKMETAL);
    guard.position.y = -0.18;
    w.add(guard);
  } else if (kind === 'bow') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 5, 12, Math.PI * 1.15), WOODMAT);
    bow.rotation.y = Math.PI / 2;
    bow.rotation.z = Math.PI / 2 + 0.35;
    w.add(bow);
  } else if (kind === 'club') {
    const club = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.6, 6), WOODMAT);
    club.position.y = -1.1;
    w.add(club);
  }
  parts.armR.add(w);
  return w;
}

// ---------- стрелы ----------
const arrowGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4);
arrowGeo.rotateX(Math.PI / 2);
export class ArrowSystem {
  constructor(scene) { this.scene = scene; this.arrows = []; this.GRAV = 6.0; }
  shootAt(sx, sy, sz, tx, ty, tz, shooter) {
    const m = new THREE.Mesh(arrowGeo, WOODMAT);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), DARKMETAL);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = 0.52;
    m.add(tip);
    const SPEED = 40;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const dFlat = Math.hypot(dx, dz);
    // компенсация падения: подъём на половину параболы
    const tFly = dFlat / SPEED;
    const lift = 0.5 * this.GRAV * tFly * tFly;
    const dir = new THREE.Vector3(dx, dy + lift, dz).normalize();
    m.position.set(sx, sy, sz);
    this.scene.add(m);
    this.arrows.push({ mesh: m,
      vx: dir.x * SPEED, vy: dir.y * SPEED, vz: dir.z * SPEED, life: 4.5, shooter });
  }
  update(dt, actors, player, onPlayerHit, log) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.vy -= this.GRAV * dt;
      const p = a.mesh.position;
      p.x += a.vx * dt; p.y += a.vy * dt; p.z += a.vz * dt;
      a.mesh.lookAt(p.x + a.vx, p.y + a.vy, p.z + a.vz);
      a.life -= dt;
      let dead = a.life <= 0 || p.y < terrainHeight(p.x, p.z) + 0.05;
      if (!dead && a.shooter !== 'player' &&
          Math.abs(p.x - player.pos.x) < 0.8 && Math.abs(p.z - player.pos.z) < 0.8 &&
          p.y > player.pos.y + 0.3 && p.y < player.pos.y + 3.4) {
        onPlayerHit(9 + Math.random() * 7, a.shooter, 'стрела');
        dead = true;
      }
      if (!dead) {
        for (const act of actors) {
          if (act.dead || act === a.shooter) continue;
          // не бьём своих и союзников стрелком
          if (a.shooter === 'player') { if (act.playerAlly()) continue; }
          else if (act.faction === a.shooter.faction || act.playerAlly()) continue;
          if (Math.abs(p.x - act.pos.x) < 0.85 && Math.abs(p.z - act.pos.z) < 0.85 &&
              p.y > act.pos.y && p.y < act.pos.y + 3.4) {
            act.damage(13 + Math.random() * 6, a.shooter === 'player' ? 'player' : a.shooter);
            dead = true;
            break;
          }
        }
      }
      if (dead) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
    }
  }
}

// ---------- корован ----------
export class Caravan {
  constructor(scene, path) {
    this.path = path;
    this.seg = 0; this.t = 0;
    this.speed = 4.2;
    this.looted = false;
    this.group = new THREE.Group();
    const cart = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 2.4), WOODMAT);
    bed.position.y = 1.1; bed.castShadow = true; cart.add(bed);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.8), lam(0x8a6a3a));
    cargo.position.y = 1.85; cargo.castShadow = true; cart.add(cargo);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.4), lam(0xcab87a));
    top.position.y = 2.5; cart.add(top);
    for (const [wx, wz] of [[-1.2, 1.15], [-1.2, -1.15], [1.2, 1.15], [1.2, -1.15]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.16, 10), DARKMETAL);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.65, wz);
      wheel.rotation.x = 0; // ось Z после поворота
      cart.add(wheel);
    }
    const horseMat = lam(0x6a4a30);
    this.horses = [];
    for (const s of [-1, 1]) {
      const horse = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.8), horseMat);
      body.position.y = 1.35; body.castShadow = true; horse.add(body);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), horseMat);
      neck.position.set(0.95, 1.9, 0); neck.rotation.z = -0.5; horse.add(neck);
      const hhead = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.35), horseMat);
      hhead.position.set(1.35, 2.15, 0); horse.add(hhead);
      this.horseLegs = this.horseLegs || [];
      for (const lx of [-0.7, 0.7]) for (const lz of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), horseMat);
        leg.position.set(lx, 0.5, lz);
        horse.add(leg);
        this.horseLegs.push(leg);
      }
      horse.position.set(3.4, 0, s * 0.8);
      cart.add(horse);
      this.horses.push(horse);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), DARKMETAL);
    pole.position.set(-1.6, 2.6, 0); cart.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.04),
      new THREE.MeshLambertMaterial({ color: 0xd4af37, side: THREE.DoubleSide }));
    flag.position.set(-1.05, 3.6, 0); cart.add(flag);
    this.cart = cart;
    this.group.add(cart);
    scene.add(this.group);
    this.place();
  }
  place() {
    const p0 = this.path[this.seg];
    const p1 = this.path[(this.seg + 1) % this.path.length];
    const x = p0.x + (p1.x - p0.x) * this.t;
    const z = p0.z + (p1.z - p0.z) * this.t;
    this.group.position.set(x, terrainHeight(x, z) + 0.1, z);
    this.group.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    this.pos = { x, y: this.group.position.y, z };
  }
  update(dt, time) {
    if (this.looted) return;
    const p0 = this.path[this.seg];
    const p1 = this.path[(this.seg + 1) % this.path.length];
    const len = Math.max(Math.hypot(p1.x - p0.x, p1.z - p0.z), 1);
    this.t += dt * this.speed / len;
    while (this.t >= 1) { this.t -= 1; this.seg = (this.seg + 1) % this.path.length; }
    this.place();
    // дрожание повозки и ног лошадей
    this.cart.position.y = Math.abs(Math.sin(time * 9)) * 0.07;
    for (let i = 0; i < this.horseLegs.length; i++) {
      this.horseLegs[i].rotation.x = Math.sin(time * 9 + i * 1.7) * 0.5;
    }
  }
  loot() { this.looted = true; this.group.visible = false; }
}

// ---------- Actor ----------
let ACTOR_ID = 1;

export class Actor {
  constructor(game, faction, x, z, opts = {}) {
    this.id = ACTOR_ID++;
    this.game = game;
    this.scene = game.scene;
    this.faction = faction;
    this.isSquad = !!opts.squad;
    this.parts = makeHumanoid(faction);
    this.scene.add(this.parts.group);
    this.weaponType = opts.weapon ||
      (faction === 'elf' ? 'bow' : faction === 'human' ? 'sword' : 'club');
    this.weaponMesh = attachWeapon(this.parts, this.weaponType);
    this.pos = new THREE.Vector3(x, terrainHeight(x, z), z);
    this.home = { x, z };
    this.hpMax = opts.hp || (faction === 'villain' ? 70 : 55);
    this.hp = this.hpMax;
    this.speed = opts.speed || 5.2;
    this.dead = false;
    this.target = null;
    this.attackCd = Math.random();
    this.shootCd = Math.random() * 2;
    this.animT = Math.random() * 10;
    this.swingT = 0;
    this.name = opts.name || '';
    this.isCommander = !!opts.commanderFlag;
    this.leash = opts.leash != null ? opts.leash : 95;
    this.agroRange = opts.agro || 62;
    this.followCaravan = opts.followCaravan || null;
    if (this.isCommander) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), lam(0xd4402a));
      plume.position.y = 3.85;
      this.parts.group.add(plume);
    }
  }

  enemiesOfFaction() {
    if (this.faction === 'elf') return ['villain', 'human'];
    if (this.faction === 'human') return ['villain', 'elf'];
    return ['elf', 'human'];
  }
  playerAlly() {
    const pf = this.game.player.faction;
    return pf !== 'neutral' && this.faction === pf;
  }
  isPlayerTarget() { return this.game.player.faction !== 'neutral'; }
  isEnemy(other) {
    if (!other || other === this) return false;
    if (other.isPlayerLike) {
      const pf = this.game.player.faction;
      return pf !== 'neutral' && this.enemiesOfFaction().includes(pf);
    }
    if (this.isSquad && other.isSquad) return false;
    return other.faction !== this.faction;
  }

  damage(amount, from) {
    if (this.dead) return;
    this.hp -= amount;
    if (from === 'player') this.game.onPlayerDealtDamage();
    if (from && from !== 'player' && from.pos && !this.target) this.target = from;
    if (this.hp <= 0) this.die(from);
  }

  die(from) {
    this.dead = true;
    this.game.spawnCorpseFromParts(this.parts, this.faction, this.pos, null);
    this.scene.remove(this.parts.group);
    if (this.onDeath) this.onDeath();
  }

  distTo(o) {
    if (o === 'player') return this.pos.distanceTo(this.game.player.pos);
    return this.pos.distanceTo(o.pos);
  }

  findTarget(nearby) {
    let best = null, bd = this.agroRange;
    for (const o of nearby) {
      if (!this.isEnemy(o)) continue;
      const d = this.distTo(o);
      if (d < bd) { bd = d; best = o; }
    }
    const pf = this.game.player.faction;
    if (pf !== 'neutral' && !this.isSquad && this.enemiesOfFaction().includes(pf)) {
      const dp = this.distTo('player');
      if (dp < bd && !this.game.player.dead) { best = 'player'; bd = dp; }
    }
    this.target = best;
  }

  update(dt, nearby, player) {
    if (this.dead) return;
    this.animT += dt;
    this.attackCd -= dt;
    this.shootCd -= dt;

    if (this.target && this.target !== 'player' && this.target.dead) this.target = null;
    if (this.target === 'player' && player.dead) this.target = null;
    if (!this.target) this.findTarget(nearby);

    const ordered = this.isSquad && this.game.squadOrder === 'attack';
    let mvx = 0, mvz = 0;

    if (this.target && (ordered || !this.isSquad)) {
      const tp = this.target === 'player' ? player.pos : this.target.pos;
      const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
      const d = Math.max(Math.hypot(dx, dz), 0.01);
      const range = this.weaponType === 'bow' ? 32 : 2.3;
      if (d > range) { mvx = dx / d; mvz = dz / d; }
      else if (this.weaponType === 'bow' && d < 16) { mvx = -dx / d; mvz = -dz / d; }
      if (d <= range + 0.6) {
        if (this.weaponType === 'bow') {
          if (d <= range && this.shootCd <= 0) {
            this.shootCd = 2.0 + Math.random() * 1.3;
            this.game.arrows.shootAt(
              this.pos.x, this.pos.y + 2.7, this.pos.z,
              tp.x, tp.y + 1.6, tp.z, this
            );
          }
        } else if (this.attackCd <= 0) {
          this.attackCd = 1.15;
          this.swingT = 0.001;
          if (this.target === 'player') player.takeMeleeHit(9 + Math.random() * 7, this);
          else this.target.damage(11 + Math.random() * 9, this);
        }
      }
      if (!ordered && !this.storming &&
          Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > this.leash) {
        this.target = null;
      }
    }

    if (!mvx && !mvz) {
      if (this.followCaravan && !this.followCaravan.looted) {
        const c = this.followCaravan.pos;
        const dx = c.x - this.pos.x, dz = c.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 7) { mvx = dx / d; mvz = dz / d; }
      } else {
        const dh = Math.max(Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z), 0.01);
        if (dh > 7) {
          mvx = (this.home.x - this.pos.x) / dh;
          mvz = (this.home.z - this.pos.z) / dh;
        } else if ((Math.floor(this.animT * 0.25) + this.id) % 9 === 0) {
          const a = this.animT * 0.5 + this.id * 2.1;
          mvx = Math.cos(a) * 0.35; mvz = Math.sin(a) * 0.35;
        }
      }
    }

    if (mvx || mvz) {
      const sp = this.speed;
      this.pos.x += mvx * sp * dt;
      this.pos.z += mvz * sp * dt;
      [this.pos.x, this.pos.z] = this.game.resolveMove(this.pos.x, this.pos.z, 0.55);
      this.faceDir = Math.atan2(mvx, mvz);
    } else if (this.target && this.target !== 'player') {
      this.faceDir = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
    } else if (this.target === 'player') {
      this.faceDir = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    }

    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    this.parts.group.position.copy(this.pos);
    if (this.faceDir !== undefined) {
      const cur = this.parts.group.rotation.y;
      let delta = this.faceDir - cur;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.parts.group.rotation.y = cur + delta * Math.min(1, dt * 8);
    }
    const walking = mvx !== 0 || mvz !== 0;
    animateParts(this.parts, this.animT * (walking ? 7 : 1.5), walking, this.swingT);
    if (this.swingT > 0) { this.swingT += dt * 3.5; if (this.swingT > 1.25) this.swingT = 0; }
  }
}

export function animateParts(p, t, walking, swing) {
  const sw = Math.sin(t) * (walking ? 0.75 : 0.05);
  p.legL.rotation.x = sw;
  p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.8;
  p.armR.rotation.x = swing > 0 ? (-2.4 + swing * 2.0) : sw * 0.8;
}
