const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

async function checkEquipment(
  browser,
  url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href,
) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /shader|THREE|WebGL/i.test(m.text())) errors.push(m.text());
  });
  try {
    await page.goto(url);
    await page.locator('.faction').nth(1).click();
    await page.click('#begin:enabled');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);
    await page.evaluate(() => {
      closeModal();
      cancelAnimationFrame(frame);
      realmVoice.stop();
      scoreStop();
      prefs.camera = 'first';
      Object.assign(game, { x: -21, z: -50, yaw: 0, pitch: 0, weapon: 'sword', stamina: 100, actors: [] });
      const g = actor('guard', 'hostile', game.x, game.z - 2, 'patrol');
      window.duelGuard = g;
      world.display(game, 10, 0, 0, null);
    });
    await page.keyboard.press('f');
    assert.ok(await page.evaluate(() => swing > 0 && duelGuard.hp < 58));
    const pictures = await page.evaluate(() => {
      const r = world.renderer,
        c = world.camera,
        booth = new THREE.Scene(),
        clock = { t: 21 };
      booth.add(c, new THREE.AmbientLight(0xffffff, 2));
      c.position.set(0, 0, 0);
      c.rotation.set(0, 0, 0, 'YXZ');
      const oldAlpha = r.getClearAlpha();
      const oldClear = r.getClearColor(new THREE.Color()),
        oldTarget = r.getRenderTarget();
      r.setClearColor(0, 0);
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ colorWrite: false }),
      );
      wall.renderOrder = -1;
      wall.position.z = -0.16;
      wall.visible = false;
      booth.add(wall);
      const w = 240,
        h = 144,
        target = new THREE.WebGLRenderTarget(w, h),
        pixels = new Uint8Array(w * h * 4);
      const paint = (aspect, pitch, heavy, attack) => {
        game.pitch = pitch;
        game.heavy = heavy;
        c.aspect = aspect;
        c.updateProjectionMatrix();
        world.updateHands(game, (clock.t += 1 / 45), attack, 0);
      };
      const mask = () => {
        r.setRenderTarget(target);
        r.render(booth, c);
        r.readRenderTargetPixels(target, 0, 0, w, h, pixels);
        const filled = new Uint8Array(w * h);
        for (let i = 0; i < filled.length; i++) filled[i] = Number(pixels[4 * i + 3] > 127);
        return filled;
      };
      // Follow the actual rendered sleeve from the visible fist all the way to the edge of the image.
      function silhouette(bits) {
        const todo = new Int32Array(w * h),
          count = bits.reduce((a, b) => a + b, 0);
        let largest = 0,
          tethered = false;
        for (let root = 0; root < bits.length; root++) {
          if (!bits[root]) continue;
          let head = 0,
            tail = 1,
            touches = false;
          todo[0] = root;
          bits[root] = 0;
          while (head < tail) {
            const at = todo[head++],
              x = at % w,
              y = Math.floor(at / w);
            if (x === 0 || y === 0 || x === w - 1) touches = true;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                if (x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h) continue;
                const next = at + dy * w + dx;
                if (bits[next]) {
                  bits[next] = 0;
                  todo[tail++] = next;
                }
              }
          }
          if (tail > largest) {
            largest = tail;
            tethered = touches;
          }
        }
        return { count, share: largest / Math.max(1, count), tethered };
      }
      const failures = [];
      let frames = 0,
        minShare = 1,
        minPixels = Infinity;
      for (const aspect of [0.59, 1.6, 2.36])
        for (const pitch of [0, -0.95, 0.87])
          for (const heavy of [false, true]) {
            for (let frame = 0; frame <= 9; frame++) {
              paint(aspect, pitch, heavy, 1 - frame / 9);
              for (const item of [world.shield, world.weapon, world.leftArm.group, world.viewBody])
                if (item) item.visible = false;
              const image = silhouette(mask());
              if (!image.tethered || image.share < 0.96 || image.count < 15)
                failures.push({ aspect, pitch, heavy, frame, ...image });
              frames++;
              minShare = Math.min(minShare, image.share);
              minPixels = Math.min(minPixels, image.count);
            }
          }
      paint(1.6, 0, true, 0.48);
      world.leftArm.group.visible = world.shield.visible = false;
      const uncovered = mask();
      wall.visible = true;
      const covered = mask();
      wall.visible = false;
      const lost =
        uncovered.reduce((a, v, i) => a + Number(v && !covered[i]), 0) / uncovered.reduce((a, v) => a + v, 0);
      paint(1.6, -1.15, false, 0);
      const body = world.viewBody,
        legs = body.getObjectByName('thigh_r');
      world.rightArm.group.visible =
        world.leftArm.group.visible =
        world.weapon.visible =
        world.shield.visible =
          false;
      const torso = mask().reduce((a, v) => a + v, 0);
      const motionStart = legs.quaternion.clone();
      keys.add('KeyW');
      for (let i = 0; i < 15; i++) paint(1.6, -1.15, false, 0);
      keys.delete('KeyW');
      const gait = motionStart.angleTo(legs.quaternion);
      world.scene.add(c);
      r.setRenderTarget(oldTarget);
      r.setClearColor(oldClear, oldAlpha);
      target.dispose();
      return {
        frames,
        minShare,
        minPixels,
        failures: failures.slice(0, 12),
        totalFailures: failures.length,
        lost,
        torso,
        gait,
      };
    });
    console.log('Rendered sword arm and tunic', pictures);
    assert.equal(pictures.totalFailures, 0);
    assert.ok(pictures.lost < 0.005 && pictures.torso > 70 && pictures.gait > 0.04);
    await page.keyboard.down('r');
    const sweep = await page.evaluate(() => {
      let t = world.handTime;
      game.pitch = 0;
      world.camera.aspect = 1.6;
      world.camera.updateProjectionMatrix();
      world.guardLift = { value: 0, speed: 0 };
      const records = [];
      for (let i = 0; i < 55; i++) {
        tickGuard(1 / 60);
        world.updateHands(game, (t += 1 / 60), 0);
        records.push([world.guardLift.value, ...world.shield.position.toArray(), world.shield.visible]);
      }
      window.shieldRecords = records;
      return records;
    });
    await page.keyboard.up('r');
    const lower = await page.evaluate(() => {
      let t = world.handTime;
      const rows = [];
      for (let i = 0; i < 61; i++) {
        tickGuard(1 / 60);
        world.updateHands(game, (t += 1 / 60), 0);
        rows.push([world.guardLift.value, world.shield.visible]);
      }
      return rows;
    });
    assert.ok(
      sweep.every((v) => v[4]) && lower.every((v) => v[1]),
      'the equipped shield stays with the forearm in both directions',
    );
    assert.ok(
      sweep[0][0] < 0.025 &&
        sweep[7][0] > 0.25 &&
        sweep[7][0] < 0.55 &&
        sweep[15][0] > 0.7 &&
        sweep[40][0] > 0.99,
    );
    assert.ok(lower[4][0] > 0.72 && lower[17][0] < 0.3 && lower.at(-1)[0] < 0.002);
    const maxJump = Math.max(
      ...sweep.slice(1).map((row, i) => Math.hypot(...row.slice(1, 4).map((v, j) => v - sweep[i][j + 1]))),
    );
    assert.ok(maxJump < 0.04 && Math.abs(sweep.at(-1)[2] - sweep[0][2]) > 0.25);
    const thirdPerson = await page.evaluate(() => {
      prefs.camera = 'shoulder';
      const results = [];
      for (const side of [0, 1, 2]) {
        game.side = side;
        game.blockTime = 0;
        world.guardLift = { value: 0, speed: 0 };
        let t = world.handTime + 0.04;
        world.updateHands(game, t, 0);
        frameHeroCamera(world, game, t, 0);
        const hero = world.fieldHero,
          target = hero.getObjectByName('lowerarm_l');
        const origin = target.quaternion.clone(),
          record = [];
        for (let i = 0; i < 46; i++) {
          game.blockTime = (i + 1) / 60;
          world.updateHands(game, (t += 1 / 60), 0);
          frameHeroCamera(world, game, t, 0);
          if ([0, 7, 35].includes(i)) record.push(target.quaternion.angleTo(origin));
        }
        keys.add('KeyW');
        frameHeroCamera(world, game, t + 0.016, 0);
        keys.clear();
        results.push({ record, visible: hero.visible, walk: hero.userData.state === 'walk' });
      }
      return results;
    });
    for (const { record, visible, walk } of thirdPerson) {
      assert.ok(
        visible && walk && record[1] > record[0] + 0.1 && record[2] > record[1] + 0.2,
        JSON.stringify(thirdPerson),
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS — normal hit on a guard, rendered connected arm at three aspect ratios, close cover, visible animated body, continuous shield raise and recovery.',
      { maxJump },
    );
  } finally {
    await page.close();
  }
}
module.exports = checkEquipment;
if (require.main === module)
  (async () => {
    const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'],
    });
    try {
      await checkEquipment(b);
    } finally {
      await b.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
