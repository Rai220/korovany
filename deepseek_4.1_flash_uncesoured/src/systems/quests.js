// Задания, приказы командира, диалоги, победные условия трёх фракций.
import { G, emit, notify, say, banner, on } from '../core/state.js';
import { clamp, dist2D } from '../core/mathutil.js';
import { addXP, gainGold, addItem } from '../entities/player.js';
import { spawnRaid, spawnSpy, createSquad, fillSquad, commandSquad, squadAlive } from './npc.js';
import { PLACES, placeNear } from '../world/terrain.js';
import { LANDMARKS } from '../world/settlements.js';

let questId = 1;
const quests = [];
const patrolSpots = {};

const RANKS = ['Рядовой', 'Капрал', 'Сержант', 'Сотник', 'Тысячник'];

export function initQuests() {
  G.quests = {
    list: quests, start, update, dialogueFor, captainOrder, elderOrder, onCaravanRobbed,
    current: () => quests.find((q) => q.state === 'active'),
    add, complete, objectiveDone: checkObj, rank: () => G.playerRank || 0, victory,
  };
  G.playerRank = 0;
  // прогресс по событиям
  on('npc:killed', ({ entity, killer }) => {
    if (!killer || !killer.isPlayer) return;
    for (const q of quests) {
      if (q.state !== 'active') continue;
      for (const o of q.objectives) {
        if (o.done) continue;
        if (o.type === 'kill' && matchKill(o, entity)) { o.progress = (o.progress || 0) + 1; checkObj(q, o); }
        if (o.type === 'killboss' && entity.boss) { o.progress = 1; checkObj(q, o); }
      }
    }
  });
  on('player:place', ({ place }) => {
    for (const q of quests) {
      if (q.state !== 'active') continue;
      for (const o of q.objectives) {
        if (o.done) continue;
        if (o.type === 'goto' && o.target === place.id) { o.progress = 1; checkObj(q, o); }
      }
    }
  });
  on('ui:throne', () => {
    for (const q of quests) {
      if (q.state !== 'active') continue;
      for (const o of q.objectives) {
        if (o.done) continue;
        if (o.type === 'capture') { o.progress = 1; checkObj(q, o); }
      }
    }
  });
  on('caravan:robbed', () => {
    for (const q of quests) {
      if (q.state !== 'active') continue;
      for (const o of q.objectives) {
        if (o.done) continue;
        if (o.type === 'rob') { o.progress = (o.progress || 0) + 1; checkObj(q, o); }
      }
    }
  });
  on('squad:hired', () => {
    for (const q of quests) {
      if (q.state !== 'active') continue;
      for (const o of q.objectives) {
        if (o.done || o.type !== 'hire') continue;
        o.progress = squadAlive(G.player.squad || []);
        checkObj(q, o);
      }
    }
  });
  on('npc:killed', ({ entity }) => {
    if (!entity.ai || !entity.ai.caravanGuard) return;
    if (G.caravanAggro) return;
  });
}

function matchKill(o, entity) {
  if (o.faction && entity.faction !== o.faction) return false;
  if (o.role && entity.role !== o.role) return false;
  if (o.elite && !entity.elite) return false;
  return true;
}

function add(def) {
  const q = {
    id: 'q' + (questId++),
    title: def.title, desc: def.desc, faction: def.faction,
    objectives: (def.objectives || []).map((o, i) => ({ ...o, id: 'o' + i, done: false, progress: 0 })),
    reward: def.reward || {}, state: 'active', giver: def.giver || null,
    timeLimit: def.timeLimit || 0, timeLeft: def.timeLimit || 0, main: !!def.main,
    chainName: def.chainName || null, chainIndex: def.chainIndex || 0,
  };
  quests.push(q);
  emit('quest:new', { quest: q });
  G.audio.play('quest');
  notify(`Новое задание: ${q.title}`, 'good');
  if (q.main) banner(q.title);
  if (def.onStart) { try { def.onStart(); } catch (e) { console.error(e); } }
  return q;
}
function checkObj(q, o) {
  if (o.done) return;
  if ((o.progress || 0) >= (o.count || 1)) {
    o.done = true;
    emit('quest:objective', { quest: q, objective: o });
    notify(`Выполнено: ${o.text}`, 'good');
    G.audio.play('ui');
    if (q.objectives.every((x) => x.done)) complete(q);
  } else {
    emit('quest:progress', { quest: q, objective: o });
  }
}
function complete(q) {
  if (q.state !== 'active') return;
  q.state = 'done';
  const r = q.reward || {};
  if (r.gold) { gainGold(r.gold); }
  if (r.xp) addXP(r.xp);
  if (r.items) for (const it of r.items) addItem(it, 1);
  if (r.rep) for (const [f, v] of Object.entries(r.rep)) G.player.rep[f] = clamp((G.player.rep[f] || 0) + v, -100, 100);
  G.stats.questsDone++;
  G.audio.play('levelup');
  banner('ЗАДАНИЕ ВЫПОЛНЕНО');
  notify(`${q.title} — выполнено.${r.gold ? ` Награда: ${r.gold} золота.` : ''}`, 'good');
  emit('quest:done', { quest: q });
  // следующее звено цепочки
  if (q.chainName) start(q.chainName, q.chainIndex + 1);
  if (q.onDone) q.onDone();
}

export function start(chainName, index = 0) {
  const chain = CHAINS[chainName];
  if (!chain) return null;
  const def = chain[index];
  if (!def) return null;
  def.chainName = chainName;
  def.chainIndex = index;
  return add(def);
}

// ------------------------- цепочки заданий -------------------------
const CHAINS = {
  elf_main: [
    {
      title: 'Стража Луннолесья', faction: 'elves', main: true,
      desc: 'Старейшина просит проредить солдат Империи, что топчут наши тропы. Убей пятерых.',
      objectives: [{ text: 'Убить солдат Империи: 0/5', type: 'kill', faction: 'empire', count: 5 }],
      reward: { gold: 60, xp: 60, rep: { elves: 12, empire: -5 }, items: ['bandage'] },
    },
    {
      title: 'Долг корованов', faction: 'elves', main: true,
      desc: 'Люди везут через лес своё добро. Ограбь два корована — лес прокормит.',
      objectives: [{ text: 'Ограбить корованы: 0/2', type: 'rob', count: 2 }],
      reward: { gold: 90, xp: 80, rep: { elves: 10, empire: -8 }, items: ['arrows'] },
    },
    {
      title: 'Щит деревни', faction: 'elves', main: true,
      desc: 'Солдаты дворца идут на Луннолесье. Встреть их у деревни и отбрось.',
      objectives: [
        { text: 'Отбить налёт на Луннолесье', type: 'defend', place: 'elfvillage', count: 1 },
        { text: 'Убить налётчиков: 0/6', type: 'kill', faction: 'empire', count: 6 },
      ],
      reward: { gold: 140, xp: 140, rep: { elves: 16 }, items: ['elven_mail'] },
      onStart: () => spawnRaid('empire', 'elfvillage', 7),
    },
    {
      title: 'Свобода Луннолесья', faction: 'elves', main: true,
      desc: 'Пока стоит Чёрный Шпиль, лес не замирится. Убей Владыку Дрегара в его форте.',
      objectives: [{ text: 'Убить Владыку Дрегара', type: 'killboss', count: 1 }],
      reward: { gold: 400, xp: 400, rep: { elves: 25, villain: -20 }, items: ['gem'] },
      onDone: () => victory('elves'),
    },
  ],
  guard_main: [
    {
      title: 'Патруль стен', faction: 'empire', main: true,
      desc: 'Капитан Ратмир: «Обойди стены дворца, проверь посты». Четыре точки.',
      objectives: [
        { text: 'Северная стена', type: 'goto', target: 'palace', count: 1 },
        { text: 'Восточный мост', type: 'goto', target: 'bridge_e', count: 1 },
        { text: 'Казармы', type: 'goto', target: 'barracks', count: 1 },
        { text: 'Развалины у тракта', type: 'goto', target: 'ruins', count: 1 },
      ],
      reward: { gold: 45, xp: 40, rep: { empire: 10 } },
    },
    {
      title: 'Шпион в казармах', faction: 'empire', main: true,
      desc: 'В дворце видели лазутчика Дрегара. Найди и убей, пока он не ушёл.',
      objectives: [{ text: 'Убить шпиона', type: 'kill', faction: 'villain', role: 'spy', count: 1 }],
      reward: { gold: 80, xp: 70, rep: { empire: 12, villain: -6 }, items: ['potion_heal'] },
      onStart: () => { G.activeSpy = spawnSpy('palace', 'villain'); },
    },
    {
      title: 'Отпор партизанам', faction: 'empire', main: true,
      desc: 'Эльфийские партизаны жгут хутора у Тихого Брода. Иди к деревне и помоги ополчению.',
      objectives: [
        { text: 'Дойти до деревни Тихий Брод', type: 'goto', target: 'village', count: 1 },
        { text: 'Убить партизан: 0/5', type: 'kill', faction: 'elves', count: 5 },
      ],
      reward: { gold: 120, xp: 120, rep: { empire: 14, elves: -8 }, items: ['chain_armor'] },
      onStart: () => spawnRaid('elves', 'village', 6),
    },
    {
      title: 'Набег на Луннолесье', faction: 'empire', main: true,
      desc: 'Император велел проучить лес. Убей шестерых эльфов в их деревне.',
      objectives: [
        { text: 'Дойти до Луннолесья', type: 'goto', target: 'elfvillage', count: 1 },
        { text: 'Убить эльфов: 0/6', type: 'kill', faction: 'elves', count: 6 },
      ],
      reward: { gold: 180, xp: 160, rep: { empire: 16, elves: -10 }, items: ['steel_sword'] },
    },
    {
      title: 'Падение Чёрного Шпиля', faction: 'empire', main: true,
      desc: 'Сотня идёт на форт. Убей Владыку Дрегара и принеси Империи покой.',
      objectives: [{ text: 'Убить Владыку Дрегара', type: 'killboss', count: 1 }],
      reward: { gold: 500, xp: 450, rep: { empire: 30, villain: -25 }, items: ['gem', 'helmet_great'] },
      onDone: () => victory('guard'),
    },
  ],
  villain_main: [
    {
      title: 'Дань с тракта', faction: 'villain', main: true,
      desc: 'Твои шпионы доносят: корованы идут без должной охраны. Ограбь два и собери 200 золота.',
      objectives: [
        { text: 'Ограбить корованы: 0/2', type: 'rob', count: 2 },
        { text: 'Собрать 200 золота в казну', type: 'gold', count: 200 },
      ],
      reward: { gold: 100, xp: 80, rep: { villain: 10, empire: -8 } },
    },
    {
      title: 'Легион теней', faction: 'villain', main: true,
      desc: 'Найми в форте четырёх бойцов — с ними пойдёшь на дворец.',
      objectives: [{ text: 'Нанять отряд: 0/4', type: 'hire', count: 4 }],
      reward: { gold: 120, xp: 90, rep: { villain: 12 }, items: ['dark_crystal'] },
    },
    {
      title: 'Осада Златоверхого', faction: 'villain', main: true,
      desc: 'Веди отряд на дворец: убей восемь гвардейцев и их капитана, потом сядь на трон.',
      objectives: [
        { text: 'Дойти до дворца', type: 'goto', target: 'palace', count: 1 },
        { text: 'Убить гвардейцев: 0/8', type: 'kill', faction: 'empire', count: 8 },
        { text: 'Убить капитана Ратмира', type: 'kill', faction: 'empire', role: 'captain', count: 1 },
        { text: 'Водрузить знамя на трон', type: 'capture', count: 1 },
      ],
      reward: { gold: 600, xp: 500, rep: { villain: 30, empire: -30 }, items: ['gem'] },
      onDone: () => victory('villain'),
    },
    {
      title: 'Подмять Луннолесье', faction: 'villain', main: true,
      desc: 'Эльфы слишком дерзки. Убей их старейшину в Луннолесье.',
      objectives: [{ text: 'Убить старейшину эльфов', type: 'kill', faction: 'elves', role: 'elder', count: 1 }],
      reward: { gold: 260, xp: 220, rep: { villain: 18, elves: -20 }, items: ['elven_bow'] },
    },
  ],
};

// ------------------------- динамические приказы -------------------------
export function captainOrder() {
  const rnd = Math.random();
  if (rnd < 0.25) {
    const q = add({
      title: 'Приказ: обход тракта', faction: 'empire',
      desc: 'Капитан: «Пройди тракт до перекрёстка и обратно, доложи».',
      objectives: [{ text: 'Дойти до перекрёстка', type: 'goto', target: 'crossroad', count: 1 }],
      reward: { gold: 30, xp: 25, rep: { empire: 4 } },
    });
    return q;
  }
  if (rnd < 0.5) {
    spawnRaid('elves', 'village', 5);
    return add({
      title: 'Приказ: отбить налёт', faction: 'empire',
      desc: 'Капитан: «Эльфы лезут на деревню. Возьми людей и отбрось».',
      objectives: [{ text: 'Убить налётчиков: 0/4', type: 'kill', faction: 'elves', count: 4 }],
      reward: { gold: 55, xp: 45, rep: { empire: 6 } },
    });
  }
  if (rnd < 0.7) {
    spawnRaid('villain', 'village', 5);
    return add({
      title: 'Приказ: тени у деревни', faction: 'empire',
      desc: 'Капитан: «Легион Дрегара жжёт хутора. Иди и покажи им сталь».',
      objectives: [{ text: 'Убить легионеров: 0/4', type: 'kill', faction: 'villain', count: 4 }],
      reward: { gold: 60, xp: 50, rep: { empire: 6, villain: -3 } },
    });
  }
  return add({
    title: 'Приказ: караул', faction: 'empire',
    desc: 'Капитан: «Постой у ворот, гляди в оба».',
    objectives: [{ text: 'Постоять у ворот дворца', type: 'goto', target: 'palace', count: 1 }],
    reward: { gold: 22, xp: 18, rep: { empire: 3 } },
  });
}

export function elderOrder() {
  const rnd = Math.random();
  if (rnd < 0.4) {
    return add({
      title: 'Просьба старейшины: травы', faction: 'elves',
      desc: 'Старейшина: «Собери пять пучков трав в чаще, Ниэль заплатит».',
      objectives: [{ text: 'Собрать травы: 0/5', type: 'gather', item: 'herb', count: 5 }],
      reward: { gold: 40, xp: 35, rep: { elves: 6 }, items: ['potion_heal'] },
    });
  }
  if (rnd < 0.7) {
    spawnRaid('villain', 'elfvillage', 5);
    return add({
      title: 'Просьба старейшины: тени в лесу', faction: 'elves',
      desc: 'Старейшина: «Люди Дрегара жгут чащу. Прогони их».',
      objectives: [{ text: 'Убить легионеров: 0/4', type: 'kill', faction: 'villain', count: 4 }],
      reward: { gold: 70, xp: 60, rep: { elves: 8 }, items: ['arrows'] },
    });
  }
  return add({
    title: 'Просьба старейшины: разведка', faction: 'elves',
    desc: 'Старейшина: «Сходи к перевалу, глянь, не идёт ли Дрегар».',
    objectives: [{ text: 'Дойти до горного перевала', type: 'goto', target: 'pass', count: 1 }],
    reward: { gold: 35, xp: 30, rep: { elves: 5 } },
  });
}

export function onCaravanRobbed() { /* крючок для будущих заданий */ }

export function update(dt) {
  const p = G.player;
  if (!p) return;
  for (const q of quests) {
    if (q.state !== 'active') continue;
    if (q.timeLimit) {
      q.timeLeft -= dt;
      if (q.timeLeft <= 0) {
        q.state = 'failed';
        notify(`Провалено: ${q.title}`, 'bad');
      }
    }
    for (const o of q.objectives) {
      if (o.done) continue;
      if (o.type === 'defend') {
        // нужно быть рядом с местом и пережить налёт
        const place = placeNear(o.place);
        if (place && dist2D(p.pos.x, p.pos.z, place.x, place.z) < place.r + 60) {
          o.progress = 1;
          checkObj(q, o);
        }
      }
      if (o.type === 'gold') {
        if (p.gold >= o.count) { o.progress = o.count; checkObj(q, o); }
      }
      if (o.type === 'gather') {
        const have = p.inventory.filter((i) => i.id === o.item).reduce((a, b) => a + b.qty, 0);
        if (have >= o.count) { o.progress = o.count; checkObj(q, o); }
      }
    }
  }
}

function victory(faction) {
  if (G.victoryShown) return;
  G.victoryShown = true;
  const titles = {
    elves: 'Свобода Луннолесья',
    guard: 'Щит Империи',
    villain: 'Новый Владыка Златоверхого',
  };
  const texts = {
    elves: 'Чаща выстояла. Солдаты дворца отброшены, Владыка Дрегар мёртв, а твой народ снова хозяин в Луннолесье. Корованы на тракте платят лесу дань.',
    guard: 'Дворец стоит. Эльфийские партизаны отброшены, шпионы перевешаны, а Чёрный Шпиль пал под имперскими знамёнами. Император доволен — ты дослужился до Тысячника.',
    villain: 'Златоверхий пал. Знамя Дрегара висит над троном, гвардия Империи разбита, а капитан Ратмир лежит на ступенях. Мир узнал нового Владыку.',
  };
  emit('victory', { title: titles[faction], text: texts[faction], faction });
}

// ------------------------- диалоги -------------------------
export function dialogueFor(npc) {
  const p = G.player;
  const heroFaction = p.heroFaction;
  const lines = [];
  const opts = [];
  const role = npc.ai.role || npc.role;
  const shopForRole = (G.worldShops || []).find((s) => dist2D(s.x, s.z, npc.pos.x, npc.pos.z) < 6 && s.npcRole === npc.role);

  // роль-специфичное
  if (npc.role === 'captain' && heroFaction === 'guard') {
    lines.push('Капитан Ратмир хмурится: «Докладывай коротко. Служба — она не ждёт».');
    opts.push({ text: 'Есть ли приказ?', action: () => { captainOrder(); } });
    opts.push({ text: 'Что с моим званием?', action: () => { say(npc.name, `Ныне ты ${RANKS[G.playerRank]}. Служи — будет и повышение.`); } });
    opts.push({ text: 'Награда за службу?', action: () => { captainPay(); } });
  }
  if (npc.role === 'elder' && heroFaction === 'elf') {
    lines.push('Старейшина смотрит на тебя из-под седых бровей: «Лес слушает. Говори».');
    opts.push({ text: 'Что делать?', action: () => { elderOrder(); } });
    opts.push({ text: 'Как дела в деревне?', action: () => { say(npc.name, 'Деревня держится, пока есть такие, как ты. Дрегар шлёт тени, Империя — солдат.'); } });
  }
  if (npc.faction === 'villain' && heroFaction === 'villain' && npc.role !== 'dregar') {
    lines.push(`${npc.name} бьёт кулаком в грудь: «Владыка! Легион ждёт приказа».`);
    opts.push({ text: 'Нанять бойцов в отряд', action: () => { hireTroops(npc); } });
    opts.push({ text: 'Новости с гор', action: () => { say(npc.name, 'Эльфы шалят у перевала, а дворец богатеет. Пора напомнить о себе.'); } });
  }
  if (npc.role === 'dregar') {
    lines.push('Владыка Дрегар усмехается: «Ты пришёл в мой дом, герой? Что ж, слушаю».');
    opts.push({ text: 'Кто ты такой?', action: () => { say(npc.name, 'Я тот, кого боится Император и ненавидят эльфы. Скоро весь тракт будет мой.'); } });
  }
  // торг
  if (shopForRole) {
    opts.push({ text: `Торговать (${shopForRole.name})`, action: () => emit('ui:shop', shopForRole) });
  } else if (role === 'shopkeeper') {
    const s = (G.worldShops || []).find((sh) => dist2D(sh.x, sh.z, npc.pos.x, npc.pos.z) < 25);
    if (s) opts.push({ text: `Торговать (${s.name})`, action: () => emit('ui:shop', s) });
  }
  // слухи
  opts.push({ text: 'Что слышно?', action: () => { say(npc.name, rumor(npc)); } });
  // шпион
  if (npc.ai.spy && npc.ai.spy.talked) {
    lines.push('Он озирается: «Тише… Я здесь не просто так».');
    opts.push({ text: 'Ты шпион? Тогда умри!', action: () => { npc.ai.temporaryHostile = true; npc.ai.alert = 30; say(npc.name, 'Раскрыл! Ну держись!'); } });
  }
  // наём в отряд
  if (heroFaction === 'villain' && npc.faction === 'villain' && npc.ai.squad !== (G.player.squad)) {
    opts.push({ text: 'Вступить в мой отряд (120 золота)', action: () => { hireOne(npc); } });
  }
  if (npc.faction === 'empire' && heroFaction === 'guard' && npc.role === 'guard') {
    opts.push({ text: 'Приказ: следовать за мной', action: () => { followMe(npc); } });
  }
  // лечение и протезы через лекаря-НПС
  if (shopForRole && (shopForRole.kind === 'healer' || shopForRole.kind === 'prosthetic')) {
    opts.push({ text: shopForRole.kind === 'healer' ? 'Подлечить раны' : 'Поставить протез', action: () => emit('ui:shop', shopForRole) });
  }
  opts.push({ text: 'Прощай', action: () => emit('ui:closeDialogue') });

  if (!lines.length) {
    lines.push(greetLine(npc));
  }
  return { name: npc.name, role: roleName(npc), text: lines.join(' '), options: opts, npc };
}

function rumor(npc) {
  const pool = [
    'В горах у Дрегара собирается легион. Говорят, он сам смотрит на дворец.',
    'Корован с пряностями пойдёт по тракту — охрана небольшая.',
    'У костоправа в Тихом Броде появились железные руки. Дивно.',
    'Эльфы из чащи стреляют без промаха. Не лезь в лес без шлема.',
    'Император болен. Капитан Ратмир злее обычного.',
    'Ночью на тракте видели тени с чёрными знамёнами.',
    'Лекарь Веста берёт дорого, но штопает на совесть.',
    'Если потеряешь руку — не тяни: кровь уходит быстрее, чем кажется.',
  ];
  if (npc.faction === 'elves') pool.push('Древо помнит всё. И Дрегар это узнает.');
  if (npc.faction === 'villain') pool.push('Владыка обещал золото за голову капитана.');
  return pool[Math.floor(Math.random() * pool.length)];
}
function greetLine(npc) {
  const pool = {
    people: ['Доброго дня, путник.', 'Хлеб нынче дорог, а война — рядом.', 'Заходи, коли не грабить.'],
    empire: ['Служба идёт, всё спокойно.', 'Держись подальше от эльфийских стрел.', 'Империя не забывает своих.'],
    elves: ['Лес приветствует тебя.', 'Тише ступай, тут охотятся.', 'Ты пахнешь железом, человек.'],
    villain: ['Шевелись, легион не ждёт.', 'Кровь — она как дань. Платить надо.', 'Дрегар всё видит.'],
    bandits: ['Кошелёк-то при тебе?', 'Тут наши места, понял?', 'Дорога — она общая, а добро — моё.'],
  }[npc.faction] || ['Хм?'];
  return pool[Math.floor(Math.random() * pool.length)];
}
function roleName(npc) {
  return {
    captain: 'капитан дворцовой стражи', elder: 'старейшина Луннолесья', dregar: 'Владыка Дрегара',
    guard: 'гвардеец', archer: 'лучник', elf: 'эльф', elf_archer: 'эльфийский лучник', partisan: 'партизан',
    legion: 'легионер', brute: 'громила', dark_archer: 'тёмный лучник', spy: 'шпион',
    villager: 'селянин', merchant: 'купец', militia: 'ополченец', child: 'ребёнок',
    blacksmith: 'кузнец', trader: 'торговец', healer: 'лекарь', artificer: 'костоправ', innkeeper: 'кабатчик',
    banker: 'меняла', veteran: 'ветеран', fletcher: 'лучный мастер', herbalist: 'травница', slaver: 'работорговец',
    quartermaster: 'каптенармус', servant: 'слуга', taskmaster: 'надсмотрщик', slave: 'невольник',
  }[npc.role] || 'житель';
}

function captainPay() {
  const p = G.player;
  const pay = 10 + G.playerRank * 8;
  gainGold(pay);
  say('Ратмир', `Держи жалование: ${pay} золота. Не пропей всё.`);
}
function hireOne(npc) {
  const p = G.player;
  if (p.gold < 120) { notify('Нужно 120 золота.', 'bad'); return; }
  if (!p.squad) p.squad = createSquad('villain', p);
  if (p.squad.length >= 8) { notify('Отряд полон (8 бойцов).', 'bad'); return; }
  gainGold(-120);
  const e = npc;
  e.ai.squad = p.squad;
  e.ai.command = 'follow';
  e.ai.homeR = 400;
  p.squad.push(e);
  emit('squad:hired', { entity: e });
  notify(`${e.name} вступил в отряд.`, 'good');
  emit('squad:changed', {});
}
function hireTroops(npc) {
  const p = G.player;
  const costs = { legion: 120, dark_archer: 150, brute: 220 };
  emit('ui:squad', { npc, costs });
  void npc;
}
function followMe(npc) {
  const p = G.player;
  if (!p.squad) p.squad = createSquad('empire', p);
  if (p.squad.length >= 6) { notify('Больше людей капитан не даст.'); return; }
  npc.ai.squad = p.squad;
  npc.ai.command = 'follow';
  p.squad.push(npc);
  notify(`${npc.name} следует за тобой.`, 'good');
  emit('squad:changed', {});
}

// ------------------------- прочее -------------------------
export function patrolFor(placeId) {
  if (patrolSpots[placeId]) return patrolSpots[placeId];
  const place = placeNear(placeId);
  if (!place) return null;
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    pts.push({ x: place.x + Math.cos(a) * place.r * 0.7, z: place.z + Math.sin(a) * place.r * 0.7 });
  }
  patrolSpots[placeId] = pts;
  return pts;
}

export { quests, LANDMARKS, PLACES, commandSquad, fillSquad };
