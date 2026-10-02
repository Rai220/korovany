// Smoke-тест игры в headless Chrome через CDP: запуск, три фракции, бой, травмы, сохранение.
// Запуск: node tests/smoke.mjs  (нужен локальный сервер на :8123 и Chrome с --remote-debugging-port=9222)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 8123;
const CDP = Number(process.env.CDP_PORT || 9333);
const URL = `http://localhost:${PORT}/deepseek_4.1_flash_uncesoured/index.html`;
const CHROME = process.env.CHROME_PATH || '/Users/knkrestnikov/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok, info });
  console.log(`${ok ? '✅' : '❌'} ${name}${info ? ' — ' + info : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpConnect() {
  const list = await (await fetch(`http://localhost:${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('нет страницы в CDP');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      logs.push(`${msg.params.type}: ${text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, logs, close: () => ws.close() };
}

async function evaluate(cdp, expression, awaitPromise = true) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (r.result && r.result.exceptionDetails) {
    return { error: r.result.exceptionDetails.exception?.description || 'ошибка' };
  }
  return { value: r.result?.result?.value };
}

async function main() {
  // сервер
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: path.resolve(ROOT, '..'), stdio: 'ignore' });
  await sleep(900);
  // браузер
  const userDir = fs.mkdtempSync('/tmp/kor-chrome-');
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--window-size=1600,900', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  await sleep(2500);
  let cdp;
  for (let i = 0; i < 20 && !cdp; i++) {
    try { cdp = await cdpConnect(); } catch (e) { await sleep(500); }
  }
  if (!cdp) { console.error('не удалось подключиться к Chrome'); process.exit(1); }

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.navigate', { url: URL });

  // ждём загрузку
  let ready = false;
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    const r = await evaluate(cdp, 'window.__ready === true');
    if (r.value) { ready = true; break; }
  }
  check('страница загрузилась, мир собран (window.__ready)', ready);
  if (!ready) {
    const r = await evaluate(cdp, 'JSON.stringify({errors: window.__errors, last: window.__lastError})');
    console.log('ошибки:', r.value);
    console.log(cdp.logs.slice(-25).join('\n'));
    await cdp.send('Page.captureScreenshot', {}).then(async (s) => {
      if (s.result?.data) fs.writeFileSync(path.join(ROOT, 'tests', 'fail.png'), Buffer.from(s.result.data, 'base64'));
    });
    chrome.kill(); server.kill(); process.exit(1);
  }

  const bootErrors = await evaluate(cdp, 'JSON.stringify(window.__errors || [])');
  check('нет ошибок на старте', bootErrors.value === '[]', bootErrors.value);

  // --- эльфы ---
  await evaluate(cdp, `window.__korovany.api.start({faction:'elf', seed:'smoke1', tutorial:false})`);
  await sleep(3500);
  let st = await evaluate(cdp, 'JSON.stringify(window.__korovany.api.stats())');
  let stats = JSON.parse(st.value);
  check('игра стартовала за эльфов', stats.player.hp > 0);
  check('лес высажен (LOD-деревья)', stats.trees > 3000, `деревьев: ${stats.trees}`);
  check('НПС заселены', stats.entities > 30, `сущностей: ${stats.entities}`);
  // в headless-софт-рендере (SwiftShader) fps низкий — важно, что кадры идут
  check('кадры идут в headless-софт-рендере', stats.fps >= 1, `fps: ${stats.fps} (софт-рендер)`);

  const sceneInfo = await evaluate(cdp, `JSON.stringify({
    trees3d: window.__korovany.G._trees3d || 0,
    calls: window.__korovany.G.renderer.info.render.calls,
    zones: 4,
    places: window.__korovany.G.places.length,
    shops: (window.__korovany.G.worldShops||[]).length,
    quests: window.__korovany.G.quests.list.length,
  })`);
  const si = JSON.parse(sceneInfo.value);
  check('картинки деревьев превращаются в 3D рядом с игроком', si.trees3d > 20, `3D-деревьев: ${si.trees3d}`);
  check('лавки построены', si.shops >= 20, `лавок: ${si.shops}`);
  check('сюжетная цепочка выдана', si.quests >= 1, `заданий: ${si.quests}`);
  check('draw calls в разумных пределах', si.calls < 1200, `calls: ${si.calls}`);

  // телепорт в деревню эльфов и скриншот
  await evaluate(cdp, `window.__korovany.api.teleport(-620,-540); window.__korovany.G.camera.position.set(-620, 12, -520)`);
  await sleep(1200);
  const shot1 = await cdp.send('Page.captureScreenshot', {});
  fs.writeFileSync(path.join(ROOT, 'tests', 'shot-elf.png'), Buffer.from(shot1.result.data, 'base64'));

  // --- бой и расчленёнка ---
  const fight = await evaluate(cdp, `(() => {
    const api = window.__korovany.api, G = window.__korovany.G;
    const e = api.spawn('guard','empire', G.player.pos.x + 4, G.player.pos.z);
    const before = { hp: e.hp };
    api.damage(0,'torso');
    // рубим руку
    const m = window.__korovany.G;
    const mod = m.__humanoidMod;
    return JSON.stringify({ spawned: !!e, name: e.name, before });
  })()`);
  check('враг заспавнен для боя', JSON.parse(fight.value).spawned);

  // рубим конечности через прямые вызовы
  const sever = await evaluate(cdp, `(async () => {
    const G = window.__korovany.G;
    const { damageHumanoid, severLimb } = await import('/deepseek_4.1_flash_uncesoured/src/entities/humanoid.js');
    const target = G.entities.find(e => e.role === 'guard' && !e.dead);
    if (!target) return JSON.stringify({ ok:false });
    damageHumanoid(target, 999, 'armR', { sever: true, dir: {x:1,y:1,z:0} });
    severLimb(target, 'legL', {x:1,y:1,z:0});
    return JSON.stringify({ ok:true, missing: target.missing, hp: Math.round(target.hp), dead: target.dead, name: target.name });
  })()`);
  const sv = JSON.parse(sever.value);
  check('рука отрубается', sv.ok && sv.missing && sv.missing.armR === true, JSON.stringify(sv.missing));
  check('нога отрубается', sv.ok && sv.missing && sv.missing.legL === true);

  // игрок: травмы, протезы, коляска
  const inj = await evaluate(cdp, `(async () => {
    const G = window.__korovany.G;
    const pl = await import('/deepseek_4.1_flash_uncesoured/src/entities/player.js');
    window.__korovany.api.god();
    pl.severPlayerPart('armR', {x:1,y:1,z:0});
    pl.severPlayerPart('legL', {x:1,y:1,z:0});
    pl.severPlayerPart('legR', {x:1,y:1,z:0});
    const bleedingAfter = G.player.bleeding;
    const crawlingAfter = G.player.crawling;
    pl.installProsthetic('mech_arm');
    pl.installProsthetic('iron_leg');
    G.player.wheelchair = true;
    pl.toggleWheelchair();
    return JSON.stringify({
      bleeding: bleedingAfter, crawling: crawlingAfter,
      prosthetics: G.player.prosthetics, inChair: G.player.inChair, missing: G.player.missing,
    });
  })()`);
  const ij = JSON.parse(inj.value);
  check('отрубленная рука даёт кровотечение', ij.bleeding > 1, `bleeding: ${ij.bleeding}`);
  check('без двух ног игрок ползёт', ij.crawling === true);
  check('протез руки устанавливается', !!ij.prosthetics.armR, ij.prosthetics.armR || 'нет');
  check('коляска работает', ij.inChair === true);

  const eyeTest = await evaluate(cdp, `(async () => {
    const G = window.__korovany.G;
    const pl = await import('/deepseek_4.1_flash_uncesoured/src/entities/player.js');
    G.player.missing.eyeR = true;
    pl.applyProstheticVisuals(G.player);
    pl.playerEyeLoss(G.player);
    await new Promise(r => setTimeout(r, 900));
    const el = document.getElementById('eye-right');
    return JSON.stringify({ opacity: getComputedStyle(el).opacity, inline: el.style.opacity });
  })()`);
  const et = JSON.parse(eyeTest.value);
  // computed может отставать из-за CSS-перехода, поэтому проверяем и inline-стиль
  check('выбитый глаз закрывает пол-экрана', parseFloat(et.inline || '0') > 0.5, `inline=${et.inline}, computed=${et.opacity}`);

  // корован
  const car = await evaluate(cdp, `(() => {
    const G = window.__korovany.G;
    const before = G.caravans.length;
    window.__korovany.api.caravan();
    const c = G.caravans[G.caravans.length-1];
    return JSON.stringify({ before, after: G.caravans.length, carts: c.carts.length, guards: c.guards.length, name: c.name });
  })()`);
  const cd = JSON.parse(car.value);
  check('корован с охраной и телегами создан', cd.carts >= 2 && cd.guards >= 3, `${cd.name}: телег ${cd.carts}, охраны ${cd.guards}`);

  // сохранение/загрузка
  const saveTest = await evaluate(cdp, `(() => {
    if (window.__korovany.G.godMode) window.__korovany.api.god();
    const api = window.__korovany.api;
    window.__korovany.G.player.gold = 777;
    api.save('1');
    window.__korovany.G.player.gold = 1;
    api.load('1');
    return JSON.stringify({ gold: window.__korovany.G.player.gold, missing: window.__korovany.G.player.missing });
  })()`);
  const stt = JSON.parse(saveTest.value);
  check('сохранение и загрузка восстанавливают золото', stt.gold === 777, `золото: ${stt.gold}`);
  check('травмы сохраняются', stt.missing && stt.missing.armR === true);

  const shot2 = await cdp.send('Page.captureScreenshot', {});
  fs.writeFileSync(path.join(ROOT, 'tests', 'shot-injury.png'), Buffer.from(shot2.result.data, 'base64'));

  // --- охрана дворца ---
  await evaluate(cdp, `window.__korovany.api.start({faction:'guard', seed:'smoke2', tutorial:false})`);
  await sleep(3000);
  const guardInfo = await evaluate(cdp, `(() => {
    const G = window.__korovany.G;
    return JSON.stringify({ faction: G.player.heroFaction, quest: G.quests.list[0]?.title, guards: G.entities.filter(e=>e.role==='guard').length, captain: G.entities.some(e=>e.role==='captain') });
  })()`);
  const gi = JSON.parse(guardInfo.value);
  check('игра за охрану дворца стартует', gi.faction === 'guard');
  check('приказ командира выдан', !!gi.quest, gi.quest);
  check('стража и капитан на месте', gi.guards >= 8 && gi.captain, `гвардейцев: ${gi.guards}`);
  await evaluate(cdp, `window.__korovany.api.teleport(620, 720)`);
  await sleep(1200);
  const shot3 = await cdp.send('Page.captureScreenshot', {});
  fs.writeFileSync(path.join(ROOT, 'tests', 'shot-palace.png'), Buffer.from(shot3.result.data, 'base64'));

  // --- злодей ---
  await evaluate(cdp, `window.__korovany.api.start({faction:'villain', seed:'smoke3', tutorial:false})`);
  await sleep(3000);
  const vil = await evaluate(cdp, `(() => {
    const G = window.__korovany.G;
    window.__korovany.api.gold(1000);
    window.__korovany.api.squad('legion', 3);
    return JSON.stringify({ faction: G.player.heroFaction, squad: (G.player.squad||[]).length, quest: G.quests.list[0]?.title, dregar: G.entities.some(e=>e.role==='dregar'), fort: !!G.landmarks.fortKeep });
  })()`);
  const vi = JSON.parse(vil.value);
  check('игра за злодея стартует', vi.faction === 'villain');
  check('отряд нанимается', vi.squad >= 3, `бойцов: ${vi.squad}`);
  check('Дрегар и его форт на месте', vi.dregar && vi.fort);
  check('задание злодея выдано', !!vi.quest, vi.quest);

  const raid = await evaluate(cdp, `(() => { window.__korovany.api.raid('empire','elfvillage',6); return window.__korovany.G.entities.filter(e=>e.ai.raid).length; })()`);
  check('налёт спавнится', raid.value >= 6, `в налёте: ${raid.value}`);

  await sleep(2500);
  const finalErrors = await evaluate(cdp, 'JSON.stringify((window.__errors||[]).concat(window.__lastError?[window.__lastError]:[]))');
  check('за весь прогон нет исключений', finalErrors.value === '[]', finalErrors.value);

  const shot4 = await cdp.send('Page.captureScreenshot', {});
  fs.writeFileSync(path.join(ROOT, 'tests', 'shot-fort.png'), Buffer.from(shot4.result.data, 'base64'));

  const failed = results.filter((r) => !r.ok);
  console.log(`\nИтог: ${results.length - failed.length}/${results.length} проверок пройдено`);
  if (failed.length) console.log('Провалено: ' + failed.map((f) => f.name).join('; '));
  cdp.close();
  chrome.kill();
  server.kill();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
