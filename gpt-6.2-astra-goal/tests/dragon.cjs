'use strict';

const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

// Accepts the same shared Playwright Browser used by the other field suites.
module.exports = async function checkDragon(browser) {
  const page = await browser.newPage({ viewport: { width: 1120, height: 730 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.click('#begin');
    await page.waitForFunction(() => active && world && world.renderer.info.render.frame > 0);
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      closeModal();
      realmVoice.stop();
      scoreStop();
      game.actors = [];
      game.story.started = true;
      game.story.aimTip = game.story.shieldTip = true;
      game.x = 98.5;
      game.z = 106;
      game.air = game.vy = 0;
      gameTime = 4;
      const d = wakeDragon();
      window.sim = (seconds) => {
        for (let i = 0; i < Math.ceil(seconds * 50); i++) {
          gameTime += 0.02;
          step(0.02);
        }
      };
      window.aimBoss = (zone = 'chest') => {
        const distanceNow = distance(game, d),
          travel = distanceNow / 55;
        let x = 0,
          z = 0,
          y = 1.98;
        if (zone === 'throat') {
          z = 2.33;
          y = 2.19;
        }
        if (zone === 'wing') {
          x = 3.88;
          z = -0.6;
          y = dragonWingSurface({ ...d, anim: d.anim + travel }, x, z) ?? 3.1;
        }
        const tx = d.x + Math.cos(d.yaw) * x + Math.sin(d.yaw) * z;
        const tz = d.z - Math.sin(d.yaw) * x + Math.cos(d.yaw) * z;
        game.yaw = Math.atan2(game.x - tx, game.z - tz);
        const dist = Math.hypot(tx - game.x, tz - game.z);
        const delta = walkingSurface(d.x, d.z) + d.lift + y - walkingSurface(game.x, game.z) - 1.71;
        game.pitch = Math.atan2(delta - 0.027 * dist + 0.00105 * dist * dist, dist);
      };
      window.input = (type, code) =>
        document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
      window.press = (code) => {
        input('keydown', code);
        input('keyup', code);
      };
      aimBoss();
      sim(0.12);
    });
    await page.keyboard.press('2');
    await page.keyboard.press('f');
    const early = await page.evaluate(() => {
      sim(0.91);
      return {
        hp: game.dragon.hp,
        max: game.dragon.maxHp,
        rank: heroLevel(),
        awake: game.dragon.engaged,
        level: game.wardWarningAt,
        arrows: game.arrows,
      };
    });
    assert.equal(early.rank, 1);
    assert.equal(early.hp, early.max);
    assert.ok(early.awake);
    assert.ok(Number.isFinite(early.level));
    const result = await page.evaluate(() => {
      window.savedDragonFrames = {};
      game.x = 94;
      game.z = 89;
      sim(6);
      const reset = !game.dragon.engaged && game.dragon.hp === game.dragon.maxHp;
      awardXP(560, 'Учебный стенд');
      for (const id of ['focus', 'medic', 'stride', 'bulwark']) learnTalent(id);
      const before = game.training.xp,
        d = game.dragon;
      Object.assign(game, { x: 98.5, z: 105.8, air: 0, vy: 0 });
      input('keydown', 'KeyR');
      const phases = new Set(),
        modes = new Set(),
        damage = [],
        roarHits = [],
        exposedHits = [],
        startArrows = game.arrows;
      let sawFire = false,
        brands = 0,
        dodgedFire = false,
        dodgedOrb = false,
        dodgedCharge = false,
        lastMode = '',
        strafe = 0,
        fireHP = 0,
        markHP = 0,
        markDist = 0,
        airHit = false,
        chargeHP = 0,
        swordHits = 0;
      const setStrafe = (state) => {
        const desired = state ? 'KeyD' : null;
        if ((strafe || null) === desired) return;
        if (strafe) input('keyup', strafe);
        if (desired) input('keydown', desired);
        strafe = desired;
      };
      for (let tick = 0; tick < 50 * 130 && game.health > 0 && d.hp > 0; tick++) {
        aimBoss();
        phases.add(d.phase);
        modes.add(d.mode);
        if (d.mode !== lastMode) {
          if (d.mode === 'inhale') {
            fireHP = game.health;
            if (!savedDragonFrames.inhale)
              savedDragonFrames.inhale = { s: structuredClone(game), t: gameTime };
          }
          if (d.mode === 'chargeWind') chargeHP = game.health;
          if (lastMode === 'charge' && d.mode === 'recover' && d.phase === 3)
            dodgedCharge = game.health === chargeHP;
          if (lastMode === 'flame' && d.mode !== 'flame') {
            sawFire = true;
            dodgedFire ||= game.health >= fireHP;
            setStrafe(false);
          }
          if (d.mode === 'brand') {
            brands++;
            markHP = game.health;
          }
          if (d.mode === 'impact') {
            markDist = Math.hypot(game.x - d.markX, game.z - d.markZ);
            dodgedOrb ||= markDist > 2.8 && game.health === markHP;
            setStrafe(false);
          }
          lastMode = d.mode;
        }
        if (
          ['flame', 'orbit', 'brand', 'charge', 'roar', 'cast'].includes(d.mode) &&
          d.left < d.span * 0.66 &&
          !savedDragonFrames[d.mode]
        )
          savedDragonFrames[d.mode] = { s: structuredClone(game), t: gameTime };
        if (d.mode === 'chargeWind' && d.phase === 3) {
          setStrafe(true);
        } else if (d.mode === 'inhale' || (d.mode === 'flame' && d.left > d.span * 0.72)) {
          setStrafe(true);
        } else if (d.mode === 'brand') {
          if (d.span - d.left < 0.93) setStrafe(true);
          else setStrafe(false);
        } else setStrafe(false);
        if (game.health < 50 && game.bandages) press('KeyH');
        const atWing =
          d.phase === 2 &&
          d.hp > d.maxHp * 0.29 &&
          brands >= 1 &&
          ['orbit', 'brand', 'cast', 'impact'].includes(d.mode);
        const atThroat =
          d.phase === 1 &&
          d.mode === 'flame' &&
          d.left < 0.89 &&
          !exposedHits.some(([m, z]) => m === 'flame' && z === 'throat');
        const canFire =
          (d.mode === 'roar' && !sawFire) ||
          atWing ||
          atThroat ||
          (sawFire && d.phase < 3 && d.mode === 'recover');
        if (atWing || atThroat) aimBoss(atWing ? 'wing' : 'throat');
        if (d.phase === 3 && dodgedCharge) {
          input('keyup', 'KeyR');
          if (game.weapon !== 'sword') press('Digit1');
          if (distance(game, d) > 2.55 && !aimedEnemy(3.18, 0.82)) input('keydown', 'KeyW');
          else input('keyup', 'KeyW');
          if (swing <= 0 && aimedEnemy(3.18, 0.82)?.kind === 'dragon') {
            const old = d.hp;
            press('KeyG');
            if (d.hp < old) {
              swordHits++;
              damage.push(['sword', old - d.hp]);
            }
          }
        }
        if (canFire && !game.arrow && swing <= 0 && game.stamina >= 9 && game.arrows) press('KeyF');
        const hp = d.hp,
          m = d.mode,
          projectile = game.arrow,
          h = d.lift;
        sim(0.02);
        if (d.hp < hp) {
          damage.push([m, hp - d.hp, projectile?.dragonZone]);
          if (m === 'roar') roarHits.push(hp - d.hp);
          if (projectile?.dragonZone) exposedHits.push([m, projectile.dragonZone, hp - d.hp]);
          if (h > 3) airHit = true;
        }
      }
      input('keyup', 'KeyR');
      input('keyup', 'KeyW');
      setStrafe(false);
      return {
        reset,
        before,
        after: game.training.xp,
        phases: [...phases],
        modes: [...modes],
        hp: d.hp,
        player: game.health,
        used: startArrows - game.arrows,
        damage,
        roarHits,
        exposedHits,
        dodgedFire,
        dodgedOrb,
        dodgedCharge,
        swordHits,
        markDist,
        airHit,
        position: [game.x, game.z, d.x, d.z],
        talents: [...game.training.learned],
      };
    });
    console.log(JSON.stringify({ early, result }));
    assert.ok(result.reset);
    assert.ok(
      result.roarHits.length >= 2 && result.roarHits.every((h) => h > 0 && h <= 12),
      'Repeated front shots should glance off the overlapping plates during the opening roar',
    );
    assert.ok(result.exposedHits.some(([m, z, h]) => m === 'flame' && z === 'throat' && h > 65));
    assert.ok(
      result.exposedHits.some(
        ([m, z, h]) => ['orbit', 'brand', 'cast', 'impact'].includes(m) && z === 'wing' && h > 65,
      ),
    );
    assert.deepEqual(result.phases, [1, 2, 3]);
    assert.equal(result.hp, 0);
    assert.ok(result.player > 0);
    assert.ok(result.dodgedFire);
    assert.ok(result.dodgedOrb);
    assert.ok(result.airHit);
    assert.ok(result.dodgedCharge);
    assert.ok(result.swordHits > 0);
    assert.equal(result.after - result.before, 200);
    const loot = await page.evaluate(() => {
      const d = game.dragon,
        coins = game.coins,
        count = game.story.entries.length;
      input('keydown', 'KeyW');
      for (let i = 0; i < 600 && !dragonLootPrompt(); i++) {
        aimBoss();
        sim(0.02);
      }
      input('keyup', 'KeyW');
      const near = !!dragonLootPrompt();
      press('KeyE');
      press('KeyE');
      press('KeyK');
      const record = JSON.parse(localStorage.getItem(saveKey()));
      return {
        near,
        coins: game.coins - coins,
        entries: game.story.entries.length - count,
        taken: d.looted,
        record: valid(record) && record.dragon.hp === 0 && record.dragon.looted,
        remaining: distance(d, game),
      };
    });
    const controls = await page.evaluate(() => {
      const finished = game,
        rec = savedDragonFrames;
      const out = {};
      for (const [id, seconds] of [
        ['inhale', 3.16],
        ['brand', 2.29],
      ]) {
        game = structuredClone(rec[id].s);
        const hp = game.health;
        for (let i = 0; i < seconds * 50; i++) dragonTick(0.02);
        out[id] = hp - game.health;
      }
      game = finished;
      return out;
    });
    console.log(JSON.stringify({ controls }));
    assert.ok(controls.inhale > 0 && controls.brand > 0);
    if (process.env.DRAGON_SHOTS) {
      for (const mode of ['flame', 'orbit', 'charge', 'cast']) {
        await page.evaluate((mode) => {
          const rec = savedDragonFrames[mode];
          game = structuredClone(rec.s);
          gameTime = rec.t;
          const d = game.dragon;
          prefs.motion = false;
          drawHud();
          world.lod(game.x, game.z);
          world.display(game, gameTime, 0, 0, null);
          const rig = world.sargat.rig;
          for (let i = 0; i < 12; i++) poseSargat(rig, d, gameTime + i * 0.095);
          world.display(game, gameTime + 1.17, 0, 0, null);
        }, mode);
        await page.screenshot({
          path: resolve(process.env.DRAGON_SHOTS, 'sargat-' + mode + '.jpg'),
          quality: 91,
        });
      }
    }
    console.log(JSON.stringify({ loot, errors }));
    assert.ok(loot.near);
    assert.equal(loot.coins, 145);
    assert.equal(loot.entries, 1);
    assert.ok(loot.taken && loot.record);
    assert.deepEqual(errors, []);
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
