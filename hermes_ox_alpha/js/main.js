// ДЖВА ГОДА — главный модуль: игра, ввод, сценарии фракций, сохранения.
import * as THREE from 'three';
import {
  WORLD, ZONES, POI, VILLAGE, GROVE, PALACE, FORT,
  zoneAt, terrainHeight, buildWorld, updateWorld, collide,
  shops, landmarks, roadDist, riverX,
} from './world.js';
import { buildForest } from './forest.js';
import {
  Actor, ArrowSystem, Caravan, makeHumanoid, attachWeapon, animateParts,
} from './actors.js';
import { Player, LIMBS } from './player.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1600);
    this.scene.add(this.camera);

    buildWorld(this.scene);
    this.worldHalf = WORLD.HALF;
    this.forest = buildForest(this.scene);
    this.arrows = new ArrowSystem(this.scene);

    this.player = new Player(this);
    this.ui = new UI(this);
    this.scene.add(this.player.viewGroup);   // рука в мировых координатах

    // состояние
    this.actors = [];
    this.corpses = [];
    this.caravans = [];
    this.squad = [];
    this.squadOrder = 'follow';
    this.questText = '';
    this.canRecruit = false;
    this.godmode = false;
    this.paused = true;
    this.inGame = false;
    this.timeOfDay = 9 * 60; // минуты с полуночи
    this.discovered = { 0: true, 1: false, 2: false, 3: false };
    this.keys = {};
    this.openScreen = null;

    this.bindInput();
    this.ui.mapFastTravel = false;
    this.showMenu();
    this.animate = this.animate.bind(this);
    this.lastT = performance.now();
    requestAnimationFrame(this.animate);
  }

  // ---------- меню и старт ----------
  showMenu() {
    this.inGame = false;
    this.paused = true;
    this.ui.show('menu', true);
    this.ui.show('hud', false);
    this.ui.showMenu([
      { id: 'elf', title: '🧝 ЛЕСНЫЕ ЭЛЬФЫ', desc: 'Густой родной лес, лук и стрелы. Отбивайте набеги солдат и злодеев, грабьте корованы на тракте.',
        onClick: () => this.startGame('elf') },
      { id: 'human', title: '🛡 ОХРАНА ДВОРЦА', desc: 'Служите командиру гарнизона: защита дворца от шпионов и партизан, вылазки и набеги по приказу.',
        onClick: () => this.startGame('human') },
      { id: 'villain', title: '😈 ЗЛОЙ (Варгхаст)', desc: 'Вы сам себе командир: наймите войско, атакуйте кого хотите — хоть сам дворец Императора.',
        onClick: () => this.startGame('villain') },
    ]);
  }

  factionInfo(f) {
    if (f === 'elf') return { base: GROVE, title: 'ЭЛЬФ' };
    if (f === 'human') return { base: PALACE, title: 'ОХРАННИК' };
    return { base: FORT, title: 'ЗЛОЙ' };
  }

  startGame(faction) {
    // очистка прошлой партии
    for (const a of this.actors) if (!a.dead) this.scene.remove(a.parts.group);
    this.actors = [];
    for (const c of this.corpses) this.scene.remove(c.group);
    this.corpses = [];
    for (const s of this.squad) if (!s.dead) this.scene.remove(s.parts.group);
    this.squad = [];
    for (const c of this.caravans) this.scene.remove(c.group);
    this.caravans = [];
    this.squadOrder = 'follow';
    this.canRecruit = false;
    this.timeOfDay = 9 * 60;
    this.gameTime = 0;
    this.discovered = { 0: true, 1: false, 2: false, 3: false };
    this.waveTimer = null;
    this.waveKind = null;
    this.elfWaveT = null;
    this.guardWaveT = null;
    this.villainWaveT = null;
    this.guardStage = 0;
    this.guardTask = null;
    this.storm = null;
    if (this.flyingLimbs) for (const f of this.flyingLimbs) this.scene.remove(f.obj);
    this.flyingLimbs = [];

    const info = this.factionInfo(faction);
    this.player.reset(faction, new THREE.Vector3(info.base.x, terrainHeight(info.base.x, info.base.z), info.base.z));
    // охранник смотрит на двор, злодей — на донжон своего форта, эльф — в чащу
    this.player.yaw = faction === 'human' ? Math.PI : (faction === 'villain' ? Math.PI : 0);

    this.spawnFactionWorld(faction);
    this.setupQuest(faction);

    this.ui.show('menu', false);
    this.ui.show('deathScreen', false);
    this.ui.show('pauseScreen', false);
    this.ui.show('hud', true);
    this.inGame = true;
    this.paused = false;
    this.ui.log(`Вы — ${info.title}. ${this.questText}`, 'good');
    this.ui.banner(this.factionTitle(faction), 3000);
    $('clickToPlay').classList.remove('hidden');
  }

  factionTitle(f) {
    return f === 'elf' ? 'ЛЕСНЫЕ ЭЛЬФЫ' : f === 'human' ? 'ОХРАНА ДВОРЦА' : 'ВОЙСКО ЗЛОГО';
  }

  // ---------- заселение мира ----------
  spawnFactionWorld(faction) {
    // нейтральные жители деревни
    for (let i = 0; i < 4; i++) {
      const a = new Actor(this, 'human', VILLAGE.x + (Math.random() - 0.5) * 60, VILLAGE.z + (Math.random() - 0.5) * 60,
        { weapon: 'sword', name: 'крестьянин', hp: 30, speed: 3.5, agro: 0 });
      a.peaceful = true;
      this.actors.push(a);
    }
    // гарнизон дворца
    for (let i = 0; i < 6; i++) {
      const a = new Actor(this, 'human', (Math.random() - 0.5) * 80, -560 - Math.random() * 60,
        { weapon: 'sword', name: 'стражник', leash: 70 });
      if (faction === 'human') a.playerAllyNPC = true;
      this.actors.push(a);
    }
    const cmdr = new Actor(this, 'human', 0, -590, { weapon: 'sword', name: 'Командир Гарет', hp: 120, commanderFlag: true });
    this.commander = cmdr;
    this.actors.push(cmdr);
    // эльфы
    for (let i = 0; i < 6; i++) {
      const a = new Actor(this, 'elf', GROVE.x + (Math.random() - 0.5) * 90, GROVE.z + (Math.random() - 0.5) * 90,
        { weapon: 'bow', name: 'лучник-эльф' });
      this.actors.push(a);
    }
    // злодеи в форте
    for (let i = 0; i < 6; i++) {
      const a = new Actor(this, 'villain', FORT.x + (Math.random() - 0.5) * 70, FORT.z + (Math.random() - 0.5) * 70,
        { weapon: Math.random() < 0.3 ? 'bow' : 'club', name: 'приспешник', hp: 70 });
      this.actors.push(a);
    }

    // корованы: путь вдоль тракта через мост (запад → дворец)
    const caravanPath = [
      { x: -930, z: 0 }, { x: -400, z: 0 }, { x: -60, z: 0 }, { x: 300, z: 0 },
      { x: 300, z: 0 }, { x: -60, z: 0 }, { x: -400, z: 0 }, { x: -930, z: 0 },
    ];
    for (let i = 0; i < 2; i++) {
      const c = new Caravan(this.scene, caravanPath);
      c.t = i * 0.45;
      c.place();
      this.caravans.push(c);
      // охрана
      for (let k = 0; k < 2; k++) {
        const g = new Actor(this, 'human', c.pos.x + (Math.random() - 0.5) * 6, c.pos.z + (Math.random() - 0.5) * 6,
          { weapon: 'sword', name: 'охрана корована', leash: 1e9 });
        g.followCaravan = c;
        g.agroRange = 70;
        this.actors.push(g);
      }
    }

    // фракционные особенности
    if (faction === 'human') {
      this.canRecruit = true;
    }
    if (faction === 'villain') {
      // свой командный состав
      this.canRecruit = true;
    }
  }

  setupQuest(faction) {
    if (faction === 'elf') {
      this.questText = 'Отбивайте волны набегов на поляну. Грабьте корованы на тракте [E].';
    } else if (faction === 'human') {
      this.questText = 'Слушайтесь командира Гарета [E]. Защищайте дворец от набегов.';
    } else {
      this.questText = 'Наймите войско у своих приспешников [E] и штурмуйте дворец!';
    }
  }

  // ---------- ввод ----------
  bindInput() {
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.inGame) return;
      this.keys[e.code] = true;
      if (e.code === 'Escape') { this.togglePause(); return; }
      if (this.paused) return;
      if (e.code === 'KeyM') this.toggleScreen('mapScreen', () => { this.ui.mapFastTravel = true; this.ui.drawMap(); });
      if (e.code === 'Tab') this.toggleScreen('invScreen', () => this.ui.openInventory());
      if (e.code === 'F1') this.toggleScreen('controlsScreen');
      if (e.code === 'KeyR') this.switchWeapon();
      if (e.code === 'KeyC') this.toggleSquadOrder();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyB') this.useBandage();
      if (e.code === 'KeyV') { if (this.player.faction === 'villain') this.startStormPalace(); }
      if (e.code === 'F5') { e.preventDefault(); this.saveGame(); }
      if (e.code === 'F9') this.loadGame();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this.canvas.addEventListener('click', () => {
      if (!this.inGame) return;
      if (this.paused) return;
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
        $('clickToPlay').classList.add('hidden');
      }
    });
    document.addEventListener('pointerlockchange', () => {
      // если открыт экран (карта/лавка/инвентарь) — не считаем это паузой
      if (this.inGame && !this.paused && !this.openScreen &&
          document.pointerLockElement !== this.canvas) {
        this.togglePause(true);
      }
      if (document.pointerLockElement === this.canvas) $('clickToPlay').classList.add('hidden');
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.player.yaw -= e.movementX * 0.0023;
      this.player.pitch -= e.movementY * 0.0023;
      this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch));
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.inGame || this.paused || document.pointerLockElement !== this.canvas) return;
      if (e.button === 0) {
        if (this.player.weapon === 'bow') this.player.tryShoot(this.aimPoint());
        else this.player.tryMelee(this.nearbyActors(4));
      }
    });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  toggleScreen(id, before) {
    const el = $(id);
    if (el.classList.contains('hidden')) {
      if (before) before();
      el.classList.remove('hidden');
      this.openScreen = id;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    } else {
      el.classList.add('hidden');
      this.openScreen = null;
    }
  }
  closeScreens() {
    for (const id of ['mapScreen', 'invScreen', 'shopScreen', 'controlsScreen']) $(id).classList.add('hidden');
    this.openScreen = null;
  }

  togglePause(force) {
    const want = force !== undefined ? force : !this.paused;
    if (want === this.paused && !force) return;
    if (want) {
      this.paused = true;
      document.exitPointerLock?.();
      this.closeScreens();
      this.ui.show('pauseScreen', true);
    } else {
      this.paused = false;
      this.ui.show('pauseScreen', false);
      this.closeScreens();
      this.canvas.requestPointerLock();
    }
  }

  toMenu() {
    this.paused = true;
    this.ui.show('pauseScreen', false);
    this.ui.show('deathScreen', false);
    this.ui.show('hud', false);
    this.showMenu();
  }

  aimPoint() {
    // точка на 60м перед камерой
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return this.camera.position.clone().add(dir.multiplyScalar(60));
  }

  // ---------- взаимодействие (E) ----------
  nearbyActors(r) {
    const res = [];
    for (const a of this.actors) {
      if (a.dead) continue;
      if (Math.abs(a.pos.x - this.player.pos.x) < r && Math.abs(a.pos.z - this.player.pos.z) < r) res.push(a);
    }
    return res;
  }

  nearestInteractable() {
    const p = this.player.pos;
    // лавки
    for (const s of shops) {
      if (Math.hypot(s.x - p.x, s.z - p.z) < 3.4) return { type: 'shop', shop: s };
    }
    // трупы
    for (const c of this.corpses) {
      if (c.searched) continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 3.2) return { type: 'corpse', corpse: c };
    }
    // корованы
    for (const cv of this.caravans) {
      if (cv.looted) continue;
      if (Math.hypot(cv.pos.x - p.x, cv.pos.z - p.z) < 6) return { type: 'caravan', caravan: cv };
    }
    // актёры: командир, наём, разговор
    let best = null, bd = 4.2;
    for (const a of this.actors) {
      if (a.dead || a.peaceful && !a.isCommander) continue;
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (best) {
      if (best.isCommander && this.player.faction === 'human') return { type: 'commander', actor: best };
      if (best.isSquad && false) {}
      if (this.player.faction === 'villain' && best.faction === 'villain' && !best.isSquad) return { type: 'recruit', actor: best };
      if (this.player.faction === 'human' && best.faction === 'human' && !best.isSquad && !best.isCommander) return { type: 'recruit', actor: best };
      return { type: 'talk', actor: best };
    }
    return null;
  }

  interact() {
    const it = this.nearestInteractable();
    if (!it) { this.ui.log('Рядом нет ничего интересного.', ''); return; }
    if (it.type === 'shop') {
      this.ui.openShop(it.shop);
      this.openScreen = 'shopScreen';
      document.exitPointerLock?.();
      return;
    }
    if (it.type === 'corpse') { this.searchCorpse(it.corpse); return; }
    if (it.type === 'caravan') { this.lootCaravan(it.caravan); return; }
    if (it.type === 'commander') { this.talkCommander(); return; }
    if (it.type === 'recruit') { this.recruitActor(it.actor); return; }
    if (it.type === 'talk') {
      const a = it.actor;
      const lines = {
        elf: '«Лес шепчет: враги уже близко.»',
        human: a.isCommander ? '«Держать строй!»' : '«Служу Императору!»',
        villain: '«Хозяин, укажи цель — и она будет пеплом.»',
      };
      this.ui.log(a.name + ': ' + (lines[a.faction] || '«...»'), '');
    }
  }

  talkCommander() {
    // цикл приказов командира
    this.guardStage = (this.guardStage || 0) % 3;
    const stages = [
      '«Патрулируй тракт у моста. Шпионы эльфов уже снуют.» (задача: дойти до моста)',
      '«Дозор донёс: готовится набег на деревню! Будь начеку.» (скоро волна)',
      '«Собрать отряд и ударить по логову Злого! [E] у меня — взять солдат.»',
    ];
    this.ui.log('Командир Гарет: ' + stages[this.guardStage], 'good');
    if (this.guardStage === 0) this.guardTask = { type: 'patrol', x: POI.bridge.x, z: POI.bridge.z };
    if (this.guardStage === 1) this.scheduleWave('humanDefense', 20);
    if (this.guardStage === 2) this.canRecruit = true;
    this.guardStage++;
    this.updateQuestFromState();
  }

  recruitActor(a) {
    const cost = 30;
    if (this.player.gold < cost) { this.ui.log(`Наём стоит ${cost} золота.`, 'bad'); return; }
    if (this.squad.length >= 6) { this.ui.log('Больше шести в отряд не взять.', 'bad'); return; }
    this.player.gold -= cost;
    a.isSquad = true;
    a.home = { x: a.pos.x, z: a.pos.z };
    this.squad.push(a);
    this.ui.log(`${a.name || 'Боец'} вступает в ваш отряд! [C] — приказ.`, 'good');
    this.ui.updateHUD();
  }

  toggleSquadOrder() {
    if (!this.squad.length) return;
    this.squadOrder = this.squadOrder === 'follow' ? 'attack' : 'follow';
    this.ui.log(this.squadOrder === 'attack' ? 'Приказ: В АТАКУ!' : 'Приказ: держаться за мной.', 'good');
  }

  lootCaravan(c) {
    c.loot();
    const gold = 40 + Math.floor(Math.random() * 60);
    this.player.gold += gold;
    this.ui.loot(`Корован разграблен: +${gold} золота`);
    this.ui.log('Корован ваш! Золото звенит в кошеле.', 'good');
    // охрана мстит
    for (const a of this.actors) {
      if (a.followCaravan === c && !a.dead) { a.target = 'player'; }
    }
    if (this.player.faction === 'elf') this.elfStats = this.elfStats || { looted: 0 };
    if (this.player.faction === 'elf') this.elfStats.looted++;
  }

  searchCorpse(c) {
    c.searched = true;
    const gold = 5 + Math.floor(Math.random() * 20);
    this.player.gold += gold;
    let msg = `Обыск: +${gold} золота`;
    if (Math.random() < 0.35 && this.player.weapon === 'bow') { this.player.arrows += 4; msg += ', +4 стрелы'; }
    if (Math.random() < 0.25) { this.player.bandages++; msg += ', +1 бинт'; }
    this.ui.loot(msg);
  }

  useBandage() {
    if (this.player.bandages <= 0) { this.ui.log('Бинтов нет. Их продаёт лекарь.', 'bad'); return; }
    if (this.player.bandage()) this.ui.log('Рана перевязана.', 'good');
    else this.ui.log('Нечего перевязывать.', '');
  }

  switchWeapon() {
    const p = this.player;
    if (p.weapon === 'sword' && p.arrows <= 0 && p.faction !== 'elf') {
      this.ui.log('Стрел нет — лук бесполезен.', 'bad');
      return;
    }
    p.weapon = p.weapon === 'sword' ? 'bow' : 'sword';
    p.buildViewModel();
    this.ui.log('Оружие: ' + (p.weapon === 'sword' ? 'меч' : 'лук'), '');
  }

  // ---------- бой игрока и события ----------
  onPlayerDealtDamage() {}

  severEnemyLimb(act, limb) {
    // визуально: часть гуманоида отлетает
    const part = limb === 'arm' ? act.parts.armR : act.parts.legR;
    act.parts.group.remove(part);
    // летящая конечность
    const fly = new THREE.Group();
    fly.add(part);
    fly.position.copy(act.pos).add(new THREE.Vector3(0, limb === 'arm' ? 2.6 : 0.8, 0));
    this.scene.add(fly);
    this.flyingLimbs = this.flyingLimbs || [];
    this.flyingLimbs.push({ obj: fly,
      vx: (Math.random() - 0.5) * 5, vy: 4 + Math.random() * 2, vz: (Math.random() - 0.5) * 5, life: 2.5 });
    act.weaponType = 'club'; // раненый бьёт чем попало
    act.damage(20, 'player');
    this.ui.hitMark();
    this.ui.log('Расчленёнка! Врагу оторвало ' + (limb === 'arm' ? 'руку' : 'ногу') + '!', 'good');
  }

  spawnCorpseFromParts(parts, faction, pos, extra) {
    // труп: лежащий гуманоид + отрубленные части рядом
    const g = new THREE.Group();
    const p = makeHumanoid(faction);
    // поваливаем
    p.group.rotation.x = -Math.PI / 2;
    p.group.rotation.z = (Math.random() - 0.5);
    g.add(p.group);
    g.position.set(pos.x, terrainHeight(pos.x, pos.z) + 0.35, pos.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(g);
    this.corpses.push({ group: g, x: pos.x, z: pos.z, searched: false, t: 0 });
  }

  killPlayer(cause) {
    if (this.player.dead) return;
    this.player.dead = true;
    this.player.hp = 0;
    this.ui.showDeath(cause);
    document.exitPointerLock?.();
  }

  scheduleWave(kind, delay) {
    this.waveTimer = delay;
    this.waveKind = kind;
  }

  // ---------- волны набегов ----------
  updateWaves(dt) {
    if (this.waveTimer != null) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.launchWave(this.waveKind);
        this.waveTimer = null;
      }
    }
    const f = this.player.faction;
    if (f === 'elf') {
      this.elfWaveT = (this.elfWaveT ?? 75) - dt;
      if (this.elfWaveT <= 0) {
        this.elfWaveT = 150 + Math.random() * 60;
        this.launchWave('elfDefense');
      }
    } else if (f === 'human') {
      this.guardWaveT = (this.guardWaveT ?? 110) - dt;
      if (this.guardWaveT <= 0) {
        this.guardWaveT = 170 + Math.random() * 70;
        this.launchWave('humanDefense');
      }
    } else if (f === 'villain') {
      this.villainWaveT = (this.villainWaveT ?? 100) - dt;
      if (this.villainWaveT <= 0) {
        this.villainWaveT = 160 + Math.random() * 80;
        this.launchWave('villainHarass');
      }
    }
  }

  launchWave(kind) {
    const f = this.player.faction;
    if (kind === 'elfDefense') {
      // солдаты и злодеи идут на поляну эльфов
      const n = 4 + Math.min(4, Math.floor(this.gameTime / 120));
      this.ui.banner('⚠ НАБЕГ НА ПОЛЯНУ!');
      for (let i = 0; i < n; i++) {
        const villain = i % 3 === 0;
        const a = new Actor(this, villain ? 'villain' : 'human',
          GROVE.x + (Math.random() - 0.5) * 30, GROVE.z + 320 + Math.random() * 60,
          { weapon: villain ? 'club' : 'sword', name: villain ? 'рейдеры Злого' : 'солдат-набег', leash: 1e9 });
        a.home = { x: GROVE.x, z: GROVE.z };
        a.storming = true;
        this.actors.push(a);
      }
    } else if (kind === 'humanDefense') {
      // шпионы/партизаны эльфов + отряд Злого идут к дворцу
      this.ui.banner('⚠ НА ДВОРЕЦ ИДУТ ВРАГИ!');
      const n = 4 + Math.min(4, Math.floor(this.gameTime / 120));
      for (let i = 0; i < n; i++) {
        const elf = i % 2 === 0;
        const a = new Actor(this, elf ? 'elf' : 'villain',
          (Math.random() - 0.5) * 60, 300 + Math.random() * 100,
          { weapon: elf ? 'bow' : 'club', name: elf ? 'партизан-эльф' : 'шпион Злого', leash: 1e9 });
        a.home = { x: 0, z: -600 };
        a.storming = true;
        this.actors.push(a);
      }
    } else if (kind === 'villainHarass') {
      // партизаны эльфов нападают на форт
      this.ui.banner('⚠ ПАРТИЗАНЫ ЭЛЬФОВ АТАКУЮТ ФОРТ!');
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const a = new Actor(this, 'elf',
          FORT.x + (Math.random() - 0.5) * 40, FORT.z - 260 - Math.random() * 60,
          { weapon: 'bow', name: 'партизан-эльф', leash: 1e9 });
        a.home = { x: FORT.x, z: FORT.z };
        a.storming = true;
        this.actors.push(a);
      }
    }
  }

  // ---------- штурм дворца (за злого) ----------
  startStormPalace() {
    if (this.storm || this.player.faction !== 'villain') return;
    this.storm = { target: { x: 0, z: -600 }, done: false };
    this.ui.banner('⚔ ШТУРМ ДВОРЦА! В АТАКУ!');
    for (const s of this.squad) { s.storming = true; s.home = { x: 0, z: -600 }; s.target = null; }
    // сам Злой тоже штурмует — помечаем врагов-стражей
    this.questText = 'Штурм: ворвитесь во дворец и уничтожьте охрану!';
    this.ui.log('Войско поднято! Вперед, к дворцу!', 'good');
  }

  checkStormResult() {
    if (!this.storm || this.storm.done) return;
    // победа: все стражники в радиусе двора мертвы
    const defenders = this.actors.filter(a =>
      !a.dead && a.faction === 'human' && !a.isSquad && a.pos.z < -480 &&
      Math.abs(a.pos.x) < 90 && !a.peaceful);
    if (defenders.length === 0) {
      this.storm.done = true;
      this.player.gold += 200;
      this.ui.banner('♛ ДВОРЕЦ ВЗЯТ! Вы — новый владыка!', 6000);
      this.ui.log('Дворец пал! +200 золота. Император бежал.', 'good');
      this.questText = 'Дворец взят! Можете грабить корованы или развлекаться.';
    }
  }

  // ---------- магазин ----------
  shopGoods(kind) {
    const p = this.player;
    const G = [];
    if (kind === 'weapons') {
      G.push({ id: 'sword_up', name: 'Хороший меч', price: 80, desc: '+40% урона в ближнем бою', owned: p.swordUp });
      G.push({ id: 'arrows', name: 'Стрелы ×10', price: 15, desc: 'для лука' });
      G.push({ id: 'bandage', name: 'Бинт', price: 10, desc: 'останавливает кровотечение' });
    } else if (kind === 'general') {
      G.push({ id: 'arrows', name: 'Стрелы ×10', price: 15, desc: 'для лука' });
      G.push({ id: 'bandage', name: 'Бинт', price: 10, desc: 'останавливает кровотечение' });
      G.push({ id: 'wheelchair', name: 'Коляска', price: 70, desc: 'катайтесь, пока нет ног', owned: p.hasWheelchair });
      G.push({ id: 'eye_patch', name: 'Стеклянный глаз', price: 50, desc: 'вернёт зрение на пол-экрана', owned: p.limbs.eye === 'prosthesis' || p.limbs.eye === false });
    } else {
      G.push({ id: 'heal', name: 'Лечение', price: 20, desc: 'полное восстановление здоровья' });
      G.push({ id: 'bandage', name: 'Бинт', price: 10, desc: 'останавливает кровотечение' });
      const missing = LIMBS.filter(l => p.limbs[l] === 'lost' || p.limbs[l] === 'bleeding');
      const names = { armL: 'протез левой руки', armR: 'протез правой руки', legL: 'протез левой ноги', legR: 'протез правой ноги', eye: 'стеклянный глаз' };
      for (const l of missing) {
        const price = l === 'eye' ? 60 : 90;
        G.push({ id: 'prosth_' + l, name: names[l], price, desc: 'лекарь поставит прямо сейчас' });
      }
      if (p.limbs.legL === 'lost' && p.limbs.legR === 'lost' && !p.hasWheelchair) {
        G.push({ id: 'wheelchair', name: 'Коляска', price: 70, desc: 'пока не поставлены оба протеза' });
      }
    }
    return G;
  }

  buy(id) {
    const p = this.player;
    const all = [...this.shopGoods('weapons'), ...this.shopGoods('general'), ...this.shopGoods('healer')];
    const g = all.find(x => x.id === id);
    if (!g || p.gold < g.price) return false;
    p.gold -= g.price;
    switch (id) {
      case 'arrows': p.arrows += 10; this.ui.log('Куплено 10 стрел.', 'good'); break;
      case 'bandage': p.bandages++; this.ui.log('Куплен бинт.', 'good'); break;
      case 'sword_up': p.swordUp = true; this.ui.log('Меч заточен! Урон выше.', 'good'); break;
      case 'wheelchair':
        p.hasWheelchair = true;
        this.ui.log('Коляска ваша! Ездите, пока нет ног.', 'good');
        break;
      case 'eye_patch':
        p.limbs.eye = 'prosthesis';
        this.ui.log('Стеклянный глаз вставлен. Зрение вернулось!', 'good');
        break;
      case 'heal':
        p.hp = p.hpMax;
        this.ui.log('Лекарь подлатали раны. Здоровье полное.', 'good');
        break;
      default:
        if (id.startsWith('prosth_')) {
          const limb = id.slice(7);
          p.limbs[limb] = 'prosthesis';
          this.ui.log('Протез установлен! Конечность снова работает.', 'good');
        }
    }
    this.ui.updateHUD();
    return true;
  }

  // ---------- быстрое перемещение ----------
  fastTravel(nx, nz) {
    const x = (nx - 0.5) * 2 * this.worldHalf;
    const z = (nz - 0.5) * 2 * this.worldHalf;
    if (Math.hypot(x, z) > 940) { this.ui.log('Туда не пройти — край мира.', 'bad'); return; }
    const gy = terrainHeight(x, z);
    if (gy < -1) { this.ui.log('Там река. Нужен мост.', 'bad'); return; }
    // нельзя в гущу врагов
    for (const a of this.actors) {
      if (!a.dead && !a.playerAlly() && Math.hypot(a.pos.x - x, a.pos.z - z) < 40) {
        this.ui.log('Слишком опасно — там враги!', 'bad');
        return;
      }
    }
    this.player.pos.set(x, terrainHeight(x, z), z);
    this.player.vel.set(0, 0, 0);
    this.closeScreens();
    this.ui.log('Вы быстро переместились.', 'good');
  }

  // ---------- утилиты ----------
  log(text, cls) { this.ui.log(text, cls); }
  zoneAtPlayer() { return zoneAt(this.player.pos.x, this.player.pos.z); }
  timeString() {
    const h = Math.floor(this.timeOfDay / 60) % 24;
    const m = Math.floor(this.timeOfDay % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  resolveMove(x, z, r) { return collide(x, z, r); }

  saveKey() { return 'korovany_ox_alpha_save'; }

  saveGame() {
    const p = this.player;
    const data = {
      v: 1, faction: p.faction, pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw,
      hp: p.hp, stam: p.stam, gold: p.gold, limbs: p.limbs, arrows: p.arrows,
      bandages: p.bandages, weapon: p.weapon, hasWheelchair: p.hasWheelchair,
      swordUp: p.swordUp, timeOfDay: this.timeOfDay, discovered: this.discovered,
      gameTime: this.gameTime, squadOrder: this.squadOrder,
      squad: this.squad.filter(s => !s.dead).map(s => ({ x: s.pos.x, z: s.pos.z, hp: s.hp, name: s.name, faction: s.faction })),
      quest: this.questText,
    };
    localStorage.setItem(this.saveKey(), JSON.stringify(data));
    this.ui.log('Игра сохранена. (F5 — быстрое сохранение)', 'good');
  }

  loadGame() {
    const raw = localStorage.getItem(this.saveKey());
    if (!raw) { this.ui.log('Сохранений нет.', 'bad'); return false; }
    const d = JSON.parse(raw);
    this.startGame(d.faction);
    const p = this.player;
    p.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    p.yaw = d.yaw;
    p.hp = d.hp; p.stam = d.stam; p.gold = d.gold;
    p.limbs = d.limbs; p.arrows = d.arrows; p.bandages = d.bandages;
    p.weapon = d.weapon; p.hasWheelchair = d.hasWheelchair; p.swordUp = d.swordUp;
    p.buildViewModel();
    this.timeOfDay = d.timeOfDay; this.discovered = d.discovered;
    this.gameTime = d.gameTime || 0;
    this.questText = d.quest || this.questText;
    // отряд
    for (const s of d.squad) {
      const a = new Actor(this, s.faction, s.x, s.z, { weapon: s.faction === 'elf' ? 'bow' : 'sword', name: s.name, squad: true });
      a.hp = s.hp;
      this.squad.push(a);
      this.actors.push(a);
    }
    this.ui.log('Игра загружена.', 'good');
    this.ui.updateHUD();
    return true;
  }

  // ---------- главный цикл ----------
  animate() {
    requestAnimationFrame(this.animate);
    const now = performance.now();
    let dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    if (!this.inGame || this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.gameTime = (this.gameTime || 0) + dt;
    this.timeOfDay += dt * 0.5; // 1 игровая минута = 2 сек

    const p = this.player;
    p.update(dt, this.keys);
    this.forest.update(p.pos.x, p.pos.z);
    updateWorld(dt, p.pos);

    // актёры: обновляем ближних
    const near = this.nearbyActors(160);
    for (const a of near) a.update(dt, near, p);
    this.arrows.update(dt, near, p,
      (dmg, shooter, cause) => p.arrowHit(dmg, shooter ? (shooter.name || 'враг') : 'враг'),
      null);

    // отряд следует за игроком (когда нет боя)
    for (const s of this.squad) {
      if (s.dead) continue;
      s.animT += dt;
      const inCombat = !!s.target;
      if (!inCombat && this.squadOrder === 'follow') {
        const d = Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
        if (d > 5) {
          const dx = (p.pos.x - s.pos.x) / d, dz = (p.pos.z - s.pos.z) / d;
          const step = Math.min(s.speed * dt, d);
          [s.pos.x, s.pos.z] = this.resolveMove(s.pos.x + dx * step, s.pos.z + dz * step, 0.55);
          s.pos.y = terrainHeight(s.pos.x, s.pos.z);
          s.faceDir = Math.atan2(dx, dz);
          s.parts.group.position.copy(s.pos);
          s.parts.group.rotation.y = s.faceDir;
        }
        animateParts(s.parts, s.animT * ((d > 1) ? 7 : 1.5), d > 1, 0);
      } else {
        animateParts(s.parts, s.animT * 1.5, false, 0); // в бою анимирует Actor.update
      }
    }

    // корованы
    for (const c of this.caravans) c.update(dt, now / 1000);

    // летящие конечности
    if (this.flyingLimbs) {
      for (let i = this.flyingLimbs.length - 1; i >= 0; i--) {
        const f = this.flyingLimbs[i];
        f.vy -= 14 * dt;
        f.obj.position.x += f.vx * dt;
        f.obj.position.y += f.vy * dt;
        f.obj.position.z += f.vz * dt;
        f.obj.rotation.x += dt * 7;
        f.life -= dt;
        const gy = terrainHeight(f.obj.position.x, f.obj.position.z);
        if (f.obj.position.y < gy + 0.2) { f.obj.position.y = gy + 0.2; f.vx *= 0.6; f.vz *= 0.6; f.vy = 0; }
        if (f.life <= 0) { this.scene.remove(f.obj); this.flyingLimbs.splice(i, 1); }
      }
    }

    // трупы: стареют и исчезают через 60 сек
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.t += dt;
      if (c.t > 60) { this.scene.remove(c.group); this.corpses.splice(i, 1); }
    }

    this.updateWaves(dt);
    this.checkStormResult();

    // зона/открытие
    const zid = this.zoneAtPlayer();
    this.discovered[zid] = true;
    this.ui.mapFastTravel = Object.values(this.discovered).some(Boolean);

    // HUD
    this.ui.updateHUD();
    // подсказка E
    const it = this.nearestInteractable();
    let hint = '';
    if (it) {
      if (it.type === 'shop') hint = 'E — ' + it.shop.name;
      else if (it.type === 'corpse') hint = 'E — обыскать труп';
      else if (it.type === 'caravan') hint = 'E — грабить корован!';
      else if (it.type === 'commander') hint = 'E — говорить с командиром';
      else if (it.type === 'recruit') hint = 'E — нанять в отряд (30 з.)';
      else if (it.type === 'talk') hint = 'E — говорить: ' + (it.actor.name || 'бойец');
    }
    this.ui.setHint(hint);

    // смерть от падения за границу
    if (p.pos.y < -40) this.killPlayer('Вы сорвались с края мира.');

    this.renderer.render(this.scene, this.camera);
  }
}

// ---------- запуск ----------
const game = new Game();
window.game = game; // для отладки
