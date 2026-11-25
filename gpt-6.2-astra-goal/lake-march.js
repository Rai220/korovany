'use strict';

const marchEntrance = { x: -96, z: -25, title: 'Проход в Озёрную марку' };
const marchSites = {
  mouth: { x: 0, z: 178, title: 'Устье марки' },
  station: { x: -52, z: 96, title: 'Сигнальная станция' },
  aqueduct: { x: -55, z: 5, title: 'Западный затвор' },
  chapel: { x: -77, z: -82, title: 'Часовня перевозчиков' },
  ferry: { x: 62, z: 26, title: 'Сгоревшая переправа' },
  quarry: { x: 78, z: -68, title: 'Каменоломня' },
  belfry: { x: 14, z: -138, title: 'Верхняя звонница' },
};
// Each surveyed station has a ground elevation in metres. Both bridges continue a public path.
const marchRoads = [
  [
    [0, 187, 13],
    [0, 178, 12],
    [-7, 153, 10],
    [-20, 134, 9],
    [-31, 119, 11],
    [-52, 96, 13],
  ],
  [
    [-52, 96, 13],
    [-49, 99, 13],
    [-47, 95, 13],
    [-47, 80, 12],
    [-64, 79, 11],
    [-62, 56, 7],
    [-72, 38, 9],
    [-65, 19, 10],
    [-55, 5, 8.4],
  ],
  [
    [-55, 5, 8.4],
    [-67, -13, 10],
    [-64, -40, 8],
    [-78, -62, 11],
    [-77, -82, 10],
  ],
  [
    [-77, -82, 10],
    [-77, -76.5, 10],
    [-70, -75, 10],
    [-60, -98, 9],
    [-41, -111, 11],
    [-24, -124, 13],
    [-4, -127, 15],
    [14, -138, 18],
  ],
  [
    [-20, 134, 9],
    [2, 134, 5],
    [14, 134, 3.8],
    [38, 134, 3.8],
    [49, 132, 5],
    [71, 108, 9],
    [83, 85, 10],
    [68, 63, 7],
    [69, 43, 6],
    [62, 26, 5],
  ],
  [
    [62, 26, 5],
    [62, 5, 8.4],
  ],
  [
    [-55, 5, 8.4],
    [62, 5, 8.4],
  ],
  [
    [62, 5, 8.4],
    [74, -14, 10],
    [71, -35, 8],
    [85, -52, 12],
    [78, -68, 14],
  ],
  [
    [78, -68, 14],
    [82, -86, 15],
    [67, -108, 18],
    [41, -121, 17],
    [14, -138, 18],
  ],
  [
    [-77, -82, 10],
    [-77, -76.5, 10],
    [-70, -75, 10],
    [-57, -86, 6],
    [-40, -92, 3],
    [-21, -94, 0.67],
    [-6, -91, 0.49],
    [8, -94, 0.42],
    [25, -92, 0.62],
    [40, -88, 2.5],
    [57, -83, 7],
    [78, -68, 14],
  ],
  [
    [-52, 96, 13],
    [-88, 103, 19],
    [-108, 85, 26],
    [-119, 62, 29],
    [-105, 35, 24],
    [-87, 22, 17],
    [-55, 5, 8.4],
  ],
  [
    [78, -68, 14],
    [102, -66, 19],
    [122, -84, 26],
    [117, -115, 31],
    [91, -138, 29],
    [61, -151, 24],
    [34, -151, 21],
    [14, -138, 18],
  ],
];
const marchSteps = marchRoads.flatMap((road) =>
  road.slice(1).map((b, i) => {
    const a = road[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    return { a, b, dx, dz, len: dx * dx + dz * dz };
  }),
);
const marchEase = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const marchWater = 0.81;
function marchPath(x, z) {
  let d2 = Infinity,
    elevation = 0;
  for (const { a, b, dx, dz, len } of marchSteps) {
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len));
    const u = x - a[0] - t * dx,
      v = z - a[1] - t * dz,
      dd = u * u + v * v;
    if (dd < d2) {
      d2 = dd;
      elevation = a[2] + t * (b[2] - a[2]);
    }
  }
  return { d: Math.sqrt(d2), y: elevation };
}
function marchStream(z) {
  return 21 + 6 * Math.sin((z - 95) * 0.045) + 2 * Math.sin(z * 0.133);
}
function marchShore(x, z) {
  const u = (z + 12) / 111,
    center = 4 + 5 * Math.sin(z * 0.034) + 3 * Math.sin(z * 0.079);
  const v = (x - center) / (50 + 4 * Math.cos(z * 0.041));
  return (Math.hypot(v, u) - 1) * 48 + 1.7 * Math.sin(0.12 * x + 0.052 * z);
}
function marchSurvey(x, z) {
  const u = Math.max(0, Math.min(287.9, x)),
    v = Math.max(0, Math.min(287.9, z));
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * 289 + i;
  return (
    ((1 - b) * ((1 - a) * alpineFloor[k] + a * alpineFloor[k + 1]) +
      b * ((1 - a) * alpineFloor[k + 289] + a * alpineFloor[k + 290])) *
    0.25
  );
}
function marchRawGround(x, z) {
  const shore = marchShore(x, z);
  const waves =
    Math.sin(x * 0.066 + z * 0.031) * 1.9 +
    Math.sin(x * 0.041 - z * 0.069) * 1.25 +
    Math.sin(x * 0.128 + 0.3) * Math.sin(z * 0.091) * 0.65;
  const edge = Math.max(Math.abs(x) / 170, Math.abs(z - 2) / 207);
  const flank = (Math.abs(x) - 63) * 0.023;
  const fold =
    Math.max(0, 1 - Math.abs(x + 139 + 16 * Math.sin(z * 0.036)) * 0.035) *
    (18 + 13 * (1 - Math.abs(Math.sin(z * 0.038 + 0.4))));
  const spur =
    Math.max(0, 1 - Math.abs(x - 127 + 12 * Math.sin(z * 0.041)) * 0.051) *
    (24 + 20 * (1 - Math.abs(Math.sin(z * 0.035 - 0.8))));
  const northern =
    Math.max(0, 1 - Math.abs(z + 173 + 12 * Math.sin(x * 0.051)) * 0.061) *
    (14 + 12 * Math.sin(0.038 * x) ** 2);
  const west = x < 0,
    broad = marchEase(59, 104, Math.abs(x));
  const cross = 175 + (Math.abs(x) - 57) * 0.79 + 7 * Math.sin(z * 0.023),
    along = 218 + (west ? z : -z) * 0.39 + 9 * Math.sin(x * 0.032);
  const radar =
    marchSurvey(cross, along) + 0.45 * marchSurvey(218 + (west ? z : -z) * 0.34, 180 + Math.abs(x) * 0.45);
  const crag =
    marchEase(8, 33, radar) * (0.46 * Math.sin(x * 0.52 - z * 0.31) + 0.35 * Math.cos(z * 0.54 + x * 0.37));
  const bed = radar * 0.21 + x * 0.067 - z * 0.045,
    layer = bed - Math.floor(bed);
  const shelves = 0.6 * (marchEase(0.48, 0.93, layer) - layer);
  const hills =
    waves +
    Math.max(0, flank) * 3.8 +
    fold * 0.33 +
    spur * 0.31 +
    northern * 0.4 +
    broad * (radar * 1.22 + crag + shelves) +
    marchEase(0.79, 1.13, edge) * (21 + 5 * Math.sin(x * 0.051 - z * 0.032));
  let h = Math.max(-11, Math.min(11, shore * 0.35)) + hills * marchEase(-3, 20, shore);
  if (z > 60) {
    const channel = Math.abs(x - marchStream(z));
    h = Math.min(
      h,
      -2.9 + 0.5 * Math.sin(z * 0.13) + channel * 0.53 + marchEase(0, 27, channel) * Math.max(0, h),
    );
  }
  return h;
}
function marchOverWater(x, z) {
  return (Math.abs(z - 5) < 8 && x > -48 && x < 52) || (Math.abs(z - 134) < 5 && x > 14.5 && x < 37.5);
}
function marchGround(x, z, path = marchPath(x, z)) {
  const wild = marchRawGround(x, z);
  if (marchOverWater(x, z)) {
    // Preserve the void under the aqueduct and the river span. The deck is a separate walking surface.
    const lip = Math.abs(z - 5) < 8 ? Math.min(x + 48, 52 - x) : Math.min(x - 14.5, 37.5 - x);
    return wild + (path.y - wild) * (1 - marchEase(0, 4, lip)) * (1 - marchEase(1.8, 7, path.d));
  }
  const flatten = 1 - marchEase(2.0, 8.6, path.d);
  let h = wild + (path.y - wild) * flatten;
  // Level the apron inside occupied buildings as well as both sills.
  for (const [cx, cz, y, rx, rz] of marchPads) {
    if (Math.abs(x - cx) > rx + 5 || Math.abs(z - cz) > rz + 5) continue;
    const d = Math.max(0, Math.abs(x - cx) - rx, Math.abs(z - cz) - rz);
    h += (y - h) * (1 - marchEase(0, 4.5, d));
  }
  // The old landing hugs a dredged cut; its planks must stay above the bank along the gangway.
  if (x > 42 && x < 62 && Math.abs(z - 26) < 4.2) {
    const deck = 1.75 + 3.25 * marchEase(53, 62, x);
    h = Math.min(
      h,
      deck - 0.28 + (6.1 * marchEase(1.65, 4.2, Math.abs(z - 26)) + 0.28 * marchEase(61.25, 62, x)),
    );
  }
  return h;
}
const marchPads = [
  [-53, 95, 13, 9, 7],
  [-55, 5, 8.4, 4.3, 5],
  [62, 5, 8.4, 4, 4],
  [-77, -82, 10, 5.4, 8],
  [78, -68, 14, 7, 5],
  [14, -138, 18, 7.8, 7],
  [63, 26, 5, 4.3, 4.5],
  [0, 178, 12, 4, 3],
];
function marchDeck(x, z) {
  if (x >= 46 && x <= 62 && Math.abs(z - 26) < 1.35) return 1.75 + 3.25 * marchEase(53, 62, x);
  if (x >= -57 && x <= 64 && Math.abs(z - 5) < 1.88) return 8.4;
  if (x >= 13 && x <= 39 && Math.abs(z - 134) < 1.85) return 3.8;
  return null;
}
function marchFloor(x, z) {
  return marchDeck(x, z) ?? marchGround(x, z);
}
const marchSolids = [];
function marchWall(x, z, w, d) {
  marchSolids.push([x, z, w * 0.5, d * 0.5]);
}
function marchLocalFree(x, z, r = 0.34) {
  if (Math.abs(x) > 179 - r || Math.abs(z) > 218 - r || marchFloor(x, z) < marchWater - 0.49) return false;
  for (const [cx, cz, rx, rz] of marchSolids) {
    if (Math.hypot(Math.max(0, Math.abs(x - cx) - rx), Math.max(0, Math.abs(z - cz) - rz)) < r) return false;
  }
  if (typeof marchVegetationAt === 'function' && marchVegetationAt(x, z, r)) return false;
  return true;
}
function marchStepFree(x, z, nx, nz, r = 0.34) {
  if (!marchLocalFree(nx, nz, r)) return false;
  const delta = marchFloor(nx, nz) - marchFloor(x, z);
  return Math.abs(delta) < Math.hypot(nx - x, nz - z) * 1.28 + 0.08;
}
function marchMove(state, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.24)),
    sx = dx / steps,
    sz = dz / steps;
  const ox = state.x,
    oz = state.z;
  for (let j = 0; j < steps; j++) {
    const x = state.x,
      z = state.z;
    if (marchStepFree(x, z, x + sx, z + sz)) {
      state.x += sx;
      state.z += sz;
      continue;
    }
    if (sx && marchStepFree(x, z, x + sx, z)) state.x += sx;
    if (sz && marchStepFree(state.x, z, state.x, z + sz)) state.z += sz;
  }
  return Math.hypot(state.x - ox, state.z - oz);
}
function validMarchSave(g) {
  const s = g?.march,
    pack = g?.marchFauna;
  if (
    pack != null &&
    (!Array.isArray(pack) ||
      pack.length !== marchDens.length ||
      !pack.every(
        (a, i) =>
          a?.marchFoe === true &&
          a.id === i + 1 &&
          ['x', 'z', 'homeX', 'homeZ', 'hp', 'maxHp', 'yaw', 'wait', 'stagger', 'windup'].every((k) =>
            Number.isFinite(a[k]),
          ) &&
          a.hp >= 0 &&
          a.hp <= a.maxHp &&
          a.maxHp > 0 &&
          Math.abs(a.x) < 180 &&
          Math.abs(a.z) < 220,
      ))
  )
    return false;
  if (s == null) return true;
  const shot = s.shot;
  return (
    Number.isFinite(s.x) &&
    Number.isFinite(s.z) &&
    Math.abs(s.x) < 179 &&
    Math.abs(s.z) < 218 &&
    !g.dungeon &&
    !g.inside &&
    !g.delivery &&
    (s.mark == null || Object.hasOwn(marchSites, s.mark)) &&
    (shot == null || ['x', 'y', 'z', 'dx', 'dy', 'dz', 'life'].every((k) => Number.isFinite(shot[k])))
  );
}
function marchEnter() {
  if (game.march || game.delivery || game.inside || game.dungeon) return;
  game.march = { x: 0, z: 174.5 };
  game.yaw = 0.28;
  game.pitch = 0.025;
  game.air = game.vy = 0;
  game.arrow = null;
  world.refreshFrame = true;
  checkpoint();
  drawHud();
  scoreRefresh();
}
function marchLeave() {
  if (!game.march) return;
  game.march = null;
  Object.assign(game, clearSpot(marchEntrance.x + 1.7, marchEntrance.z, game));
  game.yaw = -Math.PI / 2;
  game.pitch = 0;
  game.arrow = null;
  game.air = game.vy = 0;
  if (world.camera.parent !== world.scene) world.scene.add(world.camera);
  world.refreshFrame = true;
  checkpoint();
  drawHud();
  scoreRefresh();
}
function marchAction() {
  if (!game.march)
    return Math.hypot(game.x - marchEntrance.x, game.z - marchEntrance.z) < 3.5
      ? { id: 'enter', label: 'По озёрной тропе · Озёрная марка' }
      : null;
  const p = game.march;
  for (const [id, site] of Object.entries(marchSites)) {
    if (Math.hypot(p.x - site.x, p.z - site.z) > 3.6) continue;
    if (id === 'mouth') return { id, label: 'Вернуться к Старой переправе' };
    const label = typeof marchQuestAction === 'function' ? marchQuestAction(id) : null;
    return { id, label: label || site.title + ' · осмотреть' };
  }
  return null;
}
function marchInteract() {
  const a = marchAction();
  if (!a) return;
  if (a.id === 'enter') {
    marchEnter();
    return;
  }
  if (a.id === 'mouth') {
    marchLeave();
    return;
  }
  if (
    typeof marchQuestUse === 'function' &&
    typeof marchQuestAction === 'function' &&
    marchQuestAction(a.id)
  ) {
    marchQuestUse(a.id);
    return;
  }
  const views = {
    station: 'На столе лежит журнал сигнальщика. Из окон видны оба берега.',
    aqueduct: 'Над каждым пролётом идут две каменные трубы. Здесь они сходятся у медной задвижки.',
    chapel: 'Под навесом сохнут сети. За дверью пахнет воском и озёрной водой.',
    ferry: 'На обугленных сваях уцелел один железный швартовочный крюк.',
    quarry: 'На лебёдке ещё висит корзина с белым плитняком.',
    belfry: 'Колокол висит под полом звонницы. В толще камня слышна вода.',
  };
  notify(views[a.id], 4);
}
function marchTick(dt) {
  const g = game,
    s = g.march,
    block = tickGuard(dt);
  g.riposteLeft = Math.max(0, (g.riposteLeft || 0) - dt);
  if (keys.has('ArrowLeft')) g.yaw += dt * 1.85;
  if (keys.has('ArrowRight')) g.yaw -= dt * 1.85;
  const forward =
    Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const len = Math.hypot(forward, strafe);
  if (g.stamina < 4) g.winded = true;
  if (g.stamina > 35) g.winded = false;
  const sprint =
    len > 0 &&
    !block &&
    !g.winded &&
    g.leg !== 'lost' &&
    g.leg !== 'chair' &&
    (keys.has('ShiftLeft') || keys.has('ShiftRight'));
  const speed = g.leg === 'lost' ? 1.25 : g.leg === 'chair' ? 3.4 : sprint ? 9 : block ? 2.8 : 5.4;
  g.stamina = clamp(g.stamina + dt * (sprint ? -6 : block ? 2.5 : 14), 0, 100);
  let travelled = 0;
  if (len)
    travelled = marchMove(
      s,
      ((Math.cos(g.yaw) * strafe - Math.sin(g.yaw) * forward) * dt * speed) / len,
      ((-Math.sin(g.yaw) * strafe - Math.cos(g.yaw) * forward) * dt * speed) / len,
    );
  if (g.evade > 0) marchMove(s, Math.sin(g.yaw) * dt * 11, Math.cos(g.yaw) * dt * 11);
  walking += travelled * 1.64;
  g.vy -= 18 * dt;
  g.air = Math.max(0, g.air + g.vy * dt);
  if (!g.air) g.vy = 0;
  swing = Math.max(0, swing - dt * (g.heavy ? 1.35 : 2));
  if (g.bleed) {
    g.health = Math.max(0, g.health - g.bleed * dt);
    if (!g.health) death();
  }
  marchHuntTick(dt);
  if (typeof oathTick === 'function') oathTick();
  if (gameTime > chapterUntil) $('chapter-toast').style.opacity = 0;
  soundscape(dt, !!travelled, sprint);
  if (gameTime > subtitleUntil && !realmVoice.active) $('subtitle').textContent = '';
  return travelled ? Math.sin(walking) * 0.035 : 0;
}
function marchMap() {
  const p = game.march,
    focus = navigationGoal().target;
  const positions = (point) => [184 + point.x, 224 + point.z];
  const paths = marchRoads
    .map((road) => {
      const points = road.map(([x, z]) => x + 184 + ',' + (z + 224)).join(' ');
      return '<polyline points="' + points + '"/>';
    })
    .join('');
  const signs = {
    mouth: '↗',
    station: '⌂',
    aqueduct: '≋',
    chapel: '✣',
    ferry: '⚓',
    quarry: '◇',
    belfry: '♢',
  };
  const pins = Object.entries(marchSites)
    .map(([id, site]) => {
      const [x, z] = positions(site),
        selected = focus === site,
        left = x > 238;
      return (
        '<g class="lake-pin' +
        (selected ? ' selected' : '') +
        '" tabindex="0" role="button" data-march-mark="' +
        id +
        '" aria-label="' +
        site.title +
        '"><title>' +
        site.title +
        '</title>' +
        '<circle cx="' +
        x +
        '" cy="' +
        z +
        '" r="5"/><text x="' +
        (x + (left ? -8 : 8)) +
        '" y="' +
        (z + 2.2) +
        '" text-anchor="' +
        (left ? 'end' : 'start') +
        '">' +
        site.title +
        '</text></g>'
      );
    })
    .join('');
  const waypoints = Object.entries(marchSites)
    .map(
      ([id, site]) =>
        '<button type="button" data-lake-list="' +
        id +
        '" aria-pressed="' +
        (focus === site) +
        '"><span aria-hidden="true">' +
        signs[id] +
        '</span>' +
        site.title +
        '</button>',
    )
    .join('');
  const [px, pz] = positions(p);
  return (
    '<div class="lake-atlas"><svg role="group" aria-label="Топографическая карта Озёрной марки" viewBox="0 0 368 448">' +
    '<image width="368" height="448" href="./assets/oath/lake-relief.webp"/>' +
    '<g class="lake-roads shadow">' +
    paths +
    '</g><g class="lake-roads">' +
    paths +
    '</g>' +
    '<text x="184" y="180" text-anchor="middle" class="lake-water-name" transform="rotate(-79 184 180)">ОЗЁРНАЯ МАРКА</text>' +
    oathMap() +
    pins +
    '<g transform="translate(' +
    px +
    ' ' +
    pz +
    ') rotate(' +
    (-game.yaw * 180) / Math.PI +
    ')"><circle r="5" fill="#392f23" stroke="#fae4a7"/><path d="M0 -8 L3.4 3.5 0 1.8 -3.4 3.5 Z" fill="#ffebbc"/></g>' +
    '<g class="lake-scale" transform="translate(15 421)"><path d="M0 0v4h50v-4" fill="none" stroke="currentColor"/><text x="24" y="-3" text-anchor="middle">50 м</text></g>' +
    '<g class="lake-scale" transform="translate(343 24)"><path d="M0 2l-3 11 3-2 3 2Z" fill="currentColor"/><text y="-2" text-anchor="middle">С</text></g></svg>' +
    '<div class="lake-atlas-key"><h3>Указатель дорог</h3><p>Выберите место для отметки на компасе.</p>' +
    waypoints +
    '<small>Горизонтали через 4 м</small></div></div>'
  );
}

function marchNavigation() {
  const pin = marchSites[game?.march?.mark];
  return pin ? { text: 'Метка · ' + pin.title, target: pin } : null;
}
function bindMarchMap() {
  for (const el of document.querySelectorAll('[data-march-mark], [data-lake-list]')) {
    const choose = () => {
      const id = el.dataset.marchMark || el.dataset.lakeList;
      game.march.mark = game.march.mark === id ? null : id;
      closeModal();
      drawHud();
      if (game.march.mark) notify('Метка · ' + marchSites[id].title, 1.8);
      capture();
    };
    el.addEventListener('click', choose);
    if (el.hasAttribute('data-march-mark'))
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose();
        }
      });
  }
}
