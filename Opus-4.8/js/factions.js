// Логика трёх играбельных фракций из ТЗ:
//   эльфы — грабят корованы и отбивают набеги на лес;
//   охрана — слушается командира (приказы-набеги) и защищает дворец;
//   злодей — сам себе командир: по команде F ведёт войско на штурм дворца.
// Здесь же — заселение мира, маркер цели и периодические набеги.
import * as THREE from 'three';
import { ZONES } from './world.js';
import { sideOfFaction } from './npc.js';

const RAID_INTERVAL = 55;

export class Factions {
  constructor(world, npc, player, ui) {
    this.world = world; this.npc = npc; this.player = player; this.ui = ui;
    this.L = world.landmarks;
    this.robbed = 0;
    this.killCounts = { soldier: 0, elf: 0, villain: 0, human: 0 };
    this.orderIndex = 0;
    this.orderBaseline = 0;
    this.objective = { text: '—', target: null };
    this.raidTimer = 20; this.raidActive = false;
    this.assault = false;
    this.followTimer = 0;
    this.commander = null; this.boss = null;

    // маркер цели
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
    ring.position.y = 30;
    this.beacon = new THREE.Group(); this.beacon.add(ring);
    this.beacon.visible = false;
    npc.scene.add(this.beacon);

    npc.onKill = (n, side) => this._onKill(n, side);
    npc.onCorovanRobbed = (cor, side) => this._onRobbed(cor, side);
  }

  homePoint() {
    const f = this.player.faction;
    if (f === 'elf') return ZONES.elf;
    if (f === 'guard') return ZONES.palace;
    return ZONES.villain;
  }

  // ---------- заселение мира ----------
  populate() {
    const N = this.npc, L = this.L;
    // дворец
    this.commander = N.spawn('soldier', 'commander', L.palaceYard.x - 4, L.palaceYard.z);
    N.spawnGroup('soldier', 'soldier', ZONES.palace.x, ZONES.palace.z + 40, 6, 24);
    // эльфы
    N.spawnGroup('elf', 'elf', ZONES.elf.x, ZONES.elf.z, 6, 40);
    // злодей и прихвостни
    this.boss = N.spawn('villain', 'villain', ZONES.villain.x, ZONES.villain.z + 18,
      { hp: 200, dmg: 20, spd: 4.2 });
    this.boss.mesh.scale.setScalar(1.3);
    N.spawnGroup('villain', 'villain', ZONES.villain.x, ZONES.villain.z + 24, 6, 26);
    // нейтралы-люди на рынке
    N.spawnGroup('human', 'human', ZONES.human.x, ZONES.human.z, 4, 28);
    N.spawn('human', 'human', L.shop.x, L.shop.z + 1); // «торговец» у лавки
    // корованы
    N.spawnCorovan(this.world.routes[0], 140);
    N.spawnCorovan(this.world.routes[1], 110);
    N.spawnCorovan(this.world.routes[2], 160);
  }

  start(faction) {
    this.player.faction = faction;
    this._initObjective();
  }

  _initObjective() {
    const f = this.player.faction;
    if (f === 'elf') {
      this._setObjective('Грабь корованы! (ограблено 0/3). Бей повозку ЛКМ.', this._nearestCorovan());
    } else if (f === 'guard') {
      this.orderIndex = 0; this._startOrder();
    } else {
      this._setObjective('Ты — злодей. Подними войско и нажми F, чтобы вести штурм дворца.', null);
    }
  }

  _setObjective(text, target) {
    this.objective = { text, target };
    this.ui.setObjective(text);
    if (target) { this.beacon.visible = true; this.beacon.position.set(target.x, 0, target.z); }
    else this.beacon.visible = false;
    this.ui.setCompassTarget(target || null);
  }

  // ---------- приказы командира (охрана) ----------
  _orders() {
    const L = this.L;
    return [
      { text: 'Приказ командира: патрулируй ворота дворца.', target: L.palaceGate, kind: 'goto', r: 12 },
      { text: 'Приказ: набег на лес эльфов — перебей 4 партизан.', target: ZONES.elf, kind: 'kill', side: 'elf', n: 4 },
      { text: 'Приказ: вылазка к форту злодея — перебей 4 прихвостня.', target: ZONES.villain, kind: 'kill', side: 'villain', n: 4 },
      { text: 'Приказ: вернись во двор дворца на смотр.', target: L.palaceYard, kind: 'goto', r: 10 },
    ];
  }
  _startOrder() {
    const o = this._orders()[this.orderIndex % 4];
    this._order = o;
    if (o.kind === 'kill') this.orderBaseline = this.killCounts[o.side];
    this._setObjective(o.text, o.target);
  }
  _checkOrder() {
    const o = this._order; if (!o) return;
    const p = this.player.pos;
    if (o.kind === 'goto') {
      if (Math.hypot(p.x - o.target.x, p.z - o.target.z) < o.r) this._orderDone();
    } else if (o.kind === 'kill') {
      if (this.killCounts[o.side] - this.orderBaseline >= o.n) this._orderDone();
    }
  }
  _orderDone() {
    this.player.gold += 70;
    this.ui.log('🎖 Приказ выполнен! Командир доволен. +70 золота.', 'good');
    this.orderIndex++; this._startOrder();
  }

  // ---------- команда F ----------
  command() {
    const f = this.player.faction;
    if (f === 'villain') {
      this.assault = true;
      this.npc.rally = new THREE.Vector2(this.L.palaceGate.x, this.L.palaceGate.z);
      this._setObjective('⚔ ШТУРМ! Веди войско злодея на дворец и перебей охрану!', ZONES.palace);
      this.ui.log('💀 «Войска! На дворец! Сожжём всё дотла!»', 'bad');
    } else {
      this.followTimer = 22;
      this.ui.log('📣 «За мной!» — союзники следуют за тобой.', 'good');
    }
  }

  // ---------- набеги ----------
  _spawnRaid() {
    const f = this.player.faction, N = this.npc;
    this.raidActive = true;
    const home = this.homePoint();
    const edge = { x: home.x + (Math.random() - 0.5) * 30, z: home.z + home.r * 0.85 };
    let raiders = [];
    if (f === 'elf') {
      raiders = raiders.concat(N.spawnGroup('soldier', 'soldier', edge.x, edge.z, 3, 12));
      raiders = raiders.concat(N.spawnGroup('villain', 'villain', edge.x + 20, edge.z, 2, 10));
      this.ui.log('⚔ На лес набигают солдаты дворца и злодей! Защити домики!', 'bad');
    } else if (f === 'guard') {
      raiders = raiders.concat(N.spawnGroup('elf', 'elf', edge.x, edge.z, 3, 12));
      raiders = raiders.concat(N.spawnGroup('villain', 'villain', edge.x + 18, edge.z, 2, 10));
      this.ui.log('⚔ Шпионы и партизаны-эльфы атакуют дворец! К оружию!', 'bad');
    } else {
      raiders = raiders.concat(N.spawnGroup('elf', 'elf', edge.x, edge.z, 4, 14));
      this.ui.log('⚔ Партизаны-эльфы пробрались в форт! Перебей их!', 'bad');
    }
    // набигающие идут в центр зоны — там их встретят защитники и игрок
    for (const r of raiders) { r.home.set(home.x, home.z); r.aggro = Math.max(r.aggro, 44); }
  }

  // ---------- колбэки ----------
  _onKill(n, side) {
    if (side === sideOfFaction(this.player.faction)) {
      this.killCounts[n.side] = (this.killCounts[n.side] || 0) + 1;
      const bounty = n.type === 'commander' ? 80 : n.type === 'human' ? 4 : 12;
      this.player.gold += bounty;
    }
  }
  _onRobbed(cor, side) {
    if (side === sideOfFaction(this.player.faction)) {
      this.player.gold += cor.gold;
      this.robbed++;
      this.ui.log(`💰 КОРОВАН ОГРАБЛЕН! +${cor.gold} золота. Награблено корованов: ${this.robbed}.`, 'good');
    }
  }

  // ---------- тик ----------
  update(dt) {
    if (!this.player.alive) return;

    // «за мной» — союзники к игроку
    if (this.followTimer > 0) {
      this.followTimer -= dt;
      this.npc.rally = new THREE.Vector2(this.player.pos.x, this.player.pos.z);
      if (this.followTimer <= 0 && !this.assault) this.npc.rally = null;
    }

    // набеги по таймеру
    this.raidTimer -= dt;
    if (this.raidTimer <= 0 && !this.raidActive) { this._spawnRaid(); this.raidTimer = RAID_INTERVAL; }

    const home = this.homePoint();
    if (this.raidActive) {
      const left = this.npc.enemiesNear(home.x, home.z, home.r + 30);
      this._setObjective(`⚔ ОТБЕЙ НАБЕГ на ${home.name}! Врагов рядом: ${left}.`, home);
      if (left === 0) {
        this.raidActive = false;
        this.player.gold += 50;
        this.ui.log('🛡 Набег отбит! Тишина… пока что. +50 золота.', 'good');
        this._restoreObjective();
      }
      this.ui.setCompassTarget(home);
      return;
    }

    // обычные цели по фракциям
    const f = this.player.faction;
    if (f === 'elf') {
      const cor = this._nearestCorovan();
      this._setObjective(`Грабь корованы! (ограблено ${this.robbed}/3). ${this.robbed >= 3 ? 'Лес гордится тобой — партизань дальше!' : 'Бей повозку ЛКМ.'}`, cor);
    } else if (f === 'guard') {
      this._checkOrder();
    } else if (f === 'villain') {
      if (this.assault) {
        const left = this.npc.enemiesNear(ZONES.palace.x, ZONES.palace.z, 90);
        const near = Math.hypot(this.player.pos.x - ZONES.palace.x, this.player.pos.z - ZONES.palace.z) < 70;
        this._setObjective(`⚔ ШТУРМ ДВОРЦА! Охраны осталось рядом: ${left}.`, ZONES.palace);
        if (near && left <= 1) {
          this.assault = false; this.npc.rally = null;
          this.player.gold += 300;
          this.ui.log('👑 ДВОРЕЦ ВЗЯТ! Император повержен. Злодей торжествует! +300 золота.', 'good');
          this._setObjective('Дворец пал. Можешь грабить корованы или искать новых врагов.', null);
        }
      }
    }
  }

  _restoreObjective() {
    const f = this.player.faction;
    if (f === 'guard') this._startOrder();
    else if (f === 'villain' && this.assault)
      this._setObjective('⚔ Продолжай штурм дворца!', ZONES.palace);
    else this._initObjective();
  }

  _nearestCorovan() {
    let best = null, bd = Infinity;
    for (const c of this.npc.corovans) {
      if (c.looted) continue;
      const d = Math.hypot(c.pos.x - this.player.pos.x, c.pos.y - this.player.pos.z);
      if (d < bd) { bd = d; best = { x: c.pos.x, z: c.pos.y, name: 'корован' }; }
    }
    return best;
  }

  serialize() {
    return { robbed: this.robbed, killCounts: this.killCounts, orderIndex: this.orderIndex,
      assault: this.assault };
  }
  deserialize(s) {
    this.robbed = s.robbed || 0;
    this.killCounts = s.killCounts || this.killCounts;
    this.orderIndex = s.orderIndex || 0;
    this.assault = s.assault || false;
    this._initObjective();
  }
}
