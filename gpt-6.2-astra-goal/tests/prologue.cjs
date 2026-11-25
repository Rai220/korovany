'use strict';
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkOpening(
  browser,
  url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href,
) {
  const page = await browser.newPage({ viewport: { width: 1050, height: 660 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /shader|THREE|WebGL/i.test(m.text())) errors.push(m.text());
  });
  try {
    await page.goto(url);
    await page.locator('#oath-begin:enabled').click();
    await page.waitForFunction(() => active && prologue?.shot === 0 && world.renderer.info.render.frame > 0);
    const from = await page.evaluate(() => prologue.camera.position.toArray());
    await page.waitForFunction(
      () => prologue.shot === 1 && realmVoice.active && realmVoice.playhead > 0.12,
      {},
      { timeout: 45000 },
    );
    const played = await page.evaluate(() => ({
      scene: prologue.v.scene === ensureMarchView(world).scene,
      moved: prologue.camera.position.toArray(),
      name: realmVoice.speaker,
      body: prologue.savva.userData.actorStyle.witness,
      lip: prologue.savva.children.some((m) => m.morphTargetInfluences),
      boats: prologue.boat.position.x < prologue.boatOrigin.x,
      words: $('opening-words').textContent,
      seconds: realmVoice.playhead,
    }));
    assert.ok(played.scene && played.lip && played.boats && played.seconds > 0);
    assert.equal(played.body, 'savva');
    assert.equal(played.name, 'Савва');
    assert.notDeepEqual(played.moved, from);
    await page.locator('#opening-pause').click();
    const paused = await page.evaluate(() => prologue.elapsed);
    await page.waitForTimeout(370);
    assert.equal(await page.evaluate(() => prologue.elapsed), paused);
    await page.locator('#opening-pause').click();
    await page.waitForFunction(() => prologue?.shot === 5 && !$('opening-choice').hidden, null, {
      timeout: 65000,
    });
    await page.locator('[data-landing="token"]').click();
    await page.waitForFunction(() => !prologue && game.march && game.oath?.intro === 'token');
    const spawn = await page.evaluate(() => [game.march.x, game.march.z]);
    await page.keyboard.down('w');
    await page.waitForFunction((x) => game.march.x > x + 2, spawn[0], { timeout: 12000 });
    await page.keyboard.up('w');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => game.air > 0.08);
    await page.keyboard.press('m');
    await page.waitForSelector('#dialog[open] svg');
    await page.locator('[data-lake-list="aqueduct"]').click();
    await page.waitForFunction(() => game.march.mark === 'aqueduct' && !$('dialog').open);
    await page.keyboard.press('j');
    await page.waitForSelector('[data-journal-tab="oath"][aria-pressed="true"]');
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    const written = await page.evaluate(() => ({
      march: game.march.x,
      save: valid(readSlot()),
      choice: game.oath.intro,
    }));
    assert.ok(written.save && written.march > spawn[0] + 1);
    await page.reload();
    await page.click('#resume:visible');
    await page.waitForFunction(() => active && !prologue && game.march && game.oath.intro === 'token');
    assert.ok(Math.abs((await page.evaluate(() => game.march.x)) - written.march) < 0.2);
    await page.evaluate(() => {
      menu();
    });
    await page.click('#oath-begin');
    await page.waitForFunction(() => !!prologue);
    await page.click('#opening-skip');
    await page.keyboard.press('2');
    await page.waitForFunction(() => !prologue && game.oath?.intro === 'rope');
    assert.deepEqual(await page.evaluate(() => game.oath.notes), ['rope']);
    assert.deepEqual(errors, []);
    console.log(
      'PASS — real-time voiced introduction, moving camera and rig, pause/resume, both landings, dock movement, jump, journal, map and saved position.',
      { played, written },
    );
  } finally {
    await page.close();
  }
};
if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const browser = process.env.BROWSER_WS_ENDPOINT
      ? await chromium.connect(process.env.BROWSER_WS_ENDPOINT)
      : await chromium.launch({
          headless: true,
          executablePath: process.env.BROWSER_EXECUTABLE || undefined,
          args: ['--enable-unsafe-swiftshader'],
        });
    try {
      await module.exports(browser);
    } finally {
      await browser.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
