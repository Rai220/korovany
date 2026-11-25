const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require('playwright');

async function run(browser, url = pathToFileURL(path.resolve(__dirname, '../index.html')).href) {
  const page = await browser.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.goto(url);
    await page.click('#begin');
    await page.waitForFunction(() => active && world && world.renderer.info.render.frame > 0, null, { timeout: 90000 });
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      closeModal();
      game.story.started = true;
      window.freshCart = (s = 35) => {
        game.actors = [];
        game.inside = null;
        game.delivery = null;
        game.health = 100;
        game.hits = 0;
        game.air = 0;
        game.stamina = 100;
        Object.assign(game.wagon, convoyRoad(s), {
          convoy: null,
          roadS: s,
          node: 1,
          bend: 0,
          cool: 0,
          listening: 0,
        });
        Object.assign(game, {
          x: 0,
          z: 0,
          evade: 0,
          blockTime: 0,
          parryWindow: 0,
          weapon: 'sword',
          pitch: 0,
        });
        return game.wagon;
      };
    });
    const road = await page.evaluate(() => {
      const w = freshCart(),
        c = convoyState(w),
        nodes = new Set();
      let maxTurn = 0,
        maxBend = 0,
        minStep = 1,
        maxStep = 0,
        blockedSamples = 0;
      for (let i = 0; i < Math.ceil((4 * convoyLeg + 4) / (1.35 * 0.04)); i++) {
        const x = w.x,
          z = w.z,
          a = w.angle;
        wagonTick(0.04);
        nodes.add(w.node);
        const ds = Math.hypot(w.x - x, w.z - z);
        if (i % 5 === 0) {
          const c = Math.cos(w.bend),
            h = Math.sin(w.bend);
          for (const side of [-1, 1]) {
            for (const [x, z, r] of [
              [side * 0.72, -1.17, 0.42],
              [side * 0.72, 0.9, 0.43],
              [side * 0.73 * c + 2.53 * h, 1.09 - side * 0.73 * h + 2.53 * c, 0.45],
              [side * 0.73 * c + 3.37 * h, 1.09 - side * 0.73 * h + 3.37 * c, 0.39],
            ]) {
              const p = convoyPlace(w, x, z);
              if (!world.free(p.x, p.z, r)) blockedSamples++;
            }
          }
        }
        minStep = Math.min(minStep, ds);
        maxStep = Math.max(maxStep, ds);
        maxTurn = Math.max(maxTurn, Math.abs(angles(w.angle - a)));
        maxBend = Math.max(maxBend, Math.abs(w.bend));
      }
      return { nodes: nodes.size, minStep, maxStep, maxTurn, maxBend, speed: c.speed, blockedSamples };
    });
    assert.equal(road.nodes, 4);
    assert.equal(road.blockedSamples, 0);
    assert.ok(road.minStep > 0.051 && road.maxStep < 0.056);
    assert.ok(road.maxTurn < 0.011 && road.maxTurn > 0.007 && road.maxBend > 0.3);
    const pinnae = await page.evaluate(() =>
      world.team[1].userData.ears.map((ear) => {
        const p = ear.children[0].geometry.attributes.position;
        const vertices = Array.from({ length: p.count }, (_, i) =>
          new THREE.Vector3().fromBufferAttribute(p, i),
        );
        const bounds = new THREE.Box3().setFromPoints(vertices),
          size = bounds.getSize(new THREE.Vector3());
        const tip = vertices.filter((v) => v.y > bounds.max.y - 0.02);
        const outline = new THREE.Box3().setFromPoints(tip);
        return {
          height: size.y,
          width: size.x,
          depth: size.z,
          tipWidth: outline.max.x - outline.min.x,
          outward: ear.userData.side * (outline.min.x + outline.max.x) * 0.5,
        };
      }),
    );
    assert.equal(pinnae.length, 2);
    for (const ear of pinnae)
      assert.ok(
        ear.height > ear.width * 2.2 &&
          ear.height < 0.25 &&
          ear.depth > 0.05 &&
          ear.tipWidth < ear.width * 0.32 &&
          ear.outward > 0.025,
        JSON.stringify(ear),
      );
    const raid = await page.evaluate(() => {
      const w = freshCart(),
        c = convoyState(w),
        crew = c.archers;
      let shots = 0,
        draw = 0;
      const coins = game.coins;
      function follow() {
        Object.assign(game, convoyPlace(w, 1.6, -13));
      }
      follow();
      raidWagon();
      for (let i = 0; i < 143; i++) {
        const n = c.shots.length;
        follow();
        wagonTick(0.025);
        shots += Math.max(0, c.shots.length - n);
        draw = Math.max(draw, ...crew.map((a) => a.draw));
      }
      const speed = c.speed;
      const target = archerSite(w, crew[0]);
      const p = convoyPlace(w, -0.77, -5.4);
      Object.assign(game, p);
      game.yaw = Math.atan2(-wrapped(target.x - game.x), -wrapped(target.z - game.z));
      game.pitch = Math.atan2(target.y - walkingSurface(game.x, game.z) - 1.68, distance(game, target));
      const pick = convoyTarget(6, 0.45) === target;
      const hit = convoyArrowHit({ x: target.x, y: target.y, z: target.z }) === target;
      const xp = game.training?.xp || 0;
      hurtActor(target, 51, true);
      const awarded = game.training.xp - xp;
      hurtActor(target, 51, true);
      const body = convoyArrowHit({ ...convoyPlace(w, 1, 0), y: ground(w.x, w.z) + 1.1 });
      hurtActor(body, 88, true);
      for (let i = 0; i < 78; i++) {
        follow();
        wagonTick(0.04);
      }
      const stopped = c.speed < 0.01;
      Object.assign(game, convoyPlace(w, 0, -3.3));
      raidWagon();
      const cash = game.coins - coins,
        cool = w.cool;
      raidWagon();
      return {
        shots,
        draw,
        speed,
        pick,
        hit,
        archerDown: target.hp === 0,
        awarded,
        totalXP: game.training.xp - xp,
        stopped,
        cash,
        cool,
        repeated: game.coins - coins,
      };
    });
    assert.ok(
      raid.shots > 0 &&
        raid.draw > 0.88 &&
        raid.speed >= 5.9 &&
        raid.pick &&
        raid.hit &&
        raid.archerDown &&
        raid.stopped,
    );
    assert.equal(raid.awarded, 19);
    assert.equal(raid.totalXP, 19);
    assert.equal(raid.cash, 42);
    assert.equal(raid.repeated, 42);
    assert.ok(raid.cool > 0);
    const weapons = await page.evaluate(() => {
      const w = freshCart(),
        c = convoyState(w),
        archer = archerSite(w, c.archers[1]);
      Object.assign(game, convoyPlace(w, 0.77, -9));
      game.weapon = 'bow';
      game.arrows = 5;
      game.arm = 'whole';
      game.arrow = null;
      swing = 0;
      game.yaw = Math.atan2(-wrapped(archer.x - game.x), -wrapped(archer.z - game.z));
      game.pitch = Math.atan2(archer.y - walkingSurface(game.x, game.z) - 1.71, distance(archer, game));
      attack();
      const fired = !!game.arrow;
      for (let i = 0; i < 55 && game.arrow; i++) arrowTick(0.012);
      const hit = archer.hp < 46;
      Object.assign(game, convoyPlace(w, -2.52, 0.04));
      game.yaw = Math.atan2(-wrapped(w.x - game.x), -wrapped(w.z - game.z));
      game.pitch = -0.16;
      game.weapon = 'sword';
      swing = 0;
      attack();
      return { fired, hit, alarm: c.alarm, axle: c.axle };
    });
    assert.ok(weapons.fired && weapons.hit && weapons.alarm && weapons.axle < 82, JSON.stringify(weapons));
    const defense = await page.evaluate(() => {
      const w = freshCart(),
        c = convoyState(w);
      function one(x, z, tx, tz, block, dodge) {
        Object.assign(game, {
          x: tx,
          z: tz,
          health: 100,
          blockTime: block ? 1 : 0,
          evade: dodge ? 0.65 : 0,
          parryWindow: block ? 0.4 : 0,
          stamina: 100,
          yaw: Math.atan2(tx - x, tz - z),
          hits: 0,
        });
        const dx = tx - x,
          dz = tz - z,
          len = Math.hypot(dx, dz);
        c.shots = [
          {
            x,
            y: walkingSurface(x, z) + 1.45,
            z,
            dx: (dx / len) * 20,
            dy: 1.55,
            dz: (dz / len) * 20,
            life: 2,
            startX: x,
            startZ: z,
          },
        ];
        for (let i = 0; i < 72 && c.shots.length; i++) convoyArrows(c, 0.02);
        return [game.health, game.stamina, c.shots.length];
      }
      return {
        direct: one(-31, -50, -21, -50, false, false),
        shield: one(-31, -50, -21, -50, true, false),
        dodge: one(-31, -50, -21, -50, false, true),
        cover: one(-62, -65, -62, -54, false, false),
      };
    });
    assert.equal(defense.direct[0], 91);
    assert.deepEqual(defense.shield, [100, 97, 0]);
    assert.deepEqual(defense.dodge, [100, 100, 0]);
    assert.deepEqual(defense.cover, [100, 100, 0]);
    const sprint = await page.evaluate(() => {
      const w = freshCart(),
        c = convoyState(w),
        balance = game.coins;
      alarmConvoy();
      Object.assign(game, convoyPlace(w, 0, -32));
      for (let i = 0; i < 130; i++) wagonTick(0.025);
      Object.assign(game, convoyPlace(w, 0.22, -3.15));
      raidWagon();
      return { got: game.coins - balance, crew: c.archers.every((s) => s.hp > 0) };
    });
    assert.deepEqual(sprint, { got: 42, crew: true });
    const npc = await page.evaluate(() => {
      freshCart();
      Object.assign(game, { x: -14, z: -50 });
      // A sentry holds his post while turning to face a visitor behind him.
      const a = actor('guard', 'resident', -14, -48, 'vigil');
      const start = point(a.x, a.z);
      const model = world.person(a.kind, a.tag, false, a);
      world.scene.add(model);
      const bones = ['foot_l', 'foot_r'].map((n) => model.userData.skeleton.getBoneByName(n));
      let planted = 0,
        lifted = 0,
        slip = 0;
      let prev = a.angle,
        max = 0,
        vertexTurns = 0;
      for (let i = 0; i < 72; i++) {
        stepActors(0.02);
        model.position.set(a.x, ground(a.x, a.z), a.z);
        model.rotation.y = a.angle;
        animateCastActor(model, a, 30 + i * 0.02, false);
        for (const [j, foot] of (model.userData.turnFeet?.feet || []).entries()) {
          if (foot.end) {
            lifted++;
            continue;
          }
          const actual = bones[j].getWorldPosition(new THREE.Vector3());
          planted++;
          slip = Math.max(slip, Math.hypot(actual.x - foot.anchor.x, actual.z - foot.anchor.z));
        }
        const turn = Math.abs(angles(a.angle - prev));
        max = Math.max(max, turn);
        if (turn > 0.01) vertexTurns++;
        prev = a.angle;
      }
      world.scene.remove(model);
      releaseCharacter(model);
      return {
        max,
        vertexTurns,
        drift: distance(a, start),
        facingError: Math.abs(angles(a.angle - faceField(a, game))),
        planted,
        lifted,
        slip,
      };
    });
    assert.ok(
      npc.max < 0.081 && npc.vertexTurns > 24 && npc.drift < 0.00001 && npc.facingError < 0.01,
      'Sentry half-turn on post: ' + JSON.stringify(npc),
    );
    assert.ok(npc.planted > 30 && npc.lifted > 15 && npc.slip < 0.095, JSON.stringify(npc));
    const fighters = await page.evaluate(() => {
      // A duellist can circle a stationary opponent while his weapon recovers.
      const samples = [];
      for (let seed = 1; seed <= 16; seed++) {
        freshCart();
        Object.assign(game, { x: -14, z: -50 });
        const a = actor('guard', 'hostile', -14, -48, 'probe');
        Object.assign(a, { seed, cd: 10 });
        const start = point(a.x, a.z);
        let maxTurn = 0, facingError = 0;
        const modes = new Set();
        for (let i = 0; i < 116; i++) {
          const before = a.angle;
          stepActors(0.02);
          maxTurn = Math.max(maxTurn, Math.abs(angles(a.angle - before)));
          if (i >= 100)
            facingError = Math.max(facingError, Math.abs(angles(a.angle - faceField(a, game))));
          modes.add(a.mind.mode);
        }
        samples.push({ seed, maxTurn, facingError, drift: distance(start, a), modes: [...modes] });
      }
      return samples;
    });
    for (const f of fighters)
      assert.ok(f.maxTurn < 0.081 && f.facingError < 0.10, 'Tactical turn: ' + JSON.stringify(f));
    assert.ok(
      fighters.some((f) => f.modes.includes('flank') && f.drift > 0.35),
      'No seeded fighter circled the player: ' + JSON.stringify(fighters),
    );
    const gait = await page.evaluate(() => {
      const w = freshCart(60),
        dt = 1 / 30,
        side = 1;
      const start = escortSlot(w, side);
      const guard = actor('escort', 'escort', start.x, start.z, 'escort');
      guard.angle = w.angle;
      guard.escortSide = side;
      const model = world.person('escort', 'escort');
      const toes = ['ball_l', 'ball_r'].map((n) => model.userData.skeleton.getBoneByName(n));
      const speed = { walk: [], run: [] };
      let before,
        count = 0,
        lowest = 1;
      for (let i = 0; i < 180; i++) {
        if (i === 90) alarmConvoy();
        Object.assign(game, convoyPlace(w, 3.5, i < 90 ? -1 : 10));
        world.camera.position.set(game.x, walkingSurface(game.x, game.z) + 1.7, game.z);
        wagonTick(dt);
        stepActors(dt);
        model.position.set(guard.x, walkingSurface(guard.x, guard.z), guard.z);
        model.rotation.y = guard.angle;
        animateCastActor(model, guard, i * dt + 35, false);
        const current = toes.map((toe) => toe.getWorldPosition(new THREE.Vector3()));
        const mode = model.userData.state;
        if (before && ((i > 20 && i < 87) || i > 126) && speed[mode]) {
          count++;
          for (let j = 0; j < 2; j++) {
            const a = before[j],
              b = current[j];
            const h = b.y - walkingSurface(b.x, b.z);
            lowest = Math.min(lowest, h);
            if (a.y - walkingSurface(a.x, a.z) < 0.04 && h < 0.04)
              speed[mode].push(Math.hypot(b.x - a.x, b.z - a.z) / dt);
          }
        }
        before = current;
      }
      world.scene.remove(model);
      releaseCharacter(model);
      const slip = Object.fromEntries(
        Object.entries(speed).map(([key, a]) => [
          key,
          { frames: a.length, median: a.sort((a, b) => a - b)[Math.floor(a.length / 2)] },
        ]),
      );
      const bridge = { x: 50, z: streamZ(50), angle: 0 };
      const margins = [-1, 1].map((side) => 2.63 - Math.abs(escortSlot(bridge, side).x - bridge.x) - 0.37);
      const deck = walkingSurface(bridge.x, bridge.z);
      return { slip, count, lowest, margins, deck };
    });
    assert.ok(gait.slip.walk.frames > 30 && gait.slip.walk.median < 0.045, JSON.stringify(gait));
    assert.ok(gait.slip.run.frames > 5 && gait.slip.run.median < 0.1, JSON.stringify(gait));
    assert.ok(
      gait.lowest > -0.035 && Math.min(...gait.margins) > 0.19 && gait.deck >= 0.15,
      JSON.stringify(gait),
    );
    const resumed = await page.evaluate(() => {
      const w = freshCart(convoyStraight + 1);
      alarmConvoy();
      Object.assign(game, convoyPlace(w, 1, -16));
      for (let i = 0; i < 52; i++) wagonTick(0.021);
      const save = JSON.stringify(w);
      for (let i = 0; i < 25; i++) wagonTick(0.021);
      const end = JSON.stringify(w);
      game.wagon = JSON.parse(save);
      for (let i = 0; i < 25; i++) wagonTick(0.021);
      return end === JSON.stringify(game.wagon);
    });
    assert.ok(resumed, 'Saved pursuit resumes at the same steering angle and archer draw');
    assert.deepEqual(errors, []);
    console.log(
      'PASS caravan patrol, steering, pursuit, mounted archers, arrows, shields, evasion, cover, disabled axle, moving cargo and NPC turns',
      JSON.stringify({ road, raid, weapons, defense, sprint, npc, gait, resumed }),
    );
  } finally {
    await page.close();
  }
}
module.exports = run;
if (require.main === module)
  (async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      await run(browser, process.env.GAME_URL);
    } finally {
      await browser.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
