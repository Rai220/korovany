'use strict';

const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkImpact(
  browser,
  url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href,
) {
  const page = await browser.newPage({ viewport: { width: 1040, height: 650 } });
  page.setDefaultTimeout(65000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const plate = async (name) => {
    if (process.env.IMPACT_SHOTS)
      await page.screenshot({ path: resolve(process.env.IMPACT_SHOTS, name + '.png') });
  };
  try {
    await page.goto(url);
    await page.locator('#factions button').nth(1).click();
    await page.click('#begin:enabled');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      closeModal();
      scoreStop();
      realmVoice.stop();
      keys.clear();
      game.story.started = true;
      game.story.shieldTip = true;
      Object.assign(game, { x: -21, z: -50, actors: [], yaw: 0, pitch: 0, health: 32, hits: 0, bleed: 0 });
      window.rearGuard = actor('guard', 'hostile', game.x, game.z + 1.8, 'patrol');
      rearGuard.angle = Math.PI;
      resetImpacts(game);
      drawHud();
      world.display(game, gameTime, 0, 0, null);
    });
    await plate('before');
    const hit = await page.evaluate(() => {
      const base = { x: game.x, z: game.z };
      for (let i = 0; i < 1200 && !game.hits; i++) {
        // A generated patrol may flank before committing. The player turns away during its wind-up.
        if (rearGuard.windup > 0)
          game.yaw = Math.atan2(wrapped(rearGuard.x - game.x), wrapped(rearGuard.z - game.z));
        gameTime += 0.015;
        step(0.015);
      }
      if (!game.hits) throw Error('Patrol never struck the hero');
      drawHud();
      world.display(game, gameTime, 0, 0, null);
      window.placeOfHit = base;
      return {
        health: game.health,
        side: $('impact-call').textContent,
        relative: angles(blow.bearing + game.yaw),
        warning: $('health-warning').textContent,
        edges: +$('hurt').style.opacity,
        visible: [...$('hit-arc').children].filter((x) => !x.hidden).length,
        washed: +getComputedStyle($('hurt')).opacity,
      };
    });
    assert.match(hit.side, /со спины|сзади/);
    assert(Math.cos(hit.relative) < -0.8);
    assert(hit.health < 32 && hit.visible === 1 && hit.washed > 0.7);
    assert.match(hit.warning, /Мало здоровья/);
    await plate('rear');
    const displacement = await page.evaluate(() => {
      game.actors = [];
      const facing = game.yaw;
      for (let i = 0; i < 50; i++) {
        gameTime += 0.02;
        step(0.02);
      }
      drawHud();
      world.display(game, gameTime, 0, 0, null);
      const alive =
        $('play').classList.contains('health-low') && getComputedStyle($('blood-loss')).opacity !== '0';
      return {
        alongFacing:
          -wrapped(game.x - placeOfHit.x) * Math.sin(facing) -
          wrapped(game.z - placeOfHit.z) * Math.cos(facing),
        length: distance(game, placeOfHit),
        facing: game.yaw - facing,
        low: alive,
      };
    });
    assert(
      displacement.alongFacing > 0.48 &&
        displacement.length < 2 &&
        displacement.facing === 0 &&
        displacement.low,
    );
    await plate('low');
    await page.keyboard.press('h');
    assert.equal(await page.evaluate(() => $('play').classList.contains('health-low')), false);

    const other = await page.evaluate(() => {
      resetImpacts(game);
      Object.assign(game, { health: 100, yaw: 0, blockTime: 1, parryWindow: 0, stamina: 90, hits: 0, evade: 0 });
      hitPlayer(12, { x: game.x, z: game.z - 1, ranged: true });
      const blocked = [game.health, blow.xSpeed, blow.zSpeed, blow.marks.filter(Boolean).length];
      game.blockTime = 0;
      game.evade = 0.2;
      hitPlayer(17, { x: game.x, z: game.z + 1 });
      const evaded = game.health;
      game.evade = 0;
      hitPlayer(10, { x: game.x + 2, z: game.z });
      hitPlayer(10, { x: game.x - 2, z: game.z });
      const both = [...$('hit-arc').children].filter((x) => !x.hidden);
      const anglesBefore = both.map((x) => x.style.transform);
      game.yaw = Math.PI;
      drawImpactHud(game);
      const anglesAfter = both.map((x) => x.style.transform);
      game.health = 12;
      drawHud();
      const critical = $('play').classList.contains('health-critical') && $('health-warning').textContent;
      return { blocked, evaded, anglesBefore, anglesAfter, critical };
    });
    assert.deepEqual(other.blocked, [100, 0, 0, 0]);
    assert.equal(other.evaded, 100);
    assert.equal(other.anglesBefore.length, 2);
    assert.notEqual(...other.anglesBefore);
    assert.notDeepEqual(other.anglesAfter, other.anglesBefore);
    assert.match(other.critical, /На исходе/);
    await page.keyboard.press('k');
    await page.reload();
    await page.click('#resume');
    await page.waitForFunction(
      () => active && game.health === 12 && $('play').classList.contains('health-critical'),
    );
    assert.equal(await page.evaluate(() => $('impact-call').hidden), true);
    const maps = await page.evaluate(() => {
      cancelAnimationFrame(frame);
      closeModal();
      keys.clear();
      game.actors = [];
      const outdoors = [game.x, game.z];
      game.march = { ...marchSites.mouth };
      game.health = 100;
      game.hits = 0;
      game.evade = 0;
      game.blockTime = 0;
      game.yaw = 0;
      resetImpacts(game);
      const lakeStart = game.march.z;
      hitPlayer(12, { x: game.march.x, z: game.march.z + 1, ranged: true });
      for (let i = 0; i < 45; i++) stepImpacts(game, 0.02);
      const lake = lakeStart - game.march.z;
      const stays = outdoors[0] === game.x && outdoors[1] === game.z;
      game.march = null;
      game.inside = 'palace';
      enterDungeon('palace');
      resetImpacts(game);
      const radius = bodyRadius(game);
      // Locate a real floor cell ending at a wall, with enough open space for the player's capsule.
      const dungeon = underways.palace;
      let wall = null;
      for (const key of dungeon.tiles) {
        const cell = key.split(',').map(Number),
          p = dungeonPoint(cell);
        for (let d = 0; d < 3; d += 0.1) {
          if (dungeonFree(p.x + d, p.z, radius) && !dungeonFree(p.x + d + 0.19, p.z, radius)) {
            wall = { x: p.x + d, z: p.z };
            break;
          }
        }
        if (wall) break;
      }
      if (!wall) throw Error('Could not find a solid dungeon wall');
      game.roomX = wall.x - 0.36;
      game.roomZ = wall.z;
      const start = game.roomX;
      hitPlayer(25, { x: start - 1, z: wall.z });
      for (let i = 0; i < 50; i++) stepImpacts(game, 0.02);
      return {
        lake,
        stays,
        wallTravel: game.roomX - start,
        free: dungeonFree(game.roomX, game.roomZ, radius),
        remained: game.roomX <= wall.x + 0.19,
      };
    });
    assert(maps.lake > 0.35 && maps.lake < 1.1 && maps.stays);
    assert(maps.wallTravel >= 0 && maps.wallTravel < 0.65 && maps.remained && maps.free);
    assert.deepEqual(errors, []);
    console.log(
      'PASS — patrol hit from behind, world displacement, two attack bearings, block/dodge, low health, healing and saved health, lake arrow and solid dungeon wall.',
      JSON.stringify({ hit, displacement, other, maps }),
    );
  } finally {
    await page.close();
  }
};
if (require.main === module)
  (async () => {
    const { chromium } = require('playwright');
    const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      headless: true,
    });
    try {
      await module.exports(b);
    } finally {
      await b.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
