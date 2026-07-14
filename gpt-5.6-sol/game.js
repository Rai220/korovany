import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const SAVE_KEY = 'korovany-gpt-5.6-sol-save-v1';
const VERSION = 1;
const WORLD_LIMIT = 66;
const clock = new THREE.Clock();

const FACTIONS = {
  elf: {
    name: 'Лесные эльфы', short: 'Эльф', color: 0x4fbb73, accent: '#79d98f',
    spawn: new THREE.Vector3(-49, 1.05, -38), weapon: 'Лесной клинок', ability: 'Q — Тень леса',
    intro: 'Старейшина велел перехватить имперский корован и вернуть добычу в чащу.',
  },
  guard: {
    name: 'Дворцовая стража', short: 'Страж', color: 0xd8b35c, accent: '#f2cf76',
    spawn: new THREE.Vector3(42, 1.05, 29), weapon: 'Имперский меч', ability: 'Q — Боевой клич',
    intro: 'Командир ждёт доклада. Стража исполняет приказ и держит дворцовые ворота.',
  },
  villain: {
    name: 'Владыка форта', short: 'Владыка', color: 0xa83d54, accent: '#db6179',
    spawn: new THREE.Vector3(48, 1.05, -42), weapon: 'Топор Владыки', ability: 'Q — Зов форта',
    intro: 'В старом форте нет над тобой командира. Собери войско и реши, когда начать войну.',
  },
};

const ZONES = {
  forest: { name: 'Изумрудная чаща', color: 0x244f34, center: [-43, -34] },
  neutral: { name: 'Вольные земли', color: 0x78653f, center: [-5, 23] },
  palace: { name: 'Имперский дворец', color: 0x66748a, center: [43, 29] },
  fort: { name: 'Горный форт', color: 0x3d3b48, center: [47, -40] },
};

const state = {
  mode: 'title', faction: null, paused: false, started: false,
  player: null, scene: null, renderer: null, camera: null, world: null,
  yaw: Math.PI, pitch: -0.24, keys: new Set(), blocking: false,
  npcs: [], allies: [], enemies: [], particles: [], interactables: [], corpses: [],
  gold: 65, reputation: 0, kills: 0, caravan: null, mission: null,
  attackCooldown: 0, abilityCooldown: 0, zone: '', toastTimer: null,
  body: freshBody(), lastSave: null, finalStarted: false, gameTime: 0,
  audio: null, mouseLocked: false, order: 'follow', capture: 0,
};

const el = {};
const ids = [
  'title-screen', 'faction-screen', 'game-screen', 'pause-screen', 'shop-screen', 'result-screen',
  'new-game-btn', 'continue-btn', 'back-to-title-btn', 'game-canvas-container', 'health-fill',
  'stamina-fill', 'bleed-fill', 'health-text', 'gold-value', 'reputation-value', 'zone-name',
  'objective-text', 'interaction-prompt', 'body-status', 'ability-label', 'order-menu',
  'damage-flash', 'left-eye-mask', 'right-eye-mask', 'toast-container', 'minimap', 'resume-btn',
  'save-btn', 'quit-btn', 'shop-items', 'close-shop-btn', 'result-title', 'result-summary',
  'result-restart-btn', 'result-title-btn', 'loading-screen', 'loading-text',
];

function freshBody() {
  return {
    leftEye: 'healthy', rightEye: 'healthy', leftArm: 'healthy', rightArm: 'healthy',
    leftLeg: 'healthy', rightLeg: 'healthy', bleed: 0,
  };
}

function cacheDom() {
  for (const id of ids) el[id] = document.getElementById(id);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  el[id]?.classList.add('active');
}

function boot() {
  cacheDom();
  el['new-game-btn']?.addEventListener('click', () => showScreen('faction-screen'));
  el['back-to-title-btn']?.addEventListener('click', () => showScreen('title-screen'));
  el['continue-btn']?.addEventListener('click', () => loadGame());
  document.querySelectorAll('[data-faction]').forEach((button) => {
    button.addEventListener('click', () => startGame(button.dataset.faction));
  });
  el['resume-btn']?.addEventListener('click', resumeGame);
  el['save-btn']?.addEventListener('click', () => saveGame(true));
  el['quit-btn']?.addEventListener('click', quitToTitle);
  el['close-shop-btn']?.addEventListener('click', closeShop);
  el['result-restart-btn']?.addEventListener('click', () => startGame(state.faction));
  el['result-title-btn']?.addEventListener('click', quitToTitle);
  el['continue-btn'].disabled = !localStorage.getItem(SAVE_KEY);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (event) => state.keys.delete(event.code));
  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', (event) => { if (event.button === 2) state.blocking = false; });
  document.addEventListener('pointerlockchange', () => {
    state.mouseLocked = document.pointerLockElement === state.renderer?.domElement;
  });
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  showScreen('title-screen');
}

async function startGame(faction, loaded = null) {
  if (!FACTIONS[faction]) return;
  state.mode = 'loading';
  showScreen('loading-screen');
  el['loading-text'].textContent = 'Прокладываем дороги между четырьмя землями…';
  await new Promise((resolve) => requestAnimationFrame(resolve));
  cleanupGame();
  state.faction = faction;
  state.gold = loaded?.gold ?? 65;
  state.reputation = loaded?.reputation ?? 0;
  state.kills = loaded?.kills ?? 0;
  state.body = { ...freshBody(), ...(loaded?.body || {}) };
  state.finalStarted = loaded?.finalStarted ?? false;
  state.gameTime = loaded?.gameTime ?? 0;
  state.capture = loaded?.capture ?? 0;
  state.order = loaded?.order ?? 'follow';
  initThree();
  createWorld();
  createPlayer(loaded?.position, loaded);
  spawnPopulation();
  createCaravan(loaded?.caravan);
  initMission(loaded?.mission);
  if (state.mission.stage >= 4) {
    state.finalStarted = false;
    startFinalBattle(state.faction === 'guard' ? 'villain' : state.faction === 'elf' ? 'guard' : 'guard');
  }
  state.started = true;
  state.paused = false;
  state.mode = 'game';
  showScreen('game-screen');
  resize();
  updateHud();
  syncBodyVisuals();
  toast(`${FACTIONS[faction].name}: ${FACTIONS[faction].intro}`, 6200);
  state.renderer.domElement.addEventListener('click', () => {
    if (!state.paused && state.mode === 'game') state.renderer.domElement.requestPointerLock?.();
  });
  clock.start();
  animate();
}

function cleanupGame() {
  state.started = false;
  state.keys.clear();
  state.npcs = [];
  state.allies = [];
  state.enemies = [];
  state.interactables = [];
  state.corpses = [];
  state.particles = [];
  state.finalStarted = false;
  state.attackCooldown = 0;
  state.abilityCooldown = 0;
  state.capture = 0;
  state.renderer?.dispose();
  if (el['game-canvas-container']) el['game-canvas-container'].replaceChildren();
}

function initThree() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x9eb0a8);
  state.scene.fog = new THREE.FogExp2(0x83918b, 0.0115);
  state.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.05;
  state.renderer.domElement.setAttribute('aria-label', 'Трёхмерный мир Четырёх земель');
  state.renderer.domElement.setAttribute('data-testid', 'game-canvas');
  el['game-canvas-container'].appendChild(state.renderer.domElement);
  state.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 250);
  const hemi = new THREE.HemisphereLight(0xddebcf, 0x29343c, 2.15);
  state.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b5, 3.2);
  sun.position.set(-28, 58, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  state.scene.add(sun);
}

function mat(color, roughness = 0.88, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geometry, material, x = 0, y = 0, z = 0, cast = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = cast;
  object.receiveShadow = true;
  return object;
}

function createWorld() {
  const world = new THREE.Group();
  world.name = 'Четыре земли';
  state.world = world;
  state.scene.add(world);
  const groundGeo = new THREE.PlaneGeometry(70, 65, 1, 1);
  const grounds = [
    [-35, -32.5, 0x315f39], [0, 32.5, 0x796c48], [35, 32.5, 0x59636c], [35, -32.5, 0x34343c],
  ];
  for (const [x, z, color] of grounds) {
    const ground = mesh(groundGeo, mat(color), x, -0.04, z, false);
    ground.rotation.x = -Math.PI / 2;
    world.add(ground);
  }
  const roadMat = mat(0x9b835a);
  addRoad(-36, -28, -7, 19, 4.4, roadMat);
  addRoad(-5, 20, 40, 28, 5.2, roadMat);
  addRoad(9, 13, 45, -39, 4.5, roadMat);
  addRoad(40, 28, 45, -38, 4.1, roadMat);
  buildForest();
  buildVillage();
  buildPalace();
  buildFort();
  buildBoundaryMountains();
}

function addRoad(x1, z1, x2, z2, width, material) {
  const dx = x2 - x1; const dz = z2 - z1;
  const road = mesh(new THREE.PlaneGeometry(Math.hypot(dx, dz), width), material, (x1 + x2) / 2, 0.01, (z1 + z2) / 2, false);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -Math.atan2(dz, dx);
  state.world.add(road);
}

function buildForest() {
  const rand = seededRandom(561);
  for (let i = 0; i < 68; i += 1) {
    const x = -64 + rand() * 49;
    const z = -61 + rand() * 52;
    if (Math.hypot(x + 40, z + 34) < 8 || Math.abs(z - (1.6 * x + 32)) < 3.2) continue;
    state.world.add(createTreeLOD(x, z, 0.78 + rand() * 0.65));
  }
  createHut(-46, -38, 1.3); createHut(-38, -43, 1.05); createHut(-51, -29, 0.9);
  const elder = createMarker(-44, -34, 0x79d98f, 'Старейшина');
  state.interactables.push({ type: 'elder', object: elder, radius: 3.6, label: 'E — говорить со старейшиной' });
}

function createTreeLOD(x, z, scale) {
  const lod = new THREE.LOD();
  const detailed = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.34, 0.55, 5.5, 7), mat(0x4b3020), 0, 2.75, 0);
  detailed.add(trunk);
  const foliageMat = mat(0x204f2d);
  for (const [px, py, pz, size] of [[0, 5.3, 0, 2.4], [-1.2, 4.7, .2, 1.8], [1.1, 4.8, -.3, 1.9], [0, 6.5, 0, 1.65]]) {
    detailed.add(mesh(new THREE.ConeGeometry(size, size * 2, 7), foliageMat, px, py, pz));
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: treeBillboardTexture(), transparent: true, depthWrite: false }));
  sprite.scale.set(7, 10, 1);
  sprite.position.y = 4.7;
  lod.addLevel(detailed, 0);
  lod.addLevel(sprite, 22);
  lod.position.set(x, 0, z);
  lod.scale.setScalar(scale);
  return lod;
}

let treeTexture;
function treeBillboardTexture() {
  if (treeTexture) return treeTexture;
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3f2b1e'; ctx.fillRect(58, 92, 13, 94);
  ctx.fillStyle = '#173f27';
  ctx.beginPath(); ctx.moveTo(64, 3); ctx.lineTo(9, 116); ctx.lineTo(119, 116); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#255b34';
  ctx.beginPath(); ctx.moveTo(64, 36); ctx.lineTo(20, 145); ctx.lineTo(111, 145); ctx.closePath(); ctx.fill();
  treeTexture = new THREE.CanvasTexture(canvas);
  treeTexture.colorSpace = THREE.SRGBColorSpace;
  return treeTexture;
}

function createHut(x, z, scale = 1) {
  const hut = new THREE.Group();
  const wood = mat(0x765238); const dark = mat(0x36291f); const glow = mat(0xe3a74d, 0.6);
  hut.add(mesh(new THREE.BoxGeometry(5, 3.8, 4), wood, 0, 2.1, 0));
  const roof = mesh(new THREE.ConeGeometry(4, 2.8, 4), dark, 0, 5.1, 0); roof.rotation.y = Math.PI / 4; hut.add(roof);
  hut.add(mesh(new THREE.BoxGeometry(.8, 1.2, .15), glow, -1.2, 2.4, 2.05));
  hut.position.set(x, 0, z); hut.scale.setScalar(scale); state.world.add(hut);
}

function buildVillage() {
  createHouse(-13, 22, 0xb1784c); createHouse(-5, 30, 0x9d714b); createHouse(5, 25, 0xa16646);
  createHouse(-9, 13, 0x8c684a); createHouse(8, 16, 0xa66d43);
  const market = new THREE.Group();
  market.add(mesh(new THREE.BoxGeometry(5.5, .7, 2.2), mat(0x633e28), 0, 1.3, 0));
  const awning = mesh(new THREE.BoxGeometry(6, .18, 3.6), mat(0xa04d3f), 0, 3.3, 0); market.add(awning);
  market.position.set(-1, 0, 21); state.world.add(market);
  const merchant = createMarker(-1, 22, 0xe9b75a, 'Торговец и хирург');
  state.interactables.push({ type: 'merchant', object: merchant, radius: 4, label: 'E — торговля и лечение' });
}

function createHouse(x, z, color) {
  const house = new THREE.Group();
  house.add(mesh(new THREE.BoxGeometry(5.8, 3.6, 4.8), mat(color), 0, 1.8, 0));
  const roof = mesh(new THREE.ConeGeometry(4.5, 2.6, 4), mat(0x47342b), 0, 4.7, 0); roof.rotation.y = Math.PI / 4; house.add(roof);
  house.position.set(x, 0, z); state.world.add(house);
}

function buildPalace() {
  const stone = mat(0xb9b7aa); const trim = mat(0xd7c990); const red = mat(0x7f2936);
  const palace = new THREE.Group();
  palace.add(mesh(new THREE.BoxGeometry(22, 8, 16), stone, 0, 4, 0));
  palace.add(mesh(new THREE.BoxGeometry(8, 7, 7), trim, 0, 10.5, -1));
  for (const x of [-10, 10]) for (const z of [-7, 7]) {
    palace.add(mesh(new THREE.CylinderGeometry(2.2, 2.5, 12, 8), stone, x, 6, z));
    palace.add(mesh(new THREE.ConeGeometry(3, 4, 8), red, x, 14, z));
  }
  palace.position.set(48, 0, 39); state.world.add(palace);
  const wall = mesh(new THREE.BoxGeometry(32, 5, 2), stone, 38, 2.5, 23); state.world.add(wall);
  const gate = new THREE.Group();
  gate.add(mesh(new THREE.BoxGeometry(4, 7, 3), stone, -5, 3.5, 0));
  gate.add(mesh(new THREE.BoxGeometry(4, 7, 3), stone, 5, 3.5, 0));
  gate.add(mesh(new THREE.BoxGeometry(14, 2, 3), stone, 0, 7.5, 0));
  gate.position.set(38, 0, 22); state.world.add(gate);
  state.gate = gate; state.gate.userData.health = 100;
  const commander = createMarker(42, 29, 0xf2cf76, 'Командир Радан');
  state.interactables.push({ type: 'commander', object: commander, radius: 4, label: 'E — выслушать приказ' });
}

function buildFort() {
  const dark = mat(0x484754); const iron = mat(0x24242b, .55, .35); const ember = mat(0xa4382e);
  const fort = new THREE.Group();
  fort.add(mesh(new THREE.BoxGeometry(19, 8, 15), dark, 0, 4, 0));
  for (const x of [-9, 9]) for (const z of [-7, 7]) {
    fort.add(mesh(new THREE.CylinderGeometry(2.5, 2.8, 12, 6), dark, x, 6, z));
    fort.add(mesh(new THREE.ConeGeometry(3.2, 3.2, 6), iron, x, 13.5, z));
  }
  fort.add(mesh(new THREE.BoxGeometry(6, 7, .6), ember, 0, 5, 7.8));
  fort.position.set(50, 0, -49); state.world.add(fort);
  const table = createMarker(48, -42, 0xdb6179, 'Стол войны');
  state.interactables.push({ type: 'warTable', object: table, radius: 4, label: 'E — начать поход' });
}

function buildBoundaryMountains() {
  const rock = mat(0x51525a); const rand = seededRandom(99);
  for (let i = 0; i < 27; i += 1) {
    const edge = i % 3;
    const x = edge === 0 ? 62 + rand() * 5 : -64 + rand() * 128;
    const z = edge === 1 ? -61 + rand() * 5 : -62 + rand() * 122;
    const cone = mesh(new THREE.ConeGeometry(3 + rand() * 4, 8 + rand() * 14, 5), rock, x, 4, z);
    state.world.add(cone);
  }
}

function createMarker(x, z, color, label) {
  const group = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(1.05, .1, 8, 24), mat(color, .45, .25), 0, .14, 0); ring.rotation.x = Math.PI / 2;
  const beamMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .17, depthWrite: false });
  const beam = mesh(new THREE.CylinderGeometry(.09, .65, 4.5, 12), beamMaterial, 0, 2.3, 0, false);
  group.add(ring, beam); group.position.set(x, 0, z); group.userData.label = label; state.world.add(group);
  return group;
}

function seededRandom(seed) {
  return () => { seed = Math.imul(48271, seed) | 0; return ((seed >>> 0) % 2147483647) / 2147483647; };
}

function createPlayer(savedPosition, loaded) {
  const data = FACTIONS[state.faction];
  const group = createCharacterModel(data.color, state.faction, true);
  group.position.copy(savedPosition ? new THREE.Vector3(...savedPosition) : data.spawn);
  state.scene.add(group);
  state.player = {
    group, hp: loaded?.health ?? 100, maxHp: 100, stamina: 100, velocity: new THREE.Vector3(), onGround: true,
    speed: 8.2, invulnerable: 0, cloak: 0, rally: 0, weaponLevel: loaded?.weaponLevel ?? 1,
  };
}

function createCharacterModel(color, faction, isPlayer = false) {
  const group = new THREE.Group();
  const skin = mat(0xc79b73); const cloth = mat(color); const boot = mat(0x29251f); const steel = mat(0xc5ccd2, .32, .7);
  const torso = mesh(new THREE.CapsuleGeometry(.48, 1.15, 5, 8), cloth, 0, 1.75, 0); group.add(torso);
  const head = mesh(new THREE.SphereGeometry(.42, 10, 8), skin, 0, 2.9, 0); group.add(head);
  const limbGeo = new THREE.CapsuleGeometry(.14, .75, 4, 7);
  const leftArm = mesh(limbGeo, cloth, -.64, 1.85, 0); leftArm.rotation.z = -.12; leftArm.name = 'leftArm';
  const rightArm = mesh(limbGeo, cloth, .64, 1.85, 0); rightArm.rotation.z = .12; rightArm.name = 'rightArm';
  const leftLeg = mesh(limbGeo, boot, -.27, .52, 0); leftLeg.name = 'leftLeg';
  const rightLeg = mesh(limbGeo, boot, .27, .52, 0); rightLeg.name = 'rightLeg';
  group.add(leftArm, rightArm, leftLeg, rightLeg);
  if (faction === 'elf') {
    const earGeo = new THREE.ConeGeometry(.12, .55, 5); const earL = mesh(earGeo, skin, -.48, 3.02, 0); earL.rotation.z = Math.PI / 2;
    const earR = mesh(earGeo, skin, .48, 3.02, 0); earR.rotation.z = -Math.PI / 2; group.add(earL, earR);
  }
  const weapon = faction === 'villain'
    ? mesh(new THREE.BoxGeometry(.18, 1.9, .18), boot, .85, 1.7, .1)
    : mesh(new THREE.BoxGeometry(.12, 1.65, .12), steel, .82, 1.72, .1);
  weapon.rotation.z = -.38; weapon.name = 'weapon'; group.add(weapon);
  if (faction === 'guard') group.add(mesh(new THREE.BoxGeometry(.95, .24, .95), steel, 0, 3.27, 0));
  if (faction === 'villain') group.add(mesh(new THREE.ConeGeometry(.52, .68, 6), boot, 0, 3.42, 0));
  group.userData.faction = faction; group.userData.isPlayer = isPlayer;
  group.traverse((child) => { if (child.isMesh) child.castShadow = child.receiveShadow = true; });
  return group;
}

function spawnPopulation() {
  const groups = {
    elf: [[-51,-33],[-43,-46],[-35,-34],[-29,-44]],
    guard: [[38,29],[45,25],[51,31],[33,25]],
    villain: [[49,-36],[55,-44],[41,-48],[57,-53]],
  };
  Object.entries(groups).forEach(([faction, points]) => points.forEach(([x,z], i) => spawnNpc(faction, x, z, `${faction}-${i}`, faction === state.faction)));
  spawnNpc('guard', -2, 15, 'caravan-guard-1', state.faction === 'guard', 'caravan');
  spawnNpc('guard', -4, 18, 'caravan-guard-2', state.faction === 'guard', 'caravan');
  const spy = spawnNpc('elf', 5, 22, 'spy', state.faction === 'elf', 'spy');
  spy.group.visible = state.faction === 'guard';
}

function spawnNpc(faction, x, z, id, allied = false, role = 'soldier') {
  const group = createCharacterModel(FACTIONS[faction].color, faction);
  group.position.set(x, 1.05, z); group.rotation.y = Math.random() * Math.PI * 2;
  state.scene.add(group);
  const npc = {
    id, faction, role, group, hp: role === 'final' ? 95 : 62, alive: true, allied,
    state: allied ? 'follow' : 'patrol', home: new THREE.Vector3(x, 1.05, z),
    cooldown: Math.random(), target: null, velocity: new THREE.Vector3(),
  };
  state.npcs.push(npc);
  if (allied) state.allies.push(npc); else if (faction !== state.faction && role !== 'spy') state.enemies.push(npc);
  return npc;
}

function createCaravan(saved) {
  const caravan = new THREE.Group();
  const wood = mat(0x6d472e); const canvasMat = mat(0xc1aa76); const iron = mat(0x292929, .4, .3);
  caravan.add(mesh(new THREE.BoxGeometry(4.2, 1.3, 2.5), wood, 0, 1.35, 0));
  const cover = mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 10, 1, false, 0, Math.PI), canvasMat, 0, 2.2, 0);
  cover.rotation.z = Math.PI / 2; cover.rotation.y = Math.PI / 2; caravan.add(cover);
  for (const x of [-1.45, 1.45]) for (const z of [-1.35, 1.35]) {
    const wheel = mesh(new THREE.TorusGeometry(.55, .16, 8, 14), iron, x, .65, z); wheel.rotation.y = Math.PI / 2; caravan.add(wheel);
  }
  const chest = mesh(new THREE.BoxGeometry(1.5, 1, 1), mat(0xb38335), 0, 1.9, 0); chest.name = 'chest'; caravan.add(chest);
  state.scene.add(caravan);
  state.caravan = {
    group: caravan, progress: saved?.progress ?? .08, direction: saved?.direction ?? 1,
    looted: saved?.looted ?? false, delivered: saved?.delivered ?? false,
  };
  state.interactables.push({ type: 'caravan', object: caravan, radius: 5, label: 'E — осмотреть корован' });
  updateCaravanPosition();
}

function initMission(saved) {
  const initial = {
    elf: { stage: 0, text: 'Доберитесь до корована на дороге', progress: 0 },
    guard: { stage: 0, text: 'Получите приказ у командира', progress: 0 },
    villain: { stage: 0, text: 'Осмотрите стол войны в старом форте', progress: 0 },
  }[state.faction];
  state.mission = { ...initial, ...(saved || {}) };
  if (state.mission.stage >= 4) state.finalStarted = true;
}

function onKeyDown(event) {
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' && state.started) {
    if (state.mode === 'shop') closeShop(); else if (state.paused) resumeGame(); else pauseGame();
    return;
  }
  if (!state.started || state.paused || state.mode !== 'game') return;
  state.keys.add(event.code);
  if (event.code === 'Space') jump();
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyQ') useAbility();
  if (event.code === 'KeyF') cycleOrder();
  if (event.code === 'KeyH') useBandage();
}

function onMouseMove(event) {
  if (!state.mouseLocked || state.paused) return;
  state.yaw -= event.movementX * .0023;
  state.pitch = THREE.MathUtils.clamp(state.pitch - event.movementY * .0017, -.55, .15);
}

function onMouseDown(event) {
  if (!state.started || state.paused || state.mode !== 'game' || !state.mouseLocked) return;
  if (event.button === 0) playerAttack();
  if (event.button === 2) state.blocking = true;
}

function jump() {
  const legLost = isLegLost();
  if (state.player.onGround && !legLost && state.player.stamina >= 12) {
    state.player.velocity.y = 7.2; state.player.onGround = false; state.player.stamina -= 12; playTone(210, .08, 'square');
  }
}

function playerAttack() {
  if (state.attackCooldown > 0 || state.player.stamina < 9) return;
  const armPenalty = isArmLost() ? 1.55 : 1;
  state.attackCooldown = (.48 + (state.faction === 'villain' ? .18 : 0)) * armPenalty;
  state.player.stamina -= 9;
  const weapon = state.player.group.getObjectByName('weapon');
  if (weapon) weapon.rotation.x = -1.7;
  setTimeout(() => { if (weapon) weapon.rotation.x = 0; }, 160);
  playTone(state.faction === 'villain' ? 110 : 180, .08, 'sawtooth');
  let hit = false;
  const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
  for (const npc of state.npcs) {
    if (!npc.alive || npc.allied || npc.role === 'spy') continue;
    const offset = npc.group.position.clone().sub(state.player.group.position);
    const distance = offset.length();
    const facing = offset.normalize().dot(forward);
    if (distance < (state.faction === 'villain' ? 4.5 : 3.7) && facing > .15) {
      damageNpc(npc, (state.faction === 'villain' ? 38 : 29) * state.player.weaponLevel);
      hit = true;
    }
  }
  if (state.faction === 'villain' && state.mission?.stage === 3 && state.gate && state.player.group.position.distanceTo(state.gate.position) < 7) {
    state.gate.userData.health = Math.max(0, state.gate.userData.health - 13);
    toast(`Прочность ворот: ${state.gate.userData.health}%`, 1200);
    hit = true;
    if (state.gate.userData.health <= 0) advanceMission('gateBroken');
  }
  if (hit) emitSparks(state.player.group.position.clone().add(forward.multiplyScalar(2)));
}

function damageNpc(npc, amount) {
  if (!npc.alive) return;
  npc.hp -= amount;
  npc.group.position.add(new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw)).multiplyScalar(1.1));
  flashCharacter(npc.group, 0xff7755);
  if (npc.hp <= 0) killNpc(npc);
}

function killNpc(npc) {
  npc.alive = false; npc.state = 'dead'; state.kills += npc.allied ? 0 : 1;
  npc.group.rotation.z = Math.PI / 2; npc.group.position.y = .48;
  npc.group.traverse((child) => { if (child.isMesh) child.castShadow = false; });
  state.corpses.push(npc.group);
  if (!npc.allied) { state.gold += 8; state.reputation += 4; }
  playTone(70, .16, 'triangle');
  advanceMission('enemyDown', npc);
}

function flashCharacter(group, color) {
  group.traverse((child) => {
    if (!child.isMesh || !child.material?.emissive) return;
    const original = child.material.emissive.getHex(); child.material.emissive.setHex(color);
    setTimeout(() => child.material?.emissive?.setHex(original), 90);
  });
}

function damagePlayer(amount, attacker) {
  if (state.player.invulnerable > 0) return;
  const blocked = state.blocking && state.player.stamina > 5;
  const finalAmount = amount * (blocked ? .26 : 1) * (state.player.rally > 0 ? .72 : 1);
  if (blocked) state.player.stamina = Math.max(0, state.player.stamina - 12);
  state.player.hp = Math.max(0, state.player.hp - finalAmount);
  state.player.invulnerable = .38;
  el['damage-flash']?.classList.remove('hit'); void el['damage-flash']?.offsetWidth; el['damage-flash']?.classList.add('hit');
  playTone(85, .12, 'sawtooth');
  if (!blocked && Math.random() < .2) inflictInjury();
  if (state.player.hp <= 0) finishGame(false, attacker ? `Вас одолел ${FACTIONS[attacker.faction]?.short || 'враг'}.` : 'Кровопотеря оказалась смертельной.');
}

function inflictInjury() {
  const parts = ['leftEye','rightEye','leftArm','rightArm','leftLeg','rightLeg'];
  const part = parts[Math.floor(Math.random() * parts.length)];
  const current = state.body[part];
  if (current === 'prosthetic' || current === 'severed') return;
  const severe = current === 'wounded' || state.player.hp < 42;
  state.body[part] = severe ? 'severed' : 'wounded';
  state.body.bleed = Math.min(100, state.body.bleed + (severe ? 28 : 10));
  const names = { leftEye:'левый глаз',rightEye:'правый глаз',leftArm:'левая рука',rightArm:'правая рука',leftLeg:'левая нога',rightLeg:'правая нога' };
  toast(severe ? `Тяжёлая травма: потерян ${names[part]}. Нужен протез!` : `Ранение: ${names[part]}. Кровотечение усилилось.`, 4200, 'danger');
  syncBodyVisuals();
}

function syncBodyVisuals() {
  if (!state.player) return;
  for (const part of ['leftArm','rightArm','leftLeg','rightLeg']) {
    const limb = state.player.group.getObjectByName(part);
    if (limb) limb.visible = state.body[part] !== 'severed';
    if (limb && state.body[part] === 'prosthetic') limb.material = mat(0x8f9698, .35, .75);
  }
  el['left-eye-mask']?.classList.toggle('visible', state.body.leftEye === 'severed');
  el['right-eye-mask']?.classList.toggle('visible', state.body.rightEye === 'severed');
}

function isLegLost() { return state.body.leftLeg === 'severed' || state.body.rightLeg === 'severed'; }
function isArmLost() { return state.body.leftArm === 'severed' || state.body.rightArm === 'severed'; }

function useAbility() {
  if (state.abilityCooldown > 0) return;
  state.abilityCooldown = state.faction === 'villain' ? 20 : 15;
  if (state.faction === 'elf') {
    state.player.cloak = 6; state.player.group.visible = false; toast('Тень леса: враги теряют вас из виду на 6 секунд.');
  } else if (state.faction === 'guard') {
    state.player.rally = 7; state.player.hp = Math.min(100, state.player.hp + 15);
    state.allies.filter((n) => n.alive).forEach((n) => { n.hp = Math.min(72, n.hp + 20); });
    toast('Боевой клич: отряд укреплён!');
  } else {
    const base = state.player.group.position;
    for (let i = 0; i < 2; i += 1) spawnNpc('villain', base.x + i * 2 - 1, base.z - 2, `summon-${Date.now()}-${i}`, true);
    toast('Из тумана выступили два бойца форта.');
  }
  playTone(360, .22, 'triangle');
}

function cycleOrder() {
  const orders = ['follow', 'attack', 'hold'];
  state.order = orders[(orders.indexOf(state.order) + 1) % orders.length];
  const labels = { follow: 'За мной', attack: 'В атаку', hold: 'Держать позицию' };
  toast(`Приказ отряду: ${labels[state.order]}`);
  if (el['order-menu']) el['order-menu'].textContent = `F — ${labels[state.order]}`;
}

function useBandage() {
  if (state.gold < 8 || state.body.bleed <= 0) { toast('Бинт стоит 8 золота; сейчас перевязка не нужна.', 1800); return; }
  state.gold -= 8; state.body.bleed = Math.max(0, state.body.bleed - 34); toast('Вы наложили походную повязку.'); updateHud();
}

function interact() {
  const nearest = nearestInteraction();
  if (!nearest) return;
  if (nearest.type === 'merchant') openShop();
  if (nearest.type === 'commander') advanceMission('commander');
  if (nearest.type === 'elder') advanceMission('elder');
  if (nearest.type === 'warTable') advanceMission('warTable');
  if (nearest.type === 'caravan') advanceMission('caravan');
  const spy = state.npcs.find((n) => n.id === 'spy' && n.alive);
  if (state.faction === 'guard' && spy && spy.group.visible && state.player.group.position.distanceTo(spy.group.position) < 3.5) advanceMission('spy');
}

function nearestInteraction() {
  let best = null; let distance = Infinity;
  for (const item of state.interactables) {
    const d = state.player.group.position.distanceTo(item.object.position);
    if (d < item.radius && d < distance) { best = item; distance = d; }
  }
  const spy = state.npcs.find((n) => n.id === 'spy' && n.alive && n.group.visible);
  if (spy) {
    const d = state.player.group.position.distanceTo(spy.group.position);
    if (d < 3.5 && d < distance) best = { type: 'spy', label: 'E — разоблачить подозрительного путника' };
  }
  return best;
}

function openShop() {
  state.mode = 'shop'; state.paused = true; document.exitPointerLock?.();
  renderShop(); el['shop-screen'].classList.add('active');
}

function closeShop() {
  el['shop-screen']?.classList.remove('active'); state.mode = 'game'; state.paused = false; clock.getDelta();
}

const SHOP = [
  { id:'heal', name:'Лечение лекаря', price:22, desc:'Восстановить здоровье и залечить обычные раны.', action: () => { state.player.hp = 100; for (const k of Object.keys(state.body)) if (state.body[k] === 'wounded') state.body[k] = 'healthy'; state.body.bleed = Math.max(0, state.body.bleed - 45); } },
  { id:'bandage', name:'Три бинта', price:16, desc:'Остановить большую часть кровотечения.', action: () => { state.body.bleed = Math.max(0, state.body.bleed - 70); } },
  { id:'weapon', name:'Закалённое оружие', price:42, desc:'Урон оружия увеличен на 35%.', action: () => { state.player.weaponLevel = Math.max(state.player.weaponLevel, 1.35); } },
  { id:'arm', name:'Стальной протез руки', price:35, desc:'Возвращает возможность сражаться без штрафа.', action: () => prosthetic(['leftArm','rightArm']) },
  { id:'leg', name:'Шарнирный протез ноги', price:38, desc:'Снова позволяет бегать и прыгать.', action: () => prosthetic(['leftLeg','rightLeg']) },
  { id:'eye', name:'Глазной протез', price:30, desc:'Убирает заслоняющую обзор повязку.', action: () => prosthetic(['leftEye','rightEye']) },
];

function renderShop() {
  el['shop-items'].replaceChildren();
  for (const item of SHOP) {
    const card = document.createElement('article'); card.className = 'shop-item';
    const available = item.id === 'arm' ? ['leftArm','rightArm'].some((p) => state.body[p] === 'severed')
      : item.id === 'leg' ? ['leftLeg','rightLeg'].some((p) => state.body[p] === 'severed')
      : item.id === 'eye' ? ['leftEye','rightEye'].some((p) => state.body[p] === 'severed') : true;
    card.innerHTML = `<div><h3>${item.name}</h3><p>${item.desc}</p></div><button data-buy="${item.id}" ${state.gold < item.price || !available ? 'disabled' : ''}>${available ? `${item.price} ◈` : 'Не требуется'}</button>`;
    el['shop-items'].appendChild(card);
  }
  el['shop-items'].querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => buyItem(button.dataset.buy)));
}

function buyItem(id) {
  const item = SHOP.find((entry) => entry.id === id); if (!item || state.gold < item.price) return;
  state.gold -= item.price; item.action(); syncBodyVisuals(); updateHud(); renderShop(); saveGame(false); toast(`Куплено: ${item.name}`);
}

function prosthetic(parts) {
  const part = parts.find((p) => state.body[p] === 'severed');
  if (part) state.body[part] = 'prosthetic';
}

function advanceMission(event, subject) {
  const mission = state.mission;
  if (state.faction === 'elf') {
    if (mission.stage === 0 && (event === 'caravan' || state.player.group.position.distanceTo(state.caravan.group.position) < 10)) setMission(1, 'Победите охрану корована');
    else if (mission.stage === 1 && state.npcs.filter((n) => n.role === 'caravan' && n.alive && !n.allied).length === 0) setMission(2, 'Обыщите повозку — нажмите E рядом с ней');
    else if (mission.stage === 2 && event === 'caravan') { lootCaravan(); setMission(3, 'Доставьте добычу в Изумрудную чащу'); }
    else if (mission.stage === 3 && getZone(state.player.group.position) === 'forest') { startFinalBattle('guard'); setMission(4, 'Отразите ответный рейд стражи'); }
    else if (mission.stage === 4 && finalEnemiesDead()) finishGame(true, 'Корован разграблен, а лесная деревня устояла.');
  } else if (state.faction === 'guard') {
    if (mission.stage === 0 && event === 'commander') setMission(1, 'Сопроводите корован к дворцу');
    else if (mission.stage === 1 && state.caravan.delivered) setMission(2, 'Найдите эльфийского шпиона в Вольных землях');
    else if (mission.stage === 2 && event === 'spy') { if (subject) subject.alive = false; const spy = state.npcs.find((n) => n.id === 'spy'); if (spy) spy.group.visible = false; state.gold += 25; setMission(3, 'Вернитесь к командиру у дворца'); }
    else if (mission.stage === 3 && event === 'commander') { startFinalBattle('villain'); setMission(4, 'Защитите дворцовые ворота от войск форта'); }
    else if (mission.stage === 4 && finalEnemiesDead()) finishGame(true, 'Приказ исполнен: дворец и корован спасены.');
  } else {
    if (mission.stage === 0 && event === 'warTable') { setMission(1, 'Прикажите отряду следовать за вами (F)'); }
    else if (mission.stage === 1 && event === 'order') setMission(2, 'Разграбьте корован или идите прямо к дворцу');
    else if (mission.stage === 2 && event === 'caravan') { lootCaravan(); setMission(3, 'Сломайте дворцовые ворота атаками'); }
    else if (mission.stage === 2 && state.player.group.position.distanceTo(state.gate.position) < 8) setMission(3, 'Сломайте дворцовые ворота атаками');
    else if (mission.stage === 3 && event === 'gateBroken') { startFinalBattle('guard'); setMission(4, 'Удерживайте дворцовый двор: 0%'); }
    else if (mission.stage === 4 && state.capture >= 100) finishGame(true, 'Старый форт подчинил себе имперские земли.');
  }
  if (event === 'enemyDown' && subject?.role === 'final') checkMissionTransitions();
}

function setMission(stage, text) {
  state.mission.stage = stage; state.mission.text = text; state.reputation += 10;
  toast(`Новая цель: ${text}`, 3600); saveGame(false); updateHud();
}

function lootCaravan() {
  if (state.caravan.looted) return;
  state.caravan.looted = true; state.gold += 58; state.reputation += 20;
  const chest = state.caravan.group.getObjectByName('chest'); if (chest) chest.visible = false;
  toast('Корован разграблен: +58 золота. Кирилл был бы доволен.', 3600);
}

function startFinalBattle(enemyFaction) {
  if (state.finalStarted) return;
  state.finalStarted = true;
  const center = state.faction === 'elf' ? new THREE.Vector3(-42,1,-35) : new THREE.Vector3(35,1,20);
  for (let i = 0; i < 4; i += 1) {
    const npc = spawnNpc(enemyFaction, center.x + 10 + (i % 2) * 2, center.z - 5 + i * 3, `final-${i}`, false, 'final');
    npc.target = state.player;
  }
  toast('Финальная битва началась!', 3200, 'danger');
}

function finalEnemiesDead() { return state.npcs.filter((n) => n.role === 'final' && n.alive).length === 0; }

function checkMissionTransitions() {
  if ((state.faction === 'elf' || state.faction === 'guard') && state.mission.stage === 4 && finalEnemiesDead()) advanceMission('finalClear');
}

function updateMission(dt) {
  if (!state.mission) return;
  if (state.faction === 'elf') advanceMission('tick');
  if (state.faction === 'guard' && state.mission.stage === 1 && state.caravan.delivered) advanceMission('tick');
  if (state.faction === 'villain') {
    if (state.mission.stage === 1 && state.order !== 'follow') advanceMission('order');
    if (state.mission.stage === 2 && state.player.group.position.distanceTo(state.gate.position) < 8) advanceMission('palace');
    if (state.mission.stage === 4) {
      if (state.player.group.position.distanceTo(new THREE.Vector3(41, 1, 28)) < 9) state.capture = Math.min(100, state.capture + dt * 10);
      state.mission.text = `Удерживайте дворцовый двор: ${Math.floor(state.capture)}%`;
      if (state.capture >= 100) advanceMission('captured');
    }
  }
}

function updatePlayer(dt) {
  const player = state.player;
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.abilityCooldown = Math.max(0, state.abilityCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.cloak = Math.max(0, player.cloak - dt);
  player.rally = Math.max(0, player.rally - dt);
  if (player.cloak <= 0 && !player.group.visible) player.group.visible = true;
  const forwardAmount = (state.keys.has('KeyW') || state.keys.has('ArrowUp') ? 1 : 0) - (state.keys.has('KeyS') || state.keys.has('ArrowDown') ? 1 : 0);
  const sideAmount = (state.keys.has('KeyD') || state.keys.has('ArrowRight') ? 1 : 0) - (state.keys.has('KeyA') || state.keys.has('ArrowLeft') ? 1 : 0);
  const direction = new THREE.Vector3();
  if (forwardAmount || sideAmount) {
    const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    direction.addScaledVector(forward, forwardAmount).addScaledVector(right, sideAmount).normalize();
    player.group.rotation.y = Math.atan2(direction.x, direction.z);
  }
  const sprinting = state.keys.has('ShiftLeft') && player.stamina > 2 && !isLegLost();
  const speed = player.speed * (sprinting ? 1.55 : 1) * (isLegLost() ? .29 : 1);
  player.group.position.addScaledVector(direction, speed * dt);
  if (sprinting && direction.lengthSq()) player.stamina = Math.max(0, player.stamina - dt * 18);
  else player.stamina = Math.min(100, player.stamina + dt * 13);
  player.velocity.y -= 18 * dt; player.group.position.y += player.velocity.y * dt;
  if (player.group.position.y <= 1.05) { player.group.position.y = 1.05; player.velocity.y = 0; player.onGround = true; }
  player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -WORLD_LIMIT, WORLD_LIMIT);
  player.group.position.z = THREE.MathUtils.clamp(player.group.position.z, -WORLD_LIMIT, WORLD_LIMIT);
  if (state.body.bleed > 0) {
    state.body.bleed = Math.min(100, state.body.bleed + dt * .34);
    player.hp = Math.max(0, player.hp - dt * state.body.bleed * .0025);
    if (player.hp <= 0 || state.body.bleed >= 100) damagePlayer(999, null);
  }
  const cameraOffset = new THREE.Vector3(-Math.sin(state.yaw) * 8.7, 4.4 - state.pitch * 5, -Math.cos(state.yaw) * 8.7);
  state.camera.position.lerp(player.group.position.clone().add(cameraOffset), 1 - Math.pow(.001, dt));
  state.camera.lookAt(player.group.position.clone().add(new THREE.Vector3(0, 1.4 - state.pitch * 3, 0)));
}

function updateNpcs(dt) {
  for (const npc of state.npcs) {
    if (!npc.alive || !npc.group.visible) continue;
    npc.cooldown = Math.max(0, npc.cooldown - dt);
    const distanceToPlayer = npc.group.position.distanceTo(state.player.group.position);
    const hostile = !npc.allied && npc.faction !== state.faction && npc.role !== 'spy';
    let targetNpc = null;
    if (npc.allied && state.order === 'attack') targetNpc = nearestHostile(npc.group.position);
    if (hostile && distanceToPlayer < (npc.role === 'final' ? 38 : 19) && state.player.cloak <= 0) {
      moveNpcToward(npc, state.player.group.position, dt, 3.5);
      if (distanceToPlayer < 2.45 && npc.cooldown <= 0) { npc.cooldown = 1.25 + Math.random() * .4; damagePlayer(npc.role === 'final' ? 13 : 9, npc); }
    } else if (targetNpc) {
      const d = npc.group.position.distanceTo(targetNpc.group.position); moveNpcToward(npc, targetNpc.group.position, dt, 4.1);
      if (d < 2.5 && npc.cooldown <= 0) { npc.cooldown = 1.1; damageNpc(targetNpc, 16); }
    } else if (npc.allied && state.order === 'follow' && distanceToPlayer > 4 + state.allies.indexOf(npc) * .5) {
      moveNpcToward(npc, state.player.group.position, dt, 4.5);
    } else if (!hostile && !npc.allied && npc.role !== 'caravan') {
      const wander = npc.home.clone().add(new THREE.Vector3(Math.sin(state.gameTime * .25 + npc.home.x) * 3, 0, Math.cos(state.gameTime * .2 + npc.home.z) * 3));
      moveNpcToward(npc, wander, dt, 1.15);
    }
  }
}

function nearestHostile(position) {
  let best = null; let dist = 20;
  for (const npc of state.npcs) if (npc.alive && !npc.allied && npc.role !== 'spy') {
    const d = position.distanceTo(npc.group.position); if (d < dist) { dist = d; best = npc; }
  }
  return best;
}

function moveNpcToward(npc, target, dt, speed) {
  const direction = target.clone().sub(npc.group.position); direction.y = 0;
  if (direction.lengthSq() < .2) return;
  direction.normalize(); npc.group.position.addScaledVector(direction, speed * dt); npc.group.rotation.y = Math.atan2(direction.x, direction.z);
}

function updateCaravan(dt = 0) {
  if (!state.caravan || state.caravan.looted) return;
  const guardFaction = state.faction === 'guard';
  const nearby = state.player.group.position.distanceTo(state.caravan.group.position) < 18;
  const speed = guardFaction && state.mission?.stage === 1 && nearby ? .025 : .009;
  state.caravan.progress += dt * speed * state.caravan.direction;
  if (state.caravan.progress >= 1) {
    state.caravan.progress = 1; state.caravan.direction = -1; state.caravan.delivered = true;
    if (guardFaction) toast('Корован прибыл к дворцу.');
  }
  if (state.caravan.progress <= 0) { state.caravan.progress = 0; state.caravan.direction = 1; }
  updateCaravanPosition();
  const guards = state.npcs.filter((n) => n.role === 'caravan' && n.alive);
  guards.forEach((guard, i) => { if (guard.allied || guardFaction) moveNpcToward(guard, state.caravan.group.position.clone().add(new THREE.Vector3(i ? 3 : -3,0,2)), dt, 4); });
}

function updateCaravanPosition() {
  const start = new THREE.Vector3(-10, 0, 16); const end = new THREE.Vector3(32, 0, 24);
  state.caravan.group.position.lerpVectors(start, end, state.caravan.progress);
  state.caravan.group.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
}

function emitSparks(position) {
  for (let i = 0; i < 7; i += 1) {
    const spark = mesh(new THREE.SphereGeometry(.055, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffc15a }), position.x, position.y + 1.5, position.z, false);
    state.scene.add(spark); state.particles.push({ object: spark, life: .42, velocity: new THREE.Vector3((Math.random()-.5)*5, Math.random()*4, (Math.random()-.5)*5) });
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i]; p.life -= dt; p.velocity.y -= 8 * dt; p.object.position.addScaledVector(p.velocity, dt);
    if (p.life <= 0) { state.scene.remove(p.object); state.particles.splice(i, 1); }
  }
}

function getZone(position) {
  if (position.x < -18) return 'forest';
  if (position.x > 22 && position.z < 1) return 'fort';
  if (position.x > 22) return 'palace';
  return 'neutral';
}

function updateZone() {
  const zone = getZone(state.player.group.position);
  if (zone !== state.zone) {
    state.zone = zone; toast(`Вы вступили в земли: ${ZONES[zone].name}`, 2200); saveGame(false);
    state.scene.fog.color.set(zone === 'forest' ? 0x718778 : zone === 'fort' ? 0x6c6e78 : zone === 'palace' ? 0x9aa8b3 : 0xa69d82);
  }
}

function updateHud() {
  if (!state.player) return;
  const hp = Math.max(0, state.player.hp); const stamina = state.player.stamina; const bleed = state.body.bleed;
  el['health-fill'].style.width = `${hp}%`; el['stamina-fill'].style.width = `${stamina}%`; el['bleed-fill'].style.width = `${bleed}%`;
  el['health-text'].textContent = `${Math.ceil(hp)} / 100`;
  el['gold-value'].textContent = state.gold; el['reputation-value'].textContent = state.reputation;
  el['zone-name'].textContent = ZONES[state.zone]?.name || 'Четыре земли';
  el['objective-text'].textContent = state.mission?.text || 'Выберите свою судьбу';
  el['ability-label'].textContent = state.abilityCooldown > 0 ? `${FACTIONS[state.faction].ability.split(' — ')[1]}: ${Math.ceil(state.abilityCooldown)}с` : FACTIONS[state.faction].ability;
  const interaction = nearestInteraction();
  el['interaction-prompt'].textContent = interaction?.label || '';
  el['interaction-prompt'].classList.toggle('visible', Boolean(interaction));
  const labels = { healthy:'цел', wounded:'ранен', severed:'потерян', prosthetic:'протез' };
  const status = [
    ['Глаз', state.body.leftEye, state.body.rightEye], ['Рука', state.body.leftArm, state.body.rightArm], ['Нога', state.body.leftLeg, state.body.rightLeg],
  ].map(([name,a,b]) => `<span class="body-part ${a} ${b}">${name}: ${labels[a]} / ${labels[b]}</span>`).join('');
  el['body-status'].innerHTML = status;
  drawMinimap();
}

function drawMinimap() {
  const canvas = el.minimap; if (!canvas) return;
  const ctx = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height;
  ctx.clearRect(0,0,w,h); ctx.fillStyle = 'rgba(8,12,14,.82)'; ctx.fillRect(0,0,w,h);
  const zoneColors = ['#315f39','#796c48','#59636c','#34343c'];
  ctx.fillStyle = zoneColors[0]; ctx.fillRect(0,h/2,w/2,h/2);
  ctx.fillStyle = zoneColors[1]; ctx.fillRect(0,0,w/2,h/2);
  ctx.fillStyle = zoneColors[2]; ctx.fillRect(w/2,0,w/2,h/2);
  ctx.fillStyle = zoneColors[3]; ctx.fillRect(w/2,h/2,w/2,h/2);
  const map = (v) => (v + WORLD_LIMIT) / (WORLD_LIMIT * 2) * w;
  ctx.fillStyle = '#fff4bd'; ctx.beginPath(); ctx.arc(map(state.player.group.position.x), h - map(state.player.group.position.z), 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#d8a74c'; ctx.beginPath(); ctx.arc(map(state.caravan.group.position.x), h-map(state.caravan.group.position.z), 3, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(.5,.5,w-1,h-1);
}

function pauseGame() {
  state.paused = true; state.mode = 'pause'; document.exitPointerLock?.(); el['pause-screen'].classList.add('active');
}
function resumeGame() { el['pause-screen']?.classList.remove('active'); state.paused = false; state.mode = 'game'; clock.getDelta(); }
function quitToTitle() { document.exitPointerLock?.(); cleanupGame(); state.mode = 'title'; state.paused = false; showScreen('title-screen'); el['continue-btn'].disabled = !localStorage.getItem(SAVE_KEY); }

function saveGame(manual) {
  if (!state.player || !state.mission) return;
  const payload = {
    version: VERSION, faction: state.faction, position: state.player.group.position.toArray(), health: state.player.hp,
    weaponLevel: state.player.weaponLevel, gold: state.gold,
    reputation: state.reputation, kills: state.kills, body: state.body, mission: state.mission,
    caravan: { progress: state.caravan.progress, direction: state.caravan.direction, looted: state.caravan.looted, delivered: state.caravan.delivered },
    finalStarted: state.finalStarted, gameTime: state.gameTime, capture: state.capture, order: state.order,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); state.lastSave = Date.now(); el['continue-btn'].disabled = false;
  if (manual) toast('Игра сохранена в этом браузере.');
}

function loadGame() {
  try {
    const payload = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!payload || payload.version !== VERSION || !FACTIONS[payload.faction]) throw new Error('bad save');
    startGame(payload.faction, payload);
  } catch {
    localStorage.removeItem(SAVE_KEY); el['continue-btn'].disabled = true; toast('Сохранение повреждено. Начните новую игру.', 3200, 'danger');
  }
}

function finishGame(won, reason) {
  if (state.mode === 'result') return;
  state.mode = 'result'; state.paused = true; document.exitPointerLock?.();
  el['result-title'].textContent = won ? 'Земля помнит твоё имя' : 'Песнь оборвалась';
  el['result-summary'].innerHTML = `<p>${reason}</p><dl><div><dt>Сторона</dt><dd>${FACTIONS[state.faction].name}</dd></div><div><dt>Время</dt><dd>${Math.floor(state.gameTime / 60)}:${String(Math.floor(state.gameTime % 60)).padStart(2,'0')}</dd></div><div><dt>Побеждено</dt><dd>${state.kills}</dd></div><div><dt>Золото</dt><dd>${state.gold}</dd></div></dl>`;
  el['result-screen'].classList.add('active');
  if (won) localStorage.removeItem(SAVE_KEY);
}

function toast(message, duration = 2400, tone = '') {
  if (!el['toast-container']) return;
  const node = document.createElement('div'); node.className = `toast ${tone}`; node.textContent = message; el['toast-container'].appendChild(node);
  requestAnimationFrame(() => node.classList.add('visible'));
  setTimeout(() => { node.classList.remove('visible'); setTimeout(() => node.remove(), 300); }, duration);
}

function playTone(frequency, duration, type = 'sine') {
  try {
    state.audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = state.audio.createOscillator(); const gain = state.audio.createGain();
    osc.type = type; osc.frequency.value = frequency; gain.gain.setValueAtTime(.035, state.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, state.audio.currentTime + duration);
    osc.connect(gain).connect(state.audio.destination); osc.start(); osc.stop(state.audio.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

function resize() {
  if (!state.renderer || !state.camera) return;
  state.camera.aspect = window.innerWidth / window.innerHeight; state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!state.started) return;
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  if (!state.paused && state.mode === 'game') {
    state.gameTime += dt;
    updatePlayer(dt); updateNpcs(dt); updateCaravan(dt); updateParticles(dt); updateMission(dt); updateZone(); updateHud();
    if (Math.floor(state.gameTime) % 45 === 0 && (!state.lastSave || Date.now() - state.lastSave > 42000)) saveGame(false);
  }
  state.renderer.render(state.scene, state.camera);
}

boot();
