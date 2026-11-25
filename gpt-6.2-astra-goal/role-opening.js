'use strict';

const roleOvertures = [
  {
    title: 'Пока горит окно',
    place: 'Лесное поселение',
    at: [-60.6, 65.3],
    yaw: 0.36,
    hour: 6.85,
    entries: [
      'Травница погасила свет у дозорного дома. За гребнем показались два налётчика. Лиора взялась вывести детей за овраг.',
      'Защитите лесные дома',
    ],
    cast: [
      ['mara', 'merchant', 'healer', -0.92, -0.15, 0.31, true],
      ['liora', 'elf', 'hero', 0.92, 0.3, -0.43, true],
      ['child', 'merchant', 'young', -2.4, -0.95, 0.92, true, 0.7],
      ['runner', 'elf', 'young', -3.2, -1.32, 0.92, true, 0.76],
    ],
    shots: [
      { eye: [2.7, 2.85, 7.6], to: [2.2, 2.45, 6.8], aim: [-0.3, 1.37, -0.35], lens: 48, seconds: 2.1 },
      {
        line: 'herbalist-window',
        who: 'mara',
        eye: [0.8, 1.56, 2.48],
        to: [0.51, 1.54, 2.29],
        aim: [-0.71, 1.4, -0.1],
        lens: 39,
      },
      {
        line: 'scout-tracks',
        who: 'liora',
        eye: [-0.74, 1.58, 2.83],
        to: [-0.55, 1.62, 2.51],
        aim: [0.72, 1.43, 0.34],
        lens: 38,
      },
      {
        line: 'scout-home',
        who: 'liora',
        eye: [1.72, 1.56, 3.26],
        to: [2.15, 1.68, 3.58],
        aim: [0.25, 1.28, -0.03],
        lens: 46,
      },
    ],
  },
  {
    title: 'Без сменного знака',
    place: 'Имперская стена',
    at: [52.1, -50.8],
    yaw: -1.13,
    hour: 9.2,
    entries: [
      'Ивен доложил о двух чужих у ворот. Капитан Арда принимает караул на площади. Подойдите к ней за приказом.',
      'Получите приказ капитана',
    ],
    cast: [
      ['iven', 'guard', 'vigil', -0.87, 0.04, 0.48, true],
      ['arda', 'commander', 'commander', 0.86, 0.1, -0.5, true],
    ],
    shots: [
      { eye: [-4.1, 3.7, 8.2], to: [-3.15, 3.2, 6.7], aim: [0.35, 2.15, -1.6], lens: 49, seconds: 2.25 },
      {
        line: 'sentry-token',
        who: 'iven',
        eye: [0.53, 1.58, 2.39],
        to: [0.39, 1.6, 2.32],
        aim: [-0.76, 1.51, 0.05],
        lens: 39,
      },
      {
        line: 'captain-gate',
        who: 'arda',
        eye: [-0.52, 1.57, 2.48],
        to: [-0.27, 1.64, 2.24],
        aim: [0.76, 1.48, 0.09],
        lens: 39,
      },
      {
        line: 'captain-report',
        who: 'arda',
        eye: [1.1, 1.61, 2.64],
        to: [1.0, 1.64, 2.33],
        aim: [0.66, 1.48, 0.09],
        lens: 43,
      },
    ],
  },
  {
    title: 'Пустой обоз',
    place: 'Старый форт',
    at: [67.15, 51.0],
    yaw: 0.1,
    hour: 16.3,
    entries: [
      'Имперская стража забрала зерно, предназначенное гарнизону. Сотник Гарт собрал трёх воинов. Цель первого похода выберете вы.',
      'Отдайте приказ дружине',
    ],
    cast: [
      ['gart', 'lord', 'keeper', -1.1, 0.08, 0.4, true],
      ['lord', 'lord', 'hero', 0.89, 0.08, -0.46, true],
      ['bearer', 'lord', 'squad', -2.44, -1.23, 0.34, false],
      ['file', 'lord', 'squad', 1.52, -1.72, -0.1, false],
      ['rear', 'lord', 'squad', 0.06, -2.77, -0.03, false],
    ],
    shots: [
      { eye: [-0.75, 1.62, 5.9], to: [-0.47, 1.8, 5.48], aim: [-0.29, 1.67, -0.65], lens: 51, seconds: 2.4 },
      {
        line: 'centurion-sacks',
        who: 'gart',
        eye: [0.23, 1.63, 2.69],
        to: [0.07, 1.62, 2.46],
        aim: [-0.94, 1.44, 0.08],
        lens: 39,
      },
      {
        line: 'lord-banner',
        who: 'lord',
        eye: [-0.39, 1.49, 2.37],
        to: [-0.19, 1.57, 2.17],
        aim: [0.79, 1.49, 0.08],
        lens: 39,
      },
      {
        line: 'centurion-march',
        who: 'gart',
        eye: [0.32, 1.9, 4.6],
        to: [-0.04, 2.08, 5.55],
        aim: [-0.29, 1.56, -0.49],
        lens: 48,
      },
    ],
  },
];

function rolePosition(p, x, height, z, out) {
  const wx = p.script.at[0] + x * p.cos + z * p.sin,
    wz = p.script.at[1] - x * p.sin + z * p.cos;
  return out.set(wx, walkingSurface(wx, wz) + height, wz);
}

function fortStandard() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const q = c.getContext('2d');
  q.fillStyle = '#314845';
  q.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 256; i += 3) {
    q.fillStyle = i % 2 ? '#324c48' : '#374c47';
    q.fillRect(i, 0, 1, 320);
  }
  q.strokeStyle = '#b59a63';
  q.lineWidth = 5;
  q.strokeRect(9, 9, 238, 302);
  q.strokeStyle = '#806a47';
  q.lineWidth = 2;
  q.strokeRect(15, 15, 226, 290);
  const peak = new Path2D(
    'M30 205 L87 102 L110 132 L143 63 L224 203 L186 201 L145 119 L125 163 L109 148 L91 177 L84 159 L56 208 Z',
  );
  q.fillStyle = '#d1b77f';
  q.fill(peak);
  q.fillStyle = '#9f8053';
  q.fillRect(63, 213, 130, 7);
  q.fillRect(80, 229, 96, 3);
  q.fillStyle = '#eedab2';
  for (const y of [41, 263]) {
    q.beginPath();
    q.moveTo(127, y - 8);
    q.lineTo(134, y);
    q.lineTo(127, y + 8);
    q.lineTo(120, y);
    q.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stageRoleProps(p) {
  const props = new THREE.Group();
  p.group.add(props);
  rolePosition(p, 0, 0, 0, props.position);
  props.rotation.y = p.script.yaw;
  const cloth = new THREE.MeshStandardMaterial({ color: 0x533e2d, roughness: 0.98, side: THREE.DoubleSide }),
    metal = new THREE.MeshStandardMaterial({ color: 0x99734b, metalness: 0.65, roughness: 0.42 }),
    wood = new THREE.MeshStandardMaterial({ color: 0x705138, roughness: 0.96 });
  p.disposable.push(cloth, metal, wood);
  function part(g, m, x, y, z, parent = props) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    p.disposable.push(g);
    return o;
  }
  function box(x, y, z, w, h, d, m = wood, parent) {
    return part(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  }
  function cylinder(x, y, z, a, b, h, m = wood, parent) {
    return part(new THREE.CylinderGeometry(a, b, h, 12), m, x, y, z, parent);
  }
  if (p.side === 0) {
    const lantern = new THREE.Group();
    props.add(lantern);
    lantern.position.set(-1.76, 0.89, -0.2);
    box(-1.76, 0.86, -0.2, 0.73, 0.09, 0.55);
    for (const x of [-2.05, -1.47]) for (const z of [-0.41, 0.01]) box(x, 0.43, z, 0.055, 0.84, 0.055);
    const glass = new THREE.MeshStandardMaterial({
      color: 0xffcf81,
      emissive: 0xff8627,
      emissiveIntensity: 1.35,
      roughness: 0.45,
    });
    p.disposable.push(glass);
    cylinder(0, 0.042, 0, 0.1, 0.11, 0.064, metal, lantern);
    cylinder(0, 0.17, 0, 0.076, 0.063, 0.209, glass, lantern);
    for (const x of [-0.053, 0.053])
      for (const z of [-0.053, 0.053]) box(x, 0.17, z, 0.012, 0.21, 0.012, metal, lantern);
    part(new THREE.ConeGeometry(0.12, 0.11, 7), metal, 0, 0.325, 0, lantern);
    p.lamp = lantern;
    const light = new THREE.PointLight(0xffae62, 2.8, 4);
    light.position.set(0, 0.2, 0);
    lantern.add(light);
  } else if (p.side === 1) {
    const book = new THREE.MeshStandardMaterial({ color: 0xcdbc89, roughness: 0.95 });
    p.disposable.push(book);
    box(-0.08, 0.91, 0.57, 1.24, 0.11, 0.64);
    for (const x of [-0.62, 0.46]) for (const z of [0.35, 0.79]) box(x, 0.44, z, 0.067, 0.87, 0.067);
    box(-0.1, 0.99, 0.56, 0.48, 0.06, 0.32, cloth);
    for (const s of [-1, 1]) {
      const leaf = box(-0.1 + s * 0.106, 1.02, 0.56, 0.218, 0.017, 0.305, book);
      leaf.rotation.z = -s * 0.04;
      for (let j = 0; j < 4; j++)
        box(-0.1 + s * 0.107, 1.033, 0.47 + j * 0.042, 0.138 - 0.012 * (j % 3), 0.005, 0.008, wood);
    }
    for (const x of [0.27, 0.4]) {
      const key = cylinder(x, 1.0, 0.51, 0.049, 0.048, 0.018, metal);
      key.rotation.y = 0.3;
    }
    for (const x of [-1.76, -1.58]) {
      const shaft = cylinder(x, 1.02, -0.55, 0.014, 0.019, 2.04);
      shaft.rotation.z = -0.075;
      part(new THREE.ConeGeometry(0.059, 0.25, 4), metal, x + 0.081, 2.15, -0.55);
    }
  } else {
    const burlap = new THREE.MeshStandardMaterial({ color: 0xa08c69, roughness: 1 }),
      ochre = new THREE.MeshStandardMaterial({ color: 0xbd9452, roughness: 0.94 });
    p.disposable.push(burlap, ochre);
    for (let i = 0; i < 3; i++) {
      const sack = part(
        new THREE.DodecahedronGeometry(1, 1),
        burlap,
        -1.45 - i * 0.37,
        0.162,
        -0.47 - i * 0.08,
      );
      sack.scale.set(0.41, 0.16, 0.26);
      sack.rotation.y = i * 0.7;
    }
    for (let i = 0; i < 20; i++) {
      const a = i * 2.4,
        r = 0.1 + (0.42 * ((i * 11) % 19)) / 19;
      const grain = part(
        new THREE.OctahedronGeometry(0.022),
        ochre,
        -0.97 + Math.sin(a) * r,
        0.032,
        -0.26 + Math.cos(a) * r,
      );
      grain.scale.set(1, 0.65, 1.55);
    }
    const heraldry = fortStandard();
    p.disposable.push(heraldry);
    const flagMat = new THREE.MeshStandardMaterial({
      map: heraldry,
      color: 0xffffff,
      side: THREE.DoubleSide,
      roughness: 0.96,
    });
    p.disposable.push(flagMat);
    const pole = cylinder(-2.88, 1.47, -1.38, 0.022, 0.035, 2.94);
    part(new THREE.ConeGeometry(0.076, 0.23, 5), metal, pole.position.x, 3.02, pole.position.z);
    const banner = new THREE.PlaneGeometry(1.06, 1.41, 9, 12);
    banner.translate(0.53, -0.705, 0);
    p.banner = part(banner, flagMat, -2.87, 2.83, -1.38);
    p.flagRest = banner.attributes.position.array.slice();
  }
}

function beginRoleOpening() {
  if (!game || !world || prologue) return;
  const script = roleOvertures[game.side],
    group = new THREE.Group(),
    c = new THREE.PerspectiveCamera(46, world.camera.aspect, 0.055, 430);
  const p = {
    kind: 'role',
    side: game.side,
    script,
    group,
    camera: c,
    shot: -1,
    elapsed: 0,
    time: 0,
    paused: false,
    cast: new Map(),
    disposable: [],
    cos: Math.cos(script.yaw),
    sin: Math.sin(script.yaw),
    eye: new THREE.Vector3(),
    aim: new THREE.Vector3(),
  };
  prologue = p;
  keys.clear();
  waitForCountryHour(game, script.hour);
  world.lod(game.x, game.z);
  world.display(game, 0, 0, 0, null);
  world.groupRoleHidden = [];
  for (const actor of world.actors.values())
    if (actor.visible) {
      world.groupRoleHidden.push(actor);
      actor.visible = false;
      actor.userData.groundShadow.visible = false;
    }
  world.hideHands();
  if (world.fieldHero) world.fieldHero.visible = false;
  world.marker.visible = false;
  world.scene.add(group);
  group.add(c);
  const squad = game.actors.filter((a) => a.tag === 'squad');
  for (const [id, kind, tag, x, z, yaw, unarmed, size = 1] of script.cast) {
    const soldier = ['bearer', 'file', 'rear'].indexOf(id);
    const source =
      soldier >= 0 ? squad[soldier] : id === 'arda' ? game.actors.find((a) => a.tag === 'commander') : null;
    const person = world.person(kind, tag, unarmed, source || 'role/' + game.side + '/' + id);
    group.add(person);
    person.scale.multiplyScalar(size);
    rolePosition(p, x, 0, z, person.position);
    person.rotation.y = yaw + script.yaw;
    const shade = footShade();
    group.add(shade);
    shade.position.copy(person.position);
    shade.position.y += 0.022;
    shade.scale.set(size * 0.84, 1, size);
    const face = [];
    if (script.shots.some((shot) => shot.who === id)) {
      for (const mesh of person.children) {
        if (!mesh.isSkinnedMesh || !/^(MI_Superhero|MI_Regular|MI_Hair|MI_Eyes)/.test(mesh.name)) continue;
        const geometry = mesh.geometry.clone();
        shapeWitnessFace(
          geometry,
          mesh.name.replace('MI_Regular', 'MI_Superhero'),
          person.userData.actorStyle,
        );
        mesh.geometry = geometry;
        mesh.updateMorphTargets();
        face.push(mesh);
        p.disposable.push(geometry);
      }
    }
    p.cast.set(id, { person, shade, x, z, yaw, face, source });
  }
  stageRoleProps(p);
  const fill = new THREE.HemisphereLight(0xffede1, 0xcbad8a, 0.68);
  group.add(fill);
  const sideLight = new THREE.DirectionalLight(0xffebd3, 1.02);
  rolePosition(p, 2.1, 5.7, 5.0, sideLight.position);
  rolePosition(p, 0, 1, 0, sideLight.target.position);
  group.add(sideLight, sideLight.target);
  if (document.pointerLockElement) {
    expectedUnlock = true;
    document.exitPointerLock();
  }
  const overlay = $('opening'),
    title = $('opening-title');
  p.oldTitle = [
    title.querySelector('small').textContent,
    title.querySelector('h2').textContent,
    overlay.getAttribute('aria-label'),
  ];
  title.querySelector('small').textContent = script.place;
  title.querySelector('h2').textContent = script.title;
  overlay.setAttribute('aria-label', script.title);
  $('play').classList.add('in-prologue');
  overlay.hidden = false;
  overlay.classList.remove('held', 'departing', 'at-choice');
  $('opening-choice').hidden = true;
  const next = document.createElement('button');
  next.type = 'button';
  next.id = 'role-next';
  next.textContent = 'Далее';
  next.onclick = advanceRoleShot;
  $('opening-skip').before(next);
  p.next = next;
  $('opening-pause').hidden = false;
  $('opening-pause').textContent = 'Пауза';
  $('opening-pause').setAttribute('aria-pressed', 'false');
  $('opening-pause').onclick = pauseRoleOpening;
  $('opening-skip').hidden = false;
  $('opening-skip').onclick = () => endRoleOpening(true);
  startRoleShot(0);
}

function startRoleShot(index) {
  const p = prologue,
    shot = p.script.shots[index];
  p.shot = index;
  p.elapsed = 0;
  resetOpeningVoiceClock(p);
  p.paused = false;
  $('opening').classList.remove('held');
  $('opening-pause').textContent = 'Пауза';
  $('opening-pause').setAttribute('aria-pressed', 'false');
  const row = roleSpeech[shot.line];
  p.length = shot.seconds || row[3] + 0.66;
  $('opening-title').hidden = !!row;
  $('opening-caption').hidden = !row;
  $('opening-speaker').textContent = row?.[0] || '';
  $('opening-words').textContent = row?.[1] || '';
  p.next.textContent = index === p.script.shots.length - 1 ? 'Вступить в игру' : 'Далее';
  if (row) realmVoice.play(row[0], row[1]);
  else realmVoice.stop();
}
function advanceRoleShot() {
  const p = prologue;
  if (p?.kind !== 'role') return;
  if (p.shot + 1 >= p.script.shots.length) return endRoleOpening(true);
  startRoleShot(p.shot + 1);
}
function pauseRoleOpening() {
  const p = prologue;
  if (p?.kind !== 'role') return;
  p.paused = !p.paused;
  $('opening').classList.toggle('held', p.paused);
  $('opening-pause').textContent = p.paused ? 'Продолжить' : 'Пауза';
  $('opening-pause').setAttribute('aria-pressed', String(p.paused));
  holdOpeningVoice(p);
}
function drawRoleOpening(dt) {
  const p = prologue;
  if (!p.paused) {
    p.elapsed += dt;
    p.time += dt;
  }
  const currentRow = roleSpeech[p.script.shots[p.shot].line];
  if (openingCanCut(p, p.length, currentRow?.[0], currentRow?.[1])) {
    advanceRoleShot();
    if (!prologue) return;
  }
  const shot = p.script.shots[p.shot],
    t = p.time,
    u = THREE.MathUtils.smootherstep(p.elapsed, 0, p.length);
  for (const [id, figure] of p.cast) {
    const { person, shade, x, z, yaw } = figure;
    let px = x,
      pz = z,
      state = shot.who === id ? 'talk' : 'watch',
      angle = yaw;
    if (p.side === 0 && (id === 'child' || id === 'runner')) {
      const v = THREE.MathUtils.clamp((t - (id === 'child' ? 2.8 : 4.2)) / 7.0, 0, 1);
      px = x + v * 6.1;
      pz = z - v * 1.05;
      state = v > 0 && v < 1 ? 'run' : 'idle';
      angle = 1.74;
      person.visible = v < 1;
    }
    if (id === 'liora' && p.shot === 3) angle += 0.38 * u;
    if (id === 'bearer') state = 'armed';
    if (id === 'lord' && shot.who !== id) state = 'armed';
    rolePosition(p, px, 0, pz, person.position);
    person.rotation.y = angle + p.script.yaw;
    shade.visible = person.visible;
    shade.position.copy(person.position);
    shade.position.y += 0.024;
    poseCharacter(person, state, t + figure.x * 0.11, state === 'run' ? 0.84 : 1);
    const row = roleSpeech[shot.line],
      talking = id === shot.who && row && realmVoice.speaker === row[0] && realmVoice.active;
    const at = talking ? realmVoice.playhead * 25 : 0,
      syllable = talking ? roleMouth[shot.line] : '';
    const i = Math.floor(at),
      mouth = syllable[i]
        ? (syllable.charCodeAt(i) -
            65 +
            (syllable[i + 1] ? (syllable.charCodeAt(i + 1) - syllable.charCodeAt(i)) * (at - i) : 0)) /
          25
        : 0;
    const blink = (t + figure.x + 6) % 3.84;
    for (const mesh of figure.face) {
      mesh.morphTargetInfluences[0] = mouth;
      mesh.morphTargetInfluences[1] = blink < 0.16 ? Math.sin((blink * Math.PI) / 0.16) ** 2 : 0;
    }
  }
  if (p.lamp) {
    const lift = p.shot < 1 ? 0 : p.shot > 1 ? 1 : THREE.MathUtils.smootherstep(p.elapsed, 1.0, 2.6);
    const mara = p.cast.get('mara').person,
      hand = mara.userData.skeleton.getBoneByName('hand_r');
    p.lampHand ??= new THREE.Vector3();
    hand.getWorldPosition(p.lampHand);
    p.lamp.parent.worldToLocal(p.lampHand);
    p.lamp.position.set(-1.76, 0.89, -0.2).lerp(p.lampHand, lift);
    p.lamp.position.y -= 0.34 * lift;
    p.lamp.position.y += Math.sin(Math.PI * lift) * 0.13;
  }
  if (p.banner) {
    const a = p.banner.geometry.attributes.position.array,
      r = p.flagRest,
      lift = p.shot < 2 ? 0.24 : p.shot === 2 ? 0.24 + 0.76 * u : 1;
    for (let i = 0; i < a.length; i += 3) {
      const x = r[i],
        y = r[i + 1];
      a[i] = x * (0.53 + 0.47 * lift);
      a[i + 1] = y * lift - 0.06 * x * x;
      a[i + 2] = x * (0.13 * Math.sin(7 * x - 4 * t + y) + 0.05 * Math.sin(12 * x + 3 * t));
    }
    p.banner.geometry.attributes.position.needsUpdate = true;
  }
  const c = p.camera;
  c.aspect = world.camera.aspect;
  rolePosition(p, ...shot.eye.map((v, i) => THREE.MathUtils.lerp(v, shot.to[i], u)), p.eye);
  rolePosition(p, ...shot.aim, p.aim);
  c.position.copy(p.eye);
  c.lookAt(p.aim);
  c.fov = shot.lens;
  c.updateProjectionMatrix();
  world.skyMesh.position.copy(c.position);
  world.renderer.render(world.scene, c);
}
function endRoleOpening(enterWorld) {
  const p = prologue;
  if (p?.kind !== 'role') return;
  world.scene.remove(p.group);
  for (const f of p.cast.values()) releaseCharacter(f.person);
  for (const obj of p.disposable) obj.dispose();
  for (const m of world.groupRoleHidden || []) m.visible = true;
  world.groupRoleHidden = null;
  p.next.remove();
  const title = $('opening-title');
  title.querySelector('small').textContent = p.oldTitle[0];
  title.querySelector('h2').textContent = p.oldTitle[1];
  $('opening').setAttribute('aria-label', p.oldTitle[2]);
  $('opening').hidden = true;
  $('opening').classList.remove('held');
  $('play').classList.remove('in-prologue');
  realmVoice.stop();
  prologue = null;
  if (!enterWorld) return;
  const g = game,
    s = p.script;
  if (p.side === 1) {
    const captain = g.actors.find((a) => a.tag === 'commander');
    Object.assign(g, clearSpot(captain.x - 0.9, captain.z + 2.45, g));
  } else if (p.side === 2) {
    Object.assign(g, clearSpot(s.at[0] + 0.86, s.at[1] + 0.16, g));
    for (const f of p.cast.values())
      if (f.source?.tag === 'squad') {
        const at = rolePosition(p, f.x, 0, f.z, p.eye);
        Object.assign(f.source, clearSpot(at.x, at.z, f.source));
        f.source.angle = f.yaw + s.yaw;
      }
  }
  const goalTarget = goal().target;
  if (goalTarget) g.yaw = Math.atan2(wrapped(g.x - goalTarget.x), wrapped(g.z - goalTarget.z));
  g.pitch = -0.035;
  g.story.started = true;
  g.journalTab = 'story';
  g.story.entries.push([s.title, s.entries[0]]);
  g.air = g.vy = 0;
  keys.clear();
  world.refreshFrame = true;
  world.lod(g.x, g.z);
  drawHud();
  chapter(s.title, s.place);
  notify(s.entries[1] + (p.side === 2 ? ' · Q' : p.side === 1 ? ' · E' : ''), 5);
  checkpoint();
  capture();
}
