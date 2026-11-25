'use strict';
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdirSync } = require('node:fs');

module.exports = async function playRoleOpenings(browser) {
  const urls = process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href;
  const shots = process.env.ROLE_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  const outcomes = [];
  for (let side = 0; side < 3; side++) {
    const page = await browser.newPage({
        viewport: shots ? { width: 1600, height: 900 } : { width: 1100, height: 700 },
      }),
      errors = [];
    try {
      page.on('pageerror', (error) => errors.push(error.message));
      if (process.env.QA_LIGHT)
        await page.addInitScript(() => {
          localStorage.setItem('korovany.goal.preferences', JSON.stringify({ quality: 'light' }));
        });
      await page.addInitScript(() => {
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) {
          if (this.src.includes('/assets/roles/')) window.stageSound = this;
          return play.apply(this, args);
        };
      });
      await page.goto(urls);
      await page.locator('#factions button').nth(side).click();
      await page.click('#role-begin:enabled');
      await page.waitForFunction((side) => prologue?.kind === 'role' && prologue.side === side, side, {
        timeout: 60000,
      });
      let heard = [];
      assert.equal(await page.evaluate(() => game.march ?? null), null);
      await page.evaluate(() => {
        cancelAnimationFrame(frame);
      });
      await page.click('#opening-pause');
      assert(await page.evaluate(() => prologue.paused));
      const still = await page.evaluate(() => {
        const t = prologue.time;
        drawPrologue(0.3);
        return prologue.time === t;
      });
      assert(still);
      await page.click('#opening-pause');
      for (let j = 1; j <= 3; j++) {
        // An unusually slow initial render may already have advanced to the first speaker.
        if ((await page.evaluate(() => prologue.shot)) < j) await page.click('#role-next');
        await page.waitForFunction(
          (j) => prologue.shot === j && window.stageSound?.currentTime > 0.04 && !stageSound.paused,
          j,
          { timeout: 12000 },
        );
        const result = await page.evaluate(() => {
          const p = prologue,
            s = p.script.shots[p.shot],
            row = roleSpeech[s.line];
          if (p.side === 1 && p.shot === 1) {
            // The camera reaches its destination before a slowly delivered voice has ended.
            p.elapsed = p.length + 4;
            drawPrologue(0.01);
            if (p.shot !== 1) throw Error('Guard cut interrupted the sentinel');
            const elapsed = p.elapsed,
              playhead = realmVoice.playhead;
            pauseRoleOpening();
            if (realmVoice.active || !stageSound.paused) throw Error('Speech continued on pause');
            pauseRoleOpening();
            if (p.elapsed !== elapsed || realmVoice.playhead < playhead - 0.04)
              throw Error('Resume rewound the take');
          }
          let jaw = 0;
          for (let i = 0; i < 6; i++) drawPrologue(0.04);
          const face = p.cast.get(s.who).face;
          if (face.length) jaw = face[0].morphTargetInfluences[0];
          return {
            key: s.line,
            expected: row[1],
            actual: $('opening-words').textContent,
            speaker: $('opening-speaker').textContent,
            playing: realmVoice.speaker,
            source: stageSound.src,
            actor: p.cast.get(s.who).person.userData.state,
            face: face.length,
            jaw,
          };
        });
        assert.equal(result.actual, result.expected);
        assert.equal(result.playing, result.speaker);
        assert(
          result.source.includes('/' + result.key + '.mp3') &&
            result.face > 0 &&
            result.jaw >= 0 &&
            result.jaw <= 1.001,
        );
        assert.equal(result.actor, 'talk');
        heard.push(result.key);
        if (shots && j === (side === 0 ? 2 : 3)) {
          const hide = await page.addStyleTag({
            content: '#play > :not(#view){visibility:hidden!important}',
          });
          await page.screenshot({ path: resolve(shots, 'intro-' + ['elf', 'guard', 'lord'][side] + '.png') });
          await hide.evaluate((node) => node.remove());
        }
      }
      if (side === 2) {
        const styles = await page.evaluate(() => {
          const p = prologue;
          return [...p.cast.values()]
            .filter((f) => f.source?.tag === 'squad')
            .map((f) => [f.source.id, f.person.userData.actorStyle.person.seed, actorSeed(f.source)]);
        });
        assert.equal(styles.length, 3);
        for (const [, actual, expected] of styles) assert.equal(actual, expected);
      }
      await page.click('#role-next');
      await page.waitForFunction(() => active && !prologue);
      assert.equal(await page.evaluate(() => game.story.entries.length), 1);
      const start = await page.evaluate(() => [game.x, game.z, game.side, goal().text]);
      await page.keyboard.press('j');
      assert.equal(await page.locator('[data-journal-tab="story"]').getAttribute('aria-pressed'), 'true');
      assert(
        (await page.locator('#dialog-body').innerText()).includes(
          await page.evaluate(() => roleOvertures[game.side].title),
        ),
      );
      await page.click('#close');
      await page.keyboard.press('k');
      assert.equal(
        await page.evaluate(() => JSON.parse(localStorage.getItem(saveKey())).journalTab),
        'story',
      );
      if (side === 0) {
        const battle = await page.evaluate(() => {
          let seed = 724115;
          Math.random = () => {
            seed = (1664525 * seed + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          const key = (code) => {
            document.dispatchEvent(new KeyboardEvent('keydown', { code }));
            document.dispatchEvent(new KeyboardEvent('keyup', { code }));
          };
          const count = game.actors.filter((a) => a.tag === 'first' && a.hp > 0).length;
          for (let i = 0; i < 4200 && game.stage === 0 && game.health > 0 && !$('dialog').open; i++) {
            const t = game.actors
              .filter((a) => a.tag === 'first' && a.hp > 0)
              .sort((a, b) => distance(a, game) - distance(b, game))[0];
            if (t) {
              const d = distance(t, game);
              game.yaw = Math.atan2(game.x - t.x, game.z - t.z);
              if (d > 3.2 && d < 22 && game.arrows && visiblePath(game, t)) {
                if (game.weapon !== 'bow') key('Digit2');
                game.pitch = Math.atan2(ground(t.x, t.z) - ground(game.x, game.z) - 0.18, d);
                key('KeyF');
              } else if (d > 2.3) {
                if (game.weapon !== 'sword') key('Digit1');
                keys.add('KeyW');
              } else {
                if (game.weapon !== 'sword') key('Digit1');
                game.pitch = 0;
                if (t.windup > 0.12) keys.add('KeyR');
                else key('KeyF');
              }
              if (d < 2.8 && i % 45 === 0) key('KeyG');
              if (game.health < 53 && game.bandages) key('KeyH');
            }
            step(0.04);
            gameTime += 0.04;
            keys.clear();
          }
          return [count, game.stage, game.kills, game.health];
        });
        assert.equal(battle[0], 2);
        assert.equal(battle[1], 1);
        assert(battle[2] >= 2 && battle[3] > 0);
      } else if (side === 1) {
        assert(await page.evaluate(() => interactable()?.a?.tag === 'commander'));
        await page.keyboard.press('e');
        assert.equal(await page.evaluate(() => game.stage), 1);
        assert.equal(
          await page.evaluate(() => game.actors.filter((a) => a.tag === 'spy' && a.hp > 0).length),
          2,
        );
      } else {
        await page.keyboard.press('q');
        await page.click('#palace');
        assert.deepEqual(
          await page.evaluate(() => [
            game.raid,
            game.order,
            game.actors.filter((a) => a.tag === 'raid' && a.hp > 0).length,
          ]),
          [1, 'raid', 3],
        );
      }
      assert.deepEqual(errors, []);
      outcomes.push({ side, start, heard });
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify(outcomes));
};
if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      headless: true,
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
