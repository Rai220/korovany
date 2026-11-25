'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const { mkdirSync } = require('node:fs');

module.exports = async function playOath(browser) {
  const page = await browser.newPage({ viewport: { width: 1050, height: 720 } });
  const url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href;
  const errors = [],
    routes = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    if (process.env.OATH_TRACE) console.error(e.stack);
  });
  const click = (id) => page.locator('[data-oath-choice="' + id + '"]').click({ timeout: 20000 });
  const away = () => page.click('#close');
  const shot = async (name) => {
    if (!process.env.OATH_SHOTS) return;
    mkdirSync(process.env.OATH_SHOTS, { recursive: true });
    await page.screenshot({ path: resolve(process.env.OATH_SHOTS, name + '.jpg'), quality: 90 });
  };
  let lastSpeaker = null;
  const hear = async (id) => {
    await page.waitForFunction(
      (key) => {
        const row = oathSpeech[key];
        return (
          window.playingOath?.src.includes(key + '.mp3') &&
          playingOath.currentTime > 0.03 &&
          !playingOath.paused &&
          realmVoice.speaker === row[0] &&
          dialogueStage?.subject?.userData?.state === 'talk'
        );
      },
      id,
      { timeout: 7000 },
    );
    lastSpeaker = id;
  };
  try {
    await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        if (this.src.includes('/assets/oath/')) window.playingOath = this;
        return play.apply(this, args);
      };
    });
    async function land(side, choice) {
      await page.goto('about:blank');
      await page.goto(url);
      await page.locator('#factions button').nth(side).click();
      await page.click('#oath-begin:enabled');
      await page.waitForFunction(() => prologue && game.march);
      await page.click('#opening-skip');
      await page.locator('[data-landing="' + choice + '"]').click();
      await page.waitForFunction(
        (choice) => active && !prologue && game.march && game.oath?.intro === choice,
        choice,
      );
    }
    await land(1, 'token');
    const setup = () =>
      page.evaluate(() => {
        cancelAnimationFrame(frame);
        if ($('dialog').open) closeModal();
        realmVoice.stop();
        scoreStop();
        const waypoints = new Map();
        const key = (x, z) => x + ',' + z;
        const node = ([x, z]) => {
          const k = key(x, z);
          if (!waypoints.has(k)) waypoints.set(k, { x, z, links: new Set() });
          return waypoints.get(k);
        };
        for (const road of marchRoads)
          for (let i = 1; i < road.length; i++) {
            const a = node(road[i - 1]),
              b = node(road[i]);
            a.links.add(b);
            b.links.add(a);
          }
        function near(p) {
          return [...waypoints.values()].reduce((best, n) =>
            Math.hypot(n.x - p.x, n.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? n : best,
          );
        }
        function route(s, g) {
          const start = near(s),
            finish = near(g),
            dist = new Map([[start, 0]]),
            prev = new Map(),
            open = new Set(waypoints.values());
          while (open.size) {
            let n = null;
            for (const p of open) if (dist.has(p) && (!n || dist.get(p) < dist.get(n))) n = p;
            if (!n || n === finish) break;
            open.delete(n);
            for (const b of n.links) {
              const d = dist.get(n) + Math.hypot(b.x - n.x, b.z - n.z);
              if (d < (dist.get(b) ?? Infinity)) {
                dist.set(b, d);
                prev.set(b, n);
              }
            }
          }
          if (!dist.has(finish)) throw Error('Broken road network');
          const path = [];
          for (let p = finish; p; p = prev.get(p)) path.unshift(p);
          return path;
        }
        function testEdge(p, x, z) {
          const q = { x: p.x, z: p.z };
          marchMove(q, x - p.x, z - p.z);
          return Math.hypot(q.x - x, q.z - z) < 1e-6 ? q : null;
        }
        function walkSection(state, target, r) {
          if (Math.hypot(state.x - target.x, state.z - target.z) < r) return 0;
          if (testEdge(state, target.x, target.z))
            return marchMove(state, target.x - state.x, target.z - state.z);
          // Pass a door jamb or low vegetation while remaining close to this stretch of road.
          const W = 2 * 80 + 1,
            root = 80 * W + 80,
            prev = new Int32Array(W * W).fill(-2),
            at = new Array(W * W),
            ix = (k) => (k % W) - 80,
            iz = (k) => Math.floor(k / W) - 80,
            idx = (i, j) => (j + 80) * W + i + 80,
            start = { x: state.x, z: state.z };
          const queue = [[root, 0]],
            unit = 0.83;
          prev[root] = -1;
          at[root] = start;
          let end = -1;
          while (queue.length) {
            let top = 0;
            for (let i = 1; i < queue.length; i++) if (queue[i][1] < queue[top][1]) top = i;
            const [k] = queue[top];
            queue[top] = queue[queue.length - 1];
            queue.pop();
            const here = at[k];
            if (Math.hypot(here.x - target.x, here.z - target.z) < r) {
              end = k;
              break;
            }
            for (const [dx, dz] of [
              [1, 0],
              [0, 1],
              [-1, 0],
              [0, -1],
              [1, 1],
              [-1, 1],
              [1, -1],
              [-1, -1],
            ]) {
              const i = ix(k) + dx,
                j = iz(k) + dz;
              if (Math.abs(i) > 80 || Math.abs(j) > 80) continue;
              const n = idx(i, j);
              if (prev[n] !== -2) continue;
              const x = start.x + i * unit,
                z = start.z + j * unit;
              if (
                Math.hypot(x - target.x, z - target.z) >
                Math.hypot(start.x - target.x, start.z - target.z) + 12
              )
                continue;
              const reached = testEdge(here, x, z);
              if (!reached) continue;
              at[n] = reached;
              prev[n] = k;
              queue.push([n, Math.hypot(x - target.x, z - target.z)]);
            }
          }
          if (end < 0) throw Error('No footpath to ' + [target.x, target.z] + ' from ' + [state.x, state.z]);
          const points = [];
          for (let n = end; n !== root; n = prev[n]) points.unshift(at[n]);
          let distance = 0;
          for (const p of points) {
            distance += marchMove(state, p.x - state.x, p.z - state.z);
            if (Math.hypot(state.x - p.x, state.z - p.z) > 1e-6) throw Error('Walk changed underfoot');
          }
          return distance;
        }
        window.walkOath = (id) => {
          const s = game.march,
            goal = marchSites[id],
            path = route(s, goal);
          let meters = 0;
          for (const [i, p] of path.entries()) {
            meters += walkSection(s, p, i === path.length - 1 ? 2.6 : 1.7);
            oathTick(0.2);
          }
          if (marchAction()?.id !== id)
            throw Error('Wrong action at ' + id + ': ' + JSON.stringify(marchAction()));
          game.yaw = Math.atan2(s.x - goal.x, s.z - goal.z);
          drawHud();
          return Math.round(meters);
        };
      });
    const go = async (id) => {
      routes.push([id, await page.evaluate((id) => walkOath(id), id)]);
      if (process.env.OATH_TRACE) console.log('Visit', id);
      await page.keyboard.press('e');
      await page.waitForFunction(() => $('dialog').open);
    };
    const save = async () => {
      await page.keyboard.press('k');
      return page.evaluate(() => ({ key: saveKey(), raw: localStorage.getItem(saveKey()) }));
    };
    const resume = async (record) => {
      const saved = JSON.parse(record.raw);
      await page.evaluate(({ key, raw }) => {
        localStorage.removeItem(key + '.checkpoint');
        localStorage.setItem(key, raw);
      }, record);
      await page.reload();
      await page.locator('#factions button').nth(1).click();
      const checkpoint = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem(saveKey()));
        return { valid: valid(saved), ending: saved?.oath?.ending };
      });
      assert(checkpoint.valid, 'Saved game rejected: ' + JSON.stringify(checkpoint));
      await page.click('#resume:enabled');
      try {
        await page.waitForFunction(
          (inMarch) => active && !!game.march === inMarch && !prologue,
          !!saved.march,
          { timeout: 60000 },
        );
      } catch (error) {
        const info = await page.evaluate(() => ({
          active,
          march: game?.march,
          selected: choice,
          message: $('dialog-title').textContent,
          boot: editionBoot.failed,
          notice: $('notice')?.textContent,
        }));
        throw new Error('Could not resume ' + JSON.stringify({ checkpoint, info, errors }), { cause: error });
      }
      await setup();
      assert.deepEqual(await page.evaluate(() => game.oath), saved.oath);
    };
    const checkRoadside = async (ending) => {
      const inventory = () =>
        page.evaluate(() => {
          world.display(game, gameTime, 0, 0, null);
          return {
            coins: game.coins,
            bandages: game.bandages,
            gift: game.oathRoadGift || null,
            giftShown: world.roadsideView.userData.gift.visible,
            lit: !!game.lanternLit,
            light: !!(
              world.roadLamp?.isPointLight &&
              world.roadLamp.visible &&
              world.roadLamp.parent === world.camera &&
              world.roadLamp.intensity > 0 &&
              world.roadLamp.distance > 0
            ),
          };
        });
      routes.push(['mouth', await page.evaluate(() => walkOath('mouth'))]);
      await page.keyboard.press('e');
      await page.waitForFunction(() => active && !game.march && !game.inside && !game.dungeon);
      const approach = await page.evaluate(() => {
        const gate = distance(game, marchEntrance);
        const walked = move(game, oathRoadside.x - game.x, oathRoadside.z + 2 - game.z);
        game.yaw = Math.atan2(game.x - oathRoadside.x, game.z - oathRoadside.z);
        world.display(game, gameTime, 0, 0, null);
        return {
          gate,
          walked,
          interact: !!interactable()?.roadside,
          shows: [...world.roadsideViews].filter(([, object]) => object.visible).map(([id]) => id),
        };
      });
      assert(
        approach.gate < 4 && approach.walked > 2 && approach.interact,
        'Walk from gate: ' + JSON.stringify(approach),
      );
      assert.deepEqual(approach.shows, [ending]);
      const before = await inventory();
      assert.equal(before.gift, null);
      assert(before.giftShown);
      await page.keyboard.press('e');
      await page.locator('#road-claim').click();
      assert.equal(await page.locator('#road-claim').count(), 0);
      await page.click('#road-back');
      const after = await inventory();
      assert.deepEqual(after, {
        coins: before.coins + (ending === 'hearing' ? 18 : 0),
        bandages: before.bandages + (ending === 'refuge' ? 3 : 0),
        gift: ending,
        giftShown: false,
        lit: ending === 'vigil',
        light: ending === 'vigil',
      });
      if (ending === 'vigil') {
        await page.keyboard.press('l');
        assert(!(await inventory()).light);
        await page.keyboard.press('l');
        assert((await inventory()).light);
        await page.keyboard.press('Escape');
        await page.click('#road-lamp');
        assert(!(await inventory()).light);
        await page.click('#road-lamp');
        await page.click('#back');
        assert((await inventory()).light);
      }
      await page.keyboard.press('e');
      await page.locator('#road-back').waitFor();
      assert.equal(await page.locator('#road-claim').count(), 0);
      await page.click('#road-back');
      await resume(await save());
      assert.deepEqual(await inventory(), after);
      await page.keyboard.press('e');
      await page.locator('#road-back').waitFor();
      assert.equal(await page.locator('#road-claim').count(), 0);
      await page.click('#road-back');
      assert.deepEqual(await inventory(), after);
      return { fromGate: approach.walked, coins: after.coins, bandages: after.bandages, lamp: after.light };
    };
    const checkEnding = async (id) => {
      await click(id);
      assert.equal(await page.locator('[data-oath-choice="confirm"]').count(), 1);
      await click('confirm');
      await hear(id === 'hearing' ? 'vera-hearing' : id === 'refuge' ? 'savva-refuge' : 'savva-vigil');
      await click('other');
      await hear(id === 'hearing' ? 'savva-hearing' : id === 'refuge' ? 'vera-refuge' : 'vera-vigil');
      await click('leave');
      const verified = await page.evaluate(() => {
        const s = oathState(),
          v = ensureMarchView(world);
        world.display(game, gameTime, 0, 0, null);
        const end = oathEndings[s.ending];
        return {
          ending: s.ending,
          xp: game.training.xp,
          target: end.place,
          xb: v.vera.position.x,
          zb: v.vera.position.z,
          xs: v.savva.position.x,
          zs: v.savva.position.z,
          family: v.family.filter((o) => o.visible).length,
          board: v.nameboard.visible,
          luggage: v.luggage.visible,
          officer: v.bailiff.visible,
          waterToWheel: s.waterToWheel,
          drainOpen: s.drainOpen,
          fromPlace: [v.vera, v.savva].map((a) =>
            Math.hypot(a.position.x - marchSites[end.place].x, a.position.z - marchSites[end.place].z),
          ),
          entries: game.story.entries.filter((r) => r[0] === end.name).length,
        };
      });
      assert.equal(verified.ending, id);
      assert.equal(verified.entries, 1);
      assert.equal(verified.board, id !== 'refuge');
      assert.equal(verified.luggage, id === 'refuge');
      assert.equal(verified.officer, id !== 'refuge');
      assert.equal(verified.family, id === 'refuge' ? 3 : 0);
      assert(verified.fromPlace[0] < 5);
      assert(verified.fromPlace[1] < (id === 'refuge' ? 19 : 5));
      assert.equal(verified.waterToWheel, id === 'vigil');
      assert.equal(verified.drainOpen, id === 'refuge');
      await go(verified.target);
      await click('first');
      await away();
      const record = await save();
      await resume(record);
      assert.equal(await page.evaluate(() => oathEnding()), id);
      verified.roadGift = await checkRoadside(id);
      return verified;
    };
    await setup();
    await go('station');
    await hear('vera-token');
    await page.click('#oath-rehear');
    await hear('vera-token');
    await shot('vera');
    await away();
    await go('belfry');
    assert.equal(await page.locator('[data-oath-choice="drive"]').count(), 0);
    await away();
    await go('aqueduct');
    await click('inlet');
    await click('pulse');
    assert(!(await page.evaluate(() => oathHas('beat'))));
    await click('inlet');
    await click('pulse');
    const xp = await page.evaluate(() => game.training.xp);
    await click('pulse');
    assert.equal(await page.evaluate(() => game.training.xp), xp);
    await click('drain');
    assert(!(await page.evaluate(() => oathVisualState().dry)));
    await click('inlet');
    assert(await page.evaluate(() => oathVisualState().dry));
    await away();
    await go('belfry');
    await click('drive');
    await click('back');
    await click('names');
    await click('leave');
    assert(
      !(await page.evaluate(() => oathHas('roll') || oathHas('vera'))),
      'Drive can be found before paper evidence',
    );
    await go('chapel');
    await hear('savva-motor');
    await click('testify');
    await hear('savva-tale');
    await click('next');
    await click('night');
    await hear('savva-night');
    await click('back');
    await click('boat');
    await click('back');
    await click('word');
    await hear('savva-sworn');
    await click('leave');
    await go('ferry');
    await click('receipt');
    await away();
    await go('quarry');
    await click('wrongleaf');
    assert(!(await page.evaluate(() => oathHas('roll'))));
    await click('book');
    await click('roll');
    await away();
    await page.keyboard.press('j');
    await page.locator('[data-journal-tab="oath"]').click();
    await page.click('#oath-compare-journal');
    await click('receipt');
    await click('roll');
    await click('retry');
    await click('roll');
    await click('receipt');
    await click('wrong');
    await click('retry');
    await click('prove');
    await click('leave');
    await page.locator('[data-oath-track="station"]').click();
    assert.equal(await page.evaluate(() => oathState().track), 'station');
    await away();
    await go('station');
    await hear('vera-firstproof');
    await click('admit');
    await hear('vera-admit');
    await click('sister');
    await click('command');
    await hear('vera-command');
    await click('back');
    await click('sign');
    await hear('vera-sworn');
    await click('leave');
    await go('belfry');
    await away();
    const branch = await save(),
      outcomes = [];
    const before = JSON.parse(branch.raw);
    assert.equal(before.oath.ending, null);
    for (const id of ['hearing', 'refuge', 'vigil']) {
      await resume(branch);
      await go('belfry');
      await click('choose');
      outcomes.push(await checkEnding(id));
    }
    for (const o of outcomes) assert.equal(o.xp, before.training.xp + 75);
    await land(0, 'rope');
    await setup();
    await go('station');
    await hear('vera-rope');
    await away();
    await go('ferry');
    await click('receipt');
    await away();
    await go('chapel');
    await hear('savva-rope');
    assert.equal(await page.locator('[data-oath-choice="testify"]').count(), 1);
    await click('grove');
    await hear('savva-grove');
    await shot('savva');
    await click('back');
    await click('testify');
    await away();
    assert(await page.evaluate(() => oathHas('grove') && oathHas('savva') && !oathHas('drive')));
    await land(1, 'rope');
    await setup();
    await go('quarry');
    await click('roll');
    await away();
    await go('station');
    await click('watch');
    await hear('vera-watch');
    await click('back');
    await click('admit');
    await away();
    assert(
      await page.evaluate(
        () => oathHas('vera') && oathHas('watch') && !oathHas('dates') && !oathHas('receipt'),
      ),
    );
    await land(2, 'token');
    await setup();
    await go('chapel');
    await hear('savva-first');
    const coins = await page.evaluate(() => game.coins);
    await click('wage');
    await hear('savva-wage');
    await click('back');
    await click('relay');
    await away();
    assert.equal(await page.evaluate(() => game.coins), coins - 8);
    assert(await page.evaluate(() => oathHas('wage') && oathVisualState().drainOpen));
    await go('aqueduct');
    assert.match(await page.locator('.oath-flow').innerText(), /Открыт/);
    await away();
    // A forester can hear the testimony through the safe passage alone, without either starting clue.
    await land(0, 'token');
    await setup();
    await go('chapel');
    assert.equal(await page.locator('[data-oath-choice="testify"]').count(), 0);
    await click('grove');
    await click('back');
    await click('testify');
    await away();
    assert(await page.evaluate(() => oathHas('savva') && !oathHas('receipt') && !oathHas('drive')));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ routes, notes: before.oath.notes, outcomes, lastSpeaker }));
  } finally {
    await page.close();
  }
};
if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const b = await chromium.launch({
      headless: true,
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
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
}
