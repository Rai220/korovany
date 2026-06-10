// Игрок: вид от первого лица, прыжки, меч/лук, увечья.
// Могут не только убить, но и отрубить руку (перевяжись или умрёшь),
// выколоть глаз (пол-экрана не видно — или купи волшебный глаз),
// отрубить ногу (умрёшь / ползай / коляска / протез — самое хорошее).
import * as THREE from 'three';

const LIMB_NAMES = {
  armL: 'левую руку', armR: 'правую руку',
  legL: 'левую ногу', legR: 'правую ногу',
  eyeL: 'левый глаз', eyeR: 'правый глаз',
};

const arrowGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.7, 5);
arrowGeo.rotateX(Math.PI / 2);
const arrowMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });

export class Player {
  constructor(game) {
    this.g = game;
    this.isPlayer = true;
    this.name = 'Вы';
    this.pos = new THREE.Vector3();
    this.velY = 0; this.onGround = true;
    this.yaw = 0; this.pitch = 0;
    this.cool = 0; this.swingT = 0; this.hitPend = false;
    this.moving = false;
    this.buildFP();
  }

  reset(faction) {
    this.faction = faction;
    this.dead = false;
    this.maxHp = 100; this.hp = 100;
    this.bleeding = 0;
    this.limbs = { armL: 1, armR: 1, legL: 1, legR: 1, eyeL: 1, eyeR: 1 }; // 1 цела, 0 нет, 2 протез
    this.wheelchair = false;
    this.inv = { potion: 1, bandage: 2, arrows: 0 };
    this.weapons = { steel: false, bow: false };
    this.weapon = 'melee';
    this.gold = 50;
    let sx = -204, sz = -212;
    this.yaw = -2.2; this.pitch = 0; this.velY = 0;
    if (faction === 'elf') {
      this.weapons.bow = true; this.inv.arrows = 30; this.gold = 60;
    } else if (faction === 'guard') {
      this.gold = 40; sx = 172; sz = 200; this.yaw = -Math.PI / 2;
    } else if (faction === 'villain') {
      this.weapons.steel = true; this.gold = 140; sx = 218; sz = -210; this.yaw = Math.PI;
    }
    this.pos.set(sx, this.g.world.height(sx, sz), sz);
    this.applyWeaponVis();
  }

  buildFP() {
    const fp = new THREE.Group();
    this.g.camera.add(fp);
    this.fp = fp;
    // меч
    const sw = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.64, 0.05), new THREE.MeshLambertMaterial({ color: 0xc8d0d8 }));
    blade.position.y = 0.36;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.07), new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a2a16 }));
    hilt.position.y = -0.1;
    sw.add(blade, guard, hilt);
    sw.position.set(0.34, -0.32, -0.6);
    sw.rotation.set(-0.6, 0.1, -0.15);
    fp.add(sw);
    this.swordMesh = sw;
    // лук
    const bw = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.022, 6, 14, Math.PI), new THREE.MeshLambertMaterial({ color: 0x6a4a26 }));
    arc.rotation.z = Math.PI / 2;
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.66, 0.008), new THREE.MeshLambertMaterial({ color: 0xd8d8c8 }));
    bw.add(arc, str);
    bw.position.set(-0.3, -0.28, -0.55);
    bw.rotation.set(0, 0.4, 0.15);
    fp.add(bw);
    this.bowMesh = bw;
  }

  get armsWorking() { return (this.limbs.armL > 0 ? 1 : 0) + (this.limbs.armR > 0 ? 1 : 0); }
  get legsOK() { return this.limbs.legL > 0 && this.limbs.legR > 0; }
  canBow() { return this.weapons.bow && this.limbs.armL > 0 && this.limbs.armR > 0; }

  moveMode() {
    if (this.legsOK) return 'walk';
    if (this.wheelchair && this.armsWorking > 0) return 'wheel';
    return 'crawl';
  }

  applyWeaponVis() {
    if (!this.swordMesh) return;
    const melee = this.weapon === 'melee' && this.armsWorking > 0;
    this.swordMesh.visible = melee;
    // меч в левой руке, если правой нет
    this.swordMesh.position.x = this.limbs.armR > 0 ? 0.34 : -0.34;
    this.bowMesh.visible = this.weapon === 'bow' && this.canBow();
  }

  setWeapon(w) {
    if (this.dead) return;
    if (w === 'bow') {
      if (!this.weapons.bow) { this.g.ui.msg('У вас нет лука. Купите в лавке.', 'bad'); return; }
      if (!this.canBow()) { this.g.ui.msg('Для лука нужны обе руки (протез считается).', 'bad'); return; }
    }
    this.weapon = w;
    this.applyWeaponVis();
    this.g.sfx.click();
  }

  update(dt) {
    if (this.dead) return;
    const k = this.g.keys, W = this.g.world;

    // кровотечение: если не вылечат — умрёт
    if (this.bleeding > 0) {
      this.hp -= 2.2 * this.bleeding * dt;
      this.g.ui.setBleeding(true);
      if (this.hp <= 0) { this.die('Вы истекли кровью. Вас так и не вылечили.'); return; }
    } else {
      this.g.ui.setBleeding(false);
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 0.5 * dt);
    }

    // движение
    const mode = this.moveMode();
    let sp;
    if (mode === 'walk') sp = (k['ShiftLeft'] || k['ShiftRight']) ? 8.6 : 5.4;
    else if (mode === 'wheel') sp = 4.2;
    else sp = this.armsWorking > 0 ? 1.5 : 0.8;

    let fx = 0, fz = 0;
    if (k['KeyW']) fz -= 1;
    if (k['KeyS']) fz += 1;
    if (k['KeyA']) fx -= 1;
    if (k['KeyD']) fx += 1;
    this.moving = false;
    if (fx || fz) {
      const l = Math.hypot(fx, fz); fx /= l; fz /= l;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const Fx = -s, Fz = -c;          // вперёд
      const Rx = c, Rz = -s;           // вправо
      this.pos.x += (Fx * (-fz) + Rx * fx) * sp * dt;
      this.pos.z += (Fz * (-fz) + Rz * fx) * sp * dt;
      this.moving = true;
    }

    // прыжок (можно прыгать и т.п. — но только если ноги в строю)
    if (k['Space'] && this.onGround && mode === 'walk') {
      const prosthetic = this.limbs.legL === 2 || this.limbs.legR === 2;
      this.velY = prosthetic ? 6.2 : 7.4;
      this.onGround = false;
    }
    this.velY -= 20 * dt;
    this.pos.y += this.velY * dt;
    const gr = W.height(this.pos.x, this.pos.z);
    if (this.pos.y <= gr) { this.pos.y = gr; this.velY = 0; this.onGround = true; }

    const r = W.resolve(this.pos.x, this.pos.z, 0.45);
    this.pos.x = Math.max(-395, Math.min(395, r[0]));
    this.pos.z = Math.max(-395, Math.min(395, r[1]));

    // камера
    const eye = mode === 'walk' ? 1.62 : mode === 'wheel' ? 1.15 : 0.55;
    const bob = this.moving && mode === 'walk' ? Math.sin(performance.now() * 0.012) * 0.05 : 0;
    this.g.camera.position.set(this.pos.x, this.pos.y + eye + bob, this.pos.z);
    this.g.camera.rotation.set(this.pitch, this.yaw, 0);

    // оружие
    this.cool = Math.max(0, this.cool - dt);
    if (this.swingT > 0) {
      this.swingT -= dt;
      const p = 1 - this.swingT / 0.28;
      this.swordMesh.rotation.x = -0.6 - Math.sin(Math.PI * p) * 1.5;
      this.swordMesh.position.z = -0.6 - Math.sin(Math.PI * p) * 0.25;
      if (this.hitPend && p > 0.45) { this.hitPend = false; this.meleeHit(); }
      if (this.swingT <= 0) {
        this.swordMesh.rotation.set(-0.6, 0.1, -0.15);
        this.swordMesh.position.z = -0.6;
      }
    }
  }

  attack() {
    if (this.dead || this.cool > 0) return;
    if (this.weapon === 'bow') {
      if (!this.canBow()) {
        this.g.ui.msg('Лук не натянуть — нужны обе руки!', 'bad');
        this.weapon = 'melee'; this.applyWeaponVis();
        return;
      }
      if (this.inv.arrows <= 0) { this.g.ui.msg('Нет стрел! Купите в лавке.', 'bad'); return; }
      this.inv.arrows--;
      this.cool = 0.7;
      this.shootArrow();
      this.g.sfx.shoot();
    } else {
      if (this.armsWorking === 0) {
        this.g.ui.msg('Нечем держать меч! Купите протез руки в лавке.', 'bad');
        return;
      }
      this.cool = 0.5;
      this.swingT = 0.28;
      this.hitPend = true;
      this.g.sfx.swing();
    }
  }

  meleeHit() {
    const dir = new THREE.Vector3();
    this.g.camera.getWorldDirection(dir);
    const dmgBase = (this.weapons.steel ? 40 : 25) * (this.armsWorking === 2 ? 1 : 0.65);
    let hit = false;
    for (const n of this.g.npcs.npcs) {
      if (n.dead) continue;
      const np = n.group.position;
      const dx = np.x - this.pos.x, dz = np.z - this.pos.z;
      const dy = (np.y + 1.1) - (this.pos.y + 1.4);
      const d = Math.hypot(dx, dz);
      if (d < 2.9 && Math.abs(dy) < 2.6) {
        const inv = 1 / (d || 1e-6);
        if (dir.x * dx * inv + dir.z * dz * inv > 0.55) {
          n.takeDamage(dmgBase + Math.random() * 8, this);
          hit = true;
        }
      }
    }
    if (hit) this.g.sfx.hit();
  }

  shootArrow() {
    const dir = new THREE.Vector3();
    this.g.camera.getWorldDirection(dir);
    const mesh = new THREE.Mesh(arrowGeo, arrowMat);
    mesh.position.copy(this.g.camera.position).addScaledVector(dir, 0.6);
    const vel = dir.clone().multiplyScalar(44);
    vel.y += 0.8;
    mesh.lookAt(mesh.position.clone().add(vel));
    this.g.scene.add(mesh);
    this.g.projectiles.push({ mesh, vel, t: 0, stuck: false });
  }

  takeDamage(d, label) {
    if (this.dead) return;
    this.hp -= d;
    this.g.sfx.hurt();
    this.g.ui.damageFlash();
    if (this.hp <= 0) { this.die(`Вас убил: ${label}.`); return; }
    if (d >= 11 && Math.random() < 0.22) this.injure();
  }

  injure() {
    const cand = Object.keys(this.limbs).filter(k => this.limbs[k] === 1);
    if (!cand.length) return;
    const part = cand[(Math.random() * cand.length) | 0];
    this.limbs[part] = 0;
    this.g.sfx.sever();
    const ui = this.g.ui;
    if (part === 'armL' || part === 'armR') {
      this.bleeding++;
      ui.banner('ВАМ ОТРУБИЛИ РУКУ!', 'red');
      ui.msg(`Вам отрубили ${LIMB_NAMES[part]}! [B] — перевязать, иначе истечёте кровью. Протез — в лавке.`, 'bad');
      if (this.weapon === 'bow' && !this.canBow()) this.weapon = 'melee';
    } else if (part === 'eyeL' || part === 'eyeR') {
      ui.banner('ВАМ ВЫКОЛОЛИ ГЛАЗ!', 'red');
      ui.msg(`Вам выкололи ${LIMB_NAMES[part]}! Пол-экрана теперь не видно. Волшебный глаз продаётся в лавке.`, 'bad');
      ui.applyEyes();
    } else {
      this.bleeding++;
      ui.banner('ВАМ ОТРУБИЛИ НОГУ!', 'red');
      if (this.wheelchair && this.armsWorking > 0) {
        ui.msg(`Вам отрубили ${LIMB_NAMES[part]}! Вы пересели в инвалидную коляску. И перевяжитесь [B]!`, 'bad');
      } else {
        ui.msg(`Вам отрубили ${LIMB_NAMES[part]}! Теперь ползком. Коляска или протез — в лавке. Перевяжитесь [B]!`, 'bad');
      }
    }
    this.applyWeaponVis();
  }

  usePotion() {
    if (this.dead) return;
    if (this.inv.potion <= 0) { this.g.ui.msg('Зелий нет. Купите в лавке.', 'bad'); return; }
    if (this.hp >= this.maxHp) { this.g.ui.msg('Вы и так здоровы (но рук это не вернёт).', 'dim'); return; }
    this.inv.potion--;
    this.hp = Math.min(this.maxHp, this.hp + 50);
    this.g.ui.msg('Вы выпили зелье лечения. +50 ХП', 'good');
    this.g.sfx.potion();
  }

  useBandage() {
    if (this.dead) return;
    if (this.bleeding === 0) { this.g.ui.msg('Кровь не идёт.', 'dim'); return; }
    if (this.inv.bandage <= 0) { this.g.ui.msg('Бинтов нет! Купите у лекаря или в лавке.', 'bad'); return; }
    this.inv.bandage--;
    this.bleeding = 0;
    this.g.ui.msg('Кровотечение остановлено. Жить будете. Наверное.', 'good');
    this.g.sfx.potion();
  }

  installProsthetic(kind) {
    const ui = this.g.ui;
    if (kind === 'arm') {
      const part = this.limbs.armR === 0 ? 'armR' : 'armL';
      this.limbs[part] = 2;
      ui.msg('Протез руки установлен. Как новенькая! Даже меч держит.', 'good');
    } else if (kind === 'leg') {
      const part = this.limbs.legR === 0 ? 'legR' : 'legL';
      this.limbs[part] = 2;
      ui.msg('Протез ноги установлен — самое хорошее! Снова можно ходить и прыгать.', 'good');
    } else if (kind === 'eye') {
      const part = this.limbs.eyeR === 0 ? 'eyeR' : 'eyeL';
      this.limbs[part] = 2;
      ui.msg('Волшебный глаз установлен. Видит даже лучше прежнего.', 'good');
      ui.applyEyes();
    }
    this.applyWeaponVis();
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.g.over(cause);
  }

  serialize() {
    return {
      faction: this.faction,
      pos: [this.pos.x, this.pos.y, this.pos.z],
      yaw: this.yaw, pitch: this.pitch,
      hp: this.hp, maxHp: this.maxHp,
      gold: this.gold,
      inv: { ...this.inv },
      weapons: { ...this.weapons },
      weapon: this.weapon,
      limbs: { ...this.limbs },
      wheelchair: this.wheelchair,
      bleeding: this.bleeding,
    };
  }

  deserialize(d) {
    if (!d) return;
    this.hp = d.hp; this.maxHp = d.maxHp;
    this.gold = d.gold;
    this.inv = { ...d.inv };
    this.weapons = { ...d.weapons };
    this.weapon = d.weapon;
    this.limbs = { ...d.limbs };
    this.wheelchair = !!d.wheelchair;
    this.bleeding = d.bleeding || 0;
    this.yaw = d.yaw || 0; this.pitch = d.pitch || 0;
    if (d.pos) this.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    this.applyWeaponVis();
  }
}
