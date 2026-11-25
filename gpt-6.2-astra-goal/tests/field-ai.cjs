'use strict';
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkFieldFighters(browser) {
  const page = await browser.newPage({ viewport: { width: 950, height: 570 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.locator('#begin:enabled').waitFor();
    await page.evaluate(() => $('begin').click());
    await page.waitForFunction(() => active && world, null, { timeout: 120000 });
    const first = await page.evaluate(() => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      scoreStop();
      closeModal();
      realmVoice.stop();
      const seed = game.aiSeed,
        old = game.actors.filter((a) => a.tag === 'escort');
      const legacy = old.map((a) => ({ id: a.id, kind: a.kind, tag: a.tag, team: a.team, x: a.x, z: a.z }));
      const serial = game.aiSeed;
      delete game.aiSeed;
      const oldSeeds = legacy.map((a) => actorSeed(a)),
        restoredSeeds = legacy.map((a) => {
          delete a.seed;
          return actorSeed(a);
        });
      game.aiSeed = serial;
      const tail = convoyPlace(game.wagon, 0, -3.3);
      Object.assign(game, clearSpot(tail.x, tail.z, game));
      game.yaw = angles(faceField(game, game.wagon) + Math.PI);
      window.guardPair = () => game.actors.filter((a) => a.tag === 'escort');
      window.guardPress = (code) => {
        document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      };
      window.guardFrame = () => {
        gameTime += 1 / 45;
        step(1 / 45);
      };
      window.defendGuard = () => {
        const active = guardPair()
          .filter((a) => a.hp > 0)
          .sort((a, b) => (a.windup > 0 ? a.windup : 15) - (b.windup > 0 ? b.windup : 15));
        if (active[0]) game.yaw = angles(faceField(game, active[0]) + Math.PI);
        if (active[0]?.windup > 0) keys.add('KeyR');
        else keys.delete('KeyR');
        if (game.health < 55 && game.bandages) guardPress('KeyH');
      };
      window.observedFight = (seconds) => {
        const pair = guardPair(),
          events = [],
          modes = [new Set(), new Set()],
          serial = pair.map((a) => a.strikeSerial || 0),
          active = pair.map((a) => a.windup > 0);
        let minGap = Infinity;
        for (let i = 0; i < Math.round(seconds * 45) && game.health > 0; i++) {
          defendGuard();
          guardFrame();
          minGap = Math.min(minGap, distance(pair[0], pair[1]));
          pair.forEach((a, k) => {
            if (a.hp <= 0) return;
            modes[k].add(a.mind.mode);
            if (!active[k] && a.windup > 0)
              events.push([i, k, 'begin', a.mind.attack, +a.windDuration.toFixed(4)]);
            if ((a.strikeSerial || 0) > serial[k]) events.push([i, k, 'release', a.mind.attack]);
            active[k] = a.windup > 0;
            serial[k] = a.strikeSerial || 0;
          });
        }
        keys.clear();
        return {
          events,
          modes: modes.map((s) => [...s]),
          minGap: +minGap.toFixed(3),
          end: pair.map((a) => [a.id, a.mind.rng, a.mind.mode, +a.x.toFixed(3), +a.z.toFixed(3)]),
          health: game.health,
        };
      };
      return { seed, oldSeeds, restoredSeeds };
    });
    assert.deepEqual(first.oldSeeds, first.restoredSeeds);
    assert.equal(new Set(first.oldSeeds).size, 2);
    await page.keyboard.press('e');
    const alarm = await page.evaluate(() => {
      const pair = guardPair();
      for (let n = 0; n < 250 && !pair.some((a) => a.windup > 0); n++) {
        defendGuard();
        guardFrame();
      }
      keys.clear();
      const saved = save();
      return {
        saved,
        alarm: game.wagon.convoy?.alarm,
        wind: pair.some((a) => a.windup > 0),
        ids: pair.map((a) => [a.seed, a.mind.profile, a.mind.rng, a.windup || 0]),
        valid: valid(readSlot()),
      };
    });
    assert.ok(alarm.saved && alarm.alarm && alarm.wind && alarm.valid, JSON.stringify(alarm));
    assert.equal(new Set(alarm.ids.map((k) => k[1])).size, 2);
    async function restore() {
      await page.evaluate(() => menu());
      await page.waitForFunction(() => !active && !document.pointerLockElement, null, { polling: 40 });
      await page.locator('#resume:enabled').click();
      await page.waitForFunction(() => active && !$('dialog').open, null, { polling: 40 });
      const resumed = await page.evaluate(() =>
        guardPair().map((a) => [a.seed, a.mind.profile, a.mind.rng, a.windup || 0]),
      );
      assert.deepEqual(resumed, alarm.ids);
    }
    await restore();
    const runA = await page.evaluate(() => observedFight(10.5));
    await restore();
    const runB = await page.evaluate(() => observedFight(10.5));
    assert.deepEqual(
      runA.events,
      runB.events,
      'Loaded NPCs retain their RNG, precise swing times and moves.',
    );
    assert.deepEqual(runA.end, runB.end);
    const releases = runA.events.filter((e) => e[2] === 'release'),
      begins = runA.events.filter((e) => e[2] === 'begin');
    assert.ok(runA.health > 0 && runA.minGap >= 0.72);
    for (const i of [0, 1])
      assert.ok(
        releases.some((e) => e[1] === i),
        'Both guards released their own attacks',
      );
    assert.ok(runA.modes.some((m) => m.includes('flank')));
    assert.ok(begins.length >= 4);
    const starts = new Set(begins.map((e) => e[0]));
    assert.equal(starts.size, begins.length);
    await restore();
    const lone = await page.evaluate(() => {
      const pair = guardPair();
      let foe;
      for (let i = 0; i < 750 && pair.every((a) => a.hp > 0) && game.health > 0; i++) {
        foe = foe || pair.slice().sort((a, b) => distance(game, a) - distance(game, b))[0];
        game.yaw = angles(faceField(game, foe) + Math.PI);
        if (distance(game, foe) > 2.65) keys.add('KeyW');
        else {
          keys.delete('KeyW');
          guardPress('KeyG');
        }
        if (game.health < 58 && game.bandages) guardPress('KeyH');
        guardFrame();
      }
      keys.clear();
      const other = pair.find((a) => a.hp > 0),
        dead = pair.filter((a) => a.hp <= 0);
      if (!other || dead.length !== 1)
        return { error: 'Could not isolate a surviving foot guard', hp: pair.map((a) => a.hp) };
      const start = other.strikeSerial || 0;
      observedFight(9);
      return {
        kills: dead.length,
        replies: (other.strikeSerial || 0) - start,
        health: game.health,
        stance: other.mind.profile,
      };
    });
    assert.ok(lone.kills === 1 && lone.replies >= 2 && lone.health > 0, JSON.stringify(lone));
    // Load the actual old schema mid-fight; its actors had cd/windup but no private random streams.
    await restore();
    const old = await page.evaluate(() => {
      delete game.aiSeed;
      for (const a of game.actors) {
        delete a.seed;
        delete a.mind;
        delete a.windDuration;
        delete a.strikeSerial;
      }
      return save() && valid(readSlot());
    });
    assert.equal(old, true);
    await page.evaluate(() => menu());
    await page.waitForFunction(() => !active && !document.pointerLockElement, null, { polling: 40 });
    await page.locator('#resume:enabled').click();
    await page.waitForFunction(() => active && !$('dialog').open, null, { polling: 40 });
    const migrated = await page.evaluate(() => {
      const pair = guardPair();
      guardFrame();
      observedFight(7);
      return pair.map((a) => ({ id: a.seed, style: a.mind?.profile, releases: a.strikeSerial || 0 }));
    });
    assert.equal(new Set(migrated.map((a) => a.style)).size, 2);
    assert.ok(
      migrated.every((a) => Number.isInteger(a.id) && a.releases > 0),
      JSON.stringify(migrated),
    );
    const next = await page.evaluate(() => {
      menu();
      start(false);
      cancelAnimationFrame(frame);
      return game.aiSeed;
    });
    assert.notEqual(next, first.seed);
    assert.deepEqual(errors, []);
    console.log(
      'PASS autonomous field fighters',
      JSON.stringify({
        seed: first.seed,
        roles: alarm.ids.map((k) => k[1]),
        begins,
        releases: releases.length,
        decisions: runA.modes,
        clearance: runA.minGap,
        solo: lone,
        restored: true,
        migrated,
      }),
    );
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
