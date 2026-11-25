'use strict';

// The opening is blocked on the same quay, in the same coordinates, as the playable ferry.
let prologue = null;
const quayShots = [
  {
    seconds: 4.6,
    eye: [
      [17, 12, 49],
      [24, 8.8, 42],
    ],
    aim: [
      [-13, 8, -30],
      [45, 2, 25],
    ],
    lens: 44,
  },
  {
    seconds: 6.2,
    line: 0,
    eye: [
      [40.1, 2.47, 31.8],
      [42.5, 2.4, 30.3],
    ],
    aim: [
      [46, 2.17, 26.1],
      [46.8, 2.29, 26.3],
    ],
    lens: 38,
  },
  {
    seconds: 6.1,
    line: 1,
    eye: [
      [46.4, 2.74, 27.82],
      [45.88, 2.67, 27.54],
    ],
    aim: [
      [45.14, 2.59, 25.96],
      [45.04, 2.49, 26.02],
    ],
    lens: 34,
  },
  {
    seconds: 5.0,
    line: 2,
    eye: [
      [45.26, 3.04, 25.14],
      [45.69, 3.08, 25.1],
    ],
    aim: [
      [47.35, 3.24, 26.34],
      [47.35, 3.23, 26.31],
    ],
    lens: 33,
  },
  {
    seconds: 8.2,
    line: 3,
    eye: [
      [47.0, 3.05, 27.94],
      [47.74, 2.88, 28.97],
    ],
    aim: [
      [45.14, 2.51, 25.98],
      [45.69, 2.48, 25.91],
    ],
    lens: 34,
  },
  {
    seconds: Infinity,
    eye: [
      [49.3, 3.38, 28],
      [49.52, 3.35, 27.94],
    ],
    aim: [
      [45.93, 2.25, 26.05],
      [45.93, 2.25, 26.05],
    ],
    lens: 43,
  },
];
function ferryBell(gain = 1) {
  if (!soundOn) return;
  for (const [hz, life, volume] of [
    [123, 3.7, 0.13],
    [247, 2.85, 0.09],
    [293, 2.65, 0.057],
    [505, 1.85, 0.056],
    [673, 1.04, 0.025],
    [987, 0.47, 0.014],
  ]) {
    resonantFoley(hz, life, volume * gain, hz * 0.998, 0, -0.27);
    resonantFoley(hz * 1.003, life * 0.82, volume * 0.27 * gain, hz, 0.24, 0.45);
  }
}
function wetTally() {
  const group = new THREE.Group(),
    brass = new THREE.MeshStandardMaterial({
      color: 0xc38e51,
      roughness: 0.36,
      metalness: 0.67,
    });
  const profile = new THREE.Shape();
  profile.moveTo(-0.046, -0.073);
  profile.lineTo(0.046, -0.073);
  profile.lineTo(0.046, 0.044);
  profile.lineTo(0.018, 0.073);
  profile.lineTo(-0.027, 0.073);
  profile.lineTo(-0.046, 0.049);
  profile.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0.046, 0.009, 0, Math.PI * 2, true);
  profile.holes.push(hole);
  const tag = new THREE.Mesh(
    new THREE.ExtrudeGeometry(profile, {
      depth: 0.007,
      bevelThickness: 0.0018,
      bevelSize: 0.0016,
      bevelSegments: 2,
      steps: 1,
    }),
    brass,
  );
  const cord = new THREE.Mesh(
    new THREE.TorusGeometry(0.029, 0.0028, 6, 30),
    new THREE.MeshStandardMaterial({ color: 0x493421, roughness: 0.94 }),
  );
  cord.position.y = 0.072;
  group.add(tag, cord);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const q = c.getContext('2d');
  q.textAlign = 'center';
  q.fillStyle = '#392c24';
  q.font = 'bold 61px Georgia';
  q.fillText('36', 64, 88);
  q.fillRect(32, 99, 64, 2);
  const stamp = new THREE.CanvasTexture(c);
  stamp.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.086, 0.086),
    new THREE.MeshBasicMaterial({
      map: stamp,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  mark.position.set(0, -0.014, 0.01);
  group.add(mark);
  return group;
}
function beginPrologue() {
  const v = ensureMarchView(world),
    group = new THREE.Group(),
    camera = new THREE.PerspectiveCamera(45, 1, 0.035, 780);
  const vera = world.person('witness', 'vera', true),
    savva = world.person('witness', 'savva', true);
  group.add(vera, savva, camera);
  const tally = wetTally(),
    rope = quayLine();
  group.add(tally, rope);
  dressQuay(v);
  const lamp = new THREE.PointLight(0xffca98, 2.1, 8, 2);
  lamp.position.set(46, 2.9, 26.8);
  group.add(lamp);
  const fill = new THREE.HemisphereLight(0xdde6ed, 0x776a5b, 0.55);
  group.add(fill);
  v.scene.add(group);
  const boat = v.ferryBoat;
  boat.userData.directed = true;
  prologue = {
    v,
    group,
    camera,
    vera,
    savva,
    tally,
    rope,
    ropeStart: new THREE.Vector3(),
    ropeEnd: new THREE.Vector3(),
    boat,
    boatOrigin: boat.position.clone(),
    boatYaw: boat.rotation.y,
    shot: -1,
    elapsed: 0,
    time: 0,
    paused: false,
    choice: null,
    aim: new THREE.Vector3(),
    eye: new THREE.Vector3(),
  };
  game.frontierStart = true;
  game.march = { x: 48.66, z: 26.3 };
  world.hideHands();
  if (v.hero) v.hero.visible = false;
  if (world.camera.parent === v.scene) v.scene.remove(world.camera);
  waitForCountryHour(game, 6.25);
  keys.clear();
  if (document.pointerLockElement) {
    expectedUnlock = true;
    document.exitPointerLock();
  }
  $('play').classList.add('in-prologue');
  $('opening').hidden = false;
  $('opening').classList.remove('at-choice', 'held', 'departing');
  $('opening-choice').hidden = true;
  $('opening-pause').textContent = 'Пауза';
  $('opening-pause').setAttribute('aria-pressed', 'false');
  $('opening-pause').onclick = pausePrologue;
  $('opening-skip').onclick = offerLanding;
  for (const b of document.querySelectorAll('[data-landing]'))
    b.onclick = () => landFromPrologue(b.dataset.landing);
  nextQuayShot(0);
  ferryBell(0.78);
}
function nextQuayShot(index) {
  const p = prologue,
    s = quayShots[index];
  p.shot = index;
  p.elapsed = 0;
  resetOpeningVoiceClock(p);
  const line = OATH_INTRO_LINES[s.line];
  $('opening-words').textContent = line?.text || '';
  $('opening-speaker').textContent = line?.speaker || '';
  $('opening-caption').hidden = !line;
  $('opening-title').hidden = index !== 0;
  if (line) oathSpeak(line.id);
  if (index === 3) ferryBell(0.42);
  if (index === quayShots.length - 1) {
    $('opening').classList.add('at-choice');
    $('opening-choice').hidden = false;
    $('opening-skip').hidden = true;
    $('opening-pause').hidden = true;
    $('opening-choice').querySelector('button').focus({ preventScroll: true });
  } else {
    $('opening-skip').hidden = false;
    $('opening-pause').hidden = false;
  }
}
function offerLanding() {
  if (prologue?.kind === 'role') return endRoleOpening(true);
  if (!prologue || prologue.choice || prologue.shot === quayShots.length - 1) return;
  prologue.paused = false;
  realmVoice.stop();
  $('opening').classList.remove('held');
  nextQuayShot(quayShots.length - 1);
}
function pausePrologue() {
  if (prologue?.kind === 'role') return pauseRoleOpening();
  const p = prologue;
  if (!p || p.choice || p.shot === quayShots.length - 1) return;
  p.paused = !p.paused;
  $('opening').classList.toggle('held', p.paused);
  $('opening-pause').textContent = p.paused ? 'Продолжить' : 'Пауза';
  $('opening-pause').setAttribute('aria-pressed', String(p.paused));
  holdOpeningVoice(p);
}
function resetOpeningVoiceClock(p) {
  p.voicePlayhead = -1;
  p.voiceHeartbeat = performance.now();
}
function holdOpeningVoice(p) {
  if (p.paused) realmVoice.pause();
  else {
    p.voiceHeartbeat = performance.now();
    realmVoice.resume();
  }
}
function openingCanCut(p, duration, speaker, text) {
  if (p.paused) return false;
  const voiced = speaker && realmVoice.active && realmVoice.speaker === speaker && realmVoice.words === text;
  if (voiced && realmVoice.playhead > p.voicePlayhead + 0.012) {
    p.voicePlayhead = realmVoice.playhead;
    p.voiceHeartbeat = performance.now();
  }
  if (p.elapsed < duration) return false;
  if (!voiced) return true;
  // Loading and decoding can outlast the planned camera movement. Give a stalled audio stream
  // twelve seconds since its last real progress; a line that keeps playing always reaches its end.
  if (performance.now() - p.voiceHeartbeat < 12000) return false;
  realmVoice.stop();
  return true;
}
function landFromPrologue(choice) {
  const p = prologue;
  if (!p || p.choice) return;
  p.choice = choice;
  p.elapsed = 0;
  p.exitEye = p.camera.position.clone();
  p.exitRotation = p.camera.quaternion.clone();
  p.exitLens = p.camera.fov;
  oathPrologueChoice(choice);
  realmVoice.stop();
  $('opening-choice').hidden = true;
  $('opening').classList.add('departing');
}
function endPrologue(enterWorld) {
  if (prologue?.kind === 'role') return endRoleOpening(enterWorld);
  const p = prologue;
  if (!p) return;
  p.v.scene.remove(p.group);
  p.boat.position.copy(p.boatOrigin);
  p.boat.rotation.y = p.boatYaw;
  p.boat.userData.directed = false;
  releaseCharacter(p.vera);
  releaseCharacter(p.savva);
  p.rope.geometry.dispose();
  p.rope.material.dispose();
  p.tally.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
  prologue = null;
  realmVoice.stop();
  $('opening').hidden = true;
  $('play').classList.remove('in-prologue');
  if (enterWorld) {
    game.yaw = -Math.PI / 2;
    game.pitch = -0.035;
    game.air = game.vy = 0;
    game.journalTab = 'oath';
    keys.clear();
    drawHud();
    checkpoint();
    chapter('Колокол подо льдом', 'Озёрная марка');
    notify('J · Дневник     M · Карта долины', 4);
    capture();
  }
}
function sampleShot(points, u, out) {
  return out.set(...points[0]).lerp(new THREE.Vector3(...points[1]), u);
}
function drawPrologue(dt) {
  if (prologue?.kind === 'role') return drawRoleOpening(dt);
  const p = prologue;
  if (!p.paused) {
    p.elapsed += dt;
    p.time += dt;
  }
  let s = quayShots[p.shot];
  const line = OATH_INTRO_LINES[s.line];
  if (!p.choice && openingCanCut(p, s.seconds, line?.speaker, line?.text)) {
    nextQuayShot(p.shot + 1);
    s = quayShots[p.shot];
  }
  const t = p.time,
    tide = 0.021 * Math.sin(t * 0.91),
    approach = 1 - THREE.MathUtils.smootherstep(t, 0, 12);
  const bx = 45 - 5.5 * approach;
  p.boat.position.x = p.boatOrigin.x - 5.5 * approach;
  p.boat.position.y = p.boatOrigin.y + tide;
  p.boat.rotation.y = p.boatYaw + 0.014 * Math.sin(t * 0.31);
  p.vera.position.set(bx + 0.05, 1.19 + tide, 25.94);
  p.vera.rotation.y = 1.26 + 0.11 * Math.sin(t * 0.38);
  p.savva.position.set(47.35, 1.75, 26.32);
  p.savva.rotation.y = -1.7 + 0.06 * Math.sin(t * 0.23);
  const fore = p.vera.userData.skeleton.getBoneByName('lowerarm_l');
  if (p.armBase) fore.quaternion.copy(p.armBase);
  poseCharacter(p.vera, [2, 4].includes(p.shot) ? 'talk' : 'idle', t, 0.88);
  poseCharacter(p.savva, [1, 3].includes(p.shot) ? 'talk' : 'idle', t, 0.93);
  const fingers = p.vera.userData.skeleton.getBoneByName('hand_l');
  const lift = p.shot === 2 ? 0.82 : p.shot === 4 ? 0.5 : 0.1;
  p.armBase = fore.quaternion.clone();
  fore.rotateX(-0.52 * lift);
  fingers.getWorldPosition(p.tally.position);
  p.tally.position.y -= 0.086;
  p.tally.rotation.set(0, 0.5 + 0.18 * Math.sin(t * 1.6), 0.12 * Math.cos(t * 1.5));
  p.tally.scale.setScalar(1.36);
  const hand = p.savva.userData.skeleton.getBoneByName('hand_r');
  hand.getWorldPosition(p.ropeEnd);
  p.ropeStart.set(bx + 0.91, 1.33 + tide, 26.29);
  p.rope.userData.update(p.ropeStart, p.ropeEnd, t);
  const c = p.camera;
  c.aspect = world.camera.aspect;
  if (p.choice) {
    const u = THREE.MathUtils.smootherstep(p.elapsed, 0, 1.1);
    c.position
      .copy(p.exitEye)
      .lerp(p.eye.set(game.march.x, marchFloor(game.march.x, game.march.z) + 1.71, game.march.z), u);
    c.quaternion
      .copy(p.exitRotation)
      .slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.035, -Math.PI / 2, 0, 'YXZ')), u);
    c.fov = THREE.MathUtils.lerp(p.exitLens, 68, u);
    if (p.elapsed >= 1.1) {
      endPrologue(true);
      return;
    }
  } else {
    const u = THREE.MathUtils.smootherstep(p.elapsed, 0, Number.isFinite(s.seconds) ? s.seconds : 14);
    sampleShot(s.eye, u, p.eye);
    sampleShot(s.aim, u, p.aim);
    if (p.shot === 1) p.aim.x -= approach * 2;
    // A cut-in follows the swinging tally in Vera's fingers on the word «клеймо».
    if (p.shot === 2 && p.elapsed > 2.15 && p.elapsed < 4.65) {
      p.aim.copy(p.tally.position);
      p.eye.copy(p.aim).add(new THREE.Vector3(0.13, 0.039, 0.36));
      c.position.copy(p.eye);
      c.lookAt(p.aim);
      c.fov = 36;
    } else {
      c.position.copy(p.eye);
      c.lookAt(p.aim);
      c.fov = s.lens;
    }
  }
  c.updateProjectionMatrix();
  renderMarchCamera(world, c, t);
}

function campWait() {
  if (
    game.bleed > 0 ||
    (!game.march &&
      !game.inside &&
      game.actors.some((a) => a.hp > 0 && a.team === 'hostile' && distance(game, a) < 12)) ||
    (game.dungeon && dungeonState().foes.some((a) => a.hp > 0 && a.alert > 0)) ||
    (game.march && game.marchFauna?.some((a) => a.hp > 0 && a.engaged))
  ) {
    $('wait-country').textContent = game.bleed > 0 ? 'Сначала перевяжите рану' : 'Рядом противник';
    return;
  }
  modal(
    'Привал',
    'Время в пути',
    '<p>Выберите час, в который продолжите путь.</p>' +
      actions(
        [
          [6, 'Рассвет · 06:00'],
          [12, 'Полдень · 12:00'],
          [18, 'Вечер · 18:00'],
          [23, 'Ночь · 23:00'],
        ].map(([h, s]) => ['wait-' + h, s]),
      ),
  );
  for (const h of [6, 12, 18, 23])
    $('wait-' + h).onclick = () => {
      waitForCountryHour(game, h);
      game.stamina = 100;
      closeModal();
      drawHud();
      notify(countryAlmanac(game).time + ' · ' + countryAlmanac(game).name);
      capture();
    };
}

// Twisted hemp sags between the hand and the cleat as the hull drifts alongside.
function quayLine() {
  const rings = 35,
    sides = 8,
    geo = new THREE.BufferGeometry();
  const points = new Float32Array(rings * sides * 3),
    uv = [],
    indices = [];
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      uv.push(i / (rings - 1), j / sides);
      if (!i) continue;
      const a = (i - 1) * sides + j,
        b = (i - 1) * sides + ((j + 1) % sides);
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  geo.setAttribute('position', new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  const mat = new THREE.MeshStandardMaterial({ color: 0x96724b, roughness: 0.96 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.update = (start, end, t) => {
    const dx = end.x - start.x,
      dz = end.z - start.z,
      len = Math.max(0.001, Math.hypot(dx, dz)),
      sx = -dz / len,
      sz = dx / len;
    const slack = Math.min(0.47, len * 0.105);
    for (let i = 0; i < rings; i++) {
      const v = i / (rings - 1);
      const y = start.y + (end.y - start.y) * v - Math.sin(v * Math.PI) * slack;
      for (let j = 0; j < sides; j++) {
        const a = (j * 2 * Math.PI) / sides,
          r = 0.012 * (1 + 0.12 * Math.cos(a * 3 + v * 65));
        const k = (i * sides + j) * 3;
        points[k] = start.x + dx * v + sx * Math.cos(a) * r;
        points[k + 1] = y + r * Math.sin(a);
        points[k + 2] =
          start.z + dz * v + sz * Math.cos(a) * r + 0.015 * Math.sin(Math.PI * v) * Math.cos(t * 0.7);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return mesh;
}
function dressQuay(view) {
  if (view.quayProps) return view.quayProps;
  const dock = new THREE.Group();
  view.scene.add(dock);
  const iron = new THREE.MeshStandardMaterial({ color: 0x434544, metalness: 0.55, roughness: 0.55 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x947148, metalness: 0.6, roughness: 0.48 });
  const ember = new THREE.MeshStandardMaterial({
    color: 0xffc587,
    emissive: 0xffa14c,
    emissiveIntensity: 1.7,
    roughness: 0.38,
  });
  const hemp = new THREE.MeshStandardMaterial({ color: 0x8c7556, roughness: 0.95 });
  const put = (g, m, x, y, z) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    dock.add(o);
    return o;
  };
  const x = 47.53,
    z = 25.04,
    base = 1.77;
  put(new THREE.CylinderGeometry(0.13, 0.145, 0.057, 8), iron, x, base + 0.027, z);
  put(new THREE.CylinderGeometry(0.075, 0.111, 0.195, 8), ember, x, base + 0.15, z);
  put(new THREE.ConeGeometry(0.15, 0.104, 8), bronze, x, base + 0.302, z);
  for (let j = 0; j < 6; j++) {
    const a = (j * Math.PI) / 3;
    put(
      new THREE.CylinderGeometry(0.009, 0.009, 0.26, 5),
      iron,
      x + Math.sin(a) * 0.11,
      base + 0.162,
      z + Math.cos(a) * 0.11,
    );
  }
  put(new THREE.TorusGeometry(0.075, 0.008, 6, 20), iron, x, base + 0.378, z);
  for (let j = 0; j < 8; j++) {
    const ring = put(
      new THREE.TorusGeometry(0.115 + 0.017 * j, 0.012, 6, 45),
      hemp,
      48.18 + j * 0.015,
      1.765 + 0.006 * j,
      25.4,
    );
    ring.rotation.x = Math.PI / 2 + 0.04 * Math.sin(j);
    ring.scale.y = 0.8;
    ring.rotation.z = 0.16 * j;
  }
  const light = new THREE.PointLight(0xffa252, 1.65, 4.3, 2);
  light.position.set(x, base + 0.24, z);
  dock.add(light);
  return (view.quayProps = dock);
}
