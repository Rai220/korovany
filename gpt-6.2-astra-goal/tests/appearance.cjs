'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

module.exports = async function checkCompany(browser) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text());
  });
  try {
    await page.goto(process.env.GAME_URL || pathToFileURL(resolve(__dirname, '../index.html')).href);
    await page.locator('#begin').evaluate((b) => b.click());
    await page.waitForFunction(() => active && world?.renderer.info.render.frame);
    const result = await page.evaluate(() => {
      cancelAnimationFrame(frame);
      window.requestAnimationFrame = () => 0;
      closeModal();
      realmVoice.stop();
      scoreStop();
      function readPatrol() {
        const guards = game.actors.filter((a) => a.tag === 'escort');
        game.x = guards[0].x;
        game.z = guards[0].z + 2;
        world.lod(game.x, game.z);
        world.display(game, 7, 0, 0, null);
        return guards.map((a) => {
          const actor = world.actors.get(a.id),
            p = actor.userData.actorStyle.person;
          const shield = actor.getObjectByName('arms').material.map.image,
            ctx = shield.getContext('2d');
          // Fingerprint the player's visible paint, not just the material keys.
          const pixels = ctx.getImageData(0, 0, shield.width, shield.height).data;
          let paint = 2166136261;
          for (let i = 0; i < pixels.length; i += 76) paint = Math.imul(paint ^ pixels[i], 16777619);
          return {
            id: a.id,
            seed: a.seed,
            cut: p.cut,
            scale: actor.scale.toArray(),
            style: actor.userData.actorStyle.id,
            paint: paint >>> 0,
            bones: actor.userData.skeleton.bones.length,
          };
        });
      }
      const first = readPatrol();
      const saved = save() && valid(readSlot());
      start(true);
      cancelAnimationFrame(frame);
      closeModal();
      const loaded = readPatrol();
      const old = { id: 811, kind: 'spy', tag: 'ambush', team: 'hostile' },
        migrated = personalCut(old.kind, old.tag, { ...old });
      const moved = personalCut(old.kind, '', { ...old, x: 91, team: 'friend', tag: '' });
      const names = [
        ['merchant', 'healer'],
        ['escort', 'carter'],
        ['commander', 'commander'],
        ['witness', 'vera'],
        ['witness', 'savva'],
        ['guard', 'hero'],
        ['regent', 'regent'],
      ];
      const named = names.every(([k, t]) => personalCut(k, t, { id: 1, seed: 15 }) === null);
      const variety = Array.from({ length: 256 }, (_, n) =>
        personalCut('spy', 'ambush', { id: n, seed: n * 133 + 617 }),
      );
      const cuts = new Set(variety.map((p) => p.cut)).size;
      const coats = new Set(variety.map((p) => p.dye)).size;
      const skins = new Set(variety.map((p) => p.skin)).size;
      const sample = (model, b) =>
        model
          .worldToLocal(b.getWorldPosition(new THREE.Vector3()))
          .toArray()
          .map((v) => +v.toFixed(4));
      const paths = {};
      const source = game.actors.find((a) => a.tag === 'escort');
      for (const name of Object.keys(fieldActions)) {
        const a = { ...source, walk: false, gaitSpeed: 0, windup: 0, cd: 0, angle: 0, lookYaw: 0 };
        delete a.strikeSerial;
        delete a.mind;
        const m = appearance(a.kind, a.tag, false, a);
        m.rotation.y = 0.93;
        m.position.set(game.x, walkingSurface(game.x, game.z), game.z);
        a.mind = { ...fieldMind(a), attack: name, mode: 'attack' };
        const dt = 1 / 60,
          duration = (a.windDuration = name === 'heavy' ? 0.75 : name === 'thrust' ? 0.39 : 0.52);
        let time = 11;
        animateCastActor(m, a, time, false);
        const out = {};
        function capture() {
          const r = m.userData.strikingArm,
            root = m.getWorldQuaternion(new THREE.Quaternion());
          m.updateMatrixWorld(true);
          const blade = m.getObjectByName('blade');
          // The first and last five-vertex rings are the forged blade's heel and tip.
          const ring = (row) => {
            const sum = new THREE.Vector3();
            for (let i = 0; i < 5; i++) {
              const index = row * 5 + i;
              const vertex = new THREE.Vector3().fromBufferAttribute(
                blade.geometry.attributes.position,
                index,
              );
              sum.add(blade.localToWorld(blade.applyBoneTransform(index, vertex)));
            }
            return sum.multiplyScalar(0.2);
          };
          const tip = ring(4),
            formed = tip.clone().sub(ring(0)).normalize();
          const axis = r.axis
            .clone()
            .applyQuaternion(r.hand.getWorldQuaternion(new THREE.Quaternion()))
            .normalize();
          const alignment = formed.dot(axis);
          return {
            hand: sample(m, r.hand),
            axis: formed.applyQuaternion(root.invert()).toArray(),
            alignment,
            tip: m.worldToLocal(tip).toArray(),
          };
        }
        for (let i = 0; i <= 44; i++) {
          time += dt;
          a.windup = duration * (1 - i / 45);
          animateCastActor(m, a, time, false);
          if (i === 22) out.ready = capture();
        }
        a.windup = 0;
        releaseFieldStrike(a, null);
        time += dt;
        animateCastActor(m, a, time, false);
        out.contact = capture();
        out.serial = a.strikeSerial;
        out.recovery = m.userData.strikeUntil > time;
        for (let j = 0; j < 11; j++) {
          time += dt;
          animateCastActor(m, a, time, false);
        }
        out.finish = capture();
        a.hp = 0;
        time += dt;
        animateCastActor(m, a, time, true);
        const p = sample(m, m.userData.strikingArm.hand);
        time += 3;
        animateCastActor(m, a, time, true);
        out.still = Math.hypot(...sample(m, m.userData.strikingArm.hand).map((v, i) => v - p[i]));
        paths[name] = out;
        releaseCharacter(m);
      }
      // Match cadence and animation phase on the same skeleton: the two saved people still carry
      // their torso differently, even without a second mesh, a difference in stature or a look target.
      const persons = [3433984077, 654767739].map((seed, id) =>
        personalCut('escort', 'escort', { seed, id }),
      );
      const torso = [];
      for (const person of persons) {
        const a = { ...source, lookYaw: 0, angle: 0, gaitSpeed: 1.25, walk: true };
        const m = appearance('escort', 'escort');
        m.userData.actorStyle.person = { ...person, depth: 1 };
        m.position.set(game.x, walkingSurface(game.x, game.z), game.z);
        for (let i = 0; i < 30; i++) animateCastActor(m, a, 14 + i / 60, false);
        const b = m.userData.skeleton.getBoneByName('spine_01');
        torso.push(b.quaternion.toArray());
        releaseCharacter(m);
      }
      const q = new THREE.Quaternion().fromArray(torso[0]);
      return {
        first,
        loaded,
        saved,
        named,
        legacy: JSON.stringify(migrated) === JSON.stringify(moved),
        cuts,
        coats,
        skins,
        paths,
        angle: q.angleTo(new THREE.Quaternion().fromArray(torso[1])),
      };
    });
    const r = result;
    assert.deepEqual(r.first, r.loaded);
    assert.equal(r.first.length, 2);
    assert(r.saved && r.named && r.legacy);
    assert.notEqual(r.first[0].cut, r.first[1].cut);
    assert.notEqual(r.first[0].paint, r.first[1].paint);
    assert(r.first.every((x) => x.bones > 60));
    assert.deepEqual([r.cuts, r.coats, r.skins], [6, 4, 5]);
    const { heavy, thrust, cut } = r.paths;
    for (const [name, move] of Object.entries(r.paths)) {
      assert(
        move.recovery && move.serial === 1 && move.still < 0.001,
        name + ': first physical release or corpse ' + JSON.stringify(move),
      );
      for (const phase of [move.ready, move.contact, move.finish]) assert(phase.alignment > 0.975);
      assert(Math.abs(Math.hypot(...move.ready.axis) - 1) < 0.001);
    }
    assert(heavy.ready.hand[1] > thrust.ready.hand[1] + 0.28);
    assert(
      thrust.ready.axis[2] > 0.72 && heavy.ready.axis[2] < -0.18 && cut.ready.axis[0] < -0.04,
      JSON.stringify(r.paths),
    );
    assert(
      thrust.contact.tip[2] > 1.05 && cut.finish.axis[0] > 0.48 && heavy.finish.axis[1] < -0.42,
      JSON.stringify(r.paths),
    );
    assert(r.angle > 0.004, 'same carried spine ' + r.angle);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        first: r.first,
        variants: [r.cuts, r.coats, r.skins],
        legacy: r.legacy,
        torso: r.angle,
        attacks: Object.fromEntries(
          Object.entries(r.paths).map(([k, v]) => [
            k,
            { ready: v.ready, contact: v.contact.tip, finish: v.finish.axis },
          ]),
        ),
        errors,
      }),
    );
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
