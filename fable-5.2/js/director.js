// Режиссёр: население зон, набеги, приказы командира, задания, корованы, приказы войскам Злого.
import { G, FACTIONS, WAR, SITES, ITEMS, ROADS, SOUTH_ROAD, pathBetween, rnd, rndInt, pick, clamp } from './data.js';
import { NPC, Caravan } from './entities.js';
import { addItem, addXp } from './player.js';

const P = G.player;
const RANKS = ['Рядовой', 'Капрал', 'Сержант', 'Лейтенант', 'Капитан гвардии'];
export const rankName = () => RANKS[Math.min(P.rank, RANKS.length - 1)];
const GARRISON = { elf: 11, empire: 13, evil: 12 };
let respawnT = 0, raidT = 0, caravanT = 0, orderT = 0, repT = 0, importants = [];
G.raids = []; G.hired = 0; G.successes = 0;

function around(s, r0, r1) { const a = rnd(Math.PI * 2), r = rnd(r0, r1); return { x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r }; }
function spawnFighter(f, extra = {}) {
  const s = SITES[f], p = extra.at || around(s, 6, f === 'empire' ? 40 : 28);
  const kind = extra.kind || (Math.random() < 0.35 ? 'archer' : 'warrior');
  return new NPC({ faction: f, kind, x: p.x, z: p.z, hx: s.x, hz: s.z, hr: f === 'empire' ? 44 : f === 'elf' ? 45 : 30, garrison: true, ...extra });
}
function important(def) {
  const e = { def, npc: new NPC(def), deadT: 0 };
  importants.push(e); return e.npc;
}

export function populate() {
  importants = []; G.raids = []; G.mission = null; respawnT = 15; raidT = rnd(70, 110); caravanT = 3; orderT = 10;
  const poi = G.poi;
  // --- эльфы ---
  for (let i = 0; i < GARRISON.elf; i++) spawnFighter('elf', { kind: i < 5 ? 'archer' : 'warrior' });
  for (let i = 0; i < 5; i++) { const p = around({ x: -200, z: -200 }, 20, 130); new NPC({ faction: 'elf', kind: i % 2 ? 'archer' : 'warrior', x: p.x, z: p.z, hx: -200, hz: -200, hr: 130 }); }
  for (let i = 0; i < 4; i++) { const p = around(SITES.elf, 10, 40); new NPC({ faction: 'elf', kind: 'civilian', x: p.x, z: p.z, hx: SITES.elf.x, hz: SITES.elf.z, hr: 40, state: 'wander' }); }
  if (!G.leadersDead.elf) new NPC({ faction: 'elf', kind: 'leader', x: poi.elder.x, z: poi.elder.z, face: poi.elder.face, state: 'idle', role: 'elder', name: 'Владыка эльфов Элронд Лесной', hr: 6 });
  important({ faction: 'elf', kind: 'merchant', x: poi.elfshop.x, z: poi.elfshop.z, face: poi.elfshop.face, role: 'shop:elfshop', name: 'Травница Нимродэль' });
  // --- дворец ---
  for (let i = 0; i < GARRISON.empire; i++) spawnFighter('empire', { kind: i < 4 ? 'archer' : 'warrior' });
  const E = SITES.empire;
  for (const [dx, dz, f] of [[-59, -4, -1.57], [-59, 4, -1.57], [-4, -59, 3.14], [4, 59, 0]])
    new NPC({ faction: 'empire', kind: 'warrior', x: E.x + dx, z: E.z + dz, face: f, state: 'idle', hr: 8, name: 'Страж ворот' });
  if (!G.leadersDead.empire) new NPC({ faction: 'empire', kind: 'leader', x: poi.throne.x, z: poi.throne.z, face: poi.throne.face, state: 'idle', role: 'emperor', name: 'Император Всеслав IV', hr: 6 });
  important({ faction: 'empire', kind: 'commander', x: poi.commander.x, z: poi.commander.z, face: poi.commander.face, state: 'idle', role: 'commander', name: 'Командир стражи Бронислав', hr: 6 });
  important({ faction: 'empire', kind: 'merchant', x: poi.quarter.x, z: poi.quarter.z, face: poi.quarter.face, role: 'shop:quarter', name: 'Интендант Прокопий' });
  important({ faction: 'empire', kind: 'merchant', x: poi.medic.x, z: poi.medic.z, face: poi.medic.face, role: 'shop:medic', name: 'Лекарь Авиценнус' });
  // --- форт Злого ---
  const troops = GARRISON.evil + (P.faction === 'evil' ? G.hired : 0);
  for (let i = 0; i < troops; i++) spawnFighter('evil', { kind: i % 3 === 0 ? 'archer' : 'warrior' });
  if (P.faction !== 'evil' && !G.leadersDead.evil) new NPC({ faction: 'evil', kind: 'leader', x: poi.evilThrone.x, z: poi.evilThrone.z, face: poi.evilThrone.face, state: 'idle', role: 'evilboss', name: 'Злой (имя не придумано)', hr: 8, hpMul: 1.25 });
  important({ faction: 'evil', kind: 'merchant', x: poi.dealer.x, z: poi.dealer.z, face: poi.dealer.face, role: 'shop:dealer', name: 'Барыга Гнилозуб' });
  important({ faction: 'evil', kind: 'merchant', x: poi.bones.x, z: poi.bones.z, face: poi.bones.face, role: 'shop:bones', name: 'Костоправ Хрясь' });
  // --- город людей ---
  const H = SITES.human;
  for (let i = 0; i < 6; i++) { const p = around(H, 8, 45); new NPC({ faction: 'human', kind: i < 2 ? 'archer' : 'warrior', x: p.x, z: p.z, hx: H.x, hz: H.z, hr: 50, name: 'Ополченец' }); }
  const mn = { smith: 'Оружейник Кузьма', armorer: 'Бронник Потап', alch: 'Алхимик-лекарь Парацельс', prosth: 'Мастер протезов Левша', trader: 'Купец Садко' };
  for (const s of poi.stalls) important({ faction: 'human', kind: 'merchant', x: s.x, z: s.z, face: s.face, role: 'shop:' + s.kind, name: mn[s.kind] });
  important({ faction: 'human', kind: 'merchant', x: poi.tavern.x, z: poi.tavern.z, face: poi.tavern.face, role: 'shop:tavern', name: 'Трактирщик Фома' });
  for (let i = 0; i < 10; i++) { const p = around(H, 6, 70); new NPC({ faction: 'human', kind: 'civilian', x: p.x, z: p.z, hx: H.x, hz: H.z, hr: 70, state: 'wander' }); }
  spawnCaravan(); spawnCaravan(); spawnCaravan();
  if (P.faction === 'evil') applyEvilOrder();
}

// ---------- корованы ----------
function spawnCaravan() {
  const have = new Set(G.caravans.map(c => c.faction));
  const opts = ['human', 'empire', 'evil', 'elf'].filter(f => !have.has(f));
  if (!opts.length) return;
  const f = pick(opts);
  let path;
  if (f === 'human') path = SOUTH_ROAD.slice(1).map(q => ({ x: q[0], z: q[1] }));   // не через колодец на площади
  else path = pathBetween(f, 'human').slice(0, -1);
  if (f !== 'human') path[0] = { x: ROADS[f][1][0], z: ROADS[f][1][1] };      // старт у ворот, а не внутри
  if (Math.random() < 0.5) path.reverse();
  // не спавним прямо на глазах у игрока
  if (Math.hypot(path[0].x - P.pos.x, path[0].z - P.pos.z) < 60) path.reverse();
  if (G.caravans.some(c => Math.hypot(c.pos.x - path[0].x, c.pos.z - path[0].z) < 40)) return;   // место занято — попробуем позже
  new Caravan(f, path, f === 'empire' ? 4 : 3);
}

// ---------- набеги ----------
export function launchRaid(from, to, size, o = {}) {
  let path = pathBetween(from, to);
  if (o.fromHub) path = ROADS[to].slice().reverse().map(q => ({ x: q[0], z: q[1] }));
  const raid = { from, to, members: [], t: 0, near: false, tag: o.tag || 'raid' };
  const s = path[0], T = SITES[to];
  for (let i = 0; i < size; i++) {
    const n = new NPC({ faction: from, kind: i % 3 === 2 ? 'archer' : 'warrior', x: s.x + rnd(-6, 6), z: s.z + rnd(-6, 6), state: 'path', tag: raid.tag });
    n.path = path; n.pi = 1; n.pathSpeed = 0.95; n.off = { x: rnd(-4, 4), z: rnd(-4, 4) };
    n.onArrive = m => { m.home = { x: T.x, z: T.z, r: 30 }; m.state = 'wander'; };
    if (o.name) n.name = n.name.replace(/,.*/, ', ' + o.name);
    raid.members.push(n);
  }
  G.raids.push(raid);
  return raid;
}
function updateRaids(dt) {
  for (let i = G.raids.length - 1; i >= 0; i--) {
    const r = G.raids[i]; r.t += dt;
    const alive = r.members.filter(n => n.alive);
    const T = SITES[r.to];
    if (!r.near && alive.some(n => Math.hypot(n.pos.x - T.x, n.pos.z - T.z) < 130)) {
      r.near = true;
      if (r.to === P.faction) { G.ui.msg(`⚔ ${FACTIONS[r.from].name} набигают на ${T.name}! К оружию!`, 'bad'); G.sfx('horn'); }
    }
    if (!alive.length) {
      G.raids.splice(i, 1);
      if (r.to === P.faction && Math.hypot(P.pos.x - T.x, P.pos.z - T.z) < 170 && !(G.mission && G.mission.raid === r)) {
        const g = rndInt(30, 60); P.gold += g; addXp(50); G.ui.msg(`Набег отбит! Награда: ${g} зол.`, 'good');
      }
      r.over = true;
    } else if (r.t > 480 && !r.retreat) {
      r.retreat = true;
      const back = pathBetween(r.to, r.from);
      for (const n of alive) { n.state = 'path'; n.path = back; n.pi = 1; n.target = null; n.onArrive = m => m.remove(); }
    } else if (r.retreat && r.t > 900) { alive.forEach(n => n.remove()); }
  }
}
function scheduleRaid() {
  const pf = P.faction;
  let to, from;
  if (Math.random() < (pf === 'elf' ? 0.6 : 0.45)) to = pf; else to = pick(WAR);
  const cand = WAR.filter(f => f !== to);
  from = pf === 'evil' && to === 'evil' && Math.random() < 0.7 ? 'elf' : pick(cand);
  if (from === pf) {
    // наш собственный набег: зовём игрока
    launchRaid(from, to, 6);
    G.ui.msg(`Наши выступили в набег: цель — ${SITES[to].name}. Можно присоединиться!`, 'info');
    return;
  }
  const size = clamp((G.leadersDead[from] ? 3 : 4) + Math.floor(G.day / 2) + rndInt(0, 2), 3, 8);
  const name = from === 'elf' ? (to === 'evil' ? 'партизан' : 'лазутчик') : undefined;
  const raid = launchRaid(from, to, size, { fromHub: to === pf, name });
  if (to === pf) {
    G.ui.msg(`Разведка: ${FACTIONS[from].name} идут на ${SITES[to].name} (${size} бойцов).`, 'bad');
    if (!G.mission) startMission({ type: 'defend', raid, title: pf === 'empire' ? 'Приказ: защищать дворец!' : `Защити: ${SITES[to].name}`, desc: `Враг (${FACTIONS[from].short}) идёт от перекрёстка. Перебей налётчиков.`, target: SITES[to], reward: { gold: 50, xp: 80 }, order: pf === 'empire' });
  }
}

// ---------- задания и приказы ----------
function startMission(m) {
  m.progress = m.progress || 0; G.mission = m;
  G.ui.msg(`${m.order ? '📜 Командир' : '📜 Задание'}: ${m.title}`, 'info'); G.sfx('quest');
}
function squad(n, tag = 'squad') {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const m = new NPC({ faction: P.faction, kind: i % 3 === 0 ? 'archer' : 'warrior', x: P.pos.x + Math.cos(a) * 4, z: P.pos.z + Math.sin(a) * 4, state: 'follow', tag });
    m.leader = P; m.off = { x: Math.cos(a) * 3.5, z: Math.sin(a) * 3.5 }; out.push(m);
  }
  return out;
}
function makeMission(type) {
  const pf = P.faction, base = SITES[pf], order = pf === 'empire';
  if (type === 'patrol') {
    const pts = [[-72, 0], [0, -72], [72, 0], [0, 72]].map(q => ({ x: base.x + q[0], z: base.z + q[1] }));
    const k = rndInt(0, 3); const pts2 = pts.slice(k).concat(pts.slice(0, k));
    return { type, title: 'Приказ: обойти стены дозором', desc: 'Обойди все четыре поста у ворот дворца.', pts: pts2, goal: 4, target: pts2[0], t: 240, reward: { gold: 30, xp: 40 }, order };
  }
  if (type === 'spy') {
    const ef = pick(WAR.filter(f => f !== pf)), p = around(base, pf === 'empire' ? 88 : 80, 115), spies = [];
    for (let i = 0; i < 2; i++) { const n = new NPC({ faction: ef, kind: i ? 'warrior' : 'archer', x: p.x + i * 2, z: p.z, hx: p.x, hz: p.z, hr: 12, tag: 'spy' }); n.name = n.name.replace(/,.*/, ef === 'elf' ? ', шпион эльфов' : ', лазутчик'); spies.push(n); }
    return { type, title: order ? 'Приказ: найти и убить шпионов' : 'Убей вражеских лазутчиков', desc: `Возле базы замечены шпионы (${FACTIONS[ef].short}). Найди их по метке на карте.`, spies, goal: 2, target: p, t: 260, reward: { gold: 45, xp: 70 }, order };
  }
  if (type === 'kill') {
    const ef = pick(WAR.filter(f => f !== pf));
    return { type, faction: ef, title: `${order ? 'Приказ: н' : 'Н'}абег — ${SITES[ef].name}`, desc: `Иди с отрядом и убей 5 врагов (${FACTIONS[ef].short}). Считаются и убийства отряда рядом с тобой.`, goal: 5, target: SITES[ef], t: 780, squad: squad(4), reward: { gold: 90, xp: 150 }, order };
  }
  if (type === 'rob') return { type, title: 'Ограбь корован', desc: 'Найди на дороге чужой корован (жёлтый квадрат на карте), перебей охрану и забери груз.', goal: 1, t: 600, reward: { gold: 40, xp: 100 }, order: false };
  if (type === 'defend') {
    const ef = pick(WAR.filter(f => f !== pf));
    const raid = launchRaid(ef, pf, clamp(4 + Math.floor(G.day / 2), 4, 7), { fromHub: true });
    return { type, raid, title: order ? 'Приказ: защищать дворец!' : `Защити: ${base.name}`, desc: `Отряд (${FACTIONS[ef].short}) идёт на нас от перекрёстка. Перебей налётчиков.`, target: base, reward: { gold: 50, xp: 80 }, order };
  }
}
export function giveOrder() {
  if (G.mission) return;
  const types = P.faction === 'empire' ? ['patrol', 'spy', 'kill', 'defend', 'spy', 'patrol'] : ['rob', 'spy', 'kill', 'defend', 'rob'];
  let t = pick(types);
  if (P.faction === 'empire' && G.successes === 0) t = 'patrol';
  startMission(makeMission(t));
}
function endMission(ok, why) {
  const m = G.mission; if (!m) return;
  G.mission = null;
  if (m.squad) for (const n of m.squad) if (n.alive) { n.leader = null; n.state = 'wander'; const s = SITES[P.faction]; n.home = { x: s.x, z: s.z, r: 35 }; n.garrison = true; }
  if (ok) {
    const pay = m.reward.gold + (m.order ? P.rank * 15 : 0);
    P.gold += pay; addXp(m.reward.xp); G.successes++;
    G.ui.msg(`✔ ${m.order ? 'Приказ выполнен' : 'Задание выполнено'}! Награда: ${pay} зол.`, 'good'); G.sfx('level');
    if (m.order && G.successes % 3 === 0 && P.rank < RANKS.length - 1) { P.rank++; G.ui.msg(`Тебя повысили! Новое звание: ${rankName()}.`, 'good'); }
  } else {
    G.ui.msg(`✘ ${m.order ? 'Приказ провален' : 'Задание провалено'}${why ? ': ' + why : ''}.`, 'bad');
    if (m.order) {
      P.discipline--;
      const fine = Math.min(P.gold, 20); P.gold -= fine;
      if (P.discipline <= 0) { P.discipline = 3; if (P.rank > 0) P.rank--; const f2 = Math.floor(P.gold / 2); P.gold -= f2; G.ui.msg(`Командир в ярости: гауптвахта, штраф ${fine + f2} зол.${P.rank >= 0 ? ' Звание: ' + rankName() + '.' : ''}`, 'bad'); }
      else G.ui.msg(`Командир недоволен. Штраф ${fine} зол. Дисциплина: ${P.discipline}/3`, 'bad');
    }
  }
  orderT = rnd(25, 45);
}
function updateMission(dt) {
  const m = G.mission;
  if (!m) {
    if (P.faction === 'empire' && P.alive && importants.some(e => e.def.role === 'commander' && e.npc.alive)) { orderT -= dt; if (orderT <= 0) giveOrder(); }
    return;
  }
  if (m.t !== undefined) { m.t -= dt; if (m.t <= 0) return endMission(false, 'время вышло'); }
  if (m.type === 'patrol') {
    const p = m.pts[m.progress];
    if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 9) { m.progress++; G.sfx('coin'); if (m.progress >= m.goal) return endMission(true); m.target = m.pts[m.progress]; G.ui.msg(`Пост ${m.progress}/${m.goal} проверен.`); }
  } else if (m.type === 'spy') {
    m.progress = m.spies.filter(n => !n.alive).length;
    const live = m.spies.find(n => n.alive); if (live) m.target = { x: live.pos.x, z: live.pos.z };
    if (m.progress >= m.goal) endMission(true);
  } else if (m.type === 'defend') {
    const alive = m.raid.members.filter(n => n.alive).length;
    m.left = alive;
    if (m.raid.over || !alive) endMission(true); else if (m.raid.retreat) endMission(true);
  } else if (m.progress >= m.goal) endMission(true);
}

// ---------- приказы войскам Злого ----------
export const EVIL_ORDERS = {
  hold: 'Оборонять форт', follow: 'За мной!', attack_empire: 'В атаку на дворец!', attack_elf: 'В атаку на эльфов!', ambush: 'Засада на перекрёстке (грабить корованы)',
};
function orderNpc(n) {
  const o = G.evilOrder, F = SITES.evil;
  n.leader = null; n.path = null; n.onArrive = null;
  if (o === 'hold') { n.state = 'wander'; n.home = { x: F.x, z: F.z, r: 30 }; }
  else if (o === 'follow') { n.state = 'follow'; n.leader = P; const a = rnd(Math.PI * 2), r = rnd(2.5, 7); n.off = { x: Math.cos(a) * r, z: Math.sin(a) * r }; }
  else {
    const to = o === 'attack_empire' ? 'empire' : o === 'attack_elf' ? 'elf' : 'hub';
    const path = to === 'hub' ? ROADS.evil.map(q => ({ x: q[0], z: q[1] })) : pathBetween('evil', to);
    let bi = 0, bd = 1e9; path.forEach((p, i) => { const d = Math.hypot(p.x - n.pos.x, p.z - n.pos.z); if (d < bd) { bd = d; bi = i; } });
    n.state = 'path'; n.path = path; n.pi = bi; n.pathSpeed = 1; n.off = { x: rnd(-4, 4), z: rnd(-4, 4) };
    const T = SITES[to];
    n.onArrive = m => { m.home = { x: T.x, z: T.z, r: to === 'hub' ? 35 : 30 }; m.state = 'wander'; };
  }
}
export function applyEvilOrder(o) {
  if (o) G.evilOrder = o;
  let c = 0;
  for (const n of G.npcs) if (n.alive && n.faction === 'evil' && n.garrison && n.combatant) { orderNpc(n); c++; }
  return c;
}
export function hireMinion() {
  if (P.gold < 60) { G.ui.msg('Не хватает золота (нужно 60).', 'bad'); return false; }
  if (G.hired >= 12) { G.ui.msg('Форт больше не вместит бойцов.', 'bad'); return false; }
  P.gold -= 60; G.hired++;
  const n = spawnFighter('evil', { at: { x: G.poi.dealer.x + rnd(-3, 3), z: G.poi.dealer.z + rnd(3, 6) } });
  orderNpc(n); G.ui.msg(`Нанят боец: ${n.name}. Войско: ${evilTroops()}`, 'good'); G.sfx('coin');
  return true;
}
export const evilTroops = () => G.npcs.filter(n => n.alive && n.faction === 'evil' && n.garrison && n.combatant).length;

// ---------- события ----------
G.provoke = function (n) {
  n.provoked = true;
  P.repHuman -= 8;
  for (const m of G.npcs) if (m.faction === 'human' && m.combatant && ((n.group && m.group === n.group) || (!n.group && !m.group && Math.hypot(m.pos.x - n.pos.x, m.pos.z - n.pos.z) < 45))) { m.provoked = true; m.target = P; }
  G.ui.msg('Ты напал на вольных людей! Репутация падает — стража этого не простит.', 'bad');
};
G.onKill = function (n, attacker) {
  const byP = attacker && attacker.isPlayer;
  const ally = attacker && !attacker.isPlayer && attacker.faction === P.faction && Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) < 70;
  if (byP) {
    G.stats.kills++;
    addXp({ warrior: 25, archer: 22, civilian: 4, merchant: 8, commander: 120, leader: 300 }[n.kind]);
    if (n.faction === 'human') { P.repHuman -= 25; }
  }
  const m = G.mission;
  if (m && m.type === 'kill' && n.faction === m.faction && (byP || ally)) m.progress++;
  if (n.kind === 'leader') {
    G.leadersDead[n.faction] = true;
    G.ui.msg(`☠ ${n.name} пал! ${FACTIONS[n.faction].name}: войско обезглавлено.`, n.faction === P.faction ? 'bad' : 'good');
    G.sfx('horn');
    const enemies = WAR.filter(f => f !== P.faction);
    if (!G.won && enemies.every(f => G.leadersDead[f])) { G.won = true; G.ui.victory(); }
  }
};
G.onRob = function (c) {
  const loot = c.rob();
  P.gold += loot.gold;
  const parts = [`${loot.gold} зол.`];
  for (const id in loot.items) { addItem(id, loot.items[id]); parts.push(`${ITEMS[id].name} ×${loot.items[id]}`); }
  G.stats.robbed++; addXp(60);
  if (c.faction === 'human') { P.repHuman -= 30; }
  G.ui.msg(`💰 Корован ограблен! Добыча: ${parts.join(', ')}`, 'good'); G.sfx('coin');
  const m = G.mission; if (m && m.type === 'rob') m.progress++;
};

export function updateDirector(dt) {
  updateRaids(dt); updateMission(dt);
  raidT -= dt; if (raidT <= 0) { raidT = rnd(150, 230); scheduleRaid(); }
  caravanT -= dt; if (caravanT <= 0) { caravanT = rnd(35, 60); if (G.caravans.length < 4) spawnCaravan(); }
  repT += dt;
  if (repT > 12) {
    repT = 0;
    if (P.repHuman < 0) P.repHuman++;
    if (P.repHuman > -20) for (const n of G.npcs) if (n.faction === 'human' && n.provoked && n.target !== P) n.provoked = false;
  }
  respawnT -= dt;
  if (respawnT <= 0) {
    respawnT = 22;
    for (const f of WAR) {
      const have = G.npcs.reduce((c, n) => c + (n.alive && n.faction === f && n.garrison && n.combatant ? 1 : 0), 0);
      let want = GARRISON[f] + (f === 'evil' && P.faction === 'evil' ? G.hired : 0);
      if (G.leadersDead[f]) want = Math.ceil(want * 0.5);
      const s = SITES[f];
      if (have < want && (f === P.faction || Math.hypot(P.pos.x - s.x, P.pos.z - s.z) > 70 || Math.random() < 0.3)) {
        const n = spawnFighter(f, { at: around(s, 4, 14) });
        if (f === 'evil' && P.faction === 'evil') orderNpc(n);
      }
    }
    const militia = G.npcs.reduce((c, n) => c + (n.alive && n.faction === 'human' && n.combatant && !n.group ? 1 : 0), 0);
    if (militia < 6 && Math.hypot(P.pos.x - SITES.human.x, P.pos.z - SITES.human.z) > 80) { const p = around(SITES.human, 8, 40); new NPC({ faction: 'human', kind: 'warrior', x: p.x, z: p.z, hx: SITES.human.x, hz: SITES.human.z, hr: 50, name: 'Ополченец' }); }
    for (const e of importants) {
      if (e.npc.alive) continue;
      e.deadT += 22;
      if (e.deadT > 110 && Math.hypot(P.pos.x - e.def.x, P.pos.z - e.def.z) > 50) {
        e.npc = new NPC({ ...e.def, name: e.def.name.replace(/ [^ ]+$/, ' ' + pick(['Младший', 'Второй', 'Новый', 'Сменщик'])) }); e.deadT = 0;
        if (e.def.role === 'commander' && P.faction === 'empire') G.ui.msg('Во дворце назначен новый командир стражи.', 'info');
      }
    }
  }
}

// ---------- разговоры ----------
export function talk(n) {
  const role = n.role, ui = G.ui;
  if (role.startsWith('shop:')) return ui.shop(role.slice(5), n);
  if (role === 'elder') {
    const m = G.mission;
    const opts = [];
    if (!m) opts.push({ label: 'Есть ли дело для меня, Владыка?', fn: () => { giveOrder(); ui.close(); } });
    else opts.push({ label: `Отказаться от задания «${m.title}»`, fn: () => { endMission(false, 'ты отказался'); ui.close(); } });
    opts.push({ label: 'Что происходит в лесу?', fn: () => ui.dialog(n.name, 'Солдаты дворца и орды Злого набигают на наши деревяные домики. Мы отвечаем партизанскими вылазками и грабим их корованы. Убей Императора и Злого — и лес будет свободен.', [{ label: 'Понятно', fn: ui.close }]) });
    opts.push({ label: 'Уйти', fn: ui.close });
    return ui.dialog(n.name, m ? `Твоё задание: ${m.title}. Ступай, дитя леса.` : 'Приветствую, страж леса. Лес густ, но враги уже у опушки.', opts);
  }
  if (role === 'commander') {
    const m = G.mission;
    const opts = [];
    if (!m) opts.push({ label: 'Жду приказаний!', fn: () => { giveOrder(); ui.close(); } });
    opts.push({ label: 'Так точно! (уйти)', fn: ui.close });
    return ui.dialog(n.name, `${rankName()}! ${m ? 'У тебя приказ: «' + m.title + '». Выполнять!' : 'Стой смирно и жди приказа.'}\nДисциплина: ${P.discipline}/3. Выполнено приказов: ${G.successes}. Жалованье растёт со званием. Невыполнение приказа — штраф и гауптвахта.`, opts);
  }
  if (role === 'emperor') return ui.dialog(n.name, 'Служи верно, стражник. Слушайся командира, береги дворец от Злого, от шпионов и партизан эльфов. Империя тебя не забудет.', [{ label: 'Слава Императору!', fn: ui.close }]);
}

export function serializeWorld() {
  return { dayTime: G.dayTime, day: G.day, leadersDead: G.leadersDead, evilOrder: G.evilOrder, stats: G.stats, hired: G.hired, successes: G.successes, won: G.won };
}
export function loadWorld(o) {
  G.dayTime = o.dayTime; G.day = o.day; G.leadersDead = o.leadersDead; G.evilOrder = o.evilOrder || 'hold'; G.stats = o.stats; G.hired = o.hired || 0; G.successes = o.successes || 0; G.won = !!o.won;
}
export function resetWorld() {
  G.dayTime = 0.3; G.day = 1; G.leadersDead = { elf: false, empire: false, evil: false }; G.evilOrder = 'hold'; G.stats = { kills: 0, robbed: 0 }; G.hired = 0; G.successes = 0; G.won = false; G.mission = null;
}
