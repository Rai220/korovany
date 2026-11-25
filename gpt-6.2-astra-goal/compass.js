'use strict';
function trailCompass(player, target) {
  const canvas = $('trail-compass'),
    width = canvas.clientWidth;
  if (!width) return;
  const ratio = Math.min(2, devicePixelRatio);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(42 * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(42 * ratio);
  }
  const pen = canvas.getContext('2d');
  pen.setTransform(ratio, 0, 0, ratio, 0, 0);
  pen.clearRect(0, 0, width, 42);
  const wash = pen.createLinearGradient(0, 0, width, 0);
  wash.addColorStop(0, '#10221c00');
  wash.addColorStop(0.22, '#12211dbb');
  wash.addColorStop(0.78, '#12211dbb');
  wash.addColorStop(1, '#10221c00');
  pen.fillStyle = wash;
  pen.fillRect(0, 0, width, 32);
  const heading = (-player.yaw * 180) / Math.PI,
    scale = width / 118;
  const labels = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  pen.textAlign = 'center';
  pen.font = 'bold 12px Georgia,serif';
  for (let n = Math.ceil((heading - 58) / 5); n <= Math.floor((heading + 58) / 5); n++) {
    const deg = n * 5,
      x = width / 2 + (deg - heading) * scale,
      major = n % 9 === 0;
    pen.fillStyle = major ? '#fff0ce' : '#d2c39b';
    pen.fillRect(Math.round(x), major ? 19 : 22, 1, major ? 7 : 3);
    if (major) pen.fillText(labels[(((n / 9) % 8) + 8) % 8], x, 15);
  }
  pen.fillStyle = '#e8c283';
  pen.beginPath();
  pen.moveTo(width / 2 - 3, 32);
  pen.lineTo(width / 2 + 3, 32);
  pen.lineTo(width / 2, 27);
  pen.fill();
  if (!target || player.inside) return;
  const dx = target.x - player.x,
    dz = target.z - player.z;
  const a = Math.atan2(-(player.march ? dx : wrapped(dx)), -(player.march ? dz : wrapped(dz)));
  const off = (-angles(a - player.yaw) * 180) / Math.PI;
  const x = width / 2 + clamp(off, -53, 53) * scale;
  pen.fillStyle = '#ffcf6e';
  pen.strokeStyle = '#554127';
  pen.lineWidth = 1.1;
  pen.beginPath();
  if (Math.abs(off) > 54) {
    const dir = Math.sign(off);
    pen.moveTo(x + 4 * dir, 13);
    pen.lineTo(x - 3 * dir, 9);
    pen.lineTo(x - 3 * dir, 17);
  } else {
    pen.moveTo(x, 5);
    pen.lineTo(x + 4, 12);
    pen.lineTo(x, 19);
    pen.lineTo(x - 4, 12);
  }
  pen.closePath();
  pen.fill();
  pen.stroke();
}
