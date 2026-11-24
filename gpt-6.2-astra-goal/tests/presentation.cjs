const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && /WebGL|THREE|shader/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.locator('.faction').nth(1).click();
    await page.click('#begin:enabled');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      realmVoice.stop();
      Object.assign(game, { x: -37, z: -50, yaw: 0, pitch: 0 });
      window.paint = (t, attack = 0) => world.display(game, t, attack, 0, null);
      paint(1);
    });
    await page.keyboard.press('t');
    const clip = await page.evaluate(() => {
      paint(1.05);
      const actor = world.fieldHero,
        head = actor.getObjectByName('Head');
      let bones = 0;
      actor.traverse((o) => {
        if (o.isSkinnedMesh) bones = Math.max(bones, o.skeleton.bones.length);
      });
      const q = actor.getObjectByName('UpperArm_L') || actor.getObjectByName('LeftArm') || head;
      let initial = q.quaternion.clone();
      for (let i = 1; i <= 13; i++) paint(1.05 + i / 30, 0.6);
      return {
        bones,
        visible: actor.visible,
        posed: actor.userData.state,
        movement: q.quaternion.angleTo(initial),
        cameraDistance: world.camera.position.distanceTo(actor.position),
        weapon: world.weapon.visible,
      };
    });
    assert.ok(clip.bones >= 55 && clip.visible && !clip.weapon && clip.cameraDistance > 2);
    assert.ok(clip.posed === 'slash' && clip.movement > 0.012, JSON.stringify(clip));
    const guardMotion = await page.evaluate(() => {
      const pose = (pressed, t) => {
        game.blockTime = pressed ? 0.1 : 0;
        world.updateHands(game, t, 0, 0);
        return world.guardLift.value;
      };
      pose(false, 3);
      const start = pose(true, 3.017);
      const halfway = pose(true, 3.065);
      for (let i = 5; i <= 33; i++) pose(true, 3 + i / 60);
      const raised = world.guardLift.value;
      const lowering = pose(false, 3.57);
      for (let i = 35; i < 90; i++) pose(false, 3 + i / 60);
      return [
        start,
        halfway,
        raised,
        lowering,
        world.guardLift.value,
        world.rightArm.group.visible,
        world.shield.visible,
      ];
    });
    assert.ok(
      guardMotion[0] >= 0 &&
        guardMotion[0] < guardMotion[1] &&
        guardMotion[1] < guardMotion[2] &&
        guardMotion[2] > 0.94,
    );
    assert.ok(
      guardMotion[3] > 0.45 &&
        guardMotion[3] < 1 &&
        guardMotion[4] < 0.01 &&
        guardMotion[5] &&
        guardMotion[6],
    );
    await page.keyboard.press('2');
    await page.keyboard.down('r');
    const focus = await page.evaluate(() => {
      for (let i = 0; i < 13; i++) paint(1.65 + i * 0.055);
      return [
        world.camera.fov,
        world.bow.visible,
        world.fieldHero.visible,
        $('play').classList.contains('bow-focus'),
      ];
    });
    await page.keyboard.up('r');
    assert.ok(focus[0] < 49 && focus[1] && !focus[2] && focus[3], String(focus));
    await page.keyboard.press('1');
    await page.keyboard.press('t');
    await page.evaluate(() => {
      const captain = game.actors.find((a) => a.tag === 'commander');
      Object.assign(game, clearSpot(captain.x, captain.z + 1.65, game));
      drawHud();
    });
    await page.keyboard.press('e');
    await page.waitForFunction(() => dialogueStage?.renderer.info.render.frame > 3 && realmVoice.active);
    const face = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 70;
      const ctx = c.getContext('2d');
      ctx.drawImage(dialogueStage.renderer.domElement, 0, 0, 70, 70);
      const pixels = ctx.getImageData(0, 0, 70, 70).data,
        colors = new Set();
      let solid = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i + 3] > 235) {
          solid++;
          colors.add([pixels[i] >> 4, pixels[i + 1] >> 4, pixels[i + 2] >> 4].join(','));
        }
      return [solid, colors.size, dialogueStage.subject.userData.state];
    });
    assert.ok(face[0] > 200 && face[1] > 18 && face[2] === 'talk', String(face));
    await page.click('#reply0');
    assert.equal(await page.evaluate(() => Boolean(dialogueStage.subject) || Boolean(portraitFrame)), false);
    await page.evaluate(() => {
      realmVoice.stop();
      Object.assign(game, { x: -50, z: streamZ(-50) + 4, yaw: Math.PI / 2 });
      scoreAir(false);
    });
    await page.waitForFunction(() => Boolean(fieldAirNodes?.water) && fieldBuffers.size >= 4);
    const near = await page.evaluate(async () => {
      scoreAir(false);
      await new Promise((r) => setTimeout(r, 710));
      return [
        fieldAirNodes.water.gain.gain.value,
        fieldAirNodes.water.pan.pan.value,
        ...['grove', 'water', 'swish', 'ring'].map((k) => fieldBuffers.get(k).duration),
      ];
    });
    assert.ok(near[0] > 0.13 && near[1] > 0.25 && near.slice(2).every((s) => s > 0.05), String(near));
    const far = await page.evaluate(async () => {
      game.z = streamZ(game.x) + 50;
      scoreAir(false);
      await new Promise((r) => setTimeout(r, 920));
      return fieldAirNodes.water.gain.gain.value;
    });
    assert.ok(far < near[0] * 0.3, 'Water recedes with distance');
    const migrated = await page.evaluate(() => {
      const saved = JSON.parse(JSON.stringify(game));
      delete saved.story.saltEdition;
      saved.story.hoof = true;
      saved.story.dairyStamps = [0];
      saved.story.entries = [
        ['Подпись копытом', 'старый текст'],
        ['Маслобойня', 'старая печать'],
      ];
      localStorage.setItem(saveKey(), JSON.stringify(saved));
      const resumed = readSlot();
      return [
        resumed.story.entries.map((e) => e[0]),
        resumed.coins === game.coins,
        resumed.story.hoof,
        resumed.story.dairyStamps[0],
      ];
    });
    assert.deepEqual(migrated, [['Подпись возницы', 'Западная переправа'], true, true, 0]);
    assert.deepEqual(errors, []);
    console.log(
      'PASS — animated shoulder camera, bow optics, spoken and rendered captain, positional recordings, old journal.',
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
