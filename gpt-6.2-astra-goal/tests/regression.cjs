const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: ['--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.click('#begin');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);

    const movement = await page.evaluate(() => {
      cancelAnimationFrame(frame);
      game.actors = [];
      Object.assign(game, { x: WORLD_LIMIT - 1, z: -50, yaw: -Math.PI / 2 });
      keys.add('KeyW');
      for (let i = 0; i < 30; i++) step(0.04);
      keys.clear();
      const eastExit = game.x;
      Object.assign(game, { x: -13, z: -50 });
      const guard = actor('guard', 'neutral', -10, -50);
      move(game, 8, 0);
      const gap = guard.x - game.x;
      move(game, 0, 1.2);
      move(game, 6, 0);
      return { eastExit, halfWidth: WORLD_LIMIT, gap, passed: game.x > guard.x };
    });
    assert.ok(movement.eastExit < -movement.halfWidth + 8 && movement.eastExit > -movement.halfWidth);
    assert.ok(movement.gap >= 0.739 && movement.gap < 1 && movement.passed);

    const hitch = await page.evaluate(() => {
      game.actors = [];
      Object.assign(game, { x: 10, z: -50 });
      Object.assign(game.wagon, { x: 0, z: -50, angle: Math.PI / 2, node: 1 });
      for (let i = 0; i < 200; i++) wagonTick(0.04);
      const stop = game.wagon.x;
      wagonTick(0.04);
      const waited = game.wagon.x === stop;
      move(game, 0, 3);
      let min = Infinity;
      const angles = Array.from({ length: 8 }, () => []);
      for (let i = 0; i < 45; i++) {
        wagonTick(0.04);
        min = Math.min(min, hitchDistance(game.x, game.z, game.wagon));
        world.animateTeam(game.wagon, 30 + i * 0.04);
        world.team.forEach((animal, j) =>
          animal.userData.legs.forEach((leg, k) => angles[j * 4 + k].push(leg.knee.rotation.x)),
        );
      }
      return {
        waited,
        resumed: game.wagon.x > stop,
        min,
        flex: angles.map((a) => Math.max(...a) - Math.min(...a)),
      };
    });
    assert.ok(hitch.waited && hitch.resumed && hitch.min > 0.36);
    assert.ok(hitch.flex.every((amplitude) => amplitude > 0.48));

    await page.evaluate(() => {
      game.stage = 1;
      game.wagon.cool = 0;
      const cow = bovineOffice();
      Object.assign(game, clearSpot(cow.x, cow.z + 2.1, game));
    });
    await page.keyboard.press('v');
    const notes = ['Свист', 'Звон', 'Стук'];
    const sequence = (await page.locator('.call-sequence').innerText())
      .split(' · ')
      .map((n) => notes.indexOf(n));
    await page.click('#cow-ready');
    await page.click('[data-call="' + ((sequence[0] + 1) % 3) + '"]');
    await page.waitForSelector('#cow-ready');
    await page.click('#cow-ready');
    for (const call of sequence) await page.click('[data-call="' + call + '"]');
    const saved = await page.evaluate(() => readSlot());
    assert.equal(saved.story.hoof, true);
    assert.equal(saved.robbed, 1);
    assert.equal(saved.stage, 2);
    await page.reload();
    await page.click('#resume');
    await page.waitForFunction(() => game?.story.hoof === true && game.robbed === 1);
    const merchantWithSquad = await page.evaluate(() => {
      cancelAnimationFrame(frame);
      game.side = 2;
      game.stage = 0;
      game.story.phase = 'origin';
      game.actors = [];
      game.x = -53.7;
      game.z = 53.2;
      actor('merchant', 'neutral', -56, 52.65, 'shop');
      actor('lord', 'friend', -53, 54, 'squad');
      return interactable()?.a.tag;
    });
    assert.equal(merchantWithSquad, 'shop');
    assert.deepEqual(errors, []);
    console.log(
      'PASS — WebGL, road seam, solid bodies, wagon yielding, eight legs, convoy signals and save/load.',
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
