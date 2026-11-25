'use strict';
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkCountry(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 570 } }),
    errors = [];
  page.setDefaultTimeout(120000);
  try {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text().slice(0, 400));
    });
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.click('#begin');
    await page.waitForFunction(() => active && world?.renderer.info.render.frame > 0);
    const result = await page.evaluate(() => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      closeModal();
      realmVoice.stop();
      scoreStop();
      game.actors = [];
      game.wagon.x = -60;
      game.wagon.z = -60;
      const checkpoints = [
        ...Object.values(fieldSites).map((p) => [p.title, p.x + p.approach[0], p.z + p.approach[1]]),
        ...Object.values(huntSites).map((p) => [p.name, p.x, p.z]),
        ['Перевал дракона', 98.9, 119.1],
        ...Object.values(houses).flatMap((h) =>
          h.doors.map((d) => [h.name + ' / ' + d.key, d.x, d.z + d.n * 0.9]),
        ),
      ];
      let roadError = 0,
        roadChecks = 0,
        seam = 0,
        footing = 0,
        unchanged = 0,
        highest = -Infinity,
        basin = -Infinity,
        cliff = null;
      for (let i = -144; i < 144; i += 0.5) {
        for (const fixed of [-50, 50])
          for (const [x, z] of [
            [i, fixed],
            [fixed, i],
          ]) {
            roadChecks++;
            roadError = Math.max(roadError, Math.abs(ground(x, z) - surveyedGround(x, z)));
          }
        seam = Math.max(
          seam,
          Math.abs(ground(-143.999, i) - ground(143.999, i)),
          Math.abs(ground(i, -143.999) - ground(i, 143.999)),
        );
      }
      const grid = world.landGrid,
        at = (i, j) => grid.positions.getY((grid.xSteps + 1) * j + i);
      for (let j = 0; j < grid.zSteps; j++)
        for (let i = 0; i < grid.xSteps; i++) {
          const first = j * (grid.xSteps + 1) + i,
            next = first + grid.xSteps + 1;
          const x = grid.positions.getX(first) + (PERIOD / grid.xSteps) * 0.31,
            z = grid.positions.getZ(first) * 0.75 + grid.positions.getZ(next) * 0.25;
          const trueHeight = 0.44 * at(i, j) + 0.31 * at(i + 1, j) + 0.25 * at(i, j + 1),
            rise = rockUplift(x, z);
          if (Math.abs(rise) > 0.23) footing = Math.max(footing, Math.abs(walkingSurface(x, z) - trueHeight));
          else if (!rise) unchanged++;
          highest = Math.max(highest, trueHeight);
          if (Math.abs(x) < 45 && Math.abs(z) < 45) basin = Math.max(basin, trueHeight);
          if (
            !cliff &&
            rise > 4 &&
            world.free(x, z, 0.6) &&
            world.free(x + 0.5, z, 0.6) &&
            ground(x + 0.5, z) - ground(x, z) > 0.83
          ) {
            cliff = [x, z];
          }
        }
      const roll = [];
      for (const path of highTracks)
        for (const points of [path, path.slice().reverse()]) {
          game.x = points[0][0];
          game.z = points[0][1];
          let worst = 0;
          for (let i = 1; i < points.length; i++) {
            const [x, z] = points[i],
              dx = x - game.x,
              dz = z - game.z,
              n = Math.ceil(Math.hypot(dx, dz) / 0.15);
            for (let j = 0; j < n; j++) move(game, dx / n, dz / n);
            worst = Math.max(worst, Math.hypot(game.x - x, game.z - z));
          }
          roll.push(+worst.toFixed(4));
        }
      const w = 288,
        n = w * w,
        open = new Uint8Array(n),
        seen = new Uint8Array(n),
        heights = new Float32Array(n),
        rises = new Float32Array(n);
      for (let j = 0; j < w; j++)
        for (let i = 0; i < w; i++) {
          const x = i - 144,
            z = j - 144,
            k = j * w + i;
          open[k] = +world.free(x, z, 0.48);
          heights[k] = walkingSurface(x, z);
          rises[k] = rockUplift(x, z);
        }
      const key = (x, z) => ((Math.round(z) + 144 + w) % w) * w + ((Math.round(x) + 144 + w) % w);
      const queue = [key(-50, 45)];
      seen[queue[0]] = 1;
      for (let head = 0; head < queue.length; head++) {
        const k = queue[head],
          i = k % w,
          j = (k - i) / w;
        for (const [a, b] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const u = ((j + b + w) % w) * w + ((i + a + w) % w);
          if (
            seen[u] ||
            !open[u] ||
            ((rises[k] > 0.12 || rises[u] > 0.12) && Math.abs(heights[k] - heights[u]) > 0.93)
          )
            continue;
          seen[u] = 1;
          queue.push(u);
        }
      }
      const missed = checkpoints
        .filter(([, x, z]) => ![-1, 0, 1].some((a) => [-1, 0, 1].some((b) => seen[key(x + a, z + b)])))
        .map((p) => p[0]);
      let wall = null;
      if (cliff) {
        [game.x, game.z] = cliff;
        const before = game.x;
        move(game, 0.45, 0);
        const up = game.x - before;
        game.x = before + 0.45;
        move(game, -0.45, 0);
        wall = { up, down: before + 0.45 - game.x };
      }
      world.lod(game.x, game.z);
      world.display(game, gameTime, 0, 0, null);
      return {
        roadChecks,
        roadError,
        seam,
        footing,
        highest,
        basin,
        roll,
        checkedSites: checkpoints.length,
        missed,
        reachable: queue.length,
        unchanged,
        wall,
      };
    });
    console.log(JSON.stringify({ result, errors }));
    assert.deepEqual(errors, []);
    assert.equal(result.roadError, 0);
    assert.ok(result.seam < 0.002);
    assert.ok(result.footing < 0.001);
    assert.ok(result.highest > 38);
    assert.ok(result.basin < 6, 'An isolated summit returned beside the inner convoy roads');
    assert.deepEqual(result.missed, []);
    assert.ok(result.roll.every((n) => n < 0.06));
    assert.ok(result.wall && result.wall.up < 0.2 && result.wall.down > 0.4);
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
