// Игрок: движение, бой, увечья (рука/нога/глаз), протезы, коляска, инвентарь.
import * as THREE from '../lib/three.min.js';
import { G, ITEMS, SITES, BODY_PARTS, rnd, pick, clamp, lerp, angDiff } from './data.js';
import { heightAt, collide, collideTrees, boxTopAt } from './world.js';
import { makeHumanoid, makeWeapon, lookFor, hurt, shoot, spawnBlood, mat } from './entities.js';

let scene, camera;
export const input = { keys: {}, mx: 0, my: 0, lmb: false, rmb: false, pressed: {} };
const P = G.player = {
  isPlayer: true, alive: false, faction: 'elf', pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0,
  hp: 100, maxHp: 100, stamina: 100, gold: 0, xp: 0, level: 1, points: 0, stats: { str: 0, agi: 0, end: 0 },
  inv: {}, equip: { melee: null, ranged: null, armor: null }, slot: 'melee',
  body: { armL: 'ok', armR: 'ok', legL: 'ok', legR: 'ok', eyeL: 'ok', eyeR: 'ok' },
  bleed: 0, repHuman: 0, rank: 0, discipline: 3, eyeH: 1.7, aimH: 1.2,
  atkT: 0, atkDur: 0.4, atkCd: 0, hitDone: true, blocking: false, onGround: true, injuryCd: 0, lastHurt: 99,
  third: false, hurtFlash: 0, mode: 'walk', walkPh: 0, moving: 0,
};
let view, viewWeapon, viewArm, model, chair, modelWeaponKey = '';

const LOOKS = {
  elf: { skin: 0xf3dfc0, body: 0x3a8040, legs: 0x4a3a24, hat: 'hair', hatColor: 0xe8d080, ears: true, belt: 0x4a321c, cape: 0x25552a },
  empire: { skin: 0xe8c9a0, body: 0x2c4f9e, arms: 0x9aa0aa, legs: 0x6a6e78, hat: 'helmet', hatColor: 0xa8acb4, belt: 0xd6a530 },
  evil: { skin: 0x9a9aa8, body: 0x15121a, legs: 0x15121a, robe: true, hat: 'horns', hatColor: 0x15121a, cape: 0x4a1a6a, eyes: 0xd060ff, eyesGlow: 0xa040ff, scale: 1.12 },
};

export function initPlayer(sc, cam) {
  scene = sc; camera = cam;
  scene.add(camera);
  view = new THREE.Group(); camera.add(view);
}
function rebuildModel() {
  if (model) scene.remove(model.root);
  model = makeHumanoid(LOOKS[P.faction]);
  scene.add(model.root);
  chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.6), mat(0x6b4a2c)); seat.position.y = 0.55;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.06), mat(0x6b4a2c)); back.position.set(0, 0.9, -0.3);
  chair.add(seat, back);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 5, 14), mat(0x333333)); w.rotation.y = Math.PI / 2; w.position.set(sx * 0.42, 0.45, -0.05); chair.add(w); }
  model.root.add(chair);
  modelWeaponKey = '';
}
function refreshWeapons() {
  const id = P.slot === 'ranged' && P.equip.ranged ? P.equip.ranged : P.equip.melee;
  const key = id + '/' + P.body.armL + P.body.armR;
  if (key === modelWeaponKey) return;
  modelWeaponKey = key;
  while (view.children.length) view.remove(view.children[0]);
  const arms = armCount();
  if (id && arms > 0) {
    const side = P.body.armR !== 'lost' ? 1 : -1, isBow = id === 'bow' || id === 'longbow';
    viewArm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.5), mat(P.body[side > 0 ? 'armR' : 'armL'] === 'prosthesis' ? 0x777777 : LOOKS[P.faction].skin));
    viewArm.position.set(0.02 * side, -0.07, 0.27); viewArm.rotation.x = -0.25;
    viewWeapon = makeWeapon(id); viewWeapon.scale.setScalar(0.5);
    if (isBow) { viewWeapon.rotation.set(0, Math.PI, 0.2); viewWeapon.position.set(0, 0.06, 0); viewArm.position.set(0, -0.2, 0.25); }
    else viewWeapon.rotation.set(0.7, Math.PI, -0.2 * side);
    view.add(viewArm, viewWeapon);
    view.userData.base = new THREE.Vector3(isBow ? -0.3 : 0.36 * side, isBow ? -0.2 : -0.36, -0.62);
  }
  if (model) {
    if (model.weapon) model.weapon.parent.remove(model.weapon);
    model.weapon = null;
    if (id && arms > 0) { model.weapon = makeWeapon(id); model.weapon.position.set(0, -0.72, 0); (P.body.armR !== 'lost' ? model.armR : model.armL).add(model.weapon); }
  }
}

export function newPlayer(faction) {
  P.faction = faction; P.alive = true;
  P.maxHp = faction === 'evil' ? 140 : 100; P.hp = P.maxHp; P.stamina = 100;
  P.xp = 0; P.level = 1; P.points = 0; P.stats = { str: 0, agi: 0, end: 0 };
  P.body = { armL: 'ok', armR: 'ok', legL: 'ok', legR: 'ok', eyeL: 'ok', eyeR: 'ok' };
  P.bleed = 0; P.repHuman = 0; P.rank = 0; P.discipline = 3; P.vy = 0; P.pitch = 0; P.injuryCd = 0; P.atkT = 0; P.atkCd = 0;
  if (faction === 'elf') { P.inv = { dagger: 1, bow: 1, arrow: 40, leather: 1, bandage: 2, potion: 1, bread: 2 }; P.equip = { melee: 'dagger', ranged: 'bow', armor: 'leather' }; P.gold = 40; }
  else if (faction === 'empire') { P.inv = { sword: 1, leather: 1, bandage: 2, potion: 1, bread: 2 }; P.equip = { melee: 'sword', ranged: null, armor: 'leather' }; P.gold = 60; }
  else { P.inv = { blackblade: 1, staff: 1, chain: 1, bandage: 3, potion: 2 }; P.equip = { melee: 'blackblade', ranged: 'staff', armor: 'chain' }; P.gold = 200; }
  P.slot = 'melee';
  const s = SITES[faction], off = faction === 'empire' ? [-44, 4] : faction === 'evil' ? [-6, 6] : [10, 12];
  P.pos.set(s.x + off[0], 0, s.z + off[1]); P.pos.y = heightAt(P.pos.x, P.pos.z);
  P.yaw = faction === 'empire' ? -Math.PI / 2 : Math.PI * 0.75;
  rebuildModel(); refreshWeapons();
}
export function serializePlayer() {
  const o = {};
  for (const k of ['faction', 'hp', 'maxHp', 'stamina', 'gold', 'xp', 'level', 'points', 'stats', 'inv', 'equip', 'slot', 'body', 'bleed', 'repHuman', 'rank', 'discipline', 'yaw', 'pitch']) o[k] = P[k];
  o.pos = [P.pos.x, P.pos.y, P.pos.z];
  return JSON.parse(JSON.stringify(o));
}
export function loadPlayer(o) {
  for (const k in o) if (k !== 'pos') P[k] = o[k];
  P.pos.set(o.pos[0], o.pos[1], o.pos[2]); P.alive = true; P.vy = 0; P.atkT = 0; P.atkCd = 0; P.injuryCd = 5;
  rebuildModel(); refreshWeapons();
}

export const armCount = () => (P.body.armL !== 'lost') + (P.body.armR !== 'lost');
export const legCount = () => (P.body.legL !== 'lost') + (P.body.legR !== 'lost');
export function addItem(id, n = 1) { P.inv[id] = (P.inv[id] || 0) + n; }
export function removeItem(id, n = 1) {
  if (!P.inv[id]) return false;
  P.inv[id] -= n;
  if (P.inv[id] <= 0) { delete P.inv[id]; for (const k in P.equip) if (P.equip[k] === id) P.equip[k] = null; }
  refreshWeapons(); return true;
}
export function addXp(n) {
  P.xp += n;
  while (P.xp >= P.level * 100) {
    P.xp -= P.level * 100; P.level++; P.points += 2; P.maxHp += 8; P.hp = Math.min(P.maxHp, P.hp + 30);
    G.ui.msg(`Новый уровень: ${P.level}! Очки характеристик: +2 (открой «I»)`, 'good'); G.sfx('level');
  }
}

export function useItem(id) {
  const it = ITEMS[id];
  if (!it || !P.inv[id]) return;
  if (it.type === 'melee') { P.equip.melee = id; P.slot = 'melee'; G.ui.msg(`В руке: ${it.name}`); }
  else if (it.type === 'ranged') { P.equip.ranged = id; P.slot = 'ranged'; G.ui.msg(`В руке: ${it.name}`); }
  else if (it.type === 'armor') { P.equip.armor = id; G.ui.msg(`Надето: ${it.name}`); }
  else if (id === 'bandage') {
    if (P.bleed <= 0) { G.ui.msg('Кровотечения нет — бинт не нужен.'); return; }
    P.bleed = 0; removeItem(id); G.ui.msg('Рана перевязана, кровь остановлена.', 'good'); G.sfx('heal');
  } else if (it.heal) {
    if (P.hp >= P.maxHp) { G.ui.msg('Здоровье и так полное.'); return; }
    P.hp = Math.min(P.maxHp, P.hp + it.heal); removeItem(id); G.ui.msg(`${it.name}: +${it.heal} здоровья`, 'good'); G.sfx('heal');
  } else if (it.type === 'prosthesis') {
    if (P.bleed > 0) { G.ui.msg('Сначала останови кровь — протез на свежую рану не поставить!', 'bad'); return; }
    const key = [it.part + 'L', it.part + 'R'].find(k => P.body[k] === 'lost');
    if (!key) { G.ui.msg('Все такие части тела на месте — протез пока не нужен.'); return; }
    P.body[key] = 'prosthesis'; removeItem(id);
    G.ui.msg(`Протез установлен: ${BODY_PARTS[key]}.`, 'good'); G.sfx('heal');
  } else if (id === 'wheelchair') G.ui.msg(legCount() < 2 ? 'Ты уже сидишь в коляске.' : 'Коляска пригодится, если отрубят ногу.');
  else G.ui.msg('Это можно только продать.');
  refreshWeapons();
}

export function injure(what) {
  const order = { arm: ['arm', 'leg', 'eye'], leg: ['leg', 'arm', 'eye'], eye: ['eye', 'arm', 'leg'] }[what];
  for (const w of order) {
    const sides = Math.random() < 0.5 ? ['L', 'R'] : ['R', 'L'];
    const key = sides.map(s => w + s).find(k => P.body[k] === 'ok');
    if (!key) continue;
    P.body[key] = 'lost'; P.injuryCd = 28;
    spawnBlood(P.pos.x, P.pos.y + 1, P.pos.z, 12);
    if (w === 'eye') G.ui.msg(`Тебе выкололи ${BODY_PARTS[key]}! Половины экрана больше не видно. Нужен хрустальный глаз.`, 'bad');
    else {
      P.bleed += 1;
      if (w === 'arm') G.ui.msg(`Тебе отрубили: ${BODY_PARTS[key]}! Перевяжи рану (B) или беги к лекарю — иначе умрёшь от потери крови!`, 'bad');
      else G.ui.msg(`Тебе отрубили: ${BODY_PARTS[key]}! Останови кровь (B)! Дальше — ползком, на коляске или с протезом.`, 'bad');
    }
    G.sfx('maim'); G.ui.flash(1);
    refreshWeapons();
    return key;
  }
  return null;
}

P.takeDamage = function (amount, attacker, kind) {
  if (!P.alive || G.god) return;
  let blocked = false;
  if (P.blocking && attacker && attacker.pos) {
    const a = Math.atan2(attacker.pos.x - P.pos.x, attacker.pos.z - P.pos.z);
    if (Math.abs(angDiff(a, P.yaw)) < 1.25) { amount *= kind === 'melee' ? 0.2 : 0.45; blocked = true; P.stamina = Math.max(0, P.stamina - 12); G.sfx('block'); }
  }
  const def = P.equip.armor ? ITEMS[P.equip.armor].def : 0;
  amount *= (1 - def) * (1 - P.stats.end * 0.03);
  P.hp -= amount; P.lastHurt = 0; P.hurtFlash = Math.min(1, P.hurtFlash + 0.5);
  if (!blocked) G.sfx('hurt');
  G.ui.flash(0.5);
  if (!blocked && amount >= 3 && P.injuryCd <= 0 && Math.random() < 0.085 + (P.hp < P.maxHp * 0.5 ? 0.07 : 0))
    injure(kind === 'arrow' && Math.random() < 0.6 ? 'eye' : pick(['arm', 'leg', 'arm', 'leg', 'eye']));
  if (P.hp <= 0) die(attacker && attacker.name ? `Тебя убил: ${attacker.name}` : 'Ты погиб');
};
function die(cause) { P.hp = 0; P.alive = false; G.sfx('die'); if (G.onPlayerDeath) G.onPlayerDeath(cause); }

function doMelee() {
  const w = ITEMS[P.equip.melee] || { dmg: 4, range: 2, speed: 1.2, name: 'Кулак' };
  const arms = armCount();
  const range = arms ? w.range : 2.0;
  let dmg = arms ? w.dmg : 5;
  if (arms === 1 && P.body.armR === 'lost') dmg *= 0.8;
  if (P.body.armR === 'prosthesis') dmg *= 0.9;
  if (P.mode === 'crawl') dmg *= 0.6;
  dmg *= 1 + P.stats.str * 0.08;
  const hits = [];
  for (const n of G.npcs) {
    if (!n.alive || n.faction === P.faction) continue;
    const dx = n.pos.x - P.pos.x, dz = n.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > range + 0.5 || Math.abs(n.pos.y - P.pos.y) > 2.5) continue;
    if (d > 1.1 && Math.abs(angDiff(Math.atan2(dx, dz), P.yaw)) > 0.8) continue;
    hits.push({ n, d });
  }
  hits.sort((a, b) => a.d - b.d);
  for (const h of hits.slice(0, 2)) hurt(h.n, dmg * rnd(0.85, 1.15), P, 'melee');
  if (!hits.length) G.sfx('swing');
}
const _v = new THREE.Vector3(), _f = new THREE.Vector3();
function doShoot() {
  const w = ITEMS[P.equip.ranged];
  camera.getWorldDirection(_f);
  if (P.third) _f.set(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
  const from = new THREE.Vector3(P.pos.x, P.pos.y + P.eyeH - 0.1, P.pos.z).addScaledVector(_f, 0.6);
  const dmg = w.dmg * (1 + P.stats.agi * 0.06) * rnd(0.9, 1.1);
  if (w.magic) { shoot(P, from, _f.clone().multiplyScalar(36), dmg, true); G.sfx('magic'); }
  else { _f.y += 0.02; shoot(P, from, _f.clone().multiplyScalar(48), dmg, false); removeItem('arrow', 1); G.sfx('bow'); }
}

export function findInteract() {
  let best = null, bd = 3.6;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  const front = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz); return d < 1.3 || (dx * fx + dz * fz) / d > 0.35 ? d : 99; };
  for (const n of G.npcs) {
    if (!n.alive || !n.role) continue;
    const d = front(n.pos.x, n.pos.z);
    if (d < bd && !n.hostileTo(P)) { bd = d; best = { type: 'talk', obj: n, label: `E — говорить: ${n.name}` }; }
  }
  for (const c of G.corpses) {
    if (!c.loot) continue;
    const d = front(c.pos.x, c.pos.z);
    if (d < Math.min(bd, 2.6)) { bd = d; best = { type: 'corpse', obj: c, label: `E — обыскать труп (${c.name})` }; }
  }
  for (const c of G.caravans) {      // корован важнее всего остального рядом
    const d = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
    if (d < 5 && !c.looted) best = { type: 'caravan', obj: c, label: c.faction === P.faction ? 'Корован твоей фракции' : 'E — ограбить корован' };
  }
  return best;
}

export function updatePlayer(dt) {
  const k = input.keys;
  P.injuryCd -= dt; P.lastHurt += dt; P.atkCd -= dt; P.hurtFlash = Math.max(0, P.hurtFlash - dt * 1.5);
  if (!P.alive) { P.eyeH = lerp(P.eyeH, 0.3, dt * 3); placeCamera(dt); return; }
  // взгляд
  P.yaw -= input.mx * 0.0023; P.pitch = clamp(P.pitch - input.my * 0.0023, -1.45, 1.45);
  input.mx = input.my = 0;
  // режим передвижения
  const legs = legCount();
  P.mode = legs === 2 ? 'walk' : (P.inv.wheelchair ? 'chair' : 'crawl');
  let speed = 6.4 * (1 + P.stats.agi * 0.04);
  if (P.body.legL === 'prosthesis') speed *= 0.9; if (P.body.legR === 'prosthesis') speed *= 0.9;
  let fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  const sprint = (k.ShiftLeft || k.ShiftRight) && fwd > 0 && P.stamina > 1 && P.mode === 'walk' && !P.blocking;
  if (P.mode === 'walk') { if (sprint) { speed *= 1.65; P.stamina -= 11 * dt; } }
  else if (P.mode === 'chair') { speed = 4.6 * (armCount() === 0 ? 0.4 : armCount() === 1 ? 0.75 : 1); }
  else speed = armCount() === 0 ? 0.8 : 1.5;
  if (P.blocking) speed *= 0.55;
  const len = Math.hypot(fwd, str) || 1; fwd /= len; str /= len;
  const sn = Math.sin(P.yaw), cs = Math.cos(P.yaw);
  let mvx = (sn * fwd - cs * str) * speed, mvz = (cs * fwd + sn * str) * speed;
  if (P.mode === 'chair' && (fwd || str)) {     // в гору на коляске тяжело
    const h0 = heightAt(P.pos.x, P.pos.z), h1 = heightAt(P.pos.x + mvx * 0.2, P.pos.z + mvz * 0.2);
    const sl = (h1 - h0) / (speed * 0.2); const f = clamp(1 - sl * 2.2, 0.25, 1.5); mvx *= f; mvz *= f;
  }
  P.pos.x += mvx * dt; P.pos.z += mvz * dt;
  P.moving = (fwd || str) ? Math.hypot(mvx, mvz) : 0;
  collide(P.pos, 0.42); collideTrees(P.pos, 0.38);
  for (const c of G.caravans) { const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, d = Math.hypot(dx, dz); if (d < 2.4 && d > 0.01) { P.pos.x = c.pos.x + dx / d * 2.4; P.pos.z = c.pos.z + dz / d * 2.4; } }
  P.pos.x = clamp(P.pos.x, -590, 590); P.pos.z = clamp(P.pos.z, -590, 590);
  // прыжок и гравитация
  const ground = Math.max(heightAt(P.pos.x, P.pos.z), boxTopAt(P.pos.x, P.pos.z, 0.3, P.pos.y));
  if (input.pressed.Space && P.onGround) {
    if (P.mode === 'walk' && P.stamina > 8) { P.vy = 6.6 + P.stats.agi * 0.25; P.onGround = false; P.stamina -= 8; G.sfx('jump'); }
    else if (P.mode !== 'walk') G.ui.msg(P.mode === 'crawl' ? 'Без ноги не попрыгаешь…' : 'На коляске не прыгают.');
  }
  if (!P.onGround) {
    P.vy -= 18 * dt; P.pos.y += P.vy * dt;
    if (P.pos.y <= ground) { P.pos.y = ground; P.onGround = true; P.vy = 0; }
  } else {
    if (P.pos.y > ground + 0.6) { P.onGround = false; P.vy = 0; } else P.pos.y = ground;
  }
  // оружие
  if (input.pressed.Digit1) { P.slot = 'melee'; refreshWeapons(); }
  if (input.pressed.Digit2) { if (P.equip.ranged) { P.slot = 'ranged'; refreshWeapons(); } else G.ui.msg('Нет стрелкового оружия.'); }
  if (input.pressed.KeyQ) useItem(P.inv.potion ? 'potion' : 'bread');
  if (input.pressed.KeyB) { if (P.inv.bandage) useItem('bandage'); else G.ui.msg('Бинтов нет!', 'bad'); }
  if (input.pressed.KeyV) P.third = !P.third;
  P.blocking = input.rmb && armCount() > 0 && P.stamina > 2 && P.atkT <= 0;
  if (P.blocking) P.stamina -= 4 * dt;
  if (input.lmb && P.atkCd <= 0 && P.atkT <= 0 && !P.blocking) {
    const ranged = P.slot === 'ranged' && P.equip.ranged;
    if (ranged) {
      const w = ITEMS[P.equip.ranged], arms = armCount();
      if (!w.magic && arms < 2) G.ui.msg('Из лука с одной рукой не выстрелить. Нужен протез.', 'bad'), P.atkCd = 0.6;
      else if (w.magic && arms < 1) G.ui.msg('Нечем держать посох.', 'bad'), P.atkCd = 0.6;
      else if (!w.magic && !P.inv.arrow) G.ui.msg('Кончились стрелы!', 'bad'), P.atkCd = 0.6;
      else if (P.stamina < (w.magic ? 16 : 5)) P.atkCd = 0.2;
      else {
        P.stamina -= w.magic ? 16 : 5;
        const slow = (P.body.armL === 'prosthesis' || P.body.armR === 'prosthesis') ? 1.5 : 1;
        P.atkDur = 0.3; P.atkT = P.atkDur; P.atkCd = (w.magic ? 0.8 : 0.85) * slow / (1 + P.stats.agi * 0.04); P.hitDone = true;
        doShoot();
      }
    } else if (P.stamina >= 7) {
      const w = ITEMS[P.equip.melee] || { speed: 1.2 };
      P.stamina -= 7;
      P.atkDur = 0.4 / w.speed; P.atkT = P.atkDur; P.atkCd = 0.56 / w.speed / (1 + P.stats.agi * 0.04); P.hitDone = false;
    }
  }
  if (P.atkT > 0) {
    P.atkT -= dt;
    if (!P.hitDone && P.atkT < P.atkDur * 0.5) { P.hitDone = true; doMelee(); }
  }
  // состояние тела
  if (!sprint && !P.blocking) P.stamina = Math.min(100, P.stamina + (P.moving ? 9 : 16) * dt);
  if (P.bleed > 0) {
    P.hp -= P.bleed * 1.25 * dt;
    if (Math.random() < dt * 4) spawnBlood(P.pos.x, P.pos.y + 0.7, P.pos.z, 1);
    if (P.hp <= 0) { die('Ты истёк кровью. Раны надо было перевязать…'); }
  } else if (P.lastHurt > 12 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 0.6 * dt);
  P.aimH = P.mode === 'crawl' ? 0.3 : P.mode === 'chair' ? 0.9 : 1.2;
  const eh = P.mode === 'crawl' ? 0.45 : P.mode === 'chair' ? 1.15 : 1.7;
  P.eyeH = lerp(P.eyeH, eh, Math.min(1, dt * 6));
  if (P.moving && P.onGround) P.walkPh += dt * P.moving * (P.mode === 'walk' ? 1.6 : 2.5);
  placeCamera(dt);
}

function placeCamera(dt) {
  const bob = P.moving && P.onGround ? Math.sin(P.walkPh * (P.mode === 'walk' ? 1 : 0.7)) * (P.mode === 'crawl' ? 0.07 : P.mode === 'walk' ? 0.045 : 0.012) : 0;
  const limp = (P.body.legL === 'prosthesis' || P.body.legR === 'prosthesis') && P.moving ? Math.sin(P.walkPh * 0.5) * 0.035 : 0;
  const cp = Math.cos(P.pitch), dx = Math.sin(P.yaw) * cp, dy = Math.sin(P.pitch), dz = Math.cos(P.yaw) * cp;
  const ex = P.pos.x, ey = P.pos.y + P.eyeH + bob, ez = P.pos.z;
  if (P.third || !P.alive) {
    const dist = 5.2;
    let cx = ex - dx * dist, cy = ey + 0.9 - dy * dist, cz = ez - dz * dist;
    cy = Math.max(cy, heightAt(cx, cz) + 0.4);
    camera.position.set(cx, cy, cz);
    camera.lookAt(ex + dx * 3, ey + 0.3 + dy * 3, ez + dz * 3);
  } else {
    camera.position.set(ex, ey, ez);
    camera.lookAt(ex + dx, ey + dy, ez + dz);
    camera.rotateZ(limp + (P.alive ? 0 : 0.6));
  }
  // оружие от первого лица
  view.visible = !P.third && P.alive && view.children.length > 0;
  if (view.visible) {
    const b = view.userData.base;
    view.position.set(b.x, b.y + bob * 0.5, b.z);
    const bow = P.slot === 'ranged' && P.equip.ranged;
    if (P.atkT > 0 && !bow) {
      const t = 1 - P.atkT / P.atkDur;
      view.rotation.set(lerp(0.9, -1.1, t), lerp(-0.5, 0.5, t) * Math.sign(b.x), 0);
    } else if (P.atkT > 0) { view.rotation.set(0.12, 0, 0); view.position.z += 0.1; }
    else if (P.blocking) { view.rotation.set(0.2, 0, Math.sign(b.x) * 1.1); view.position.x -= Math.sign(b.x) * 0.25; view.position.y += 0.12; }
    else view.rotation.set(0, 0, 0);
  }
  // модель от третьего лица
  if (model) {
    const m = model;
    m.root.visible = P.third || !P.alive;
    if (m.root.visible) {
      m.root.position.copy(P.pos); m.root.rotation.y = P.yaw;
      const sw = P.moving ? Math.sin(P.walkPh * 1.3) * 0.7 : 0;
      for (const key of ['armL', 'armR', 'legL', 'legR']) { const st = P.body[key]; m[key].visible = st !== 'lost'; m[key].scale.set(st === 'prosthesis' ? 0.45 : 1, 1, st === 'prosthesis' ? 0.45 : 1); }
      m.eyeL.visible = P.body.eyeL !== 'lost'; m.eyeR.visible = P.body.eyeR !== 'lost';
      chair.visible = P.mode === 'chair' && P.alive;
      m.body.rotation.set(0, 0, 0); m.body.position.set(0, 0, 0);
      if (!P.alive) { m.body.rotation.x = -1.5; m.body.position.y = 0.22; }
      else if (P.mode === 'crawl') { m.body.rotation.x = 1.4; m.body.position.y = 0.3; m.armL.rotation.x = -2.6 + sw; m.armR.rotation.x = -2.6 - sw; m.legL.rotation.x = m.legR.rotation.x = 0; }
      else if (P.mode === 'chair') { m.body.position.y = -0.22; m.legL.rotation.x = m.legR.rotation.x = -1.45; m.armL.rotation.x = -0.5 + sw * 0.5; m.armR.rotation.x = -0.5 - sw * 0.5; }
      else {
        m.legL.rotation.x = sw; m.legR.rotation.x = -sw; m.armL.rotation.x = -sw * 0.7;
        m.armR.rotation.x = P.atkT > 0 ? lerp(-2.8, -0.3, 1 - P.atkT / P.atkDur) : P.blocking ? -1.3 : sw * 0.7;
      }
    }
  }
}
export { refreshWeapons };
