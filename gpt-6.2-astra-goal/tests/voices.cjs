const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require('playwright');

async function main() {
  const engine = process.env.VOICE_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: engine === chromium ? ['--enable-webgl', '--enable-unsafe-swiftshader'] : [],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Observe the native element's decoder and playback clock, including detached audio elements.
    await page.addInitScript(() => {
      window.mediaCreated = [];
      window.Audio = new Proxy(Audio, {
        construct(ctor, args) {
          const media = Reflect.construct(ctor, args);
          window.mediaCreated.push(media);
          return media;
        },
      });
      window.voiceElement = () => mediaCreated.find((m) => m.currentSrc.includes('/assets/voice/'));
    });
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.click('#begin');
    await page.waitForFunction(() => active && game && world);
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      game.story.phase = 'miller';
      storyInteraction('miller');
    });
    await page.waitForFunction(() => realmVoice.speaker === 'Эльда, мельничиха' && voiceElement()?.currentTime > .18);
    assert.equal(await page.locator('#rehear').isVisible(), true);
    const starts = await page.evaluate(() => {
      const media = voiceElement();
      window.starts = 0;
      media.addEventListener('playing', () => window.starts++);
      return media.currentSrc;
    });
    const firstClip = new URL(starts);
    assert.equal(firstClip.search, firstClip.protocol === 'file:' ? '' : '?v=accent-2');
    await page.click('#rehear');
    await page.waitForFunction(() => window.starts > 0 && voiceElement()?.currentTime > .1);
    assert.equal(await page.evaluate(() => voiceElement().currentSrc), starts);
    await page.click('#close');
    assert.equal(await page.evaluate(() => !realmVoice.active && voiceElement().paused), true);

    // Compare real mix targets while the same battle track continues under the spoken tutorial.
    await page.evaluate(() => {
      game.actors.find((a) => a.team === 'hostile').x = game.x + 2;
      game.actors.find((a) => a.team === 'hostile').z = game.z;
      scoreRefresh();
    });
    await page.waitForFunction(() => scoreAudible === 'battle' && scoreTracks.battle.target > 0);
    const volume = await page.evaluate(() => scoreTracks.battle.target);
    await page.evaluate(() => speak('Капитан Арда', 'Подними щит, когда увидишь замах.'));
    await page.waitForFunction(() => realmVoice.active && voiceElement()?.currentTime > .1 && scoreTracks.battle.target < .3);
    assert.ok(await page.evaluate(() => scoreTracks.battle.target) < volume * .5);
    assert.match(await page.locator('#subtitle').innerText(), /Подними щит/);

    const endings = await page.evaluate(() => {
      const result = [];
      for (let side = 0; side < 3; side++) {
        for (const branch of Object.keys(verdicts)) {
          for (const arrested of branch === 'law' ? [true, false] : [false]) {
            game.side = side;
            Object.assign(game.story, {branch, arrested, phase: 'return'});
            storyInteraction('ending');
            const text = document.querySelector('.story-text').textContent;
            result.push({side, branch, arrested, duration: realmVoice.duration('Из хроники Пограничья',text), replay: !$('rehear').hidden});
            closeModal();
          }
        }
      }
      return result;
    });
    assert.equal(new Set(endings.map((e) => e.side + e.branch)).size, 9);
    assert.equal(endings.length, 12);
    assert.ok(endings.every((e) => e.duration > 10 && e.replay), JSON.stringify(endings));

    await page.evaluate(() => menu());
    await page.click('#settings');
    await page.uncheck('#subtitles');
    await page.locator('#voice').press('Home');
    for (let i = 0; i < 7; i++) await page.locator('#voice').press('ArrowRight');
    await page.click('#close');
    await page.click('#audio');
    await page.reload();
    assert.equal(await page.locator('#audio').getAttribute('aria-pressed'), 'false');
    await page.click('#settings');
    assert.equal(await page.locator('#subtitles').isChecked(), false);
    assert.equal(await page.locator('#voice').inputValue(), '0.35');
    assert.equal(await page.evaluate(() => document.body.classList.contains('no-subtitles')), true);
    assert.equal(await page.evaluate(() => realmVoice.play('Возница','Звонок!')), 0);
    await page.click('#close');
    await page.click('#audio');
    const duration = await page.evaluate(() => realmVoice.play('Возница','Звонок!'));
    assert.ok(duration > 0);
    await page.waitForFunction(() => voiceElement()?.currentTime > .1 && !voiceElement().paused);
    assert.equal(await page.evaluate(() => voiceElement().volume), .35);
    await page.waitForFunction(() => !realmVoice.active);
    assert.deepEqual(errors, []);
    console.log('PASS — native Russian playback, replay, interrupted dialogue, battle mix, 9 endings and both trial outcomes, saved audio settings.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
