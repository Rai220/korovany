const assert = require('node:assert/strict');
const { resolve } = require('node:path'),
  { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
async function checkProgression(
  browser,
  url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href,
) {
  const page = await browser.newPage({ viewport: { width: 1120, height: 700 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(url);
    await page.locator('.faction').nth(1).click();
    await page.click('#explore-entry:enabled');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);
    const entrance = await page.evaluate(() => [
      heroLevel(),
      distance(game, fieldPoint('ferry')) < 8,
      game.exploration.tracked,
      document.querySelectorAll('[data-field-track]').length,
    ]);
    assert.deepEqual(entrance, [1, true, 'river', 3]);
    const install = () =>
      page.evaluate(() => {
        cancelAnimationFrame(frame);
        closeModal();
        soundOn = false;
        realmVoice.stop();
        scoreStop();
        game.story.started = true;
        window.rounds = (n) => {
          for (let i = 0; i < n && game.health > 0; i++) {
            gameTime += 1 / 40;
            step(0.025);
          }
        };
        window.goHunt = (id, length) => {
          const h = huntSites[id],
            m = huntState(id);
          for (let j = 0; j < 16; j++) {
            const a = (j * Math.PI) / 8,
              x = m.x + Math.sin(a) * length,
              z = m.z + Math.cos(a) * length;
            if (!livingFree(x, z, 0.4, game) || !visiblePath({ x, z }, m)) continue;
            Object.assign(game, {
              x,
              z,
              yaw: Math.atan2(x - m.x, z - m.z),
              air: 0,
              vy: 0,
              pitch: Math.atan2(walkingSurface(m.x, m.z) + 0.8 - walkingSurface(x, z) - 1.71, length),
            });
            drawHud();
            return true;
          }
          return false;
        };
        window.huntBattle = (id) => {
          const m = huntState(id);
          let guarded = 0,
            shots = 0,
            strikes = 0,
            openings = 0,
            prev = '';
          for (let i = 0; i < 7100 && m.hp > 0; i++) {
            if (!game.health) throw Error('hero fell during ' + id);
            keys.clear();
            const dist = distance(game, m);
            game.yaw = Math.atan2(game.x - m.x, game.z - m.z);
            game.pitch = Math.atan2(
              walkingSurface(m.x, m.z) + 0.86 - walkingSurface(game.x, game.z) - 1.7 - game.air,
              dist,
            );
            if (prev !== 'recover' && m.phase === 'recover') openings++;
            prev = m.phase;
            if (game.health < 49 && game.bandages) bandage();
            if (m.phase === 'wind' && m.attack === 'web') keys.add('KeyA');
            else if ((m.phase === 'wind' || m.phase === 'rush') && dist < 5.4) {
              game.weapon = 'sword';
              keys.add('KeyR');
              guarded++;
            } else if (dist > 3.04 && game.arrows > 0) {
              game.weapon = 'bow';
              if (!game.arrow && !swing && game.stamina >= 9) {
                attack();
                shots++;
              }
              if (dist > 7) keys.add('KeyW');
            } else if (dist > 2.45) {
              keys.add('KeyW');
            } else if (!swing && game.stamina > 20) {
              game.weapon = 'sword';
              attack(m.phase === 'recover');
              strikes++;
            }
            rounds(1);
          }
          keys.clear();
          if (m.hp > 0) throw Error('hunt stalled: ' + JSON.stringify([m, game.health, game.x, game.z]));
          return { guarded, shots, strikes, openings, health: game.health };
        };
      });
    await install();
    await page.keyboard.press('p');
    assert.equal(await page.locator('[data-talent]').count(), 9);
    assert.equal(await page.locator('[data-talent]:enabled').count(), 0);
    await page.click('#close');
    for (const id of ['pale', 'widow']) {
      assert.ok(await page.evaluate((id) => goHunt(id, 2.45), id));
      const blocked = await page.evaluate((id) => {
        const m = huntState(id),
          hp = m.hp,
          before = game.training.xp;
        game.weapon = 'sword';
        swing = 0;
        attack(true);
        const sword = m.hp === hp;
        for (const type of ['arrow', 'parry', 'melee', 'heavy']) hurtActor(m, 9900, true, type);
        return {
          sword,
          alive: m.hp === hp,
          xp: game.training.xp === before,
          rank: heroLevel(),
          target: aimedEnemy(4, 0.6)?.hunt,
        };
      }, id);
      assert.deepEqual(blocked, { sword: true, alive: true, xp: true, rank: 1, target: id });
      const bow = await page.evaluate((id) => {
        goHunt(id, 4.2);
        const m = huntState(id),
          hp = m.hp;
        game.arrow = null;
        swing = 0;
        game.stamina = 100;
        game.weapon = 'bow';
        game.wardWarningAt = -10;
        gameTime += 0.1;
        const start = game.arrows;
        attack();
        let steps = 0;
        while (game.arrow && steps++ < 100) arrowTick(0.0125);
        return {
          alive: m.hp === hp,
          arrow: game.arrows === start - 1,
          hit: game.wardWarningAt === gameTime,
          steps,
        };
      }, id);
      assert.ok(bow.alive && bow.arrow && bow.hit && bow.steps < 16, JSON.stringify(bow));
    }
    // Rank fixtures isolate both fights. The expedition suite earns these levels through outdoor quests.
    await page.evaluate(() => {
      awardXP(65 - game.training.xp, 'Подготовка к охоте');
      goHunt('pale', 6);
    });
    await page.keyboard.press('p');
    await page.click('[data-talent=riposte]');
    assert.ok(await page.locator('[data-talent=riposte]').isDisabled());
    await page.click('#close');
    const first = await page.evaluate(() => huntBattle('pale'));
    assert.ok(first.guarded > 0 && first.openings > 0);
    assert.ok(await page.evaluate(() => goHunt('pale', 1.4)));
    const pocket = await page.evaluate(() => game.coins);
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => game.coins), pocket + 32);
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => game.coins), pocket + 32);
    await page.evaluate(() => {
      awardXP(335 - game.training.xp, 'Опыт экспедиции');
      goHunt('widow', 6);
    });
    await page.keyboard.press('p');
    await page.click('[data-talent=breaker]');
    await page.click('[data-talent=medic]');
    await page.click('#close');
    assert.ok(await page.evaluate(() => maxHealth() === 128 && talentPoints() === 0));
    const second = await page.evaluate(() => huntBattle('widow'));
    assert.ok(second.strikes + second.shots >= 3);
    assert.ok(await page.evaluate(() => goHunt('widow', 1.4)));
    await page.keyboard.press('e');
    await page.keyboard.press('k');
    const before = await page.evaluate(() => [
      game.training.xp,
      ...game.training.learned,
      game.hunts.pale.looted,
      game.hunts.widow.looted,
    ]);
    await page.reload();
    await page.locator('.faction').nth(1).click();
    await page.click('#resume:enabled');
    await page.waitForFunction(() => active);
    await install();
    assert.deepEqual(
      await page.evaluate(() => [
        game.training.xp,
        ...game.training.learned,
        game.hunts.pale.looted,
        game.hunts.widow.looted,
      ]),
      before,
    );
    const results = await page.evaluate(() => {
      // Independent builds exercise rank prerequisites and combat effects with identical equipment.
      game.training = newTraining();
      awardXP(1710, 'Тест мастерства');
      const learn = (ids) => ids.every(learnTalent);
      const illegal = !learnTalent('quiver');
      const ok = learn(['focus', 'pin', 'quiver', 'medic', 'stride', 'bulwark', 'riposte']);
      const cap = maxHealth(),
        t = { kind: 'guard', stagger: 0 };
      game.arrow = { aimed: true };
      const damage = trainedDamage(t, 30, 'arrow');
      game.arrow = null;
      game.stamina = 100;
      game.air = 0;
      game.weapon = 'bow';
      swing = 0;
      game.arrows = 2;
      attack();
      const shotCost = 100 - game.stamina;
      game.arrow = null;
      game.health = cap - 60;
      game.bandages++;
      bandage();
      const heal = game.health - (cap - 60);
      game.health = cap;
      game.hits = 0;
      game.blockTime = 0;
      game.evade = 0;
      hitPlayer(25);
      const received = cap - game.health;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }));
      const dodge = game.evade,
        cost = 100 - shotCost - game.stamina;
      game.evade = 0;
      game.training = newTraining();
      awardXP(1710, 'Тест фехтования');
      learn(['riposte', 'breaker', 'blade']);
      game.riposteLeft = 2;
      game.stamina = 33;
      const counter = trainedDamage({ kind: 'hound', stagger: 1 }, 30, 'melee');
      return {
        illegal,
        ok,
        damage,
        pinned: t.stagger,
        shotCost,
        heal,
        received,
        dodge,
        cost,
        counter,
        refill: game.stamina,
        points: talentPoints(),
      };
    });
    assert.equal(results.illegal, true);
    assert.equal(results.ok, true);
    assert.equal(results.damage, 55);
    assert.equal(results.shotCost, 5);
    assert.equal(results.heal, 54);
    assert.equal(results.received, 19);
    assert.equal(results.cost, 15);
    assert.equal(results.dodge, 0.39);
    assert.equal(results.pinned, 1);
    assert.equal(results.counter, 70);
    assert.equal(results.refill, 45);
    const legacy = await page.evaluate(() => {
      const copy = JSON.parse(JSON.stringify(game));
      delete copy.training;
      copy.health = 82;
      copy.kills = 11;
      copy.stage = 2;
      copy.story.phase = 'miller';
      copy.story.branch = null;
      copy.story.clues = [];
      game = copy;
      const validOld = valid(game);
      restoreTraining(game);
      const xp = game.training.xp;
      restoreTraining(game);
      return [validOld, xp, game.training.xp, game.health, valid(game)];
    });
    assert.ok(legacy[0] && legacy[1] >= 175 && legacy[1] === legacy[2] && legacy[3] === 82 && legacy[4]);
    assert.deepEqual(errors, []);
    console.log(
      'PASS — 8 ranks, 9 talents across builds, warded elites, 2 distinct live hunts, trophies, save/reload and legacy credit.',
      { first, second, results },
    );
  } finally {
    await page.close();
  }
}
module.exports = checkProgression;
if (require.main === module)
  (async () => {
    const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'],
    });
    try {
      await checkProgression(b);
    } finally {
      await b.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
