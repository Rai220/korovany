/* Run with NODE_PATH pointing to an installed playwright package. No app build needed. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const url = process.env.ASTRA_URL || "http://127.0.0.1:8766/";
  await page.goto(url + "?test=1");
  await page.waitForFunction(() => window.astraReady, { timeout: 60000 });
  await page.click("#start");
  assert.equal(await page.locator("#hud").isVisible(), true);
  const check = async (name, fn) => {
    const result = await page.evaluate(fn);
    assert.equal(result, true, `${name}: ${JSON.stringify(result)}`);
    console.log("PASS", name);
  };
  await check(
    "3D forest uses both LOD levels",
    () =>
      astraTest.lod.near > 0 &&
      astraTest.lod.far > 0 &&
      astraTest.lod.total > 700,
  );
  await page.keyboard.down("KeyW");
  await check("W moves player, walls block movement", () => {
    const a = astraTest,
      p = a.player,
      z = p.z;
    a.step(0.4);
    return p.z < z - 0.5 && a.blocked(115, -96);
  });
  await page.keyboard.up("KeyW");
  await page.keyboard.down("Space");
  await check("jump has vertical motion", () => {
    astraTest.updatePlayer(0.05);
    return astraTest.player.y > 0 && astraTest.player.vy > 0;
  });
  await page.keyboard.up("Space");
  await check("moving caravan advances along road", () => {
    const a = astraTest,
      c = a.caravans[0],
      x = c.x;
    a.updateCaravans(2);
    return Math.abs(c.x - x) > 1;
  });
  await check("shop is accessible through E at physical stall", () => {
    const a = astraTest;
    a.teleport(-106, -69);
    a.interact();
    return a.stats.activeModal === "shop";
  });
  await check("purchases debit gold and add inventory", () => {
    const a = astraTest,
      p = a.player;
    p.gold = 100;
    const n = p.bandages;
    a.buy("bandage");
    return p.gold === 82 && p.bandages === n + 3;
  });
  await check("unaffordable purchase does not change inventory", () => {
    const a = astraTest,
      p = a.player;
    p.gold = 0;
    const n = p.arrows;
    a.buy("arrows");
    return p.gold === 0 && p.arrows === n;
  });
  await page.click("#close-modal");
  await check("arm loss causes bleeding; bandage stops it", () => {
    const a = astraTest,
      p = a.player;
    a.injurePlayer("arm");
    const hp = p.health;
    a.updatePlayer(1);
    const bled = p.health < hp && p.bleed > 0;
    a.bandage();
    return bled && p.bleed === 0 && p.arm === "missing";
  });
  await check("eye loss covers half the screen", () => {
    astraTest.injurePlayer("eye");
    const el = document.getElementById("blind");
    return (
      getComputedStyle(el).display === "flex" &&
      Math.abs(el.getBoundingClientRect().width - innerWidth / 2) < 1
    );
  });
  await check("leg loss, wheelchair and all prostheses work", () => {
    const a = astraTest,
      p = a.player;
    a.injurePlayer("leg");
    p.gold = 500;
    a.openShop();
    a.buy("wheel");
    const wheel = p.wheel && p.leg === "missing";
    a.buy("arm");
    a.buy("eye");
    a.buy("leg");
    return (
      wheel &&
      p.arm === "prosthetic" &&
      p.eye === "prosthetic" &&
      p.leg === "prosthetic" &&
      !p.wheel &&
      p.bleed === 0 &&
      getComputedStyle(document.getElementById("blind")).display === "none"
    );
  });
  await page.click("#close-modal");
  await check("caravan requires fighting escorts before loot", () => {
    const a = astraTest,
      c = a.caravans[0];
    a.teleport(c.x, c.z + 4);
    a.interact();
    const alarm = c.hostile && !c.robbed;
    a.interact();
    const guarded = !c.robbed;
    for (const id of c.escorts) {
      const e = a.actors.find((e) => e.id === id);
      a.hurtActor(e, 200, "arm");
    }
    a.teleport(c.x, c.z + 2);
    a.interact();
    return (
      (alarm && guarded && c.robbed && a.player.robberies === 1) || {
        alarm,
        guarded,
        robbed: c.robbed,
        robberies: a.player.robberies,
        notices: document.getElementById("announcements").textContent,
        escorts: a.actors
          .filter((e) => c.escorts.includes(e.id))
          .map((e) => ({ dead: e.dead, x: e.x, z: e.z, loot: e.loot })),
        caravan: { x: c.x, z: c.z },
      }
    );
  });
  await check("3D corpses keep severed limbs and can be searched", () => {
    const a = astraTest,
      dead = a.actors.find((e) => e.dead);
    a.teleport(dead.x, dead.z + 1);
    const before = a.player.gold;
    a.interact();
    return (
      dead.loot &&
      dead.group.rotation.z > 1.5 &&
      !dead.parts.arm.visible &&
      a.player.gold > before
    );
  });
  await check(
    "save/load restores wounds, corpse loot, caravan, location",
    () => {
      const a = astraTest,
        p = a.player;
      p.eye = "missing";
      p.bleed = 1.6;
      p.gold = 123;
      a.updateHUD();
      const old = a.serialize();
      if (!a.saveGame()) return "save rejected";
      p.gold = 999;
      p.eye = "ok";
      a.loadGame();
      const restored = a.serialize();
      return (
        restored.player.gold === 123 &&
        restored.player.eye === "missing" &&
        restored.player.bleed === 1.6 &&
        restored.actors.some((e) => e.dead && e.loot) &&
        restored.caravans[0].robbed &&
        Math.abs(restored.player.x - old.player.x) < 0.01
      );
    },
  );
  await check("invalid save data is rejected", () => {
    const a = astraTest,
      s = a.serialize();
    s.player.x = "invalid";
    return (
      !a.validSave(s) && !a.validSave({ version: 9 }) && !a.validSave(null)
    );
  });
  await check("untreated bleeding is fatal", () => {
    const a = astraTest,
      p = a.player;
    p.health = 0.1;
    p.bleed = 2;
    a.updatePlayer(0.2);
    return p.health === 0 && a.stats.activeModal === "death";
  });
  await check("guard starts with commander assignment", () => {
    const a = astraTest;
    a.begin("guard");
    a.teleport(87, -81);
    a.interact();
    return a.player.chapter === 0 && a.stats.activeModal === "commander";
  });
  await page.click('[data-action="order-defend"]');
  await check("guard defense transitions to personal report", () => {
    const a = astraTest,
      p = a.player;
    const enemies = a.actors.filter((e) => e.mission === p.missionTag);
    enemies.forEach((e) => a.hurtActor(e, 300));
    a.updateMissions();
    a.teleport(87, -81);
    a.interact();
    return (
      enemies.length === 3 &&
      p.chapter === 2 &&
      a.stats.activeModal === "commander"
    );
  });
  await page.click('[data-action="order-raid"]');
  await check("guard receives real raid targets and two allies", () => {
    const a = astraTest,
      p = a.player;
    return (
      p.chapter === 3 &&
      a.actors.filter((e) => e.mission === "fort-raid").length === 4 &&
      a.actors.filter((e) => e.squad && !e.dead).length === 2
    );
  });
  await check("guard completes second order and reports victory", () => {
    const a = astraTest;
    a.actors
      .filter((e) => e.mission === "fort-raid")
      .forEach((e) => a.hurtActor(e, 300));
    a.updateMissions();
    a.teleport(87, -81);
    a.interact();
    return a.player.chapter === 4;
  });
  await page.click('[data-action="finish-guard"]');
  await check(
    "guard campaign has a conclusion",
    () =>
      astraTest.player.completed && astraTest.stats.activeModal === "victory",
  );
  await check("evil starts with four commanded troops", () => {
    const a = astraTest;
    a.begin("evil");
    return a.actors.filter((e) => e.squad && !e.dead).length === 4;
  });
  await page.keyboard.press("KeyC");
  await page.click('[data-order="attack"]');
  await check("army marches around fort and enters palace gate", () => {
    const a = astraTest;
    for (const e of a.actors) if (e.faction !== "evil") a.kill(e);
    a.player.health = 100;
    a.player.bleed = 0;
    for (let i = 0; i < 2400; i++) a.updateActors(0.05);
    const squad = a.actors.filter((e) => e.squad && !e.dead);
    return (
      squad.every((e) => e.z < -78 && Math.abs(e.x - 96) < 8) ||
      squad.map((e) => ({ x: e.x, z: e.z, step: e.marchStep }))
    );
  });
  await check("evil can capture palace with interaction", () => {
    const a = astraTest;
    a.teleport(96, -86);
    a.interact();
    return a.player.completed && a.player.captured;
  });
  await check("elf defense and robbery unlock palace objective", () => {
    const a = astraTest;
    a.begin("elf");
    a.actors
      .filter((e) => e.mission === a.player.missionTag)
      .forEach((e) => a.hurtActor(e, 300));
    a.updateMissions();
    const defended = a.player.chapter === 1;
    a.player.robberies = 1;
    a.updateMissions();
    return defended && a.player.chapter === 2;
  });
  await check("elf can finish at captured banner", () => {
    const a = astraTest;
    a.actors.filter((e) => e.faction === "guard").forEach((e) => a.kill(e));
    a.teleport(96, -86);
    a.interact();
    return a.player.completed && a.player.captured;
  });
  await page.click('[data-action="resume"]');
  await page.keyboard.press("KeyM");
  await check(
    "map pauses the simulation",
    () =>
      astraTest.stats.paused &&
      document.getElementById("big-map").width === 630,
  );
  await page.keyboard.press("KeyM");
  await check("map hotkey resumes", () => !astraTest.stats.paused);
  await check("actual sword attack applies aimed damage", () => {
    const a = astraTest;
    a.begin("elf");
    a.teleport(-25, 68);
    a.player.weapon = 1;
    const e = a.spawn("evil", -25, 65);
    a.attack();
    return e.health < 68 && a.player.stamina < 100;
  });
  await check("bow consumes an arrow and damages a ranged target", () => {
    const a = astraTest;
    a.begin("elf");
    a.teleport(-25, 68);
    a.player.weapon = 2;
    const e = a.spawn("evil", -25, 58);
    const arrows = a.player.arrows;
    a.attack();
    return e.health < 68 && a.player.arrows === arrows - 1;
  });
  assert.deepEqual(errors, [], "browser errors");
  console.log("HTTP rendering and gameplay: no browser errors");
  const filePage = await browser.newPage();
  filePage.on("pageerror", (e) => errors.push(e.message));
  await filePage.goto(
    pathToFileURL(path.resolve(__dirname, "../index.html")).href,
  );
  await filePage.waitForFunction(() => window.astraReady, { timeout: 60000 });
  assert.equal(await filePage.locator("#start").isEnabled(), true);
  await filePage.click("#start");
  assert.equal(await filePage.locator("#hud").isVisible(), true);
  assert.deepEqual(errors, []);
  console.log("PASS direct file:// launch with CDN modules");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
