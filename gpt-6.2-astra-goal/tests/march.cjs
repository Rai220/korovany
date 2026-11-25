'use strict';

const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkLakeMarch(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 400));
  });
  try {
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.locator('#begin:enabled').waitFor();
    await page.evaluate(() => $('begin').click());
    await page.waitForFunction(() => active && world, null, { timeout: 120000 });
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      closeModal();
      realmVoice.stop();
      scoreStop();
      // Start the fixture on the approach outside the gateway. The E key performs both crossings.
      Object.assign(game, clearSpot(marchEntrance.x + 2.2, marchEntrance.z, game));
    });
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => Boolean(game.march)), true);
    const coverage = await page.evaluate(() => {
      const v = ensureMarchView(world);
      const blocked = [],
        visited = new Set();
      let metres = 0,
        checks = 0;
      for (const [i, road] of marchRoads.entries()) {
        for (const sign of [1, -1]) {
          const lane = sign === 1 ? road : [...road].reverse();
          let last = { x: lane[0][0], z: lane[0][1] };
          for (const [tx, tz] of lane.slice(1)) {
            const dx = tx - last.x,
              dz = tz - last.z,
              d = Math.hypot(dx, dz),
              n = Math.ceil(d / 0.17);
            for (let k = 0; k < n; k++) {
              const x = last.x + dx / n,
                z = last.z + dz / n;
              if (!marchStepFree(last.x, last.z, x, z)) blocked.push({ road: i, sign, x, z });
              last = { x, z };
              checks++;
            }
            metres += d;
          }
        }
      }
      function section(tx, tz) {
        const p = game.march;
        let travelled = 0;
        for (let i = 0; i < 1700; i++) {
          const dx = tx - p.x,
            dz = tz - p.z,
            d = Math.hypot(dx, dz);
          if (d < 0.08) return travelled;
          const x = p.x,
            z = p.z;
          game.yaw = Math.atan2(-dx, -dz);
          const dt = Math.min(0.04, d / 9);
          gameTime += dt;
          step(dt);
          travelled += Math.hypot(x - p.x, z - p.z);
          if (x === p.x && z === p.z)
            throw Error('Walking stopped on approach ' + [p.x, p.z, tx, tz].join(','));
        }
        throw Error('Could not finish road to ' + [tx, tz].join(','));
      }
      function walkRoad(i, back = false) {
        const lane = back ? [...marchRoads[i]].reverse() : marchRoads[i];
        for (const [x, z] of lane) {
          section(x, z);
          const a = marchAction();
          if (a) visited.add(a.id);
        }
      }
      keys.add('KeyW');
      keys.add('ShiftLeft');
      walkRoad(0);
      walkRoad(1);
      walkRoad(6);
      walkRoad(7);
      walkRoad(8);
      walkRoad(3, true);
      walkRoad(9);
      walkRoad(7, true);
      walkRoad(5, true);
      walkRoad(4, true);
      section(-7, 153);
      section(0, 178);
      keys.clear();
      window.lakeWalkTo = section;
      const wet = !marchLocalFree(4, -12),
        edge = !marchLocalFree(179.1, 0);
      let cliff = false;
      for (let x = 89; x < 167 && !cliff; x += 1.5)
        for (let z = -139; z < 120 && !cliff; z += 1.5) {
          if (
            marchLocalFree(x, z) &&
            marchLocalFree(x + 0.55, z) &&
            Math.abs(marchFloor(x + 0.55, z) - marchFloor(x, z)) > 0.9
          )
            cliff = !marchStepFree(x, z, x + 0.55, z);
        }
      const hours = [11, 23].map((h) => {
        waitForCountryHour(game, h);
        marchLighting(v, gameTime);
        return {
          glass: v.lamps.glass.emissiveIntensity,
          sun: v.sun.intensity,
          sky: v.airUniforms.dim.value,
        };
      });
      const story = oathState(),
        old = [story.waterToWheel, story.drainOpen],
        flow = [];
      for (const [feed, drain] of [
        [true, false],
        [false, true],
      ]) {
        story.waterToWheel = feed;
        story.drainOpen = drain;
        marchUpdate(v, gameTime);
        flow.push([v.wellWater.position.y, v.millJet.visible]);
      }
      [story.waterToWheel, story.drainOpen] = old;
      return {
        blocked: blocked.slice(0, 9),
        flow,
        checks,
        metres: Math.round(metres),
        visited: [...visited],
        wet,
        edge,
        cliff,
        hours,
      };
    });
    assert.deepEqual(coverage.blocked, []);
    assert.ok(coverage.flow[0][1] && !coverage.flow[1][1] && coverage.flow[0][0] - coverage.flow[1][0] > 4);
    assert.equal(new Set(coverage.visited).size, 7);
    assert.ok(coverage.checks > 14000);
    assert.ok(coverage.wet && coverage.edge && coverage.cliff);
    assert.ok(coverage.hours[1].glass > coverage.hours[0].glass + 1 && coverage.hours[1].sky > 0.9);
    // Space activates a focused atlas pin without sending a jump into the world behind the dialog.
    await page.keyboard.press('m');
    await page.locator('[data-march-mark="station"]').focus();
    await page.keyboard.press('Space');
    assert.deepEqual(
      await page.evaluate(() => [game.march.mark, $('dialog').open, game.air, game.vy]),
      ['station', false, 0, 0],
    );
    await page.keyboard.press('m');
    await page.click('[data-march-mark="quarry"]');
    assert.equal(await page.evaluate(() => marchNavigation().target === marchSites.quarry), true);
    // Some browsers keep the closed SVG control as the keyboard target.
    await page.locator('[data-march-mark="quarry"]').dispatchEvent('keydown', { key: 'Enter', code: 'Enter' });
    assert.equal(await page.evaluate(() => game.march.mark), 'quarry', 'Hidden map pin changed the route');
    await page.keyboard.press('Space');
    const jumped = await page.evaluate(() => {
      for (let i = 0; i < 5; i++) step(0.03);
      return { air: game.air, mark: game.march.mark };
    });
    assert.ok(jumped.air > 0.6 && jumped.mark === 'quarry', JSON.stringify(jumped));
    await page.keyboard.press('k');
    const written = await page.evaluate(() => {
      const saved = readSlot();
      const manual = JSON.parse(localStorage.getItem(saveKey()));
      return {
        live: game.march.mark,
        manual: manual?.march?.mark,
        mark: saved?.march?.mark,
        valid: valid(saved),
        x: saved?.march?.x,
        z: saved?.march?.z,
      };
    });
    assert.ok(written.valid && written.manual === 'quarry' && written.mark === 'quarry', JSON.stringify(written));
    await page.evaluate(() => menu());
    await page.waitForFunction(() => !active && !document.pointerLockElement);
    await page.locator('#resume:enabled').click();
    await page.waitForFunction(() => active && game.march?.mark === 'quarry' && !$('dialog').open);
    await page.keyboard.press('e');
    const exit = await page.evaluate(() => ({
      outdoors: !game.march,
      distance: distance(game, marchEntrance),
      valid: valid(readSlot()),
      action: marchAction()?.id,
      dialog: $('dialog').open,
      position: [game.x, game.z],
      local: game.march,
    }));
    assert.ok(exit.outdoors && exit.distance < 4 && exit.valid, JSON.stringify(exit));
    await page.keyboard.press('e');
    const hunt = await page.evaluate(() => {
      // Isolate an actual alternate-route encounter after coverage of the public road network.
      const foe = marchFauna().at(-1),
        p = game.march;
      let origin = null;
      for (let i = 0; i < 32 && !origin; i++) {
        const a = (i * Math.PI) / 16,
          x = foe.x + 5.3 * Math.cos(a),
          z = foe.z + 5.3 * Math.sin(a);
        if (
          marchLocalFree(x, z) &&
          marchLocalFree((x + foe.x) / 2, (z + foe.z) / 2) &&
          Math.abs(marchFloor(x, z) - marchFloor(foe.x, foe.z)) < 2
        )
          origin = { x, z };
      }
      if (!origin) throw Error('No firing lane at the eastern den');
      Object.assign(p, origin);
      const d = Math.hypot(foe.x - p.x, foe.z - p.z);
      game.yaw = Math.atan2(p.x - foe.x, p.z - foe.z);
      game.pitch = Math.atan2(marchFloor(foe.x, foe.z) + 0.88 - marchFloor(p.x, p.z) - 1.71, d);
      game.air = game.vy = 0;
      game.weapon = 'bow';
      game.arrows = 5;
      game.stamina = 100;
      game.blockTime = 0;
      swing = 0;
      const initial = foe.hp;
      attack();
      const launched = !!p.shot;
      for (let i = 0; i < 54; i++) {
        gameTime += 1 / 60;
        step(1 / 60);
      }
      const arrowDamage = initial - foe.hp,
        used = 5 - game.arrows,
        before = game.training.xp,
        initialKills = game.kills;
      game.weapon = 'sword';
      keys.add('KeyR');
      for (let i = 0; i < 200 && !foe.struckAt; i++) {
        game.yaw = Math.atan2(p.x - foe.x, p.z - foe.z);
        gameTime += 0.025;
        step(0.025);
      }
      const shield = foe.struckAt != null && game.health === maxHealth();
      keys.delete('KeyR');
      step(0.04);
      game.yaw = Math.atan2(p.x - foe.x, p.z - foe.z);
      attack(true);
      const after = game.training.xp;
      marchHurt(foe, 100, true);
      return {
        launched,
        arrowDamage,
        used,
        shield,
        kill: game.kills - initialKills,
        xp: after - before,
        duplicate: game.training.xp - after,
        hp: foe.hp,
      };
    });
    assert.ok(hunt.launched && hunt.arrowDamage > 0 && hunt.used === 1 && hunt.shield);
    assert.ok(hunt.kill === 1 && hunt.xp === 22 && hunt.duplicate === 0 && hunt.hp === 0);
    assert.deepEqual(errors, []);
    console.log('Озёрная марка', JSON.stringify({ coverage, hunt }));
  } finally {
    await page.close();
  }
};

if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    });
    try {
      await module.exports(browser);
    } finally {
      await browser.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
