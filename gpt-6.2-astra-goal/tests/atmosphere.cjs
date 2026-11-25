'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

module.exports = async function testAtmosphere(browser) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /WebGL|shader|THREE/i.test(m.text())) errors.push(m.text());
  });
  try {
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.click('#begin:enabled');
    await page.waitForFunction(() => active && world?.renderer.info.render.frame);
    const result = await page.evaluate(async () => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      closeModal();
      realmVoice.stop();
      scoreStop();
      game.actors = [];
      const initial = countryAlmanac({ x: 0, z: 0 });
      const instant = countrySeconds(game);
      keys.add('KeyW');
      const start = [game.x, game.z];
      for (let i = 0; i < 12; i++) step(0.04);
      keys.clear();
      const walk = Math.hypot(game.x - start[0], game.z - start[1]),
        elapsed = countrySeconds(game) - instant;
      const gl = world.renderer,
        target = new THREE.WebGLRenderTarget(112, 72);
      target.texture.colorSpace = THREE.SRGBColorSpace;
      const pixels = new Uint8Array(112 * 72 * 4);
      const luma = (scene) => {
        gl.setRenderTarget(target);
        gl.render(scene, world.camera);
        gl.readRenderTargetPixels(target, 0, 0, 112, 72, pixels);
        gl.setRenderTarget(null);
        let total = 0;
        for (let i = 0; i < pixels.length; i += 4)
          total += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
        return Math.round((total * 100) / (112 * 72)) / 100;
      };
      Object.assign(game, { x: -51, z: 63, yaw: 1.09, pitch: 0.21, air: 0 });
      world.lod(game.x, game.z);
      const frames = [];
      for (const hour of [6.4, 12, 17.5, 19.6, 22.7]) {
        game.worldSeconds = (hour / 24) * COUNTRY_DAY;
        world.display(game, 20 + hour, 0, 0, null);
        const pane = world.matCache.get(0x364842);
        frames.push({
          name: world.air.name,
          light: luma(world.scene),
          dir: world.airUniforms.lightDirection.value.toArray(),
          glass: pane.emissiveIntensity,
          aurora: world.air.aurora,
        });
      }
      const stored = save() && valid(readSlot()) && readSlot().worldSeconds === game.worldSeconds;
      const before = countrySeconds(game);
      waitForCountryHour(game, 6.4);
      const next = countryAlmanac(game);
      const rollover = next.day === 2 && countrySeconds(game) > before && Math.abs(next.hour - 6.4) < 1e-9;
      const rain = [];
      for (let h = 0; h < 48; h += 0.25) rain.push(countryWeather({ x: 70, z: 67 }, (h / 24) * COUNTRY_DAY));
      const seam = Math.abs(
        countryWeather({ x: 70, z: 67 }, 110) - countryWeather({ x: 70 + PERIOD, z: 67 - PERIOD }, 110),
      );
      enterRoom('inn');
      game.worldSeconds = 0.5 * COUNTRY_DAY;
      world.display(game, 30, 0, 0, null);
      const room = world.rooms.get('inn'),
        windowCount = room.userData.windowViews.length,
        indoorNoon = room.userData.day.intensity;
      const timeInside = countrySeconds(game);
      step(0.04);
      const interiorElapsed = countrySeconds(game) - timeInside;
      game.worldSeconds = 0.96 * COUNTRY_DAY;
      world.display(game, 31, 0, 0, null);
      const indoorNight = room.userData.day.intensity;
      leaveRoom();
      Object.assign(game, { x: -50, z: 5, pitch: 0, yaw: 0 });
      const budget = [];
      for (const quality of ['light', 'balanced', 'high']) {
        prefs.quality = quality;
        applyGraphics();
        world.lod(game.x, game.z);
        world.display(game, 42, 0, 0, null);
        budget.push({
          quality,
          lamps: world.countryLamps.lights.filter((l) => l.visible).length,
          mirror: world.riverMirror.active.value,
          shafts: world.countryShafts.some((m) => m.visible),
          mist: world.countryMist.group.visible,
        });
      }
      const roadside = [];
      Object.assign(game, { x: oathRoadside.x, z: oathRoadside.z + 1.65 });
      world.lod(game.x, game.z);
      game.oath = newOath();
      for (const ending of ['hearing', 'refuge', 'vigil', null]) {
        game.oath.ending = ending;
        delete game.oathRoadGift;
        world.display(game, 53.5, 0, 0, null);
        const active = [...(world.roadsideViews?.values() || [])].filter((v) => v.visible).length;
        const onPath =
          world.free(marchEntrance.x, marchEntrance.z) &&
          world.free(fieldSites.ferry.x, fieldSites.ferry.z + 1.95) &&
          world.free(game.x, game.z);
        const beacon = world.countryLamps.nearest.some(
          (p) => Math.abs(p.x - oathRoadside.x - watchBeacon.x) < 1e-6,
        );
        const solid = !world.free(oathRoadside.x - (ending === 'vigil' ? 0.61 : 0), oathRoadside.z);
        const prompt = interactable()?.roadside === true;
        if (ending) game.oathRoadGift = ending;
        drawOathRoadside(world, game, 54);
        const giftLeft = world.roadsideView?.userData.gift.visible === true;
        roadside.push({ ending, active, onPath, beacon, solid, prompt, giftLeft });
      }
      target.dispose();
      return {
        roadside,
        initial: initial.time,
        walk,
        elapsed,
        interiorElapsed,
        frames,
        stored,
        rollover,
        rain: [Math.min(...rain), Math.max(...rain)],
        seam,
        indoorNoon,
        indoorNight,
        windowCount,
        budget,
      };
    });
    console.log(JSON.stringify({ result, errors }));
    assert.deepEqual(errors, []);
    for (const spot of result.roadside) {
      assert.equal(spot.active, Number(!!spot.ending));
      assert.ok(spot.onPath);
      assert.equal(spot.beacon, spot.ending === 'vigil');
      assert.equal(spot.solid, !!spot.ending);
      assert.equal(spot.prompt, !!spot.ending);
      assert.equal(spot.giftLeft, false);
    }
    assert.equal(result.initial, '16:25');
    assert.ok(result.walk > 0.4 && Math.abs(result.elapsed - 0.48) < 1e-7);
    assert.ok(
      Math.abs(result.interiorElapsed - 0.04) < 1e-7 &&
        result.windowCount === 2 &&
        result.indoorNoon > result.indoorNight * 2,
    );
    assert.deepEqual(
      result.frames.map((f) => f.name),
      ['Рассвет', 'День', 'Золотой час', 'Синие сумерки', 'Ночь'],
    );
    assert.ok(result.frames[1].light > result.frames[4].light * 1.6 && result.frames[4].light > 8);
    assert.ok(result.frames[1].glass + 0.4 < result.frames[4].glass && result.frames[4].aurora > 0.5);
    assert.ok(result.stored && result.rollover && result.seam < 1e-8);
    assert.ok(result.rain[0] < 0.12 && result.rain[1] > 0.73);
    assert.deepEqual(
      result.budget.map((v) => v.lamps),
      [1, 2, 3],
    );
    assert.deepEqual(
      result.budget.map((v) => v.mirror),
      [0, 1, 1],
    );
    assert.ok(!result.budget[0].mist && !result.budget[0].shafts && result.budget[2].mist);
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
          channel: process.env.CHROME_CHANNEL || undefined,
          executablePath: process.env.BROWSER_EXECUTABLE || undefined,
          args: ['--enable-unsafe-swiftshader'],
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
