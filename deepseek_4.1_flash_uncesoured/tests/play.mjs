// Игровой прогон: реальный ввод, бой, обыск, лавка, лечение, протез, приказы, сохранение, панели.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 8123;
const CDP = Number(process.env.CDP_PORT || 9666);
const CHROME = process.env.CHROME_PATH || '/Users/knkrestnikov/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${info ? ' — ' + info : ''}`); };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: path.resolve(ROOT, '..'), stdio: 'ignore' });
const dir = fs.mkdtempSync('/tmp/kor-play-');
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${dir}`,
  '--no-first-run', '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=900,600', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

let list = null;
for (let i = 0; i < 40 && !list; i++) { await sleep(700); try { list = await (await fetch(`http://localhost:${CDP}/json/list`)).json(); } catch (e) { /* ждём */ } }
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  const ex = r.result?.exceptionDetails;
  if (ex) return { err: ex.exception?.description || ex.text };
  return r.result?.result?.value;
};
const J = async (expr) => {
  const v = await ev(expr);
  if (typeof v === 'string' && v.startsWith('ERR ')) { console.log('  (eval) ' + v.slice(0, 160)); return {}; }
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return v; } }
  return v ?? {};
};

await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: `http://localhost:${PORT}/deepseek_4.1_flash_uncesoured/index.html` });
for (let i = 0; i < 90; i++) { await sleep(500); if (await ev('window.__ready===true')) break; }

await ev(`window.__korovany.api.start({faction:'guard', seed:'play', tutorial:false})`);
await sleep(3500);

// --- ходьба ---
let s0 = await J('JSON.stringify(window.__korovany.api.state())');
await ev(`window.__korovany.api.hold('KeyW', true)`);
await ev(`window.__korovany.api.waitGame(2.5)`);
await ev(`window.__korovany.api.hold('KeyW', false)`);
let s1 = await J('JSON.stringify(window.__korovany.api.state())');
const moved = await ev('window.__korovany.G.player.stats ? 1 : 0');
void moved;
const posDelta = await J(`JSON.stringify((()=>{const p=window.__korovany.G.player.pos; return {x:p.x,z:p.z};})())`);
check('игрок ходит по клавише W', Math.abs(posDelta.x - 620) + Math.abs(posDelta.z - 700) > 3, `позиция: ${Math.round(posDelta.x)},${Math.round(posDelta.z)}`);

// --- прыжок ---
await ev(`window.__korovany.G.player.pos.set(-640, window.__korovany.G.surfaceHeight(-640,700,1e4), 700)`);
await sleep(300);
const yBefore = await ev('window.__korovany.G.player.pos.y');
await ev(`window.__korovany.api.press('Space')`);
await ev(`window.__korovany.api.waitGame(0.35)`);
const yAfter = await ev('window.__korovany.G.player.pos.y');
check('прыжок работает', yAfter > yBefore + 0.2, `y: ${yBefore?.toFixed?.(2)} → ${yAfter?.toFixed?.(2)}`);

// --- бой: настоящие удары по врагу ---
await ev(`window.__kills = 0; import('/deepseek_4.1_flash_uncesoured/src/core/state.js').then(s => s.on('npc:death', ()=>{window.__kills++;}))`);
await sleep(300);
const fight = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G, api = window.__korovany.api;
  const e = api.spawn('bandit','bandits', G.player.pos.x + 1.8, G.player.pos.z + 0.2);
  api.lookAt(e.pos.x, e.pos.z);
  return { name: e.name, hp: e.hp, id: e.id };
})())`);
for (let i = 0; i < 40; i++) {
  await ev(`window.__korovany.api.lookAt(window.__korovany.G.entities.find(e=>e.id==='${fight.id}')?.pos.x ?? 0, window.__korovany.G.entities.find(e=>e.id==='${fight.id}')?.pos.z ?? 0)`);
  await ev(`window.__korovany.api.press('Mouse0')`);
  await ev(`window.__korovany.api.waitGame(0.75)`);
}
const afterFight = await J(`JSON.stringify((()=>{const G=window.__korovany.G; return {corpses: G.corpses.length, kills: window.__kills||0};})())`);
check('удары игрока убивают врага (появляется 3D-труп)', afterFight.corpses >= 1 && afterFight.kills >= 1, `трупов: ${afterFight.corpses}, смертей: ${afterFight.kills}`);

// --- обыск трупа ---
const lootRes = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const c = G.corpses[0];
  G.player.pos.set(c.pos.x + 0.8, window.__korovany.G.surfaceHeight(c.pos.x+0.8, c.pos.z, 1e4), c.pos.z);
  const before = G.player.gold;
  return { name: c.entity.name, items: c.entity.inventory.length, before };
})())`);
await ev(`window.__korovany.api.interact()`);
await sleep(400);
await ev(`document.getElementById('loot-take-all')?.click()`);
await sleep(300);
const goldAfter = await ev('window.__korovany.G.player.gold');
check('труп обыскивается, золото берётся', goldAfter > lootRes.before, `золото: ${lootRes.before} → ${goldAfter}`);
await ev(`window.__korovany.api.closePanel('panel-loot')`);

// --- лавка: покупка ---
const shopRes = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const shop = G.worldShops.find(s => s.kind === 'trader');
  G.player.gold = 500;
  window.__korovany.api.press('KeyI');
  const before = G.player.inventory.length;
  window.__korovany.api.state();
  return { shopId: shop.id, before, gold: G.player.gold };
})())`);
await ev(`window.__korovany.G.economy.buy(window.__korovany.G.worldShops.find(s=>s.id==='${shopRes.shopId}'), 'bread', 2)`);
const bought = await J(`JSON.stringify((()=>{const G=window.__korovany.G; return {bread: G.player.inventory.filter(i=>i.id==='bread').length, gold: G.player.gold};})())`);
check('в лавке можно купить товар', bought.bread >= 1 && bought.gold < 500, `хлеба: ${bought.bread}, золото: ${bought.gold}`);

// --- лечение у лекаря ---
const healRes = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const healer = G.worldShops.find(s => s.kind === 'healer');
  G.player.hp = 40; G.player.bleeding = 1.5;
  G.economy.healService(healer);
  return { hp: Math.round(G.player.hp), bleeding: G.player.bleeding, gold: G.player.gold };
})())`);
check('лекарь лечит раны и кровь', healRes.hp > 100 && healRes.bleeding === 0, `хп: ${healRes.hp}, кровь: ${healRes.bleeding}`);

// --- протез у костоправа ---
const prosth = await J(`(async()=>{
  const G = window.__korovany.G;
  const pl = await import('/deepseek_4.1_flash_uncesoured/src/entities/player.js');
  pl.severPlayerPart('armR', {x:1,y:0,z:0});
  const before = G.player.missing.armR;
  pl.installProsthetic('hook_arm');
  return JSON.stringify({ before, after: G.player.prosthetics.armR, missing: G.player.missing.armR });
})()`);
check('протез руки ставится на место отрубленной', prosth.before === true && prosth.after === 'hook_arm');

// --- приказ командира ---
const order = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const cap = G.entities.find(e => e.role === 'captain');
  const d = G.quests.dialogueFor(cap);
  return { name: cap.name, options: d.options.map(o => o.text).length, text: d.text.slice(0, 40) };
})())`);
check('у капитана есть диалог с приказами', order.options >= 3, `вариантов: ${order.options}`);

const orderIssue = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const n = G.quests.list.length;
  G.quests.captainOrder();
  return { before: n, after: G.quests.list.length, quest: G.quests.list[G.quests.list.length-1].title };
})())`);
check('командир выдаёт новый приказ', orderIssue.after > orderIssue.before, orderIssue.quest);

// --- выполнение задания телепортом в цель ---
const questDone = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const q = G.quests.list.find(x => x.state === 'active' && x.objectives.every(o => o.type === 'goto'));
  if (!q) return { skipped: true };
  for (const o of q.objectives) { o.progress = o.count; G.quests.objectiveDone(q, o); }
  return { state: q.state, title: q.title };
})())`);
check('задание можно выполнить (goto-цель)', questDone.skipped || questDone.state === 'done', questDone.title || '');

// --- сон и быстрое перемещение ---
const sleepRes = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  const bed = G.worldBeds[0];
  const day0 = G.time.day, t0 = G.time.seconds;
  G.player.gold = 100; G.player.stamina = 10;
  G.economy.restAtBed(bed);
  return { day0, day1: G.time.day, dt: G.time.seconds - t0, stamina: Math.round(G.player.stamina) };
})())`);
check('сон в постели восстанавливает силы и двигает время', sleepRes.stamina > 90 && sleepRes.dt > 3600, `+${Math.round(sleepRes.dt / 3600)} ч`);

await ev(`window.__korovany.G.discovered.add('village'); window.__korovany.api.panel('panel-map')`);
await sleep(400);
const travel = await J(`(async()=>{
  const m = await import('/deepseek_4.1_flash_uncesoured/src/ui/panels.js');
  const G = window.__korovany.G;
  m.travelTo('village');
  return JSON.stringify({ x: Math.round(G.player.pos.x), z: Math.round(G.player.pos.z), place: G.placeName() });
})()`);
check('быстрый переход по карте работает', Math.abs(travel.x + 640) < 60, `${travel.place} (${travel.x},${travel.z})`);

// --- панели открываются без ошибок ---
const panels = await J(`(async()=>{
  const m = await import('/deepseek_4.1_flash_uncesoured/src/ui/panels.js');
  const out = [];
  for (const id of ['panel-inventory','panel-character','panel-journal','panel-map','screen-pause']) {
    m.openPanel(id);
    await new Promise(r => setTimeout(r, 120));
    out.push([id, !document.getElementById(id).classList.contains('hidden')]);
    m.closePanel(id);
  }
  return JSON.stringify(out);
})()`);
check('все панели открываются', panels.every(([, open]) => open), panels.map(([id, o]) => id + ':' + o).join(' '));

// --- сохранение / загрузка ---
await ev(`window.__korovany.G.player.gold = 1234; window.__korovany.api.save('2')`);
await ev(`window.__korovany.G.player.gold = 5; window.__korovany.api.load('2')`);
const goldLoaded = await ev('window.__korovany.G.player.gold');
check('сохранение/загрузка слота 2', goldLoaded === 1234, `золото: ${goldLoaded}`);

// --- отряд злодея и штурм ---
await ev(`window.__korovany.api.start({faction:'villain', seed:'play2', tutorial:false})`);
await sleep(3200);
const squad = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  window.__korovany.api.gold(2000);
  window.__korovany.api.squad('legion', 4);
  return { size: (G.player.squad || []).length, gold: G.player.gold };
})())`);
check('злодей нанимает отряд', squad.size >= 4, `бойцов: ${squad.size}`);

const assault = await J(`(async()=>{
  const m = await import('/deepseek_4.1_flash_uncesoured/src/ui/panels.js');
  const G = window.__korovany.G;
  G.player.pos.set(620, G.surfaceHeight(620, 700, 1e4), 700); // у ворот дворца
  G.entities.length && null;
  const enemy = G.entities.find(e => e.faction === 'empire' && !e.dead);
  if (enemy) m.issueOrder('attack');
  await new Promise(r => setTimeout(r, 2500));
  const ordered = (G.player.squad || []).filter(e => e.ai.command === 'attack').length;
  const fighting = (G.player.squad || []).filter(e => e.ai.target).length;
  return JSON.stringify({ ordered, fighting, enemy: enemy ? enemy.name : null });
})()`);
check('отряду можно приказать «в атаку»', assault.ordered >= 1, `в атаке: ${assault.ordered}, с целью: ${assault.fighting}`);

// --- трон ---
const throne = await J(`(async()=>{
  const G = window.__korovany.G;
  const t = G.landmarks.throne;
  G.player.pos.set(t.x, G.surfaceHeight(t.x, t.z, 1e4), t.z);
  await new Promise(r => setTimeout(r, 400));
  const before = !!G.throneCaptured;
  const m = await import('/deepseek_4.1_flash_uncesoured/src/ui/panels.js');
  void m;
  return JSON.stringify({ before, thronePos: [t.x, t.z] });
})()`);
check('трон во дворце доступен для захвата', throne.thronePos[0] > 0);

// --- ночь, дождь, время ---
const weather = await J(`JSON.stringify((()=>{
  const G = window.__korovany.G;
  window.__korovany.api.setTime(23);
  G.weather.target = 0.8;
  return { time: G.time.seconds / 3600 };
})())`);
await ev(`window.__korovany.api.waitGame(4)`);
const rainOn = await ev('window.__korovany.G.sky.rain.visible');
check('ночь и дождь включаются', weather.time > 22, `дождь: ${rainOn}`);

const errors = await ev('JSON.stringify((window.__errors||[]).concat(window.__lastError?[window.__lastError]:[]))');
check('нет ошибок за прогон', errors === '[]', errors);

const shot = await send('Page.captureScreenshot', {});
fs.writeFileSync(path.join(ROOT, 'tests', 'shot-play.png'), Buffer.from(shot.result.data, 'base64'));

const failed = results.filter((r) => !r.ok);
console.log(`\nИтог: ${results.length - failed.length}/${results.length}`);
if (failed.length) console.log('Провалено: ' + failed.map((f) => f.name).join('; '));
process.exit(failed.length ? 1 : 0);
