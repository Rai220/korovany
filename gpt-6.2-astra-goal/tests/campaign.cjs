const { chromium } = require('playwright'),
  assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  try {
    const page = await b.newPage({ viewport: { width: 960, height: 720 } });
    const errors = [],
      external = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => {
      if (
        !r.url().startsWith(new URL('.', url).href) &&
        !r.url().startsWith('data:') &&
        !r.url().startsWith('blob:')
      )
        external.push(r.url());
    });
    const url =
      process.env.GAME_URL ||
      require('node:url').pathToFileURL(require('node:path').resolve(__dirname, '../index.html')).href;
    await page.goto(url);
    await page.click('[data-page="atlas"]');
    await page.click('.region:nth-child(4)');
    assert.equal(await page.locator('#dialog-title').innerText(), 'Чёрные горы');
    await page.click('#close');
    await page.click('[data-page="campaign"]');
    await page.click('#help');
    await page.keyboard.press('Escape');
    const install = () =>
      page.evaluate(() => {
        // Drive the actual simulation with a fixed timestep between browser inputs.
        let seed = 724115;
        Math.random = () => {
          seed = (1664525 * seed + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        soundOn = false;
        window.nativeRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = () => 0;
        window.tick = (n) => {
          for (let i = 0; i < n; i++) {
            if (!active || $('dialog').open || game.health <= 0) break;
            step(0.04);
            gameTime += 0.04;
          }
          drawHud();
        };
        window.key = (code) => {
          document.dispatchEvent(new KeyboardEvent('keydown', { code }));
          document.dispatchEvent(new KeyboardEvent('keyup', { code }));
        };
        window.face = (t) => (game.yaw = Math.atan2(-(t.x - game.x), -(t.z - game.z)));
        window.walkTo = (targetFn, dist = 2.5, limit = 3000) => {
          let via = null,
            plan = [];
          for (let i = 0; i < limit; i++) {
            const t = targetFn();
            if (!t || distance(t, game) <= dist) return true;
            if (via && distance(via, game) < 0.42) via = null;
            if (!via && plan.length) via = plan.shift();
            const next = via || t;
            face(next);
            const p = { x: game.x, z: game.z };
            keys.add('KeyW');
            keys.add('ShiftLeft');
            tick(1);
            keys.clear();
            if (distance(p, game) < 0.1) {
              plan = detour(game, t);
              via = plan.shift();
            }
            if (!game.health) return false;
          }
          return false;
        };
        window.battle = (tag, limit = 4200) => {
          for (let i = 0; i < limit; i++) {
            if (game.health <= 0 || $('dialog').open)
              throw Error('Cannot fight ' + game.health + ' ' + $('dialog-title').textContent);
            const enemies = game.actors
              .filter((a) => a.tag === tag && a.hp > 0)
              .sort((a, b) => distance(a, game) - distance(b, game));
            if (!enemies.length) {
              if (game.weapon !== 'sword') key('Digit1');
              game.pitch = 0;
              return true;
            }
            const t = enemies[0];
            face(t);
            const dist = distance(t, game);
            if (dist > 3.2 && dist < 22 && game.arrows && game.arm !== 'lost' && visiblePath(game, t)) {
              if (game.weapon !== 'bow') key('Digit2');
              game.pitch = Math.atan2(ground(t.x, t.z) - ground(game.x, game.z) - 0.18, dist);
              key('KeyF');
            } else if (dist > 2.75) {
              keys.add('KeyW');
              keys.add('ShiftLeft');
            } else {
              if (game.weapon !== 'sword') key('Digit1');
              game.pitch = 0;
              if (t.windup > 0.12) keys.add('KeyR');
              else key('KeyF');
            }
            if (dist < 2.8 && i % 45 === 0) key('KeyG');
            if (game.health < 53 && game.bandages) key('KeyH');
            tick(1);
            keys.clear();
          }
          throw Error(
            'combat stalled ' + JSON.stringify([game.x, game.z, game.actors.filter((a) => a.tag === tag)]),
          );
        };
      });
    const ev = (f, arg) => page.evaluate(f, arg),
      press = async (k) => {
        await page.keyboard.press(k);
        await page.waitForTimeout(30);
      };
    const travel = async (i) => {
      await press('m');
      await page.locator('[data-travel="' + i + '"]').click();
      assert.equal(await ev(() => zoneAt(game.x, game.z)), i);
    };
    const starts = [];
    await install();
    await page.click('#begin');
    assert.equal(await ev(() => game.side), 0);
    await page.keyboard.down('w');
    const z = await ev(() => game.z);
    await ev(() => tick(5));
    await page.keyboard.up('w');
    assert.ok((await ev(() => game.z)) < z);
    await press('Space');
    await ev(() => tick(4));
    assert.ok((await ev(() => game.air)) > 0.2);
    await ev(() => tick(25));
    assert.equal(await ev(() => game.air), 0);
    await ev(() => battle('first'));
    assert.equal(await ev(() => game.stage), 1);
    assert.ok(await ev(() => walkTo(() => game.wagon, 3.6)));
    await press('e');
    assert.ok(await ev(() => game.actors.some((a) => a.tag === 'escort' && a.team === 'hostile')));
    await ev(() => battle('escort'));
    assert.ok(await ev(() => walkTo(() => game.wagon, 3.5)));
    await press('e');
    assert.equal(await ev(() => game.stage), 2);
    await ev(() => {
      window.forestShop = () => game.actors.find((a) => a.tag === 'shop' && a.x < 0 && a.z > 0);
      return walkTo(forestShop, 2.5);
    });
    await press('e');
    assert.equal(await ev(() => game.stage), 3);
    const money = await ev(() => game.coins);
    await page.click('[data-buy="0"]');
    assert.equal(await ev(() => game.coins), money - 6);
    await page.click('#close');
    await ev(() => {
      world.lod(game.x, game.z);
      world.display(game, 1, 0, 0, null);
    });
    assert.ok(
      await ev(() => {
        const c = game.actors.find((a) => a.tag === 'first');
        return (
          world.actors.get(c.id).rotation.x < -1 &&
          world.trees.some((t) => t.near) &&
          world.trees.some((t) => !t.near)
        );
      }),
    );
    await press('k');
    const saved = await ev(() => JSON.parse(localStorage.getItem(saveKey())));
    await page.reload();
    await install();
    await page.click('#resume');
    assert.equal(await ev(() => game.coins), saved.coins);
    assert.equal(await ev(() => game.robbed), 1);
    console.log(
      'PASS forest defense, moving caravan, escorts, plunder, delivery, shop, 3D bodies, LOD, reload',
    );
    const leave = async () => {
      await press('Escape');
      if (!(await page.locator('#leave').isVisible())) await press('Escape');
      await page.click('#leave');
      await page.click('#no-save');
    };
    await ev(() => {
      tick(2);
      save();
    });
    starts.push(await ev(() => Object.fromEntries(Object.entries(localStorage))));
    await leave();
    await page.click('.faction:nth-child(2)');
    await page.click('#begin');
    assert.ok(await ev(() => walkTo(() => goal().target)));
    await press('e');
    assert.equal(await ev(() => game.stage), 1);
    await page.click('#close');
    await ev(() => battle('spy'));
    assert.equal(await ev(() => game.stage), 2);
    await travel(3);
    await ev(() => battle('garrison'));
    assert.equal(await ev(() => game.stage), 3);
    await travel(1);
    await ev(() => walkTo(() => goal().target));
    await press('e');
    assert.equal(await ev(() => game.stage), 4);
    await page.click('#close');
    console.log('PASS guard accepts orders, defense, raid, report, travel');
    await ev(() => {
      tick(2);
      save();
    });
    starts.push(await ev(() => Object.fromEntries(Object.entries(localStorage))));
    await leave();
    await page.click('.faction:nth-child(3)');
    await page.click('#begin');
    await press('q');
    await page.click('#hold');
    const before = await ev(() => game.actors.filter((a) => a.team === 'friend').map((a) => [a.x, a.z]));
    await ev(() => tick(1));
    assert.deepEqual(
      await ev(() => game.actors.filter((a) => a.team === 'friend').map((a) => [a.x, a.z])),
      before,
    );
    await press('q');
    await page.click('#palace');
    assert.equal(await ev(() => game.raid), 1);
    await ev(() => battle('intruder'));
    await ev(() => tick(350));
    assert.ok(await ev(() => game.actors.some((a) => a.team === 'friend' && a.z < 30)));
    await travel(1);
    await ev(() => battle('raid'));
    await ev(() => tick(6));
    assert.equal(await ev(() => game.stage), 1);
    await travel(0);
    console.log('PASS dark lord holds position, dispatches troops, invader, palace raid, all four regions');

    await ev(() => {
      tick(2);
      save();
    });
    starts.push(await ev(() => Object.fromEntries(Object.entries(localStorage))));
    async function restore(slot, side) {
      await page.reload();
      await install();
      await ev((data) => {
        localStorage.clear();
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        refreshResume();
      }, slot);
      await page.locator('.faction').nth(side).click();
      await page.click('#resume');
    }
    const visit = async () => {
      assert.ok(await ev(() => walkTo(() => goal().target, 2.4)), await ev(() => goal().text));
      await press('e');
    };
    for (let side = 0; side < 3; side++) {
      await restore(starts[side], side);
      await ev(() => tick(2));
      assert.equal(await ev(() => game.story.phase), 'miller');
      await travel(0);
      await visit();
      await page.click('#reply0');
      await visit();
      await page.click('#reply0');
      assert.ok(await ev(() => walkTo(() => places.rider, 2.6)));
      await press('e');
      await page.click('#reply0');
      assert.ok(await ev(() => game.story.aid));
      await visit();
      await page.click('#reply0');
      assert.equal(await ev(() => game.story.phase), 'choice');
      await travel(0);
      assert.ok(await ev(() => walkTo(() => goal().target, 2.4)));
      await press('k');
      const slot = await ev(() => Object.fromEntries(Object.entries(localStorage)));
      for (const [idx, branch] of ['bread', 'law', 'iron'].entries()) {
        if (idx) await restore(slot, side);
        await press('e');
        await page.click('#reply' + idx);
        assert.equal(await ev(() => game.story.branch), branch);
        if (branch === 'bread') {
          const ret = await ev(() => {
            for (let i = 0; i < 7500 && game.story.phase === 'escort'; i++) {
              if (game.actors.some((a) => a.tag === 'ambush' && a.hp > 0)) {
                battle('ambush');
                continue;
              }
              const shoulder = { x: game.wagon.x - 2.1, z: game.wagon.z - 2.8 };
              if (distance(game, shoulder) > 2.3) {
                face(shoulder);
                keys.add('KeyW');
                if (i % 55 > 40) keys.add('KeyA');
              }
              if (game.health < 53 && game.bandages) key('KeyH');
              tick(1);
              keys.clear();
              if (game.health <= 0) break;
            }
            return [game.story.phase, game.story.wave, game.wagon.z, game.health];
          });
          assert.equal(ret[0], 'return', String(ret));
          assert.equal(ret[1], 2);
        } else if (branch === 'law') {
          await visit();
          assert.ok(await ev(() => game.story.arrested));
          await travel(1);
        } else {
          await travel(1);
          await ev(() => battle('vault'));
          await visit();
          await travel(3);
        }
        await visit();
        assert.equal(await ev(() => game.story.phase), 'done');
        assert.ok((await page.locator('#dialog-kicker').innerText()).toLowerCase().includes('эпилог'));
        await page.click('#reply0');
        await press('k');
        console.log('PASS ending', side, branch);
      }
    }
    // Give the expedition enough gold to test every treatment at the same merchant.
    await ev(() => {
      if ($('dialog').open) closeModal();
      game.hits = 3;
      game.health = 100;
      game.bleed = 0;
      game.arm = game.eye = game.leg = 'whole';
      game.coins = 240;
      game.bandages = 3;
      game.air = game.vy = 0;
      game.actors = game.actors.filter((a) => a.team !== 'hostile');
      const m = game.actors.find((a) => a.tag === 'shop' && a.x < 0 && a.z < 0);
      game.x = m.x + 0.85;
      game.z = m.z;
      game.yaw = -Math.PI / 2;
      window.injure = () => {
        game.hits = 3;
        const rand = Math.random;
        Math.random = () => 0;
        try {
          hitPlayer(4);
        } finally {
          Math.random = rand;
        }
        drawHud();
      };
    });
    await ev(() => injure());
    assert.equal(await ev(() => game.arm), 'lost');
    const bleedingStart = await ev(() => game.health);
    await ev(() => tick(20));
    assert.ok((await ev(() => game.health)) < bleedingStart);
    await press('h');
    assert.equal(await ev(() => game.bleed), 0);
    const buy = async (id) => {
      await press('e');
      await page.click('[data-buy="' + id + '"]');
      await page.click('#close');
    };
    await buy(3);
    assert.equal(await ev(() => game.arm), 'prosthetic');
    await ev(() => injure());
    assert.ok(await page.locator('#blind').isVisible());
    await buy(4);
    assert.equal(await ev(() => game.eye), 'prosthetic');
    await ev(() => injure());
    assert.equal(await ev(() => game.leg), 'lost');
    await press('Space');
    assert.equal(await ev(() => game.vy), 0);
    await buy(5);
    assert.equal(await ev(() => game.leg), 'chair');
    await buy(6);
    assert.equal(await ev(() => game.leg), 'prosthetic');
    await press('Space');
    assert.ok((await ev(() => game.vy)) > 0);
    await ev(() => {
      game.health = 1;
      game.bleed = 1.65;
      tick(40);
    });
    assert.equal(await page.locator('#dialog-title').innerText(), 'Герой пал');
    await page.click('#restart');
    assert.equal(await ev(() => game.health), 100);
    console.log('PASS bleeding, bandages, three injuries, prostheses, wheelchair, jump and death/restart.');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
