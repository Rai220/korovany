import { writeFile } from 'node:fs/promises';

const cdpPort = process.env.CDP_PORT || '9222';
const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const listeners = new Map();
const browserErrors = [];

socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    browserErrors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
  }
  for (const resolve of listeners.get(message.method) || []) resolve(message.params);
  listeners.delete(message.method);
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function once(method) {
  return new Promise((resolve) => listeners.set(method, [...(listeners.get(method) || []), resolve]));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function key(code, key = code.replace(/^Key/, '')) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
}

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await once('Page.loadEventFired');
await delay(1800);
await evaluate(`localStorage.removeItem('korovany-gpt-5.6-sol-save-v1')`);

const results = [];
for (const faction of ['elf', 'guard', 'villain']) {
  if (faction !== 'elf') {
    const loaded = once('Page.loadEventFired');
    await send('Page.reload', { ignoreCache: true });
    await loaded;
    await delay(1600);
  }
  const menu = await evaluate(`({
    titleVisible: document.querySelector('#title-screen').classList.contains('active'),
    newGameButtons: document.querySelectorAll('[data-testid="new-game"]').length,
    title: document.title
  })`);
  await evaluate(`document.querySelector('#new-game-btn').click(); document.querySelector('[data-faction="${faction}"]').click();`);
  await delay(4200);
  const gameplay = await evaluate(`(() => {
    const canvas = document.querySelector('[data-testid="game-canvas"]');
    let pixelSum = 0;
    if (canvas) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const pixels = new Uint8Array(4);
        gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        pixelSum = [...pixels].reduce((a, b) => a + b, 0);
      }
    }
    return {
      canvasCount: document.querySelectorAll('[data-testid="game-canvas"]').length,
      canvasSize: canvas ? [canvas.width, canvas.height] : null,
      pixelSum,
      gameVisible: document.querySelector('#game-screen').classList.contains('active'),
      objective: document.querySelector('#objective-text').textContent,
      zone: document.querySelector('#zone-name').textContent,
      gold: document.querySelector('#gold-value').textContent,
      saveExists: Boolean(localStorage.getItem('korovany-gpt-5.6-sol-save-v1'))
    };
  })()`);
  results.push({ faction, menu, gameplay });
  if (faction === 'guard') {
    await key('KeyE', 'e');
    await delay(180);
    results.at(-1).orderAccepted = await evaluate(`document.querySelector('#objective-text').textContent.includes('Сопроводите корован')`);
  }
  if (faction === 'villain') {
    await key('KeyE', 'e');
    await key('KeyF', 'f');
    await delay(180);
    results.at(-1).commandAccepted = await evaluate(`document.querySelector('#objective-text').textContent.includes('Разграбьте корован')`);
  }
  if (faction === 'elf') {
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile('/tmp/korovany-smoke-game.png', Buffer.from(shot.data, 'base64'));
  }
}

await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
await delay(250);
const pauseVisible = await evaluate(`document.querySelector('#pause-screen').classList.contains('active')`);
await evaluate(`document.querySelector('#save-btn').click()`);
const saveValid = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('korovany-gpt-5.6-sol-save-v1')); return Boolean(s && s.version === 1 && s.faction === 'villain' && Array.isArray(s.position)); })()`);

await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('korovany-gpt-5.6-sol-save-v1'));
  s.faction = 'guard'; s.position = [-1, 1.05, 22]; s.gold = 100;
  s.body.leftLeg = 'severed'; s.body.bleed = 22;
  s.mission = { stage: 0, text: 'Получите приказ у командира', progress: 0 };
  localStorage.setItem('korovany-gpt-5.6-sol-save-v1', JSON.stringify(s));
})()`);
const reloaded = once('Page.loadEventFired');
await send('Page.reload', { ignoreCache: true });
await reloaded; await delay(1200);
await evaluate(`document.querySelector('#continue-btn').click()`); await delay(2600);
await key('KeyE', 'e'); await delay(200);
const shopAndProsthetic = await evaluate(`(() => {
  const shopVisible = document.querySelector('#shop-screen').classList.contains('active');
  const legButton = document.querySelector('[data-buy="leg"]');
  const limbWasLost = document.querySelector('#body-status').textContent.includes('потерян');
  legButton?.click();
  const save = JSON.parse(localStorage.getItem('korovany-gpt-5.6-sol-save-v1'));
  return { shopVisible, limbWasLost, purchaseEnabled: Boolean(legButton && !legButton.disabled), prostheticSaved: save.body.leftLeg === 'prosthetic', gold: save.gold };
})()`);

const failures = [];
for (const result of results) {
  if (!result.menu.titleVisible || result.menu.newGameButtons !== 1) failures.push(`${result.faction}: title menu`);
  if (!result.gameplay.gameVisible || result.gameplay.canvasCount !== 1) failures.push(`${result.faction}: canvas`);
  if (!result.gameplay.canvasSize || result.gameplay.canvasSize[0] < 500 || result.gameplay.canvasSize[1] < 400) failures.push(`${result.faction}: canvas size`);
  if (result.gameplay.pixelSum === 0) failures.push(`${result.faction}: empty WebGL pixel`);
  if (!result.gameplay.objective || !result.gameplay.zone) failures.push(`${result.faction}: HUD`);
  if (result.faction === 'guard' && !result.orderAccepted) failures.push('guard commander interaction');
  if (result.faction === 'villain' && !result.commandAccepted) failures.push('villain command interaction');
}
if (!pauseVisible) failures.push('pause overlay');
if (!saveValid) failures.push('localStorage save');
if (!shopAndProsthetic.shopVisible || !shopAndProsthetic.limbWasLost || !shopAndProsthetic.purchaseEnabled || !shopAndProsthetic.prostheticSaved) failures.push('shop/prosthetic flow');
if (browserErrors.length) failures.push(`browser errors: ${browserErrors.join(' | ')}`);

console.log(JSON.stringify({ results, pauseVisible, saveValid, shopAndProsthetic, browserErrors, failures }, null, 2));
await send('Page.close');
socket.close();
if (failures.length) process.exitCode = 1;
