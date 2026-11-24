const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { extname, resolve, sep } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require('playwright');

const edition = resolve(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
};

// Mount in a subdirectory, as on Pages, to exercise the game's relative URLs.
async function serve() {
  const prefix = '/edition/';
  const server = createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!name.startsWith(prefix)) throw Error();
      const file = resolve(edition, name.slice(prefix.length) || 'index.html');
      if (!file.startsWith(edition + sep)) throw Error();
      const data = await readFile(file);
      const headers = {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      };
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const start = Number(range[1]);
        const end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
        if (end < start) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + data.length }).end();
          return;
        }
        const slice = data.subarray(start, end + 1);
        res.writeHead(206, {
          ...headers,
          'Content-Range': 'bytes ' + start + '-' + end + '/' + data.length,
          'Content-Length': slice.length,
        });
        res.end(slice);
      } else {
        res.writeHead(200, { ...headers, 'Content-Length': data.length });
        res.end(data);
      }
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
  return { server, url: 'http://127.0.0.1:' + server.address().port + prefix };
}

async function measureCue(page, key, localFile) {
  await page.waitForFunction((key) => scoreAudible === key && scoreTracks[key].level > 0.25, key, {
    timeout: 20000,
  });
  const reading = await page.evaluate(async (key) => {
    const track = scoreTracks[key];
    if (track.native) {
      const start = track.media.currentTime;
      await new Promise((done) => setTimeout(done, 250));
      return {
        advance: track.media.currentTime - start,
        ready: track.media.readyState,
        level: track.media.volume,
      };
    }
    const node = audioCtx.createAnalyser();
    node.fftSize = 2048;
    track.gain.connect(node);
    const frames = new Float32Array(node.fftSize);
    let energy = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise((done) => setTimeout(done, 35));
      node.getFloatTimeDomainData(frames);
      for (const f of frames) energy += f * f;
    }
    track.gain.disconnect(node);
    return {
      rms: Math.sqrt(energy / (10 * frames.length)),
      channels: track.buffer.numberOfChannels,
      loopError: Math.abs(track.node.loopEnd - track.buffer.duration),
    };
  }, key);
  if (localFile) {
    assert.ok(reading.advance > 0.05 && reading.ready >= 2 && reading.level > 0.2, key + ' file playback');
  } else {
    assert.ok(
      reading.rms > 0.001 && reading.loopError < 0.055 && reading.channels === 2,
      key + ' Web Audio playback',
    );
  }
  return reading;
}

async function run(browser, url) {
  const page = await browser.newPage({ viewport: { width: 720, height: 420 } });
  const errors = [];
  const localFile = url.startsWith('file:');
  try {
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(() => {
      prefs.quality = 'light';
    });
    assert.equal(await page.evaluate(() => scoreAudible), '', 'autoplay before the first gesture');
    await page.click('#begin');
    await page.waitForFunction(() => active && world.renderer.info.render.frame > 0);
    await page.evaluate(() => {
      cancelAnimationFrame(frame);
      closeModal();
      game.actors = [];
      Object.assign(game, { x: 0, z: 0, inside: null, delivery: null });
      Object.assign(game.wagon, { x: 45, z: 0 });
    });
    const cues = ['road', 'battle', 'fair', 'mill'];
    for (const cue of cues) {
      await page.evaluate((cue) => {
        game.inside = cue === 'mill' ? 'mill' : null;
        game.delivery = cue === 'fair' ? { gate: 1 } : null;
        game.actors = cue === 'battle' ? [{ x: 1, z: 1, hp: 20, team: 'hostile' }] : [];
        scoreRefresh();
      }, cue);
      console.log(new URL(url).protocol, cue, await measureCue(page, cue, localFile));
    }
    await page.evaluate(() => {
      window.millOutput = () => {
        const track = scoreTracks.mill;
        return track.native ? track.media.volume : track.gain.gain.value;
      };
    });
    await page.waitForFunction(() => millOutput() > 0.54);
    // Play the same packaged Russian line and public voice API as the regent's hearing.
    const seconds = await page.evaluate(() =>
      realmVoice.play('Регент Вельт', 'Подделать такое копыто невозможно. Ведите.'),
    );
    assert.ok(seconds > 1, 'recorded voice line was found');
    await page.waitForFunction(() => realmVoice.active && millOutput() < 0.22, null, {
      timeout: 5000,
    });
    await page.waitForFunction(() => !realmVoice.active && millOutput() > 0.54, null, {
      timeout: (seconds + 5) * 1000,
    });
    await page.evaluate(() => {
      prefs.music = 0;
      scoreRefresh();
    });
    assert.ok(
      await page.evaluate(() =>
        Object.values(scoreTracks).every((t) => t.level === 0 && !t.node && (!t.media || t.media.paused)),
      ),
    );
    await page.evaluate(() => {
      prefs.music = 0.8;
      scoreRefresh();
    });
    await measureCue(page, 'mill', localFile);
    await page.evaluate(() => scoreStop());
    assert.ok(
      await page.evaluate(
        () =>
          !scoreTimer &&
          !scoreMode &&
          !terrainAudio &&
          Object.values(scoreTracks).every((track) => !track.buffer),
      ),
    );
    await page.evaluate(() => menu());
    await page.click('#post-race');
    await page.waitForFunction(
      () => game.delivery?.phase === 'brief' && realmVoice.active && scoreAudible === 'fair',
    );
    await page.click('#post-start');
    await page.waitForFunction(() => game.delivery?.phase === 'running' && scoreTracks.fair.level > 0.25);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function main() {
  const host = process.env.GAME_URL ? null : await serve();
  let browser;
  try {
    const engine = process.env.SCORE_BROWSER === 'webkit' ? webkit : chromium;
    browser = await engine.launch({
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: engine === chromium ? ['--enable-webgl', '--enable-unsafe-swiftshader'] : [],
    });
    await run(browser, process.env.GAME_URL || host.url);
    await run(browser, pathToFileURL(resolve(edition, 'index.html')).href);
  } finally {
    if (browser) await browser.close();
    if (host) await new Promise((done) => host.server.close(done));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
