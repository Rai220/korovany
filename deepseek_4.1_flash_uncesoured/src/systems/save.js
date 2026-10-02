// Сохранения: 4 слота + автосейв в localStorage. Мир восстанавливается из сида.
import { G, SETTINGS, emit, notify } from '../core/state.js';
import { clamp } from '../core/mathutil.js';
import { createHumanoid, killHumanoid } from '../entities/humanoid.js';
import { heightAt } from '../world/terrain.js';

const KEY = 'korovany_ds41_save_';
const SLOTS = ['auto', '1', '2', '3', '4'];

export function initSave() {
  G.save = { save, load, list, remove, autosave, hasAny };
}

function snapshot() {
  const p = G.player;
  return {
    v: 2,
    seed: G.seed, seedRaw: G.seedRaw, faction: p.heroFaction, difficulty: G.difficulty,
    when: new Date().toISOString(),
    time: { seconds: G.time.seconds, day: G.time.day },
    playtime: G.stats.playtime,
    stats: G.stats,
    player: {
      x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch,
      hp: p.hp, hpMax: p.hpMax, stamina: p.stamina, staminaMax: p.staminaMax, blood: p.blood, hunger: p.hunger,
      gold: p.gold, level: p.level, xp: p.xp, xpNext: p.xpNext,
      limbHp: p.limbHp, missing: p.missing, prosthetics: p.prosthetics, bleeding: p.bleeding,
      inventory: p.inventory, equip: p.equip, quick: p.quick, skills: p.skills, rep: p.rep,
      wheelchair: p.wheelchair, inChair: p.inChair, stats: p.stats, name: p.name,
      heroFaction: p.heroFaction,
    },
    dead: G.entities.filter((e) => e.dead).map((e) => e.id),
    entityState: G.entities.filter((e) => !e.dead && (e.hp < e.hpMax || e.ai.squad || e.ai.spy)).map((e) => ({
      id: e.id, hp: e.hp, missing: e.missing, x: e.pos.x, z: e.pos.z, squad: !!e.ai.squad, spy: !!e.ai.spy,
    })),
    corpses: G.corpses.slice(-30).map((c) => ({
      name: c.entity.name, role: c.entity.role, faction: c.entity.faction,
      x: c.pos.x, y: c.pos.y, z: c.pos.z, missing: c.entity.missing, inventory: c.entity.inventory, looted: c.looted,
    })),
    containers: G.containers.filter((c) => c.opened || (c.loot && c.loot.length)).map((c) => ({ id: c.id, opened: c.opened, loot: c.loot, locked: c.locked })),
    containersOpened: G.containers.filter((c) => c.opened).map((c) => c.id),
    quests: (G.quests ? G.quests.list : []).map((q) => ({ id: q.id, title: q.title, state: q.state, objectives: q.objectives, chainName: q.chainName, chainIndex: q.chainIndex })),
    discovered: [...G.discovered],
    shopState: G.shopState || {},
    bank: G.bank,
    victoryShown: !!G.victoryShown,
    throneCaptured: !!G.throneCaptured,
    rank: G.playerRank,
    caravans: G.caravans.map((c) => ({ kind: c.kind, s: c.s, dir: c.dir, alive: c.alive, robbed: c.robbed })),
    difficulty2: G.difficulty,
  };
}

export function save(slot = 'auto') {
  try {
    const data = snapshot();
    localStorage.setItem(KEY + slot, JSON.stringify(data));
    const meta = {
      slot, when: new Date().toLocaleString('ru-RU'), faction: data.faction,
      level: data.player.level, place: G.placeName ? G.placeName() : '',
    };
    localStorage.setItem(KEY + slot + '_meta', JSON.stringify(meta));
    notify(slot === 'auto' ? 'Игра сохранена (автосейв).' : `Игра сохранена в слот ${slot}.`, 'good');
    emit('save:done', { slot });
    return true;
  } catch (e) {
    console.error(e);
    notify('Не удалось сохранить: ' + e.message, 'bad');
    return false;
  }
}

export function list() {
  const out = [];
  for (const slot of SLOTS) {
    try {
      const meta = localStorage.getItem(KEY + slot + '_meta');
      if (meta) { const m = JSON.parse(meta); out.push({ ...m, name: slot === 'auto' ? 'Автосейв' : `Слот ${slot}` }); }
      else out.push({ slot, name: slot === 'auto' ? 'Автосейв' : `Слот ${slot}`, when: 'пусто', faction: '—', level: '—', place: '—' });
    } catch (e) { /* пусто */ }
  }
  return out;
}
export function hasAny() {
  return SLOTS.some((s) => localStorage.getItem(KEY + s));
}
export function remove(slot) {
  localStorage.removeItem(KEY + slot);
  localStorage.removeItem(KEY + slot + '_meta');
  notify('Сохранение удалено.');
}

export function load(slot = 'auto') {
  try {
    const raw = localStorage.getItem(KEY + slot);
    if (!raw) { notify('Сохранение не найдено.', 'bad'); return null; }
    const data = JSON.parse(raw);
    applySave(data);
    return data;
  } catch (e) {
    console.error(e);
    notify('Ошибка загрузки: ' + e.message, 'bad');
    return null;
  }
}

export function applySave(d) {
  G.time.seconds = d.time.seconds;
  G.time.day = d.time.day;
  G.stats = Object.assign(G.stats, d.stats || {});
  G.difficulty = d.difficulty || 'normal';
  G.victoryShown = !!d.victoryShown;
  G.throneCaptured = !!d.throneCaptured;
  G.playerRank = d.rank || 0;
  G.discovered = new Set(d.discovered || []);
  G.bank = d.bank || { deposit: 0, loan: 0, due: 0 };
  if (d.shopState) G.shopState = d.shopState;
  const p = G.player;
  const ps = d.player;
  if (ps) {
    p.pos.set(ps.x, ps.y, ps.z);
    p.yaw = ps.yaw; p.pitch = ps.pitch;
    p.hp = ps.hp; p.hpMax = ps.hpMax; p.stamina = ps.stamina; p.staminaMax = ps.staminaMax;
    p.blood = ps.blood; p.hunger = ps.hunger;
    p.gold = ps.gold; p.level = ps.level; p.xp = ps.xp; p.xpNext = ps.xpNext;
    p.limbHp = ps.limbHp; p.missing = ps.missing; p.prosthetics = ps.prosthetics; p.bleeding = ps.bleeding;
    p.inventory = ps.inventory || []; p.equip = ps.equip || {}; p.quick = ps.quick || [null, null, null, null];
    p.skills = ps.skills; p.rep = ps.rep;
    p.wheelchair = !!ps.wheelchair; p.inChair = false;
    p.stats = ps.stats || p.stats;
    p.dead = false;
    p.armor = p.equip.armor ? 0.3 : 0.05;
    emit('player:restored', {});
  }
  // смертность НПС
  const deadSet = new Set(d.dead || []);
  for (const e of G.entities) {
    if (deadSet.has(e.id) && !e.dead) {
      e.hp = 0;
      killHumanoid(e, { cause: 'save' });
      e.group.visible = true;
    }
  }
  for (const es of d.entityState || []) {
    const e = G.entities.find((x) => x.id === es.id);
    if (!e || e.dead) continue;
    e.hp = clamp(es.hp, 1, e.hpMax);
    e.pos.x = es.x; e.pos.z = es.z; e.pos.y = heightAt(es.x, es.z);
  }
  // трупы
  for (const c of d.corpses || []) {
    const existsNear = G.corpses.some((x) => Math.abs(x.pos.x - c.x) < 1 && Math.abs(x.pos.z - c.z) < 1);
    if (existsNear) continue;
    const e = createHumanoid({ role: c.role, faction: c.faction, name: c.name, x: c.x, z: c.z });
    e.missing = Object.assign(e.missing, c.missing || {});
    e.inventory = c.inventory || [];
    e.hp = 0;
    killHumanoid(e, { cause: 'save' });
    G.scene.add(e.group);
    e.anim.dead = 1;
    e.group.position.set(c.x, c.y || heightAt(c.x, c.z), c.z);
    G.corpses.push({ entity: e, pos: e.group.position, looted: !!c.looted });
  }
  // контейнеры
  for (const c of d.containers || []) {
    const cont = G.containers.find((x) => x.id === c.id);
    if (!cont) continue;
    cont.opened = c.opened; cont.locked = c.locked;
    if (c.loot) cont.loot = c.loot;
  }
  // задания
  if (G.quests) {
    G.quests.list.length = 0;
    for (const q of d.quests || []) G.quests.list.push({ ...q, desc: '', reward: {} });
  }
  emit('quest:new', {});
  emit('player:eyes', {
    left: p.missing.eyeL && !p.prosthetics.eyeL, right: p.missing.eyeR && !p.prosthetics.eyeR,
    glassL: p.missing.eyeL && p.prosthetics.eyeL, glassR: p.missing.eyeR && p.prosthetics.eyeR,
  });
  emit('player:prosthetic', {});
  notify('Игра загружена.', 'good');
}

export function autosave() {
  if (!G.running || G.gameOver) return;
  save('auto');
}
void SETTINGS;
