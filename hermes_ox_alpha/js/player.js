// ДЖВА ГОДА — игрок: FPS-управление, прыжки, травмы, кровотечение, протезы.
import * as THREE from 'three';
import { terrainHeight } from './world.js';

export const LIMBS = ['armL', 'armR', 'legL', 'legR', 'eye'];

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;      // смотрим на юг по умолчанию
    this.pitch = -0.1;
    this.onGround = true;
    this.dead = false;
    this.faction = null;

    // тело
    this.hpMax = 100;
    this.hp = 100;
    this.stamMax = 100;
    this.stam = 100;
    this.gold = 60;

    // травмы: limb -> false (цел) / 'bleeding' (только конечности) / 'lost' / 'prosthesis'
    this.limbs = { armL: false, armR: false, legL: false, legR: false, eye: false };
    this.hasWheelchair = false;

    // экипировка
    this.weapon = 'sword';   // 'sword' | 'bow'
    this.arrows = 12;
    this.bandages = 1;

    this.attackCd = 0;
    this.swingT = 0;
    this.bowDrawT = 0;
    this.bobT = 0;

    // вид-модель руки/оружия
    this.viewGroup = new THREE.Group();
  }

  buildViewModel() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xd0aa88 });
    const sleeve = new THREE.MeshLambertMaterial({ color: 0x5a6a8a });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.62), sleeve);
    arm.position.set(0.32, -0.28, -0.55);
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.14), mat);
    hand.position.set(0.32, -0.28, -0.88);
    g.add(hand);
    if (this.weapon === 'sword') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.85),
        new THREE.MeshLambertMaterial({ color: 0xc8ccd4 }));
      blade.position.set(0.34, -0.24, -1.3);
      g.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.06),
        new THREE.MeshLambertMaterial({ color: 0x6a6a70 }));
      guard.position.set(0.34, -0.25, -0.9);
      g.add(guard);
    } else {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 5, 14, Math.PI),
        new THREE.MeshLambertMaterial({ color: 0x7a5a38 }));
      bow.position.set(0.36, -0.22, -0.95);
      bow.rotation.set(Math.PI / 2, 0.15, Math.PI / 2);
      g.add(bow);
    }
    if (this.limbs.armR === 'prosthesis') {
      // металлическая рука
      for (const c of [arm, hand]) c.material = new THREE.MeshLambertMaterial({ color: 0x8a9098 });
    }
    this.viewGroup.clear();
    this.viewGroup.add(g);
    return g;
  }

  reset(faction, spawnPos) {
    this.faction = faction;
    this.pos.copy(spawnPos);
    this.vel.set(0, 0, 0);
    this.dead = false;
    this.hpMax = 100; this.hp = 100;
    this.stam = 100;
    this.gold = faction === 'villain' ? 120 : 60;
    this.limbs = { armL: false, armR: false, legL: false, legR: false, eye: false };
    this.hasWheelchair = false;
    this.weapon = faction === 'elf' ? 'bow' : 'sword';
    this.arrows = 12;
    this.bandages = 1;
    this.buildViewModel();
  }

  legsUsable() {
    let n = 0;
    for (const l of ['legL', 'legR']) if (this.limbs[l] === false || this.limbs[l] === 'prosthesis') n++;
    return n;
  }
  armsUsable() {
    let n = 0;
    for (const a of ['armL', 'armR']) if (this.limbs[a] === false || this.limbs[a] === 'prosthesis') n++;
    return n;
  }

  takeMeleeHit(dmg, from) {
    if (this.dead || this.game.godmode) return;
    // шанс получить тяжёлую травму конечности от ближнего боя
    const roll = Math.random();
    if (roll < 0.11) {
      const pool = ['armL', 'armR', 'legL', 'legR'].filter(l =>
        this.limbs[l] === false || this.limbs[l] === 'prosthesis');
      if (pool.length) {
        const limb = pool[Math.floor(Math.random() * pool.length)];
        this.sever(limb);
        this.hurt(dmg * 0.4, from ? (from.name || 'враг') : 'враг');
        this.game.ui.updateHUD();
        return;
      }
    }
    this.hurt(dmg, from ? (from.name || 'враг') : 'враг');
  }

  hurt(dmg, cause) {
    if (this.dead) return;
    this.hp -= dmg;
    this.game.ui.bloodFlash();
    if (this.hp <= 0) this.game.killPlayer('Вас убил ' + cause + '.');
  }

  arrowHit(dmg, shooterName) { this.hurt(dmg, shooterName + ' (стрела)'); }

  // отрубание конечностей вражеским оружием
  sever(limb) {
    if (this.limbs[limb] === 'lost' || this.limbs[limb] === 'prosthesis') return false;
    if (limb === 'eye') {
      this.limbs.eye = 'lost';
      this.game.log('⚠ Вам ВЫКОЛОЛИ ГЛАЗ! Половина экрана закрыта. Лекарь поставит «стеклянный глаз».', 'bad');
      return true;
    }
    this.limbs[limb] = 'bleeding';
    this.game.log(`⚠ Вам ОТРУБИЛИ ${limb === 'armL' ? 'левую руку' : limb === 'armR' ? 'правую руку' : limb === 'legL' ? 'левую ногу' : 'правую ногу'}! Кровотечение! Срочно к лекарю или бинт!`, 'bad');
    return true;
  }

  bandage() {
    for (const l of LIMBS) {
      if (this.limbs[l] === 'bleeding') {
        this.limbs[l] = 'lost';
        this.bandages--;
        this.game.log('Вы перевязали культю. Кровотечение остановлено. Протез можно купить у лекаря.', 'good');
        this.game.ui.updateHUD();
        return true;
      }
    }
    return false;
  }

  update(dt, keys) {
    if (this.dead) return;
    const g = this.game;

    // выносливость
    const wantsRun = keys['ShiftLeft'] && this.stam > 2;
    let maxSpeed = 7.2;
    const legs = this.legsUsable();
    if (legs === 0) {
      maxSpeed = this.hasWheelchair ? 4.2 : 1.7; // ползком или коляска
    } else if (legs === 1) {
      maxSpeed = this.hasWheelchair ? 4.2 : 2.6; // хромаем или коляска
    }
    if (wantsRun && legs >= 2) maxSpeed *= 1.45;

    // ввод
    let fx = 0, fz = 0;
    if (keys['KeyW']) fz -= 1;
    if (keys['KeyS']) fz += 1;
    if (keys['KeyA']) fx -= 1;
    if (keys['KeyD']) fx += 1;
    const moving = fx !== 0 || fz !== 0;

    // ползание визуально ниже камеры
    const crawl = legs === 0;
    const eyeH = crawl ? 1.1 : (legs < 2 && this.hasWheelchair ? 2.0 : 3.1);

    if (moving) {
      const len = Math.hypot(fx, fz);
      fx /= len; fz /= len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = fx * cos - fz * sin;
      const dz = fx * sin + fz * cos;
      const cost = wantsRun ? 14 : 6;
      if (this.stam > 0 || !wantsRun) {
        this.pos.x += dx * maxSpeed * dt;
        this.pos.z += dz * maxSpeed * dt;
        if (wantsRun && legs >= 2) { this.stam = Math.max(0, this.stam - cost * dt); }
        else this.stam = Math.min(this.stamMax, this.stam + (wantsRun ? 0 : 8) * dt);
        this.bobT += dt * (wantsRun ? 11 : 7);
      }
    } else {
      this.stam = Math.min(this.stamMax, this.stam + 10 * dt);
    }

    // прыжок
    if (keys['Space'] && this.onGround) {
      if (legs >= 2) {
        this.vel.y = 7.4;
        this.onGround = false;
      } else if (legs === 1 && !this.hasWheelchair) {
        this.vel.y = 3.2; // подскок на одной ноге
        this.onGround = false;
      }
      keys['Space'] = false;
    }

    // гравитация
    this.vel.y -= 21 * dt;
    this.pos.y += this.vel.y * dt;
    const gy = terrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) {
      if (this.vel.y < -16) this.hurt((-this.vel.y - 16) * 3.2, 'падение');
      this.pos.y = gy;
      this.vel.y = 0;
      this.onGround = true;
    }

    // коллизии мира
    [this.pos.x, this.pos.z] = g.resolveMove(this.pos.x, this.pos.z, 0.65);

    // кровотечение
    let bleeding = false;
    for (const l of LIMBS) if (this.limbs[l] === 'bleeding') bleeding = true;
    if (bleeding) {
      this.hp -= dt * 2.2;
      g.ui.showBleed(true);
      if (this.hp <= 0) g.killPlayer('Вы истекли кровью после потери конечности.');
    } else {
      g.ui.showBleed(false);
    }
    // регенерация до 50% если нет критического урона
    if (!bleeding && this.hp > 0 && this.hp < this.hpMax * 0.5) {
      this.hp = Math.min(this.hpMax * 0.5, this.hp + dt * 0.7);
    }

    // таймеры атаки
    this.attackCd -= dt;
    if (this.swingT > 0) this.swingT += dt * 5;
    if (this.swingT > 1) this.swingT = 0;

    // камера
    const cam = g.camera;
    cam.position.set(
      this.pos.x,
      this.pos.y + eyeH + (moving && this.onGround ? Math.sin(this.bobT) * 0.07 : 0),
      this.pos.z
    );
    cam.rotation.set(0, 0, 0);
    cam.rotateY(this.yaw);
    cam.rotateX(this.pitch);
    cam.rotateZ(crawl ? 0.18 : 0);
  }

  // позиционирование модели руки — вызывается из main после обновления камеры
  updateViewModel() {
    const cam = this.game.camera;
    const g = this.game;
    this.viewGroup.position.copy(cam.position);
    this.viewGroup.quaternion.copy(cam.quaternion);
    if (this.swingT > 0) {
      const k = Math.sin(Math.min(1, this.swingT) * Math.PI);
      this.viewGroup.translateZ(-k * (this.weapon === 'sword' ? 0.5 : 0.15));
      this.viewGroup.rotateX(-k * 0.4);
    }
    if (this.weapon === 'bow') this.viewGroup.translateY(0.02);
  }

  tryShoot(targetPoint) {
    if (this.attackCd > 0) return false;
    if (this.weapon === 'sword') return false;
    if (this.arrows <= 0) { this.game.log('Колчан пуст!', 'bad'); return false; }
    if (this.armsUsable() === 0) { this.game.log('Нет рук для стрельбы!', 'bad'); return false; }
    this.attackCd = 0.9;
    this.arrows--;
    this.swingT = 0.001;
    this.game.arrows.shootAt(
      this.pos.x, this.pos.y + 2.6, this.pos.z,
      targetPoint.x, targetPoint.y, targetPoint.z,
      'player'
    );
    return true;
  }

  tryMelee(nearbyActors) {
    if (this.attackCd > 0) return false;
    if (this.weapon === 'bow') return false;
    if (this.armsUsable() === 0) { this.game.log('Нечем бить — нет рук!', 'bad'); return false; }
    this.attackCd = 0.55;
    this.swingT = 0.001;
    const reach = 3.4;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion);
    let hitSomething = false;
    for (const act of nearbyActors) {
      if (act.dead || act.playerAlly()) continue;
      const d = act.pos.distanceTo(this.pos);
      if (d > reach) continue;
      const dir = new THREE.Vector3().subVectors(act.pos, this.pos).normalize();
      if (dir.dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) > 0.35) {
        hitSomething = true;
        // расчленёнка игрока по врагу!
        if (act.hp > 26 && Math.random() < 0.16) {
          const limbRoll = ['arm', 'leg'][Math.floor(Math.random() * 2)];
          this.game.severEnemyLimb(act, limbRoll);
        } else {
          const dmg = 16 + Math.random() * 12;
          act.damage(dmg, 'player');
          this.game.ui.hitMark();
        }
        break;
      }
    }
    return hitSomething;
  }
}
