'use strict';

const heroRoles = ['elf', 'guard', 'lord'];
function changeHeroView() {
  prefs.camera = prefs.camera === 'shoulder' ? 'first' : 'shoulder';
  persistSettings();
  if (active) notify(prefs.camera === 'shoulder' ? 'Камера за плечом' : 'Вид от первого лица', 1.4);
}
function frameHeroCamera(realm, s, t, attackAnim) {
  const c = realm.camera;
  const focused = s.weapon === 'bow' && keys.has('KeyR') && !s.delivery;
  const sprinting =
    (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
    s.stamina > 4 &&
    (keys.has('KeyW') || keys.has('ArrowUp')) &&
    !s.blockTime &&
    !s.delivery;
  const shoulder =
    prefs.camera === 'shoulder' &&
    !s.delivery &&
    s.health > 0 &&
    s.arm !== 'lost' &&
    s.eye !== 'lost' &&
    !['lost', 'chair'].includes(s.leg) &&
    s.weapon === 'sword';
  const fov = focused ? 48 : sprinting && prefs.motion ? 73 : 68;
  const dt = clamp(t - (realm.heroLensTime ?? t - 0.016), 0, 0.1);
  realm.heroLensTime = t;
  if (Math.abs(c.fov - fov) > 0.025) {
    c.fov += (fov - c.fov) * (1 - Math.exp(-12 * dt));
    c.updateProjectionMatrix();
  }
  $('play').classList.toggle('bow-focus', focused);
  if (!shoulder) {
    if (realm.fieldHero) realm.fieldHero.visible = false;
    if (realm.weapon.visible && !s.delivery) {
      const threatened =
        attackAnim > 0 ||
        s.blockTime > 0 ||
        s.actors.some((a) => a.hp > 0 && a.team === 'hostile' && distance(s, a) < 12);
      const target = threatened ? 0 : 1;
      realm.loweredBlade =
        (realm.loweredBlade ?? target) + (target - (realm.loweredBlade ?? target)) * (1 - Math.exp(-9 * dt));
      realm.weapon.position.y -= realm.loweredBlade * 0.19;
      realm.weapon.rotation.x -= realm.loweredBlade * 0.55;
    }
    return;
  }
  if (realm.fieldHero?.userData.playerSide !== s.side) {
    if (realm.fieldHero) {
      realm.scene.remove(realm.fieldHero);
      releaseCharacter(realm.fieldHero);
    }
    realm.fieldHero = realm.person(heroRoles[s.side], 'hero');
    realm.fieldHero.userData.playerSide = s.side;
  }
  const hero = realm.fieldHero;
  const floor = walkingSurface(s.x, s.z),
    y = floor + s.air;
  hero.position.set(s.x, y, s.z);
  hero.visible = true;
  const moving = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown'].some((k) => keys.has(k));
  const state =
    attackAnim > 0.01
      ? 'slash'
      : s.blockTime > 0
        ? 'block'
        : s.vy !== 0 && s.air > 0.13
          ? 'jump'
          : moving
            ? sprinting
              ? 'run'
              : 'walk'
            : 'idle';
  const stepForward =
    Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const stepRight = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const strideDirection =
    moving && !s.blockTime && attackAnim < 0.01 ? Math.atan2(-stepRight, stepForward) : 0;
  const facing = s.yaw + Math.PI + strideDirection;
  if (hero.userData.facing == null || dt === 0) hero.userData.facing = facing;
  hero.userData.facing += angles(facing - hero.userData.facing) * (1 - Math.exp(-17 * dt));
  hero.rotation.set(0, hero.userData.facing, 0);
  poseCharacter(hero, attackAnim > 0.01 && s.heavy ? 'heavy' : state, t);
  const fx = -Math.sin(s.yaw),
    fz = -Math.cos(s.yaw),
    rx = Math.cos(s.yaw),
    rz = -Math.sin(s.yaw);
  const pitch = clamp(s.pitch, -0.94, 0.76),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const radius = c.aspect < 0.86 ? 3.5 : 3.12,
    side = 0.42;
  const dx = -fx * radius * cp + rx * side,
    dz = -fz * radius * cp + rz * side;
  let fraction = 1;
  // Pull the camera in when a wall or a trunk lies between the character and the lens.
  for (let i = 1; i <= 12; i++) {
    const u = i / 12;
    if (!realm.free(s.x + dx * u, s.z + dz * u, 0.18)) {
      fraction = (i - 1) / 12;
      break;
    }
  }
  const x = s.x + dx * fraction,
    z = s.z + dz * fraction,
    eye = y + 1.62;
  c.position.set(x, Math.max(ground(x, z) + 0.3, eye + (0.59 - radius * sp) * fraction), z);
  hero.visible = fraction > 0.2;
  c.lookAt(s.x + fx * 7.5 * cp + rx * side, eye + sp * 7.5, s.z + fz * 7.5 * cp + rz * side);
  realm.skyMesh.position.copy(c.position);
  for (const object of [realm.weapon, realm.shield, realm.bow]) object.visible = false;
}

const dialogueCast = {
  'Капитан Арда': ['commander', 'commander'],
  'Дозорная Лиора': ['elf', 'hero'],
  Эльда: ['merchant', 'shop'],
  'Эльда, мельничиха': ['merchant', 'shop'],
  'Мара, травница': ['merchant', 'healer'],
  'Писарь Нив': ['merchant', 'scribe'],
  Возница: ['merchant', 'carter'],
  'Старший обоза': ['merchant', 'carter'],
  'Сотник Гарт': ['lord', 'keeper'],
  'Гарт, хранитель огня': ['lord', 'keeper'],
  'Часовой Ивен': ['guard', 'vigil'],
  'Ян, колёсник': ['escort', 'carter'],
  'Регент Вельт': ['regent', 'regent'],
};
let dialogueStage = null,
  portraitFrame = 0;
function closeStage() {
  cancelAnimationFrame(portraitFrame);
  portraitFrame = 0;
  if (dialogueStage?.subject) {
    dialogueStage.scene.remove(dialogueStage.subject);
    releaseCharacter(dialogueStage.subject);
    dialogueStage.subject = null;
  }
}
function portraitStudio() {
  if (dialogueStage) return dialogueStage;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(26, 1, 0.02, 25);
  scene.add(new THREE.HemisphereLight(0xecf2fc, 0xb29e87, 1.45));
  for (const [color, power, x, y, z] of [
    [0xffdaa5, 2.9, -2.7, 3.8, 3],
    [0x98c6e4, 1.38, 2.1, 2, -2.2],
    [0xf1ebd4, 0.55, 1.3, 0.4, 3],
  ]) {
    const light = new THREE.DirectionalLight(color, power);
    light.position.set(x, y, z);
    scene.add(light);
  }
  dialogueStage = { scene, camera, renderer, subject: null };
  return dialogueStage;
}
function openStage(speaker) {
  const host = $('portrait-stage'),
    role = dialogueCast[speaker];
  if (!host || !role || !world) return;
  let studio;
  try {
    studio = portraitStudio();
  } catch {
    return;
  }
  const { scene, camera, renderer } = studio;
  const actor = world.person(...role, true);
  scene.add(actor);
  scene.environment = world.scene.environment;
  studio.subject = actor;
  actor.rotation.y = -0.19;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  host.classList.add('live');
  const began = performance.now();
  let lastFrame = -1;
  function render(stamp) {
    if (!host.isConnected || !$('dialog').open || studio.subject !== actor) {
      closeStage();
      return;
    }
    if (!document.hidden && stamp - lastFrame >= 32) {
      lastFrame = stamp;
      const width = Math.max(1, host.clientWidth),
        height = Math.max(1, host.clientHeight);
      if (
        renderer.domElement.clientWidth !== width ||
        renderer.domElement.clientHeight !== height ||
        studio.height !== height ||
        studio.width !== width
      ) {
        renderer.setSize(width, height);
        studio.width = width;
        studio.height = height;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const t = prefs.motion ? (stamp - began) * 0.001 : 0;
      poseCharacter(actor, realmVoice.active ? 'talk' : 'idle', t);
      const distance = 1.57,
        slide = prefs.motion ? 0.025 * Math.sin(t * 0.22) : 0;
      camera.position.set(0.19 + slide, 1.61, distance);
      camera.lookAt(0, 1.49, 0);
      renderer.render(scene, camera);
    }
    portraitFrame = requestAnimationFrame(render);
  }
  render(began);
}
