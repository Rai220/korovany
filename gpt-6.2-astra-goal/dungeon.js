'use strict';

const chamberStep = 3.4;
const underways = {
  palace: {
    name: 'Затопленный склеп',
    gateName: 'Решётка усыпальницы',
    switchName: 'Колесо старого шлюза',
    relic: 'Ларец полкового врача',
    relicText:
      'Под вощеной тканью сохранились четыре перевязи, серебро на жалованье и бронзовая печать врача.',
    mark: 'Печать полкового врача',
    reward: 36,
    bandages: 4,
    arrows: 0,
    rooms: [
      [2, 9, 5, 13],
      [1, 2, 7, 6],
      [8, 8, 12, 11],
      [11, 2, 15, 6],
    ],
    passages: [
      [3, 6, 3, 10],
      [4, 10, 9, 10],
      [7, 5, 9, 5],
      [9, 5, 9, 9],
      [7, 3, 12, 3],
    ],
    start: [3, 12],
    handle: [2, 3],
    gate: [9, 3],
    relicAt: [14, 4],
    spawns: [
      ['hound', 3, 7],
      ['weaver', 10, 10],
      ['weaver', 6, 4],
      ['sentinel', 12, 4],
    ],
  },
  fort: {
    name: 'Шахты Чёрной жилы',
    gateName: 'Подъёмные ворота штрека',
    switchName: 'Лебёдка горного мастера',
    relic: 'Сундук разведочной партии',
    relicText:
      'В двойном дне лежали жалованье рудокопов, восемнадцать стрел и карта потерянной серебряной жилы.',
    mark: 'Карта Чёрной жилы',
    reward: 56,
    bandages: 0,
    arrows: 18,
    rooms: [
      [1, 10, 5, 13],
      [1, 5, 5, 8],
      [9, 7, 13, 11],
      [10, 1, 15, 5],
    ],
    passages: [
      [3, 7, 3, 11],
      [4, 7, 10, 7],
      [3, 3, 3, 5],
      [3, 3, 11, 3],
      [5, 12, 11, 12],
      [11, 10, 11, 12],
    ],
    start: [3, 12],
    handle: [12, 9],
    gate: [7, 3],
    relicAt: [14, 2],
    spawns: [
      ['hound', 3, 7],
      ['weaver', 8, 7],
      ['hound', 10, 11],
      ['sentinel', 12, 3],
    ],
  },
};
const bestiary = {
  hound: {
    name: 'Рудная гончая',
    hp: 54,
    speed: 2.25,
    reach: 1.68,
    wind: 0.58,
    power: 9,
    radius: 0.39,
    top: 1.18,
  },
  weaver: {
    name: 'Пещерный ткач',
    hp: 45,
    speed: 1.65,
    reach: 1.92,
    wind: 0.85,
    power: 11,
    radius: 0.52,
    top: 1.04,
  },
  sentinel: {
    name: 'Костяной страж',
    hp: 118,
    speed: 1.22,
    reach: 2.3,
    wind: 1.15,
    power: 17,
    radius: 0.6,
    top: 2.4,
  },
};
function dungeonPoint(pair) {
  return { x: pair[0] * chamberStep, z: pair[1] * chamberStep };
}
function tileKey(x, z) {
  return x + ',' + z;
}
function dungeonCell(x, z) {
  return [Math.round(x / chamberStep), Math.round(z / chamberStep)];
}
for (const d of Object.values(underways)) {
  d.tiles = new Set();
  for (const [x1, z1, x2, z2] of [...d.rooms, ...d.passages])
    for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) d.tiles.add(tileKey(x, z));
  d.gateKey = tileKey(...d.gate);
}
function dungeonState() {
  const id = game.dungeon,
    d = underways[id];
  game.undercrofts ||= {};
  return (game.undercrofts[id] ||= {
    unlocked: false,
    lift: 0,
    claimed: false,
    seen: [],
    foes: d.spawns.map(([kind, col, row], index) => {
      const p = dungeonPoint([col, row]);
      return {
        ...p,
        id: index + 1,
        kind,
        team: 'hostile',
        hp: bestiary[kind].hp,
        maxHp: bestiary[kind].hp,
        yaw: index * 0.8,
        cd: 1.2,
        windup: 0,
        stagger: 0,
        walk: false,
        alert: 0,
      };
    }),
  });
}
function dungeonPlayer() {
  return { x: game.roomX, z: game.roomZ };
}
function enterDungeon(id) {
  if (!underways[id] || game.inside !== id || game.dungeon) return;
  game.dungeonReturn = { x: game.roomX, z: game.roomZ, yaw: game.yaw };
  game.dungeon = id;
  const p = dungeonPoint(underways[id].start);
  Object.assign(game, {
    roomX: p.x,
    roomZ: p.z,
    yaw: 0,
    pitch: 0,
    air: 0,
    vy: 0,
    arrow: null,
    evade: 0,
    blockTime: 0,
  });
  keys.clear();
  swing = 0;
  dungeonState();
  chapter(underways[id].name, 'Подземный ход');
  discoverChamber();
  notify('M — план подземелья. E у лестницы — вернуться.', 3.5);
  checkpoint();
  drawHud();
}
function leaveDungeon() {
  const p = game.dungeonReturn || { x: -4.6, z: -6, yaw: Math.PI };
  Object.assign(game, {
    dungeon: null,
    dungeonReturn: null,
    roomX: p.x,
    roomZ: p.z,
    yaw: p.yaw,
    pitch: 0,
    air: 0,
    vy: 0,
    arrow: null,
    blockTime: 0,
    evade: 0,
  });
  keys.clear();
  swing = 0;
  checkpoint();
  drawHud();
  notify(houses[game.inside].name);
}
function validDungeonSave(s) {
  if (
    s.undercrofts &&
    (typeof s.undercrofts !== 'object' ||
      Array.isArray(s.undercrofts) ||
      Object.entries(s.undercrofts).some(
        ([id, record]) =>
          !Object.hasOwn(underways, id) ||
          !record ||
          typeof record.unlocked !== 'boolean' ||
          typeof record.claimed !== 'boolean' ||
          (record.lift != null && (!Number.isFinite(record.lift) || record.lift < 0 || record.lift > 1)) ||
          !Array.isArray(record.seen) ||
          !Array.isArray(record.foes) ||
          record.foes.length !== underways[id].spawns.length ||
          !record.foes.every(
            (a) =>
              a &&
              Object.hasOwn(bestiary, a.kind) &&
              [a.x, a.z, a.hp, a.id, a.yaw, a.windup, a.cd].every(Number.isFinite),
          ),
      ))
  )
    return false;
  if (!s.dungeon) return true;
  const d = underways[s.dungeon],
    record = s.undercrofts?.[s.dungeon];
  return (
    !!d &&
    !!record &&
    s.inside === s.dungeon &&
    Number.isFinite(s.roomX) &&
    Number.isFinite(s.roomZ) &&
    d.tiles.has(tileKey(...dungeonCell(s.roomX, s.roomZ)))
  );
}
function tileIsOpen(d, state, c, r) {
  const k = tileKey(c, r);
  return d.tiles.has(k) && (k !== d.gateKey || state.unlocked);
}
function gateLift(state) {
  const fraction = state.unlocked ? clamp(state.lift ?? 1, 0, 1) : 0;
  return fraction * fraction * (3 - 2 * fraction);
}
function dungeonFree(x, z, r = 0) {
  const d = underways[game.dungeon],
    state = dungeonState();
  for (const dx of [-r, r])
    for (const dz of [-r, r]) if (!d.tiles.has(tileKey(...dungeonCell(x + dx, z + dz)))) return false;
  const gate = dungeonPoint(d.gate);
  return (
    gateLift(state) * 3.95 >= 1.85 ||
    Math.abs(x - gate.x) > r + 0.085 ||
    Math.abs(z - gate.z) > r + chamberStep / 2
  );
}
function dungeonSight(a, b) {
  const gate = dungeonPoint(underways[game.dungeon].gate);
  if (gateLift(dungeonState()) * 3.95 < 1.85 && (a.x - gate.x) * (b.x - gate.x) < 0) {
    const crossing = (gate.x - a.x) / (b.x - a.x);
    if (Math.abs(a.z + (b.z - a.z) * crossing - gate.z) < chamberStep / 2) return false;
  }
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.55);
  for (let j = 1; j < n; j++)
    if (!dungeonFree(a.x + ((b.x - a.x) * j) / n, a.z + ((b.z - a.z) * j) / n)) return false;
  return true;
}
function dungeonPath(d, state, start, end) {
  const sk = tileKey(...start),
    ek = tileKey(...end),
    prev = new Map([[sk, null]]),
    q = [start];
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i],
      key = tileKey(x, z);
    if (key === ek) break;
    for (const [dx, dz] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = tileKey(nx, nz);
      if (!prev.has(k) && tileIsOpen(d, state, nx, nz)) {
        prev.set(k, key);
        q.push([nx, nz]);
      }
    }
  }
  if (!prev.has(ek) || sk === ek) return [];
  const path = [];
  for (let k = ek; k !== sk; k = prev.get(k)) path.push(k.split(',').map(Number));
  return path.reverse();
}
function discoverChamber() {
  const d = underways[game.dungeon],
    state = dungeonState(),
    p = dungeonPlayer(),
    [col, row] = dungeonCell(p.x, p.z);
  const key = tileKey(col, row);
  if (state.lastSeen === key) return;
  state.lastSeen = key;
  const known = new Set(state.seen);
  for (let z = row - 3; z <= row + 3; z++)
    for (let x = col - 3; x <= col + 3; x++)
      if (d.tiles.has(tileKey(x, z)) && dungeonSight(p, dungeonPoint([x, z]))) known.add(tileKey(x, z));
  state.seen = [...known];
}
function dungeonGoal() {
  const d = underways[game.dungeon],
    s = dungeonState();
  const sentinel = s.foes.find((m) => m.kind === 'sentinel' && m.hp > 0);
  if (!s.unlocked) return { text: 'Найдите механизм ворот', target: dungeonPoint(d.handle) };
  if (sentinel) return { text: 'Пройдите за ворота и одолейте стража', target: sentinel };
  if (!s.claimed) return { text: 'Отыщите тайник экспедиции', target: dungeonPoint(d.relicAt) };
  return { text: 'Вернитесь к лестнице', target: dungeonPoint(d.start) };
}
function dungeonAction() {
  const d = underways[game.dungeon],
    s = dungeonState(),
    p = dungeonPlayer();
  const sites = [
    ['up', d.start, 'Подняться в замок'],
    ['wheel', d.handle, s.unlocked ? 'Осмотреть поднятый противовес' : d.switchName + ' · повернуть'],
    ['gate', d.gate, d.gateName + ' · заперто'],
    ['chest', d.relicAt, s.claimed ? 'Осмотреть пустой сундук' : d.relic + ' · открыть'],
  ];
  for (const [key, where, label] of sites) {
    const loc = dungeonPoint(where);
    if (
      (key !== 'gate' || !s.unlocked) &&
      Math.hypot(loc.x - p.x, loc.z - p.z) < (key === 'gate' ? 3.35 : 2.25) &&
      (key === 'gate' || dungeonSight(p, loc))
    )
      return { key, label };
  }
  return null;
}
function dungeonInteract() {
  const a = dungeonAction();
  if (!a) return;
  const s = dungeonState(),
    d = underways[game.dungeon];
  if (a.key === 'up') {
    leaveDungeon();
    return;
  }
  if (a.key === 'gate') {
    notify('За стеной слышна цепь. Найдите ворот.');
    return;
  }
  if (a.key === 'wheel') {
    if (s.unlocked) {
      notify('Цепь натянута. Ворота открыты.');
      return;
    }
    s.unlocked = true;
    awardOnce('wheel-' + game.dungeon, 20, 'Механизм открыт');
    s.lift = 0;
    tone(76, 0.65, 'triangle', 0.12, 36);
    notify('Противовес опущен. Ворота поднялись.', 3);
    s.lastSeen = null;
    discoverChamber();
    checkpoint();
    drawHud();
    return;
  }
  if (s.claimed) {
    notify('В сундуке осталась только вощёная ткань.');
    return;
  }
  if (s.foes.some((m) => m.kind === 'sentinel' && m.hp > 0)) {
    notify('Костяной страж охраняет тайник.');
    return;
  }
  s.claimed = true;
  awardOnce('vault-' + game.dungeon, 65, 'Тайник экспедиции');
  game.coins += d.reward;
  game.bandages += d.bandages;
  game.arrows += d.arrows;
  game.story.entries.push([d.mark, d.relicText]);
  checkpoint();
  scoreCue('chapter');
  drawHud();
  modal(
    d.name,
    d.mark,
    '<p>' +
      d.relicText +
      '</p><p class="loot-result">+' +
      d.reward +
      ' монет · ' +
      (d.bandages ? '+' + d.bandages + ' бинта' : '+' + d.arrows + ' стрел') +
      '</p>',
  );
}
function dungeonMap() {
  const d = underways[game.dungeon],
    state = dungeonState(),
    p = dungeonPlayer();
  const seen = new Set(state.seen),
    plan = Array.from(d.tiles, (key) => {
      const [x, z] = key.split(',').map(Number);
      if (!seen.has(key)) return '';
      return (
        '<rect x="' +
        x * 12 +
        '" y="' +
        z * 12 +
        '" width="12.3" height="12.3" fill="' +
        (key === d.gateKey && !state.unlocked ? '#bb8056' : '#767e73') +
        '"/>'
      );
    }).join('');
  const glyph = (where, sign, color) =>
    seen.has(tileKey(...where))
      ? '<text x="' +
        (where[0] * 12 + 6) +
        '" y="' +
        (where[1] * 12 + 9) +
        '" text-anchor="middle" font-size="10" fill="' +
        color +
        '">' +
        sign +
        '</text>'
      : '';
  const x = (p.x / chamberStep) * 12 + 6,
    z = (p.z / chamberStep) * 12 + 6;
  modal(
    'Подземный план',
    d.name,
    '<svg class="under-map" role="img" aria-label="План разведанных залов" viewBox="0 0 205 184">' +
      plan +
      glyph(d.start, '↑', '#fff2c0') +
      glyph(d.handle, '⚙', '#ffe2a0') +
      glyph(d.relicAt, '◆', '#ecce8d') +
      '<path d="M 0 -4 L 3.3 3.5 L 0 2 L -3.3 3.5 Z" fill="#ffdf8d" stroke="#40301d" stroke-width=".6" transform="translate(' +
      x +
      ' ' +
      z +
      ') rotate(' +
      (-game.yaw * 180) / Math.PI +
      ')"/></svg><p>↑ Лестница　 ⚙ Ворот　 ◆ Тайник</p><p>' +
      dungeonGoal().text +
      '.</p>',
  );
}
function dungeonTarget(range, cone) {
  const g = game,
    p = dungeonPlayer();
  let best = null,
    min = range;
  for (const m of dungeonState().foes) {
    if (m.hp <= 0) continue;
    const dx = m.x - p.x,
      dz = m.z - p.z,
      dist = Math.hypot(dx, dz),
      profile = bestiary[m.kind];
    const vertical = Math.atan2(
      profile.top * 0.68 - (g.leg === 'lost' ? 0.78 : 1.71) - g.air,
      Math.max(0.4, dist),
    );
    if (
      dist < min &&
      Math.abs(angles(Math.atan2(-dx, -dz) - g.yaw)) < cone &&
      Math.abs(g.pitch - vertical) < 0.94 &&
      dungeonSight(p, m)
    ) {
      best = m;
      min = dist;
    }
  }
  return best;
}
function dungeonMove(entity, dx, dz, r, player = false) {
  const pos = player ? dungeonPlayer() : entity;
  const can = (x, z) =>
    dungeonFree(x, z, r) &&
    (player || Math.hypot(x - game.roomX, z - game.roomZ) > r + 0.32) &&
    !dungeonState().foes.some(
      (o) => o !== entity && o.hp > 0 && Math.hypot(x - o.x, z - o.z) < r + bestiary[o.kind].radius - 0.035,
    );
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.19));
  let x = pos.x,
    z = pos.z;
  for (let i = 0; i < n; i++) {
    if (can(x + dx / n, z)) x += dx / n;
    if (can(x, z + dz / n)) z += dz / n;
  }
  const travel = Math.hypot(x - pos.x, z - pos.z);
  if (player) {
    game.roomX = x;
    game.roomZ = z;
  } else {
    entity.x = x;
    entity.z = z;
  }
  return travel;
}
function dungeonArmor(m, amount, type) {
  if (
    m.kind !== 'sentinel' ||
    m.recover > 0 ||
    m.stagger > 0 ||
    type === 'parry' ||
    (type === 'heavy' && hasTalent('breaker'))
  )
    return amount;
  const p = dungeonPlayer(),
    front = Math.abs(angles(Math.atan2(p.x - m.x, p.z - m.z) - m.yaw)) < 1.34;
  return front ? Math.max(1, Math.round(amount * (type === 'heavy' ? 0.65 : 0.4))) : amount;
}
function monsterTick(m, dt) {
  if (m.hp <= 0) return;
  const s = dungeonState(),
    d = underways[game.dungeon],
    p = dungeonPlayer(),
    spec = bestiary[m.kind];
  const dist = Math.hypot(m.x - p.x, m.z - p.z),
    los = dist < 19 && dungeonSight(m, p);
  m.cd = Math.max(0, m.cd - dt);
  m.stagger = Math.max(0, (m.stagger || 0) - dt);
  m.walk = false;
  if (los && dist < (m.kind === 'sentinel' ? 14 : 11)) m.alert = 9;
  else m.alert = Math.max(0, m.alert - dt);
  m.recover = Math.max(0, (m.recover || 0) - dt);
  if (m.recover > 0) return;
  if (m.stagger > 0) {
    m.windup = 0;
    return;
  }
  if (m.windup > 0) {
    m.windup = Math.max(0, m.windup - dt);
    if (!m.windup) {
      m.struckAt = gameTime;
      m.cd = m.kind === 'sentinel' ? 2.05 : 1.48;
      const slam = m.moveKind === 'slam',
        span = slam ? 3.4 : spec.reach + 0.52;
      const angle = Math.abs(angles(Math.atan2(p.x - m.x, p.z - m.z) - m.yaw));
      if (los && dist < span && (slam ? game.air < 0.62 : angle < 1.12 && game.air < 1.6))
        hitPlayer(spec.power * (slam ? 1.45 : 1), m);
      if (m.kind === 'sentinel') {
        m.recover = slam ? 1.45 : 0.7;
        m.moveKind = null;
      }
    }
    return;
  }
  if (!m.alert) return;
  if (los && dist <= spec.reach) {
    const face = angles(Math.atan2(p.x - m.x, p.z - m.z) - m.yaw);
    m.yaw += clamp(face, -dt * 3, dt * 3);
    if (m.cd <= 0 && Math.abs(face) < 0.32) {
      m.windup = spec.wind;
      if (m.kind === 'sentinel') {
        m.beats = (m.beats || 0) + 1;
        if (m.beats % 3 === 0 || (m.hp < m.maxHp * 0.5 && m.beats % 2 === 0)) {
          m.moveKind = 'slam';
          m.windup = 1.38;
          notify('Страж бьёт в пол · отпрыгните или перепрыгните волну', 1.25);
        }
      }
      monsterCall(m.kind, false);
    }
    return;
  }
  const cell = dungeonCell(m.x, m.z),
    end = dungeonCell(p.x, p.z);
  let goal = p;
  if (!los) {
    if (!m.path || m.planEnd !== tileKey(...end) || (m.planTime || 0) <= gameTime) {
      m.path = dungeonPath(d, s, cell, end);
      m.planEnd = tileKey(...end);
      m.planTime = gameTime + 0.68;
    }
    if (!m.path.length) return;
    goal = dungeonPoint(m.path[0]);
    if (Math.hypot(m.x - goal.x, m.z - goal.z) < 0.38) {
      m.path.shift();
      return;
    }
  } else m.path = null;
  const dx = goal.x - m.x,
    dz = goal.z - m.z,
    angle = Math.atan2(dx, dz);
  m.yaw += clamp(angles(angle - m.yaw), -dt * 4.8, dt * 4.8);
  for (const offset of [0, 0.65, -0.65]) {
    const a = angle + offset;
    if (dungeonMove(m, Math.sin(a) * spec.speed * dt, Math.cos(a) * spec.speed * dt, spec.radius) > 0.005) {
      m.walk = true;
      break;
    }
  }
}
function monsterCall(kind, deathCall) {
  const weight = kind === 'sentinel' ? 1.25 : kind === 'weaver' ? 0.65 : 0.9,
    base = kind === 'weaver' ? 218 : kind === 'sentinel' ? 65 : 103;
  noiseFoley(deathCall ? 0.34 : 0.2, kind === 'weaver' ? 2800 : 880, 0.12 * weight, 0.2);
  resonantFoley(base, deathCall ? 0.49 : 0.28, 0.13 * weight, base * (deathCall ? 0.35 : 0.67));
  resonantFoley(base * 1.68, 0.22, 0.062, base * (deathCall ? 0.59 : 0.87), 0.04, -0.26);
}
function dungeonTick(dt) {
  const g = game;
  const state = dungeonState();
  if (state.unlocked && (state.lift ?? 1) < 1) state.lift = Math.min(1, state.lift + dt * 1.28);
  tickGuard(dt);
  if (keys.has('ArrowLeft')) g.yaw += dt * 1.85;
  if (keys.has('ArrowRight')) g.yaw -= dt * 1.85;
  const f =
      +Boolean(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
    r = Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
    len = Math.hypot(f, r);
  const sprint =
    len > 0 &&
    (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
    !g.blockTime &&
    g.stamina > 8 &&
    g.leg !== 'lost' &&
    g.leg !== 'chair';
  const speed = g.leg === 'lost' ? 1.25 : g.leg === 'chair' ? 3.1 : g.blockTime ? 2.25 : sprint ? 6.2 : 4.05;
  let travelled = 0;
  if (len) {
    const n = (speed * dt) / len;
    travelled = dungeonMove(
      null,
      (r * Math.cos(g.yaw) - f * Math.sin(g.yaw)) * n,
      (-r * Math.sin(g.yaw) - f * Math.cos(g.yaw)) * n,
      0.34,
      true,
    );
  }
  if (g.evade > 0) dungeonMove(null, Math.sin(g.yaw) * dt * 9, Math.cos(g.yaw) * dt * 9, 0.34, true);
  g.stamina = clamp(g.stamina + dt * (sprint ? -7 : g.blockTime ? 2.5 : 13), 0, 100);
  const oldBeat = Math.floor(walking / Math.PI);
  walking += travelled * 1.7;
  if (oldBeat !== Math.floor(walking / Math.PI) && !g.air) {
    const pan = oldBeat % 2 ? 0.2 : -0.2;
    noiseFoley(0.054, g.dungeon === 'palace' ? 1540 : 930, 0.058, pan);
    resonantFoley(120, 0.092, 0.08, 52, 0.009, pan);
    noiseFoley(0.055, 750, 0.02, -pan, 0.115);
  }
  g.vy -= 18 * dt;
  g.air = Math.max(0, g.air + g.vy * dt);
  if (!g.air) g.vy = 0;
  swing = Math.max(0, swing - dt * (g.weapon === 'bow' && hasTalent('quiver') ? 3 : g.heavy ? 1.35 : 2));
  flash = Math.max(0, flash - dt);
  $('hurt').style.opacity = flash;
  if (g.bleed) {
    g.health = Math.max(0, g.health - g.bleed * dt);
    if (!g.health) {
      death();
      return 0;
    }
  }
  dungeonArrowTick(dt);
  discoverChamber();
  for (const m of dungeonState().foes) {
    monsterTick(m, dt);
    if (g.health <= 0) break;
  }
  if (gameTime > subtitleUntil) $('subtitle').textContent = '';
  return travelled ? Math.sin(walking) * 0.026 : 0;
}
function dungeonArrowTick(dt) {
  const a = game.arrow;
  if (!a) return;
  for (let i = 0; i < 5; i++) {
    const h = dt / 5,
      start = { x: a.x, z: a.z };
    a.x += a.dx * h;
    a.y += a.dy * h;
    a.z += a.dz * h;
    a.dy -= 6.4 * h;
    a.life -= h;
    if (
      a.life <= 0 ||
      a.y <= 0.04 ||
      a.y >= 4.9 ||
      !dungeonFree(a.x, a.z, 0.035) ||
      !dungeonSight(start, a)
    ) {
      game.arrow = null;
      return;
    }
    const mob = dungeonState().foes.find(
      (m) =>
        m.hp > 0 &&
        Math.hypot(a.x - m.x, a.z - m.z) < bestiary[m.kind].radius + 0.24 &&
        a.y < bestiary[m.kind].top + 0.15,
    );
    if (mob) {
      hurtActor(mob, 34 + game.upgrade * 6, true, 'arrow');
      game.arrow = null;
      return;
    }
  }
}
