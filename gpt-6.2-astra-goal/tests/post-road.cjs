const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href;

function installDriver() {
  cancelAnimationFrame(frame);
  window.requestAnimationFrame = () => 0;
  window.drive = (perfect) => {
    const gates = new Set();
    for (let i = 0; i < 3600; i++) {
      const d = game.delivery,
        w = game.wagon;
      if (d.phase !== 'running') return { jars: d.jars, gates: [...gates], time: d.time, phase: d.phase };
      const b = postRoad[d.gate],
        dx = b.x - w.x,
        dz = b.z - w.z,
        dist = Math.hypot(dx, dz);
      const a = angles(Math.atan2(dx, dz) - w.angle);
      keys.clear();
      if (Math.abs(a) > 0.055) keys.add(a > 0 ? 'KeyA' : 'KeyD');
      const speed =
        Math.abs(a) > 0.65 ? 1 : b.bridge && dist < 12 && perfect ? 4.2 : b.turn && dist < 7 ? 3.4 : 9;
      if (d.speed < speed) keys.add('KeyW');
      else if (d.speed > speed + 0.35) keys.add('KeyS');
      if (b.bar && dist < 16 && !d.opened)
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      gates.add(d.gate);
      step(0.04);
      gameTime += 0.04;
    }
    throw Error('The postal carriage did not reach its destination.');
  };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'],
  });
  try {
    const p = await browser.newPage({ viewport: { width: 1000, height: 690 } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(url);
    await p.click('#post-race');
    await p.click('#post-start');
    await p.keyboard.press('v');
    assert.equal(await p.evaluate(() => game.delivery.seated), true);
    await p.keyboard.press('v');
    assert.equal(await p.evaluate(() => game.delivery.seated), false);
    await p.keyboard.down('w');
    await p.waitForFunction(() => game.delivery.speed > 0.15 && game.wagon.z < 39);
    await p.keyboard.up('w');
    await p.keyboard.press('Escape');
    await p.waitForSelector('#post-resume');
    const elapsed = await p.evaluate(() => game.delivery.time);
    await p.waitForTimeout(180);
    assert.equal(await p.evaluate(() => game.delivery.time), elapsed);
    await p.click('#post-recover');
    await p.evaluate(installDriver);
    assert.ok((await p.evaluate(() => game.delivery.time)) >= elapsed + 4);
    const closed = await p.evaluate(() => {
      keys.add('KeyW');
      for (let i = 0; i < 135; i++) {
        step(0.04);
        gameTime += 0.04;
      }
      keys.clear();
      return [game.delivery.gate, game.delivery.opened, game.delivery.jars, game.wagon.z];
    });
    assert.deepEqual(closed.slice(0, 3), [1, false, 5]);
    assert.ok(closed[3] > 15);
    const finish = await p.evaluate(() => drive(true));
    assert.deepEqual(finish.gates, [1, 2, 3, 4, 5]);
    assert.equal(finish.jars, 5);
    await p.click('#post-again');
    await p.click('#post-start');
    const perfect = await p.evaluate(() => drive(true));
    assert.equal(perfect.jars, 6);
    await p.click('#post-again');
    await p.click('#post-start');
    assert.equal((await p.evaluate(() => drive(false))).jars, 5);
    assert.equal(await p.evaluate(() => bestDelivery().jars), 6);
    await p.click('#post-again');
    await p.click('#post-start');
    // Recreate six high-speed approaches from the same starting point; collision, breakage and end screen are real.
    await p.evaluate(() => {
      for (let crash = 0; crash < 6; crash++) {
        const w = game.wagon;
        w.x = -50;
        w.z = 39;
        w.angle = Math.PI;
        keys.add('KeyW');
        for (let i = 0; i < 120 && game.delivery.phase === 'running'; i++) {
          step(0.04);
          gameTime += 0.04;
        }
        keys.clear();
      }
    });
    assert.equal(await p.locator('#dialog-title').innerText(), 'Крынки вдребезги');
    assert.equal(await p.evaluate(() => bestDelivery().jars), 6);
    assert.deepEqual(
      await p.evaluate(() => [
        localStorage.getItem(saveKey()),
        localStorage.getItem(saveKey() + '.checkpoint'),
      ]),
      [null, null],
    );
    await p.click('#post-exit');
    await p.click('#begin');
    await p.evaluate(() => {
      game.stage = 3;
      game.coins = 80;
      window.originalCampaign = game;
      shop();
    });
    await p.click('#hire-post');
    await p.click('#post-start');
    await p.evaluate(() => drive(true));
    await p.click('#post-again');
    await p.click('#post-exit');
    assert.deepEqual(
      await p.evaluate(() => [
        game === originalCampaign,
        game.stage,
        game.coins,
        readSlot().coins,
        game.story.entries.at(-1)[0],
      ]),
      [true, 3, 120, 120, 'Молочная почта'],
    );
    await p.close();

    const mobile = await browser.newPage({
      viewport: { width: 412, height: 850 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1.5,
    });
    mobile.on('pageerror', (e) => errors.push(String(e)));
    await mobile.goto(url);
    await mobile.tap('#post-race');
    await mobile.tap('#post-start');
    const stick = await mobile.locator('#stick').boundingBox(),
      client = await mobile.context().newCDPSession(mobile);
    const x = stick.x + stick.width * 0.5,
      y = stick.y + stick.height * 0.5;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - stick.height * 0.31 }],
    });
    await mobile.waitForFunction(() => keys.has('KeyW') && game.delivery.speed > 0.25);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await mobile.evaluate(() => keys.has('KeyW')), false);
    await mobile.evaluate(() => {
      game.wagon.z = 29;
      game.z = 29;
      game.delivery.bell = 0;
    });
    await mobile.tap('#post-view');
    assert.equal(await mobile.evaluate(() => game.delivery.seated), true);
    await mobile.tap('#post-bell');
    assert.equal(await mobile.evaluate(() => game.delivery.opened), true);
    assert.deepEqual(errors, []);
    console.log(
      'PASS — two keyboard driving lines, barriers, fragile cargo, timer pause, recovery penalty, best result, defeat, campaign pay and touch steering/bell.',
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
