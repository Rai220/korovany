// NPC, бой, расчленёнка и корованы.
// Стороны: soldier (дворец), elf (лес), villain (форт), human (нейтрал).
// Враждуют по матрице ENEMIES — отсюда сами собой возникают сражения между NPC.
// Игрок принадлежит одной из сторон (guard→soldier, elf, villain) — союзники дерутся за него.
import * as THREE from 'three';

const GRAVITY = 26;

const ENEMIES = {
  soldier: ['elf', 'villain'],
  elf: ['soldier', 'villain'],
  villain: ['soldier', 'elf'],
  human: [],
};
export function sideOfFaction(f) { return f === 'guard' ? 'soldier' : f; }

const PRESET = {
  soldier:  { body: 0x4a5a78, head: 0xc9a37a, hp: 60,  dmg: 10, spd: 4.2, aggro: 34, dis: 0.10, helmet: 0x8a8f99 },
  elf:      { body: 0x2f6a2e, head: 0xd8b48a, hp: 52,  dmg: 9,  spd: 4.8, aggro: 36, dis: 0.12, helmet: 0x1f4a1e },
  villain:  { body: 0x402038, head: 0x9a8a8a, hp: 64,  dmg: 12, spd: 4.4, aggro: 36, dis: 0.16, helmet: 0x201018 },
  human:    { body: 0x7a5a3a, head: 0xc9a37a, hp: 40,  dmg: 6,  spd: 3.6, aggro: 0,  dis: 0.05, helmet: null },
  commander:{ body: 0x8a7a30, head: 0xc9a37a, hp: 120, dmg: 16, spd: 4.0, aggro: 40, dis: 0.20, helmet: 0xd4af37, scale: 1.15 },
};

let _id = 0;

function buildFigure(side, type) {
  const p = PRESET[type] || PRESET[side] || PRESET.human;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: p.body });
  const skinMat = new THREE.MeshLambertMaterial({ color: p.head });
  const limbMat = new THREE.MeshLambertMaterial({ color: p.body });

  const parts = {};
  parts.legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.34), limbMat.clone());
  parts.legL.position.set(-0.22, 0.48, 0);
  parts.legR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.34), limbMat.clone());
  parts.legR.position.set(0.22, 0.48, 0);
  parts.body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.5), bodyMat);
  parts.body.position.set(0, 1.5, 0);
  parts.armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.92, 0.24), limbMat.clone());
  parts.armL.position.set(-0.62, 1.55, 0);
  parts.armR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.92, 0.24), limbMat.clone());
  parts.armR.position.set(0.62, 1.55, 0);
  parts.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
  parts.head.position.set(0, 2.3, 0);
  for (const k in parts) g.add(parts[k]);
  // «лицо» — тёмная полоска спереди головы, чтобы видеть направление
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.02),
    new THREE.MeshLambertMaterial({ color: 0x201810 }));
  face.position.set(0, 2.32, 0.26); g.add(face); parts.face = face;
  if (p.helmet) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.56),
      new THREE.MeshLambertMaterial({ color: p.helmet }));
    h.position.set(0, 2.62, 0); g.add(h); parts.helmet = h;
  }
  // оружие в правой руке у бойцов
  if (type !== 'human') {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07),
      new THREE.MeshLambertMaterial({ color: 0xb8bcc4 }));
    w.position.set(0.62, 1.2, 0.3); g.add(w); parts.weapon = w;
  }
  if (p.scale) g.scale.setScalar(p.scale);
  return { group: g, parts };
}

export class NPC {
  constructor(side, type, x, z, opts = {}) {
    this.id = ++_id;
    this.side = side;
    this.type = type;
    const fig = buildFigure(side, type);
    this.mesh = fig.group;
    this.parts = fig.parts;
    this.mesh.position.set(x, 0, z);
    const p = PRESET[type] || PRESET[side];
    this.maxHp = opts.hp || p.hp; this.hp = this.maxHp;
    this.dmg = opts.dmg || p.dmg;
    this.speed = opts.spd || p.spd;
    this.aggro = p.aggro;
    this.dismemberChance = p.dis;
    this.home = new THREE.Vector2(x, z);
    this.target = null;
    this.state = 'idle';
    this.cd = Math.random();        // кулдаун атаки
    this.alive = true;
    this.dying = 0;
    this.provoked = new Set();      // для нейтралов: кого считать врагом
    this.waypoints = opts.waypoints || null;
    this.wpIndex = 0; this.wpDir = 1;
    this.leader = opts.leader || null; // для охраны корована
    this.injuryChance = opts.injuryChance ?? 0.12;
    this.bobT = Math.random() * 10;
  }

  isHostileTo(otherSide) {
    if ((ENEMIES[this.side] || []).includes(otherSide)) return true;
    if (this.side === 'human' && this.provoked.has(otherSide)) return true;
    return false;
  }

  faceTo(x, z) {
    const a = Math.atan2(x - this.mesh.position.x, z - this.mesh.position.z);
    this.mesh.rotation.y = a;
  }
}

export class NPCManager {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.npcs = [];
    this.gibs = [];        // отрубленные конечности (3D)
    this.corpses = [];     // тела
    this.corovans = [];
    this.playerSide = 'elf';
    this.player = null;
    this.rally = null;     // точка сбора союзников (приказ «за мной/в атаку»)
    this.onKill = null;        // (npc, attackerSide)
    this.onCorovanRobbed = null;
    this.onPlayerSpotted = null;
  }

  spawn(side, type, x, z, opts) {
    const n = new NPC(side, type, x, z, opts);
    this.scene.add(n.mesh);
    this.npcs.push(n);
    return n;
  }

  spawnGroup(side, type, cx, cz, count, spread = 14, opts) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * spread;
      arr.push(this.spawn(side, type, cx + Math.cos(a) * d, cz + Math.sin(a) * d, opts));
    }
    return arr;
  }

  // ---------- корован ----------
  spawnCorovan(route, gold = 120) {
    const start = route[0];
    const cartMat = new THREE.MeshLambertMaterial({ color: 0x6a4a26 });
    const cart = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2), cartMat);
    body.position.y = 1.3; cart.add(body);
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3, 8, 1, false, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0xcfc6a8 }));
    cover.rotation.z = Math.PI / 2; cover.position.y = 2.2; cart.add(cover);
    for (const [wx, wz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10),
        new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
      w.rotation.x = Math.PI / 2; w.position.set(wx, 0.5, wz); cart.add(w);
    }
    cart.position.set(start.x, 0, start.z);
    this.scene.add(cart);

    const cor = {
      cart, route, wpIndex: 0, wpDir: 1, gold, hp: 90, maxHp: 90,
      looted: false, guards: [], speed: 3.0,
      pos: new THREE.Vector2(start.x, start.z),
    };
    // охрана корована (нейтралы-люди, провоцируются при грабеже)
    for (let i = 0; i < 3; i++) {
      const g = this.spawn('human', 'human', start.x + (i - 1) * 2.2, start.z + 3, { hp: 50, dmg: 9 });
      g.corovan = cor;
      cor.guards.push(g);
    }
    this.corovans.push(cor);
    return cor;
  }

  _updateCorovans(dt) {
    for (const cor of this.corovans) {
      if (cor.looted) continue;
      const wp = cor.route[cor.wpIndex];
      const ddx = wp.x - cor.pos.x, ddz = wp.z - cor.pos.y;
      const dist = Math.hypot(ddx, ddz);
      if (dist < 2) {
        cor.wpIndex += cor.wpDir;
        if (cor.wpIndex >= cor.route.length - 1) { cor.wpIndex = cor.route.length - 1; cor.wpDir = -1; }
        if (cor.wpIndex <= 0) { cor.wpIndex = 0; cor.wpDir = 1; }
      } else {
        const vx = ddx / dist, vz = ddz / dist;
        cor.pos.x += vx * cor.speed * dt; cor.pos.y += vz * cor.speed * dt;
        cor.cart.position.set(cor.pos.x, 0, cor.pos.y);
        cor.cart.rotation.y = Math.atan2(vx, vz);
      }
      // охрана держится рядом, если не в бою
      cor.guards.forEach((g, i) => {
        if (!g.alive || g.target) return;
        const ang = i * 2.1;
        const gx = cor.pos.x + Math.cos(ang) * 3, gz = cor.pos.y + Math.sin(ang) * 3;
        g.home.set(gx, gz);
      });
    }
  }

  robCorovan(cor, dmg, attackerSide) {
    if (cor.looted) return;
    cor.hp -= dmg;
    // охрана сразу враждебна грабителю
    for (const g of cor.guards) if (g.alive) { g.provoked.add(attackerSide); g.aggro = 46; }
    if (cor.hp <= 0) {
      cor.looted = true;
      cor.cart.rotation.z = 0.5; // повозка завалилась
      cor.cart.position.y = -0.3;
      if (this.onCorovanRobbed) this.onCorovanRobbed(cor, attackerSide);
    }
  }

  // ---------- бой игрока ----------
  handlePlayerAttack(info) {
    const side = this.playerSide;
    let best = null, bestD = Infinity, bestCor = null;
    // корованы (грабёж только для эльфов/злодея)
    if (side === 'elf' || side === 'villain') {
      for (const cor of this.corovans) {
        if (cor.looted) continue;
        const d = this._frontDist(info, cor.pos.x, cor.pos.y, 1.6);
        if (d != null && d < bestD) { bestD = d; best = null; bestCor = cor; }
      }
    }
    for (const n of this.npcs) {
      if (!n.alive || n.side === side) continue; // по своим не бьём
      const d = this._frontDist(info, n.mesh.position.x, n.mesh.position.z, 1.0);
      if (d != null && d < bestD) { bestD = d; best = n; bestCor = null; }
    }
    if (bestCor) { this.robCorovan(bestCor, info.dmg, side); return; }
    if (best) {
      if (best.side === 'human') { best.provoked.add(side); best.aggro = 46; }
      this.damageNpc(best, info.dmg, info.dismember, side);
    }
  }

  _frontDist(info, x, z, extra) {
    const dx = x - info.origin.x, dz = z - info.origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > info.range + extra) return null;
    if (dist < 0.001) return dist;
    const fdot = (dx / dist) * info.dir.x + (dz / dist) * info.dir.z;
    if (fdot < 0.4) return null; // не перед игроком
    return dist;
  }

  damageNpc(n, dmg, dismemberChance, attackerSide) {
    if (!n.alive) return;
    n.hp -= dmg;
    n.target = n.target || '__alert__'; // станет агрессивным к атакующему через AI
    n._lastAttacker = attackerSide;
    let lethal = false;
    if (Math.random() < (dismemberChance || 0)) {
      const limbs = ['armL', 'armR', 'legL', 'legR'].filter(k => n.parts[k]);
      if (limbs.length) {
        const part = limbs[(Math.random() * limbs.length) | 0];
        this._detachPart(n, part);
        if (part.startsWith('leg')) lethal = true; // без ноги не стоит
      }
    }
    if (n.hp <= 0 || lethal) this.killNpc(n, attackerSide);
  }

  _detachPart(n, name) {
    const part = n.parts[name];
    if (!part) return;
    part.updateWorldMatrix(true, false);
    const wpos = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    part.matrixWorld.decompose(wpos, wq, ws);
    n.mesh.remove(part);
    part.position.copy(wpos); part.quaternion.copy(wq); part.scale.copy(ws);
    this.scene.add(part);
    part.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4);
    part.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    part.userData.rest = false;
    this.gibs.push(part);
    if (this.gibs.length > 90) this.scene.remove(this.gibs.shift());
    n.parts[name] = null;
  }

  killNpc(n, attackerSide) {
    if (!n.alive) return;
    n.alive = false; n.state = 'dead'; n.dying = 0.001;
    // кровавый оттенок тела
    if (n.parts.body) { n.parts.body.material = n.parts.body.material.clone();
      n.parts.body.material.color.lerp(new THREE.Color(0x5a0a0a), 0.5); }
    this.corpses.push(n);
    if (this.corpses.length > 40) {
      const old = this.corpses.shift();
      this.scene.remove(old.mesh);
      this.npcs = this.npcs.filter(x => x !== old);
    }
    if (this.onKill) this.onKill(n, attackerSide);
  }

  // ---------- общий апдейт ----------
  update(dt, player) {
    this.player = player;
    this.playerSide = sideOfFaction(player.faction);
    this._updateCorovans(dt);

    const pp = player.pos;
    for (const n of this.npcs) {
      if (!n.alive) { this._updateCorpse(n, dt); continue; }
      this._updateNpc(n, dt, player, pp);
    }
    this._updateGibs(dt);
  }

  _updateCorpse(n, dt) {
    if (n.dying > 0 && n.dying < 1) {
      n.dying = Math.min(1, n.dying + dt * 1.8);
      n.mesh.rotation.x = -Math.PI / 2 * n.dying;
      n.mesh.position.y = -0.2 * n.dying;
    }
  }

  _updateGibs(dt) {
    for (const part of this.gibs) {
      if (part.userData.rest) continue;
      const v = part.userData.vel;
      v.y -= GRAVITY * dt;
      part.position.addScaledVector(v, dt);
      const s = part.userData.spin;
      part.rotation.x += s.x * dt; part.rotation.y += s.y * dt; part.rotation.z += s.z * dt;
      if (part.position.y <= 0.15) {
        part.position.y = 0.15; part.userData.rest = true;
        part.rotation.set(Math.PI / 2 * Math.random(), Math.random() * 6, 0);
      }
    }
  }

  _findTarget(n, player, pp) {
    let best = null, bd = Infinity;
    // игрок
    if (n.isHostileTo(this.playerSide) && player.alive) {
      const d = n.mesh.position.distanceTo(new THREE.Vector3(pp.x, 0, pp.z));
      if (d < n.aggro || (n.target === '__alert__' && n._lastAttacker === this.playerSide)) {
        best = player; bd = d;
      }
    }
    // другие NPC
    for (const o of this.npcs) {
      if (o === n || !o.alive) continue;
      if (!n.isHostileTo(o.side)) continue;
      const d = n.mesh.position.distanceTo(o.mesh.position);
      if (d < bd && d < n.aggro) { best = o; bd = d; }
    }
    return best;
  }

  _updateNpc(n, dt, player, pp) {
    n.cd = Math.max(0, n.cd - dt);
    n.bobT += dt;

    // выбор цели
    if (!n.target || n.target === '__alert__' ||
        (n.target.alive === false) || (n.target === player && !player.alive)) {
      const t = this._findTarget(n, player, pp);
      n.target = t;
      if (t === player && this.onPlayerSpotted) this.onPlayerSpotted(n);
    }

    let tx, tz, tEntity = n.target;
    if (n.target === player) { tx = pp.x; tz = pp.z; }
    else if (n.target && n.target.mesh) { tx = n.target.mesh.position.x; tz = n.target.mesh.position.z; }

    if (tEntity && tx !== undefined) {
      const dx = tx - n.mesh.position.x, dz = tz - n.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      // отрыв от дома (leash)
      if (n.home.distanceTo(new THREE.Vector2(n.mesh.position.x, n.mesh.position.z)) > 110) {
        n.target = null; tEntity = null;
      } else if (dist > 2.4) {
        this._moveTo(n, dx / dist, dz / dist, dt);
        n.faceTo(tx, tz);
      } else {
        n.faceTo(tx, tz);
        if (n.cd <= 0) { n.cd = 1.0; this._npcAttack(n, player); }
      }
    } else {
      // нет цели: к точке сбора (приказ) / охрана корована / дом
      let gx = n.home.x, gz = n.home.y;
      if (n.side === this.playerSide && this.rally) { gx = this.rally.x; gz = this.rally.y; }
      const dx = gx - n.mesh.position.x, dz = gz - n.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 3) { this._moveTo(n, dx / dist, dz / dist, dt); n.faceTo(gx, gz); }
      else { // лёгкое покачивание на месте
        n.mesh.position.y = Math.abs(Math.sin(n.bobT * 2)) * 0.04;
      }
    }
  }

  _moveTo(n, dx, dz, dt) {
    const nx = n.mesh.position.x + dx * n.speed * dt;
    const nz = n.mesh.position.z + dz * n.speed * dt;
    const r = this.world.collide(nx, nz, 1.0);
    n.mesh.position.x = r.x; n.mesh.position.z = r.z;
    // «шаг» — покачивание
    n.mesh.position.y = Math.abs(Math.sin(n.bobT * 8)) * 0.08;
  }

  _npcAttack(n, player) {
    // взмах оружием
    if (n.parts.armR) { n.parts.armR.rotation.x = -1.4; setTimeout(() => { if (n.parts.armR) n.parts.armR.rotation.x = 0; }, 160); }
    if (n.target === player) {
      let injury = null;
      if (Math.random() < n.injuryChance) injury = ['hand', 'eye', 'leg'][(Math.random() * 3) | 0];
      player.takeDamage(n.dmg, injury);
    } else if (n.target && n.target.alive) {
      this.damageNpc(n.target, n.dmg, n.dismemberChance, n.side);
    }
  }

  // союзники игрока, живые, для подсчёта/штурма
  alliesAlive() { return this.npcs.filter(n => n.alive && n.side === this.playerSide).length; }
  enemiesNear(x, z, r) {
    return this.npcs.filter(n => n.alive && n.isHostileTo(this.playerSide) &&
      Math.hypot(n.mesh.position.x - x, n.mesh.position.z - z) < r).length;
  }

  clear() {
    for (const n of this.npcs) this.scene.remove(n.mesh);
    for (const g of this.gibs) this.scene.remove(g);
    for (const c of this.corovans) this.scene.remove(c.cart);
    this.npcs = []; this.gibs = []; this.corpses = []; this.corovans = [];
    this.rally = null;
  }
}
