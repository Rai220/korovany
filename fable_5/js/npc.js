// NPC: солдаты дворца, эльфы-партизаны, бойцы Злодея, мирные жители,
// корованы с охраной. Враги 3-хмерные, и труп тоже 3д.
import * as THREE from 'three';

export const HOSTILITY = {
  elf: ['guard', 'villain'],
  guard: ['elf', 'villain'],
  villain: ['elf', 'guard'],
  caravan: ['elf', 'villain'],
  civilian: [],
};
export function isHostile(a, b) { return (HOSTILITY[a] || []).includes(b); }

const LOOKS = {
  guard:     { tunic: 0x9c2f2f, legs: 0x4a463f, skin: 0xd8b08a, helmet: 0x9aa0a8 },
  commander: { tunic: 0xc03030, legs: 0x33302b, skin: 0xd8b08a, helmet: 0xd4af37, plume: 0xc03030 },
  elf:       { tunic: 0x2f7a3a, legs: 0x274a28, skin: 0xe8d8b0, hood: 0x1f5c2c },
  spy:       { tunic: 0x3a5a3a, legs: 0x2a3a2a, skin: 0xe8d8b0, hood: 0x20281e },
  villain:   { tunic: 0x35353f, legs: 0x222228, skin: 0xbfae9a, helmet: 0x1a1a20, horns: 0x111114 },
  caravan:   { tunic: 0xa07030, legs: 0x6a5238, skin: 0xd8b08a, helmet: 0x7a6a4a },
  civilian:  { tunic: 0x8a6a4a, legs: 0x5a4a36, skin: 0xd8b08a },
};

const NAMES = {
  guard: 'Стражник дворца', commander: 'Командир', elf: 'Эльф-партизан',
  spy: 'Шпион эльфов', villain: 'Боец Злодея', caravan: 'Охранник корована',
  civilian: 'Мирный житель',
};

const SPEED = { elf: 4.6, guard: 4.0, villain: 4.2, caravan: 4.0, civilian: 3.4 };

// общая геометрия гуманоида (ноги/руки смещены так, что вращаются от плеча/бедра)
const geoLeg = new THREE.BoxGeometry(0.16, 0.72, 0.16); geoLeg.translate(0, -0.36, 0);
const geoArm = new THREE.BoxGeometry(0.14, 0.6, 0.14); geoArm.translate(0, -0.27, 0);
const geoBody = new THREE.BoxGeometry(0.5, 0.66, 0.28);
const geoHead = new THREE.BoxGeometry(0.27, 0.27, 0.25);
const geoHelm = new THREE.BoxGeometry(0.31, 0.13, 0.29);
const geoHood = new THREE.ConeGeometry(0.21, 0.36, 5);
const geoBlade = new THREE.BoxGeometry(0.05, 0.52, 0.05);
const geoEye = new THREE.BoxGeometry(0.05, 0.05, 0.02);
const geoPlume = new THREE.ConeGeometry(0.07, 0.32, 5);
const geoHorn = new THREE.ConeGeometry(0.05, 0.2, 4);
const geoDecal = new THREE.CircleGeometry(0.7, 7); geoDecal.rotateX(-Math.PI / 2);

const matCache = {};
function mat(c) { return matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c })); }
const matBlade = new THREE.MeshLambertMaterial({ color: 0xb8c0c8 });
const matEye = new THREE.MeshLambertMaterial({ color: 0x111111 });
const matBlood = new THREE.MeshBasicMaterial({ color: 0x5e0d0d });

function posOf(e) { return e.isPlayer ? e.pos : e.group.position; }

export class NPC {
  constructor(game, mgr, opts) {
    this.game = game; this.mgr = mgr;
    this.faction = opts.faction;
    this.kind = opts.kind || 'soldier';
    this.playerTroop = !!opts.playerTroop;
    this.homeBase = opts.homeBase || null;
    this.order = opts.order || { type: 'wander', x: opts.x, z: opts.z, r: 6 };
    this.name = opts.name || NAMES[this.kind === 'soldier' ? this.faction : this.kind] || 'Некто';

    this.hp = 60; this.dmg = 9; this.speed = SPEED[this.faction] || 4; this.aggro = 26;
    if (this.kind === 'commander') { this.hp = 150; this.dmg = 14; this.aggro = 30; }
    if (this.kind === 'spy') { this.hp = 45; this.dmg = 7; this.speed = 5.4; this.aggro = 12; }
    if (this.kind === 'civilian') { this.hp = 30; this.dmg = 0; this.aggro = 0; }

    this.dead = false; this.disposed = false; this.bleeding = false;
    this.severed = { L: false, R: false };
    this.target = null; this.personal = null;
    this.retargetT = Math.random() * 0.3; this.atkT = 0;
    this.animT = Math.random() * 6; this.swing = 0; this.moving = false;
    this.fleeFrom = null; this.fleeT = 0;

    this.build(opts.x, opts.z);
  }

  build(x, z) {
    const lk = LOOKS[this.kind === 'commander' ? 'commander' : this.kind === 'spy' ? 'spy' : this.faction] || LOOKS.civilian;
    this.tunicMat = new THREE.MeshLambertMaterial({ color: lk.tunic });
    const g = new THREE.Group();
    this.parts = {};
    const add = (name, geo, m, px, py, pz) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(px, py, pz);
      g.add(mesh);
      this.parts[name] = mesh;
      return mesh;
    };
    add('legL', geoLeg, mat(lk.legs), -0.12, 0.76, 0);
    add('legR', geoLeg, mat(lk.legs), 0.12, 0.76, 0);
    add('body', geoBody, this.tunicMat, 0, 1.07, 0);
    add('head', geoHead, mat(lk.skin), 0, 1.55, 0);
    add('eyeL', geoEye, matEye, -0.06, 1.58, 0.13);
    add('eyeR', geoEye, matEye, 0.06, 1.58, 0.13);
    add('armL', geoArm, this.tunicMat, -0.34, 1.38, 0);
    const armR = add('armR', geoArm, this.tunicMat, 0.34, 1.38, 0);
    if (lk.helmet) add('helm', geoHelm, mat(lk.helmet), 0, 1.72, 0);
    if (lk.hood) add('hood', geoHood, mat(lk.hood), 0, 1.78, 0);
    if (lk.plume) add('plume', geoPlume, mat(lk.plume), 0, 1.92, 0);
    if (lk.horns) {
      const h1 = new THREE.Mesh(geoHorn, mat(lk.horns)); h1.position.set(-0.12, 1.82, 0); h1.rotation.z = 0.4;
      const h2 = new THREE.Mesh(geoHorn, mat(lk.horns)); h2.position.set(0.12, 1.82, 0); h2.rotation.z = -0.4;
      g.add(h1, h2);
    }
    if (this.kind !== 'civilian') {
      const sw = new THREE.Mesh(geoBlade, matBlade);
      sw.position.set(0, -0.6, 0.16);
      sw.rotation.x = 1.1;
      armR.add(sw);
    }
    if (this.kind === 'commander') g.scale.setScalar(1.08);
    g.position.set(x, this.game.world.height(x, z), z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.group = g;
    this.game.scene.add(g);
  }

  face(dx, dz) { this.group.rotation.y = Math.atan2(dx, dz); }

  walkTo(x, z, dt, mult = 1) {
    const p = this.group.position;
    const dx = x - p.x, dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const step = Math.min(d, this.speed * mult * dt);
    let nx = p.x + dx / d * step, nz = p.z + dz / d * step;
    const r = this.game.world.resolve(nx, nz, 0.4);
    nx = r[0]; nz = r[1];
    p.set(nx, this.game.world.height(nx, nz), nz);
    this.face(dx, dz);
    this.moving = true;
    return d < 2.5;
  }

  acquire() {
    let best = null, bd = Infinity;
    const p = this.group.position;
    const consider = (e, range) => {
      const ep = posOf(e);
      const dx = ep.x - p.x, dz = ep.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < range * range && d2 < bd) { bd = d2; best = e; }
    };
    const P = this.game.player;
    if (P && !P.dead) {
      const hostileP = isHostile(this.faction, P.faction) || this.personal === P;
      if (hostileP) {
        let r = this.aggro;
        if (this.faction === 'caravan' && this.personal !== P) r = 11;
        consider(P, r);
      }
    }
    for (const n of this.mgr.npcs) {
      if (n === this || n.dead) continue;
      if (isHostile(this.faction, n.faction) || this.personal === n) {
        let r = this.aggro;
        if (this.faction === 'caravan' && this.personal !== n) r = 11;
        consider(n, r);
      }
    }
    this.target = best;
  }

  update(dt) {
    this.moving = false;
    if (this.bleeding) {
      this.hp -= 3 * dt;
      if (this.hp <= 0) { this.die(null); return; }
    }
    // безрукий в ужасе убегает
    if (this.severed.L && this.severed.R) { this.fleeUpdate(dt); this.animate(dt); return; }
    if (this.kind === 'civilian') {
      if (this.fleeT > 0) { this.fleeT -= dt; this.fleeUpdate(dt); }
      else this.doOrder(dt);
      this.animate(dt);
      return;
    }
    this.retargetT -= dt;
    if (this.retargetT <= 0) { this.retargetT = 0.25 + Math.random() * 0.2; this.acquire(); }
    if (this.target && this.target.dead) this.target = null;
    if (this.target) {
      const tp = posOf(this.target);
      const p = this.group.position;
      const dx = tp.x - p.x, dz = tp.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 42) this.target = null;
      else if (d > 1.9) this.walkTo(tp.x, tp.z, dt, 1.15);
      else {
        this.face(dx, dz);
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 1.25;
          this.swing = 0.3;
          const dmg = this.dmg + Math.random() * 4;
          if (this.target.isPlayer) this.target.takeDamage(dmg, this.name);
          else this.target.takeDamage(dmg, this);
        }
      }
    } else this.doOrder(dt);
    this.animate(dt);
  }

  doOrder(dt) {
    const o = this.order;
    if (!o) return;
    const p = this.group.position;
    if (o.type === 'hold') {
      if (Math.hypot(o.x - p.x, o.z - p.z) > 1.5) this.walkTo(o.x, o.z, dt);
    } else if (o.type === 'wander') {
      o.t = (o.t ?? 0) - dt;
      if (o.t <= 0 || o.tx === undefined) {
        o.t = 3 + Math.random() * 5;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * o.r;
        o.tx = o.x + Math.cos(a) * rr; o.tz = o.z + Math.sin(a) * rr;
      }
      if (Math.hypot(o.tx - p.x, o.tz - p.z) > 1) this.walkTo(o.tx, o.tz, dt, 0.6);
    } else if (o.type === 'patrol') {
      const pt = o.pts[o.i];
      if (this.walkTo(pt[0], pt[1], dt, 0.7)) o.i = (o.i + 1) % o.pts.length;
    } else if (o.type === 'waypoints') {
      const pt = o.pts[o.i];
      if (this.walkTo(pt[0], pt[1], dt)) {
        o.i++;
        if (o.i >= o.pts.length) {
          this.order = { type: 'hold', x: pt[0] + Math.random() * 6 - 3, z: pt[1] + Math.random() * 6 - 3 };
        }
      }
    } else if (o.type === 'follow') {
      let tx, tz;
      if (o.caravan) {
        if (o.caravan.gone || o.caravan.robbed) { this.order = { type: 'hold', x: p.x, z: p.z }; return; }
        const cp = o.caravan.pos;
        tx = cp.x + o.ox; tz = cp.z + o.oz;
      } else {
        const pp = this.game.player.pos;
        tx = pp.x + o.ox; tz = pp.z + o.oz;
      }
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d > 2.2) this.walkTo(tx, tz, dt, d > 10 ? 1.35 : 1);
    }
  }

  fleeUpdate(dt) {
    const p = this.group.position;
    let src = null;
    if (this.fleeFrom && !this.fleeFrom.dead) src = posOf(this.fleeFrom);
    else {
      const P = this.game.player;
      if (P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 30) src = P.pos;
    }
    if (src) {
      const dx = p.x - src.x, dz = p.z - src.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 34) this.walkTo(p.x + dx / d * 10, p.z + dz / d * 10, dt, 1.2);
    }
  }

  animate(dt) {
    const P = this.parts;
    if (this.moving) {
      this.animT += dt * 9;
      const a = Math.sin(this.animT) * 0.55;
      P.legL.rotation.x = a; P.legR.rotation.x = -a;
      if (!this.severed.L) P.armL.rotation.x = -a * 0.8;
      if (!this.severed.R && this.swing <= 0) P.armR.rotation.x = a * 0.8;
    } else {
      P.legL.rotation.x *= 0.8; P.legR.rotation.x *= 0.8;
      if (!this.severed.L) P.armL.rotation.x *= 0.8;
      if (!this.severed.R && this.swing <= 0) P.armR.rotation.x *= 0.8;
    }
    if (this.swing > 0) {
      this.swing -= dt;
      if (!this.severed.R) {
        P.armR.rotation.x = -1.9 * Math.sin(Math.PI * Math.max(0, 1 - this.swing / 0.3));
      }
    }
  }

  takeDamage(d, src) {
    if (this.dead) return;
    this.hp -= d;
    this.tunicMat.emissive.setHex(0x802020);
    setTimeout(() => { if (!this.disposed) this.tunicMat.emissive.setHex(0); }, 110);
    if (src) {
      this.personal = src;
      if (!this.target) this.target = src;
      // тревога союзникам поблизости
      const p = this.group.position;
      for (const n of this.mgr.npcs) {
        if (n.dead || n === this || n.faction !== this.faction || n.kind === 'civilian') continue;
        const np = n.group.position;
        if (Math.hypot(np.x - p.x, np.z - p.z) < 15 && !n.target) { n.target = src; n.personal = src; }
      }
      if (this.kind === 'civilian') { this.fleeFrom = src; this.fleeT = 7; }
    }
    const byPlayer = !!(src && src.isPlayer);
    if (this.hp <= 0) {
      if (Math.random() < 0.35) this.severArm(byPlayer);
      this.die(src);
    } else if (d >= 14 && Math.random() < 0.2) {
      this.severArm(byPlayer);
    }
  }

  // отрубить руку: рука (иногда вместе с мечом) отлетает 3д-куском
  severArm(byPlayer) {
    const sides = ['L', 'R'].filter(s => !this.severed[s]);
    if (!sides.length) return;
    const s = sides[(Math.random() * sides.length) | 0];
    this.severed[s] = true;
    const arm = this.parts['arm' + s];
    if (arm) {
      const wp = new THREE.Vector3();
      arm.getWorldPosition(wp);
      this.group.remove(arm);
      arm.position.copy(wp);
      arm.rotation.set(Math.random() * 2, Math.random() * 6, Math.random() * 2);
      this.game.scene.add(arm);
      this.game.gibs.push({
        mesh: arm,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, 4 + Math.random() * 3, (Math.random() - 0.5) * 4),
        av: (Math.random() - 0.5) * 9,
        t: 0, rest: false,
      });
    }
    this.bleeding = true;
    this.dmg *= 0.55;
    this.mgr.addDecal(this.group.position.x, this.group.position.z);
    if (byPlayer) {
      this.game.ui.msg('Вы отрубили врагу руку! Он истекает кровью.', 'good');
      this.game.sfx.sever();
    }
    if (this.severed.L && this.severed.R) this.fleeFrom = this.target || this.game.player;
  }

  die(src) {
    if (this.dead) return;
    this.dead = true;
    this.target = null;
    const p = this.group.position;
    // труп тоже 3д
    this.group.rotation.z = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    this.group.rotation.x = (Math.random() - 0.5) * 0.25;
    p.y = this.game.world.height(p.x, p.z) + 0.28;
    this.mgr.addDecal(p.x, p.z);
    this.mgr.corpses.push(this);
    if (this.mgr.corpses.length > 32) {
      const old = this.mgr.corpses.shift();
      old.disposed = true;
      this.game.scene.remove(old.group);
      old.tunicMat.dispose();
    }
    const byPlayer = !!(src && src.isPlayer);
    if (this.game.quests) this.game.quests.onKill(this, byPlayer);
  }
}

// ---------- КОРОВАН ----------
class Caravan {
  constructor(game, mgr, dir) {
    this.game = game; this.mgr = mgr;
    this.dir = dir;
    this.x = dir > 0 ? -233 : 146;
    this.z = 200 + (Math.random() * 4 - 2);
    this.gold = 120 + ((Math.random() * 120) | 0);
    this.robbed = false; this.halted = false; this.gone = false; this.goneT = 0;

    const g = new THREE.Group();
    const wood = mat(0x7a5a33);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 3.2), wood);
    body.position.y = 1.15;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.6), mat(0xcabb96));
    canopy.position.y = 2.0;
    g.add(body, canopy);
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.16, 9);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [wx, wz] of [[-0.95, -1.1], [0.95, -1.1], [-0.95, 1.1], [0.95, 1.1]]) {
      const w = new THREE.Mesh(wheelGeo, mat(0x4a3a26));
      w.position.set(wx, 0.55, wz);
      g.add(w);
    }
    // вол
    const ox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 1.7), mat(0x6a4a30));
    ox.position.set(0, 0.95, 2.9);
    const oxHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.55), mat(0x6a4a30));
    oxHead.position.set(0, 1.15, 3.9);
    for (const hx of [-0.2, 0.2]) {
      const horn = new THREE.Mesh(geoHorn, mat(0xd8d0b8));
      horn.position.set(hx, 1.45, 3.9);
      horn.rotation.z = hx < 0 ? 0.6 : -0.6;
      g.add(horn);
    }
    g.add(ox, oxHead);
    this.group = g;
    game.scene.add(g);

    this.guards = [
      mgr.spawn({ faction: 'caravan', x: this.x - 2, z: this.z - 2, order: { type: 'follow', caravan: this, ox: -1.8, oz: -1 } }),
      mgr.spawn({ faction: 'caravan', x: this.x + 2, z: this.z + 2, order: { type: 'follow', caravan: this, ox: 1.8, oz: 1 } }),
    ];
    this.place();
  }

  get pos() { return this.group.position; }

  place() {
    this.group.position.set(this.x, this.game.world.height(this.x, this.z), this.z);
    this.group.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  update(dt) {
    if (this.gone) return;
    if (this.robbed) {
      this.goneT += dt;
      if (this.goneT > 30) { this.gone = true; this.game.scene.remove(this.group); }
      return;
    }
    if (!this.halted && this.guards.every(gd => gd.dead)) {
      this.halted = true; // возница сбежал, корован можно грабить
    }
    if (!this.halted) {
      this.x += this.dir * 1.7 * dt;
      if (this.x > 146) { this.x = 146; this.dir = -1; }
      if (this.x < -233) { this.x = -233; this.dir = 1; }
      this.place();
    }
  }

  robbable() { return !this.robbed && !this.gone && this.guards.every(gd => gd.dead); }

  rob() {
    this.robbed = true;
    return this.gold;
  }
}

// ---------- МЕНЕДЖЕР ----------
export class NPCManager {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.corpses = [];
    this.caravans = [];
    this.decals = [];
    this.caravanT = 40;
    this.nextDir = 1;
    this.pruneT = 2;
  }

  spawn(opts) {
    const n = new NPC(this.game, this, opts);
    this.npcs.push(n);
    return n;
  }

  spawnSquad(faction, n, x, z, pts, extra = {}) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const myPts = pts.map(p => [p[0] + Math.random() * 6 - 3, p[1] + Math.random() * 6 - 3]);
      arr.push(this.spawn(Object.assign({
        faction,
        x: x + Math.random() * 8 - 4,
        z: z + Math.random() * 8 - 4,
        order: { type: 'waypoints', pts: myPts, i: 0 },
      }, extra)));
    }
    return arr;
  }

  spawnCaravan() {
    const active = this.caravans.filter(c => !c.gone && !c.robbed).length;
    if (active >= 2) return;
    const c = new Caravan(this.game, this, this.nextDir);
    this.nextDir *= -1;
    this.caravans.push(c);
  }

  addDecal(x, z) {
    const m = new THREE.Mesh(geoDecal, matBlood);
    const s = 0.7 + Math.random() * 0.8;
    m.scale.set(s, 1, s);
    m.position.set(x, this.game.world.height(x, z) + 0.04, z);
    this.game.scene.add(m);
    this.decals.push(m);
    if (this.decals.length > 70) this.game.scene.remove(this.decals.shift());
  }

  countAlive(faction) {
    let c = 0;
    for (const n of this.npcs) if (!n.dead && n.faction === faction) c++;
    return c;
  }

  update(dt) {
    for (const n of this.npcs) if (!n.dead) n.update(dt);
    for (const c of this.caravans) c.update(dt);
    this.caravanT -= dt;
    if (this.caravanT <= 0) { this.caravanT = 45; this.spawnCaravan(); }
    this.pruneT -= dt;
    if (this.pruneT <= 0) {
      this.pruneT = 2;
      this.npcs = this.npcs.filter(n => !n.disposed);
      this.caravans = this.caravans.filter(c => !c.gone);
    }
  }

  clearAll() {
    for (const n of this.npcs) {
      this.game.scene.remove(n.group);
      n.tunicMat.dispose();
      n.disposed = true;
    }
    for (const c of this.caravans) this.game.scene.remove(c.group);
    for (const d of this.decals) this.game.scene.remove(d);
    this.npcs = []; this.corpses = []; this.caravans = []; this.decals = [];
  }
}
