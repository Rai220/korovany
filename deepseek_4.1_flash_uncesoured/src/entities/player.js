// Игрок: камера, движение, бой, травмы, протезы, коляска, взаимодействие с миром.
import * as THREE from 'three';
import { G, SETTINGS, emit, notify, say, isNight } from '../core/state.js';
import { clamp, lerp, damp, wrapAngle, dist2D, DEG } from '../core/mathutil.js';
import { Input } from '../core/input.js';
import { createHumanoid, updateHumanoid, damageHumanoid, setWeapon, bark } from './humanoid.js';
import { heightAt, groundMaterial, placeAt, isWater } from '../world/terrain.js';
import { resolveCollisions, surfaceHeight, isOnPlatform } from '../world/collision.js';

export const PLAYER_START = { elf: { x: -600, z: -560 }, guard: { x: 620, z: 700 }, villain: { x: 650, z: -560 } };

export function createPlayer(faction, opts = {}) {
  const roleKey = faction === 'elf' ? 'partisan' : faction === 'guard' ? 'guard' : 'legion';
  const start = PLAYER_START[faction] || PLAYER_START.elf;
  const p = createHumanoid({ role: roleKey, faction: faction === 'guard' ? 'empire' : faction === 'villain' ? 'villain' : 'elves', x: start.x, z: start.z, name: 'Ты' });
  p.isPlayer = true;
  p.kind = 'player';
  p.id = 'player';
  p.heroFaction = faction;
  p.hpMax = 150; p.hp = 150;
  p.stamina = 100; p.staminaMax = 100;
  p.blood = 100;
  p.gold = 0;
  p.level = 1; p.xp = 0; p.xpNext = 60;
  p.inventory = [];
  p.equip = { weapon: null, armor: null, shield: false, helmet: null };
  p.quick = ['bandage', 'potion_heal', null, null];
  p.prosthetics = { armL: null, armR: null, legL: null, legR: null, eyeL: null, eyeR: null };
  p.wheelchair = false; p.inChair = false;
  p.skills = { blade: 12, archery: 10, block: 8, sneak: 6, speech: 10, athletics: 18, endurance: 14, trade: 8 };
  p.rep = { people: 0, empire: 0, elves: 0, villain: 0, bandits: 0 };
  p.armor = 0.05;
  p.baseSpeed = 4.3;
  p.weapon = 'fists';
  p.view = 1; // 1 — от первого лица, 3 — от третьего
  p.camDist = 4.4;
  p.blocking = false;
  p.bowDraw = 0; p.drawing = false;
  p.attackCd = 0;
  p.attackTime = 0.45;
  p.wheelSpin = 0;
  p.zone = 1;
  p.moving = false; p.sprinting = false; p.sneaking = false; p.crouching = false;
  p.crawling = false; p.onGround = true; p.groundMaterial = 'grass';
  p.torch = false; p.lanternItem = false;
  p.lastDamageAt = -99;
  p.combatLog = [];
  p.squad = [];
  p.camera = G.camera;
  p.pitch = 0;
  p.bloodTimer = 0;
  p.regenTimer = 0;
  p.hunger = 100;
  p.tutorialStep = 0;
  p.mountedHorse = null;
  p.stats = { kills: 0, severed: 0, headshots: 0, caravans: 0 };
  // стартовый набор
  giveStartingKit(p, faction);
  applyProstheticVisuals(p);
  p.group.visible = true;
  return p;
}

function giveStartingKit(p, faction) {
  const add = (id, qty = 1) => { p.inventory.push({ id, qty }); };
  if (faction === 'elf') {
    add('elven_bow'); add('dagger'); add('arrows', 24); add('bandage', 3); add('bread', 2); add('leather_armor');
    p.gold = 40; p.equip.weapon = 'elven_bow'; p.equip.armor = 'leather_armor';
  } else if (faction === 'guard') {
    add('iron_sword'); add('shield'); add('bandage', 2); add('bread', 2); add('chain_armor'); add('arrows', 8); add('hunting_bow');
    p.gold = 25; p.equip.weapon = 'iron_sword'; p.equip.armor = 'chain_armor'; p.equip.shield = true;
  } else {
    add('dregar_blade'); add('bandage', 2); add('bread', 3); add('plate_armor'); add('dark_crystal', 4); add('arrows', 12); add('war_bow');
    p.gold = 250; p.equip.weapon = 'dregar_blade'; p.equip.armor = 'plate_armor';
  }
  if (p.equip.shield) p.shield = true;
  setWeapon(p, weaponKind(p.equip.weapon));
}

export function weaponKind(itemId) {
  if (!itemId) return 'fists';
  const table = {
    iron_sword: 'sword', steel_sword: 'sword', elven_blade: 'sword', dregar_blade: 'greatsword',
    rusty_axe: 'axe', war_axe: 'greataxe', spear: 'spear', dagger: 'dagger', elven_dagger: 'dagger',
    hunting_bow: 'bow', elven_bow: 'bow', war_bow: 'bow', staff: 'staff', club: 'axe',
  };
  return table[itemId] || 'sword';
}

export function applyProstheticVisuals(p) {
  const P = p.parts;
  for (const side of ['L', 'R']) {
    const leg = P['leg' + side];
    const arm = P['arm' + side];
    if (!leg || !arm) continue;
    const legKey = 'leg' + side, armKey = 'arm' + side;
    // деревянная/железная нога — красим и укорачиваем культю
    if (p.missing[legKey] && p.prosthetics[legKey]) {
      leg.up.scale.y = 1;
      leg.material = null;
      leg.up.material = new THREE.MeshLambertMaterial({ color: p.prosthetics[legKey] === 'iron_leg' ? 0x9aa0a8 : 0x8a6a3a });
      if (leg.lo.parent !== leg.knee) leg.knee.add(leg.lo);
      if (leg.foot.parent !== leg.knee) leg.knee.add(leg.foot);
      leg.lo.material = leg.up.material;
      leg.visible = true;
    } else if (p.missing[legKey]) {
      leg.up.scale.y = 0.5;
      if (leg.lo.parent) { leg.lo.parent.remove(leg.lo); G.scene.attach(leg.lo); }
      if (leg.foot.parent) { leg.foot.parent.remove(leg.foot); G.scene.attach(leg.foot); }
    }
    if (p.missing[armKey] && p.prosthetics[armKey]) {
      arm.up.scale.y = 1;
      arm.up.material = new THREE.MeshLambertMaterial({ color: p.prosthetics[armKey] === 'mech_arm' ? 0xb0b6be : 0x8a5a2a });
      if (!arm.lo.parent) arm.elbow.add(arm.lo);
      arm.lo.material = arm.up.material;
    } else if (p.missing[armKey]) {
      arm.up.scale.y = 0.55;
    }
  }
  // глаз
  if (p.parts.eyes) {
    p.parts.eyes[0].visible = !p.missing.eyeR;
    p.parts.eyes[1].visible = !p.missing.eyeL;
  }
}

export function playerEyeLoss(p) {
  const left = p.missing.eyeL && !p.prosthetics.eyeL;
  const right = p.missing.eyeR && !p.prosthetics.eyeR;
  const glassL = p.missing.eyeL && p.prosthetics.eyeL;
  const glassR = p.missing.eyeR && p.prosthetics.eyeR;
  emit('player:eyes', { left, right, glassL, glassR });
}

// ------------------------- травмы -------------------------
export function damagePlayer(amount, part = 'torso', opts = {}) {
  const p = G.player;
  if (!p || p.dead) return;
  if (G.godMode) return;
  let dmg = amount;
  if (p.blocking && !opts.unblockable) {
    const facing = opts.dir ? Math.abs(wrapAngle(Math.atan2(opts.dir.x, opts.dir.z) - p.yaw)) < 1.3 : true;
    if (facing) {
      const blockSkill = p.skills.block / 100;
      dmg *= clamp(0.45 - blockSkill * 0.3 - (p.equip.shield ? 0.12 : 0), 0.08, 0.5);
      p.stamina -= amount * 0.5;
      emit('player:blocked', {});
    }
  }
  dmg *= (1 - clamp(p.armor, 0, 0.75));
  if (part === 'head') dmg *= 1.35;
  if (part.startsWith('arm') || part.startsWith('leg')) dmg *= 0.8;
  p.hp -= dmg;
  p.lastDamageAt = G.now;
  p.limbHp[part] = Math.max(0, (p.limbHp[part] || 0) - dmg * 1.2);
  emit('player:hurt', { amount: dmg, part, from: opts.from });
  p.bleeding = Math.min(3, p.bleeding + (opts.bleed ?? 0.35));
  p.anim.hurt = 1;
  if (opts.attacker && opts.attacker.ai) opts.attacker.ai.alert = 10;
  // расчленение
  if (part !== 'torso' && part !== 'head' && !p.missing[part] && p.limbHp[part] <= 0) {
    severPlayerPart(part, opts.dir);
  }
  if (p.hp <= 0) {
    if (p.hp > -p.hpMax * 0.6 && Math.random() < 0.35) {
      // тяжёлое ранение — падение без смерти
      p.downed = true;
    } else killPlayer(opts.cause || 'раны');
  }
}

export function severPlayerPart(part, dir) {
  const p = G.player;
  if (p.missing[part]) return;
  p.missing[part] = true;
  const P = p.parts[part];
  const detach = [];
  if (part.startsWith('arm')) {
    detach.push(P.lo, P.fist);
    p.bleeding = Math.min(3, p.bleeding + 1.4);
    if (p.equip.weapon && weaponKind(p.equip.weapon) === 'bow') p.equip.weapon = p.equip.weapon;
  } else {
    detach.push(P.lo, P.foot);
    p.bleeding = Math.min(3, p.bleeding + 1.1);
  }
  for (const o of detach) {
    if (!o || !o.parent) continue;
    G.scene.attach(o);
    emit('gore:limb', { mesh: o, dir: dir || { x: Math.random() - 0.5, y: 1, z: Math.random() - 0.5 }, pos: o.getWorldPosition(new THREE.Vector3()), color: 0xa02020 });
  }
  if (part === 'legL' || part === 'legR') {
    const other = part === 'legL' ? 'legR' : 'legL';
    p.crawling = p.missing[other] && !(p.prosthetics[other]);
    if (p.prosthetics[other]) p.crawling = false;
    p.downed = p.missing.legL && p.missing.legR && !p.prosthetics.legL && !p.prosthetics.legR;
  }
  emit('player:sever', { part });
  notify(part.startsWith('arm') ? 'Тебе отрубили руку! Перевяжи рану (F), иначе умрёшь от кровотечения.' : 'Тебе отрубили ногу! Нужен костыль, коляска (G) или протез.', 'bad');
  say('Ты', part.startsWith('arm') ? 'Рука! А-а-а!' : 'Нога! Держись, держись…');
  applyProstheticVisuals(p);
  emit('player:injury', { part });
  if (p.missing.legL && p.missing.legR) { p.crawling = true; }
}

export function killPlayer(cause = 'раны') {
  const p = G.player;
  if (p.dead) return;
  p.dead = true;
  G.lastDeathCause = cause;
  G.gameOver = true;
  G.stats.deaths++;
  emit('player:death', { cause });
  emit('banner', { text: 'ТЫ ПОГИБ' });
}

export function revivePlayer() {
  const p = G.player;
  p.dead = false; p.downed = false;
  p.hp = p.hpMax * 0.5;
  p.blood = Math.max(35, p.blood);
  p.bleeding = 0;
  p.stamina = p.staminaMax;
  G.gameOver = false;
  emit('player:revive', {});
}

// ------------------------- предметы и лечение -------------------------
export function playerBandage() {
  const p = G.player;
  const slot = p.inventory.find((i) => i.id === 'bandage' && i.qty > 0);
  if (!slot) { notify('Нет бинтов.', 'bad'); return false; }
  slot.qty--;
  if (slot.qty <= 0) p.inventory.splice(p.inventory.indexOf(slot), 1);
  p.bleeding = Math.max(0, p.bleeding - 1.6);
  p.hp = Math.min(p.hpMax, p.hp + 6);
  G.audio.play('bandage');
  notify(p.bleeding <= 0.05 ? 'Кровь остановлена.' : 'Перевязался, но кровь ещё идёт.', p.bleeding <= 0.05 ? 'good' : '');
  emit('player:bandaged', {});
  return true;
}

export function playerUseItem(id) {
  const p = G.player;
  const slot = p.inventory.find((i) => i.id === id && i.qty > 0);
  if (!slot) return false;
  const def = G.economy ? G.economy.item(id) : null;
  if (!def) return false;
  if (def.heal) { p.hp = Math.min(p.hpMax, p.hp + def.heal); }
  if (def.stamina) { p.stamina = Math.min(p.staminaMax, p.stamina + def.stamina); }
  if (def.blood) { p.blood = Math.min(100, p.blood + def.blood); }
  if (def.stopsBleeding) p.bleeding = Math.max(0, p.bleeding - def.stopsBleeding);
  if (def.cure) { p.bleeding = 0; p.hp = Math.min(p.hpMax, p.hp + 40); }
  if (def.food) { p.hunger = Math.min(100, p.hunger + def.food); p.stamina = Math.min(p.staminaMax, p.stamina + 10); }
  if (def.wheelchair) { p.wheelchair = true; notify('Коляска в сумке. Нажми G, чтобы сесть.'); }
  if (def.prosthetic) { installProsthetic(def.prosthetic); }
  slot.qty--;
  if (slot.qty <= 0) p.inventory.splice(p.inventory.indexOf(slot), 1);
  G.audio.play(def.food ? 'drink' : 'drink');
  emit('player:used', { id });
  return true;
}

export function installProsthetic(kind) {
  const p = G.player;
  const map = {
    hook_arm: ['armR', 'hook_arm'], mech_arm: ['armR', 'mech_arm'], mech_arm_l: ['armL', 'mech_arm'],
    wood_leg: ['legR', 'wood_leg'], iron_leg: ['legR', 'iron_leg'],
    glass_eye: ['eyeR', 'glass_eye'], glass_eye_l: ['eyeL', 'glass_eye'],
  };
  const entry = map[kind];
  if (!entry) return false;
  let [slot, type] = entry;
  if (slot === 'armR' && !p.missing.armR) slot = 'armL';
  if (slot === 'legR' && !p.missing.legR) slot = 'legL';
  if (slot === 'eyeR' && !p.missing.eyeR) slot = 'eyeL';
  if (!p.missing[slot] && !slot.startsWith('eye')) {
    // ставим на отсутствующую конечность
    const alt = slot.endsWith('R') ? slot.slice(0, -1) + 'L' : slot.slice(0, -1) + 'R';
    if (p.missing[alt]) slot = alt;
  }
  p.prosthetics[slot] = type;
  if (slot.startsWith('leg')) {
    p.crawling = false;
    p.downed = false;
    if (p.missing.legL && p.missing.legR && (p.prosthetics.legL && p.prosthetics.legR)) { p.crawling = false; p.downed = false; }
  }
  if (slot.startsWith('eye')) playerEyeLoss(p);
  applyProstheticVisuals(p);
  G.audio.play('prosthetic');
  notify(`Протез установлен: ${G.economy ? G.economy.item(kind)?.name || kind : kind}.`, 'good');
  emit('player:prosthetic', { slot, type });
  return true;
}

export function toggleWheelchair() {
  const p = G.player;
  if (!p.wheelchair) {
    if (p.inventory.some((i) => i.id === 'wheelchair')) { p.wheelchair = true; }
    else { notify('Нужна коляска (продаётся у костоправа).', 'bad'); return; }
  }
  p.inChair = !p.inChair;
  if (p.inChair) {
    if (!p.chairMesh) {
      const g = new THREE.Group();
      const wood = new THREE.MeshLambertMaterial({ color: 0x6a4f2f });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), wood); seat.position.y = 0.5; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), wood); back.position.set(0, 0.8, 0.28); g.add(back);
      for (const s of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 6, 16), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
        wheel.position.set(s * 0.36, 0.36, 0); wheel.rotation.y = Math.PI / 2; g.add(wheel);
      }
      p.chairMesh = g;
      G.scene.add(g);
    }
    p.chairMesh.visible = true;
    notify('Ты сел в коляску. G — встать.');
    G.audio.play('wheel');
  } else if (p.chairMesh) {
    p.chairMesh.visible = false;
    notify('Ты встал с коляски.');
  }
  emit('player:wheelchair', { inChair: p.inChair });
}

export function addXP(amount) {
  const p = G.player;
  p.xp += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = Math.round(p.xpNext * 1.45 + 20);
    p.hpMax += 12;
    p.hp = p.hpMax;
    p.staminaMax += 5;
    G.audio.play('levelup');
    emit('banner', { text: `УРОВЕНЬ ${p.level}` });
    notify(`Новый уровень: ${p.level}. Здоровье и сила выросли.`, 'good');
  }
  emit('player:xp', {});
}

export function trainSkill(skill, amount = 3) {
  const p = G.player;
  if (p.skills[skill] === undefined) return;
  p.skills[skill] = clamp(p.skills[skill] + amount, 0, 100);
  emit('player:skills', {});
}

export function gainGold(amount) {
  const p = G.player;
  p.gold = Math.max(0, p.gold + amount);
  if (amount > 0) G.stats.goldEarned += amount;
  emit('player:gold', {});
}

export function addItem(id, qty = 1) {
  const p = G.player;
  const ex = p.inventory.find((i) => i.id === id);
  if (ex && (G.economy ? G.economy.item(id)?.stack !== false : true)) ex.qty += qty;
  else p.inventory.push({ id, qty });
  emit('player:inventory', {});
}

export function removeItem(id, qty = 1) {
  const p = G.player;
  const slot = p.inventory.find((i) => i.id === id);
  if (!slot || slot.qty < qty) return false;
  slot.qty -= qty;
  if (slot.qty <= 0) p.inventory.splice(p.inventory.indexOf(slot), 1);
  emit('player:inventory', {});
  return true;
}

// ------------------------- взаимодействие -------------------------
export function interactionTarget() {
  const p = G.player;
  if (p.dead) return null;
  const range = 3.2;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const px = p.pos.x, pz = p.pos.z;
  const candidates = [];
  // трупы
  for (const c of G.corpses) {
    if (c.looted) continue;
    const d = dist2D(px, pz, c.pos.x, c.pos.z);
    if (d < range + 0.8) candidates.push({ kind: 'corpse', obj: c, d, text: `Обыскать тело (${c.entity.name})` });
  }
  // контейнеры
  for (const c of G.containers) {
    if (c.opened && c.loot.length === 0) continue;
    const d = dist2D(px, pz, c.x, c.z);
    if (d < range) {
      const locked = c.locked && !hasLockpick(p);
      candidates.push({ kind: 'container', obj: c, d, text: locked ? `Вскрыть ${c.name} (нужна отмычка)` : `Открыть ${c.name}` });
    }
  }
  // НПС
  for (const e of G.entities) {
    if (e.dead || e.kind !== 'npc') continue;
    const d = dist2D(px, pz, e.pos.x, e.pos.z);
    if (d > range + 0.6) continue;
    const dx = e.pos.x - px, dz = e.pos.z - pz;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < 0.1) continue;
    if (e.ai.role === 'slave' || !e.faction) continue;
    candidates.push({ kind: 'npc', obj: e, d, text: `Говорить: ${e.name}` });
  }
  // лавки
  for (const s of G.worldShops || []) {
    const d = dist2D(px, pz, s.x, s.z);
    if (d < range + 0.5) candidates.push({ kind: 'shop', obj: s, d, text: `${s.name}` });
  }
  // постели
  for (const b of G.worldBeds || []) {
    const d = dist2D(px, pz, b.x, b.z);
    if (d < range) candidates.push({ kind: 'bed', obj: b, d, text: `Спать: ${b.name} (${b.price} зол.)` });
  }
  // трон / флаг
  if (G.landmarks) {
    for (const [key, lm] of Object.entries(G.landmarks)) {
      if (!lm || !lm.x) continue;
      const d = dist2D(px, pz, lm.x, lm.z);
      if (d < 3.4) {
        if (key === 'throne' && p.heroFaction === 'villain') candidates.push({ kind: 'throne', obj: lm, d, text: 'Водрузить знамя Дрегара на трон' });
        if (key === 'fortThrone' && p.heroFaction !== 'villain') candidates.push({ kind: 'fortthrone', obj: lm, d, text: 'Сесть на трон Владыки' });
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.d - b.d);
  return candidates[0];
}

function hasLockpick(p) { return p.inventory.some((i) => i.id === 'lockpick'); }

export function doInteract() {
  const t = interactionTarget();
  if (!t) return;
  const p = G.player;
  switch (t.kind) {
    case 'corpse': emit('ui:lootCorpse', t.obj); break;
    case 'container': emit('ui:lootContainer', t.obj); break;
    case 'npc': emit('ui:talk', t.obj); break;
    case 'shop': emit('ui:shop', t.obj); break;
    case 'bed': emit('ui:bed', t.obj); break;
    case 'throne': emit('ui:throne', t.obj); break;
    case 'fortthrone': emit('ui:fortthrone', t.obj); break;
    default: break;
  }
  void p;
}

// ------------------------- обновление -------------------------
export function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  const cam = G.camera;
  // обзор
  const mouse = Input.consumeMouse();
  const sens = 0.0022 * SETTINGS.sens;
  p.yaw = wrapAngle(p.yaw - mouse.dx * sens);
  p.pitch = clamp(p.pitch + (SETTINGS.invertY ? mouse.dy : -mouse.dy) * sens, -1.35, 1.35);
  p.group.rotation.y = p.yaw;

  if (!p.dead) {
    // режимы
    if (Input.pressed('view')) { p.view = p.view === 1 ? 3 : 1; notify(p.view === 1 ? 'Вид от первого лица' : 'Вид от третьего лица'); }
    if (Input.pressed('crouch')) p.crouching = !p.crouching;
    if (Input.pressed('wheelchair')) toggleWheelchair();
    if (Input.pressed('bandage')) playerBandage();
    if (Input.pressed('interact')) doInteract();
    if (Input.pressed('torch')) { p.torch = !p.torch; G.audio.play('fire'); }
    if (Input.pressed('switchWeapon')) cycleWeapon();
    for (let i = 0; i < 4; i++) {
      if (Input.pressed('quick' + (i + 1))) useQuick(i);
    }
    handleMovement(p, dt);
    handleCombat(p, dt);
    // естественное восстановление
    p.regenTimer += dt;
    if (p.regenTimer > 1) {
      p.regenTimer = 0;
      if (p.bleeding <= 0.02 && p.hp < p.hpMax && G.now - p.lastDamageAt > 8) p.hp = Math.min(p.hpMax, p.hp + 1.2 + p.skills.endurance * 0.02);
      if (!p.sprinting) p.stamina = Math.min(p.staminaMax, p.stamina + 3 + p.skills.endurance * 0.05);
      p.blood = Math.min(100, p.blood + (p.bleeding > 0.02 ? -p.bleeding * 1.3 : 0.8));
      p.hunger = Math.max(0, p.hunger - 0.06);
      if (p.blood <= 0 && !p.dead) killPlayer('потеря крови');
      if (p.hunger <= 0) p.hp = Math.max(1, p.hp - 0.4);
    }
  } else {
    handleMovement(p, dt);
  }
  updateHumanoidPlayer(p, dt);
  updateCamera(p, dt);
  emit('player:tick', {});
  void cam;
}

function useQuick(i) {
  const p = G.player;
  const id = p.quick[i];
  if (!id) return;
  if (id === 'bandage') playerBandage();
  else playerUseItem(id);
}

export function cycleWeapon() {
  const p = G.player;
  const kinds = [];
  const inv = p.inventory.map((it) => it.id);
  const have = (id) => inv.includes(id);
  if (have('dregar_blade') || have('steel_sword') || have('iron_sword')) kinds.push('sword');
  if (have('elven_bow') || have('hunting_bow') || have('war_bow')) kinds.push('bow');
  kinds.push('fists');
  const cur = weaponKind(p.equip.weapon);
  const idx = kinds.indexOf(cur);
  const next = kinds[(idx + 1) % kinds.length];
  equipWeaponKind(next);
}
export function equipWeaponKind(kind) {
  const p = G.player;
  const map = { sword: ['dregar_blade', 'steel_sword', 'iron_sword', 'elven_blade'], bow: ['war_bow', 'elven_bow', 'hunting_bow'], fists: [null], axe: ['war_axe', 'rusty_axe'], spear: ['spear'], dagger: ['elven_dagger', 'dagger'] };
  const list = map[kind] || [null];
  const found = list.find((id) => !id || p.inventory.some((i) => i.id === id));
  p.equip.weapon = found || null;
  if (kind === 'bow' && p.missing.armL && p.missing.armR) notify('Без обеих рук из лука не постреляешь.', 'bad');
  setWeapon(p, kind);
  emit('player:weapon', { kind, id: p.equip.weapon });
}

function handleMovement(p, dt) {
  const { f, s } = Input.moveVector();
  const canMove = !G.uiOpen || true;
  const sprint = Input.isDownAction('sprint') && !p.crouching && p.stamina > 2 && !p.inChair;
  p.sprinting = sprint && (f !== 0 || s !== 0);
  p.sneaking = p.crouching && !p.inChair;
  let speed = p.baseSpeed * (p.level * 0.01 + 1);
  if (p.inChair) speed = 3.3;
  else if (p.crawling || (p.missing.legL && p.missing.legR && !p.prosthetics.legL && !p.prosthetics.legR)) speed = 1.45;
  else if ((p.missing.legL && !p.prosthetics.legL) || (p.missing.legR && !p.prosthetics.legR)) speed = 3.1;
  if (p.sneaking) speed *= 0.52;
  if (p.sprinting) speed *= 1.62;
  if (p.blocking) speed *= 0.75;
  if (p.hp < p.hpMax * 0.3) speed *= 0.85;
  if (p.bleeding > 0.8) speed *= 0.9;
  if (p.hunger < 15) speed *= 0.9;
  if (isWater(p.pos.x, p.pos.z)) speed *= 0.62;
  speed *= (0.9 + p.skills.athletics * 0.004);
  if (p.downed) speed *= 0.35;
  const wnx = -Math.sin(p.yaw), wnz = -Math.cos(p.yaw);
  const wx = wnx * f + Math.cos(p.yaw) * s;
  const wz = wnz * f - Math.sin(p.yaw) * s;
  const len = Math.hypot(wx, wz) || 1;
  const moving = (f !== 0 || s !== 0) && canMove;
  p.moving = moving;
  const targetSpeed = moving ? speed : 0;
  p.speedNow = damp(p.speedNow || 0, targetSpeed, 10, dt);
  if (moving) {
    const slope = 1;
    p.desiredX = (wx / len) * p.speedNow * slope;
    p.desiredZ = (wz / len) * p.speedNow * slope;
  } else { p.desiredX = 0; p.desiredZ = 0; }

  // прыжок
  const canJump = p.onGround && !p.inChair && !p.crawling && p.stamina > 6 && !p.downed;
  if (Input.pressed('jump') && canJump) {
    p.vy = (p.missing.legL || p.missing.legR) && !p.prosthetics.legL && !p.prosthetics.legR ? 5.4 : 7.1;
    p.onGround = false;
    p.stamina -= 5;
    trainSkill('athletics', 0.08);
  }
  p.pos.x += p.desiredX * dt;
  p.pos.z += p.desiredZ * dt;
  // гравитация
  const ground = surfaceHeight(p.pos.x, p.pos.z, p.pos.y);
  if (!p.onGround) {
    p.vy -= 24 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= ground) {
      const fall = -p.vy;
      p.pos.y = ground;
      p.vy = 0;
      p.onGround = true;
      if (fall > 12) {
        const dmg = (fall - 12) * 3.2;
        damagePlayer(dmg, 'legL', { bleed: 0.2 });
        notify(`Падение: ${Math.round(dmg)} урона`, 'bad');
        trainSkill('athletics', 0.2);
      }
    }
  } else {
    if (p.pos.y > ground + 0.3) { p.onGround = false; p.vy = 0; }
    else p.pos.y = ground;
  }
  resolveCollisions(p.pos, p.radius, p.pos.y, p.height);
  if (isOnPlatform(p.pos.x, p.pos.z, p.pos.y)) p.onGround = true;
  p.groundMaterial = groundMaterial(p.pos.x, p.pos.z);
  if (p.sprinting) {
    p.stamina -= dt * 4.2;
    trainSkill('athletics', dt * 0.05);
  } else if (moving) trainSkill('athletics', dt * 0.02);
  if (p.stamina < 0) p.stamina = 0;
  // спрятанность
  if (p.sneaking && moving) trainSkill('sneak', dt * 0.06);
  // коляска едет за игроком
  if (p.chairMesh && p.inChair) {
    p.chairMesh.position.set(p.pos.x, p.pos.y, p.pos.z);
    p.chairMesh.rotation.y = p.yaw;
  } else if (p.chairMesh) {
    p.chairMesh.position.set(p.pos.x - Math.sin(p.yaw) * 1.2, p.pos.y, p.pos.z - Math.cos(p.yaw) * 1.2);
  }
  // зона
  const zone = placeAt(p.pos.x, p.pos.z);
  const zn = G.zoneAt ? G.zoneAt(p.pos.x, p.pos.z) : null;
  if (zn && zn.id !== p.zone) { p.zone = zn.id; emit('player:zone', { zone: zn.id }); }
  if (zone) emit('player:place', { place: zone });
}

function handleCombat(p, dt) {
  p.attackCd = Math.max(0, p.attackCd - dt);
  const kind = weaponKind(p.equip.weapon);
  const hasArm = !p.missing.armR || p.prosthetics.armR;
  const bothArms = (!p.missing.armL || p.prosthetics.armL) && hasArm;
  p.blocking = Input.isDownAction('block') && p.stamina > 1 && (kind !== 'bow') && !p.inChair;
  if (p.blocking) { p.stamina -= dt * 3; trainSkill('block', dt * 0.05); }

  if (kind === 'bow') {
    const canDraw = p.inventory.some((i) => i.id === 'arrows' && i.qty > 0) && (hasArm);
    if (Input.isDownAction('attack') && canDraw && p.attackCd <= 0) {
      p.drawing = true;
      p.bowDraw = Math.min(1.4, p.bowDraw + dt * (1.1 + p.skills.archery * 0.006));
    } else if (p.drawing && p.bowDraw > 0.15) {
      shootArrow(p, p.bowDraw);
      p.drawing = false;
      p.bowDraw = 0;
      p.attackCd = 0.75 - p.skills.archery * 0.003;
    } else if (!Input.isDownAction('attack')) {
      p.drawing = false;
      p.bowDraw = 0;
    }
  } else {
    p.drawing = false;
    if (Input.pressed('attack') && p.attackCd <= 0) {
      meleeAttack(p, bothArms);
    }
  }
  // быстрое оружие из кулаков
  if (Input.pressed('attack') && kind === 'fists' && p.attackCd <= 0) meleeAttack(p, bothArms);
}

function meleeAttack(p, bothArms) {
  const kind = weaponKind(p.equip.weapon);
  const stats = {
    fists: { dmg: 7, range: 1.9, cd: 0.5, stam: 4 },
    dagger: { dmg: 12, range: 1.9, cd: 0.4, stam: 4 },
    sword: { dmg: 22, range: 2.5, cd: 0.62, stam: 8 },
    axe: { dmg: 26, range: 2.4, cd: 0.78, stam: 11 },
    greataxe: { dmg: 38, range: 2.9, cd: 1.05, stam: 16 },
    greatsword: { dmg: 42, range: 3.1, cd: 1.1, stam: 17 },
    spear: { dmg: 24, range: 3.3, cd: 0.7, stam: 9 },
    staff: { dmg: 18, range: 2.6, cd: 0.65, stam: 8 },
  }[kind] || { dmg: 7, range: 1.9, cd: 0.5, stam: 4 };
  if (p.stamina < stats.stam * 0.5) return;
  p.stamina -= stats.stam;
  p.attackCd = stats.cd * (bothArms ? 1 : 1.4);
  p.attackTime = stats.cd;
  p.anim.attack = 1;
  G.audio.play(kind === 'fists' ? 'swing' : (stats.dmg > 25 ? 'swing_heavy' : 'swing'));
  const dmgMul = (bothArms ? 1 : 0.7) * (1 + p.skills.blade * 0.012) * (p.level * 0.02 + 1);
  const aimPitch = p.pitch;
  emit('combat:playerswing', { range: stats.range, dmg: stats.dmg * dmgMul, part: 'auto', aimPitch });
  trainSkill(kind === 'fists' ? 'blade' : 'blade', 0.14);
}

function shootArrow(p, draw) {
  const kind = p.equip.weapon;
  const base = kind === 'war_bow' ? 34 : kind === 'elven_bow' ? 30 : 24;
  const dmg = base * (0.45 + draw * 0.55) * (1 + p.skills.archery * 0.014) * (p.missing.armL || p.missing.armR ? 0.75 : 1) * (p.level * 0.02 + 1);
  removeItem('arrows', 1);
  G.audio.play('bow');
  p.anim.attack = 1;
  p.attackTime = 0.3;
  trainSkill('archery', 0.22);
  emit('combat:playerarrow', { dmg, draw });
}

function updateHumanoidPlayer(p, dt) {
  // используем общую физику/анимацию гуманоида, но без ИИ
  if (p.dead) {
    p.anim.dead = Math.min(1, (p.anim.dead || 0) + dt * 2.2);
    const B = p.body;
    B.rotation.x = -Math.PI / 2 * Math.min(1, p.anim.dead * 1.2);
    B.position.y = lerp(0, 0.1 * p.height, Math.min(1, p.anim.dead));
    return;
  }
  p.crawling = (p.missing.legL && p.missing.legR && !p.prosthetics.legL && !p.prosthetics.legR) || p.downed;
  p.anim.crawl = damp(p.anim.crawl, p.crawling && !p.inChair ? 1 : 0, 6, dt);
  p.speedNow = p.speedNow || 0;
  // анимация: переиспользуем anim-код гуманоида
  const fake = p;
  fake.attackTime = p.attackTime;
  updateHumanoidAnimOnly(fake, dt);
  // кровотечение
  if (p.bleeding > 0) {
    p.bloodTimer = (p.bloodTimer || 0) + dt;
    if (p.bloodTimer > 1.15) {
      p.bloodTimer = 0;
      emit('player:bleed', { amount: p.bleeding });
    }
  }
  // позиция тела
  p.group.position.set(p.pos.x, p.pos.y, p.pos.z);
  if (p.inChair && p.chairMesh) p.body.position.y += 0;
}

function updateHumanoidAnimOnly(p, dt) {
  // лёгкая копия animateHumanoid, чтобы не тянуть ИИ
  const A = p.anim, P = p.parts;
  A.hurt = Math.max(0, A.hurt - dt * 3);
  A.attack = Math.max(0, A.attack - dt * (1 / Math.max(0.18, p.attackTime || 0.45)));
  A.block = damp(A.block, p.blocking ? 1 : 0, 12, dt);
  A.draw = damp(A.draw, p.drawing ? 1 : 0, 10, dt);
  const speed = p.speedNow || 0;
  const moving = speed > 0.25;
  if (moving) A.phase += dt * (4.4 + speed * 1.4);
  else A.phase += dt * 1.5;
  const swing = moving ? Math.sin(A.phase) * clamp(speed / 4.2, 0.2, 1) : Math.sin(A.phase) * 0.04;
  const crawl = A.crawl;
  p.body.position.y = (moving && !crawl ? Math.abs(Math.sin(A.phase)) * 0.03 * p.height : 0) - (p.crouching ? 0.1 * p.height : 0) - (p.inChair ? -0.42 : 0);
  p.body.rotation.x = crawl ? -Math.PI * 0.42 * crawl : (p.crouching ? 0.1 : 0);
  p.body.rotation.z = moving && !crawl ? Math.sin(A.phase) * 0.02 : 0;
  for (const side of ['L', 'R']) {
    const arm = P['arm' + side], leg = P['leg' + side];
    const sign = side === 'L' ? 1 : -1;
    if (leg && !p.missing['leg' + side]) {
      if (crawl) { leg.hip.rotation.x = 0.3 + Math.sin(A.phase * 0.8) * 0.12 * sign; leg.knee.rotation.x = -0.45; }
      else if (p.inChair) { leg.hip.rotation.x = -1.15; leg.knee.rotation.x = -1.25; }
      else { leg.hip.rotation.x = -swing * sign * 1.1; leg.knee.rotation.x = Math.max(0, swing * sign) * 1.2 - 0.12; }
    } else if (leg) { leg.hip.rotation.x = -0.2; leg.knee.rotation.x = -0.85; }
    if (arm && !p.missing['arm' + side]) {
      let baseX = swing * sign * 0.9;
      let rotZ = sign * 0.08;
      if (p.drawing && side === 'L') { baseX = -1.45 * A.draw; rotZ = 0.2; }
      if (p.equip.weapon && weaponKind(p.equip.weapon) === 'bow' && side === 'R' && p.drawing) { baseX = -0.9; }
      if (A.attack > 0 && side === 'R' && weaponKind(p.equip.weapon) !== 'bow') {
        const t = 1 - A.attack;
        baseX = -1.5 + Math.sin(t * Math.PI) * 2.6;
        rotZ = -0.4 + Math.sin(t * Math.PI) * 0.5;
        arm.elbow.rotation.x = -0.7 + Math.sin(t * Math.PI) * 0.5;
      } else {
        arm.elbow.rotation.x = damp(arm.elbow.rotation.x, -0.35, 8, dt);
      }
      if (A.block > 0.05 && side === 'L') { baseX = -1.25 * A.block; rotZ = 0.5 * A.block; }
      if (p.drawing && side === 'R') { baseX = -1.1 * A.draw; }
      arm.sh.rotation.x = damp(arm.sh.rotation.x, baseX, 14, dt);
      arm.sh.rotation.z = damp(arm.sh.rotation.z, rotZ, 12, dt);
    }
  }
}

function updateCamera(p, dt) {
  const cam = G.camera;
  const eye = p.eyeHeight + p.pos.y;
  const crouchOff = p.crouching ? -0.35 : 0;
  const crawlOff = p.crawling ? -0.75 : 0;
  const chairOff = p.inChair ? -0.32 : 0;
  const headBob = p.moving && p.onGround ? Math.sin(p.anim.phase * 2) * 0.035 * (p.sprinting ? 1.7 : 1) : 0;
  if (p.view === 1) {
    if (p.parts.head) p.parts.head.visible = false;
    cam.position.set(p.pos.x, eye + crouchOff + crawlOff + chairOff + headBob, p.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = p.yaw;
    cam.rotation.x = p.pitch + (p.crawling ? 0.35 : 0);
    cam.rotation.z = (p.inChair ? 0 : Math.sin(p.anim.phase) * 0.008);
    cam.fov = SETTINGS.fov;
  } else {
    if (p.parts.head) p.parts.head.visible = true;
    const dist = p.camDist * (p.crouching ? 0.8 : 1);
    const cx = p.pos.x + Math.sin(p.yaw) * Math.cos(p.pitch) * dist;
    const cz = p.pos.z + Math.cos(p.yaw) * Math.cos(p.pitch) * dist;
    const cy = eye + 0.4 - Math.sin(p.pitch) * dist * 0.9;
    cam.position.set(cx, Math.max(cy, heightAt(cx, cz) + 0.4), cz);
    cam.rotation.order = 'YXZ';
    cam.lookAt(p.pos.x, eye - 0.1, p.pos.z);
    cam.fov = SETTINGS.fov;
  }
  cam.updateProjectionMatrix();
  // фонарь в руке ночью
  if (p.torch) {
    if (!p.torchLight) {
      p.torchLight = new THREE.PointLight(0xffb060, 4.5, 26, 2);
      G.scene.add(p.torchLight);
    }
    p.torchLight.position.set(p.pos.x - Math.sin(p.yaw) * 0.5, eye - 0.2, p.pos.z - Math.cos(p.yaw) * 0.5);
    p.torchLight.intensity = isNight() ? 4.5 : 1.2;
  } else if (p.torchLight) {
    p.torchLight.intensity = 0;
  }
}

export function respawnPlayer() {
  const p = G.player;
  const faction = p.heroFaction;
  const spot = faction === 'elf' ? { x: -600, z: -560 } : faction === 'guard' ? { x: 620, z: 690 } : { x: 650, z: -560 };
  p.pos.set(spot.x, heightAt(spot.x, spot.z), spot.z);
  revivePlayer();
  notify('Тебя выходили у лекаря. Раны залечены, но шрамы остались.');
}

void DEG; void bark; void damageHumanoid; void say; void updateHumanoid;
