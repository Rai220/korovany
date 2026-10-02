// Корованы: волы, телеги, охрана, тракт. Можно грабить.
import * as THREE from 'three';
import { G, emit, notify } from '../core/state.js';
import { clamp, dist2D, lerp } from '../core/mathutil.js';
import { Rand } from '../core/rng.js';
import { spawnNPC } from './npc.js';
import { setTroopHostility } from './npc.js';
import { makeContainer } from '../world/props.js';
import { heightAt, roadPointAt, roadLength, PLACES } from '../world/terrain.js';
import { addCollider } from '../world/collision.js';

const caravans = [];
const ROUTES = {
  trade: { road: 'trade', from: 'village', to: 'palace', name: 'Торговый корован' },
  spice: { road: 'trade', from: 'palace', to: 'village', name: 'Корован с пряностями' },
  forest: { road: 'forest', from: 'crossroad', to: 'elfvillage', name: 'Корован к эльфам' },
  mountain: { road: 'pass', from: 'crossroad', to: 'fort', name: 'Корован в горы' },
};

function oxMesh(rnd) {
  const g = new THREE.Group();
  const hide = new THREE.MeshLambertMaterial({ color: rnd.pick([0x8a6a4a, 0x6a5a44, 0xa08060]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 2.0), hide);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.8), hide);
  head.position.set(0, 1.25, -1.3);
  head.castShadow = true;
  g.add(head);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 5), new THREE.MeshLambertMaterial({ color: 0xd8cba8 }));
    horn.position.set(s * 0.28, 1.55, -1.4);
    horn.rotation.z = s * 0.7;
    g.add(horn);
  }
  const legs = [];
  for (const [sx, sz] of [[-0.4, -0.7], [0.4, -0.7], [-0.4, 0.7], [0.4, 0.7]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.22), hide);
    leg.position.set(sx, 0.5, sz);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  g.userData.head = head;
  return g;
}

function cartMesh(rnd) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: rnd.pick([0x6b5230, 0x74593a, 0x5d4728]) });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 3.2), wood);
  box.position.y = 1.25;
  box.castShadow = true;
  g.add(box);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 3.3), new THREE.MeshLambertMaterial({ color: 0x4a3520 }));
  frame.position.y = 0.72;
  g.add(frame);
  for (const [sx, sz] of [[-0.95, -1.1], [0.95, -1.1], [-0.95, 1.1], [0.95, 1.1]]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 5, 12), new THREE.MeshLambertMaterial({ color: 0x3a2a18 }));
    wheel.position.set(sx, 0.62, sz);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    g.add(wheel);
  }
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 3.4), new THREE.MeshLambertMaterial({ color: 0x8a3a3a }));
  awning.position.y = 1.95;
  g.add(awning);
  return g;
}

export function spawnCaravan(kind = 'trade') {
  const route = ROUTES[kind] || ROUTES.trade;
  const rnd = new Rand(Math.floor(Math.random() * 1e9));
  const from = PLACES.find((p) => p.id === route.from) || PLACES[0];
  const to = PLACES.find((p) => p.id === route.to) || PLACES[1];
  const roadLen = roadLength(route.road);
  const group = new THREE.Group();
  group.name = 'caravan_' + kind;
  G.scene.add(group);
  const caravan = {
    id: 'caravan' + (caravans.length + 1) + '_' + Math.floor(Math.random() * 999),
    kind, route, name: route.name, s: 0, speed: 1.5, group,
    carts: [], guards: [], oxen: [], alive: true, paused: 0, dir: 1,
    goods: caravanGoods(kind, rnd), robbed: false, hostile: false,
    home: { x: from.x, z: from.z }, target: { x: to.x, z: to.z },
  };
  const cartCount = kind === 'trade' ? 3 : kind === 'spice' ? 2 : 2;
  for (let i = 0; i < cartCount; i++) {
    const cart = cartMesh(rnd);
    const ox = oxMesh(rnd);
    ox.position.set(0, 0, 2.6);
    cart.add(ox);
    group.add(cart);
    const c = makeContainer(0, 0, i === 0 ? 'chest' : 'crate', { loot: [], rich: kind !== 'forest' });
    c.onCart = cart;
    c.loot = [];
    c.loot.push({ id: 'gold', qty: rnd.int(30, 120) * (kind === 'spice' ? 2 : 1) });
    if (rnd.float() < 0.7) c.loot.push({ id: rnd.pick(['silver_ring', 'gem', 'dark_crystal', 'herb', 'pelt', 'ale']), qty: rnd.int(1, 3) });
    if (rnd.float() < 0.5) c.loot.push({ id: 'bandage', qty: rnd.int(1, 2) });
    const off = (i - (cartCount - 1) / 2) * 8.5;
    caravan.carts.push({ mesh: cart, ox, off, container: c });
  }
  const guardCount = kind === 'spice' ? 5 : kind === 'trade' ? 4 : 3;
  for (let i = 0; i < guardCount; i++) {
    const role = i === 0 ? 'captain' : (i % 3 === 2 ? 'archer' : 'guard');
    const e = spawnNPC({ role, faction: 'empire', x: from.x, z: from.z + i * 2, homeR: 400, aiRole: 'caravan_guard' });
    e.ai.caravan = caravan;
    e.ai.command = 'follow';
    e.ai.formation = i * 1.3;
    caravan.guards.push(e);
  }
  caravans.push(caravan);
  G.caravans.push(caravan);
  emit('caravan:spawn', { caravan });
  updateCaravan(caravan, 0);
  return caravan;
}

function caravanGoods(kind, rnd) {
  const g = [];
  for (let i = 0; i < rnd.int(2, 4); i++) g.push({ id: rnd.pick(['pelt', 'herb', 'ore', 'silver_ring', 'gem', 'ale', 'cheese']), qty: rnd.int(1, 4) });
  if (kind === 'spice') g.push({ id: 'gem', qty: rnd.int(1, 3) });
  return g;
}

export function updateCaravans(dt) {
  for (const c of caravans) {
    if (!c.alive) continue;
    updateCaravan(c, dt);
  }
}

function updateCaravan(c, dt) {
  const route = c.route;
  const roadLen = roadLength(route.road);
  if (c.paused > 0) {
    c.paused -= dt;
  } else {
    c.s += c.speed * dt * c.dir;
    if (c.s > roadLen) { c.s = roadLen; c.paused = 12; c.dir = -1; c.reachedEnd = true; }
    if (c.s < 0) { c.s = 0; c.paused = 12; c.dir = 1; c.reachedEnd = true; }
  }
  const pt = roadPointAt(route.road, clamp(c.s, 0, roadLen));
  const yaw = pt.dir;
  const cx = pt.x + Math.cos(yaw) * 0, cz = pt.z;
  c.group.position.set(cx, heightAt(cx, cz), cz);
  c.group.rotation.y = yaw;
  c.pos = { x: cx, z: cz };
  for (const cart of c.carts) {
    cart.mesh.position.set(0, 0, -cart.off);
    const legs = cart.ox.userData.legs;
    const ph = G.now * 4 + cart.off;
    legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * 1.5) * 0.4; });
    if (cart.ox.userData.head) cart.ox.userData.head.rotation.x = Math.sin(ph * 0.7) * 0.08;
    // контейнер телеги
    const wp = new THREE.Vector3();
    cart.mesh.getWorldPosition(wp);
    cart.container.x = wp.x; cart.container.z = wp.z; cart.container.y = wp.y + 0.6;
    cart.container.mesh.position.set(wp.x, wp.y + 1.7, wp.z);
    cart.container.mesh.rotation.y = yaw;
  }
  // охрана идёт рядом
  for (let i = 0; i < c.guards.length; i++) {
    const g = c.guards[i];
    if (!g || g.dead) continue;
    const off = (i - (c.guards.length - 1) / 2) * 2.4;
    const tx = cx + Math.cos(yaw) * (4 + Math.abs(off)) - Math.sin(yaw) * off;
    const tz = cz + Math.sin(yaw) * (4 + Math.abs(off)) + Math.cos(yaw) * off;
    const d = dist2D(g.pos.x, g.pos.z, tx, tz);
    if (d > 2 && (!g.ai.target || g.ai.target.dead)) {
      const want = Math.atan2(tx - g.pos.x, tz - g.pos.z);
      g.yaw = lerp(g.yaw, want, 0.06);
      g.group.rotation.y = g.yaw;
      const sp = Math.min(g.speed * 0.85, d * 1.6);
      g.pos.x += Math.sin(g.yaw) * sp * dt * (d > 6 ? 2 : 1);
      g.pos.z += Math.cos(g.yaw) * sp * dt * (d > 6 ? 2 : 1);
      g.speedNow = sp;
    } else if (!g.ai.target) g.speedNow = 0;
  }
  if (c.reachedEnd) {
    c.reachedEnd = false;
    const place = c.dir > 0 ? c.target : c.home;
    emit('caravan:arrived', { caravan: c, place });
  }
}

export function caravanAt(x, z, maxD = 4) {
  for (const c of caravans) {
    if (!c.alive || !c.pos) continue;
    if (dist2D(x, z, c.pos.x, c.pos.z) < maxD + 14) return c;
  }
  return null;
}

// Нападение на корован: охрана становится враждебной
export function aggroCaravan(c, attacker) {
  if (!c) return;
  c.hostile = true;
  for (const g of c.guards) {
    if (!g || g.dead) continue;
    setTroopHostility(g, true);
    g.ai.target = attacker || G.player;
    g.ai.alert = 30;
    g.ai.caravanGuard = true;
  }
  if (!c.robbed) {
    c.robbed = true;
    notify(`${c.name}: охрана берётся за оружие!`, 'bad');
    emit('caravan:aggro', { caravan: c });
  }
}

export function caravanAftermath(c) {
  const alive = c.guards.filter((g) => !g.dead).length;
  if (alive === 0 && c.alive) {
    c.alive = false;
    notify(`${c.name} ограблен! Забирай добро из телег.`, 'good');
    G.stats.caravansRobbed++;
    if (G.player) G.player.stats.caravans++;
    emit('caravan:robbed', { caravan: c });
    if (G.quests) G.quests.onCaravanRobbed(c);
  }
}

export function nearestCaravanEvent() {
  const p = G.player;
  let best = null, bd = 1e9;
  for (const c of caravans) {
    if (!c.pos) continue;
    const d = dist2D(p.pos.x, p.pos.z, c.pos.x, c.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return { caravan: best, dist: bd };
}

export function despawnCaravans() {
  for (const c of caravans) {
    if (c.group && c.group.parent) c.group.parent.remove(c.group);
    for (const g of c.guards) if (g && g.group.parent) g.group.parent.remove(g.group);
  }
  caravans.length = 0;
  G.caravans.length = 0;
}
void addCollider; void roadPointAt; void roadLen0();
function roadLen0() { return 0; }
