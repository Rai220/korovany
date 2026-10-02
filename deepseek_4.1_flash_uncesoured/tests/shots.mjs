// Скриншоты для карточки и проверка освещения: разные зоны, время суток, виды.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 8123;
const CDP = Number(process.env.CDP_PORT || 9444);
const CHROME = process.env.CHROME_PATH || '/Users/knkrestnikov/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: path.resolve(ROOT, '..'), stdio: 'ignore' });
const dir = fs.mkdtempSync('/tmp/kor-shots-');
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${dir}`,
  '--no-first-run', '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=1600,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

let list = null;
for (let i = 0; i < 40 && !list; i++) { await sleep(700); try { list = await (await fetch(`http://localhost:${CDP}/json/list`)).json(); } catch (e) { /* ждём */ } }
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: `http://localhost:${PORT}/deepseek_4.1_flash_uncesoured/index.html` });
for (let i = 0; i < 90; i++) { await sleep(500); if (await ev('window.__ready===true')) break; }

async function shot(name, setup) {
  if (setup) {
    const r = await ev(`(() => { ${setup} ; return 'ok'; })()`);
    if (r !== 'ok') console.log('  setup error в ' + name + ': ' + r);
  }
  await sleep(setup ? 1400 : 900);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'tests', name), Buffer.from(s.result.data, 'base64'));
  console.log('снят', name);
}

// 1. эльфийская деревня днём, вид от третьего лица
await ev(`window.__korovany.api.start({faction:'elf', seed:'korovany', tutorial:false})`);
await sleep(3500);
await shot('shot-elf.png', `
  const G = window.__korovany.G;
  window.__korovany.api.setTime(11);
  window.__korovany.api.teleport(-596,-560);
  G.player.yaw = 2.4; G.player.pitch = -0.05; G.player.view = 3;
  G.player.hp = G.player.hpMax;
`);
// 2. густой LOD-лес: картинки вдали, 3D вблизи
await shot('shot-forest.png', `
  const G = window.__korovany.G;
  window.__korovany.api.teleport(-430,-380);
  G.player.yaw = 2.0; G.player.pitch = 0.02; G.player.view = 1;
`);
// 3. дворец
await shot('shot-palace.png', `
  const G = window.__korovany.G;
  window.__korovany.api.teleport(620, 760);
  G.player.yaw = 0.0; G.player.pitch = 0.05; G.player.view = 1;
`);
// 4. корован на тракте
await shot('shot-caravan.png', `
  const G = window.__korovany.G;
  window.__korovany.api.caravan();
  const c = G.caravans[G.caravans.length-1];
  for (let i=0;i<600;i++) { }
  window.__korovany.api.teleport(c.pos.x + 12, c.pos.z + 6);
  G.player.yaw = -1.2; G.player.pitch = 0; G.player.view = 3;
`);
// 5. горный форт Дрегара
await shot('shot-fort.png', `
  const G = window.__korovany.G;
  window.__korovany.api.teleport(600, -520);
  G.player.yaw = -2.4; G.player.pitch = 0.06; G.player.view = 3;
`);
// 6. бой: расчленёнка и кровь
await shot('shot-injury.png', `
  const G = window.__korovany.G;
  window.__korovany.api.teleport(-300, 880); // лагерь разбойников
  G.player.yaw = 1.0; G.player.pitch = 0; G.player.view = 3;
  const api = window.__korovany.api;
  for (let i=0;i<3;i++) api.spawn('bandit','bandits', G.player.pos.x + 3 + i*1.6, G.player.pos.z + 4);
  api.sever('armR'); api.sever('legL');
  G.player.bleeding = 2.2;
  setTimeout(()=>{ const m = window.__korovany; }, 50);
`);
// 7. ночь в деревне с факелами
await shot('shot-night.png', `
  const G = window.__korovany.G;
  window.__korovany.api.setTime(22.5);
  window.__korovany.api.teleport(-600, 700);
  G.player.yaw = 1.2; G.player.pitch = 0.02; G.player.view = 1;
`);

console.log('ошибки:', await ev('JSON.stringify(window.__errors||[])'));
process.exit(0);
