// game.js — кампании трёх фракций, корованы, лавка/лекарь, набеги, сохранения.
import { SITES, ROADS, heightAt, makeCart } from './world.js';
import { Unit } from './units.js';

const SAVE_KEY = 'korovany_k3_save';

// ---------- корованы ----------
function roadLength(road) {
  let L = 0;
  for (let i = 0; i < road.length - 1; i++)
    L += Math.hypot(road[i + 1][0] - road[i][0], road[i + 1][1] - road[i][1]);
  return L;
}
function roadPoint(road, s) {
  for (let i = 0; i < road.length - 1; i++) {
    const seg = Math.hypot(road[i + 1][0] - road[i][0], road[i + 1][1] - road[i][1]);
    if (s <= seg) {
      const t = s / seg;
      return {
        x: road[i][0] + (road[i + 1][0] - road[i][0]) * t,
        z: road[i][1] + (road[i + 1][1] - road[i][1]) * t,
        yaw: Math.atan2(road[i + 1][0] - road[i][0], road[i + 1][1] - road[i][1]),
      };
    }
    s -= seg;
  }
  const l = road[road.length - 1];
  return { x: l[0], z: l[1], yaw: 0 };
}

function spawnCaravan(G) {
  const road = ROADS[0];
  const L = roadLength(road);
  const dir = G._caravanDir = -(G._caravanDir || -1);
  const group = makeCart();
  const s = dir === 1 ? 0 : L;
  const p = roadPoint(road, s);
  group.position.set(p.x, heightAt(p.x, p.z), p.z);
  G.scene.add(group);
  const cart = { group, s, L, dir, road, looted: false, removeT: -1, x: p.x, z: p.z, guards: [] };
  for (const off of [-3, 3]) {
    const u = new Unit(G, {
      faction: 'guard', role: 'caravan', name: 'Охранник корована',
      x: p.x + off, z: p.z + 1.5, hp: 70, dmg: 15, speed: 4.4, aggro: 16, gold: 18,
    });
    u.cart = cart;
    cart.guards.push(u);
    G.units.push(u);
  }
  G.caravans.push(cart);
  G.ui.toast('На тракте появился корован', 'gold');
}

function updateCaravans(G, dt) {
  for (let i = G.caravans.length - 1; i >= 0; i--) {
    const c = G.caravans[i];
    const guardsDead = c.guards.every(u => u.state === 'dead');
    if (c.looted || c.removeT >= 0) {
      c.removeT = (c.removeT < 0 ? 45 : c.removeT) - dt;
      if (c.removeT <= 0) {
        G.scene.remove(c.group);
        G.caravans.splice(i, 1);
      }
      continue;
    }
    if (!guardsDead) { // без охраны корован стоит на месте — можно грабить
      c.s += 2.3 * dt * c.dir;
      if (c.s <= 0 || c.s >= c.L) { // доехал
        G.scene.remove(c.group);
        for (const u of c.guards) if (u.state !== 'dead') { G.scene.remove(u.mesh); u.removeMe = true; }
        G.caravans.splice(i, 1);
        continue;
      }
    }
    const p = roadPoint(c.road, Math.max(0, Math.min(c.L, c.s)));
    c.x = p.x; c.z = p.z;
    c.group.position.set(p.x, heightAt(p.x, p.z), p.z);
    c.group.rotation.y = p.yaw + (c.dir === 1 ? 0 : Math.PI);
    for (const w of c.group.userData.wheels) w.rotation.y += dt * 3.7 * c.dir;
  }
}

// ---------- население мира ----------
function populate(G) {
  const f = G.player.faction;
  const U = (o) => { const u = new Unit(G, o); G.units.push(u); return u; };
  const V = SITES.village, P = SITES.palace, E = SITES.forest, F = SITES.fort;

  // деревня людей
  G.npcs.merchant = U({ faction: 'human', role: 'vendor', name: 'Торговец', label: 'ТОРГОВЕЦ', x: 10, z: 18.5, hp: 50, gold: 0 });
  G.npcs.healer = U({ faction: 'human', role: 'vendor', name: 'Лекарь', label: 'ЛЕКАРЬ', x: -14, z: 25.5, hp: 50, gold: 0 });
  for (let i = 0; i < 4; i++)
    U({ faction: 'human', role: 'villager', name: 'Житель', x: V.x + (Math.random() - 0.5) * 40, z: V.z + (Math.random() - 0.5) * 40, hp: 35, dmg: 5, speed: 3.6, gold: 3 });

  // дворец
  G.npcs.commander = U({ faction: 'guard', role: 'quest', name: 'Командир стражи', label: 'КОМАНДИР', x: P.x - 36, z: 5, hp: 120, dmg: 18, gold: 0 });
  G.npcs.captain = U({ faction: 'guard', role: 'post', name: 'Капитан стражи', label: 'КАПИТАН', x: P.x + 8, z: 4, hp: 280, dmg: 24, speed: 4.6, aggro: 18, gold: 150, boss: true });
  for (const [x, z] of [[P.x - 38, -6], [P.x - 38, 6]])
    U({ faction: 'guard', role: 'post', name: 'Стражник ворот', x, z, hp: 70, dmg: 15, speed: 4.6, gold: 12 });
  U({ faction: 'guard', role: 'patrol', name: 'Патрульный', x: P.x, z: -30, hp: 70, dmg: 15, speed: 4.6, gold: 12, waypoints: [[P.x - 30, -30], [P.x + 30, -30], [P.x + 30, 30], [P.x - 30, 30]] });
  U({ faction: 'guard', role: 'patrol', name: 'Патрульный', x: P.x, z: 30, hp: 70, dmg: 15, speed: 4.6, gold: 12, waypoints: [[P.x + 30, 30], [P.x - 30, 30], [P.x - 30, -30], [P.x + 30, -30]] });

  // роща эльфов
  G.npcs.elder = U({ faction: 'elf', role: 'quest', name: 'Старейшина', label: 'СТАРЕЙШИНА', x: E.x + 4, z: E.z + 4, hp: 80, dmg: 10, gold: 0 });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.4;
    U({ faction: 'elf', role: 'post', name: 'Защитник рощи', x: E.x + Math.cos(a) * 14, z: E.z + Math.sin(a) * 14, hp: 75, dmg: 16, speed: 4.5, aggro: 26, gold: 14 });
  }

  // форт Злого
  if (f !== 'villain') {
    G.npcs.darkLord = U({ faction: 'villain', role: 'post', name: 'Злой', label: 'ЗЛОЙ', x: F.x, z: F.z - 8, hp: 340, dmg: 26, speed: 4.8, aggro: 24, gold: 200, boss: true });
  }
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    U({ faction: 'villain', role: 'post', name: 'Прислужник', x: F.x + Math.cos(a) * 12, z: F.z + Math.sin(a) * 10, hp: 65, dmg: 14, speed: 4.3, gold: 13 });
  }
}

// ---------- лавка ----------
export function shopItems(G) {
  const p = G.player;
  return [
    { name: 'Бинт', desc: 'Останавливает кровотечение и лечит 25 HP. Клавиша H.', price: 30,
      onBuy: () => { p.items.bandage++; G.ui.toast('Бинт добавлен в сумку', 'good'); } },
    { name: 'Эликсир жизни', desc: 'Полностью лечит. Клавиша H, если не кровите.', price: 60,
      onBuy: () => { p.items.elixir++; G.ui.toast('Эликсир добавлен в сумку', 'good'); } },
    { name: 'Стальной меч', desc: 'Урон 16 → 24. Разовая покупка.', price: 150, sold: p.swordUpgraded,
      onBuy: () => { p.swordUpgraded = true; G.applyPlayerVisuals(); G.ui.toast('Стальной меч — урон вырос!', 'good'); } },
    { name: 'Кольчуга', desc: 'Входящий урон −30%. Разовая покупка.', price: 200, sold: p.armor,
      onBuy: () => { p.armor = true; G.ui.toast('Кольчуга надета', 'good'); } },
    { name: 'Протез руки', desc: 'Деревянная рука: урон снова полный.', price: 120,
      hidden: !(p.injuries.arm && !p.prosthesis.arm),
      onBuy: () => { p.prosthesis.arm = true; G.applyPlayerVisuals(); G.ui.toast('Протез руки поставлен', 'good'); } },
    { name: 'Стеклянный глаз', desc: 'Протез глаза: снова видно весь экран.', price: 100,
      hidden: !(p.injuries.eye && !p.prosthesis.eye),
      onBuy: () => { p.prosthesis.eye = true; G.applyPlayerVisuals(); G.ui.toast('Глаз на месте. Ну, почти.', 'good'); } },
    { name: 'Протез ноги', desc: 'Ходите и прыгайте как раньше.', price: 150,
      hidden: !(p.injuries.leg && !p.prosthesis.leg),
      onBuy: () => { p.prosthesis.leg = true; G.applyPlayerVisuals(); G.ui.toast('Протез ноги поставлен', 'good'); } },
    { name: 'Коляска', desc: 'С отрубленной ногой — катитесь быстро, но не прыгнуть.', price: 80,
      hidden: !(p.injuries.leg && !p.prosthesis.leg && !p.wheelchair),
      onBuy: () => { p.wheelchair = true; G.applyPlayerVisuals(); G.ui.toast('Вы сели в коляску. Погнали!', 'good'); } },
  ];
}

// ---------- кампания ----------
export function startCampaign(G) {
  const f = G.player.faction;
  const E = SITES.forest, P = SITES.palace, V = SITES.village, F = SITES.fort;
  const ui = G.ui;

  populate(G);

  const camp = {
    faction: f,
    stage: 0,
    questText: null,
    wave: [],
    cratesLeft: 0,
    caravanT: 12,
    raidT: 130,
    victory: false,
    stormStarted: false,
  };
  G.campaign = camp;

  const setQuest = (title, desc) => { camp.questText = { title, desc }; ui.updateHUD(); };
  const advance = () => { camp.stage++; ui.sfx('quest'); enterStage(); G.saveGame(); };
  const waveDead = () => camp.wave.length > 0 && camp.wave.every(u => u.state === 'dead');

  function spawnWave(list, objective, role = 'raid') {
    camp.wave = [];
    for (const [fx, fz, o] of list) {
      const u = new Unit(G, { objective, role, ...o, x: fx + (Math.random() - 0.5) * 8, z: fz + (Math.random() - 0.5) * 8 });
      G.units.push(u);
      camp.wave.push(u);
    }
  }

  // ======== ЭЛЬФЫ ========
  const elfStages = [
    { // 0: поговорить со Старейшиной
      enter() {
        setQuest('Роща эльфов', 'Поговорите со Старейшиной (клавиша E рядом с ним).');
        G.world.setBeacon(G.npcs.elder.pos.x, G.npcs.elder.pos.z);
      },
      check() {},
    },
    { // 1: ограбить корован
      enter() {
        setQuest('Корован на тракте', 'Ограбьте корован: уберите охрану и нажмите E у телеги. Корованы ходят по тракту между деревней и дворцом.');
        camp.caravanT = Math.min(camp.caravanT, 4);
      },
      check() {
        const c = G.caravans.find(c => !c.looted);
        if (c) G.world.setBeacon(c.x, c.z);
      },
    },
    { // 2: отбить набег солдат
      enter() {
        setQuest('Набег!', 'Солдаты дворца набигают нагибать рощу. Перебейте отряд и их сержанта!');
        ui.waveBanner('НАБЕГ СОЛДАТ!');
        spawnWave([
          [-330, 0, { faction: 'guard', name: 'Сержант дворца', hp: 150, dmg: 20, speed: 4.7, gold: 60, boss: true }],
          [-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }],
          [-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }],
          [-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }],
          [-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }],
        ], { x: E.x, z: E.z });
        G.world.setBeacon(-330, 0);
        setTimeout(() => ui.waveBanner(null), 4000);
      },
      check() { if (waveDead()) advance(); },
    },
    { // 3: победа
      enter() {
        setQuest('Свободная охота', 'Роща отбита! Грабьте корованы и защищайте лес — набеги продолжатся.');
        G.world.setBeacon(null);
        G.showVictory('Солдаты дворца бегут из леса. Роща эльфов выстояла, корованы никуда не денутся.');
      },
      check() {},
    },
  ];

  // ======== СТРАЖА ========
  const guardStages = [
    { // 0: приказ командира
      enter() {
        setQuest('Служба начинается', 'Получите приказ у командира стражи (E рядом с ним, он у ворот дворца).');
        G.world.setBeacon(G.npcs.commander.pos.x, G.npcs.commander.pos.z);
      },
      check() {},
    },
    { // 1: пост у ворот, шпионы
      enter() {
        setQuest('Пост у ворот', 'Шпионы Злого уже в пути. Отбейте их у ворот дворца!');
        ui.waveBanner('ШПИОНЫ ЗЛОГО!');
        spawnWave([
          [P.x - 90, 0, { faction: 'villain', name: 'Шпион Злого', hp: 45, dmg: 13, speed: 5.2, gold: 16 }],
          [P.x - 90, 0, { faction: 'villain', name: 'Шпион Злого', hp: 45, dmg: 13, speed: 5.2, gold: 16 }],
          [P.x - 90, 0, { faction: 'villain', name: 'Шпион Злого', hp: 45, dmg: 13, speed: 5.2, gold: 16 }],
          [P.x - 90, 0, { faction: 'villain', name: 'Шпион Злого', hp: 45, dmg: 13, speed: 5.2, gold: 16 }],
        ], { x: P.x - 44, z: 0 });
        G.world.setBeacon(P.x - 44, 0);
        setTimeout(() => ui.waveBanner(null), 4000);
      },
      check() {
        if (waveDead()) {
          setQuest('Доложите командиру', 'Шпионы перебиты. Вернитесь к командиру за жалованием.');
          G.world.setBeacon(G.npcs.commander.pos.x, G.npcs.commander.pos.z);
          camp.stage = 1.5;
        }
      },
    },
    { // 2: набег на рощу (склады эльфов)
      enter() {
        setQuest('Набег на рощу', 'Командир велит уничтожить 3 склада эльфов в их роще. С вами двое стражников. Бейте склады мечом!');
        camp.cratesLeft = 3;
        for (const [x, z] of [[E.x - 8, E.z + 10], [E.x + 10, E.z - 6], [E.x + 2, E.z + 14]])
          G.world.makeCrate(x, z, 'elfcamp');
        for (const off of [-2, 2]) {
          const u = new Unit(G, { faction: 'guard', role: 'follow', leader: G.player, name: 'Стражник отряда', x: G.player.pos.x + off, z: G.player.pos.z + 2, hp: 80, dmg: 16, speed: 4.8, gold: 0 });
          G.units.push(u);
        }
        // партизаны устроят засаду на дороге
        spawnWave([
          [-180, 0, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
          [-180, 0, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
          [-180, 0, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
        ], { x: G.player.pos.x, z: G.player.pos.z }, 'post');
        camp.wave = []; // партизаны не обязательны для квеста
        G.world.setBeacon(E.x, E.z);
      },
      check() {
        if (camp.cratesLeft <= 0) {
          setQuest('Доложите командиру', 'Склады эльфов горят. Вернитесь к командиру.');
          G.world.setBeacon(G.npcs.commander.pos.x, G.npcs.commander.pos.z);
          camp.stage = 2.5;
        }
      },
    },
    { // 3: поход на форт Злого
      enter() {
        setQuest('Поход на форт Злого', 'Финальный приказ: взять старый форт в горах и убить Злого. С вами трое стражников.');
        for (const off of [-3, 0, 3]) {
          const u = new Unit(G, { faction: 'guard', role: 'follow', leader: G.player, name: 'Стражник отряда', x: G.player.pos.x + off, z: G.player.pos.z + 2, hp: 90, dmg: 17, speed: 4.8, gold: 0 });
          G.units.push(u);
        }
        G.world.setBeacon(F.x, F.z);
      },
      check() {
        if (G.npcs.darkLord && G.npcs.darkLord.state === 'dead') {
          setQuest('Доложите командиру', 'Злой повержен! Вернитесь к командиру.');
          G.world.setBeacon(G.npcs.commander.pos.x, G.npcs.commander.pos.z);
          camp.stage = 3.5;
        }
      },
    },
    { // 4: победа
      enter() {
        setQuest('Герой дворца', 'Злой мёртв, дворец в безопасности. Служба продолжается — ждите новых нападений.');
        G.world.setBeacon(null);
        G.showVictory('Злой повержен в его собственном форту. Император доволен, командир пожимает руку. Жалование: 150 золота.');
        G.addGold(150, 'жалование');
      },
      check() {},
    },
  ];

  // ======== ЗЛОЙ ========
  const villainStages = [
    { // 0: военный стол
      enter() {
        setQuest('Я — Злой', 'Подойдите к военному столу в форте (E), чтобы отдавать приказы.');
        G.world.setBeacon(F.x, F.z + 8);
      },
      check() {},
    },
    { // 1: партизаны атакуют форт
      enter() {
        setQuest('Партизаны!', 'Партизаны эльфов атакуют ваш форт. Перебейте их всех.');
        ui.waveBanner('ПАРТИЗАНЫ ЭЛЬФОВ!');
        spawnWave([
          [0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
          [0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
          [0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
          [0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
          [0, -350, { faction: 'elf', name: 'Вождь партизан', hp: 130, dmg: 19, speed: 4.9, gold: 50, boss: true }],
        ], { x: F.x, z: F.z });
        G.world.setBeacon(0, -350);
        setTimeout(() => ui.waveBanner(null), 4000);
      },
      check() { if (waveDead()) advance(); },
    },
    { // 2: набег на деревню
      enter() {
        setQuest('Набег на деревню', 'Нейтралы жируют. Разграбьте 2 склада в деревне людей. Ополченцы будут защищаться.');
        camp.cratesLeft = 2;
        for (const [x, z] of [[6, -18], [-24, 8]])
          G.world.makeCrate(x, z, 'village');
        spawnWave([
          [V.x, V.z, { faction: 'human', name: 'Ополченец', hp: 55, dmg: 12, speed: 4.2, gold: 10 }],
          [V.x, V.z, { faction: 'human', name: 'Ополченец', hp: 55, dmg: 12, speed: 4.2, gold: 10 }],
          [V.x, V.z, { faction: 'human', name: 'Ополченец', hp: 55, dmg: 12, speed: 4.2, gold: 10 }],
        ], { x: V.x, z: V.z }, 'post');
        camp.wave = [];
        G.world.setBeacon(V.x, V.z);
      },
      check() {
        if (camp.cratesLeft <= 0) advance();
      },
    },
    { // 3: штурм дворца
      enter() {
        setQuest('Штурм дворца', 'Прикажите у военного стола начать штурм — и ведите войско на дворец. Убейте Капитана стражи у трона.');
        G.world.setBeacon(F.x, F.z + 8);
      },
      check() {
        if (camp.stormStarted && G.npcs.captain.state === 'dead') advance();
      },
    },
    { // 4: победа
      enter() {
        setQuest('Злой на троне', 'Дворец пал. Империя дрожит. Можно продолжать злодействовать.');
        G.world.setBeacon(null);
        G.showVictory('Капитан повержен, трон Императора — ваш. Прислужники вопят от восторга. Злой правит!');
      },
      check() {},
    },
  ];

  const chains = { elf: elfStages, guard: guardStages, villain: villainStages };
  const chain = chains[f];

  function enterStage() {
    const st = chain[Math.floor(camp.stage)];
    if (st) st.enter();
    ui.updateHUD();
  }
  camp.setStage = (i) => { camp.stage = i; enterStage(); };

  // ---- взаимодействия NPC ----
  G.onUnitDied = (unit, attacker) => {
    if (camp.wave.includes(unit) && waveDead()) {
      // волна перебита — check() подхватит
    }
  };
  G.onCrateBroken = (tag) => {
    camp.cratesLeft = Math.max(0, camp.cratesLeft - 1);
    ui.toast(`Склад уничтожен! Осталось: ${camp.cratesLeft}`, 'good');
  };
  G.onCaravanLooted = () => {
    if (f === 'elf' && camp.stage === 1) advance();
  };

  // диалоги
  camp.talkElder = () => {
    if (camp.stage === 0) {
      ui.dialog('Старейшина эльфов',
        'Солдаты дворца набигают нагибают нашу рощу, а Злой в горах шлёт своих тварей.\n\nНа тракте между деревней и дворцом ходят корованы Императора. Ограбь один — роще нужны припасы и золото. Охрану придётся уложить.',
        [{ label: 'Будет сделано', cb: () => { G.closeOverlay(); advance(); } }]);
    } else {
      ui.dialog('Старейшина эльфов', 'Лес смотрит на тебя с надеждой. Грабь корованы, береги рощу.',
        [{ label: 'Понял', cb: () => G.closeOverlay() }]);
    }
  };

  camp.talkCommander = () => {
    if (camp.stage === 0) {
      ui.dialog('Командир стражи',
        'Слушай приказ! Встанешь на пост у ворот. Разведка доносит: шпионы Злого (имя он не придумал) крадутся к дворцу. Перебить всех.',
        [{ label: 'Есть, командир!', cb: () => { G.closeOverlay(); advance(); } }]);
    } else if (camp.stage === 1.5) {
      ui.dialog('Командир стражи',
        'Шпионы перебиты? Неплохо. Держи жалование — 60 золота.\n\nНовый приказ: набег на рощу эльфов. Уничтожь три их склада. Двое стражников пойдут с тобой. Жди партизан.',
        [{ label: 'Есть!', cb: () => { G.addGold(60, 'жалование'); G.closeOverlay(); camp.stage = 2; enterStage(); G.saveGame(); } }]);
    } else if (camp.stage === 2.5) {
      ui.dialog('Командир стражи',
        'Склады эльфов уничтожены — партизаны взвоют. Жалование: 80 золота.\n\nПоследний приказ: поход на старый форт в горах. Убей Злого. Трое лучших пойдут с тобой.',
        [{ label: 'Есть!', cb: () => { G.addGold(80, 'жалование'); G.closeOverlay(); camp.stage = 3; enterStage(); G.saveGame(); } }]);
    } else if (camp.stage === 3.5) {
      ui.dialog('Командир стражи', 'Злой мёртв... Ты герой дворца, стражник. Император лично благодарит.',
        [{ label: 'Служить!', cb: () => { G.closeOverlay(); camp.stage = 4; enterStage(); G.saveGame(); } }]);
    } else {
      ui.dialog('Командир стражи', 'Служба не ждёт. К приказам вернёмся позже.',
        [{ label: 'Есть', cb: () => G.closeOverlay() }]);
    }
  };

  camp.warTable = () => {
    const buttons = [];
    buttons.push({
      label: 'Призвать прислужника (50 зол.)',
      cb: () => {
        if (G.player.gold < 50) { ui.toast('Не хватает золота', 'bad'); return; }
        const followers = G.units.filter(u => u.role === 'follow' && u.leader === G.player && u.state !== 'dead');
        if (followers.length >= 5) { ui.toast('Отряд полон (5)', 'bad'); return; }
        G.player.gold -= 50;
        const u = new Unit(G, { faction: 'villain', role: 'follow', leader: G.player, name: 'Прислужник', x: G.player.pos.x + 2, z: G.player.pos.z + 2, hp: 75, dmg: 15, speed: 4.6, gold: 0 });
        G.units.push(u);
        ui.sfx('buy');
        ui.toast('Прислужник призван', 'good');
        ui.updateHUD();
        camp.warTable();
      },
    });
    buttons.push({
      label: camp._followHold ? 'Отряд: за мной!' : 'Отряд: ждать в форте',
      cb: () => {
        camp._followHold = !camp._followHold;
        for (const u of G.units) {
          if (u.faction !== 'villain' || u.state === 'dead') continue;
          if (camp._followHold && u.role === 'follow') { u.role = 'post'; u.home = { x: F.x, z: F.z }; }
          else if (!camp._followHold && u.role === 'post' && u.leader === G.player) u.role = 'follow';
        }
        ui.toast(camp._followHold ? 'Отряд ждёт в форте' : 'Отряд идёт за вами', 'good');
        camp.warTable();
      },
    });
    if (camp.stage === 3 && !camp.stormStarted) {
      buttons.push({
        label: 'НАЧАТЬ ШТУРМ ДВОРЦА!',
        cb: () => {
          camp.stormStarted = true;
          camp._followHold = false;
          for (const u of G.units) {
            if (u.faction === 'villain' && u.state !== 'dead') { u.role = 'follow'; u.leader = G.player; }
          }
          setQuest('Штурм дворца', 'Ведите войско ко дворцу и убейте Капитана стражи у трона!');
          G.world.setBeacon(P.x, P.z);
          ui.waveBanner('НА ШТУРМ!');
          setTimeout(() => ui.waveBanner(null), 4000);
          G.closeOverlay();
          G.saveGame();
        },
      });
    }
    buttons.push({ label: 'Отойти от стола', cb: () => G.closeOverlay() });
    ui.dialog('Военный стол Злого',
      'Карта четырёх земель расстелена на столе. Вы — Злой, вы сами себе командир.\nЗолото: ' + G.player.gold,
      buttons);
  };

  camp.healerTalk = () => {
    if (G.player.gold < 50) {
      ui.dialog('Лекарь', 'Лечение стоит 50 золота. У тебя не хватает — возвращайся, как разбогатеешь.',
        [{ label: 'Уйти', cb: () => G.closeOverlay() }]);
      return;
    }
    ui.dialog('Лекарь', 'Полностью залатать раны и остановить кровь — 50 золота. Отрубленное не пришью: за протезами — в лавку.',
      [
        { label: 'Лечить (50 зол.)', cb: () => {
          G.player.gold -= 50;
          G.player.hp = G.player.maxHp;
          G.player.bleeding = false;
          ui.setBleeding(false);
          ui.healFlash();
          ui.sfx('heal');
          ui.updateHUD();
          G.closeOverlay();
        } },
        { label: 'Уйти', cb: () => G.closeOverlay() },
      ]);
  };

  enterStage();

  // ---- периодика ----
  camp.update = (dt) => {
    // корованы
    camp.caravanT -= dt;
    if (camp.caravanT <= 0) {
      camp.caravanT = 75 + Math.random() * 30;
      if (G.caravans.length < 2) spawnCaravan(G);
    }
    updateCaravans(G, dt);

    // проверка условий текущей стадии
    const st = chain[Math.floor(camp.stage)];
    if (st) st.check();

    // свободные набеги после победы
    if (camp.victory) {
      camp.raidT -= dt;
      if (camp.raidT <= 0) {
        camp.raidT = 120 + Math.random() * 60;
        if (f === 'elf') {
          ui.waveBanner('НАБЕГ СОЛДАТ!');
          spawnWave([[-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }],
                     [-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }],
                     [-330, 0, { faction: 'guard', name: 'Солдат', hp: 70, dmg: 15, speed: 4.6, gold: 14 }]], { x: E.x, z: E.z });
        } else if (f === 'guard') {
          ui.waveBanner('НАПАДЕНИЕ НА ДВОРЕЦ!');
          const villain = Math.random() < 0.5;
          const ff = villain ? 'villain' : 'elf';
          const nm = villain ? 'Лазутчик Злого' : 'Партизан';
          spawnWave([[P.x - 90, 0, { faction: ff, name: nm, hp: 55, dmg: 14, speed: 5, gold: 15 }],
                     [P.x - 90, 0, { faction: ff, name: nm, hp: 55, dmg: 14, speed: 5, gold: 15 }],
                     [P.x - 90, 0, { faction: ff, name: nm, hp: 55, dmg: 14, speed: 5, gold: 15 }]], { x: P.x - 44, z: 0 });
        } else {
          ui.waveBanner('ПАРТИЗАНЫ У ФОРТА!');
          spawnWave([[0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
                     [0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }],
                     [0, -350, { faction: 'elf', name: 'Партизан', hp: 60, dmg: 15, speed: 4.9, gold: 15 }]], { x: F.x, z: F.z });
        }
        setTimeout(() => ui.waveBanner(null), 4000);
      }
    }
  };

  // ---- взаимодействия (E) ----
  camp.getInteract = () => {
    const p = G.player;
    const near = (x, z, r) => Math.hypot(p.pos.x - x, p.pos.z - z) < r;
    const list = [];
    if (near(G.npcs.merchant.pos.x, G.npcs.merchant.pos.z, 3.5))
      list.push({ label: 'E — Лавка (торговать)', action: () => { G.openOverlay('shop'); ui.openShop('Лавка купца Гаврилы', shopItems(G)); } });
    if (near(G.npcs.healer.pos.x, G.npcs.healer.pos.z, 3.5))
      list.push({ label: 'E — Лекарь (лечение, 50 зол.)', action: () => { G.openOverlay('dialog'); camp.healerTalk(); } });
    if (f === 'elf' && near(G.npcs.elder.pos.x, G.npcs.elder.pos.z, 3.5))
      list.push({ label: 'E — Поговорить со Старейшиной', action: () => { G.openOverlay('dialog'); camp.talkElder(); } });
    if (f === 'guard' && near(G.npcs.commander.pos.x, G.npcs.commander.pos.z, 3.5))
      list.push({ label: 'E — Командир стражи', action: () => { G.openOverlay('dialog'); camp.talkCommander(); } });
    if (f === 'villain' && near(F.x, F.z + 8, 3.2))
      list.push({ label: 'E — Военный стол (приказы)', action: () => {
        G.openOverlay('dialog');
        if (camp.stage === 0) { advance(); }
        camp.warTable();
      } });
    for (const c of G.caravans) {
      if (!c.looted && c.guards.every(u => u.state === 'dead') && near(c.x, c.z, 4))
        list.push({ label: 'E — ОГРАБИТЬ КОРОВАН', action: () => {
          c.looted = true;
          const g = 40 + ((Math.random() * 40) | 0);
          G.addGold(g, 'корован ограблен');
          ui.sfx('coin');
          G.onCaravanLooted();
        } });
    }
    return list[0] || null;
  };

  return camp;
}

// ---------- сохранения ----------
export function saveGame(G) {
  if (!G.player || !G.campaign || G.state === 'menu') return;
  const p = G.player;
  const data = {
    faction: p.faction,
    x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw,
    hp: p.hp, maxHp: p.maxHp, gold: p.gold, dmg: p.dmg,
    items: p.items, injuries: p.injuries, prosthesis: p.prosthesis,
    wheelchair: p.wheelchair, armor: p.armor, swordUpgraded: p.swordUpgraded,
    stage: G.campaign.stage, victory: G.campaign.victory, stormStarted: G.campaign.stormStarted,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  G.ui.toast('Игра сохранена', 'good');
}

export function loadSaveData() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

export function applySave(G, d) {
  const p = G.player;
  p.pos.set(d.x, d.y, d.z);
  p.yaw = d.yaw;
  p.hp = d.hp; p.maxHp = d.maxHp; p.gold = d.gold; p.dmg = d.dmg;
  p.items = d.items; p.injuries = d.injuries; p.prosthesis = d.prosthesis;
  p.wheelchair = d.wheelchair; p.armor = d.armor; p.swordUpgraded = d.swordUpgraded;
  G.campaign.victory = !!d.victory;
  G.campaign.stormStarted = !!d.stormStarted;
  G.campaign.setStage(Math.min(d.stage, 4));
  G.applyPlayerVisuals();
  if (p.injuries.eye && !p.prosthesis.eye) G.ui.setEye(true);
  G.ui.updateHUD();
}
