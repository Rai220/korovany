// Корованы. Их можно грабить.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { TRADE_ROAD } from './config.js';
import { Actor } from './actors.js';
import { rand, randInt, choice } from './util.js';

function mat(hex) { return new THREE.MeshLambertMaterial({ color: hex }); }

function wagonMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 4.2), mat(0x6b4a2c));
  body.position.y = 1.15;
  body.castShadow = true;
  g.add(body);
  const tilt = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 4.0, 10, 1, true, 0, Math.PI), mat(0xd8cdae));
  tilt.rotation.z = Math.PI / 2;
  tilt.rotation.y = Math.PI / 2;
  tilt.position.y = 1.7;
  tilt.castShadow = true;
  g.add(tilt);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 10), mat(0x4a3320));
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 1.25, 0.62, sz * 1.5);
    g.add(w);
  }
  // Лошадка.
  const horse = new THREE.Group();
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 2.0), mat(0x6a4a34));
  hb.position.y = 1.25;
  horse.add(hb);
  const hn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.9), mat(0x6a4a34));
  hn.position.set(0, 1.55, 1.2);
  horse.add(hn);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), mat(0x4a3222));
    l.position.set(sx * 0.28, 0.45, sz * 0.7);
    horse.add(l);
  }
  horse.position.z = 3.4;
  g.add(horse);
  // Тюки с товаром.
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), mat(choice([0x8a6a42, 0x7a3128, 0x3d5c33])));
    c.position.set(rand(-0.5, 0.5), 1.95, -1.2 + i * 1.1);
    g.add(c);
  }
  return g;
}

export class Caravan {
  constructor(game, dir = 1) {
    this.game = game;
    this.dir = dir;
    this.dead = false;
    this.looted = false;
    this.arrived = false;
    this.gold = randInt(180, 460);
    this.goods = [];
    for (let i = 0; i < randInt(2, 4); i++) this.goods.push(choice(['silk', 'spice', 'pelt', 'crown']));

    // Раскладываем маршрут по длине дуги.
    const raw = TRADE_ROAD.path.map((p) => new THREE.Vector2(p[0], p[1]));
    this.path = dir > 0 ? raw : raw.slice().reverse();
    this.cum = [0];
    for (let i = 1; i < this.path.length; i++) {
      this.cum.push(this.cum[i - 1] + this.path[i].distanceTo(this.path[i - 1]));
    }
    this.total = this.cum[this.cum.length - 1];
    this.s = 4;
    this.speed = 5.2;

    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.wagons = [];
    for (let i = 0; i < 3; i++) {
      const w = wagonMesh();
      if (i === 0) {
        // Высокий флаг над головной повозкой — чтобы корован было видно издалека, над лесом.
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 11, 6), mat(0x4a3320));
        pole.position.set(0, 6.5, -1.4);
        w.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 3.4), mat(0xc02a1e));
        flag.position.set(0, 11.0, -3.1);
        w.add(flag);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 3.4), mat(0xd8b23c));
        trim.position.set(0, 10.1, -3.1);
        w.add(trim);
      }
      this.group.add(w);
      this.wagons.push({ mesh: w, offset: -i * 11 });
    }

    // Охрана корована.
    this.guards = [];
    const p0 = this.sample(this.s);
    for (let i = 0; i < 4; i++) {
      const a = new Actor(game, {
        faction: 'guard', role: i === 0 ? 'archer' : 'grunt',
        weapon: i === 0 ? 'crossbow' : 'sword',
        x: p0.x + rand(-4, 4), z: p0.y + rand(-4, 4), hp: 85,
        gold: randInt(15, 50),
      });
      a.caravan = this;
      a.order = { type: 'escort', x: p0.x, z: p0.y };
      game.actors.push(a);
      this.guards.push(a);
    }
    this.pos = new THREE.Vector3(p0.x, heightAt(p0.x, p0.y), p0.y);
  }

  sample(s) {
    const c = this.cum;
    s = Math.max(0, Math.min(this.total, s));
    let i = 1;
    while (i < c.length - 1 && c[i] < s) i++;
    const t = (s - c[i - 1]) / (c[i] - c[i - 1] || 1);
    return new THREE.Vector2().lerpVectors(this.path[i - 1], this.path[i], t);
  }

  update(dt) {
    if (this.dead) return;
    const speed = this.looted ? this.speed * 1.5 : this.speed;
    this.s += speed * dt;
    if (this.s >= this.total) {
      this.arrived = true;
      this.game.onCaravanArrived(this);
      this.destroy();
      return;
    }

    const head = this.sample(this.s);
    this.pos.set(head.x, heightAt(head.x, head.y), head.y);

    for (const w of this.wagons) {
      const p = this.sample(this.s + w.offset);
      const ahead = this.sample(this.s + w.offset + 2);
      const y = heightAt(p.x, p.y);
      w.mesh.position.set(p.x, y, p.y);
      w.mesh.rotation.y = Math.atan2(ahead.x - p.x, ahead.y - p.y);
    }

    // Охрана шагает рядом.
    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      if (g.dead) continue;
      if (!g.target) {
        const off = this.sample(this.s - i * 5);
        g.order = { type: 'escort', x: off.x + (i % 2 ? 4 : -4), z: off.y };
      } else {
        g.order = null;
      }
    }
  }

  /** Живая ли ещё охрана. */
  get guardsAlive() { return this.guards.filter((g) => !g.dead).length; }

  loot(player) {
    if (this.looted) return null;
    this.looted = true;
    player.gold += this.gold;
    for (const g of this.goods) player.add(g, 1);
    player.caravansRobbed++;
    return { gold: this.gold, goods: this.goods.slice() };
  }

  destroy() {
    this.dead = true;
    this.game.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
