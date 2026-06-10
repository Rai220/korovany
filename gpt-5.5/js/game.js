import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const canvas = document.querySelector('#game');
const root = document.querySelector('#game-root');
const factionScreen = document.querySelector('#faction-screen');
const hud = document.querySelector('#hud');
const logBox = document.querySelector('#message-log');
const mapPanel = document.querySelector('#map-panel');
const shopPanel = document.querySelector('#shop-panel');
const crosshair = document.querySelector('#crosshair');
const saveButton = document.querySelector('#save-game');

const ui = {
  faction: document.querySelector('#faction-label'),
  zone: document.querySelector('#zone-label'),
  objective: document.querySelector('#objective-label'),
  health: document.querySelector('#health'),
  healthBar: document.querySelector('#health-bar'),
  gold: document.querySelector('#gold'),
  squad: document.querySelector('#squad'),
  body: document.querySelector('#body-status'),
};

const FACTIONS = {
  elves: {
    title: 'Лесные эльфы',
    color: 0x4f9a5c,
    startZone: 'elves',
    spawn: new THREE.Vector3(-92, 0, -74),
    friend: ['elves'],
    enemies: ['guard', 'villain'],
    objective: 'Грабь корованы, защищай лесные домики и устраивай партизанские налеты.',
  },
  guard: {
    title: 'Охрана дворца',
    color: 0xd8a935,
    startZone: 'palace',
    spawn: new THREE.Vector3(78, 0, -64),
    friend: ['guard'],
    enemies: ['elves', 'villain'],
    objective: 'Слушайся командира: патруль, защита дворца, набеги на эльфов и злодея.',
  },
  villain: {
    title: 'Злодей',
    color: 0x8a3434,
    startZone: 'villain',
    spawn: new THREE.Vector3(76, 0, 78),
    friend: ['villain'],
    enemies: ['guard', 'elves'],
    objective: 'Командуй войсками из старого форта и готовь штурм дворца.',
  },
};

const ZONES = {
  humans: { title: 'Зона людей', center: new THREE.Vector3(-70, 0, 64), color: 0x7c6a48 },
  palace: { title: 'Зона императора', center: new THREE.Vector3(78, 0, -66), color: 0x8f9388 },
  elves: { title: 'Зона эльфов', center: new THREE.Vector3(-86, 0, -74), color: 0x3f7c47 },
  villain: { title: 'Зона злого', center: new THREE.Vector3(82, 0, 80), color: 0x633a38 },
};

const SAVE_KEY = 'kirill-korovany-gpt-5-5';
const keys = new Set();
const interactables = [];
const npcs = [];
const caravans = [];
const trees = [];
const corpses = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

let renderer;
let scene;
let camera;
let playerGroup;
let weapon;
let currentZone = 'elves';
let faction = null;
let pointerLocked = false;
let yaw = 0;
let pitch = -0.16;
let objectiveTimer = 0;
let combatCooldown = 0;
let spawnTimer = 0;
let orderTimer = 0;

const player = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  health: 100,
  gold: 20,
  squad: 2,
  onGround: true,
  limbs: {
    arm: 'ok',
    eye: 'ok',
    leg: 'ok',
  },
};

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ccce1);
  scene.fog = new THREE.Fog(0x9ccce1, 70, 210);

  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 500);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  const hemi = new THREE.HemisphereLight(0xeaf3ff, 0x334427, 2.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0bd, 2.5);
  sun.position.set(80, 120, 40);
  sun.castShadow = true;
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  scene.add(sun);

  buildWorld();
  buildPlayer();
  bindEvents();
  updateUi();
  animate();
}

function buildWorld() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260, 80, 80),
    new THREE.MeshStandardMaterial({ color: 0x5d7040, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  addRoad();
  addZoneMarkers();
  addElfVillage();
  addPalace();
  addVillainFort();
  addHumanCamp();
  addForest();
  addMountains();
  addCaravan(-35, 14);
  addCaravan(16, 6);
}

function addRoad() {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x6a553a, roughness: 1 });
  const road = new THREE.Mesh(new THREE.BoxGeometry(220, 0.04, 10), roadMat);
  road.position.set(0, 0.021, 14);
  road.receiveShadow = true;
  scene.add(road);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 190), roadMat);
  cross.position.set(16, 0.024, -8);
  cross.receiveShadow = true;
  scene.add(cross);
}

function addZoneMarkers() {
  Object.entries(ZONES).forEach(([key, zone]) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(15, 16, 48),
      new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(zone.center).add(new THREE.Vector3(0, 0.03, 0));
    ring.userData.zone = key;
    scene.add(ring);
  });
}

function addElfVillage() {
  for (let i = 0; i < 7; i++) {
    const x = -104 + (i % 3) * 14 + Math.random() * 4;
    const z = -92 + Math.floor(i / 3) * 16 + Math.random() * 4;
    addCabin(x, z);
  }
}

function addCabin(x, z) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 7),
    new THREE.MeshStandardMaterial({ color: 0x815537, roughness: .88 })
  );
  base.position.set(x, 2.5, z);
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(6.4, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0x3d5835, roughness: .9 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, 7, z);
  roof.castShadow = true;
  scene.add(roof);
}

function addPalace() {
  const stone = new THREE.MeshStandardMaterial({ color: 0xa7a99d, roughness: .74 });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(31, 24, 25), stone);
  keep.position.set(86, 12, -78);
  keep.castShadow = true;
  keep.receiveShadow = true;
  scene.add(keep);

  for (const [x, z] of [[64, -98], [108, -98], [64, -58], [108, -58]]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 29, 12), stone);
    tower.position.set(x, 14.5, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(6.5, 8, 12), new THREE.MeshStandardMaterial({ color: 0xb23b32 }));
    cap.position.set(x, 33, z);
    cap.castShadow = true;
    scene.add(cap);
  }

  addNpc('guard', 66, -46, 'Командир');
  addNpc('guard', 95, -46, 'Стражник');
}

function addVillainFort() {
  const wall = new THREE.MeshStandardMaterial({ color: 0x4f4540, roughness: .94 });
  for (let i = 0; i < 4; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(i < 2 ? 38 : 8, 13, i < 2 ? 7 : 38), wall);
    block.position.set(82 + (i === 2 ? -22 : i === 3 ? 22 : 0), 6.5, 82 + (i === 0 ? -22 : i === 1 ? 22 : 0));
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  }
  addNpc('villain', 83, 82, 'Черный сотник');
  addNpc('villain', 96, 74, 'Налетчик');
}

function addHumanCamp() {
  addCabin(-74, 57);
  addCabin(-59, 69);
  addNpc('human', -67, 52, 'Купец');
  addShop(-54, 58);
}

function addShop(x, z) {
  const stall = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 5), new THREE.MeshStandardMaterial({ color: 0x8a623a }));
  counter.position.y = 1.5;
  counter.castShadow = true;
  stall.add(counter);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 6), new THREE.MeshStandardMaterial({ color: 0xc3a24e }));
  awning.position.y = 4.2;
  awning.castShadow = true;
  stall.add(awning);
  stall.position.set(x, 0, z);
  stall.userData = { type: 'shop' };
  scene.add(stall);
  interactables.push(stall);
}

function addForest() {
  for (let i = 0; i < 220; i++) {
    const dense = i < 160;
    const x = dense ? -128 + Math.random() * 86 : -120 + Math.random() * 240;
    const z = dense ? -124 + Math.random() * 98 : -125 + Math.random() * 250;
    if (Math.hypot(x - 86, z + 78) < 28 || Math.hypot(x - 82, z - 82) < 30) continue;
    addTree(x, z, 8 + Math.random() * 9);
  }
}

function addTree(x, z, h) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.42, .7, h * .52, 7), new THREE.MeshStandardMaterial({ color: 0x6f4728 }));
  trunk.position.y = h * .26;
  trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(h * .26, h * .72, 9), new THREE.MeshStandardMaterial({ color: 0x2f6c3c, roughness: .9 }));
  crown.position.y = h * .76;
  crown.castShadow = true;
  group.add(trunk, crown);

  const billboard = new THREE.Mesh(
    new THREE.PlaneGeometry(h * .45, h),
    new THREE.MeshBasicMaterial({ color: 0x2f6c3c, transparent: true, opacity: .82, side: THREE.DoubleSide })
  );
  billboard.position.y = h * .5;
  billboard.visible = false;
  group.add(billboard);
  group.position.set(x, 0, z);
  scene.add(group);
  trees.push({ group, trunk, crown, billboard });
}

function addMountains() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a635a, roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(14 + Math.random() * 20, 24 + Math.random() * 40, 5), mat);
    cone.position.set(34 + Math.random() * 115, cone.geometry.parameters.height / 2 - 2, 42 + Math.random() * 95);
    cone.rotation.y = Math.random() * Math.PI;
    cone.castShadow = true;
    cone.receiveShadow = true;
    scene.add(cone);
  }
}

function addPlayerMarker() {
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.3, 5, 10), new THREE.MeshStandardMaterial({ color: FACTIONS[faction].color }));
  body.position.y = 2.2;
  body.castShadow = true;
  playerGroup.add(body);
}

function buildPlayer() {
  playerGroup = new THREE.Group();
  scene.add(playerGroup);
  weapon = new THREE.Mesh(new THREE.BoxGeometry(.28, .28, 3.2), new THREE.MeshStandardMaterial({ color: 0xd6d0bc, metalness: .4, roughness: .36 }));
  weapon.position.set(.9, 2.3, -1.6);
  weapon.rotation.x = -.2;
  weapon.castShadow = true;
  playerGroup.add(weapon);
}

function addNpc(kind, x, z, name = '') {
  const colors = {
    elves: 0x4f9a5c,
    guard: 0xd8a935,
    villain: 0x8a3434,
    human: 0x8b6d47,
  };
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.1, 5, 10), new THREE.MeshStandardMaterial({ color: colors[kind] || 0xffffff }));
  body.position.y = 2;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.72, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd2a06a }));
  head.position.y = 3.85;
  head.castShadow = true;
  group.add(head);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, 2.6), new THREE.MeshStandardMaterial({ color: 0xc5c2ad, metalness: .3 }));
  blade.position.set(1, 2.15, -.9);
  group.add(blade);
  group.position.set(x, 0, z);
  scene.add(group);
  npcs.push({
    group,
    kind,
    name,
    health: kind === 'human' ? 70 : 95,
    hostile: false,
    attackTimer: Math.random() * 2,
    order: kind === 'guard' && name === 'Командир',
  });
}

function addCaravan(x, z) {
  const group = new THREE.Group();
  const cart = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 5), new THREE.MeshStandardMaterial({ color: 0x8b5a37 }));
  cart.position.y = 2.2;
  cart.castShadow = true;
  group.add(cart);
  for (const dx of [-3, 3]) {
    for (const dz of [-2.4, 2.4]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, .5, 16), new THREE.MeshStandardMaterial({ color: 0x24201c }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(dx, .85, dz);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }
  const horse = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshStandardMaterial({ color: 0x5d3d27 }));
  horse.position.set(-6.6, 1.6, 0);
  horse.castShadow = true;
  group.add(horse);
  group.position.set(x, 0, z);
  scene.add(group);
  const caravan = { group, health: 120, looted: false, speed: .8 + Math.random() * .4, dir: 1 };
  caravans.push(caravan);
  interactables.push(group);
}

function bindEvents() {
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'KeyM') toggleMap();
    if (event.code === 'KeyO') toggleShop();
    if (event.code === 'KeyE') interact();
    if (event.code === 'KeyQ') rallySquad();
    if (event.code === 'KeyF') strike();
    if (event.code === 'Space') jump();
  });
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  canvas.addEventListener('click', () => {
    if (!faction) return;
    if (!pointerLocked) canvas.requestPointerLock();
    strike();
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (!pointerLocked || !faction) return;
    yaw -= event.movementX * 0.0023;
    pitch = clamp(pitch - event.movementY * 0.0018, -1.1, .55);
  });

  document.querySelectorAll('[data-faction]').forEach((button) => {
    button.addEventListener('click', () => startGame(button.dataset.faction));
  });
  document.querySelectorAll('[data-zone]').forEach((button) => {
    button.addEventListener('click', () => travelTo(button.dataset.zone));
  });
  document.querySelectorAll('[data-buy]').forEach((button) => {
    button.addEventListener('click', () => buy(button.dataset.buy));
  });
  document.querySelector('#load-game').addEventListener('click', loadGame);
  document.querySelector('#close-shop').addEventListener('click', () => shopPanel.classList.add('hidden'));
  saveButton.addEventListener('click', saveGame);
}

function startGame(selectedFaction, saved = null) {
  faction = selectedFaction;
  const cfg = FACTIONS[faction];
  currentZone = saved?.currentZone || cfg.startZone;
  player.pos.copy(saved?.pos ? new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z) : cfg.spawn);
  player.vel.set(0, 0, 0);
  player.health = saved?.health ?? 100;
  player.gold = saved?.gold ?? 20;
  player.squad = saved?.squad ?? (faction === 'villain' ? 5 : 2);
  player.limbs = saved?.limbs || { arm: 'ok', eye: 'ok', leg: 'ok' };
  playerGroup.clear();
  playerGroup.add(weapon);
  addPlayerMarker();
  factionScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  logBox.classList.remove('hidden');
  crosshair.classList.remove('hidden');
  saveButton.classList.remove('hidden');
  setObjective(cfg.objective);
  announce(`${cfg.title}: кампания началась.`);
  refreshZoneFromPosition();
  spawnFactionScene();
  updateUi();
}

function spawnFactionScene() {
  if (faction === 'elves') {
    addNpc('guard', -30, 18, 'Дворцовый рейдер');
    addNpc('villain', -110, -35, 'Темный шпион');
  } else if (faction === 'guard') {
    addNpc('elves', 49, -35, 'Эльф-партизан');
    addNpc('villain', 35, -58, 'Шпион злого');
  } else {
    addNpc('guard', 54, 60, 'Разведчик дворца');
    addNpc('elves', 102, 42, 'Эльф-диверсант');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  if (faction) {
    updatePlayer(dt);
    updateCamera();
    updateNpcs(dt);
    updateCaravans(dt);
    updateTrees();
    updateWorldEvents(dt);
    updateUi();
  } else {
    camera.position.set(0, 70, 125);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  const speedBase = player.limbs.leg === 'lost' ? 4 : player.limbs.leg === 'prosthetic' ? 13 : 16;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw) * -1);
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys.has('KeyW')) move.add(forward);
  if (keys.has('KeyS')) move.sub(forward);
  if (keys.has('KeyD')) move.add(right);
  if (keys.has('KeyA')) move.sub(right);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speedBase * dt);
  player.pos.add(move);
  player.vel.y -= 28 * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vel.y = 0;
    player.onGround = true;
  }
  player.pos.x = clamp(player.pos.x, -126, 126);
  player.pos.z = clamp(player.pos.z, -126, 126);
  playerGroup.position.copy(player.pos);
  playerGroup.rotation.y = yaw;
  refreshZoneFromPosition();
}

function jump() {
  if (!faction || !player.onGround || player.limbs.leg === 'lost') return;
  player.vel.y = player.limbs.leg === 'prosthetic' ? 9 : 12;
  player.onGround = false;
}

function updateCamera() {
  const cameraOffset = new THREE.Vector3(0, 5.5, 10);
  cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.copy(player.pos).add(cameraOffset);
  const target = player.pos.clone().add(new THREE.Vector3(Math.sin(yaw) * 18, 4 + pitch * 6, -Math.cos(yaw) * 18));
  camera.lookAt(target);
}

function updateNpcs(dt) {
  npcs.forEach((npc) => {
    if (npc.health <= 0) return;
    const pos = npc.group.position;
    const dist = pos.distanceTo(player.pos);
    const enemy = FACTIONS[faction]?.enemies.includes(npc.kind);
    npc.hostile = enemy && dist < 42;
    if (npc.hostile) {
      const dir = player.pos.clone().sub(pos);
      dir.y = 0;
      if (dir.lengthSq() > 1) {
        dir.normalize();
        pos.addScaledVector(dir, dt * (npc.kind === 'elves' ? 9 : 7));
        npc.group.lookAt(player.pos.x, 0, player.pos.z);
      }
      npc.attackTimer -= dt;
      if (dist < 4 && npc.attackTimer <= 0) {
        npc.attackTimer = 1.1 + Math.random() * .6;
        hurtPlayer(8 + Math.random() * 11, npc.name || 'враг');
      }
    } else if (npc.order && faction === 'guard' && dist < 10) {
      orderTimer -= dt;
      if (orderTimer <= 0) {
        orderTimer = 18;
        setObjective(randomChoice([
          'Командир: держать ворота дворца до следующего налета.',
          'Командир: разведать лес эльфов и прогнать партизан.',
          'Командир: ударить по старому форту злодея.',
        ]));
      }
    }
  });
}

function updateCaravans(dt) {
  caravans.forEach((caravan) => {
    if (caravan.health <= 0) return;
    caravan.group.position.x += caravan.speed * caravan.dir * dt * 5;
    caravan.group.rotation.y = caravan.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (caravan.group.position.x > 105) caravan.dir = -1;
    if (caravan.group.position.x < -110) caravan.dir = 1;
  });
}

function updateTrees() {
  trees.forEach((tree) => {
    const distance = tree.group.position.distanceTo(player.pos);
    const far = distance > 58;
    tree.trunk.visible = !far;
    tree.crown.visible = !far;
    tree.billboard.visible = far;
    if (far) tree.billboard.lookAt(camera.position);
  });
}

function updateWorldEvents(dt) {
  spawnTimer -= dt;
  objectiveTimer -= dt;
  combatCooldown = Math.max(0, combatCooldown - dt);

  if (spawnTimer <= 0) {
    spawnTimer = 20 + Math.random() * 12;
    if (faction === 'elves') {
      addNpc(randomChoice(['guard', 'villain']), -72 + Math.random() * 70, -20 + Math.random() * 60, 'Налетчик');
      announce('В лес вошел вражеский отряд.');
    } else if (faction === 'guard') {
      addNpc(randomChoice(['elves', 'villain']), 44 + Math.random() * 42, -44 + Math.random() * 44, 'Диверсант');
      announce('У дворца замечены шпионы.');
    } else {
      addNpc(randomChoice(['elves', 'guard']), 58 + Math.random() * 48, 42 + Math.random() * 40, 'Партизан');
      announce('К старому форту крадутся враги.');
    }
  }

  if (objectiveTimer <= 0) {
    if (faction === 'villain' && player.squad >= 4) setObjective('Можно собрать войска и идти на дворец: Q рядом с солдатами, затем зона императора.');
    if (faction === 'elves') setObjective('На тракте снова идет корован. Найди телегу и ударь по ней.');
  }

  if (player.limbs.arm === 'lost' || player.limbs.leg === 'lost') {
    player.health -= dt * .5;
    if (player.health <= 0) {
      announce('Ты умер от ран. Загрузись или начни новую кампанию.');
      player.health = 0;
    }
  }
}

function strike() {
  if (!faction || combatCooldown > 0 || player.health <= 0) return;
  combatCooldown = player.limbs.arm === 'lost' ? 1.4 : player.limbs.arm === 'prosthetic' ? .62 : .82;
  weapon.rotation.x = -.9;
  setTimeout(() => { weapon.rotation.x = -.2; }, 120);

  let hit = false;
  npcs.forEach((npc) => {
    if (npc.health <= 0) return;
    const dist = npc.group.position.distanceTo(player.pos);
    if (dist < 6 && isInFront(npc.group.position)) {
      hit = true;
      npc.health -= player.limbs.arm === 'lost' ? 12 : 34;
      if (npc.health <= 0) killNpc(npc);
      else announce(`Удар по ${npc.name || 'врагу'}: он ранен.`);
    }
  });

  caravans.forEach((caravan) => {
    if (caravan.health <= 0 || caravan.looted) return;
    const dist = caravan.group.position.distanceTo(player.pos);
    if (dist < 8 && isInFront(caravan.group.position)) {
      hit = true;
      caravan.health -= faction === 'elves' ? 45 : 24;
      if (caravan.health <= 0) lootCaravan(caravan);
      else announce('Корован поврежден. Бей еще.');
    }
  });

  if (!hit) announce('Удар рассек воздух.');
}

function isInFront(target) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const toTarget = target.clone().sub(player.pos);
  toTarget.y = 0;
  toTarget.normalize();
  return forward.dot(toTarget) > .35;
}

function killNpc(npc) {
  announce(`${npc.name || 'Враг'} повержен. Труп остался в 3D.`);
  player.gold += npc.kind === 'human' ? 8 : 5;
  const corpse = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x59362e, roughness: .9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.8, 2.4, 4, 8), mat);
  body.rotation.z = Math.PI / 2;
  body.position.y = .6;
  corpse.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.55, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb7835f }));
  head.position.set(1.6, .5, 0);
  corpse.add(head);
  corpse.position.copy(npc.group.position);
  scene.add(corpse);
  corpses.push(corpse);
  scene.remove(npc.group);
}

function lootCaravan(caravan) {
  caravan.looted = true;
  player.gold += faction === 'elves' ? 34 : 18;
  announce(faction === 'elves' ? 'Корован ограблен. Эльфы довольны.' : 'Корован взят под контроль.');
  setObjective('Золото можно потратить в лавке людей: открой O рядом с торговцем.');
  caravan.group.traverse((child) => {
    if (child.material) child.material.color.set(0x3d342b);
  });
}

function hurtPlayer(amount, source) {
  if (player.health <= 0) return;
  player.health = Math.max(0, player.health - amount);
  const severe = Math.random();
  if (severe > .78) {
    injure(source);
  } else {
    announce(`${source} попал по тебе. Нужна осторожность.`);
  }
}

function injure(source) {
  const available = Object.entries(player.limbs).filter(([, state]) => state === 'ok').map(([part]) => part);
  if (!available.length) {
    announce(`${source} нанес тяжелую рану.`);
    return;
  }
  const part = randomChoice(available);
  player.limbs[part] = 'lost';
  if (part === 'arm') announce(`${source} отрубил руку. Без лечения ты истечешь кровью, а удары стали слабее.`);
  if (part === 'eye') announce(`${source} выколол глаз. Пол-экрана закрыто, но жить можно.`);
  if (part === 'leg') announce(`${source} отрубил ногу. Теперь можно только ползти, пока не купишь протез.`);
  if (part === 'eye') root.classList.add('half-blind');
}

function interact() {
  if (!faction) return;
  const shop = nearestInteractable('shop', 10);
  if (shop) {
    shopPanel.classList.remove('hidden');
    announce('Лекарь готов продать лечение и протезы.');
    return;
  }
  const caravan = caravans.find((item) => item.group.position.distanceTo(player.pos) < 9 && item.looted);
  if (caravan) {
    player.gold += 6;
    announce('Нашел в короване еще немного золота.');
    return;
  }
  announce('Рядом нет действия.');
}

function nearestInteractable(type, distance) {
  return interactables.find((item) => item.userData?.type === type && item.position.distanceTo(player.pos) <= distance);
}

function rallySquad() {
  if (!faction) return;
  const friends = npcs.filter((npc) => npc.health > 0 && FACTIONS[faction].friend.includes(npc.kind) && npc.group.position.distanceTo(player.pos) < 18);
  if (friends.length) {
    player.squad = Math.min(9, player.squad + friends.length);
    announce(`Отряд собран: +${friends.length}. Теперь можно идти в набег.`);
    return;
  }
  if (faction === 'villain' && currentZone === 'villain') {
    player.squad = Math.min(9, player.squad + 2);
    announce('Из форта вышли два бойца злодея.');
    addNpc('villain', player.pos.x + 5, player.pos.z + 5, 'Солдат злого');
    addNpc('villain', player.pos.x - 5, player.pos.z + 3, 'Солдат злого');
    return;
  }
  announce('Никто из своих не рядом.');
}

function buy(item) {
  const prices = { arm: 35, eye: 25, leg: 45, heal: 15 };
  if (player.gold < prices[item]) {
    announce('Не хватает золота.');
    return;
  }
  player.gold -= prices[item];
  if (item === 'heal') {
    player.health = Math.min(100, player.health + 45);
    announce('Раны перевязаны.');
  } else {
    player.limbs[item] = 'prosthetic';
    if (item === 'eye') root.classList.remove('half-blind');
    announce('Протез установлен. Можно продолжать приключение.');
  }
  updateUi();
}

function toggleMap() {
  if (!faction) return;
  mapPanel.classList.toggle('hidden');
}

function toggleShop() {
  if (!faction) return;
  shopPanel.classList.toggle('hidden');
}

function travelTo(zone) {
  currentZone = zone;
  const center = ZONES[zone].center;
  player.pos.copy(center.clone().add(new THREE.Vector3(0, 0, 10)));
  if (zone === 'palace' && faction === 'villain' && player.squad >= 4) {
    setObjective('Штурм дворца начался. Победи стражу у ворот.');
    addNpc('guard', 72, -50, 'Защитник ворот');
    addNpc('guard', 91, -51, 'Защитник ворот');
  }
  if (zone === 'elves' && faction === 'guard') {
    setObjective('Набег на эльфов: найди партизан и вернись живым.');
  }
  mapPanel.classList.add('hidden');
  announce(`Переход: ${ZONES[zone].title}.`);
}

function refreshZoneFromPosition() {
  let closest = currentZone;
  let closestDist = Infinity;
  Object.entries(ZONES).forEach(([key, zone]) => {
    const dist = zone.center.distanceTo(player.pos);
    if (dist < closestDist) {
      closestDist = dist;
      closest = key;
    }
  });
  currentZone = closest;
  document.querySelectorAll('.zone-tile').forEach((tile) => tile.classList.toggle('active', tile.dataset.zone === currentZone));
}

function setObjective(text) {
  ui.objective.textContent = text;
  objectiveTimer = 28;
}

function updateUi() {
  if (!faction) return;
  ui.faction.textContent = FACTIONS[faction].title;
  ui.zone.textContent = ZONES[currentZone].title;
  ui.health.textContent = Math.round(player.health);
  ui.healthBar.style.width = `${clamp(player.health, 0, 100)}%`;
  ui.gold.textContent = player.gold;
  ui.squad.textContent = player.squad;
  const labels = {
    ok: 'цел',
    lost: 'потеря',
    prosthetic: 'протез',
  };
  ui.body.innerHTML = '';
  [
    ['arm', 'Рука'],
    ['eye', 'Глаз'],
    ['leg', 'Нога'],
  ].forEach(([key, label]) => {
    const tag = document.createElement('span');
    tag.textContent = `${label}: ${labels[player.limbs[key]]}`;
    ui.body.append(tag);
  });
}

function announce(text) {
  if (!logBox) return;
  const item = document.createElement('div');
  item.textContent = text;
  logBox.prepend(item);
  while (logBox.children.length > 5) logBox.lastElementChild.remove();
}

function saveGame() {
  if (!faction) return;
  const payload = {
    faction,
    currentZone,
    pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    health: player.health,
    gold: player.gold,
    squad: player.squad,
    limbs: player.limbs,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  announce('Сохранение записано.');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    announce('Сохранения пока нет.');
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!FACTIONS[data.faction]) throw new Error('bad faction');
    startGame(data.faction, data);
    announce('Сохранение загружено.');
  } catch {
    announce('Сохранение повреждено.');
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}
