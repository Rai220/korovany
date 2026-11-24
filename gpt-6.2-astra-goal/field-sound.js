'use strict';

// Source recordings live in a classic script so the same mixer also runs under file://.
const fieldBuffers = new Map(),
  pendingFieldBuffers = new Map();
let fieldAirNodes = null;
function fieldBuffer(name) {
  if (fieldBuffers.has(name)) return Promise.resolve(fieldBuffers.get(name));
  if (!pendingFieldBuffers.has(name)) {
    const bytes = Uint8Array.from(atob(fieldRecordings[name]), (char) => char.charCodeAt(0));
    const task = audioCtx
      .decodeAudioData(bytes.buffer)
      .then((buffer) => {
        fieldBuffers.set(name, buffer);
        return buffer;
      })
      .finally(() => pendingFieldBuffers.delete(name));
    pendingFieldBuffers.set(name, task);
  }
  return pendingFieldBuffers.get(name);
}
function fieldStrike(name, level = 1, heavy = false) {
  if (!soundOn || !active || document.hidden || !audioCtx || !prefs.effects) return;
  const ctx = audioCtx,
    at = ctx.currentTime;
  fieldBuffer(name)
    .then((buffer) => {
      if (!soundOn || !active || document.hidden || $('dialog').open || ctx.currentTime - at > 0.23) return;
      const sound = ctx.createBufferSource(),
        gain = ctx.createGain();
      sound.buffer = buffer;
      sound.playbackRate.value = (heavy ? 0.88 : 1) * (0.94 + 0.12 * Math.random());
      gain.gain.value = prefs.effects * level * (realmVoice.active ? 0.62 : 1);
      sound.connect(gain).connect(ctx.destination);
      sound.onended = () => {
        sound.disconnect();
        gain.disconnect();
      };
      sound.start();
    })
    .catch(() => {});
}
function scoreAir(duck) {
  if (!active || !game || !prefs.effects || !audioCtx || document.hidden || scoreMode !== 'play') {
    stopScoreAir();
    return;
  }
  const ctx = audioCtx;
  if (!fieldAirNodes) {
    const layers = {};
    fieldAirNodes = layers;
    for (const name of ['grove', 'water']) {
      fieldBuffer(name)
        .then((buffer) => {
          if (fieldAirNodes !== layers) return;
          const source = ctx.createBufferSource(),
            gain = ctx.createGain(),
            pan = ctx.createStereoPanner();
          source.buffer = buffer;
          source.loop = true;
          gain.gain.value = 0;
          source.connect(gain).connect(pan).connect(ctx.destination);
          source.start(0, (performance.now() * 0.001) % buffer.duration);
          layers[name] = { source, gain, pan };
        })
        .catch(() => {});
    }
    for (const name of ['swish', 'ring']) fieldBuffer(name).catch(() => {});
  }
  const zone = zoneAt(game.x, game.z),
    dz = wrapped(streamZ(game.x) - game.z);
  const near = Math.max(0, 1 - Math.abs(dz) / 24);
  const master = prefs.effects * (duck ? 0.4 : 1) * ($('dialog').open ? 0.45 : 1) * (game.inside ? 0.055 : 1);
  const grove = (zone === 2 ? 0.53 : zone === 0 ? 0.33 : zone === 1 ? 0.16 : 0.1) * master;
  const water = near * near * master * 0.96;
  const right = -Math.sin(game.yaw) * Math.sign(dz) * Math.min(1, Math.abs(dz) / 3);
  for (const [name, level, direction] of [
    ['grove', grove, 0],
    ['water', water, right * 0.74],
  ]) {
    const layer = fieldAirNodes[name];
    if (!layer) continue;
    layer.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.38);
    layer.pan.pan.setTargetAtTime(direction, ctx.currentTime, 0.29);
  }
}
function stopScoreAir() {
  if (!fieldAirNodes) return;
  for (const { source, gain, pan } of Object.values(fieldAirNodes)) {
    source.stop();
    source.disconnect();
    gain.disconnect();
    pan.disconnect();
  }
  fieldAirNodes = null;
}
