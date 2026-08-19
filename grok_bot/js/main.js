import * as THREE from "three";
import {
  WORLD,
  heightAt,
  zoneAt,
  ZONE_NAME,
  createWorld,
  resolveMove,
} from "./world.js";

const SAVE_KEY = "korovany_grok_bot_v1";

let canvas;
let renderer;
let scene;
let camera;
let world;
let clock;
let game = null;

function showBootError(err) {
  const el = document.getElementById("boot-error");
  const st = document.getElementById("boot-status");
  if (st) st.hidden = true;
  if (!el) return;
  el.hidden = false;
  const msg = err && err.message ? err.message : String(err || "ошибка");
  const proto = location.protocol === "file:"
    ? " Открой папку по http (GitHub Pages или python3 -m http.server) — ES modules с file:// не живут."
    : "";
  el.textContent = msg + proto;
}
const keys = new Set();
let pointerLocked = false;
let thirdPerson = false;
let uiOpen = false;
let started = false;
let dead = false;

const SHOP = [
  { id: "sword", name: "Меч", price: 40, desc: "Сильнее бьёт" },
  { id: "bandage", name: "Бинты", price: 8, desc: "Остановить кровотечение" },
  { id: "potion", name: "Зелье", price: 15, desc: "+40 здоровья" },
  { id: "prosthesis_arm", name: "Протез руки", price: 35, desc: "Вернуть удар" },
  { id: "prosthesis_leg", name: "Протез ноги", price: 40, desc: "Снова ходить" },
  { id: "wheelchair", name: "Коляска", price: 25, desc: "Катиться без ноги" },
];

const GUARD_ORDERS = [
  "Держать ворота дворца. Никого чужого во двор.",
  "Патрулировать стены и искать шпионов эльфов.",
  "Набег на чащу: выжечь партизанские хижины.",
  "Перехватить людей Морвейна на тракте к горам.",
];

const FAC = {
  elf: { title: "Лесные эльфы", color: 0x2f6b32, skin: 0xd4b896, accent: 0x1e3d1c },
  guard: { title: "Охрана дворца", color: 0x2a4a8a, skin: 0xc8b090, accent: 0xc9a227 },
  villain: { title: "Владыка Морвейн", color: 0x4a1218, skin: 0xb09078, accent: 0x1a1012 },
  civilian: { title: "Житель", color: 0x6a5340, skin: 0xc4a882, accent: 0x4a3a28 },
};

let player;
const actors = [];
let caravan;
let commanderOrder = GUARD_ORDERS[0];
let orderTimer = 0;
let raidTimer = 18;
let villainCmd = 2;
let swingT = 0;
let logLines = [];

function mat(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

function makeHumanoid(faction, opts = {}) {
  const pal = FAC[faction];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), mat(pal.color));
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mat(pal.skin));
  head.position.y = 1.76;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.4), mat(pal.accent));
  helm.position.y = 1.96;
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), mat(pal.skin));
  lArm.position.set(-0.4, 1.15, 0);
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), mat(pal.skin));
  rArm.position.set(0.4, 1.15, 0);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), mat(0x2a2420));
  lLeg.position.set(-0.16, 0.4, 0);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), mat(0x2a2420));
  rLeg.position.set(0.16, 0.4, 0);
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 1.05), mat(opts.steel ? 0xb0b8c0 : 0x8a9070));
  weapon.position.set(0.52, 1.15, 0.45);
  g.add(body, head, helm, lArm, rArm, lLeg, rLeg, weapon);
  if (faction === "elf") {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 5), mat(0x1e4a22));
    hood.position.y = 2.12;
    g.add(hood);
  }
  if (faction === "villain") {
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 5), mat(0xeee8d8));
    hornL.position.set(-0.14, 2.18, 0);
    hornL.rotation.z = 0.4;
    const hornR = hornL.clone();
    hornR.position.x = 0.14;
    hornR.rotation.z = -0.4;
    g.add(hornL, hornR);
  }
  return { group: g, body, head, lArm, rArm, lLeg, rLeg, weapon };
}

function spawnActor(faction, x, z, role) {
  const parts = makeHumanoid(faction, { steel: faction === "guard" });
  const y = heightAt(x, z);
  parts.group.position.set(x, y, z);
  scene.add(parts.group);
  const a = {
    id: actors.length,
    faction,
    role,
    parts,
    group: parts.group,
    x,
    y,
    z,
    yaw: 0,
    hp: role === "commander" || role === "morveyn" ? 160 : 80,
    maxHp: role === "commander" || role === "morveyn" ? 160 : 80,
    dead: false,
    wounds: { arm: false, eye: false, leg: false },
    lootGold: 6 + ((Math.random() * 14) | 0),
    looted: false,
    speed: 3.6,
    attackCd: 0,
    home: new THREE.Vector3(x, 0, z),
    target: null,
    raid: false,
  };
  actors.push(a);
  return a;
}

function makeCaravan() {
  const g = new THREE.Group();
  const horse = new THREE.Group();
  const hBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 1.35), mat(0x5a3a22));
  hBody.position.y = 0.85;
  const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.45), mat(0x4a2e18));
  hHead.position.set(0, 1.15, 0.85);
  const hLegGeo = new THREE.BoxGeometry(0.1, 0.7, 0.1);
  for (const [lx, lz] of [
    [-0.18, 0.4],
    [0.18, 0.4],
    [-0.18, -0.4],
    [0.18, -0.4],
  ]) {
    const lg = new THREE.Mesh(hLegGeo, mat(0x2a1a10));
    lg.position.set(lx, 0.35, lz);
    horse.add(lg);
  }
  horse.add(hBody, hHead);
  horse.position.set(0, 0, 2.4);
  const wagon = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 2.3), mat(0x7a4e28));
  wagon.position.set(0, 0.85, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 10);
  const wheels = [];
  for (const [wx, wz] of [
    [-0.85, 0.7],
    [0.85, 0.7],
    [-0.85, -0.7],
    [0.85, -0.7],
  ]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x2a1e14));
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), mat(0x8a6a30));
  crate1.position.set(-0.3, 1.5, 0.2);
  const crate2 = crate1.clone();
  crate2.position.set(0.35, 1.5, -0.35);
  const crate3 = crate1.clone();
  crate3.position.set(0.05, 1.95, 0.05);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.4), mat(0x6a2020));
  cloth.position.set(0, 2.22, 0);
  g.add(horse, wagon, crate1, crate2, crate3, cloth);
  scene.add(g);
  const waypoints = [
    new THREE.Vector3(-110, 0, 10),
    new THREE.Vector3(-40, 0, 8),
    new THREE.Vector3(8, 0, -8),
    new THREE.Vector3(20, 0, -50),
    new THREE.Vector3(-20, 0, -40),
    new THREE.Vector3(-10, 0, 8),
    new THREE.Vector3(50, 0, 10),
    new THREE.Vector3(70, 0, 40),
    new THREE.Vector3(30, 0, 10),
    new THREE.Vector3(-80, 0, 10),
  ];
  return {
    group: g,
    horse,
    wheels,
    waypoints,
    wi: 0,
    looted: false,
    gold: 48,
    x: -110,
    z: 10,
  };
}

function startGame(faction, saved) {
  if (!world || !world.spots) {
    showBootError("World.spots нет — игра не стартовала. Сначала создаётся мир, потом кнопки.");
    return;
  }
  if (started && !saved) return;
  started = true;
  dead = false;
  document.getElementById("start").hidden = true;
  document.getElementById("hud").hidden = false;
  document.getElementById("dead").hidden = true;

  if (!saved) {
    actors.length = 0;
    const leftovers = scene.children.filter((c) => c.userData && c.userData.actor);
    leftovers.forEach((c) => scene.remove(c));
    scene.children.filter((c) => c.userData && c.userData.gib).forEach((c) => scene.remove(c));

    const L = world.spots;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 16;
      spawnActor("elf", L.forest.x + Math.cos(a) * r, L.forest.z + Math.sin(a) * r, "soldier");
    }
    spawnActor("guard", L.commander.x, L.commander.z, "commander");
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 16;
      spawnActor("guard", L.palace.x + Math.cos(a) * r, L.palace.z + Math.sin(a) * r - 8, "soldier");
    }
    if (faction !== "villain") spawnActor("villain", L.fort.x, L.fort.z - 6, "morveyn");
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 12;
      spawnActor("villain", L.fort.x + Math.cos(a) * r, L.fort.z + Math.sin(a) * r, "soldier");
    }
    for (let i = 0; i < 4; i++) {
      spawnActor("civilian", -60 - Math.random() * 30, -55 - Math.random() * 30, "civilian");
    }
    const g1 = spawnActor("guard", -108, 12, "caravan");
    const g2 = spawnActor("guard", -112, 8, "caravan");
    g1.lootGold = 12;
    g2.lootGold = 12;
    caravan = makeCaravan();
    caravan.guards = [g1, g2];

    const spawn = world.spots[faction];
    player = {
      faction,
      x: spawn.x,
      y: heightAt(spawn.x, spawn.z),
      z: spawn.z,
      yaw: spawn.yaw,
      pitch: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      gold: spawn.gold,
      wounds: { arm: false, eye: false, leg: false },
      bleeding: false,
      inv: {
        sword: false,
        bandage: 1,
        potion: 0,
        prosthesis_arm: false,
        prosthesis_leg: false,
        wheelchair: false,
      },
      usingChair: false,
    };
    const body = makeHumanoid(faction, { steel: true });
    body.group.userData.playerBody = true;
    scene.add(body.group);
    player.parts = body;
    commanderOrder = GUARD_ORDERS[0];
    villainCmd = 2;
    logLines = [];
    log("Добро пожаловать. H — помощь, M — карта.");
    if (faction === "elf") log("На тракте у опушки идёт корован. Стражу сначала.");
    if (faction === "guard") log("Командир ждёт у ворот. Слушай приказ на HUD.");
    if (faction === "villain") log("1 — за мной, 2 — форт, 3 — штурм дворца.");
  }

  applyFactionHud();
  tryLock();
}

function applyFactionHud() {
  document.getElementById("faction-name").textContent = FAC[player.faction].title;
}

function log(msg) {
  logLines.unshift(msg);
  logLines = logLines.slice(0, 5);
  document.getElementById("log").innerHTML = logLines.map((l) => `<div>${l}</div>`).join("");
}

function hostile(a, b) {
  if (!a || !b || a === b) return false;
  const fa = a.faction || a;
  const fb = b.faction || b;
  if (fa === "civilian" || fb === "civilian") return false;
  return fa !== fb;
}

function gib(part, color, x, y, z, yaw) {
  const m = part.clone();
  m.material = mat(color);
  m.position.set(x, y + 1.1, z);
  m.rotation.y = yaw;
  m.userData.gib = true;
  m.userData.life = 8;
  m.userData.vx = Math.sin(yaw) * 3 + (Math.random() - 0.5);
  m.userData.vz = Math.cos(yaw) * 3 + (Math.random() - 0.5);
  m.userData.vy = 3.5;
  scene.add(m);
}

function applyWound(who, part) {
  if (part === "arm" && !who.wounds.arm) {
    who.wounds.arm = true;
    who.parts.lArm.visible = false;
    if (who === player) {
      player.bleeding = !player.inv.prosthesis_arm;
      log("Руку отсекли. Кровь идёт — бинты или лекарь.");
    }
  } else if (part === "eye" && !who.wounds.eye) {
    who.wounds.eye = true;
    who.parts.head.material = mat(0x2a1010);
    if (who === player) {
      document.getElementById("eye-mask").hidden = false;
      log("Глаз выбит. Пол-экрана темно.");
    }
  } else if (part === "leg" && !who.wounds.leg) {
    who.wounds.leg = true;
    who.parts.lLeg.visible = false;
    if (who === player) log("Ногу отрубили. Ползёшь, пока нет коляски или протеза.");
  }
}

function kill(who) {
  if (who.dead) return;
  who.dead = true;
  who.hp = 0;
  who.group.rotation.x = Math.PI / 2;
  who.group.position.y = heightAt(who.x, who.z) + 0.18;
  who.parts.weapon.visible = false;
  log(who.role === "civilian" ? "Житель пал." : `${FAC[who.faction].title}: труп остался.`);
}

function strikeTarget(attacker, victim, power) {
  if (!victim || victim.dead) return;
  victim.hp -= power;
  const r = Math.random();
  let part = "torso";
  if (attacker === player) {
    if (player.pitch < -0.25) part = "leg";
    else if (player.pitch > 0.28) part = "eye";
    else if (r < 0.45) part = "arm";
  } else if (r < 0.22) part = ["arm", "eye", "leg"][(Math.random() * 3) | 0];
  if (part !== "torso") {
    applyWound(victim, part);
    const col = FAC[victim.faction].skin;
    const mesh =
      part === "arm" ? victim.parts.lArm : part === "leg" ? victim.parts.lLeg : victim.parts.head;
    gib(mesh, col, victim.x, victim.y, victim.z, attacker.yaw || 0);
  }
  if (victim === player) {
    log("Тебя рубанули!");
    if (part === "arm") player.bleeding = !player.inv.prosthesis_arm;
  }
  if (victim.hp <= 0) {
    if (victim === player) die("Смерть от клинка.");
    else kill(victim);
  }
}

function die(reason) {
  if (dead) return;
  dead = true;
  document.getElementById("dead").hidden = false;
  document.getElementById("dead-reason").textContent = reason;
  document.exitPointerLock?.();
  log(reason);
}

function facing() {
  return new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
}

function playerSpeed() {
  if (player.wounds.leg && !player.inv.prosthesis_leg) {
    if (player.inv.wheelchair && player.usingChair) return 5.1;
    return 1.55;
  }
  return 7.4;
}

function tryLock() {
  if (!started || uiOpen || dead) return;
  canvas.requestPointerLock?.();
}

function togglePanel(id) {
  const el = document.getElementById(id);
  const open = el.hidden;
  ["map-panel", "help-panel", "shop-panel"].forEach((p) => {
    document.getElementById(p).hidden = true;
  });
  el.hidden = !open;
  uiOpen = !el.hidden;
  if (uiOpen) document.exitPointerLock?.();
  if (id === "map-panel" && uiOpen) drawMap();
}

function nearestLoot() {
  let best = null;
  let bestD = 2.3;
  for (const a of actors) {
    if (!a.dead || a.looted) continue;
    const d = Math.hypot(a.x - player.x, a.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function nearestInteract() {
  for (const it of world.interact) {
    if (Math.hypot(it.x - player.x, it.z - player.z) < it.r) return it;
  }
  return null;
}

function caravanReady() {
  if (!caravan || caravan.looted) return false;
  if (!caravan.guards.every((g) => g.dead)) return false;
  return Math.hypot(caravan.x - player.x, caravan.z - player.z) < 3.4;
}

function interact() {
  if (dead) return;
  if (!document.getElementById("shop-panel").hidden) {
    document.getElementById("shop-panel").hidden = true;
    uiOpen = false;
    return;
  }
  const corpse = nearestLoot();
  if (corpse) {
    corpse.looted = true;
    player.gold += corpse.lootGold;
    if (Math.random() < 0.35) player.inv.bandage += 1;
    log(`Обыскал труп: +${corpse.lootGold} золота.`);
    return;
  }
  if (caravanReady()) {
    if (player.faction !== "elf") {
      log("Корован казённый. Грабят его лесные.");
      return;
    }
    caravan.looted = true;
    player.gold += caravan.gold;
    player.inv.bandage += 2;
    player.inv.potion += 1;
    log(`Корован ограблен: +${caravan.gold} золота, бинты и зелье.`);
    return;
  }
  const it = nearestInteract();
  if (!it) return;
  if (it.type === "shop") openShop();
  if (it.type === "healer") useHealer();
}

function openShop() {
  const box = document.getElementById("shop-list");
  document.getElementById("shop-title").textContent = "Лавка (как в Дэггерфолле, почти)";
  box.innerHTML = "";
  SHOP.forEach((item) => {
    const row = document.createElement("div");
    row.className = "shop-row";
    row.innerHTML = `<div><b>${item.name}</b> — ${item.price} зол.<div style="color:#9a8a68;font-size:13px">${item.desc}</div></div>`;
    const btn = document.createElement("button");
    btn.textContent = "Купить";
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      buy(item);
    });
    row.appendChild(btn);
    box.appendChild(row);
  });
  document.getElementById("shop-panel").hidden = false;
  uiOpen = true;
  document.exitPointerLock?.();
}

function buy(item) {
  if (player.gold < item.price) {
    log("Мало золота.");
    return;
  }
  player.gold -= item.price;
  if (item.id === "bandage") {
    player.inv.bandage += 1;
    player.bleeding = false;
    log("Бинты. Кровь остановлена, если шла.");
  } else if (item.id === "potion") {
    player.inv.potion += 1;
    player.hp = Math.min(player.maxHp, player.hp + 40);
    log("Выпил зелье.");
  } else if (item.id === "sword") {
    player.inv.sword = true;
    log("Меч куплен. Удары тяжелее.");
  } else if (item.id === "prosthesis_arm") {
    player.inv.prosthesis_arm = true;
    player.wounds.arm = false;
    player.bleeding = false;
    player.parts.lArm.visible = true;
    player.parts.lArm.material = mat(0x8a8a90);
    log("Протез руки надет.");
  } else if (item.id === "prosthesis_leg") {
    player.inv.prosthesis_leg = true;
    player.wounds.leg = false;
    player.usingChair = false;
    player.parts.lLeg.visible = true;
    player.parts.lLeg.material = mat(0x8a8a90);
    log("Протез ноги. Снова ходишь.");
  } else if (item.id === "wheelchair") {
    player.inv.wheelchair = true;
    player.usingChair = player.wounds.leg && !player.inv.prosthesis_leg;
    log("Коляска. Если нет ноги — катишься.");
  }
}

function useHealer() {
  if (player.gold < 20) {
    log("Лекарь: двадцать золота, не меньше.");
    return;
  }
  player.gold -= 20;
  player.hp = player.maxHp;
  player.bleeding = false;
  player.wounds.eye = false;
  document.getElementById("eye-mask").hidden = true;
  player.parts.head.material = mat(FAC[player.faction].skin);
  log("Лекарь за 20 золота: кровь и глаз в порядке. Конечности — только протезом.");
}

function melee() {
  if (dead || swingT > 0) return;
  if (player.wounds.arm && !player.inv.prosthesis_arm) {
    log("Без руки бьёшь слабо...");
  }
  swingT = 0.28;
  const dmgBase = player.inv.sword ? 26 : 15;
  const dmg = player.wounds.arm && !player.inv.prosthesis_arm ? dmgBase * 0.45 : dmgBase;
  const fwd = facing();
  let hit = null;
  let best = 2.55;
  for (const a of actors) {
    if (a.dead || !hostile(player, a)) continue;
    const dx = a.x - player.x;
    const dz = a.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > best || d < 0.2) continue;
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    if (dir.dot(fwd) < 0.28) continue;
    best = d;
    hit = a;
  }
  if (hit) {
    strikeTarget(player, hit, dmg + Math.random() * 6);
    log(`Удар по ${FAC[hit.faction].title}.`);
  }
}

function aimOf(a) {
  let best = null;
  let bestD = a.role === "civilian" ? 10 : 22;
  const consider = (x, z, ref) => {
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < bestD) {
      bestD = d;
      best = ref;
    }
  };
  if (hostile(a, player) && !dead) consider(player.x, player.z, player);
  for (const o of actors) {
    if (o.dead || o === a || !hostile(a, o)) continue;
    consider(o.x, o.z, o);
  }
  return best;
}

function steer(a, tx, tz, dt, speed) {
  const dx = tx - a.x;
  const dz = tz - a.z;
  const d = Math.hypot(dx, dz) || 1;
  a.yaw = Math.atan2(dx, dz);
  const step = Math.min(d, speed * dt);
  const nx = a.x + (dx / d) * step;
  const nz = a.z + (dz / d) * step;
  const r = resolveMove(a.x, a.z, nx, nz, world.colliders, 0.4);
  a.x = r.x;
  a.z = r.z;
  a.y = heightAt(a.x, a.z);
}

function updateActors(dt) {
  const L = world.spots || world.landmarks;
  orderTimer += dt;
  if (orderTimer > 26) {
    orderTimer = 0;
    commanderOrder = GUARD_ORDERS[(GUARD_ORDERS.indexOf(commanderOrder) + 1) % GUARD_ORDERS.length];
    if (player.faction === "guard") log("Новый приказ командира.");
  }
  raidTimer -= dt;
  if (raidTimer <= 0) {
    raidTimer = 42 + Math.random() * 18;
    const raiders = actors.filter((a) => a.faction === "elf" && !a.dead && a.role === "soldier").slice(0, 3);
    raiders.forEach((a) => {
      a.raid = true;
    });
    log("Партизаны эльфов идут набегом на старый форт.");
  }

  for (const a of actors) {
    if (a.dead) {
      a.group.position.set(a.x, heightAt(a.x, a.z) + 0.18, a.z);
      continue;
    }
    a.attackCd = Math.max(0, a.attackCd - dt);
    const enemy = aimOf(a);
    let tx = a.home.x;
    let tz = a.home.z;

    if (a.role === "civilian") {
      if (enemy) {
        tx = a.x - (enemy.x - a.x);
        tz = a.z - (enemy.z - a.z);
      }
    } else if (a.role === "caravan") {
      const side = a === caravan.guards[0] ? 1.6 : -1.6;
      const ang = Math.atan2(
        caravan.waypoints[caravan.wi].x - caravan.x,
        caravan.waypoints[caravan.wi].z - caravan.z
      );
      tx = caravan.x + Math.cos(ang) * side;
      tz = caravan.z - Math.sin(ang) * side;
      if (enemy && Math.hypot(enemy.x - a.x, enemy.z - a.z) < 16) {
        tx = enemy.x;
        tz = enemy.z;
      }
    } else if (a.faction === "villain" && player.faction === "villain") {
      if (villainCmd === 1) {
        tx = player.x - Math.sin(player.yaw) * 2.2;
        tz = player.z - Math.cos(player.yaw) * 2.2;
      } else if (villainCmd === 2) {
        tx = L.fort.x;
        tz = L.fort.z;
      } else {
        tx = L.palace.x;
        tz = L.palace.z - 12;
      }
    } else if (a.faction === "guard" && player.faction === "guard") {
      if (commanderOrder.includes("чащу")) {
        tx = L.forest.x;
        tz = L.forest.z;
      } else if (commanderOrder.includes("Морвейн")) {
        tx = 40;
        tz = -20;
      } else {
        tx = a.home.x;
        tz = a.home.z;
      }
    } else if (a.faction === "elf" && a.raid) {
      tx = L.fort.x;
      tz = L.fort.z;
      if (Math.hypot(a.x - L.fort.x, a.z - L.fort.z) < 8) a.raid = false;
    }

    if (enemy && Math.hypot(enemy.x - a.x, enemy.z - a.z) < 18) {
      tx = enemy.x;
      tz = enemy.z;
    }

    const distHomeGoal = Math.hypot(tx - a.x, tz - a.z);
    if (distHomeGoal > 0.6) steer(a, tx, tz, dt, a.speed);

    if (enemy) {
      const d = Math.hypot(enemy.x - a.x, enemy.z - a.z);
      if (d < 2.2 && a.attackCd <= 0) {
        a.attackCd = 0.85;
        const dmg = 8 + Math.random() * 7;
        if (enemy === player) strikeTarget(a, player, dmg);
        else strikeTarget(a, enemy, dmg);
      }
    }

    a.group.position.set(a.x, a.y, a.z);
    a.group.rotation.y = a.yaw;
    const bob = Math.sin(performance.now() * 0.01 + a.id) * 0.04;
    a.parts.lArm.rotation.x = bob;
    a.parts.rArm.rotation.x = -bob;
  }
}

function updateCaravan(dt) {
  if (!caravan) return;
  const wp = caravan.waypoints[caravan.wi];
  const aliveGuards = caravan.guards.filter((g) => !g.dead).length;
  const speed = aliveGuards === 0 ? 0 : 2.35;
  const dx = wp.x - caravan.x;
  const dz = wp.z - caravan.z;
  const d = Math.hypot(dx, dz);
  if (d < 2.2) caravan.wi = (caravan.wi + 1) % caravan.waypoints.length;
  else if (speed > 0) {
    caravan.x += (dx / d) * speed * dt;
    caravan.z += (dz / d) * speed * dt;
  }
  const y = heightAt(caravan.x, caravan.z);
  caravan.group.position.set(caravan.x, y, caravan.z);
  caravan.group.rotation.y = Math.atan2(dx, dz);
  caravan.wheels.forEach((w) => {
    w.rotation.x += speed * dt * 2.4;
  });
}

function updatePlayer(dt) {
  if (dead) return;
  const onGround = player.y <= heightAt(player.x, player.z) + 0.05;
  const crawl = player.wounds.leg && !player.inv.prosthesis_leg && !player.inv.wheelchair;
  player.usingChair = player.wounds.leg && !player.inv.prosthesis_leg && player.inv.wheelchair;
  let speed = playerSpeed();
  if (uiOpen) speed = 0;
  const fwd = facing();
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  let mx = 0;
  let mz = 0;
  if (keys.has("KeyW")) {
    mx += fwd.x;
    mz += fwd.z;
  }
  if (keys.has("KeyS")) {
    mx -= fwd.x;
    mz -= fwd.z;
  }
  if (keys.has("KeyA")) {
    mx -= right.x;
    mz -= right.z;
  }
  if (keys.has("KeyD")) {
    mx += right.x;
    mz += right.z;
  }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const r = resolveMove(player.x, player.z, player.x + mx * speed * dt, player.z + mz * speed * dt, world.colliders);
    player.x = r.x;
    player.z = r.z;
  }
  if (keys.has("Space") && onGround && !player.usingChair && !crawl) player.vy = 7.2;
  player.vy -= 22 * dt;
  player.y += player.vy * dt;
  const ground = heightAt(player.x, player.z);
  const stand = crawl ? 0.15 : player.usingChair ? 0.35 : 0;
  if (player.y < ground + stand) {
    player.y = ground + stand;
    player.vy = 0;
  }

  if (player.bleeding) {
    player.hp -= 4.2 * dt;
    if (player.inv.bandage > 0 && keys.has("KeyB")) {
      player.inv.bandage -= 1;
      player.bleeding = false;
      log("Перевязался (B).");
    }
    if (player.hp <= 0) die("Истёк кровью. Надо было к лекарю или бинтами.");
  }

  swingT = Math.max(0, swingT - dt);
  const body = player.parts.group;
  body.position.set(player.x, player.y, player.z);
  body.rotation.y = player.yaw + Math.PI;
  body.visible = thirdPerson;
  if (player.usingChair) {
    body.scale.set(1, 0.72, 1);
  } else if (crawl) {
    body.scale.set(1, 0.45, 1);
    body.rotation.x = 0.15;
  } else {
    body.scale.set(1, 1, 1);
    body.rotation.x = 0;
  }
  player.parts.weapon.rotation.x = swingT > 0 ? -1.4 * (swingT / 0.28) : 0;

  const eye = crawl ? 0.55 : player.usingChair ? 1.05 : 1.62;
  const f = facing();
  camera.up.set(0, 1, 0);
  if (thirdPerson) {
    camera.position.set(player.x - f.x * 4.4, player.y + 2.35, player.z - f.z * 4.4);
    camera.lookAt(player.x, player.y + 1.35, player.z);
  } else {
    const horiz = Math.cos(player.pitch);
    camera.position.set(player.x, player.y + eye, player.z);
    camera.lookAt(
      player.x + f.x * horiz,
      player.y + eye + Math.sin(player.pitch),
      player.z + f.z * horiz
    );
  }
}

function updateHud() {
  const hp = Math.max(0, player.hp);
  document.getElementById("hp-fill").style.width = `${(hp / player.maxHp) * 100}%`;
  document.getElementById("hp-text").textContent = `Здоровье: ${hp | 0}`;
  document.getElementById("gold").textContent = `Золото: ${player.gold}`;
  document.getElementById("zone").textContent = `Зона: ${ZONE_NAME[zoneAt(player.x, player.z)]}`;
  const w = [];
  if (player.bleeding) w.push("кровотечение");
  if (player.wounds.arm && !player.inv.prosthesis_arm) w.push("нет руки");
  if (player.wounds.eye) w.push("нет глаза");
  if (player.wounds.leg && !player.inv.prosthesis_leg) w.push(player.usingChair ? "коляска" : "ползёшь");
  document.getElementById("wounds").textContent = w.length ? w.join(", ") : "Ран нет";
  document.getElementById("bleed-vignette").classList.toggle("on", player.bleeding);
  document.getElementById("eye-mask").hidden = !player.wounds.eye;

  const boxTitle = document.getElementById("order-title");
  const boxText = document.getElementById("order-text");
  if (player.faction === "guard") {
    boxTitle.textContent = "Приказ командира";
    boxText.textContent = commanderOrder;
  } else if (player.faction === "villain") {
    boxTitle.textContent = "Приказы Морвейна (1/2/3)";
    boxText.textContent =
      villainCmd === 1 ? "Войска: за мной." : villainCmd === 2 ? "Войска: держать старый форт." : "Войска: штурм дворца!";
  } else {
    boxTitle.textContent = "Лес помнит";
    boxText.textContent = "Грабь корован на тракте. Партизаны сами пойдут на форт.";
  }

  let prompt = "";
  const corpse = nearestLoot();
  const it = nearestInteract();
  if (corpse) prompt = "E — обыскать труп";
  else if (caravanReady()) prompt = player.faction === "elf" ? "E — ограбить корован" : "Корован без стражи";
  else if (it) prompt = it.type === "shop" ? "E — лавка (меч, бинты, зелье, протезы, коляска)" : "E — лекарь (20 золота)";
  document.getElementById("prompt").textContent = prompt;
}

function drawMap() {
  const c = document.getElementById("map-canvas");
  const g = c.getContext("2d");
  const s = c.width;
  g.fillStyle = "#10140e";
  g.fillRect(0, 0, s, s);
  const to = (x, z) => [((x + WORLD) / (WORLD * 2)) * s, ((WORLD - z) / (WORLD * 2)) * s];
  g.fillStyle = "#1e4a24";
  g.fillRect(0, 0, s / 2, s / 2);
  g.fillStyle = "#3a4a78";
  g.fillRect(s / 2, 0, s / 2, s / 2);
  g.fillStyle = "#5a6a30";
  g.fillRect(0, s / 2, s / 2, s / 2);
  g.fillStyle = "#4a4440";
  g.fillRect(s / 2, s / 2, s / 2, s / 2);
  g.fillStyle = "#e8d5a8";
  g.font = "12px serif";
  g.fillText("Лес", 16, 22);
  g.fillText("Дворец", s / 2 + 16, 22);
  g.fillText("Деревня", 16, s / 2 + 22);
  g.fillText("Форт", s / 2 + 16, s / 2 + 22);
  const [px, pz] = to(player.x, player.z);
  g.fillStyle = "#ffe08a";
  g.beginPath();
  g.arc(px, pz, 5, 0, Math.PI * 2);
  g.fill();
  if (caravan) {
    const [cx, cz] = to(caravan.x, caravan.z);
    g.fillStyle = "#c06020";
    g.fillRect(cx - 4, cz - 3, 8, 6);
  }
  g.fillStyle = "#d0d0d0";
  actors.forEach((a) => {
    if (a.dead) return;
    const [ax, az] = to(a.x, a.z);
    g.fillStyle = a.faction === "elf" ? "#3d8a3a" : a.faction === "guard" ? "#6a8ad0" : a.faction === "villain" ? "#b03040" : "#888";
    g.fillRect(ax - 2, az - 2, 4, 4);
  });
}

function snapshot() {
  return {
    faction: player.faction,
    player: {
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: player.yaw,
      pitch: player.pitch,
      hp: player.hp,
      gold: player.gold,
      wounds: { ...player.wounds },
      bleeding: player.bleeding,
      inv: { ...player.inv },
      usingChair: player.usingChair,
    },
    thirdPerson,
    commanderOrder,
    villainCmd,
    caravan: {
      x: caravan.x,
      z: caravan.z,
      wi: caravan.wi,
      looted: caravan.looted,
      guards: caravan.guards.map((g) => g.id),
    },
    actors: actors.map((a) => ({
      id: a.id,
      faction: a.faction,
      role: a.role,
      x: a.x,
      z: a.z,
      yaw: a.yaw,
      hp: a.hp,
      dead: a.dead,
      wounds: { ...a.wounds },
      looted: a.looted,
      raid: a.raid,
    })),
  };
}

function saveGame() {
  if (!started) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
  log("Сохранено (F5).");
}

function clearActors() {
  actors.forEach((a) => scene.remove(a.group));
  actors.length = 0;
  if (caravan) scene.remove(caravan.group);
  scene.children.filter((c) => c.userData && (c.userData.gib || c.userData.playerBody)).forEach((c) => scene.remove(c));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    log("Нет сохранения.");
    return;
  }
  const data = JSON.parse(raw);
  clearActors();
  data.actors.forEach((s) => {
    const a = spawnActor(s.faction, s.x, s.z, s.role);
    a.hp = s.hp;
    a.yaw = s.yaw;
    a.dead = s.dead;
    a.looted = s.looted;
    a.raid = s.raid;
    a.wounds = { ...s.wounds };
    if (a.wounds.arm) a.parts.lArm.visible = false;
    if (a.wounds.leg) a.parts.lLeg.visible = false;
    if (a.dead) {
      a.group.rotation.x = Math.PI / 2;
      a.y = heightAt(a.x, a.z);
    }
  });
  caravan = makeCaravan();
  caravan.x = data.caravan.x;
  caravan.z = data.caravan.z;
  caravan.wi = data.caravan.wi;
  caravan.looted = data.caravan.looted;
  caravan.guards = data.caravan.guards.map((id) => actors[id]).filter(Boolean);
  player = {
    ...data.player,
    wounds: { ...data.player.wounds },
    inv: { ...data.player.inv },
    faction: data.faction,
    parts: makeHumanoid(data.faction, { steel: true }),
  };
  player.parts.group.userData.playerBody = true;
  scene.add(player.parts.group);
  if (player.wounds.arm && !player.inv.prosthesis_arm) player.parts.lArm.visible = false;
  if (player.wounds.leg && !player.inv.prosthesis_leg) player.parts.lLeg.visible = false;
  thirdPerson = !!data.thirdPerson;
  commanderOrder = data.commanderOrder;
  villainCmd = data.villainCmd;
  startGame(data.faction, true);
  document.getElementById("mode").textContent = thirdPerson ? "Вид: 3-е лицо" : "Вид: 1-е лицо";
  log("Загружено (F9).");
}

function updateGibs(dt) {
  scene.children.slice().forEach((c) => {
    if (!c.userData || !c.userData.gib) return;
    c.userData.life -= dt;
    c.userData.vy -= 18 * dt;
    c.position.x += c.userData.vx * dt;
    c.position.y += c.userData.vy * dt;
    c.position.z += c.userData.vz * dt;
    c.rotation.x += dt * 4;
    const g = heightAt(c.position.x, c.position.z) + 0.08;
    if (c.position.y < g) {
      c.position.y = g;
      c.userData.vy *= -0.2;
      c.userData.vx *= 0.6;
      c.userData.vz *= 0.6;
    }
    if (c.userData.life < 0) scene.remove(c);
  });
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, clock.getDelta());
  if (started && player) {
    updatePlayer(dt);
    updateActors(dt);
    updateCaravan(dt);
    updateGibs(dt);
    updateHud();
    world.updateLOD(camera);
    if (!document.getElementById("map-panel").hidden) drawMap();
  } else {
    camera.position.set(-40, 28, 40);
    camera.lookAt(-20, 2, 20);
    world.updateLOD(camera);
  }
  renderer.render(scene, camera);
}

class Game {
  constructor() {
    this.initWorld();
    this.bindUi();
    this.drainPendingStart();
    loop();
  }

  initWorld() {
    canvas = document.getElementById("view");
    if (!canvas) throw new Error("Нет canvas #view — мир некуда рисовать.");
    this.canvas = canvas;
    renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 420);
    world = createWorld(scene);
    this.world = world;
    if (!this.world || !this.world.spots) {
      throw new Error("World не создал spots — старт фракции упадёт.");
    }
    clock = new THREE.Clock();
  }

  bindUi() {
    if (!this.canvas) throw new Error("bindUi() до canvas: слушатели не повесятся.");
    this.canvas.addEventListener("click", () => {
      if (!started || uiOpen) return;
      tryLock();
      if (pointerLocked) melee();
    });
    document.addEventListener("pointerlockchange", () => {
      pointerLocked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!started || !pointerLocked || dead) return;
      player.yaw -= e.movementX * 0.0022;
      player.pitch -= e.movementY * 0.002;
      player.pitch = THREE.MathUtils.clamp(player.pitch, -1.25, 1.25);
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "F5" || e.code === "F9") e.preventDefault();
      keys.add(e.code);
      if (!started) return;
      if (e.code === "KeyV") {
        thirdPerson = !thirdPerson;
        document.getElementById("mode").textContent = thirdPerson ? "Вид: 3-е лицо" : "Вид: 1-е лицо";
      }
      if (e.code === "KeyM") togglePanel("map-panel");
      if (e.code === "KeyH") togglePanel("help-panel");
      if (e.code === "KeyE") interact();
      if (e.code === "F5") saveGame();
      if (e.code === "F9") loadGame();
      if (player && player.faction === "villain") {
        if (e.code === "Digit1" || e.code === "Numpad1") {
          villainCmd = 1;
          log("Приказ Морвейна: за мной.");
        }
        if (e.code === "Digit2" || e.code === "Numpad2") {
          villainCmd = 2;
          log("Приказ Морвейна: держать форт.");
        }
        if (e.code === "Digit3" || e.code === "Numpad3") {
          villainCmd = 3;
          log("Приказ Морвейна: штурм дворца!");
        }
      }
    });
    document.addEventListener("keyup", (e) => keys.delete(e.code));
    document.querySelectorAll("[data-faction]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.start(btn.dataset.faction);
      });
    });
    document.getElementById("btn-reload")?.addEventListener("click", loadGame);
    document.getElementById("btn-restart")?.addEventListener("click", () => location.reload());
    addEventListener("resize", () => {
      if (!camera || !renderer) return;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    window.startGrokBot = (faction) => this.start(faction);
    const status = document.getElementById("boot-status");
    if (status) status.hidden = true;
  }

  start(faction) {
    if (!this.world || !this.world.spots) {
      showBootError("Мир ещё не создан. World.spots нет — кнопка фракции не стартует игру.");
      return;
    }
    if (!this.world.spots[faction]) {
      showBootError("Неизвестная сторона: " + faction);
      return;
    }
    startGame(faction, false);
  }

  drainPendingStart() {
    const pending = window.__GROK_PENDING_FACTION;
    window.__GROK_PENDING_FACTION = null;
    if (pending) this.start(pending);
  }
}

try {
  game = new Game();
  window.__GROK_BOT__ = game;
} catch (err) {
  console.error(err);
  showBootError(err);
  window.startGrokBot = () => showBootError(err);
}
