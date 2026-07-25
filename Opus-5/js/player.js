// Игрок: ходьба, прыжки, увечья, протези и рюкзак.
import * as THREE from 'three';
import { heightAt, slopeAt } from './terrain.js';
import { ITEMS, STARTS, BASES } from './config.js';
import { clamp, chance } from './util.js';

const GRAVITY = 24;
const JUMP_V = 8.0;
const EYE_H = 1.68;

export class Player {
  constructor(faction) {
    const st = STARTS[faction];
    this.faction = faction;
    this.maxHp = 100;
    this.hp = 100;
    this.bleed = 0;
    this.stamina = 100;
    this.gold = st.gold;
    this.inv = { ...st.inv };
    this.weapon = st.weapon;
    this.armor = st.armor;
    this.kills = 0;
    this.caravansRobbed = 0;
    this.rank = 0;
    this.questsDone = 0;
    this.discovered = { [faction === 'guard' ? 'palace' : faction === 'villain' ? 'villain' : 'elf']: true };

    // Состояние тела: ok | lost | prosthetic (для глаза — glass)
    this.parts = { armL: 'ok', armR: 'ok', legL: 'ok', legR: 'ok', eyeL: 'ok', eyeR: 'ok' };

    const b = BASES[faction] || BASES.human;
    this.pos = new THREE.Vector3(b.x - 24, 0, b.z + 26);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.vel = new THREE.Vector3();
    // Смотрим в сторону своей базы, а не в чистое поле.
    this.yaw = Math.atan2(-(b.x - this.pos.x), -(b.z - this.pos.z));
    this.pitch = 0;
    this.onGround = true;
    this.atkCd = 0;
    this.bob = 0;
    this.swing = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this._tmpCols = [];
  }

  // ---------- рюкзак ----------
  count(id) { return this.inv[id] || 0; }
  add(id, n = 1) { this.inv[id] = (this.inv[id] || 0) + n; }
  remove(id, n = 1) {
    this.inv[id] = Math.max(0, (this.inv[id] || 0) - n);
    if (!this.inv[id]) delete this.inv[id];
  }

  get armorValue() { return this.armor ? (ITEMS[this.armor]?.armor || 0) : 0; }

  get weaponData() {
    const w = ITEMS[this.weapon] || ITEMS.fists;
    // Без рук оружие держать нечем.
    if (this.parts.armR !== 'ok' && this.parts.armL !== 'ok'
        && this.parts.armR !== 'prosthetic' && this.parts.armL !== 'prosthetic') return ITEMS.fists;
    return w;
  }

  /** Множитель урона: рубить одной рукой хуже, протезом — так себе. */
  get armPower() {
    const v = (s) => (s === 'ok' ? 1 : s === 'prosthetic' ? 0.7 : 0);
    const a = Math.max(v(this.parts.armR), v(this.parts.armL));
    const b = Math.min(v(this.parts.armR), v(this.parts.armL));
    return clamp(a * 0.75 + b * 0.25, 0.25, 1);
  }

  // ---------- ноги и передвижение ----------
  get mobility() {
    const l = this.parts.legL, r = this.parts.legR;
    const bad = (s) => s === 'lost';
    if (bad(l) && bad(r)) return this.count('wheelchair') ? 'wheelchair' : 'crawl';
    if (bad(l) || bad(r)) return 'limp';
    if (l === 'prosthetic' || r === 'prosthetic') return 'prosth';
    return 'walk';
  }

  get mobilityText() {
    return {
      walk: '', prosth: 'на протезе', limp: 'ковыляете на одной ноге',
      crawl: 'ползёте', wheelchair: 'котаетесь на коляске',
    }[this.mobility];
  }

  get baseSpeed() {
    switch (this.mobility) {
      case 'walk': return 6.4;
      case 'prosth': return 5.4;
      case 'limp': return 3.2;
      case 'wheelchair': return 4.6;
      case 'crawl': return 1.5;
    }
    return 6.4;
  }

  get camHeight() {
    switch (this.mobility) {
      case 'crawl': return 0.55;
      case 'wheelchair': return 1.15;
      case 'limp': return 1.5;
      default: return EYE_H;
    }
  }

  get canJump() { return this.mobility === 'walk' || this.mobility === 'prosth'; }

  get blindLevel() {
    const l = this.parts.eyeL === 'lost' ? 1 : 0;
    const r = this.parts.eyeR === 'lost' ? 1 : 0;
    return l + r;
  }

  // ---------- увечья ----------
  /** Возвращает true, если конечность действительно отрубили. */
  dismember(part) {
    if (!this.parts[part] || this.parts[part] === 'lost') return false;
    this.parts[part] = 'lost';
    if (part === 'eyeL' || part === 'eyeR') this.bleed += 0.25;
    else this.bleed += 0.85;
    this.hp = Math.max(1, this.hp - 8);
    return true;
  }

  bandage() {
    if (!this.count('bandage')) return 'Бинтов нет.';
    if (this.bleed <= 0) return 'Кровь и так не идёт.';
    this.remove('bandage');
    this.bleed = 0;
    this.hp = Math.min(this.maxHp, this.hp + 8);
    return 'Перевязались. Кровь остановлена.';
  }

  drink() {
    if (!this.count('potion')) return 'Зелий нет.';
    if (this.hp >= this.maxHp) return 'Здоровье и так полное.';
    this.remove('potion');
    this.hp = Math.min(this.maxHp, this.hp + (ITEMS.potion.heal || 50));
    return 'Выпили зелье.';
  }

  fullHeal() {
    this.hp = this.maxHp;
    this.bleed = 0;
  }

  /** Ставим протез вместо потерянной части. */
  attachProsthetic(part) {
    const st = this.parts[part];
    if (st !== 'lost') return 'Эта часть тела на месте.';
    const need = part.startsWith('arm') ? 'prosth_arm' : part.startsWith('leg') ? 'prosth_leg' : 'glass_eye';
    if (!this.count(need)) return `Нет предмета: ${ITEMS[need].name}.`;
    this.remove(need);
    this.parts[part] = part.startsWith('eye') ? 'prosthetic' : 'prosthetic';
    this.bleed = Math.max(0, this.bleed - 0.85);
    return `Поставили: ${ITEMS[need].name}.`;
  }

  // ---------- шаг мира ----------
  update(dt, input, world) {
    if (this.dead) return;

    // Кровотечение убивает, если не вылечат.
    if (this.bleed > 0) {
      this.hp -= this.bleed * dt;
      if (this.hp <= 0) { this.hp = 0; return; }
    }
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.swing > 0) this.swing -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    const mob = this.mobility;
    const sprinting = input.sprint && this.stamina > 1 && (mob === 'walk' || mob === 'prosth');
    let speed = this.baseSpeed * (sprinting ? 1.55 : 1);
    if (sprinting) this.stamina = Math.max(0, this.stamina - 26 * dt);
    else this.stamina = Math.min(100, this.stamina + 16 * dt);

    // Направление по камере.
    let fx = 0, fz = 0;
    if (input.fwd) fz += 1;
    if (input.back) fz -= 1;
    if (input.left) fx -= 1;
    if (input.right) fx += 1;
    const len = Math.hypot(fx, fz);
    let wishX = 0, wishZ = 0;
    if (len > 0) {
      fx /= len; fz /= len;
      // Камера смотрит вдоль (-sin yaw, -cos yaw), вправо — (cos yaw, -sin yaw).
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      wishX = fx * cy - fz * sy;
      wishZ = -fz * cy - fx * sy;
    }

    // Крутой склон тормозит, а коляска на него и вовсе не заедет.
    const slope = slopeAt(this.pos.x, this.pos.z);
    if (mob === 'wheelchair' && slope > 0.42) speed *= 0.25;
    else if (slope > 0.5) speed *= 0.6;

    const nx = this.pos.x + wishX * speed * dt;
    const nz = this.pos.z + wishZ * speed * dt;
    this.pos.x = nx;
    this.pos.z = nz;
    this._collide(world);
    this.pos.x = clamp(this.pos.x, -985, 985);
    this.pos.z = clamp(this.pos.z, -985, 985);

    // Прыжки и падение.
    const ground = heightAt(this.pos.x, this.pos.z);
    if (input.jump && this.onGround && this.canJump && this.stamina > 8) {
      this.vel.y = JUMP_V;
      this.onGround = false;
      this.stamina -= 8;
    }
    this.vel.y -= GRAVITY * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= ground) {
      if (!this.onGround && this.vel.y < -16) {
        const fall = (-this.vel.y - 16) * 2.4;
        this.hp -= fall;
        if (fall > 10) this.hurtFlash = 0.5;
      }
      this.pos.y = ground;
      this.vel.y = 0;
      this.onGround = true;
    }

    // Покачивание при ходьбе.
    if (len > 0 && this.onGround) this.bob += dt * speed * 1.35;
  }

  _collide(world) {
    const R = this.mobility === 'crawl' ? 0.35 : 0.5;
    for (const c of world.colliders) {
      if (c.type === 'box') {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const ox = c.hw + R - Math.abs(dx);
        const oz = c.hd + R - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          if (ox < oz) this.pos.x += Math.sign(dx || 1) * ox;
          else this.pos.z += Math.sign(dz || 1) * oz;
        }
      } else {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const need = c.r + R;
        if (d < need && d > 1e-4) {
          this.pos.x += (dx / d) * (need - d);
          this.pos.z += (dz / d) * (need - d);
        }
      }
    }
    if (world.forest) {
      const cols = world.forest.collidersNear(this.pos.x, this.pos.z, 3, this._tmpCols);
      for (const c of cols) {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const need = c.r + R;
        if (d < need && d > 1e-4) {
          this.pos.x += (dx / d) * (need - d);
          this.pos.z += (dz / d) * (need - d);
        }
      }
    }
  }

  serialize() {
    return {
      faction: this.faction, hp: this.hp, bleed: this.bleed, gold: this.gold,
      inv: this.inv, weapon: this.weapon, armor: this.armor, parts: this.parts,
      kills: this.kills, caravansRobbed: this.caravansRobbed, rank: this.rank,
      questsDone: this.questsDone, discovered: this.discovered,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw,
    };
  }

  static deserialize(data) {
    const p = new Player(data.faction);
    Object.assign(p, {
      hp: data.hp, bleed: data.bleed, gold: data.gold, inv: data.inv,
      weapon: data.weapon, armor: data.armor, parts: data.parts,
      kills: data.kills || 0, caravansRobbed: data.caravansRobbed || 0,
      rank: data.rank || 0, questsDone: data.questsDone || 0,
      discovered: data.discovered || {}, yaw: data.yaw || 0,
    });
    p.pos.set(data.pos[0], data.pos[1], data.pos[2]);
    return p;
  }
}

/** Куда пришёлся удар по игроку. */
export function randomPlayerPart() {
  const r = Math.random();
  if (r < 0.14) return chance(0.5) ? 'eyeL' : 'eyeR';
  if (r < 0.44) return chance(0.5) ? 'armL' : 'armR';
  if (r < 0.68) return chance(0.5) ? 'legL' : 'legR';
  return 'torso';
}
