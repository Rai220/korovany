// Логика фракций:
//  - эльфы: набигают солдаты дворца и злодеи, можно грабить корованы
//  - охрана: слушаться командира, защищать дворец, ходить в набеги
//  - злодей: сам себе командир, приказывает войскам, штурмует дворец
export class Quests {
  constructor(game) {
    this.g = game;
    this.order = null;
    this.orderIdx = 0;
    this.ordersDone = 0;
    this.lvl = 0;       // уровень набегов на эльфов
    this.plvl = 0;      // уровень партизанских атак
    this.raidT = 55;
    this.partT = 75;
    this.reinfT = 90;
    this.wave = [];     // набег на эльфов (мы — эльф)
    this.pwave = [];    // партизаны на форт (мы — злодей)
    this.owave = [];    // атака на дворец (приказ "оборона")
    this.escorts = [];
    this.spyNpc = null;
    this.commander = null;
    this.assault = false;
  }

  start() { this.populate(); }

  populate() {
    const M = this.g.npcs, F = this.g.faction;
    const r = n => Math.random() * n - n / 2;

    // гарнизон дворца
    if (!this.g.flags.palaceCaptured) {
      const posts = [[160, 195], [160, 205], [212, 192], [212, 208], [200, 170], [200, 230]];
      for (const [x, z] of posts) {
        M.spawn({ faction: 'guard', x, z, order: { type: 'hold', x, z }, homeBase: 'palace' });
      }
      const route = [[160, 165], [240, 165], [240, 235], [160, 235]];
      M.spawn({ faction: 'guard', x: 175, z: 185, order: { type: 'patrol', pts: route, i: 0 }, homeBase: 'palace' });
      M.spawn({ faction: 'guard', x: 175, z: 215, order: { type: 'patrol', pts: route.slice().reverse(), i: 0 }, homeBase: 'palace' });
      this.commander = M.spawn({
        faction: 'guard', kind: 'commander', x: 186, z: 200,
        order: { type: 'hold', x: 186, z: 200 }, homeBase: 'palace',
      });
    }

    // деревня эльфов: защитники и жители
    for (let i = 0; i < 7; i++) {
      M.spawn({ faction: 'elf', x: -200 + r(36), z: -200 + r(36), order: { type: 'wander', x: -200, z: -200, r: 20 } });
    }
    for (let i = 0; i < 2; i++) {
      M.spawn({ faction: 'civilian', kind: 'civilian', x: -200 + r(20), z: -200 + r(20), order: { type: 'wander', x: -200, z: -200, r: 12 } });
    }

    // форт Злодея
    if (F === 'villain') {
      for (let i = 0; i < 5; i++) {
        M.spawn({
          faction: 'villain', playerTroop: true, name: 'Ваш боец',
          x: 216 + r(10), z: -218 + r(10),
          order: { type: 'hold', x: 216 + r(10), z: -218 + r(10) },
        });
      }
    } else {
      for (let i = 0; i < 6; i++) {
        M.spawn({ faction: 'villain', x: 220 + r(16), z: -220 + r(16), order: { type: 'wander', x: 220, z: -220, r: 14 } });
      }
    }

    // деревня людей (нейтрал)
    for (let i = 0; i < 5; i++) {
      M.spawn({ faction: 'civilian', kind: 'civilian', x: -200 + r(40), z: 200 + r(24), order: { type: 'wander', x: -200, z: 200, r: 22 } });
    }

    // корованы
    M.spawnCaravan();
    M.spawnCaravan();
  }

  update(dt) {
    const g = this.g, M = g.npcs, F = g.faction;
    // подкрепления гарнизонов — мир живёт
    this.reinfT -= dt;
    if (this.reinfT <= 0) {
      this.reinfT = 90;
      if (!g.flags.palaceCaptured && M.countAlive('guard') < 8) {
        M.spawn({
          faction: 'guard', x: 165, z: 200, homeBase: 'palace',
          order: { type: 'patrol', pts: [[160, 165], [240, 165], [240, 235], [160, 235]], i: 0 },
        });
      }
      if (M.countAlive('elf') < 7) {
        M.spawn({ faction: 'elf', x: -200 + Math.random() * 16 - 8, z: -200 + Math.random() * 16 - 8, order: { type: 'wander', x: -200, z: -200, r: 20 } });
      }
      if (F !== 'villain' && M.countAlive('villain') < 6) {
        M.spawn({ faction: 'villain', x: 220, z: -220, order: { type: 'wander', x: 220, z: -220, r: 14 } });
      }
    }
    if (F === 'elf') this.updateElf(dt);
    if (F === 'villain') this.updateVillain(dt);
    if (F === 'guard') this.updateGuard(dt);
  }

  // ---------- ЭЛЬФЫ ----------
  updateElf(dt) {
    const g = this.g;
    if (this.wave.length) {
      if (this.wave.every(w => w.dead)) {
        this.wave = [];
        const rew = 40 + this.lvl * 10;
        g.player.gold += rew;
        g.stats.waves++;
        g.ui.banner('НАБЕГ ОТБИТ!');
        g.ui.msg(`Набег отбит! Благодарность леса: +${rew} золота`, 'good');
        g.sfx.fanfare();
        this.raidT = 75 + Math.random() * 45;
      }
    } else {
      this.raidT -= dt;
      if (this.raidT <= 0) {
        this.lvl++;
        const enemy = Math.random() < 0.5 ? 'guard' : 'villain';
        const n = 3 + Math.min(5, this.lvl);
        const sp = enemy === 'guard' ? [-30, -140] : [-30, -285];
        this.wave = g.npcs.spawnSquad(enemy, n, sp[0], sp[1], [[-150, -200], [-200, -200]]);
        g.ui.banner('НАБИГАЮТ!!!', 'red');
        g.ui.msg(enemy === 'guard'
          ? 'Солдаты дворца набигают на лес! Защищайте домики деревянные!'
          : 'Бойцы Злодея (имя не придумано) набигают на лес!', 'bad');
        g.sfx.raid();
      }
    }
  }

  // ---------- ЗЛОДЕЙ ----------
  updateVillain(dt) {
    const g = this.g;
    if (this.pwave.length) {
      if (this.pwave.every(w => w.dead)) {
        this.pwave = [];
        g.player.gold += 30;
        g.stats.waves++;
        g.ui.msg('Атака партизан отбита. +30 золота из их карманов.', 'good');
        this.partT = 80 + Math.random() * 50;
      }
    } else {
      this.partT -= dt;
      if (this.partT <= 0) {
        this.plvl++;
        const n = 2 + Math.min(4, this.plvl);
        this.pwave = g.npcs.spawnSquad('elf', n, 130, -150, [[185, -205], [218, -218]]);
        g.ui.banner('ПАРТИЗАНЫ ЭЛЬФОВ!', 'red');
        g.ui.msg('Шпионы и партизаны эльфов напали на форт!', 'bad');
        g.sfx.raid();
      }
    }
  }

  troopOrder(type) {
    const g = this.g;
    if (g.faction !== 'villain') return;
    const troops = g.npcs.npcs.filter(n => n.playerTroop && !n.dead);
    if (!troops.length) { g.ui.msg('У вас нет бойцов! Наймите у знамени форта (50з).', 'bad'); return; }
    if (type === 'follow') {
      troops.forEach((n, i) => {
        n.order = { type: 'follow', ox: (i % 2 ? 1 : -1) * (1.5 + (i >> 1) * 0.9), oz: 1.6 + (i >> 1) * 1.1 };
      });
      g.ui.msg(`Войско (${troops.length}) следует за вами!`);
    } else if (type === 'hold') {
      this.assault = false;
      troops.forEach((n, i) => {
        n.order = { type: 'hold', x: 220 + Math.cos(i * 1.1) * 7, z: -220 + Math.sin(i * 1.1) * 7 };
      });
      g.ui.msg('Войско возвращается охранять форт.');
    } else if (type === 'assault') {
      this.assault = true;
      troops.forEach(n => {
        n.order = {
          type: 'waypoints',
          pts: [[120, 198 + Math.random() * 6], [152, 198 + Math.random() * 6], [195, 196 + Math.random() * 10]],
          i: 0,
        };
      });
      g.ui.banner('ШТУРМ ДВОРЦА!', 'red');
      g.ui.msg('Вы приказали штурмовать дворец! Ведите войско на юго-восток, к воротам.');
      g.sfx.raid();
    }
    g.sfx.click();
  }

  recruit() {
    const g = this.g;
    if (g.faction !== 'villain') { g.ui.msg('Это знамя Злодея. Вам тут не рады.', 'dim'); return; }
    const cnt = g.npcs.npcs.filter(n => n.playerTroop && !n.dead).length;
    if (cnt >= 12) { g.ui.msg('Армия и так велика (максимум 12 бойцов).', 'dim'); return; }
    if (g.player.gold < 50) { g.ui.msg('Нужно 50 золота. Ограбьте корован!', 'bad'); return; }
    g.player.gold -= 50;
    g.npcs.spawn({
      faction: 'villain', playerTroop: true, name: 'Ваш боец',
      x: 214 + Math.random() * 4 - 2, z: -214 + Math.random() * 4 - 2,
      order: { type: 'hold', x: 214 + Math.random() * 6 - 3, z: -216 + Math.random() * 6 - 3 },
    });
    g.ui.msg(`Боец нанят! В армии: ${cnt + 1}`, 'good');
    g.sfx.coin();
  }

  // ---------- ОХРАНА ДВОРЦА ----------
  updateGuard(dt) {
    void dt;
    const g = this.g, o = this.order;
    if (!o || o.done) return;
    if (o.id === 'patrol') {
      const pp = g.player.pos;
      o.pts.forEach((p, i) => {
        if (!o.visited[i] && Math.hypot(p[0] - pp.x, p[1] - pp.z) < 9) {
          o.visited[i] = true;
          g.ui.msg(`Пост ${o.visited.filter(Boolean).length}/4 проверен.`);
          g.sfx.click();
        }
      });
      if (o.visited.every(Boolean)) {
        o.done = true;
        g.ui.msg('Патруль завершён! Доложите командиру [E].', 'good');
      }
    }
    if (o.id === 'defend' && this.owave.length && this.owave.every(w => w.dead)) {
      o.done = true;
      this.owave = [];
      g.ui.banner('АТАКА ОТБИТА!');
      g.ui.msg('Дворец защищён! Доложите командиру [E].', 'good');
    }
  }

  assignNextOrder() {
    const g = this.g, M = g.npcs;
    const seq = ['patrol', 'defend', 'raidElves', 'spy', 'raidFort'];
    const id = seq[this.orderIdx % seq.length];
    this.orderIdx++;
    const o = { id, done: false };
    if (id === 'patrol') {
      o.text = 'ПРИКАЗ: обойти 4 угловые башни дворца';
      o.pts = [[157, 157], [243, 157], [243, 243], [157, 243]];
      o.visited = [false, false, false, false];
    } else if (id === 'defend') {
      o.text = 'ПРИКАЗ: отбить атаку Злодея на дворец!';
      this.owave = M.spawnSquad('villain', 4 + Math.min(4, this.ordersDone), 20, 200, [[120, 200], [152, 200], [185, 200]]);
      g.ui.banner('ТРЕВОГА! НАБИГАЮТ!', 'red');
      g.sfx.raid();
    } else if (id === 'raidElves') {
      o.text = 'ПРИКАЗ: набег на лес эльфов (северо-запад) — убей 4 партизан';
      o.count = 0;
      this.escorts = [
        M.spawn({ faction: 'guard', x: 174, z: 204, order: { type: 'follow', ox: -1.6, oz: 1.6 }, homeBase: 'palace' }),
        M.spawn({ faction: 'guard', x: 174, z: 196, order: { type: 'follow', ox: 1.6, oz: 1.6 }, homeBase: 'palace' }),
      ];
      g.ui.msg('Вам выделили двух бойцов. Они идут за вами.', 'dim');
    } else if (id === 'spy') {
      o.text = 'ПРИКАЗ: найти и убить шпиона эльфов у стен дворца';
      const a = Math.random() * Math.PI * 2;
      const sx = 200 + Math.cos(a) * 75, sz = 200 + Math.sin(a) * 75;
      this.spyNpc = M.spawn({ faction: 'elf', kind: 'spy', x: sx, z: sz, order: { type: 'wander', x: sx, z: sz, r: 25 } });
    } else if (id === 'raidFort') {
      o.text = 'ПРИКАЗ: вылазка к старому форту (северо-восток, в горах) — убей 3 бойцов Злодея';
      o.count = 0;
      this.escorts = [
        M.spawn({ faction: 'guard', x: 174, z: 204, order: { type: 'follow', ox: -1.6, oz: 1.6 }, homeBase: 'palace' }),
        M.spawn({ faction: 'guard', x: 174, z: 196, order: { type: 'follow', ox: 1.6, oz: 1.6 }, homeBase: 'palace' }),
      ];
    }
    this.order = o;
  }

  commanderTalk() {
    const g = this.g, ui = g.ui;
    if (g.faction !== 'guard') return;
    if (!this.commander || this.commander.dead) { ui.msg('Командир мёртв. Приказов больше не будет.', 'dim'); return; }
    const close = { label: 'Так точно!', fn: () => { ui.closeDialog(); g.resumePlay(); } };
    if (!this.order) {
      this.assignNextOrder();
      ui.openDialog({
        title: 'Командир',
        text: `«Солдат! ${this.order.text.replace('ПРИКАЗ: ', '')}. Выполнять! И чтоб слушаться меня!»`,
        buttons: [close],
      });
    } else if (this.order.done) {
      const pay = 80 + this.ordersDone * 20;
      g.player.gold += pay;
      this.ordersDone++;
      g.stats.orders++;
      for (const e of this.escorts) if (!e.dead) e.order = { type: 'wander', x: 200, z: 200, r: 25 };
      this.escorts = [];
      this.order = null;
      g.sfx.coin();
      ui.openDialog({
        title: 'Командир',
        text: `«Молодец, солдат! Держи жалование: ${pay} золотых. Отдохни и подходи за новым приказом.»`,
        buttons: [{ label: 'Служу Императору!', fn: () => { ui.closeDialog(); g.resumePlay(); } }],
      });
    } else {
      ui.openDialog({
        title: 'Командир',
        text: `«Выполняй приказ, солдат!»\n\n${this.order.text}`,
        buttons: [close],
      });
    }
  }

  // ---------- ТРОН ----------
  thronePalace() {
    const g = this.g;
    if (g.faction === 'guard') {
      if (this.commander && !this.commander.dead) g.ui.msg('Командир смотрит на вас с осуждением. Слезайте.', 'dim');
      else g.ui.msg('Вы присели на трон. Императору бы это не понравилось... но командира больше нет.', 'dim');
      return;
    }
    const guardsLeft = g.npcs.npcs.filter(n => !n.dead && n.faction === 'guard').length;
    if (guardsLeft > 0) {
      g.ui.msg(`Дворец ещё защищают! Осталось стражи: ${guardsLeft}`, 'bad');
      return;
    }
    if (g.flags.palaceCaptured) { g.ui.msg('Вы уже правите отсюда. Трон удобный.', 'dim'); return; }
    g.flags.palaceCaptured = true;
    const text = g.faction === 'villain'
      ? `${g.villainName} воссел на трон Императора! Войско ликует. Старый форт можно оставить — теперь у вас целый дворец.`
      : 'Лесные эльфы захватили дворец Императора! Теперь все корованы — ваши, а лес — в безопасности.';
    g.victoryShow(text);
  }

  fortThrone() {
    const g = this.g;
    if (g.faction === 'villain') {
      g.player.hp = g.player.maxHp;
      g.ui.msg('Вы отдохнули на Троне Злодея. Здоровье восстановлено.', 'good');
      g.sfx.potion();
    } else {
      g.ui.msg('Это трон Злодея (имя не придумано). Садиться страшно.', 'dim');
    }
  }

  // ---------- СОБЫТИЯ ----------
  onKill(npc, byPlayer) {
    const g = this.g;
    if (byPlayer) {
      g.stats.kills++;
      if (!g.firstKill) {
        g.firstKill = true;
        g.ui.msg('Враги 3-хмерные. И труп тоже 3д.', 'dim');
      }
      if (npc.faction === 'civilian') {
        g.ui.msg('Вы убили мирного жителя. Зачем?', 'bad');
      } else {
        const loot = 8 + ((Math.random() * 16) | 0);
        g.player.gold += loot;
        g.ui.msg(`+${loot} золота — трофеи`, 'gold');
      }
      if (g.faction === 'guard' && this.order && !this.order.done) {
        const o = this.order;
        if (o.id === 'raidElves' && npc.faction === 'elf') {
          o.count++;
          if (o.count >= 4) { o.done = true; g.ui.msg('Эльфы наказаны. Доложите командиру [E]!', 'good'); }
        }
        if (o.id === 'raidFort' && npc.faction === 'villain') {
          o.count++;
          if (o.count >= 3) { o.done = true; g.ui.msg('Форту досталось. Доложите командиру [E]!', 'good'); }
        }
        if (o.id === 'spy' && npc === this.spyNpc) {
          o.done = true;
          g.ui.msg('Шпион ликвидирован! Доложите командиру [E].', 'good');
        }
      }
      if (g.faction === 'guard' && npc.faction === 'caravan') {
        g.ui.msg('Вы убили охранника корована... Лишь бы командир не узнал.', 'bad');
      }
    }
    if (npc.kind === 'commander') g.ui.msg('Командир дворца погиб!', 'bad');
    if (npc.playerTroop) g.ui.msg('Ваш боец пал в бою.', 'bad');
  }

  onCaravanRobbed() {
    const g = this.g;
    g.stats.caravans++;
    if (g.faction === 'elf') g.ui.msg('Корован ограблен по-эльфийски: тихо и с прибылью.', 'dim');
    if (g.faction === 'guard') g.ui.msg('Стража, грабящая корованы... Командир будет в ярости, если узнает.', 'bad');
  }

  orderText() {
    const g = this.g, F = g.faction;
    if (F === 'guard') {
      if (!this.commander || this.commander.dead) return 'Командир мёртв. Вы вольны делать что хотите.';
      if (!this.order) return 'Подойдите к командиру за приказом [E]';
      const o = this.order;
      if (o.done) return 'ПРИКАЗ ВЫПОЛНЕН — доложите командиру [E]';
      let t = o.text;
      if (o.id === 'patrol') t += ` (${o.visited.filter(Boolean).length}/4)`;
      if (o.id === 'raidElves') t += ` (${o.count}/4)`;
      if (o.id === 'raidFort') t += ` (${o.count}/3)`;
      return t;
    }
    if (F === 'elf') {
      if (this.wave.length && !this.wave.every(w => w.dead)) return 'НАБЕГ! Защищайте деревню эльфов!';
      return `Охраняйте лес. Грабьте корованы на дороге (юг). Ограблено: ${g.stats.caravans}`;
    }
    const n = g.npcs.npcs.filter(x => x.playerTroop && !x.dead).length;
    if (g.flags.palaceCaptured) return `${g.villainName} правит миром! Бойцов: ${n}`;
    if (this.assault) return `ШТУРМ ДВОРЦА! Перебейте стражу и сядьте на трон [E]! Бойцов: ${n}`;
    return `Бойцов: ${n} | [T] за мной  [G] держать форт  [Y] ШТУРМ ДВОРЦА`;
  }

  markers() {
    const m = [];
    const g = this.g;
    if (g.faction === 'guard' && this.order) {
      const o = this.order;
      if (o.done) {
        if (this.commander && !this.commander.dead) {
          const p = this.commander.group.position;
          m.push([p.x, p.z]);
        }
      } else if (o.id === 'patrol') {
        o.pts.forEach((p, i) => { if (!o.visited[i]) m.push(p); });
      } else if (o.id === 'defend') m.push([152, 200]);
      else if (o.id === 'raidElves') m.push([-200, -200]);
      else if (o.id === 'spy' && this.spyNpc && !this.spyNpc.dead) {
        const p = this.spyNpc.group.position;
        m.push([p.x, p.z]);
      } else if (o.id === 'raidFort') m.push([220, -220]);
    }
    if (g.faction === 'villain' && this.assault && !g.flags.palaceCaptured) m.push([200, 200]);
    if (g.faction === 'elf' && this.wave.length) {
      const alive = this.wave.find(w => !w.dead);
      if (alive) m.push([alive.group.position.x, alive.group.position.z]);
    }
    return m;
  }

  serialize() {
    return { orderIdx: this.orderIdx, ordersDone: this.ordersDone, lvl: this.lvl, plvl: this.plvl };
  }

  deserialize(d) {
    if (!d) return;
    this.orderIdx = d.orderIdx || 0;
    this.ordersDone = d.ordersDone || 0;
    this.lvl = d.lvl || 0;
    this.plvl = d.plvl || 0;
  }
}
