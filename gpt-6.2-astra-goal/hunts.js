'use strict';
const huntSites = {
  pale: {
    name: 'Белогрив',
    place: 'След у западного брода',
    x: -93,
    z: 40,
    level: 2,
    kind: 'hound',
    hp: 154,
    scale: 1.3,
    reach: 1.85,
    rumor:
      'У брода к западу от эльфийского посёлка находят двойные следы. Охотники видели, как зверь сперва скребёт лапой землю.',
    tactic:
      'Белогрив бросается по прямой. Уходите в сторону на разбеге и бейте, пока он переводит дыхание. Раненый зверь заходит на второй бросок с фланга.',
    trophy: 'Клык Белогрива',
    xp: 75,
    coins: 32,
  },
  widow: {
    name: 'Колокольная вдова',
    place: 'Остов звонницы',
    x: 25,
    z: -95,
    level: 4,
    kind: 'weaver',
    hp: 238,
    scale: 1.55,
    reach: 2.55,
    rumor: 'К северо-западу от дворца стоит остов старой звонницы. Днём её нити видны против света.',
    tactic:
      'Вдова плетёт сеть в месте, где вас заметила. Выходите из белого круга до натяжения нитей и отступайте от укуса. Обходите её панцирь сбоку.',
    trophy: 'Серебряный шёлк',
    xp: 115,
    coins: 48,
  },
};
function huntState(id) {
  const h = huntSites[id],
    records = (game.hunts ??= {});
  return (records[id] ??= {
    id: id === 'pale' ? -101 : -102,
    hunt: id,
    kind: h.kind,
    minLevel: h.level,
    name: h.name,
    team: 'hostile',
    hp: h.hp,
    maxHp: h.hp,
    x: h.x,
    z: h.z,
    yaw: Math.PI * 0.37,
    phase: 'idle',
    timer: 0,
    cd: 1.6,
    hits: 0,
  });
}
function huntSolid(x, z, r, who) {
  if (game.inside || game.delivery || !game.hunts) return false;
  return Object.values(game.hunts).some(
    (m) =>
      m !== who &&
      m.hp > 0 &&
      Math.hypot(x - m.x, z - m.z) < r + (m.hunt === 'pale' ? 0.55 : 0.75) &&
      !(who === game && game.air > 1.95),
  );
}
function huntMove(m, dx, dz) {
  const r = m.hunt === 'pale' ? 0.54 : 0.68;
  const can = (x, z) =>
    world.free(x, z, r) &&
    Math.abs(walkingSurface(x, z) - walkingSurface(m.x, m.z)) < 0.7 &&
    distance({ x, z }, game) > r + 0.34;
  if (can(m.x + dx, m.z + dz)) {
    m.x += dx;
    m.z += dz;
    return true;
  }
  if (Math.abs(dx) > 0.00001 && can(m.x + dx, m.z)) {
    m.x += dx;
    return true;
  }
  if (Math.abs(dz) > 0.00001 && can(m.x, m.z + dz)) {
    m.z += dz;
    return true;
  }
  return false;
}
function huntFace(m, angle, dt, rate) {
  m.yaw += clamp(angles(angle - m.yaw), -rate * dt, rate * dt);
}
function huntRest(m, t) {
  m.phase = 'recover';
  m.timer = t;
  m.windup = 0;
  m.walk = false;
}
function huntTick(dt) {
  const g = game;
  g.webbed = Math.max(0, (g.webbed || 0) - dt);
  for (const [id, h] of Object.entries(huntSites)) {
    if (distance(g, h) > 62 && !g.hunts?.[id]?.engaged) continue;
    const m = huntState(id);
    if (!m.seen && distance(g, h) < 19) {
      m.seen = true;
      awardOnce('den-' + id, 18, h.place);
      notify(h.place + ' · Следы в полевом дневнике', 3);
    }
    if (m.hp <= 0) continue;
    const dist = distance(m, g),
      angle = Math.atan2(g.x - m.x, g.z - m.z);
    if (!m.engaged && dist < 12.5 && visiblePath(m, g)) {
      m.engaged = true;
      monsterCall(m.kind, false);
    }
    if (m.engaged && (dist > 24 || distance(g, h) > 26)) {
      m.engaged = false;
      m.phase = 'home';
      m.webLeft = 0;
      m.windup = 0;
    }
    m.walk = false;
    m.webLeft = Math.max(0, (m.webLeft || 0) - dt);
    if (
      m.webLeft &&
      (Math.hypot(g.x - m.webX, g.z - m.webZ) < 2.25 ||
        (m.trapX != null && Math.hypot(g.x - m.trapX, g.z - m.trapZ) < 1.65)) &&
      g.air < 0.65 &&
      !g.evade
    )
      g.webbed = 0.38;
    if (!m.engaged) {
      if (m.phase === 'home' && distance(m, h) > 0.7) {
        const a = Math.atan2(h.x - m.x, h.z - m.z);
        huntFace(m, a, dt, 2.7);
        m.walk = huntMove(m, Math.sin(a) * dt * 3.2, Math.cos(a) * dt * 3.2);
      } else {
        m.phase = 'idle';
        m.hp = Math.min(h.hp, m.hp + dt * 6);
      }
      continue;
    }
    if (m.stagger > 0) {
      m.stagger = Math.max(0, m.stagger - dt);
      huntRest(m, 0.34);
      continue;
    }
    m.cd = Math.max(0, m.cd - dt);
    m.timer = Math.max(0, m.timer - dt);
    if (m.phase === 'recover') {
      if (!m.timer) m.phase = 'idle';
      continue;
    }
    if (m.phase === 'circle') {
      const tangent = angle + m.side * 1.24;
      huntFace(m, tangent, dt, 5.6);
      m.walk = huntMove(m, Math.sin(tangent) * dt * 5.1, Math.cos(tangent) * dt * 5.1);
      if (!m.timer) {
        m.phase = 'idle';
        m.cd = 0.04;
        m.nextRush = true;
      }
      continue;
    }
    if (m.phase === 'withdraw') {
      huntFace(m, angle, dt, 3.4);
      const a = angle + Math.PI + 0.3 * m.side;
      m.walk = huntMove(m, Math.sin(a) * dt * 3.5, Math.cos(a) * dt * 3.5);
      if (!m.timer) {
        m.phase = 'idle';
        m.cd = 0.16;
      }
      continue;
    }
    if (m.phase === 'wind') {
      m.windup = Math.max(0.001, m.timer);
      if (m.timer) continue;
      m.windup = 0;
      m.struckAt = gameTime;
      if (m.attack === 'rush') {
        m.phase = 'rush';
        m.timer = 0.7;
        m.didHit = false;
      } else if (m.attack === 'web') {
        m.webLeft = m.hp < h.hp * 0.5 ? 5 : 3.4;
        if (m.hp < h.hp * 0.5) {
          m.side = m.hits % 2 ? 1 : -1;
          m.trapX = m.webX + Math.cos(m.yaw) * 3.55 * m.side;
          m.trapZ = m.webZ - Math.sin(m.yaw) * 3.55 * m.side;
        } else m.trapX = null;
        if (Math.hypot(g.x - m.webX, g.z - m.webZ) < 2.45 && g.air < 0.65 && !g.evade) {
          g.webbed = 1.2;
          hitPlayer(13, { x: m.x, z: m.z, ranged: true });
        }
        huntRest(m, 1.1);
      } else {
        if (dist < h.reach + 0.7 && visiblePath(m, g) && g.air < 1.6) hitPlayer(22, m);
        if (m.hp < h.hp * 0.65) {
          m.phase = 'withdraw';
          m.timer = 0.85;
          m.side = m.hits % 2 ? 1 : -1;
        } else huntRest(m, 0.75);
      }
      continue;
    }
    if (m.phase === 'rush') {
      m.walk = true;
      const speed = 12.5;
      huntMove(m, Math.sin(m.yaw) * speed * dt, Math.cos(m.yaw) * speed * dt);
      if (!m.didHit && dist < h.reach + 0.28 && g.air < 1.0 && visiblePath(m, g)) {
        m.didHit = true;
        hitPlayer(23, m);
      }
      if (!m.timer) {
        if (m.hp < h.hp * 0.65 && !m.nextRush) {
          m.side = m.hits % 2 ? 1 : -1;
          m.phase = 'circle';
          m.timer = 0.67;
        } else {
          m.nextRush = false;
          huntRest(m, 1.2);
        }
      }
      continue;
    }
    huntFace(m, angle, dt, id === 'pale' ? 3.4 : 2.25);
    if (
      !m.cd &&
      Math.abs(angles(angle - m.yaw)) < 0.42 &&
      visiblePath(m, g) &&
      (dist < h.reach + 0.4 || dist < (id === 'pale' ? 9 : 11))
    ) {
      m.hits++;
      m.attack = id === 'pale' ? 'rush' : dist > h.reach || m.hits % 2 === 0 ? 'web' : 'bite';
      m.phase = 'wind';
      m.timer = m.attack === 'web' ? 1.12 : m.attack === 'rush' ? 0.8 : 0.64;
      m.windup = m.timer;
      m.webX = g.x;
      m.webZ = g.z;
      m.cd = id === 'widow' ? 2.6 : 2.3;
      monsterCall(m.kind, false);
      continue;
    }
    if (dist > h.reach) {
      const speed = id === 'pale' ? 2.65 : 1.95;
      for (const bias of [0, 0.55, -0.55, 1.05, -1.05]) {
        const a = angle + bias;
        if (huntMove(m, Math.sin(a) * speed * dt, Math.cos(a) * speed * dt)) {
          m.walk = true;
          break;
        }
      }
    }
  }
}
function huntTarget(range, cone) {
  let best = null,
    limit = range;
  for (const m of Object.values(game.hunts || {})) {
    if (m.hp <= 0) continue;
    const d = distance(game, m),
      vert = Math.atan2(walkingSurface(m.x, m.z) + 0.84 - walkingSurface(game.x, game.z) - 1.6 - game.air, d);
    if (
      d < limit &&
      Math.abs(angles(Math.atan2(game.x - m.x, game.z - m.z) - game.yaw)) < cone &&
      Math.abs(vert - game.pitch) < 0.89 &&
      visiblePath(game, m)
    ) {
      limit = d;
      best = m;
    }
  }
  return best;
}
function huntArrowHit(a) {
  return (
    Object.values(game.hunts || {}).find(
      (m) =>
        m.hp > 0 &&
        distance(m, a) < (m.hunt === 'pale' ? 0.77 : 1.05) &&
        Math.abs(a.y - walkingSurface(m.x, m.z) - 0.86) < 0.9,
    ) || null
  );
}
function huntHit(m, amount) {
  const h = huntSites[m.hunt];
  m.engaged = true;
  const frontal = Math.abs(angles(Math.atan2(game.x - m.x, game.z - m.z) - m.yaw)) < 1.03;
  if (m.phase === 'recover') amount = Math.round(amount * 1.48);
  else if (frontal && m.phase !== 'wind' && !m.stagger)
    amount = Math.max(1, Math.round(amount * (m.hunt === 'widow' ? 0.39 : 0.68)));

  m.hp = Math.max(0, m.hp - amount);
  m.hitAt = gameTime;
  fieldImpact(m.x, walkingSurface(m.x, m.z) + 0.95, m.z, 'dust');
  if (!m.hp) {
    m.fellAt = gameTime;
    m.windup = 0;
    m.phase = 'fallen';
    m.walk = false;
    m.engaged = false;
    m.webLeft = 0;
    game.kills++;
    monsterCall(m.kind, true);
    awardOnce('hunt-' + m.hunt, h.xp, h.name);
    notify(h.name + ' повержен · E у останков', 3);
    checkpoint();
  }
}
function huntLootOption() {
  for (const m of Object.values(game.hunts || {}))
    if (!m.hp && !m.looted && distance(game, m) < 3.25)
      return { huntLoot: m.hunt, label: 'Взять трофей · ' + huntSites[m.hunt].trophy };
  return null;
}
function takeHunt(id) {
  const m = huntState(id),
    h = huntSites[id];
  if (m.hp > 0 || m.looted || distance(game, m) >= 3.25) return;
  m.looted = true;
  game.coins += h.coins;
  game.story.entries.push([
    h.trophy,
    'В ' + h.place.toLowerCase() + ' добыт трофей. Награда охотничьей артели — ' + h.coins + ' монет.',
  ]);
  checkpoint();
  drawHud();
  notify(h.trophy + ' · +' + h.coins + ' монет');
}
function huntJournal() {
  return (
    '<section class="hunt-notes">' +
    Object.entries(huntSites)
      .map(([id, h]) => {
        const m = game.hunts?.[id];
        return (
          '<div><b>' +
          h.name +
          ' · ур. ' +
          h.level +
          '</b><p>' +
          (m?.seen ? h.tactic : h.rumor) +
          '</p>' +
          (m?.hp <= 0
            ? 'Трофей · ' + h.trophy
            : '<button class="action" data-hunt="' +
              id +
              '">' +
              (game.trackHunt === id ? 'Снять отметку' : 'Отметить район на компасе') +
              '</button>') +
          '</div>'
        );
      })
      .join('') +
    '</section>'
  );
}
function bindHuntJournal() {
  for (const b of document.querySelectorAll('[data-hunt]'))
    b.onclick = () => {
      game.trackHunt = game.trackHunt === b.dataset.hunt ? null : b.dataset.hunt;
      game.markHall = game.markMarch = null;
      if (game.oath) game.oath.tracked = false;
      if (game.exploration) game.exploration.tracked = null;
      closeModal();
      drawHud();
      capture();
    };
}
function huntGoal() {
  const id = game.trackHunt,
    h = huntSites[id];
  if (!h) return null;
  const m = game.hunts?.[id];
  return m?.looted
    ? null
    : { text: h.place + ' · ' + h.name + ' (ур. ' + h.level + ')', target: m?.seen ? m : h };
}

function huntWebGeometry() {
  const vertices = [];
  function thread(ax, ay, bx, by, depth = 0) {
    vertices.push(ax, ay, depth, bx, by, depth);
  }
  for (let j = 0; j < 15; j++) {
    const a = (j * Math.PI * 2) / 15,
      b = ((j + 1) * Math.PI * 2) / 15,
      stretch = 1 + 0.09 * Math.sin(a * 3);
    thread(0, 0, Math.cos(a) * stretch, Math.sin(a));
    for (let k = 1; k <= 7; k++) {
      const r = k / 8,
        mid = (a + b) / 2;
      thread(
        Math.cos(a) * r * stretch,
        Math.sin(a) * r,
        Math.cos(mid) * r * 0.89,
        Math.sin(mid) * r * 0.89 - 0.026,
      );
      thread(
        Math.cos(mid) * r * 0.89,
        Math.sin(mid) * r * 0.89 - 0.026,
        Math.cos(b) * r * (1 + 0.09 * Math.sin(b * 3)),
        Math.sin(b) * r,
      );
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return mesh;
}
function createHuntScene(realm, id) {
  const h = huntSites[id],
    den = new THREE.Group(),
    root = new THREE.Group(),
    beast = creatureModel(h.kind);
  realm.scene.add(den, root);
  root.add(beast);
  beast.scale.setScalar(h.scale);
  const web = huntWebGeometry(),
    silk = new THREE.LineBasicMaterial({ color: 0xe4e8d7, transparent: true, opacity: 0.65 });
  const echo = new THREE.LineSegments(web, silk.clone());
  echo.rotation.x = -Math.PI / 2;
  echo.visible = false;
  realm.scene.add(echo);
  const tell = new THREE.LineSegments(web, silk.clone());
  tell.rotation.x = -Math.PI / 2;
  tell.visible = false;
  realm.scene.add(tell);
  const skin = beast.userData.parts;
  const hair = new THREE.MeshStandardMaterial({
    color: id === 'pale' ? 0xd1cbb1 : 0xc88356,
    roughness: 0.89,
  });
  if (id === 'pale') {
    const spike = new THREE.ConeGeometry(1, 1, 5);
    for (let i = 0; i < 13; i++) {
      const j = (i % 3) - 1;
      const crest = beastPart(
        skin.body,
        spike,
        hair,
        0.09 * j,
        0.9 - 0.016 * Math.floor(i / 3),
        0.17 - i * 0.055,
        0.065,
        0.21 + Math.sin(i) * 0.025,
        0.065,
      );
      crest.rotation.x = -0.53;
      crest.rotation.z = -j * 0.22;
    }
    const rib = new THREE.MeshStandardMaterial({ color: 0xc1b497, roughness: 0.92 });
    for (let i = 0; i < 7; i++) {
      const dx = -2.65 + i * 0.2,
        dz = 2.1 + 0.18 * Math.sin(i);
      const pos = walkingSurface(h.x + dx, h.z + dz);
      const bent = new THREE.Mesh(new THREE.TorusGeometry(0.17 + (i % 3) * 0.023, 0.022, 5, 10, 2.5), rib);
      bent.position.set(dx, pos + 0.055, dz);
      bent.rotation.set(0.8, i * 0.39, -0.15);
      den.add(bent);
    }
  } else {
    const stone = new THREE.MeshStandardMaterial({ map: texture('stone'), color: 0x9b9c94, roughness: 0.94 });
    const timber = new THREE.MeshStandardMaterial({
      map: texture('craft-finish'),
      color: 0x706352,
      roughness: 1,
    });
    const bell = new THREE.MeshStandardMaterial({ color: 0x766849, metalness: 0.65, roughness: 0.48 });
    const posts = [
      [-3.4, -3.4],
      [2.0, -3.4],
    ];
    for (const [x, z] of posts) {
      const y = walkingSurface(h.x + x, h.z + z);
      beastPart(den, realm.box, stone, x, y + 0.32, z, 1.25, 0.64, 1.2);
      beastPart(den, realm.box, stone, x, y + 1.97, z, 0.88, 3.28, 0.84);
      beastPart(den, realm.box, stone, x, y + 3.7, z, 1.16, 0.23, 1.04);
      realm.bound(h.x + x, h.z + z, 1.22, 1.2);
    }
    const y = walkingSurface(h.x - 0.7, h.z - 3.4);
    beastPart(den, realm.box, timber, -0.7, y + 3.96, -3.4, 6.28, 0.31, 0.31);
    beastPart(den, new THREE.CylinderGeometry(0.2, 0.51, 0.68, 18, 1, true), bell, -0.9, y + 3.22, -3.4);
    beastPart(den, new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), bell, -0.9, y + 3.43, -3.4);
    const curtain = new THREE.LineSegments(web, silk);
    curtain.position.set(-0.65, y + 2.02, -3.49);
    curtain.scale.set(2.73, 1.88, 1);
    den.add(curtain);
    const body = skin.body;
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const mark = beastPart(
          body,
          new THREE.SphereGeometry(1, 9, 6),
          hair,
          0.146 * side,
          0.69 - i * 0.028,
          -0.25 - i * 0.086,
          0.115,
          0.044,
          0.05,
        );
        mark.rotation.z = side * 0.48;
      }
  }
  const shade = footShade();
  shade.scale.set(id === 'pale' ? 2.1 : 3.1, 1, id === 'pale' ? 3.25 : 3.0);
  root.add(shade);
  return { den, root, beast, tell, shade, echo };
}
function drawHunts(realm, s, t) {
  const views = (realm.huntViews ??= new Map());
  for (const [id, h] of Object.entries(huntSites)) {
    let v = views.get(id);
    if (s.delivery || distance(s, h) > 63) {
      if (v) {
        v.root.visible = v.den.visible = v.tell.visible = v.echo.visible = false;
      }
      continue;
    }
    const m = huntState(id);
    if (!v) {
      v = createHuntScene(realm, id);
      views.set(id, v);
    }
    v.den.position.set(nearest(h.x, s.x), 0, nearest(h.z, s.z));
    v.den.visible = v.root.visible = true;
    v.root.position.set(nearest(m.x, s.x), walkingSurface(m.x, m.z), nearest(m.z, s.z));
    v.shade.position.y = 0.028;
    poseCreature(v.beast, m, t);
    v.beast.position.set(0, 0, 0);
    const marking =
      m.hp > 0 && id === 'widow' && ((m.phase === 'wind' && m.attack === 'web') || m.webLeft > 0);
    v.tell.visible = !!marking;
    v.echo.visible = !!(marking && m.webLeft > 0 && m.trapX != null);
    if (v.echo.visible) {
      v.echo.scale.setScalar(1.72);
      v.echo.position.set(
        nearest(m.trapX, s.x),
        walkingSurface(m.trapX, m.trapZ) + 0.05,
        nearest(m.trapZ, s.z),
      );
    }

    if (marking) {
      v.tell.position.set(nearest(m.webX, s.x), walkingSurface(m.webX, m.webZ) + 0.055, nearest(m.webZ, s.z));
      const f = m.phase === 'wind' ? 1 - Math.min(1, m.timer / 1.12) : 1;
      v.tell.scale.setScalar(2.33 * f + 0.18);
      v.tell.material.opacity = 0.4 + 0.47 * f;
    }
  }
}
