const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function checkDoors(page) {
  const doors = await page.evaluate(() =>
    Object.entries(houses).flatMap(([id, h]) => h.doors.map((d) => ({ id, key: d.key }))),
  );
  assert.equal(doors.length, 20);
  for (const door of doors) {
    const start = await page.evaluate(({ id, key }) => {
      const d = houses[id].doors.find((v) => v.key === key);
      for (const depth of [0.19, 0.01, 0.55, 0.95, 1.35, 1.8])
        for (const offset of [0, -0.4, 0.4, -0.77, 0.77]) {
          const x = d.x + offset,
            z = d.z + d.n * depth;
          if (!livingFree(x, z, bodyRadius(game), game)) continue;
          Object.assign(game, { x, z, yaw: d.n > 0 ? 0 : Math.PI, pitch: 0, air: 0, vy: 0 });
          const prompt = interactable();
          if (prompt?.house === id && prompt.entrance === key) return prompt.label;
        }
      return '';
    }, door);
    assert.match(start, /Войти/, door.id + '/' + door.key);
    await page.keyboard.press('e');
    assert.deepEqual(await page.evaluate(() => [game.inside, game.roomEntrance]), [door.id, door.key]);
    const home = await page.evaluate((id) => houses[id].kind === 'home', door.id);
    const key = home ? 'KeyW' : 'KeyS',
      exit = home && door.key === 'front' ? 'back' : 'front';
    await page.keyboard.down(key);
    const route = await page.evaluate(() => {
      underTick(76);
      return [roomAction()?.key, roomAction()?.door];
    });
    await page.keyboard.up(key);
    assert.deepEqual(route, ['leave', exit], door.id + '/' + door.key);
    await page.keyboard.press('e');
    const outside = await page.evaluate(
      ({ id, exit }) => {
        const d = houses[id].doors.find((v) => v.key === exit);
        return (
          !game.inside &&
          Math.hypot(game.x - d.x, game.z - d.z) < 2.7 &&
          (game.z - d.z) * d.n > 0 &&
          livingFree(game.x, game.z, bodyRadius(game), game)
        );
      },
      { id: door.id, exit },
    );
    assert.ok(outside, door.id + '/' + exit);
  }
  console.log('PASS — 20 exterior entrances, traversable rooms and correct return positions.');
}

async function checkUnderways(
  browser,
  url = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href,
) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && /WebGL|THREE|shader/.test(m.text())) errors.push(m.text());
  });
  try {
    await page.goto(url);
    await page.locator('.faction').nth(1).click();
    await page.click('#begin:enabled');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);
    const install = async () =>
      page.evaluate(() => {
        cancelAnimationFrame(frame);
        realmVoice.stop();
        scoreStop();
        soundOn = false;
        window.underTick = (n = 1) => {
          for (let i = 0; i < n && game.health > 0; i++) {
            gameTime += 1 / 36;
            step(1 / 36);
          }
        };
        window.hallWalk = (x, z) => {
          const id = game.inside,
            scale = 0.38,
            toGrid = (v) => Math.round(v / scale),
            start = [toGrid(game.roomX), toGrid(game.roomZ)],
            end = [toGrid(x), toGrid(z)],
            queue = [start],
            prev = new Map([[start.toString(), null]]);
          for (let i = 0; i < queue.length; i++) {
            const [a, b] = queue[i];
            if (a === end[0] && b === end[1]) break;
            for (const [dx, dz] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const nx = a + dx,
                nz = b + dz,
                k = [nx, nz].toString();
              if (!prev.has(k) && roomFree(id, nx * scale, nz * scale, 0.36)) {
                prev.set(k, [a, b].toString());
                queue.push([nx, nz]);
              }
            }
          }
          if (!prev.has(end.toString())) throw Error('no route in hall ' + id);
          const pts = [];
          for (let k = end.toString(); prev.get(k) != null; k = prev.get(k))
            pts.push(k.split(',').map((n) => +n * scale));
          for (const [tx, tz] of pts.reverse()) {
            for (let n = 0; n < 12; n++) {
              const dx = tx - game.roomX,
                dz = tz - game.roomZ;
              if (Math.hypot(dx, dz) < 0.16) break;
              game.yaw = Math.atan2(-dx, -dz);
              keys.add('KeyW');
              underTick();
              keys.clear();
            }
          }
        };
        window.expedition = (destination) => {
          const d = underways[game.dungeon],
            state = dungeonState(),
            finish = dungeonPoint(destination);
          let strikes = 0,
            shots = 0,
            blocks = 0;
          for (let i = 0; i < 14000; i++) {
            if (game.health <= 0)
              throw Error('hero defeated ' + JSON.stringify([game.roomX, game.roomZ, state.foes]));
            const p = dungeonPlayer(),
              near = state.foes
                .filter((m) => m.hp > 0 && dungeonSight(p, m))
                .sort((a, b) => distance(a, p) - distance(b, p))[0];
            keys.clear();
            if (game.health < 65 && game.bandages) bandage();
            if (near && distance(near, p) < 11) {
              const dist = distance(near, p);
              game.yaw = Math.atan2(p.x - near.x, p.z - near.z);
              game.pitch = Math.atan2(bestiary[near.kind].top * 0.58 - 1.71, dist);
              if (near.windup > 0 && dist < 2.75) {
                game.weapon = 'sword';
                keys.add('KeyR');
                blocks++;
              } else if (dist > 3.0 && game.arrows && i % 3 === 0 && !swing && !game.arrow) {
                game.weapon = 'bow';
                attack();
                shots++;
              } else if (dist > 2.6) keys.add('KeyW');
              else if (!swing && game.stamina > 11) {
                game.weapon = 'sword';
                attack(near.kind === 'sentinel' && game.stamina > 42);
                strikes++;
              }
            } else {
              if (distance(p, finish) < 0.78) {
                keys.clear();
                return { strikes, shots, blocks };
              }
              const c = dungeonCell(p.x, p.z),
                path = dungeonPath(d, state, c, destination);
              if (!path.length && tileKey(...c) !== tileKey(...destination))
                throw Error('unreachable ' + destination);
              const next = path.length ? dungeonPoint(path[0]) : finish;
              const dx = next.x - p.x,
                dz = next.z - p.z;
              game.yaw = Math.atan2(-dx, -dz);
              game.pitch = 0;
              keys.add('KeyW');
            }
            underTick();
          }
          throw Error('route stalled ' + JSON.stringify([destination, game.roomX, game.roomZ, state.foes]));
        };
      });
    await install();
    await checkDoors(page);
    for (const id of ['palace', 'fort']) {
      await page.keyboard.press('m');
      await page.locator('[data-hall="' + id + '"]').click();
      assert.ok(
        await page.evaluate((id) => game.markHall === id && navigationGoal().target === houses[id].door, id),
      );
      const outside = await page.evaluate((id) => {
        const h = houses[id];
        Object.assign(game, clearSpot(h.door.x, h.door.z + 0.6, game));
        game.yaw = 0;
        return interactable()?.house;
      }, id);
      assert.equal(outside, id);
      await page.keyboard.press('e');
      assert.equal(await page.evaluate(() => game.inside), id);
      assert.equal(await page.evaluate(() => game.markHall), null);
      await page.evaluate(() => {
        hallWalk(hallStairs.x, hallStairs.z);
        drawHud();
      });
      await page.keyboard.press('e');
      assert.equal(await page.evaluate(() => game.dungeon), id);
      const topology = await page.evaluate(() => {
        const d = underways[game.dungeon],
          s = dungeonState();
        const path = (dest) => dungeonPath(d, s, d.start, dest).length;
        const gate = dungeonPoint(d.gate);
        const assertGate =
          dungeonFree(gate.x - 0.6, gate.z, 0.34) &&
          !dungeonFree(gate.x - 0.2, gate.z, 0.34) &&
          !dungeonSight({ x: gate.x - 1.3, z: gate.z }, { x: gate.x + 1.6, z: gate.z });
        return {
          lever: path(d.handle),
          seal: path(d.relicAt),
          gateSlab: assertGate,
          free: s.foes.every((m) => dungeonFree(m.x, m.z, bestiary[m.kind].radius)),
        };
      });
      assert.ok(topology.lever > 0 && topology.free && topology.gateSlab);
      assert.equal(topology.seal, 0);
      await page.keyboard.press('m');
      assert.ok((await page.locator('.under-map rect').count()) > 0);
      await page.click('#close');
      const leg = await page.evaluate(() => expedition(underways[game.dungeon].handle));
      await page.keyboard.press('e');
      assert.ok(await page.evaluate(() => dungeonState().unlocked));
      const lift = await page.evaluate(() => {
        const s = dungeonState(),
          gate = dungeonPoint(underways[game.dungeon].gate);
        const closed = !dungeonFree(gate.x, gate.z, 0.34);
        underTick(8);
        const halfway = gateLift(s);
        underTick(26);
        return [closed, halfway, dungeonFree(gate.x, gate.z, 0.34)];
      });
      assert.ok(lift[0] && lift[1] > 0 && lift[1] < 1 && lift[2]);
      await page.keyboard.press('k');
      const before = await page.evaluate(() => [game.roomX, game.roomZ, game.health, game.kills]);
      await page.reload();
      await page.locator('.faction').nth(1).click();
      await page.click('#resume');
      await page.waitForFunction(() => active && Boolean(game?.dungeon));
      await install();
      const after = await page.evaluate(() => [game.roomX, game.roomZ, game.health, game.kills]);
      assert.ok(after.every((n, i) => Math.abs(n - before[i]) < 1));
      const second = await page.evaluate(() => expedition(underways[game.dungeon].relicAt));
      assert.ok(await page.evaluate(() => dungeonState().foes.find((m) => m.kind === 'sentinel').hp === 0));
      const purse = await page.evaluate(() => game.coins);
      await page.keyboard.press('e');
      await page.waitForSelector('.loot-result');
      await page.click('#close');
      assert.equal(await page.evaluate(() => game.coins), purse + (id === 'palace' ? 36 : 56));
      await page.keyboard.press('e');
      assert.equal(await page.evaluate(() => game.coins), purse + (id === 'palace' ? 36 : 56));
      await page.evaluate(() => {
        expedition(underways[game.dungeon].start);
        drawHud();
      });
      await page.keyboard.press('e');
      assert.ok(await page.evaluate(() => !game.dungeon && roomAction()?.key === 'dungeon'));
      await page.evaluate(() => {
        const door = roomFeatures(game.inside).find((f) => f.key === 'leave');
        hallWalk(door.x, door.z);
        drawHud();
      });
      await page.keyboard.press('e');
      assert.equal(await page.evaluate(() => game.inside), null);
      console.log('PASS', id, leg, second);
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
module.exports = checkUnderways;
if (require.main === module)
  (async () => {
    const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'],
    });
    try {
      await checkUnderways(b);
    } finally {
      await b.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
