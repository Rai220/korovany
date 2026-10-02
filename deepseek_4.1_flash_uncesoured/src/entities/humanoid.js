// Гуманоиды: тело из отдельных частей, анимации, расчленение, 3D-трупы.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, emit } from '../core/state.js';
import { clamp, lerp, damp, wrapAngle, angleTowards } from '../core/mathutil.js';
import { Rand } from '../core/rng.js';
import { heightAt } from '../world/terrain.js';
import { resolveCollisions, surfaceHeight } from '../world/collision.js';

const matCache = new Map();
function mat(color) {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(color, m); }
  return m;
}
const matCacheE = new Map();
function matEm(color) {
  let m = matCacheE.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 }); matCacheE.set(color, m); }
  return m;
}

export const ROLES = {
  // --- люди ---
  villager: { height: 1.72, hp: 60, dmg: 6, speed: 2.0, armor: 0, weapon: 'fists', cloth: 0x6d5a3c, skin: 0xd8b48a, aggro: 22, xp: 4, faction: 'people' },
  child: { height: 1.25, hp: 40, dmg: 3, speed: 2.4, armor: 0, weapon: 'fists', cloth: 0x8a6a44, skin: 0xe0c096, aggro: 8, xp: 2, faction: 'people' },
  merchant: { height: 1.7, hp: 70, dmg: 8, speed: 1.9, armor: 0.1, weapon: 'dagger', cloth: 0x5a5a7a, skin: 0xd0a87c, aggro: 10, xp: 6, faction: 'people' },
  militia: { height: 1.74, hp: 90, dmg: 11, speed: 3.2, armor: 0.25, weapon: 'spear', cloth: 0x6a5a34, skin: 0xd0a87c, aggro: 24, xp: 8, faction: 'people' },
  bandit: { height: 1.76, hp: 95, dmg: 13, speed: 3.6, armor: 0.2, weapon: 'axe', cloth: 0x4a3a2c, skin: 0xc89868, aggro: 30, xp: 10, faction: 'bandits' },
  // --- империя ---
  guard: { height: 1.8, hp: 120, dmg: 15, speed: 3.7, armor: 0.4, weapon: 'sword', shield: true, cloth: 0x8a3a3a, metal: 0x9aa0a8, skin: 0xd0a87c, aggro: 30, xp: 14, faction: 'empire' },
  archer: { height: 1.76, hp: 95, dmg: 13, speed: 3.3, armor: 0.25, weapon: 'bow', cloth: 0x6a5a44, metal: 0x8a9098, skin: 0xd0a87c, aggro: 34, xp: 14, faction: 'empire' },
  captain: { height: 1.88, hp: 190, dmg: 22, speed: 3.9, armor: 0.5, weapon: 'sword', shield: true, cloth: 0xa8202a, metal: 0xc8b060, skin: 0xd0a87c, aggro: 34, xp: 40, faction: 'empire', elite: true },
  servant: { height: 1.68, hp: 50, dmg: 4, speed: 2.2, armor: 0.05, weapon: 'fists', cloth: 0xb0a88a, skin: 0xd8b48a, aggro: 10, xp: 3, faction: 'empire' },
  // --- эльфы ---
  elf: { height: 1.8, hp: 85, dmg: 11, speed: 4.1, armor: 0.15, weapon: 'dagger', cloth: 0x3f6a3a, skin: 0xe6cba6, aggro: 26, xp: 10, faction: 'elves' },
  elf_archer: { height: 1.82, hp: 85, dmg: 16, speed: 4.2, armor: 0.15, weapon: 'bow', cloth: 0x35592f, skin: 0xe6cba6, aggro: 40, xp: 16, faction: 'elves' },
  elf_child: { height: 1.3, hp: 40, dmg: 3, speed: 3.4, armor: 0.05, weapon: 'fists', cloth: 0x4a7a44, skin: 0xe8d0ac, aggro: 8, xp: 2, faction: 'elves' },
  elder: { height: 1.76, hp: 110, dmg: 14, speed: 2.4, armor: 0.2, weapon: 'staff', cloth: 0x6a7a9a, skin: 0xe0c8a4, aggro: 20, xp: 30, faction: 'elves', elite: true },
  partisan: { height: 1.8, hp: 105, dmg: 15, speed: 4.2, armor: 0.25, weapon: 'sword', cloth: 0x2f5230, skin: 0xe6cba6, aggro: 42, xp: 18, faction: 'elves' },
  // --- легион Дрегара ---
  legion: { height: 1.82, hp: 125, dmg: 16, speed: 3.6, armor: 0.45, weapon: 'sword', shield: true, cloth: 0x2a2a34, metal: 0x50565e, skin: 0xc09070, aggro: 32, xp: 16, faction: 'villain' },
  brute: { height: 2.05, hp: 220, dmg: 26, speed: 3.4, armor: 0.35, weapon: 'greataxe', cloth: 0x4a2a2a, metal: 0x6a5a4a, skin: 0xa87858, aggro: 30, xp: 30, faction: 'villain', elite: true },
  dark_archer: { height: 1.78, hp: 95, dmg: 15, speed: 3.4, armor: 0.2, weapon: 'bow', cloth: 0x33333f, skin: 0xb88868, aggro: 42, xp: 18, faction: 'villain' },
  spy: { height: 1.74, hp: 80, dmg: 12, speed: 4.4, armor: 0.15, weapon: 'dagger', cloth: 0x2f2f3a, skin: 0xc8a078, aggro: 26, xp: 20, faction: 'villain' },
  taskmaster: { height: 1.8, hp: 110, dmg: 12, speed: 2.6, armor: 0.3, weapon: 'whip', cloth: 0x3a2a2a, skin: 0xb08060, aggro: 20, xp: 12, faction: 'villain' },
  slave: { height: 1.7, hp: 50, dmg: 4, speed: 2.0, armor: 0, weapon: 'fists', cloth: 0x7a6a52, skin: 0xc8a078, aggro: 4, xp: 3, faction: 'neutral' },
  dregar: { height: 2.15, hp: 520, dmg: 34, speed: 4.0, armor: 0.55, weapon: 'greatsword', cloth: 0x1a1a22, metal: 0x8a2a2a, skin: 0xb08868, aggro: 40, xp: 200, faction: 'villain', elite: true, boss: true },
};

const FIRST = {
  people: ['Борислав', 'Горазд', 'Тихон', 'Веста', 'Радим', 'Милана', 'Живаго', 'Любава', 'Остап', 'Дарён'],
  empire: ['Ратмир', 'Ярополк', 'Святозар', 'Велимир', 'Добрыня', 'Мирослав', 'Златан', 'Берислав', 'Кузьма', 'Олег'],
  elves: ['Аэлир', 'Ниэль', 'Фаэлон', 'Ллиэн', 'Тауриэль', 'Элронд', 'Мириэль', 'Келеборн', 'Айвен', 'Сильвана'],
  villain: ['Гзул', 'Кромм', 'Вур', 'Гарм', 'Морд', 'Скрипа', 'Зарг', 'Краг', 'Нургл', 'Шэд'],
  bandits: ['Кривой Пёс', 'Топор', 'Ржавый', 'Сорока', 'Гвоздь', 'Пила', 'Клещ', 'Хмурый'],
};
const BARKS = {
  aggro: ['Стой, кто идёт!', 'Враг!', 'За Императора!', 'Держи его!', 'Наших бьют!', 'К оружию!'],
  elves: ['Лес не прощает!', 'За Луннолесье!', 'Уходи с нашей земли!', 'Стрелы не считаем!'],
  villain: ['За Владыку!', 'Тьма идёт!', 'Пленных не брать!', 'Кровь для Дрегара!'],
  hurt: ['Ах!', 'Ух!', 'Проклятье!', 'Ранили!', 'Больно!'],
  flee: ['Отступаем!', 'Бежим!', 'Спасайся!'],
  idle: ['Слышал новости?', 'Дворец-то богатый…', 'Дрегар опять лезет.', 'Хороший день.', 'Эльфы шалят.', 'Корованы идут.'],
  die: ['Ааа…', 'Всё…', 'Прощай…', 'Дрегар… отомстит…'],
};

let nextId = 1;
export const humanoids = [];

function limbGeo(len, w, d) {
  const g = new THREE.BoxGeometry(w, len, d);
  g.translate(0, -len / 2, 0);
  return g;
}

// Склейка частей в один меш: экономит draw calls (у НПС их сотни).
const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const _vc = new THREE.Color();
function vcMesh(list) {
  const geos = [];
  for (const [geo, color] of list) {
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    _vc.set(color);
    for (let i = 0; i < n; i++) { arr[i * 3] = _vc.r; arr[i * 3 + 1] = _vc.g; arr[i * 3 + 2] = _vc.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    geos.push(geo);
  }
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(merged, vcMat);
  mesh.castShadow = true;
  return mesh;
}

export function createHumanoid(o = {}) {
  const roleKey = o.role || 'villager';
  const role = ROLES[roleKey] || ROLES.villager;
  const faction = o.faction || role.faction || 'people';
  const H = (role.height || 1.75) * (o.scale || 1);
  const rnd = new Rand((G.seed ^ (nextId * 2654435761)) >>> 0);
  const cloth = o.cloth || role.cloth || 0x6a5a3c;
  const skin = o.skin || role.skin || 0xd8b48a;
  const metal = role.metal || 0x8a8a8a;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = {};

  // ноги
  const legLen = 0.5 * H;
  const upperLeg = 0.25 * H, lowerLeg = 0.24 * H;
  const legW = 0.085 * H, legD = 0.09 * H;
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.07 * H, legLen, 0);
    const up = vcMesh([[limbGeo(upperLeg, legW, legD), cloth]]);
    hip.add(up);
    const knee = new THREE.Group();
    knee.position.y = -upperLeg;
    hip.add(knee);
    const footGeo = new THREE.BoxGeometry(legW * 1.2, 0.045 * H, legD * 1.7);
    footGeo.translate(0, -lowerLeg, legD * 0.4);
    const lo = vcMesh([[limbGeo(lowerLeg, legW * 0.85, legD * 0.85), shade(cloth, 0.85)], [footGeo, 0x33281c]]);
    knee.add(lo);
    body.add(hip);
    parts['leg' + side] = { hip, knee, up, lo, foot: lo, side };
  }
  // таз и торс
  const pelvisGeo = new THREE.BoxGeometry(0.24 * H, 0.1 * H, 0.14 * H);
  pelvisGeo.translate(0, legLen + 0.03 * H, 0);
  const torsoH = 0.3 * H;
  const torsoGeo = new THREE.BoxGeometry(0.27 * H, torsoH, 0.16 * H);
  torsoGeo.translate(0, legLen + 0.08 * H + torsoH / 2, 0);
  const torsoParts = [[pelvisGeo, shade(cloth, 0.9)], [torsoGeo, cloth]];
  if (role.metal) {
    const chestGeo = new THREE.BoxGeometry(0.235 * H, 0.2 * H, 0.18 * H);
    chestGeo.translate(0, legLen + 0.11 * H + torsoH / 2, 0);
    torsoParts.push([chestGeo, metal]);
  }
  const torso = vcMesh(torsoParts);
  body.add(torso);
  parts.torso = torso;
  // голова
  const neckY = legLen + 0.08 * H + torsoH;
  const head = new THREE.Group();
  head.position.y = neckY + 0.045 * H;
  const skullGeo = new THREE.BoxGeometry(0.12 * H, 0.135 * H, 0.13 * H);
  const hairGeo = new THREE.BoxGeometry(0.13 * H, 0.05 * H, 0.14 * H);
  hairGeo.translate(0, 0.06 * H, 0);
  const headParts = [[skullGeo, skin], [hairGeo, role.hair || hairColor(faction)]];
  if (role.helmet) {
    const helmGeo = new THREE.BoxGeometry(0.14 * H, 0.09 * H, 0.15 * H);
    helmGeo.translate(0, 0.05 * H, 0);
    headParts.push([helmGeo, role.metal || 0x8a9098]);
  }
  const skull = vcMesh(headParts);
  head.add(skull);
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.022 * H, 0.018 * H, 0.012 * H), mat(0x201810));
    eye.position.set(s * 0.03 * H, 0.012 * H, -0.068 * H);
    head.add(eye);
    eyes.push(eye);
  }
  body.add(head);
  parts.head = head; parts.skull = skull; parts.eyes = eyes;
  // руки
  const shoulderY = neckY - 0.02 * H;
  const upperArm = 0.18 * H, lowerArm = 0.17 * H;
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    const sh = new THREE.Group();
    sh.position.set(sign * 0.155 * H, shoulderY, 0);
    const up = vcMesh([[limbGeo(upperArm, 0.07 * H, 0.075 * H), role.metal ? metal : cloth]]);
    sh.add(up);
    const elbow = new THREE.Group();
    elbow.position.y = -upperArm;
    sh.add(elbow);
    const fistGeo = new THREE.BoxGeometry(0.07 * H, 0.075 * H, 0.07 * H);
    fistGeo.translate(0, -lowerArm, 0);
    const lo = vcMesh([[limbGeo(lowerArm, 0.06 * H, 0.065 * H), skin], [fistGeo, skin]]);
    elbow.add(lo);
    const hand = new THREE.Group();
    hand.position.y = -lowerArm;
    elbow.add(hand);
    body.add(sh);
    parts['arm' + side] = { sh, elbow, hand, up, lo, fist: lo, side };
  }

  const e = {
    id: 'npc' + (nextId++),
    kind: 'npc', role: roleKey, faction, name: o.name || generateName(faction, roleKey),
    group: root, body, parts, height: H, radius: 0.34 * (o.scale || 1), eyeHeight: neckY + 0.075 * H,
    pos: root.position, yaw: o.yaw || rnd.float() * Math.PI * 2, vy: 0, onGround: true,
    hp: role.hp, hpMax: role.hp, level: o.level || 1,
    armor: role.armor || 0, dmg: role.dmg, speed: role.speed * (o.speedMul || 1),
    weapon: role.weapon || 'fists', shield: !!role.shield, elite: !!role.elite, boss: !!role.boss,
    limbHp: { head: role.hp * 0.55, torso: role.hp, armL: role.hp * 0.42, armR: role.hp * 0.42, legL: role.hp * 0.48, legR: role.hp * 0.48 },
    missing: { armL: false, armR: false, legL: false, legR: false, eyeL: false, eyeR: false },
    bleeding: 0, dead: false, downed: false, crawling: false,
    anim: { walk: 0, phase: rnd.float() * 6.28, attack: 0, block: 0, draw: 0, hurt: 0, dead: 0, crawl: 0 },
    ai: {
      state: 'idle', target: null, home: { x: o.x || 0, z: o.z || 0 }, homeR: o.homeR || 12,
      timer: rnd.float() * 3, think: 0, waypoint: null, path: null, patrol: null, patrolT: 0,
      alert: 0, lastSeen: null, squad: o.squad || null, command: 'follow', formation: rnd.float() * 6.28,
      role: o.aiRole || null, order: null, disguise: false, looted: false, hostileToPlayer: false,
    },
    inventory: o.inventory ? o.inventory.slice() : rollNpcLoot(roleKey, faction),
    xp: role.xp || 5, spawn: { x: o.x, z: o.z }, home: roleKey,
    isPlayer: false, barks: [], lastBark: -10,
  };
  root.position.set(o.x || 0, heightAt(o.x || 0, o.z || 0), o.z || 0);
  root.rotation.y = e.yaw;
  root.userData.entity = e;
  setWeapon(e, e.weapon);
  applyEyeLoss(e);
  return e;
}
function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}
function hairColor(faction) {
  return { elves: 0xd8c48a, people: 0x6a4a2a, empire: 0x4a3a2a, villain: 0x2a2a2a, bandits: 0x3a2a1a }[faction] || 0x4a3a2a;
}
export function generateName(faction, role) {
  if (role === 'dregar') return 'Владыка Дрегар';
  const list = FIRST[faction] || FIRST.people;
  const rnd = new Rand(Date.now() % 100000 + Math.floor(Math.random() * 9999));
  return list[Math.floor(Math.random() * list.length)] + (rnd.float() < 0.3 ? ' Младший' : '');
}
function rollNpcLoot(role, faction) {
  const rnd = new Rand(Math.floor(Math.random() * 1e9));
  const loot = [{ id: 'gold', qty: rnd.int(3, 18) }];
  if (rnd.float() < 0.5) loot.push({ id: 'bandage', qty: 1 });
  if (rnd.float() < 0.25) loot.push({ id: 'bread', qty: 1 });
  if (role === 'guard' || role === 'legion' || role === 'captain') loot.push({ id: 'iron_sword', qty: 1 });
  if (role === 'archer' || role === 'elf_archer' || role === 'dark_archer') loot.push({ id: 'arrows', qty: rnd.int(3, 9) });
  if (role === 'dregar') { loot.push({ id: 'gold', qty: 250 }); loot.push({ id: 'dark_crystal', qty: 3 }); loot.push({ id: 'dregar_blade', qty: 1 }); }
  void faction;
  return loot;
}

// ------------------------- оружие -------------------------
export function setWeapon(e, weapon) {
  if (e.weaponMesh) { e.weaponMesh.removeFromParent(); e.weaponMesh = null; }
  if (e.shieldMesh) { e.shieldMesh.removeFromParent(); e.shieldMesh = null; }
  e.weapon = weapon;
  const hand = e.parts.armR ? e.parts.armR.hand : null;
  const lhand = e.parts.armL ? e.parts.armL.hand : null;
  const H = e.height;
  if (!hand) return;
  const add = (mesh, parent, x = 0, y = 0, z = 0, rx = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const steel = mat(0xb8bcc0), wood = mat(0x5a4228), dark = mat(0x2a2a2e);
  switch (weapon) {
    case 'sword':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.05 * H, 0.72 * H, 0.012 * H), steel), hand, 0, -0.2 * H, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14 * H, 0.03 * H, 0.03 * H), mat(0x8a7a4a)), hand, 0, 0.14 * H, 0);
      break;
    case 'greatsword':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.08 * H, 1.05 * H, 0.02 * H), mat(0xc8a0a0)), hand, 0, -0.35 * H, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.22 * H, 0.04 * H, 0.05 * H), mat(0x3a2a2a)), hand, 0, 0.2 * H, 0);
      break;
    case 'axe':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.04 * H, 0.6 * H, 0.04 * H), wood), hand, 0, -0.18 * H, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.05 * H, 0.16 * H, 0.22 * H), steel), hand, 0, 0.04 * H, 0.06 * H);
      break;
    case 'greataxe':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.055 * H, 0.9 * H, 0.055 * H), wood), hand, 0, -0.3 * H, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.07 * H, 0.26 * H, 0.36 * H), steel), hand, 0, 0.1 * H, 0.1 * H);
      break;
    case 'spear':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.035 * H, 1.7 * H, 0.035 * H), wood), hand, 0, -0.5 * H, 0);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.05 * H, 0.2 * H, 5), steel), hand, 0, 0.36 * H, 0);
      break;
    case 'dagger':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.035 * H, 0.35 * H, 0.012 * H), steel), hand, 0, -0.1 * H, 0);
      break;
    case 'staff':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.04 * H, 1.5 * H, 0.04 * H), wood), hand, 0, -0.4 * H, 0);
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 * H, 0), matEm(0x7fd0ff)), hand, 0, 0.36 * H, 0);
      break;
    case 'whip':
      e.weaponMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.03 * H, 0.1 * H, 0.03 * H), dark), hand, 0, -0.05 * H, 0);
      break;
    case 'bow':
      if (lhand) {
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42 * H, 0.02 * H, 4, 12, Math.PI * 1.1), wood);
        bow.rotation.y = Math.PI / 2;
        bow.rotation.z = -Math.PI * 0.55;
        add(bow, lhand, 0, -0.05 * H, 0);
        e.weaponMesh = bow;
      }
      break;
    default: break;
  }
  if (e.shield && lhand && weapon !== 'bow') {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.34 * H, 0.42 * H, 0.04 * H), mat(0x7a6a4a));
    sh.position.set(0, -0.12 * H, 0.02 * H);
    sh.castShadow = true;
    lhand.add(sh);
    e.shieldMesh = sh;
  }
}

// ------------------------- травмы и смерть -------------------------
export function severLimb(e, part, dir = { x: 0, y: 1, z: 0 }, opts = {}) {
  if (e.missing[part]) return;
  e.missing[part] = true;
  const P = e.parts[part];
  if (!P) return;
  const detach = [];
  if (part.startsWith('arm')) {
    detach.push(P.lo, P.fist);
    if (P.sh && P.sh.parent) P.up.scale.y = 0.55;
    if (e.weaponMesh && P.side === 'R') { e.weaponMesh.removeFromParent(); e.weaponMesh = null; }
    if (P.side === 'R' && e.shieldMesh) { /* щит в левой */ }
  } else if (part.startsWith('leg')) {
    detach.push(P.lo, P.foot);
    P.up.scale.y = 0.5;
  }
  for (const obj of detach) {
    if (!obj || !obj.parent) continue;
    G.scene.attach(obj);
    emit('gore:limb', { mesh: obj, dir, pos: obj.getWorldPosition(new THREE.Vector3()), color: 0xa02020 });
  }
  e.limbHp[part] = 0;
  e.bleeding = Math.min(3, e.bleeding + (part.startsWith('arm') ? 1 : 0.8));
  // обрубок
  const stumpPos = new THREE.Vector3();
  const src = part.startsWith('arm') ? e.parts[part].sh : e.parts[part].hip;
  src.getWorldPosition(stumpPos);
  if (G.gore) G.gore.stump(stumpPos, 0.06 * e.height, e);
  if (part.startsWith('leg')) {
    const other = part === 'legL' ? 'legR' : 'legL';
    e.crawling = e.missing[other];
    e.anim.crawl = 1;
    e.speed *= 0.62;
  }
  if (part.startsWith('arm')) {
    const other = part === 'armL' ? 'armR' : 'armL';
    if (e.missing[other]) e.speed *= 0.9;
    if (e.weapon === 'greataxe' || e.weapon === 'greatsword') {
      if (e.missing.armL || e.missing.armR) { setWeapon(e, 'sword'); e.dmg *= 0.75; }
    }
  }
  e.downed = e.missing.legL && e.missing.legR;
  emit('npc:sever', { entity: e, part });
  void opts;
}

export function applyEyeLoss(e) {
  if (!e.parts.eyes) return;
  e.parts.eyes[0].visible = !e.missing.eyeR;
  e.parts.eyes[1].visible = !e.missing.eyeL;
}

export function damageHumanoid(e, amount, part = 'torso', opts = {}) {
  if (e.dead) return { killed: false, severed: false };
  const loc = e.missing[part] === false ? part : 'torso';
  let dmg = amount * (1 - clamp(e.armor, 0, 0.85));
  if (opts.pierce) dmg = amount * (1 - clamp(e.armor * 0.4, 0, 0.6));
  if (loc === 'head') dmg *= 1.6;
  if (loc.startsWith('arm') || loc.startsWith('leg')) dmg *= 0.75;
  e.hp -= dmg;
  e.limbHp[loc] = Math.max(0, (e.limbHp[loc] || 0) - dmg * (loc === 'torso' ? 1 : 1.4));
  e.anim.hurt = 1;
  e.bleeding = Math.min(3, e.bleeding + (opts.bleed ?? 0.15));
  if (e.ai) {
    e.ai.alert = 12;
    if (opts.attacker) e.ai.target = opts.attacker;
  }
  // отрубание
  let severed = false;
  const limbThreshold = (loc.startsWith('arm') || loc.startsWith('leg')) ? 0.25 : 0;
  if (part !== 'torso' && part !== 'head' && !e.missing[part] && e.limbHp[part] <= e.hpMax * limbThreshold && (opts.sever || e.limbHp[part] <= 0)) {
    severLimb(e, part, opts.dir || { x: 0, y: 1, z: 0 });
    severed = true;
  }
  if (part === 'head' && e.hp <= 0 && (opts.sever || e.limbHp.head <= 0)) {
    // отсечение головы
    if (e.parts.head && e.parts.head.parent) {
      const head = e.parts.head;
      G.scene.attach(head);
      emit('gore:limb', { mesh: head, dir: { x: 0, y: 1.4, z: 0 }, pos: head.getWorldPosition(new THREE.Vector3()), color: 0xa02020 });
      severed = true;
      e.decapitated = true;
    }
  }
  if (e.hp <= 0) return { killed: killHumanoid(e, opts), severed };
  return { killed: false, severed };
}

export function killHumanoid(e, opts = {}) {
  if (e.dead) return true;
  e.dead = true;
  e.hp = 0;
  e.bleeding = 0;
  e.anim.dead = 0.001;
  if (e.ai) e.ai.state = 'dead';
  emit('npc:death', { entity: e, killer: opts.attacker, part: opts.part });
  return true;
}

export function healHumanoid(e, amount) {
  e.hp = Math.min(e.hpMax, e.hp + amount);
  for (const k of Object.keys(e.limbHp)) {
    if (k === 'torso') e.limbHp[k] = Math.min(e.hpMax, e.limbHp[k] + amount * 0.5);
    else e.limbHp[k] = Math.min(e.hpMax * 0.42, e.limbHp[k] + amount * 0.4);
  }
}

// ------------------------- физика и анимация -------------------------
export function updateHumanoid(e, dt) {
  const p = e.pos;
  // гравитация
  const ground = surfaceHeight(p.x, p.z, p.y);
  if (!e.onGround) {
    e.vy -= 22 * dt;
    p.y += e.vy * dt;
    if (p.y <= ground) { p.y = ground; e.vy = 0; e.onGround = true; }
  } else {
    if (p.y > ground + 0.25) { e.onGround = false; e.vy = 0; }
    else p.y = ground;
  }
  if (e.dead) {
    e.anim.dead = Math.min(1, (e.anim.dead || 0) + dt * 2.2);
    animateDead(e);
    return;
  }
  // кровотечение
  if (e.bleeding > 0) {
    e.bleedTimer = (e.bleedTimer || 0) + dt;
    if (e.bleedTimer > 1.1) {
      e.bleedTimer = 0;
      e.hp -= e.bleeding * 1.15;
      emit('npc:bleed', { entity: e });
      if (e.hp <= 0) killHumanoid(e, { cause: 'bleeding' });
    }
  }
  // столкновения
  resolveCollisions(p, e.radius, p.y, e.height);
  animateHumanoid(e, dt);
}

function animateDead(e) {
  const B = e.body;
  const t = e.anim.dead;
  B.rotation.x = -Math.PI / 2 * Math.min(1, t * 1.2);
  B.position.y = lerp(0, 0.12 * e.height, Math.min(1, t));
  const P = e.parts;
  for (const side of ['L', 'R']) {
    const arm = P['arm' + side], leg = P['leg' + side];
    if (arm) {
      arm.sh.rotation.z = lerp(arm.sh.rotation.z, side === 'L' ? 1.1 : -1.1, 0.15);
      arm.sh.rotation.x = lerp(arm.sh.rotation.x, -0.4, 0.15);
      arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, -0.3, 0.1);
    }
    if (leg) {
      leg.hip.rotation.z = lerp(leg.hip.rotation.z, side === 'L' ? 0.25 : -0.25, 0.12);
      leg.hip.rotation.x = lerp(leg.hip.rotation.x, 0.1, 0.1);
      leg.knee.rotation.x = lerp(leg.knee.rotation.x, -0.25, 0.1);
    }
  }
  if (P.head) P.head.rotation.z = lerp(P.head.rotation.z, 0.25, 0.1);
}

export function animateHumanoid(e, dt) {
  const A = e.anim;
  const P = e.parts;
  A.hurt = Math.max(0, A.hurt - dt * 3);
  A.attack = Math.max(0, A.attack - dt * (1 / Math.max(0.18, e.attackTime || 0.42)));
  A.block = damp(A.block, e.blocking ? 1 : 0, 12, dt);
  A.draw = damp(A.draw, e.drawing ? 1 : 0, 10, dt);
  const speed = e.speedNow || 0;
  const moving = speed > 0.25;
  if (moving) A.phase += dt * (4.6 + speed * 1.5);
  else A.phase += dt * 1.6;
  const swing = moving ? Math.sin(A.phase) * clamp(speed / 4, 0.2, 1) : Math.sin(A.phase) * 0.05;
  const crawl = A.crawl;
  const crouch = e.crouching ? 0.75 : 1;

  e.body.position.y = (moving && !crawl ? Math.abs(Math.sin(A.phase)) * 0.035 * e.height : 0) - (1 - crouch) * 0.12 * e.height;
  e.body.rotation.x = lerp(-Math.PI * 0.42, 0, crawl ? 0 : 1) * (crawl ? 1 : 0) + (e.crouching ? 0.12 : 0);
  e.body.rotation.z = moving && !crawl ? Math.sin(A.phase) * 0.02 : 0;

  for (const side of ['L', 'R']) {
    const arm = P['arm' + side], leg = P['leg' + side];
    const sign = side === 'L' ? 1 : -1;
    if (leg && !e.missing['leg' + side]) {
      if (crawl) {
        leg.hip.rotation.x = 0.35 + Math.sin(A.phase * 0.8) * 0.15 * sign;
        leg.knee.rotation.x = -0.5;
      } else {
        leg.hip.rotation.x = -swing * sign * 1.1;
        leg.knee.rotation.x = Math.max(0, swing * sign) * 1.2 - (moving ? 0.15 : 0.05);
      }
    } else if (leg) {
      leg.hip.rotation.x = -0.25;
      leg.knee.rotation.x = -0.9;
    }
    if (arm && !e.missing['arm' + side]) {
      let baseX = swing * sign * 0.9;
      let rotZ = sign * 0.08;
      if (e.weapon === 'bow' && side === 'L' && (e.ai && e.ai.state === 'aim')) { baseX = -1.45; rotZ = 0.25; }
      if (A.attack > 0 && side === 'R') {
        const t = 1 - A.attack;
        baseX = -1.5 + Math.sin(t * Math.PI) * 2.6;
        rotZ = -0.4 + Math.sin(t * Math.PI) * 0.6;
        arm.elbow.rotation.x = -0.7 + Math.sin(t * Math.PI) * 0.5;
      } else if (A.attack > 0 && side === 'L' && e.weapon === 'bow') {
        baseX = -1.3;
      } else {
        arm.elbow.rotation.x = damp(arm.elbow.rotation.x, -0.35 - (A.block > 0.4 ? 0.6 : 0), 8, dt);
      }
      if (A.block > 0.05 && side === 'L') { baseX = -1.25 * A.block; rotZ = 0.5 * A.block; }
      arm.sh.rotation.x = damp(arm.sh.rotation.x, baseX, 14, dt);
      arm.sh.rotation.z = damp(arm.sh.rotation.z, rotZ, 12, dt);
    }
  }
  if (P.head) {
    P.head.rotation.y = damp(P.head.rotation.y, (e.lookYaw || 0) * 0.6, 6, dt);
    P.head.rotation.x = damp(P.head.rotation.x, (e.lookPitch || 0) * 0.4, 6, dt);
  }
  if (e.crawling) {
    for (const side of ['L', 'R']) {
      const arm = P['arm' + side];
      if (!arm || e.missing['arm' + side]) continue;
      const s = side === 'L' ? 1 : -1;
      arm.sh.rotation.x = -1.3 + Math.sin(A.phase * 1.4 + (s > 0 ? 0 : Math.PI)) * 0.7;
    }
  }
}

export function turnTo(e, x, z, dt, rate = 6) {
  const want = Math.atan2(x - e.pos.x, z - e.pos.z);
  e.yaw = angleTowards(e.yaw, want, rate * dt);
  e.group.rotation.y = e.yaw;
  return Math.abs(wrapAngle(want - e.yaw));
}

export function faceAngle(e, angle, dt, rate = 6) {
  e.yaw = angleTowards(e.yaw, angle, rate * dt);
  e.group.rotation.y = e.yaw;
}

export function bark(e, kind, force = false) {
  if (!force && G.now - e.lastBark < 6) return;
  const pool = kind === 'aggro'
    ? (BARKS[e.faction] && Math.random() < 0.5 ? BARKS[e.faction] : BARKS.aggro)
    : BARKS[kind];
  if (!pool) return;
  e.lastBark = G.now;
  emit('bark', { entity: e, text: pool[Math.floor(Math.random() * pool.length)] });
}

export function setHumanoidShadow(e, on) {
  if (e._shadowOn === on) return;
  e._shadowOn = on;
  e.group.traverse((o) => { if (o.isMesh) o.castShadow = on; });
}

export function disposeHumanoid(e) {
  if (e.group.parent) e.group.parent.remove(e.group);
  const idx = G.entities.indexOf(e);
  if (idx >= 0) G.entities.splice(idx, 1);
}

export function rollLimbPart(hitYRatio) {
  if (hitYRatio > 0.84) return 'head';
  if (hitYRatio > 0.42) return Math.random() < 0.22 ? (Math.random() < 0.5 ? 'armL' : 'armR') : 'torso';
  return Math.random() < 0.7 ? (Math.random() < 0.5 ? 'legL' : 'legR') : 'torso';
}
