// Сборка всей игры: мир, бой, приказы, лавки, сохранения.
import * as THREE from 'three';
import { buildTerrain, heightAt, zoneAt } from './terrain.js';
import { Forest } from './forest.js';
import { buildSettlements } from './props.js';
import { Actor, weaponMesh, partFromHeight, LIMB_RU } from './actors.js';
import { Player, randomPlayerPart } from './player.js';
import { Caravan } from './caravan.js';
import { UI } from './ui.js';
import { makeQuest, questEvent, rankName, randomTaunt } from './quests.js';
import { initAudio, resumeAudio, sfx } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import {
  ITEMS, SHOPS, SERVICES, BASES, FACTIONS, ZONES, STARTS, isHostile, VIEW_DIST,
} from './config.js';
import { clamp, rand, randInt, chance, choice } from './util.js';

const ACTIVE_DIST = 260;

export class Game {
  constructor() {
    this.state = 'loading';
    this.actors = [];
    this.caravans = [];
    this.projectiles = [];
    this.debris = [];
    this.squad = [];
    this.player = null;
    this.quest = null;
    this.questIndex = 0;
    this.objective = '';
    this.zone = ZONES.wild;
    this.time = 0;
    this.caravanT = 8;
    this.eventT = 60;
    this.respawnT = 20;
    this.pendingReward = 0;
    this.input = {
      fwd: false, back: false, left: false, right: false,
      sprint: false, jump: false, attack: false,
    };
    this.ui = new UI(this);
    this._ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
  }

  // ==================== ЗАПУСК ====================
  async boot() {
    this.ui.show('loading');
    await this._step(0.05, 'Готовим движок…', () => this._initRenderer());
    await this._step(0.25, 'Насыпаем горы и долины…', () => this._initWorld());
    await this._step(0.55, 'Ставим домики деревяные и дворец…', () => this._initSettlements());
    await this._step(0.85, 'Растим густой лес…', () => this._initForest());
    await this._step(1.0, 'Готово.', () => {});
    this._initInput();
    this.ui.show('menu');
    if (hasSave()) document.getElementById('btnContinue').classList.remove('hidden');
    this._loop();
  }

  _step(pct, text, fn) {
    return new Promise((resolve) => {
      this.ui.setLoading(pct, text);
      requestAnimationFrame(() => {
        setTimeout(() => { fn(); resolve(); }, 16);
      });
    });
  }

  _initRenderer() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9dbcd4);
    this.scene.fog = new THREE.Fog(0x9dbcd4, VIEW_DIST * 0.45, VIEW_DIST * 1.05);

    this.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 2600);

    const hemi = new THREE.HemisphereLight(0xbcd7ee, 0x4a4530, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.35);
    sun.position.set(60, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    const S = 78;
    sun.shadow.camera.left = -S;
    sun.shadow.camera.right = S;
    sun.shadow.camera.top = S;
    sun.shadow.camera.bottom = -S;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // Небо-купол.
    const skyGeo = new THREE.SphereGeometry(1600, 24, 16);
    const cols = new Float32Array(skyGeo.attributes.position.count * 3);
    const top = new THREE.Color(0x37628f), bot = new THREE.Color(0xd3e0e6);
    const tmp = new THREE.Color();
    for (let i = 0; i < skyGeo.attributes.position.count; i++) {
      const y = skyGeo.attributes.position.getY(i) / 1600;
      tmp.copy(bot).lerp(top, clamp(y * 1.25 + 0.15, 0, 1));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    this.scene.add(sky);
    this.sky = sky;

    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  _initWorld() {
    this.terrain = buildTerrain();
    this.scene.add(this.terrain);
    this.world = { colliders: [], forest: null };
  }

  _initSettlements() {
    const s = buildSettlements(this.scene);
    this.world.colliders = s.colliders;
    this.interactables = s.interactables;
    this._exclusions = s.exclusions;
  }

  _initForest() {
    this.forest = new Forest(this.scene, this._exclusions);
    this.world.forest = this.forest;
  }

  // ==================== НОВАЯ ИГРА / ЗАГРУЗКА ====================
  newGame(faction) {
    this._clearWorldEntities();
    this.player = new Player(faction);
    this.questIndex = 0;
    this.quest = null;
    this.objective = STARTS[faction].obj;
    this._populate();
    this._buildViewmodel();
    this.forest.update(this.player.pos, true);
    this.enterPlaying();
    this.ui.log(`Вы играете за: ${FACTIONS[faction].name}.`, 'gold');
    this.ui.log(this.objective, 'warn');
    sfx('horn');
  }

  loadFromSave() {
    const data = loadGame();
    if (!data) return false;
    this._clearWorldEntities();
    this.player = Player.deserialize(data.player);
    this.questIndex = data.questIndex || 0;
    this.quest = data.quest || null;
    this.objective = data.objective || STARTS[this.player.faction].obj;
    this._populate();
    this._buildViewmodel();
    this.forest.update(this.player.pos, true);
    this.enterPlaying();
    this.ui.log('Сохранение загружено.', 'good');
    return true;
  }

  doSave() {
    const ok = saveGame({
      player: this.player.serialize(),
      quest: this.quest,
      questIndex: this.questIndex,
      objective: this.objective,
    });
    this.ui.log(ok ? 'Сохранено.' : 'Сохранить не вышло.', ok ? 'good' : 'bad');
    this.ui.refreshSaveInfo();
    return ok;
  }

  _clearWorldEntities() {
    for (const a of this.actors) a.dispose();
    this.actors = [];
    this.squad = [];
    for (const c of this.caravans) if (!c.dead) c.destroy();
    this.caravans = [];
    this.caravanT = 8;
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
  }

  /** Расселяем мир: гвардия у дворца, эльфы в лесу, слуги Злого в форте, мужики в городке. */
  _populate() {
    const spawn = (opt) => {
      const a = new Actor(this, opt);
      this.actors.push(a);
      return a;
    };
    const around = (base, r) => {
      const ang = rand(0, Math.PI * 2), d = rand(r * 0.35, r);
      return { x: base.x + Math.cos(ang) * d, z: base.z + Math.sin(ang) * d };
    };

    // Эльфы.
    for (let i = 0; i < 16; i++) {
      const p = around(BASES.elf, i < 10 ? 70 : 240);
      spawn({ faction: 'elf', role: i % 3 === 0 ? 'archer' : 'grunt', weapon: i % 3 === 0 ? 'bow' : 'dagger', ...p, hp: 80 });
    }
    this.elder = spawn({
      faction: 'elf', role: 'elder', name: 'Старейшина леса', weapon: 'dagger',
      x: BASES.elf.x + 14, z: BASES.elf.z + 10, hp: 160, cloth: 0x2c5a45,
    });

    // Гвардия дворца.
    for (let i = 0; i < 18; i++) {
      const p = around(BASES.guard, i < 12 ? 80 : 200);
      spawn({ faction: 'guard', role: i % 4 === 0 ? 'archer' : 'grunt', weapon: i % 4 === 0 ? 'crossbow' : 'sword', ...p, hp: 95 });
    }
    this.commander = spawn({
      faction: 'guard', role: 'commander', name: 'Командир дворцовой стражи', weapon: 'sword',
      x: 600 - 22, z: -600, hp: 220, cloth: 0x24406e,
    });

    // Слуги Злого…
    for (let i = 0; i < 15; i++) {
      const p = around(BASES.villain, i < 10 ? 70 : 180);
      spawn({ faction: 'villain', role: i % 4 === 0 ? 'archer' : 'grunt', weapon: i % 4 === 0 ? 'darkstaff' : 'axe', ...p, hp: 95 });
    }
    this.warlord = spawn({
      faction: 'villain', role: 'commander', name: 'Тёмный воевода', weapon: 'axe',
      x: BASES.villain.x - 14, z: BASES.villain.z + 8, hp: 240, cloth: 0x1f1a20,
    });

    // Люди — нейтралы.
    for (let i = 0; i < 12; i++) {
      const p = around(BASES.human, 90);
      spawn({ faction: 'human', role: 'peasant', weapon: 'dagger', ...p, hp: 50, gold: randInt(5, 30) });
    }
    for (const [dx, dz, nm] of [[-26, 46, 'Оружейник'], [26, 46, 'Лекарь-протезист'], [0, 64, 'Торговец']]) {
      spawn({
        faction: 'human', role: 'merchant', name: nm, x: BASES.human.x + dx, z: BASES.human.z + dz,
        hp: 70, cloth: 0x7a6242,
      });
    }
  }

  _buildViewmodel() {
    if (this.vm) this.camera.remove(this.vm);
    const vm = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9b38c });
    const metal = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });

    const hand = (sx, isProsth) => {
      const g = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.1), isProsth ? metal : skin);
      arm.position.set(0, -0.22, 0);
      g.add(arm);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.12), isProsth ? metal : skin);
      fist.position.set(0, -0.46, 0);
      g.add(fist);
      g.position.set(sx * 0.3, -0.42, -0.95);
      g.rotation.x = -0.38;
      return g;
    };
    this.vmRight = hand(1, this.player.parts.armR === 'prosthetic');
    this.vmLeft = hand(-1, this.player.parts.armL === 'prosthetic');
    this.vmWeapon = null;
    vm.add(this.vmRight, this.vmLeft);

    // Коляска — если ног нет, но есть на чём котаться.
    const chair = new THREE.Group();
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 16), metal);
      wheel.position.set(sx * 0.44, -0.62, -0.3);
      chair.add(wheel);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    seat.position.set(0, -0.8, -0.35);
    chair.add(seat);
    chair.visible = false;
    this.vmChair = chair;
    vm.add(chair);

    this.camera.add(vm);
    this.scene.add(this.camera);
    this.vm = vm;
    this._syncViewmodel();
  }

  _syncViewmodel() {
    const p = this.player;
    this.vmRight.visible = p.parts.armR !== 'lost';
    this.vmLeft.visible = p.parts.armL !== 'lost';
    if (this.vmWeapon && this.vmWeapon.parent) this.vmWeapon.parent.remove(this.vmWeapon);
    this.vmWeapon = null;
    if (p.weaponData !== ITEMS.fists) {
      const holder = p.parts.armR !== 'lost' ? this.vmRight : this.vmLeft;
      const w = weaponMesh(p.weapon);
      const ranged = ITEMS[p.weapon]?.kind === 'ranged';
      if (ranged) {
        // Лук и арбалет держим слева, чтобы не закрывали прицел.
        w.rotation.set(0.12, 0.35, 0.16);
        w.position.set(-0.58, -0.3, -0.2);   // рука смещена вправо, компенсируем
        w.scale.setScalar(0.6);
      } else {
        w.rotation.set(-0.62, 0.45, 0.62);
        w.position.set(0.1, -0.3, 0);
        w.scale.setScalar(0.62);
      }
      holder.add(w);
      this.vmWeapon = w;
    }
    this.vmChair.visible = p.mobility === 'wheelchair';
  }

  // ==================== УПРАВЛЕНИЕ ====================
  _initInput() {
    const keyMap = {
      KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
    };
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (keyMap[e.code]) this.input[keyMap[e.code]] = true;
      if (e.repeat) return;
      this._onKey(e.code);
    });
    addEventListener('keyup', (e) => { if (keyMap[e.code]) this.input[keyMap[e.code]] = false; });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement !== this.canvas) { this.canvas.requestPointerLock(); return; }
      if (e.button === 0) this.input.attack = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.input.attack = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas || !this.player) return;
      const s = 0.0022;
      this.player.yaw -= e.movementX * s;
      this.player.pitch = clamp(this.player.pitch - e.movementY * s, -1.45, 1.45);
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.state === 'playing') this.pause();
    });

    // Меню.
    let picked = null;
    for (const card of document.querySelectorAll('.fcard')) {
      card.addEventListener('click', () => {
        for (const c of document.querySelectorAll('.fcard')) c.classList.remove('sel');
        card.classList.add('sel');
        picked = card.dataset.faction;
        document.getElementById('btnStart').disabled = false;
        sfx('ui');
      });
    }
    document.getElementById('btnStart').addEventListener('click', () => {
      initAudio(); resumeAudio();
      if (picked) this.newGame(picked);
    });
    document.getElementById('btnContinue').addEventListener('click', () => {
      initAudio(); resumeAudio();
      if (!this.loadFromSave()) this.ui.log('Сохранение не читается.', 'bad');
    });
    document.getElementById('btnResume').addEventListener('click', () => this.enterPlaying());
    document.getElementById('btnSave').addEventListener('click', () => this.doSave());
    document.getElementById('btnLoad').addEventListener('click', () => this.loadFromSave());
    document.getElementById('btnQuit').addEventListener('click', () => {
      this.state = 'menu';
      document.exitPointerLock?.();
      this.ui.show('menu');
    });
    document.getElementById('btnRespawn').addEventListener('click', () => this.respawn());
    document.getElementById('btnLoadDeath').addEventListener('click', () => {
      if (!this.loadFromSave()) this.respawn();
    });
  }

  _onKey(code) {
    if (code === 'Escape') {
      if (this.state === 'playing') this.pause();
      else if (['shop', 'inv', 'dialog', 'map', 'paused'].includes(this.state)) this.closeOverlay();
      return;
    }
    if (this.state === 'shop' || this.state === 'dialog') return;
    if (code === 'KeyI') {
      if (this.state === 'inv') this.closeOverlay();
      else if (this.state === 'playing') { this.state = 'inv'; document.exitPointerLock?.(); this.ui.openInventory(); }
      return;
    }
    if (code === 'KeyM') {
      if (this.state === 'map') this.closeOverlay();
      else if (this.state === 'playing') { this.state = 'map'; document.exitPointerLock?.(); this.ui.openMap(); }
      return;
    }
    if (this.state !== 'playing') return;

    switch (code) {
      case 'KeyE': this.interact(); break;
      case 'KeyR': this.ui.log(this.player.bandage(), 'good'); this.ui.updateHud(); break;
      case 'KeyQ': this.ui.log(this.player.drink(), 'good'); break;
      case 'KeyF': this.squadCommand(); break;
      case 'KeyT': this.grandAssault(); break;
      case 'Digit1': this.equipBest('melee'); break;
      case 'Digit2': this.equipBest('ranged'); break;
      default: break;
    }
  }

  equipBest(kind) {
    const owned = Object.keys(this.player.inv).filter((id) => ITEMS[id]?.cat === 'weapon' && ITEMS[id].kind === kind);
    if (!owned.length) { this.ui.log('Такого оружия нет.', 'warn'); return; }
    owned.sort((a, b) => ITEMS[b].dmg - ITEMS[a].dmg);
    this.equip(owned[0]);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.exitPointerLock?.();
    this.ui.refreshSaveInfo();
    this.ui.show('pause');
  }

  enterPlaying() {
    this.state = 'playing';
    this.ui.show(null);
    this.canvas.requestPointerLock?.();
    resumeAudio();
  }

  closeOverlay() {
    if (this.state === 'dead') return;
    this.enterPlaying();
  }

  // ==================== ВЗАИМОДЕЙСТВИЕ ====================
  _nearestInteractable() {
    const p = this.player;
    let best = null, bestD = 4.2;

    for (const it of this.interactables) {
      const d = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
      if (d < (it.r || 4) && d < bestD + 2) {
        best = { kind: it.type, data: it, d, label: it.type === 'bed' ? `${it.name}: отдохнуть и сохранится` : `${it.name}: торговать` };
        bestD = d;
      }
    }
    for (const c of this.caravans) {
      if (c.dead) continue;
      for (const w of c.wagons) {
        const d = Math.hypot(w.mesh.position.x - p.pos.x, w.mesh.position.z - p.pos.z);
        if (d < 4.5 && d < bestD) {
          best = { kind: 'caravan', data: c, d, label: c.looted ? 'Корован уже обчищен' : 'Ограбить корован' };
          bestD = d;
        }
      }
    }
    for (const a of this.actors) {
      const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
      if (d > 3.4 || d > bestD) continue;
      if (a.dead) {
        if (a.looted) continue;
        best = { kind: 'corpse', data: a, d, label: `Обыскать: ${a.name}` };
        bestD = d;
      } else if (['commander', 'elder', 'merchant'].includes(a.role) && !a.hostileTo(p.faction)) {
        best = { kind: 'talk', data: a, d, label: `Поговорить: ${a.name}` };
        bestD = d;
      }
    }
    // Костёр у своей базы — вербовать.
    const base = BASES[p.faction];
    if (base) {
      const d = Math.hypot(base.x - p.pos.x, base.z - p.pos.z);
      if (d < 34 && !best) best = { kind: 'recruit', d, label: 'F — нанять бойца в отряд (60 золотых)' };
    }
    return best;
  }

  interact() {
    const it = this._nearestInteractable();
    if (!it) return;
    const p = this.player;
    if (it.kind === 'shop') {
      this.state = 'shop';
      document.exitPointerLock?.();
      this.ui.openShop(it.data.shop, it.data.name);
      sfx('ui');
    } else if (it.kind === 'bed') {
      p.hp = Math.min(p.maxHp, p.hp + 45);
      if (p.bleed > 0 && p.count('bandage')) this.ui.log(p.bandage(), 'good');
      this.doSave();
      this.ui.log('Вы отдохнули на постоялом дворе.', 'good');
      this._advanceWorld(60);
    } else if (it.kind === 'caravan') {
      const res = it.data.loot(p);
      if (res) {
        sfx('gold');
        this.ui.log(`Корован ограблен! +${res.gold} золотых и товар.`, 'gold');
        this._questEvent('rob');
        // Охрана, конечно, обидится.
        for (const g of it.data.guards) if (!g.dead) { g.angry.add(p.faction); g.peaceful = false; }
        if (p.faction === 'guard') {
          this.ui.log('Командир такого не простит…', 'bad');
          this._makeEveryoneAngry('guard');
        }
      } else this.ui.log('Тут уже пусто.', 'warn');
    } else if (it.kind === 'corpse') {
      const a = it.data;
      a.looted = true;
      p.gold += a.gold;
      let txt = `Обыскали ${a.name}: +${a.gold} золотых`;
      for (const l of a.loot) { p.add(l, 1); txt += `, ${ITEMS[l].name}`; }
      sfx('gold');
      this.ui.log(txt, 'gold');
    } else if (it.kind === 'talk') {
      this.talkTo(it.data);
    }
  }

  talkTo(a) {
    const p = this.player;
    this.state = 'dialog';
    document.exitPointerLock?.();
    const opts = [];
    const close = () => this.closeOverlay();

    if (a.role === 'merchant') {
      const shopId = { 'Оружейник': 'armorer', 'Лекарь-протезист': 'healer', 'Торговец': 'trader' }[a.name] || 'trader';
      opts.push({
        label: 'Показывай товар', fn: () => {
          this.state = 'shop';
          this.ui.openShop(shopId, a.name);
        },
      });
      opts.push({ label: 'Ничего, пойду', fn: close });
      this.ui.openDialog({ name: a.name, text: 'Есть товар. Есть и услуги. Деньги вперёд.', options: opts });
      return;
    }

    const isMyBoss = (a.faction === p.faction);
    if (!isMyBoss) {
      opts.push({ label: 'Уйти', fn: close });
      this.ui.openDialog({ name: a.name, text: `${randomTaunt(a.faction)} Тебе тут не рады.`, options: opts });
      return;
    }

    // Свой командир / старейшина / воевода.
    let text;
    if (!this.quest) {
      const q = makeQuest(p.faction, this.questIndex);
      text = p.faction === 'guard'
        ? 'Слушай приказ, боец.'
        : p.faction === 'elf' ? 'Лес просит помощи.' : 'Ты сам себе командир, но дело есть.';
      opts.push({
        label: `Взять задание: ${q.title}`, desc: q.text,
        fn: () => {
          this.quest = q;
          this.objective = q.title;
          this.ui.log(`Новое задание: ${q.title}. ${q.text}`, 'warn');
          sfx('quest');
          close();
        },
      });
    } else if (this.quest.done) {
      text = 'Справился. Держи награду.';
      opts.push({
        label: `Получить награду: ${this.quest.gold} золотых`,
        fn: () => {
          p.gold += this.quest.gold;
          p.questsDone++;
          p.rank = Math.floor(p.questsDone / 2);
          this.questIndex++;
          this.ui.log(`Задание выполнено! +${this.quest.gold} золотых. Звание: ${rankName(p.faction, p.rank)}.`, 'gold');
          this.quest = null;
          this.objective = 'Возьмите новое задание у начальства.';
          sfx('gold');
          close();
        },
      });
    } else {
      text = `Задание не выполнено: ${this.quest.title} (${this.quest.have}/${this.quest.need}).`;
      opts.push({
        label: 'Отказаться от задания', desc: 'Возьмёте другое',
        fn: () => { this.quest = null; this.questIndex++; this.ui.log('Задание брошено.', 'warn'); close(); },
      });
    }

    opts.push({
      label: 'Дай людей в отряд (60 золотых)',
      desc: this.squad.filter((s) => !s.dead).length >= 8 ? 'Больше не дадут' : 'Пойдут за вами в бой',
      fn: () => { this.recruit(); this.ui.renderInventory?.(); close(); },
    });
    opts.push({ label: 'Всё понял', fn: close });
    this.ui.openDialog({ name: a.name, text, options: opts });
  }

  // ==================== ОТРЯД ====================
  recruit() {
    const p = this.player;
    const alive = this.squad.filter((s) => !s.dead);
    this.squad = alive;
    if (alive.length >= 8) { this.ui.log('Отряд и так полон.', 'warn'); return; }
    if (p.gold < 60) { this.ui.log('Нужно 60 золотых.', 'warn'); return; }
    p.gold -= 60;
    const f = p.faction;
    const weap = f === 'elf' ? 'bow' : f === 'guard' ? 'sword' : 'axe';
    const a = new Actor(this, {
      faction: f, role: 'grunt', weapon: weap, follower: true, hp: 95,
      x: p.pos.x + rand(-4, 4), z: p.pos.z + rand(-4, 4),
    });
    this.actors.push(a);
    this.squad.push(a);
    this.ui.log(`В отряд нанят боец (${this.squad.length}). ${randomTaunt(f)}`, 'good');
    this._questEvent('recruit');
    sfx('ui');
  }

  squadCommand() {
    const p = this.player;
    const base = BASES[p.faction];
    if (base && Math.hypot(base.x - p.pos.x, base.z - p.pos.z) < 34) { this.recruit(); return; }
    const alive = this.squad.filter((s) => !s.dead);
    if (!alive.length) { this.ui.log('Отряда нет. Наймите бойцов у своей базы или у начальства.', 'warn'); return; }
    for (const s of alive) { s.order = null; s.follower = true; }
    this.ui.log('Приказ: «За мной!»', 'good');
    sfx('horn');
  }

  /** Прикажет своим войскам с ним самим напасть — и пойдёт в атаку. */
  grandAssault() {
    const p = this.player;
    const alive = this.squad.filter((s) => !s.dead);
    if (!alive.length) { this.ui.log('Некому приказывать. Сначала соберите отряд (F).', 'warn'); return; }
    const targetKey = p.faction === 'villain' ? 'guard' : p.faction === 'guard' ? 'elf' : 'guard';
    const t = BASES[targetKey];
    for (const s of alive) { s.follower = false; s.order = { type: 'attack', x: t.x, z: t.z }; }
    this.ui.log(`Приказ: «В атаку на ${t.name}!» Отряд пошёл. ${randomTaunt(p.faction)}`, 'gold');
    sfx('horn');
    // Защитники поднимаются по тревоге.
    const defFaction = targetKey === 'guard' ? 'guard' : targetKey;
    for (const a of this.actors) {
      if (a.faction === defFaction && !a.dead) a.angry.add(p.faction);
    }
  }

  _makeEveryoneAngry(faction) {
    for (const a of this.actors) {
      if (a.faction === faction && !a.dead) { a.angry.add(this.player.faction); a.peaceful = false; }
    }
  }

  // ==================== ТОРГОВЛЯ ====================
  buy(id) {
    const p = this.player, it = ITEMS[id];
    if (!it) return;
    if (p.gold < it.price) { this.ui.shopMsg('Не хватает золота.'); return; }
    p.gold -= it.price;
    p.add(id, it.amount || 1);
    this.ui.shopMsg(`Куплено: ${it.name}.`);
    sfx('gold');
    if (it.cat === 'weapon' && !ITEMS[p.weapon]) this.equip(id);
    this.ui.renderShop();
  }

  sell(id) {
    const p = this.player, it = ITEMS[id];
    if (!it || !p.count(id)) return;
    if (p.weapon === id && p.count(id) === 1) { this.ui.shopMsg('Это у вас в руках.'); return; }
    if (p.armor === id && p.count(id) === 1) { this.ui.shopMsg('Это на вас надето.'); return; }
    p.remove(id, 1);
    const price = Math.max(1, Math.floor(it.price / 2));
    p.gold += price;
    this.ui.shopMsg(`Продано за ${price}.`);
    sfx('gold');
    this.ui.renderShop();
  }

  service(sid) {
    const p = this.player, s = SERVICES[sid];
    if (p.gold < s.price) { this.ui.shopMsg('Не хватает золота.'); return; }
    if (sid === 'heal') {
      p.gold -= s.price;
      p.fullHeal();
      this.ui.shopMsg('Лекарь вас заштопал. Кровь остановлена.');
      sfx('quest');
    } else if (sid === 'attach') {
      const lost = ['legL', 'legR', 'armL', 'armR', 'eyeL', 'eyeR'].find((k) => p.parts[k] === 'lost');
      if (!lost) { this.ui.shopMsg('Всё на месте, протез ставить некуда.'); return; }
      const res = p.attachProsthetic(lost);
      if (res.startsWith('Нет предмета')) { this.ui.shopMsg(res); return; }
      p.gold -= s.price;
      this.ui.shopMsg(`${res} (${LIMB_RU[lost]})`);
      this._syncViewmodel();
      sfx('quest');
    }
    this.ui.renderShop();
    this.ui.updateHud();
  }

  equip(id) {
    const p = this.player, it = ITEMS[id];
    if (!it || !p.count(id)) return;
    if (it.cat === 'weapon') { p.weapon = id; this._syncViewmodel(); this.ui.log(`В руках: ${it.name}.`); }
    else if (it.cat === 'armor') { p.armor = id; this.ui.log(`Надето: ${it.name}.`); }
    if (this.state === 'inv') this.ui.renderInventory();
    sfx('ui');
  }

  useItem(id) {
    const p = this.player;
    let msg = '';
    if (id === 'bandage') msg = p.bandage();
    else if (id === 'potion') msg = p.drink();
    this.ui.invMsg(msg);
    this.ui.renderInventory();
    this.ui.updateHud();
  }

  putProsthetic(part) {
    const res = this.player.attachProsthetic(part);
    this.ui.invMsg(res);
    this._syncViewmodel();
    this.ui.renderInventory();
    this.ui.updateHud();
    if (res.startsWith('Поставили')) {
      this.ui.log(`${res} Теперь ${LIMB_RU[part]} — протез.`, 'good');
      sfx('quest');
    }
  }

  fastTravel(key) {
    const p = this.player;
    if (p.gold < 25) { this.ui.mapMsg('Нет 25 золотых на дорогу.'); return; }
    const b = BASES[key];
    p.gold -= 25;
    p.pos.set(b.x - 26, 0, b.z + 28);
    p.pos.y = heightAt(p.pos.x, p.pos.z);
    p.vel.set(0, 0, 0);
    this._advanceWorld(120);
    if (p.bleed > 0) {
      p.hp -= 25;
      this.ui.log('В дороге вы истекали кровью…', 'bad');
    }
    this.forest.update(p.pos, true);
    this.ui.mapMsg(`Вы прибыли: ${b.name}.`);
    this.ui.log(`Дорога закончена: ${b.name}.`, 'good');
    this.ui.renderMap();
    if (p.hp <= 0) this.killPlayer('Вы истекли кровью в дороге.');
  }

  /** Мир живёт, пока игрок отдыхает или едет. */
  _advanceWorld(seconds) {
    this.time += seconds;
    this.caravanT -= seconds * 0.5;
    for (const a of this.actors) if (!a.dead && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + seconds * 0.4);
  }

  // ==================== БОЙ ====================
  get playerAlive() { return this.player && !this.player.dead && this.player.hp > 0; }

  playerAttack() {
    const p = this.player;
    if (p.atkCd > 0) return;
    const w = p.weaponData;
    p.atkCd = (w.rate || 0.6) / clamp(p.armPower + 0.35, 0.5, 1.3);
    p.swing = 0.22;

    if (w.kind === 'ranged') {
      if (w.ammo && !p.count(w.ammo)) {
        this.ui.log(`Кончились: ${ITEMS[w.ammo].name}.`, 'warn');
        return;
      }
      if (w.ammo) p.remove(w.ammo, 1);
      const from = this.camera.getWorldPosition(new THREE.Vector3());
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.spawnProjectile(from, dir, w.speed || 100, w.dmg * p.armPower, p, w.dis || 0.1);
      sfx('shot');
      return;
    }

    sfx('swing');
    const hit = this._meleeTarget(w.reach || 3);
    if (hit) {
      const { actor, part } = hit;
      this.dealDamage(actor, w.dmg * p.armPower * rand(0.85, 1.15), p, w.dis || 0.15, part);
      sfx('hit');
    }
  }

  _meleeTarget(reach) {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this._ray.set(origin, dir);
    this._ray.far = reach;
    const groups = this.actors.filter((a) => !a.dead && a.distTo(this.player.pos) < reach + 3).map((a) => a.group);
    const hits = this._ray.intersectObjects(groups, true);
    if (hits.length) {
      const a = this._actorOf(hits[0].object);
      if (a) {
        const local = hits[0].point.y - a.pos.y;
        const side = hits[0].point.clone().sub(a.pos);
        return { actor: a, part: partFromHeight(local, Math.sin(a.yaw) * side.z - Math.cos(a.yaw) * side.x) };
      }
    }
    // Прощаем неточность: бьём ближайшего в пределах конуса.
    let best = null, bestD = reach + 0.6;
    for (const a of this.actors) {
      if (a.dead) continue;
      const dx = a.pos.x - this.player.pos.x, dz = a.pos.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx / d) * dir.x + (dz / d) * dir.z;
      if (dot < 0.72) continue;
      best = a; bestD = d;
    }
    return best ? { actor: best, part: chance(0.25) ? 'head' : choice(['torso', 'armL', 'armR', 'legL', 'legR']) } : null;
  }

  _actorOf(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.actor) return o.userData.actor;
      o = o.parent;
    }
    return null;
  }

  spawnProjectile(from, dir, speed, dmg, owner, dis) {
    const isDark = owner !== this.player && owner.weapon === 'darkstaff';
    const geo = isDark
      ? new THREE.IcosahedronGeometry(0.24, 0)
      : new THREE.CylinderGeometry(0.035, 0.035, 1.1, 5);
    const mat = new THREE.MeshLambertMaterial({
      color: isDark ? 0x8d2b2b : 0xd8cdae,
      emissive: isDark ? 0x4a0d0d : 0x000000,
    });
    const mesh = new THREE.Mesh(geo, mat);
    if (!isDark) mesh.rotation.x = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.position.copy(from);
    holder.lookAt(from.clone().add(dir));
    this.scene.add(holder);
    this.projectiles.push({
      mesh: holder, pos: from.clone(), dir: dir.clone().normalize(),
      speed, dmg, owner, dis, life: 6,
    });
  }

  dealDamage(target, dmg, attacker, dis = 0, part = null) {
    if (target === this.player || target instanceof Player) {
      this.damagePlayer(dmg, attacker, dis, part);
      return;
    }
    const pt = part || choice(['torso', 'torso', 'head', 'armL', 'armR', 'legL', 'legR']);
    target.hurt(dmg, pt, attacker, dis);
  }

  damagePlayer(dmg, attacker, dis = 0, part = null) {
    const p = this.player;
    if (!this.playerAlive) return;
    const real = dmg * (1 - p.armorValue);
    p.hp -= real;
    p.hurtFlash = 0.45;
    sfx('hurt');

    // Отрубить руку, ногу или выколоть глаз.
    const target = part && part !== 'torso' && part !== 'head' ? part : randomPlayerPart();
    if (target !== 'torso' && p.parts[target] === 'ok') {
      const prob = clamp(dis * (real / 40), 0, 0.85);
      if (chance(prob)) this._playerLosePart(target);
    }
    if (p.hp <= 0) {
      this.killPlayer(attacker ? `Вас убил: ${attacker.name || 'враг'}.` : 'Вы погибли.');
    }
    this.ui.updateHud();
  }

  _playerLosePart(part) {
    const p = this.player;
    if (!p.dismember(part)) return;
    sfx('dismember');
    this._syncViewmodel();
    if (part === 'eyeL' || part === 'eyeR') {
      const other = part === 'eyeL' ? 'eyeR' : 'eyeL';
      if (p.parts[other] === 'lost') {
        this.ui.log('Вам выкололи и второй глаз. Вы ослепли — но живы.', 'bad');
      } else {
        this.ui.log('Вам выкололи глаз! Пол-экрана не видно. Купите стеклянный глаз у лекаря.', 'bad');
      }
    } else if (part.startsWith('arm')) {
      this.ui.log(`Вам отрубили ${LIMB_RU[part]}! Идёт кровь — перевяжитесь (R), иначе умрёте. Протез — у лекаря.`, 'bad');
    } else {
      const both = p.parts.legL === 'lost' && p.parts.legR === 'lost';
      this.ui.log(both
        ? 'Обе ноги отрублены. Теперь либо ползать, либо коляска, либо протезы. И кровь остановите!'
        : `Вам отрубили ${LIMB_RU[part]}! Ковыляете. Кровь остановите (R), а лучше — протез.`, 'bad');
    }
  }

  killPlayer(reason) {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.hp = 0;
    this.state = 'dead';
    document.exitPointerLock?.();
    sfx('die');
    const lost = Object.entries(p.parts).filter(([, v]) => v === 'lost').map(([k]) => LIMB_RU[k]);
    const extra = lost.length ? ` Не залечено: ${lost.join(', ')}.` : '';
    this.ui.showDeath('Вы умерли', `${reason}${extra} Вас подобрали свои — но полкошелька пропало.`);
  }

  respawn() {
    const p = this.player;
    const b = BASES[p.faction] || BASES.human;
    p.dead = false;
    p.hp = p.maxHp * 0.6;
    p.bleed = 0;
    p.gold = Math.floor(p.gold / 2);
    p.pos.set(b.x - 22, 0, b.z + 24);
    p.pos.y = heightAt(p.pos.x, p.pos.z);
    p.vel.set(0, 0, 0);
    this.forest.update(p.pos, true);
    this.ui.log('Вас нашли свои и подлатали. Кровь остановлена, но увечья остались.', 'warn');
    this.enterPlaying();
  }

  onActorDied(actor, headshot) {
    sfx('die');
    const p = this.player;
    const wasMine = actor.faction === p.faction;
    if (actor.target === p || actor.angry.has(p.faction) || isHostile(actor.faction, p.faction)) {
      p.kills++;
    }
    this.ui.log(`${actor.name} убит${headshot ? ' (в голову)' : ''}.`, wasMine ? 'warn' : 'good');
    const nearPalace = Math.hypot(actor.pos.x - BASES.guard.x, actor.pos.z - BASES.guard.z) < 220;
    this._questEvent('kill', { faction: actor.faction, nearPalace });
    const i = this.squad.indexOf(actor);
    if (i >= 0) this.squad.splice(i, 1);
  }

  onCaravanArrived(c) {
    if (!c.looted) {
      this.ui.log('Корован дошёл до дворца.', this.player.faction === 'guard' ? 'good' : 'warn');
      this._questEvent('caravan_arrived');
    }
  }

  _questEvent(type, data) {
    if (questEvent(this.quest, type, data)) {
      this.ui.log(`Задание выполнено: ${this.quest.title}. Вернитесь к начальству за наградой.`, 'gold');
      sfx('quest');
    }
  }

  nearestCaravan() {
    // Без ограничения по расстоянию: корован должно быть видно в HUD с любого конца карты,
    // иначе игрок за эльфов его просто не находит.
    let best = null, bestD = Infinity;
    for (const c of this.caravans) {
      if (c.dead) continue;
      const d = Math.hypot(c.pos.x - this.player.pos.x, c.pos.z - this.player.pos.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  // ==================== ЭФФЕКТЫ ====================
  spawnBlood(x, y, z, n = 6) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x8e1a12 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), mat);
      m.position.set(x, y, z);
      this.scene.add(m);
      this.debris.push({
        mesh: m, life: 1.2 + Math.random(),
        vel: new THREE.Vector3(rand(-2.5, 2.5), rand(1, 4), rand(-2.5, 2.5)),
        spin: 0,
      });
    }
  }

  /** Отрубленная часть падает на землю и остаётся лежать. */
  spawnLimb(node, worldPos, rotY) {
    node.position.copy(worldPos);
    node.rotation.set(rand(-1, 1), rotY, rand(-1, 1));
    this.scene.add(node);
    this.debris.push({
      mesh: node, life: 26, settle: true,
      vel: new THREE.Vector3(rand(-2, 2), rand(2, 4.5), rand(-2, 2)),
      spin: rand(-6, 6),
    });
    sfx('dismember');
  }

  log(msg, cls) { this.ui.log(msg, cls); }
  sfx(name) { sfx(name); }

  // ==================== МИРОВЫЕ СОБЫТИЯ ====================
  _worldTick(dt) {
    this.time += dt;

    // Корованы выходят в путь. Если на тракте пусто — новый идёт быстро,
    // чтобы грабить всегда было кого.
    this.caravanT -= dt;
    const live = this.caravans.filter((c) => !c.dead);
    this.caravans = live;
    if (!live.length && this.caravanT > 25) this.caravanT = 25;
    if (this.caravanT <= 0 && live.length < 2) {
      this.caravanT = rand(70, 120);
      this.caravans.push(new Caravan(this, chance(0.75) ? 1 : -1));
      this.ui.log('По тракту пошёл корован. Он отмечен в HUD и на карте (M).', 'gold');
      sfx('horn');
    }

    // Пополнение гарнизонов.
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = 22;
      this._refillGarrisons();
    }

    // Случайные набеги: «иногда нападают шпионы или партизаны».
    this.eventT -= dt;
    if (this.eventT <= 0) {
      this.eventT = rand(90, 170);
      this._randomRaid();
    }

    // Уборка старых трупов, чтобы не копились без конца.
    const corpses = this.actors.filter((a) => a.dead);
    if (corpses.length > 26) {
      const far = corpses
        .filter((a) => a.distTo(this.player.pos) > 90)
        .slice(0, corpses.length - 26);
      for (const c of far) {
        c.dispose();
        this.actors.splice(this.actors.indexOf(c), 1);
      }
    }
  }

  _refillGarrisons() {
    const counts = { elf: 0, guard: 0, villain: 0, human: 0 };
    for (const a of this.actors) if (!a.dead) counts[a.faction]++;
    const want = { elf: 17, guard: 19, villain: 16, human: 15 };
    for (const f in want) {
      if (counts[f] >= want[f]) continue;
      const base = BASES[f] || BASES.human;
      const ang = rand(0, Math.PI * 2), d = rand(45, 95);
      const x = base.x + Math.cos(ang) * d, z = base.z + Math.sin(ang) * d;
      if (Math.hypot(x - this.player.pos.x, z - this.player.pos.z) < 55) continue;
      const weap = f === 'elf' ? (chance(0.4) ? 'bow' : 'dagger')
        : f === 'guard' ? (chance(0.3) ? 'crossbow' : 'sword')
          : f === 'villain' ? (chance(0.3) ? 'darkstaff' : 'axe') : 'dagger';
      this.actors.push(new Actor(this, {
        faction: f, role: f === 'human' ? 'peasant' : (chance(0.3) ? 'archer' : 'grunt'),
        weapon: weap, x, z, hp: f === 'human' ? 50 : 90,
      }));
    }
  }

  _randomRaid() {
    const p = this.player;
    if (!this.playerAlive) return;
    const enemies = ['elf', 'guard', 'villain'].filter((f) => isHostile(f, p.faction));
    if (!enemies.length) return;
    const f = choice(enemies);
    const n = randInt(2, 4);
    const ang = rand(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const d = rand(48, 70);
      const x = clamp(p.pos.x + Math.cos(ang + i * 0.2) * d, -960, 960);
      const z = clamp(p.pos.z + Math.sin(ang + i * 0.2) * d, -960, 960);
      const a = new Actor(this, {
        faction: f, role: chance(0.4) ? 'archer' : 'grunt',
        weapon: f === 'elf' ? 'bow' : f === 'guard' ? 'sword' : 'axe',
        x, z, hp: 85,
      });
      a.angry.add(p.faction);
      this.actors.push(a);
    }
    const what = f === 'elf' ? 'партизаны эльфов' : f === 'guard' ? 'солдаты дворца' : 'слуги Злого…';
    this.ui.log(`Набег! Рядом ${what} — ${n} шт.`, 'bad');
    sfx('horn');
  }

  // ==================== ЦИКЛ ====================
  _loop() {
    let prev = performance.now();
    const frame = () => {
      requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (this.state === 'playing') this._update(dt);
      else if (this.player) this._updateCamera(0);
      if (this.renderer) this.renderer.render(this.scene, this.camera);
    };
    frame();
  }

  _update(dt) {
    const p = this.player;
    p.update(dt, this.input, this.world);
    if (p.hp <= 0 && !p.dead) {
      this.killPlayer(p.bleed > 0 ? 'Вас не вылечили — вы истекли кровью.' : 'Вы погибли от ран.');
      return;
    }

    if (this.input.attack) this.playerAttack();

    // Персонажи. Дальние спят, чтобы не жрать кадры.
    for (const a of this.actors) {
      const d = a.distTo(p.pos);
      const near = d < ACTIVE_DIST;
      a.group.visible = d < VIEW_DIST + 40;
      if (near || a.dead) a.update(dt);
    }
    for (const c of this.caravans) c.update(dt);

    this._updateProjectiles(dt);
    this._updateDebris(dt);
    this._worldTick(dt);
    this._updateCamera(dt);

    this.forest.update(this.camera.position);

    // Свет ходит за игроком, чтобы тени были рядом.
    this.sun.position.set(p.pos.x + 60, p.pos.y + 120, p.pos.z + 40);
    this.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.sky.position.set(p.pos.x, 0, p.pos.z);

    // Новая зона — отметка на карте.
    const z = zoneAt(p.pos.x, p.pos.z);
    if (z.id !== this.zone.id) {
      this.zone = z;
      if (z.id !== 'wild' && !p.discovered[z.id]) {
        p.discovered[z.id] = true;
        this.ui.log(`Открыта зона: ${z.name}.`, 'gold');
      }
    }

    const it = this._nearestInteractable();
    this.ui.setPrompt(it ? (it.kind === 'recruit' ? it.label : `<b>E</b> — ${it.label}`) : null);
    this.ui.updateHud();
  }

  _updateCamera(dt) {
    const p = this.player;
    if (!p) return;
    const bobAmt = p.mobility === 'crawl' ? 0.05 : 0.045;
    const bob = Math.sin(p.bob * 2) * bobAmt * (this.input.fwd || this.input.back || this.input.left || this.input.right ? 1 : 0);
    this.camera.position.set(p.pos.x, p.pos.y + p.camHeight + bob, p.pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;
    if (p.mobility === 'crawl') this.camera.rotation.z = 0.12;

    // Замах оружием.
    if (this.vmRight) {
      const s = Math.max(0, p.swing) / 0.22;
      const arm = p.parts.armR !== 'lost' ? this.vmRight : this.vmLeft;
      if (arm) arm.rotation.x = -0.38 - Math.sin(s * Math.PI) * 1.2;
      const idle = Math.sin(p.bob * 2) * 0.022;
      this.vmRight.position.y = -0.42 + idle;
      this.vmLeft.position.y = -0.42 - idle;
    }
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      const step = pr.speed * dt;
      pr.pos.addScaledVector(pr.dir, step);
      pr.dir.y -= 0.55 * dt;          // лёгкая баллистика
      pr.dir.normalize();
      pr.mesh.position.copy(pr.pos);
      pr.mesh.lookAt(pr.pos.clone().add(pr.dir));

      let hit = false;
      // По игроку.
      if (pr.owner !== this.player && this.playerAlive) {
        const p = this.player;
        const dx = pr.pos.x - p.pos.x, dz = pr.pos.z - p.pos.z;
        const dy = pr.pos.y - (p.pos.y + p.camHeight * 0.55);
        if (Math.hypot(dx, dz) < 0.6 && Math.abs(dy) < p.camHeight) {
          const part = pr.pos.y - p.pos.y > 1.5 ? (chance(0.3) ? (chance(0.5) ? 'eyeL' : 'eyeR') : 'torso') : null;
          this.damagePlayer(pr.dmg, pr.owner, pr.dis, part);
          hit = true;
        }
      }
      // По персонажам.
      if (!hit) {
        for (const a of this.actors) {
          if (a.dead || a === pr.owner) continue;
          if (pr.owner !== this.player && a.faction === pr.owner.faction) continue;
          const dx = pr.pos.x - a.pos.x, dz = pr.pos.z - a.pos.z;
          const dy = pr.pos.y - a.pos.y;
          if (Math.hypot(dx, dz) < 0.65 && dy > 0 && dy < 1.95) {
            a.hurt(pr.dmg, partFromHeight(dy, dx), pr.owner === this.player ? this.player : pr.owner, pr.dis);
            hit = true;
            break;
          }
        }
      }
      if (!hit && pr.pos.y <= heightAt(pr.pos.x, pr.pos.z)) hit = true;
      if (hit || pr.life <= 0) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (!d.grounded) {
        d.vel.y -= 18 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.spin) d.mesh.rotation.x += d.spin * dt;
        const g = heightAt(d.mesh.position.x, d.mesh.position.z);
        if (d.mesh.position.y <= g + 0.08) {
          d.mesh.position.y = g + 0.08;
          d.grounded = true;
          if (!d.settle) d.life = Math.min(d.life, 0.8);
        }
      }
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
      }
    }
  }
}
