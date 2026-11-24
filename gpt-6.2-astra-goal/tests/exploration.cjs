const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const defaultURL = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
module.exports = async (browser) => {
  const p = await browser.newPage({ viewport: { width: 920, height: 680 } });
  const errs = [],
    logs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      window.fieldAudioLog = [];
      HTMLMediaElement.prototype.play = function (...args) {
        if (this.src.includes('/assets/exploration/')) {
          window.fieldMedia = this;
          fieldAudioLog.push(this.src);
        }
        return play.apply(this, args);
      };
    });
    await p.goto(process.env.GAME_URL || defaultURL);
    await p.locator('#factions button').nth(1).click();
    await p.click('#begin');
    await p.waitForFunction(() => active && world?.fieldLandmarks);
    const setupWalk = () =>
      p.evaluate(() => {
        cancelAnimationFrame(frame);
        if ($('dialog').open) closeModal();
        realmVoice.stop();
        scoreStop();
        window.expWalk = (id) => {
          const goal = fieldPoint(id),
            margin = bodyRadius(game) + 0.08;
          const clear = (x, z) => livingFree(x, z, margin, game) && Math.hypot(x - 95, z - 120) > 16.6;
          // Replay move()'s arithmetic at each footprint, including the fractional endpoint left by the previous step.
          const trace = (x, z, tx, tz) => {
            const steps = Math.max(1, Math.ceil(Math.hypot(tx - x, tz - z) / 0.18));
            const dx = (tx - x) / steps,
              dz = (tz - z) / steps;
            for (let i = 0; i < steps; i++) {
              const nx = x + dx,
                nz = z + dz;
              if (!canClimbStep(x, z, nx, nz) || !clear(nx, nz)) return null;
              x = wrapped(nx);
              z = wrapped(nz);
            }
            return [x, z];
          };
          const W = 287,
            idx = (x, z) => (z + 143) * W + x + 143,
            xx = (k) => (k % W) - 143,
            zz = (k) => Math.floor(k / W) - 143;
          const sx = Math.round(game.x),
            sz = Math.round(game.z),
            gx = Math.round(goal.x),
            gz = Math.round(goal.z);
          const root = idx(sx, sz),
            first = trace(game.x, game.z, sx, sz);
          if (!first) throw Error('Cannot reach walking grid: ' + id + ' ' + [game.x, game.z, sx, sz]);
          const prev = new Int32Array(W * W).fill(-2);
          const reachedX = new Float64Array(W * W),
            reachedZ = new Float64Array(W * W);
          // Prefer vertices near the destination. Every other reachable vertex stays in the queue for detours.
          const buckets = Array.from({ length: 2 * W + 1 }, () => []);
          let priority = buckets.length,
            end = -1;
          const enqueue = (k, tx, tz, point, parent) => {
            prev[k] = parent;
            reachedX[k] = point[0];
            reachedZ[k] = point[1];
            const score = Math.abs(tx - gx) + Math.abs(tz - gz);
            buckets[score].push(k);
            priority = Math.min(priority, score);
          };
          enqueue(root, sx, sz, first, -1);
          while (priority < buckets.length) {
            if (!buckets[priority].length) {
              priority++;
              continue;
            }
            const k = buckets[priority].pop(),
              x = xx(k),
              z = zz(k);
            if (Math.hypot(x - goal.x, z - goal.z) < 1.24) {
              end = k;
              break;
            }
            for (const [dx, dz] of [
              [0, 1],
              [1, 0],
              [0, -1],
              [-1, 0],
            ]) {
              const a = x + dx,
                b = z + dz;
              if (a < -143 || a > 143 || b < -143 || b > 143) continue;
              const n = idx(a, b);
              if (prev[n] !== -2) continue;
              const reached = trace(reachedX[k], reachedZ[k], a, b);
              if (reached) enqueue(n, a, b, reached, k);
            }
          }
          if (end < 0) throw Error('No walking route: ' + id + ' ' + [sx, sz]);
          const route = [];
          for (let k = end; k >= 0; k = prev[k]) route.push([xx(k), zz(k)]);
          route.reverse();
          let dist = 0;
          for (const [x, z] of route) {
            dist += move(game, x - game.x, z - game.z);
            if (Math.hypot(x - game.x, z - game.z) > 1e-7)
              throw Error('Collision ' + id + ': ' + [x, z, game.x, game.z]);
            fieldQuestTick(0.56);
          }
          game.yaw = Math.atan2(game.x - fieldSites[id].x, game.z - fieldSites[id].z);
          drawHud();
          const match = interactable();
          if (match?.site !== id) throw Error('Wrong E target ' + id + ' ' + match?.label);
          return Math.round(dist);
        };
      });
    await setupWalk();
    const go = async (id) => {
      const d = await p.evaluate((x) => expWalk(x), id);
      await p.keyboard.press('KeyE');
      await p.waitForFunction(() => $('dialog').open);
      logs.push([id, d]);
    };
    const btn = async (name) => {
      await p.getByRole('button', { name, exact: true }).click({ timeout: 3500 });
    };
    const link = async (id, prefix) => {
      await go(id);
      await btn(prefix);
    };
    const loc = async () =>
      await p.evaluate(() => ({
        xp: game.training?.xp || 0,
        level: heroLevel(),
        kills: game.kills,
        paid: [...fieldState().paid],
        state: JSON.parse(JSON.stringify(fieldState())),
        money: game.coins,
        bandages: game.bandages,
        arrows: game.arrows,
      }));
    // Saved field scenes run through the normal UI, including active native voices and their animated studio subjects.
    const portrait = async (speaker) => {
      await p.waitForFunction(
        (who) =>
          window.fieldMedia?.currentTime > 0.035 &&
          !fieldMedia.paused &&
          fieldMedia.readyState >= 2 &&
          realmVoice.active &&
          realmVoice.speaker === who &&
          dialogueStage?.subject?.userData?.state === 'talk' &&
          $('portrait-stage')?.querySelector('canvas'),
        speaker,
        { timeout: 5000 },
      );
    };
    const savedKey = () => p.evaluate(() => ({ key: saveKey(), raw: localStorage.getItem(saveKey()) }));
    const branchSave = async () => {
      await p.click('#close');
      await p.keyboard.press('KeyK');
      const data = await savedKey();
      await p.keyboard.press('KeyE');
      return data;
    };
    const resume = async (data) => {
      await p.evaluate(({ key, raw }) => {
        localStorage.removeItem(key + '.checkpoint');
        localStorage.setItem(key, raw);
      }, data);
      await p.reload();
      await p.locator('#factions button').nth(1).click();
      await p.click('#resume');
      await p.waitForFunction(() => active && world?.fieldLandmarks);
      await setupWalk();
      const old = JSON.parse(data.raw);
      assert.equal(await p.evaluate(() => game.training.xp), old.training.xp);
      assert.deepEqual(await p.evaluate(() => game.exploration), old.exploration);
    };
    const snap = async (name) => {
      if (process.env.FIELD_SCREENSHOTS)
        await p.screenshot({ path: path.join(process.env.FIELD_SCREENSHOTS, name + '.jpg'), quality: 87 });
    };
    await p.keyboard.press('KeyJ');
    await p.locator('[data-field-track="river"]').click();
    await p.click('#close');
    assert.equal(await p.evaluate(() => fieldState().tracked), 'river');
    assert.equal((await loc()).xp, 0);
    await go('ferry');
    await portrait('Рада');
    await snap('portrait-rada');
    await p.click('#field-rehear');
    await portrait('Рада');
    await btn('Восстановить сигнал');
    await go('ferry');
    await portrait('Рада');
    await btn('Искать рейку');
    await link('gauge', 'Запомнить и отойти');
    await go('ferry');
    for (const x of ['Средний колокол', 'Большой колокол', 'Малый колокол']) await btn(x);
    assert.ok((await p.locator('#dialog-body').innerText()).includes('Сигнал распался'));
    for (const x of ['Большой колокол', 'Малый колокол', 'Малый колокол']) await btn(x);
    await portrait('Рада');
    const riverSave = await branchSave();
    await btn('Передать ключ семьям');
    await btn('Вернуться на тракт');
    await go('reeds');
    await btn('Забрать припасы');
    await go('camp');
    await portrait('Лист');
    await snap('portrait-list');
    await btn('Найти последнее имя');
    await go('camp');
    await portrait('Лист');
    await btn('Отойти');
    await link('kiln', 'Запомнить и отойти');
    await link('memorial', 'Запомнить и отойти');
    await go('camp');
    await btn('Терен');
    assert.ok((await p.locator('#dialog-body').innerText()).includes('отметины расходятся'));
    await btn('Юрко');
    await portrait('Лист');
    const nameSave = await branchSave();
    await btn('Врезать жетон в камень');
    await btn('Вернуться на тракт');
    await link('memorial', 'Взять свёрток');
    await go('cairn');
    await btn('Забрать припасы');
    await go('observatory');
    await portrait('Эсма');
    await snap('portrait-esma');
    await btn('Найти новую линзу');
    await go('observatory');
    await portrait('Эсма');
    await btn('Отойти');
    await link('shard', 'Запомнить и отойти');
    await go('observatory');
    await btn('Взглянуть в трубу');
    assert.ok((await p.locator('#dialog-body').innerText()).includes('склон без обгоревшего камня'));
    await btn('Повернуть алидаду');
    await btn('Поднять окуляр');
    await btn('Взглянуть в трубу');
    await portrait('Эсма');
    await btn('Убрать окуляр');
    await go('survey');
    await btn('Забрать припасы');
    const before = await loc();
    assert.equal(before.xp, 645);
    assert.equal(before.level, 5);
    assert.equal(before.kills, 0);
    await p.keyboard.press('KeyK');
    const cache = await p.evaluate(() => JSON.parse(localStorage.getItem(saveKey())));
    assert.equal(cache.training.xp, 645);
    assert.deepEqual(cache.exploration, before.state);
    const dragonSave = await savedKey();
    const allAudio = await p.evaluate(() => [
      ...new Set(fieldAudioLog.map((s) => new URL(s).pathname.split('/').pop())),
    ]);
    assert.equal(allAudio.length, 9);
    await resume(dragonSave);
    await go('mast');
    await btn('Поставить белую лопасть к тропе');
    await btn('Вернуться на тракт');
    const finished = await loc();
    assert.equal(finished.xp, 710);
    assert.equal(finished.kills, 0);
    assert.equal(finished.state.visited.length, 11);
    await go('reeds');
    assert.ok((await p.locator('#dialog-body').innerText()).includes('Закладка пуста'));
    await btn('Отойти');
    assert.equal((await loc()).xp, 710);
    await p.keyboard.press('KeyJ');
    const text = await p.locator('#dialog-body').innerText();
    assert.ok(text.includes('11 из 11') && text.includes('Завершено'));
    await p.click('#close');
    await p.keyboard.press('KeyM');
    assert.equal(await p.locator('.field-map-mark').count(), 11);
    await p.click('#close');
    await resume(riverSave);
    await go('ferry');
    await btn('Передать ключ артели');
    await btn('Вернуться на тракт');
    assert.equal((await loc()).state.choices.river, 'trade');
    await go('ferry');
    const preTrade = await loc();
    await btn('Купить двенадцать стрел · 4 монеты');
    const afterTrade = await loc();
    assert.equal(afterTrade.arrows - preTrade.arrows, 12);
    assert.equal(afterTrade.money - preTrade.money, -4);
    await resume(nameSave);
    await go('camp');
    await btn('Отдать жетон сестре');
    await btn('Вернуться на тракт');
    assert.equal((await loc()).state.choices.names, 'kin');
    await link('kiln', 'Взять бинты');
    assert.ok((await loc()).paid.includes('kin-gift'));
    await resume(dragonSave);
    await go('mast');
    await btn('Отметить поток над гнездом');
    await btn('Вернуться на тракт');
    assert.equal((await loc()).state.choices.glass, 'wind');
    assert.equal((await loc()).xp, 710);
    logs.forEach((row) => console.log(...row));
    console.log(
      'PASS: peaceful XP 0→645→710, level 5, zero kills, 11 new sites. All 3 portraits spoke, 3 alternate wrong puzzle paths corrected, journal+map, saved+resumed states, duplicate loot, six tested endings and all 9 native audio files.',
    );
    assert.deepEqual(errs, []);
  } finally {
    await p.close();
  }
};

if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
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
