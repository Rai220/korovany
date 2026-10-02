// Герой-скриншот для карточки музея: эльфийская деревня в лучах заката, густой LOD-лес.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || '/Users/knkrestnikov/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', '8123'], { cwd: path.resolve(ROOT, '..'), stdio: 'ignore' });
const dir = fs.mkdtempSync('/tmp/kor-card-');
spawn(CHROME, ['--headless=new', '--remote-debugging-port=9888', `--user-data-dir=${dir}`, '--no-first-run',
  '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1600,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let list = null;
for (let i = 0; i < 40 && !list; i++) { await sleep(700); try { list = await (await fetch('http://localhost:9888/json/list')).json(); } catch (e) { /* ждём */ } }
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:8123/deepseek_4.1_flash_uncesoured/index.html' });
for (let i = 0; i < 90; i++) { await sleep(500); if (await ev('window.__ready===true')) break; }
await ev(`window.__korovany.api.start({faction:'elf', seed:'korovany', tutorial:false})`);
await sleep(3500);
const variants = {
  card: `window.__korovany.api.setTime(15.6);
    window.__korovany.api.teleport(-556,-548);
    G.player.yaw = 2.35; G.player.pitch = 0.10; G.player.view = 3; G.player.camDist = 5.6;
    G.player.equip.weapon='elven_bow';`,
  card2: `window.__korovany.api.setTime(12.2);
    window.__korovany.api.teleport(618,812);
    G.player.yaw = 0.0; G.player.pitch = 0.11; G.player.view = 3; G.player.camDist = 6.2;
    G.player.equip.weapon='iron_sword';`,
  card3: `window.__korovany.api.setTime(16.4);
    window.__korovany.api.teleport(-96,378);
    G.player.yaw = 0.15; G.player.pitch = 0.02; G.player.view = 1;
    G.player.equip.weapon='elven_bow';`,
  card4: `window.__korovany.api.setTime(12.6);
    window.__korovany.api.teleport(-512,-482);
    G.player.yaw = 2.30; G.player.pitch = 0.13; G.player.view = 3; G.player.camDist = 6.4;
    G.player.equip.weapon='elven_bow';`,
  card5: `window.__korovany.api.setTime(15.2);
    window.__korovany.api.spawn('elf_archer','elves', -92, 372);
    window.__korovany.api.caravan();
    const c = G.caravans[G.caravans.length-1];
    G.player.pos.set(-104, G.surfaceHeight(-104, 392, 1e4), 392);
    G.player.yaw = 0.35; G.player.pitch = 0.04; G.player.view = 3; G.player.camDist = 5.0;
    G.player.equip.weapon='elven_bow';`,
  card6: `window.__korovany.api.setTime(13.4);
    window.__korovany.api.caravan();
    G.player.pos.set(-112, G.surfaceHeight(-112, 400, 1e4), 400);
    G.player.yaw = 0.42; G.player.pitch = 0.02; G.player.view = 3; G.player.camDist = 5.4;
    G.player.equip.weapon='elven_bow';`,
  card7: `window.__korovany.api.setTime(16.2);
    G.player.pos.set(620, G.surfaceHeight(620, 806, 1e4), 806);
    G.player.yaw = 0.0; G.player.pitch = 0.05; G.player.view = 3; G.player.camDist = 5.0;
    G.player.equip.weapon='iron_sword';`,
};
for (const [name, setup] of Object.entries(variants)) {
  const r = await ev(`(() => { const G = window.__korovany.G; ${setup} window.__korovany.api.waitGame(1.2); return 'ok'; })()`);
  if (name === 'card5' || name === 'card6') { await ev(`(()=>{const G=window.__korovany.G; const c=G.caravans[G.caravans.length-1]; c.s = 262; return 'ok';})()`); }
  await ev('window.__korovany.api.waitGame(3)');
  await sleep(2200);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'tests', name + '.png'), Buffer.from(shot.result.data, 'base64'));
  console.log(name + ':', r);
}
console.log('ошибки:', await ev('JSON.stringify(window.__errors||[])'));
process.exit(0);
