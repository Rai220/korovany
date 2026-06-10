// Игрок: вид от первого лица, прыжок, бег, коллизии,
// и фирменная система увечий из ТЗ:
//   рука — без лечения кровотечение убьёт; протез возвращает силу удара;
//   глаз — пол-экрана не видно, пока не вставить протез;
//   нога — ползёшь, либо коляска, либо протез (лучший вариант).
import * as THREE from 'three';

const EYE_STAND = 1.7, EYE_CRAWL = 0.7, EYE_CHAIR = 1.15;
const GRAVITY = 26, JUMP_V = 9.5;

export const WEAPONS = {
  rusty:   { name: 'Ржавый меч',     dmg: 18, range: 3.4, dismember: 0.12 },
  sword:   { name: 'Стальной меч',   dmg: 30, range: 3.6, dismember: 0.22 },
  axe:     { name: 'Боевой топор',   dmg: 42, range: 3.4, dismember: 0.40 },
  elfblade:{ name: 'Эльфийский клинок', dmg: 36, range: 3.8, dismember: 0.30 },
};

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    camera.rotation.order = 'YXZ';

    this.pos = new THREE.Vector3(0, 0, 0); // ноги
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;

    this.faction = 'elf';
    this.maxHp = 100; this.hp = 100;
    this.maxStam = 100; this.stam = 100;
    this.gold = 0;
    this.armor = 0;          // снижение урона 0..0.6
    this.weaponKey = 'rusty';
    this.potions = 1;        // зелья лечения
    this.bandages = 1;       // останавливают кровотечение

    // увечья
    this.handLost = false; this.handProsth = false;
    this.eyeLost = false;   this.eyeProsth = false; this.eyeSide = 'right';
    this.legLost = false;   this.legProsth = false; this.wheelchair = false;
    this.bleeding = false;

    this.alive = true;
    this.controlEnabled = false;
    this.locked = false;
    this.sens = 0.0022;

    this.keys = {};
    this.swingT = 1; this.swinging = false;
    this.attackCooldown = 0;
    this.invuln = 0;

    // колбэки (ставит main)
    this.onAttack = null;
    this.onDeath = null;
    this.onPointerUnlock = null;
    this.onStatsChange = null;

    this._buildViewModel();
    this._bindInput();
  }

  get weapon() { return WEAPONS[this.weaponKey]; }

  _buildViewModel() {
    const g = new THREE.Group();
    const hiltMat = new THREE.MeshLambertMaterial({ color: 0x3a2a16 });
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), hiltMat);
    hilt.position.y = -0.1;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), hiltMat);
    guard.position.y = 0.1;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.03), bladeMat);
    blade.position.y = 0.62;
    g.add(hilt, guard, blade);
    g.position.set(0.42, -0.42, -0.8);
    g.rotation.set(0, 0, -0.25);
    this.camera.add(g);
    this.viewWeapon = g;
    this.viewWeaponMat = bladeMat;
  }

  _bindInput() {
    const dom = this.dom;
    addEventListener('keydown', e => {
      if (!this.controlEnabled) return;
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('mousemove', e => {
      if (!this.locked || !this.controlEnabled) return;
      this.yaw -= e.movementX * this.sens;
      this.pitch -= e.movementY * this.sens;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    });
    dom.addEventListener('mousedown', e => {
      if (!this.controlEnabled || !this.locked) return;
      if (e.button === 0) this.attack();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      if (!this.locked && this.controlEnabled && this.alive && this.onPointerUnlock) {
        this.onPointerUnlock();
      }
    });
  }

  lock() {
    if (!this.dom.requestPointerLock) return;
    const p = this.dom.requestPointerLock();
    if (p && p.catch) p.catch(() => {}); // без жеста мыши — молча игнорируем
  }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }

  spawn(faction, pos) {
    this.faction = faction;
    this.pos.set(pos.x, 0, pos.z);
    this.yaw = pos.yaw || 0; this.pitch = 0;
    this.vy = 0; this.onGround = true;
    this.alive = true;
    if (faction === 'elf') this.weaponKey = 'elfblade';
  }

  // ---------- движение ----------
  moveSpeed() {
    if (this.legLost && !this.legProsth) return this.wheelchair ? 4.0 : 1.6;
    if (this.legProsth) return 5.6;
    return 6.2;
  }
  canJump() {
    if (this.legLost && !this.legProsth) return false;
    return this.onGround;
  }
  eyeHeight() {
    if (this.legLost && !this.legProsth) return this.wheelchair ? EYE_CHAIR : EYE_CRAWL;
    return EYE_STAND;
  }

  update(dt) {
    if (!this.alive) return;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    // кровотечение из ТЗ — без лечения умрёшь
    if (this.bleeding) {
      this.hp -= 3.5 * dt;
      if (this.hp <= 0) return this._die('Истёк кровью. Надо было перевязать рану!');
    }

    // обзор
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // ввод направления
    let fx = 0, fz = 0;
    if (this.keys['KeyW']) fz += 1;
    if (this.keys['KeyS']) fz -= 1;
    if (this.keys['KeyA']) fx -= 1;
    if (this.keys['KeyD']) fx += 1;
    const len = Math.hypot(fx, fz);
    const running = this.keys['ShiftLeft'] && len > 0 && this.stam > 1 &&
      !(this.legLost && !this.legProsth);
    let speed = this.moveSpeed() * (running ? 1.6 : 1);

    if (len > 0) {
      fx /= len; fz /= len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const dx = (-sin * fz + cos * fx);
      const dz = (-cos * fz - sin * fx);
      let nx = this.pos.x + dx * speed * dt;
      let nz = this.pos.z + dz * speed * dt;
      const r = this.world.collide(nx, nz, 1.2);
      this.pos.x = r.x; this.pos.z = r.z;
    }

    // выносливость
    if (running) this.stam = Math.max(0, this.stam - 24 * dt);
    else this.stam = Math.min(this.maxStam, this.stam + 16 * dt);

    // прыжок и гравитация
    if (this.keys['Space'] && this.canJump()) { this.vy = JUMP_V; this.onGround = false; }
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }

    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight(), this.pos.z);

    this._animateWeapon(dt);
    if (this.onStatsChange) this.onStatsChange();
  }

  _animateWeapon(dt) {
    if (this.swinging) {
      this.swingT += dt * 5;
      const t = this.swingT;
      // быстрый замах и возврат
      const s = Math.sin(Math.min(t, 1) * Math.PI);
      this.viewWeapon.rotation.x = -s * 1.6;
      this.viewWeapon.rotation.z = -0.25 + s * 0.5;
      if (t >= 1) { this.swinging = false; this.viewWeapon.rotation.set(0, 0, -0.25); }
    }
  }

  attack() {
    if (this.attackCooldown > 0 || !this.alive) return;
    this.attackCooldown = 0.45;
    this.swinging = true; this.swingT = 0;
    if (this.onAttack) this.onAttack(this.getAttackInfo());
  }

  getAttackInfo() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const weak = this.handLost && !this.handProsth;
    return {
      origin, dir,
      range: this.weapon.range * (weak ? 0.75 : 1),
      dmg: this.weapon.dmg * (weak ? 0.45 : 1),
      dismember: this.weapon.dismember,
    };
  }

  // ---------- получение урона и увечья ----------
  takeDamage(amount, injuryType = null) {
    if (!this.alive || this.invuln > 0) return;
    const dmg = amount * (1 - this.armor);
    this.hp -= dmg;
    this.invuln = 0.4;
    this._flashBlood();
    if (injuryType) this.applyInjury(injuryType);
    if (this.hp <= 0) this._die('Тебя зарубили.');
  }

  applyInjury(type) {
    if (type === 'hand' && !this.handLost && !this.handProsth) {
      this.handLost = true; this.bleeding = true;
      this.ui.log('💢 Тебе отрубили руку! Кровотечение — срочно перевяжись (бинт/зелье) или поставь протез!', 'bad');
    } else if (type === 'eye' && !this.eyeLost && !this.eyeProsth) {
      this.eyeLost = true; this.eyeSide = Math.random() < 0.5 ? 'left' : 'right';
      this.ui.setEyeOverlay(true, this.eyeSide);
      this.ui.log('💢 Тебе выкололи глаз! Полобзора потеряно. Нужен глазной протез.', 'bad');
    } else if (type === 'leg' && !this.legLost && !this.legProsth) {
      this.legLost = true; this.bleeding = true;
      this.ui.log('💢 Тебе отрубили ногу! Теперь ты ползаешь. Купи коляску или протез — и перевяжись!', 'bad');
    }
  }

  _flashBlood() {
    const o = document.getElementById('blood-overlay');
    o.style.opacity = '1';
    clearTimeout(this._bloodT);
    this._bloodT = setTimeout(() => { if (!this.bleeding) o.style.opacity = '0'; }, 250);
  }

  // ---------- лечение / протезы ----------
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
  useBandage() {
    if (this.bandages <= 0) { this.ui.log('Нет бинтов.', 'bad'); return false; }
    if (!this.bleeding) { this.ui.log('Кровотечения нет.'); return false; }
    this.bandages--; this.bleeding = false;
    document.getElementById('blood-overlay').style.opacity = '0';
    this.ui.log('🩹 Рана перевязана. Кровотечение остановлено.', 'good');
    return true;
  }
  usePotion() {
    if (this.potions <= 0) { this.ui.log('Нет зелий.', 'bad'); return false; }
    this.potions--; this.heal(60); this.bleeding = false;
    document.getElementById('blood-overlay').style.opacity = '0';
    this.ui.log('🧪 Выпито зелье лечения (+60 HP, кровь остановлена).', 'good');
    return true;
  }
  installProsthetic(part) {
    if (part === 'hand') { this.handProsth = true; this.handLost = false; this.bleeding = this.legLost && !this.legProsth ? this.bleeding : false;
      this.ui.log('🦾 Установлен протез руки. Сила удара восстановлена.', 'good'); }
    if (part === 'eye') { this.eyeProsth = true; this.eyeLost = false; this.ui.setEyeOverlay(false);
      this.ui.log('👁 Вставлен глазной протез. Обзор восстановлен.', 'good'); }
    if (part === 'leg') { this.legProsth = true; this.legLost = false; this.wheelchair = false; this.bleeding = false;
      document.getElementById('blood-overlay').style.opacity = '0';
      this.ui.log('🦿 Установлен протез ноги. Снова ходишь и прыгаешь.', 'good'); }
    if (part === 'wheelchair') { this.wheelchair = true;
      this.ui.log('♿ Куплена коляска. Катаешься быстрее, чем ползаешь.', 'good'); }
  }

  _die(reason) {
    if (!this.alive) return;
    this.alive = false;
    this.bleeding = false;
    document.getElementById('blood-overlay').style.opacity = '0';
    this.unlock();
    if (this.onDeath) this.onDeath(reason);
  }

  center() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.0, this.pos.z); }

  // ---------- сохранение ----------
  serialize() {
    return {
      faction: this.faction, x: this.pos.x, z: this.pos.z, yaw: this.yaw,
      hp: this.hp, gold: this.gold, armor: this.armor, weaponKey: this.weaponKey,
      potions: this.potions, bandages: this.bandages,
      handLost: this.handLost, handProsth: this.handProsth,
      eyeLost: this.eyeLost, eyeProsth: this.eyeProsth, eyeSide: this.eyeSide,
      legLost: this.legLost, legProsth: this.legProsth, wheelchair: this.wheelchair,
      bleeding: this.bleeding,
    };
  }
  deserialize(s) {
    this.faction = s.faction;
    this.pos.set(s.x, 0, s.z); this.yaw = s.yaw;
    this.hp = s.hp; this.gold = s.gold; this.armor = s.armor; this.weaponKey = s.weaponKey;
    this.potions = s.potions; this.bandages = s.bandages;
    this.handLost = s.handLost; this.handProsth = s.handProsth;
    this.eyeLost = s.eyeLost; this.eyeProsth = s.eyeProsth; this.eyeSide = s.eyeSide;
    this.legLost = s.legLost; this.legProsth = s.legProsth; this.wheelchair = s.wheelchair;
    this.bleeding = s.bleeding; this.alive = true;
    this.ui.setEyeOverlay(this.eyeLost, this.eyeSide);
  }
}
