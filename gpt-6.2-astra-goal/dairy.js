'use strict';
function bovineOffice(w = game.wagon) {
  return {
    x: w.x - 0.73 * Math.cos(w.angle) + 4.05 * Math.sin(w.angle),
    z: w.z + 0.73 * Math.sin(w.angle) + 4.05 * Math.cos(w.angle),
  };
}
function cowSound(signal) {
  if (signal === 0) {
    tone(125, 0.67, 'sawtooth', 0.065, 79);
    tone(244, 0.52, 'triangle', 0.038, 169);
  }
  if (signal === 1) {
    tone(786, 0.42, 'triangle', 0.1, 772);
    tone(1344, 0.27, 'sine', 0.039, 1311);
  }
  if (signal === 2) {
    noiseFoley(0.1, 420, 0.17);
    tone(88, 0.135, 'triangle', 0.11, 45);
  }
}
function speakCow() {
  if (game.inside) return notify('Бурёнка принимает на свежем воздухе.');
  const cow = bovineOffice(),
    d = distance(game, cow);
  if (d > 6) {
    cowSound(1);
    notify(targetBearing(cow) + ' Бурёнка на тракте · ' + Math.round(d) + ' м. Подойдите к колокольчику.', 4);
    return;
  }
  game.wagon.listening = 5;
  cowSound(0);
  const calls = ['Му-у', 'Динь', 'Топ'],
    sequences = [
      [0, 2, 1],
      [1, 0, 2],
      [2, 1, 0],
      [0, 1, 0],
      [2, 0, 2],
    ];
  const order = sequences[Math.floor(Math.random() * sequences.length)];
  let count = 0,
    seen = true,
    message = 'Запомните три знака начальницы. Ответьте в том же порядке.';
  function render() {
    modal(
      'МУниципальная служба перевозок',
      'Приём у Бурёнки',
      '<div class="cow-office"><img src="./assets/tale1.webp" alt="Бурёнка у мельницы"><div><strong>Бурёнка Первая</strong><small>Действительный корован I класса</small></div></div>' +
        '<p id="cow-message">' +
        message +
        '</p><p class="call-sequence" aria-live="polite">' +
        (seen
          ? order.map((i) => calls[i]).join(' · ')
          : order.map((v, i) => (i < count ? calls[v] : '◇')).join(' · ')) +
        '</p>' +
        (seen
          ? '<button id="cow-ready" class="action">Ответить Бурёнке</button>'
          : calls
              .map((v, i) => '<button class="cow-note action" data-call="' + i + '">' + v + '</button>')
              .join('')),
    );
    if (seen)
      $('cow-ready').onclick = () => {
        seen = false;
        message = 'Подайте три знака.';
        render();
      };
    else
      document.querySelectorAll('[data-call]').forEach(
        (b) =>
          (b.onclick = () => {
            const value = Number(b.dataset.call);
            cowSound(value);
            if (order[count] !== value) {
              seen = true;
              count = 0;
              message = 'Переводчик записал «сдать телегу в гардероб». Бурёнка просит повторить.';
              render();
              return;
            }
            if (++count < order.length) {
              render();
              return;
            }
            closeModal();
            certifyCow();
            if (!$('dialog').open) capture();
          }),
      );
  }
  render();
}
function certifyCow() {
  const g = game,
    s = g.story,
    w = g.wagon;
  if (!s.hoof) {
    s.hoof = true;
    s.entries.push([
      'Подпись копытом',
      'Бурёнка засвидетельствовала накладную. Её подпись принимают на тракте и в имперском суде.',
    ]);
  }
  w.listening = 1;
  if (s.phase === 'escort') {
    const pickets = g.actors.filter((a) => a.hp > 0 && a.tag === 'ambush');
    if (pickets.length) {
      for (const a of pickets) {
        a.team = 'neutral';
        a.tag = 'inspector';
        a.windup = 0;
      }
      speak('Начальник засады', 'Виноват. В приказе сказано грабить обозы. А вы, вижу, юридически корова.');
    } else speak('Возница', 'Разрешение мычать получено. Поехали!');
  } else if (w.cool <= 0) {
    for (const a of g.actors.filter((a) => a.hp > 0 && a.tag === 'escort')) {
      a.team = 'escort';
      a.windup = 0;
    }
    claimCargo();
    speak('Переводчик', 'Груз передан добровольно. Потерпевшая собственноручно его отмукала.');
  } else speak('Бурёнка Первая', 'Му. (Копию выдали. Следующий приём после погрузки.)');
  checkpoint();
  drawHud();
}
function claimCargo() {
  const g = game;
  g.coins += 42;
  g.bandages++;
  g.robbed++;
  g.wagon.cool = 95;
  if (g.side === 0 && g.stage === 1) g.stage = 2;
  notify('Корован выдал 42 монеты и бинт');
  tone(560, 0.3);
}
function stampDairy(index) {
  const site = dairies[index],
    s = game.story;
  s.dairyStamps ||= [];
  if (s.dairyStamps.includes(index)) {
    notify('В молочном паспорте уже есть ' + site.stamp + '.');
    return;
  }
  s.dairyStamps.push(index);
  const all = s.dairyStamps.length === 4;
  game.coins += all ? 32 : 6;
  const line = all
    ? 'Четыре печати. Палата признала вас пастухом международного образца и выдала 32 монеты.'
    : 'Печать «' + site.stamp + '» и 6 монет за выезд. Собрано ' + s.dairyStamps.length + ' из 4.';
  s.entries.push([site.title, line]);
  checkpoint();
  cowSound(1);
  scene('Молочный паспорт', site.title, 1, 'Дежурный по сливкам', line, [['Убрать паспорт', () => {}]]);
}
